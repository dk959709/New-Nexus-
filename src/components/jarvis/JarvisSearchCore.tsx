import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Mic,
  Send,
  X,
  Sparkles,
  Globe,
  BookOpen,
  Film,
  Image as ImageIcon,
  Newspaper,
  Compass,
  ArrowUpRight,
  Copy,
  Check,
  Zap,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Bookmark,
  BookmarkCheck,
} from 'lucide-react';
import { JarvisAnimatedCore } from './JarvisAnimatedCore';
import { useSpeechSearch } from '@/hooks/useSpeechSearch';
import { askSmartAnswerEngine } from '@/services/answerEngine';
import { storage } from '@/lib/storage';
import { playTapSound } from '@/lib/audio';
import { copyToClipboard } from '@/lib/clipboard';
import type { AnswerEngineResult, Settings, SavedItem } from '@/types';

export type JarvisQuickMode = 'ai' | 'web' | 'wiki' | 'videos' | 'media' | 'news';

interface JarvisSearchCoreProps {
  settings?: Settings;
  onSearchNexus?: (query: string) => void;
}

const QUICK_MODES: Array<{
  id: JarvisQuickMode;
  label: string;
  icon: typeof Sparkles;
  description: string;
  placeholder: string;
  badge: string;
}> = [
  {
    id: 'ai',
    label: 'AI',
    icon: Sparkles,
    description: 'Direct AI Answer & Knowledge Synthesis',
    placeholder: 'Ask JARVIS anything (e.g. Explain quantum computing, black hole thermodynamics)...',
    badge: '✨ AI SYNTHESIS',
  },
  {
    id: 'web',
    label: 'Web',
    icon: Globe,
    description: 'Live Search Index & Open Web',
    placeholder: 'Search the live web with JARVIS...',
    badge: '🌐 LIVE WEB',
  },
  {
    id: 'wiki',
    label: 'Wikipedia',
    icon: BookOpen,
    description: 'Encyclopedic Knowledge & Deep Summaries',
    placeholder: 'Search Wikipedia with JARVIS...',
    badge: '📚 WIKIPEDIA',
  },
  {
    id: 'videos',
    label: 'Videos',
    icon: Film,
    description: 'Video Streams & Media Footage',
    placeholder: 'Search videos & streams with JARVIS...',
    badge: '🎬 VIDEOS',
  },
  {
    id: 'media',
    label: 'Media',
    icon: ImageIcon,
    description: 'Images, Diagrams & Wikimedia Visuals',
    placeholder: 'Search images & visual media with JARVIS...',
    badge: '🖼️ MEDIA',
  },
  {
    id: 'news',
    label: 'News',
    icon: Newspaper,
    description: 'Live World Headlines & Breaking Signals',
    placeholder: 'Search latest global news with JARVIS...',
    badge: '📰 WORLD NEWS',
  },
];

const MODE_SUGGESTIONS: Record<JarvisQuickMode, string[]> = {
  ai: [
    'How does CRISPR gene editing work?',
    'Explain the theory of relativity simply',
    'Compare monolithic vs microservices architecture',
    'What happens inside a black hole event horizon?',
  ],
  web: [
    'NASA James Webb telescope latest discoveries',
    'Global renewable energy milestones 2026',
    'Quantum computing qubit roadmap',
  ],
  wiki: [
    'Albert Einstein',
    'Voyager 1 space probe',
    'Artificial intelligence history',
  ],
  videos: [
    'SpaceX Starship launch highlights',
    'Quantum physics documentary explanation',
    'Deep ocean exploration footage',
  ],
  media: [
    'James Webb deep space galaxy images',
    'Human neural network microscopy diagram',
    'Mars Rover high-resolution surface panoramas',
  ],
  news: [
    'Latest technology breakthroughs today',
    'Global space exploration mission updates',
    'Renewable clean power grid expansion news',
  ],
};

