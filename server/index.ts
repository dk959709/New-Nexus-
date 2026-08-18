import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { resolve } from 'node:path';
import { z } from 'zod';

const app = express();
const port = Number(process.env.PORT ?? 8787);
const searchSchema = z.object({ query: z.string().trim().min(1).max(300), page: z.number().int().positive().optional(), category: z.enum(['ALL', 'NEWS', 'IMAGES', 'VIDEOS', 'SHOPPING']).optional(), region: z.string().optional(), language: z.string().optional() });
const weatherSchema = z.object({ city: z.string().trim().min(1).max(120).optional(), latitude: z.coerce.number().min(-90).max(90).optional(), longitude: z.coerce.number().min(-180).max(180).optional() });

app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      imgSrc: ["'self'", "data:", "blob:", "https://images.pexels.com"],
      scriptSrc: ["'self'", "'wasm-unsafe-eval'", "blob:", "https://cdn.jsdelivr.net"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://huggingface.co"],
      workerSrc: ["'self'", "blob:"],
    },
  },
}));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));
const pathToDist = resolve(process.cwd(), 'dist');
app.use(express.static(pathToDist, {
  setHeaders: (res, filePath) => {
    if (
      filePath.endsWith('index.html') ||
      filePath.endsWith('sw.js') ||
      filePath.endsWith('manifest.json')
    ) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (filePath.includes('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

function errorResponse(res: Response, status: number, message: string) { return res.status(status).json({ error: message }); }
function domainOf(url: string) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }

async function searchProvider(input: z.infer<typeof searchSchema>) {
  const key = process.env.SEARCH_API_KEY;
  const url = process.env.SEARCH_API_URL;
  if (!key || !url) throw Object.assign(new Error('Search provider is not configured.'), { status: 503 });
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'X-API-Key': key }, body: JSON.stringify({ query: input.query, page: input.page ?? 1, category: input.category ?? 'ALL', region: input.region, language: input.language, max_results: 20 }) });
  if (!response.ok) throw Object.assign(new Error('Search provider is temporarily unavailable.'), { status: 502 });
  const payload = await response.json() as { results?: Array<Record<string, unknown>>; organic_results?: Array<Record<string, unknown>>; news?: Array<Record<string, unknown>> };
  const items = payload.results ?? payload.organic_results ?? payload.news ?? [];
  const type = input.category === 'NEWS' ? 'news' : input.category === 'IMAGES' ? 'images' : input.category === 'VIDEOS' ? 'videos' : input.category === 'SHOPPING' ? 'shopping' : 'web';
  return items.map((item) => { const urlValue = String(item.url ?? item.link ?? ''); return { title: String(item.title ?? ''), url: urlValue, domain: domainOf(urlValue), description: String(item.description ?? item.snippet ?? ''), date: item.date ? String(item.date) : undefined, type }; }).filter((item) => item.title && item.url);
}

async function geocode(city: string) {
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=en&format=json`);
  if (!response.ok) throw new Error('Weather provider is temporarily unavailable.');
  const payload = await response.json() as { results?: Array<{ name: string; country: string; latitude: number; longitude: number }> };
  return payload.results ?? [];
}

function condition(code: number): ['clear' | 'partly-cloudy' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog', string] {
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
  const data = await response.json() as { current: Record<string, number>; hourly: Record<string, Array<number | string>>; daily: Record<string, Array<number | string>> };
  const currentCondition = condition(Number(data.current.weather_code));
  const hourly = data.hourly.time.slice(0, 12).map((time, index) => ({ time: String(time), temperature: Number(data.hourly.temperature_2m[index]), condition: condition(Number(data.hourly.weather_code[index]))[0], rainProbability: Number(data.hourly.precipitation_probability[index]), wind: Number(data.hourly.wind_speed_10m[index]) }));
  const daily = data.daily.time.map((day, index) => ({ day: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(new Date(String(day))), high: Number(data.daily.temperature_2m_max[index]), low: Number(data.daily.temperature_2m_min[index]), condition: condition(Number(data.daily.weather_code[index]))[0], conditionLabel: condition(Number(data.daily.weather_code[index]))[1], rainProbability: Number(data.daily.precipitation_probability_max[index]), wind: Number(data.daily.wind_speed_10m_max[index]) }));
  return { current: { location, temperature: Number(data.current.temperature_2m), feelsLike: Number(data.current.apparent_temperature), condition: currentCondition[0], conditionLabel: currentCondition[1], humidity: Number(data.current.relative_humidity_2m), wind: Number(data.current.wind_speed_10m), pressure: Number(data.current.surface_pressure), visibility: 10, uvIndex: 0, sunrise: String(data.daily.sunrise[0]).split('T')[1], sunset: String(data.daily.sunset[0]).split('T')[1], rainProbability: Number(data.daily.precipitation_probability_max[0]), updatedAt: new Date().toISOString(), latitude, longitude, isDay: Boolean(data.current.is_day) }, hourly, daily, alerts: [] };
}


// Same-origin proxy for the NEXUS Offline AI model.
// This avoids browser/CORS/fetch failures when Hugging Face redirects
// large ONNX files through its Xet storage layer.
app.get('/api/offline-model/:owner/:repo/*rest', async (req, res) => {
  try {
    const owner = String(req.params.owner);
    const repo = String(req.params.repo);
    const restParam = (req.params as any).rest;
    const rest = Array.isArray(restParam)
      ? restParam.join("/")
      : String(restParam ?? "");

    if (!owner || !repo || !rest) {
      return errorResponse(res, 400, 'Invalid offline model path.');
    }

    // Only allow the specific model used by NEXUS.
    if (owner !== 'HuggingFaceTB' || repo !== 'SmolLM2-135M-Instruct') {
      return errorResponse(res, 403, 'Offline model not allowed.');
    }

    // Transformers.js may request:
    // resolve/main/file/config.json
    // while Hugging Face expects:
    // resolve/main/config.json
    let normalizedRest = rest;

    if (normalizedRest.startsWith("resolve/")) {
      const parts = normalizedRest.split("/");
      const revision = parts[1] || "main";
      let file = parts.slice(2).join("/");

      if (file.startsWith("file/")) {
        file = file.slice(5);
      }

      normalizedRest = `resolve/${revision}/${file}`;
    } else if (normalizedRest.startsWith("revision/")) {
      const parts = normalizedRest.split("/");
      const revision = parts[1] || "main";
      let file = parts.slice(2).join("/");

      if (file.startsWith("file/")) {
        file = file.slice(5);
      }

      normalizedRest = `resolve/${revision}/${file}`;
    }

    const upstreamUrl =
      `https://huggingface.co/${owner}/${repo}/${normalizedRest}`;

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

    res.setHeader(
      'Cache-Control',
      'public, max-age=31536000, immutable',
    );
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

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'nexus-api', time: new Date().toISOString() }));
app.get('/api/config/status', (_req, res) => res.json({ data: { search: Boolean(process.env.SEARCH_API_KEY && process.env.SEARCH_API_URL), weather: true, map: Boolean(process.env.MAP_API_KEY), ai: Boolean(process.env.AI_API_KEY && process.env.AI_API_URL), wallpapers: Boolean(process.env.PEXELS_API_KEY) } }));


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
  history: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().max(8000),
    }),
  ).max(20).optional(),
  memory: z.string().max(1200).optional(),
});

