import React from 'react';
import { Sparkles, Radio, Activity, Cpu, ShieldCheck } from 'lucide-react';
import { playTapSound } from '@/lib/audio';

interface StudioHeroGraphicProps {
  providerName: string;
  selectedVoiceName: string;
  isFreeTierOk?: boolean;
  onQuickSelectVoice?: (voiceId: string) => void;
  selectedVoiceId: string;
}

export function StudioHeroGraphic({
  providerName,
  selectedVoiceName,
  isFreeTierOk = true,
  onQuickSelectVoice,
  selectedVoiceId,
}: StudioHeroGraphicProps) {
  const quickVoices = [
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', accent: 'American • Reassuring' },
    { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', accent: 'British • Storyteller' },
    { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', accent: 'American • Deep Narrative' },
    { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', accent: 'British • Clear Educator' },
  ];

  return (
    <div className="relative rounded-2xl overflow-hidden border border-purple-500/25 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/60 p-5 sm:p-6 shadow-2xl">
      {/* Decorative ambient studio glow */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Dynamic Animated Equalizer Graphic (Pure SVG & CSS) */}
      <div className="absolute -right-6 top-1/2 -translate-y-1/2 opacity-25 sm:opacity-40 pointer-events-none select-none">
        <svg width="240" height="140" viewBox="0 0 240 140" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Waveform curves */}
          <path
            d="M0 70 Q 30 20, 60 70 T 120 70 T 180 70 T 240 70"
            stroke="url(#gradient-purple)"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="animate-pulse"
          />
          <path
            d="M0 70 Q 30 110, 60 70 T 120 70 T 180 70 T 240 70"
            stroke="url(#gradient-cyan)"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.7"
          />
          <path
            d="M0 70 Q 40 40, 80 70 T 160 70 T 240 70"
            stroke="#a855f7"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.5"
          />
          <defs>
            <linearGradient id="gradient-purple" x1="0" y1="0" x2="240" y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="#9333ea" />
              <stop offset="0.5" stopColor="#c084fc" />
              <stop offset="1" stopColor="#6366f1" />
            </linearGradient>
            <linearGradient id="gradient-cyan" x1="0" y1="0" x2="240" y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38bdf8" />
              <stop offset="0.7" stopColor="#818cf8" />
              <stop offset="1" stopColor="#c084fc" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="relative z-10 space-y-4">
        {/* Studio Status Bar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
              <Radio size={12} className="text-purple-400 animate-pulse" />
              STUDIO VOICE ENGINE
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-slate-800/80 text-slate-300 border border-slate-700/80">
              <Cpu size={12} className="text-indigo-400" />
              {providerName}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck size={13} /> Key Failover Active
            </span>
            <span>•</span>
            <span className="text-slate-400">44.1 kHz Studio Master</span>
          </div>
        </div>

        {/* Title & Description with Studio Master Graphic Badge */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-1 max-w-xl">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2.5">
              <span>Cloud Voice AI Workstation</span>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-200 border border-purple-500/40">
                PRO STUDIO
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Synthesize lifelike, studio-grade speech with ultra-realistic cadence, nuanced emotional tone, and seamless multi-key redundancy.
            </p>
          </div>

          {/* Active Voice Pill Display */}
          <div className="bg-slate-950/70 border border-purple-500/30 rounded-xl p-3 flex items-center gap-3 backdrop-blur-md shadow-inner shrink-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20 shrink-0">
              <Activity size={18} />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Active Studio Voice
              </div>
              <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>{selectedVoiceName}</span>
                {!isFreeTierOk && (
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Paid Plan
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Voice Selector Chips */}
        {onQuickSelectVoice && (
          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={12} className="text-purple-400" />
                Featured Studio Voice Models:
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Click any model to switch instantly
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {quickVoices.map((v) => {
                const isSelected = selectedVoiceId === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      playTapSound();
                      onQuickSelectVoice(v.id);
                    }}
                    className={`text-left p-2.5 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-purple-500/20 border-purple-500/60 text-purple-100 shadow-md shadow-purple-500/10 ring-1 ring-purple-500/30'
                        : 'bg-slate-950/60 hover:bg-slate-800/60 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-semibold text-xs text-slate-100">{v.name}</span>
                      {v.tier && (
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          {v.tier}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">{v.accent}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
