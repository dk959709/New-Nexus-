import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { errorResponse } from '../shared.js';

export const skillsRouter = Router();

const MAX_SKILL_CHARS = 24000;
const MAX_FILE_BYTES = 200 * 1024; // 200 KB
const MAX_FILES_COMBINED = 3;
const FETCH_TIMEOUT_MS = 10000; // 10 seconds

// Tiny in-memory rate limit: 20 requests per 10 minutes per IP
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const ipRateLimitMap = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = ipRateLimitMap.get(ip) || [];
  const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (validTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    ipRateLimitMap.set(ip, validTimestamps);
    return false;
  }
  validTimestamps.push(now);
  ipRateLimitMap.set(ip, validTimestamps);
  return true;
}

// 5-minute in-memory cache by normalized URL
interface SkillFetchResponsePayload {
  ok: true;
  repo: string;
  branch: string;
  files: Array<{ path: string; chars: number }>;
  suggestedName: string;
  text: string;
  truncated: boolean;
  license: string | null;
  sourceUrl: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const responseCache = new Map<string, { data: SkillFetchResponsePayload; expiresAt: number }>();

const fetchGithubSchema = z.object({
  url: z.string().trim().min(1).max(300),
});

const OWNER_REPO_REGEX = /^[A-Za-z0-9_.-]{1,100}$/;
const ALLOWED_EXTENSIONS = ['.md', '.mdx', '.txt'];

function hasAllowedExtension(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function isMarkdownFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return lower.endsWith('.md') || lower.endsWith('.mdx');
}

interface ParsedGithubTarget {
  owner: string;
  repo: string;
  kind: 'root' | 'tree' | 'blob';
  branch?: string;
  pathSegments: string[];
  normalizedUrl: string;
}

function parseGithubUrl(rawUrl: string): { ok: true; target: ParsedGithubTarget } | { ok: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return {
      ok: false,
      error: 'Invalid URL. Paste a public GitHub link like https://github.com/owner/repo.',
    };
  }

  if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== 'github.com') {
    return {
      ok: false,
      error: 'Only https://github.com links are supported.',
    };
  }

  if (parsed.username || parsed.password || parsed.port) {
    return {
      ok: false,
      error: 'Invalid GitHub link format.',
    };
  }

  const rawSegments = parsed.pathname.split('/').filter((seg) => seg.length > 0);
  if (rawSegments.length < 2) {
    return {
      ok: false,
      error: 'GitHub link must include owner and repository (https://github.com/owner/repo).',
    };
  }

  let decodedSegments: string[];
  try {
    decodedSegments = rawSegments.map((seg) => decodeURIComponent(seg));
  } catch {
    return {
      ok: false,
      error: 'Invalid characters in GitHub URL path.',
    };
  }

  for (const seg of [...rawSegments, ...decodedSegments]) {
    if (
      seg === '.' ||
      seg === '..' ||
      seg.includes('..') ||
      seg.includes('\0') ||
      seg.includes('\\')
    ) {
      return {
        ok: false,
        error: 'Invalid path segments in GitHub URL.',
      };
    }
  }

  const owner = decodedSegments[0];
  let repo = decodedSegments[1];
  if (repo.toLowerCase().endsWith('.git')) {
    repo = repo.slice(0, -4);
  }

  if (
    !OWNER_REPO_REGEX.test(owner) ||
    !OWNER_REPO_REGEX.test(repo) ||
    owner === '.' ||
    owner === '..' ||
    repo === '.' ||
    repo === '..'
  ) {
    return {
      ok: false,
      error: 'Invalid GitHub owner or repository name.',
    };
  }

  if (decodedSegments.length === 2) {
    return {
      ok: true,
      target: {
        owner,
        repo,
        kind: 'root',
        pathSegments: [],
        normalizedUrl: `https://github.com/${owner}/${repo}`,
      },
    };
  }

  const mode = decodedSegments[2];
  if (mode !== 'tree' && mode !== 'blob') {
    return {
      ok: false,
      error: 'Only repository root, /tree/{branch}/..., or /blob/{branch}/... links are supported.',
    };
  }

  const branch = decodedSegments[3];
  if (!branch || !/^[A-Za-z0-9_.\-/]{1,100}$/.test(branch) || branch.includes('..')) {
    return {
      ok: false,
      error: 'GitHub link is missing a valid branch name.',
    };
  }

  const pathSegments = decodedSegments.slice(4);
  for (const seg of pathSegments) {
    if (!seg || seg.length > 120 || !/^[A-Za-z0-9_.\- ]+$/.test(seg) || seg.includes('..')) {
      return {
        ok: false,
        error: 'Invalid file or folder path in GitHub link.',
      };
    }
  }

  if (mode === 'blob') {
    if (pathSegments.length === 0) {
      return {
        ok: false,
        error: 'File link must point to a .md, .mdx, or .txt file.',
      };
    }
    const fileName = pathSegments[pathSegments.length - 1];
    if (!hasAllowedExtension(fileName)) {
      return {
        ok: false,
        error: 'Only .md, .mdx, and .txt text files can be imported as skills.',
      };
    }
  }

  const joinedPath = pathSegments.map((s) => encodeURIComponent(s)).join('/');
  const normalizedUrl =
    pathSegments.length > 0
      ? `https://github.com/${owner}/${repo}/${mode}/${encodeURIComponent(branch)}/${joinedPath}`
      : `https://github.com/${owner}/${repo}/${mode}/${encodeURIComponent(branch)}`;

  return {
    ok: true,
    target: {
      owner,
      repo,
      kind: mode,
      branch,
      pathSegments,
      normalizedUrl,
    },
  };
}

