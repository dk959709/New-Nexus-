import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  Download,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ExternalLink,
  Bookmark,
} from 'lucide-react';
import type { ParallaxSummary, ParallaxMessage } from '@/types';
import { formatFullParallaxTranscript } from '@/data/parallaxVoices';
import { getDebateModeConfig } from '@/data/parallaxDebateModes';
import { ParallaxConfidenceMeter } from './ParallaxConfidenceMeter';
import { computeConfidenceWeightedVerdict } from '@/services/parallaxEvidenceEngine';

export interface ParallaxSynthesisReportProps {
  summary: ParallaxSummary;
  topic: string;
  allMessages: ParallaxMessage[];
  onNewTopic?: () => void;
  onRerun?: () => void;
  onExportMp3?: () => void;
  onSave?: () => void;
}

export const ParallaxSynthesisReport: React.FC<ParallaxSynthesisReportProps> = ({
  summary,
  topic,
  allMessages,
  onNewTopic,
  onRerun,
  onExportMp3,
  onSave,
}) => {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    query: true,
    summary: true,
    findings: true,
    evidence: true,
    consensus: true,
    sources: false,
    confidence: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleCopyTranscript = () => {
    const text = formatFullParallaxTranscript(topic, allMessages, summary);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExportMarkdown = () => {
    const text = formatFullParallaxTranscript(topic, allMessages, summary);
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const sanitizedTopic = topic.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40);
    a.download = `nexus-parallax-report-${sanitizedTopic}-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    if (onSave) {
      onSave();
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // Determine Grounding badge styling
  const groundingLevel = summary.groundingLevel || 'HIGH';
  const groundingColor =
    groundingLevel === 'HIGH'
      ? '#10b981'
      : groundingLevel === 'MODERATE'
      ? '#38bdf8'
      : '#f59e0b';

  const modeConfig = getDebateModeConfig(summary.debateMode);
  const modeAccentColor = modeConfig.accentColor || '#06b6d4';
  const rawHeadline = summary.modeResult?.headline || '';

  const [countProgress, setCountProgress] = useState<number>(1);

  useEffect(() => {
    if (!rawHeadline || !/\d/.test(rawHeadline)) {
      setCountProgress(1);
      return;
    }
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setCountProgress(1);
      return;
    }

    let rafId = 0;
    const duration = 600;
    const start = performance.now();
    setCountProgress(0);

    const tick = (now: number) => {
      const elapsed = now - start;
      const p = Math.min(1, elapsed / duration);
      // Smooth ease-out
      const eased = 1 - Math.pow(1 - p, 3);
      setCountProgress(eased);
      if (p < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [rawHeadline]);

  const animatedHeadline = React.useMemo(() => {
    if (!rawHeadline || countProgress >= 1) return rawHeadline;
    return rawHeadline.replace(/\d+/g, (match) => {
      const num = parseInt(match, 10);
      if (Number.isNaN(num)) return match;
      return String(Math.round(num * countProgress));
    });
  }, [rawHeadline, countProgress]);

  const headlineColor = React.useMemo(() => {
    const upper = rawHeadline.toUpperCase();
    if (!upper) return modeAccentColor;
    // Check amber outcomes first (so PARTIALLY UPHELD is caught before UPHELD)
    if (
      upper.includes('PARTIALLY UPHELD') ||
      upper.includes('CONDITIONAL') ||
      upper.includes('DRAW') ||
      upper.includes('NO VALID VOTES') ||
      upper.includes('NO VALID CALLS')
    ) {
      return '#fbbf24';
    }
    // Check red outcomes next (so NOT UPHELD is caught before UPHELD, and DECISION: PASS before PASSED)
    if (
      upper.includes('NOT UPHELD') ||
      upper.includes('REJECTED') ||
      upper.includes('RED WINS') ||
      /^DECISION:\s*PASS\b/.test(upper)
    ) {
      return '#fb7185';
    }
    // Check green outcomes
    if (
      upper.includes('UPHELD') ||
      upper.includes('PASSED') ||
      upper.includes('INVEST') ||
      upper.includes('BLUE WINS')
    ) {
      return '#34d399';
    }
    return modeAccentColor;
  }, [rawHeadline, modeAccentColor]);

  return (
    <div
      id="parallax-synthesis-report"
      className="relative py-6 pl-4 sm:pl-6 border-l-2 border-cyan-400/60 my-6 select-text"
    >
      <style>{`
        @keyframes parallaxModeCardIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes parallaxModeDetailIn {
          from {
            opacity: 0;
            transform: translateY(5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .parallax-mode-card-anim {
          animation: parallaxModeCardIn 200ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .parallax-mode-detail-anim {
          animation: parallaxModeDetailIn 200ms ease-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          .parallax-mode-card-anim,
          .parallax-mode-detail-anim {
            animation: none !important;
          }
        }
      `}</style>
      {/* Timeline Node Dot on Left Connector */}
      <div className="absolute -left-[6px] top-7 w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_12px_#00f0ff]" />

      {/* Top Operations Header */}
      <div className="pb-5 border-b border-white/[0.06] relative">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 font-mono text-xs text-cyan-300 font-bold uppercase tracking-widest">
              <Sparkles size={14} className="text-cyan-400" />
              <span>FINAL INTELLIGENCE REPORT // SYNTHESIS PROTOCOL</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight font-sans m-0 leading-snug">
              &ldquo;{topic}&rdquo;
            </h2>

            <div className="flex items-center gap-3 pt-1 flex-wrap font-mono text-xs">
              {summary.debateMode === 'genesis' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-400/40 text-violet-200 font-bold">
                  <Sparkles size={13} className="text-violet-300" />
                  <span>
                    Genesis Swarm · {(summary.swarmSize ?? 20) - 2} auto agents · 1 round
                  </span>
                </span>
              )}

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/40 backdrop-blur-xl text-cyan-300 font-bold">
                <ShieldCheck size={13} />
                <span>CONSENSUS LEAN: {summary.consensusLean || 'BALANCED'}</span>
              </span>

              <span className="text-slate-300 text-[11px]">
                GROUNDING:{' '}
                <strong style={{ color: groundingColor }}>{groundingLevel} CONFIDENCE</strong>
              </span>

              <span className="text-white/20">•</span>

              <span className="text-slate-300 text-[11px]">
                {allMessages.length} SWARM TURNS SYNTHESIZED
              </span>
            </div>
          </div>

          {/* Action Buttons: [ COPY ] [ EXPORT ] [ SAVE ] [ NEW ANALYSIS ] */}
          <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
            <button
              id="parallax-report-copy-btn"
              type="button"
              onClick={handleCopyTranscript}
              className={`px-3.5 py-2 rounded-full font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-slate-900/40 backdrop-blur-xl hover:bg-slate-800/60 text-slate-100'
              }`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'COPIED' : 'COPY'}</span>
            </button>

            <button
              id="parallax-report-export-btn"
              type="button"
              onClick={handleExportMarkdown}
              className="px-3.5 py-2 rounded-full bg-slate-900/40 backdrop-blur-xl hover:bg-slate-800/60 text-slate-100 font-bold transition-all cursor-pointer flex items-center gap-1.5"
              title="Download complete intelligence report as Markdown"
            >
              <Download size={14} />
              <span>EXPORT</span>
            </button>

            {onExportMp3 && (
              <button
                id="parallax-report-export-mp3-btn"
                type="button"
                onClick={onExportMp3}
                className="px-3.5 py-2 rounded-full bg-slate-900/40 backdrop-blur-xl hover:bg-slate-800/60 text-slate-100 font-bold transition-all cursor-pointer flex items-center gap-1.5"
                title="Export complete swarm speech as MP3"
              >
                <Download size={14} />
                <span>EXPORT MP3</span>
              </button>
            )}

            <button
              id="parallax-report-save-btn"
              type="button"
              onClick={handleSave}
              className={`px-3.5 py-2 rounded-full font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                saved
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-slate-900/40 backdrop-blur-xl hover:bg-slate-800/60 text-slate-100'
              }`}
            >
              {saved ? <Check size={14} /> : <Bookmark size={14} />}
              <span>{saved ? 'SAVED' : 'SAVE'}</span>
            </button>

            {onRerun && (
              <button
                id="parallax-report-rerun-btn"
                type="button"
                onClick={onRerun}
                className="px-3.5 py-2 rounded-full bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30 font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw size={14} />
                <span>RE-RUN</span>
              </button>
            )}

            {onNewTopic && (
              <button
                id="parallax-report-new-analysis-btn"
                type="button"
                onClick={onNewTopic}
                className="px-3.5 py-2 rounded-full bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles size={14} />
                <span>NEW ANALYSIS</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MODE RESULT CARD (When debateMode !== 'default' and !== 'genesis' and modeResult is present) */}
      {summary.modeResult && summary.debateMode !== 'genesis' && (
        <div
          id="parallax-mode-result-card"
          style={{
            borderColor: `${modeAccentColor}66`,
            boxShadow: `0 0 22px -4px ${modeAccentColor}40, inset 0 0 18px ${modeAccentColor}12`,
          }}
          className="parallax-mode-card-anim mb-4 p-4 sm:p-5 rounded-2xl border bg-slate-900/80 backdrop-blur-xl space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-[10.5px] font-mono font-bold uppercase tracking-widest"
              style={{ color: modeAccentColor }}
            >
              Mode Result · {summary.modeResult.title}
            </span>
            {summary.debateMode && summary.debateMode !== 'default' && (
              <span
                style={{
                  borderColor: `${modeAccentColor}50`,
                  backgroundColor: `${modeAccentColor}1f`,
                  color: '#f8fafc',
                }}
                className="px-2 py-0.5 rounded-md border text-[10px] font-mono uppercase tracking-wider"
              >
                {modeConfig.label || summary.debateMode.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          <div
            style={{ color: headlineColor }}
            className="text-xl sm:text-[26px] font-extrabold font-mono tabular-nums tracking-wide leading-snug"
          >
            {animatedHeadline}
          </div>
          {summary.modeResult.details && summary.modeResult.details.length > 0 && (
            <ul className="list-disc pl-4 sm:pl-5 space-y-1 text-xs sm:text-[13px] text-slate-200 leading-relaxed m-0">
              {summary.modeResult.details.map((detail, idx) => (
                <li
                  key={idx}
                  className={idx < 8 ? 'parallax-mode-detail-anim' : undefined}
                  style={
                    idx < 8
                      ? { animationDelay: `${idx * 40}ms` }
                      : undefined
                  }
                >
                  {detail}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Hairline Divided Sections Content */}
      <div className="divide-y divide-white/[0.06]">
        {/* SECTION 1: QUERY & SCOPE */}
        <div className="py-4">
          <button
            type="button"
            onClick={() => toggleSection('query')}
            className="w-full py-2 flex items-center justify-between text-left font-mono text-xs font-bold text-slate-100 hover:text-cyan-300 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#00f0ff]" />
              <span className="uppercase tracking-wider">
                01. QUERY & DELIBERATION SCOPE
              </span>
            </div>
            {expandedSections.query ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {expandedSections.query && (
            <div className="pt-3 space-y-3 font-mono text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900/40 backdrop-blur-xl text-slate-100 font-sans leading-relaxed">
                <strong className="text-cyan-300 font-mono">OPERATIONAL INQUIRY:</strong> &ldquo;{topic}&rdquo;
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px] text-slate-300">
                <div className="p-2.5 rounded-xl bg-slate-900/40 backdrop-blur-xl">
                  <span className="text-slate-400">PROTOCOL:</span>{' '}
                  {summary.debateMode === 'genesis' ? 'Genesis Swarm (1 Round)' : '3-Round Matrix'}
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/40 backdrop-blur-xl">
                  <span className="text-slate-400">SWARM SIZE:</span>{' '}
                  {summary.debateMode === 'genesis'
                    ? `2 Fixed + ${(summary.swarmSize ?? 20) - 2} Auto Agents`
                    : '20 Personas + Specialists'}
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/40 backdrop-blur-xl">
                  <span className="text-slate-400">GROUNDING:</span> VERITAS Live Search
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/40 backdrop-blur-xl">
                  <span className="text-slate-400">OUTPUT:</span> Multi-Agent Consensus
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: EXECUTION SUMMARY */}
        <div className="py-4">
          <button
            type="button"
            onClick={() => toggleSection('summary')}
            className="w-full py-2 flex items-center justify-between text-left font-mono text-xs font-bold text-slate-100 hover:text-cyan-300 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#00f0ff]" />
              <span className="uppercase tracking-wider">
                02. EXECUTION SUMMARY
              </span>
            </div>
            {expandedSections.summary ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {expandedSections.summary && (
            <div className="pt-3 space-y-4 font-sans text-xs">
              <div className="p-4 rounded-xl bg-slate-900/40 backdrop-blur-xl text-slate-100 text-sm leading-relaxed border-l-2 border-cyan-400 whitespace-pre-wrap">
                {summary.verdict}
              </div>

              {/* Confidence Weighted Verdict Meter */}
              <ParallaxConfidenceMeter
                verdict={
                  summary.confidenceVerdict ||
                  computeConfidenceWeightedVerdict(summary.verifiedClaims || [], allMessages)
                }
              />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-[11px]">
                <div className="p-3 rounded-xl bg-slate-900/40 backdrop-blur-xl text-center">
                  <div className="text-slate-300 text-[10px]">TURNS LOGGED</div>
                  <div className="text-cyan-300 font-bold text-base mt-0.5">{allMessages.length}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/40 backdrop-blur-xl text-center">
                  <div className="text-slate-300 text-[10px]">ROUNDS COMPLETED</div>
                  <div className="text-emerald-300 font-bold text-base mt-0.5">
                    {summary.debateMode === 'genesis' ? '1 / 1' : '3 / 3'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/40 backdrop-blur-xl text-center">
                  <div className="text-slate-300 text-[10px]">VERIFIED CLAIMS</div>
                  <div className="text-purple-300 font-bold text-base mt-0.5">{summary.verifiedClaims?.length || 0}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/40 backdrop-blur-xl text-center">
                  <div className="text-slate-300 text-[10px]">CITED SOURCES</div>
                  <div className="text-amber-300 font-bold text-base mt-0.5">{summary.evidenceSources?.length || 0}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 3: KEY FINDINGS */}
        <div className="py-4">
          <button
            type="button"
            onClick={() => toggleSection('findings')}
            className="w-full py-2 flex items-center justify-between text-left font-mono text-xs font-bold text-slate-100 hover:text-cyan-300 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#00f0ff]" />
              <span className="uppercase tracking-wider">
                03. KEY FINDINGS & STRATEGIC TAKEAWAYS
              </span>
            </div>
            {expandedSections.findings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {expandedSections.findings && (
            <div className="pt-3 space-y-3 font-sans text-xs">
              {summary.highlights && summary.highlights.length > 0 ? (
                <ul className="m-0 pl-5 space-y-2 text-slate-100">
                  {summary.highlights.map((h, i) => (
                    <li key={i} className="leading-relaxed">
                      {h}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-slate-300 italic">No specific highlights recorded.</div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 4: EVIDENCE & GROUNDED CLAIMS */}
        {summary.verifiedClaims && summary.verifiedClaims.length > 0 && (
          <div className="py-4">
            <button
              type="button"
              onClick={() => toggleSection('evidence')}
              className="w-full py-2 flex items-center justify-between text-left font-mono text-xs font-bold text-slate-100 hover:text-cyan-300 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
                <span className="uppercase tracking-wider">
                  04. EVIDENCE POOL & VERIFIED CLAIMS ({summary.verifiedClaims.length})
                </span>
              </div>
              {expandedSections.evidence ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {expandedSections.evidence && (
              <div className="pt-3 space-y-2.5">
                {summary.verifiedClaims.map((c) => {
                  const statusBadgeColor =
                    c.status === 'VERIFIED'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : c.status === 'PLAUSIBLE'
                      ? 'bg-sky-500/20 text-sky-300'
                      : c.status === 'DISPUTED'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-rose-500/20 text-rose-300';

                  return (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-xl bg-slate-900/40 backdrop-blur-xl font-mono space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeColor}`}>
                          {c.status} • {Math.round(c.confidence * 100)}% CONFIDENCE
                        </span>
                        <span className="text-[10px] text-slate-300 uppercase">
                          TYPE: {c.claimType}
                        </span>
                      </div>

                      <p className="m-0 text-xs font-sans text-slate-100 font-medium">
                        {c.claimText}
                      </p>

                      {c.reasoning && (
                        <p className="m-0 text-[11px] font-sans text-slate-300 italic">
                          Rationale: {c.reasoning}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SECTION 5: AGENT CONSENSUS & IDEOLOGICAL MATRIX */}
        <div className="py-4">
          <button
            type="button"
            onClick={() => toggleSection('consensus')}
            className="w-full py-2 flex items-center justify-between text-left font-mono text-xs font-bold text-slate-100 hover:text-cyan-300 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_6px_#c084fc]" />
              <span className="uppercase tracking-wider">
                05. AGENT CONSENSUS & VALUE CONFLICTS
              </span>
            </div>
            {expandedSections.consensus ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {expandedSections.consensus && (
            <div className="pt-3 space-y-3 font-sans text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900/40 backdrop-blur-xl flex items-center justify-between flex-wrap gap-2">
                <span className="font-mono text-slate-200">SWARM CONSENSUS POLARITY:</span>
                <span className="font-mono font-bold text-cyan-300 px-3 py-1 rounded-full bg-cyan-500/20">
                  {summary.consensusLean}
                </span>
              </div>

              {summary.valueConflicts && summary.valueConflicts.length > 0 && (
                <div>
                  <span className="text-[11px] font-mono font-bold text-purple-300 uppercase tracking-wide">
                    Philosophical & Ethical Divergences:
                  </span>
                  <ul className="m-0 pl-5 mt-1 space-y-1 text-slate-200">
                    {summary.valueConflicts.map((v, idx) => (
                      <li key={idx}>{v}</li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.factualConflicts && summary.factualConflicts.length > 0 && (
                <div className="pt-2 border-t border-white/[0.06]">
                  <span className="text-[11px] font-mono font-bold text-amber-300 uppercase tracking-wide">
                    Empirical / Factual Disagreements:
                  </span>
                  <ul className="m-0 pl-5 mt-1 space-y-1 text-slate-200">
                    {summary.factualConflicts.map((f, idx) => (
                      <li key={idx}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 6: SOURCES & CITATIONS */}
        {summary.evidenceSources && summary.evidenceSources.length > 0 && (
          <div className="py-4">
            <button
              type="button"
              onClick={() => toggleSection('sources')}
              className="w-full py-2 flex items-center justify-between text-left font-mono text-xs font-bold text-slate-100 hover:text-cyan-300 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#00f0ff]" />
                <span className="uppercase tracking-wider">
                  06. VERIFIED CITATIONS & WEB SOURCES ({summary.evidenceSources.length})
                </span>
              </div>
              {expandedSections.sources ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {expandedSections.sources && (
              <div className="pt-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {summary.evidenceSources.map((src, i) => (
                    <a
                      key={i}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl bg-slate-900/40 backdrop-blur-xl hover:bg-slate-800/60 transition-all font-mono text-xs flex items-center justify-between gap-2 group"
                    >
                      <div className="min-w-0">
                        <div className="text-slate-100 font-bold truncate group-hover:text-cyan-300">
                          {src.title || src.domain}
                        </div>
                        <div className="text-[10px] text-slate-300 truncate">
                          {src.domain} • Tier {src.tier || '1'}
                        </div>
                      </div>
                      <ExternalLink size={12} className="text-slate-400 group-hover:text-cyan-300 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECTION 7: CONFIDENCE & SYSTEM INTEGRITY */}
        <div className="py-4">
          <button
            type="button"
            onClick={() => toggleSection('confidence')}
            className="w-full py-2 flex items-center justify-between text-left font-mono text-xs font-bold text-slate-100 hover:text-cyan-300 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
              <span className="uppercase tracking-wider">
                07. GROUNDING CONFIDENCE & TELEMETRY
              </span>
            </div>
            {expandedSections.confidence ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {expandedSections.confidence && (
            <div className="pt-3 space-y-3 font-mono text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900/40 backdrop-blur-xl flex items-center justify-between flex-wrap gap-2">
                <span className="text-slate-200">SYNTHESIS CONFIDENCE LEVEL:</span>
                <span className="font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300">
                  {groundingLevel} CONFIDENCE
                </span>
              </div>
              <p className="m-0 text-slate-300 font-sans text-xs leading-relaxed">
                Grounding level derived from live search verification passes, contradiction checking across 20 agent perspectives, and peer consensus analysis.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
