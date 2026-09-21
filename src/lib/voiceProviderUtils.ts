import { VoiceProviderConfig, CloudVoiceItem, AIKeyItem, StudioVoiceSettings } from '@/types';
import { DEFAULT_ELEVENLABS_VOICES } from '@/data/elevenLabsVoices';
import { storage } from '@/lib/storage';

/**
 * Builds the HTTP headers for a Voice AI Provider.
 * Supports custom header names (like 'xi-api-key' for ElevenLabs)
 * or standard 'Authorization: Bearer <key>' format.
 */
export function buildVoiceRequestHeaders(
  provider: VoiceProviderConfig,
  apiKey?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'audio/mpeg, audio/*, application/json',
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
 * Resolves the ElevenLabs WebSocket streaming URL:
 * wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input?model_id={model_id}&output_format=pcm_24000
 */
export function buildElevenLabsWebSocketUrl(
  voiceId: string,
  modelId?: string,
  outputFormat: string = 'pcm_24000'
): string {
  const cleanVoiceId = encodeURIComponent(voiceId.trim());
  const cleanModel = encodeURIComponent(modelId || 'eleven_multilingual_v2');
  const cleanFormat = encodeURIComponent(outputFormat);
  return `wss://api.elevenlabs.io/v1/text-to-speech/${cleanVoiceId}/stream-input?model_id=${cleanModel}&output_format=${cleanFormat}`;
}

/**
 * Checks if a voice ID is a known library/restricted voice requiring a paid ElevenLabs plan
 */
export function isVoiceTierRestricted(voiceId: string): boolean {
  const restrictedIds = [
    'gOupLcAkjEnguROwi4oS', // Darian
    'OZ0L6eISlOejga3XjDFt', // Talia
    'WQP7cQUF5aAS6Axh5yaa', // Elara
    '21m00Tcm4TlvDq8ikWAM', // Rachel
    'AZnzlk1XvdvUeBnXmlld', // Domi
    'ErXwobaYiN019PkySvjV', // Antoni
  ];
  return restrictedIds.includes(voiceId.trim());
}

/**
 * Resolves the Voice AI endpoint URL by replacing '{voice_id}' or '{voiceId}'
 * with the target voice ID. If not found in the template, appends the voice ID.
 */
export function buildVoiceEndpointUrl(urlTemplate: string, voiceId: string): string {
  const rawUrl = urlTemplate.trim();
  if (!rawUrl) return '';

  const cleanVoiceId = encodeURIComponent(voiceId.trim());

  if (rawUrl.includes('{voice_id}')) {
    return rawUrl.replace(/\{voice_id\}/g, cleanVoiceId);
  }
  if (rawUrl.includes('{voiceId}')) {
    return rawUrl.replace(/\{voiceId\}/g, cleanVoiceId);
  }

  // If URL ends with a slash or doesn't have voiceId, check if it looks like an endpoint needing it
  if (rawUrl.includes('api.elevenlabs.io') && !rawUrl.includes(cleanVoiceId)) {
    return rawUrl.replace(/\/+$/, '') + '/' + cleanVoiceId;
  }

  return rawUrl;
}

/**
 * Formats the JSON request body payload for Cloud Voice synthesis
 * with dynamic replacement of '{text}' and model identifiers.
 */
export function buildVoiceRequestBody(
  template?: string,
  text: string = '',
  model?: string,
  settings?: StudioVoiceSettings
): Record<string, unknown> {
  const cleanText = text.trim();
  const modelToUse = model || 'eleven_multilingual_v2';
  const voiceSettings = {
    stability: typeof settings?.stability === 'number' ? settings.stability : 0.5,
    similarity_boost: typeof settings?.similarityBoost === 'number' ? settings.similarityBoost : 0.75,
    ...(typeof settings?.speed === 'number' && settings.speed !== 1.0 ? { speed: settings.speed } : {}),
  };

  if (!template || !template.trim()) {
    return {
      text: cleanText,
      model_id: modelToUse,
      voice_settings: voiceSettings,
    };
  }

  const rawTemplate = template.trim();
  try {
    const stringifiedText = JSON.stringify(cleanText);
    const replaced = rawTemplate
      .replace(/"\{text\}"/g, stringifiedText)
      .replace(/\{text\}/g, stringifiedText)
      .replace(/"\{model\}"/g, JSON.stringify(modelToUse))
      .replace(/\{model\}/g, modelToUse);

    const parsed = JSON.parse(replaced) as Record<string, unknown>;
    parsed.voice_settings = {
      ...((parsed.voice_settings as Record<string, unknown>) || {}),
      ...voiceSettings,
    };
    return parsed;
  } catch (parseErr) {
    console.warn('[VoiceProvider] JSON.parse template failed, using safe fallback:', parseErr);
    return {
      text: cleanText,
      model_id: modelToUse,
      voice_settings: voiceSettings,
    };
  }
}

/**
 * Fetches the dynamic list of available voices from the configured Voice AI Provider
 * (e.g., https://api.elevenlabs.io/v1/voices for ElevenLabs).
 * Falls back gracefully to default curated premade voices.
 */
export async function fetchCloudVoices(
  provider: VoiceProviderConfig,
  apiKey?: string
): Promise<CloudVoiceItem[]> {
  const voicesUrl = provider.voicesUrl?.trim() || (provider.url.includes('elevenlabs.io') ? 'https://api.elevenlabs.io/v1/voices' : '');

  if (!voicesUrl) {
    return DEFAULT_ELEVENLABS_VOICES;
  }

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    const keyToUse = apiKey?.trim();
    if (keyToUse) {
      if (provider.customHeaderName && provider.customHeaderName.trim()) {
        headers[provider.customHeaderName.trim()] = keyToUse;
      } else {
        headers['Authorization'] = `Bearer ${keyToUse}`;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(voicesUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
      mode: 'cors',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[VoiceProvider] Voices endpoint returned HTTP ${response.status}. Using fallback voices.`);
      return DEFAULT_ELEVENLABS_VOICES;
    }

    const data = await response.json();
    const rawVoices = Array.isArray(data.voices) ? data.voices : Array.isArray(data) ? data : null;

    if (rawVoices && rawVoices.length > 0) {
      const parsedVoices: CloudVoiceItem[] = rawVoices
        .map((v: Record<string, unknown>) => {
          const id = String(v.voice_id || v.id || '');
          const name = String(v.name || id);
          const category = typeof v.category === 'string' ? v.category : undefined;
          const labels = typeof v.labels === 'object' && v.labels !== null ? (v.labels as Record<string, string>) : undefined;
          const gender = labels?.gender || (typeof v.gender === 'string' ? v.gender : undefined);
          const accent = labels?.accent || (typeof v.accent === 'string' ? v.accent : undefined);
          const description = typeof v.description === 'string' ? v.description : labels?.description;
          const previewUrl = typeof v.preview_url === 'string' ? v.preview_url : undefined;
          const availableTiers = Array.isArray(v.available_for_tiers) ? (v.available_for_tiers as string[]) : undefined;

          // Known restricted library/community voices (e.g. Darian, Talia, Elara, Rachel, Domi, Antoni)
          const isKnownLibrary =
            id === 'gOupLcAkjEnguROwi4oS' ||
            id === 'OZ0L6eISlOejga3XjDFt' ||
            id === 'WQP7cQUF5aAS6Axh5yaa' ||
            id === '21m00Tcm4TlvDq8ikWAM' ||
            id === 'AZnzlk1XvdvUeBnXmlld' ||
            id === 'ErXwobaYiN019PkySvjV';
          const isLibrary = category === 'library' || Boolean(v.sharing && (v.sharing as Record<string, unknown>).library_item_id) || isKnownLibrary || (category && category !== 'premade');
          const requiresSubscription = isLibrary || (availableTiers && availableTiers.length > 0 && !availableTiers.includes('free'));
          const isFreeTierCompatible = !requiresSubscription;

          return {
            id,
            name,
            category,
            labels,
            gender,
            accent,
            description,
            previewUrl,
            requiresSubscription,
            isFreeTierCompatible,
          };
        })
        .filter((v: CloudVoiceItem) => Boolean(v.id));

      // Sort: Free tier compatible voices first, then alphabetical
      parsedVoices.sort((a, b) => {
        if (a.isFreeTierCompatible && !b.isFreeTierCompatible) return -1;
        if (!a.isFreeTierCompatible && b.isFreeTierCompatible) return 1;
        return a.name.localeCompare(b.name);
      });

      return parsedVoices;
    }

    return DEFAULT_ELEVENLABS_VOICES;
  } catch (err) {
    console.warn('[VoiceProvider] Failed to fetch dynamic voices, using fallback:', err);
    return DEFAULT_ELEVENLABS_VOICES;
  }
}

/**
 * Synthesizes speech using the configured Cloud Voice AI Provider with automatic key failover.
 */
export async function synthesizeCloudVoiceAudio(
  provider: VoiceProviderConfig,
  text: string,
  voiceId: string,
  onProgress?: (msg: string) => void,
  settings?: StudioVoiceSettings
): Promise<{ blob: Blob; usedKeyId?: string }> {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error('Please enter text to synthesize.');
  }

  const endpointUrl = buildVoiceEndpointUrl(provider.url, voiceId);
  if (!endpointUrl) {
    throw new Error(`Invalid Voice AI endpoint URL for provider ${provider.name}.`);
  }

  // Determine candidate keys according to key strategy
  const configuredKeys = (provider.keys || []).filter((k) => k.key.trim().length > 0);
  
  if (configuredKeys.length === 0) {
    throw new Error(`No API key configured for ${provider.name}. Please configure an API key in AI Providers Settings.`);
  }

  // Sort candidate keys based on keyStrategy and status
  let candidateKeys: AIKeyItem[] = [...configuredKeys];
  if (provider.keyStrategy === 'manual' && provider.preferredKeyId) {
    const preferred = candidateKeys.find((k) => k.id === provider.preferredKeyId);
    if (preferred) {
      candidateKeys = [preferred, ...candidateKeys.filter((k) => k.id !== provider.preferredKeyId)];
    }
  } else if (provider.keyStrategy === 'round_robin') {
    candidateKeys.sort((a, b) => (a.lastTested || 0) - (b.lastTested || 0));
  } else {
    // Failover: healthy first, untested second, cooldown last, skip invalid if others exist
    candidateKeys.sort((a, b) => {
      const order = { healthy: 0, untested: 1, cooldown: 2, invalid: 3 };
      return (order[a.status] || 1) - (order[b.status] || 1);
    });
  }

  let lastError: Error | null = null;

  for (let i = 0; i < candidateKeys.length; i++) {
    const keyItem = candidateKeys[i];
    const keyVal = keyItem.key.trim();

    try {
      if (onProgress) {
        onProgress(
          candidateKeys.length > 1
            ? `Synthesizing with ${provider.name} (Key ${i + 1}/${candidateKeys.length})...`
            : `Synthesizing with ${provider.name}...`
        );
      }

      const headers = buildVoiceRequestHeaders(provider, keyVal);
      const requestPayload = buildVoiceRequestBody(provider.requestBodyTemplate, cleanText, provider.model, settings);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);

      const response = await fetch(endpointUrl, {
        method: provider.requestType === 'get' ? 'GET' : 'POST',
        headers,
        body: provider.requestType === 'get' ? undefined : JSON.stringify(requestPayload),
        signal: controller.signal,
        mode: 'cors',
      });

      clearTimeout(timeoutId);

      const contentType = (response.headers.get('content-type') || '').toLowerCase();

      if (!response.ok) {
        let errMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          if (contentType.includes('application/json')) {
            const errJson = await response.json();
            errMessage =
              errJson?.detail?.message ||
              errJson?.detail ||
              errJson?.message ||
              errJson?.error ||
              JSON.stringify(errJson);
          } else {
            const errTxt = await response.text();
            if (errTxt) errMessage = errTxt.slice(0, 300);
          }
        } catch {
          // ignore parsing error
        }

        const isVoiceTierRestricted =
          response.status === 402 ||
          /needs_to_be_subscribed_to_use_voice/i.test(errMessage) ||
          /cannot use library voices/i.test(errMessage) ||
          /library voices via the api/i.test(errMessage) ||
          /upgrade your subscription to use this voice/i.test(errMessage);

        if (isVoiceTierRestricted) {
          // The API key is valid and authenticated; the voice itself is restricted on the free tier.
          // Keep key healthy and do not penalize it.
          storage.updateVoiceKeyHealth(provider.id, keyItem.id, 'healthy');
          const restrictionError = new Error(
            `Free users cannot use library voices via the API (402 paid_plan_required). Please switch to a confirmed free-tier premade voice (such as Sarah, George, or Brian), use Microsoft Edge TTS, or upgrade your ElevenLabs subscription.`
          );
          (restrictionError as Record<string, unknown>).isVoiceTierRestricted = true;
          (restrictionError as Record<string, unknown>).suggestedVoiceId = 'EXAVITQu4vr4xnSDxMaL';
          (restrictionError as Record<string, unknown>).suggestedVoiceName = 'Sarah';
          throw restrictionError;
        }

        const isAuthError = response.status === 401 || response.status === 403;
        storage.updateVoiceKeyHealth(
          provider.id,
          keyItem.id,
          isAuthError ? 'invalid' : 'cooldown',
          errMessage
        );

        throw new Error(errMessage);
      }

      // Check if response is audio or JSON error
      if (contentType.includes('application/json')) {
        const json = await response.json();
        if (json?.error || json?.detail) {
          const errMsg = json.error?.message || json.detail?.message || json.error || json.detail;
          throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
        }
      }

      const audioBlob = await response.blob();
      if (!audioBlob || audioBlob.size === 0) {
        throw new Error('Received empty audio stream from voice provider.');
      }

      // Mark key as healthy
      storage.updateVoiceKeyHealth(provider.id, keyItem.id, 'healthy');

      const finalBlob = audioBlob.type.includes('audio')
        ? audioBlob
        : new Blob([audioBlob], { type: 'audio/mpeg' });

      return { blob: finalBlob, usedKeyId: keyItem.id };
    } catch (err: unknown) {
      const parsedErr = err instanceof Error ? err : new Error(String(err));
      console.warn(`[VoiceProvider] Key ${keyItem.id} failed:`, parsedErr.message);
      lastError = parsedErr;

      // If this is a voice-tier restriction, breaking immediately prevents attempting other keys
      // which would also fail because the voice model itself is restricted.
      if ((parsedErr as Record<string, unknown>).isVoiceTierRestricted) {
        break;
      }

      // If user selected manual strategy, do not failover automatically
      if (provider.keyStrategy === 'manual') {
        break;
      }
    }
  }

  throw lastError || new Error(`Failed to synthesize voice with ${provider.name}.`);
}

/**
 * Converts accumulated 16-bit linear PCM chunks (mono, 24kHz) into a valid RIFF WAV audio Blob.
 */
export function pcmToWavBlob(
  pcmChunks: Uint8Array[],
  sampleRate = 24000,
  numChannels = 1
): Blob {
  const totalPcmBytes = pcmChunks.reduce((sum, c) => sum + c.byteLength, 0);
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  // "RIFF" chunk
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + totalPcmBytes, true); // chunkSize (36 + data size)
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // "fmt " sub-chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM linear)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate (e.g. 24000)
  view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate (SampleRate * NumChannels * 2)
  view.setUint16(32, numChannels * 2, true); // BlockAlign (NumChannels * 2)
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // "data" sub-chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, totalPcmBytes, true); // Subchunk2Size (data size)

  return new Blob([wavHeader, ...pcmChunks], { type: 'audio/wav' });
}
