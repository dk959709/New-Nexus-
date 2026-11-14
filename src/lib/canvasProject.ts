export const MAX_PROJECT_FILES = 40;
export const MAX_PROJECT_CHARS = 300000;

export interface ProjectFile {
  path: string;
  content: string;
}

export interface ProjectTreeNode {
  kind: 'folder' | 'file';
  name: string;
  path: string;
  children?: ProjectTreeNode[];
}

const VALID_PATH_CHARS_REGEX = /^[A-Za-z0-9_\-./@]+$/;

export function isValidProjectPath(path: string): boolean {
  if (typeof path !== 'string') return false;
  if (path.length < 1 || path.length > 120) return false;
  if (path.startsWith('/') || path.endsWith('/')) return false;
  if (path.includes('..') || path.includes('//')) return false;
  if (!VALID_PATH_CHARS_REGEX.test(path)) return false;

  const parts = path.split('/');
  for (const part of parts) {
    if (!part || part === '.' || part === '..') {
      return false;
    }
  }
  return true;
}

export function parseProjectBundle(text: string): { files: ProjectFile[]; errors: string[] } {
  const files: ProjectFile[] = [];
  const errors: string[] = [];
  if (typeof text !== 'string' || !text) {
    return { files, errors };
  }

  const markerSpans: Array<{ rawPath: string; lineStart: number; contentStart: number }> = [];
  let pos = 0;
  const len = text.length;

  while (pos <= len) {
    const nextNl = text.indexOf('\n', pos);
    const lineEnd = nextNl === -1 ? len : nextNl;
    const lineWithoutCr =
      lineEnd > pos && text[lineEnd - 1] === '\r'
        ? text.slice(pos, lineEnd - 1)
        : text.slice(pos, lineEnd);

    if (lineWithoutCr.startsWith('=== FILE: ') && lineWithoutCr.endsWith(' ===')) {
      const rawPath = lineWithoutCr.slice(
        '=== FILE: '.length,
        lineWithoutCr.length - ' ==='.length,
      );
      const contentStart = nextNl === -1 ? len : nextNl + 1;
      markerSpans.push({ rawPath, lineStart: pos, contentStart });
    }

    if (nextNl === -1) break;
    pos = nextNl + 1;
  }

  const seenPaths = new Set<string>();

  for (let i = 0; i < markerSpans.length; i++) {
    const { rawPath, contentStart } = markerSpans[i];
    const rawEnd = i + 1 < markerSpans.length ? markerSpans[i + 1].lineStart : len;
    const rawSlice = text.slice(contentStart, rawEnd);
    const content = rawSlice.replace(/\r?\n$/, '').replace(/\r\n/g, '\n');

    if (!isValidProjectPath(rawPath)) {
      errors.push(`Invalid file path skipped: "${rawPath}"`);
      continue;
    }

    if (seenPaths.has(rawPath)) {
      errors.push(`Duplicate file path skipped: "${rawPath}"`);
      continue;
    }

    if (files.length >= MAX_PROJECT_FILES) {
      errors.push(`Maximum file limit (${MAX_PROJECT_FILES}) reached; extra files were skipped.`);
      break;
    }

    seenPaths.add(rawPath);
    files.push({ path: rawPath, content });
  }

  return { files, errors };
}

export function serializeProject(files: ProjectFile[]): string {
  if (!Array.isArray(files) || files.length === 0) return '';
  return files.map((file) => `=== FILE: ${file.path} ===\n${file.content}\n`).join('');
}

export function projectTotalChars(files: ProjectFile[]): number {
  let total = 0;
  for (const file of files) {
    total += file.content.length;
  }
  return total;
}

export function listFolders(files: ProjectFile[]): string[] {
  const folderSet = new Set<string>();
  for (const file of files) {
    const parts = file.path.split('/');
    if (parts.length > 1) {
      let accum = '';
      for (let i = 0; i < parts.length - 1; i++) {
        accum = accum ? `${accum}/${parts[i]}` : parts[i];
        folderSet.add(accum);
      }
    }
  }
  return Array.from(folderSet).sort((a, b) => a.localeCompare(b));
}