app.post('/api/ai/chat', async (req, res) => {
  const parsed = aiChatSchema.safeParse(req.body);

  if (!parsed.success) {
    return errorResponse(res, 400, 'Enter a valid message.');
  }

  const key = process.env.AI_API_KEY;
  const url = process.env.AI_API_URL;
  const model = process.env.AI_MODEL ?? 'deepseek/deepseek-chat';

  if (!key || !url) {
    return errorResponse(
      res,
      503,
      'AI Assistant is not configured. Add AI_API_KEY and AI_API_URL to the server environment.',
    );
  }

  const message = parsed.data.message;
  const tool = detectAITool(message);

  let searchContext = '';
  let weatherContext = '';
  let weatherData: unknown = undefined;

  /*
   * NEXUS SEARCH TOOL
   */
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
          ...results.slice(0, 10).map(
            (item, index) =>
              `${index + 1}. ${item.title}\nURL: ${item.url}\nSource: ${item.domain}\nDescription: ${item.description}${item.date ? `\nDate: ${item.date}` : ''}`,
          ),
        ].join('\n\n');
      } else {
        searchContext =
          'NEXUS SEARCH returned no useful results for this request.';
      }
    } catch {
      searchContext =
        'NEXUS SEARCH is currently unavailable. Do not invent current information.';
    }
  }

  /*
   * NEXUS WEATHER TOOL
   *
   * Extract a city from common weather questions such as:
   * "weather in Chennai"
   * "temperature in Mumbai"
   * "what is the weather like in Delhi?"
   */
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
          weatherContext =
            `NEXUS WEATHER could not find the location "${city}".`;
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

  const memoryContext = parsed.data.memory?.trim()
    ? parsed.data.memory.slice(-1200)
    : '';

  const messages = [
    {
      role: 'system',
      content: [
        'You are NEXUS AI, the assistant inside the NEXUS Intelligence app.',
        'Give clear, useful and concise answers.',
        'Never pretend to have live information unless NEXUS tools provide it.',
        'When NEXUS SEARCH results are provided, answer current-information questions using those results.',
        'When NEXUS WEATHER data is provided, answer weather questions using that data.',
        'For current/news/search questions, summarize the actual returned search results instead of telling the user to visit websites.',
        'For weather questions, clearly state the location and relevant current weather values from the supplied weather data.',
        'If a NEXUS tool fails or has insufficient data, say so clearly instead of inventing information.',
        'Do not invent facts, URLs, dates, headlines, weather values, or sources.',
        memoryContext
          ? `Conversation memory:\n${memoryContext}`
          : '',
        searchContext
          ? `NEXUS SEARCH TOOL OUTPUT:\n${searchContext}`
          : '',
        weatherContext
          ? `NEXUS WEATHER TOOL OUTPUT:\n${weatherContext}`
          : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
    },
    ...(parsed.data.history ?? []),
    {
      role: 'user',
      content: message,
    },
  ];

  try {
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

    const payload = await upstream.json().catch(() => ({})) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
      error?: {
        message?: string;
      };
    };

    if (!upstream.ok) {
      return errorResponse(
        res,
        502,
        payload.error?.message ?? 'AI provider is temporarily unavailable.',
      );
    }

    const answer = payload.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      return errorResponse(res, 502, 'AI provider returned an empty response.');
    }

    return res.json({
      data: {
        answer,
        model,
        tool,
        ...(tool === 'search' && searchContext
          ? {
              sources: searchContext,
            }
          : {}),
        ...(tool === 'weather' && weatherData
          ? {
              weather: weatherData,
            }
          : {}),
      },
    });
  } catch {
    return errorResponse(res, 502, 'AI provider is temporarily unavailable.');
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
    const upstream = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(parsed.data.query)}&per_page=12&page=${parsed.data.page ?? 1}&orientation=landscape`, { headers: { Authorization: key } });
    if (!upstream.ok) return errorResponse(res, 502, 'Wallpaper provider is temporarily unavailable.');
    const payload = await upstream.json() as { photos?: Array<{ id: number; photographer: string; photographer_url: string; url: string; src: { landscape: string; large2x: string; original: string } }> };
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

const mapTileSchema = z.object({ layer: z.enum(['temp_new', 'precipitation_new', 'clouds_new', 'wind_new', 'pressure_new']), z: z.coerce.number().int().min(0).max(18), x: z.coerce.number().int(), y: z.coerce.number().int() });
app.get('/api/wallpaper-image/:id', async (req, res) => {
  const id = Number(req.params.id);
  const size = req.query.size === 'original'
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

    const photo = await search.json() as {
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
    const upstream = await fetch(`https://tile.openweathermap.org/map/${layer}/${z}/${x}/${y}.png?appid=${key}`);
    if (!upstream.ok) return errorResponse(res, 502, 'Map tile provider is temporarily unavailable.');
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=600');
    return res.send(buffer);
  } catch {
    return errorResponse(res, 502, 'Map tile provider is temporarily unavailable.');
  }
});
app.post('/api/search', async (req, res) => { const parsed = searchSchema.safeParse(req.body); if (!parsed.success) return errorResponse(res, 400, 'Enter a valid search query.'); try { return res.json({ data: await searchProvider(parsed.data) }); } catch (error) { const err = error as Error & { status?: number }; return errorResponse(res, err.status ?? 502, err.message); } });
app.post('/api/search/summary', async (req, res) => { const parsed = z.object({ query: z.string().min(1), results: z.array(z.object({ title: z.string(), url: z.string(), description: z.string() })).max(20) }).safeParse(req.body); if (!parsed.success) return errorResponse(res, 400, 'A query and search results are required.'); const key = process.env.AI_API_KEY; const url = process.env.AI_API_URL; if (!key || !url) return errorResponse(res, 503, 'AI summary is not configured.'); try { const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: process.env.AI_MODEL, messages: [{ role: 'user', content: `Answer only from these sources. Query: ${parsed.data.query}\nSources: ${JSON.stringify(parsed.data.results)}` }] }) }); if (!response.ok) throw new Error(); return res.json({ data: await response.json() }); } catch { return errorResponse(res, 502, 'AI summary is temporarily unavailable.'); } });
app.get('/api/weather/geocode', async (req, res) => { const parsed = z.string().trim().min(1).max(120).safeParse(req.query.city); if (!parsed.success) return errorResponse(res, 400, 'Enter a city.'); try { return res.json({ data: await geocode(parsed.data) }); } catch { return errorResponse(res, 502, 'Weather provider is temporarily unavailable.'); } });
app.get('/api/weather', async (req, res) => { const parsed = weatherSchema.safeParse(req.query); if (!parsed.success) return errorResponse(res, 400, 'Provide a city or coordinates.'); try { let latitude = parsed.data.latitude; let longitude = parsed.data.longitude; let location = parsed.data.city ?? 'Selected location'; if (parsed.data.city) { const result = (await geocode(parsed.data.city))[0]; if (!result) return errorResponse(res, 404, 'Location not found.'); latitude = result.latitude; longitude = result.longitude; location = `${result.name}, ${result.country}`; } if (latitude === undefined || longitude === undefined) return errorResponse(res, 400, 'Provide a city or coordinates.'); return res.json({ data: await weatherProvider(latitude, longitude, location) }); } catch (error) { return errorResponse(res, 502, error instanceof Error ? error.message : 'Weather provider is temporarily unavailable.'); } });
app.get('/api/weather/forecast', (req, res) => res.redirect(307, `/api/weather?${new URLSearchParams(req.query as Record<string, string>).toString()}`));
app.get('/api/weather/alerts', (_req, res) => res.json({ data: [] }));
app.get('/api/news', async (_req, res) => { try { return res.json({ data: await searchProvider({ query: 'latest world news', category: 'NEWS' }) }); } catch (error) { const err = error as Error & { status?: number }; return errorResponse(res, err.status ?? 502, err.message); } });
app.get('/api/nasa/apod', async (req, res) => {
  try {
    const apiKey = process.env.NASA_API_KEY;
    if (!apiKey) return errorResponse(res, 503, 'NASA API is not configured.');
    const response = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${apiKey}`);
    if (!response.ok) return errorResponse(res, 502, 'NASA data is temporarily unavailable.');
    return res.json({ data: await response.json() });
  } catch {
    return errorResponse(res, 502, 'NASA data is temporarily unavailable.');
  }
});


app.get('/api/space/moon', async (req, res) => {
  try {
    const now = new Date();
    const knownNewMoon = new Date('2000-01-06T18:14:00Z').getTime();
    const synodicMonth = 29.53058867;
    const daysSince = (now.getTime() - knownNewMoon) / (1000 * 60 * 60 * 24);
    const phaseIndex = ((daysSince % synodicMonth) + synodicMonth) % synodicMonth;
    const illumination = Math.round((1 - Math.cos((phaseIndex / synodicMonth) * 2 * Math.PI)) / 2 * 100);

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

    return res.json({ data: { phaseName, illumination, ageDays: Math.round(phaseIndex * 10) / 10 } });
  } catch {
    return errorResponse(res, 502, 'Moon phase data is temporarily unavailable.');
  }
});

app.get('/api/space/iss', async (req, res) => {
  try {
    const response = await fetch('http://api.open-notify.org/iss-now.json');
    if (!response.ok) return errorResponse(res, 502, 'ISS data is temporarily unavailable.');
    const json = await response.json();
    return res.json({ data: { latitude: parseFloat(json.iss_position.latitude), longitude: parseFloat(json.iss_position.longitude), timestamp: json.timestamp } });
  } catch {
    return errorResponse(res, 502, 'ISS data is temporarily unavailable.');
  }
});

app.get('/{*splat}', (_req, res) => {
  const indexPath = resolve(pathToDist, 'index.html');

  return res.sendFile(indexPath, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
});

app.use((_req, res) => errorResponse(res, 404, 'Not found.'));
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => { void _next; console.error(error); return errorResponse(res, 500, 'Something went wrong.'); });
app.listen(port, () => console.log(`NEXUS API listening on ${port}`));
