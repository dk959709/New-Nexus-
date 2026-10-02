import React, { useState } from 'react';
import {
  Brain,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Copy,
  Check,
  Layers,
  Globe,
} from 'lucide-react';
import type { ParallaxIntelligenceBriefing as IntelligenceBriefingType } from '@/types';

export interface ParallaxIntelligenceBriefingProps {
  briefing: IntelligenceBriefingType;
  defaultExpanded?: boolean;
}

export const ParallaxIntelligenceBriefing: React.FC<ParallaxIntelligenceBriefingProps> = ({
  briefing,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = [
      `### INTELLIGENCE BRIEFING: ${briefing.topic.toUpperCase()}`,
      briefing.summary || '',
      '',
      'KEY EMPIRICAL FACTS:',
      ...briefing.keyFacts.map((f, i) => `[${i + 1}] ${f}`),
      '',
      'KEY ENTITIES: ' + briefing.keyEntities.join(', '),
      '',
      'SOURCES:',
      ...briefing.sources.map((s) => `• ${s.title} (${s.domain}) - ${s.url}`),
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id="parallax-intelligence-briefing"
      className="rounded-xl sm:rounded-2xl overflow-hidden mb-4 sm:mb-6 transition-all font-mono"
      style={{
        background: 'linear-gradient(135deg, rgba(4, 16, 28, 0.94) 0%, rgba(2, 8, 16, 0.98) 100%)',
        border: '1px solid rgba(0, 240, 255, 0.3)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 0 20px rgba(0, 240, 255, 0.04)',
      }}
    >
      {/* Header Bar */}
      <div className="p-3 sm:p-4.5 border-b border-cyan-500/20 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl grid place-items-center shrink-0"
            style={{
              background: 'rgba(0, 240, 255, 0.15)',
              border: '1px solid rgba(0, 240, 255, 0.4)',
              boxShadow: '0 0 14px rgba(0, 240, 255, 0.25)',
            }}
          >
            <Brain size={16} className="text-cyan-400 sm:w-5 sm:h-5 animate-pulse" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="text-[10px] sm:text-xs font-black tracking-wider px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                ROUND 00
              </span>
              <h3 className="m-0 text-xs sm:text-sm font-black text-white uppercase tracking-wider truncate">
                INTELLIGENCE BRIEFING
              </h3>
              <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck size={10} />
                <span>{briefing.liveSearchCount} SOURCES GROUNDED</span>
              </span>
            </div>
            <p className="m-0 mt-0.5 text-[10px] sm:text-[11px] text-slate-400 font-sans line-clamp-1">
              Shared empirical foundation injected into Round 1 swarm agents
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-400/40 text-slate-300 hover:text-white text-[10px] sm:text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer"
            title="Copy briefing to clipboard"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 text-[10px] sm:text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Expanded Content Drawer */}
      {isExpanded && (
        <div className="p-3 sm:p-5 space-y-3.5 sm:space-y-4 animate-fadeIn">
          {/* Briefing Summary */}
          {briefing.summary && (
            <div className="p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-cyan-950/30 border border-cyan-500/25 text-[11px] sm:text-xs text-slate-200 font-sans leading-relaxed flex items-start gap-2">
              <Sparkles size={14} className="text-cyan-400 shrink-0 mt-0.5" />
              <span>{briefing.summary}</span>
            </div>
          )}

          {/* Key Empirical Facts */}
          <div>
            <div className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>KEY EMPIRICAL FACTS & DATA POINTS ({briefing.keyFacts.length}):</span>
            </div>

            <div className="grid grid-cols-1 gap-1.5 sm:gap-2">
              {briefing.keyFacts.map((fact, idx) => (
                <div
                  key={idx}
                  className="p-2 sm:p-2.5 rounded-lg bg-black/40 border border-white/5 hover:border-cyan-500/30 text-[11px] sm:text-xs font-sans text-slate-200 leading-relaxed flex items-start gap-2 transition-colors"
                >
                  <span className="font-mono text-[10px] font-bold text-cyan-400 shrink-0 mt-0.5 px-1 rounded bg-cyan-950/60 border border-cyan-500/30">
                    F{idx + 1}
                  </span>
                  <span className="flex-1">{fact}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Key Entities & Resolved Taxonomy */}
          {briefing.keyEntities && briefing.keyEntities.length > 0 && (
            <div>
              <div className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Layers size={11} className="text-purple-400" />
                <span>IDENTIFIED ENTITIES & CANONICAL TAXONOMY:</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {briefing.keyEntities.map((entity, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-[10px] sm:text-[11px] font-semibold"
                  >
                    {entity}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Grounding Source Attribution List */}
          {briefing.sources && briefing.sources.length > 0 && (
            <div>
              <div className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Globe size={11} className="text-emerald-400" />
                <span>GROUNDING EVIDENCE SOURCES ({briefing.sources.length}):</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                {briefing.sources.slice(0, 6).map((src, idx) => (
                  <a
                    key={idx}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-black/30 border border-white/5 hover:border-emerald-500/40 hover:bg-emerald-950/20 text-left transition-all flex items-center justify-between gap-2 group text-decoration-none"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] sm:text-xs font-sans text-slate-300 group-hover:text-emerald-300 font-medium truncate">
                        {src.title}
                      </div>
                      <div className="text-[9px] sm:text-[10px] font-mono text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span>{src.domain}</span>
                        {src.tier && (
                          <span
                            className={`px-1 py-0.2 rounded text-[8.5px] uppercase font-bold ${
                              src.tier === 'high'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-slate-500/20 text-slate-400'
                            }`}
                          >
                            {src.tier} tier
                          </span>
                        )}
                      </div>
                    </div>
                    <ExternalLink size={12} className="text-slate-600 group-hover:text-emerald-400 shrink-0 transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