export function buildTree(files: ProjectFile[]): ProjectTreeNode[] {
  const root: ProjectTreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split('/');
    let currentList = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLast = i === parts.length - 1;

      if (isLast) {
        currentList.push({
          kind: 'file',
          name: part,
          path: currentPath,
        });
      } else {
        let folderNode = currentList.find((n) => n.kind === 'folder' && n.name === part);
        if (!folderNode) {
          folderNode = {
            kind: 'folder',
            name: part,
            path: currentPath,
            children: [],
          };
          currentList.push(folderNode);
        }
        if (!folderNode.children) {
          folderNode.children = [];
        }
        currentList = folderNode.children;
      }
    }
  }

  const sortNodes = (nodes: ProjectTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.children) {
        sortNodes(node.children);
      }
    }
  };

  sortNodes(root);
  return root;
}

export function renamePath(
  files: ProjectFile[],
  oldPath: string,
  newPath: string,
): { files: ProjectFile[]; error: string | null } {
  const cleanOld = oldPath.trim();
  const cleanNew = newPath.trim();

  if (!isValidProjectPath(cleanNew)) {
    return {
      files,
      error:
        'Invalid path. Use letters, numbers, _, -, ., /, @ (no leading "/", "..", or "//", max 120 chars).',
    };
  }

  if (cleanOld === cleanNew) {
    return { files: [...files], error: null };
  }

  const isExactFile = files.some((f) => f.path === cleanOld);
  if (isExactFile) {
    const hasCollision = files.some(
      (f) =>
        f.path !== cleanOld &&
        (f.path === cleanNew ||
          f.path.startsWith(`${cleanNew}/`) ||
          cleanNew.startsWith(`${f.path}/`)),
    );
    if (hasCollision) {
      return {
        files,
        error: `A file or folder already exists at "${cleanNew}".`,
      };
    }

    return {
      files: files.map((f) => (f.path === cleanOld ? { ...f, path: cleanNew } : f)),
      error: null,
    };
  }

  const folderPrefix = `${cleanOld}/`;
  const matchingFolderFiles = files.filter((f) => f.path.startsWith(folderPrefix));
  if (matchingFolderFiles.length === 0) {
    return {
      files,
      error: `Path "${cleanOld}" was not found in the project.`,
    };
  }

  if (cleanNew.startsWith(folderPrefix)) {
    return {
      files,
      error: 'Cannot rename a folder inside itself.',
    };
  }

  const updatedFiles: ProjectFile[] = [];
  for (const file of files) {
    if (file.path.startsWith(folderPrefix)) {
      const candidatePath = `${cleanNew}${file.path.slice(cleanOld.length)}`;
      if (!isValidProjectPath(candidatePath)) {
        return {
          files,
          error: `Resulting path "${candidatePath}" is invalid or exceeds 120 characters.`,
        };
      }
      updatedFiles.push({ ...file, path: candidatePath });
    } else {
      updatedFiles.push(file);
    }
  }

  for (let i = 0; i < updatedFiles.length; i++) {
    for (let j = i + 1; j < updatedFiles.length; j++) {
      const p1 = updatedFiles[i].path;
      const p2 = updatedFiles[j].path;
      if (p1 === p2 || p1.startsWith(`${p2}/`) || p2.startsWith(`${p1}/`)) {
        return {
          files,
          error: `Renaming to "${cleanNew}" collides with existing path "${p1 === p2 ? p1 : p2}".`,
        };
      }
    }
  }

  return { files: updatedFiles, error: null };
}

export function deletePath(files: ProjectFile[], pathOrFolder: string): ProjectFile[] {
  const cleanTarget = pathOrFolder.trim();
  const folderPrefix = `${cleanTarget}/`;
  return files.filter((f) => f.path !== cleanTarget && !f.path.startsWith(folderPrefix));
}

