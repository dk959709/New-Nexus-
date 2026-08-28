import { CloudSun, Newspaper, Cpu, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatTemp, conditionLabel } from '@/lib/format';
import type { WeatherData, Settings } from '@/types';

interface NexusStatCardsProps {
  weather: WeatherData | null;
  settings: Settings;
  newsCount?: number;
}

export function NexusStatCards({
  weather,
  settings,
  newsCount = 18,
}: NexusStatCardsProps) {
  // Extract high/low from first daily forecast if available
  const todayForecast = weather?.daily?.[0];
  const highTemp = todayForecast ? formatTemp(todayForecast.high, settings.temperature) : '--';
  const lowTemp = todayForecast ? formatTemp(todayForecast.low, settings.temperature) : '--';
  const currentTemp = weather?.current?.temp != null
    ? formatTemp(weather.current.temp, settings.temperature)
    : '22°';
  const locationName = weather?.location?.name
    ? `${weather.location.name}${weather.location.country ? `, ${weather.location.country}` : ''}`
    : 'Local Terminal';
  const condition = weather?.current?.condition ? conditionLabel(weather.current.condition) : 'Clear Sky';

  return (
    <div
      id="nexus-stat-cards"
      className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 my-6 font-mono"
    >
      {/* 1. WEATHER STAT CARD (CYAN NEON) */}
      <Link
        to="/weather"
        className="group relative rounded-2xl border border-cyan-500/40 bg-[#030712]/90 p-5 shadow-[0_0_25px_rgba(6,182,212,0.12)] hover:border-cyan-400 hover:shadow-[0_0_35px_rgba(6,182,212,0.28)] transition-all duration-300 flex flex-col justify-between"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-cyan-400">
            <CloudSun size={18} className="group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold tracking-widest uppercase text-cyan-300">
              WEATHER
            </span>
          </div>
          <ArrowUpRight size={15} className="text-cyan-500/60 group-hover:text-cyan-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
        </div>

        <div className="my-2">
          <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-baseline gap-2">
            <span>{currentTemp}</span>
            <span className="text-sm font-normal text-cyan-400/80">{condition}</span>
          </div>
        </div>

        <div className="text-xs text-slate-400 flex items-center justify-between border-t border-cyan-500/15 pt-3 mt-1">
          <span className="truncate max-w-[160px] text-slate-300">{locationName}</span>
          <span className="text-cyan-300/90 font-semibold shrink-0">
            H: {highTemp} L: {lowTemp}
          </span>
        </div>
      </Link>

      {/* 2. NEWS STAT CARD (ORANGE / AMBER NEON) */}
      <Link
        to="/news"
        className="group relative rounded-2xl border border-amber-500/40 bg-[#030712]/90 p-5 shadow-[0_0_25px_rgba(245,158,11,0.12)] hover:border-amber-400 hover:shadow-[0_0_35px_rgba(245,158,11,0.28)] transition-all duration-300 flex flex-col justify-between"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-amber-400">
            <Newspaper size={18} className="group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold tracking-widest uppercase text-amber-300">
              NEWS
            </span>
          </div>
          <ArrowUpRight size={15} className="text-amber-500/60 group-hover:text-amber-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
        </div>

        <div className="my-2">
          <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-baseline gap-2">
            <span>LIVE {newsCount}+</span>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
          </div>
        </div>

        <div className="text-xs text-slate-400 flex items-center justify-between border-t border-amber-500/15 pt-3 mt-1">
          <span className="text-slate-300">Global Wire Feed</span>
          <span className="text-amber-300/90 font-semibold">Updated 2m ago</span>
        </div>
      </Link>

      {/* 3. AI CORE STAT CARD (PURPLE / MAGENTA NEON) */}
      <Link
        to="/search?type=ai"
        className="group relative rounded-2xl border border-purple-500/40 bg-[#030712]/90 p-5 shadow-[0_0_25px_rgba(168,85,247,0.12)] hover:border-purple-400 hover:shadow-[0_0_35px_rgba(168,85,247,0.28)] transition-all duration-300 flex flex-col justify-between"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-purple-400">
            <Cpu size={18} className="group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold tracking-widest uppercase text-purple-300">
              AI CORE
            </span>
          </div>
          <ArrowUpRight size={15} className="text-purple-500/60 group-hover:text-purple-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
        </div>

        <div className="my-2">
          <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-baseline gap-2">
            <span className="text-purple-300">ONLINE</span>
            <span className="text-xs text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
              99.8%
            </span>
          </div>
        </div>

        <div className="text-xs text-slate-400 flex items-center justify-between border-t border-purple-500/15 pt-3 mt-1">
          <span className="text-slate-300">Gemini 2.5 / Hybrid AI</span>
          <span className="text-purple-300/90 font-semibold">18ms Latency</span>
        </div>
      </Link>
    </div>
  );
}
