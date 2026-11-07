import React, { useState } from 'react';
import {
  Sparkles,
  CheckSquare,
  Square,
  Bookmark,
  Check,
  FileDown,
  Loader2,
  ChevronDown,
  ChevronUp,
  Scale,
  Sliders,
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { getPersonaCleanText } from '@/services/multiChatOrchestrator';
import type { MultiChatMessage, MultiChatConsensusData, MultiChatTheme } from '@/types';

interface MultiChatConsensusCardProps {
  message: MultiChatMessage;
  isGeneratingConsensus: boolean;
  onGenerateConsensus: (msg: MultiChatMessage) => void;
  onToggleChecklistItem: (msgId: string, itemId: string) => void;
  theme?: MultiChatTheme;
}

export const MultiChatConsensusCard: React.FC<MultiChatConsensusCardProps> = ({
  message,
  isGeneratingConsensus,
  onGenerateConsensus,
  onToggleChecklistItem,
  theme = 'classic',
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [weights, setWeights] = useState({ nova: 45, orbit: 30, cosmos: 25 });
  const [showWeightingDials, setShowWeightingDials] = useState(false);
  const [savedToVault, setSavedToVault] = useState(() =>
    storage.isSaved(`multichat_${message.id}`),
  );

  const completedResponses = message.responses.filter(
    (r) => r.status === 'completed' && getPersonaCleanText(r).trim().length > 0,
  );

  if (completedResponses.length === 0) {
    return null;
  }

  const consensus: MultiChatConsensusData | undefined = message.consensus;

  const buildMarkdownReport = (): string => {
    const lines: string[] = [
      `# Multi Chat Report: ${message.query}`,
      `Date: ${new Date(message.timestamp).toLocaleString()}`,
      `Mode: ${(message.dialogueMode || 'harmony').toUpperCase()}`,
      '',
    ];

    for (const r of completedResponses) {
      lines.push(`## ${r.icon} ${r.name} (${r.toneBadge || 'Persona'})`);
      lines.push(getPersonaCleanText(r));
      lines.push('');
    }

    if (consensus) {
      lines.push('## ⚖️ Executive Consensus & Verdict');
      lines.push(consensus.verdict);
      lines.push('');
      if (consensus.agreements.length > 0) {
        lines.push('### Key Points of Agreement');
        consensus.agreements.forEach((a) => lines.push(`- ${a}`));
        lines.push('');
      }
      if (consensus.actionChecklist.length > 0) {
        lines.push('### Action Checklist');
        consensus.actionChecklist.forEach((item) =>
          lines.push(`- [${item.done ? 'x' : ' '}] ${item.text}`),
        );
        lines.push('');
      }
    }

    return lines.join('\n');
  };

  const handleSaveToSavedPage = () => {
    const itemId = `multichat_${message.id}`;
    const reportContent = buildMarkdownReport();
    storage.saveItem({
      id: itemId,
      type: 'jarvis',
      title: message.query.slice(0, 90),
      query: message.query,
      subtitle:
        consensus?.verdict ||
        completedResponses
          .map((r) => `${r.name}: ${getPersonaCleanText(r).slice(0, 70)}...`)
          .join(' | '),
      content: reportContent,
      sources: (message.webSources || []).map((ws) => ({
        title: ws.title,
        url: ws.url,
        domain: ws.domain,
      })),
      savedAt: new Date().toLocaleDateString(),
    });
    setSavedToVault(true);
  };

  const handleDownloadMarkdown = () => {
    const md = buildMarkdownReport();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = message.query
      .slice(0, 28)
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .toLowerCase();
    a.href = url;
    a.download = `nexus_multichat_${slug || 'report'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  return (
    <div
      className={`px-3 sm:px-5 py-2.5 sm:py-3 border-t flex flex-col gap-2.5 transition-colors ${
        theme === 'classic'
          ? 'bg-slate-950/90 border-white/10'
          : theme === 'fulldark'
          ? 'bg-[#121212] border-[#262626]'
          : 'bg-zinc-900/90 border-zinc-800'
      }`}
    >
      {/* Top Action Row */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {!consensus ? (
            <button
              type="button"
              onClick={() => onGenerateConsensus(message)}
              disabled={isGeneratingConsensus}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                theme === 'classic'
                  ? 'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 border-cyan-500/35'
                  : theme === 'fulldark'
                  ? 'bg-[#212121] hover:bg-[#2a2a2a] text-[#ececec] border-[#383838]'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700'
              }`}
              title="Synthesize a unified verdict, key agreements, and action checklist from all personas"
            >
              {isGeneratingConsensus ? (
                <>
                  <Loader2 size={12} className="animate-spin text-cyan-400" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Scale size={12} className="text-cyan-400" />
                  <span>Synthesize Consensus</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-cyan-300 hover:text-cyan-200"
            >
              <Sparkles size={12} className="text-cyan-400" />
              <span>EXECUTIVE CONSENSUS &amp; CHECKLIST</span>
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>

        {/* Save to SavedPage & Download .MD Buttons */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Feature 3: Persona Weighting Dials Toggle */}
          <button
            type="button"
            onClick={() => setShowWeightingDials(!showWeightingDials)}
            className={`px-2 py-1 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1 border transition-all ${
              showWeightingDials
                ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
            }`}
            title="Adjust persona weighting dials for this consensus"
          >
            <Sliders size={11} className={showWeightingDials ? 'text-cyan-300' : 'text-slate-400'} />
            <span className="hidden xs:inline">Weights</span>
          </button>

          <button
            type="button"
            onClick={handleSaveToSavedPage}
            className={`px-2 sm:px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1 border transition-all ${
              savedToVault
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : theme === 'classic'
                ? 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10'
                : theme === 'fulldark'
                ? 'bg-[#1c1c1e] hover:bg-[#262629] text-[#d4d4d8] border-[#2e2e32]'
                : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border-zinc-700/70'
            }`}
            title="Save this Multi Chat breakdown to your Saved page"
          >
            {savedToVault ? (
              <>
                <Check size={11} className="text-emerald-400" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Bookmark size={11} />
                <span>Save</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadMarkdown}
            className={`px-2 sm:px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1 border transition-all ${
              theme === 'classic'
                ? 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10'
                : theme === 'fulldark'
                ? 'bg-[#1c1c1e] hover:bg-[#262629] text-[#d4d4d8] border-[#2e2e32]'
                : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border-zinc-700/70'
            }`}
            title="Download full turn + consensus as a Markdown (.md) report"
          >
            <FileDown size={11} />
            <span>.MD</span>
          </button>
        </div>
      </div>

      {/* Feature 3: Interactive Persona Consensus Weighting Sliders */}
      {showWeightingDials && (
        <div className="p-3 sm:p-4 rounded-xl bg-slate-900/85 border border-cyan-500/25 space-y-3 font-mono text-xs my-1 relative overflow-hidden shadow-xl">
          <div className="stitch-corner-bracket stitch-corner-tl" />
          <div className="stitch-corner-bracket stitch-corner-br" />

          <div className="flex items-center justify-between border-b border-white/10 pb-1.5 flex-wrap gap-2">
            <span className="font-bold text-cyan-300 flex items-center gap-1.5 text-[11px]">
              <Sliders size={12} className="text-cyan-400" />
              <span>CONSENSUS INFLUENCE WEIGHTING DIALS</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/30 text-[10px] text-cyan-300 font-bold uppercase">
              {weights.nova > 55
                ? '⚖️ Empirical Rigor Bias'
                : weights.orbit > 45
                ? '⚡ Creative Divergence Bias'
                : '🧘 Trinity Equilibrium'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* NOVA Slider */}
            <div className="space-y-1 bg-black/40 p-2.5 rounded-lg border border-sky-500/20">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-sky-300 font-bold">NOVA (Rigor)</span>
                <span className="text-white font-mono">{weights.nova}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={weights.nova}
                onChange={(e) => setWeights({ ...weights, nova: Number(e.target.value) })}
                className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <span className="text-[9.5px] text-slate-400 block">Demands citations &amp; mathematical consistency</span>
            </div>

            {/* ORBIT Slider */}
            <div className="space-y-1 bg-black/40 p-2.5 rounded-lg border border-amber-500/20">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-amber-300 font-bold">ORBIT (Creative)</span>
                <span className="text-white font-mono">{weights.orbit}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={weights.orbit}
                onChange={(e) => setWeights({ ...weights, orbit: Number(e.target.value) })}
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <span className="text-[9.5px] text-slate-400 block">Injects edge cases &amp; intuitive analogies</span>
            </div>

            {/* COSMOS Slider */}
            <div className="space-y-1 bg-black/40 p-2.5 rounded-lg border border-purple-500/20">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-purple-300 font-bold">COSMOS (Ethics)</span>
                <span className="text-white font-mono">{weights.cosmos}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={weights.cosmos}
                onChange={(e) => setWeights({ ...weights, cosmos: Number(e.target.value) })}
                className="w-full accent-purple-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <span className="text-[9.5px] text-slate-400 block">Maintains systemic alignment &amp; long-term value</span>
            </div>
          </div>
        </div>
      )}

      {/* Live Consensus Fusion Reactor Animation */}
      {isGeneratingConsensus && (
        <div className="relative overflow-hidden p-6 sm:p-8 rounded-2xl border border-cyan-500/40 bg-slate-950/95 flex flex-col items-center justify-center text-center shadow-[0_0_40px_rgba(6,182,212,0.25)] my-2">
          {/* Tactical Corner Brackets */}
          <div className="stitch-corner-bracket stitch-corner-tl" />
          <div className="stitch-corner-bracket stitch-corner-tr" />
          <div className="stitch-corner-bracket stitch-corner-bl" />
          <div className="stitch-corner-bracket stitch-corner-br" />

          {/* Fusion Reactor Core Graphic with Tri-Color Vortex */}
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 mb-4 grid place-items-center">
            {/* Pulsing Shockwave Rings */}
            <div className="absolute inset-0 rounded-full border border-cyan-400/30 fusion-shockwave-ring" />
            <div className="absolute inset-2 rounded-full border border-purple-500/30 fusion-shockwave-ring" style={{ animationDelay: '0.5s' }} />

            {/* Tri-Color Rotating Vortex SVG */}
            <svg viewBox="0 0 100 100" className="w-full h-full fusion-vortex-spin overflow-visible">
              <defs>
                <linearGradient id="vortexCyan" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#006970" stopOpacity="0.1" />
                </linearGradient>
                <linearGradient id="vortexAmber" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#78350f" stopOpacity="0.1" />
                </linearGradient>
                <linearGradient id="vortexViolet" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#c084fc" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#581c87" stopOpacity="0.1" />
                </linearGradient>
              </defs>

              {/* 3 Converging Plasma Energy Beams */}
              <path d="M 50 10 C 65 30, 65 45, 50 50" fill="none" stroke="url(#vortexCyan)" strokeWidth="4" strokeLinecap="round" />
              <path d="M 85 70 C 68 70, 58 58, 50 50" fill="none" stroke="url(#vortexAmber)" strokeWidth="4" strokeLinecap="round" />
              <path d="M 15 70 C 32 70, 42 58, 50 50" fill="none" stroke="url(#vortexViolet)" strokeWidth="4" strokeLinecap="round" />

              {/* Central Fusion Core */}
              <circle cx="50" cy="50" r="14" fill="#00f0ff" className="animate-pulse" style={{ filter: 'drop-shadow(0 0 16px #00f0ff)' }} />
              <circle cx="50" cy="50" r="6" fill="#ffffff" />
            </svg>
          </div>

          <div className="flex items-center gap-2 mb-1.5 font-mono text-cyan-300 font-bold text-xs sm:text-sm tracking-wider uppercase">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>FUSING TRI-CORE CONSENSUS MATRIX</span>
          </div>
          <p className="text-[11px] font-mono text-slate-400 max-w-sm m-0">
            Harmonizing NOVA’s factual rigor, ORBIT’s vivid perspectives, and COSMOS’s holistic wisdom into an executive synthesis...
          </p>
        </div>
      )}

      {/* Expanded Consensus Content */}
      {consensus && isExpanded && (
        <div
          className={`relative p-3 sm:p-3.5 rounded-2xl border space-y-3 text-xs ${
            theme === 'classic'
              ? 'bg-slate-900/75 border-cyan-500/25'
              : theme === 'fulldark'
              ? 'bg-[#1a1a1a] border-[#2e2e2e]'
              : 'bg-zinc-950/80 border-zinc-800'
          }`}
        >
          {/* Tactical Google Stitch Corner Reticles */}
          <div className="stitch-corner-bracket stitch-corner-tl" />
          <div className="stitch-corner-bracket stitch-corner-tr" />
          <div className="stitch-corner-bracket stitch-corner-bl" />
          <div className="stitch-corner-bracket stitch-corner-br" />
          {/* Executive Verdict */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold mb-1">
              Panel Verdict
            </div>
            <p className="text-zinc-100 leading-relaxed text-xs sm:text-[13px] m-0">
              {consensus.verdict}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-white/10">
            {/* Key Agreements */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold mb-1.5">
                Key Agreements
              </div>
              <ul className="space-y-1.5 m-0 pl-0 list-none">
                {consensus.agreements.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-zinc-300 leading-snug">
                    <span className="text-emerald-400 font-bold mt-0.5">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Interactive Action Checklist */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold mb-1.5">
                Next Steps Checklist
              </div>
              <div className="space-y-1">
                {consensus.actionChecklist.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onToggleChecklistItem(message.id, item.id)}
                    className="w-full flex items-start gap-2 text-left p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    {item.done ? (
                      <CheckSquare size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <Square size={14} className="text-zinc-400 shrink-0 mt-0.5" />
                    )}
                    <span
                      className={`leading-snug ${
                        item.done ? 'line-through text-zinc-500' : 'text-zinc-200'
                      }`}
                    >
                      {item.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

