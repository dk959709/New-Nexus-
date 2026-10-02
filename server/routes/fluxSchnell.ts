import { Router, type Request, type Response } from 'express';

export const fluxSchnellRouter = Router();

interface FluxSchnellRequestBody {
  prompt?: string;
  inputs?: string;
  width?: number | string;
  height?: number | string;
  num_steps?: number | string;
  num_inference_steps?: number | string;
  seed?: number;
  randomize_seed?: boolean;
  apiKey?: string;
  apiToken?: string;
  key?: string;
}

interface GradioStreamResult {
  path?: string;
  url?: string;
}

/**
 * Resolves Hugging Face token in order:
 * (a) Request header Authorization: Bearer <token> (only if it starts with "hf_")
 * (b) Request body fields apiKey / apiToken / key
 * (c) process.env.HF_TOKEN, HUGGINGFACE_API_KEY, HF_API_KEY
 * Never logs the token.
 */
function resolveHfToken(req: Request, body: FluxSchnellRequestBody): string {
  // (a) Request header Authorization: Bearer <token> (only if starts with "hf_")
  const authHeader = (req.headers.authorization || '').trim();
  if (authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    if (bearerToken.startsWith('hf_')) {
      return bearerToken;
    }
  }

  // (b) Request body fields apiKey / apiToken / key
  const bodyKey = (body.apiKey || body.apiToken || body.key || '').trim();
  if (bodyKey) {
    return bodyKey;
  }

  // (c) process.env.HF_TOKEN, HUGGINGFACE_API_KEY, HF_API_KEY
  const envToken = (
    process.env.HF_TOKEN ||
    process.env.HUGGINGFACE_API_KEY ||
    process.env.HF_API_KEY ||
    ''
  ).trim();
  if (envToken) {
    return envToken;
  }

  return '';
}

/**
 * Checks magic bytes to verify whether buffer is a real image and detects its MIME type.
 * Supported:
 * - PNG:  89 50 4E 47
 * - JPEG: FF D8 FF
 * - WEBP: 52 49 46 46 .... 57 45 42 50 (RIFF....WEBP)
 * - GIF:  47 49 46 38 (GIF8)
 */
function detectImageType(
  buffer: Buffer,
): 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | null {
  if (!buffer || buffer.length < 12) return null;

  // PNG: 89 50 4E 47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  // WEBP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  // GIF: GIF8 (47 49 46 38)
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return 'image/gif';
  }

  return null;
}

/**
 * Parses Server-Sent Events (SSE) from the Gradio streaming endpoint.
 * Waits for 'event: complete' (or 'event: error') and extracts output data { path, url }.
 */
async function streamGradioInference(
  eventId: string,
  timeoutMs: number = 30000,
  token?: string,
): Promise<GradioStreamResult> {
  const streamUrl = `https://black-forest-labs-flux-1-schnell.hf.space/gradio_api/call/infer/${eventId}`;
  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const streamHeaders: Record<string, string> = {
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
    };
    if (token) {
      streamHeaders['Authorization'] = `Bearer ${token}`;
    }

    const streamRes = await fetch(streamUrl, {
      method: 'GET',
      headers: streamHeaders,
      signal: controller.signal,
    });

    if (!streamRes.ok) {
      if (
        streamRes.status === 429 ||
        streamRes.status === 503 ||
        streamRes.status === 502 ||
        streamRes.status === 504
      ) {
        throw new Error('Space is busy, try again');
      }
      throw new Error(`Gradio Space stream error (HTTP ${streamRes.status})`);
    }

    if (!streamRes.body) {
      throw new Error('No response stream received from Gradio Space');
    }

    const reader = streamRes.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let currentEvent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          // Empty line separates SSE messages
          currentEvent = '';
          continue;
        }

        if (trimmed.startsWith('event:')) {
          currentEvent = trimmed.slice(6).trim();
        } else if (trimmed.startsWith('data:')) {
          const rawData = trimmed.slice(5).trim();

          if (currentEvent === 'error') {
            console.log(
              `[FLUX.1-schnell] Error event: ${currentEvent} | Data: ${rawData.slice(0, 200)}`,
            );

            const isNullOrEmpty =
              !rawData ||
              rawData === 'null' ||
              rawData === 'undefined' ||
              rawData === '""' ||
              rawData === '{}' ||
              rawData === '[]';

            if (isNullOrEmpty) {
              throw new Error(
                'The FLUX Space returned an error without details. This is usually the free GPU quota or the Space being overloaded. Add a Hugging Face token (hf_...) in Settings > AI Providers > FLUX.1-schnell, or try again later.',
              );
            }
            throw new Error(rawData);
          }

          if (currentEvent === 'complete') {
            try {
              const parsed = JSON.parse(rawData);
              // In Gradio, data is an array: [ { path: "...", url: "...", ... } ] or [ "..." ]
              const firstItem = Array.isArray(parsed) ? parsed[0] : parsed;
              let filePath = '';
              let fileUrl = '';

              if (typeof firstItem === 'string') {
                if (
                  firstItem.startsWith('http://') ||
                  firstItem.startsWith('https://')
                ) {
                  fileUrl = firstItem;
                } else {
                  filePath = firstItem;
                }
              } else if (firstItem && typeof firstItem === 'object') {
                const itemObj = firstItem as {
                  path?: string;
                  url?: string;
                  image?: { path?: string; url?: string };
                };
                filePath = itemObj.path || itemObj.image?.path || '';
                fileUrl = itemObj.url || itemObj.image?.url || '';
              }

              if (!filePath && !fileUrl) {
                throw new Error('No image file path or URL returned from Space');
              }

              return { path: filePath, url: fileUrl };
            } catch (err: unknown) {
              if (err instanceof Error && err.message.includes('Space')) {
                throw err;
              }
              throw new Error(
                'Failed to parse completed image payload from Space',
              );
            }
          }
        }
      }
    }

    throw new Error('Space stream closed before completion');
  } finally {
    clearTimeout(timeoutTimer);
  }
}

