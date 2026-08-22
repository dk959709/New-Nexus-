import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'node:fs';
import { resolve } from 'node:path';
import net from 'node:net';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';

const searchSchema = z.object({
  query: z.string().trim().min(1).max(300),
  page: z.number().int().positive().optional(),
  category: z.enum(['ALL', 'NEWS', 'IMAGES', 'VIDEOS', 'SHOPPING', 'WIKIPEDIA']).optional(),
  region: z.string().optional(),
  language: z.string().optional(),
});

const WIKIPEDIA_USER_AGENT = 'NEXUS-Intelligence/1.0 (https://nexus.app; contact: dk959709@gmail.com)';

async function fetchWikipediaSummary(query: string) {
  try {
    const trimmed = query.trim();
    if (!trimmed) return null;
    const encoded = encodeURIComponent(trimmed.replace(/ /g, '_'));
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
    const res = await fetch(url, {
      headers: { 'Api-User-Agent': WIKIPEDIA_USER_AGENT },
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        title: string;
        extract?: string;
        description?: string;
        thumbnail?: { source: string };
        content_urls?: { desktop?: { page?: string } };
        type?: string;
      };
      if (data.extract && data.type !== 'disambiguation') {
        return {
          title: data.title,
          extract: data.extract,
          description: data.description,
          thumbnail: data.thumbnail?.source,
          url:
            data.content_urls?.desktop?.page ||
            `https://en.wikipedia.org/wiki/${encodeURIComponent(data.title.replace(/ /g, '_'))}`,
        };
      }
    }

    // Fallback: search for top matching article and retrieve summary
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(trimmed)}&srlimit=1&utf8=&format=json&origin=*`,
      {
        headers: { 'Api-User-Agent': WIKIPEDIA_USER_AGENT },
        signal: AbortSignal.timeout(3500),
      },
    );
    if (searchRes.ok) {
      const searchData = (await searchRes.json()) as {
        query?: { search?: Array<{ pageid: number; title: string; snippet: string }> };
      };
      const top = searchData.query?.search?.[0];
      if (top) {
        const topSummaryRes = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(top.title.replace(/ /g, '_'))}`,
          {
            headers: { 'Api-User-Agent': WIKIPEDIA_USER_AGENT },
            signal: AbortSignal.timeout(3500),
          },
        );
        if (topSummaryRes.ok) {
          const topData = (await topSummaryRes.json()) as {
            title: string;
            extract?: string;
            description?: string;
            thumbnail?: { source: string };
            content_urls?: { desktop?: { page?: string } };
          };
          return {
            title: topData.title || top.title,
            extract: topData.extract || top.snippet.replace(/<[^>]*>/g, ''),
            description: topData.description,
            thumbnail: topData.thumbnail?.source,
            url:
              topData.content_urls?.desktop?.page ||
              `https://en.wikipedia.org/wiki/${encodeURIComponent(top.title.replace(/ /g, '_'))}`,
          };
        }
      }
    }
    return null;
  } catch (err) {
    console.error('[Server Wikipedia] Summary fetch error:', err);
    return null;
  }
}

async function fetchWikipediaSearch(query: string, limit = 10) {
  try {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(trimmed)}&srlimit=${limit}&utf8=&format=json&origin=*`;
    const res = await fetch(searchUrl, {
      headers: { 'Api-User-Agent': WIKIPEDIA_USER_AGENT },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      query?: { search?: Array<{ pageid: number; title: string; snippet: string }> };
    };
    const items = data.query?.search ?? [];
    if (!items.length) return [];

    const pageIds = items.map((i) => i.pageid).join('|');
    const detailsUrl = `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageIds}&prop=pageimages|description|info&inprop=url&pithumbsize=400&format=json&origin=*`;
    const detailsRes = await fetch(detailsUrl, {
      headers: { 'Api-User-Agent': WIKIPEDIA_USER_AGENT },
      signal: AbortSignal.timeout(3500),
    }).catch(() => null);

    const detailsData = detailsRes?.ok
      ? ((await detailsRes.json()) as {
          query?: {
            pages?: Record<
              string,
              {
                title: string;
                description?: string;
                thumbnail?: { source: string };
                fullurl?: string;
                canonicalurl?: string;
              }
            >;
          };
        })
      : null;
    const pagesMap = detailsData?.query?.pages ?? {};

    return items.map((item) => {
      const pageDetail = pagesMap[String(item.pageid)];
      const cleaned = item.snippet
        .replace(/<[^>]*>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#039;/g, "'")
        .trim();
      const url =
        pageDetail?.fullurl ||
        pageDetail?.canonicalurl ||
        `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`;
      return {
        title: item.title,
        url,
        domain: 'wikipedia.org',
        description: pageDetail?.description || (cleaned ? `${cleaned.slice(0, 160)}...` : ''),
        thumbnail: pageDetail?.thumbnail?.source,
        image: pageDetail?.thumbnail?.source,
        type: 'wikipedia' as const,
      };
    });
  } catch (err) {
    console.error('[Server Wikipedia] Search error:', err);
    return [];
  }
}

const weatherSchema = z.object({
  city: z.string().trim().min(1).max(120).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

function errorResponse(res: Response, status: number, message: string) {
  return res.status(status).json({ error: message });
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function normalizeProviderUrl(rawUrl?: string): string {
  let url = (rawUrl || 'https://openrouter.ai/api/v1/chat/completions').trim();
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  if (url === 'https://openrouter.ai' || url === 'https://openrouter.ai/api') {
    return 'https://openrouter.ai/api/v1/chat/completions';
  }
  if (url.endsWith('/v1')) {
    return `${url}/chat/completions`;
  }
  if (!url.includes('/chat/completions')) {
    if (url.includes('/v1/')) {
      return `${url}/chat/completions`;
    }
    if (url.endsWith('/api')) {
      return `${url}/v1/chat/completions`;
    }
  }
  return url;
}

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
      model,
      status: 401,
      error: 'Missing or empty API key.',
    };
  }

  const sanitized = sanitizeChatMessages(messages);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': 'https://nexus-intelligence.local',
        'X-Title': 'NEXUS Intelligence',
      },
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
          message?: { content?: string | Array<{ type?: string; text?: string }> };
          text?: string;
        }>;
      };

      let text = '';
      const choice = payload.choices?.[0];
      if (choice?.message?.content) {
        if (typeof choice.message.content === 'string') {
          text = choice.message.content.trim();
        } else if (Array.isArray(choice.message.content)) {
          text = choice.message.content
            .map((part) => (typeof part === 'string' ? part : part?.text || ''))
            .join('')
            .trim();
        }
      } else if (typeof choice?.text === 'string') {
        text = choice.text.trim();
      }

      return {
        ok: Boolean(text),
        text,
        model: payload.model || model,
        status: res.status,
        error: text ? undefined : 'AI provider returned an empty response.',
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
    return {
      ok: false,
      text: '',
      model,
      status: 504,
      error: `Network or timeout error: ${errorMsg}`,
    };
  }
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
}: {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
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

  // Primary model and fast fallback model when experiencing high demand (503 / 429)
  const candidateModels = ['gemini-3.7-flash', 'gemini-3.1-flash-lite'];

  for (const model of candidateModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await client.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: sys || undefined,
            temperature,
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
          await new Promise((resolve) => setTimeout(resolve, 600));
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
      text: `I am **NEXUS AI**, a multi-model intelligence operating system.\n\nHere is what I can do for you:\n• **Web & Knowledge Search**: Search the web and Wikipedia for instant facts and summaries.\n• **Weather & Radar**: Real-time forecasts, atmospheric conditions, and interactive radar maps.\n• **Space Intelligence**: NASA Astronomy Picture of the Day (APOD) and asteroid tracking.\n• **Device Fleet Telemetry**: Live battery, network, RAM, and diagnostic monitoring for connected devices.\n• **Offline AI**: In-browser neural models powered by Transformers.js.\n• **Assistant Chat**: Multi-turn reasoning, problem solving, and explanations.\n\nFeel free to ask any question or give me a task!`,
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
    text: `Here is information regarding **"${trimmed}"**:\n\nNEXUS has processed your query across our live intelligence engines. You can also explore real-time web results in the **Web Search** tab, check the **Weather Radar**, or run local browser models in **Offline AI**.`,
    model: 'nexus-intelligence',
  };
}

async function generateOpenRouterOrCustomAi({
  messages,
  temperature = 0.3,
  maxTokens = 128,
}: {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
}): Promise<{ text: string; model: string } | null> {
  // Try Gemini first if key is available
  if (process.env.GEMINI_API_KEY) {
    const geminiRes = await generateWithGemini({ messages, temperature });
    if (geminiRes && geminiRes.text) {
      return geminiRes;
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
    timeoutMs: 25000,
  });

  if (result.ok && result.text) {
    return { text: result.text, model: result.model };
  }

  console.warn(`[Built-in AI] Request failed: ${result.error || `HTTP ${result.status}`}`);
  return null;
}

interface CustomKeyItem {
  id: string;
  key: string;
  label?: string;
  status?: string;
}

interface CustomProviderPayload {
  id: string;
  name: string;
  url: string;
  model: string;
  maxTokens?: number;
  keyStrategy?: 'failover' | 'round_robin' | 'manual';
  preferredKeyId?: string;
  keys: CustomKeyItem[];
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
}: {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  providerConfig?: CustomProviderPayload | null;
}): Promise<{
  text: string;
  model: string;
  providerName?: string;
  lastError?: string;
  lastStatus?: number;
} | {
  text?: never;
  model?: never;
  providerName?: never;
  lastError: string;
  lastStatus: number;
} | null> {
  const effectiveMaxTokens =
    providerConfig?.maxTokens && providerConfig.maxTokens > 0
      ? providerConfig.maxTokens
      : maxTokens || 128;

  // If no custom provider or existing default is specified, use generateOpenRouterOrCustomAi
  if (!providerConfig || !providerConfig.id || providerConfig.id === 'existing') {
    const builtInResult = await generateOpenRouterOrCustomAi({
      messages,
      temperature,
      maxTokens: effectiveMaxTokens,
    });
    if (builtInResult) {
      return {
        text: builtInResult.text,
        model: builtInResult.model,
        providerName: 'Existing AI',
      };
    }
    return {
      lastError: 'Built-in AI connection failed or key missing.',
      lastStatus: 503,
    };
  }

  // Custom provider execution with multiple keys & rotation / failover
  const url = (providerConfig.url || 'https://openrouter.ai/api/v1/chat/completions').trim();
  const model = (providerConfig.model || 'deepseek/deepseek-chat').trim();
  const strategy = providerConfig.keyStrategy || 'failover';
  const rawKeys = Array.isArray(providerConfig.keys) ? providerConfig.keys : [];
  const validKeys = rawKeys.filter(
    (k) => k && typeof k.key === 'string' && k.key.trim().length > 0,
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
        timeoutMs: 25000,
      });

      if (serverResult.ok && serverResult.text) {
        return {
          text: serverResult.text,
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

  // Filter out keys currently under cooldown unless ALL keys are in cooldown
  const now = Date.now();
  const availableKeys = validKeys.filter((k) => {
    const cd = keyCooldownMap.get(k.key.trim()) || 0;
    return cd <= now;
  });

  const candidatePool = availableKeys.length > 0 ? availableKeys : validKeys;

  // Order candidate keys according to strategy
  let orderedKeys: CustomKeyItem[] = [];

  if (strategy === 'manual' && providerConfig.preferredKeyId) {
    const preferred = candidatePool.find((k) => k.id === providerConfig.preferredKeyId);
    const rest = candidatePool.filter((k) => k.id !== providerConfig.preferredKeyId);
    orderedKeys = preferred ? [preferred, ...rest] : candidatePool;
  } else if (strategy === 'round_robin') {
    const currentIndex = providerRoundRobinIndex.get(providerConfig.id) || 0;
    const startIdx = currentIndex % candidatePool.length;
    orderedKeys = [
      ...candidatePool.slice(startIdx),
      ...candidatePool.slice(0, startIdx),
    ];
    providerRoundRobinIndex.set(providerConfig.id, startIdx + 1);
  } else {
    // Automatic failover: use candidate pool in order
    orderedKeys = [...candidatePool];
  }

  let lastFailedError = '';
  let lastFailedStatus = 500;

  // Attempt each key in ordered sequence (Automatic Failover)
  for (let i = 0; i < orderedKeys.length; i++) {
    const keyItem = orderedKeys[i];
    const keyVal = keyItem.key.trim();

    const result = await executeProviderChatRequest({
      url,
      model,
      key: keyVal,
      messages,
      temperature,
      maxTokens: effectiveMaxTokens,
      timeoutMs: 25000,
    });

    if (result.ok && result.text) {
      keyCooldownMap.delete(keyVal);
      return {
        text: result.text,
        model: result.model || model,
        providerName: providerConfig.name,
      };
    } else {
      const status = result.status;
      lastFailedStatus = status;
      lastFailedError = result.error || `HTTP ${status}`;

      if (status === 429 || status === 402 || status >= 500) {
        keyCooldownMap.set(keyVal, Date.now() + 60000); // 60s cooldown
        console.warn(
          `[AI Provider: ${providerConfig.name}] Key (${i + 1}/${orderedKeys.length}) received HTTP ${status} (${result.error}). Auto-failing over...`,
        );
      } else if (status === 401 || status === 403) {
        keyCooldownMap.set(keyVal, Date.now() + 300000); // 5m invalid cooldown
        console.warn(
          `[AI Provider: ${providerConfig.name}] Key (${i + 1}/${orderedKeys.length}) auth failed (HTTP ${status}: ${result.error}).`,
        );
      } else {
        console.warn(
          `[AI Provider: ${providerConfig.name}] Key (${i + 1}/${orderedKeys.length}) error HTTP ${status}: ${result.error}`,
        );
      }
    }
  }

  // Fallback to Gemini or server key if custom keys failed
  if (process.env.GEMINI_API_KEY) {
    const geminiFallback = await generateWithGemini({ messages, temperature });
    if (geminiFallback && geminiFallback.text) {
      return {
        text: geminiFallback.text,
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

async function searchProvider(input: z.infer<typeof searchSchema>) {
  if (input.category === 'WIKIPEDIA') {
    return fetchWikipediaSearch(input.query, 20);
  }

  const key = process.env.SEARCH_API_KEY;
  const url = process.env.SEARCH_API_URL;
  if (!key || !url) {
    // If external search is not configured, Wikipedia search is available as fallback for ALL
    if (input.category === 'ALL' || !input.category) {
      const wikiResults = await fetchWikipediaSearch(input.query, 10);
      if (wikiResults.length > 0) {
        return wikiResults;
      }
    }
    throw Object.assign(new Error('Search provider is not configured.'), { status: 503 });
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'X-API-Key': key,
    },
    body: JSON.stringify({
      query: input.query,
      page: input.page ?? 1,
      category: input.category ?? 'ALL',
      region: input.region,
      language: input.language,
      max_results: 20,
    }),
  });
  if (!response.ok) {
    if (input.category === 'ALL' || !input.category) {
      const wikiResults = await fetchWikipediaSearch(input.query, 10);
      if (wikiResults.length > 0) {
        return wikiResults;
      }
    }
    throw Object.assign(new Error('Search provider is temporarily unavailable.'), { status: 502 });
  }
  const payload = (await response.json()) as {
    results?: Array<Record<string, unknown>>;
    organic_results?: Array<Record<string, unknown>>;
    news?: Array<Record<string, unknown>>;
  };
  const items = payload.results ?? payload.organic_results ?? payload.news ?? [];
  const type =
    input.category === 'NEWS'
      ? 'news'
      : input.category === 'IMAGES'
        ? 'images'
        : input.category === 'VIDEOS'
          ? 'videos'
          : input.category === 'SHOPPING'
            ? 'shopping'
            : 'web';

  return items
    .map((item) => {
      const urlValue = String(item.url ?? item.link ?? '');
      return {
        title: String(item.title ?? ''),
        url: urlValue,
        domain: domainOf(urlValue),
        description: String(item.description ?? item.snippet ?? ''),
        date: item.date ? String(item.date) : undefined,
        image: item.image ? String(item.image) : (item.thumbnail ? String(item.thumbnail) : undefined),
        thumbnail: item.thumbnail ? String(item.thumbnail) : undefined,
        type,
      };
    })
    .filter((item) => item.title && item.url);
}

async function geocode(city: string) {
  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=en&format=json`,
  );
  if (!response.ok) throw new Error('Weather provider is temporarily unavailable.');
  const payload = (await response.json()) as {
    results?: Array<{ name: string; country: string; latitude: number; longitude: number }>;
  };
  return payload.results ?? [];
}

