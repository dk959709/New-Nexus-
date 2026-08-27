import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Send,
  Sparkles,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { DailyForecast, AnswerCard, JarvisSearchCore } from '@/components';
import { SpaceStarfield } from '@/components/SpaceStarfield';
import { MeteorShower } from '@/animations/MeteorShower';
import { api } from '@/services/api';
import { getLocation } from '@/services/location';
import { storage } from '@/lib/storage';
import { useSettings } from '@/hooks/useSettings';
import { playTapSound } from '@/lib/audio';
import { askSmartAnswerEngine } from '@/services/answerEngine';
import type { WeatherData, AnswerEngineResult } from '@/types';

const SMART_SUGGESTIONS = [
  'What is a black hole?',
  'Explain gravity simply',
  'What is photosynthesis?',
  'Latest space news',
  'Search Wikipedia for Mars',
];

export function HomePage() {
  const navigate = useNavigate();
  const [settings] = useSettings();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [aiQuery, setAiQuery] = useState('');
  const [smartResult, setSmartResult] = useState<AnswerEngineResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    getLocation()
      .then((position) => api.weather(`latitude=${position.latitude}&longitude=${position.longitude}`))
      .then(setWeather)
      .catch(() => {
        api.weather('city=New York').then(setWeather).catch(() => undefined);
      });
  }, []);

  const search = (query: string) => {
    storage.saveSearch(query);
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const askNexusAI = async (queryToAsk?: string) => {
    const targetQuery = (queryToAsk || aiQuery).trim();
    if (!targetQuery || aiLoading) return;

    playTapSound();
    setAiQuery(targetQuery);
    setAiLoading(true);
    setAiError('');
    setSmartResult(null);

    try {
      const response = await askSmartAnswerEngine(targetQuery);
      setSmartResult(response);
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'NEXUS Answer Engine is temporarily unavailable.',
      );
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <>
      <SpaceStarfield />
      <MeteorShower reduced={settings.animations === 'reduced'} />
      <div className="space-content-wrapper relative">
        {/* Floating colorful ambient live aurora background orbs */}
        <div className="absolute top-10 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
        <div className="absolute top-40 right-10 w-80 h-80 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDuration: '7s' }} />

        {/* ================================================== */}
        {/* TOP OF WEBSITE: NEXUS INTELLIGENT HERO            */}
        {/* ================================================== */}
        <div className="hero-wrap relative z-10 mb-6 sm:mb-8 w-full max-w-5xl">
          <div className="hero-aurora-glow" aria-hidden="true" />
          
          <div className="relative py-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="eyebrow font-mono tracking-widest text-cyan-300 font-bold">NEXUS INTELLIGENT</span>
            </div>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] my-3">
              <span className="hero-gradient-line">Search the web.</span>
              <br />
              <span className="hero-gradient-line hero-glow-text">Understand the world.</span>
            </h1>
            <p className="text-slate-300 text-sm sm:text-base md:text-lg font-normal leading-relaxed max-w-2xl mt-2">
              A unified view of live search, weather, and world signals — clear, fast, and precise.
            </p>
          </div>
        </div>

        {/* ================================================== */}
        {/* JARVIS INTELLIGENT SEARCH CORE                    */}
        {/* ================================================== */}
        <div className="relative z-10 mb-8">
          <JarvisSearchCore settings={settings} onSearchNexus={search} />
        </div>

        {/* Smart Answer Engine Section */}
        <section
          className="nexus-ai-card relative z-10 overflow-hidden"
          aria-label="NEXUS Smart Answer Engine"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-500/15 via-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
          <div className="nexus-ai-label flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 shadow-md shadow-cyan-500/20">
                <Sparkles size={18} className="ai-sparkle-active" />
              </div>
              <span className="font-bold text-sm tracking-wider text-white">NEXUS Smart Answer Engine</span>
            </div>
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono text-cyan-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              Multi-Source Intelligence
            </span>
          </div>

          <div className="nexus-ai-form">
            <div className="nexus-ai-input-wrap shadow-xl">
              <Sparkles size={20} className="ai-sparkle-active text-cyan-400" />

              <input
                value={aiQuery}
                onChange={(event) => setAiQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') askNexusAI();
                }}
                placeholder="Ask NEXUS anything (e.g. What is a black hole? Explain gravity)..."
                aria-label="Ask NEXUS AI anything"
                className="nexus-ai-input placeholder:text-slate-500"
              />
            </div>

            <button
              type="button"
              onClick={() => askNexusAI()}
              disabled={!aiQuery.trim() || aiLoading}
              aria-label="Ask NEXUS AI"
              className="nexus-ai-submit group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-sky-400 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <Send size={18} className="relative z-10" />
            </button>
          </div>

          {/* Quick Suggestions Chips */}
          {!smartResult && !aiLoading && (
            <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <span className="text-xs font-mono text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={12} /> Try asking:
              </span>
              <div className="flex flex-wrap gap-2">
                {SMART_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-cyan-500/15 border border-white/10 hover:border-cyan-500/40 text-xs text-slate-300 hover:text-white transition-all flex items-center gap-1.5 shadow-sm group"
                    onClick={() => askNexusAI(suggestion)}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 group-hover:bg-cyan-400 transition-colors" />
                    <span>{suggestion}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {aiLoading && (
            <div className="nexus-ai-loading mt-4 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 flex items-center gap-3">
              <Sparkles size={18} className="ai-sparkle-active animate-spin text-cyan-400" />
              <span className="text-xs sm:text-sm font-medium">NEXUS Engine is retrieving and synthesizing verified sources...</span>
            </div>
          )}

          {aiError && (
            <div className="nexus-ai-error">
              {aiError}
            </div>
          )}

          {smartResult && (
            <AnswerCard
              result={smartResult}
              onSelectFollowUp={(q) => askNexusAI(q)}
              className="mt-4 animate-in fade-in duration-300"
            />
          )}
        </section>

        {/* Live Signals & World Briefing Card */}
        <aside className="brief-card relative overflow-hidden group z-10 my-4">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all pointer-events-none" />
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="eyebrow">LIVE SIGNALS</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">World briefing</h2>
          <p className="text-slate-300 text-xs sm:text-sm mb-4 leading-relaxed">Search the current web or open the live news desk for your next signal.</p>
          <Link
            to="/news"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-semibold text-xs transition-all shadow-md group-hover:translate-x-1"
          >
            Explore live news <ArrowUpRight size={15} />
          </Link>
        </aside>

        {/* 7-Day Extended Forecast at the bottom of the home screen */}
        {weather?.daily && (
          <div className="relative z-10 my-6">
            <DailyForecast
              data={weather.daily}
              temperatureUnit={settings.temperature}
              windUnit={settings.wind}
            />
          </div>
        )}
      </div>
    </>
  );
}
