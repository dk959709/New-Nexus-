import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Activity, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import type {
  MultiChatMessage,
  MultiChatPersonaConfig,
  MultiChatTheme,
} from '@/types';
import { TypingDots } from './TypingDots';

type AgentRunState = 'idle' | 'pending' | 'running' | 'completed' | 'failed';

interface MultiChatLiveTimelineProps {
  personas: MultiChatPersonaConfig[];
  /** Latest turn; its per-persona responses drive the timeline states. */
  message?: MultiChatMessage;
  isGenerating?: boolean;
  theme?: MultiChatTheme;
  /** Optional explicit roster; defaults to enabled personas. */
  activeIds?: string[];
  className?: string;
}

const shellTheme = (theme: MultiChatTheme) => {
  if (theme === 'classic') return 'border-cyan-500/20 bg-slate-950/70';
  if (theme === 'fulldark') return 'border-white/10 bg-[#0c0c0f]';
  return 'border-indigo-500/20 bg-zinc-900/70';
};

const isIdleState = (state: AgentRunState) => state === 'idle';

const STATUS_LABEL: Record<AgentRunState, string> = {
  idle: 'Standby',
  pending: 'Queued',
  running: 'Thinking',
  completed: 'Done',
  failed: 'Failed',
};

export const MultiChatLiveTimeline: React.FC<MultiChatLiveTimelineProps> = ({
  personas,
  message,
  isGenerating = false,
  theme = 'minimal',
  activeIds,
  className = '',
}) => {
  const reduceMotion = useReducedMotion();

  const roster = React.useMemo(() => {
    const ids = activeIds ?? personas.filter((p) => p.enabled).map((p) => p.id);
    const set = new Set(ids);
    const selected = personas.filter((p) => set.has(p.id));
    return selected.length > 0 ? selected : personas;
  }, [activeIds, personas]);

  const stateFor = (personaId: string): AgentRunState => {
    const resp = message?.responses?.find((r) => r.personaId === personaId);
    return (resp?.status as AgentRunState) || 'idle';
  };

  const durationFor = (personaId: string): number | undefined =>
    message?.responses?.find((r) => r.personaId === personaId)?.durationMs;

  const anyRunning = roster.some((p) => {
    const s = stateFor(p.id);
    return s === 'running' || s === 'pending';
  });

  return (
    <div
      className={`relative overflow-hidden rounded-xl border ${shellTheme(theme)} ${className}`}
      data-mc-live-timeline
    >
      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Activity size={11} className="shrink-0 text-cyan-300" />
          <span className="text-[10px] font-mono font-bold tracking-wider text-slate-200">
            LIVE TIMELINE
          </span>
          {(isGenerating || anyRunning) && !reduceMotion && (
            <motion.span
              className="w-1.5 h-1.5 rounded-full bg-cyan-400"
              animate={{ opacity: [0.25, 1, 0.25], scale: [1, 1.25, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>
        <span className="text-[9.5px] font-mono text-slate-500 shrink-0">
          {isGenerating ? 'streaming' : 'idle'}
        </span>
      </div>

      <div className="flex items-center gap-1.5 px-2 pb-2 overflow-x-auto scrollbar-none">
        {roster.map((persona, index) => {
          const state = stateFor(persona.id);
          const accent = persona.accentColor || '#38bdf8';
          const duration = durationFor(persona.id);
          const isRunning = state === 'running';
          const isPending = state === 'pending';
          const isDone = state === 'completed';
          const isFailed = state === 'failed';

          return (
            <React.Fragment key={persona.id}>
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className="shrink-0 h-[1px] w-3 sm:w-4 rounded-full"
                  style={{
                    backgroundColor:
                      isDone || isRunning ? `${accent}66` : 'rgba(113,113,122,0.28)',
                  }}
                />
              )}

              <motion.div
                layout={!reduceMotion}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: 'spring' as const, stiffness: 400, damping: 32 }
                }
                className="shrink-0 inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full border"
                style={{
                  borderColor: isRunning || isDone ? `${accent}55` : `${accent}22`,
                  background:
                    isRunning || isDone
                      ? `linear-gradient(120deg, ${accent}1f 0%, rgba(9,9,12,0.7) 85%)`
                      : 'rgba(24,24,27,0.55)',
                  boxShadow: isRunning ? `0 0 10px ${accent}25` : 'none',
                }}
                title={`${persona.name} — ${STATUS_LABEL[state]}`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: isIdleState(state) ? '#52525b' : accent,
                    opacity: isPending ? 0.6 : 1,
                  }}
                />

                <span className="text-[10px] font-semibold text-slate-200 whitespace-nowrap">
                  {persona.name}
                </span>

                <AnimatePresence mode="wait" initial={false}>
                  {isRunning ? (
                    <motion.span
                      key="typing"
                      initial={reduceMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="inline-flex items-center gap-1"
                    >
                      <TypingDots color={accent} size={3} />
                      <span className="text-[8.5px] font-mono" style={{ color: accent }}>
                        {STATUS_LABEL.running}
                      </span>
                    </motion.span>
                  ) : (
                    <motion.span
                      key={`state-${state}`}
                      initial={reduceMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="inline-flex items-center gap-1"
                    >
                      {isDone && <CheckCircle2 size={9} className="text-emerald-400" />}
                      {isFailed && <AlertCircle size={9} className="text-rose-400" />}
                      {isPending && <Clock size={9} className="text-slate-400" />}
                      <span
                        className={`text-[8.5px] font-mono ${
                          isFailed ? 'text-rose-300' : isDone ? 'text-emerald-300/80' : 'text-slate-400'
                        }`}
                      >
                        {isDone && duration ? `${(duration / 1000).toFixed(1)}s` : STATUS_LABEL[state]}
                      </span>
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default MultiChatLiveTimeline;
