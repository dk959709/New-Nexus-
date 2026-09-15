// Puter.js Image Generation & Session Management Service
// Puter provides free temporary guest sessions with zero API keys required.

export const PUTER_IMAGE_MODELS = [
  { id: 'stabilityai/stable-diffusion-3-medium', name: 'Stability AI Stable Diffusion 3 Medium' },
  { id: 'openai/gpt-image-2', name: 'OpenAI GPT Image 2' },
  { id: 'google/gemini-3-pro-image-preview', name: 'Google Gemini 3 Pro Image Preview' },
  { id: 'google/gemini-2.5-flash-image', name: 'Google Gemini 2.5 Flash Image' },
  { id: 'black-forest-labs/flux-2-pro', name: 'Black Forest Labs FLUX 2 Pro' },
  { id: 'x-ai/grok-imagine-image', name: 'xAI Grok Imagine Image' },
];

export const DEFAULT_PUTER_MODEL = 'stabilityai/stable-diffusion-3-medium';

declare global {
  interface Window {
    puter?: {
      ai?: {
        txt2img: (
          prompt: string,
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

let puterLoadPromise: Promise<typeof window.puter> | null = null;

/**
 * Dynamically loads the Puter.js v2 SDK if not already available in window.
 */
export async function loadPuterScript(): Promise<typeof window.puter> {
  if (typeof window === 'undefined') {
    throw new Error('Puter SDK can only run in a browser environment');
  }

  if (window.puter?.ai?.txt2img) {
    return window.puter;
  }

  if (puterLoadPromise) {
    return puterLoadPromise;
  }

  puterLoadPromise = new Promise((resolve, reject) => {
    // Check if script element is already added to DOM
    const existing = document.querySelector<HTMLScriptElement>('script[src*="js.puter.com"]');
    if (existing) {
      if (window.puter?.ai?.txt2img) {
        resolve(window.puter);
        return;
      }
      existing.addEventListener('load', () => {
        if (window.puter) resolve(window.puter);
        else reject(new Error('Puter SDK script loaded but window.puter not found'));
      });
      existing.addEventListener('error', () => {
        reject(new Error('Failed to load Puter.js from https://js.puter.com/v2/'));
      });
      // Safety timeout
      setTimeout(() => {
        if (window.puter?.ai) resolve(window.puter);
      }, 1500);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.puter.com/v2/';
    script.async = true;
    script.crossOrigin = 'anonymous';

    script.onload = () => {
      if (window.puter) {
        resolve(window.puter);
      } else {
        // Sometimes takes a few milliseconds for window.puter to register
        setTimeout(() => {
          if (window.puter) resolve(window.puter);
          else reject(new Error('Puter SDK loaded but puter object is missing'));
        }, 300);
      }
    };

    script.onerror = () => {
      puterLoadPromise = null;
      reject(new Error('Failed to load Puter.js script from https://js.puter.com/v2/'));
    };

    document.head.appendChild(script);
  });

  return puterLoadPromise;
}

/**
 * Synthesizes an image using Puter.js library SDK.
 * Handles temporary guest sessions automatically.
 */
export async function generatePuterImage(
  prompt: string,
  model?: string
): Promise<{ url: string; prompt: string; model: string }> {
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) {
    throw new Error('Please provide an image prompt description');
  }

  const selectedModel = model || DEFAULT_PUTER_MODEL;
  const puter = await loadPuterScript();

  if (!puter?.ai?.txt2img) {
    throw new Error('Puter AI txt2img is not available in the loaded Puter.js SDK');
  }

  try {
    const result = await puter.ai.txt2img(cleanPrompt, {
      model: selectedModel,
    });

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

    return {
      url: finalSrc,
      prompt: cleanPrompt,
      model: selectedModel,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[Puter AI] Generation error:', err);
    throw new Error(errorMsg || 'Puter image synthesis failed');
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
    console.warn('[Puter AI] Error resetting session:', err);
  }
}
