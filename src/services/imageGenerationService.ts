import { storage } from '@/lib/storage';
import {
  buildImageRequestBody,
  buildImageRequestHeaders,
  extractImageUrlFromJson,
} from '@/lib/imageProviderUtils';
import { generatePuterImage, DEFAULT_PUTER_MODEL } from '@/services/puterImageService';
import { saveGeneratedImageToIndexedDb } from '@/services/imageIndexedDb';
import type {
  ImageProviderConfig,
  GeneratedImageItem,
  KeyHealthStatus,
} from '@/types';

export interface KeyCandidate {
  id: string;
  key: string;
  label: string;
  status: KeyHealthStatus;
  originalIndex: number;
  cooldownUntil?: number;
}

export interface GenerateImageOptions {
  width?: number;
  height?: number;
  seed?: number;
  model?: string;
  providerId?: string;
  onProgress?: (phase: string) => void;
}

/**
 * Returns prioritized candidate keys for a given image provider.
 */
export function getProviderKeyCandidates(provider: ImageProviderConfig): KeyCandidate[] {
  if (!provider.keys || provider.keys.length === 0) {
    return [{ id: 'default', key: '', label: 'Default / Unauthenticated', status: 'untested', originalIndex: -1 }];
  }

  const valid = provider.keys
    .map((k, idx) => ({
      id: k.id,
      key: (k.key || '').trim(),
      label: k.label || `Key ${idx + 1}`,
      status: k.status,
      originalIndex: idx,
      cooldownUntil: k.cooldownUntil,
    }))
    .filter((k) => k.key.length > 0);

  if (valid.length === 0) {
    return [{ id: 'default', key: '', label: 'Default / Unauthenticated', status: 'untested', originalIndex: -1 }];
  }

  if (provider.keyStrategy === 'manual' && provider.preferredKeyId) {
    const preferred = valid.find((k) => k.id === provider.preferredKeyId);
    if (preferred) {
      const remaining = valid.filter((k) => k.id !== provider.preferredKeyId);
      return [preferred, ...remaining];
    }
  }

  const now = Date.now();
  const sorted = [...valid].sort((a, b) => {
    const getPriority = (k: typeof a) => {
      if (k.status === 'healthy') return 1;
      if (k.status === 'untested') return 2;
      if (k.status === 'cooldown' && k.cooldownUntil && k.cooldownUntil <= now) return 3;
      if (k.status === 'cooldown') return 4;
      if (k.status === 'invalid') return 5;
      return 2;
    };
    const pDiff = getPriority(a) - getPriority(b);
    if (pDiff !== 0) return pDiff;
    return a.originalIndex - b.originalIndex;
  });

  return sorted;
}

/**
 * Helper to build the generation URL for GET providers (e.g. Pollinations)
 */
export function buildGetGenerationUrl(
  promptText: string,
  provider: ImageProviderConfig,
  opts: {
    width: number;
    height: number;
    seed: number;
    model?: string;
    quickEnhance?: boolean;
    nologo?: boolean;
    apiKey?: string;
  }
): string {
  const base = provider.url.trim().replace(/\/+$/, '');
  const encodedPrompt = encodeURIComponent(promptText.trim());
  let fullUrl = `${base}/${encodedPrompt}`;

  const params = new URLSearchParams();

  if (opts.apiKey) {
    params.append('key', opts.apiKey);
  }
  if (opts.width && opts.height) {
    params.append('width', String(opts.width));
    params.append('height', String(opts.height));
  }
  if (opts.seed !== undefined) {
    params.append('seed', String(opts.seed));
  }
  if (opts.model && opts.model !== 'default') {
    params.append('model', opts.model);
  }
  if (opts.quickEnhance) {
    params.append('enhance', 'true');
  }
  if (opts.nologo !== false) {
    params.append('nologo', 'true');
  }

  const queryString = params.toString();
  if (queryString) {
    fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
  }

  return fullUrl;
}

/**
 * Executes single provider generation with its key failover
 */