export function JarvisSearchCore({ settings, onSearchNexus }: JarvisSearchCoreProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeMode, setActiveMode] = useState<JarvisQuickMode>('ai');
  const [isFocused, setIsFocused] = useState(false);
  const [status, setStatus] = useState<'idle' | 'searching' | 'thinking' | 'synthesizing' | 'success'>('idle');
  const [result, setResult] = useState<AnswerEngineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [recentlySaved, setRecentlySaved] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const reducedMotion = settings?.animations === 'reduced';

  // Voice search integration
  const handleVoiceInput = (text: string) => {
    setQuery(text);
    if (text.trim()) {
      setTimeout(() => {
        executeSearch(text.trim(), activeMode);
      }, 400);
    }
  };

  const { listening, supported, start: startVoice, stop: stopVoice } = useSpeechSearch(handleVoiceInput);

  const activeModeConfig = QUICK_MODES.find((m) => m.id === activeMode) || QUICK_MODES[0];

  const executeSearch = async (queryText: string, modeToUse: JarvisQuickMode) => {
    const q = queryText.trim();
    if (!q || status === 'thinking' || status === 'searching' || status === 'synthesizing') return;

    playTapSound();
    storage.saveSearch(q);

    // If non-AI mode is selected, route immediately to existing NEXUS services
    if (modeToUse === 'web') {
      navigate(`/search?q=${encodeURIComponent(q)}&tab=web`);
      return;
    }
    if (modeToUse === 'wiki') {
      navigate(`/search?q=${encodeURIComponent(q)}&tab=wikipedia`);
      return;
    }
    if (modeToUse === 'videos') {
      navigate(`/search?q=${encodeURIComponent(q)}&tab=videos`);
      return;
    }
    if (modeToUse === 'media') {
      navigate(`/search?q=${encodeURIComponent(q)}&tab=images`);
      return;
    }
    if (modeToUse === 'news') {
      navigate(`/news`);
      return;
    }

    // AI Synthesis Mode (Direct, Token-Efficient, Verified)
    setStatus('thinking');
    setError(null);
    setResult(null);

    // Transition smoothly through HUD state
    const timer = setTimeout(() => {
      setStatus('synthesizing');
    }, 400);

    try {
      const response = await askSmartAnswerEngine(q);
      setResult(response);
      setStatus('success');
      setTimeout(() => {
        setStatus('idle');
      }, 3000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'JARVIS intelligent synthesis service is temporarily unavailable.',
      );
      setStatus('idle');
    } finally {
      clearTimeout(timer);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query, activeMode);
  };

  const handleModeClick = (mode: JarvisQuickMode) => {
    playTapSound();
    setActiveMode(mode);
    if (query.trim()) {
      executeSearch(query.trim(), mode);
    } else {
      inputRef.current?.focus();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    executeSearch(suggestion, activeMode);
  };

  const handleCopy = async () => {
    let textToCopy = result?.answer || result?.text;
    if (!textToCopy) return;
    playTapSound();
    if (result?.model) {
      textToCopy = `${textToCopy.trim()}\n\n---\nModels Used:\nAI Synthesis: ${result.model}`;
    }
    const success = await copyToClipboard(textToCopy);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = () => {
    const textToSave = result?.answer || result?.text;
    if (!textToSave) return;
    playTapSound();
    const savedId = `jarvis-search-${Date.now()}`;
    const jarvisSavedItem: SavedItem = {
      id: savedId,
      type: 'jarvis',
      title: query.trim() || 'JARVIS Synthesis',
      subtitle: textToSave.length > 180 ? `${textToSave.slice(0, 180)}...` : textToSave,
      content: textToSave,
      sources: result.sources?.map((s) => ({
        title: s.title,
        url: s.url,
        domain: s.domain,
      })),
      savedAt: new Date().toISOString(),
    };
    storage.saveItem(jarvisSavedItem);
    setIsSaved(true);
    setRecentlySaved(true);
    setTimeout(() => setRecentlySaved(false), 2500);
  };

  const handleLaunchDeepResearch = () => {
    playTapSound();
    const textSnippet = result?.answer || result?.text;
    const targetQ = query.trim() || textSnippet?.slice(0, 50) || '';
    navigate(`/jarvis?q=${encodeURIComponent(targetQ)}&deep=true`);
  };

  const handleOpenInWebSearch = () => {
    playTapSound();
    const targetQ = query.trim() || '';
    if (onSearchNexus) {
      onSearchNexus(targetQ);
    } else {
      navigate(`/search?q=${encodeURIComponent(targetQ)}`);
    }
  };

  return (
    <section
      className="jarvis-search-core-wrapper relative w-full max-w-4xl mx-auto my-6 px-2 sm:px-4 select-none"
      aria-label="JARVIS Intelligent Search Core"
    >
      {/* Seamless Ambient Light Flare */}
      <div
        className="absolute -top-16 left-1/2 -translate-x-1/2 w-4/5 max-w-xl h-36 pointer-events-none rounded-full blur-3xl transition-opacity duration-700"
        style={{
          background: isFocused
            ? 'radial-gradient(ellipse at center, rgba(97, 215, 201, 0.35) 0%, rgba(56, 189, 248, 0.2) 50%, transparent 80%)'
            : 'radial-gradient(ellipse at center, rgba(97, 215, 201, 0.22) 0%, rgba(56, 189, 248, 0.12) 50%, transparent 80%)',
          opacity: isFocused ? 0.9 : 0.65,
        }}
      />

      {/* Main Transparent Content */}
      <div className="relative z-10 w-full flex flex-col items-center">
        {/* Animated AI Core Node with Focus Acceleration */}
        <div className="relative z-10 flex flex-col items-center justify-center mb-3">
          <JarvisAnimatedCore
            status={status}
            reducedMotion={reducedMotion}
            size="md"
            interactive
            isFocused={isFocused}
            onClick={() => inputRef.current?.focus()}
          />

          {/* JARVIS Header & Subtitle */}
          <div className="text-center mt-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-mono tracking-widest text-cyan-300 uppercase font-bold mb-1 backdrop-blur-sm shadow-[0_0_12px_rgba(97,215,201,0.15)]">
              <Zap size={11} className="text-cyan-400" />
              <span>INTELLIGENT SEARCH CORE</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white m-0 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
              JARVIS
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm font-medium mt-1 max-w-md mx-auto drop-shadow-sm">
              Search the web. Understand the answer.
            </p>
          </div>
        </div>

        {/* Floating Glassmorphic Search Input */}
        <form
          onSubmit={handleSubmit}
          className="relative z-10 w-full max-w-2xl mx-auto"
          role="search"
        >
          <div
            className={`group relative flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-2xl sm:rounded-full backdrop-blur-xl transition-all duration-300 ${
              isFocused
                ? 'ring-2 ring-cyan-400/50 shadow-[0_0_30px_rgba(97,215,201,0.35),inset_0_1px_0_rgba(255,255,255,0.2)]'
                : 'shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_20px_rgba(97,215,201,0.15),inset_0_1px_0_rgba(255,255,255,0.1)]'
            }`}
            style={{
              background: isFocused ? 'rgba(6, 18, 32, 0.75)' : 'rgba(5, 15, 26, 0.55)',
              border: isFocused ? '1px solid rgba(97, 215, 201, 0.7)' : '1px solid rgba(97, 215, 201, 0.35)',
            }}
          >
            {/* Search Icon */}
            <div className="pl-3 text-cyan-400 flex items-center justify-center">
              <Search
                size={20}
                className={`transition-transform duration-300 ${
                  isFocused ? 'scale-110 drop-shadow-[0_0_10px_rgba(97,215,201,0.8)]' : 'drop-shadow-[0_0_6px_rgba(97,215,201,0.4)]'
                }`}
              />
            </div>

            {/* Input Element */}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={activeModeConfig.placeholder}
              aria-label="Ask JARVIS anything"
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-white text-sm sm:text-base placeholder:text-slate-400/80 font-medium px-1 py-1"
            />

            {/* Clear Button */}
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setResult(null);
                  setError(null);
                  inputRef.current?.focus();
                }}
                aria-label="Clear query"
                className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={16} />
              </button>
            )}

            {/* Voice Input Button */}
            {supported && (
              <button
                type="button"
                onClick={listening ? stopVoice : startVoice}
                aria-label="Voice search"
                title={listening ? 'Stop voice recording' : 'Speak to JARVIS'}
                className={`min-w-[40px] min-h-[40px] p-2 rounded-full transition-all duration-300 flex items-center justify-center ${
                  listening
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_18px_#61d7c9] animate-pulse'
                    : 'text-slate-300 hover:text-cyan-300 hover:bg-cyan-500/15'
                }`}
              >
                <Mic size={18} className={listening ? 'animate-bounce' : ''} />
              </button>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!query.trim() || status === 'thinking' || status === 'synthesizing'}
              aria-label="Submit search"
              className="min-h-[40px] px-5 py-2 rounded-xl sm:rounded-full font-bold text-xs sm:text-sm tracking-wide transition-all duration-300 flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #61d7c9 0%, #38bdf8 100%)',
                color: '#051218',
                boxShadow: isFocused ? '0 0 20px rgba(97, 215, 201, 0.55)' : '0 0 14px rgba(97, 215, 201, 0.35)',
              }}
            >
              <span>Search</span>
              <Send size={13} />
            </button>
          </div>
        </form>

        {/* Quick Modes Floating Pills */}
        <div className="relative z-10 w-full max-w-2xl mt-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2 px-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-300/90 font-semibold flex items-center gap-1">
              <Sparkles size={12} className="text-cyan-400" />
              <span>QUICK MODES:</span>
            </span>
            <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
              {activeModeConfig.description}
            </span>
          </div>

          {/* Mode Pill Buttons */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {QUICK_MODES.map((mode) => {
              const Icon = mode.icon;
              const isActive = activeMode === mode.id;

              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => handleModeClick(mode.id)}
                  aria-pressed={isActive}
                  className={`min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all duration-200 backdrop-blur-md border ${
                    isActive
                      ? 'bg-cyan-500/25 border-cyan-400 text-white shadow-[0_0_14px_rgba(97,215,201,0.35)]'
                      : 'bg-slate-950/40 hover:bg-cyan-500/15 border-white/10 hover:border-cyan-500/40 text-slate-300 hover:text-white'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-cyan-300' : 'text-slate-400'} />
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mode Suggestions Floating (When No Result Yet) */}
        {!result && status === 'idle' && (
          <div className="relative z-10 w-full max-w-2xl mt-3.5 flex flex-wrap items-center justify-center sm:justify-start gap-2 px-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mr-1">
              Suggested:
            </span>
            {MODE_SUGGESTIONS[activeMode]?.slice(0, 3).map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => handleSuggestionClick(sug)}
                className="px-3 py-1.5 rounded-lg bg-slate-950/40 hover:bg-cyan-500/20 backdrop-blur-sm border border-white/10 hover:border-cyan-400/40 text-[11px] text-slate-300 hover:text-cyan-200 transition-all active:scale-95"
              >
                {sug}
              </button>
            ))}
          </div>
        )}

        {/* Active Processing Indicator */}
        {(status === 'thinking' || status === 'synthesizing') && (
          <div
            className="relative z-10 w-full max-w-2xl mt-4 p-4 rounded-2xl flex items-center justify-center gap-3 backdrop-blur-md animate-pulse shadow-lg"
            style={{
              background: 'rgba(5, 20, 32, 0.75)',
              border: '1px solid rgba(97, 215, 201, 0.45)',
            }}
          >
            <div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            <span className="text-xs sm:text-sm font-bold text-cyan-300 font-mono tracking-wide">
              {status === 'thinking'
                ? 'JARVIS ROUTER: Analyzing query & selecting verified sources...'
                : 'JARVIS CORE: Synthesizing comprehensive intelligence answer...'}
            </span>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="relative z-10 w-full max-w-2xl mt-4 p-4 rounded-2xl bg-rose-950/60 backdrop-blur-md border border-rose-500/40 text-rose-200 text-xs sm:text-sm">
            <div className="font-bold flex items-center gap-2 mb-1">
              <ShieldCheck size={16} className="text-rose-400" />
              <span>JARVIS Execution Notice</span>
            </div>
            <p>{error}</p>
          </div>
        )}

        {/* Holographic JARVIS Synthesized Result Card */}
        {result && (
          <div
            className="relative z-10 w-full max-w-3xl mt-5 p-5 sm:p-6 rounded-2xl backdrop-blur-xl transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, rgba(8, 20, 34, 0.88) 0%, rgba(12, 22, 46, 0.9) 100%)',
              border: '1px solid rgba(97, 215, 201, 0.45)',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 28px rgba(97, 215, 201, 0.18)',
            }}
          >
            {/* Top Result Banner */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 mb-4 border-b border-cyan-500/20">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white m-0">
                    JARVIS Verified Synthesis
                  </h3>
                  <span className="text-[10px] font-mono text-cyan-400/90">
                    {(result.provider || result.model) ? `Model: ${(result.provider || result.model)?.toUpperCase()}` : 'Neural Mesh'} · Verified Multi-Source
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${
                    recentlySaved
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                      : isSaved
                      ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white'
                  }`}
                  title={isSaved ? 'Saved in NEXUS Library' : 'Save to NEXUS Library'}
                >
                  {recentlySaved ? (
                    <>
                      <Check size={14} className="text-emerald-400" />
                      <span className="font-semibold text-emerald-300">Saved ✓</span>
                    </>
                  ) : isSaved ? (
                    <>
                      <BookmarkCheck size={14} className="text-cyan-300" />
                      <span>Saved</span>
                    </>
                  ) : (
                    <>
                      <Bookmark size={14} />
                      <span>Save</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white font-medium flex items-center gap-1.5 transition-all"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Dismiss result"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Answer Content */}
            <div className="text-slate-100 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-sans">
              {result.answer || result.text}
            </div>

            {/* Key Bullet Points (If present) */}
            {result.keyPoints && result.keyPoints.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-700/50">
                <span className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider block mb-2">
                  Key Insights:
                </span>
                <ul className="space-y-1.5 pl-4 list-disc text-xs sm:text-sm text-slate-200 marker:text-cyan-400">
                  {result.keyPoints.map((point: string, idx: number) => (
                    <li key={idx}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Source Citations */}
            {result.sources && result.sources.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-700/50 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  Sources ({result.sources.length}):
                </span>
                {result.sources.slice(0, 4).map((src, i) => (
                  <a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-[11px] font-mono text-cyan-300 hover:text-white transition-all"
                  >
                    <span>{src.domain || src.title.slice(0, 20)}</span>
                    <ExternalLink size={10} />
                  </a>
                ))}
              </div>
            )}

            {/* Deep Research & Routing Next Steps */}
            <div className="mt-5 pt-4 border-t border-cyan-500/20 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleLaunchDeepResearch}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, rgba(97,215,201,0.2) 0%, rgba(56,189,248,0.25) 100%)',
                  border: '1px solid rgba(97,215,201,0.4)',
                  color: '#61d7c9',
                }}
              >
                <Compass size={15} />
                <span>Launch in 5-Agent JARVIS Deep Research</span>
                <ChevronRight size={14} />
              </button>

              <button
                type="button"
                onClick={handleOpenInWebSearch}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 font-medium transition-colors"
              >
                <span>Explore all web results</span>
                <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