async function safeGithubFetch(
  targetUrl: string,
  allowedHost: 'api.github.com' | 'raw.githubusercontent.com',
): Promise<globalThis.Response> {
  let currentUrl = targetUrl;

  for (let redirectCount = 0; redirectCount <= 3; redirectCount++) {
    const parsed = new URL(currentUrl);
    if (parsed.protocol !== 'https:' || parsed.hostname !== allowedHost) {
      throw new Error('Blocked request to disallowed host.');
    }

    const headers: Record<string, string> = {
      'User-Agent': 'NEXUS-Skills',
      Accept:
        allowedHost === 'api.github.com'
          ? 'application/vnd.github+json'
          : 'text/plain; charset=utf-8',
    };

    // Only send GITHUB_TOKEN to api.github.com, never to raw.githubusercontent.com
    const githubToken = process.env.GITHUB_TOKEN?.trim();
    if (allowedHost === 'api.github.com' && githubToken) {
      headers.Authorization = `Bearer ${githubToken}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(currentUrl, {
        method: 'GET',
        headers,
        redirect: 'manual',
        signal: controller.signal,
      });

      if (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) {
        const location = res.headers.get('location');
        if (!location) {
          throw new Error('Redirect missing location header.');
        }
        const nextUrl = new URL(location, currentUrl);
        if (nextUrl.protocol !== 'https:' || nextUrl.hostname !== allowedHost) {
          throw new Error('Redirect to external host is not permitted.');
        }
        currentUrl = nextUrl.toString();
        continue;
      }

      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error('Too many redirects from GitHub.');
}

interface GithubContentEntry {
  name?: string;
  path?: string;
  type?: 'file' | 'dir' | string;
  size?: number;
}

function buildGithubApiContentsUrl(
  owner: string,
  repo: string,
  pathSegments: string[],
  branch: string,
): string {
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);
  const encodedPath = pathSegments.map((s) => encodeURIComponent(s)).join('/');
  const encodedBranch = encodeURIComponent(branch);
  if (encodedPath) {
    return `https://api.github.com/repos/${encodedOwner}/${encodedRepo}/contents/${encodedPath}?ref=${encodedBranch}`;
  }
  return `https://api.github.com/repos/${encodedOwner}/${encodedRepo}/contents?ref=${encodedBranch}`;
}

function buildRawGithubUrl(
  owner: string,
  repo: string,
  branch: string,
  filePath: string,
): string {
  const cleanSegments = filePath
    .split('/')
    .filter(Boolean)
    .map((s) => encodeURIComponent(s));
  return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/${cleanSegments.join('/')}`;
}

function truncateCleanly(rawText: string, maxChars: number): { text: string; truncated: boolean } {
  const cleaned = rawText.replace(/\0/g, '').replace(/\r\n/g, '\n').trim();
  if (cleaned.length <= maxChars) {
    return { text: cleaned, truncated: false };
  }

  const slice = cleaned.slice(0, maxChars);
  // Prefer cutting cleanly at a paragraph break (\n\n) in the last 25% of the limit
  const minCutIndex = Math.floor(maxChars * 0.75);
  const paraIndex = slice.lastIndexOf('\n\n');
  if (paraIndex >= minCutIndex) {
    return { text: slice.slice(0, paraIndex).trimEnd(), truncated: true };
  }

  const lineIndex = slice.lastIndexOf('\n');
  if (lineIndex >= minCutIndex) {
    return { text: slice.slice(0, lineIndex).trimEnd(), truncated: true };
  }

  return { text: slice.trimEnd(), truncated: true };
}

function deriveSuggestedName(
  combinedText: string,
  repo: string,
  pathSegments: string[],
): string {
  // 1. Check YAML frontmatter name:
  const frontmatterMatch = combinedText.match(/^---\n([\s\S]{1,1200}?)\n---/);
  if (frontmatterMatch) {
    const nameLine = frontmatterMatch[1].match(/^\s*name\s*:\s*(.+)$/m);
    if (nameLine && nameLine[1]) {
      const fmName = nameLine[1].replace(/^['"]|['"]$/g, '').trim();
      if (fmName) return fmName.slice(0, 60);
    }
  }

  // 2. Check first Markdown # Heading
  const headingMatch = combinedText.match(/^\s*#\s+([^\n#]+)/m);
  if (headingMatch && headingMatch[1]) {
    const cleanHeading = headingMatch[1]
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_`~]/g, '')
      .trim();
    if (cleanHeading) return cleanHeading.slice(0, 60);
  }

  // 3. Fallback to folder/file name or repo name
  if (pathSegments.length > 0) {
    const lastSeg = pathSegments[pathSegments.length - 1].replace(/\.(md|mdx|txt)$/i, '');
    if (lastSeg && !/^(skill|skills|readme)$/i.test(lastSeg)) {
      return lastSeg.slice(0, 60);
    }
    if (pathSegments.length >= 2) {
      const parentSeg = pathSegments[pathSegments.length - 2];
      if (parentSeg && !/^(skill|skills)$/i.test(parentSeg)) {
        return parentSeg.slice(0, 60);
      }
    }
  }

  return repo.slice(0, 60);
}