async function generateWithSingleProvider(
  provider: ImageProviderConfig,
  prompt: string,
  width: number,
  height: number,
  seed: number,
  model?: string
): Promise<{ url: string; modelUsed: string; providerName: string }> {
  const isSdk = provider.requestType === 'sdk';
  const isCloudflare =
    !isSdk &&
    (provider.url.toLowerCase().includes('cloudflare') ||
      provider.name.toLowerCase().includes('cloudflare'));
  const isPost =
    !isSdk &&
    (provider.requestType === 'post' ||
      provider.url.toLowerCase().includes('huggingface') ||
      provider.url.toLowerCase().includes('hf-inference') ||
      isCloudflare ||
      provider.name.toLowerCase().includes('hugging'));

  // 1. Puter SDK Generation
  if (isSdk) {
    const selectedModel = model || provider.model || DEFAULT_PUTER_MODEL;
    console.log(`[ImageGen] Generating with Puter SDK (${selectedModel})...`);
    const puterRes = await generatePuterImage(prompt, selectedModel);
    return {
      url: puterRes.url,
      modelUsed: selectedModel,
      providerName: provider.name || 'Puter AI',
    };
  }

  // 2. POST Inference Generation (Cloudflare, Hugging Face, Pixazo)
  if (isPost) {
    const candidateKeys = getProviderKeyCandidates(provider);
    let lastError: Error | null = null;

    for (let i = 0; i < candidateKeys.length; i++) {
      const candidate = candidateKeys[i];
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      try {
        const targetFetchUrl = isCloudflare ? '/api/proxy/cloudflare-image' : provider.url.trim();
        const requestPayload = isCloudflare
          ? {
              prompt,
              url: provider.url.trim(),
              model: model || provider.model || '@cf/black-forest-labs/flux-1-schnell',
              apiToken: candidate.key,
              apiKey: candidate.key,
            }
          : provider.requestBodyTemplate
          ? buildImageRequestBody(provider.requestBodyTemplate, prompt, width, height)
          : { inputs: prompt, prompt };

        const reqHeaders = buildImageRequestHeaders(provider, candidate.key);

        console.log(`[ImageGen] POST request to ${targetFetchUrl} using key ${candidate.label}...`);
        const response = await fetch(targetFetchUrl, {
          method: 'POST',
          headers: reqHeaders,
          body: JSON.stringify(requestPayload),
          signal: controller.signal,
          mode: 'cors',
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          let errDetail = '';
          try {
            const errJson = await response.json();
            errDetail =
              (Array.isArray(errJson?.errors) && errJson.errors[0]?.message) ||
              errJson?.error ||
              errJson?.message ||
              JSON.stringify(errJson);
          } catch {
            try {
              errDetail = await response.text();
            } catch {
              errDetail = `HTTP ${response.status}: ${response.statusText}`;
            }
          }

          const isRateLimit = response.status === 429 || /rate[- ]?limit|too many requests|quota/i.test(errDetail);
          const isAuth =
            response.status === 401 ||
            response.status === 403 ||
            /unauthori[zs]ed|invalid.*key|authentication/i.test(errDetail);

          if ((isRateLimit || isAuth) && candidate.id !== 'default') {
            storage.updateImageKeyHealth(
              provider.id,
              candidate.id,
              isRateLimit ? 'cooldown' : 'invalid',
              errDetail
            );
          }

          if (i < candidateKeys.length - 1) {
            lastError = new Error(`Key ${candidate.label} failed (${response.status}): ${errDetail}`);
            continue;
          }
          throw new Error(`${provider.name} failed (${response.status}): ${errDetail}`);
        }

        if (candidate.id !== 'default') {
          storage.updateImageKeyHealth(provider.id, candidate.id, 'healthy');
        }

        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        let finalImageUrl = '';

        if (contentType.includes('application/json') || contentType.includes('+json')) {
          const json = await response.json();
          const extracted = extractImageUrlFromJson(json);
          if (extracted) {
            finalImageUrl = extracted;
          } else {
            throw new Error(`${provider.name} JSON response did not contain a valid image URL.`);
          }
        } else {
          const imageBlob = await response.blob();
          const reader = new FileReader();
          finalImageUrl = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(imageBlob);
          });
        }

        const actualModel =
          model ||
          provider.model ||
          (provider.url.split('/').filter(Boolean).pop()) ||
          'POST Inference';

        return {
          url: finalImageUrl,
          modelUsed: actualModel,
          providerName: provider.name,
        };
      } catch (postErr) {
        clearTimeout(timeoutId);
        lastError = postErr instanceof Error ? postErr : new Error(String(postErr));
        if (i < candidateKeys.length - 1) {
          continue;
        }
        throw lastError;
      }
    }

    throw lastError || new Error(`All keys failed for ${provider.name}`);
  }

  // 3. GET Inference Generation (Pollinations, etc.)
  const candidateKeys = getProviderKeyCandidates(provider);
  let lastError: Error | null = null;

  for (let i = 0; i < candidateKeys.length; i++) {
    const candidate = candidateKeys[i];
    const generatedUrl = buildGetGenerationUrl(prompt, provider, {
      width,
      height,
      seed,
      model: model || provider.model || 'flux',
      nologo: true,
      apiKey: candidate.key,
    });

    try {
      console.log(`[ImageGen] Testing GET generation URL for ${provider.name}...`);
      
      // Perform preloading with Image() and timeout
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        const timeout = setTimeout(() => {
          img.src = '';
          reject(new Error('Image generation timed out after 35 seconds.'));
        }, 35000);

        img.onload = () => {
          clearTimeout(timeout);
          resolve();
        };

        img.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Failed to load image from provider.'));
        };

        img.src = generatedUrl;
      });

      if (candidate.id !== 'default') {
        storage.updateImageKeyHealth(provider.id, candidate.id, 'healthy');
      }

      return {
        url: generatedUrl,
        modelUsed: model || provider.model || 'flux',
        providerName: provider.name,
      };
    } catch (getErr) {
      lastError = getErr instanceof Error ? getErr : new Error(String(getErr));
      if (candidate.id !== 'default') {
        storage.updateImageKeyHealth(provider.id, candidate.id, 'cooldown', lastError.message);
      }
      if (i < candidateKeys.length - 1) {
        continue;
      }
      throw lastError;
    }
  }

  throw lastError || new Error(`Generation failed on ${provider.name}`);
}