/**
 * Handler for FLUX.1-schnell generation via Hugging Face Gradio Space REST queue.
 */
async function handleFluxSchnellGeneration(req: Request, res: Response) {
  const body = (req.body || {}) as FluxSchnellRequestBody;
  const rawPrompt = (body.prompt || body.inputs || '').trim();

  if (!rawPrompt) {
    return res.status(400).json({
      ok: false,
      error: 'Prompt is required',
      message: 'Prompt is required',
    });
  }

  const token = resolveHfToken(req, body);
  console.log(`[FLUX.1-schnell] Generation request | Token used: ${Boolean(token)}`);

  const rawWidth =
    typeof body.width === 'number'
      ? body.width
      : parseInt(String(body.width || 1024), 10);
  const rawHeight =
    typeof body.height === 'number'
      ? body.height
      : parseInt(String(body.height || 1024), 10);
  const width =
    isNaN(rawWidth) || rawWidth <= 0 ? 1024 : Math.min(Math.max(rawWidth, 256), 2048);
  const height =
    isNaN(rawHeight) || rawHeight <= 0 ? 1024 : Math.min(Math.max(rawHeight, 256), 2048);
  const numSteps = 4; // FLUX.1-schnell default steps
  const seed = typeof body.seed === 'number' ? body.seed : 0;
  const randomizeSeed =
    body.randomize_seed !== undefined ? Boolean(body.randomize_seed) : true;

  try {
    // Step 1 (POST): Call infer endpoint on Hugging Face Gradio Space
    const step1Payload = {
      data: [rawPrompt, seed, randomizeSeed, width, height, numSteps],
    };

    const step1Controller = new AbortController();
    const step1Timeout = setTimeout(() => step1Controller.abort(), 15000);

    let eventId = '';
    try {
      const step1Headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        step1Headers['Authorization'] = `Bearer ${token}`;
      }

      const step1Res = await fetch(
        'https://black-forest-labs-flux-1-schnell.hf.space/gradio_api/call/infer',
        {
          method: 'POST',
          headers: step1Headers,
          body: JSON.stringify(step1Payload),
          signal: step1Controller.signal,
        },
      );

      if (!step1Res.ok) {
        if (
          step1Res.status === 429 ||
          step1Res.status === 503 ||
          step1Res.status === 502 ||
          step1Res.status === 504
        ) {
          return res.status(503).json({
            ok: false,
            error: 'Space is busy, try again',
            message: 'Space is busy, try again',
          });
        }
        const errText = await step1Res.text().catch(() => '');
        return res.status(502).json({
          ok: false,
          error: errText || 'Space is busy, try again',
          message: 'Space is busy, try again',
        });
      }

      const step1Json = (await step1Res.json()) as { event_id?: string };
      eventId = step1Json.event_id || '';
    } finally {
      clearTimeout(step1Timeout);
    }

    if (!eventId) {
      return res.status(503).json({
        ok: false,
        error: 'Space is busy, try again',
        message: 'Space is busy, try again',
      });
    }

    // Step 2 (GET, streamed SSE): Wait for completion and retrieve { path, url }
    const gradioResult = await streamGradioInference(eventId, 30000, token);

    // Step 3: Build list of candidate URLs in specific order:
    // (a) the "url" field if it starts with http
    // (b) https://black-forest-labs-flux-1-schnell.hf.space/gradio_api/file=<path>
    // (c) https://black-forest-labs-flux-1-schnell.hf.space/file=<path>
    const candidates: string[] = [];

    if (
      gradioResult.url &&
      (gradioResult.url.startsWith('http://') || gradioResult.url.startsWith('https://'))
    ) {
      candidates.push(gradioResult.url);
    }

    if (gradioResult.path) {
      const normalizedPath = gradioResult.path.startsWith('/')
        ? gradioResult.path
        : `/${gradioResult.path}`;
      candidates.push(
        `https://black-forest-labs-flux-1-schnell.hf.space/gradio_api/file=${normalizedPath}`,
      );
      candidates.push(
        `https://black-forest-labs-flux-1-schnell.hf.space/file=${normalizedPath}`,
      );
    }

    let successfulImage: { buffer: Buffer; mime: string } | null = null;

    for (const candidateUrl of candidates) {
      const fileController = new AbortController();
      const fileTimeout = setTimeout(() => fileController.abort(), 15000);

      try {
        const fileHeaders: Record<string, string> = {};
        if (token) {
          fileHeaders['Authorization'] = `Bearer ${token}`;
        }

        const fileRes = await fetch(candidateUrl, {
          headers: fileHeaders,
          signal: fileController.signal,
        });

        const contentTypeHeader = fileRes.headers.get('content-type') || '';

        if (!fileRes.ok) {
          console.log(
            `[FLUX.1-schnell] Candidate tried: ${candidateUrl} | HTTP status: ${fileRes.status} | Content-Type: ${contentTypeHeader || 'none'} | Byte size: 0 | Detected type: none (HTTP error)`,
          );
          continue;
        }

        const arrayBuffer = await fileRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const detectedType = detectImageType(buffer);

        console.log(
          `[FLUX.1-schnell] Candidate tried: ${candidateUrl} | HTTP status: ${fileRes.status} | Content-Type: ${contentTypeHeader || 'none'} | Byte size: ${buffer.length} | Detected type: ${detectedType || 'none'}`,
        );

        if (detectedType && buffer.length > 0) {
          successfulImage = { buffer, mime: detectedType };
          break;
        }
      } catch (candidateErr: unknown) {
        const errMsg =
          candidateErr instanceof Error ? candidateErr.message : String(candidateErr);
        console.log(
          `[FLUX.1-schnell] Candidate tried: ${candidateUrl} | Error: ${errMsg} | Detected type: none`,
        );
      } finally {
        clearTimeout(fileTimeout);
      }
    }

    if (!successfulImage) {
      return res.status(502).json({
        ok: false,
        error: 'FLUX Space returned a file that is not an image, try again',
        message: 'FLUX Space returned a file that is not an image, try again',
      });
    }

    const base64 = successfulImage.buffer.toString('base64');
    const dataUrl = `data:${successfulImage.mime};base64,${base64}`;

    return res.json({
      ok: true,
      success: true,
      image: dataUrl,
      dataUrl,
      output: dataUrl,
      result: { image: base64 },
    });
  } catch (err: unknown) {
    const errorObj = err as Error;
    const rawErrorMsg = String(errorObj?.message || err || '').trim();
    const cleanMsg =
      rawErrorMsg === 'null' || !rawErrorMsg
        ? 'The FLUX Space returned an error without details. Add a Hugging Face token (hf_...) in Settings > AI Providers > FLUX.1-schnell, or try again later.'
        : rawErrorMsg;

    const lower = cleanMsg.toLowerCase();
    const isQuotaOrRate =
      lower.includes('429') ||
      lower.includes('quota') ||
      lower.includes('rate') ||
      lower.includes('too many requests') ||
      lower.includes('exceeded');
    const isBusyOrTimeout =
      errorObj.name === 'AbortError' ||
      lower.includes('aborted') ||
      lower.includes('timeout') ||
      lower.includes('busy');

    console.error('[FLUX.1-schnell] Error during generation:', cleanMsg);

    if (isQuotaOrRate) {
      return res.status(429).json({
        ok: false,
        error: cleanMsg,
        message: cleanMsg,
      });
    }

    if (isBusyOrTimeout || cleanMsg.includes('Space is busy')) {
      return res.status(503).json({
        ok: false,
        error: 'Space is busy, try again',
        message: 'Space is busy, try again',
      });
    }

    return res.status(502).json({
      ok: false,
      error: cleanMsg,
      message: cleanMsg,
    });
  }
}

fluxSchnellRouter.post('/api/image/flux-schnell', handleFluxSchnellGeneration);
fluxSchnellRouter.post('/api/flux-schnell', handleFluxSchnellGeneration);
fluxSchnellRouter.post('/api/routes/flux-schnell', handleFluxSchnellGeneration);

export default fluxSchnellRouter;