skillsRouter.post('/api/skills/fetch-github', async (req: Request, res: Response) => {
  const clientIp =
    (typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : req.ip) || 'unknown';

  if (!checkRateLimit(clientIp)) {
    return errorResponse(res, 429, 'Too many skill fetch requests. Please wait a few minutes and try again.');
  }

  const parsedBody = fetchGithubSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return errorResponse(res, 400, 'Please enter a valid GitHub link (max 300 characters).');
  }

  const parsedUrlResult = parseGithubUrl(parsedBody.data.url);
  if (!parsedUrlResult.ok) {
    return errorResponse(res, 400, parsedUrlResult.error);
  }

  const { owner, repo, kind, branch: urlBranch, pathSegments, normalizedUrl } = parsedUrlResult.target;

  // Check 5-minute in-memory cache
  const cached = responseCache.get(normalizedUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json(cached.data);
  }

  try {
    // 1. Fetch repository metadata for default_branch & license
    const repoMetaUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const repoRes = await safeGithubFetch(repoMetaUrl, 'api.github.com');

    if (repoRes.status === 403 || repoRes.status === 429) {
      return errorResponse(res, 429, 'GitHub rate limit reached. Try again later.');
    }
    if (repoRes.status === 404) {
      return errorResponse(
        res,
        404,
        'GitHub repository not found. Make sure the link points to a public repository.',
      );
    }
    if (!repoRes.ok) {
      return errorResponse(res, 502, 'Could not reach GitHub API. Please try again.');
    }

    const repoMeta = (await repoRes.json()) as {
      default_branch?: string;
      license?: { spdx_id?: string | null; name?: string | null } | null;
    };

    const effectiveBranch = urlBranch || repoMeta.default_branch || 'main';
    if (!/^[A-Za-z0-9_.\-/]{1,100}$/.test(effectiveBranch) || effectiveBranch.includes('..')) {
      return errorResponse(res, 400, 'Invalid repository branch name.');
    }

    const rawLicense = repoMeta.license?.spdx_id || null;
    const license = rawLicense && rawLicense !== 'NOASSERTION' ? rawLicense : null;

    let selectedFilePaths: string[] = [];

    if (kind === 'blob') {
      // Check file metadata first to ensure it exists and is <= 200 KB
      const blobContentsUrl = buildGithubApiContentsUrl(owner, repo, pathSegments, effectiveBranch);
      const blobMetaRes = await safeGithubFetch(blobContentsUrl, 'api.github.com');

      if (blobMetaRes.status === 403 || blobMetaRes.status === 429) {
        return errorResponse(res, 429, 'GitHub rate limit reached. Try again later.');
      }
      if (blobMetaRes.status === 404) {
        return errorResponse(res, 404, 'File not found in this GitHub repository.');
      }
      if (!blobMetaRes.ok) {
        return errorResponse(res, 502, 'Could not verify file metadata on GitHub.');
      }

      const blobMeta = (await blobMetaRes.json()) as GithubContentEntry | GithubContentEntry[];
      if (Array.isArray(blobMeta) || blobMeta.type !== 'file') {
        return errorResponse(res, 400, 'That link points to a folder, not a file.');
      }
      if (typeof blobMeta.size === 'number' && blobMeta.size > MAX_FILE_BYTES) {
        return errorResponse(res, 400, 'File is larger than 200 KB. Skills must be under 200 KB.');
      }

      const cleanPath = blobMeta.path || pathSegments.join('/');
      if (!hasAllowedExtension(cleanPath)) {
        return errorResponse(res, 400, 'Only .md, .mdx, and .txt files are supported.');
      }

      selectedFilePaths = [cleanPath];
    } else {
      // kind === 'root' or 'tree'
      const dirContentsUrl = buildGithubApiContentsUrl(owner, repo, pathSegments, effectiveBranch);
      const dirRes = await safeGithubFetch(dirContentsUrl, 'api.github.com');

      if (dirRes.status === 403 || dirRes.status === 429) {
        return errorResponse(res, 429, 'GitHub rate limit reached. Try again later.');
      }
      if (dirRes.status === 404) {
        return errorResponse(res, 404, 'Folder or branch not found in this GitHub repository.');
      }
      if (!dirRes.ok) {
        return errorResponse(res, 502, 'Could not list repository files from GitHub.');
      }

      const dirPayload = (await dirRes.json()) as GithubContentEntry | GithubContentEntry[];
      if (!Array.isArray(dirPayload)) {
        // User passed /tree/ link to a single file
        if (
          dirPayload &&
          dirPayload.type === 'file' &&
          dirPayload.path &&
          hasAllowedExtension(dirPayload.path) &&
          (typeof dirPayload.size !== 'number' || dirPayload.size <= MAX_FILE_BYTES)
        ) {
          selectedFilePaths = [dirPayload.path];
        } else {
          return errorResponse(res, 404, 'No usable skill text files (.md, .mdx, .txt under 200 KB) found.');
        }
      } else {
        const validFiles = dirPayload.filter(
          (item): item is Required<Pick<GithubContentEntry, 'name' | 'path'>> & GithubContentEntry =>
            Boolean(
              item &&
                item.type === 'file' &&
                typeof item.name === 'string' &&
                typeof item.path === 'string' &&
                !item.path.includes('..') &&
                hasAllowedExtension(item.name) &&
                (typeof item.size !== 'number' || item.size <= MAX_FILE_BYTES),
            ),
        );

        // Priority order:
        // 1. SKILL.md
        // 2. skill.md
        // 3. SKILLS.md
        // 4. Any other .md inside a "skills" folder (first 3)
        // 5. README.md (or case-insensitive readme)
        const exactSkillUpper = validFiles.find((f) => f.name === 'SKILL.md');
        const exactSkillLower = validFiles.find((f) => f.name === 'skill.md');
        const exactSkillsUpper = validFiles.find((f) => f.name === 'SKILLS.md');

        if (exactSkillUpper) {
          selectedFilePaths = [exactSkillUpper.path];
        } else if (exactSkillLower) {
          selectedFilePaths = [exactSkillLower.path];
        } else if (exactSkillsUpper) {
          selectedFilePaths = [exactSkillsUpper.path];
        } else {
          // Check if current folder is already inside a "skills" folder or has a "skills" subfolder
          const isInsideSkillsFolder = pathSegments.some((seg) => seg.toLowerCase() === 'skills');
          let skillsFolderMdFiles: string[] = [];

          if (isInsideSkillsFolder) {
            skillsFolderMdFiles = validFiles
              .filter((f) => isMarkdownFile(f.name) && !/^readme\./i.test(f.name))
              .slice(0, MAX_FILES_COMBINED)
              .map((f) => f.path);
          }

          if (skillsFolderMdFiles.length === 0) {
            const skillsSubdir = dirPayload.find(
              (item) =>
                item &&
                item.type === 'dir' &&
                typeof item.name === 'string' &&
                item.name.toLowerCase() === 'skills',
            );

            if (skillsSubdir && skillsSubdir.name) {
              const subSegments = [...pathSegments, skillsSubdir.name];
              const subUrl = buildGithubApiContentsUrl(owner, repo, subSegments, effectiveBranch);
              const subRes = await safeGithubFetch(subUrl, 'api.github.com').catch(() => null);
              if (subRes && subRes.ok) {
                const subPayload = (await subRes.json()) as GithubContentEntry | GithubContentEntry[];
                if (Array.isArray(subPayload)) {
                  const subMdFiles = subPayload.filter(
                    (item): item is Required<Pick<GithubContentEntry, 'name' | 'path'>> & GithubContentEntry =>
                      Boolean(
                        item &&
                          item.type === 'file' &&
                          typeof item.name === 'string' &&
                          typeof item.path === 'string' &&
                          !item.path.includes('..') &&
                          isMarkdownFile(item.name) &&
                          (typeof item.size !== 'number' || item.size <= MAX_FILE_BYTES),
                      ),
                  );
                  skillsFolderMdFiles = subMdFiles.slice(0, MAX_FILES_COMBINED).map((f) => f.path);
                }
              }
            }
          }

          if (skillsFolderMdFiles.length > 0) {
            selectedFilePaths = skillsFolderMdFiles.slice(0, MAX_FILES_COMBINED);
          } else {
            const exactReadme =
              validFiles.find((f) => f.name === 'README.md') ||
              validFiles.find((f) => /^readme\.(md|mdx|txt)$/i.test(f.name));
            if (exactReadme) {
              selectedFilePaths = [exactReadme.path];
            } else if (validFiles.length > 0) {
              selectedFilePaths = validFiles.slice(0, MAX_FILES_COMBINED).map((f) => f.path);
            }
          }
        }
      }
    }

    if (selectedFilePaths.length === 0) {
      return errorResponse(
        res,
        404,
        'No skill instructions found. Add a repo that contains a SKILL.md, skills/ folder, or README.md (under 200 KB).',
      );
    }

    const downloadedFiles: Array<{ path: string; chars: number }> = [];
    const textBlocks: string[] = [];

    for (const filePath of selectedFilePaths.slice(0, MAX_FILES_COMBINED)) {
      if (filePath.includes('..') || !hasAllowedExtension(filePath)) {
        continue;
      }

      const rawUrl = buildRawGithubUrl(owner, repo, effectiveBranch, filePath);
      const rawRes = await safeGithubFetch(rawUrl, 'raw.githubusercontent.com');

      if (rawRes.status === 403 || rawRes.status === 429) {
        return errorResponse(res, 429, 'GitHub rate limit reached. Try again later.');
      }
      if (!rawRes.ok) {
        continue;
      }

      const contentLengthHeader = rawRes.headers.get('content-length');
      if (contentLengthHeader && Number(contentLengthHeader) > MAX_FILE_BYTES) {
        continue;
      }

      const rawBuffer = await rawRes.arrayBuffer();
      if (rawBuffer.byteLength > MAX_FILE_BYTES) {
        continue;
      }

      const rawString = new TextDecoder('utf-8').decode(rawBuffer);
      const cleanFileText = rawString.replace(/\0/g, '').replace(/\r\n/g, '\n').trim();
      if (!cleanFileText) {
        continue;
      }

      downloadedFiles.push({
        path: filePath,
        chars: cleanFileText.length,
      });

      if (selectedFilePaths.length > 1) {
        textBlocks.push(`<!-- File: ${filePath} -->\n${cleanFileText}`);
      } else {
        textBlocks.push(cleanFileText);
      }
    }

    if (downloadedFiles.length === 0 || textBlocks.length === 0) {
      return errorResponse(
        res,
        404,
        'No readable skill text found in the selected GitHub file(s) (must be non-empty and under 200 KB).',
      );
    }

    const combinedRaw = textBlocks.join('\n\n');
    const { text: finalText, truncated } = truncateCleanly(combinedRaw, MAX_SKILL_CHARS);

    if (!finalText.trim()) {
      return errorResponse(res, 404, 'The skill file appears to be empty.');
    }

    const suggestedName = deriveSuggestedName(finalText, repo, pathSegments);

    const responsePayload: SkillFetchResponsePayload = {
      ok: true,
      repo: `${owner}/${repo}`,
      branch: effectiveBranch,
      files: downloadedFiles,
      suggestedName,
      text: finalText,
      truncated,
      license,
      sourceUrl: normalizedUrl,
    };

    responseCache.set(normalizedUrl, {
      data: responsePayload,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return res.json(responsePayload);
  } catch (err: unknown) {
    const isAbort =
      err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'));
    if (isAbort) {
      return errorResponse(res, 504, 'GitHub request timed out after 10 seconds. Please try again.');
    }
    return errorResponse(res, 502, 'Could not fetch skill from GitHub. Please check the link and try again.');
  }
});
