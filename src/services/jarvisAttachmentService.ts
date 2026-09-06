import * as pdfjsLib from 'pdfjs-dist';
import { JarvisAttachedFile } from '@/types';

// Set up pdfjs worker
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
  }
}

const SUPPORTED_TEXT_EXTENSIONS = new Set([
  'txt',
  'pdf',
  'py',
  'html',
  'htm',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'json',
  'css',
  'scss',
  'sass',
  'less',
  'md',
  'markdown',
  'yaml',
  'yml',
  'xml',
  'csv',
  'sql',
  'sh',
  'bash',
  'zsh',
  'env',
  'toml',
  'ini',
  'log',
  'c',
  'cpp',
  'h',
  'hpp',
  'java',
  'go',
  'rs',
  'php',
  'rb',
  'swift',
  'kt',
  'dart',
  'r',
  'lua',
]);

const EXPLICITLY_UNSUPPORTED_EXTENSIONS = new Set([
  // Images
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif', 'heic', 'heif', 'avif',
  // Videos
  'mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v', '3gp', 'mpg', 'mpeg',
  // Audio
  'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma',
  // Archives
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'tgz',
  // Executables & Binaries
  'exe', 'dll', 'bin', 'dmg', 'pkg', 'apk', 'ipa', 'class', 'o', 'so', 'dylib',
]);

const EXPLICITLY_UNSUPPORTED_MIMES = [
  'image/',
  'video/',
  'audio/',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/gzip',
  'application/octet-stream',
];

export const UNSUPPORTED_FILE_ERROR_MESSAGE =
  'Only text-based files (.txt, .pdf, .py, .html, etc.) are supported. Images, videos, and archives are not supported.';

export function validateAttachmentFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  const fileName = file.name || '';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  // 1. Explicitly check for blocked image / video / audio / archive types
  if (
    EXPLICITLY_UNSUPPORTED_EXTENSIONS.has(ext) ||
    EXPLICITLY_UNSUPPORTED_MIMES.some((mime) => file.type && file.type.startsWith(mime))
  ) {
    return {
      valid: false,
      error: UNSUPPORTED_FILE_ERROR_MESSAGE,
    };
  }

  // 2. Check if the extension is in our supported list
  if (!SUPPORTED_TEXT_EXTENSIONS.has(ext)) {
    // If browser reports text/* MIME, allow it as text
    if (file.type && file.type.startsWith('text/')) {
      return { valid: true };
    }
    return {
      valid: false,
      error: UNSUPPORTED_FILE_ERROR_MESSAGE,
    };
  }

  // 3. Safety limit (15MB)
  if (file.size > 15 * 1024 * 1024) {
    return {
      valid: false,
      error: 'File size exceeds maximum limit of 15MB.',
    };
  }

  return { valid: true };
}

/**
 * Fallback regex-based text extractor for PDF array buffers when worker is unavailable
 */
function extractTextFromPdfStreamFallback(buffer: ArrayBuffer): string {
  try {
    const bytes = new Uint8Array(buffer);
    let str = '';
    // Sample first 1MB if huge
    const limit = Math.min(bytes.length, 1024 * 1024);
    for (let i = 0; i < limit; i++) {
      const code = bytes[i];
      // Keep printable ASCII & basic newlines
      if ((code >= 32 && code <= 126) || code === 10 || code === 13) {
        str += String.fromCharCode(code);
      }
    }

    // Extract text in parentheses (e.g. (Hello World) Tj)
    const textMatches: string[] = [];
    const regex = /\(([^)]+)\)\s*(?:Tj|TJ)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(str)) !== null) {
      if (match[1] && match[1].trim().length > 1) {
        textMatches.push(match[1].replace(/\\([()\\])/g, '$1').trim());
      }
    }

    if (textMatches.length > 0) {
      return textMatches.join(' ');
    }
  } catch (err) {
    console.warn('PDF stream fallback failed:', err);
  }
  return '';
}

/**
 * Extract text from a PDF file using pdfjs-dist (ignores embedded images)
 */
export async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });

    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;
    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Extract only string items, ignoring any image or graphical objects
      const items = textContent.items
        .map((item: unknown) =>
          typeof item === 'object' &&
          item !== null &&
          'str' in item &&
          typeof (item as { str: unknown }).str === 'string'
            ? (item as { str: string }).str
            : ''
        )
        .filter((str: string) => str && str.trim().length > 0);

      if (items.length > 0) {
        pageTexts.push(`[Page ${pageNum}]\n${items.join(' ')}`);
      }
    }

    const result = pageTexts.join('\n\n').trim();
    if (result) {
      return result;
    }
  } catch (pdfErr) {
    console.warn('pdfjs extraction failed, attempting stream fallback:', pdfErr);
  }

  const fallback = extractTextFromPdfStreamFallback(arrayBuffer);
  if (fallback) {
    return fallback;
  }

  return '[PDF attached, but no selectable text layer found (document may contain scanned images or be encrypted).]';
}

/**
 * Primary processor: converts an attached File into a structured JarvisAttachedFile
 */
export async function processAttachedFile(file: File): Promise<JarvisAttachedFile> {
  const validation = validateAttachmentFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || UNSUPPORTED_FILE_ERROR_MESSAGE);
  }

  const fileName = file.name;
  const ext = fileName.split('.').pop()?.toLowerCase() || 'txt';
  let content = '';

  if (ext === 'pdf') {
    content = await extractPdfText(file);
  } else {
    // Plain text / code file
    content = await file.text();
  }

  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: fileName,
    size: file.size,
    type: file.type || 'text/plain',
    extension: ext,
    content,
  };
}

/**
 * Formats file size in human-readable units (e.g. 24.5 KB)
 */
export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Formats prompt + attached files into unified context for the JARVIS pipeline
 */
export function formatPromptWithAttachments(
  userQuery: string,
  attachments: JarvisAttachedFile[]
): string {
  if (!attachments || attachments.length === 0) {
    return userQuery;
  }

  const fileSections = attachments
    .map((att, idx) => {
      const codeFence = att.extension || 'txt';
      return `### Attachment [${idx + 1}]: \`${att.name}\` (${formatAttachmentSize(att.size)})\n\`\`\`${codeFence}\n${att.content}\n\`\`\``;
    })
    .join('\n\n');

  if (userQuery.trim()) {
    return `${userQuery.trim()}\n\n---\n## User Attached Context Files:\n${fileSections}`;
  }

  return `Please review, analyze, and process the attached files:\n\n${fileSections}`;
}
