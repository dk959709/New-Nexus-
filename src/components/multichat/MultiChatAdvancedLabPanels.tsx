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
} from 'lucide-react';
import { copyToClipboard } from '@/lib/clipboard';
import { MULTICHAT_GUEST_SPECIALISTS } from '@/services/multiChatOrchestrator';
import type {
  MultiChatMessage,
  MultiChatPersonaId,
  MultiChatGuestSpecialistId,
  MultiChatPromptSplitPlan,
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

