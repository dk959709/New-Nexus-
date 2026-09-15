// Puter.js Image Generation & Session Management Service
// Puter provides free temporary guest sessions with zero API keys required.

export const PUTER_IMAGE_MODELS = [
  { id: 'stabilityai/stable-diffusion-3-medium', name: 'Stability AI Stable Diffusion 3 Medium' },
  { id: 'black-forest-labs/flux-kontext-pro', name: 'Black Forest Labs FLUX Kontext Pro (Image Edit)' },
  { id: 'google/gemini-2.5-flash-image', name: 'Google Gemini 2.5 Flash Image (Image Edit)' },
  { id: 'openai/gpt-image-2', name: 'OpenAI GPT Image 2' },
  { id: 'google/gemini-3-pro-image-preview', name: 'Google Gemini 3 Pro Image Preview' },
  { id: 'black-forest-labs/flux-2-pro', name: 'Black Forest Labs FLUX 2 Pro' },
  { id: 'x-ai/grok-imagine-image', name: 'xAI Grok Imagine Image' },
];

export const DEFAULT_PUTER_MODEL = 'stabilityai/stable-diffusion-3-medium';

export const PUTER_TIMEOUT_ERROR_MESSAGE =
  'Puter did not respond in time — this may be due to network restrictions or a blocked script.';

export const PUTER_SCRIPT_TIMEOUT_MS = 15000;
export const PUTER_GENERATE_TIMEOUT_MS = 20000;

declare global {
  interface Window {
    puter?: {
      ai?: {
        txt2img: (
          prompt: string,
          options?: { model?: string; image?: string; [key: string]: unknown }
        ) => Promise<HTMLImageElement | string | { src?: string; url?: string }>;
        img2img?: (
          prompt: string,
          image: string,
          options?: { model?: string; [key: string]: unknown }
        ) => Promise<HTMLImageElement | string | { src?: string; url?: string }>;
      };
      auth?: {
        signOut: () => Promise<void>;
        isSignedIn?: () => boolean;
        getUser?: () => Promise<unknown>;
      };
      [key: string]: unknown;
    };
  }
}

export interface PuterDebugInfo {
  scriptAppended: boolean;
  scriptAppendedAt?: string;
  onloadFired: boolean;
  onloadFiredAt?: string;
  onerrorFired: boolean;
  onerrorDetails?: string;
  typeofWindowPuter: string;
  typeofWindowPuterAi: string;
  typeofWindowPuterAiTxt2img: string;
  windowPuterTopLevelKeys: string[];
  lastUpdated: string;
  error?: string;
}

let latestPuterDebugInfo: PuterDebugInfo = {
  scriptAppended: false,
  onloadFired: false,
  onerrorFired: false,
  typeofWindowPuter: 'undefined',
  typeofWindowPuterAi: 'undefined',
  typeofWindowPuterAiTxt2img: 'undefined',
  windowPuterTopLevelKeys: [],
  lastUpdated: new Date().toISOString(),
};

export function getPuterDebugInfo(): PuterDebugInfo {
  if (typeof window !== 'undefined') {
    const existing = document.querySelector<HTMLScriptElement>('script[src*="js.puter.com"]');
    const isAppended = latestPuterDebugInfo.scriptAppended || !!existing;
    const typeofPuter = typeof window.puter;
    const typeofAi = typeof window.puter?.ai;
    const typeofTxt2img = typeof window.puter?.ai?.txt2img;
    let keys: string[] = [];
    try {
      if (window.puter && typeof window.puter === 'object') {
        keys = Object.keys(window.puter);
      }
    } catch {
      keys = [];
    }

    latestPuterDebugInfo = {
      ...latestPuterDebugInfo,
      scriptAppended: isAppended,
      typeofWindowPuter: typeofPuter,
      typeofWindowPuterAi: typeofAi,
      typeofWindowPuterAiTxt2img: typeofTxt2img,
      windowPuterTopLevelKeys: keys.length > 0 ? keys : latestPuterDebugInfo.windowPuterTopLevelKeys,
      lastUpdated: new Date().toISOString(),
    };
  }
  return { ...latestPuterDebugInfo };
}

let puterLoadPromise: Promise<typeof window.puter> | null = null;

/**
 * Dynamically loads the Puter.js v2 SDK if not already available in window with a strict timeout.
 */