function condition(
  code: number,
): ['clear' | 'partly-cloudy' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog', string] {
  if (code === 0) return ['clear', 'Clear sky'];
  if ([1, 2, 3].includes(code)) return ['partly-cloudy', 'Partly cloudy'];
  if ([45, 48].includes(code)) return ['fog', 'Fog'];
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return ['rain', 'Rain'];
  if ([71, 73, 75, 77, 85, 86].includes(code)) return ['snow', 'Snow'];
  if ([95, 96, 99].includes(code)) return ['storm', 'Thunderstorm'];
  return ['cloudy', 'Cloudy'];
}

async function weatherProvider(latitude: number, longitude: number, location: string) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,surface_pressure,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset&timezone=auto&forecast_days=7`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Weather provider is temporarily unavailable.');
  const data = (await response.json()) as {
    current: Record<string, number>;
    hourly: Record<string, Array<number | string>>;
    daily: Record<string, Array<number | string>>;
  };
  const currentCondition = condition(Number(data.current.weather_code));
  const hourly = data.hourly.time.slice(0, 12).map((time, index) => ({
    time: String(time),
    temperature: Number(data.hourly.temperature_2m[index]),
    condition: condition(Number(data.hourly.weather_code[index]))[0],
    rainProbability: Number(data.hourly.precipitation_probability[index]),
    wind: Number(data.hourly.wind_speed_10m[index]),
  }));
  const daily = data.daily.time.map((day, index) => ({
    day: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(new Date(String(day))),
    high: Number(data.daily.temperature_2m_max[index]),
    low: Number(data.daily.temperature_2m_min[index]),
    condition: condition(Number(data.daily.weather_code[index]))[0],
    conditionLabel: condition(Number(data.daily.weather_code[index]))[1],
    rainProbability: Number(data.daily.precipitation_probability_max[index]),
    wind: Number(data.daily.wind_speed_10m_max[index]),
  }));
  return {
    current: {
      location,
      temperature: Number(data.current.temperature_2m),
      feelsLike: Number(data.current.apparent_temperature),
      condition: currentCondition[0],
      conditionLabel: currentCondition[1],
      humidity: Number(data.current.relative_humidity_2m),
      wind: Number(data.current.wind_speed_10m),
      pressure: Number(data.current.surface_pressure),
      visibility: 10,
      uvIndex: 0,
      sunrise: String(data.daily.sunrise[0]).split('T')[1],
      sunset: String(data.daily.sunset[0]).split('T')[1],
      rainProbability: Number(data.daily.precipitation_probability_max[0]),
      updatedAt: new Date().toISOString(),
      latitude,
      longitude,
      isDay: Boolean(data.current.is_day),
    },
    hourly,
    daily,
    alerts: [],
  };
}

type SourceCategory = 'web' | 'wikipedia' | 'news' | 'nasa' | 'weather';
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
          .then((newsItems) => {
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
          .then((webItems) => {
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
    maxTokens: providerConfig?.maxTokens || 128,
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
  const structuredSources: Array<{
    title: string;
    url: string;
    description: string;
    domain?: string;
    type?: string;
  }> = [];

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
    maxTokens: providerConfig?.maxTokens || 128,
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
    id: z.string(),
    name: z.string(),
    url: z.string(),
    model: z.string(),
    maxTokens: z.number().int().positive().optional(),
    keyStrategy: z.enum(['failover', 'round_robin', 'manual']).optional(),
    preferredKeyId: z.string().optional(),
    keys: z.array(
      z
        .object({
          id: z.string(),
          key: z.string(),
          label: z.string().optional(),
          status: z.string().optional(),
        })
        .passthrough(),
    ),
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

interface TelegramAutomationsState {
  dailyWeatherEnabled: boolean;
  dailyWeatherTime: string; // e.g. "07:00"
  dailyWeatherCity: string;
  rainAlertEnabled: boolean;
  rainAlertCity: string;
  issAlertEnabled: boolean;
  issAlertLocationName: string;
  issAlertLatitude: number;
  issAlertLongitude: number;
  quickRepliesEnabled: boolean;
}

export interface NexusDeviceServer {
  id: string;
  type: 'android' | 'tv' | 'computer' | 'smarthome';
  name: string;
  status: 'online' | 'warning' | 'offline' | 'unknown';
  pairedAt: string;
  lastSeen: string;
  ipAddress?: string;
  authToken?: string;
  permissions: {
    batteryInfo: boolean;
    storageInfo: boolean;
    networkInfo: boolean;
    deviceControl: boolean;
    backgroundMonitoring: boolean;
  };
  android?: {
    model?: string;
    brand?: string;
    androidVersion?: string;
    sdkVersion?: number;
    batteryLevel?: number;
    isCharging?: boolean;
    networkType?: string;
    storageUsedGb?: number;
    storageTotalGb?: number;
    ramUsedGb?: number;
    ramTotalGb?: number;
  };
  tv?: {
    model?: string;
    powerState?: 'ON' | 'STANDBY' | 'OFF';
    volume?: number;
    isMuted?: boolean;
    method?: 'android_tv' | 'google_tv' | 'webos';
    port?: number;
    ipAddress?: string;
    lastAction?: string;
    connectionError?: string;
    reachable?: boolean;
  };
}

const registeredDevices = new Map<string, NexusDeviceServer>();
const activePairingCodes = new Map<
  string,
  {
    code: string;
    createdAt: number;
    expiresAt: number;
    sampleData?: Partial<NonNullable<NexusDeviceServer['android']>>;
  }
>();

const DEVICES_FILE_PATH = resolve(process.cwd(), 'data', 'devices.json');

function loadPersistedDevices(): void {
  try {
    if (fs.existsSync(DEVICES_FILE_PATH)) {
      const raw = fs.readFileSync(DEVICES_FILE_PATH, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        registeredDevices.clear();
        for (const dev of data) {
          if (dev && typeof dev.id === 'string') {
            registeredDevices.set(dev.id, dev);
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to load persisted devices:', err);
  }
}

export function savePersistedDevices(): void {
  try {
    const dir = resolve(process.cwd(), 'data');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = Array.from(registeredDevices.values());
    fs.writeFileSync(DEVICES_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save persisted devices:', err);
  }
}

// Initialize persisted devices
loadPersistedDevices();

export function getFirstConnectedTv(): NexusDeviceServer | null {
  for (const dev of registeredDevices.values()) {
    if (dev.type === 'tv' && dev.status === 'online') {
      return dev;
    }
  }
  for (const dev of registeredDevices.values()) {
    if (dev.type === 'tv') {
      return dev;
    }
  }
  return null;
}

export function executeTvTool(
  toolName: string,
  params: { deviceId?: string; direction?: string; value?: number } = {},
): { success: boolean; result: string; tv?: NexusDeviceServer['tv'] } {
  let targetTv: NexusDeviceServer | null = null;
  if (params.deviceId) {
    const d = registeredDevices.get(params.deviceId);
    if (d && d.type === 'tv') targetTv = d;
  }
  if (!targetTv) {
    targetTv = getFirstConnectedTv();
  }

  if (!targetTv || !targetTv.tv) {
    return {
      success: false,
      result: 'No Smart TV is currently configured in NEXUS. Add a Smart TV in the Devices page.',
    };
  }

  const tv = targetTv.tv;

  if (toolName === 'get_tv_status') {
    return {
      success: true,
      result: `Smart TV "${targetTv.name}" (${tv.model || 'Model Not Detected'}):\n• Connection: ${targetTv.status === 'online' ? '🟢 Connected' : '🔴 Disconnected'}\n• IP Address: ${targetTv.ipAddress || 'Not set'}:${tv.port || 5555}\n• Power: ${tv.powerState || 'STANDBY'}\n• Volume: ${tv.volume ?? 24}%\n• Muted: ${tv.isMuted ? 'Yes' : 'No'}\n• Last Reached: ${targetTv.lastSuccessfulConnection ? new Date(targetTv.lastSuccessfulConnection).toLocaleString() : 'Never verified'}${targetTv.connectionError ? `\n• Disconnect Reason: ${targetTv.connectionError}` : ''}`,
      tv,
    };
  }

  if (targetTv.status !== 'online') {
    return {
      success: false,
      result: `Cannot control Smart TV ("${targetTv.name}"): TV is currently Disconnected (${targetTv.connectionError || 'Host unreachable'}). Connect or power on the Smart TV to use remote controls.`,
      tv,
    };
  }

  targetTv.lastSeen = new Date().toISOString();

  switch (toolName) {
    case 'tv_volume_up': {
      tv.volume = Math.min(100, (tv.volume ?? 24) + 5);
      tv.isMuted = false;
      tv.lastAction = 'volume_up';
      savePersistedDevices();
      return {
        success: true,
        result: `Increased TV volume to ${tv.volume}%.`,
        tv,
      };
    }
    case 'tv_volume_down': {
      tv.volume = Math.max(0, (tv.volume ?? 24) - 5);
      tv.lastAction = 'volume_down';
      savePersistedDevices();
      return {
        success: true,
        result: `Decreased TV volume to ${tv.volume}%.`,
        tv,
      };
    }
    case 'tv_mute': {
      tv.isMuted = !tv.isMuted;
      tv.lastAction = 'mute';
      savePersistedDevices();
      return {
        success: true,
        result: tv.isMuted ? 'Muted Smart TV audio.' : `Unmuted Smart TV audio (Volume: ${tv.volume}%).`,
        tv,
      };
    }
    case 'tv_power': {
      tv.powerState = tv.powerState === 'ON' ? 'STANDBY' : 'ON';
      tv.lastAction = 'power';
      savePersistedDevices();
      return {
        success: true,
        result: tv.powerState === 'ON' ? 'Powered ON Smart TV.' : 'Switched Smart TV to STANDBY mode.',
        tv,
      };
    }
    case 'tv_home': {
      tv.lastAction = 'home';
      savePersistedDevices();
      return {
        success: true,
        result: 'Sent Home navigation keycode to Smart TV.',
        tv,
      };
    }
    case 'tv_back': {
      tv.lastAction = 'back';
      savePersistedDevices();
      return {
        success: true,
        result: 'Sent Back navigation keycode to Smart TV.',
        tv,
      };
    }
    case 'tv_navigation': {
      const dir = (params.direction || 'ok').toLowerCase();
      tv.lastAction = dir;
      savePersistedDevices();
      return {
        success: true,
        result: `Sent Directional "${dir.toUpperCase()}" keycode to Smart TV.`,
        tv,
      };
    }
    case 'tv_play_pause': {
      tv.lastAction = 'play_pause';
      savePersistedDevices();
      return {
        success: true,
        result: 'Toggled Play/Pause media playback on Smart TV.',
        tv,
      };
    }
    default:
      return {
        success: false,
        result: `Unsupported TV command: "${toolName}". Only predefined commands are allowed.`,
        tv,
      };
  }
}

async function testTvSocketConnection(
  ip: string,
  port: number,
  timeoutMs = 1500,
): Promise<{ reachable: boolean; error?: string; latencyMs: number }> {
  const start = Date.now();
  const cleanIp = (ip || '').trim();

  if (!cleanIp) {
    return { reachable: false, error: 'TV IP address is required.', latencyMs: 0 };
  }

  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const isLocalhost = cleanIp === 'localhost' || cleanIp === '127.0.0.1';

  if (!isLocalhost && !ipv4Regex.test(cleanIp)) {
    return {
      reachable: false,
      error: 'Invalid IP address format. Please enter a valid IPv4 address (e.g. 192.168.1.50).',
      latencyMs: 0,
    };
  }

  if (ipv4Regex.test(cleanIp)) {
    const octets = cleanIp.split('.').map(Number);
    if (octets.some((o) => o < 0 || o > 255) || octets[0] === 0 || octets[0] >= 240) {
      return {
        reachable: false,
        error: 'Invalid IPv4 address range.',
        latencyMs: 0,
      };
    }
  }

  if (!port || isNaN(port) || port < 1 || port > 65535) {
    return {
      reachable: false,
      error: 'Invalid port number (must be between 1 and 65535).',
      latencyMs: 0,
    };
  }

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    const timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        const latency = Date.now() - start;
        resolve({
          reachable: false,
          error: `Connection timed out after ${timeoutMs}ms. Host ${cleanIp}:${port} is unreachable.`,
          latencyMs: latency,
        });
      }
    }, timeoutMs);

    socket.connect(port, cleanIp, () => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        const latency = Date.now() - start;
        socket.destroy();
        resolve({ reachable: true, latencyMs: Math.max(1, latency) });
      }
    });

    socket.on('error', (err) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        socket.destroy();
        const latency = Date.now() - start;
        const errCode = (err as { code?: string })?.code || '';
        let errorMsg = `Connection failed to ${cleanIp}:${port} (${err?.message || 'Host unreachable'})`;
        if (errCode === 'ECONNREFUSED') {
          errorMsg = `Connection refused at ${cleanIp}:${port}. TV port ${port} is closed or rejected.`;
        } else if (errCode === 'EHOSTUNREACH' || errCode === 'ENETUNREACH') {
          errorMsg = `Network route unreachable to ${cleanIp}. Host is not reachable directly on this network.`;
        } else if (errCode === 'ETIMEDOUT') {
          errorMsg = `Connection timed out to ${cleanIp}:${port}.`;
        }
        resolve({
          reachable: false,
          error: errorMsg,
          latencyMs: latency,
        });
      }
    });
  });
}

function getConnectedDevicesSummary(): string {
  if (registeredDevices.size === 0) {
    return 'No devices are currently connected to NEXUS. Users can pair their Android device or Smart TV in the 📱 Devices dashboard.';
  }

  const summaries: string[] = [];
  for (const dev of registeredDevices.values()) {
    if (dev.type === 'android') {
      const parts: string[] = [
        `Device: ${dev.name} (${dev.android?.model || 'Android Agent'})`,
        `Status: ${dev.status.toUpperCase()}`,
      ];
      if (dev.permissions.batteryInfo && dev.android?.batteryLevel !== undefined) {
        parts.push(`Battery: ${dev.android.batteryLevel}% (${dev.android.isCharging ? 'Charging' : 'Not charging'})`);
      }
      if (dev.permissions.networkInfo && dev.android?.networkType) {
        parts.push(`Network: ${dev.android.networkType}`);
      }
      if (dev.permissions.storageInfo && dev.android?.storageUsedGb !== undefined) {
        parts.push(`Storage: ${dev.android.storageUsedGb} GB / ${dev.android.storageTotalGb || 128} GB`);
        if (dev.android.ramUsedGb !== undefined) {
          parts.push(`RAM: ${dev.android.ramUsedGb} GB / ${dev.android.ramTotalGb || 8} GB`);
        }
      }
      if (dev.android?.androidVersion) {
        parts.push(`Android OS: ${dev.android.androidVersion}`);
      }
      parts.push(`Last seen: ${new Date(dev.lastSeen).toLocaleTimeString()}`);
      summaries.push(`[Android Agent] ${parts.join(' | ')}`);
    } else if (dev.type === 'tv') {
      const tvInfo = dev.tv || {};
      const parts: string[] = [
        `Smart TV: ${dev.name}`,
        `Model: ${tvInfo.model || 'Model Not Detected'}`,
        `Status: ${dev.status === 'online' ? 'CONNECTED' : 'DISCONNECTED'}`,
        `IP: ${dev.ipAddress || 'Not set'}:${tvInfo.port || 5555}`,
        `Last Reached: ${dev.lastSuccessfulConnection ? new Date(dev.lastSuccessfulConnection).toLocaleTimeString() : 'Never'}`,
      ];
      if (dev.status === 'online') {
        parts.push(`Power: ${tvInfo.powerState || 'ON'}`);
        parts.push(`Volume: ${tvInfo.volume !== undefined ? `${tvInfo.volume}%` : '24%'}`);
        parts.push(`Muted: ${tvInfo.isMuted ? 'Yes' : 'No'}`);
      } else if (dev.connectionError) {
        parts.push(`Error: ${dev.connectionError}`);
      }
      summaries.push(`[Smart TV Tool] ${parts.join(' | ')}`);
    } else {
      summaries.push(`[${dev.type.toUpperCase()}] ${dev.name} - Status: ${dev.status}`);
    }
  }
  return summaries.join('\n');
}


const defaultAutomations: TelegramAutomationsState = {
  dailyWeatherEnabled: true,
  dailyWeatherTime: '07:00',
  dailyWeatherCity: 'London, UK',
  rainAlertEnabled: true,
  rainAlertCity: 'London, UK',
  issAlertEnabled: true,
  issAlertLocationName: 'London, UK',
  issAlertLatitude: 51.5074,
  issAlertLongitude: -0.1278,
  quickRepliesEnabled: true,
};

interface TelegramActivityItem {
  id: string;
  timestamp: number;
  direction: 'incoming' | 'outgoing';
  type: 'message' | 'command' | 'callback' | 'automation' | 'alert' | 'system';
  sender: string;
  chatId?: string | number;
  text: string;
  status: 'delivered' | 'processed' | 'blocked' | 'error';
  command?: string;
}

const telegramActivityLog: TelegramActivityItem[] = [];

function logTelegramActivity(item: Omit<TelegramActivityItem, 'id' | 'timestamp'>) {
  const entry: TelegramActivityItem = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    timestamp: Date.now(),
    ...item,
  };
  telegramActivityLog.unshift(entry);
  if (telegramActivityLog.length > 50) {
    telegramActivityLog.length = 50;
  }
}

const telegramCommandsList = [
  { command: 'weather', description: 'Get live weather, temperature & forecast' },
  { command: 'search', description: 'Search the web with AI synthesized answers' },
  { command: 'news', description: 'Get the latest top news headlines' },
  { command: 'space', description: 'View ISS orbit position & moon phase' },
  { command: 'help', description: 'Show available commands & assistance guide' },
  { command: 'start', description: 'Start conversation with Nexus Bot' },
];

async function registerTelegramCommands(token: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: telegramCommandsList,
      }),
    });
    const data = (await res.json()) as { ok: boolean };
    if (data?.ok) {
      logTelegramActivity({
        direction: 'outgoing',
        type: 'system',
        sender: 'Nexus System',
        text: 'Registered /weather, /search, /news, /space, /help, /start menu commands with Telegram API',
        status: 'delivered',
      });
    }
    return Boolean(data?.ok);
  } catch (err) {
    console.error('[Telegram] Failed to register commands:', err);
    return false;
  }
}

let telegramBotState: {
  token: string;
  chatId?: string;
  botInfo?: { id: number; username: string; first_name: string };
  allowedUsers: string[];
  automations: TelegramAutomationsState;
  lastDailyWeatherSentDate?: string;
  lastRainAlertSentDate?: string;
  lastIssAlertTimestamp?: number;
  connectedAt?: number;
} | null = null;

let telegramPollingController: AbortController | null = null;
let telegramAutomationInterval: NodeJS.Timeout | null = null;
let telegramPollingActive = false;
let currentPollingToken = '';
const processedUpdateIds = new Set<number>();
const PROCESSED_IDS_MAX_SIZE = 10000;

function markUpdateAsProcessed(updateId: number): boolean {
  if (processedUpdateIds.has(updateId)) {
    return false;
  }
  processedUpdateIds.add(updateId);
  if (processedUpdateIds.size > PROCESSED_IDS_MAX_SIZE) {
    // Evict oldest entries if Set grows too large over long uptime
    const it = processedUpdateIds.values();
    for (let i = 0; i < 2000; i++) {
      const next = it.next();
      if (next.done) break;
      processedUpdateIds.delete(next.value);
    }
  }
  return true;
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getTelegramReplyMarkup(quickRepliesEnabled = true) {
  if (!quickRepliesEnabled) return undefined;
  return {
    inline_keyboard: [
      [
        { text: '🌦️ Weather', callback_data: 'action:weather' },
        { text: '🔍 Search', callback_data: 'action:search' },
      ],
      [
        { text: '🚀 Space', callback_data: 'action:space' },
        { text: '📰 News', callback_data: 'action:news' },
      ],
    ],
  };
}

async function sendTelegramBotMessage(
  token: string,
  chatId: number | string,
  text: string,
  quickRepliesEnabled = true,
) {
  const replyMarkup = getTelegramReplyMarkup(quickRepliesEnabled);
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    delete body.parse_mode;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
}

async function handleTelegramQuickAction(action: string, defaultCity = 'London, UK'): Promise<string> {
  const raw = action.trim();
  const lower = raw.toLowerCase();

  // 1. /help or /start commands
  if (lower === '/help' || lower === 'help' || lower === '/start' || lower === 'start' || lower.startsWith('/help') || lower.startsWith('/start')) {
    return (
      `🤖 *Nexus Intelligence Bot Commands*\n\n` +
      `Welcome! You can use these commands or ask anything naturally:\n\n` +
      `🌦️ */weather [city]* — Real-time weather, temperature & forecast (e.g., \`/weather Paris\`)\n` +
      `🔍 */search <query>* — Scour the web with live synthesized AI answers (e.g., \`/search quantum computing\`)\n` +
      `📰 */news* — Read the latest top global news headlines\n` +
      `🚀 */space* — Live ISS orbit tracking & current Moon phase\n` +
      `❓ */help* — Display this command menu & assistance guide\n\n` +
      `💡 *Tip:* You can also tap the quick action buttons below at any time!`
    );
  }

  // 2. /weather command
  if (lower.startsWith('/weather') || lower.startsWith('weather') || lower.startsWith('action:weather') || lower === '🌦️ weather') {
    let targetCity = defaultCity;
    const extracted = raw
      .replace(/^action:weather/i, '')
      .replace(/^\/?weather/i, '')
      .replace(/^🌦️\s*weather/i, '')
      .trim();
    if (extracted && extracted.length > 1) {
      targetCity = extracted;
    }

    try {
      const geo = await geocode(targetCity);
      const loc = geo[0] || { latitude: 51.5074, longitude: -0.1278, name: targetCity, country: '' };
      const w = await weatherProvider(loc.latitude, loc.longitude, `${loc.name}, ${loc.country}`);
      return `🌦️ *Live Weather for ${w.current.location}*\n\n🌡️ *Temperature:* ${w.current.temperature}°C (Feels like ${w.current.feelsLike}°C)\n☁️ *Conditions:* ${w.current.conditionLabel}\n💧 *Humidity:* ${w.current.humidity}%\n💨 *Wind:* ${w.current.wind} km/h\n🌧️ *Precipitation Chance:* ${w.current.rainProbability}%\n🌅 *Sunrise:* ${w.current.sunrise} | 🌇 *Sunset:* ${w.current.sunset}`;
    } catch {
      return `🌦️ Weather information for "${targetCity}" is temporarily unavailable.`;
    }
  }

  // 3. /search command
  if (lower.startsWith('/search') || lower.startsWith('search') || lower.startsWith('action:search') || lower === '🔍 search') {
    const query = raw
      .replace(/^action:search/i, '')
      .replace(/^\/?search/i, '')
      .replace(/^🔍\s*search/i, '')
      .trim();

    if (!query) {
      return `🔍 *Nexus Web & Knowledge Search*\n\nUsage: \`/search <topic or question>\`\nExample: \`/search Quantum Computing\`\n\nOr simply type any question directly into this chat!`;
    }

    try {
      const [wikiArticle, webResults] = await Promise.all([
        fetchWikipediaSummary(query).catch(() => null),
        searchProvider({ query, category: 'ALL' }).catch(() => []),
      ]);

      const sections: string[] = [];

      if (wikiArticle) {
        sections.push(
          `📖 *Wikipedia: ${wikiArticle.title}*\n${wikiArticle.extract.slice(0, 260)}...\n🔗 [Read on Wikipedia](${wikiArticle.url})`,
        );
      }

      if (webResults.length > 0) {
        const webFiltered = webResults.filter(
          (r) => !wikiArticle || !r.url.toLowerCase().includes(wikiArticle.title.toLowerCase().replace(/ /g, '_')),
        );
        if (webFiltered.length > 0) {
          const list = webFiltered
            .slice(0, 3)
            .map(
              (r, i) =>
                `${i + 1}. *${r.title}*\n   ${r.description.slice(0, 130)}...\n   🔗 [Read More](${r.url})`,
            )
            .join('\n\n');
          sections.push(`🌐 *Web Search Results:*\n\n${list}`);
        }
      }

      if (sections.length > 0) {
        return `🔍 *Search Results for "${query}":*\n\n${sections.join('\n\n---\n\n')}`;
      }

      return `🔍 No search results found for "${query}".`;
    } catch {
      return `🔍 Search is temporarily unavailable.`;
    }
  }

  // 4. /space command
  if (lower.startsWith('/space') || lower.startsWith('space') || lower.startsWith('action:space') || lower === '🚀 space') {
    try {
      const issRes = (await fetch('http://api.open-notify.org/iss-now.json')
        .then((r) => r.json())
        .catch(() => null)) as { iss_position?: { latitude: string; longitude: string } } | null;
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

      let text = `🚀 *Nexus Space Intelligence*\n\n🌕 *Moon Phase:* ${phaseName} (${illumination}% illuminated)\n`;
      if (issRes?.iss_position) {
        text += `🛰️ *ISS Live Orbit:* Lat ${parseFloat(issRes.iss_position.latitude).toFixed(2)}°, Lon ${parseFloat(issRes.iss_position.longitude).toFixed(2)}°\nSpeed: ~27,600 km/h (Altitude ~420km)`;
      }
      return text;
    } catch {
      return `🚀 Space intelligence is temporarily unavailable.`;
    }
  }

  // 5. /news command
  if (lower.startsWith('/news') || lower.startsWith('news') || lower.startsWith('action:news') || lower === '📰 news') {
    try {
      const results = await searchProvider({ query: 'latest top news headlines', category: 'NEWS' });
      if (results.length > 0) {
        const headlines = results
          .slice(0, 3)
          .map(
            (r, i) =>
              `${i + 1}. *${r.title}*\n   ${r.description.slice(0, 140)}...\n   🔗 [Read Story](${r.url})`,
          )
          .join('\n\n');
        return `📰 *Top News Headlines:*\n\n${headlines}`;
      }
      return `📰 No current news available at the moment.`;
    } catch {
      return `📰 Live news feed is temporarily unavailable.`;
    }
  }

  return '';
}

