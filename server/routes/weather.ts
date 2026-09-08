import { Router } from 'express';
import { z } from 'zod';
import { errorResponse } from '../shared.js';

export const weatherSchema = z.object({
  city: z.string().trim().min(1).max(120).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

export async function geocode(city: string) {
  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=en&format=json`,
  );
  if (!response.ok) throw new Error('Weather provider is temporarily unavailable.');
  const payload = (await response.json()) as {
    results?: Array<{ name: string; country: string; latitude: number; longitude: number }>;
  };
  return payload.results ?? [];
}

export function condition(
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

export function wttrCondition(
  descRaw: string,
): ['clear' | 'partly-cloudy' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog', string] {
  const desc = (descRaw || '').toLowerCase().trim();
  const label = descRaw ? descRaw.trim() : 'Cloudy';
  if (/thunder|storm|lightning/.test(desc)) return ['storm', label];
  if (/snow|sleet|blizzard|ice/.test(desc)) return ['snow', label];
  if (/rain|drizzle|shower|precipitation/.test(desc)) return ['rain', label];
  if (/fog|mist|haze|smoke|dust/.test(desc)) return ['fog', label];
  if (/clear|sunny/.test(desc)) return ['clear', label];
  if (/partly/.test(desc)) return ['partly-cloudy', label];
  if (/cloud|overcast/.test(desc)) return ['cloudy', label];
  return ['cloudy', label];
}

export function convert12to24(timeStr: string): string {
  if (!timeStr || typeof timeStr !== 'string') return '06:00';
  const parts = timeStr.trim().split(' ');
  if (parts.length < 2) return timeStr;
  const timePart = parts[0];
  const modifier = parts[1].toUpperCase();
  const timeSub = timePart.split(':');
  let hours = parseInt(timeSub[0], 10) || 0;
  const minutes = timeSub[1] || '00';
  if (modifier === 'PM' && hours < 12) {
    hours += 12;
  }
  if (modifier === 'AM' && hours === 12) {
    hours = 0;
  }
  const hh = String(hours).padStart(2, '0');
  return `${hh}:${minutes}`;
}

export async function fetchWttrInFallback(latitude: number, longitude: number, location: string) {
  const url = `https://wttr.in/${latitude},${longitude}?format=j1`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`wttr.in fallback failed with status ${res.status}`);
  }
  const data = (await res.json()) as Record<string, unknown>;

  const todayWeather = (data.weather as Array<Record<string, unknown>>)?.[0] || {};
  const dateStr = String(todayWeather.date || new Date().toISOString().split('T')[0]);
  const hourlyItems = Array.isArray(todayWeather.hourly) ? (todayWeather.hourly as Array<Record<string, unknown>>) : [];
  const hourly = hourlyItems.map((h: Record<string, unknown>) => {
    const rawTime = String(h?.time ?? '0');
    const padded = rawTime.padStart(4, '0');
    const hh = padded.slice(0, 2);
    const mm = padded.slice(2);
    const timeIso = `${dateStr}T${hh}:${mm}:00`;
    const weatherDescList = h?.weatherDesc as Array<Record<string, unknown>> | undefined;
    const desc = String(weatherDescList?.[0]?.value || 'Clear');
    const cond = wttrCondition(desc);
    return {
      time: timeIso,
      temperature: Number(h?.tempC) || 0,
      condition: cond[0],
      rainProbability: Number(h?.chanceofrain) || 0,
      wind: Number(h?.windspeedKmph) || 0,
    };
  });

  const dailyItems = Array.isArray(data.weather) ? (data.weather as Array<Record<string, unknown>>) : [];
  const daily = dailyItems.map((d: Record<string, unknown>) => {
    const dDate = String(d?.date || new Date().toISOString().split('T')[0]);
    const dHourly = Array.isArray(d?.hourly) ? (d.hourly as Array<Record<string, unknown>>) : [];
    const dHourly4Desc = (dHourly[4]?.weatherDesc as Array<Record<string, unknown>> | undefined)?.[0]?.value;
    const dHourly0Desc = (dHourly[0]?.weatherDesc as Array<Record<string, unknown>> | undefined)?.[0]?.value;
    const desc = String(dHourly4Desc || dHourly0Desc || 'Clear');
    const cond = wttrCondition(desc);
    let dayName = 'Today';
    try {
      dayName = new Intl.DateTimeFormat('en', { weekday: 'short' }).format(new Date(dDate));
    } catch {
      dayName = 'Today';
    }
    const dHourly0 = dHourly[0] || {};
    const rainChance = Number(dHourly0.chanceofrain) || 0;
    const windSpeed = Number(dHourly0.windspeedKmph) || 0;
    return {
      day: dayName || 'Today',
      high: Number(d?.maxtempC) || 30,
      low: Number(d?.mintempC) || 20,
      condition: cond[0],
      conditionLabel: cond[1],
      rainProbability: rainChance,
      wind: windSpeed,
    };
  });

  const astronomyList = todayWeather.astronomy as Array<Record<string, unknown>> | undefined;
  const astronomy = astronomyList?.[0] || {};
  const sunriseRaw = String(astronomy.sunrise || '05:55 AM');
  const sunsetRaw = String(astronomy.sunset || '06:53 PM');
  const sunrise = convert12to24(sunriseRaw);
  const sunset = convert12to24(sunsetRaw);

  const curList = data.current_condition as Array<Record<string, unknown>> | undefined;
  const cur = curList?.[0] || {};
  const curWeatherDesc = cur.weatherDesc as Array<Record<string, unknown>> | undefined;
  const curDesc = String(curWeatherDesc?.[0]?.value || 'Clear');
  const currentCondition = wttrCondition(curDesc);

  const tempVal = Number(cur.temp_C) || 25;
  const feelsVal = Number(cur.FeelsLikeC) || tempVal;
  const humVal = Number(cur.humidity) || 50;
  const windVal = Number(cur.windspeedKmph) || 5;
  const pressVal = Number(cur.pressure) || 1013;
  const visVal = Number(cur.visibility) || 10;
  const uvVal = Number(cur.uvIndex) || 0;
  const todayHourly = Array.isArray(todayWeather.hourly) ? (todayWeather.hourly as Array<Record<string, unknown>>) : [];
  const rainProbVal = Number(todayHourly[0]?.chanceofrain) || 0;

  return {
    current: {
      location: location || 'Unknown',
      temperature: tempVal,
      feelsLike: feelsVal,
      condition: currentCondition[0],
      conditionLabel: currentCondition[1],
      humidity: humVal,
      wind: windVal,
      pressure: pressVal,
      visibility: visVal,
      uvIndex: uvVal,
      sunrise,
      sunset,
      rainProbability: rainProbVal,
      updatedAt: new Date().toISOString(),
      latitude: Number(latitude) || 0,
      longitude: Number(longitude) || 0,
      isDay: true,
    },
    hourly: hourly.length > 0 ? hourly : [{
      time: `${dateStr}T00:00:00`,
      temperature: tempVal,
      condition: currentCondition[0],
      rainProbability: 0,
      wind: windVal,
    }],
    daily: daily.length > 0 ? daily : [{
      day: 'Today',
      high: tempVal + 5,
      low: tempVal - 5,
      condition: currentCondition[0],
      conditionLabel: currentCondition[1],
      rainProbability: 0,
      wind: windVal,
    }],
    alerts: [],
  };
}

export async function weatherProvider(latitude: number, longitude: number, location: string) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,surface_pressure,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset&timezone=auto&forecast_days=7`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Open-Meteo error status ${response.status}`);
    const data = (await response.json()) as {
      current: Record<string, number>;
      hourly: Record<string, Array<number | string>>;
      daily: Record<string, Array<number | string>>;
    };
    const currentCondition = condition(Number(data.current?.weather_code || 0));
    const hourly = (data.hourly?.time || []).slice(0, 12).map((time, index) => ({
      time: String(time || ''),
      temperature: Number(data.hourly.temperature_2m?.[index]) || 0,
      condition: condition(Number(data.hourly.weather_code?.[index] || 0))[0],
      rainProbability: Number(data.hourly.precipitation_probability?.[index]) || 0,
      wind: Number(data.hourly.wind_speed_10m?.[index]) || 0,
    }));
    const daily = (data.daily?.time || []).map((day, index) => ({
      day: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(new Date(String(day || Date.now()))),
      high: Number(data.daily.temperature_2m_max?.[index]) || 30,
      low: Number(data.daily.temperature_2m_min?.[index]) || 20,
      condition: condition(Number(data.daily.weather_code?.[index] || 0))[0],
      conditionLabel: condition(Number(data.daily.weather_code?.[index] || 0))[1],
      rainProbability: Number(data.daily.precipitation_probability_max?.[index]) || 0,
      wind: Number(data.daily.wind_speed_10m_max?.[index]) || 0,
    }));
    return {
      current: {
        location: location || 'Unknown',
        temperature: Number(data.current?.temperature_2m) || 25,
        feelsLike: Number(data.current?.apparent_temperature) || Number(data.current?.temperature_2m) || 25,
        condition: currentCondition[0],
        conditionLabel: currentCondition[1],
        humidity: Number(data.current?.relative_humidity_2m) || 50,
        wind: Number(data.current?.wind_speed_10m) || 5,
        pressure: Number(data.current?.surface_pressure) || 1013,
        visibility: 10,
        uvIndex: 0,
        sunrise: String(data.daily?.sunrise?.[0] || '').split('T')[1] || '06:00',
        sunset: String(data.daily?.sunset?.[0] || '').split('T')[1] || '18:00',
        rainProbability: Number(data.daily?.precipitation_probability_max?.[0]) || 0,
        updatedAt: new Date().toISOString(),
        latitude: Number(latitude) || 0,
        longitude: Number(longitude) || 0,
        isDay: Boolean(data.current?.is_day),
      },
      hourly: hourly.length > 0 ? hourly : [],
      daily: daily.length > 0 ? daily : [],
      alerts: [],
    };
  } catch (err) {
    console.warn('Open-Meteo failed, trying wttr.in fallback:', err);
    try {
      return await fetchWttrInFallback(latitude, longitude, location);
    } catch (fallbackErr) {
      console.error('wttr.in fallback also failed:', fallbackErr);
      throw err;
    }
  }
}

export const weatherRouter = Router();

weatherRouter.get('/api/weather/geocode', async (req, res) => {
  const parsed = z.string().trim().min(1).max(120).safeParse(req.query.city);
  if (!parsed.success) return errorResponse(res, 400, 'Enter a city.');
  try {
    return res.json({ data: await geocode(parsed.data) });
  } catch {
    return errorResponse(res, 502, 'Weather provider is temporarily unavailable.');
  }
});

weatherRouter.get('/api/weather', async (req, res) => {
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

weatherRouter.get('/api/weather/forecast', (req, res) =>
  res.redirect(
    307,
    `/api/weather?${new URLSearchParams(req.query as Record<string, string>).toString()}`,
  ),
);

weatherRouter.get('/api/weather/alerts', (_req, res) => res.json({ data: [] }));

export default weatherRouter;
