import { useEffect, useState } from 'react';
import {
  Sparkles,
  Globe,
  BookOpen,
  Newspaper,
  Film,
  Send,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AnswerCard } from '@/components';
import { SpaceStarfield } from '@/components/SpaceStarfield';
import { MeteorShower } from '@/animations/MeteorShower';
import { JarvisAnimatedCore } from '@/components/jarvis/JarvisAnimatedCore';
import { NexusTerminalOutput } from '@/components/home/NexusTerminalOutput';
import { api } from '@/services/api';
import { getLocation } from '@/services/location';
import { storage } from '@/lib/storage';
import { useSettings } from '@/hooks/useSettings';
import { playTapSound } from '@/lib/audio';
import { askSmartAnswerEngine } from '@/services/answerEngine';
import type { WeatherData, AnswerEngineResult } from '@/types';

type SearchMode = 'ai' | 'web' | 'wiki' | 'news' | 'media';

interface ModeChip {
  id: SearchMode;
  label: string;
  icon: typeof Sparkles;
  activeClass: string;
  inactiveClass: string;
}

const MODE_CHIPS: ModeChip[] = [
  {
    id: 'ai',
    label: 'AI',
    icon: Sparkles,
    activeClass:
      'bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.45)]',
    inactiveClass:
      'border-emerald-500/50 text-emerald-400 hover:border-emerald-400 hover:bg-emerald-500/10',
  },
  {
    id: 'web',
    label: 'WEB',
    icon: Globe,
    activeClass:
      'bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.45)]',
    inactiveClass:
      'border-cyan-500/50 text-cyan-400 hover:border-cyan-400 hover:bg-cyan-500/10',
  },
  {
    id: 'wiki',
    label: 'WIKI',
    icon: BookOpen,
    activeClass:
      'bg-blue-500/25 border-blue-400 text-blue-300 shadow-[0_0_18px_rgba(96,165,250,0.45)]',
    inactiveClass:
      'border-blue-500/50 text-blue-400 hover:border-blue-400 hover:bg-blue-500/10',
  },
  {
    id: 'news',
    label: 'NEWS',
    icon: Newspaper,
    activeClass:
      'bg-amber-500/25 border-amber-400 text-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.45)]',
    inactiveClass:
      'border-amber-500/50 text-amber-400 hover:border-amber-400 hover:bg-amber-500/10',
  },
  {
    id: 'media',
    label: 'MEDIA',
    icon: Film,
    activeClass:
      'bg-fuchsia-500/25 border-fuchsia-400 text-fuchsia-300 shadow-[0_0_18px_rgba(232,121,249,0.45)]',
    inactiveClass:
      'border-fuchsia-500/50 text-fuchsia-400 hover:border-fuchsia-400 hover:bg-fuchsia-500/10',
  },
];

