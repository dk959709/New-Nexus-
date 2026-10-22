import React, { useState, useRef, useEffect } from 'react';
import {
  RotateCcw,
  Check,
  Search,
  Shield,
  Layers,
  Volume2,
  Play,
  Square,
  Palette,
} from 'lucide-react';
import { storage, DEFAULT_PARALLAX_AGENTS } from '@/lib/storage';
import type { ParallaxSystemConfig, ParallaxAgentConfig, AIProvidersState } from '@/types';
import { ParallaxAgentAvatar } from './ParallaxAgentIcon';
import { EDGE_VOICES } from '@/data/edgeVoices';
import { getParallaxAgentVoice } from '@/data/parallaxVoices';

export type ParallaxTheme = 'minimal' | 'classic' | 'fulldark';

const PARALLAX_THEME_STORAGE_KEY = 'nexus-parallax-theme-v1';

export function getSavedParallaxTheme(): ParallaxTheme {
  try {
    const val = localStorage.getItem(PARALLAX_THEME_STORAGE_KEY);
    if (val === 'minimal' || val === 'classic' || val === 'fulldark') {
      return val;
    }
  } catch {
    // ignore storage errors
  }
  return 'fulldark';
}

export function saveParallaxTheme(theme: ParallaxTheme): void {
  try {
    localStorage.setItem(PARALLAX_THEME_STORAGE_KEY, theme);
  } catch {
    // ignore storage errors
  }
}

interface ParallaxSettingsProps {
  config: ParallaxSystemConfig;
  onConfigChange: (updated: ParallaxSystemConfig) => void;
  theme?: ParallaxTheme;
  onThemeChange?: (theme: ParallaxTheme) => void;
}