export function guessLanguage(
  path: string,
): 'html' | 'css' | 'javascript' | 'typescript' | 'json' | 'markdown' | 'text' {
  const lower = path.toLowerCase();
  const dotIdx = lower.lastIndexOf('.');
  const ext = dotIdx !== -1 ? lower.slice(dotIdx + 1) : '';
  switch (ext) {
    case 'html':
    case 'htm':
    case 'svg':
      return 'html';
    case 'css':
      return 'css';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'json':
      return 'json';
    case 'md':
    case 'markdown':
      return 'markdown';
    default:
      return 'text';
  }
}

export function starterProject(): ProjectFile[] {
  return [
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Starter Project</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="card">
    <span class="badge">Multi-File Project</span>
    <h1>Hello from Live AI Canvas</h1>
    <p id="statusText">Edit index.html, styles.css, or script.js to update the live preview.</p>
    <button id="actionBtn" type="button">Click Counter: 0</button>
  </main>
  <script src="script.js"></script>
</body>
</html>`,
    },
    {
      path: 'styles.css',
      content: `* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: #09090b;
  color: #f4f4f5;
  font-family: system-ui, -apple-system, sans-serif;
}

.card {
  max-width: 440px;
  width: 100%;
  padding: 28px;
  border-radius: 16px;
  background: #18181b;
  border: 1px solid #27272a;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.45);
}

.badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: rgba(6, 182, 212, 0.15);
  color: #22d3ee;
  border: 1px solid rgba(6, 182, 212, 0.35);
}

h1 {
  margin: 14px 0 8px;
  font-size: 22px;
}

p {
  margin: 0 0 20px;
  color: #a1a1aa;
  font-size: 14px;
  line-height: 1.5;
}

button {
  padding: 10px 18px;
  border-radius: 10px;
  border: 1px solid #0891b2;
  background: #06b6d4;
  color: #082f49;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: transform 0.12s ease, background 0.15s ease;
}

button:hover {
  background: #22d3ee;
  transform: translateY(-1px);
}`,
    },
    {
      path: 'script.js',
      content: `let count = 0;
const btn = document.getElementById('actionBtn');
const statusText = document.getElementById('statusText');

if (btn) {
  btn.addEventListener('click', () => {
    count += 1;
    btn.textContent = \`Click Counter: \${count}\`;
    if (statusText) {
      statusText.textContent = \`Button clicked \${count} \${count === 1 ? 'time' : 'times'}!\`;
    }
  });
}`,
    },
  ];
}