export async function loadPuterScript(
  timeoutMs: number = PUTER_SCRIPT_TIMEOUT_MS
): Promise<typeof window.puter> {
  if (typeof window === 'undefined') {
    const err = new Error('Puter SDK can only run in a browser environment');
    console.error('[Puter AI: Script Load]', err.message);
    latestPuterDebugInfo.error = err.message;
    throw err;
  }

  if (window.puter?.ai?.txt2img) {
    getPuterDebugInfo();
    return window.puter;
  }

  if (puterLoadPromise) {
    return puterLoadPromise;
  }

  const loadTask = new Promise<typeof window.puter>((resolve, reject) => {
    let hasResolvedOrRejected = false;

    const cleanupAndReject = (error: Error) => {
      if (hasResolvedOrRejected) return;
      hasResolvedOrRejected = true;
      puterLoadPromise = null;
      console.error('[Puter AI: Script Load] Failed to load Puter.js SDK:', error.message);
      latestPuterDebugInfo.error = error.message;
      getPuterDebugInfo();
      reject(error);
    };

    const cleanupAndResolve = (puterInstance: typeof window.puter) => {
      if (hasResolvedOrRejected) return;
      hasResolvedOrRejected = true;
      getPuterDebugInfo();
      resolve(puterInstance);
    };

    // Check if script element is already added to DOM
    const existing = document.querySelector<HTMLScriptElement>('script[src*="js.puter.com"]');
    if (existing) {
      console.log('[Puter AI: Script Load] Existing <script src*="js.puter.com"> found in DOM.');
      latestPuterDebugInfo.scriptAppended = true;
      if (window.puter?.ai?.txt2img) {
        console.log('[Puter AI: Script Load] window.puter.ai.txt2img already ready on existing script.');
        cleanupAndResolve(window.puter);
        return;
      }
      existing.addEventListener('load', () => {
        console.log('[Puter AI: Script Load] existing script onload event fired!');
        console.log('[Puter AI: Script Load] window.puter content:', window.puter);
        console.log('[Puter AI: Script Load] typeof window.puter:', typeof window.puter);
        console.log('[Puter AI: Script Load] typeof window.puter?.ai:', typeof window.puter?.ai);
        console.log('[Puter AI: Script Load] typeof window.puter?.ai?.txt2img:', typeof window.puter?.ai?.txt2img);
        
        latestPuterDebugInfo.onloadFired = true;
        latestPuterDebugInfo.onloadFiredAt = new Date().toISOString();
        getPuterDebugInfo();

        if (window.puter?.ai?.txt2img || window.puter) {
          cleanupAndResolve(window.puter);
        } else {
          cleanupAndReject(new Error('Puter SDK script loaded but window.puter object is missing'));
        }
      });
      existing.addEventListener('error', (evt) => {
        console.error('[Puter AI: Script Load] existing script onerror event fired!', evt);
        latestPuterDebugInfo.onerrorFired = true;
        latestPuterDebugInfo.onerrorDetails = 'existing script tag error event';
        getPuterDebugInfo();
        cleanupAndReject(new Error('Failed to load Puter.js from https://js.puter.com/v2/'));
      });
      // Periodic check for window.puter readiness
      const interval = setInterval(() => {
        if (window.puter?.ai?.txt2img) {
          console.log('[Puter AI: Script Load] window.puter.ai.txt2img detected via interval check on existing script!');
          latestPuterDebugInfo.onloadFired = true;
          clearInterval(interval);
          cleanupAndResolve(window.puter);
        }
      }, 200);
      setTimeout(() => clearInterval(interval), timeoutMs);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.puter.com/v2/';
    script.async = true;

    const nowIso = new Date().toISOString();
    latestPuterDebugInfo.scriptAppended = true;
    latestPuterDebugInfo.scriptAppendedAt = nowIso;
    console.log('[Puter AI: Script Load] Appending <script> to document.head at:', nowIso, 'src:', script.src);

    script.onload = () => {
      console.log('[Puter AI: Script Load] script.onload event fired successfully!');
      console.log('[Puter AI: Script Load] window.puter content:', window.puter);
      console.log('[Puter AI: Script Load] typeof window.puter:', typeof window.puter);
      console.log('[Puter AI: Script Load] typeof window.puter?.ai:', typeof window.puter?.ai);
      console.log('[Puter AI: Script Load] typeof window.puter?.ai?.txt2img:', typeof window.puter?.ai?.txt2img);

      latestPuterDebugInfo.onloadFired = true;
      latestPuterDebugInfo.onloadFiredAt = new Date().toISOString();
      getPuterDebugInfo();

      if (window.puter?.ai?.txt2img || window.puter) {
        cleanupAndResolve(window.puter);
      } else {
        setTimeout(() => {
          console.log('[Puter AI: Script Load +300ms fallback] typeof window.puter:', typeof window.puter, 'window.puter?.ai?.txt2img:', typeof window.puter?.ai?.txt2img);
          getPuterDebugInfo();
          if (window.puter?.ai?.txt2img || window.puter) {
            cleanupAndResolve(window.puter);
          } else {
            cleanupAndReject(new Error('Puter SDK script loaded but window.puter is missing'));
          }
        }, 300);
      }
    };

    script.onerror = (evt) => {
      console.error('[Puter AI: Script Load] script.onerror event fired!', evt);
      latestPuterDebugInfo.onerrorFired = true;
      latestPuterDebugInfo.onerrorDetails = 'script onerror event fired';
      getPuterDebugInfo();
      cleanupAndReject(new Error('Failed to fetch Puter.js from https://js.puter.com/v2/'));
    };

    document.head.appendChild(script);
    console.log('[Puter AI: Script Load] document.head.appendChild(script) executed.');
  });

  // Strict timeout protection for the entire script load process
  const timeoutTask = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      clearTimeout(timer);
      puterLoadPromise = null;
      const timeoutErr = new Error(PUTER_TIMEOUT_ERROR_MESSAGE);
      latestPuterDebugInfo.error = `Timeout after ${timeoutMs}ms: ${timeoutErr.message}`;
      getPuterDebugInfo();
      console.error('[Puter AI: Script Load] Timeout after', timeoutMs, 'ms:', timeoutErr.message);
      reject(timeoutErr);
    }, timeoutMs);
  });

  puterLoadPromise = Promise.race([loadTask, timeoutTask]).catch((err) => {
    puterLoadPromise = null;
    throw err;
  });

  return puterLoadPromise;
}

