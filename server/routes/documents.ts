import { Router, type Request, type Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { getBackendApiKey } from '../apiCatalog.js';
import { fetchWithSafeRedirects, readResponseBuffer, requirePublicUrl } from '../networkSafety.js';

export const documentsRouter = Router();

/**
 * Generate Gemini embeddings using text-embedding-004 model.
 * Does NOT store or persist any document data on the server filesystem.
 */
async function generateEmbeddingsWithGemini(
  texts: string[],
): Promise<Array<number[] | undefined>> {
  const geminiKey = getBackendApiKey('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
  if (!geminiKey) return texts.map(() => undefined);

  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const results: Array<number[] | undefined> = [];

    // Process in batches of 5 to respect rate limits
    for (let i = 0; i < texts.length; i += 5) {
      const batch = texts.slice(i, i + 5);
      const batchPromises = batch.map(async (txt) => {
        try {
          const res = await ai.models.embedContent({
            model: 'text-embedding-004',
            contents: txt.slice(0, 2048),
          });
          if (res && res.embedding && Array.isArray(res.embedding.values)) {
            return res.embedding.values;
          }
        } catch {
          // Soft fallback on per-chunk error
        }
        return undefined;
      });

      const batchRes = await Promise.all(batchPromises);
      results.push(...batchRes);
    }

    return results;
  } catch (err) {
    console.warn('[Embeddings] Gemini embedding service call failed, falling back to client-side vectorizer:', err);
    return texts.map(() => undefined);
  }
}

async function generateSingleEmbedding(text: string): Promise<number[] | undefined> {
  const geminiKey = getBackendApiKey('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
  if (!geminiKey) return undefined;
  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const res = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: text.slice(0, 2048),
    });
    if (res && res.embedding && Array.isArray(res.embedding.values)) {
      return res.embedding.values;
    }
  } catch {
    // fallback
  }
  return undefined;
}

/**
 * POST /api/documents/embed - Generate semantic embeddings for text chunks or query
 * Pure compute endpoint: no file system or disk persistence.
 */
documentsRouter.post('/api/documents/embed', async (req: Request, res: Response) => {
  try {
    const { texts, text } = req.body || {};

    if (Array.isArray(texts)) {
      const validTexts = texts.map((t) => (typeof t === 'string' ? t : ''));
      const embeddings = await generateEmbeddingsWithGemini(validTexts);
      return res.json({ ok: true, embeddings });
    }

    if (typeof text === 'string') {
      const embedding = await generateSingleEmbedding(text);
      return res.json({ ok: true, embedding });
    }

    return res.status(400).json({ ok: false, error: 'Either "texts" array or "text" string is required.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Embedding generation failed';
    return res.status(500).json({ ok: false, error: msg });
  }
});

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const MAX_DOCUMENT_CHARS = 24000;

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
  });
  const document = await loadingTask.promise;
  const pages: string[] = [];
  const pageCount = Math.min(document.numPages, 25);
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => (typeof item === 'object' && item && 'str' in item ? String(item.str) : ''))
      .filter(Boolean)
      .join(' ');
    if (text.trim()) pages.push(text.trim());
  }
  await loadingTask.destroy().catch(() => undefined);
  return pages.join('\n\n');
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return String(result.value || '').trim();
}

/**
 * POST /api/documents/extract-url - Extract text from a public document URL.
 * Supports PDF, DOCX, and text-like files. No file is persisted on disk.
 */
documentsRouter.post('/api/documents/extract-url', async (req: Request, res: Response) => {
  const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  if (!rawUrl) {
    return res.status(400).json({ ok: false, error: 'A document URL is required.' });
  }

  let target: URL;
  try {
    target = requirePublicUrl(rawUrl);
  } catch (err) {
    return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Invalid document URL.' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetchWithSafeRedirects(target.toString(), {
      headers: {
        'User-Agent': 'NEXUS-DocumentReader/1.0 (https://nexus.app)',
        Accept: 'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/html,application/json,*/*;q=0.5',
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      return res.status(502).json({ ok: false, error: `Document download failed (HTTP ${response.status}).` });
    }

    const { buffer, truncated } = await readResponseBuffer(response, MAX_DOCUMENT_BYTES);
    if (truncated) {
      return res.status(413).json({ ok: false, error: 'Document is larger than the 8 MB limit.' });
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const pathname = new URL(response.url || target.toString()).pathname.toLowerCase();
    let text = '';
    if (contentType.includes('application/pdf') || pathname.endsWith('.pdf')) {
      text = await extractPdfText(buffer);
    } else if (
      contentType.includes('wordprocessingml') ||
      contentType.includes('application/msword') ||
      pathname.endsWith('.docx')
    ) {
      text = await extractDocxText(buffer);
    } else if (
      contentType.includes('text/') ||
      contentType.includes('json') ||
      pathname.endsWith('.txt') ||
      pathname.endsWith('.md') ||
      pathname.endsWith('.csv') ||
      pathname.endsWith('.json') ||
      pathname.endsWith('.html') ||
      pathname.endsWith('.htm')
    ) {
      text = buffer.toString('utf8');
      if (contentType.includes('html') || pathname.endsWith('.html') || pathname.endsWith('.htm')) {
        text = stripHtmlToText(text);
      }
    } else {
      return res.status(415).json({ ok: false, error: 'Unsupported document type. Use PDF, DOCX, TXT, MD, CSV, JSON, or HTML.' });
    }

    text = text.split(String.fromCharCode(0)).join('').replace(/\r\n/g, '\n').trim();
    if (!text) {
      return res.status(422).json({ ok: false, error: 'No readable text was found in this document.' });
    }

    const clipped = text.slice(0, MAX_DOCUMENT_CHARS);
    return res.json({
      ok: true,
      data: {
        url: target.toString(),
        finalUrl: response.url || target.toString(),
        contentType,
        text: clipped,
        charCount: text.length,
        isTruncated: text.length > clipped.length,
      },
    });
  } catch (err: unknown) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return res.status(aborted ? 504 : 502).json({
      ok: false,
      error: aborted
        ? 'Document extraction timed out.'
        : err instanceof Error
          ? err.message
          : 'Document extraction failed.',
    });
  } finally {
    clearTimeout(timeout);
  }
});

