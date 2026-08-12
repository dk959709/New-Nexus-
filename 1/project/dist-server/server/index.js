import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { z } from 'zod';
const app = express();
const port = Number(process.env.PORT ?? 8787);
const searchSchema = z.object({ query: z.string().trim().min(1).max(300), page: z.number().int().positive().optional(), category: z.enum(['ALL', 'NEWS', 'IMAGES', 'VIDEOS', 'SHOPPING']).optional(), region: z.string().optional(), language: z.string().optional() });
const weatherQuery = z.object({ city: z.string().trim().min(1).max(120).optional(), latitude: z.coerce.number().min(-90).max(90).optional(), longitude: z.coerce.number().min(-180).max(180).optional() });
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));
app.use(express.static('dist'));
function sendError(res, status, error) { res.status(status).json({ error }); }
function domainOf(url) { try {
    return new URL(url).hostname.replace(/^www\./, '');
}
catch {
    return '';
} }
async function providerSearch(input) {
    const key = process.env.SEARCH_API_KEY;
    const url = process.env.SEARCH_API_URL;
    if (!key || !url)
        throw Object.assign(new Error('Search API is not configured.'), { status: 503 });
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'X-API-Key': key }, body: JSON.stringify({ query: input.query, page: input.page ?? 1, category: input.category ?? 'ALL', region: input.region, language: input.language }) });
    if (!response.ok)
        throw Object.assign(new Error('Search service is temporarily unavailable.'), { status: 502 });
    const raw = await response.json();
    const list = raw.results ?? raw.organic_results ?? raw.news ?? [];
    return list.map((item) => { const resultUrl = String(item.url ?? item.link ?? ''); return { title: String(item.title ?? ''), url: resultUrl, domain: domainOf(resultUrl), description: String(item.description ?? item.snippet ?? ''), favicon: item.favicon ? String(item.favicon) : undefined, date: item.date ? String(item.date) : undefined, type: (input.category ?? 'ALL').toLowerCase().replace('all', 'web') }; }).filter((item) => item.title && item.url);
}
async function geocode(city) {
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=en&format=json`);
    if (!response.ok)
        throw new Error('Weather service is temporarily unavailable.');
    const data = await response.json();
    return data.results ?? [];
}
function weatherCode(code) { if (code === 0)
    return ['clear', 'Clear sky']; if ([1, 2, 3].includes(code))
    return ['partly-cloudy', 'Partly cloudy']; if ([45, 48].includes(code))
    return ['fog', 'Fog']; if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return ['rain', 'Rain']; if ([71, 73, 75, 77, 85, 86].includes(code))
    return ['snow', 'Snow']; if ([95, 96, 99].includes(code))
    return ['storm', 'Thunderstorm']; return ['cloudy', 'Cloudy']; }
async function openMeteoWeather(latitude, longitude, location) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,surface_pressure,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset&timezone=auto&forecast_days=7`;
    const response = await fetch(url);
    if (!response.ok)
        throw new Error('Weather service is temporarily unavailable.');
    const data = await response.json();
    const currentCondition = weatherCode(Number(data.current.weather_code));
    const hourly = data.hourly.time.slice(0, 12).map((time, index) => { const condition = weatherCode(Number(data.hourly.weather_code[index])); return { time: String(time), temperature: Number(data.hourly.temperature_2m[index]), condition: condition[0], rainProbability: Number(data.hourly.precipitation_probability[index]), wind: Number(data.hourly.wind_speed_10m[index]) }; });
    const daily = data.daily.time.map((day, index) => { const condition = weatherCode(Number(data.daily.weather_code[index])); return { day: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(new Date(String(day))), high: Number(data.daily.temperature_2m_max[index]), low: Number(data.daily.temperature_2m_min[index]), condition: condition[0], conditionLabel: condition[1], rainProbability: Number(data.daily.precipitation_probability_max[index]), wind: Number(data.daily.wind_speed_10m_max[index]) }; });
    return { current: { location, temperature: Number(data.current.temperature_2m), feelsLike: Number(data.current.apparent_temperature), condition: currentCondition[0], conditionLabel: currentCondition[1], humidity: Number(data.current.relative_humidity_2m), wind: Number(data.current.wind_speed_10m), pressure: Number(data.current.surface_pressure), visibility: 10, uvIndex: 0, sunrise: String(data.daily.sunrise[0]).split('T')[1], sunset: String(data.daily.sunset[0]).split('T')[1], rainProbability: Number(data.daily.precipitation_probability_max[0]), updatedAt: new Date().toISOString(), latitude, longitude }, hourly, daily, alerts: [] };
}
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'nexus-api', time: new Date().toISOString() }));
app.get('/api/config/status', (_req, res) => res.json({ data: { search: Boolean(process.env.SEARCH_API_KEY && process.env.SEARCH_API_URL), weather: true, map: Boolean(process.env.MAP_API_KEY), ai: Boolean(process.env.AI_API_KEY && process.env.AI_API_URL) } }));
app.post('/api/search', async (req, res) => { const parsed = searchSchema.safeParse(req.body); if (!parsed.success)
    return sendError(res, 400, 'Enter a valid search query.'); try {
    return res.json({ data: await providerSearch(parsed.data) });
}
catch (error) {
    const err = error;
    return sendError(res, err.status ?? 502, err.message.includes('configured') ? err.message : 'Search service is temporarily unavailable.');
} });
app.post('/api/search/summary', async (req, res) => { const input = z.object({ query: z.string().min(1), results: z.array(z.object({ title: z.string(), url: z.string(), description: z.string() })).max(20) }).safeParse(req.body); if (!input.success)
    return sendError(res, 400, 'A query and search results are required.'); const key = process.env.AI_API_KEY; const url = process.env.AI_API_URL; if (!key || !url)
    return sendError(res, 503, 'AI summary is currently unavailable.'); try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: process.env.AI_MODEL, messages: [{ role: 'user', content: `Answer only from these sources. Query: ${input.data.query}\nSources: ${JSON.stringify(input.data.results)}` }] }) });
    if (!response.ok)
        throw new Error();
    return res.json({ data: await response.json() });
}
catch {
    return sendError(res, 502, 'AI summary is currently unavailable.');
} });
app.get('/api/weather/geocode', async (req, res) => { const city = z.string().trim().min(1).max(120).safeParse(req.query.city); if (!city.success)
    return sendError(res, 400, 'Enter a city.'); try {
    res.json({ data: await geocode(city.data) });
}
catch {
    sendError(res, 502, 'Weather service is temporarily unavailable.');
} });
app.get('/api/weather', async (req, res) => { const parsed = weatherQuery.safeParse(req.query); if (!parsed.success)
    return sendError(res, 400, 'Provide a city or coordinates.'); try {
    let latitude = parsed.data.latitude;
    let longitude = parsed.data.longitude;
    let location = parsed.data.city ?? 'Selected location';
    if (parsed.data.city) {
        const result = (await geocode(parsed.data.city))[0];
        if (!result)
            return sendError(res, 404, 'Location not found.');
        latitude = result.latitude;
        longitude = result.longitude;
        location = `${result.name}, ${result.country}`;
    }
    if (latitude === undefined || longitude === undefined)
        return sendError(res, 400, 'Provide a city or coordinates.');
    res.json({ data: await openMeteoWeather(latitude, longitude, location) });
}
catch (error) {
    sendError(res, 502, error instanceof Error ? error.message : 'Weather service is temporarily unavailable.');
} });
app.get('/api/weather/forecast', (req, res) => res.redirect(307, `/api/weather?${new URLSearchParams(req.query).toString()}`));
app.get('/api/weather/alerts', (_req, res) => res.json({ data: [] }));
app.get('/api/news', async (_req, res) => { try {
    res.json({ data: await providerSearch({ query: 'latest world news', category: 'NEWS' }) });
}
catch (error) {
    const err = error;
    sendError(res, err.status ?? 502, err.message.includes('configured') ? err.message : 'News service is temporarily unavailable.');
} });
app.use((_req, res) => sendError(res, 404, 'Not found.'));
app.use((error, _req, res, _next) => { void _next; console.error(error); sendError(res, 500, 'Something went wrong.'); });
app.listen(port, () => console.log(`NEXUS API listening on ${port}`));
