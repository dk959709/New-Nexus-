import { storage } from '@/lib/storage';
import type { ParallaxGenesisSettings, ParallaxGenesisSlot } from '@/types';

export interface ParallaxModelPoolChoice {
  providerId: string;
  modelId: string;
}

/**
 * Returns the list of usable model choices from storage.getAIProvidersState().providers
 * (only providers with at least 1 non-empty key) plus 'existing' (Built-in / Active default).
 */
export function getModelPool(): ParallaxModelPoolChoice[] {
  const pool: ParallaxModelPoolChoice[] = [];
  try {
    const state = storage.getAIProvidersState();
    const providers = Array.isArray(state?.providers) ? state.providers : [];

    for (const p of providers) {
      if (!p || !p.id) continue;
      const hasValidKey =
        Array.isArray(p.keys) && p.keys.some((k) => k && typeof k.key === 'string' && k.key.trim().length > 0);
      if (hasValidKey) {
        pool.push({
          providerId: p.id,
          modelId: (p.model && p.model.trim()) || 'deepseek/deepseek-chat',
        });
      }
    }

    const activeCustom = storage.getActiveAIProvider?.();
    const defaultModel =
      activeCustom && activeCustom.model && activeCustom.model.trim()
        ? activeCustom.model.trim()
        : 'deepseek/deepseek-chat';

    pool.push({
      providerId: 'existing',
      modelId: defaultModel,
    });
  } catch {
    pool.push({
      providerId: 'existing',
      modelId: 'deepseek/deepseek-chat',
    });
  }

  if (pool.length === 0) {
    pool.push({
      providerId: 'existing',
      modelId: 'deepseek/deepseek-chat',
    });
  }

  return pool;
}

/**
 * Resolves the providerId and modelId for a specific Genesis slot (0..19).
 * If the slot's providerId is 'auto', picks pool[slotIndex % pool.length].
 * If the pool is empty, uses { providerId: 'existing', modelId: 'deepseek/deepseek-chat' }.
 */
export function resolveGenesisSlot(
  slotIndex: number,
  settings?: ParallaxGenesisSettings,
): ParallaxGenesisSlot {
  const effectiveSettings = settings || storage.getParallaxGenesisSettings();
  const safeIdx = Math.max(0, Math.min(19, Math.floor(slotIndex)));
  const slot = effectiveSettings?.slots?.[safeIdx];
  const pool = getModelPool();

  if (!slot || !slot.providerId || slot.providerId === 'auto') {
    if (pool.length === 0) {
      return { providerId: 'existing', modelId: 'deepseek/deepseek-chat' };
    }
    const picked = pool[safeIdx % pool.length];
    return {
      providerId: picked.providerId,
      modelId: picked.modelId || 'deepseek/deepseek-chat',
    };
  }

  if (slot.modelId && slot.modelId.trim()) {
    return {
      providerId: slot.providerId,
      modelId: slot.modelId.trim(),
    };
  }

  // Fallback model lookup if user left modelId blank for a specific provider
  try {
    const state = storage.getAIProvidersState();
    const matched = state.providers.find((p) => p.id === slot.providerId);
    if (matched && matched.model && matched.model.trim()) {
      return {
        providerId: slot.providerId,
        modelId: matched.model.trim(),
      };
    }
  } catch {
    // ignore
  }

  return {
    providerId: slot.providerId,
    modelId: 'deepseek/deepseek-chat',
  };
}
