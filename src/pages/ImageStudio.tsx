import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Image as ImageIcon,
  Sparkles,
  Download,
  RotateCw,
  Copy,
  ExternalLink,
  Settings,
  Dice5,
  Check,
  AlertCircle,
  Maximize2,
  X,
  Layers,
  Trash2,
  Database,
  Wand2,
  UploadCloud,
  ImagePlus,
  ArrowRightLeft,
  Columns,
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { api } from '@/services/api';
import { playTapSound } from '@/lib/audio';
import {
  getStoredGeneratedImages,
  saveGeneratedImageToIndexedDb,
  deleteGeneratedImageFromIndexedDb,
  clearAllGeneratedImagesFromIndexedDb,
} from '@/services/imageIndexedDb';
import {
  generatePuterImage,
  resetPuterSession,
  getPuterDebugInfo,
  PuterDebugInfo,
  DEFAULT_PUTER_MODEL,
  PUTER_IMAGE_MODELS,
} from '@/services/puterImageService';
import type {
  ImageProviderConfig,
  ImageProvidersState,
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

const SAMPLE_PROMPTS = [
  'Futuristic cyberpunk metropolis bathed in neon rain, volumetric fog, octane render 8k',
  'Whimsical isometric greenhouse laboratory with bioluminescent alien flora, digital art',
  'Astronaut exploring an ancient crystal cave on a desolate purple moon, photorealistic',
  'Hyperrealistic macro close-up of a glass butterfly with iridescent prismatic wings',
  'Minimalist brutalist villa overlooking a calm misty Scandinavian fjord at dawn',
  'Studio portrait of a mechanical cybernetic owl with glowing brass clockwork gears',
];

const ASPECT_RATIOS = [
  { label: '1:1 Square', width: 1024, height: 1024, icon: '■' },
  { label: '16:9 Landscape', width: 1280, height: 720, icon: '▬' },
  { label: '9:16 Portrait', width: 720, height: 1280, icon: '▮' },
  { label: '4:3 Standard', width: 1024, height: 768, icon: '▭' },
  { label: '3:2 Photo', width: 1200, height: 800, icon: '▰' },
];

interface ReferenceImageDetails {
  isDataUrl: boolean;
  mimeType: string;
  byteSize: number;
  formattedSize: string;
  blob?: Blob;
  file?: File;
  rawUrl?: string;
  base64Only?: string;
}

function parseReferenceImageData(
  dataUrlOrUrl: string,
  fileName?: string | null
): ReferenceImageDetails {
  if (dataUrlOrUrl.startsWith('data:')) {
    const commaIndex = dataUrlOrUrl.indexOf(',');
    const header = commaIndex !== -1 ? dataUrlOrUrl.slice(0, commaIndex) : 'data:image/png;base64';
    const base64Str = commaIndex !== -1 ? dataUrlOrUrl.slice(commaIndex + 1) : dataUrlOrUrl;

    const mimeMatch = header.match(/^data:([^;]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

    try {
      const binaryStr = atob(base64Str);
      const len = binaryStr.length;
      const u8arr = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        u8arr[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([u8arr], { type: mimeType });
      const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
      const name = fileName || `reference_image.${ext}`;
      const file = new File([blob], name, { type: mimeType });

      return {
        isDataUrl: true,
        mimeType,
        byteSize: len,
        formattedSize:
          len > 1024 * 1024
            ? `${(len / (1024 * 1024)).toFixed(2)} MB`
            : `${(len / 1024).toFixed(2)} KB`,
        blob,
        file,
        base64Only: base64Str,
      };
    } catch {
      return {
        isDataUrl: true,
        mimeType,
        byteSize: base64Str.length,
        formattedSize: `${(base64Str.length / 1024).toFixed(2)} KB (raw base64)`,
        base64Only: base64Str,
      };
    }
  }

  return {
    isDataUrl: false,
    mimeType: 'image/remote-url',
    byteSize: dataUrlOrUrl.length,
    formattedSize: `${dataUrlOrUrl.length} chars (remote URL)`,
    rawUrl: dataUrlOrUrl,
  };
}

export function ImageStudio() {
  const [prompt, setPrompt] = useState('');
  const [imageProvidersState, setImageProvidersState] = useState<ImageProvidersState>(() =>
    storage.getImageProvidersState()
  );
  const [selectedProviderId, setSelectedProviderId] = useState<string>(() => {
    const s = storage.getImageProvidersState();
    return s.activeProviderId || s.providers[0]?.id || '';
  });

  const [selectedRatioIndex, setSelectedRatioIndex] = useState(0);
  const [modelType, setModelType] = useState('flux');
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 1000000));
  const [quickEnhance, setQuickEnhance] = useState(false);
  const [smartAiEnhance, setSmartAiEnhance] = useState(false);
  const [nologo, setNologo] = useState(true);

  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<'idle' | 'enhancing' | 'generating'>('idle');
  const [failoverNotice, setFailoverNotice] = useState<string | null>(null);
  const [lastEnhancedPrompt, setLastEnhancedPrompt] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState<GeneratedImageItem | null>(null);
  const [history, setHistory] = useState<GeneratedImageItem[]>([]);
  const [fullscreenImage, setFullscreenImage] = useState<GeneratedImageItem | null>(null);
  const [hasDismissedPuterNotice, setHasDismissedPuterNotice] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nexus_seen_puter_notice') === 'true';
    } catch {
      return false;
    }
  });
  const [isResettingSession, setIsResettingSession] = useState(false);
  const [sessionResetMessage, setSessionResetMessage] = useState<string | null>(null);
  const [puterDebugInfo, setPuterDebugInfo] = useState<PuterDebugInfo | null>(null);
  const [showPuterDebug, setShowPuterDebug] = useState(true);

  // Image editing (img2img) state
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceImageName, setReferenceImageName] = useState<string | null>(null);
  const [referenceImageSize, setReferenceImageSize] = useState<number | null>(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [comparisonLayout, setComparisonLayout] = useState<'side-by-side' | 'result-only'>('side-by-side');
  const [puterSelectedModel, setPuterSelectedModel] = useState<string>(() => {
    const fresh = storage.getImageProvidersState();
    const curP = fresh.providers.find((p) => p.id === fresh.activeProviderId);
    return curP?.model || DEFAULT_PUTER_MODEL;
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync provider list on mount / tab focus
  useEffect(() => {
    const fresh = storage.getImageProvidersState();
    setImageProvidersState(fresh);
    if (!selectedProviderId || !fresh.providers.some((p) => p.id === selectedProviderId)) {
      setSelectedProviderId(fresh.activeProviderId || fresh.providers[0]?.id || '');
    }
  }, [selectedProviderId]);

  // Sync Puter model when active provider changes
  useEffect(() => {
    const cur = imageProvidersState.providers.find((p) => p.id === selectedProviderId);
    if (cur?.requestType === 'sdk' && cur.model) {
      setPuterSelectedModel(cur.model);
    }
  }, [selectedProviderId, imageProvidersState]);

  // Restore persistent generated images history from IndexedDB on page load
  useEffect(() => {
    let isMounted = true;
    const loadStoredHistory = async () => {
      try {
        const stored = await getStoredGeneratedImages();
        if (isMounted && stored && stored.length > 0) {
          setHistory(stored);
          setCurrentImage((prev) => prev || stored[0]);
        }
      } catch (err) {
        console.warn('[ImageStudio] Failed to load image history from IndexedDB:', err);
      }
    };
    loadStoredHistory();
    return () => {
      isMounted = false;
    };
  }, []);

  const activeProvider: ImageProviderConfig | undefined =
    imageProvidersState.providers.find((p) => p.id === selectedProviderId) ||
    imageProvidersState.providers[0];

  const isSdk = activeProvider?.requestType === 'sdk';
  const isPost =
    !isSdk &&
    (activeProvider?.requestType === 'post' ||
      activeProvider?.url?.toLowerCase().includes('huggingface') ||
      activeProvider?.url?.toLowerCase().includes('cloudflare') ||
      activeProvider?.name?.toLowerCase().includes('hugging') ||
      activeProvider?.name?.toLowerCase().includes('cloudflare'));
  const isPollinations = !isSdk && !isPost;

  const pollinationsProvider = imageProvidersState.providers.find(
    (p) =>
      p.requestType !== 'sdk' &&
      p.requestType !== 'post' &&
      !p.url.toLowerCase().includes('huggingface') &&
      !p.url.toLowerCase().includes('cloudflare')
  );
  const puterProvider = imageProvidersState.providers.find((p) => p.requestType === 'sdk');

  // Handle image file upload for img2img editing
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (PNG, JPG, WebP).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('Image file is too large (maximum size is 15 MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setReferenceImage(result);
      setReferenceImageName(file.name);
      setReferenceImageSize(file.size);
      setError(null);
      playTapSound();

      // If Pollinations is selected, auto-select 'kontext' for image editing
      if (isPollinations) {
        setModelType('kontext');
      }
      // If Puter is selected, ensure an editing-capable model is selected
      if (activeProvider?.requestType === 'sdk') {
        if (
          puterSelectedModel !== 'black-forest-labs/flux-kontext-pro' &&
          puterSelectedModel !== 'google/gemini-2.5-flash-image'
        ) {
          setPuterSelectedModel('black-forest-labs/flux-kontext-pro');
        }
      }
    };
    reader.onerror = () => {
      setError('Failed to read image file. Please try another image.');
    };
    reader.readAsDataURL(file);
  };

  const handleClearReferenceImage = () => {
    playTapSound();
    setReferenceImage(null);
    setReferenceImageName(null);
    setReferenceImageSize(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (modelType === 'kontext') {
      setModelType('flux');
    }
  };

  // Return all candidate keys for the provider, prioritized according to strategy (failover, manual, round_robin)
  const getProviderKeyCandidates = useCallback((provider: ImageProviderConfig): KeyCandidate[] => {
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

    // Manual strategy: place preferred key first, then remaining valid keys in original order
    if (provider.keyStrategy === 'manual' && provider.preferredKeyId) {
      const preferred = valid.find((k) => k.id === provider.preferredKeyId);
      if (preferred) {
        const remaining = valid.filter((k) => k.id !== provider.preferredKeyId);
        return [preferred, ...remaining];
      }
    }

    // Failover strategy: prioritize healthy and untested keys first, then expired cooldown, then active cooldown, then invalid
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
  }, []);

  // Resolve active API key for the selected provider (picks highest-priority candidate)
  const getResolvedApiKey = useCallback(
    (provider: ImageProviderConfig): string => {
      const candidates = getProviderKeyCandidates(provider);
      return candidates[0]?.key || '';
    },
    [getProviderKeyCandidates]
  );

  // Update key health in storage and refresh local state
  const markKeyHealth = useCallback(
    (providerId: string, candidate: KeyCandidate, status: KeyHealthStatus, errorMsg?: string) => {
      if (!candidate.id || candidate.id === 'default') return;
      storage.updateImageKeyHealth(providerId, candidate.id, status, errorMsg);
      setImageProvidersState(storage.getImageProvidersState());
    },
    []
  );

  // Build the generation URL
  const buildGenerationUrl = useCallback(
    (
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
    ) => {
      const base = provider.url.trim().replace(/\/+$/, '');
      const encodedPrompt = encodeURIComponent(promptText.trim());
      let fullUrl = `${base}/${encodedPrompt}`;

      const key = opts.apiKey !== undefined ? opts.apiKey : getResolvedApiKey(provider);
      const params = new URLSearchParams();

      if (key) {
        params.append('key', key);
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
      if (opts.nologo) {
        params.append('nologo', 'true');
      }

      const queryString = params.toString();
      if (queryString) {
        fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
      }

      return fullUrl;
    },
    [getResolvedApiKey]
  );

  // Generate Image Handler with Smart AI Enhance & Quick Enhance support
  const handleGenerate = async (overridePrompt?: string) => {
    const rawInputPrompt = (overridePrompt ?? prompt).trim();
    if (!rawInputPrompt) {
      setError('Please enter a description for your image.');
      return;
    }

    if (!activeProvider) {
      setError('No Image Provider configured. Please check Settings -> AI Providers.');
      return;
    }

    playTapSound();
    setError(null);
    setFailoverNotice(null);
    setLoading(true);

    let promptToUse = rawInputPrompt;
    let enhancedPromptUsed: string | undefined = undefined;

    // Phase 1: Smart AI Enhance (if enabled)
    if (smartAiEnhance) {
      setLoadingPhase('enhancing');
      try {
        const activeAiProvider = storage.getActiveAIProvider();
        const enhanceRes = await api.jarvisAgentCall({
          agentId: 'image-prompt-enhancer',
          messages: [
            {
              role: 'system',
              content:
                'Fix any spelling/grammar mistakes in this image prompt, and rewrite it to be more vivid and descriptive for an AI image generator, while keeping the original meaning and subject. Return ONLY the improved prompt text, nothing else.',
            },
            {
              role: 'user',
              content: rawInputPrompt,
            },
          ],
          providerConfig: activeAiProvider,
          temperature: 0.7,
          maxTokens: 350,
          timeoutMs: 25000,
        });

        if (enhanceRes?.ok && enhanceRes.text && enhanceRes.text.trim().length > 0) {
          let cleaned = enhanceRes.text.trim();
          // Remove surrounding markdown quotes or prefixes if returned by LLM
          cleaned = cleaned.replace(/^["'“”]+|["'“”]+$/g, '').trim();
          cleaned = cleaned.replace(/^(?:Enhanced prompt|Improved prompt|Rewritten prompt|Prompt):\s*/i, '').trim();
          if (cleaned.length > 0) {
            promptToUse = cleaned;
            enhancedPromptUsed = cleaned;
            setLastEnhancedPrompt(cleaned);
          }
        }
      } catch (enhanceErr) {
        console.warn('[ImageStudio] Smart AI Enhance failed, proceeding with original prompt:', enhanceErr);
      }
    }

    // Phase 2: Image Generation
    setLoadingPhase('generating');
    const ratio = ASPECT_RATIOS[selectedRatioIndex] || ASPECT_RATIOS[0];
    const currentSeed = seed;

    const isSdk = activeProvider.requestType === 'sdk';
    const isPost =
      !isSdk &&
      (activeProvider.requestType === 'post' ||
        activeProvider.url.toLowerCase().includes('huggingface') ||
        activeProvider.url.toLowerCase().includes('hf-inference') ||
        activeProvider.url.toLowerCase().includes('cloudflare') ||
        activeProvider.name.toLowerCase().includes('cloudflare'));

    // Check: Cloudflare / Hugging Face POST providers do not support direct img2img editing
    if (isPost && referenceImage) {
      setError(
        `${activeProvider.name} does not support image editing (img2img). Please switch to Pollinations (using the 'kontext' model) or Puter (using FLUX Kontext Pro or Gemini 2.5 Flash Image) to edit your reference image.`
      );
      setLoading(false);
      setLoadingPhase('idle');
      return;
    }

    if (isPost && activeProvider.url.includes('YOUR_ACCOUNT_ID')) {
      setError(
        "Please replace 'YOUR_ACCOUNT_ID' in your Cloudflare provider settings with your actual Cloudflare Account ID (Settings -> AI Providers)."
      );
      setLoading(false);
      setLoadingPhase('idle');
      return;
    }

    try {
      let finalImageUrl = '';

      if (isSdk) {
        // Puter.js in-browser SDK generation with free guest session
        // Pass reference image to Puter's editing-capable call when present
        const selectedModel =
          puterSelectedModel ||
          activeProvider.model ||
          (referenceImage ? 'black-forest-labs/flux-kontext-pro' : DEFAULT_PUTER_MODEL);
        const puterResult = await generatePuterImage(promptToUse, selectedModel, referenceImage || undefined);
        finalImageUrl = puterResult.url;
      } else if (isPost) {
        // POST inference (Cloudflare Workers AI or Hugging Face) with automatic key failover
        const isCloudflare =
          activeProvider.url.toLowerCase().includes('cloudflare') ||
          activeProvider.name.toLowerCase().includes('cloudflare');
        const candidateKeys = getProviderKeyCandidates(activeProvider);
        let lastError: Error | null = null;

        for (let attemptIndex = 0; attemptIndex < candidateKeys.length; attemptIndex++) {
          const candidate = candidateKeys[attemptIndex];
          const keyIdx = candidate.originalIndex >= 0 ? candidate.originalIndex : 0;
          console.group(
            `%c[ImageStudio Failover] [${activeProvider.name}] Attempting Generation (Key Index: ${keyIdx})`,
            'color: #38bdf8; font-weight: bold;'
          );
          console.log('Provider:', activeProvider.name);
          console.log('Key Index Used:', keyIdx);
          console.log('Key Label:', candidate.label);
          console.log('Key ID:', candidate.id);
          console.log('Attempt:', `${attemptIndex + 1} of ${candidateKeys.length}`);
          console.groupEnd();

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 45000);

          try {
            const targetFetchUrl = isCloudflare ? '/api/proxy/cloudflare-image' : activeProvider.url.trim();
            const requestPayload = isCloudflare
              ? {
                  prompt: promptToUse,
                  url: activeProvider.url.trim(),
                  model: activeProvider.model,
                  apiToken: candidate.key,
                  apiKey: candidate.key,
                }
              : { inputs: promptToUse, prompt: promptToUse };

            const response = await fetch(targetFetchUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(candidate.key ? { Authorization: `Bearer ${candidate.key}` } : {}),
              },
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
              const isAuthFailure =
                response.status === 401 ||
                response.status === 403 ||
                /unauthori[zs]ed|invalid.*key|authentication/i.test(errDetail);

              if (isRateLimit || isAuthFailure) {
                markKeyHealth(
                  activeProvider.id,
                  candidate,
                  isRateLimit ? 'cooldown' : 'invalid',
                  errDetail || (isRateLimit ? 'Rate limit exceeded (HTTP 429)' : `Auth error (${response.status})`)
                );

                console.warn(
                  `%c[ImageStudio Failover] [${activeProvider.name}] Key index ${keyIdx} (${candidate.label}) encountered ${isRateLimit ? 'Rate-Limit (HTTP 429)' : `Auth-Failure (HTTP ${response.status})`}: "${errDetail}". ${attemptIndex < candidateKeys.length - 1 ? `Automatically retrying with next available key index ${candidateKeys[attemptIndex + 1].originalIndex}...` : 'All available keys exhausted.'}`,
                  'color: #f59e0b; font-weight: bold;'
                );

                if (attemptIndex < candidateKeys.length - 1) {
                  setFailoverNotice(
                    `Key #${keyIdx + 1} (${candidate.label}) hit ${isRateLimit ? 'Rate-Limit (429)' : 'Auth error'}. Failing over to Key #${candidateKeys[attemptIndex + 1].originalIndex + 1}...`
                  );
                  lastError = new Error(
                    `Key index ${keyIdx} failed (${response.status}): ${errDetail || response.statusText}`
                  );
                  continue;
                }
              }

              if (response.status === 503) {
                throw new Error(
                  `Model is currently warming up on ${activeProvider.name} (${errDetail || 'Estimated time ~20s'}). Please click Generate again in a few moments.`
                );
              } else if (response.status === 401 || response.status === 403) {
                throw new Error(
                  `Authentication Error (${response.status}): ${errDetail || 'Invalid API key or unauthorized request.'}`
                );
              } else {
                throw new Error(
                  `Provider returned error (${response.status}): ${errDetail || response.statusText}`
                );
              }
            }

            markKeyHealth(activeProvider.id, candidate, 'healthy');
            console.log(
              `%c[ImageStudio Failover] [${activeProvider.name}] Key index ${keyIdx} (${candidate.label}) succeeded! Marked healthy.`,
              'color: #34d399; font-weight: bold;'
            );

            // Handle both Cloudflare Workers AI JSON format (result.image base64) and Hugging Face raw binary blob format
            const contentType = (response.headers.get('content-type') || '').toLowerCase();
            if (contentType.includes('application/json') || contentType.includes('+json')) {
              const json = await response.json();
              const rawB64 =
                json?.result?.image ||
                json?.image ||
                (Array.isArray(json?.data) && json.data[0]?.b64_json) ||
                (Array.isArray(json?.images) && json.images[0]) ||
                (Array.isArray(json?.result) && json.result[0]) ||
                (typeof json?.result === 'string' ? json.result : null);

              if (rawB64 && typeof rawB64 === 'string') {
                finalImageUrl = rawB64.startsWith('data:')
                  ? rawB64
                  : `data:image/png;base64,${rawB64.trim()}`;
              } else if (json?.success === false || (Array.isArray(json?.errors) && json.errors.length > 0)) {
                const errMsg = json.errors?.[0]?.message || json.errors?.[0] || json.error || 'Cloudflare returned an error';
                throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
              } else {
                throw new Error('Cloudflare JSON response did not contain an image field (expected result.image).');
              }
            } else {
              // Raw binary blob (Hugging Face / direct binary stream)
              const imageBlob = await response.blob();
              if (imageBlob.type.includes('json')) {
                try {
                  const text = await imageBlob.text();
                  const json = JSON.parse(text);
                  const rawB64 =
                    json?.result?.image ||
                    json?.image ||
                    (Array.isArray(json?.data) && json.data[0]?.b64_json);
                  if (rawB64 && typeof rawB64 === 'string') {
                    finalImageUrl = rawB64.startsWith('data:')
                      ? rawB64
                      : `data:image/png;base64,${rawB64.trim()}`;
                  }
                } catch {
                  // Not JSON, continue with blob reader
                }
              }

              if (!finalImageUrl) {
                const blobToDataUrl = (blob: Blob): Promise<string> =>
                  new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                  });
                finalImageUrl = await blobToDataUrl(imageBlob);
              }
            }

            lastError = null;
            break;
          } catch (fetchErr: unknown) {
            clearTimeout(timeoutId);
            const errObj = fetchErr instanceof Error ? fetchErr : new Error(String(fetchErr));
            lastError = errObj;
            const errMsg = errObj.message;
            const isAuthOrRate = /429|401|403|rate[- ]?limit|unauthori[zs]ed|api key/i.test(errMsg);

            if (isAuthOrRate && attemptIndex < candidateKeys.length - 1) {
              markKeyHealth(
                activeProvider.id,
                candidate,
                /429|rate/i.test(errMsg) ? 'cooldown' : 'invalid',
                errMsg
              );
              console.warn(
                `%c[ImageStudio Failover] [${activeProvider.name}] Exception on key index ${keyIdx} (${candidate.label}): "${errMsg}". Failing over to next key index ${candidateKeys[attemptIndex + 1].originalIndex}...`,
                'color: #f59e0b; font-weight: bold;'
              );
              setFailoverNotice(
                `Key #${keyIdx + 1} (${candidate.label}) error. Failing over to Key #${candidateKeys[attemptIndex + 1].originalIndex + 1}...`
              );
              continue;
            }
            throw fetchErr;
          }
        }

        if (!finalImageUrl && lastError) {
          throw lastError;
        }
      } else if (referenceImage && (modelType === 'kontext' || isPollinations)) {
        // Pollinations OpenAI-compatible image editing API (/v1/images/edits) with automatic key failover
        const providerUrl = (activeProvider.url || '').trim();
        let endpoint = 'https://gen.pollinations.ai/v1/images/edits';
        if (providerUrl.includes('/v1/images/edits')) {
          endpoint = providerUrl;
        } else if (providerUrl.includes('gen.pollinations.ai')) {
          endpoint = `${providerUrl.replace(/\/+$/, '')}/v1/images/edits`;
        } else if (
          providerUrl &&
          !providerUrl.includes('image.pollinations.ai') &&
          !providerUrl.includes('pollinations.ai/prompt')
        ) {
          endpoint = providerUrl.endsWith('/edits')
            ? providerUrl
            : `${providerUrl.replace(/\/+$/, '')}/v1/images/edits`;
        }

        const candidateKeys = getProviderKeyCandidates(activeProvider);
        const imgDetails = parseReferenceImageData(referenceImage, referenceImageName);

        console.group('%c[Pollinations kontext img2img] Request Setup', 'color: #38bdf8; font-weight: bold;');
        console.log('Target Endpoint:', endpoint);
        console.log('Model:', 'kontext');
        console.log('Prompt:', promptToUse);
        console.log('Reference Image Format:', imgDetails.mimeType);
        console.log('Reference Image Data Size:', imgDetails.formattedSize);
        console.log('Reference Image Byte Count:', imgDetails.byteSize, 'bytes');
        console.log('Is Base64 Data URL:', imgDetails.isDataUrl);
        console.log('File Name Attached:', referenceImageName || 'reference_image.png');
        console.log('Output Dimensions:', `${ratio.width}x${ratio.height}`);
        console.log('Seed:', currentSeed);
        console.log('Available Candidate Keys:', candidateKeys.length);
        console.groupEnd();

        let lastError: Error | null = null;

        for (let attemptIndex = 0; attemptIndex < candidateKeys.length; attemptIndex++) {
          const candidate = candidateKeys[attemptIndex];
          const keyIdx = candidate.originalIndex >= 0 ? candidate.originalIndex : 0;
          console.group(
            `%c[ImageStudio Failover] [Pollinations kontext] Attempting Request (Key Index: ${keyIdx})`,
            'color: #38bdf8; font-weight: bold;'
          );
          console.log('Provider:', activeProvider.name);
          console.log('Key Index Used:', keyIdx);
          console.log('Key Label:', candidate.label);
          console.log('Key ID:', candidate.id);
          console.log('Has Key Value:', Boolean(candidate.key));
          console.log('Attempt:', `${attemptIndex + 1} of ${candidateKeys.length}`);
          console.groupEnd();

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000);

          // Construct Multipart FormData with attached reference image file/blob
          const formData = new FormData();
          formData.append('prompt', promptToUse);
          formData.append('model', 'kontext');
          formData.append('size', `${ratio.width}x${ratio.height}`);
          formData.append('response_format', 'b64_json');
          if (currentSeed !== undefined) {
            formData.append('seed', String(currentSeed));
          }
          if (nologo) {
            formData.append('nologo', 'true');
          }

          if (imgDetails.file) {
            formData.append('image', imgDetails.file);
          } else if (imgDetails.blob) {
            formData.append('image', imgDetails.blob, referenceImageName || 'reference_image.png');
          } else if (imgDetails.rawUrl) {
            formData.append('image', imgDetails.rawUrl);
          } else {
            formData.append('image', referenceImage);
          }

          const headers: Record<string, string> = {};
          if (candidate.key) {
            headers['Authorization'] = `Bearer ${candidate.key}`;
          }

          try {
            console.log(
              `[Pollinations kontext] Transmitting payload with key index ${keyIdx} (${candidate.label}) to ${endpoint}...`
            );

            const response = await fetch(endpoint, {
              method: 'POST',
              headers,
              body: formData,
              signal: controller.signal,
              mode: 'cors',
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
              let errDetail = '';
              try {
                const errJson = await response.json();
                errDetail =
                  errJson?.error?.message ||
                  errJson?.message ||
                  errJson?.error ||
                  JSON.stringify(errJson);
              } catch {
                errDetail = `HTTP ${response.status}: ${response.statusText}`;
              }
              console.error('[Pollinations kontext] Error response from server:', response.status, errDetail);

              const isRateLimit = response.status === 429 || /rate[- ]?limit|too many requests|quota/i.test(errDetail);
              const isAuthFailure =
                response.status === 401 ||
                response.status === 403 ||
                errDetail.toLowerCase().includes('api key') ||
                /unauthori[zs]ed|invalid.*key|authentication/i.test(errDetail);

              if (isRateLimit || isAuthFailure) {
                markKeyHealth(
                  activeProvider.id,
                  candidate,
                  isRateLimit ? 'cooldown' : 'invalid',
                  errDetail || (isRateLimit ? 'Rate limit exceeded (HTTP 429)' : `Auth error (${response.status})`)
                );

                console.warn(
                  `%c[ImageStudio Failover] [Pollinations kontext] Key index ${keyIdx} (${candidate.label}) encountered ${isRateLimit ? 'Rate-Limit (HTTP 429)' : `Auth-Failure (HTTP ${response.status})`}: "${errDetail}". ${attemptIndex < candidateKeys.length - 1 ? `Automatically retrying with next available key index ${candidateKeys[attemptIndex + 1].originalIndex}...` : 'All available keys exhausted.'}`,
                  'color: #f59e0b; font-weight: bold;'
                );

                if (attemptIndex < candidateKeys.length - 1) {
                  setFailoverNotice(
                    `Key #${keyIdx + 1} (${candidate.label}) hit ${isRateLimit ? 'Rate-Limit (429)' : 'Auth error'}. Failing over to Key #${candidateKeys[attemptIndex + 1].originalIndex + 1}...`
                  );
                  lastError = new Error(
                    `Key index ${keyIdx} failed (${response.status}): ${errDetail}`
                  );
                  continue;
                }
              }

              if (response.status === 401 || errDetail.toLowerCase().includes('api key')) {
                throw new Error(
                  `Pollinations image editing requires an API key (${errDetail}). You can obtain a free key at https://enter.pollinations.ai/keys and add it in Settings -> AI Providers -> Pollinations. Or switch to Puter (FLUX Kontext Pro) for free in-browser guest editing.`
                );
              }
              throw new Error(`Pollinations editing failed (${response.status}): ${errDetail}`);
            }

            // Success!
            markKeyHealth(activeProvider.id, candidate, 'healthy');
            console.log(
              `%c[ImageStudio Failover] [Pollinations kontext] Key index ${keyIdx} (${candidate.label}) succeeded! Marked healthy.`,
              'color: #34d399; font-weight: bold;'
            );

            const contentType = response.headers.get('content-type') || '';
            console.log(`[Pollinations kontext] Received response (${response.status}), Content-Type: ${contentType}`);

            if (contentType.includes('application/json')) {
              const json = await response.json();
              const item = json?.data?.[0];
              if (item?.b64_json) {
                finalImageUrl = item.b64_json.startsWith('data:')
                  ? item.b64_json
                  : `data:image/png;base64,${item.b64_json}`;
              } else if (item?.url) {
                finalImageUrl = item.url;
              } else if (json?.url) {
                finalImageUrl = json.url;
              } else if (json?.image) {
                finalImageUrl = json.image.startsWith('data:')
                  ? json.image
                  : `data:image/png;base64,${json.image}`;
              } else {
                throw new Error('Pollinations returned JSON without an edited image result.');
              }
            } else {
              // Binary image response
              const imageBlob = await response.blob();
              const blobToDataUrl = (blob: Blob): Promise<string> =>
                new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                });
              finalImageUrl = await blobToDataUrl(imageBlob);
            }

            lastError = null;
            break;
          } catch (pollErr: unknown) {
            clearTimeout(timeoutId);
            const errObj = pollErr instanceof Error ? pollErr : new Error(String(pollErr));
            lastError = errObj;
            const errMsg = errObj.message;
            const isAuthOrRate = /429|401|403|rate[- ]?limit|unauthori[zs]ed|api key/i.test(errMsg);

            if (isAuthOrRate && attemptIndex < candidateKeys.length - 1) {
              markKeyHealth(
                activeProvider.id,
                candidate,
                /429|rate/i.test(errMsg) ? 'cooldown' : 'invalid',
                errMsg
              );
              console.warn(
                `%c[ImageStudio Failover] [Pollinations kontext] Exception on key index ${keyIdx} (${candidate.label}): "${errMsg}". Failing over to next key index ${candidateKeys[attemptIndex + 1].originalIndex}...`,
                'color: #f59e0b; font-weight: bold;'
              );
              setFailoverNotice(
                `Key #${keyIdx + 1} (${candidate.label}) error. Failing over to Key #${candidateKeys[attemptIndex + 1].originalIndex + 1}...`
              );
              continue;
            }
            throw pollErr;
          }
        }

        if (!finalImageUrl && lastError) {
          throw lastError;
        }
      } else {
        // Standard text-to-image synthesis with automatic key failover
        const candidateKeys = getProviderKeyCandidates(activeProvider);
        let lastError: Error | null = null;

        for (let attemptIndex = 0; attemptIndex < candidateKeys.length; attemptIndex++) {
          const candidate = candidateKeys[attemptIndex];
          const keyIdx = candidate.originalIndex >= 0 ? candidate.originalIndex : 0;
          console.group(
            `%c[ImageStudio Failover] [Standard Gen] Attempting Request (Key Index: ${keyIdx})`,
            'color: #38bdf8; font-weight: bold;'
          );
          console.log('Provider:', activeProvider.name);
          console.log('Key Index Used:', keyIdx);
          console.log('Key Label:', candidate.label);
          console.log('Key ID:', candidate.id);
          console.log('Has Key Value:', Boolean(candidate.key));
          console.log('Attempt:', `${attemptIndex + 1} of ${candidateKeys.length}`);
          console.groupEnd();

          const generatedUrl = buildGenerationUrl(promptToUse, activeProvider, {
            width: ratio.width,
            height: ratio.height,
            seed: currentSeed,
            model: modelType,
            quickEnhance,
            nologo,
            apiKey: candidate.key,
          });

          try {
            // First perform a fetch test to verify endpoint responsiveness and check for HTTP 429/401/403
            let fetchFailedStatus: number | null = null;
            let fetchErrMsg = '';

            try {
              const fetchController = new AbortController();
              const fetchTimeout = setTimeout(() => fetchController.abort(), 35000);
              const testRes = await fetch(generatedUrl, {
                method: 'GET',
                signal: fetchController.signal,
                mode: 'cors',
              });
              clearTimeout(fetchTimeout);

              if (!testRes.ok) {
                fetchFailedStatus = testRes.status;
                try {
                  const errJson = await testRes.json();
                  fetchErrMsg = errJson?.error || errJson?.message || JSON.stringify(errJson);
                } catch {
                  try {
                    fetchErrMsg = await testRes.text();
                  } catch {
                    fetchErrMsg = `HTTP ${testRes.status}: ${testRes.statusText}`;
                  }
                }
              }
            } catch (netErr: unknown) {
              if (netErr instanceof Error && netErr.name === 'AbortError') {
                throw new Error('Image generation timed out after 35 seconds.');
              }
              // If CORS blocks GET fetch directly, proceed to preloading with Image()
            }

            if (fetchFailedStatus !== null) {
              const isRateLimit = fetchFailedStatus === 429 || /rate[- ]?limit|too many requests|quota/i.test(fetchErrMsg);
              const isAuthFailure =
                fetchFailedStatus === 401 ||
                fetchFailedStatus === 403 ||
                /unauthori[zs]ed|invalid.*key|authentication/i.test(fetchErrMsg);

              if (isRateLimit || isAuthFailure) {
                markKeyHealth(
                  activeProvider.id,
                  candidate,
                  isRateLimit ? 'cooldown' : 'invalid',
                  fetchErrMsg || (isRateLimit ? 'Rate limit exceeded (HTTP 429)' : `Auth error (${fetchFailedStatus})`)
                );

                console.warn(
                  `%c[ImageStudio Failover] [Standard Gen] Key index ${keyIdx} (${candidate.label}) encountered ${isRateLimit ? 'Rate-Limit (HTTP 429)' : `Auth-Failure (HTTP ${fetchFailedStatus})`}: "${fetchErrMsg}". ${attemptIndex < candidateKeys.length - 1 ? `Automatically retrying with next available key index ${candidateKeys[attemptIndex + 1].originalIndex}...` : 'All available keys exhausted.'}`,
                  'color: #f59e0b; font-weight: bold;'
                );

                if (attemptIndex < candidateKeys.length - 1) {
                  setFailoverNotice(
                    `Key #${keyIdx + 1} (${candidate.label}) hit ${isRateLimit ? 'Rate-Limit (429)' : 'Auth error'}. Failing over to Key #${candidateKeys[attemptIndex + 1].originalIndex + 1}...`
                  );
                  lastError = new Error(
                    `Key index ${keyIdx} failed (${fetchFailedStatus}): ${fetchErrMsg}`
                  );
                  continue;
                }
              }
              throw new Error(`Provider returned error (${fetchFailedStatus}): ${fetchErrMsg}`);
            }

            // Preload image to verify successful rendering
            await new Promise<void>((resolve, reject) => {
              const img = new Image();
              const timeout = setTimeout(() => {
                img.src = '';
                reject(new Error('Image generation timed out after 30 seconds.'));
              }, 30000);

              img.onload = () => {
                clearTimeout(timeout);
                resolve();
              };

              img.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('Failed to load image from provider. Please verify endpoint or API key.'));
              };

              img.src = generatedUrl;
            });

            markKeyHealth(activeProvider.id, candidate, 'healthy');
            console.log(
              `%c[ImageStudio Failover] [Standard Gen] Key index ${keyIdx} (${candidate.label}) succeeded! Marked healthy.`,
              'color: #34d399; font-weight: bold;'
            );

            finalImageUrl = generatedUrl;
            lastError = null;
            break;
          } catch (genErr: unknown) {
            const errObj = genErr instanceof Error ? genErr : new Error(String(genErr));
            lastError = errObj;
            const errMsg = errObj.message;
            const isAuthOrRate = /429|401|403|rate[- ]?limit|unauthori[zs]ed|api key/i.test(errMsg);

            if (isAuthOrRate && attemptIndex < candidateKeys.length - 1) {
              markKeyHealth(
                activeProvider.id,
                candidate,
                /429|rate/i.test(errMsg) ? 'cooldown' : 'invalid',
                errMsg
              );
              console.warn(
                `%c[ImageStudio Failover] [Standard Gen] Key index ${keyIdx} (${candidate.label}) failed: "${errMsg}". Failing over to next key index ${candidateKeys[attemptIndex + 1].originalIndex}...`,
                'color: #f59e0b; font-weight: bold;'
              );
              setFailoverNotice(
                `Key #${keyIdx + 1} (${candidate.label}) failed. Failing over to Key #${candidateKeys[attemptIndex + 1].originalIndex + 1}...`
              );
              continue;
            }

            throw genErr;
          }
        }

        if (!finalImageUrl && lastError) {
          throw lastError;
        }
      }

      // Determine the real model used for this generation
      let actualModelUsed = modelType;
      if (isSdk) {
        actualModelUsed =
          puterSelectedModel ||
          activeProvider.model ||
          (referenceImage ? 'black-forest-labs/flux-kontext-pro' : DEFAULT_PUTER_MODEL);
      } else if (isPost) {
        actualModelUsed =
          activeProvider.model ||
          (activeProvider.url.split('/').filter(Boolean).pop()) ||
          (activeProvider.name.toLowerCase().includes('cloudflare') ? '@cf/black-forest-labs/flux-1-schnell' : 'POST Inference Model');
      } else {
        actualModelUsed = modelType;
      }

      const newItem: GeneratedImageItem = {
        id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        url: finalImageUrl,
        imageData: finalImageUrl,
        referenceImageUrl: referenceImage || undefined,
        isEdit: Boolean(referenceImage),
        prompt: promptToUse,
        originalPrompt: enhancedPromptUsed ? rawInputPrompt : undefined,
        enhancedPrompt: enhancedPromptUsed,
        providerName: activeProvider.name,
        width: ratio.width,
        height: ratio.height,
        seed: currentSeed,
        model: actualModelUsed,
        timestamp: Date.now(),
      };

      // Persist permanently in IndexedDB
      try {
        await saveGeneratedImageToIndexedDb(newItem);
      } catch (saveErr) {
        console.warn('[ImageStudio] Error saving to IndexedDB:', saveErr);
      }

      setCurrentImage(newItem);
      setHistory((prev) => [newItem, ...prev.filter((item) => item.id !== newItem.id)]);

      // Auto-advance seed for next generation
      setSeed(Math.floor(Math.random() * 1000000));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[ImageStudio: Generation Failed]', msg, err);
      if (activeProvider.requestType === 'sdk') {
        setPuterDebugInfo(getPuterDebugInfo());
      }
      setError(msg);
    } finally {
      setLoading(false);
      setLoadingPhase('idle');
      setFailoverNotice(null);
    }
  };

  // Reset Puter guest session if requested or encountered error
  const handleResetPuterSession = async () => {
    try {
      setIsResettingSession(true);
      playTapSound();
      await resetPuterSession();
      setError(null);
      setSessionResetMessage('Puter guest session was reset. Click Generate to start a clean new session.');
      setTimeout(() => setSessionResetMessage(null), 6000);
    } catch (resetErr) {
      console.error('[ImageStudio] Failed to reset Puter session:', resetErr);
      setError('Could not reset Puter session. Please refresh the page.');
    } finally {
      setIsResettingSession(false);
    }
  };

  // Clear all generation history from IndexedDB
  const handleClearHistory = async () => {
    if (history.length === 0) return;
    const confirmed = window.confirm(
      'Are you sure you want to clear your generation history? This will permanently delete all saved images from storage.'
    );
    if (!confirmed) return;

    playTapSound();
    try {
      await clearAllGeneratedImagesFromIndexedDb();
      setHistory([]);
      setCurrentImage(null);
    } catch (err) {
      console.error('[ImageStudio] Failed to clear image history:', err);
    }
  };

  // Delete an individual image from IndexedDB
  const handleDeleteImage = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    playTapSound();
    try {
      await deleteGeneratedImageFromIndexedDb(id);
      setHistory((prev) => {
        const updated = prev.filter((item) => item.id !== id);
        if (currentImage?.id === id) {
          setCurrentImage(updated[0] || null);
        }
        return updated;
      });
    } catch (err) {
      console.error('[ImageStudio] Failed to delete image from IndexedDB:', err);
    }
  };

  // Download image helper
  const handleDownload = async (item: GeneratedImageItem) => {
    try {
      setDownloading(true);
      playTapSound();

      const sanitized =
        item.prompt.slice(0, 32).replace(/[^a-zA-Z0-9_-]/g, '_') || 'generated_image';
      const fileName = `nexus_${sanitized}_${item.seed}.jpg`;

      if (item.url.startsWith('blob:') || item.url.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = item.url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const response = await fetch(item.url, { mode: 'cors' });
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }
    } catch {
      // Fallback for CORS-restricted downloads
      const a = document.createElement('a');
      a.href = item.url;
      a.target = '_blank';
      a.download = `nexus_image_${item.seed}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setDownloading(false);
    }
  };

  // Copy Image URL to clipboard
  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    playTapSound();
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Set current image as reference image for next edit
  const handleUseAsReference = (url: string) => {
    setReferenceImage(url);
    setReferenceImageName('Previous Generation');
    setReferenceImageSize(null);
    if (activeProvider?.requestType === 'sdk' || selectedProviderId === 'puter-official') {
      setPuterSelectedModel('black-forest-labs/flux-kontext-pro');
    } else {
      setModelType('kontext');
    }
    setError(null);
    playTapSound();
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  const handleSurpriseMe = () => {
    playTapSound();
    const randomIndex = Math.floor(Math.random() * SAMPLE_PROMPTS.length);
    const chosen = SAMPLE_PROMPTS[randomIndex];
    setPrompt(chosen);
  };

  const handleRollSeed = () => {
    playTapSound();
    setSeed(Math.floor(Math.random() * 1000000));
  };

  return (
    <div className="page-container" style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Top Page Header */}
      <header
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(236,72,153,0.2) 0%, rgba(168,85,247,0.2) 100%)',
                border: '1px solid rgba(236,72,153,0.4)',
                display: 'grid',
                placeItems: 'center',
                color: '#f472b6',
              }}
            >
              <ImageIcon size={20} />
            </div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Image Studio
            </h1>
            <span
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '12px',
                background: 'rgba(236,72,153,0.15)',
                color: '#f472b6',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              AI Vision Engine
            </span>
          </div>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '13px' }}>
            Generate high-fidelity artwork and photorealistic visuals using configured AI image providers.
          </p>
        </div>

        {/* Quick link to Settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link
            to="/settings?category=ai"
            className="secondary-button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              textDecoration: 'none',
              color: 'var(--text)',
            }}
          >
            <Settings size={14} /> Configure Image Providers
          </Link>
        </div>
      </header>

      {/* Main Studio Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* LEFT COLUMN: Controls & Prompt */}
        <div
          style={{
            padding: '24px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(14,31,39,0.7) 0%, rgba(20,28,48,0.7) 100%)',
            border: '1px solid var(--line)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            display: 'grid',
            gap: '20px',
          }}
        >
          {/* Provider Selector */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={14} style={{ color: '#f472b6' }} /> Image Provider
              </label>
              {activeProvider && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      background: activeProvider.keyStrategy === 'failover' ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.08)',
                      color: activeProvider.keyStrategy === 'failover' ? '#93c5fd' : 'var(--muted)',
                      fontWeight: 600,
                      textTransform: 'capitalize',
                      fontFamily: 'DM Mono, monospace',
                      border: activeProvider.keyStrategy === 'failover' ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    Strategy: {activeProvider.keyStrategy.replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                    {activeProvider.keys?.length || 0} API {activeProvider.keys?.length === 1 ? 'Key' : 'Keys'}
                  </span>
                </div>
              )}
            </div>

            <select
              id="image-provider-select"
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(10,22,28,0.85)',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                padding: '10px 12px',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 500,
                outline: 'none',
              }}
            >
              {imageProvidersState.providers.map((p) => (
                <option key={p.id} value={p.id}>
                  🎨 {p.name} — {p.requestType === 'sdk' ? `JS SDK (${p.model || 'Auto'})` : p.requestType === 'post' ? 'POST/JSON' : 'GET/URL'}
                </option>
              ))}
            </select>

            {/* Puter.js Guest Mode Welcome Card */}
            {activeProvider?.requestType === 'sdk' && !hasDismissedPuterNotice && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, rgba(14,165,233,0.18) 0%, rgba(2,132,199,0.08) 100%)',
                  border: '1px solid rgba(56,189,248,0.35)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '220px', flex: 1 }}>
                  <span style={{ fontSize: '20px' }}>⚡</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#38bdf8' }}>
                      Image generation is powered by Puter — no signup needed for basic use
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
                      Active Model: <strong style={{ color: '#fff' }}>{activeProvider.model || DEFAULT_PUTER_MODEL}</strong> (Free Unlimited Guest Session)
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setHasDismissedPuterNotice(true);
                    try {
                      localStorage.setItem('nexus_seen_puter_notice', 'true');
                    } catch {
                      // ignore localStorage errors
                    }
                  }}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '7px',
                    background: '#0284c7',
                    color: '#fff',
                    border: 0,
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Check size={13} /> Continue with Puter
                </button>
              </div>
            )}
          </div>

          {/* Reference Image (img2img / Image Editing Dropzone) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ImagePlus size={14} style={{ color: '#ec4899' }} /> Reference Image (Image Editing / img2img)
              </label>
              {referenceImage && (
                <button
                  type="button"
                  onClick={handleClearReferenceImage}
                  style={{
                    background: 'none',
                    border: 0,
                    color: '#f87171',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 6px',
                  }}
                >
                  <X size={12} /> Clear Reference
                </button>
              )}
            </div>

            {!referenceImage ? (
              /* Dropzone for Uploading Reference Image */
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingImage(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDraggingImage(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingImage(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleImageFile(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  position: 'relative',
                  borderRadius: '12px',
                  border: `2px dashed ${isDraggingImage ? '#ec4899' : 'rgba(255,255,255,0.15)'}`,
                  background: isDraggingImage ? 'rgba(236,72,153,0.1)' : 'rgba(10,22,28,0.5)',
                  padding: '16px 14px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/jpg,image/gif"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleImageFile(e.target.files[0]);
                    }
                  }}
                  style={{ display: 'none' }}
                />

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      padding: '10px',
                      borderRadius: '12px',
                      background: 'rgba(236,72,153,0.15)',
                      border: '1px solid rgba(236,72,153,0.3)',
                      color: '#f472b6',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <UploadCloud size={20} />
                  </div>

                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                      Upload Reference Image
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                      Drag & drop an image here or click to browse (PNG, JPG, WebP up to 15 MB)
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', marginTop: '2px' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: 'rgba(236,72,153,0.2)',
                        border: '1px solid rgba(236,72,153,0.4)',
                        color: '#f472b6',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <ImagePlus size={12} /> Choose Image
                    </button>
                    <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
                      Optional • Enables before/after edit comparison
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Reference Image Loaded Card */
              <div
                style={{
                  position: 'relative',
                  borderRadius: '12px',
                  border: '1px solid rgba(236,72,153,0.4)',
                  background: 'linear-gradient(135deg, rgba(236,72,153,0.08) 0%, rgba(168,85,247,0.08) 100%)',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/jpg,image/gif"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleImageFile(e.target.files[0]);
                    }
                  }}
                  style={{ display: 'none' }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '180px' }}>
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '1px solid rgba(236,72,153,0.35)',
                      background: '#071116',
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={referenceImage}
                      alt="Reference Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          background: 'rgba(236,72,153,0.2)',
                          color: '#f472b6',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '1px solid rgba(236,72,153,0.35)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Sparkles size={10} /> Reference Image Loaded
                      </span>
                      <span style={{ fontSize: '10px', color: '#a855f7', fontWeight: 600 }}>
                        Editing Mode Active
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#fff',
                        marginTop: '3px',
                        maxWidth: '220px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={referenceImageName || 'Uploaded image'}
                    >
                      {referenceImageName || 'Uploaded Reference'}
                    </div>
                    {referenceImageSize && (
                      <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '1px' }}>
                        {(referenceImageSize / (1024 * 1024)).toFixed(2)} MB
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={handleClearReferenceImage}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      background: 'rgba(248,113,113,0.15)',
                      border: '1px solid rgba(248,113,113,0.3)',
                      color: '#f87171',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    title="Remove reference image"
                  >
                    <X size={12} /> Remove
                  </button>
                </div>
              </div>
            )}

            {/* Hugging Face Not Supported Warning with Quick-Switch buttons */}
            {isPost && referenceImage && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(245,158,11,0.12)',
                  border: '1px solid rgba(245,158,11,0.35)',
                  display: 'grid',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <AlertCircle size={16} style={{ color: '#fbbf24', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#fbbf24' }}>
                      Hugging Face Does Not Support Image Editing
                    </div>
                    <div style={{ fontSize: '11px', color: '#fde68a', lineHeight: 1.4, marginTop: '2px' }}>
                      The current Hugging Face text-to-image model does not support reference image (img2img) editing.
                      Please switch to <strong>Pollinations</strong> (using the <em>kontext</em> model) or <strong>Puter</strong> (using <em>FLUX Kontext Pro</em> or <em>Gemini 2.5 Flash</em>) instead.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                  {pollinationsProvider && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProviderId(pollinationsProvider.id);
                        setModelType('kontext');
                        setError(null);
                        playTapSound();
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: '#ec4899',
                        color: '#fff',
                        border: 0,
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <Sparkles size={12} /> Switch to Pollinations (kontext)
                    </button>
                  )}
                  {puterProvider && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProviderId(puterProvider.id);
                        setPuterSelectedModel('black-forest-labs/flux-kontext-pro');
                        setError(null);
                        playTapSound();
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: '#0284c7',
                        color: '#fff',
                        border: 0,
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <Check size={12} /> Switch to Puter (FLUX Kontext Pro)
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Prompt Input Box */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {referenceImage ? (
                  <>
                    <Wand2 size={14} style={{ color: '#ec4899' }} /> Edit Instructions (img2img Mode)
                  </>
                ) : (
                  <>
                    <Sparkles size={14} style={{ color: 'var(--accent)' }} /> Image Description / Prompt
                  </>
                )}
              </label>
              <button
                type="button"
                onClick={handleSurpriseMe}
                style={{
                  background: 'none',
                  border: 0,
                  color: 'var(--accent)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 6px',
                }}
              >
                <Dice5 size={12} /> Surprise Me
              </button>
            </div>

            <textarea
              id="image-prompt-textarea"
              rows={4}
              placeholder={
                referenceImage
                  ? "Describe what to edit or change in the reference image (e.g. 'Turn into a futuristic cyberpunk painting with neon lighting', 'Change background to sunset beach', 'Add glowing golden armor and helmet')..."
                  : "Describe the image you want to generate in detail (e.g. A futuristic cybernetic city floating in the clouds at sunset, volumetric lighting, 8k render)..."
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleGenerate();
                }
              }}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(8,18,24,0.85)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '12px 14px',
                color: '#fff',
                fontSize: '13px',
                lineHeight: 1.5,
                resize: 'vertical',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                Tip: Press <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '3px' }}>Ctrl+Enter</kbd> to generate
              </span>
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                {prompt.length} chars
              </span>
            </div>

            {/* Smart AI Enhanced Prompt Banner (if generated with Smart AI) */}
            {lastEnhancedPrompt && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, rgba(236,72,153,0.12) 0%, rgba(168,85,247,0.12) 100%)',
                  border: '1px solid rgba(236,72,153,0.3)',
                  display: 'grid',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#f472b6', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Wand2 size={12} /> Enhanced prompt used by AI:
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setPrompt(lastEnhancedPrompt);
                        playTapSound();
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '4px',
                        color: '#fff',
                        fontSize: '10px',
                        padding: '2px 6px',
                        cursor: 'pointer',
                      }}
                    >
                      Use in editor
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(lastEnhancedPrompt);
                        playTapSound();
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '4px',
                        color: '#fff',
                        fontSize: '10px',
                        padding: '2px 6px',
                        cursor: 'pointer',
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text)', lineHeight: 1.4, fontStyle: 'italic' }}>
                  "{lastEnhancedPrompt}"
                </p>
              </div>
            )}
          </div>

          {/* Sample Prompts Pills */}
          <div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
              Inspiration Prompts:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {SAMPLE_PROMPTS.slice(0, 4).map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setPrompt(p);
                    playTapSound();
                  }}
                  className="secondary-button"
                  style={{
                    fontSize: '11px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    textAlign: 'left',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={p}
                >
                  {p.slice(0, 36)}...
                </button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio Picker */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: '8px' }}>
              Aspect Ratio & Dimensions
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
              {ASPECT_RATIOS.map((ratio, idx) => {
                const isSelected = selectedRatioIndex === idx;
                return (
                  <button
                    key={ratio.label}
                    type="button"
                    onClick={() => {
                      setSelectedRatioIndex(idx);
                      playTapSound();
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: `1px solid ${isSelected ? '#f472b6' : 'var(--line)'}`,
                      background: isSelected ? 'rgba(236,72,153,0.15)' : 'rgba(10,22,28,0.6)',
                      color: isSelected ? '#f472b6' : 'var(--muted)',
                      fontSize: '11px',
                      fontWeight: isSelected ? 600 : 400,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span style={{ fontSize: '13px' }}>{ratio.icon}</span>
                    <span>{ratio.label}</span>
                    <span style={{ fontSize: '9px', opacity: 0.8, fontFamily: 'DM Mono, monospace' }}>
                      {ratio.width}×{ratio.height}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generation Parameters Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            {/* Model selector (for Puter SDK, Hugging Face, or Pollinations Engine) */}
            {activeProvider?.requestType === 'sdk' ? (
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                  Puter Model {referenceImage ? '(Editing Capable)' : ''}
                </label>
                <select
                  value={puterSelectedModel}
                  onChange={(e) => {
                    setPuterSelectedModel(e.target.value);
                    playTapSound();
                  }}
                  style={{
                    width: '100%',
                    background: 'rgba(10,22,28,0.85)',
                    border: '1px solid rgba(56,189,248,0.35)',
                    borderRadius: '6px',
                    padding: '7px 8px',
                    color: '#38bdf8',
                    fontSize: '11px',
                    fontWeight: 500,
                    outline: 'none',
                  }}
                >
                  {PUTER_IMAGE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : activeProvider?.requestType === 'post' ? (
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                  Inference Model
                </label>
                <div
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'rgba(168,85,247,0.08)',
                    border: '1px solid rgba(168,85,247,0.25)',
                    borderRadius: '6px',
                    padding: '7px 8px',
                    color: '#c084fc',
                    fontSize: '11px',
                    fontWeight: 600,
                    fontFamily: 'DM Mono, monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={activeProvider.model || activeProvider.url}
                >
                  {activeProvider.name.toLowerCase().includes('cloudflare') ? 'CF' : activeProvider.name.toLowerCase().includes('hugging') ? 'HF' : 'POST'}: {activeProvider.model || (activeProvider.url.split('/').filter(Boolean).pop()) || 'Default'}
                </div>
              </div>
            ) : (
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                  Engine Model
                </label>
                <select
                  value={modelType}
                  onChange={(e) => setModelType(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(10,22,28,0.8)',
                    border: '1px solid var(--line)',
                    borderRadius: '6px',
                    padding: '7px 8px',
                    color: '#fff',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                >
                  {referenceImage && (
                    <option value="kontext">kontext (Image Edit / img2img)</option>
                  )}
                  <option value="flux">Flux (High Detail)</option>
                  <option value="turbo">Turbo (Ultra Fast)</option>
                  <option value="default">Default Provider Model</option>
                </select>
              </div>
            )}

            {/* Seed control */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)' }}>Seed</label>
                <button
                  type="button"
                  onClick={handleRollSeed}
                  style={{
                    background: 'none',
                    border: 0,
                    color: 'var(--accent)',
                    fontSize: '10px',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Roll 🎲
                </button>
              </div>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(parseInt(e.target.value, 10) || 0)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(10,22,28,0.8)',
                  border: '1px solid var(--line)',
                  borderRadius: '6px',
                  padding: '7px 8px',
                  color: '#fff',
                  fontSize: '12px',
                  fontFamily: 'DM Mono, monospace',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Options Toggles */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Quick Enhance Toggle */}
            <label
              title="Adds generic aesthetic and quality enhancer keywords to the generator request"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text)', cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={quickEnhance}
                onChange={(e) => {
                  const val = e.target.checked;
                  setQuickEnhance(val);
                  if (val) setSmartAiEnhance(false);
                }}
                style={{ accentColor: '#f472b6' }}
              />
              Quick Enhance
            </label>

            {/* Smart AI Enhance Toggle (Mutually exclusive with Quick Enhance) */}
            <label
              title="Sends prompt to active NEXUS AI model to fix grammar and rewrite into vivid, high-fidelity scene descriptions"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text)', cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={smartAiEnhance}
                onChange={(e) => {
                  const val = e.target.checked;
                  setSmartAiEnhance(val);
                  if (val) setQuickEnhance(false);
                }}
                style={{ accentColor: '#a855f7' }}
              />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Wand2 size={13} style={{ color: '#c084fc' }} /> Smart AI Enhance
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    background: 'rgba(168,85,247,0.2)',
                    color: '#c084fc',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    border: '1px solid rgba(168,85,247,0.35)',
                  }}
                >
                  AI Rewrite
                </span>
              </span>
            </label>

            {/* Clean Render */}
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={nologo}
                onChange={(e) => setNologo(e.target.checked)}
                style={{ accentColor: '#f472b6' }}
              />
              Clean Render (No Logo)
            </label>
          </div>

          {/* Puter Session Reset Notice */}
          {sessionResetMessage && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(56,189,248,0.15)',
                border: '1px solid rgba(56,189,248,0.35)',
                color: '#38bdf8',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Check size={15} />
              <span>{sessionResetMessage}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(237,139,139,0.15)',
                border: '1px solid rgba(237,139,139,0.4)',
                color: 'var(--danger)',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '200px' }}>
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
              {(activeProvider?.requestType === 'sdk' || error.toLowerCase().includes('puter') || error.toLowerCase().includes('session')) && (
                <button
                  type="button"
                  onClick={handleResetPuterSession}
                  disabled={isResettingSession}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    background: 'rgba(56,189,248,0.2)',
                    border: '1px solid rgba(56,189,248,0.4)',
                    color: '#38bdf8',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: isResettingSession ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <RotateCw size={12} className={isResettingSession ? 'animate-spin' : ''} />
                  {isResettingSession ? 'Resetting...' : 'Reset Session'}
                </button>
              )}
            </div>
          )}

          {/* Collapsible Puter Debug Info in Image Studio */}
          {activeProvider?.requestType === 'sdk' && puterDebugInfo && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(15,23,42,0.85)',
                border: '1px solid rgba(56,189,248,0.25)',
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#94a3b8',
              }}
            >
              <div
                onClick={() => setShowPuterDebug(!showPuterDebug)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  userSelect: 'none',
                  color: '#38bdf8',
                  fontWeight: 600,
                }}
              >
                <span>🔍 Puter SDK Debug Info</span>
                <span style={{ fontSize: '10px' }}>{showPuterDebug ? '▲ Hide' : '▼ Show'}</span>
              </div>
              {showPuterDebug && (
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div>
                    • Script Appended: <span style={{ color: puterDebugInfo.scriptAppended ? '#34d399' : '#f87171' }}>{String(puterDebugInfo.scriptAppended)}</span>
                    {puterDebugInfo.scriptAppendedAt && <span style={{ color: '#64748b', marginLeft: '4px' }}>({puterDebugInfo.scriptAppendedAt.split('T')[1]?.slice(0, 8)})</span>}
                  </div>
                  <div>
                    • Onload Fired: <span style={{ color: puterDebugInfo.onloadFired ? '#34d399' : '#f87171' }}>{String(puterDebugInfo.onloadFired)}</span>
                    {puterDebugInfo.onloadFiredAt && <span style={{ color: '#64748b', marginLeft: '4px' }}>({puterDebugInfo.onloadFiredAt.split('T')[1]?.slice(0, 8)})</span>}
                  </div>
                  <div>
                    • Onerror Fired: <span style={{ color: puterDebugInfo.onerrorFired ? '#f87171' : '#34d399' }}>{String(puterDebugInfo.onerrorFired)}</span>
                    {puterDebugInfo.onerrorDetails && <span style={{ color: '#f87171', marginLeft: '4px' }}>({puterDebugInfo.onerrorDetails})</span>}
                  </div>
                  <div>
                    • typeof window.puter: <span style={{ color: '#fff' }}>"{puterDebugInfo.typeofWindowPuter}"</span>
                  </div>
                  <div>
                    • typeof window.puter?.ai: <span style={{ color: '#fff' }}>"{puterDebugInfo.typeofWindowPuterAi}"</span>
                  </div>
                  <div>
                    • typeof window.puter?.ai?.txt2img: <span style={{ color: puterDebugInfo.typeofWindowPuterAiTxt2img === 'function' ? '#34d399' : '#f87171' }}>"{puterDebugInfo.typeofWindowPuterAiTxt2img}"</span>
                  </div>
                  <div>
                    • window.puter Keys: <span style={{ color: '#38bdf8', wordBreak: 'break-all' }}>{JSON.stringify(puterDebugInfo.windowPuterTopLevelKeys)}</span>
                  </div>
                  {puterDebugInfo.error && (
                    <div style={{ color: '#f87171', marginTop: '2px' }}>
                      • Error: {puterDebugInfo.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Generate Button */}
          <button
            id="generate-image-btn"
            type="button"
            onClick={() => handleGenerate()}
            disabled={loading || !prompt.trim()}
            style={{
              padding: '14px 20px',
              borderRadius: '10px',
              background: loading || !prompt.trim()
                ? 'rgba(236,72,153,0.3)'
                : 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)',
              color: '#fff',
              border: 'none',
              fontSize: '14px',
              fontWeight: 700,
              cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: loading || !prompt.trim()
                ? 'none'
                : '0 0 24px rgba(236,72,153,0.4), 0 4px 12px rgba(0,0,0,0.3)',
              transition: 'all 0.2s ease',
            }}
          >
            {loading ? (
              loadingPhase === 'enhancing' ? (
                <>
                  <Wand2 size={17} className="animate-spin" /> Refining with AI...
                </>
              ) : (
                <>
                  <RotateCw size={17} className="animate-spin" />{' '}
                  {referenceImage ? 'Synthesizing Edited Image...' : 'Synthesizing Image...'}
                </>
              )
            ) : referenceImage ? (
              <>
                <Wand2 size={17} /> Edit Image (img2img)
              </>
            ) : (
              <>
                <Sparkles size={17} /> Generate Image
              </>
            )}
          </button>
        </div>

        {/* RIGHT COLUMN: Interactive Image Canvas & Gallery */}
        <div style={{ display: 'grid', gap: '20px' }}>
          {/* Main Output Box */}
          <div
            style={{
              padding: '24px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(14,31,39,0.7) 0%, rgba(20,28,48,0.7) 100%)',
              border: '1px solid var(--line)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              display: 'grid',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ImageIcon size={16} style={{ color: '#f472b6' }} /> Output Canvas
                </h3>
                {currentImage?.referenceImageUrl && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      background: 'rgba(236,72,153,0.18)',
                      color: '#f472b6',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      border: '1px solid rgba(236,72,153,0.35)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <ArrowRightLeft size={10} /> Before & After
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {currentImage?.referenceImageUrl && (
                  <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', borderRadius: '6px', padding: '2px', border: '1px solid var(--line)' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setComparisonLayout('side-by-side');
                        playTapSound();
                      }}
                      style={{
                        background: comparisonLayout === 'side-by-side' ? 'rgba(236,72,153,0.3)' : 'transparent',
                        color: comparisonLayout === 'side-by-side' ? '#fff' : 'var(--muted)',
                        border: 0,
                        borderRadius: '4px',
                        padding: '3px 8px',
                        fontSize: '10px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Columns size={11} /> Side-by-Side
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setComparisonLayout('result-only');
                        playTapSound();
                      }}
                      style={{
                        background: comparisonLayout === 'result-only' ? 'rgba(236,72,153,0.3)' : 'transparent',
                        color: comparisonLayout === 'result-only' ? '#fff' : 'var(--muted)',
                        border: 0,
                        borderRadius: '4px',
                        padding: '3px 8px',
                        fontSize: '10px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <ImageIcon size={11} /> Result Only
                    </button>
                  </div>
                )}
                {currentImage && (
                  <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                    {currentImage.width}×{currentImage.height} · Seed {currentImage.seed}
                  </span>
                )}
              </div>
            </div>

            {/* Display Area: Loading vs Rendered vs Empty */}
            {loading ? (
              <div
                style={{
                  minHeight: '380px',
                  borderRadius: '12px',
                  background: 'rgba(8,16,22,0.8)',
                  border: '1px dashed rgba(236,72,153,0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '16px',
                  padding: '30px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: loadingPhase === 'enhancing' ? 'rgba(168,85,247,0.15)' : 'rgba(236,72,153,0.15)',
                    border: `2px solid ${loadingPhase === 'enhancing' ? '#a855f7' : '#ec4899'}`,
                    display: 'grid',
                    placeItems: 'center',
                    color: loadingPhase === 'enhancing' ? '#c084fc' : '#f472b6',
                  }}
                >
                  {loadingPhase === 'enhancing' ? (
                    <Wand2 size={28} className="animate-spin" />
                  ) : (
                    <RotateCw size={28} className="animate-spin" />
                  )}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#fff' }}>
                    {loadingPhase === 'enhancing' ? '✨ Refining Prompt with Smart AI...' : 'Generating Neural Visuals...'}
                  </h4>
                  <p
                    style={{
                      margin: '4px 0 0',
                      fontSize: '12px',
                      color: failoverNotice ? '#f59e0b' : 'var(--muted)',
                      fontWeight: failoverNotice ? 600 : 400,
                    }}
                  >
                    {loadingPhase === 'enhancing'
                      ? 'NEXUS AI text model is enhancing description depth, lighting, and vocabulary...'
                      : failoverNotice || `Communicating with ${activeProvider?.name || 'Image Provider'} endpoint.`}
                  </p>
                </div>
              </div>
            ) : currentImage ? (
              <div style={{ display: 'grid', gap: '14px' }}>
                {/* Image Container: Side-by-Side Comparison vs Single View */}
                {currentImage.referenceImageUrl && comparisonLayout === 'side-by-side' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                    {/* Before: Reference Image */}
                    <div
                      style={{
                        borderRadius: '12px',
                        overflow: 'hidden',
                        background: '#071116',
                        border: '1px solid rgba(255,255,255,0.12)',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div
                        style={{
                          padding: '8px 12px',
                          background: 'rgba(255,255,255,0.04)',
                          borderBottom: '1px solid rgba(255,255,255,0.08)',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--muted)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <ImagePlus size={13} style={{ color: '#94a3b8' }} /> BEFORE (Original Reference)
                        </span>
                        <span style={{ fontSize: '10px', opacity: 0.7 }}>Input</span>
                      </div>
                      <div style={{ position: 'relative', flex: 1, display: 'grid', placeItems: 'center', minHeight: '260px', maxHeight: '480px', overflow: 'hidden', background: '#050c10' }}>
                        <img
                          src={currentImage.referenceImageUrl}
                          alt="Reference Before"
                          style={{
                            width: '100%',
                            height: '100%',
                            maxHeight: '480px',
                            objectFit: 'contain',
                            display: 'block',
                          }}
                        />
                      </div>
                    </div>

                    {/* After: AI Edited Result */}
                    <div
                      style={{
                        borderRadius: '12px',
                        overflow: 'hidden',
                        background: '#071116',
                        border: '1px solid rgba(236,72,153,0.45)',
                        boxShadow: '0 8px 30px rgba(236,72,153,0.15)',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                      }}
                    >
                      <div
                        style={{
                          padding: '8px 12px',
                          background: 'rgba(236,72,153,0.12)',
                          borderBottom: '1px solid rgba(236,72,153,0.3)',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#f472b6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <Sparkles size={13} style={{ color: '#f472b6' }} /> AFTER (AI Edited Result)
                        </span>
                        <span style={{ fontSize: '10px', background: 'rgba(236,72,153,0.25)', padding: '1px 5px', borderRadius: '4px' }}>
                          {currentImage.model || 'kontext'}
                        </span>
                      </div>
                      <div style={{ position: 'relative', flex: 1, display: 'grid', placeItems: 'center', minHeight: '260px', maxHeight: '480px', overflow: 'hidden', background: '#050c10' }}>
                        <img
                          src={currentImage.url}
                          alt={currentImage.prompt}
                          style={{
                            width: '100%',
                            height: '100%',
                            maxHeight: '480px',
                            objectFit: 'contain',
                            display: 'block',
                          }}
                        />

                        {/* Expand button overlay */}
                        <button
                          type="button"
                          onClick={() => setFullscreenImage(currentImage)}
                          style={{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            background: 'rgba(0,0,0,0.65)',
                            backdropFilter: 'blur(4px)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '6px',
                            padding: '6px',
                            color: '#fff',
                            cursor: 'pointer',
                          }}
                          title="Fullscreen View"
                        >
                          <Maximize2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Single Image View */
                  <div
                    style={{
                      position: 'relative',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      background: '#071116',
                      border: '1px solid rgba(236,72,153,0.3)',
                      boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                    }}
                  >
                    <img
                      src={currentImage.url}
                      alt={currentImage.prompt}
                      style={{
                        width: '100%',
                        height: 'auto',
                        maxHeight: '520px',
                        objectFit: 'contain',
                        display: 'block',
                        margin: '0 auto',
                      }}
                    />

                    {/* Expand button overlay */}
                    <button
                      type="button"
                      onClick={() => setFullscreenImage(currentImage)}
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        background: 'rgba(0,0,0,0.65)',
                        backdropFilter: 'blur(4px)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '6px',
                        padding: '6px',
                        color: '#fff',
                        cursor: 'pointer',
                      }}
                      title="Fullscreen View"
                    >
                      <Maximize2 size={16} />
                    </button>
                  </div>
                )}

                {/* Prompt Caption & Meta */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: 'rgba(10,22,28,0.6)',
                    border: '1px solid var(--line)',
                    display: 'grid',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {currentImage.isEdit && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          background: 'rgba(236,72,153,0.2)',
                          color: '#f472b6',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '1px solid rgba(236,72,153,0.35)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Wand2 size={10} /> Image Edit (img2img)
                      </span>
                    )}
                    {currentImage.enhancedPrompt && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          background: 'rgba(168,85,247,0.2)',
                          color: '#c084fc',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '1px solid rgba(168,85,247,0.35)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Sparkles size={10} /> Smart AI Enhanced
                      </span>
                    )}
                  </div>

                  <p style={{ margin: 0, fontSize: '12px', color: '#fff', lineHeight: 1.5 }}>
                    "{currentImage.prompt}"
                  </p>

                  {currentImage.originalPrompt && currentImage.originalPrompt !== currentImage.prompt && (
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)', fontStyle: 'italic' }}>
                      Original: "{currentImage.originalPrompt}"
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: '12px', marginTop: '2px', fontSize: '10px', color: 'var(--muted)', flexWrap: 'wrap' }}>
                    <span>Provider: {currentImage.providerName}</span>
                    <span>Model: {currentImage.model || 'flux'}</span>
                    <span>Seed: {currentImage.seed}</span>
                    {currentImage.isEdit && <span>Mode: img2img Editing</span>}
                  </div>
                </div>

                {/* Action Buttons Toolbar */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {/* Download Image Button (Styled similar to Voice AI's Download MP3 button) */}
                  <button
                    id="download-image-btn"
                    type="button"
                    onClick={() => handleDownload(currentImage)}
                    disabled={downloading}
                    style={{
                      flex: 1,
                      minWidth: '150px',
                      padding: '11px 18px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, rgba(52,211,153,0.9) 0%, rgba(16,185,129,0.9) 100%)',
                      color: '#062016',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: downloading ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: '0 0 16px rgba(52,211,153,0.3)',
                    }}
                  >
                    {downloading ? (
                      <>
                        <RotateCw size={15} className="animate-spin" /> Downloading...
                      </>
                    ) : (
                      <>
                        <Download size={15} /> Download Image
                      </>
                    )}
                  </button>

                  {/* Use this output as reference for next edit */}
                  <button
                    type="button"
                    onClick={() => handleUseAsReference(currentImage.url)}
                    className="secondary-button"
                    style={{
                      padding: '11px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: 'pointer',
                      borderColor: 'rgba(236,72,153,0.35)',
                      color: '#f472b6',
                    }}
                    title="Load this result as the reference image to edit it further"
                  >
                    <Wand2 size={14} /> Edit This
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyUrl(currentImage.url)}
                    className="secondary-button"
                    style={{
                      padding: '11px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: 'pointer',
                    }}
                  >
                    {copiedUrl ? <Check size={14} style={{ color: '#34d399' }} /> : <Copy size={14} />}
                    {copiedUrl ? 'Copied!' : 'Copy URL'}
                  </button>

                  <a
                    href={currentImage.url}
                    target="_blank"
                    rel="noreferrer"
                    className="secondary-button"
                    style={{
                      padding: '11px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      textDecoration: 'none',
                      color: 'var(--text)',
                    }}
                  >
                    <ExternalLink size={14} /> Open Tab
                  </a>
                </div>
              </div>
            ) : (
              <div
                style={{
                  minHeight: '340px',
                  borderRadius: '12px',
                  background: 'rgba(8,16,22,0.5)',
                  border: '1px dashed var(--line)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  padding: '30px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '12px',
                    background: 'rgba(236,72,153,0.1)',
                    border: '1px solid rgba(236,72,153,0.2)',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#f472b6',
                  }}
                >
                  <ImageIcon size={26} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Ready for Synthesis</h4>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)', maxWidth: '320px' }}>
                    Type a prompt on the left and click "Generate Image" to render stunning visuals with Pollinations or custom endpoints.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Session History Gallery (IndexedDB Persistent) */}
          {history.length > 0 && (
            <div
              style={{
                padding: '18px 20px',
                borderRadius: '14px',
                background: 'rgba(14,31,39,0.5)',
                border: '1px solid var(--line)',
                display: 'grid',
                gap: '12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
                    Recent Generations ({history.length})
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--muted)',
                      background: 'rgba(255,255,255,0.06)',
                      padding: '2px 7px',
                      borderRadius: '10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Database size={10} style={{ color: '#34d399' }} /> IndexedDB
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Click to view</span>
                  <button
                    id="clear-image-history-btn"
                    type="button"
                    onClick={handleClearHistory}
                    className="secondary-button"
                    style={{
                      fontSize: '11px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      color: '#f87171',
                      borderColor: 'rgba(248,113,113,0.3)',
                      cursor: 'pointer',
                    }}
                    title="Delete all saved generations from IndexedDB"
                  >
                    <Trash2 size={12} /> Clear History
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  overflowX: 'auto',
                  paddingBottom: '8px',
                  paddingTop: '2px',
                }}
              >
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setCurrentImage(item);
                      playTapSound();
                    }}
                    style={{
                      position: 'relative',
                      width: '84px',
                      height: '84px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      flexShrink: 0,
                      cursor: 'pointer',
                      border: `2px solid ${currentImage?.id === item.id ? '#f472b6' : 'rgba(255,255,255,0.1)'}`,
                      boxShadow: currentImage?.id === item.id ? '0 0 12px rgba(244,114,182,0.4)' : '0 4px 12px rgba(0,0,0,0.3)',
                      transition: 'all 0.15s ease',
                    }}
                    title={`"${item.prompt}" — ${item.providerName} (Seed: ${item.seed})`}
                  >
                    <img
                      src={item.url}
                      alt={item.prompt}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                    />

                    {/* Image Edit tag */}
                    {(item.isEdit || item.referenceImageUrl) && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '3px',
                          left: '3px',
                          background: 'rgba(236,72,153,0.9)',
                          borderRadius: '3px',
                          padding: '1px 4px',
                          color: '#fff',
                          fontSize: '8px',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                        title="Image Edit (img2img)"
                      >
                        <Wand2 size={8} /> Edit
                      </div>
                    )}

                    {/* AI Enhanced icon tag */}
                    {item.enhancedPrompt && !(item.isEdit || item.referenceImageUrl) && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '3px',
                          left: '3px',
                          background: 'rgba(168,85,247,0.85)',
                          borderRadius: '3px',
                          padding: '1px 3px',
                          color: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                        }}
                        title="Smart AI Enhanced prompt"
                      >
                        <Wand2 size={9} />
                      </div>
                    )}

                    {/* Single image delete button */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteImage(e, item.id)}
                      style={{
                        position: 'absolute',
                        top: '3px',
                        right: '3px',
                        width: '18px',
                        height: '18px',
                        borderRadius: '4px',
                        background: 'rgba(0,0,0,0.7)',
                        border: 'none',
                        color: 'rgba(255,255,255,0.8)',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                      title="Delete this image"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Modal View */}
      {fullscreenImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.92)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 99999,
            padding: '24px',
          }}
          onClick={() => setFullscreenImage(null)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setFullscreenImage(null)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                background: 'rgba(255,255,255,0.15)',
                border: 0,
                borderRadius: '50%',
                color: '#fff',
                width: '32px',
                height: '32px',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
            <img
              src={fullscreenImage.url}
              alt={fullscreenImage.prompt}
              style={{
                maxWidth: '90vw',
                maxHeight: '76vh',
                borderRadius: '12px',
                objectFit: 'contain',
                boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
              }}
            />
            <div style={{ marginTop: '14px', textAlign: 'center', maxWidth: '680px', display: 'grid', gap: '4px' }}>
              {fullscreenImage.enhancedPrompt && (
                <div>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      background: 'rgba(168,85,247,0.25)',
                      color: '#c084fc',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      border: '1px solid rgba(168,85,247,0.4)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Wand2 size={10} /> Smart AI Enhanced Prompt
                  </span>
                </div>
              )}
              <p style={{ margin: 0, color: '#fff', fontSize: '13px', lineHeight: 1.5 }}>
                "{fullscreenImage.prompt}"
              </p>
              {fullscreenImage.originalPrompt && fullscreenImage.originalPrompt !== fullscreenImage.prompt && (
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '11px', fontStyle: 'italic' }}>
                  Original: "{fullscreenImage.originalPrompt}"
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
