import { Droplets, Eye, Gauge, Sunrise, Sunset, Wind } from 'lucide-react';
import type { DailyForecast, HourlyForecast, WeatherSnapshot } from '@/types';
import { formatTemp, formatTime, formatWind } from '@/lib/format';
import { WeatherIcon } from '@/components/WeatherIcon';

export function CurrentWeather({ data, tempUnit, windUnit }: { data: WeatherSnapshot; tempUnit: 'celsius' | 'fahrenheit'; windUnit: 'kmh' | 'mph' }) {
  const metrics = [[Droplets, 'Humidity', `${data.humidity}%`], [Wind, 'Wind', formatWind(data.wind, windUnit)], [Gauge, 'Pressure', `${data.pressure} hPa`], [Eye, 'Visibility', `${data.visibility} km`]] as const;
  return <section className="current-weather panel-glass"><div className="weather-heading"><div><span className="eyebrow">CURRENT CONDITIONS</span><h2>{data.location}</h2><p>{data.conditionLabel} · Updated {formatTime(data.updatedAt)}</p></div><WeatherIcon condition={data.condition} size={62} /></div><div className="temperature-line"><strong>{formatTemp(data.temperature, tempUnit)}</strong><span>Feels like {formatTemp(data.feelsLike, tempUnit)}</span></div><div className="weather-metrics">{metrics.map(([Icon, label, value]) => <div key={label}><Icon size={17} /><span>{label}</span><b>{value}</b></div>)}</div><div className="sun-line"><span><Sunrise size={16} /> {data.sunrise}</span><span>UV {data.uvIndex}</span><span><Sunset size={16} /> {data.sunset}</span></div></section>;
}

export function HourlyForecast({ items, tempUnit, windUnit }: { items: HourlyForecast[]; tempUnit: 'celsius' | 'fahrenheit'; windUnit: 'kmh' | 'mph' }) {
  return <section><div className="section-title"><div><span className="eyebrow">NEXT 24 HOURS</span><h3>Hourly forecast</h3></div><span className="section-note">Rain probability</span></div><div className="hourly-scroll">{items.map((item) => <div className="hour-card" key={item.time}><span>{formatTime(item.time)}</span><WeatherIcon condition={item.condition} size={26} /><b>{formatTemp(item.temperature, tempUnit)}</b><small>{item.rainProbability}% rain</small><em>{formatWind(item.wind, windUnit)}</em></div>)}</div></section>;
}

export function DailyForecast({ items, tempUnit, windUnit }: { items: DailyForecast[]; tempUnit: 'celsius' | 'fahrenheit'; windUnit: 'kmh' | 'mph' }) {
  return <section><div className="section-title"><div><span className="eyebrow">EXTENDED OUTLOOK</span><h3>7-day forecast</h3></div></div><div className="daily-list">{items.map((item) => <div className="day-row" key={item.day}><strong>{item.day}</strong><WeatherIcon condition={item.condition} size={28} /><span className="day-condition">{item.conditionLabel}</span><small>{item.rainProbability}% rain</small><b>{formatTemp(item.high, tempUnit)} <i>{formatTemp(item.low, tempUnit)}</i></b><em>{formatWind(item.wind, windUnit)}</em></div>)}</div></section>;
}
