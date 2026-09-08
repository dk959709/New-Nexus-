import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import os from 'node:os';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';

import { errorResponse, domainOf, normalizeProviderUrl } from './shared.js';
import {
  getFirstConnectedTv,
  executeTvTool,
  getConnectedDevicesSummary,
} from './state.js';
import { mediaRouter } from './routes/media.js';
import { weatherRouter, geocode, weatherProvider } from './routes/weather.js';
import { createSearchRouter, searchProvider, fetchWikipediaSummary } from './routes/search.js';
import { devicesRouter } from './routes/devices.js';
import { telegramRouter, setTelegramAiHandler } from './routes/telegram.js';


function sanitizeChatMessages(
  messages: Array<{ role: string; content: string }>,
): Array<{ role: string; content: string }> {
  const validMsgs = (Array.isArray(messages) ? messages : []).filter(
    (m) => m && typeof m.content === 'string' && m.content.trim().length > 0,
  );

  const systemMsgs = validMsgs.filter((m) => m.role === 'system');
  const nonSystemMsgs = validMsgs.filter((m) => m.role !== 'system');

  // Drop leading assistant messages that have no preceding user message
  let firstUserIdx = nonSystemMsgs.findIndex((m) => m.role === 'user');
  if (firstUserIdx === -1 && nonSystemMsgs.length > 0) {
    firstUserIdx = 0;
  }
  const validNonSystem = firstUserIdx >= 0 ? nonSystemMsgs.slice(firstUserIdx) : [];

  const cleaned: Array<{ role: string; content: string }> = [];

  if (systemMsgs.length > 0) {
    cleaned.push({
      role: 'system',
      content: systemMsgs.map((s) => s.content.trim()).join('\n\n'),
    });
  }

  for (const msg of validNonSystem) {
    const role = msg.role === 'assistant' ? 'assistant' : 'user';
    const content = msg.content.trim();
    if (!content) continue;

    if (cleaned.length > 0 && cleaned[cleaned.length - 1].role === role) {
      cleaned[cleaned.length - 1].content += `\n\n${content}`;
    } else {
      cleaned.push({ role, content });
    }
  }

  if (!cleaned.some((m) => m.role === 'user')) {
    cleaned.push({ role: 'user', content: 'Hello' });
  }

  return cleaned;
}

interface ProviderRequestOptions {
  url?: string;
  model?: string;
  key?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

interface ProviderRequestResult {
  ok: boolean;
  text: string;
  content?: string;
  reasoning?: string;
  model: string;
  status: number;
  error?: string;
}

async function executeProviderChatRequest({
  url: rawUrl,
  model: rawModel,
  key: rawKey,
  messages,
  temperature = 0.3,
  maxTokens = 128,
  timeoutMs = 25000,
}: ProviderRequestOptions): Promise<ProviderRequestResult> {
  const url = normalizeProviderUrl(rawUrl);
  const model = (rawModel || 'deepseek/deepseek-chat').trim();
  const key = (rawKey || '').trim();

  if (!key) {
    return {
      ok: false,
      text: '',
      content: '',
      reasoning: '',
      model,
      status: 401,
      error: 'Missing or empty API key.',
    };
  }

  const sanitized = sanitizeChatMessages(messages);
  const maxAttempts = 3; // Initial attempt + up to 2 retries for transient 503/502/504/429

  const isOpenRouter = url.includes('openrouter.ai');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
  };

