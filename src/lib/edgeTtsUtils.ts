import { cleanMarkdownForSpeech } from '@/lib/format';

export const CHUNK_SIZE_LIMIT = 2500;

/**
 * Splits long text into natural sentence/clause chunks under maxChunkLen characters
 * so Edge TTS can process each chunk reliably without timeout or buffer limits.
 */
export function splitTextIntoSpeechChunks(text: string, maxChunkLen = CHUNK_SIZE_LIMIT): string[] {
  if (text.length <= maxChunkLen) return [text];

  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > 0) {
    if (remaining.length <= maxChunkLen) {
      chunks.push(remaining);
      break;
    }

    let sliceEnd = -1;
    const windowText = remaining.slice(0, maxChunkLen);

    // 1. Try to find the last sentence-ending punctuation followed by space or newline
    const sentenceMatches = Array.from(windowText.matchAll(/[.!?;\n]\s+/g));
    if (sentenceMatches.length > 0) {
      const lastMatch = sentenceMatches[sentenceMatches.length - 1];
      if (lastMatch.index !== undefined && lastMatch.index > maxChunkLen * 0.3) {
        sliceEnd = lastMatch.index + lastMatch[0].length;
      }
    }

    // 2. Try comma or colon clause separators if no sentence boundary found
    if (sliceEnd === -1) {
      const clauseMatches = Array.from(windowText.matchAll(/[,:]\s+/g));
      if (clauseMatches.length > 0) {
        const lastClause = clauseMatches[clauseMatches.length - 1];
        if (lastClause.index !== undefined && lastClause.index > maxChunkLen * 0.3) {
          sliceEnd = lastClause.index + lastClause[0].length;
        }
      }
    }

    // 3. Fall back to word boundary (space)
    if (sliceEnd === -1) {
      const lastSpace = windowText.lastIndexOf(' ');
      if (lastSpace > maxChunkLen * 0.3) {
        sliceEnd = lastSpace + 1;
      } else {
        sliceEnd = maxChunkLen;
      }
    }

    const chunk = remaining.slice(0, sliceEnd).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    remaining = remaining.slice(sliceEnd).trim();
  }

  return chunks.filter(Boolean);
}

/**
 * Synthesizes audio for Edge TTS using cleanMarkdownForSpeech and automatic chunking + stitching
 */
export async function synthesizeEdgeAudio(
  rawText: string,
  voice: string,
  onProgress?: (msg: string) => void
): Promise<Blob> {
  const cleaned = cleanMarkdownForSpeech(rawText);
  if (!cleaned) {
    throw new Error('Please enter text to synthesize.');
  }

  const chunks = splitTextIntoSpeechChunks(cleaned, CHUNK_SIZE_LIMIT);

  if (chunks.length === 1) {
    if (onProgress) onProgress('Generating Neural Audio...');
    const response = await fetch('/api/edge-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: chunks[0],
        voice,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Server responded with status ${response.status}`);
    }

    return await response.blob();
  }

  const audioBlobs: Blob[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) {
      onProgress(`Synthesizing Part ${i + 1} of ${chunks.length}...`);
    }

    const response = await fetch('/api/edge-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: chunks[i],
        voice,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(
        data.error || `Chunk ${i + 1}/${chunks.length} failed with status ${response.status}`
      );
    }

    const blob = await response.blob();
    audioBlobs.push(blob);
  }

  if (onProgress) onProgress('Stitching Audio Streams...');
  return new Blob(audioBlobs, { type: 'audio/mpeg' });
}