export function convertArtifactToProject(
  kind: string,
  language: string,
  content: string,
  title = 'Project',
): ProjectFile[] {
  const safeContent = (content || '').slice(0, MAX_PROJECT_CHARS);
  if (kind === 'html') {
    return [{ path: 'index.html', content: safeContent }];
  }
  if (kind === 'svg') {
    return [{ path: 'image.svg', content: safeContent }];
  }
  if (kind === 'react') {
    return [
      {
        path: 'src/App.tsx',
        content: safeContent,
      },
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body class="bg-zinc-950 text-zinc-100">
  <div id="root"></div>
</body>
</html>`,
      },
    ];
  }
  if (kind === 'markdown') {
    return [{ path: 'README.md', content: safeContent }];
  }

  const langMap: Record<string, string> = {
    javascript: 'js',
    js: 'js',
    typescript: 'ts',
    ts: 'ts',
    tsx: 'tsx',
    jsx: 'jsx',
    python: 'py',
    py: 'py',
    json: 'json',
    css: 'css',
    html: 'html',
    vue: 'vue',
    sh: 'sh',
    bash: 'sh',
    sql: 'sql',
  };
  const cleanLang = (language || '').trim().toLowerCase();
  const ext =
    langMap[cleanLang] ||
    (cleanLang && /^[a-z0-9]{1,8}$/.test(cleanLang) && cleanLang !== 'code' && cleanLang !== 'text'
      ? cleanLang
      : 'txt');

  return [{ path: `main.${ext}`, content: safeContent }];
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function getDosDateTime(date = new Date()): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  const dosTime = ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | (seconds & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f);
  return { dosTime, dosDate };
}

export function buildZip(files: ProjectFile[]): Uint8Array {
  const encoder = new TextEncoder();
  const { dosTime, dosDate } = getDosDateTime(new Date());

  const entries = files.map((file) => {
    const nameBytes = encoder.encode(file.path);
    const dataBytes = encoder.encode(file.content);
    const crc = computeCrc32(dataBytes);
    return {
      nameBytes,
      dataBytes,
      crc,
      localHeaderOffset: 0,
    };
  });

  let localSectionSize = 0;
  let centralDirSize = 0;
  for (const entry of entries) {
    entry.localHeaderOffset = localSectionSize;
    localSectionSize += 30 + entry.nameBytes.length + entry.dataBytes.length;
    centralDirSize += 46 + entry.nameBytes.length;
  }

  const totalSize = localSectionSize + centralDirSize + 22;
  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);
  let offset = 0;

  // 1. Local file headers + file data
  for (const entry of entries) {
    const { nameBytes, dataBytes, crc } = entry;
    view.setUint32(offset, 0x04034b50, true); // Local file header signature
    view.setUint16(offset + 4, 20, true); // Version needed to extract (2.0)
    view.setUint16(offset + 6, 0x0800, true); // General purpose bit flag (bit 11 = UTF-8)
    view.setUint16(offset + 8, 0, true); // Compression method (0 = STORE)
    view.setUint16(offset + 10, dosTime, true);
    view.setUint16(offset + 12, dosDate, true);
    view.setUint32(offset + 14, crc, true);
    view.setUint32(offset + 18, dataBytes.length, true); // Compressed size
    view.setUint32(offset + 22, dataBytes.length, true); // Uncompressed size
    view.setUint16(offset + 26, nameBytes.length, true); // File name length
    view.setUint16(offset + 28, 0, true); // Extra field length
    offset += 30;

    out.set(nameBytes, offset);
    offset += nameBytes.length;

    out.set(dataBytes, offset);
    offset += dataBytes.length;
  }

  const centralDirOffset = offset;

  // 2. Central directory headers
  for (const entry of entries) {
    const { nameBytes, dataBytes, crc, localHeaderOffset } = entry;
    view.setUint32(offset, 0x02014b50, true); // Central directory file header signature
    view.setUint16(offset + 4, 20, true); // Version made by
    view.setUint16(offset + 6, 20, true); // Version needed to extract (2.0)
    view.setUint16(offset + 8, 0x0800, true); // General purpose bit flag (bit 11 = UTF-8)
    view.setUint16(offset + 10, 0, true); // Compression method (0 = STORE)
    view.setUint16(offset + 12, dosTime, true);
    view.setUint16(offset + 14, dosDate, true);
    view.setUint32(offset + 16, crc, true);
    view.setUint32(offset + 20, dataBytes.length, true); // Compressed size
    view.setUint32(offset + 24, dataBytes.length, true); // Uncompressed size
    view.setUint16(offset + 28, nameBytes.length, true); // File name length
    view.setUint16(offset + 30, 0, true); // Extra field length
    view.setUint16(offset + 32, 0, true); // File comment length
    view.setUint16(offset + 34, 0, true); // Disk number start
    view.setUint16(offset + 36, 0, true); // Internal file attributes
    view.setUint32(offset + 38, 0, true); // External file attributes
    view.setUint32(offset + 42, localHeaderOffset, true); // Relative offset of local header
    offset += 46;

    out.set(nameBytes, offset);
    offset += nameBytes.length;
  }

  // 3. End of central directory record (EOCD)
  view.setUint32(offset, 0x06054b50, true); // EOCD signature
  view.setUint16(offset + 4, 0, true); // Number of this disk
  view.setUint16(offset + 6, 0, true); // Disk where central directory starts
  view.setUint16(offset + 8, entries.length, true); // Number of central directory records on this disk
  view.setUint16(offset + 10, entries.length, true); // Total number of central directory records
  view.setUint32(offset + 12, centralDirSize, true); // Size of central directory
  view.setUint32(offset + 16, centralDirOffset, true); // Offset of start of central directory
  view.setUint16(offset + 20, 0, true); // Comment length

  return out;
}

function resolveProjectRelativePath(baseDir: string, rawRef: string): string | null {
  const trimmed = rawRef.trim();
  if (!trimmed) return null;
  if (/^(https?:|mailto:|tel:|data:|blob:|javascript:|\/\/)/i.test(trimmed)) {
    return null;
  }

  const cleanRef = trimmed.split(/[?#]/)[0];
  if (!cleanRef) return null;

  const combined = cleanRef.startsWith('/')
    ? cleanRef.slice(1)
    : baseDir
    ? `${baseDir}/${cleanRef}`
    : cleanRef;

  const segments = combined.split('/');
  const stack: string[] = [];
  for (const seg of segments) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      if (stack.length > 0) stack.pop();
    } else {
      stack.push(seg);
    }
  }
  return stack.length > 0 ? stack.join('/') : null;
}

function findProjectFile(
  files: ProjectFile[],
  baseDir: string,
  rawRef: string,
): ProjectFile | undefined {
  const resolved = resolveProjectRelativePath(baseDir, rawRef);
  if (!resolved) return undefined;

  const exact = files.find((f) => f.path === resolved);
  if (exact) return exact;

  const lowerResolved = resolved.toLowerCase();
  const caseInsensitive = files.find((f) => f.path.toLowerCase() === lowerResolved);
  if (caseInsensitive) return caseInsensitive;

  // If rawRef started with "/" and baseDir is non-empty, also check relative to baseDir
  if (rawRef.trim().startsWith('/') && baseDir) {
    const relResolved = resolveProjectRelativePath(baseDir, rawRef.trim().slice(1));
    if (relResolved) {
      return (
        files.find((f) => f.path === relResolved) ||
        files.find((f) => f.path.toLowerCase() === relResolved.toLowerCase())
      );
    }
  }

  return undefined;
}

export function inlineStaticProject(files: ProjectFile[]): string | null {
  if (!Array.isArray(files) || files.length === 0) return null;

  const indexCandidates = files.filter((f) => {
    const baseName = f.path.split('/').pop()?.toLowerCase();
    return baseName === 'index.html';
  });

  if (indexCandidates.length === 0) return null;

  indexCandidates.sort((a, b) => {
    const depthDiff = a.path.split('/').length - b.path.split('/').length;
    if (depthDiff !== 0) return depthDiff;
    if (a.path.length !== b.path.length) return a.path.length - b.path.length;
    return a.path.localeCompare(b.path);
  });

  const entryFile = indexCandidates[0];
  const lastSlashIdx = entryFile.path.lastIndexOf('/');
  const baseDir = lastSlashIdx !== -1 ? entryFile.path.slice(0, lastSlashIdx) : '';

  let html = entryFile.content;

  // Replace relative <link rel="stylesheet" href="X"> tags
  html = html.replace(/<link\b([^>]*)>/gi, (fullTag, attrs: string) => {
    const relMatch = attrs.match(/\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const relVal = (relMatch?.[1] ?? relMatch?.[2] ?? relMatch?.[3] ?? '').toLowerCase();
    if (!relVal.split(/\s+/).includes('stylesheet')) {
      return fullTag;
    }

    const hrefMatch = attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const hrefVal = hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3] ?? '';
    if (!hrefVal) return fullTag;

    const matchedCssFile = findProjectFile(files, baseDir, hrefVal);
    if (!matchedCssFile) return fullTag;

    return `<style>\n${matchedCssFile.content}\n</style>`;
  });

  // Replace relative <script src="X"></script> tags
  html = html.replace(/<script\b([^>]*)>\s*<\/script>/gi, (fullTag, attrs: string) => {
    const srcMatch = attrs.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const srcVal = srcMatch?.[1] ?? srcMatch?.[2] ?? srcMatch?.[3] ?? '';
    if (!srcVal) return fullTag;

    const matchedJsFile = findProjectFile(files, baseDir, srcVal);
    if (!matchedJsFile) return fullTag;

    const typeMatch = attrs.match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const typeVal = (typeMatch?.[1] ?? typeMatch?.[2] ?? typeMatch?.[3] ?? '').toLowerCase();
    const isModule = typeVal === 'module';
    const escapedJs = matchedJsFile.content.replace(/<\/script/gi, '<\\/script');

    return `<script${isModule ? ' type="module"' : ''}>\n${escapedJs}\n</script>`;
  });

  return html;
}

export interface ReactProjectBundle {
  code: string;
  css: string;
  entryPath: string;
}

export function extractReactProjectBundle(files: ProjectFile[]): ReactProjectBundle | null {
  if (!Array.isArray(files) || files.length === 0) return null;

  const reactCodeFiles = files.filter((f) => /\.(tsx|jsx)$/i.test(f.path));
  if (reactCodeFiles.length === 0) return null;

  const isMainEntry = (path: string) => {
    const base = path.split('/').pop()?.toLowerCase() || '';
    return base === 'app.tsx' || base === 'app.jsx' || base === 'main.tsx' || base === 'main.jsx' || base === 'index.tsx' || base === 'index.jsx';
  };

  // Put helper/component files BEFORE main entry files (App.tsx, main.tsx, index.tsx)
  const orderedModules = [...files]
    .filter((f) => /\.(tsx|jsx|ts|js)$/i.test(f.path))
    .filter((f) => !/\.(config|d)\.ts$/i.test(f.path))
    .sort((a, b) => {
      const aEntry = isMainEntry(a.path);
      const bEntry = isMainEntry(b.path);
      if (aEntry !== bEntry) return aEntry ? 1 : -1;
      return a.path.localeCompare(b.path);
    });

  // Put App.* right after helpers and before main.* if both exist so `App` is declared before `ReactDOM.createRoot`
  orderedModules.sort((a, b) => {
    const aBase = a.path.split('/').pop()?.toLowerCase() || '';
    const bBase = b.path.split('/').pop()?.toLowerCase() || '';
    const score = (base: string, path: string) => {
      if (base.startsWith('main.') || base.startsWith('index.')) return 2;
      if (base.startsWith('app.')) return 1;
      return path.includes('component') ? 0 : 0;
    };
    const diff = score(aBase, a.path) - score(bBase, b.path);
    return diff !== 0 ? diff : a.path.localeCompare(b.path);
  });

  const nonMountModules = orderedModules.filter((f) => {
    const base = f.path.split('/').pop()?.toLowerCase() || '';
    // Skip pure ReactDOM.createRoot boilerplate if an App.* exists alongside it
    if ((base === 'main.tsx' || base === 'main.jsx' || base === 'index.tsx' || base === 'index.jsx') &&
        orderedModules.some((m) => /^app\.(tsx|jsx)$/i.test(m.path.split('/').pop() || ''))) {
      return !/createRoot\s*\(|ReactDOM\.render\s*\(/.test(f.content);
    }
    return true;
  });

  const finalModules = nonMountModules.length > 0 ? nonMountModules : orderedModules;
  const cssFiles = files.filter((f) => /\.css$/i.test(f.path));

  const code = finalModules
    .map((f) => `// === MODULE: ${f.path} ===\n${f.content}`)
    .join('\n\n');
  const css = cssFiles.map((f) => f.content).join('\n\n');
  const entryFile =
    reactCodeFiles.find((f) => /^app\.(tsx|jsx)$/i.test(f.path.split('/').pop() || '')) ||
    reactCodeFiles[0];

  return {
    code,
    css,
    entryPath: entryFile.path,
  };
}