export const ParallaxSettings: React.FC<ParallaxSettingsProps> = ({
  config,
  onConfigChange,
  theme: propTheme,
  onThemeChange,
}) => {
  const [localTheme, setLocalTheme] = useState<ParallaxTheme>(() => propTheme || getSavedParallaxTheme());
  const activeTheme = propTheme || localTheme;

  const [providersState] = useState<AIProvidersState>(() => storage.getAIProvidersState());
  const [filterQuery, setFilterQuery] = useState('');
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [testingVoiceAgentId, setTestingVoiceAgentId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (propTheme) {
      setLocalTheme(propTheme);
    }
  }, [propTheme]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const agentsList = Object.values(config.agents || DEFAULT_PARALLAX_AGENTS);
  const enabledCount = agentsList.filter((a) => a.enabled !== false).length;
  const veritasEnabled = config.agents?.veritas?.enabled !== false;

  const showFeedback = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleSelectTheme = (newTheme: ParallaxTheme) => {
    setLocalTheme(newTheme);
    saveParallaxTheme(newTheme);
    onThemeChange?.(newTheme);
    const label =
      newTheme === 'minimal'
        ? 'NEXUS Minimal'
        : newTheme === 'classic'
        ? 'NEXUS Classic'
        : 'Full Dark';
    showFeedback(`Theme switched to ${label}`);
  };

  const handleTestVoice = async (agent: ParallaxAgentConfig) => {
    if (testingVoiceAgentId === agent.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setTestingVoiceAgentId(null);
      return;
    }

    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setTestingVoiceAgentId(agent.id);
      const targetVoice = agent.voice || getParallaxAgentVoice(agent.id);
      const testText = `Greetings, I am ${agent.name}. My focus is ${agent.role.toLowerCase()}.`;

      const response = await fetch('/api/edge-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testText,
          voice: targetVoice,
        }),
      });

      if (!response.ok) {
        throw new Error(`TTS failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setTestingVoiceAgentId(null);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setTestingVoiceAgentId(null);
        URL.revokeObjectURL(url);
      };

      await audio.play();
    } catch (err) {
      console.error('Test voice error:', err);
      setTestingVoiceAgentId(null);
      showFeedback(`Voice test failed: ${err instanceof Error ? err.message : 'Network error'}`);
    }
  };

  const handleUpdateAgent = (id: string, updates: Partial<ParallaxAgentConfig>) => {
    const updated = storage.updateParallaxAgent(id, updates);
    onConfigChange(updated);
    showFeedback(`Updated ${updated.agents[id]?.name || 'Agent'} settings.`);
  };

  const handleResetSingleAgent = (id: string) => {
    const def = DEFAULT_PARALLAX_AGENTS[id];
    if (def) {
      handleUpdateAgent(id, {
        systemInstruction: def.systemInstruction,
        providerId: def.providerId,
        modelId: def.modelId,
        enabled: def.enabled,
        maxTokens: def.maxTokens,
      });
      showFeedback(`Reset ${def.name} to default baseline.`);
    }
  };

  const handleResetAll = () => {
    const resetCfg = storage.resetParallaxConfig();
    onConfigChange(resetCfg);
    setConfirmResetAll(false);
    showFeedback('All 20 Parallax agents reset to factory default!');
  };

  const availableProviders = [
    { id: 'existing', name: 'Built-in AI / Active Default' },
    ...providersState.providers.map((p) => ({
      id: p.id,
      name: p.name,
      keyCount: p.keys.filter((k) => k.key && k.key.trim().length > 0).length,
    })),
  ];

  const filteredAgents = agentsList.filter((a) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.role.toLowerCase().includes(q) ||
      a.systemInstruction.toLowerCase().includes(q)
    );
  });

  const cardSurfaceClass =
    activeTheme === 'classic'
      ? 'bg-slate-900/50 backdrop-blur-xl hover:bg-slate-900/75 border border-cyan-500/20'
      : activeTheme === 'fulldark'
      ? 'bg-[#171717] hover:bg-[#1f1f1f] border border-[#2a2a2a]'
      : 'bg-zinc-900/70 hover:bg-zinc-900/95 border border-zinc-800/80';

  const inputSurfaceClass =
    activeTheme === 'classic'
      ? 'bg-slate-950/70 text-slate-100 border border-cyan-500/20 focus:ring-cyan-400/50'
      : activeTheme === 'fulldark'
      ? 'bg-[#0d0d0d] text-[#ececec] border border-[#2f2f2f] focus:ring-zinc-500/50'
      : 'bg-[#111113] text-zinc-100 border border-zinc-800 focus:ring-zinc-500/50';

  return (
    <div id="parallax-settings-container" className="divide-y divide-white/[0.06] space-y-4">
      {/* Toast notification */}
      {saveToast && (
        <div className="fixed bottom-4 right-4 z-50 px-3.5 py-2 rounded-full bg-cyan-500/95 text-slate-950 font-bold text-[11px] sm:text-xs shadow-xl flex items-center gap-1.5">
          <Check size={14} />
          {saveToast}
        </div>
      )}

      {/* ============================================================
          SECTION 1: VISUAL THEME SELECTOR (Copied from AI Assistant)
         ============================================================ */}
      <div id="parallax-theme-settings-section" className="py-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <Palette size={14} className="text-purple-400" />
          <h4 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-300 m-0">
            Visual Theme
          </h4>
        </div>
        <p className="text-[11px] sm:text-xs text-zinc-400 m-0">
          Select your preferred visual aesthetic for the NEXUS Parallax Agent Swarm.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {/* Theme 1: NEXUS Minimal (Claude style) */}
          <button
            id="parallax-theme-btn-minimal"
            type="button"
            onClick={() => handleSelectTheme('minimal')}
            className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between group cursor-pointer ${
              activeTheme === 'minimal'
                ? 'border-zinc-400 bg-zinc-800/90 shadow-md ring-1 ring-zinc-400/40'
                : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-medium text-xs text-zinc-100">
                  NEXUS Minimal
                </span>
                {activeTheme === 'minimal' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-700/50">
                    <Check size={10} /> Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed mb-2.5">
                Claude-inspired neutral dark aesthetic with refined spacing and clean sans-serif typography.
              </p>
            </div>
            {/* Visual preview swatch */}
            <div className="h-5 w-full rounded-md bg-[#111113] border border-zinc-700/60 p-1 flex items-center gap-1">
              <div className="h-full w-1/3 rounded bg-[#26262a]" />
              <div className="h-full w-2/3 rounded bg-[#1e1e21]" />
            </div>
          </button>

          {/* Theme 2: NEXUS Classic (Glassmorphic Space) */}
          <button
            id="parallax-theme-btn-classic"
            type="button"
            onClick={() => handleSelectTheme('classic')}
            className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between group cursor-pointer ${
              activeTheme === 'classic'
                ? 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_15px_rgba(6,182,212,0.2)] ring-1 ring-cyan-400/40'
                : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-medium text-xs text-cyan-200">
                  NEXUS Classic
                </span>
                {activeTheme === 'classic' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-300 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-500/50">
                    <Check size={10} /> Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed mb-2.5">
                Glassmorphic cosmic dark space theme with glowing cyan accents and deep stellar background.
              </p>
            </div>
            {/* Visual preview swatch */}
            <div className="h-5 w-full rounded-md bg-[#060b13] border border-cyan-500/30 p-1 flex items-center gap-1">
              <div className="h-full w-1/3 rounded bg-cyan-900/60 border border-cyan-500/30" />
              <div className="h-full w-2/3 rounded bg-slate-900/80 border border-cyan-500/20" />
            </div>
          </button>

          {/* Theme 3: Full Dark (ChatGPT style) */}
          <button
            id="parallax-theme-btn-fulldark"
            type="button"
            onClick={() => handleSelectTheme('fulldark')}
            className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between group cursor-pointer ${
              activeTheme === 'fulldark'
                ? 'border-zinc-400 bg-[#212121] shadow-md ring-1 ring-zinc-400/40'
                : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-medium text-xs text-[#ececec]">
                  Full Dark
                </span>
                {activeTheme === 'fulldark' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-700/50">
                    <Check size={10} /> Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed mb-2.5">
                ChatGPT-style high-contrast pure dark mode with deep black backdrop and flat clean stream.
              </p>
            </div>
            {/* Visual preview swatch */}
            <div className="h-5 w-full rounded-md bg-[#0d0d0d] border border-[#2f2f2f] p-1 flex items-center gap-1">
              <div className="h-full w-1/3 rounded bg-[#212121]" />
              <div className="h-full w-2/3 rounded bg-[#2f2f2f]" />
            </div>
          </button>
        </div>
      </div>

      {/* Summary Header Banner */}
      <div
        id="parallax-settings-summary-banner"
        className="py-3 flex items-center justify-between flex-wrap gap-3"
      >
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Layers size={16} className="text-cyan-400" />
            <span className="text-xs sm:text-sm font-extrabold text-slate-100 tracking-tight">
              PARALLAX AGENT ORCHESTRATION PIPELINE
            </span>
          </div>
          <p
            id="parallax-agents-summary-line"
            className="m-0 text-[11px] sm:text-xs text-slate-300 leading-relaxed"
          >
            <strong className="text-cyan-300">{enabledCount} of 20 Built-in Agents</strong> (
            {veritasEnabled ? '1 with tool access: VERITAS' : '0 with tool access'}
            ) active in Parallax Pipeline.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {confirmResetAll ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-rose-400 font-semibold">Reset all 20?</span>
              <button
                type="button"
                onClick={handleResetAll}
                className="px-2.5 py-1 rounded-full bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
              >
                Yes, Reset All
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetAll(false)}
                className="px-2.5 py-1 rounded-full bg-slate-900/40 backdrop-blur-xl text-slate-200 text-[11px] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              id="parallax-reset-all-btn"
              type="button"
              onClick={() => setConfirmResetAll(true)}
              className="px-3 py-1.5 rounded-full bg-slate-900/40 backdrop-blur-xl hover:bg-slate-800/60 text-slate-200 hover:text-white text-[11px] font-semibold cursor-pointer flex items-center gap-1.5 transition-all"
            >
              <RotateCcw size={12} />
              Reset All to Defaults
            </button>
          )}
        </div>
      </div>

      {/* Safety & Tool Access Notice + Filter Bar */}
      <div className="py-3 space-y-3">
        <div className={`p-3 rounded-xl flex items-center gap-2.5 ${cardSurfaceClass}`}>
          <Shield size={15} className="text-cyan-400 shrink-0" />
          <div className="text-[11px] text-slate-300 leading-relaxed">
            <strong className="text-slate-100">Strict Architecture Safeguards:</strong> Agents cannot autonomously pass messages or initiate rounds. VERITAS is granted exactly ONE live search query in Round 1 only to anchor the discussion with empirical facts. The swarm auto-stops strictly after Round 3.
          </div>
        </div>

        {/* Filter / Search Agents Bar */}
        <div className="relative">
          <input
            id="parallax-search-agents-input"
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter agents by name, role, or instruction..."
            className={`w-full py-2 pl-9 pr-3.5 rounded-full placeholder-slate-400 text-xs focus:outline-none focus:ring-1 transition-all ${inputSurfaceClass}`}
          />
          <Search
            size={14}
            className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
          />
        </div>
      </div>

      {/* 20 Agents Grid */}
      <div className="pt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filteredAgents.map((agent) => {
          const defaultAgent = DEFAULT_PARALLAX_AGENTS[agent.id];
          const isCustomized =
            (agent.systemInstruction || '').trim() !== (defaultAgent?.systemInstruction || '').trim();

          return (
            <div
              key={agent.id}
              id={`parallax-agent-card-${agent.id}`}
              className={`rounded-2xl p-3 sm:p-3.5 flex flex-col gap-2.5 transition-colors ${cardSurfaceClass}`}
              style={{
                borderLeft: `2px solid ${agent.enabled ? agent.accentColor : 'rgba(148, 163, 184, 0.3)'}`,
              }}
            >
              {/* Agent Card Header */}
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <ParallaxAgentAvatar
                    agentId={agent.id}
                    agentName={agent.name}
                    accentColor={agent.accentColor}
                    size="md"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-slate-100">{agent.name}</span>
                      {agent.id === 'veritas' ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold">
                          🔍 Fact Tool (R1)
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800/60 text-slate-300">
                          No Tools
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-300 block mt-0.5">
                      {agent.role}
                    </span>
                  </div>
                </div>

                {/* Active Toggle Switch */}
                <label className="relative inline-block w-10 h-5 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={agent.enabled}
                    onChange={(e) => handleUpdateAgent(agent.id, { enabled: e.target.checked })}
                    className="opacity-0 w-0 h-0"
                  />
                  <span
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: agent.enabled ? agent.accentColor : 'rgba(255,255,255,0.15)',
                      transition: '.25s',
                      borderRadius: '22px',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        height: '14px',
                        width: '14px',
                        left: agent.enabled ? '22px' : '3px',
                        bottom: '3px',
                        backgroundColor: '#fff',
                        transition: '.25s',
                        borderRadius: '50%',
                      }}
                    />
                  </span>
                </label>
              </div>

              {/* Editable System Instruction */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-mono text-cyan-300 font-bold tracking-wider">
                    PERSONA INSTRUCTION:
                  </label>
                  {isCustomized && (
                    <button
                      type="button"
                      onClick={() => handleResetSingleAgent(agent.id)}
                      className="text-[10px] text-sky-400 hover:text-sky-300 cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw size={10} /> Reset
                    </button>
                  )}
                </div>
                <textarea
                  value={agent.systemInstruction}
                  onChange={(e) => handleUpdateAgent(agent.id, { systemInstruction: e.target.value })}
                  rows={2}
                  className={`w-full p-2.5 rounded-xl text-xs leading-relaxed resize-y focus:outline-none focus:ring-1 transition-all ${inputSurfaceClass}`}
                />
              </div>

              {/* AI Provider & Model Select */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono text-slate-300 mb-1 font-semibold">
                    AI PROVIDER:
                  </label>
                  <select
                    value={agent.providerId || 'existing'}
                    onChange={(e) => {
                      const newProvId = e.target.value;
                      const prov = providersState.providers.find((p) => p.id === newProvId);
                      handleUpdateAgent(agent.id, {
                        providerId: newProvId,
                        modelId: prov ? prov.model : agent.modelId || 'deepseek/deepseek-chat',
                      });
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-[11px] focus:outline-none focus:ring-1 ${inputSurfaceClass}`}
                  >
                    {availableProviders.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-300 mb-1 font-semibold">
                    MODEL ID:
                  </label>
                  <input
                    type="text"
                    value={agent.modelId || 'deepseek/deepseek-chat'}
                    onChange={(e) => handleUpdateAgent(agent.id, { modelId: e.target.value })}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-[11px] focus:outline-none focus:ring-1 ${inputSurfaceClass}`}
                  />
                </div>
              </div>

              {/* Edge TTS Neural Voice Selector */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="flex items-center gap-1 text-[10px] font-mono text-slate-300 font-semibold">
                    <Volume2 size={11} className="text-cyan-400" />
                    EDGE TTS NEURAL VOICE:
                  </label>
                  <button
                    type="button"
                    onClick={() => handleTestVoice(agent)}
                    className="text-[10px] text-sky-400 hover:text-sky-300 cursor-pointer flex items-center gap-1 px-1.5 py-0.5 rounded"
                    title="Preview speech audio with this voice"
                  >
                    {testingVoiceAgentId === agent.id ? (
                      <>
                        <Square size={10} /> Stop Preview
                      </>
                    ) : (
                      <>
                        <Play size={10} /> Test Voice
                      </>
                    )}
                  </button>
                </div>
                <select
                  value={agent.voice || getParallaxAgentVoice(agent.id)}
                  onChange={(e) => handleUpdateAgent(agent.id, { voice: e.target.value })}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-[11px] focus:outline-none focus:ring-1 ${inputSurfaceClass}`}
                >
                  {EDGE_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.gender}, {v.language})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
