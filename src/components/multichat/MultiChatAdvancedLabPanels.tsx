import React, { useState } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  Download,
  RotateCcw,
  X,
  Loader2,
  Send,
  Zap,
  FlaskConical,
  Activity,
  GraduationCap,
  Table2,
  Trophy,
  AlertTriangle,
  CheckCircle2,
  UserPlus,
  BarChart3,
  Wand2,
  Volume2,
  VolumeX,
  ArrowUp,
  ArrowDown,
  Flame,
  ShieldCheck,
  GitBranch,
  Bookmark,
  Trash2,
  MonitorPlay,
  Globe,
} from 'lucide-react';
import { copyToClipboard } from '@/lib/clipboard';
import { MULTICHAT_GUEST_SPECIALISTS } from '@/services/multiChatOrchestrator';
import type {
  MultiChatMessage,
  MultiChatPersonaId,
  MultiChatGuestSpecialistId,
  MultiChatPromptSplitPlan,
  MultiChatCherryPickBlock,
  MultiChatVaultItem,
  CanvasArtifact,
} from '@/types';

const STRESS_TEST_PRESETS = [
  '💸 Budget cut by 80%',
  '⏱️ Must ship in 48 hours',
  '🔒 Zero external dependencies allowed',
  '👶 Explain & execute for a 10-year-old',
  '📈 Must handle 100x sudden scale',
];