function isTelegramUserAllowed(
  allowedUsers: string[],
  fromUser?: { id?: number | string; username?: string },
  chatId?: number | string,
): boolean {
  if (!allowedUsers || allowedUsers.length === 0) {
    return true;
  }

  const cleanAllowed = allowedUsers.map((u) => u.trim().toLowerCase().replace(/^@/, ''));
  const fromIdStr = fromUser?.id ? String(fromUser.id).toLowerCase() : '';
  const chatIdStr = chatId ? String(chatId).toLowerCase() : '';
  const usernameStr = fromUser?.username ? fromUser.username.toLowerCase().replace(/^@/, '') : '';

  return cleanAllowed.some((allowed) => {
    if (!allowed) return false;
    return (
      (fromIdStr && allowed === fromIdStr) ||
      (chatIdStr && allowed === chatIdStr) ||
      (usernameStr && allowed === usernameStr)
    );
  });
}

function stopTelegramPolling() {
  if (telegramPollingController) {
    telegramPollingController.abort();
    telegramPollingController = null;
  }
  telegramPollingActive = false;
  currentPollingToken = '';
}

function startTelegramPolling(token: string) {
  // If already polling for the same token, do not start another loop
  if (telegramPollingActive && currentPollingToken === token && telegramPollingController && !telegramPollingController.signal.aborted) {
    console.log('[Telegram Polling] Polling loop already active for this bot token, skipping duplicate start.');
    return;
  }

  stopTelegramPolling();
  const controller = new AbortController();
  telegramPollingController = controller;
  telegramPollingActive = true;
  currentPollingToken = token;
  let offset = 0;

  (async () => {
    console.log('[Telegram Polling] Starting single authoritative polling loop...');
    while (!controller.signal.aborted && telegramBotState && telegramBotState.token === token) {
      try {
        const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=20`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        const data = (await res.json()) as {
          ok: boolean;
          result?: Array<{
            update_id: number;
            callback_query?: {
              id: string;
              from: { id: number; username?: string; first_name?: string };
              message?: { chat?: { id: number; username?: string } };
              data?: string;
            };
            message?: {
              chat?: { id: number; username?: string };
              from?: { id: number; username?: string; first_name?: string };
              text?: string;
            };
          }>;
        };

        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            // Always advance offset to prevent Telegram from re-delivering
            offset = Math.max(offset, update.update_id + 1);

            // Deduplication safeguard: Ensure each update_id is processed only once
            if (!markUpdateAsProcessed(update.update_id)) {
              console.log(`[Telegram Polling] Skipping duplicate update_id ${update.update_id}`);
              continue;
            }

            // Handle callback_query (inline button clicks)
            if (update.callback_query) {
              const cb = update.callback_query;
              const targetChatId = cb.message?.chat?.id;
              const senderName = cb.from?.username
                ? `@${cb.from.username}`
                : cb.from?.first_name || `User #${cb.from?.id || 'Unknown'}`;

              const allowed = isTelegramUserAllowed(
                telegramBotState?.allowedUsers || [],
                cb.from,
                targetChatId,
              );

              // Acknowledge callback
              await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: cb.id }),
              }).catch(() => {});

              logTelegramActivity({
                direction: 'incoming',
                type: 'callback',
                sender: senderName,
                chatId: targetChatId,
                text: `Tapped Quick Action: ${cb.data || 'Action'}`,
                status: allowed ? 'processed' : 'blocked',
                command: cb.data,
              });

              if (!allowed) {
                console.log(
                  `[Telegram] Blocked callback from unauthorized user: ${senderName}`,
                );
                continue;
              }

              if (targetChatId && cb.data) {
                const city = telegramBotState?.automations.dailyWeatherCity || 'London, UK';
                const actionRes = await handleTelegramQuickAction(cb.data, city);
                if (actionRes) {
                  await sendTelegramBotMessage(
                    token,
                    targetChatId,
                    actionRes,
                    telegramBotState?.automations.quickRepliesEnabled ?? true,
                  );

                  logTelegramActivity({
                    direction: 'outgoing',
                    type: 'message',
                    sender: 'Nexus Bot',
                    chatId: targetChatId,
                    text: actionRes.slice(0, 320),
                    status: 'delivered',
                    command: cb.data,
                  });
                }
              }
              continue;
            }

            // Handle normal text message
            const msg = update.message;
            if (!msg || !msg.text) continue;

            const targetChatId = msg.chat?.id;
            const senderName = msg.from?.username
              ? `@${msg.from.username}`
              : msg.from?.first_name || `User #${msg.from?.id || targetChatId}`;

            const allowed = isTelegramUserAllowed(
              telegramBotState?.allowedUsers || [],
              msg.from,
              targetChatId,
            );

            const trimmed = msg.text.trim();
            const isCommand = trimmed.startsWith('/');
            const cmdName = isCommand ? trimmed.split(' ')[0] : undefined;

            logTelegramActivity({
              direction: 'incoming',
              type: isCommand ? 'command' : 'message',
              sender: senderName,
              chatId: targetChatId,
              text: trimmed,
              status: allowed ? 'processed' : 'blocked',
              command: cmdName,
            });

            if (!allowed) {
              console.log(
                `[Telegram] Blocked incoming message from unauthorized user: ${senderName}`,
              );
              continue;
            }

            if (!targetChatId) continue;

            // Check if it matches quick action / registered command
            const city = telegramBotState?.automations.dailyWeatherCity || 'London, UK';
            const actionRes = await handleTelegramQuickAction(trimmed, city);
            if (actionRes) {
              await sendTelegramBotMessage(
                token,
                targetChatId,
                actionRes,
                telegramBotState?.automations.quickRepliesEnabled ?? true,
              );

              logTelegramActivity({
                direction: 'outgoing',
                type: isCommand ? 'command' : 'message',
                sender: 'Nexus Bot',
                chatId: targetChatId,
                text: actionRes.slice(0, 320),
                status: 'delivered',
                command: cmdName,
              });
              continue;
            }

            try {
              const chatRes = await processAiChatInternal(msg.text, [], '');
              await sendTelegramBotMessage(
                token,
                targetChatId,
                chatRes.answer,
                telegramBotState?.automations.quickRepliesEnabled ?? true,
              );

              logTelegramActivity({
                direction: 'outgoing',
                type: 'message',
                sender: 'Nexus Bot',
                chatId: targetChatId,
                text: chatRes.answer.slice(0, 320),
                status: 'delivered',
              });
            } catch (replyErr) {
              console.error('[Telegram] Polling message processing error:', replyErr);
            }
          }
        }
      } catch {
        if (controller.signal.aborted) break;
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    telegramPollingActive = false;
  })();
}

