import { ImageProviderConfig } from '@/types';

/**
 * Builds the request headers for an Image AI provider.
 * Supports custom header names (like 'Ocp-Apim-Subscription-Key' for Pixazo AI)
 * or standard 'Authorization: Bearer <key>' format.
 */
export function buildImageRequestHeaders(
  provider: ImageProviderConfig,
  apiKey?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const keyToUse = apiKey?.trim();
  if (keyToUse) {
    if (provider.customHeaderName && provider.customHeaderName.trim()) {
      headers[provider.customHeaderName.trim()] = keyToUse;
    } else {
      headers['Authorization'] = `Bearer ${keyToUse}`;
    }
  }

  return headers;
}

/**
 * Builds the JSON request body payload for an Image AI provider using its
 * configured requestBodyTemplate, dynamically replacing {prompt}, {width}, and {height}.
 */
export function buildImageRequestBody(
  template?: string,
  prompt: string = '',
  width: number = 1024,
  height: number = 1024
): Record<string, unknown> {
  if (!template || !template.trim()) {
    return {
      prompt,
      inputs: prompt,
      width,
      height,
    };
  }

  const rawTemplate = template.trim();
  try {
    const stringifiedPrompt = JSON.stringify(prompt);
    const replaced = rawTemplate
      .replace(/"\{prompt\}"/g, stringifiedPrompt)
      .replace(/\{prompt\}/g, stringifiedPrompt)
      .replace(/"\{width\}"/g, String(width))
      .replace(/\{width\}/g, String(width))
      .replace(/"\{height\}"/g, String(height))
      .replace(/\{height\}/g, String(height));

    const parsed = JSON.parse(replaced) as Record<string, unknown>;
    return parsed;
  } catch (parseError) {
    console.warn('[ImageProvider] JSON.parse failed on substituted template string, falling back to object substitution:', parseError);
    try {
      const baseObj = JSON.parse(rawTemplate) as unknown;
      const replaceInObj = (obj: unknown): unknown => {
        if (typeof obj === 'string') {
          return obj
            .replace(/\{prompt\}/g, prompt)
            .replace(/\{width\}/g, String(width))
            .replace(/\{height\}/g, String(height));
        }
        if (Array.isArray(obj)) {
          return obj.map(replaceInObj);
        }
        if (obj && typeof obj === 'object') {
          const res: Record<string, unknown> = {};
          for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
            res[key] = replaceInObj(val);
          }
          return res;
        }
        return obj;
      };
      return replaceInObj(baseObj) as Record<string, unknown>;
    } catch {
      return {
        prompt,
        num_steps: 4,
        height,
        width,
      };
    }
  }
}

/**
 * Parses response from image generation APIs supporting:
 * - Direct image URL in "output" field (e.g. Pixazo AI: { "output": "https://..." })
 * - Direct image URLs in "url", "image_url", "data[0].url", "result.url", "images[0]"
 * - Base64 image data in "result.image", "image", "data[0].b64_json", etc.
 */
export function extractImageUrlFromJson(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null;

  const data = json as Record<string, unknown>;

  // 1. Direct output URL (Pixazo AI format)
  if (data.output) {
    if (typeof data.output === 'string' && data.output.trim().length > 0) {
      return data.output.trim();
    }
    if (
      Array.isArray(data.output) &&
      typeof data.output[0] === 'string' &&
      data.output[0].trim().length > 0
    ) {
      return data.output[0].trim();
    }
  }

  // 2. Common direct URL fields
  const dataArray = Array.isArray(data.data) ? (data.data as Array<Record<string, unknown>>) : null;
  const imagesArray = Array.isArray(data.images) ? (data.images as unknown[]) : null;
  const resultObj = data.result && typeof data.result === 'object' ? (data.result as Record<string, unknown>) : null;

  const directUrl =
    (typeof data.url === 'string' && data.url) ||
    (typeof data.image_url === 'string' && data.image_url) ||
    (typeof data.imageUrl === 'string' && data.imageUrl) ||
    (dataArray && typeof dataArray[0]?.url === 'string' && (dataArray[0].url as string)) ||
    (imagesArray && typeof imagesArray[0] === 'string' && (imagesArray[0] as string).startsWith('http') && (imagesArray[0] as string)) ||
    (typeof data.result === 'string' && ((data.result as string).startsWith('http') || (data.result as string).startsWith('data:')) && (data.result as string)) ||
    (resultObj && typeof resultObj.url === 'string' && (resultObj.url as string));

  if (directUrl && typeof directUrl === 'string') {
    return directUrl.trim();
  }

  // 3. Base64 fields (Cloudflare, OpenAI format, Hugging Face JSON, etc.)
  const rawB64 =
    (resultObj && typeof resultObj.image === 'string' && (resultObj.image as string)) ||
    (typeof data.image === 'string' && data.image) ||
    (dataArray && typeof dataArray[0]?.b64_json === 'string' && (dataArray[0].b64_json as string)) ||
    (imagesArray && typeof imagesArray[0] === 'string' && (imagesArray[0] as string)) ||
    (Array.isArray(data.result) && typeof data.result[0] === 'string' && (data.result[0] as string)) ||
    (typeof data.result === 'string' ? data.result : null);

  if (rawB64 && typeof rawB64 === 'string') {
    const trimmed = rawB64.trim();
    return trimmed.startsWith('data:') ? trimmed : `data:image/png;base64,${trimmed}`;
  }

  return null;
}
