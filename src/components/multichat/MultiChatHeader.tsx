import React from 'react';
import {
  MessageSquare,
  Sliders,
  Radio,
  Globe2,
  Layers,
} from 'lucide-react';
import type { MultiChatSystemConfig } from '@/types';

interface MultiChatHeaderProps {
  activeTab: 'chat' | 'settings';
  onTabChange: (tab: 'chat' | 'settings') => void;
  config: MultiChatSystemConfig;
  isRunning?: boolean;
  messageCount?: number;
}

export const MultiChatHeader: React.FC<MultiChatHeaderProps> = ({
  activeTab,
  onTabChange,
  config,
  isRunning = false,
  messageCount = 0,
}) => {
  const enabledPersonasCount = Object.values(config.personas || {}).filter((p) => p.enabled).length;
  const language = config.responseLanguage || 'English';

  return (
    <header
      id="nexus-multichat-header"
      className="nexus-corner-bracket relative overflow-hidden rounded-2xl mb-5 select-none"
      style={{
        background: 'linear-gradient(135deg, rgba(6, 16, 26, 0.94) 0%, rgba(3, 10, 18, 0.98) 100%)',
        border: '1px solid rgba(0, 240, 255, 0.25)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), inset 0 0 30px rgba(0, 240, 255, 0.05)',
      }}
    >
      {/* Holographic scanning line */}
      <div className="nexus-header-scanline" />

      {/* Ambient tactical background mesh */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: 'radial-gradient(rgba(0, 240, 255, 0.15) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />

      {/* Main Header Row */}
      <div className="relative z-10 px-4 py-3.5 sm:px-6 sm:py-4 flex flex-wrap items-center justify-between gap-4 border-b border-cyan-500/15">
        {/* Left Branding & Identity */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'radial-gradient(circle at center, rgba(0, 240, 255, 0.3) 0%, rgba(6, 16, 26, 0.9) 100%)',
              border: '1.5px solid rgba(0, 240, 255, 0.6)',
              boxShadow: '0 0 20px rgba(0, 240, 255, 0.35)',
            }}
          >
            <div className="relative">
              <Layers size={22} className="text-cyan-300" />
              {isRunning && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              )}
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="m-0 text-lg sm:text-2xl font-black tracking-tight text-white font-mono flex items-center gap-2">
                <span>NEXUS</span>
                <span className="text-cyan-400 font-extrabold">COGNITIVE COMMAND CENTER</span>
              </h1>
              <span
                className="text-[9px] sm:text-[10px] uppercase font-mono font-bold tracking-widest px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(0, 240, 255, 0.15)',
                  color: '#00f0ff',
                  border: '1px solid rgba(0, 240, 255, 0.35)',
                }}
              >
                3-PERSONA MESH
              </span>
            </div>

            <p className="m-0 text-[11px] sm:text-xs text-slate-400 font-mono tracking-wide flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span>SEQUENTIAL COGNITIVE DIALOGUE:</span>
              <span className="text-cyan-300 font-semibold">NOVA 🧠 (Researcher)</span>
              <span className="text-slate-600">→</span>
              <span className="text-amber-300 font-semibold">ORBIT 😎 (Buddy)</span>
              <span className="text-slate-600">→</span>
              <span className="text-purple-300 font-semibold">COSMOS 🧘 (Mentor)</span>
            </p>
          </div>
        </div>

        {/* Right Navigation & Status */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          {/* Live Status Pill */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono text-xs"
            style={{
              background: 'rgba(3, 10, 18, 0.75)',
              borderColor: isRunning ? 'rgba(0, 240, 255, 0.4)' : 'rgba(16, 185, 129, 0.3)',
            }}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isRunning ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-400'
              }`}
              style={{
                boxShadow: isRunning ? '0 0 8px #00f0ff' : '0 0 8px #10b981',
              }}
            />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
              {isRunning ? 'PIPELINE ACTIVE' : 'COMMAND CENTER ONLINE'}
            </span>
          </div>

          {/* Tab Switcher */}
          <div
            className="flex p-1 rounded-xl gap-1"
            style={{
              background: 'rgba(6, 16, 24, 0.8)',
              border: '1px solid rgba(0, 240, 255, 0.25)',
            }}
          >
            <button
              id="multichat-tab-console-btn"
              type="button"
              onClick={() => onTabChange('chat')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer transition-all ${
                activeTab === 'chat'
                  ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-black shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <MessageSquare size={13} />
              <span>Chat Console</span>
              {messageCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 text-cyan-200">
                  {messageCount}
                </span>
              )}
            </button>

            <button
              id="multichat-tab-settings-btn"
              type="button"
              onClick={() => onTabChange('settings')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer transition-all ${
                activeTab === 'settings'
                  ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-black shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sliders size={13} />
              <span>Agent Configurations</span>
            </button>
          </div>
        </div>
      </div>

      {/* Under-header Telemetry Status Strip */}
      <div
        id="multichat-sub-strip"
        className="px-4 py-2 sm:px-6 bg-black/40 flex items-center justify-between flex-wrap gap-2 text-[11px] font-mono border-t border-white/5"
      >
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
            <span className="text-emerald-300 font-bold">{enabledPersonasCount}/3 PERSONAS ACTIVE</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="text-slate-500">PIPELINE:</span>
            <span className="text-cyan-300 font-semibold">NOVA → ORBIT → COSMOS</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400">
            <Globe2 size={12} className="text-cyan-400" />
            <span>LANGUAGE: <strong className="text-slate-200">{language}</strong></span>
          </div>
        </div>

        <div className="text-[10px] text-slate-400 hidden md:flex items-center gap-2">
          <Radio size={11} className={isRunning ? 'text-cyan-400 animate-pulse' : 'text-slate-600'} />
          <span>REAL-TIME COGNITIVE DIALECTICS • EDGE TTS NEURAL SYNTHESIS READY</span>
        </div>
      </div>
    </header>
  );
};
