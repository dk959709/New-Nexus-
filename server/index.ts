import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { resolve } from 'node:path';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';

const searchSchema = z.object({
  query: z.string().trim().min(1).max(300),
  page: z.number().int().positive().optional(),
  category: z.enum(['ALL', 'NEWS', 'IMAGES', 'VIDEOS', 'SHOPPING']).optional(),
  region: z.string().optional(),
  language: z.string().optional(),
});

const weatherSchema = z.object({
  city: z.string().trim().min(1).max(120).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

function errorResponse(res: Response, status: number, message: string) {
  return res.status(status).json({ error: message });
}

function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
}

async function searchProvider(input: z.infer<typeof searchSchema>) {
  const key = process.env.SEARCH_API_KEY;
  const url = process.env.SEARCH_API_URL;
  if (!key || !url) {
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

function detectAITool(message: string): 'none' | 'search' | 'weather' {
  const text = message.toLowerCase().trim();

  const weatherPatterns = [
    /\bweather\b/,
    /\btemperature\b/,
    /\bforecast\b/,
    /\brain\b/,
    /\bsnow\b/,
    /\bhumidity\b/,
    /\bwind\b/,
    /\bclimate\b/,
    /\bhot\b/,
    /\bcold\b/,
  ];

  const searchPatterns = [
    /\bnews\b/,
    /\blatest\b/,
    /\btoday\b/,
    /\bcurrently\b/,
    /\bcurrent\b/,
    /\brecent\b/,
    /\bupdate\b/,
    /\bupdates\b/,
    /\bwhat happened\b/,
    /\bwho won\b/,
    /\bwho is\b/,
    /\bsearch\b/,
    /\blook up\b/,
  ];

  if (weatherPatterns.some((pattern) => pattern.test(text))) {
    return 'weather';
  }

  if (searchPatterns.some((pattern) => pattern.test(text))) {
    return 'search';
  }

  return 'none';
}

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
      return `🔍 *Nexus Web Search*\n\nUsage: \`/search <topic or question>\`\nExample: \`/search latest james webb telescope discoveries\`\n\nOr simply type any question directly into this chat!`;
    }

    try {
      const results = await searchProvider({ query, category: 'GENERAL' });
      if (results.length > 0) {
        const list = results
          .slice(0, 3)
          .map(
            (r, i) =>
              `${i + 1}. *${r.title}*\n   ${r.description.slice(0, 140)}...\n   🔗 [Read More](${r.url})`,
          )
          .join('\n\n');
        return `🔍 *Web Search Results for "${query}":*\n\n${list}`;
      }
      return `🔍 No web search results found for "${query}".`;
    } catch {
      return `🔍 Web search is temporarily unavailable.`;
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

async function processAiChatInternal(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  memory = '',
) {
  const tool = detectAITool(message);

  let searchContext = '';
  let weatherContext = '';
  let weatherData: unknown = undefined;

  if (tool === 'search') {
    try {
      const results = await searchProvider({
        query: message,
        page: 1,
        category: 'ALL',
      });

      if (results.length) {
        searchContext = [
          'LIVE NEXUS SEARCH RESULTS:',
          ...results
            .slice(0, 10)
            .map(
              (item, index) =>
                `${index + 1}. ${item.title}\nURL: ${item.url}\nSource: ${item.domain}\nDescription: ${item.description}${item.date ? `\nDate: ${item.date}` : ''}`,
            ),
        ].join('\n\n');
      } else {
        searchContext = 'NEXUS SEARCH returned no useful results for this request.';
      }
    } catch {
      searchContext =
        'NEXUS SEARCH is currently unavailable. Do not invent current information.';
    }
  }

  if (tool === 'weather') {
    try {
      const cityMatch = message.match(
        /\b(?:in|at|for|near)\s+([A-Za-z][A-Za-z .'-]{1,80}?)(?:\?|$| today| tomorrow| now| currently| right now)/i,
      );
      const city = cityMatch?.[1]?.trim();

      if (city) {
        const locations = await geocode(city);
        const location = locations[0];

        if (location) {
          weatherData = await weatherProvider(
            location.latitude,
            location.longitude,
            `${location.name}, ${location.country}`,
          );

          weatherContext = [
            'LIVE NEXUS WEATHER DATA:',
            JSON.stringify(weatherData),
            '',
            'Use this weather data as authoritative current weather information.',
            'Do not invent weather values.',
          ].join('\n');
        } else {
          weatherContext = `NEXUS WEATHER could not find the location "${city}".`;
        }
      } else {
        weatherContext =
          'NEXUS WEATHER detected a weather question, but no city could be identified.';
      }
    } catch {
      weatherContext =
        'NEXUS WEATHER is currently unavailable. Do not invent current weather information.';
    }
  }

  const memoryContext = memory.trim() ? memory.slice(-1200) : '';
  const systemPrompt = [
    'You are NEXUS AI, the assistant inside the NEXUS Intelligence app.',
    'Give clear, useful and concise answers.',
    'Never pretend to have live information unless NEXUS tools provide it.',
    'When NEXUS SEARCH results are provided, answer current-information questions using those results.',
    'When NEXUS WEATHER data is provided, answer weather questions using that data.',
    'For current/news/search questions, summarize the actual returned search results instead of telling the user to visit websites.',
    'For weather questions, clearly state the location and relevant current weather values from the supplied weather data.',
    'If a NEXUS tool fails or has insufficient data, say so clearly instead of inventing information.',
    'Do not invent facts, URLs, dates, headlines, weather values, or sources.',
    memoryContext ? `Conversation memory:\n${memoryContext}` : '',
    searchContext ? `NEXUS SEARCH TOOL OUTPUT:\n${searchContext}` : '',
    weatherContext ? `NEXUS WEATHER TOOL OUTPUT:\n${weatherContext}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const gemini = getGemini();
  if (gemini) {
    try {
      const contents = [
        ...history.map((h) => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }],
        })),
        {
          role: 'user',
          parts: [{ text: message }],
        },
      ];

      const response = await gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
        },
      });

      const answer = response.text?.trim();
      if (answer) {
        return {
          answer,
          model: 'gemini-2.5-flash',
          tool,
          ...(tool === 'search' && searchContext ? { sources: searchContext } : {}),
          ...(tool === 'weather' && weatherData ? { weather: weatherData } : {}),
        };
      }
    } catch (geminiError) {
      console.warn('Gemini chat failed, trying custom AI provider if available:', geminiError);
    }
  }

  const key = process.env.AI_API_KEY;
  const url = process.env.AI_API_URL;
  const model = process.env.AI_MODEL ?? 'deepseek/deepseek-chat';

  if (!key || !url) {
    throw new Error('AI Assistant is not configured. Add GEMINI_API_KEY or AI_API_KEY and AI_API_URL to the server environment.');
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message },
  ];

  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1200,
    }),
  });

  const payload = (await upstream.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (!upstream.ok) {
    throw new Error(payload.error?.message ?? 'AI provider is temporarily unavailable.');
  }

  const answer = payload.choices?.[0]?.message?.content?.trim();
  if (!answer) {
    throw new Error('AI provider returned an empty response.');
  }

  return {
    answer,
    model,
    tool,
    ...(tool === 'search' && searchContext ? { sources: searchContext } : {}),
    ...(tool === 'weather' && weatherData ? { weather: weatherData } : {}),
  };
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
          process.env.GEMINI_API_KEY || (process.env.AI_API_KEY && process.env.AI_API_URL),
        ),
        wallpapers: Boolean(process.env.PEXELS_API_KEY),
      },
    }),
  );

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
      );
      return res.json({ data: result });
    } catch (err: unknown) {
      const errorObj = err as { status?: number; message?: string };
      return errorResponse(res, errorObj.status || 500, errorObj.message || 'AI request failed.');
    }
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

    const gemini = getGemini();
    if (gemini) {
      try {
        const response = await gemini.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Answer only from these sources.\nQuery: ${parsed.data.query}\nSources: ${JSON.stringify(parsed.data.results)}`,
        });
        return res.json({ data: { choices: [{ message: { content: response.text } }] } });
      } catch {
        return errorResponse(res, 502, 'AI summary is temporarily unavailable.');
      }
    }

    const key = process.env.AI_API_KEY;
    const url = process.env.AI_API_URL;
    if (!key || !url) return errorResponse(res, 503, 'AI summary is not configured.');
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: process.env.AI_MODEL,
          messages: [
            {
              role: 'user',
              content: `Answer only from these sources. Query: ${parsed.data.query}\nSources: ${JSON.stringify(parsed.data.results)}`,
            },
          ],
        }),
      });
      if (!response.ok) throw new Error();
      return res.json({ data: await response.json() });
    } catch {
      return errorResponse(res, 502, 'AI summary is temporarily unavailable.');
    }
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