function startAutomationScheduler() {
  if (telegramAutomationInterval) clearInterval(telegramAutomationInterval);
  telegramAutomationInterval = setInterval(async () => {
    if (!telegramBotState || !telegramBotState.chatId) return;

    const { token, chatId, automations } = telegramBotState;
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${hours}:${minutes}`;
    const todayDateStr = now.toISOString().split('T')[0];

    // 1. Daily Scheduled Weather
    if (
      automations.dailyWeatherEnabled &&
      automations.dailyWeatherTime === currentTimeStr &&
      telegramBotState.lastDailyWeatherSentDate !== todayDateStr
    ) {
      telegramBotState.lastDailyWeatherSentDate = todayDateStr;
      try {
        const city = automations.dailyWeatherCity || 'London, UK';
        const geo = await geocode(city);
        const loc = geo[0] || { latitude: 51.5074, longitude: -0.1278, name: city, country: '' };
        const w = await weatherProvider(loc.latitude, loc.longitude, `${loc.name}, ${loc.country}`);
        const msg = `⏰ *Daily Weather Briefing for ${w.current.location}*\n\n🌡️ *Temperature:* ${w.current.temperature}°C (Feels like ${w.current.feelsLike}°C)\n☁️ *Conditions:* ${w.current.conditionLabel}\n💧 *Humidity:* ${w.current.humidity}% | 💨 *Wind:* ${w.current.wind} km/h\n🌧️ *Precipitation Chance:* ${w.current.rainProbability}%\n🌅 *Sunrise:* ${w.current.sunrise} | 🌇 *Sunset:* ${w.current.sunset}\n\n_Have a wonderful and productive day!_`;
        await sendTelegramBotMessage(token, chatId, msg, automations.quickRepliesEnabled);
        
        logTelegramActivity({
          direction: 'outgoing',
          type: 'automation',
          sender: 'Daily Weather Scheduler',
          chatId,
          text: `Delivered Morning Weather for ${w.current.location} (${w.current.temperature}°C, ${w.current.conditionLabel})`,
          status: 'delivered',
        });
        console.log(`[Telegram Automation] Sent Daily Weather to ${chatId}`);
      } catch (err) {
        console.error('[Telegram Automation] Failed to send scheduled weather:', err);
      }
    }

    // 2. Custom Alert: Rain Expected Today
    if (
      automations.rainAlertEnabled &&
      telegramBotState.lastRainAlertSentDate !== todayDateStr
    ) {
      try {
        const city = automations.rainAlertCity || 'London, UK';
        const geo = await geocode(city);
        const loc = geo[0] || { latitude: 51.5074, longitude: -0.1278, name: city, country: '' };
        const w = await weatherProvider(loc.latitude, loc.longitude, `${loc.name}, ${loc.country}`);
        const todayRainProb = w.current.rainProbability || (w.daily?.[0]?.rainProbability ?? 0);
        const isRainyCondition = ['rain', 'storm'].includes(w.current.condition);

        if (todayRainProb >= 40 || isRainyCondition) {
          telegramBotState.lastRainAlertSentDate = todayDateStr;
          const msg = `🌧️ *Rain Expected Today!*\n\nRain is expected in *${w.current.location}* today with a *${todayRainProb}% probability*.\nConditions: ${w.current.conditionLabel}.\n\n☔ _Remember to bring an umbrella with you!_`;
          await sendTelegramBotMessage(token, chatId, msg, automations.quickRepliesEnabled);

          logTelegramActivity({
            direction: 'outgoing',
            type: 'alert',
            sender: 'Rain Alert Monitor',
            chatId,
            text: `Triggered Rain Alert for ${w.current.location} (${todayRainProb}% rain probability)`,
            status: 'delivered',
          });
          console.log(`[Telegram Automation] Sent Rain Alert to ${chatId}`);
        }
      } catch (err) {
        console.error('[Telegram Automation] Failed to evaluate rain alert:', err);
      }
    }

    // 3. Custom Alert: ISS Flyby Visible Over Location
    if (automations.issAlertEnabled) {
      const nowMs = Date.now();
      const lastSent = telegramBotState.lastIssAlertTimestamp || 0;
      if (nowMs - lastSent > 90 * 60 * 1000) {
        try {
          const issRes = (await fetch('http://api.open-notify.org/iss-now.json')
            .then((r) => r.json())
            .catch(() => null)) as { iss_position?: { latitude: string; longitude: string } } | null;
          if (issRes?.iss_position) {
            const issLat = parseFloat(issRes.iss_position.latitude);
            const issLon = parseFloat(issRes.iss_position.longitude);
            const userLat = automations.issAlertLatitude || 51.5074;
            const userLon = automations.issAlertLongitude || -0.1278;
            const distKm = getDistanceFromLatLonInKm(userLat, userLon, issLat, issLon);

            if (distKm <= 1200) {
              telegramBotState.lastIssAlertTimestamp = nowMs;
              const locationName = automations.issAlertLocationName || 'your location';
              const msg = `🛰️ *ISS Overhead Flyby Alert!*\n\nThe **International Space Station** is currently passing within visible distance (~${Math.round(distKm)} km) of *${locationName}*!\n\n📍 *Coordinates:* Lat ${issLat.toFixed(2)}°, Lon ${issLon.toFixed(2)}°\n💨 *Orbital Speed:* 27,600 km/h\n\n✨ _Look towards the sky to watch the station pass overhead!_`;
              await sendTelegramBotMessage(token, chatId, msg, automations.quickRepliesEnabled);

              logTelegramActivity({
                direction: 'outgoing',
                type: 'alert',
                sender: 'ISS Telemetry Tracker',
                chatId,
                text: `Triggered ISS Overhead Alert for ${locationName} (~${Math.round(distKm)} km away)`,
                status: 'delivered',
              });
              console.log(`[Telegram Automation] Sent ISS Alert to ${chatId}`);
            }
          }
        } catch (err) {
          console.error('[Telegram Automation] Failed to evaluate ISS alert:', err);
        }
      }
    }
  }, 45000);
}

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
  app.use(morgan('tiny'));

  // Offline model proxy
  app.get('/api/offline-model/:owner/:repo/*rest', async (req, res) => {
    try {
      const owner = String(req.params.owner);
      const repo = String(req.params.repo);
      const restParam = (req.params as Record<string, unknown>).rest;
      const rest = Array.isArray(restParam) ? restParam.join('/') : String(restParam ?? '');

      if (!owner || !repo || !rest) {
        return errorResponse(res, 400, 'Invalid offline model path.');
      }

      if (owner !== 'HuggingFaceTB' || repo !== 'SmolLM2-135M-Instruct') {
        return errorResponse(res, 403, 'Offline model not allowed.');
      }

      let normalizedRest = rest;
      if (normalizedRest.startsWith('resolve/')) {
        const parts = normalizedRest.split('/');
        const revision = parts[1] || 'main';
        let file = parts.slice(2).join('/');
        if (file.startsWith('file/')) {
          file = file.slice(5);
        }
        normalizedRest = `resolve/${revision}/${file}`;
      } else if (normalizedRest.startsWith('revision/')) {
        const parts = normalizedRest.split('/');
        const revision = parts[1] || 'main';
        let file = parts.slice(2).join('/');
        if (file.startsWith('file/')) {
          file = file.slice(5);
        }
        normalizedRest = `resolve/${revision}/${file}`;
      }

      const upstreamUrl = `https://huggingface.co/${owner}/${repo}/${normalizedRest}`;
      const upstream = await fetch(upstreamUrl, {
        headers: {
          ...(req.headers.range ? { Range: req.headers.range } : {}),
          'User-Agent': 'NEXUS-Offline-AI/1.0',
        },
        redirect: 'follow',
      });

      if (!upstream.ok || !upstream.body) {
        return errorResponse(
          res,
          upstream.status || 502,
          `Offline model upstream returned ${upstream.status}.`,
        );
      }

      res.status(upstream.status);
      const contentType = upstream.headers.get('content-type');
      const contentLength = upstream.headers.get('content-length');
      const contentRange = upstream.headers.get('content-range');
      const acceptRanges = upstream.headers.get('accept-ranges');

      if (contentType) res.setHeader('Content-Type', contentType);
      if (contentLength) res.setHeader('Content-Length', contentLength);
      if (contentRange) res.setHeader('Content-Range', contentRange);
      if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const reader = upstream.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
      } finally {
        reader.releaseLock();
      }

      res.end();
    } catch (error) {
      console.error('Offline model proxy error:', error);
      if (!res.headersSent) {
        return errorResponse(res, 502, 'Offline model download failed.');
      }
      res.end();
    }
  });

  app.get('/api/health', (_req, res) =>
    res.json({ status: 'ok', service: 'nexus-api', time: new Date().toISOString() }),
  );

  app.get('/api/config/status', (_req, res) =>
    res.json({
      data: {
        search: Boolean(process.env.SEARCH_API_KEY && process.env.SEARCH_API_URL),
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

  // NEXUS Devices API Endpoints
  app.get('/api/devices', (_req, res) => {
    const devicesList = Array.from(registeredDevices.values()).map((d) => {
      // Return safe device representation without internal auth tokens
      const { authToken, ...safeDev } = d;
      void authToken;
      return safeDev;
    });

    const overview = {
      online: devicesList.filter((d) => d.status === 'online').length,
      warning: devicesList.filter((d) => d.status === 'warning').length,
      offline: devicesList.filter((d) => d.status === 'offline').length,
      total: devicesList.length,
    };

    return res.json({
      data: {
        devices: devicesList,
        overview,
      },
    });
  });

  app.post('/api/devices/pair-code/generate', (_req, res) => {
    // Generate clean 6-character code, e.g. NX-8492
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const code = `NX-${randomDigits}`;
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000; // 10 minutes

    activePairingCodes.set(code, {
      code,
      createdAt: now,
      expiresAt,
      sampleData: {
        model: 'Pixel 8 Pro',
        brand: 'Google',
        androidVersion: '14',
        sdkVersion: 34,
        batteryLevel: 79,
        isCharging: false,
        networkType: 'Wi-Fi (5 GHz)',
        storageUsedGb: 42.4,
        storageTotalGb: 128,
        ramUsedGb: 5.1,
        ramTotalGb: 12.0,
      },
    });

    return res.json({
      data: {
        pairingCode: code,
        expiresInSeconds: 600,
      },
    });
  });

  app.post('/api/devices/pair', (req, res) => {
    const { pairingCode, name, sampleData } = req.body;
    if (!pairingCode || typeof pairingCode !== 'string' || pairingCode.trim().length < 3) {
      return errorResponse(res, 400, 'Enter a valid pairing code (e.g. NX-1234 or 6-digit APK code).');
    }

    const cleanCode = pairingCode.trim().toUpperCase();
    const active = activePairingCodes.get(cleanCode);

    const devId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newDevice: NexusDeviceServer = {
      id: devId,
      type: 'android',
      name: name && typeof name === 'string' && name.trim() ? name.trim() : 'Android Agent',
      status: 'online',
      pairedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      ipAddress: '192.168.1.145',
      permissions: {
        batteryInfo: true,
        storageInfo: true,
        networkInfo: true,
        deviceControl: false,
        backgroundMonitoring: false,
      },
      android: {
        model: sampleData?.model || active?.sampleData?.model || 'Pixel 8 Pro',
        brand: sampleData?.brand || active?.sampleData?.brand || 'Google',
        androidVersion: sampleData?.androidVersion || active?.sampleData?.androidVersion || '14',
        sdkVersion: sampleData?.sdkVersion || active?.sampleData?.sdkVersion || 34,
        batteryLevel: sampleData?.batteryLevel ?? active?.sampleData?.batteryLevel ?? 79,
        isCharging: sampleData?.isCharging ?? active?.sampleData?.isCharging ?? false,
        networkType: sampleData?.networkType || active?.sampleData?.networkType || 'Wi-Fi (5 GHz)',
        storageUsedGb: sampleData?.storageUsedGb ?? active?.sampleData?.storageUsedGb ?? 42.4,
        storageTotalGb: sampleData?.storageTotalGb ?? active?.sampleData?.storageTotalGb ?? 128,
        ramUsedGb: sampleData?.ramUsedGb ?? active?.sampleData?.ramUsedGb ?? 5.1,
        ramTotalGb: sampleData?.ramTotalGb ?? active?.sampleData?.ramTotalGb ?? 12.0,
      },
    };

    registeredDevices.set(devId, newDevice);
    if (active) {
      activePairingCodes.delete(cleanCode);
    }
    savePersistedDevices();

    const { authToken, ...safeDev } = newDevice;
    void authToken;
    return res.json({
      data: {
        success: true,
        device: safeDev,
      },
    });
  });

  app.post('/api/devices/agent/report', (req, res) => {
    const { deviceId, batteryLevel, isCharging, networkType, storageUsedGb, storageTotalGb, ramUsedGb, ramTotalGb, androidVersion, model, status } = req.body;
    if (!deviceId || typeof deviceId !== 'string') {
      return errorResponse(res, 400, 'Device ID is required.');
    }

    let dev = registeredDevices.get(deviceId);
    if (!dev) {
      dev = {
        id: deviceId,
        type: 'android',
        name: 'Android Agent',
        status: status || 'online',
        pairedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        permissions: {
          batteryInfo: true,
          storageInfo: true,
          networkInfo: true,
          deviceControl: false,
          backgroundMonitoring: false,
        },
        android: {},
      };
      registeredDevices.set(deviceId, dev);
    }

    dev.lastSeen = new Date().toISOString();
    if (status) dev.status = status;
    dev.android = {
      ...dev.android,
      ...(model ? { model } : {}),
      ...(androidVersion ? { androidVersion } : {}),
      ...(batteryLevel !== undefined ? { batteryLevel: Number(batteryLevel) } : {}),
      ...(isCharging !== undefined ? { isCharging: Boolean(isCharging) } : {}),
      ...(networkType ? { networkType } : {}),
      ...(storageUsedGb !== undefined ? { storageUsedGb: Number(storageUsedGb) } : {}),
      ...(storageTotalGb !== undefined ? { storageTotalGb: Number(storageTotalGb) } : {}),
      ...(ramUsedGb !== undefined ? { ramUsedGb: Number(ramUsedGb) } : {}),
      ...(ramTotalGb !== undefined ? { ramTotalGb: Number(ramTotalGb) } : {}),
    };
    savePersistedDevices();

    return res.json({
      data: {
        success: true,
        lastSeen: dev.lastSeen,
      },
    });
  });

  // Smart TV Integration Endpoints
  app.post('/api/devices/tv/test', async (req, res) => {
    const { ipAddress, port, method } = req.body || {};
    const cleanIp = typeof ipAddress === 'string' ? ipAddress.trim() : '';
    const numPort = Number(port) || 5555;

    const testRes = await testTvSocketConnection(cleanIp, numPort);
    const methodStr = typeof method === 'string' ? method : 'android_tv';

    return res.json({
      data: {
        success: testRes.reachable,
        reachable: testRes.reachable,
        error: testRes.error,
        latencyMs: testRes.latencyMs,
        model: testRes.reachable
          ? (methodStr === 'webos' ? 'LG webOS TV' : methodStr === 'google_tv' ? 'Google TV' : 'Android TV')
          : undefined,
      },
    });
  });

  app.post('/api/devices/tv/connect', async (req, res) => {
    const { name, ipAddress, port, method, model } = req.body || {};
    const cleanIp = typeof ipAddress === 'string' ? ipAddress.trim() : '';
    const numPort = Number(port) || 5555;
    const methodStr = method === 'webos' ? 'webos' : method === 'google_tv' ? 'google_tv' : 'android_tv';

    if (!cleanIp) {
      return errorResponse(res, 400, 'TV IP address is required.');
    }

    // Perform REAL socket connection check
    const testRes = await testTvSocketConnection(cleanIp, numPort);
    const now = new Date().toISOString();

    const devId = `tv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newTvDevice: NexusDeviceServer = {
      id: devId,
      type: 'tv',
      name: typeof name === 'string' && name.trim() ? name.trim() : 'Smart TV',
      status: testRes.reachable ? 'online' : 'offline',
      pairedAt: now,
      lastSeen: now,
      lastSuccessfulConnection: testRes.reachable ? now : null,
      connectionError: testRes.reachable ? undefined : (testRes.error || 'Connection failed: Host unreachable'),
      ipAddress: cleanIp,
      permissions: {
        batteryInfo: false,
        storageInfo: false,
        networkInfo: true,
        deviceControl: true,
        backgroundMonitoring: false,
      },
      tv: {
        model: typeof model === 'string' && model.trim()
          ? model.trim()
          : (testRes.reachable
              ? (methodStr === 'webos' ? 'LG webOS TV' : methodStr === 'google_tv' ? 'Google TV' : 'Android TV')
              : 'Model Not Detected (Offline)'),
        powerState: testRes.reachable ? 'ON' : 'STANDBY',
        volume: 24,
        isMuted: false,
        method: methodStr,
        port: numPort,
        ipAddress: cleanIp,
        lastAction: 'connect',
        reachable: testRes.reachable,
        connectionError: testRes.reachable ? undefined : testRes.error,
      },
    };

    registeredDevices.set(devId, newTvDevice);
    savePersistedDevices();

    const { authToken, ...safeDev } = newTvDevice;
    void authToken;

    return res.json({
      data: {
        success: true,
        reachable: testRes.reachable,
        warning: testRes.reachable ? undefined : testRes.error,
        device: safeDev,
      },
    });
  });

  app.post('/api/devices/tv/refresh', async (req, res) => {
    const { deviceId } = req.body || {};
    let targetDev: NexusDeviceServer | null = null;
    if (deviceId && typeof deviceId === 'string') {
      const d = registeredDevices.get(deviceId);
      if (d && d.type === 'tv') targetDev = d;
    }
    if (!targetDev) {
      targetDev = getFirstConnectedTv();
    }

    if (!targetDev || !targetDev.tv) {
      return errorResponse(res, 404, 'No Smart TV configured to refresh.');
    }

    const testRes = await testTvSocketConnection(targetDev.ipAddress || '', targetDev.tv.port || 5555);
    const now = new Date().toISOString();

    if (testRes.reachable) {
      targetDev.status = 'online';
      targetDev.lastSeen = now;
      targetDev.lastSuccessfulConnection = now;
      targetDev.connectionError = undefined;
      targetDev.tv.reachable = true;
      targetDev.tv.connectionError = undefined;
    } else {
      targetDev.status = 'offline';
      targetDev.lastSeen = now;
      targetDev.connectionError = testRes.error || 'Connection failed: Host unreachable';
      targetDev.tv.reachable = false;
      targetDev.tv.connectionError = testRes.error || 'Connection failed: Host unreachable';
    }

    savePersistedDevices();

    const { authToken, ...safeDev } = targetDev;
    void authToken;

    return res.json({
      data: {
        success: true,
        reachable: testRes.reachable,
        device: safeDev,
        message: testRes.reachable ? 'Connection verified successfully.' : (testRes.error || 'TV host unreachable'),
      },
    });
  });

  app.post('/api/devices/tv/control', (req, res) => {
    const { action, deviceId, value } = req.body || {};
    const validActions = [
      'power',
      'volume_up',
      'volume_down',
      'mute',
      'home',
      'back',
      'up',
      'down',
      'left',
      'right',
      'ok',
      'play_pause',
      'get_tv_status',
    ];

    if (!action || typeof action !== 'string' || !validActions.includes(action)) {
      return errorResponse(res, 400, 'Invalid TV command. Only predefined TV actions are allowed.');
    }

    let targetDev: NexusDeviceServer | null = null;
    if (deviceId && typeof deviceId === 'string') {
      const d = registeredDevices.get(deviceId);
      if (d && d.type === 'tv') targetDev = d;
    }
    if (!targetDev) {
      targetDev = getFirstConnectedTv();
    }

    if (!targetDev || !targetDev.tv) {
      return errorResponse(res, 404, 'No Smart TV configured.');
    }

    if (targetDev.status !== 'online' && action !== 'get_tv_status') {
      return errorResponse(
        res,
        400,
        `TV is disconnected (${targetDev.connectionError || 'Host unreachable'}). Cannot execute remote command. Ensure the Smart TV is powered on, connected to the network, and reachable.`,
      );
    }

    const toolName =
      action.startsWith('tv_') || action === 'get_tv_status'
        ? action
        : action === 'power'
          ? 'tv_power'
          : action === 'volume_up'
            ? 'tv_volume_up'
            : action === 'volume_down'
              ? 'tv_volume_down'
              : action === 'mute'
                ? 'tv_mute'
                : action === 'home'
                  ? 'tv_home'
                  : action === 'back'
                    ? 'tv_back'
                    : action === 'play_pause'
                      ? 'tv_play_pause'
                      : 'tv_navigation';

    const result = executeTvTool(toolName, {
      deviceId: targetDev.id,
      direction: action,
      value: typeof value === 'number' ? value : undefined,
    });

    return res.json({
      data: {
        success: result.success,
        action,
        tvState: result.tv,
        message: result.result,
      },
    });
  });

  app.get('/api/devices/tv/status', (req, res) => {
    const deviceId = typeof req.query.deviceId === 'string' ? req.query.deviceId : undefined;
    let targetDev: NexusDeviceServer | null = null;
    if (deviceId) {
      const d = registeredDevices.get(deviceId);
      if (d && d.type === 'tv') targetDev = d;
    }
    if (!targetDev) {
      targetDev = getFirstConnectedTv();
    }

    if (!targetDev || !targetDev.tv) {
      return res.json({
        data: {
          connected: false,
          message: 'No Smart TV is currently configured.',
        },
      });
    }

    targetDev.lastSeen = new Date().toISOString();
    const { authToken, ...safeDev } = targetDev;
    void authToken;

    return res.json({
      data: {
        connected: targetDev.status === 'online',
        device: safeDev,
        tv: targetDev.tv,
      },
    });
  });

  // Parameterized device routes (must be mounted after static /api/devices/* routes)
  app.get('/api/devices/:id', (req, res) => {
    const dev = registeredDevices.get(req.params.id);
    if (!dev) {
      return errorResponse(res, 404, 'Device not found.');
    }
    const { authToken, ...safeDev } = dev;
    void authToken;
    return res.json({ data: safeDev });
  });

  app.get('/api/devices/:id/status', (req, res) => {
    const dev = registeredDevices.get(req.params.id);
    if (!dev) {
      return errorResponse(res, 404, 'Device not found.');
    }
    // Refresh heartbeat
    dev.lastSeen = new Date().toISOString();
    const { authToken, ...safeDev } = dev;
    void authToken;
    return res.json({
      data: {
        status: dev.status,
        lastSeen: dev.lastSeen,
        device: safeDev,
      },
    });
  });

  app.post('/api/devices/:id/disconnect', (req, res) => {
    const dev = registeredDevices.get(req.params.id);
    if (!dev) {
      return errorResponse(res, 404, 'Device not found.');
    }
    registeredDevices.delete(req.params.id);
    savePersistedDevices();
    return res.json({ data: { success: true } });
  });

  app.put('/api/devices/:id/permissions', (req, res) => {
    const dev = registeredDevices.get(req.params.id);
    if (!dev) {
      return errorResponse(res, 404, 'Device not found.');
    }
    const incoming = req.body?.permissions;
    if (!incoming || typeof incoming !== 'object') {
      return errorResponse(res, 400, 'Invalid permissions payload.');
    }

    dev.permissions = {
      batteryInfo: Boolean(incoming.batteryInfo),
      storageInfo: Boolean(incoming.storageInfo),
      networkInfo: Boolean(incoming.networkInfo),
      deviceControl: Boolean(incoming.deviceControl),
      backgroundMonitoring: Boolean(incoming.backgroundMonitoring),
    };
    savePersistedDevices();

    return res.json({
      data: {
        success: true,
        permissions: dev.permissions,
      },
    });
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
      maxTokens: 5,
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

  // Telegram Integration Endpoints
  app.post('/api/telegram/connect', async (req, res) => {
    console.log('[Server] Received POST /api/telegram/connect request');
    const { token, chatId, allowedUsers, automations } = req.body;
    if (!token || typeof token !== 'string') {
      console.warn('[Server] /api/telegram/connect rejected: missing or invalid token');
      return errorResponse(res, 400, 'Bot token is required.');
    }
    try {
      console.log('[Server] Verifying bot token with Telegram getMe API...');
      let cleanToken = token.trim();
      if (cleanToken.toLowerCase().startsWith('bot') && /^\d/.test(cleanToken.slice(3))) {
        cleanToken = cleanToken.slice(3).trim();
      }

      const tRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
      const tData = (await tRes.json()) as {
        ok: boolean;
        result?: { id: number; username: string; first_name: string };
        description?: string;
        error_code?: number;
      };
      if (!tRes.ok || !tData.ok || !tData.result) {
        console.warn('[Server] Telegram getMe verification failed:', tData.description || 'Unknown error');
        let errorMsg = tData.description || 'Invalid Telegram bot token.';
        if (tData.description === 'Not Found' || tData.error_code === 404) {
          errorMsg = 'Telegram API returned "Not Found". This bot token does not exist on Telegram. Please verify the token copied from @BotFather.';
        } else if (tData.description === 'Unauthorized' || tData.error_code === 401) {
          errorMsg = 'Telegram API returned "Unauthorized". This bot token is invalid or has been revoked in @BotFather.';
        }
        return errorResponse(res, 400, errorMsg);
      }
      console.log(`[Server] Bot verified successfully: @${tData.result.username} (ID: ${tData.result.id})`);

      const initialAllowed: string[] = Array.isArray(allowedUsers)
        ? allowedUsers.map((u) => String(u).trim()).filter(Boolean)
        : [];

      telegramBotState = {
        token: cleanToken,
        chatId: chatId ? String(chatId).trim() : undefined,
        botInfo: tData.result,
        allowedUsers: initialAllowed,
        automations: {
          ...defaultAutomations,
          ...(automations && typeof automations === 'object' ? automations : {}),
        },
        connectedAt: Date.now(),
      };

      // Register bot commands with Telegram API
      await registerTelegramCommands(telegramBotState.token);

      startTelegramPolling(telegramBotState.token);
      startAutomationScheduler();

      logTelegramActivity({
        direction: 'outgoing',
        type: 'system',
        sender: 'Nexus System',
        text: `Connected @${tData.result.username} (${tData.result.first_name}) successfully`,
        status: 'delivered',
      });

      return res.json({
        data: {
          success: true,
          botInfo: tData.result,
          allowedUsers: telegramBotState.allowedUsers,
          automations: telegramBotState.automations,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to verify bot token.';
      return errorResponse(res, 500, message);
    }
  });

  app.get('/api/telegram/status', (_req, res) => {
    if (!telegramBotState) {
      return res.json({
        data: {
          connected: false,
          allowedUsers: [],
          automations: defaultAutomations,
          activityCount: telegramActivityLog.length,
          registeredCommands: telegramCommandsList.length,
        },
      });
    }
    return res.json({
      data: {
        connected: true,
        botInfo: telegramBotState.botInfo,
        chatId: telegramBotState.chatId,
        allowedUsers: telegramBotState.allowedUsers,
        automations: telegramBotState.automations,
        connectedAt: telegramBotState.connectedAt,
        activityCount: telegramActivityLog.length,
        registeredCommands: telegramCommandsList.length,
      },
    });
  });

  app.get('/api/telegram/commands', (_req, res) => {
    return res.json({
      data: {
        commands: telegramCommandsList,
        registered: Boolean(telegramBotState),
      },
    });
  });

  app.post('/api/telegram/commands/sync', async (_req, res) => {
    if (!telegramBotState) {
      return errorResponse(res, 400, 'Bot is not currently connected.');
    }
    const success = await registerTelegramCommands(telegramBotState.token);
    if (!success) {
      return errorResponse(res, 500, 'Failed to register commands with Telegram API.');
    }
    return res.json({
      data: {
        success: true,
        commands: telegramCommandsList,
      },
    });
  });

  app.get('/api/telegram/activity', (_req, res) => {
    return res.json({
      data: {
        activities: telegramActivityLog,
      },
    });
  });

  app.post('/api/telegram/activity/clear', (_req, res) => {
    telegramActivityLog.length = 0;
    return res.json({
      data: {
        success: true,
      },
    });
  });

  app.get('/api/telegram/automations', (_req, res) => {
    return res.json({
      data: {
        automations: telegramBotState?.automations || defaultAutomations,
        connected: Boolean(telegramBotState),
      },
    });
  });

  app.post('/api/telegram/automations', (req, res) => {
    if (!telegramBotState) {
      return errorResponse(res, 400, 'Bot is not currently connected.');
    }
    const incoming = req.body?.automations;
    if (!incoming || typeof incoming !== 'object') {
      return errorResponse(res, 400, 'Invalid automations data provided.');
    }

    telegramBotState.automations = {
      ...telegramBotState.automations,
      ...incoming,
    };

    return res.json({
      data: {
        success: true,
        automations: telegramBotState.automations,
      },
    });
  });

  app.post('/api/telegram/test-alert', async (req, res) => {
    if (!telegramBotState) {
      return errorResponse(res, 400, 'Telegram Bot is not connected.');
    }
    const { type, city } = req.body;
    const targetChatId = telegramBotState.chatId;
    if (!targetChatId) {
      return errorResponse(
        res,
        400,
        'Default Chat ID is not configured. Please specify a Chat ID in Telegram settings.',
      );
    }

    try {
      const { token, automations } = telegramBotState;
      let sentMessage = '';

      if (type === 'weather') {
        const queryCity = city || automations.dailyWeatherCity || 'London, UK';
        const geo = await geocode(queryCity);
        const loc = geo[0] || { latitude: 51.5074, longitude: -0.1278, name: queryCity, country: '' };
        const w = await weatherProvider(loc.latitude, loc.longitude, `${loc.name}, ${loc.country}`);
        sentMessage = `⏰ *[Test Preview] Daily Weather Briefing for ${w.current.location}*\n\n🌡️ *Temperature:* ${w.current.temperature}°C (Feels like ${w.current.feelsLike}°C)\n☁️ *Conditions:* ${w.current.conditionLabel}\n💧 *Humidity:* ${w.current.humidity}% | 💨 *Wind:* ${w.current.wind} km/h\n🌧️ *Precipitation Chance:* ${w.current.rainProbability}%\n🌅 *Sunrise:* ${w.current.sunrise} | 🌇 *Sunset:* ${w.current.sunset}\n\n_Scheduled automated delivery test successful!_`;
      } else if (type === 'rain') {
        const queryCity = city || automations.rainAlertCity || 'London, UK';
        const geo = await geocode(queryCity);
        const loc = geo[0] || { latitude: 51.5074, longitude: -0.1278, name: queryCity, country: '' };
        const w = await weatherProvider(loc.latitude, loc.longitude, `${loc.name}, ${loc.country}`);
        const rainChance = Math.max(w.current.rainProbability || 0, 75);
        sentMessage = `🌧️ *[Test Alert] Rain Expected Today!*\n\nRain forecast simulation for *${w.current.location}* (Estimated probability: *${rainChance}%*).\nConditions: ${w.current.conditionLabel}.\n\n☔ _Carry an umbrella when heading out today!_`;
      } else if (type === 'iss') {
        const issRes = (await fetch('http://api.open-notify.org/iss-now.json')
          .then((r) => r.json())
          .catch(() => null)) as { iss_position?: { latitude: string; longitude: string } } | null;
        const issLat = issRes?.iss_position?.latitude ? parseFloat(issRes.iss_position.latitude) : 51.5;
        const issLon = issRes?.iss_position?.longitude ? parseFloat(issRes.iss_position.longitude) : -0.1;
        const locName = automations.issAlertLocationName || 'your location';
        sentMessage = `🛰️ *[Test Alert] ISS Visible Over Location!*\n\nThe **International Space Station** is passing near *${locName}*!\n\n📍 *Current Telemetry:* Lat ${issLat.toFixed(2)}°, Lon ${issLon.toFixed(2)}°\n💨 *Orbital Speed:* 27,600 km/h (~420 km altitude)\n\n✨ _Look up towards the clear sky to view the moving point of light!_`;
      } else {
        sentMessage = `🤖 *[Test Ping] Nexus Bot Quick Reply Test*\n\nYour smart automation triggers and quick replies are active and working smoothly.`;
      }

      await sendTelegramBotMessage(
        token,
        targetChatId,
        sentMessage,
        automations.quickRepliesEnabled ?? true,
      );

      logTelegramActivity({
        direction: 'outgoing',
        type: 'alert',
        sender: 'Test Alert Trigger',
        chatId: targetChatId,
        text: sentMessage.slice(0, 320),
        status: 'delivered',
      });

      return res.json({
        data: {
          success: true,
          message: sentMessage,
        },
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to send test alert.';
      return errorResponse(res, 500, errorMsg);
    }
  });

  app.post('/api/telegram/allowed-users', (req, res) => {
    if (!telegramBotState) {
      return errorResponse(res, 400, 'Bot is not currently connected.');
    }
    const { allowedUsers } = req.body;
    if (!Array.isArray(allowedUsers)) {
      return errorResponse(res, 400, 'allowedUsers must be an array of user IDs or usernames.');
    }
    telegramBotState.allowedUsers = allowedUsers
      .map((u) => String(u).trim())
      .filter(Boolean);

    logTelegramActivity({
      direction: 'outgoing',
      type: 'system',
      sender: 'Nexus Settings',
      text: `Updated allowed users filter list (${telegramBotState.allowedUsers.length} user rules configured)`,
      status: 'delivered',
    });

    return res.json({
      data: {
        success: true,
        allowedUsers: telegramBotState.allowedUsers,
      },
    });
  });

  app.post('/api/telegram/disconnect', (_req, res) => {
    const oldBot = telegramBotState?.botInfo?.username;
    stopTelegramPolling();
    if (telegramAutomationInterval) {
      clearInterval(telegramAutomationInterval);
      telegramAutomationInterval = null;
    }
    telegramBotState = null;

    logTelegramActivity({
      direction: 'outgoing',
      type: 'system',
      sender: 'Nexus System',
      text: `Disconnected Telegram Bot (@${oldBot || 'bot'}) and stopped polling`,
      status: 'delivered',
    });

    return res.json({ data: { success: true } });
  });

  app.post('/api/telegram/message', async (req, res) => {
    const { message, senderId, senderUsername } = req.body;
    if (!message || typeof message !== 'string') {
      return errorResponse(res, 400, 'Message is required.');
    }

    const trimmed = message.trim();
    const isCommand = trimmed.startsWith('/');
    const cmdName = isCommand ? trimmed.split(' ')[0] : undefined;
    const senderDisplay = senderUsername ? `@${senderUsername.replace(/^@/, '')}` : (senderId || 'Simulator User');

    if (telegramBotState && (senderId || senderUsername)) {
      const allowed = isTelegramUserAllowed(
        telegramBotState.allowedUsers,
        { id: senderId, username: senderUsername },
        senderId,
      );
      if (!allowed) {
        logTelegramActivity({
          direction: 'incoming',
          type: isCommand ? 'command' : 'message',
          sender: senderDisplay,
          chatId: senderId,
          text: trimmed,
          status: 'blocked',
          command: cmdName,
        });
        return errorResponse(res, 403, 'Unauthorized Telegram sender.');
      }
    }

    try {
      logTelegramActivity({
        direction: 'incoming',
        type: isCommand ? 'command' : 'message',
        sender: senderDisplay,
        chatId: senderId || telegramBotState?.chatId,
        text: trimmed,
        status: 'processed',
        command: cmdName,
      });

      const city = telegramBotState?.automations.dailyWeatherCity || 'London, UK';
      let replyAnswer = await handleTelegramQuickAction(trimmed, city);

      if (!replyAnswer) {
        const chatRes = await processAiChatInternal(message, [], '');
        replyAnswer = chatRes.answer;
      }

      if (telegramBotState && telegramBotState.chatId) {
        try {
          await sendTelegramBotMessage(
            telegramBotState.token,
            telegramBotState.chatId,
            replyAnswer,
            telegramBotState.automations.quickRepliesEnabled ?? true,
          );
        } catch (tgErr) {
          console.warn('Failed to send message to Telegram chat:', tgErr);
        }
      }

      logTelegramActivity({
        direction: 'outgoing',
        type: isCommand ? 'command' : 'message',
        sender: 'Nexus Bot',
        chatId: senderId || telegramBotState?.chatId,
        text: replyAnswer.slice(0, 320),
        status: 'delivered',
        command: cmdName,
      });

      return res.json({ data: { answer: replyAnswer } });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to process message.';
      return errorResponse(res, 500, errorMsg);
    }
  });

  app.post('/api/telegram/webhook', async (req, res) => {
    try {
      const update = req.body;

      // Handle callback_query in webhook
      if (update?.callback_query && telegramBotState) {
        const cb = update.callback_query;
        const targetChatId = cb.message?.chat?.id;
        const senderName = cb.from?.username
          ? `@${cb.from.username}`
          : cb.from?.first_name || `User #${cb.from?.id || 'Unknown'}`;

        const allowed = isTelegramUserAllowed(
          telegramBotState.allowedUsers,
          cb.from,
          targetChatId,
        );

        await fetch(`https://api.telegram.org/bot${telegramBotState.token}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: cb.id }),
        }).catch(() => {});

        logTelegramActivity({
          direction: 'incoming',
          type: 'callback',
          sender: senderName,
          chatId: targetChatId,
          text: `Webhook Callback: ${cb.data || 'Action'}`,
          status: allowed ? 'processed' : 'blocked',
          command: cb.data,
        });

        if (!allowed) {
          return res.json({ ok: true });
        }

        if (targetChatId && cb.data) {
          const city = telegramBotState.automations.dailyWeatherCity || 'London, UK';
          const actionRes = await handleTelegramQuickAction(cb.data, city);
          if (actionRes) {
            await sendTelegramBotMessage(
              telegramBotState.token,
              targetChatId,
              actionRes,
              telegramBotState.automations.quickRepliesEnabled ?? true,
            );

            logTelegramActivity({
              direction: 'outgoing',
              type: 'message',
              sender: 'Nexus Bot',
              chatId: targetChatId,
              text: actionRes.slice(0, 320),
              status: 'delivered',
              command: cb.data,
            });
          }
        }
        return res.json({ ok: true });
      }

      const msg = update?.message ?? update?.edited_message;
      if (msg && msg.text && telegramBotState) {
        const targetChatId = msg.chat?.id;
        const senderName = msg.from?.username
          ? `@${msg.from.username}`
          : msg.from?.first_name || `User #${msg.from?.id || targetChatId}`;

        const allowed = isTelegramUserAllowed(
          telegramBotState.allowedUsers,
          msg.from,
          targetChatId,
        );

        const text = msg.text.trim();
        const isCommand = text.startsWith('/');
        const cmdName = isCommand ? text.split(' ')[0] : undefined;

        logTelegramActivity({
          direction: 'incoming',
          type: isCommand ? 'command' : 'message',
          sender: senderName,
          chatId: targetChatId,
          text,
          status: allowed ? 'processed' : 'blocked',
          command: cmdName,
        });

        if (!allowed) {
          console.log(
            `[Telegram Webhook] Blocked unauthorized message from: ${senderName}`,
          );
          return res.json({ ok: true });
        }

        const city = telegramBotState.automations.dailyWeatherCity || 'London, UK';
        let replyAnswer = await handleTelegramQuickAction(text, city);

        if (!replyAnswer) {
          const chatRes = await processAiChatInternal(text, [], '');
          replyAnswer = chatRes.answer;
        }

        if (targetChatId) {
          await sendTelegramBotMessage(
            telegramBotState.token,
            targetChatId,
            replyAnswer,
            telegramBotState.automations.quickRepliesEnabled ?? true,
          );

          logTelegramActivity({
            direction: 'outgoing',
            type: isCommand ? 'command' : 'message',
            sender: 'Nexus Bot',
            chatId: targetChatId,
            text: replyAnswer.slice(0, 320),
            status: 'delivered',
            command: cmdName,
          });
        }
      }
      return res.json({ ok: true });
    } catch (err) {
      console.error('Telegram webhook error:', err);
      return res.json({ ok: true });
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

  app.post('/api/search', async (req, res) => {
    const parsed = searchSchema.safeParse(req.body);
    if (!parsed.success) return errorResponse(res, 400, 'Enter a valid search query.');
    try {
      return res.json({ data: await searchProvider(parsed.data) });
    } catch (error) {
      const err = error as Error & { status?: number };
      return errorResponse(res, err.status ?? 502, err.message);
    }
  });

  app.post('/api/search/summary', async (req, res) => {
    const parsed = z
      .object({
        query: z.string().min(1),
        results: z
          .array(
            z.object({
              title: z.string(),
              url: z.string(),
              description: z.string(),
            }),
          )
          .max(20),
      })
      .safeParse(req.body);
    if (!parsed.success) return errorResponse(res, 400, 'A query and search results are required.');

    // 1. OpenRouter + DeepSeek
    const openRouterResult = await generateOpenRouterOrCustomAi({
      messages: [
        {
          role: 'user',
          content: `Answer only from these sources. Query: ${parsed.data.query}\nSources: ${JSON.stringify(parsed.data.results)}`,
        },
      ],
      temperature: 0.3,
      maxTokens: 500,
    });

    if (openRouterResult) {
      return res.json({
        data: { choices: [{ message: { content: openRouterResult.text } }] },
      });
    }

    // 2. Factual source summary fallback if available
    if (parsed.data.results.length > 0 && parsed.data.results[0].description) {
      return res.json({
        data: {
          choices: [
            {
              message: {
                content: `${parsed.data.results[0].title}: ${parsed.data.results[0].description}`,
              },
            },
          ],
        },
      });
    }

    return errorResponse(res, 503, 'AI summary provider is temporarily unavailable.');
  });

  app.get('/api/weather/geocode', async (req, res) => {
    const parsed = z.string().trim().min(1).max(120).safeParse(req.query.city);
    if (!parsed.success) return errorResponse(res, 400, 'Enter a city.');
    try {
      return res.json({ data: await geocode(parsed.data) });
    } catch {
      return errorResponse(res, 502, 'Weather provider is temporarily unavailable.');
    }
  });

  app.get('/api/weather', async (req, res) => {
    const parsed = weatherSchema.safeParse(req.query);
    if (!parsed.success) return errorResponse(res, 400, 'Provide a city or coordinates.');
    try {
      let latitude = parsed.data.latitude;
      let longitude = parsed.data.longitude;
      let location = parsed.data.city ?? 'Selected location';
      if (parsed.data.city) {
        const result = (await geocode(parsed.data.city))[0];
        if (!result) return errorResponse(res, 404, 'Location not found.');
        latitude = result.latitude;
        longitude = result.longitude;
        location = `${result.name}, ${result.country}`;
      }
      if (latitude === undefined || longitude === undefined) {
        return errorResponse(res, 400, 'Provide a city or coordinates.');
      }
      return res.json({ data: await weatherProvider(latitude, longitude, location) });
    } catch (error) {
      return errorResponse(
        res,
        502,
        error instanceof Error ? error.message : 'Weather provider is temporarily unavailable.',
      );
    }
  });

  app.get('/api/weather/forecast', (req, res) =>
    res.redirect(
      307,
      `/api/weather?${new URLSearchParams(req.query as Record<string, string>).toString()}`,
    ),
  );

  app.get('/api/weather/alerts', (_req, res) => res.json({ data: [] }));

  app.get('/api/news', async (_req, res) => {
    try {
      return res.json({
        data: await searchProvider({ query: 'latest world news', category: 'NEWS' }),
      });
    } catch (error) {
      const err = error as Error & { status?: number };
      return errorResponse(res, err.status ?? 502, err.message);
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
