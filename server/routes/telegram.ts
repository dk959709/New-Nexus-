import { Router } from 'express';
import { errorResponse } from '../shared.js';
import { geocode, weatherProvider } from './weather.js';
import { searchProvider, fetchWikipediaSummary } from './search.js';

export interface TelegramAutomationsState {
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

export const defaultAutomations: TelegramAutomationsState = {
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

export interface TelegramActivityItem {
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

export const telegramActivityLog: TelegramActivityItem[] = [];

export function logTelegramActivity(item: Omit<TelegramActivityItem, 'id' | 'timestamp'>) {
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

export const telegramCommandsList = [
  { command: 'weather', description: 'Get live weather, temperature & forecast' },
  { command: 'search', description: 'Search the web with AI synthesized answers' },
  { command: 'news', description: 'Get the latest top news headlines' },
  { command: 'space', description: 'View ISS orbit position & moon phase' },
  { command: 'help', description: 'Show available commands & assistance guide' },
  { command: 'start', description: 'Start conversation with Nexus Bot' },
];

export async function registerTelegramCommands(token: string): Promise<boolean> {
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

export let telegramBotState: {
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

export type TelegramAiHandler = (message: string) => Promise<{ answer: string }>;
let telegramAiHandler: TelegramAiHandler | null = null;

export function setTelegramAiHandler(handler: TelegramAiHandler) {
  telegramAiHandler = handler;
}

function markUpdateAsProcessed(updateId: number): boolean {
  if (processedUpdateIds.has(updateId)) {
    return false;
  }
  processedUpdateIds.add(updateId);
  if (processedUpdateIds.size > PROCESSED_IDS_MAX_SIZE) {
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

export async function sendTelegramBotMessage(
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

export async function handleTelegramQuickAction(action: string, defaultCity = 'London, UK'): Promise<string> {
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
      const [wikiArticle, searchRes] = await Promise.all([
        fetchWikipediaSummary(query).catch(() => null),
        searchProvider({ query, category: 'ALL' }).catch(() => null),
      ]);

      const webResults = searchRes && 'results' in searchRes ? searchRes.results : [];
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
      const searchRes = await searchProvider({ query: 'latest top news headlines', category: 'NEWS' });
      const results = searchRes?.results ?? [];
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

export function isTelegramUserAllowed(
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

export function stopTelegramPolling() {
  if (telegramPollingController) {
    telegramPollingController.abort();
    telegramPollingController = null;
  }
  telegramPollingActive = false;
  currentPollingToken = '';
}

export function startTelegramPolling(token: string) {
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
            offset = Math.max(offset, update.update_id + 1);

            if (!markUpdateAsProcessed(update.update_id)) {
              console.log(`[Telegram Polling] Skipping duplicate update_id ${update.update_id}`);
              continue;
            }

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
              let replyAnswer = '';
              if (telegramAiHandler) {
                const chatRes = await telegramAiHandler(msg.text);
                replyAnswer = chatRes.answer;
              } else {
                replyAnswer = 'Hello! Nexus AI Assistant is currently connecting. Please ask your question in a moment.';
              }

              await sendTelegramBotMessage(
                token,
                targetChatId,
                replyAnswer,
                telegramBotState?.automations.quickRepliesEnabled ?? true,
              );

              logTelegramActivity({
                direction: 'outgoing',
                type: 'message',
                sender: 'Nexus Bot',
                chatId: targetChatId,
                text: replyAnswer.slice(0, 320),
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

export function startAutomationScheduler() {
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

export const telegramRouter = Router();

telegramRouter.post('/api/telegram/connect', async (req, res) => {
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

telegramRouter.get('/api/telegram/status', (_req, res) => {
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

telegramRouter.get('/api/telegram/commands', (_req, res) => {
  return res.json({
    data: {
      commands: telegramCommandsList,
      registered: Boolean(telegramBotState),
    },
  });
});

telegramRouter.post('/api/telegram/commands/sync', async (_req, res) => {
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

telegramRouter.get('/api/telegram/activity', (_req, res) => {
  return res.json({
    data: {
      activities: telegramActivityLog,
    },
  });
});

telegramRouter.post('/api/telegram/activity/clear', (_req, res) => {
  telegramActivityLog.length = 0;
  return res.json({
    data: {
      success: true,
    },
  });
});

telegramRouter.get('/api/telegram/automations', (_req, res) => {
  return res.json({
    data: {
      automations: telegramBotState?.automations || defaultAutomations,
      connected: Boolean(telegramBotState),
    },
  });
});

telegramRouter.post('/api/telegram/automations', (req, res) => {
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

telegramRouter.post('/api/telegram/test-alert', async (req, res) => {
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

telegramRouter.post('/api/telegram/allowed-users', (req, res) => {
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

telegramRouter.post('/api/telegram/disconnect', (_req, res) => {
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

telegramRouter.post('/api/telegram/message', async (req, res) => {
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
      if (telegramAiHandler) {
        const chatRes = await telegramAiHandler(message);
        replyAnswer = chatRes.answer;
      } else {
        replyAnswer = 'Hello! Nexus AI Assistant is currently processing. Please try again in a moment.';
      }
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

telegramRouter.post('/api/telegram/webhook', async (req, res) => {
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
        if (telegramAiHandler) {
          const chatRes = await telegramAiHandler(text);
          replyAnswer = chatRes.answer;
        } else {
          replyAnswer = 'Hello! Nexus AI Assistant is currently processing. Please try again in a moment.';
        }
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

export default telegramRouter;
