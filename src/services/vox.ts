import { api } from './api';
import { storage } from '@/lib/storage';
import type { VoxSettings } from '@/types';

// Track current playing audio instance across the app
let currentAudio: HTMLAudioElement | null = null;
let currentAudioStopCallback: (() => void) | null = null;
let isCurrentlyPlaying = false;
const playbackListeners = new Set<(isPlaying: boolean, textSnippet?: string) => void>();

function notifyPlaybackState(isPlaying: boolean, textSnippet?: string) {
  isCurrentlyPlaying = isPlaying;
  playbackListeners.forEach((listener) => {
    try {
      listener(isPlaying, textSnippet);
    } catch {
      // safe fallback
    }
  });
}

export const POPULAR_VOX_MODELS = [
  {
    id: 'facebook/mms-tts-eng',
    name: 'Meta MMS English (Recommended)',
    desc: 'High-speed, robust multilingual speech synthesis by Meta',
    lang: 'English (US/UK)',
    badge: 'Fast & Stable',
  },
  {
    id: 'espnet/kan-bayashi_ljspeech_vits',
    name: 'LJSpeech VITS Neural',
    desc: 'Expressive, clear neural voice trained on LJSpeech',
    lang: 'English (Studio)',
    badge: 'High Clarity',
  },
  {
    id: 'microsoft/speecht5_tts',
    name: 'Microsoft SpeechT5 TTS',
    desc: 'Neural multi-speaker transformer architecture by Microsoft',
    lang: 'English (Neural)',
    badge: 'Expressive',
  },
  {
    id: 'hexgrad/Kokoro-82M',
    name: 'Kokoro 82M Speech',
    desc: 'Lightweight state-of-the-art neural voice generator',
    lang: 'English (Modern)',
    badge: 'State-of-the-Art',
  },
] as const;

export interface PlaySpeechOptions {
  model?: string;
  speed?: number;
  apiKey?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: Error) => void;
}

export const vox = {
  getApiKey(providerId?: string): string | null {
    const settings = this.getSettings();
    const targetProviderId = providerId || settings.providerId;

    // 1. If a specific providerId is set, look in configured AI Providers
    if (targetProviderId && targetProviderId !== 'existing') {
      const state = storage.getAIProvidersState();
      const provider = state.providers.find((p) => p.id === targetProviderId);
      if (provider) {
        // Preferred key or first non-dead key
        if (provider.preferredKeyId) {
          const prefKey = provider.keys.find((k) => k.id === provider.preferredKeyId);
          if (prefKey && prefKey.key && prefKey.key.trim().length > 0) {
            return prefKey.key.trim();
          }
        }
        const activeKey = provider.keys.find((k) => k.key && k.key.trim().length > 0 && k.status !== 'dead');
        if (activeKey) return activeKey.key.trim();
        // Fallback to any non-empty key
        const anyKey = provider.keys.find((k) => k.key && k.key.trim().length > 0);
        if (anyKey) return anyKey.key.trim();
      }
    }

    // 2. Default to general Hugging Face key
    return storage.getHuggingFaceKey();
  },

  setApiKey(key: string): void {
    storage.saveHuggingFaceKey(key);
  },

  isConfigured(providerId?: string): boolean {
    const key = this.getApiKey(providerId);
    return Boolean(key && key.trim().length > 0);
  },

  getSettings(): VoxSettings {
    return storage.getVoxSettings();
  },

  saveSettings(settings: VoxSettings): void {
    storage.saveVoxSettings(settings);
  },

  isPlaying(): boolean {
    return isCurrentlyPlaying;
  },

  subscribePlayback(listener: (isPlaying: boolean, textSnippet?: string) => void): () => void {
    playbackListeners.add(listener);
    listener(isCurrentlyPlaying);
    return () => {
      playbackListeners.delete(listener);
    };
  },

  stop(): void {
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio.src = '';
      } catch {
        // Safe fallback
      }
      currentAudio = null;
    }
    if (currentAudioStopCallback) {
      currentAudioStopCallback();
      currentAudioStopCallback = null;
    }
    notifyPlaybackState(false);
  },

  async synthesize(
    text: string,
    options?: { model?: string; apiKey?: string },
  ): Promise<{ ok: boolean; audioUrl: string; mimeType?: string; model?: string }> {
    const settings = this.getSettings();
    const model = options?.model || settings.model || 'facebook/mms-tts-eng';
    const apiKey = options?.apiKey || this.getApiKey() || undefined;

    const res = await api.generateTts({
      text,
      model,
      apiKey,
    });

    return res;
  },

  async speak(
    text: string,
    options?: PlaySpeechOptions,
  ): Promise<{ stop: () => void; audio: HTMLAudioElement }> {
    // 1. Stop any currently active speech
    this.stop();

    // 2. Synthesize audio via Hugging Face Inference API
    const settings = this.getSettings();
    const model = options?.model || settings.model || 'facebook/mms-tts-eng';
    const speed = options?.speed ?? settings.speed ?? 1.0;
    const apiKey = options?.apiKey || this.getApiKey() || undefined;

    let res: { ok: boolean; audioUrl: string; mimeType?: string; model?: string };
    try {
      res = await api.generateTts({
        text,
        model,
        apiKey,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      options?.onError?.(error);
      notifyPlaybackState(false);
      throw error;
    }

    if (!res || !res.audioUrl) {
      const err = new Error('No audio data received from Hugging Face TTS.');
      options?.onError?.(err);
      notifyPlaybackState(false);
      throw err;
    }

    // 3. Create Audio object and play
    const audio = new Audio(res.audioUrl);
    currentAudio = audio;
    try {
      audio.playbackRate = Math.max(0.5, Math.min(2.0, speed));
    } catch {
      // safe fallback
    }

    const snippet = text.slice(0, 80).trim();

    return new Promise((resolve, reject) => {
      let isSettled = false;

      const cleanup = () => {
        if (currentAudio === audio) {
          currentAudio = null;
        }
        currentAudioStopCallback = null;
        notifyPlaybackState(false);
      };

      const handleStop = () => {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch {
          // safe fallback
        }
        cleanup();
        options?.onEnd?.();
      };

      currentAudioStopCallback = handleStop;

      audio.onplay = () => {
        notifyPlaybackState(true, snippet);
        options?.onStart?.();
        if (!isSettled) {
          isSettled = true;
          resolve({ stop: handleStop, audio });
        }
      };

      audio.onended = () => {
        cleanup();
        options?.onEnd?.();
      };

      audio.onerror = () => {
        const audioErr = new Error('Failed to play synthesized audio stream.');
        cleanup();
        options?.onError?.(audioErr);
        if (!isSettled) {
          isSettled = true;
          reject(audioErr);
        }
      };

      // Play audio
      audio.play().catch((playErr) => {
        cleanup();
        options?.onError?.(playErr);
        if (!isSettled) {
          isSettled = true;
          reject(playErr);
        }
      });
    });
  },

  async testConnection(
    apiKey?: string,
    model?: string,
  ): Promise<{ ok: boolean; message: string; audioUrl?: string }> {
    const key = apiKey || this.getApiKey() || undefined;
    const targetModel = model || this.getSettings().model || 'facebook/mms-tts-eng';

    try {
      const res = await api.testTts({ apiKey: key, model: targetModel });
      if (res.ok) {
        return {
          ok: true,
          message: `Connected successfully to Hugging Face model (${res.model || targetModel})!`,
          audioUrl: res.audioUrl,
        };
      }
      return {
        ok: false,
        message: res.error || 'Failed to connect to Hugging Face TTS.',
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Connection test error.',
      };
    }
  },
};