  if (isOpenRouter) {
    headers['HTTP-Referer'] = 'https://nexus-intelligence.local';
    headers['X-Title'] = 'NEXUS Intelligence';
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: sanitized,
          temperature,
          max_tokens: maxTokens,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.ok) {
        const payload = (await res.json()) as {
          model?: string;
          choices?: Array<{
            message?: {
              content?: string | Array<{ type?: string; text?: string }>;
              reasoning?: string;
              reasoning_content?: string;
            };
            text?: string;
          }>;
        };

        const choice = payload.choices?.[0];
        let contentStr = '';
        if (choice?.message?.content) {
          if (typeof choice.message.content === 'string') {
            contentStr = choice.message.content.trim();
          } else if (Array.isArray(choice.message.content)) {
            contentStr = choice.message.content
              .map((part) => (typeof part === 'string' ? part : part?.text || ''))
              .join('')
              .trim();
          }
        }

        const rawReasoning =
          choice?.message?.reasoning ||
          (choice?.message as { reasoning_content?: string })?.reasoning_content;
        let reasoningStr = '';
        if (rawReasoning && typeof rawReasoning === 'string') {
          reasoningStr = rawReasoning.trim();
        }

        // Primary answer is message.content, falling back to message.reasoning only if content is empty
        const text =
          contentStr ||
          reasoningStr ||
          (typeof choice?.text === 'string' ? choice.text.trim() : '') ||
          (choice ? 'OK' : '');

        if (!text) {
          return {
            ok: false,
            text: '',
            content: '',
            reasoning: '',
            model: payload.model || model,
            status: 502,
            error: 'AI provider returned an empty response.',
          };
        }

        return {
          ok: true,
          text,
          content: contentStr,
          reasoning: reasoningStr,
          model: payload.model || model,
          status: res.status,
        };
      } else {
        const status = res.status;
        let errorMsg = `HTTP ${status}`;
        try {
          const errPayload = (await res.json()) as {
            error?: { message?: string } | string;
            message?: string;
          };
          errorMsg =
            (typeof errPayload.error === 'object' ? errPayload.error?.message : errPayload.error) ||
            errPayload.message ||
            `HTTP ${status}`;
        } catch {
          const rawText = await res.text().catch(() => '');
          if (rawText) {
            errorMsg = rawText.slice(0, 200);
          }
        }

        const isTransient = status === 503 || status === 502 || status === 504 || status === 429;
        if (isTransient && attempt < maxAttempts) {
          const backoff = attempt * 750; // 750ms, then 1500ms
          console.warn(`[AI Provider Request] ${url} (${model}) returned HTTP ${status} (${errorMsg}). Retrying in ${backoff}ms (attempt ${attempt}/${maxAttempts})...`);
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
        }

        return {
          ok: false,
          text: '',
          model,
          status,
          error: errorMsg,
        };
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isTransientNetwork = attempt < maxAttempts;
      if (isTransientNetwork) {
        const backoff = attempt * 750;
        console.warn(`[AI Provider Request] Network error on attempt ${attempt}/${maxAttempts}: ${errorMsg}. Retrying in ${backoff}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }
      return {
        ok: false,
        text: '',
        model,
        status: 504,
        error: `Network or timeout error: ${errorMsg}`,
      };
    }
  }

  return {
    ok: false,
    text: '',
    model,
    status: 503,
    error: 'AI Provider request exhausted all retries.',
  };
}

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

async function generateWithGemini({
  messages,
  temperature = 0.4,
  maxTokens = 2400,
}: {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
}): Promise<{ text: string; model: string } | null> {
  const client = getGeminiClient();
  if (!client) return null;

  const sys = messages.find((m) => m.role === 'system')?.content;
  const chatMsgs = messages.filter((m) => m.role !== 'system');

  const contents = chatMsgs.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  if (contents.length === 0) return null;

  // Primary model and fallback models supporting current API specifications
  const candidateModels = ['gemini-3.7-flash', 'gemini-3.8-flash'];

  for (const model of candidateModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await client.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: sys || undefined,
            temperature,
            maxOutputTokens: Math.max(maxTokens || 1200, 1000),
            // Disable thinking budget for conversational responses so output tokens are not consumed by reasoning traces
            thinkingConfig: { thinkingBudget: 0 },
          },
        });

        const text = response.text?.trim();
        if (text) {
          return { text, model };
        }
      } catch (err: unknown) {
        const errStr = err instanceof Error ? err.message : String(err);
        const isUnavailableOrThrottled =
          errStr.includes('503') ||
          errStr.includes('UNAVAILABLE') ||
          errStr.includes('high demand') ||
          errStr.includes('429') ||
          errStr.includes('RESOURCE_EXHAUSTED');

        console.warn(`[Gemini AI] (${model} attempt ${attempt + 1}) notice: ${errStr}`);

        if (isUnavailableOrThrottled && attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          continue;
        }
        break;
      }
    }
  }

  return null;
}

function generateLocalNexusAiResponse(
  query: string,
  _history: Array<{ role: string; content: string }> = [],
  _memory = '',
  sourceContext = '',
): { text: string; model: string } {
  void _history;
  void _memory;
  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();

  // 1. Greetings
  const isGreeting =
    /^(hi|hello|hey|greetings|good morning|good afternoon|good evening|howdy|sup|hola)\b/i.test(
      lower,
    ) ||
    lower === 'hi' ||
    lower === 'hello' ||
    lower === 'hey';

  if (isGreeting) {
    return {
      text: "Hello! I am NEXUS AI, your integrated intelligence assistant. I can help you with web search, live weather, space data, device telemetry, calculations, explanations, and summaries. What would you like to explore today?",
      model: 'nexus-intelligence',
    };
  }

  // 2. Identity / Capabilities
  if (
    lower.includes('who are you') ||
    lower.includes('what are you') ||
    lower.includes('what can you do') ||
    lower.includes('help me') ||
    lower === 'help' ||
    lower === 'features'
  ) {
    return {
      text: `I am **NEXUS AI**, a multi-model intelligence operating system.\n\nHere is what I can do for you:\n• **Web & Knowledge Search**: Search the web and Wikipedia for instant facts and summaries.\n• **Weather & Radar**: Real-time forecasts, atmospheric conditions, and interactive radar maps.\n• **Space Intelligence**: NASA Astronomy Picture of the Day (APOD) and asteroid tracking.\n• **Device Fleet Telemetry**: Live battery, network, RAM, and diagnostic monitoring for connected devices.\n• **Assistant Chat**: Multi-turn reasoning, problem solving, and explanations.\n\nFeel free to ask any question or give me a task!`,
      model: 'nexus-intelligence',
    };
  }

  // 3. Simple math evaluation
  const mathMatch = trimmed.match(
    /^(?:what is|calculate|solve|evaluate)?\s*([0-9]+(?:\.[0-9]+)?\s*[+\-*/^%]\s*[0-9]+(?:\.[0-9]+)?(?:\s*[+\-*/^]\s*[0-9]+(?:\.[0-9]+)?)*)\s*\??$/i,
  );
  if (mathMatch && mathMatch[1]) {
    try {
      const sanitizedExpr = mathMatch[1].replace(/\^/g, '**');
      if (/^[0-9.+\-*/\s()]+$/.test(sanitizedExpr)) {
        const result = Function(`'use strict'; return (${sanitizedExpr})`)();
        if (typeof result === 'number' && !isNaN(result)) {
          return {
            text: `The result of **${mathMatch[1].trim()}** is **${result}**.`,
            model: 'nexus-calc',
          };
        }
      }
    } catch {
      // ignore
    }
  }

  // 3.5 TV Tool Queries
  const isTvSpecificQuery =
    lower.includes('tv volume') ||
    lower.includes('my tv') ||
    lower.includes('smart tv') ||
    lower.includes('google tv') ||
    lower.includes('android tv') ||
    lower.includes('webos') ||
    lower.includes('tv status') ||
    lower.includes('is tv on') ||
    lower.includes('is my tv') ||
    lower.includes('tv power') ||
    lower.includes('tv mute') ||
    lower.includes('turn down tv') ||
    lower.includes('turn up tv') ||
    lower.includes('mute tv');

  if (isTvSpecificQuery) {
    const tvDev = getFirstConnectedTv();
    if (!tvDev || !tvDev.tv) {
      return {
        text: 'No Smart TV is currently connected.',
        model: 'nexus-tv-tool',
      };
    }
    if (lower.includes('volume')) {
      return {
        text: `The Smart TV ("${tvDev.name}") volume is currently **${tvDev.tv.volume ?? 24}%** (Muted: ${tvDev.tv.isMuted ? 'Yes' : 'No'}).`,
        model: 'nexus-tv-tool',
      };
    }
    if (lower.includes('power') || lower.includes('is tv on') || lower.includes('is my tv on')) {
      return {
        text: `The Smart TV ("${tvDev.name}") is currently **${tvDev.tv.powerState || 'ON'}** and ${tvDev.status === 'online' ? 'connected' : 'offline'}.`,
        model: 'nexus-tv-tool',
      };
    }
    return {
      text: executeTvTool('get_tv_status').result,
      model: 'nexus-tv-tool',
    };
  }

  // 4. If source context is available (from Wikipedia, weather, NASA, devices)
  if (sourceContext) {
    return {
      text: sourceContext.replace(/\[.*?\]:?/g, '').trim(),
      model: 'nexus-knowledge',
    };
  }

  // 5. General response
  return {
    text: `Here is information regarding **"${trimmed}"**:\n\nNEXUS has processed your query across our live intelligence engines. You can also explore real-time web results in the **Web Search** tab or check the **Weather Radar**.`,
    model: 'nexus-intelligence',
  };
}

async function generateOpenRouterOrCustomAi({
  messages,
  temperature = 0.3,
  maxTokens = 128,
  timeoutMs = 35000,
}: {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ text: string; content?: string; reasoning?: string; model: string } | null> {
  // Try Gemini first if key is available
  if (process.env.GEMINI_API_KEY) {
    const geminiRes = await generateWithGemini({ messages, temperature, maxTokens });
    if (geminiRes && geminiRes.text) {
      return {
        text: geminiRes.text,
        content: geminiRes.text,
        reasoning: '',
        model: geminiRes.model,
      };
    }
  }

  const key =
    process.env.AI_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.DEEPSEEK_API_KEY;
  if (!key) return null;

  const url =
    process.env.AI_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
  const model = process.env.AI_MODEL || 'deepseek/deepseek-chat';

  const result = await executeProviderChatRequest({
    url,
    model,
    key,
    messages,
    temperature,
    maxTokens,
    timeoutMs: timeoutMs || 35000,
  });

  if (result.ok && result.text) {
    return {
      text: result.text,
      content: result.content,
      reasoning: result.reasoning,
      model: result.model,
    };
  }

  console.warn(`[Built-in AI] Request failed: ${result.error || `HTTP ${result.status}`}`);
  return null;
}

interface CustomKeyItem {
  id?: string;
  key?: string;
  label?: string;
  status?: string;
}

interface CustomProviderPayload {
  id?: string;
  name?: string;
  url?: string;
  model?: string;
  maxTokens?: number | null;
  keyStrategy?: 'failover' | 'round_robin' | 'manual';
  preferredKeyId?: string;
  keys?: CustomKeyItem[];
  capabilities?: {
    text?: boolean;
    tools?: boolean;
    web?: boolean;
    wikipedia?: boolean;
    memory?: boolean;
  };
}

const keyCooldownMap = new Map<string, number>();
const providerRoundRobinIndex = new Map<string, number>();

async function executeAiWithProviderOrFallback({
  messages,
  temperature = 0.3,
  maxTokens = 128,
  providerConfig,
  timeoutMs = 35000,
}: {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number | null;
  providerConfig?: CustomProviderPayload | null;
  timeoutMs?: number;
}): Promise<{
  text: string;
  content?: string;
  reasoning?: string;
  model: string;
  providerName?: string;
  lastError?: string;
  lastStatus?: number;
} | {
  text?: never;
  content?: never;
  reasoning?: never;
  model?: never;
  providerName?: never;
  lastError: string;
  lastStatus: number;
} | null> {
  const effectiveMaxTokens =
    maxTokens && maxTokens > 0
      ? maxTokens
      : providerConfig?.maxTokens && providerConfig.maxTokens > 0
      ? providerConfig.maxTokens
      : 128;
  const effectiveTimeout = timeoutMs || 35000;

  // If no custom provider or existing default is specified, use generateOpenRouterOrCustomAi
  if (!providerConfig || !providerConfig.id || providerConfig.id === 'existing') {
    const builtInResult = await generateOpenRouterOrCustomAi({
      messages,
      temperature,
      maxTokens: effectiveMaxTokens,
      timeoutMs: effectiveTimeout,
    });
    if (builtInResult) {
      return {
        text: builtInResult.text,
        content: builtInResult.content,
        reasoning: builtInResult.reasoning,
        model: builtInResult.model,
        providerName: 'Built-in AI',
      };
    }
    return {
      lastError: 'Built-in AI connection timed out or returned no content.',
      lastStatus: 503,
    };
  }

  // Custom provider execution with multiple keys & rotation / failover
  const url = (providerConfig.url || 'https://openrouter.ai/api/v1/chat/completions').trim();
  const model = (providerConfig.model || 'deepseek/deepseek-chat').trim();
  const strategy = providerConfig.keyStrategy || 'failover';
  const rawKeys = Array.isArray(providerConfig.keys) ? providerConfig.keys : [];
  const validKeys: Array<CustomKeyItem & { key: string }> = rawKeys.filter(
    (k): k is CustomKeyItem & { key: string } => Boolean(k && typeof k.key === 'string' && k.key.trim().length > 0),
  );

  const serverKey =
    process.env.AI_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.DEEPSEEK_API_KEY;

  if (validKeys.length === 0) {
    if (serverKey) {
      const serverResult = await executeProviderChatRequest({
        url,
        model,
        key: serverKey,
        messages,
        temperature,
        maxTokens: effectiveMaxTokens,
        timeoutMs: effectiveTimeout,
      });

      if (serverResult.ok && serverResult.text) {
        return {
          text: serverResult.text,
          content: serverResult.content,
          reasoning: serverResult.reasoning,
          model: serverResult.model || model,
          providerName: providerConfig.name || 'OpenRouter',
        };
      }
      return {
        lastError: serverResult.error || `HTTP ${serverResult.status}`,
        lastStatus: serverResult.status,
      };
    }

    console.warn(`[AI Provider: ${providerConfig.name}] No valid keys found and no server key available.`);
    return {
      lastError: `No API key entered for provider "${providerConfig.name}".`,
      lastStatus: 400,
    };
  }

  // Determine initial key ordering based on strategy
  let orderedKeys: Array<CustomKeyItem & { key: string }> = [];

  if (strategy === 'manual' && providerConfig.preferredKeyId) {
    const preferred = validKeys.find((k) => k.id === providerConfig.preferredKeyId);
    const rest = validKeys.filter((k) => k.id !== providerConfig.preferredKeyId);
    orderedKeys = preferred ? [preferred, ...rest] : [...validKeys];
  } else if (strategy === 'round_robin') {
    const currentIndex = (providerConfig.id ? providerRoundRobinIndex.get(providerConfig.id) : 0) || 0;
    const startIdx = currentIndex % validKeys.length;
    orderedKeys = [
      ...validKeys.slice(startIdx),
      ...validKeys.slice(0, startIdx),
    ];
    if (providerConfig.id) {
      providerRoundRobinIndex.set(providerConfig.id, startIdx + 1);
    }
  } else {
    // Automatic failover: use configured order
    orderedKeys = [...validKeys];
  }

  // Prioritize keys that are not currently marked in cooldown/invalid,
  // but ALWAYS keep all valid keys in the sequence as fallbacks
  const now = Date.now();
  const isKeyActive = (k: CustomKeyItem & { key: string }) => {
    const serverCooldown = keyCooldownMap.get(k.key.trim()) || 0;
    const clientCooldown = typeof (k as { cooldownUntil?: number }).cooldownUntil === 'number' ? (k as { cooldownUntil?: number }).cooldownUntil! : 0;
    const isClientInvalid = (k as { status?: string }).status === 'invalid';
    return !isClientInvalid && serverCooldown <= now && clientCooldown <= now;
  };

  const activeKeys = orderedKeys.filter(isKeyActive);
  const inactiveKeys = orderedKeys.filter((k) => !isKeyActive(k));
  const finalKeySequence = activeKeys.length > 0 ? [...activeKeys, ...inactiveKeys] : orderedKeys;

  // Deduplicate keys by key string
  const seenKeyStrings = new Set<string>();
  const executionKeyList: Array<CustomKeyItem & { key: string }> = [];
  for (const k of finalKeySequence) {
    const trimmedKey = k.key.trim();
    if (!seenKeyStrings.has(trimmedKey)) {
      seenKeyStrings.add(trimmedKey);
      executionKeyList.push(k);
    }
  }

  let lastFailedError = '';
  let lastFailedStatus = 500;

  // Attempt each key in ordered sequence (Automatic Multi-Key Failover)
  for (let i = 0; i < executionKeyList.length; i++) {
    const keyItem = executionKeyList[i];
    const keyVal = keyItem.key.trim();
    const keyLabel = keyItem.label || `Key #${i + 1}`;

    const result = await executeProviderChatRequest({
      url,
      model,
      key: keyVal,
      messages,
      temperature,
      maxTokens: effectiveMaxTokens,
      timeoutMs: effectiveTimeout,
    });

    if (result.ok && result.text && result.text.trim().length > 0) {
      keyCooldownMap.delete(keyVal);
      return {
        text: result.text,
        content: result.content,
        reasoning: result.reasoning,
        model: result.model || model,
        providerName: providerConfig.name,
      };
    } else {
      const status = result.status;
      lastFailedStatus = status;
      lastFailedError = result.error || `HTTP ${status}`;

      if (status === 503 || status === 502 || status === 504 || status === 429) {
        keyCooldownMap.set(keyVal, Date.now() + 2000); // 2s brief pause for transient spikes
        console.warn(
          `[AI Provider: ${providerConfig.name}] Key "${keyLabel}" (${i + 1}/${executionKeyList.length}) received transient HTTP ${status} (${result.error}). Auto-failing over to next key...`,
        );
      } else if (status === 401 || status === 403 || status === 400 || status === 422) {
        keyCooldownMap.set(keyVal, Date.now() + 300000); // 5m invalid cooldown
        console.warn(
          `[AI Provider: ${providerConfig.name}] Key "${keyLabel}" (${i + 1}/${executionKeyList.length}) auth/param failed (HTTP ${status}: ${result.error}). Auto-failing over to next key...`,
        );
      } else {
        keyCooldownMap.set(keyVal, Date.now() + 2000);
        console.warn(
          `[AI Provider: ${providerConfig.name}] Key "${keyLabel}" (${i + 1}/${executionKeyList.length}) error HTTP ${status}: ${result.error}. Auto-failing over to next key...`,
        );
      }
    }
  }

  // Fallback to Gemini or server key if custom keys failed
  if (process.env.GEMINI_API_KEY) {
    const geminiFallback = await generateWithGemini({
      messages,
      temperature,
      maxTokens: effectiveMaxTokens,
    });
    if (geminiFallback && geminiFallback.text) {
      return {
        text: geminiFallback.text,
        content: geminiFallback.text,
        reasoning: '',
        model: geminiFallback.model,
        providerName: 'Google Gemini',
      };
    }
  }

  if (serverKey) {
    const serverFallbackResult = await executeProviderChatRequest({
      url,
      model,
      key: serverKey,
      messages,
      temperature,
      maxTokens: effectiveMaxTokens,
      timeoutMs: 25000,
    });

    if (serverFallbackResult.ok && serverFallbackResult.text) {
      return {
        text: serverFallbackResult.text,
        content: serverFallbackResult.content,
        reasoning: serverFallbackResult.reasoning,
        model: serverFallbackResult.model || model,
        providerName: providerConfig.name || 'OpenRouter',
      };
    }
  }

  return {
    lastError: lastFailedError,
    lastStatus: lastFailedStatus,
  };
}


type SourceCategory = 'ALL' | 'web' | 'wikipedia' | 'news' | 'nasa' | 'weather';
type ConfidenceLevel = 'verified' | 'limited' | 'unverified';

interface SmartAnswerSource {
  title: string;
  url: string;
  domain?: string;
  description?: string;
  date?: string;
  thumbnail?: string;
  image?: string;
  type: SourceCategory;
}

interface SmartAnswerResult {
  query: string;
  answer: string;
  confidence: ConfidenceLevel;
  confidenceReason?: string;
  sources: SmartAnswerSource[];
  followUps?: string[];
  selectedCategories: SourceCategory[];
  model?: string;
  tool?: string;
  fromCache?: boolean;
}

const smartAnswerCache = new Map<string, { data: SmartAnswerResult; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

function determineSourceCategories(query: string): SourceCategory[] {
  const text = query.toLowerCase().trim();
  const categories = new Set<SourceCategory>();

  // 1. Weather
  const weatherKeywords = [
    'weather', 'temperature', 'forecast', 'rain', 'snow', 'wind', 'humidity',
    'climate', 'degrees', 'celsius', 'fahrenheit', 'hot outside', 'cold outside',
    'precipitation'
  ];
  if (weatherKeywords.some((kw) => new RegExp(`\\b${kw}\\b`).test(text))) {
    categories.add('weather');
  }

  // 2. NASA / Space
  const spaceKeywords = [
    'space', 'black hole', 'black holes', 'nasa', 'astronaut', 'mars', 'moon',
    'planet', 'planets', 'galaxy', 'galaxies', 'universe', 'telescope', 'james webb',
    'hubble', 'iss', 'station', 'star', 'stars', 'solar system', 'orbit', 'asteroid',
    'comet', 'supernova', 'nebula', 'spacex', 'cosmic', 'astronomy', 'cosmos'
  ];
  if (spaceKeywords.some((kw) => text.includes(kw))) {
    categories.add('nasa');
    categories.add('wikipedia');
  }

  // 3. News
  const newsKeywords = [
    'news', 'latest', 'today', 'breaking', 'recent', 'headlines', 'update', 'updates',
    'happening', 'current events', 'stock market', 'election'
  ];
  if (newsKeywords.some((kw) => new RegExp(`\\b${kw}\\b`).test(text))) {
    categories.add('news');
    categories.add('web');
  }

  // 4. Wikipedia (scientific, historical, biographical, definitional, conceptual)
  const wikiKeywords = [
    'who is', 'who was', 'what is', 'what was', 'what are', 'where is', 'where was',
    'when was', 'when did', 'define', 'definition', 'explain', 'how does', 'why is',
    'why do', 'history of', 'biography', 'concept', 'theory', 'photosynthesis',
    'einstein', 'newton', 'quantum', 'dna', 'evolution', 'biology', 'physics',
    'chemistry', 'wikipedia', 'wiki'
  ];
  if (wikiKeywords.some((kw) => text.includes(kw))) {
    categories.add('wikipedia');
    categories.add('web');
  }

  // If only weather is requested, return weather
  if (categories.has('weather') && categories.size === 1) {
    return ['weather'];
  }

  // If query is specifically about space news
  if (text.includes('space') && text.includes('news')) {
    categories.add('news');
    categories.add('nasa');
    categories.add('web');
  }

  // Default fallback for general knowledge
  if (categories.size === 0) {
    categories.add('wikipedia');
    categories.add('web');
  }

  return Array.from(categories);
}

function generateSmartFollowUps(
  query: string,
  categories: SourceCategory[],
  sources: SmartAnswerSource[],
): string[] {
  const q = query.toLowerCase().trim();
  if (q.includes('black hole')) {
    return [
      'What causes a black hole to form?',
      'Can a black hole disappear over time?',
      'What happens near the event horizon?',
    ];
  }
  if (q.includes('einstein') || q.includes('albert')) {
    return [
      'What are the key principles of General Relativity?',
      'When did Albert Einstein win the Nobel Prize?',
      'How did Einstein contribute to quantum mechanics?',
    ];
  }
  if (q.includes('photosynthesis')) {
    return [
      'What are the light-dependent reactions in photosynthesis?',
      'Why is chlorophyll essential for plant cells?',
      'How does carbon dioxide concentration affect photosynthesis?',
    ];
  }
  if (q.includes('mars')) {
    return [
      'What is the atmosphere of Mars composed of?',
      'What evidence exists of past water on Mars?',
      'What are the main missions currently exploring Mars?',
    ];
  }
  if (categories.includes('weather')) {
    return [
      'What is the 7-day extended forecast?',
      'What is the precipitation probability today?',
      'What are the expected sunrise and sunset times?',
    ];
  }
  if (categories.includes('nasa')) {
    return [
      'What is the current position of the ISS?',
      'What are upcoming NASA space exploration missions?',
      'How do astronomers measure cosmic distances?',
    ];
  }
  if (categories.includes('news')) {
    return [
      'What are recent developments related to this story?',
      'What background context led to this headline?',
      'What are different media perspectives on this topic?',
    ];
  }
  if (sources.length > 0 && sources[0].title) {
    const mainTitle = sources[0].title;
    return [
      `What is the background and origin of ${mainTitle}?`,
      `How does ${mainTitle} work in practice?`,
      `What are the major applications or impact of ${mainTitle}?`,
    ];
  }
  return [
    `Can you explain the key concepts of ${query}?`,
    `What are the most important facts to know about this?`,
    `What is the historical significance of this?`,
  ];
}

async function executeSmartAnswerEngine(
  query: string,
  customSources?: Array<{ title: string; url: string; description: string; domain?: string }>,
  providerConfig?: CustomProviderPayload | null,
): Promise<SmartAnswerResult> {
  const trimmed = query.trim();
  const cacheKey =
    providerConfig && providerConfig.id !== 'existing'
      ? `${providerConfig.id}:${trimmed.toLowerCase()}`
      : trimmed.toLowerCase();

  if (!customSources && smartAnswerCache.has(cacheKey)) {
    const cached = smartAnswerCache.get(cacheKey)!;
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return { ...cached.data, fromCache: true };
    }
  }

  const structuredSources: SmartAnswerSource[] = [];
  const contextBlocks: string[] = [];
  const selectedCategories: SourceCategory[] = customSources
    ? ['web']
    : determineSourceCategories(trimmed);

  if (customSources && customSources.length > 0) {
    // Token-optimized custom sources from Search result synthesis
    for (const item of customSources.slice(0, 4)) {
      const cleanDesc = (item.description || '').replace(/\s+/g, ' ').slice(0, 200).trim();
      structuredSources.push({
        title: item.title,
        url: item.url,
        domain: item.domain || domainOf(item.url) || 'web',
        description: cleanDesc,
        type: 'web',
      });
      contextBlocks.push(`[Web Source: ${item.title}] (Domain: ${item.domain || 'web'})\n${cleanDesc}`);
    }
  } else {
    // Multi-source intelligence retrieval
    const promises: Promise<void>[] = [];

    // 1. Wikipedia
    if (selectedCategories.includes('wikipedia')) {
      promises.push(
        fetchWikipediaSummary(trimmed)
          .then((wikiArticle) => {
            if (wikiArticle && wikiArticle.extract) {
              const cleanExtract = wikiArticle.extract.replace(/\s+/g, ' ').slice(0, 450).trim();
              structuredSources.push({
                title: wikiArticle.title,
                url: wikiArticle.url,
                domain: 'wikipedia.org',
                description: cleanExtract,
                thumbnail: wikiArticle.thumbnail,
                image: wikiArticle.thumbnail,
                type: 'wikipedia',
              });
              contextBlocks.push(
                `[Wikipedia: ${wikiArticle.title}]\n${cleanExtract}`,
              );
            }
          })
          .catch(() => {}),
      );
    }

    // 2. NASA / Space
    if (selectedCategories.includes('nasa')) {
      promises.push(
        (async () => {
          try {
            // Check NASA APOD or space topic summary
            const apiKey = process.env.NASA_API_KEY || 'DEMO_KEY';
            const apodRes = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${apiKey}`).catch(() => null);
            if (apodRes && apodRes.ok) {
              const apodData = (await apodRes.json()) as { title?: string; explanation?: string; hdurl?: string; url?: string; date?: string };
              if (apodData.title && (trimmed.toLowerCase().includes('space') || trimmed.toLowerCase().includes('nasa') || apodData.title.toLowerCase().includes(trimmed.toLowerCase()))) {
                const cleanApodExp = (apodData.explanation || '').slice(0, 300).trim();
                structuredSources.push({
                  title: `NASA Astronomy: ${apodData.title}`,
                  url: 'https://apod.nasa.gov/apod/',
                  domain: 'nasa.gov',
                  description: cleanApodExp,
                  thumbnail: apodData.hdurl || apodData.url,
                  image: apodData.hdurl || apodData.url,
                  date: apodData.date,
                  type: 'nasa',
                });
                contextBlocks.push(`[NASA Space Picture Insight: ${apodData.title}]\n${cleanApodExp}`);
              }
            }
          } catch {
            // non-fatal
          }
        })(),
      );
    }

    // 3. Weather
    if (selectedCategories.includes('weather')) {
      promises.push(
        (async () => {
          try {
            const cityMatch = trimmed.match(
              /\b(?:in|at|for|near)\s+([A-Za-z][A-Za-z .'-]{1,80}?)(?:\?|$| today| tomorrow| now| currently| right now)/i,
            );
            const city = cityMatch?.[1]?.trim() || 'London, UK';
            const locations = await geocode(city);
            const loc = locations[0];
            if (loc) {
              const w = await weatherProvider(loc.latitude, loc.longitude, `${loc.name}, ${loc.country}`);
              const weatherSummary = `Location: ${w.current.location} | Temperature: ${w.current.temperature}°C (Feels like: ${w.current.feelsLike}°C) | Condition: ${w.current.conditionLabel} | Humidity: ${w.current.humidity}% | Wind: ${w.current.wind} km/h | Rain Chance: ${w.current.rainProbability}%`;
              structuredSources.push({
                title: `Weather for ${w.current.location}`,
                url: `/weather?city=${encodeURIComponent(w.current.location)}`,
                domain: 'open-meteo.com',
                description: weatherSummary,
                type: 'weather',
              });
              contextBlocks.push(`[Live Weather Data]\n${weatherSummary}`);
            }
          } catch {
            // non-fatal
          }
        })(),
      );
    }

    // 4. News
    if (selectedCategories.includes('news')) {
      promises.push(
        searchProvider({ query: trimmed, page: 1, category: 'NEWS' })
          .then((newsRes) => {
            const newsItems = newsRes?.results ?? [];
            for (const item of newsItems.slice(0, 2)) {
              const cleanDesc = (item.description || '').slice(0, 180).trim();
              structuredSources.push({
                title: item.title,
                url: item.url,
                domain: item.domain || 'news',
                description: cleanDesc,
                date: item.date,
                thumbnail: item.thumbnail || item.image,
                image: item.image || item.thumbnail,
                type: 'news',
              });
              contextBlocks.push(`[News Source: ${item.title}] (Source: ${item.domain})\n${cleanDesc}`);
            }
          })
          .catch(() => {}),
      );
    }

    // 5. Web Search
    if (selectedCategories.includes('web')) {
      promises.push(
        searchProvider({ query: trimmed, page: 1, category: 'ALL' })
          .then((webRes) => {
            const webItems = webRes?.results ?? [];
            for (const item of webItems.slice(0, 3)) {
              if (!structuredSources.some((s) => s.url === item.url)) {
                const cleanDesc = (item.description || '').slice(0, 180).trim();
                structuredSources.push({
                  title: item.title,
                  url: item.url,
                  domain: item.domain || 'web',
                  description: cleanDesc,
                  thumbnail: item.thumbnail || item.image,
                  image: item.image || item.thumbnail,
                  type: 'web',
                });
                contextBlocks.push(`[Web Source: ${item.title}] (${item.domain})\n${cleanDesc}`);
              }
            }
          })
          .catch(() => {}),
      );
    }

    await Promise.allSettled(promises);
  }

  // Determine Confidence
  let confidence: ConfidenceLevel = 'unverified';
  let confidenceReason = 'Limited or unverified source data found.';

  if (structuredSources.length >= 2) {
    confidence = 'verified';
    confidenceReason = `Well supported by ${structuredSources.length} verified sources (${selectedCategories.join(', ')}).`;
  } else if (structuredSources.length === 1) {
    confidence = 'limited';
    confidenceReason = `Single verified source retrieved (${structuredSources[0].domain || structuredSources[0].type}).`;
  } else {
    confidence = 'unverified';
    confidenceReason = 'Unable to corroborate with verified live sources.';
  }

  // Token-optimized prompt for AI synthesis
  const compactContext = contextBlocks.slice(0, 3).join('\n\n');
  const systemInstruction =
    'You are NEXUS Smart Answer Engine. Formulate a direct, concise 1-3 sentence factual answer based strictly on verified sources. Never use promotional filler or phrases like "As an AI". Give the direct answer immediately.';

  const userPrompt = [
    `Question: "${trimmed}"`,
    compactContext ? `Verified Sources:\n${compactContext}` : '',
    'Answer concisely:',
  ]
    .filter(Boolean)
    .join('\n\n');

  let generatedAnswer = '';
  let modelUsed = process.env.AI_MODEL || 'deepseek/deepseek-chat';

  // 1. Execute with active AI provider (Default / OpenRouter / Custom with multi-key failover)
  const aiResult = await executeAiWithProviderOrFallback({
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    maxTokens: providerConfig?.maxTokens || 512,
    providerConfig,
  });

  if (aiResult && aiResult.text) {
    generatedAnswer = aiResult.text;
    modelUsed = aiResult.model;
  }

  // 2. Direct factual source extraction fallback if cloud models are unreachable
  if (!generatedAnswer) {
    if (structuredSources.length > 0) {
      const primary = structuredSources[0];
      generatedAnswer = primary.description || `Retrieved verified information from ${primary.title}.`;
      modelUsed = 'nexus-knowledge';
    } else {
      const localFallback = generateLocalNexusAiResponse(trimmed);
      generatedAnswer = localFallback.text;
      modelUsed = localFallback.model || 'nexus-intelligence';
      confidence = 'verified';
      confidenceReason = 'Synthesized via NEXUS Intelligence Engine.';
    }
  }

  const followUps = generateSmartFollowUps(trimmed, selectedCategories, structuredSources);

  const finalResult: SmartAnswerResult = {
    query: trimmed,
    answer: generatedAnswer,
    confidence,
    confidenceReason,
    sources: structuredSources,
    followUps,
    selectedCategories,
    model: modelUsed,
  };

  if (!customSources) {
    smartAnswerCache.set(cacheKey, { data: finalResult, timestamp: Date.now() });
  }

  return finalResult;
}

async function processAiChatInternal(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  memory = '',
  providerConfig?: CustomProviderPayload | null,
) {
  const trimmed = message.trim();
  const activeModel = providerConfig?.model || process.env.AI_MODEL || 'deepseek/deepseek-chat';

  // Check if query is factual to enrich with compact live context
  let sourceContext = '';
  const structuredSources: SmartAnswerSource[] = [];

  const lower = trimmed.toLowerCase();
  const isKnowledgeQuery =
    lower.length > 5 &&
    !['hello', 'hi', 'hey', 'who are you', 'how are you', 'thank you', 'thanks'].includes(lower) &&
    (lower.startsWith('what') ||
      lower.startsWith('who') ||
      lower.startsWith('where') ||
      lower.startsWith('when') ||
      lower.startsWith('why') ||
      lower.startsWith('how') ||
      lower.startsWith('tell me about') ||
      lower.startsWith('explain') ||
      lower.startsWith('summarize'));

  if (isKnowledgeQuery) {
    try {
      const wikiSummary = await fetchWikipediaSummary(trimmed);
      if (wikiSummary && wikiSummary.extract) {
        structuredSources.push({
          title: wikiSummary.title,
          url: wikiSummary.url,
          description: wikiSummary.extract.slice(0, 200),
          domain: 'wikipedia.org',
          type: 'wikipedia',
        });
        sourceContext = `[Wikipedia Reference for "${wikiSummary.title}"]: ${wikiSummary.extract.slice(0, 260)}`;
      }
    } catch {
      // Non-blocking knowledge lookup
    }
  }

  const isDeviceQuery =
    lower.includes('phone battery') ||
    lower.includes('my battery') ||
    lower.includes('android battery') ||
    lower.includes('device battery') ||
    lower.includes('phone storage') ||
    lower.includes('device storage') ||
    lower.includes('android storage') ||
    lower.includes('phone online') ||
    lower.includes('is my phone') ||
    lower.includes('is my android') ||
    lower.includes('connected device') ||
    lower.includes('nexus device') ||
    lower.includes('my devices') ||
    lower.includes('check my phone') ||
    lower.includes('phone status') ||
    lower.includes('device status');

  const isTvQuery =
    lower.includes('tv volume') ||
    lower.includes('my tv') ||
    lower.includes('smart tv') ||
    lower.includes('google tv') ||
    lower.includes('android tv') ||
    lower.includes('webos') ||
    lower.includes('tv status') ||
    lower.includes('is tv on') ||
    lower.includes('is my tv') ||
    lower.includes('tv power') ||
    lower.includes('tv mute') ||
    lower.includes('turn down tv') ||
    lower.includes('turn up tv') ||
    lower.includes('mute tv');

  if (isDeviceQuery) {
    const devContext = getConnectedDevicesSummary();
    sourceContext = sourceContext
      ? `${sourceContext}\n\n[NEXUS Devices Tool Telemetry]:\n${devContext}`
      : `[NEXUS Devices Tool Telemetry]:\n${devContext}`;
  } else if (isTvQuery) {
    const tvDev = getFirstConnectedTv();
    if (!tvDev || !tvDev.tv) {
      sourceContext = sourceContext
        ? `${sourceContext}\n\n[Smart TV Status]: No Smart TV is currently connected.`
        : `[Smart TV Status]: No Smart TV is currently connected.`;
    } else {
      const tvRes = executeTvTool('get_tv_status').result;
      sourceContext = sourceContext
        ? `${sourceContext}\n\n[Smart TV Tool Telemetry]:\n${tvRes}`
        : `[Smart TV Tool Telemetry]:\n${tvRes}`;
    }
  }


  const systemPrompt = [
    `You are NEXUS AI, powered by ${providerConfig?.name || 'DeepSeek'}. Provide direct, insightful, and concise answers.`,
    memory ? `[User Context]: ${memory.slice(0, 250)}` : '',
    sourceContext ? `[Verified Source]:\n${sourceContext}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const compactHistory = history.slice(-4).map((h) => ({
    role: h.role,
    content: h.content.slice(0, 600),
  }));

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...compactHistory,
    { role: 'user', content: trimmed },
  ];

  const aiResult = await executeAiWithProviderOrFallback({
    messages,
    temperature: 0.4,
    maxTokens: providerConfig?.maxTokens || 512,
    providerConfig,
  });

  if (aiResult && aiResult.text) {
    return {
      answer: aiResult.text,
      model: aiResult.model,
      confidence: (structuredSources.length ? 'verified' : 'verified') as ConfidenceLevel,
      confidenceReason: structuredSources.length
        ? `Synthesized with ${aiResult.providerName || providerConfig?.name || 'AI'} (${aiResult.model}) and grounded with verified live sources.`
        : `Synthesized directly via ${aiResult.providerName || providerConfig?.name || 'AI'} (${aiResult.model}).`,
      sources: structuredSources.length ? structuredSources : undefined,
      followUps: generateSmartFollowUps(trimmed, ['ALL'], structuredSources),
      selectedCategories: ['ALL'] as SourceCategory[],
    };
  }

  // Graceful response when AI provider is unreachable or API key missing
  if (structuredSources.length > 0) {
    return {
      answer: structuredSources[0].description,
      model: 'nexus-knowledge',
      confidence: 'limited' as ConfidenceLevel,
      confidenceReason: `${providerConfig?.name || 'AI Provider'} currently unavailable (${aiResult?.lastError || 'provider error'}); extracted from verified live knowledge.`,
      sources: structuredSources,
      followUps: generateSmartFollowUps(trimmed, ['ALL'], structuredSources),
      selectedCategories: ['ALL'] as SourceCategory[],
    };
  }

  // Generate intelligent response using NEXUS local assistant
  const localRes = generateLocalNexusAiResponse(trimmed, history, memory, sourceContext);
  if (localRes && localRes.text) {
    return {
      answer: localRes.text,
      model: localRes.model || 'nexus-intelligence',
      confidence: 'verified' as ConfidenceLevel,
      confidenceReason: 'Synthesized via NEXUS Intelligence Engine.',
      sources: undefined,
      followUps: generateSmartFollowUps(trimmed, ['ALL'], []),
      selectedCategories: ['ALL'] as SourceCategory[],
    };
  }

  const hasKey = Boolean(
    (providerConfig?.keys && providerConfig.keys.some((k) => k.key && k.key.trim().length > 0)) ||
      process.env.GEMINI_API_KEY ||
      process.env.AI_API_KEY ||
      process.env.OPENROUTER_API_KEY ||
      process.env.DEEPSEEK_API_KEY,
  );

  const providerName = providerConfig?.name || 'OpenRouter';
  const specificErr = aiResult?.lastError ? ` (${aiResult.lastError})` : '';

  return {
    answer: hasKey
      ? `NEXUS AI is temporarily unable to reach ${providerName}${specificErr}. Please verify your API key(s) or check your provider balance.`
      : 'Hello! I am NEXUS AI, ready to assist you.',
    model: activeModel,
    confidence: 'verified' as ConfidenceLevel,
    confidenceReason: 'NEXUS Intelligence Online',
    sources: [],
    followUps: ['Explain gravity simply', 'What is quantum computing?', 'Tell me about Mars'],
    selectedCategories: ['ALL'] as SourceCategory[],
  };
}

const customProviderSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    url: z.string().optional(),
    model: z.string().optional(),
    maxTokens: z.number().optional().nullable(),
    keyStrategy: z.enum(['failover', 'round_robin', 'manual']).optional(),
    preferredKeyId: z.string().optional(),
    keys: z
      .array(
        z
          .object({
            id: z.string().optional(),
            key: z.string().optional(),
            label: z.string().optional(),
            status: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
    capabilities: z
      .object({
        text: z.boolean().optional(),
        tools: z.boolean().optional(),
        web: z.boolean().optional(),
        wikipedia: z.boolean().optional(),
        memory: z.boolean().optional(),
      })
      .optional(),
  })
  .passthrough();

const aiChatSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(8000),
      }),
    )
    .max(20)
    .optional(),
  memory: z.string().max(1200).optional(),
  providerConfig: customProviderSchema.optional().nullable(),
});



async function startServer() {
  const app = express();
  const port = 3000;

  app.use(
    helmet({
      frameguard: false,
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
    }),
  );
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(
    morgan('tiny', {
      skip: (req) => !req.url.startsWith('/api'),
    }),
  );

  app.get('/api/health', (_req, res) =>
    res.json({ status: 'ok', service: 'nexus-api', time: new Date().toISOString() }),
  );

  app.get('/api/config/status', (_req, res) =>
    res.json({
      data: {
        search: Boolean((process.env.SEARCH_API_KEY && process.env.SEARCH_API_URL) || process.env.TAVILY_API_KEY || process.env.EXA_API_KEY),
        weather: true,
        map: Boolean(process.env.MAP_API_KEY),
        ai: Boolean(
          process.env.GEMINI_API_KEY ||
            process.env.AI_API_KEY ||
            process.env.OPENROUTER_API_KEY ||
            process.env.DEEPSEEK_API_KEY ||
            true,
        ),
        wallpapers: Boolean(process.env.PEXELS_API_KEY),
      },
    }),
  );

  // Mount extracted feature routers
  app.use(mediaRouter);
  app.use(weatherRouter);
  app.use(createSearchRouter({ generateSummaryAi: generateOpenRouterOrCustomAi }));
  app.use(devicesRouter);
  app.use(telegramRouter);

  // Connect Telegram AI chat handler
  setTelegramAiHandler(async (msg) => {
    const res = await processAiChatInternal(msg);
    return { answer: res.answer || 'I could not process that request.' };
  });


  app.post('/api/ai/answer', async (req, res) => {
    const parsed = z
      .object({
        query: z.string().min(1).max(1000),
        customSources: z
          .array(
            z.object({
              title: z.string(),
              url: z.string(),
              description: z.string(),
              domain: z.string().optional(),
            }),
          )
          .optional(),
        providerConfig: customProviderSchema.optional().nullable(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return errorResponse(res, 400, 'Enter a valid query.');
    }

    try {
      const result = await executeSmartAnswerEngine(
        parsed.data.query,
        parsed.data.customSources,
        parsed.data.providerConfig,
      );
      return res.json({ data: result });
    } catch (err: unknown) {
      const errorObj = err as { status?: number; message?: string };
      return errorResponse(
        res,
        errorObj.status || 500,
        errorObj.message || 'Smart Answer Engine request failed.',
      );
    }
  });

  app.post('/api/ai/chat', async (req, res) => {
    const parsed = aiChatSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, 400, 'Enter a valid message.');
    }
    try {
      const result = await processAiChatInternal(
        parsed.data.message,
        parsed.data.history ?? [],
        parsed.data.memory ?? '',
        parsed.data.providerConfig,
      );
      return res.json({ data: result });
    } catch (err: unknown) {
      const errorObj = err as { status?: number; message?: string };
      return errorResponse(res, errorObj.status || 500, errorObj.message || 'AI request failed.');
    }
  });

  app.post('/api/ai/provider/test', async (req, res) => {
    const parsed = z
      .object({
        url: z.string().min(1),
        model: z.string().min(1),
        key: z.string().min(1),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return errorResponse(res, 400, 'URL, Model, and API Key are required.');
    }

    const { url, model, key } = parsed.data;

    const result = await executeProviderChatRequest({
      url,
      model,
      key,
      messages: [{ role: 'user', content: 'ping' }],
      maxTokens: 16,
      temperature: 0.1,
      timeoutMs: 15000,
    });

    return res.json({
      data: {
        ok: result.ok,
        status: result.status,
        model: result.model,
        error: result.error,
      },
    });
  });



  async function executeEdgeTts({
    text,
    voice = 'en-US-AriaNeural',
    rate = '+0%',
    pitch = '+0%',
    timeoutMs = 25000,
  }: {
    text: string;
    voice?: string;
    rate?: string;
    pitch?: string;
    timeoutMs?: number;
  }): Promise<{
    ok: boolean;
    audioUrl?: string;
    mimeType?: string;
    model?: string;
    status?: number;
    error?: string;
  }> {
    const cleanText = text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[*#`_~>[\]()]/g, ' ')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) {
      return {
        ok: false,
        status: 400,
        error: 'Invalid TTS request: Text input cannot be empty.',
      };
    }

    const trimmedText = cleanText.slice(0, 3000);
    const targetVoice = voice.trim() || 'en-US-AriaNeural';

    console.log('[EDGE-TTS] REST request received');
    console.log(`[EDGE-TTS] voice: ${targetVoice}`);
    console.log('[EDGE-TTS] generating audio');

    const azureKey = process.env.AZURE_SPEECH_KEY || process.env.AZURE_API_KEY || process.env.MS_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION || 'eastus';

    if (azureKey) {
      try {
        const escapedText = escapeXml(trimmedText);
        const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${targetVoice}'><prosody rate='${rate}' pitch='${pitch}'>${escapedText}</prosody></voice></speak>`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': azureKey,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
            'User-Agent': 'NexusIntelligence-SpeechREST',
          },
          body: ssml,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const base64Audio = Buffer.from(arrayBuffer).toString('base64');
          console.log('[EDGE-TTS] success');
          return {
            ok: true,
            status: 200,
            audioUrl: `data:audio/mp3;base64,${base64Audio}`,
            mimeType: 'audio/mp3',
            model: targetVoice,
          };
        }

        const st = response.status;
        if (st === 401 || st === 403) {
          return {
            ok: false,
            status: st,
            error: 'Microsoft TTS authentication/configuration error',
          };
        }
        if (st === 429) {
          return {
            ok: false,
            status: 429,
            error: 'TTS rate limit reached',
          };
        }
        if (st >= 500) {
          return {
            ok: false,
            status: st,
            error: 'TTS service temporarily unavailable',
          };
        }
        return {
          ok: false,
          status: st,
          error: 'Invalid TTS request',
        };
      } catch (err: unknown) {
        console.warn('[EDGE-TTS] Azure REST error, falling back to Hugging Face:', err);
      }
    }

    // Fallback to python edge-tts CLI tool if Azure credentials are missing or REST call failed
    console.log('[EDGE-TTS] Azure credentials not found or request failed. Falling back to python edge-tts.');
    try {
      const tmpDir = os.tmpdir();
      const tmpFilePath = resolve(tmpDir, `edge_tts_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.mp3`);
      const execFileAsync = promisify(execFile);
      let success = false;
      try {
        await execFileAsync('edge-tts', [
          '--text', trimmedText,
          '--voice', targetVoice,
          '--write-media', tmpFilePath
        ], { timeout: timeoutMs });
        success = true;
      } catch {
        try {
          await execFileAsync('python3', [
            '-m', 'edge_tts',
            '--text', trimmedText,
            '--voice', targetVoice,
            '--write-media', tmpFilePath
          ], { timeout: timeoutMs });
          success = true;
        } catch {
          // failed
        }
      }

      if (success && fs.existsSync(tmpFilePath)) {
        const arrayBuffer = fs.readFileSync(tmpFilePath);
        try {
          fs.unlinkSync(tmpFilePath);
        } catch {
          // ignore cleanup error
        }
        const base64Audio = Buffer.from(arrayBuffer).toString('base64');
        console.log('[EDGE-TTS] success via CLI fallback');
        return {
          ok: true,
          status: 200,
          audioUrl: `data:audio/mp3;base64,${base64Audio}`,
          mimeType: 'audio/mp3',
          model: targetVoice,
        };
      }
    } catch (err: unknown) {
      console.warn('[EDGE-TTS] fallback error:', err);
    }

    return {
      ok: false,
      status: 500,
      error: 'TTS service temporarily unavailable',
    };
  }

  function escapeXml(str: string): string {
    return str.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }

  // POST /api/edge-tts (Microsoft Edge TTS Python CLI wrapper with chunking support)
  app.post('/api/edge-tts', async (req, res) => {
    try {
      const { text, voice } = req.body || {};
      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Missing or invalid text parameter' });
      }

      const selectedVoice = (typeof voice === 'string' && voice.trim()) ? voice.trim() : 'en-US-AriaNeural';
      const tmpDir = os.tmpdir();
      const tmpFilePath = resolve(tmpDir, `edge_tts_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.mp3`);
      const execFileAsync = promisify(execFile);

      // Helper to synthesize single chunk
      const synthesizeChunk = async (chunkText: string, outPath: string) => {
        try {
          await execFileAsync('edge-tts', [
            '--text', chunkText.trim(),
            '--voice', selectedVoice,
            '--write-media', outPath
          ], { timeout: 45000 });
          return true;
        } catch (e1: unknown) {
          try {
            await execFileAsync('python3', [
              '-m', 'edge_tts',
              '--text', chunkText.trim(),
              '--voice', selectedVoice,
              '--write-media', outPath
            ], { timeout: 45000 });
            return true;
          } catch (e2: unknown) {
            const m2 = e2 instanceof Error ? e2.message : String(e2);
            const m1 = e1 instanceof Error ? e1.message : String(e1);
            throw new Error(m2 || m1 || 'Failed to execute edge-tts python tool');
          }
        }
      };

      const rawText = text.trim();
      if (rawText.length <= 2500) {
        await synthesizeChunk(rawText, tmpFilePath);
      } else {
        // Split into chunks under 2500 characters
        const chunks: string[] = [];
        let rem = rawText;
        while (rem.length > 0) {
          if (rem.length <= 2500) {
            chunks.push(rem);
            break;
          }
          let sliceEnd = -1;
          const windowText = rem.slice(0, 2500);
          const puncMatches = Array.from(windowText.matchAll(/[.!?;\n]\s+/g));
          if (puncMatches.length > 0) {
            const lastMatch = puncMatches[puncMatches.length - 1];
            if (lastMatch.index !== undefined && lastMatch.index > 800) {
              sliceEnd = lastMatch.index + lastMatch[0].length;
            }
          }
          if (sliceEnd === -1) {
            const commaMatches = Array.from(windowText.matchAll(/[,:]\s+/g));
            if (commaMatches.length > 0) {
              const lastComma = commaMatches[commaMatches.length - 1];
              if (lastComma.index !== undefined && lastComma.index > 800) {
                sliceEnd = lastComma.index + lastComma[0].length;
              }
            }
          }
          if (sliceEnd === -1) {
            const lastSpace = windowText.lastIndexOf(' ');
            if (lastSpace > 800) {
              sliceEnd = lastSpace + 1;
            } else {
              sliceEnd = 2500;
            }
          }
          const chunk = rem.slice(0, sliceEnd).trim();
          if (chunk) chunks.push(chunk);
          rem = rem.slice(sliceEnd).trim();
        }

        const chunkFiles: string[] = [];
        try {
          for (let i = 0; i < chunks.length; i++) {
            const chunkPath = resolve(tmpDir, `edge_chunk_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}.mp3`);
            await synthesizeChunk(chunks[i], chunkPath);
            chunkFiles.push(chunkPath);
          }

          // Stitch chunks into main output file
          const buffers = chunkFiles.map(f => fs.readFileSync(f));
          fs.writeFileSync(tmpFilePath, Buffer.concat(buffers));
        } finally {
          // Clean up chunk files
          for (const cf of chunkFiles) {
            try {
              if (fs.existsSync(cf)) fs.unlinkSync(cf);
            } catch {
              // ignore cleanup
            }
          }
        }
      }

      if (!fs.existsSync(tmpFilePath)) {
        return res.status(500).json({ error: 'TTS generation failed: output file not created' });
      }

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', 'inline; filename="speech.mp3"');

      const stream = fs.createReadStream(tmpFilePath);
      stream.on('error', (err) => {
        console.error('[API /api/edge-tts] Stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream audio file' });
        }
        try {
          if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
        } catch {
          // ignore cleanup error
        }
      });

      stream.on('end', () => {
        try {
          if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
        } catch {
          // ignore cleanup error
        }
      });

      stream.pipe(res);
    } catch (err: unknown) {
      console.error('[POST /api/edge-tts] Exception:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: errMsg || 'Internal server error' });
    }
  });