/**
 * Checks Puter auth & guest session status with error logging.
 */
export async function checkPuterAuth(): Promise<boolean> {
  try {
    const puter = await loadPuterScript(8000);
    if (!puter) return false;
    if (puter.auth?.isSignedIn) {
      return puter.auth.isSignedIn();
    }
    return true; // Guest session available
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[Puter AI: Auth Check] Verification failed:', errMsg);
    return false;
  }
}

/**
 * Synthesizes an image using Puter.js library SDK.
 * Wrapped with strict timeout and comprehensive error diagnostics.
 */
export async function generatePuterImage(
  prompt: string,
  model?: string,
  referenceImage?: string,
  timeoutMs: number = PUTER_GENERATE_TIMEOUT_MS
): Promise<{ url: string; prompt: string; model: string }> {
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) {
    throw new Error('Please provide an image prompt description');
  }

  const selectedModel = model || DEFAULT_PUTER_MODEL;

  // Step 1: Script Load
  let puter: typeof window.puter;
  try {
    puter = await loadPuterScript();
  } catch (loadErr: unknown) {
    const errMsg = loadErr instanceof Error ? loadErr.message : String(loadErr);
    console.error('[Puter AI: Script Load Step] Failed before generation:', errMsg);
    if (errMsg.includes('timed out') || errMsg.includes('timeout') || errMsg.includes('not respond in time')) {
      throw new Error(PUTER_TIMEOUT_ERROR_MESSAGE);
    }
    throw new Error(errMsg || 'Failed to initialize Puter SDK');
  }

  if (!puter?.ai?.txt2img) {
    const err = new Error('Puter AI txt2img function is not available in the loaded Puter SDK');
    console.error('[Puter AI: Image Generation]', err.message);
    throw err;
  }

  // Step 2: Generation with race timeout
  const generationTask = async (): Promise<string> => {
    const options: Record<string, unknown> = {
      model: selectedModel,
    };

    if (referenceImage && referenceImage.trim()) {
      options.image = referenceImage.trim();
      options.input_image = referenceImage.trim();
      options.source_image = referenceImage.trim();
    }

    let result: HTMLImageElement | string | { src?: string; url?: string };
    if (referenceImage && typeof puter.ai?.img2img === 'function') {
      result = await puter.ai.img2img(cleanPrompt, referenceImage.trim(), options);
    } else {
      result = await puter.ai!.txt2img(cleanPrompt, options);
    }

    let finalSrc = '';
    if (typeof result === 'string') {
      finalSrc = result;
    } else if (result instanceof HTMLImageElement || (result && 'src' in result && typeof result.src === 'string')) {
      finalSrc = (result as HTMLImageElement).src;
    } else if (result && 'url' in result && typeof result.url === 'string') {
      finalSrc = (result as { url: string }).url;
    }

    if (!finalSrc || finalSrc.trim().length === 0) {
      throw new Error('Puter returned an empty image result');
    }

    return finalSrc;
  };

  const timeoutTask = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      clearTimeout(timer);
      const timeoutErr = new Error(PUTER_TIMEOUT_ERROR_MESSAGE);
      console.error('[Puter AI: Image Generation] Timed out after', timeoutMs, 'ms with model', selectedModel);
      reject(timeoutErr);
    }, timeoutMs);
  });

  try {
    const finalUrl = await Promise.race([generationTask(), timeoutTask]);
    return {
      url: finalUrl,
      prompt: cleanPrompt,
      model: selectedModel,
    };
  } catch (err: unknown) {
    console.error('[Puter AI: Raw Error]', err);

    let errorMsg = '';
    if (err instanceof Error && err.message && err.message !== '[object Object]') {
      errorMsg = err.message;
    } else if (typeof err === 'object' && err !== null) {
      const e = err as Record<string, unknown>;
      if (typeof e.message === 'string' && e.message && e.message !== '[object Object]') {
        errorMsg = e.message;
      } else if (typeof e.error === 'string' && e.error) {
        errorMsg = e.error;
      } else if (typeof e.error === 'object' && e.error !== null) {
        const nested = e.error as Record<string, unknown>;
        if (typeof nested.message === 'string' && nested.message) {
          errorMsg = nested.message;
        } else if (typeof nested.code === 'string' && nested.code) {
          errorMsg = `Code: ${nested.code}`;
        } else {
          try {
            errorMsg = JSON.stringify(e.error);
          } catch {
            errorMsg = '';
          }
        }
      } else if (typeof e.statusText === 'string' && e.statusText) {
        errorMsg = e.statusText;
      } else {
        try {
          const stringified = JSON.stringify(err);
          if (stringified && stringified !== '{}' && stringified !== '[]') {
            errorMsg = stringified;
          }
        } catch {
          errorMsg = '';
        }
      }
    } else if (typeof err === 'string' && err.trim()) {
      errorMsg = err;
    }

    if (!errorMsg || errorMsg === '[object Object]') {
      errorMsg = 'Puter image synthesis failed (unknown SDK error)';
    }

    latestPuterDebugInfo.error = errorMsg;
    getPuterDebugInfo();

    console.error('[Puter AI: Image Generation] Synthesis failure:', errorMsg);
    if (errorMsg.includes('timed out') || errorMsg.includes('not respond in time')) {
      throw new Error(PUTER_TIMEOUT_ERROR_MESSAGE);
    }
    throw new Error(errorMsg);
  }
}

/**
 * Resets the Puter guest session by calling puter.auth.signOut().
 * This gives the user a fresh guest session without requiring signup.
 */
export async function resetPuterSession(): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      if (window.puter?.auth?.signOut) {
        await window.puter.auth.signOut();
      }
      // Clean any stored session tokens if present in storage
      for (const key of Object.keys(localStorage)) {
        if (key.toLowerCase().includes('puter')) {
          try {
            localStorage.removeItem(key);
          } catch {
            // ignore
          }
        }
      }
      for (const key of Object.keys(sessionStorage)) {
        if (key.toLowerCase().includes('puter')) {
          try {
            sessionStorage.removeItem(key);
          } catch {
            // ignore
          }
        }
      }
    }
  } catch (err) {
    console.error('[Puter AI: Session Reset] Error resetting guest session:', err);
  }
}
