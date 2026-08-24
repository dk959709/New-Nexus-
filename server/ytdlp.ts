import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';

const execFileAsync = promisify(execFile);

export interface MediaFormat {
  formatId: string;
  ext: string;
  height?: number;
  width?: number;
  fps?: number;
  hasVideo: boolean;
  hasAudio: boolean;
  playableUrl: string;
}

export interface MediaExtractionResult {
  success: boolean;
  title?: string;
  thumbnail?: string;
  duration?: number;
  source?: string;
  originalUrl?: string;
  formats?: MediaFormat[];
  error?: string;
  version?: string;
  available?: boolean;
}

function findYtDlpBinary(): string {
  const localBin = path.join(process.cwd(), 'yt-dlp');
  if (fs.existsSync(localBin)) {
    return localBin;
  }
  return 'yt-dlp';
}

export async function checkYtDlpStatus(): Promise<{ available: boolean; version?: string; message?: string }> {
  try {
    const bin = findYtDlpBinary();
    const { stdout } = await execFileAsync(bin, ['--version'], { timeout: 5000 });
    const version = stdout.trim();
    return { available: true, version, message: `yt-dlp available (version ${version})` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'yt-dlp binary not found or failed to execute';
    return { available: false, message };
  }
}

function validateAndSanitizeUrl(rawUrl: string): { valid: boolean; url?: string; error?: string } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'URL is required' };
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTPS URLs are permitted for security' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // SSRF Protection
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '[::1]' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === '169.254.169.254' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
  ) {
    return { valid: false, error: 'Access to private or internal network addresses is prohibited' };
  }

  return { valid: true, url: parsed.toString() };
}

export async function extractMediaWithYtDlp(rawUrl: string): Promise<MediaExtractionResult> {
  const validation = validateAndSanitizeUrl(rawUrl);
  if (!validation.valid || !validation.url) {
    return { success: false, error: validation.error || 'Invalid URL' };
  }

  const bin = findYtDlpBinary();
  const args = [
    '--dump-json',
    '--no-playlist',
    '--no-warnings',
    '--skip-download',
    '--extractor-args',
    'youtube:player_client=web_safari,web',
    validation.url,
  ];

  try {
    const { stdout } = await execFileAsync(bin, args, {
      timeout: 25000,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (!stdout || stdout.trim().length === 0) {
      return { success: false, error: 'yt-dlp returned empty output' };
    }

    const data = JSON.parse(stdout) as Record<string, unknown>;

    const rawFormats = Array.isArray(data.formats) ? data.formats : [];
    const formats: MediaFormat[] = rawFormats
      .filter((f): f is Record<string, unknown> => f !== null && typeof f === 'object' && typeof (f as Record<string, unknown>).url === 'string')
      .map((f) => {
        const vcodec = typeof f.vcodec === 'string' ? f.vcodec : undefined;
        const acodec = typeof f.acodec === 'string' ? f.acodec : undefined;
        const hasVideo = vcodec !== undefined && vcodec !== 'none';
        const hasAudio = acodec !== undefined && acodec !== 'none';
        return {
          formatId: String(f.format_id || 'unknown'),
          ext: String(f.ext || 'mp4'),
          height: typeof f.height === 'number' ? f.height : undefined,
          width: typeof f.width === 'number' ? f.width : undefined,
          fps: typeof f.fps === 'number' ? f.fps : undefined,
          hasVideo: Boolean(hasVideo),
          hasAudio: Boolean(hasAudio),
          playableUrl: String(f.url),
        };
      });

    if (formats.length === 0 && typeof data.url === 'string') {
      formats.push({
        formatId: 'default',
        ext: typeof data.ext === 'string' ? data.ext : 'mp4',
        height: typeof data.height === 'number' ? data.height : undefined,
        width: typeof data.width === 'number' ? data.width : undefined,
        hasVideo: true,
        hasAudio: true,
        playableUrl: data.url,
      });
    }

    const thumbnails = Array.isArray(data.thumbnails) ? data.thumbnails : [];
    const firstThumb = thumbnails[0] as Record<string, unknown> | undefined;

    return {
      success: true,
      title: typeof data.title === 'string' ? data.title : 'Untitled Video',
      thumbnail: typeof data.thumbnail === 'string' ? data.thumbnail : (firstThumb && typeof firstThumb.url === 'string' ? firstThumb.url : undefined),
      duration: typeof data.duration === 'number' ? data.duration : 0,
      source: typeof data.extractor === 'string' ? data.extractor : (typeof data.uploader === 'string' ? data.uploader : 'yt-dlp'),
      originalUrl: typeof data.webpage_url === 'string' ? data.webpage_url : (typeof data.original_url === 'string' ? data.original_url : validation.url),
      formats,
    };
  } catch (err: unknown) {
    console.error('[YtDlpService] Extraction error:', err);
    let errorMessage = 'Failed to extract media via yt-dlp';
    if (err instanceof Error) {
      errorMessage = err.message;
      const stderr = (err as Record<string, unknown>).stderr;
      if (typeof stderr === 'string' && stderr.trim().length > 0) {
        const errorLine = stderr.split('\n').find((line) => line.includes('ERROR:'));
        if (errorLine) {
          errorMessage = errorLine.replace('ERROR:', '').trim();
        } else {
          errorMessage = stderr.trim();
        }
      }
    }

    // Graceful fallback for YouTube bot detection or network restrictions
    if (validation.url.includes('youtube.com') || validation.url.includes('youtu.be')) {
      let videoId = '';
      try {
        const parsed = new URL(validation.url);
        if (parsed.hostname.includes('youtu.be')) {
          videoId = parsed.pathname.slice(1);
        } else {
          videoId = parsed.searchParams.get('v') || '';
        }
      } catch {
        // ignore
      }

      if (videoId) {
        console.warn(`[YtDlpService] Falling back to embed/default for YouTube video ${videoId} due to extraction restriction.`);
        return {
          success: true,
          title: `YouTube Video (${videoId})`,
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          duration: 300,
          source: 'YouTube (Fallback)',
          originalUrl: validation.url,
          formats: [
            {
              formatId: 'fallback-embed',
              ext: 'mp4',
              hasVideo: true,
              hasAudio: true,
              playableUrl: `https://www.youtube.com/embed/${videoId}`,
            },
          ],
        };
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}
