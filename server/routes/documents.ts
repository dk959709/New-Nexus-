import { Router, type Request, type Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { getBackendApiKey } from '../apiCatalog.js';

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
