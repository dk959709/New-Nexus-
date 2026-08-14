import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { z } from 'zod';

const app = express();
const port = Number(process.env.PORT ?? 8787);
const searchSchema = z.object({ query: z.string().trim().min(1).max(300), page: z.number().int().positive().optional(), category: z.enum(['ALL', 'NEWS', 'IMAGES', 'VIDEOS', 'SHOPPING']).optional(), region: z.string().optional(), language: z.string().optional() });
const weatherSchema = z.object({ city: z.string().trim().min(1).max(120).optional(), latitude: z.coerce.number().min(-90).max(90).optional(), longitude: z.coerce.number().min(-180).max(180).optional() });

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));
const pathToDist = new URL('../dist/', import.meta.url).pathname;
app.use(express.static(pathToDist));

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

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'nexus-api', time: new Date().toISOString() }));
app.get('/api/config/status', (_req, res) => res.json({ data: { search: Boolean(process.env.SEARCH_API_KEY && process.env.SEARCH_API_URL), weather: true, map: Boolean(process.env.MAP_API_KEY), ai: Boolean(process.env.AI_API_KEY && process.env.AI_API_URL) } }));

const mapTileSchema = z.object({ layer: z.enum(['temp_new', 'precipitation_new', 'clouds_new', 'wind_new', 'pressure_new']), z: z.coerce.number().int().min(0).max(18), x: z.coerce.number().int(), y: z.coerce.number().int() });
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

app.get('/{*splat}', (_req, res) => {
  return res.sendFile(new URL('../dist/index.html', import.meta.url).pathname);
});

app.use((_req, res) => errorResponse(res, 404, 'Not found.'));
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => { void _next; console.error(error); return errorResponse(res, 500, 'Something went wrong.'); });
app.listen(port, () => console.log(`NEXUS API listening on ${port}`));
