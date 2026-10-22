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

  const actualSourcesCount = briefing.sources?.length ?? briefing.liveSearchCount ?? 0;

  return (
    <div
      id="parallax-intelligence-briefing"
      className="relative py-3.5 sm:py-5 pl-3 sm:pl-6 border-l border-cyan-400/50 border-b border-b-white/[0.06] transition-all font-mono min-w-0 overflow-hidden"
    >
      {/* Timeline Node Dot */}
      <div className="absolute -left-[5px] top-5 sm:top-6 w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#00f0ff]" />

      {/* Header Bar */}
      <div className="pb-3 border-b border-white/[0.06] flex flex-col min-[400px]:flex-row min-[400px]:items-center justify-between gap-2.5">
        <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-slate-900/40 backdrop-blur-xl grid place-items-center shrink-0 mt-0.5 sm:mt-0">
            <Brain size={15} className="text-cyan-400 sm:w-5 sm:h-5 animate-pulse" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="text-[10px] sm:text-xs font-black tracking-wider px-2 py-0.5 rounded-full bg-slate-900/40 backdrop-blur-xl text-cyan-300">
                ROUND 00
              </span>
              <h3 className="m-0 text-xs sm:text-sm font-black text-slate-100 uppercase tracking-wider truncate">
                INTELLIGENCE BRIEFING
              </h3>
              <span className="text-[9.5px] sm:text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 flex items-center gap-1">
                <ShieldCheck size={10} className="shrink-0" />
                <span>{actualSourcesCount} SOURCES GROUNDED</span>
              </span>
            </div>
            <p className="m-0 mt-0.5 text-[10px] sm:text-[11px] text-slate-300 font-sans line-clamp-2 sm:line-clamp-1">
              Shared empirical foundation injected into Round 1 swarm agents
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 self-end min-[400px]:self-auto shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="min-h-[30px] px-2.5 sm:px-3 py-1 rounded-full bg-slate-900/40 backdrop-blur-xl hover:bg-slate-800/60 text-slate-200 hover:text-white text-[10px] sm:text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer"
            title="Copy briefing to clipboard"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="min-h-[30px] px-2.5 sm:px-3 py-1 rounded-full bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 text-[10px] sm:text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Expanded Content Drawer */}
      {isExpanded && (
        <div className="pt-4 space-y-4 animate-fadeIn">
          {/* Briefing Summary */}
          {briefing.summary && (
            <div className="p-3.5 rounded-xl bg-slate-900/40 backdrop-blur-xl text-[11px] sm:text-xs text-slate-100 font-sans leading-relaxed flex items-start gap-2.5">
              <Sparkles size={14} className="text-cyan-400 shrink-0 mt-0.5" />
              <span>{briefing.summary}</span>
            </div>
          )}

          {/* Key Empirical Facts */}
          <div>
            <div className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>KEY EMPIRICAL FACTS & DATA POINTS ({briefing.keyFacts.length}):</span>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {briefing.keyFacts.map((fact, idx) => (
                <div
                  key={idx}
                  className="py-2.5 px-3 rounded-xl hover:bg-slate-900/40 text-[11px] sm:text-xs font-sans text-slate-100 leading-relaxed flex items-start gap-2.5 transition-colors"
                >
                  <span className="font-mono text-[10px] font-bold text-cyan-300 shrink-0 mt-0.5 px-1.5 py-0.5 rounded-full bg-slate-900/40">
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
              <div className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Layers size={11} className="text-purple-400" />
                <span>IDENTIFIED ENTITIES & CANONICAL TAXONOMY:</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {briefing.keyEntities.map((entity, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 font-mono text-[10px] sm:text-[11px] font-semibold"
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
              <div className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Globe size={11} className="text-emerald-400" />
                <span>GROUNDING EVIDENCE SOURCES ({briefing.sources.length}):</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {briefing.sources.slice(0, 6).map((src, idx) => (
                  <a
                    key={idx}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-slate-900/40 backdrop-blur-xl hover:bg-slate-800/60 text-left transition-all flex items-center justify-between gap-2 group text-decoration-none"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] sm:text-xs font-sans text-slate-100 group-hover:text-emerald-300 font-medium truncate">
                        {src.title}
                      </div>
                      <div className="text-[9px] sm:text-[10px] font-mono text-slate-300 flex items-center gap-1.5 mt-0.5">
                        <span>{src.domain}</span>
                        {src.tier && (
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[8.5px] uppercase font-bold ${
                              src.tier === 'high'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {src.tier} tier
                          </span>
                        )}
                      </div>
                    </div>
                    <ExternalLink size={12} className="text-slate-400 group-hover:text-emerald-400 shrink-0 transition-colors" />
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
