import React, { useState } from 'react';
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

  return (
    <div
      id="parallax-synthesis-report"
      className="nexus-corner-bracket relative rounded-2xl overflow-hidden my-6 select-text"
      style={{
        background: 'linear-gradient(145deg, rgba(3, 10, 18, 0.98) 0%, rgba(2, 6, 12, 1) 100%)',
        border: '1.5px solid rgba(0, 240, 255, 0.45)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 240, 255, 0.15)',
      }}
    >
      {/* Top Holographic Operations Banner */}
      <div className="p-5 sm:p-6 border-b border-cyan-500/25 bg-black/60 relative overflow-hidden">
        {/* Glow corner accent */}
        <div
          className="absolute -top-10 -right-10 w-44 h-44 rounded-full pointer-events-none opacity-25"
          style={{
            background: 'radial-gradient(circle, #00f0ff 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 font-mono text-xs text-cyan-400 font-bold uppercase tracking-widest">
              <Sparkles size={14} className="text-cyan-400" />
              <span>FINAL INTELLIGENCE REPORT // SYNTHESIS PROTOCOL</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight font-sans m-0 leading-snug">
              &ldquo;{topic}&rdquo;
            </h2>

            <div className="flex items-center gap-3 pt-1 flex-wrap font-mono text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 font-bold">
                <ShieldCheck size={13} />
                <span>CONSENSUS LEAN: {summary.consensusLean || 'BALANCED'}</span>
              </span>

              <span className="text-slate-400 text-[11px]">
                GROUNDING:{' '}
                <strong style={{ color: groundingColor }}>{groundingLevel} CONFIDENCE</strong>
              </span>

              <span className="text-slate-500">•</span>

              <span className="text-slate-400 text-[11px]">
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
              className={`px-3.5 py-2 rounded-xl border font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                copied
                  ? 'bg-emerald-950/60 border-emerald-400 text-emerald-300'
                  : 'bg-white/5 border-white/10 hover:border-cyan-400 text-slate-200 hover:text-white'
              }`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'COPIED' : 'COPY'}</span>
            </button>

            <button
              id="parallax-report-export-btn"
              type="button"
              onClick={handleExportMarkdown}
              className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-400 text-slate-200 hover:text-white font-bold transition-all cursor-pointer flex items-center gap-1.5"
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
                className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-400 text-slate-200 hover:text-white font-bold transition-all cursor-pointer flex items-center gap-1.5"
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
              className={`px-3.5 py-2 rounded-xl border font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                saved
                  ? 'bg-emerald-950/60 border-emerald-400 text-emerald-300'
                  : 'bg-white/5 border-white/10 hover:border-cyan-400 text-slate-200 hover:text-white'
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
                className="px-3.5 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400 text-cyan-200 hover:bg-cyan-500/30 font-bold transition-all cursor-pointer flex items-center gap-1.5"
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
                className="px-3.5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400 text-emerald-300 hover:bg-emerald-500/30 font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles size={14} />
                <span>NEW ANALYSIS</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Accordion / Expandable Sections Content */}
      <div className="p-4 sm:p-6 space-y-4">
        {/* SECTION 1: QUERY & SCOPE */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('query')}
            className="w-full p-4 flex items-center justify-between text-left font-mono text-xs font-bold text-white hover:bg-white/[0.03] transition-colors cursor-pointer"
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
            <div className="px-4 pb-4 pt-1 border-t border-white/5 space-y-2 font-mono text-xs">
              <div className="p-3 rounded-lg bg-black/40 border border-white/10 text-slate-300 font-sans leading-relaxed">
                <strong className="text-cyan-400 font-mono">OPERATIONAL INQUIRY:</strong> &ldquo;{topic}&rdquo;
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-400">
                <div className="p-2 rounded bg-white/5 border border-white/5">
                  <span className="text-slate-500">PROTOCOL:</span> 3-Round Matrix
                </div>
                <div className="p-2 rounded bg-white/5 border border-white/5">
                  <span className="text-slate-500">SWARM SIZE:</span> 20 Personas + Specialists
                </div>
                <div className="p-2 rounded bg-white/5 border border-white/5">
                  <span className="text-slate-500">GROUNDING:</span> VERITAS Live Search
                </div>
                <div className="p-2 rounded bg-white/5 border border-white/5">
                  <span className="text-slate-500">OUTPUT:</span> Multi-Agent Consensus
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: EXECUTION SUMMARY */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('summary')}
            className="w-full p-4 flex items-center justify-between text-left font-mono text-xs font-bold text-white hover:bg-white/[0.03] transition-colors cursor-pointer"
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
            <div className="px-4 pb-4 pt-1 border-t border-white/5 space-y-3 font-sans text-xs">
              <div className="p-3.5 rounded-lg bg-cyan-950/20 border border-cyan-500/25 text-slate-100 text-sm leading-relaxed">
                {summary.verdict}
              </div>

              {/* Confidence Weighted Verdict Meter */}
              <ParallaxConfidenceMeter
                verdict={
                  summary.confidenceVerdict ||
                  computeConfidenceWeightedVerdict(summary.verifiedClaims || [], allMessages)
                }
              />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                <div className="p-2.5 rounded bg-black/40 border border-white/10 text-center">
                  <div className="text-slate-400 text-[10px]">TURNS LOGGED</div>
                  <div className="text-cyan-300 font-bold text-base mt-0.5">{allMessages.length}</div>
                </div>
                <div className="p-2.5 rounded bg-black/40 border border-white/10 text-center">
                  <div className="text-slate-400 text-[10px]">ROUNDS COMPLETED</div>
                  <div className="text-emerald-300 font-bold text-base mt-0.5">3 / 3</div>
                </div>
                <div className="p-2.5 rounded bg-black/40 border border-white/10 text-center">
                  <div className="text-slate-400 text-[10px]">VERIFIED CLAIMS</div>
                  <div className="text-purple-300 font-bold text-base mt-0.5">{summary.verifiedClaims?.length || 0}</div>
                </div>
                <div className="p-2.5 rounded bg-black/40 border border-white/10 text-center">
                  <div className="text-slate-400 text-[10px]">CITED SOURCES</div>
                  <div className="text-amber-300 font-bold text-base mt-0.5">{summary.evidenceSources?.length || 0}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 3: KEY FINDINGS */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('findings')}
            className="w-full p-4 flex items-center justify-between text-left font-mono text-xs font-bold text-white hover:bg-white/[0.03] transition-colors cursor-pointer"
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
            <div className="px-4 pb-4 pt-1 border-t border-white/5 space-y-3 font-sans text-xs">
              {summary.highlights && summary.highlights.length > 0 ? (
                <ul className="m-0 pl-5 space-y-2 text-slate-200">
                  {summary.highlights.map((h, i) => (
                    <li key={i} className="leading-relaxed">
                      {h}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-slate-400 italic">No specific highlights recorded.</div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 4: EVIDENCE & GROUNDED CLAIMS */}
        {summary.verifiedClaims && summary.verifiedClaims.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('evidence')}
              className="w-full p-4 flex items-center justify-between text-left font-mono text-xs font-bold text-white hover:bg-white/[0.03] transition-colors cursor-pointer"
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
              <div className="px-4 pb-4 pt-1 border-t border-white/5 space-y-2.5">
                {summary.verifiedClaims.map((c) => {
                  const statusBadgeColor =
                    c.status === 'VERIFIED'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : c.status === 'PLAUSIBLE'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      : c.status === 'DISPUTED'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40';

                  return (
                    <div
                      key={c.id}
                      className="p-3 rounded-lg bg-black/40 border border-white/10 font-mono space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusBadgeColor}`}>
                          {c.status} • {Math.round(c.confidence * 100)}% CONFIDENCE
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase">
                          TYPE: {c.claimType}
                        </span>
                      </div>

                      <p className="m-0 text-xs font-sans text-white font-medium">
                        {c.claimText}
                      </p>

                      {c.reasoning && (
                        <p className="m-0 text-[11px] font-sans text-slate-400 italic">
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
        <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('consensus')}
            className="w-full p-4 flex items-center justify-between text-left font-mono text-xs font-bold text-white hover:bg-white/[0.03] transition-colors cursor-pointer"
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
            <div className="px-4 pb-4 pt-1 border-t border-white/5 space-y-3 font-sans text-xs">
              <div className="p-3 rounded-lg bg-black/40 border border-white/10 flex items-center justify-between flex-wrap gap-2">
                <span className="font-mono text-slate-300">SWARM CONSENSUS POLARITY:</span>
                <span className="font-mono font-bold text-cyan-300 px-3 py-1 rounded bg-cyan-500/20 border border-cyan-500/40">
                  {summary.consensusLean}
                </span>
              </div>

              {summary.valueConflicts && summary.valueConflicts.length > 0 && (
                <div>
                  <span className="text-[11px] font-mono font-bold text-purple-300 uppercase tracking-wide">
                    Philosophical & Ethical Divergences:
                  </span>
                  <ul className="m-0 pl-5 mt-1 space-y-1 text-slate-300">
                    {summary.valueConflicts.map((v, idx) => (
                      <li key={idx}>{v}</li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.factualConflicts && summary.factualConflicts.length > 0 && (
                <div className="pt-2 border-t border-white/5">
                  <span className="text-[11px] font-mono font-bold text-amber-300 uppercase tracking-wide">
                    Empirical / Factual Disagreements:
                  </span>
                  <ul className="m-0 pl-5 mt-1 space-y-1 text-slate-300">
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
          <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('sources')}
              className="w-full p-4 flex items-center justify-between text-left font-mono text-xs font-bold text-white hover:bg-white/[0.03] transition-colors cursor-pointer"
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
              <div className="px-4 pb-4 pt-1 border-t border-white/5 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {summary.evidenceSources.map((src, i) => (
                    <a
                      key={i}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-lg bg-black/40 border border-white/10 hover:border-cyan-400/50 transition-all font-mono text-xs flex items-center justify-between gap-2 group"
                    >
                      <div className="min-w-0">
                        <div className="text-white font-bold truncate group-hover:text-cyan-300">
                          {src.title || src.domain}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {src.domain} • Tier {src.tier || '1'}
                        </div>
                      </div>
                      <ExternalLink size={12} className="text-slate-500 group-hover:text-cyan-300 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECTION 7: CONFIDENCE & SYSTEM INTEGRITY */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('confidence')}
            className="w-full p-4 flex items-center justify-between text-left font-mono text-xs font-bold text-white hover:bg-white/[0.03] transition-colors cursor-pointer"
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
            <div className="px-4 pb-4 pt-1 border-t border-white/5 space-y-3 font-mono text-xs">
              <div className="p-3 rounded-lg bg-black/40 border border-white/10 flex items-center justify-between flex-wrap gap-2">
                <span className="text-slate-300">SYNTHESIS CONFIDENCE LEVEL:</span>
                <span className="font-bold px-3 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {groundingLevel} CONFIDENCE
                </span>
              </div>
              <p className="m-0 text-slate-400 font-sans text-xs leading-relaxed">
                Grounding level derived from live search verification passes, contradiction checking across 20 agent perspectives, and peer consensus analysis.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