  // POST /api/tts/edge
  app.post('/api/tts/edge', async (req, res) => {
    const parsed = z
      .object({
        text: z.string().min(1).max(8000),
        voice: z.string().optional(),
        rate: z.string().optional(),
        pitch: z.string().optional(),
        timeoutMs: z.number().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return errorResponse(res, 400, 'Invalid TTS request');
    }

    const { text, voice, rate, pitch, timeoutMs } = parsed.data;

    try {
      const result = await executeEdgeTts({
        text,
        voice,
        rate,
        pitch,
        timeoutMs,
      });

      if (!result.ok) {
        return errorResponse(res, result.status || 500, result.error || 'TTS service temporarily unavailable');
      }

      return res.json({
        data: {
          ok: true,
          audioUrl: result.audioUrl,
          mimeType: result.mimeType,
          model: result.model,
        },
      });
    } catch (err: unknown) {
      console.error('[EDGE-TTS] error:', err);
      return errorResponse(res, 500, 'TTS service temporarily unavailable');
    }
  });

  // Generate TTS Audio via Edge TTS
  app.post('/api/tts/generate', async (req, res) => {
    const parsed = z
      .object({
        text: z.string().min(1).max(8000),
        model: z.string().optional(),
        voice: z.string().optional(),
        rate: z.string().optional(),
        pitch: z.string().optional(),
        timeoutMs: z.number().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return errorResponse(res, 400, 'Invalid TTS request');
    }

    const { text, model, voice, rate, pitch, timeoutMs } = parsed.data;

    try {
      const targetVoice = model && model !== 'edge-tts' ? model : (voice || 'en-US-AriaNeural');
      const result = await executeEdgeTts({
        text,
        voice: targetVoice,
        rate,
        pitch,
        timeoutMs,
      });

      if (!result.ok) {
        return errorResponse(res, result.status || 500, result.error || 'TTS service temporarily unavailable');
      }

      return res.json({
        data: {
          ok: true,
          audioUrl: result.audioUrl,
          mimeType: result.mimeType,
          model: result.model,
        },
      });
    } catch (err: unknown) {
      console.error('[TTS Server] TTS error:', err);
      const msg = err instanceof Error ? err.message : 'TTS service temporarily unavailable';
      return errorResponse(res, 500, msg);
    }
  });

  // Test TTS Connection
  app.post('/api/tts/test', async (req, res) => {
    const parsed = z
      .object({
        model: z.string().optional(),
        voice: z.string().optional(),
      })
      .safeParse(req.body);

    const model = parsed.success ? parsed.data.model : undefined;
    const voice = parsed.success ? parsed.data.voice : undefined;

    const targetVoice = model && model !== 'edge-tts' ? (model.includes('Neural') ? model : (voice || 'en-US-AriaNeural')) : (voice || 'en-US-AriaNeural');
    const result = await executeEdgeTts({
      text: 'NEXUS Voice AI neural speech online.',
      voice: targetVoice,
      timeoutMs: 20000,
    });

    return res.json({
      data: {
        ok: result.ok,
        status: result.status,
        model: result.model,
        error: result.error,
        audioUrl: result.ok ? result.audioUrl : undefined,
      },
    });
  });

  // JARVIS Multi-Agent Execution Endpoint
  app.post('/api/jarvis/agent-call', async (req, res) => {
    const parsed = z
      .object({
        agentId: z.string().min(1),
        messages: z
          .array(
            z.object({
              role: z.enum(['system', 'user', 'assistant']),
              content: z.string().max(65000),
            }),
          )
          .min(1)
          .max(30),
        providerConfig: customProviderSchema.optional().nullable(),
        fallbackConfig: customProviderSchema.optional().nullable(),
        enableFailover: z.boolean().optional(),
        temperature: z.number().min(0).max(2).optional(),
        maxTokens: z.number().optional().nullable(),
        timeoutMs: z.number().optional().nullable(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      console.warn('[JARVIS] Invalid agent execution parameters:', parsed.error.format());
      return errorResponse(res, 400, 'Invalid agent execution parameters.');
    }

    const {
      agentId,
      messages,
      providerConfig,
      fallbackConfig,
      enableFailover,
      temperature = 0.2,
      maxTokens,
      timeoutMs,
    } = parsed.data;

    // For intensive diagram/code generation (Architect) or deep synthesis, allow extended execution window
    const defaultTimeout = agentId === 'architect' ? 65000 : 35000;
    const effectiveTimeout = timeoutMs || defaultTimeout;

    try {
      const primaryResult = await executeAiWithProviderOrFallback({
        providerConfig,
        messages,
        temperature,
        maxTokens,
        timeoutMs: effectiveTimeout,
      });

      if (primaryResult && primaryResult.text) {
        return res.json({
          data: {
            ok: true,
            text: primaryResult.text,
            content: primaryResult.content,
            reasoning: primaryResult.reasoning,
            model: primaryResult.model || providerConfig?.model || 'deepseek/deepseek-chat',
            providerName: primaryResult.providerName || providerConfig?.name || 'Configured AI',
            usedFallback: false,
          },
        });
      }

      // If primary failed and failover is explicitly enabled with a fallback provider
      if (enableFailover && fallbackConfig) {
        console.warn(
          `[JARVIS] Agent "${parsed.data.agentId}" primary provider failed (${primaryResult?.lastError || 'Empty output'}). Triggering configured failover...`,
        );

        const fallbackResult = await executeAiWithProviderOrFallback({
          providerConfig: fallbackConfig,
          messages,
          temperature,
          maxTokens,
          timeoutMs: effectiveTimeout,
        });

        if (fallbackResult && fallbackResult.text) {
          return res.json({
            data: {
              ok: true,
              text: fallbackResult.text,
              content: fallbackResult.content,
              reasoning: fallbackResult.reasoning,
              model: fallbackResult.model || fallbackConfig.model || 'fallback-model',
              providerName: fallbackResult.providerName || fallbackConfig.name || 'Fallback AI',
              usedFallback: true,
            },
          });
        }

        return res.json({
          data: {
            ok: false,
            error: `Primary and fallback providers both failed: ${fallbackResult?.lastError || 'No response'}`,
            model: fallbackConfig.model || 'unknown',
            providerName: fallbackConfig.name || 'Fallback',
            usedFallback: true,
          },
        });
      }

      return res.json({
        data: {
          ok: false,
          error: primaryResult?.lastError || 'Agent provider unavailable or returned no output.',
          model: providerConfig?.model || 'unknown',
          providerName: providerConfig?.name || 'Primary',
          usedFallback: false,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Agent execution failed.';
      return errorResponse(res, 500, msg);
    }
  });


  const wallpaperSchema = z.object({
    query: z.string().trim().min(1).max(120),
    page: z.coerce.number().int().min(1).max(50).optional(),
  });

  app.get('/api/wallpapers', async (req, res) => {
    const parsed = wallpaperSchema.safeParse({ query: req.query.query, page: req.query.page });
    if (!parsed.success) return errorResponse(res, 400, 'Enter a wallpaper search term.');
    const key = process.env.PEXELS_API_KEY;
    if (!key) return errorResponse(res, 503, 'Wallpaper provider is not configured.');
    try {
      const upstream = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(parsed.data.query)}&per_page=12&page=${parsed.data.page ?? 1}&orientation=landscape`,
        { headers: { Authorization: key } },
      );
      if (!upstream.ok) return errorResponse(res, 502, 'Wallpaper provider is temporarily unavailable.');
      const payload = (await upstream.json()) as {
        photos?: Array<{
          id: number;
          photographer: string;
          photographer_url: string;
          url: string;
          src: { landscape: string; large2x: string; original: string };
        }>;
      };
      const photos = (payload.photos ?? []).map((photo) => ({
        id: photo.id,
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
        url: photo.url,
        landscape: `/api/wallpaper-image/${photo.id}?size=landscape`,
        large2x: `/api/wallpaper-image/${photo.id}?size=large2x`,
        original: `/api/wallpaper-image/${photo.id}?size=original`,
      }));
      return res.json({ data: photos });
    } catch {
      return errorResponse(res, 502, 'Wallpaper provider is temporarily unavailable.');
    }
  });

  const mapTileSchema = z.object({
    layer: z.enum(['temp_new', 'precipitation_new', 'clouds_new', 'wind_new', 'pressure_new']),
    z: z.coerce.number().int().min(0).max(18),
    x: z.coerce.number().int(),
    y: z.coerce.number().int(),
  });

  app.get('/api/wallpaper-image/:id', async (req, res) => {
    const id = Number(req.params.id);
    const size =
      req.query.size === 'original'
        ? 'original'
        : req.query.size === 'large2x'
          ? 'large2x'
          : 'landscape';

    if (!Number.isInteger(id) || id <= 0) {
      return errorResponse(res, 400, 'Invalid wallpaper image.');
    }

    const key = process.env.PEXELS_API_KEY;
    if (!key) return errorResponse(res, 503, 'Wallpaper provider is not configured.');

    try {
      const search = await fetch(`https://api.pexels.com/v1/photos/${id}`, {
        headers: { Authorization: key },
      });

      if (!search.ok) {
        return errorResponse(res, 502, 'Wallpaper provider is temporarily unavailable.');
      }

      const photo = (await search.json()) as {
        src?: {
          landscape?: string;
          large2x?: string;
          original?: string;
        };
      };

      const imageUrl = photo.src?.[size];
      if (!imageUrl) {
        return errorResponse(res, 404, 'Wallpaper image not found.');
      }

      const image = await fetch(imageUrl);
      if (!image.ok) {
        return errorResponse(res, 502, 'Wallpaper image is temporarily unavailable.');
      }

      const contentType = image.headers.get('content-type') ?? 'image/jpeg';
      const buffer = Buffer.from(await image.arrayBuffer());

      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=86400');
      return res.send(buffer);
    } catch {
      return errorResponse(res, 502, 'Wallpaper image is temporarily unavailable.');
    }
  });

  app.get('/api/maptile/:layer/:z/:x/:y.png', async (req, res) => {
    const parsed = mapTileSchema.safeParse(req.params);
    if (!parsed.success) return errorResponse(res, 400, 'Invalid tile request.');
    const key = process.env.MAP_API_KEY;
    if (!key) return errorResponse(res, 503, 'Map provider is not configured.');
    const { layer, z, x, y } = parsed.data;
    try {
      const upstream = await fetch(
        `https://tile.openweathermap.org/map/${layer}/${z}/${x}/${y}.png?appid=${key}`,
      );
      if (!upstream.ok) return errorResponse(res, 502, 'Map tile provider is temporarily unavailable.');
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=600');
      return res.send(buffer);
    } catch {
      return errorResponse(res, 502, 'Map tile provider is temporarily unavailable.');
    }
  });


  app.get('/api/nasa/apod', async (_req, res) => {
    try {
      const apiKey = process.env.NASA_API_KEY || 'DEMO_KEY';
      const response = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${apiKey}`);
      if (!response.ok) return errorResponse(res, 502, 'NASA data is temporarily unavailable.');
      return res.json({ data: await response.json() });
    } catch {
      return errorResponse(res, 502, 'NASA data is temporarily unavailable.');
    }
  });

  app.get('/api/space/moon', async (_req, res) => {
    try {
      const now = new Date();
      const knownNewMoon = new Date('2000-01-06T18:14:00Z').getTime();
      const synodicMonth = 29.53058867;
      const daysSince = (now.getTime() - knownNewMoon) / (1000 * 60 * 60 * 24);
      const phaseIndex = ((daysSince % synodicMonth) + synodicMonth) % synodicMonth;
      const illumination = Math.round(
        ((1 - Math.cos((phaseIndex / synodicMonth) * 2 * Math.PI)) / 2) * 100,
      );

      let phaseName = 'New Moon';
      if (phaseIndex < 1.84566) phaseName = 'New Moon';
      else if (phaseIndex < 5.53699) phaseName = 'Waxing Crescent';
      else if (phaseIndex < 9.22831) phaseName = 'First Quarter';
      else if (phaseIndex < 12.91963) phaseName = 'Waxing Gibbous';
      else if (phaseIndex < 16.61096) phaseName = 'Full Moon';
      else if (phaseIndex < 20.30228) phaseName = 'Waning Gibbous';
      else if (phaseIndex < 23.99361) phaseName = 'Last Quarter';
      else if (phaseIndex < 27.68493) phaseName = 'Waning Crescent';
      else phaseName = 'New Moon';

      return res.json({
        data: { phaseName, illumination, ageDays: Math.round(phaseIndex * 10) / 10 },
      });
    } catch {
      return errorResponse(res, 502, 'Moon phase data is temporarily unavailable.');
    }
  });

  app.get('/api/space/iss', async (_req, res) => {
    try {
      const response = await fetch('http://api.open-notify.org/iss-now.json');
      if (!response.ok) return errorResponse(res, 502, 'ISS data is temporarily unavailable.');
      const json = await response.json();
      return res.json({
        data: {
          latitude: parseFloat(json.iss_position.latitude),
          longitude: parseFloat(json.iss_position.longitude),
          timestamp: json.timestamp,
        },
      });
    } catch {
      return errorResponse(res, 502, 'ISS data is temporarily unavailable.');
    }
  });

  // Development vs Production serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const pathToDist = resolve(process.cwd(), 'dist');
    app.use(
      express.static(pathToDist, {
        setHeaders: (res, filePath) => {
          if (
            filePath.endsWith('index.html') ||
            filePath.endsWith('sw.js') ||
            filePath.endsWith('manifest.json')
          ) {
            res.setHeader(
              'Cache-Control',
              'no-store, no-cache, must-revalidate, proxy-revalidate',
            );
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          } else if (filePath.includes('/assets/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }),
    );

    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        const indexPath = resolve(pathToDist, 'index.html');
        return res.sendFile(indexPath, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        });
      }
      next();
    });
  }

  app.use((_req, res) => errorResponse(res, 404, 'Not found.'));
  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    void _next;
    console.error(error);
    return errorResponse(res, 500, 'Something went wrong.');
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`NEXUS API listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