/**
 * Main image generation engine with multi-provider failover.
 * Generates an image using the active provider or fallback providers,
 * and saves it into IndexedDB history.
 */
export async function generateStudioImage(
  prompt: string,
  options: GenerateImageOptions = {}
): Promise<GeneratedImageItem> {
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) {
    throw new Error('Prompt cannot be empty.');
  }

  const state = storage.getImageProvidersState();
  const width = options.width || 1024;
  const height = options.height || 1024;
  const seed = options.seed ?? Math.floor(Math.random() * 1000000);

  // Determine provider sequence starting with active/requested provider
  const providersList = [...state.providers];
  let targetProviderId = options.providerId || state.activeProviderId;
  let primaryProvider = providersList.find((p) => p.id === targetProviderId) || providersList[0];

  if (!primaryProvider) {
    // Default fallback to standard Pollinations config
    primaryProvider = {
      id: 'pollinations',
      name: 'Pollinations AI',
      url: 'https://image.pollinations.ai/prompt',
      requestType: 'get',
      model: 'flux',
      keys: [],
    };
    providersList.push(primaryProvider);
  }

  // Build failover list: Primary provider first, followed by others in order
  const failoverQueue = [
    primaryProvider,
    ...providersList.filter((p) => p.id !== primaryProvider.id),
  ];

  let lastError: Error | null = null;

  for (let pIdx = 0; pIdx < failoverQueue.length; pIdx++) {
    const provider = failoverQueue[pIdx];
    options.onProgress?.(`Generating with ${provider.name}...`);

    console.group(
      `%c[ImageStudio Failover Engine] Attempting Provider ${pIdx + 1}/${failoverQueue.length}: ${provider.name}`,
      'color: #06b6d4; font-weight: bold;'
    );
    console.log('Provider Name:', provider.name);
    console.log('Request Type:', provider.requestType);
    console.log('Model:', options.model || provider.model || 'default');
    console.log('Dimensions:', `${width}x${height}`);
    console.log('Seed:', seed);
    console.groupEnd();

    try {
      const result = await generateWithSingleProvider(
        provider,
        cleanPrompt,
        width,
        height,
        seed,
        options.model
      );

      const generatedItem: GeneratedImageItem = {
        id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        url: result.url,
        imageData: result.url,
        prompt: cleanPrompt,
        providerName: result.providerName,
        width,
        height,
        seed,
        model: result.modelUsed,
        timestamp: Date.now(),
      };

      // Persist in IndexedDB
      try {
        await saveGeneratedImageToIndexedDb(generatedItem);
      } catch (dbErr) {
        console.warn('[ImageGen] IndexedDB save warning:', dbErr);
      }

      return generatedItem;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(
        `%c[ImageStudio Failover Engine] Provider "${provider.name}" failed: ${lastError.message}. ${
          pIdx < failoverQueue.length - 1
            ? `Failing over to next provider: ${failoverQueue[pIdx + 1].name}...`
            : 'All providers in failover queue exhausted.'
        }`,
        'color: #f59e0b; font-weight: bold;'
      );
    }
  }

  throw (
    lastError ||
    new Error('All Image AI providers failed to generate an image. Please verify your provider settings.')
  );
}