export function HomePage() {
  const navigate = useNavigate();
  const [settings] = useSettings();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [query, setQuery] = useState('');
  const [selectedMode, setSelectedMode] = useState<SearchMode>('web');
  const [smartResult, setSmartResult] = useState<AnswerEngineResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    // 1. Fetch Local Weather for Terminal Output Telemetry
    getLocation()
      .then((position) =>
        api.weather(`latitude=${position.latitude}&longitude=${position.longitude}`)
      )
      .then(setWeather)
      .catch(() => {
        api.weather('city=New York').then(setWeather).catch(() => undefined);
      });
  }, []);

  const executeSearch = async (targetQuery?: string) => {
    const rawQuery = (targetQuery || query).trim();
    if (!rawQuery || isSearching) return;

    playTapSound();
    storage.saveSearch(rawQuery);
    storage.addJarvisQueryLog(rawQuery, selectedMode === 'ai' ? 'ai' : 'query');

    if (selectedMode === 'ai') {
      setIsSearching(true);
      setSearchError('');
      setSmartResult(null);

      try {
        const response = await askSmartAnswerEngine(rawQuery);
        setSmartResult(response);
      } catch (err) {
        setSearchError(
          err instanceof Error
            ? err.message
            : 'JARVIS Intelligence Engine is temporarily busy.'
        );
      } finally {
        setIsSearching(false);
      }
    } else {
      let url = `/search?q=${encodeURIComponent(rawQuery)}`;
      if (selectedMode === 'wiki') url += '&type=wikipedia';
      else if (selectedMode === 'news') url += '&type=news';
      else if (selectedMode === 'media') url += '&type=media';
      navigate(url);
    }
  };

  return (
    <>
      <SpaceStarfield />
      <MeteorShower reduced={settings.animations === 'reduced'} />

      <div className="space-content-wrapper relative select-none font-mono text-slate-100 min-h-screen pb-16">
        {/* Subtle Ambient Background Energy Flares */}
        <div className="absolute top-10 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
        <div
          className="absolute top-40 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-[130px] pointer-events-none"
          style={{ animationDuration: '8s' }}
        />

        {/* ================================================== */}
        {/* 1. HEADER ROW: CYAN LABEL + HUGE TITLE + ORBITAL CORE */}
        {/* ================================================== */}
        <div className="relative z-10 pt-2 sm:pt-4 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left Column: Title & Subtitle */}
            <div className="lg:col-span-8 flex flex-col justify-center">
              {/* Small cyan label */}
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-xs sm:text-sm font-bold tracking-[0.25em] text-cyan-400 uppercase">
                  NEXUS INTELLIGENCE
                </span>
              </div>

              {/* Huge two-line title */}
              <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.05] my-2 select-text">
                <span className="text-cyan-400">&gt; SEARCH</span>
                <br />
                <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-pink-500 bg-clip-text text-transparent">
                  THE WEB
                </span>
                <span className="text-fuchsia-400 animate-pulse ml-0.5">_</span>
              </h1>

              {/* Subtitle text in gray monospace */}
              <p className="text-slate-400 text-xs sm:text-sm tracking-wider uppercase leading-relaxed max-w-2xl mt-2 select-text">
                A UNIFIED VIEW OF LIVE SEARCH, WEATHER, NEWS &amp; WORLD SIGNALS
              </p>
            </div>

            {/* Right Column: Orbital Core Graphic + Telemetry Captions */}
            <div className="lg:col-span-4 flex flex-col items-center justify-center">
              <div className="relative flex flex-col items-center justify-center">
                <div className="transform scale-95 sm:scale-100">
                  <JarvisAnimatedCore
                    size="sm"
                    status={isSearching ? 'synthesizing' : 'idle'}
                    interactive
                    onClick={() => {
                      playTapSound();
                      navigate('/jarvis');
                    }}
                  />
                </div>

                {/* Orbital Core Captions */}
                <div
                  className="text-center mt-2 space-y-1 cursor-pointer select-none"
                  onClick={() => {
                    playTapSound();
                    navigate('/jarvis');
                  }}
                >
                  <div className="text-xs font-bold tracking-widest text-cyan-300 uppercase hover:text-cyan-200 transition-colors">
                    JARVIS ORBITAL CORE
                  </div>
                  <div className="text-[11px] font-semibold text-emerald-400 flex items-center justify-center gap-1.5 tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                    <span>SYSTEMS OPERATIONAL</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================== */}
        {/* 2. SEARCH BAR: NEON GRADIENT BORDER PILL INPUT     */}
        {/* ================================================== */}
        <div className="relative z-10 max-w-4xl mx-auto my-4 sm:my-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const terminalInput = document.getElementById('terminal-chat-input') as HTMLInputElement | null;
              if (terminalInput) {
                terminalInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                terminalInput.focus();
              }
            }}
            onClick={() => {
              const terminalInput = document.getElementById('terminal-chat-input') as HTMLInputElement | null;
              if (terminalInput) {
                terminalInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                terminalInput.focus();
              }
            }}
            className="relative group rounded-full p-[2px] bg-gradient-to-r from-emerald-500 via-cyan-500 to-fuchsia-500 shadow-[0_0_30px_rgba(45,212,191,0.25)] hover:shadow-[0_0_40px_rgba(168,85,247,0.35)] transition-all duration-300 cursor-pointer"
          >
            <div className="flex items-center gap-3 bg-[#030712] rounded-full px-5 py-3 sm:py-4">
              {/* Green "$" prompt symbol */}
              <span className="text-emerald-400 font-bold text-lg sm:text-xl select-none">
                $
              </span>

              {/* Monospace Input restricted/redirected to terminal output search input */}
              <input
                type="text"
                readOnly
                onFocus={(e) => {
                  e.target.blur();
                  const terminalInput = document.getElementById('terminal-chat-input') as HTMLInputElement | null;
                  if (terminalInput) {
                    terminalInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    terminalInput.focus();
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  const terminalInput = document.getElementById('terminal-chat-input') as HTMLInputElement | null;
                  if (terminalInput) {
                    terminalInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    terminalInput.focus();
                  }
                }}
                placeholder="ask jarvis anything..."
                aria-label="Search input"
                className="w-full bg-transparent text-slate-100 placeholder:text-slate-500 font-mono text-sm sm:text-base outline-none tracking-wide cursor-pointer"
              />

              {/* Cyan Send Arrow Button */}
              <button
                type="submit"
                aria-label="Submit search"
                className="p-2 sm:p-2.5 rounded-full text-cyan-400 hover:text-cyan-200 hover:bg-cyan-500/20 active:scale-95 transition-all"
              >
                <Send size={18} className="transform -rotate-12" />
              </button>
            </div>
          </form>
        </div>

        {/* ================================================== */}
        {/* 3. MODE FILTER CHIPS ROW: 5 NEON OUTLINE PILLS    */}
        {/* ================================================== */}
        <div className="relative z-10 max-w-4xl mx-auto mb-6">
          <div className="flex items-center justify-center sm:justify-start gap-2.5 sm:gap-3 flex-wrap">
            {MODE_CHIPS.map((chip) => {
              const Icon = chip.icon;
              const isSelected = selectedMode === chip.id;

              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => {
                    playTapSound();
                    setSelectedMode(chip.id);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold tracking-wider transition-all duration-200 uppercase ${
                    isSelected ? chip.activeClass : chip.inactiveClass
                  }`}
                >
                  <Icon size={14} className={isSelected ? 'animate-pulse' : ''} />
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ================================================== */}
        {/* 4. TERMINAL OUTPUT PANEL & WORLD MAP HUD           */}
        {/* ================================================== */}
        <div className="relative z-10">
          <NexusTerminalOutput
            weather={weather}
            settings={settings}
            activeQuery={query}
            isSearching={isSearching}
            onExecuteSearch={(q) => {
              setQuery(q);
              executeSearch(q);
            }}
          />
        </div>

        {/* Smart Answer Card Display (if AI synthesis executed) */}
        {searchError && (
          <div className="relative z-10 my-4 p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs sm:text-sm font-mono">
            {searchError}
          </div>
        )}

        {smartResult && (
          <div className="relative z-10 my-6">
            <AnswerCard
              result={smartResult}
              onSelectFollowUp={(q) => {
                setQuery(q);
                executeSearch(q);
              }}
              className="border border-cyan-500/40 shadow-[0_0_30px_rgba(6,182,212,0.2)] bg-[#030712]/95 rounded-2xl"
            />
          </div>
        )}
      </div>
    </>
  );
}