// ============================================================================
// 1. "FRANKENSTEIN" MASTER ANSWER MERGER PANEL
// ============================================================================
export const MultiChatMergedAnswerPanel: React.FC<{
  message: MultiChatMessage;
  isLoading: boolean;
  onRegenerate: (msg: MultiChatMessage) => void;
  onClose: () => void;
}> = ({ message, isLoading, onRegenerate, onClose }) => {
  const data = message.mergedAnswer;
  const [filterPersona, setFilterPersona] = useState<MultiChatPersonaId | 'all'>('all');
  const [copiedClean, setCopiedClean] = useState(false);

  const handleCopyClean = async () => {
    if (!data) return;
    const text = [
      `# ${data.title}`,
      '',
      data.executiveSummary,
      '',
      ...data.sections.map(
        (s) => `## ${s.heading} [${s.icon} ${s.personaName} — ${s.roleContribution}]\n${s.content}`,
      ),
      '',
      `### Unified Conclusion\n${data.unifiedConclusion}`,
    ].join('\n');
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedClean(true);
      setTimeout(() => setCopiedClean(false), 2000);
    }
  };

  const handleDownloadMd = () => {
    if (!data) return;
    const text = [
      `# ${data.title}`,
      `> Synthesized from NOVA, ORBIT & COSMOS on ${new Date(data.generatedAt).toLocaleString()}`,
      '',
      `## Executive Summary`,
      data.executiveSummary,
      '',
      ...data.sections.map(
        (s) => `## ${s.heading}\n*Source: ${s.icon} ${s.personaName} (${s.roleContribution})*\n\n${s.content}`,
      ),
      '',
      `## Unified Conclusion`,
      data.unifiedConclusion,
    ].join('\n');
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus_master_answer_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const visibleSections =
    data?.sections.filter((s) => filterPersona === 'all' || s.personaId === filterPersona) || [];

  return (
    <div className="p-3 sm:p-4 bg-gradient-to-b from-emerald-950/25 via-slate-950/95 to-slate-950 border-t border-emerald-500/30 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-[10px] sm:text-xs font-mono font-bold flex items-center gap-1.5">
            <Zap size={12} className="text-emerald-400" />
            BEST-OF-3 MASTER ANSWER MERGER
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            NOVA’s facts + ORBIT’s analogies + COSMOS’s strategy woven into one document
          </span>
        </div>

        <div className="flex items-center gap-1.5 ml-auto flex-wrap">
          {data && (
            <>
              <div className="flex items-center p-0.5 rounded-xl bg-black/50 border border-white/10 text-[10px] font-mono">
                {(['all', 'nova', 'orbit', 'cosmos'] as const).map((pid) => (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => setFilterPersona(pid)}
                    className={`px-2 py-0.5 rounded-lg uppercase transition-all ${
                      filterPersona === pid
                        ? 'bg-emerald-500/25 text-emerald-200 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {pid === 'all' ? 'All 3' : pid}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onRegenerate(message)}
                disabled={isLoading}
                className="px-2 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-emerald-300 flex items-center gap-1"
              >
                <RotateCcw size={11} className={isLoading ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Re-Merge</span>
              </button>

              <button
                type="button"
                onClick={handleCopyClean}
                className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-slate-200 flex items-center gap-1"
              >
                {copiedClean ? (
                  <>
                    <Check size={11} className="text-emerald-400" />
                    <span className="text-emerald-300">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} />
                    <span>Copy Master</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadMd}
                className="px-2 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-emerald-300 flex items-center gap-1"
                title="Download Master Document as .MD"
              >
                <Download size={11} />
                <span className="hidden sm:inline">.MD</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {isLoading && !data ? (
        <div className="py-8 flex items-center justify-center gap-2 text-emerald-300 font-mono text-xs">
          <Loader2 size={18} className="animate-spin" />
          <span>Weaving best insights from NOVA, ORBIT & COSMOS into a Master Document...</span>
        </div>
      ) : data ? (
        <div className="flex flex-col gap-2.5">
          <div className="p-3 rounded-2xl bg-black/50 border border-emerald-500/25">
            <h4 className="text-sm sm:text-base font-extrabold text-white mb-1">{data.title}</h4>
            <p className="text-xs text-slate-300 leading-relaxed m-0">{data.executiveSummary}</p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {visibleSections.map((sec, sIdx) => (
              <div
                key={`merged_sec_${sec.id || sIdx}_${sIdx}`}
                className="p-3 rounded-2xl bg-black/45 border flex flex-col gap-1.5 transition-all"
                style={{ borderColor: `${sec.accentColor}45` }}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs sm:text-sm font-bold text-white">{sec.heading}</span>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold"
                    style={{
                      background: `${sec.accentColor}20`,
                      color: sec.accentColor,
                      border: `1px solid ${sec.accentColor}40`,
                    }}
                  >
                    <span>{sec.icon}</span>
                    <span>From {sec.personaName}:</span>
                    <span className="opacity-85">{sec.roleContribution}</span>
                  </span>
                </div>
                <p className="text-xs sm:text-[13.5px] text-slate-200 leading-relaxed m-0">
                  {sec.content}
                </p>
              </div>
            ))}
          </div>

          <div className="px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-100 flex items-center gap-2">
            <Sparkles size={14} className="text-emerald-400 shrink-0" />
            <span>
              <strong className="text-emerald-300 font-mono">UNIFIED VERDICT: </strong>
              {data.unifiedConclusion}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
};

// ============================================================================
// 2. "WHAT-IF" CONSTRAINT & STRESS-TEST INJECTOR PANEL
// ============================================================================
export const MultiChatStressTestPanel: React.FC<{
  message: MultiChatMessage;
  isLoading: boolean;
  isGeneratingTurn: boolean;
  onRunConstraint: (msg: MultiChatMessage, constraint: string) => void;
  onSendFollowUp: (prompt: string) => void;
  onClose: () => void;
}> = ({ message, isLoading, isGeneratingTurn, onRunConstraint, onSendFollowUp, onClose }) => {
  const data = message.stressTest;
  const [customConstraint, setCustomConstraint] = useState('');

  return (
    <div className="p-3 sm:p-4 bg-gradient-to-b from-amber-950/25 via-slate-950/95 to-slate-950 border-t border-amber-500/30 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[10px] sm:text-xs font-mono font-bold flex items-center gap-1.5">
            <FlaskConical size={12} className="text-amber-400" />
            "WHAT-IF" CONSTRAINT STRESS-TEST SIMULATOR
          </span>
          <span className="text-[11px] text-slate-400 hidden md:inline">
            Inject a sudden constraint to see how NOVA, ORBIT & COSMOS pivot their strategies
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white ml-auto"
        >
          <X size={14} />
        </button>
      </div>

      {/* Preset Constraint Pills + Custom Input */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {STRESS_TEST_PRESETS.map((preset) => {
            const isActive = data?.constraint === preset;
            return (
              <button
                key={preset}
                type="button"
                disabled={isLoading}
                onClick={() => onRunConstraint(message, preset)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-medium border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-amber-500/25 text-amber-200 border-amber-400/60 font-bold shadow-sm'
                    : 'bg-white/[0.04] hover:bg-amber-500/15 text-slate-300 hover:text-amber-200 border-white/10'
                }`}
              >
                {preset}
              </button>
            );
          })}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (customConstraint.trim()) {
              onRunConstraint(message, customConstraint.trim());
            }
          }}
          className="flex items-center gap-1.5"
        >
          <input
            type="text"
            value={customConstraint}
            onChange={(e) => setCustomConstraint(e.target.value)}
            placeholder='Or type a custom "What-If" constraint (e.g., "Zero cloud budget, offline-first only")...'
            className="flex-1 rounded-xl bg-black/50 border border-white/10 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/50"
          />
          <button
            type="submit"
            disabled={isLoading || !customConstraint.trim()}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <FlaskConical size={12} />
            <span>Stress-Test</span>
          </button>
        </form>
      </div>

      {isLoading ? (
        <div className="py-8 flex items-center justify-center gap-2 text-amber-300 font-mono text-xs">
          <Loader2 size={18} className="animate-spin" />
          <span>Running constraint simulation across NOVA, ORBIT & COSMOS...</span>
        </div>
      ) : data ? (
        <div className="flex flex-col gap-2.5">
          <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs text-amber-200">
              <strong className="font-mono">ACTIVE CONSTRAINT [{data.constraint}]: </strong>
              {data.impactSummary}
            </span>
            <button
              type="button"
              disabled={isGeneratingTurn}
              onClick={() =>
                onSendFollowUp(
                  `Re-evaluate "${message.query.slice(0, 70)}" under this strict constraint: ${data.constraint}. Give me a concrete step-by-step execution plan.`,
                )
              }
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-[10.5px] font-mono font-bold flex items-center gap-1 shrink-0"
            >
              <Send size={10} />
              <span>Broadcast as Full Turn</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {data.pivots.map((piv, pIdx) => (
              <div
                key={`pivot_${piv.personaId || pIdx}_${pIdx}`}
                className="p-3 rounded-2xl bg-black/50 border flex flex-col gap-2"
                style={{ borderColor: `${piv.accentColor}40` }}
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
                  <div className="flex items-center gap-1.5">
                    <span>{piv.icon}</span>
                    <span className="font-bold text-xs" style={{ color: piv.accentColor }}>
                      {piv.personaName} PIVOT
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400">
                  <span className="font-mono text-[10px] uppercase text-slate-500 block">
                    Before (Unconstrained):
                  </span>
                  {piv.originalStance}
                </div>

                <div className="text-xs text-slate-100 bg-white/[0.03] p-2 rounded-xl border border-white/5">
                  <span
                    className="font-mono text-[10px] uppercase font-bold block mb-0.5"
                    style={{ color: piv.accentColor }}
                  >
                    After ({data.constraint}):
                  </span>
                  {piv.adaptedStrategy}
                </div>

                <div className="text-[10.5px] font-mono text-amber-300/90 mt-auto pt-1">
                  ⚖️ Trade-off: {piv.keyTradeoff}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

// ============================================================================
// 3. LIVE TRI-MIND ALIGNMENT & FACT-CHECK RADAR PANEL
// ============================================================================
export const MultiChatAlignmentRadarPanel: React.FC<{
  message: MultiChatMessage;
  isLoading: boolean;
  isGeneratingTurn: boolean;
  onRegenerate: (msg: MultiChatMessage) => void;
  onSendFollowUp: (prompt: string) => void;
  onClose: () => void;
}> = ({ message, isLoading, isGeneratingTurn, onRegenerate, onSendFollowUp, onClose }) => {
  const data = message.alignmentRadar;

  return (
    <div className="p-3 sm:p-4 bg-gradient-to-b from-sky-950/25 via-slate-950/95 to-slate-950 border-t border-sky-500/30 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-200 text-[10px] sm:text-xs font-mono font-bold flex items-center gap-1.5">
            <Activity size={12} className="text-sky-400" />
            TRI-MIND ALIGNMENT & TELEMETRY RADAR
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Live Consensus Score, Risk vs. Upside Balance & #1 Point of Contention
          </span>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {data && (
            <button
              type="button"
              onClick={() => onRegenerate(message)}
              disabled={isLoading}
              className="px-2 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-sky-300 flex items-center gap-1"
            >
              <RotateCcw size={11} className={isLoading ? 'animate-spin' : ''} />
              <span>Re-Audit</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {isLoading && !data ? (
        <div className="py-8 flex items-center justify-center gap-2 text-sky-300 font-mono text-xs">
          <Loader2 size={18} className="animate-spin" />
          <span>Computing Tri-Mind consensus telemetry and risk/opportunity alignment...</span>
        </div>
      ) : data ? (
        <div className="flex flex-col gap-3">
          {/* Top Consensus Score & Confidence Bar */}
          <div className="p-3 rounded-2xl bg-black/50 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-sky-500/15 border border-sky-400/40 flex flex-col items-center justify-center shrink-0">
                <span className="text-lg font-black text-sky-300 font-mono leading-none">
                  {data.consensusScore}%
                </span>
                <span className="text-[8.5px] font-mono text-slate-400 uppercase mt-0.5">
                  Aligned
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-white">Tri-Mind Consensus Index</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                      data.confidenceLevel === 'High Confidence'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                        : data.confidenceLevel === 'Moderate Consensus'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                        : 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                    }`}
                  >
                    {data.confidenceLevel}
                  </span>
                </div>
                <p className="text-xs text-slate-300 m-0">
                  <strong className="text-emerald-300 font-mono">🤝 Shared Ground: </strong>
                  {data.sharedGround}
                </p>
              </div>
            </div>
          </div>

          {/* 3-Persona Risk vs Opportunity Telemetry Bars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {data.personaMetrics.map((pm, mIdx) => (
              <div
                key={`metric_${pm.personaId || mIdx}_${mIdx}`}
                className="p-3 rounded-2xl bg-black/45 border flex flex-col gap-2"
                style={{ borderColor: `${pm.accentColor}40` }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs flex items-center gap-1" style={{ color: pm.accentColor }}>
                    <span>{pm.icon}</span>
                    <span>{pm.personaName}</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-white/5">
                    {pm.stanceTag}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5 text-[10.5px] font-mono">
                  <div>
                    <div className="flex justify-between text-slate-300 mb-0.5">
                      <span>🛡️ Risk & Caution Focus</span>
                      <span>{pm.riskFocus}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-sky-400"
                        style={{ width: `${pm.riskFocus}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 mb-0.5">
                      <span>🚀 Upside & Boldness</span>
                      <span>{pm.opportunityFocus}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{ width: `${pm.opportunityFocus}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* #1 Clash Point Callout */}
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start gap-2 text-xs text-rose-100">
              <AlertTriangle size={15} className="text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-mono font-bold text-rose-300 uppercase mr-1.5">
                  ⚡ Key Point of Contention:
                </span>
                <span>{data.clashPoint}</span>
              </div>
            </div>
            <button
              type="button"
              disabled={isGeneratingTurn}
              onClick={() =>
                onSendFollowUp(
                  `Resolve this core point of contention between NOVA, ORBIT, and COSMOS: "${data.clashPoint}"`,
                )
              }
              className="px-2.5 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 text-[10.5px] font-mono font-bold shrink-0 cursor-pointer"
            >
              ⚔️ Debate This Clash
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

// ============================================================================
// 4. INTERACTIVE STUDY DECK & QUIZ GENERATOR PANEL
// ============================================================================
export const MultiChatStudyDeckPanel: React.FC<{
  message: MultiChatMessage;
  isLoading: boolean;
  onRegenerate: (msg: MultiChatMessage) => void;
  onClose: () => void;
}> = ({ message, isLoading, onRegenerate, onClose }) => {
  const data = message.studyDeck;
  const [subTab, setSubTab] = useState<'flashcards' | 'quiz'>('flashcards');
  const [flippedIds, setFlippedIds] = useState<Record<string, boolean>>({});
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});

  const toggleFlip = (id: string) => {
    setFlippedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const quizList = data?.quiz || [];
  const correctCount = quizList.reduce((acc, q) => {
    return selectedAnswers[q.id] === q.correctIndex ? acc + 1 : acc;
  }, 0);

  return (
    <div className="p-3 sm:p-4 bg-gradient-to-b from-indigo-950/25 via-slate-950/95 to-slate-950 border-t border-indigo-500/30 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-200 text-[10px] sm:text-xs font-mono font-bold flex items-center gap-1.5">
            <GraduationCap size={12} className="text-indigo-400" />
            ACTIVE RECALL STUDY DECK & MINI-QUIZ
          </span>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <div className="flex items-center p-0.5 rounded-xl bg-black/50 border border-white/10 text-[10.5px] font-mono">
            <button
              type="button"
              onClick={() => setSubTab('flashcards')}
              className={`px-2.5 py-0.5 rounded-lg transition-all ${
                subTab === 'flashcards'
                  ? 'bg-indigo-500/25 text-indigo-200 font-bold border border-indigo-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🃏 Flashcards ({data?.flashcards.length || 3})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('quiz')}
              className={`px-2.5 py-0.5 rounded-lg transition-all ${
                subTab === 'quiz'
                  ? 'bg-indigo-500/25 text-indigo-200 font-bold border border-indigo-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🧠 Mini-Quiz ({Object.keys(selectedAnswers).length}/{quizList.length || 3})
            </button>
          </div>

          {data && (
            <button
              type="button"
              onClick={() => {
                setFlippedIds({});
                setSelectedAnswers({});
                onRegenerate(message);
              }}
              disabled={isLoading}
              className="px-2 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-indigo-300 flex items-center gap-1"
            >
              <RotateCcw size={11} className={isLoading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">New Deck</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {isLoading && !data ? (
        <div className="py-8 flex items-center justify-center gap-2 text-indigo-300 font-mono text-xs">
          <Loader2 size={18} className="animate-spin" />
          <span>Generating Tri-Mind Flip Flashcards & Active Recall Quiz...</span>
        </div>
      ) : data ? (
        subTab === 'flashcards' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {data.flashcards.map((card, cIdx) => {
              const isFlipped = Boolean(flippedIds[card.id]);
              return (
                <button
                  key={`card_${card.id || cIdx}_${cIdx}`}
                  type="button"
                  onClick={() => toggleFlip(card.id)}
                  className="p-3.5 rounded-2xl text-left border transition-all flex flex-col justify-between min-h-[155px] cursor-pointer hover:-translate-y-0.5"
                  style={{
                    background: isFlipped
                      ? `linear-gradient(155deg, ${card.accentColor}22 0%, #090d16 90%)`
                      : 'rgba(0,0,0,0.55)',
                    borderColor: isFlipped ? card.accentColor : `${card.accentColor}45`,
                  }}
                >
                  <div className="flex items-center justify-between gap-1.5 w-full pb-2 border-b border-white/10">
                    <span
                      className="text-xs font-bold font-mono flex items-center gap-1"
                      style={{ color: card.accentColor }}
                    >
                      <span>{card.icon}</span>
                      <span>{card.personaName}</span>
                    </span>
                    <span className="text-[9.5px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                      {isFlipped ? '🔓 ANSWER (BACK)' : '❓ QUESTION (FRONT)'}
                    </span>
                  </div>

                  <p className="text-xs sm:text-[13px] text-slate-100 leading-relaxed my-2.5 font-medium">
                    {isFlipped ? card.backAnswer : card.frontQuestion}
                  </p>

                  <div className="flex items-center justify-between w-full text-[10px] font-mono text-slate-400 pt-1 border-t border-white/5">
                    <span>{card.categoryLabel}</span>
                    <span style={{ color: card.accentColor }}>Click to Flip ↻</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs font-mono">
              <span className="text-slate-300">
                Test your mastery across NOVA, ORBIT & COSMOS perspectives
              </span>
              <span className="text-indigo-300 font-bold">
                Score: {correctCount} / {quizList.length}
              </span>
            </div>

            {quizList.map((q, qIdx) => {
              const chosen = selectedAnswers[q.id];
              const isAnswered = chosen !== undefined;
              return (
                <div
                  key={`quiz_${q.id || qIdx}_${qIdx}`}
                  className="p-3 rounded-2xl bg-black/50 border flex flex-col gap-2"
                  style={{ borderColor: `${q.accentColor}40` }}
                >
                  <div className="flex items-center gap-1.5 text-xs">
                    <span>{q.icon}</span>
                    <span className="font-mono font-bold" style={{ color: q.accentColor }}>
                      Q{qIdx + 1} ({q.personaName}):
                    </span>
                    <span className="font-bold text-white">{q.question}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {q.options.map((opt, oIdx) => {
                      const isCorrect = oIdx === q.correctIndex;
                      const isThisChosen = chosen === oIdx;
                      return (
                        <button
                          key={oIdx}
                          type="button"
                          onClick={() =>
                            setSelectedAnswers((prev) => ({ ...prev, [q.id]: oIdx }))
                          }
                          className={`p-2 rounded-xl border text-left text-xs transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            !isAnswered
                              ? 'bg-white/[0.03] hover:bg-white/[0.08] border-white/10 text-slate-200'
                              : isCorrect
                              ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200 font-bold'
                              : isThisChosen
                              ? 'bg-rose-500/20 border-rose-400/60 text-rose-200'
                              : 'bg-black/40 border-white/5 text-slate-500'
                          }`}
                        >
                          <span>{opt}</span>
                          {isAnswered && isCorrect && (
                            <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {isAnswered && (
                    <div className="text-[11px] text-slate-300 bg-white/[0.03] px-2.5 py-1.5 rounded-lg border border-white/10">
                      <strong className="text-indigo-300 font-mono">Explanation: </strong>
                      {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : null}
    </div>
  );
};

// ============================================================================
// 5. SIDE-BY-SIDE WEIGHTED DECISION MATRIX TABLE PANEL
// ============================================================================
export const MultiChatDecisionMatrixPanel: React.FC<{
  message: MultiChatMessage;
  isLoading: boolean;
  isGeneratingTurn: boolean;
  onRegenerate: (msg: MultiChatMessage) => void;
  onSendFollowUp: (prompt: string) => void;
  onClose: () => void;
}> = ({ message, isLoading, isGeneratingTurn, onRegenerate, onSendFollowUp, onClose }) => {
  const data = message.decisionMatrix;
  const [novaWeight, setNovaWeight] = useState<number>(1);
  const [orbitWeight, setOrbitWeight] = useState<number>(1);
  const [cosmosWeight, setCosmosWeight] = useState<number>(1);
  const [copiedTable, setCopiedTable] = useState(false);

  const totalWeight = novaWeight + orbitWeight + cosmosWeight;

  const scoredOptions = (data?.options || [])
    .map((opt) => {
      const weighted =
        (opt.novaScore * novaWeight +
          opt.orbitScore * orbitWeight +
          opt.cosmosScore * cosmosWeight) /
        totalWeight;
      return {
        ...opt,
        weightedScore: Math.round(weighted * 10) / 10,
      };
    })
    .sort((a, b) => b.weightedScore - a.weightedScore);

  const winner = scoredOptions[0] || null;

  const handleCopyMatrix = async () => {
    if (!data) return;
    const rows = [
      `# ${data.matrixTitle}`,
      '',
      '| Option / Strategy | 🔬 NOVA (Tech/Data) | 💡 ORBIT (Speed/Action) | 🌌 COSMOS (Longevity) | 🏆 Weighted Score | Best For |',
      '|---|---|---|---|---|---|',
      ...scoredOptions.map(
        (o) =>
          `| **${o.optionName}** | ${o.novaScore}/10 (${o.novaNote}) | ${o.orbitScore}/10 (${o.orbitNote}) | ${o.cosmosScore}/10 (${o.cosmosNote}) | **${o.weightedScore}/10** | ${o.bestFor} |`,
      ),
    ].join('\n');
    const ok = await copyToClipboard(rows);
    if (ok) {
      setCopiedTable(true);
      setTimeout(() => setCopiedTable(false), 2000);
    }
  };

  return (
    <div className="p-3 sm:p-4 bg-gradient-to-b from-teal-950/25 via-slate-950/95 to-slate-950 border-t border-teal-500/30 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/40 text-teal-200 text-[10px] sm:text-xs font-mono font-bold flex items-center gap-1.5">
            <Table2 size={12} className="text-teal-400" />
            WEIGHTED TRI-MIND DECISION MATRIX
          </span>
          <span className="text-[11px] text-slate-400 hidden md:inline">
            Adjust persona priority weights (1x–3x) to rank strategic options in real time
          </span>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {data && (
            <>
              <button
                type="button"
                onClick={() => onRegenerate(message)}
                disabled={isLoading}
                className="px-2 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-teal-300 flex items-center gap-1"
              >
                <RotateCcw size={11} className={isLoading ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Re-Score</span>
              </button>
              <button
                type="button"
                onClick={handleCopyMatrix}
                className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-slate-200 flex items-center gap-1"
              >
                {copiedTable ? (
                  <>
                    <Check size={11} className="text-emerald-400" />
                    <span className="text-emerald-300">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} />
                    <span>Copy Table</span>
                  </>
                )}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {isLoading && !data ? (
        <div className="py-8 flex items-center justify-center gap-2 text-teal-300 font-mono text-xs">
          <Loader2 size={18} className="animate-spin" />
          <span>Evaluating options across NOVA, ORBIT & COSMOS criteria...</span>
        </div>
      ) : data ? (
        <div className="flex flex-col gap-2.5">
          {/* Interactive Weight Multipliers Bar */}
          <div className="p-2.5 rounded-xl bg-black/50 border border-white/10 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] font-mono text-slate-300 font-bold">
              ⚖️ Priority Multipliers:
            </span>
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { label: '🔬 NOVA (Tech/Data)', val: novaWeight, set: setNovaWeight, color: '#38bdf8' },
                { label: '💡 ORBIT (Speed)', val: orbitWeight, set: setOrbitWeight, color: '#f59e0b' },
                { label: '🌌 COSMOS (Longevity)', val: cosmosWeight, set: setCosmosWeight, color: '#c084fc' },
              ].map((w) => (
                <div key={w.label} className="flex items-center gap-1 text-[10.5px] font-mono">
                  <span style={{ color: w.color }}>{w.label}:</span>
                  {[1, 2, 3].map((mult) => (
                    <button
                      key={mult}
                      type="button"
                      onClick={() => w.set(mult)}
                      className={`px-1.5 py-0.2 rounded transition-all cursor-pointer ${
                        w.val === mult
                          ? 'bg-white/20 text-white font-bold border border-white/30'
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {mult}x
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Options Comparison Cards / Table */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {scoredOptions.map((opt, idx) => {
              const isWinner = idx === 0;
              return (
                <div
                  key={`matrix_opt_${opt.id || idx}_${idx}`}
                  className={`p-3 rounded-2xl border flex flex-col gap-2 transition-all ${
                    isWinner
                      ? 'bg-teal-950/30 border-teal-400/60 shadow-[0_0_20px_rgba(20,184,166,0.2)]'
                      : 'bg-black/45 border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5 pb-1.5 border-b border-white/10">
                    <span className="text-xs font-extrabold text-white truncate">
                      {opt.optionName}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10.5px] font-mono font-black shrink-0 flex items-center gap-1 ${
                        isWinner
                          ? 'bg-amber-400/25 text-amber-200 border border-amber-400/50'
                          : 'bg-white/10 text-slate-200'
                      }`}
                    >
                      {isWinner && <Trophy size={10} className="text-amber-400" />}
                      {opt.weightedScore}/10
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5 text-[11px]">
                    <div className="p-1.5 rounded-lg bg-black/40 border border-sky-500/20">
                      <div className="flex justify-between font-mono text-[10px] text-sky-300 font-bold">
                        <span>🔬 NOVA Score</span>
                        <span>{opt.novaScore}/10</span>
                      </div>
                      <p className="text-slate-300 text-[10.5px] m-0 mt-0.5">{opt.novaNote}</p>
                    </div>

                    <div className="p-1.5 rounded-lg bg-black/40 border border-amber-500/20">
                      <div className="flex justify-between font-mono text-[10px] text-amber-300 font-bold">
                        <span>💡 ORBIT Score</span>
                        <span>{opt.orbitScore}/10</span>
                      </div>
                      <p className="text-slate-300 text-[10.5px] m-0 mt-0.5">{opt.orbitNote}</p>
                    </div>

                    <div className="p-1.5 rounded-lg bg-black/40 border border-purple-500/20">
                      <div className="flex justify-between font-mono text-[10px] text-purple-300 font-bold">
                        <span>🌌 COSMOS Score</span>
                        <span>{opt.cosmosScore}/10</span>
                      </div>
                      <p className="text-slate-300 text-[10.5px] m-0 mt-0.5">{opt.cosmosNote}</p>
                    </div>
                  </div>

                  <div className="mt-auto pt-1.5 border-t border-white/5 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-teal-300 truncate">
                      Best for: {opt.bestFor}
                    </span>
                    <button
                      type="button"
                      disabled={isGeneratingTurn}
                      onClick={() =>
                        onSendFollowUp(
                          `Build a complete execution blueprint for "${opt.optionName}" regarding "${message.query.slice(0, 65)}".`,
                        )
                      }
                      className="px-2 py-0.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 border border-teal-400/40 text-[10px] font-mono font-bold shrink-0 cursor-pointer"
                    >
                      Execute ➔
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {winner && (
            <div className="px-3 py-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-xs text-teal-100 flex items-center justify-between gap-2 flex-wrap">
              <span>
                <strong className="font-mono text-teal-300">
                  🏆 CURRENT WEIGHTED WINNER [{winner.optionName} — {winner.weightedScore}/10]:{' '}
                </strong>
                {data.recommendationSummary}
              </span>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

// ============================================================================
// 6. SUMMON 4TH GUEST SPECIALIST ON-DEMAND PANEL
// ============================================================================
export const MultiChatGuestSpecialistPanel: React.FC<{
  message: MultiChatMessage;
  loadingSpecialistId: MultiChatGuestSpecialistId | null;
  playingAudioKey: string | null;
  onSummonSpecialist: (msg: MultiChatMessage, specialistId: MultiChatGuestSpecialistId) => void;
  onToggleAudio: (text: string, audioKey: string, personaId?: string) => void;
  onSendFollowUp: (prompt: string) => void;
  onClose: () => void;
}> = ({
  message,
  loadingSpecialistId,
  playingAudioKey,
  onSummonSpecialist,
  onToggleAudio,
  onSendFollowUp,
  onClose,
}) => {
  const [copiedGuestId, setCopiedGuestId] = useState<string | null>(null);
  const guestResponses = message.guestResponses || [];

  const handleCopyGuest = async (text: string, id: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedGuestId(id);
      setTimeout(() => setCopiedGuestId(null), 2000);
    }
  };

  return (
    <div className="p-3 sm:p-4 bg-gradient-to-b from-fuchsia-950/25 via-slate-950/95 to-slate-950 border-t border-fuchsia-500/30 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-fuchsia-500/20 border border-fuchsia-400/40 text-fuchsia-200 text-[10px] sm:text-xs font-mono font-bold flex items-center gap-1.5">
            <UserPlus size={12} className="text-fuchsia-400" />
            4TH GUEST SPECIALIST SUMMONER
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Bring in a domain specialist (CFO, Cybersecurity, UX Critic, or Legal Counsel) to audit NOVA, ORBIT & COSMOS
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white ml-auto"
          title="Close Guest Specialist Panel"
        >
          <X size={14} />
        </button>
      </div>

      {/* 4 Guest Specialist Summon Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {MULTICHAT_GUEST_SPECIALISTS.map((spec, sIdx) => {
          const alreadySummoned = guestResponses.some((g) => g.specialistId === spec.id);
          const isThisLoading = loadingSpecialistId === spec.id;
          return (
            <button
              key={`guest_btn_${spec.id}_${sIdx}`}
              type="button"
              disabled={Boolean(loadingSpecialistId)}
              onClick={() => onSummonSpecialist(message, spec.id)}
              className="p-2.5 rounded-2xl border text-left transition-all flex flex-col gap-1 cursor-pointer hover:-translate-y-0.5 disabled:opacity-50"
              style={{
                background: alreadySummoned ? `${spec.accentColor}18` : 'rgba(255,255,255,0.03)',
                borderColor: alreadySummoned ? spec.accentColor : `${spec.accentColor}40`,
              }}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className="text-xs font-extrabold flex items-center gap-1.5 truncate"
                  style={{ color: spec.accentColor }}
                >
                  <span>{spec.icon}</span>
                  <span className="truncate">{spec.name}</span>
                </span>
                {isThisLoading ? (
                  <Loader2 size={12} className="animate-spin shrink-0" style={{ color: spec.accentColor }} />
                ) : (
                  <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-slate-200 shrink-0">
                    {alreadySummoned ? 'Re-Summon' : '+ Summon'}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-mono text-white/90 font-semibold">
                {spec.roleBadge}
              </span>
              <p className="text-[10.5px] text-slate-400 line-clamp-2 m-0 leading-snug">
                {spec.tagline}
              </p>
            </button>
          );
        })}
      </div>

      {/* Loading Indicator */}
      {loadingSpecialistId && (
        <div className="py-4 flex items-center justify-center gap-2 text-fuchsia-300 font-mono text-xs">
          <Loader2 size={16} className="animate-spin" />
          <span>
            Summoning {MULTICHAT_GUEST_SPECIALISTS.find((s) => s.id === loadingSpecialistId)?.name} into the roundtable...
          </span>
        </div>
      )}

      {/* Summoned Guest Specialist Responses */}
      {guestResponses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {guestResponses.map((guest, gIdx) => {
            const audioKey = `guest_audio_${message.id}_${guest.specialistId}_${gIdx}`;
            const isPlaying = playingAudioKey === audioKey;
            return (
              <div
                key={`guest_resp_${guest.id || gIdx}_${gIdx}`}
                className="p-3.5 rounded-2xl bg-black/55 border flex flex-col gap-2 shadow-lg"
                style={{ borderColor: `${guest.accentColor}50` }}
              >
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-7 h-7 rounded-xl grid place-items-center text-sm shrink-0"
                      style={{
                        background: `${guest.accentColor}22`,
                        border: `1px solid ${guest.accentColor}50`,
                      }}
                    >
                      {guest.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="font-extrabold text-xs truncate"
                          style={{ color: guest.accentColor }}
                        >
                          {guest.name}
                        </span>
                        <span
                          className="text-[9.5px] font-mono px-1.5 py-0.2 rounded-full font-bold"
                          style={{
                            background: `${guest.accentColor}20`,
                            color: guest.accentColor,
                          }}
                        >
                          4TH GUEST
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 block truncate">
                        {guest.roleBadge}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleAudio(guest.text, audioKey, 'nova')}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
                      title="Listen to Guest Specialist"
                    >
                      {isPlaying ? (
                        <VolumeX size={12} className="text-fuchsia-400 animate-pulse" />
                      ) : (
                        <Volume2 size={12} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyGuest(`${guest.name} (${guest.roleBadge}):\n${guest.keyVerdict}\n\n${guest.text}`, guest.id)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
                      title="Copy Specialist Audit"
                    >
                      {copiedGuestId === guest.id ? (
                        <Check size={12} className="text-emerald-400" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>
                </div>

                <div
                  className="px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-bold"
                  style={{
                    background: `${guest.accentColor}15`,
                    color: guest.accentColor,
                    border: `1px solid ${guest.accentColor}35`,
                  }}
                >
                  ⚡ Verdict: {guest.keyVerdict}
                </div>

                <p className="text-xs sm:text-[13px] text-slate-200 leading-relaxed m-0">
                  {guest.text}
                </p>

                <div className="pt-1.5 border-t border-white/5 flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      onSendFollowUp(
                        `Following up on Guest Specialist ${guest.name}'s verdict ("${guest.keyVerdict}"): how should NOVA, ORBIT, and COSMOS integrate this into our concrete execution plan?`,
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10.5px] font-mono font-bold text-slate-200 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Send size={10} />
                    <span>Debate Guest Verdict with Trio</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 7. AUTO-CHART & VISUAL TELEMETRY STUDIO PANEL (SVG BAR + RADAR + CARDS)
// ============================================================================
export const MultiChatChartTelemetryPanel: React.FC<{
  message: MultiChatMessage;
  isLoading: boolean;
  onRegenerate: (msg: MultiChatMessage) => void;
  onClose: () => void;
}> = ({ message, isLoading, onRegenerate, onClose }) => {
  const data = message.chartTelemetry;
  const [chartType, setChartType] = useState<'bars' | 'radar' | 'horizontal'>('bars');
  const [copiedChartMd, setCopiedChartMd] = useState(false);
  const svgChartRef = React.useRef<SVGSVGElement | null>(null);

  const handleCopyMarkdownTable = async () => {
    if (!data) return;
    const md = [
      `# ${data.chartTitle}`,
      `_${data.subtitle}_`,
      '',
      '| Dimension | 🔬 NOVA | 💡 ORBIT | 🌌 COSMOS | ⚡ Consensus | Key Insight |',
      '|---|---|---|---|---|---|',
      ...data.metrics.map(
        (m) =>
          `| **${m.dimension}** | ${m.novaValue}/100 | ${m.orbitValue}/100 | ${m.cosmosValue}/100 | **${m.consensusValue}/100** | ${m.insight} |`,
      ),
      '',
      `**Executive Takeaway:** ${data.keyTakeaway}`,
    ].join('\n');
    const ok = await copyToClipboard(md);
    if (ok) {
      setCopiedChartMd(true);
      setTimeout(() => setCopiedChartMd(false), 2000);
    }
  };

  const handleDownloadSvgChart = () => {
    if (!svgChartRef.current) return;
    const serializer = new XMLSerializer();
    const rawSvg = serializer.serializeToString(svgChartRef.current);
    const blob = new Blob([rawSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus_telemetry_chart_${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  // Radar polygon helper for 4 metrics
  const buildRadarPoints = (key: 'novaValue' | 'orbitValue' | 'cosmosValue') => {
    if (!data || data.metrics.length === 0) return '';
    const cx = 220;
    const cy = 145;
    const maxR = 95;
    const count = data.metrics.length;
    return data.metrics
      .map((m, idx) => {
        const angle = (Math.PI * 2 * idx) / count - Math.PI / 2;
        const r = (Math.max(10, Math.min(100, m[key])) / 100) * maxR;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  return (
    <div className="p-3 sm:p-4 bg-gradient-to-b from-blue-950/25 via-slate-950/95 to-slate-950 border-t border-blue-500/30 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-200 text-[10px] sm:text-xs font-mono font-bold flex items-center gap-1.5">
            <BarChart3 size={12} className="text-blue-400" />
            AUTO-CHART & VISUAL TELEMETRY STUDIO
          </span>
          <span className="text-[11px] text-slate-400 hidden md:inline">
            Quantitative multi-axis telemetry extracted from NOVA, ORBIT & COSMOS
          </span>
        </div>

        <div className="flex items-center gap-1.5 ml-auto flex-wrap">
          <div className="flex items-center p-0.5 rounded-xl bg-black/50 border border-white/10 text-[10px] font-mono">
            {[
              { id: 'bars', label: '📊 Grouped Bars' },
              { id: 'radar', label: '🕸️ Radar Web' },
              { id: 'horizontal', label: '📏 Breakdown' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setChartType(tab.id as 'bars' | 'radar' | 'horizontal')}
                className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                  chartType === tab.id
                    ? 'bg-blue-500/25 text-blue-200 font-bold border border-blue-400/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {data && (
            <>
              <button
                type="button"
                onClick={() => onRegenerate(message)}
                disabled={isLoading}
                className="px-2 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-blue-300 flex items-center gap-1"
              >
                <RotateCcw size={11} className={isLoading ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Re-Plot</span>
              </button>
              <button
                type="button"
                onClick={handleCopyMarkdownTable}
                className="px-2 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-slate-200 flex items-center gap-1"
              >
                {copiedChartMd ? (
                  <>
                    <Check size={11} className="text-emerald-400" />
                    <span className="text-emerald-300">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} />
                    <span className="hidden sm:inline">Table</span>
                  </>
                )}
              </button>
              {chartType !== 'horizontal' && (
                <button
                  type="button"
                  onClick={handleDownloadSvgChart}
                  className="px-2 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-emerald-300 flex items-center gap-1"
                  title="Download SVG Chart"
                >
                  <Download size={11} />
                  <span className="hidden sm:inline">SVG</span>
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {isLoading && !data ? (
        <div className="py-8 flex items-center justify-center gap-2 text-blue-300 font-mono text-xs">
          <Loader2 size={18} className="animate-spin" />
          <span>Extracting quantitative telemetry and plotting SVG charts...</span>
        </div>
      ) : data ? (
        <div className="flex flex-col gap-3">
          {/* Chart Header & Legend */}
          <div className="flex items-center justify-between gap-2 flex-wrap px-1">
            <div>
              <h4 className="text-xs sm:text-sm font-extrabold text-white m-0">{data.chartTitle}</h4>
              <p className="text-[11px] text-slate-400 m-0">{data.subtitle}</p>
            </div>
            <div className="flex items-center gap-3 text-[10.5px] font-mono">
              <span className="flex items-center gap-1 text-sky-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-400 inline-block" /> 🔬 NOVA
              </span>
              <span className="flex items-center gap-1 text-amber-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> 💡 ORBIT
              </span>
              <span className="flex items-center gap-1 text-purple-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-purple-400 inline-block" /> 🌌 COSMOS
              </span>
            </div>
          </div>

          {/* MODE 1: GROUPED SVG BAR CHART */}
          {chartType === 'bars' && (
            <div className="rounded-2xl bg-[#070a12] border border-blue-500/25 p-3 overflow-x-auto">
              <svg
                ref={svgChartRef}
                viewBox="0 0 760 250"
                className="w-full h-auto min-w-[540px] block"
              >
                <rect width="760" height="250" fill="#070a12" rx="12" />
                {[0, 25, 50, 75, 100].map((gridVal) => {
                  const y = 195 - (gridVal / 100) * 150;
                  return (
                    <g key={`grid_${gridVal}`}>
                      <line
                        x1="55"
                        y1={y}
                        x2="730"
                        y2={y}
                        stroke="rgba(148,163,184,0.12)"
                        strokeDasharray="4 4"
                      />
                      <text
                        x="45"
                        y={y + 3}
                        textAnchor="end"
                        fill="#64748b"
                        fontSize="10"
                        fontFamily="ui-monospace, monospace"
                      >
                        {gridVal}
                      </text>
                    </g>
                  );
                })}

                {data.metrics.map((m, idx) => {
                  const groupX = 95 + idx * 162;
                  const bars = [
                    { val: m.novaValue, color: '#38bdf8', label: 'N' },
                    { val: m.orbitValue, color: '#f59e0b', label: 'O' },
                    { val: m.cosmosValue, color: '#c084fc', label: 'C' },
                  ];
                  return (
                    <g key={`bar_group_${m.id || idx}_${idx}`}>
                      {bars.map((b, bIdx) => {
                        const h = (b.val / 100) * 150;
                        const x = groupX + bIdx * 32;
                        const y = 195 - h;
                        return (
                          <g key={`bar_${idx}_${bIdx}`}>
                            <rect
                              x={x}
                              y={y}
                              width="24"
                              height={h}
                              rx="5"
                              fill={b.color}
                              fillOpacity="0.88"
                            />
                            <text
                              x={x + 12}
                              y={y - 5}
                              textAnchor="middle"
                              fill={b.color}
                              fontSize="9.5"
                              fontWeight="700"
                              fontFamily="ui-monospace, monospace"
                            >
                              {b.val}
                            </text>
                          </g>
                        );
                      })}
                      <text
                        x={groupX + 44}
                        y="216"
                        textAnchor="middle"
                        fill="#e2e8f0"
                        fontSize="10.5"
                        fontWeight="700"
                        fontFamily="ui-sans-serif, system-ui, sans-serif"
                      >
                        {m.dimension.length > 20 ? `${m.dimension.slice(0, 20)}…` : m.dimension}
                      </text>
                      <text
                        x={groupX + 44}
                        y="232"
                        textAnchor="middle"
                        fill="#38bdf8"
                        fontSize="9.5"
                        fontFamily="ui-monospace, monospace"
                      >
                        Avg: {m.consensusValue}/100
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {/* MODE 2: SVG RADAR WEB POLYGON CHART */}
          {chartType === 'radar' && (
            <div className="rounded-2xl bg-[#070a12] border border-blue-500/25 p-3 flex flex-col md:flex-row items-center gap-4">
              <svg
                ref={svgChartRef}
                viewBox="0 0 440 290"
                className="w-full max-w-[420px] h-auto block shrink-0"
              >
                <rect width="440" height="290" fill="#070a12" rx="12" />
                {[0.33, 0.66, 1].map((scale, sIdx) => (
                  <circle
                    key={`radar_ring_${sIdx}`}
                    cx="220"
                    cy="145"
                    r={95 * scale}
                    fill="none"
                    stroke="rgba(148,163,184,0.16)"
                    strokeDasharray="3 3"
                  />
                ))}
                {data.metrics.map((m, idx) => {
                  const angle = (Math.PI * 2 * idx) / data.metrics.length - Math.PI / 2;
                  const x2 = 220 + Math.cos(angle) * 98;
                  const y2 = 145 + Math.sin(angle) * 98;
                  const lx = 220 + Math.cos(angle) * 124;
                  const ly = 145 + Math.sin(angle) * 116;
                  return (
                    <g key={`radar_axis_${m.id || idx}_${idx}`}>
                      <line
                        x1="220"
                        y1="145"
                        x2={x2}
                        y2={y2}
                        stroke="rgba(148,163,184,0.22)"
                      />
                      <text
                        x={lx}
                        y={ly}
                        textAnchor="middle"
                        fill="#e2e8f0"
                        fontSize="10"
                        fontWeight="700"
                        fontFamily="ui-monospace, monospace"
                      >
                        {m.dimension.length > 18 ? `${m.dimension.slice(0, 18)}…` : m.dimension}
                      </text>
                    </g>
                  );
                })}
                <polygon
                  points={buildRadarPoints('novaValue')}
                  fill="rgba(56,189,248,0.18)"
                  stroke="#38bdf8"
                  strokeWidth="2"
                />
                <polygon
                  points={buildRadarPoints('orbitValue')}
                  fill="rgba(245,158,11,0.16)"
                  stroke="#f59e0b"
                  strokeWidth="2"
                />
                <polygon
                  points={buildRadarPoints('cosmosValue')}
                  fill="rgba(192,132,252,0.16)"
                  stroke="#c084fc"
                  strokeWidth="2"
                />
              </svg>

              <div className="flex-1 grid grid-cols-1 gap-2 w-full">
                {data.metrics.map((m, idx) => (
                  <div
                    key={`radar_note_${m.id || idx}_${idx}`}
                    className="p-2.5 rounded-xl bg-black/50 border border-white/10 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span>{m.dimension}</span>
                      <span className="font-mono text-blue-300">Consensus: {m.consensusValue}%</span>
                    </div>
                    <p className="text-[11px] text-slate-400 m-0">{m.insight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MODE 3: HORIZONTAL BREAKDOWN CARDS */}
          {chartType === 'horizontal' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {data.metrics.map((m, idx) => (
                <div
                  key={`horiz_metric_${m.id || idx}_${idx}`}
                  className="p-3 rounded-2xl bg-black/50 border border-white/10 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{m.dimension}</span>
                    <span className="text-[10.5px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 font-bold">
                      Avg {m.consensusValue}/100
                    </span>
                  </div>
                  {[
                    { label: '🔬 NOVA', val: m.novaValue, color: '#38bdf8' },
                    { label: '💡 ORBIT', val: m.orbitValue, color: '#f59e0b' },
                    { label: '🌌 COSMOS', val: m.cosmosValue, color: '#c084fc' },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center gap-2 text-[10.5px] font-mono">
                      <span className="w-20 shrink-0" style={{ color: row.color }}>
                        {row.label}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${row.val}%`, backgroundColor: row.color }}
                        />
                      </div>
                      <span className="w-8 text-right text-slate-300">{row.val}</span>
                    </div>
                  ))}
                  <p className="text-[11px] text-slate-400 m-0 pt-1 border-t border-white/5">
                    {m.insight}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-100">
            <strong className="font-mono text-blue-300">📊 TELEMETRY TAKEAWAY: </strong>
            {data.keyTakeaway}
          </div>
        </div>
      ) : null}
    </div>
  );
};

// ============================================================================
// 8. SMART PROMPT SPLITTER & PRE-FLIGHT TUNER DRAWER
// ============================================================================
export const MultiChatPromptSplitterDrawer: React.FC<{
  splitPlan: MultiChatPromptSplitPlan;
  isRefining: boolean;
  isGeneratingTurn: boolean;
  onChangePlan: (next: MultiChatPromptSplitPlan) => void;
  onAIRefine: () => void;
  onBroadcastSplit: (plan: MultiChatPromptSplitPlan) => void;
  onClose: () => void;
}> = ({
  splitPlan,
  isRefining,
  isGeneratingTurn,
  onChangePlan,
  onAIRefine,
  onBroadcastSplit,
  onClose,
}) => {
  return (
    <div className="p-3 sm:p-3.5 rounded-2xl border border-cyan-500/35 bg-slate-950/95 backdrop-blur-2xl shadow-2xl flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10 flex-wrap">
        <div className="flex items-center gap-2">
          <Wand2 size={14} className="text-cyan-400" />
          <span className="text-xs font-mono font-bold text-cyan-200">
            PRE-FLIGHT SMART PROMPT SPLITTER (CUSTOM TRIO MISSIONS)
          </span>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={onAIRefine}
            disabled={isRefining}
            className="px-2.5 py-1 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            {isRefining ? (
              <>
                <Loader2 size={11} className="animate-spin" />
                <span>AI Refining...</span>
              </>
            ) : (
              <>
                <Sparkles size={11} />
                <span>AI Supercharge Split</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {/* NOVA Mission */}
        <div className="p-2.5 rounded-xl bg-black/50 border border-sky-500/30 flex flex-col gap-1">
          <span className="text-[10.5px] font-mono font-bold text-sky-300 flex items-center gap-1">
            🔬 @NOVA MISSION (Data & Rigor)
          </span>
          <textarea
            rows={2}
            value={splitPlan.novaMission}
            onChange={(e) => onChangePlan({ ...splitPlan, novaMission: e.target.value })}
            className="w-full bg-transparent text-xs text-slate-100 focus:outline-none resize-none leading-snug"
          />
        </div>

        {/* ORBIT Mission */}
        <div className="p-2.5 rounded-xl bg-black/50 border border-amber-500/30 flex flex-col gap-1">
          <span className="text-[10.5px] font-mono font-bold text-amber-300 flex items-center gap-1">
            💡 @ORBIT MISSION (Action & Speed)
          </span>
          <textarea
            rows={2}
            value={splitPlan.orbitMission}
            onChange={(e) => onChangePlan({ ...splitPlan, orbitMission: e.target.value })}
            className="w-full bg-transparent text-xs text-slate-100 focus:outline-none resize-none leading-snug"
          />
        </div>

        {/* COSMOS Mission */}
        <div className="p-2.5 rounded-xl bg-black/50 border border-purple-500/30 flex flex-col gap-1">
          <span className="text-[10.5px] font-mono font-bold text-purple-300 flex items-center gap-1">
            🌌 @COSMOS MISSION (Strategy & Depth)
          </span>
          <textarea
            rows={2}
            value={splitPlan.cosmosMission}
            onChange={(e) => onChangePlan({ ...splitPlan, cosmosMission: e.target.value })}
            className="w-full bg-transparent text-xs text-slate-100 focus:outline-none resize-none leading-snug"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-[10.5px] font-mono text-slate-400">
          Each persona will execute its custom mission above while collaborating on your query.
        </span>
        <button
          type="button"
          disabled={isGeneratingTurn}
          onClick={() => onBroadcastSplit(splitPlan)}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-lg cursor-pointer"
        >
          <Send size={12} />
          <span>Broadcast Split Mission to Trio</span>
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// HELPER: SEND MULTI-CHAT OUTPUT TO LIVE AI CANVAS STUDIO
// ============================================================================
const SESSION_CANVAS_ARTIFACTS_KEY = 'nexus_canvas_session_artifacts_v1';
const CANVAS_VAULT_STORAGE_KEY = 'nexus_canvas_vault_v1';
const CANVAS_AUTO_OPEN_KEY = 'nexus_canvas_auto_open_v1';

export function sendMultiChatContentToCanvas(params: {
  title: string;
  markdownContent: string;
  sourceBadge: string;
}): CanvasArtifact {
  const { title, markdownContent, sourceBadge } = params;
  const escapedTitle = title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escapedBadge = sourceBadge.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Check if markdownContent already contains a full ```html block
  const htmlFenceMatch = markdownContent.match(/```html\s*([\s\S]*?)```/i);
  const rawHtml =
    htmlFenceMatch && htmlFenceMatch[1] && htmlFenceMatch[1].trim().length > 60
      ? htmlFenceMatch[1].trim()
      : `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapedTitle}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased p-6 md:p-10">
  <div class="max-w-4xl mx-auto space-y-6">
    <header class="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/60 to-slate-900 border border-cyan-500/30 shadow-2xl">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span class="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
          ${escapedBadge}
        </span>
        <span class="text-xs font-mono text-slate-400">${new Date().toLocaleString()}</span>
      </div>
      <h1 class="text-2xl md:text-3xl font-extrabold tracking-tight text-white">${escapedTitle}</h1>
    </header>

    <main id="content-root" class="p-6 md:p-8 rounded-2xl bg-slate-900/90 border border-white/10 shadow-xl space-y-4 leading-relaxed text-slate-200 whitespace-pre-wrap font-sans text-sm md:text-base"></main>

    <footer class="flex items-center justify-between text-xs font-mono text-slate-500 pt-2">
      <span>Generated via NEXUS Multi-Chat Trio Synthesis</span>
      <button onclick="navigator.clipboard.writeText(document.getElementById('content-root').innerText)" class="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 cursor-pointer transition">
        Copy Content
      </button>
    </footer>
  </div>
  <script>
    const rawText = ${JSON.stringify(markdownContent)};
    document.getElementById('content-root').textContent = rawText;
  </script>
</body>
</html>`;

  const artifactId = `mc-canvas-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const newArtifact: CanvasArtifact = {
    id: artifactId,
    title: title.slice(0, 64),
    type: 'html',
    language: 'html',
    content: rawHtml,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    versions: [
      {
        id: `${artifactId}-v1`,
        versionNumber: 1,
        label: `v1 • ${sourceBadge}`,
        content: rawHtml,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ],
  };

  try {
    const existingRaw = localStorage.getItem(SESSION_CANVAS_ARTIFACTS_KEY);
    const existingList: CanvasArtifact[] = existingRaw ? JSON.parse(existingRaw) : [];
    const updatedSession = [newArtifact, ...existingList.filter((a) => a.id !== newArtifact.id)].slice(0, 35);
    localStorage.setItem(SESSION_CANVAS_ARTIFACTS_KEY, JSON.stringify(updatedSession));

    const vaultRaw = localStorage.getItem(CANVAS_VAULT_STORAGE_KEY);
    const vaultList: CanvasArtifact[] = vaultRaw ? JSON.parse(vaultRaw) : [];
    const updatedVault = [newArtifact, ...vaultList.filter((a) => a.id !== newArtifact.id)].slice(0, 25);
    localStorage.setItem(CANVAS_VAULT_STORAGE_KEY, JSON.stringify(updatedVault));

    localStorage.setItem(CANVAS_AUTO_OPEN_KEY, newArtifact.id);
  } catch {
    // ignore storage quota errors
  }

  return newArtifact;
}

// ============================================================================
// 9. SEQUENTIAL CHAIN-OF-CUSTODY RELAY PIPELINE PANEL (IDEA #2)
// ============================================================================
export const MultiChatRelayPipelinePanel: React.FC<{
  message: MultiChatMessage;
  isLoading: boolean;
  onRegenerate: (msg: MultiChatMessage) => void;
  onSendToCanvas: (title: string, content: string, badge: string) => void;
  onSaveToVault: (title: string, content: string, badge: string) => void;
  onClose: () => void;
}> = ({ message, isLoading, onRegenerate, onSendToCanvas, onSaveToVault, onClose }) => {
  const data = message.relayPipeline;
  const [copiedFinal, setCopiedFinal] = useState(false);

  const handleCopyFinal = async () => {
    if (!data) return;
    const fullText = [
      `# 🔗 Chain-of-Custody Relay Deliverable`,
      `Query: ${message.userPrompt}`,
      '',
      ...data.steps.map(
        (s, idx) =>
          `## Stage ${idx + 1}: ${s.stageLabel} (${s.personaId.toUpperCase()})\nHandoff Note: ${s.handoffNote}\n\n${s.output}`
      ),
      '',
      `## 🏆 Final Polished Deliverable`,
      data.finalDeliverable,
    ].join('\n\n');
    await copyToClipboard(fullText);
    setCopiedFinal(true);
    setTimeout(() => setCopiedFinal(false), 1800);
  };

  return (
    <div className="mt-3 rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-slate-950/95 via-cyan-950/20 to-slate-950/95 p-4 shadow-2xl space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
            <GitBranch size={15} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-extrabold uppercase tracking-wider text-cyan-200">
                🔗 Chain-of-Custody Relay Pipeline
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                Draft → Expand → Audit
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Sequential baton pass: NOVA architectures the foundation → ORBIT expands with examples → COSMOS audits &amp; polishes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {data && (
            <>
              <button
                type="button"
                onClick={handleCopyFinal}
                className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 flex items-center gap-1 cursor-pointer"
              >
                {copiedFinal ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copiedFinal ? 'Copied!' : 'Copy Relay'}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onSaveToVault(
                    `Relay Deliverable: ${message.userPrompt.slice(0, 48)}`,
                    data.finalDeliverable,
                    '🔗 Relay Pipeline'
                  )
                }
                className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/30 flex items-center gap-1 cursor-pointer"
              >
                <Bookmark size={12} />
                <span>Vault</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onSendToCanvas(
                    `Relay: ${message.userPrompt.slice(0, 42)}`,
                    data.finalDeliverable,
                    '🔗 Chain-of-Custody Relay'
                  )
                }
                className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-400/40 flex items-center gap-1 cursor-pointer"
              >
                <MonitorPlay size={12} />
                <span>Open in Canvas</span>
              </button>
            </>
          )}
          <button
            type="button"
            disabled={isLoading}
            onClick={() => onRegenerate(message)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={12} className={isLoading ? 'animate-spin' : ''} />
            <span>Re-Run Relay</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {isLoading && !data ? (
        <div className="py-8 flex flex-col items-center justify-center gap-2 text-cyan-300">
          <Loader2 size={22} className="animate-spin" />
          <span className="text-xs font-mono">Passing the baton: NOVA (Step 1) → ORBIT (Step 2) → COSMOS (Step 3)...</span>
        </div>
      ) : data ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {data.steps.map((step, idx) => {
              const badgeColor =
                step.personaId === 'nova'
                  ? 'border-cyan-500/35 bg-cyan-950/20 text-cyan-200'
                  : step.personaId === 'orbit'
                  ? 'border-amber-500/35 bg-amber-950/20 text-amber-200'
                  : 'border-purple-500/35 bg-purple-950/20 text-purple-200';
              return (
                <div
                  key={`${step.personaId}-${idx}`}
                  className={`p-3 rounded-xl border ${badgeColor} flex flex-col justify-between gap-2`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black/40">
                        Stage {idx + 1} • {step.personaId.toUpperCase()}
                      </span>
                      <span className="text-[10px] font-mono opacity-80">{step.stageLabel}</span>
                    </div>
                    <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {step.output}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-white/10 text-[10.5px] font-mono text-slate-300 italic">
                    👉 {step.handoffNote}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900/90 to-cyan-950/40 border border-emerald-400/40 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-extrabold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                <Trophy size={13} /> Final Relay Deliverable (Synthesized &amp; Audited)
              </span>
              <span className="text-[10px] font-mono text-slate-400">{data.generatedAt}</span>
            </div>
            <div className="text-xs md:text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">
              {data.finalDeliverable}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

// ============================================================================
// 10. LIVE CLAIM-BY-CLAIM FACT-CHECKER & HALLUCINATION MATRIX (IDEA #3)
// ============================================================================
export const MultiChatFactMatrixPanel: React.FC<{
  message: MultiChatMessage;
  isLoading: boolean;
  onRunFactCheck: (msg: MultiChatMessage, useLiveWeb: boolean) => void;
  onClose: () => void;
}> = ({ message, isLoading, onRunFactCheck, onClose }) => {
  const data = message.factMatrix;
  const [filterStatus, setFilterStatus] = useState<'all' | 'verified' | 'nuance' | 'disputed'>('all');

  const filteredClaims = (data?.claims || []).filter((c) =>
    filterStatus === 'all' ? true : c.status === filterStatus
  );

  return (
    <div className="mt-3 rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-slate-950/95 via-emerald-950/15 to-slate-950/95 p-4 shadow-2xl space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
            <ShieldCheck size={15} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-extrabold uppercase tracking-wider text-emerald-200">
                🔍 Claim-by-Claim Fact-Checker &amp; Hallucination Matrix
              </span>
              {data && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                  Trust Score: {data.overallTrustScore}%
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Audits factual claims made by NOVA, ORBIT &amp; COSMOS for consensus verification or hallucination risk
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => onRunFactCheck(message, true)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/40 flex items-center gap-1 cursor-pointer"
            title="Cross-verify all claims against live web search"
          >
            <Globe size={12} className={isLoading ? 'animate-spin' : ''} />
            <span>Verify with Live Web</span>
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => onRunFactCheck(message, false)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={12} className={isLoading ? 'animate-spin' : ''} />
            <span>Re-Audit</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {isLoading && !data ? (
        <div className="py-8 flex flex-col items-center justify-center gap-2 text-emerald-300">
          <Loader2 size={22} className="animate-spin" />
          <span className="text-xs font-mono">Extracting claims &amp; cross-verifying across NOVA, ORBIT, and COSMOS...</span>
        </div>
      ) : data ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-black/40 p-2.5 rounded-xl border border-white/10">
            <p className="text-xs text-slate-300">{data.summaryNote}</p>
            <div className="flex items-center gap-1">
              {(['all', 'verified', 'nuance', 'disputed'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFilterStatus(st)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono uppercase cursor-pointer transition ${
                    filterStatus === st
                      ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st === 'all'
                    ? `All (${data.claims.length})`
                    : st === 'verified'
                    ? '✅ Verified'
                    : st === 'nuance'
                    ? '⚠️ Nuance'
                    : '❌ Disputed'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {filteredClaims.map((claim) => {
              const statusStyle =
                claim.status === 'verified'
                  ? 'border-emerald-500/35 bg-emerald-950/20 text-emerald-300'
                  : claim.status === 'nuance'
                  ? 'border-amber-500/35 bg-amber-950/20 text-amber-300'
                  : 'border-rose-500/35 bg-rose-950/25 text-rose-300';
              const statusBadge =
                claim.status === 'verified'
                  ? '✅ Verified'
                  : claim.status === 'nuance'
                  ? '⚠️ Needs Nuance'
                  : '❌ Disputed';

              return (
                <div
                  key={claim.id}
                  className={`p-3 rounded-xl border ${statusStyle} flex flex-col justify-between gap-2`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-black/40">
                        {claim.sourcePersona.toUpperCase()} • {statusBadge}
                      </span>
                      <span className="text-[10px] font-mono font-bold">
                        Confidence: {claim.confidence}%
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-white leading-snug">
                      &ldquo;{claim.claim}&rdquo;
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-300 border-t border-white/10 pt-1.5 leading-relaxed">
                    {claim.verificationNote}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};

// ============================================================================
// 11. "FRANKENSTEIN" INTERACTIVE PARAGRAPH MIXER (CHERRY-PICK COMPOSER - IDEA #4)
// ============================================================================
export const MultiChatCherryPickPanel: React.FC<{
  message: MultiChatMessage;
  isSmoothing: boolean;
  onUpdateBlocks: (msgId: string, blocks: MultiChatCherryPickBlock[]) => void;
  onSmoothWithAI: (msg: MultiChatMessage, selectedBlocks: MultiChatCherryPickBlock[]) => void;
  onSendToCanvas: (title: string, content: string, badge: string) => void;
  onSaveToVault: (title: string, content: string, badge: string) => void;
  onClose: () => void;
}> = ({
  message,
  isSmoothing,
  onUpdateBlocks,
  onSmoothWithAI,
  onSendToCanvas,
  onSaveToVault,
  onClose,
}) => {
  const mixer = message.cherryPickMixer;
  const [copiedMixer, setCopiedMixer] = useState(false);

  if (!mixer) return null;

  const selectedBlocks = mixer.blocks.filter((b) => b.selected);
  const compiledText =
    mixer.smoothedOutput ||
    selectedBlocks.map((b) => b.text).join('\n\n');

  const toggleBlock = (id: string) => {
    const next = mixer.blocks.map((b) => (b.id === id ? { ...b, selected: !b.selected } : b));
    onUpdateBlocks(message.id, next);
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= mixer.blocks.length) return;
    const copy = [...mixer.blocks];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);
    onUpdateBlocks(message.id, copy);
  };

  const handleCopy = async () => {
    await copyToClipboard(compiledText);
    setCopiedMixer(true);
    setTimeout(() => setCopiedMixer(false), 1800);
  };

  return (
    <div className="mt-3 rounded-2xl border border-fuchsia-500/40 bg-gradient-to-br from-slate-950/95 via-fuchsia-950/15 to-slate-950/95 p-4 shadow-2xl space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-fuchsia-500/20 border border-fuchsia-400/40 flex items-center justify-center text-fuchsia-300">
            <Wand2 size={15} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-extrabold uppercase tracking-wider text-fuchsia-200">
                🧬 Cherry-Pick Paragraph Mixer
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-400/30">
                {selectedBlocks.length} / {mixer.blocks.length} blocks active
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Toggle &amp; reorder the strongest paragraphs from NOVA, ORBIT, and COSMOS into your custom master response
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={isSmoothing || selectedBlocks.length === 0}
            onClick={() => onSmoothWithAI(message, selectedBlocks)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-fuchsia-500/25 hover:bg-fuchsia-500/35 text-fuchsia-200 border border-fuchsia-400/40 flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            {isSmoothing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            <span>AI Smooth Transitions</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 flex items-center gap-1 cursor-pointer"
          >
            {copiedMixer ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span>{copiedMixer ? 'Copied' : 'Copy Mix'}</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onSaveToVault(
                `Cherry-Pick Mix: ${message.userPrompt.slice(0, 44)}`,
                compiledText,
                '🧬 Cherry-Pick Mix'
              )
            }
            className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/30 flex items-center gap-1 cursor-pointer"
          >
            <Bookmark size={12} />
            <span>Vault</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onSendToCanvas(
                `Cherry-Pick: ${message.userPrompt.slice(0, 42)}`,
                compiledText,
                '🧬 Cherry-Pick Composer'
              )
            }
            className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-400/40 flex items-center gap-1 cursor-pointer"
          >
            <MonitorPlay size={12} />
            <span>Canvas</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Left: Block Selector & Reorder */}
        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
          <div className="text-[10.5px] font-mono uppercase tracking-wider text-slate-400 mb-1">
            1. Click to toggle paragraphs • Use arrows to reorder
          </div>
          {mixer.blocks.map((block, idx) => {
            const pBadge =
              block.personaId === 'nova'
                ? 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10'
                : block.personaId === 'orbit'
                ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
                : 'text-purple-300 border-purple-500/30 bg-purple-500/10';
            return (
              <div
                key={block.id}
                className={`p-2.5 rounded-xl border transition flex items-start justify-between gap-2 ${
                  block.selected
                    ? 'bg-slate-900/90 border-fuchsia-400/40 text-slate-100'
                    : 'bg-black/30 border-white/5 text-slate-500 opacity-60'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleBlock(block.id)}
                  className="flex-1 text-left space-y-1 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9.5px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${pBadge}`}>
                      {block.personaId.toUpperCase()}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {block.selected ? '✓ Included' : 'Click to include'}
                    </span>
                  </div>
                  <p className="text-xs line-clamp-3 leading-relaxed">{block.text}</p>
                </button>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveBlock(idx, -1)}
                    disabled={idx === 0}
                    className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 cursor-pointer"
                    title="Move Up"
                  >
                    <ArrowUp size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlock(idx, 1)}
                    disabled={idx === mixer.blocks.length - 1}
                    className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 cursor-pointer"
                    title="Move Down"
                  >
                    <ArrowDown size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Live Assembled Output */}
        <div className="p-3 rounded-xl bg-black/50 border border-white/10 flex flex-col justify-between max-h-80 overflow-y-auto">
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
              <span className="text-[10.5px] font-mono font-bold uppercase text-fuchsia-300">
                {mixer.smoothedOutput ? '✨ AI-Smoothed Master Document' : '📋 Live Assembled Preview'}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {compiledText.split(/\s+/).filter(Boolean).length} words
              </span>
            </div>
            <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
              {compiledText || 'Select at least one paragraph block on the left to compose your custom answer.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 12. CROSS-EXAMINATION "HOT SEAT" MODE PANEL (IDEA #5)
// ============================================================================
export const MultiChatHotSeatPanel: React.FC<{
  message: MultiChatMessage;
  isLoading: boolean;
  onSelectTargetAndGrill: (msg: MultiChatMessage, targetId: MultiChatPersonaId) => void;
  onClose: () => void;
}> = ({ message, isLoading, onSelectTargetAndGrill, onClose }) => {
  const data = message.hotSeat;
  const activeTarget: MultiChatPersonaId = data?.targetPersona || 'nova';

  return (
    <div className="mt-3 rounded-2xl border border-orange-500/40 bg-gradient-to-br from-slate-950/95 via-orange-950/20 to-slate-950/95 p-4 shadow-2xl space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-500/20 border border-orange-400/40 flex items-center justify-center text-orange-300">
            <Flame size={15} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-extrabold uppercase tracking-wider text-orange-200">
                🔥 Cross-Examination &ldquo;Hot Seat&rdquo; Tribunal
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-orange-500/20 text-orange-300 border border-orange-400/30">
                2 Personas Grill 1 Persona
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Put any persona on the witness stand while the other two expose blind spots and force an under-oath defense
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {(['nova', 'orbit', 'cosmos'] as MultiChatPersonaId[]).map((pid) => (
            <button
              key={pid}
              type="button"
              disabled={isLoading}
              onClick={() => onSelectTargetAndGrill(message, pid)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold uppercase cursor-pointer transition border ${
                activeTarget === pid
                  ? 'bg-orange-500/30 text-orange-200 border-orange-400/50 shadow'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
              }`}
            >
              🔥 Grill {pid.toUpperCase()}
            </button>
          ))}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 flex flex-col items-center justify-center gap-2 text-orange-300">
          <Loader2 size={22} className="animate-spin" />
          <span className="text-xs font-mono">
            Putting {activeTarget.toUpperCase()} in the Hot Seat under cross-examination...
          </span>
        </div>
      ) : data ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {data.interrogators.map((item, idx) => (
              <div
                key={`${item.challengerPersona}-${idx}`}
                className="p-3 rounded-xl bg-black/45 border border-orange-500/30 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-orange-500/20 text-orange-200">
                    ⚔️ Interrogator: {item.challengerPersona.toUpperCase()}
                  </span>
                  <span className="text-[10px] font-mono text-amber-300">
                    Blind Spot: {item.exposedBlindSpot}
                  </span>
                </div>
                <p className="text-xs text-slate-100 font-medium leading-relaxed">
                  &ldquo;{item.sharpQuestion}&rdquo;
                </p>
              </div>
            ))}
          </div>

          <div className="p-3.5 rounded-xl bg-gradient-to-r from-orange-950/35 via-slate-900/90 to-emerald-950/35 border border-amber-400/40 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono font-extrabold uppercase text-amber-300">
                🛡️ {data.targetPersona.toUpperCase()}&apos;s Under-Oath Defense &amp; Upgrades
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                Verdict: {data.verdictBadge}
              </span>
            </div>
            <div className="text-xs md:text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">
              {data.targetDefense}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

// ============================================================================
// 13. LIVE TOKEN, LATENCY & EFFICIENCY TELEMETRY STRIP (IDEA #7)
// ============================================================================
export const MultiChatTurnTelemetryStrip: React.FC<{
  message: MultiChatMessage;
  blindMode?: boolean;
}> = ({ message, blindMode }) => {
  const readyResponses = message.responses.filter((r) => r.status === 'ready' && r.content.trim().length > 0);
  if (readyResponses.length === 0) return null;

  const metrics = readyResponses.map((r, idx) => {
    const words = r.content.trim().split(/\s+/).filter(Boolean).length;
    const estTokens = Math.max(12, Math.round(words * 1.32));
    const latencySec = Math.max(0.4, (r.latencyMs || 1500) / 1000);
    const tokPerSec = Math.round(estTokens / latencySec);
    // Estimate information density by counting structured elements (headers, bullets, code/numbers)
    const structureHits = (r.content.match(/(^#+\s|^\s*[-*•]|\d+%|\*\*)/gm) || []).length;
    const densityScore = Math.min(99, Math.max(62, Math.round(65 + (structureHits / Math.max(1, words / 25)) * 18)));

    const displayLabel =
      blindMode && !message.blindRevealed
        ? `CANDIDATE ${String.fromCharCode(65 + idx)}`
        : r.personaId.toUpperCase();

    return {
      personaId: r.personaId,
      displayLabel,
      words,
      estTokens,
      latencySec: latencySec.toFixed(1),
      latencyRaw: latencySec,
      tokPerSec,
      densityScore,
    };
  });

  const fastest = [...metrics].sort((a, b) => a.latencyRaw - b.latencyRaw)[0];
  const densest = [...metrics].sort((a, b) => b.densityScore - a.densityScore)[0];
  const totalTokens = metrics.reduce((acc, m) => acc + m.estTokens, 0);

  return (
    <div className="mt-2.5 px-3 py-2 rounded-xl bg-slate-950/80 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-[10.5px] font-mono text-slate-300">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
          <BarChart3 size={11} className="text-cyan-400" /> Telemetry:
        </span>
        {metrics.map((m) => (
          <span
            key={m.personaId}
            className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10 flex items-center gap-1.5"
          >
            <strong className="text-white">{m.displayLabel}</strong>
            <span className="text-slate-400">{m.latencySec}s</span>
            <span className="text-cyan-300">{m.tokPerSec} tok/s</span>
            <span className="text-slate-400">~{m.estTokens}t</span>
            <span className="text-emerald-300">Density {m.densityScore}%</span>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {fastest && (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300">
            ⚡ Fastest: {fastest.displayLabel} ({fastest.latencySec}s)
          </span>
        )}
        {densest && (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300">
            💎 Highest Signal: {densest.displayLabel} ({densest.densityScore}%)
          </span>
        )}
        <span className="text-slate-500">Total ~{totalTokens} tokens</span>
      </div>
    </div>
  );
};

// ============================================================================
// 14. PINBOARD & CROSS-TURN INSIGHT VAULT DRAWER (IDEA #8)
// ============================================================================
export const MultiChatVaultDrawer: React.FC<{
  items: MultiChatVaultItem[];
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
  onSendToCanvas: (title: string, content: string, badge: string) => void;
  onClose: () => void;
}> = ({ items, onRemoveItem, onClearAll, onSendToCanvas, onClose }) => {
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = items.filter(
    (item) =>
      !search.trim() ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.content.toLowerCase().includes(search.toLowerCase()) ||
      item.sourceLabel.toLowerCase().includes(search.toLowerCase())
  );

  const handleExportAll = () => {
    const md = [
      `# 🗂️ NEXUS Multi-Chat Insight Vault`,
      `Exported: ${new Date().toLocaleString()}`,
      '',
      ...items.map(
        (it, idx) =>
          `## ${idx + 1}. ${it.title} (${it.sourceLabel})\n*Saved: ${it.createdAt}*\n\n${it.content}\n\n---`
      ),
    ].join('\n\n');
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-multichat-vault-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mb-3 rounded-2xl border border-amber-500/40 bg-gradient-to-br from-slate-950/95 via-amber-950/15 to-slate-950/95 p-4 shadow-2xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
            <Bookmark size={15} />
          </div>
          <div>
            <span className="text-xs font-mono font-extrabold uppercase tracking-wider text-amber-200">
              🗂️ Multi-Chat Insight Vault ({items.length} Saved)
            </span>
            <p className="text-[11px] text-slate-400">
              Cross-session pinboard of your favorite persona answers, verdicts, and synthesized deliverables
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter vault..."
            className="px-2.5 py-1 rounded-lg bg-black/50 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-amber-400/50"
          />
          {items.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleExportAll}
                className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 flex items-center gap-1 cursor-pointer"
              >
                <Download size={12} />
                <span>Export .MD</span>
              </button>
              <button
                type="button"
                onClick={onClearAll}
                className="px-2 py-1 rounded-lg text-[11px] font-mono bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 cursor-pointer"
              >
                Clear
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-6 text-center text-xs font-mono text-slate-400">
          {items.length === 0
            ? 'Your Multi-Chat Vault is empty. Click the 📌 Vault button on any Persona card, Consensus Verdict, or Synthesis panel to pin insights here.'
            : 'No saved vault items match your search filter.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-80 overflow-y-auto pr-1">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-xl bg-black/45 border border-white/10 flex flex-col justify-between gap-2"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {item.sourceLabel}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">{item.createdAt}</span>
                </div>
                <h4 className="text-xs font-bold text-white truncate">{item.title}</h4>
                <p className="text-xs text-slate-300 line-clamp-3 whitespace-pre-wrap leading-relaxed">
                  {item.content}
                </p>
              </div>
              <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-white/10">
                <button
                  type="button"
                  onClick={async () => {
                    await copyToClipboard(item.content);
                    setCopiedId(item.id);
                    setTimeout(() => setCopiedId(null), 1500);
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 hover:bg-white/10 text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  {copiedId === item.id ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                  <span>{copiedId === item.id ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSendToCanvas(item.title, item.content, item.sourceLabel)}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 flex items-center gap-1 cursor-pointer"
                >
                  <MonitorPlay size={10} />
                  <span>Canvas</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id)}
                  className="p-1 rounded text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                  title="Remove from Vault"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


