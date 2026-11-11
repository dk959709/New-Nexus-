import {
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  GraduationCap,
  HelpCircle,
  Lightbulb,
  ListChecks,
  Loader2,
  RotateCcw,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import type { TutorGoal, TutorLevel, TutorSession, TutorStage } from '@/types';
import {
  TUTOR_GOALS,
  TUTOR_LEVELS,
  TUTOR_QUICK_ACTIONS,
  TUTOR_STAGES,
  TUTOR_STAGE_ACTIONS,
  getTutorGoalLabel,
  getTutorLevelLabel,
  type TutorQuickAction,
} from '@/lib/tutor';

type TutorSessionCardProps = {
  theme: 'minimal' | 'classic' | 'fulldark';
  session: TutorSession | null;
  level: TutorLevel;
  goal: TutorGoal;
  topicDraft: string;
  loading?: boolean;
  onTopicDraftChange: (value: string) => void;
  onLevelChange: (value: TutorLevel) => void;
  onGoalChange: (value: TutorGoal) => void;
  onStart: () => void;
  onQuickAction: (action: TutorQuickAction) => void;
  onNewTopic: () => void;
  onDisable: () => void;
};

const STAGE_ICONS: Record<TutorStage, typeof Lightbulb> = {
  explain: Lightbulb,
  example: BookOpen,
  practice: ListChecks,
  quiz: HelpCircle,
};

const QUICK_ICONS: Record<TutorQuickAction, typeof Lightbulb> = {
  explain: Lightbulb,
  simplify: Sparkles,
  example: Lightbulb,
  practice: ListChecks,
  quiz: HelpCircle,
  summary: FileText,
};

export function TutorSessionCard({
  theme,
  session,
  level,
  goal,
  topicDraft,
  loading = false,
  onTopicDraftChange,
  onLevelChange,
  onGoalChange,
  onStart,
  onQuickAction,
  onNewTopic,
  onDisable,
}: TutorSessionCardProps) {
  const activeIndex = session
    ? TUTOR_STAGES.findIndex((stage) => stage.id === session.stage)
    : -1;

  const cardClass =
    theme === 'classic'
      ? 'bg-lime-950/30 border-lime-500/30 text-lime-100 shadow-[0_0_24px_rgba(132,204,22,0.12)]'
      : theme === 'fulldark'
      ? 'bg-[#181818] border-[#2e2e2e] text-[#e6e6e6]'
      : 'bg-zinc-900/90 border-zinc-800 text-zinc-200';

  const softText =
    theme === 'classic' ? 'text-lime-200/70' : theme === 'fulldark' ? 'text-[#9a9a9a]' : 'text-zinc-400';

  const inputClass =
    theme === 'classic'
      ? 'bg-slate-950/60 border-lime-500/30 text-lime-50 placeholder:text-lime-200/30 focus:border-lime-400/70'
      : theme === 'fulldark'
      ? 'bg-[#222] border-[#3a3a3a] text-[#ececec] placeholder:text-[#6e6e6e] focus:border-lime-500/60'
      : 'bg-zinc-950/60 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:border-lime-500/60';

  const pillBase =
    'px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all cursor-pointer active:scale-95';

  const levelPill = (isActive: boolean) =>
    isActive
      ? 'border-lime-400/60 bg-lime-500/20 text-lime-200 shadow-[0_0_10px_rgba(132,204,22,0.18)]'
      : theme === 'classic'
      ? 'border-lime-500/15 bg-transparent text-lime-200/60 hover:bg-lime-950/40'
      : theme === 'fulldark'
      ? 'border-[#333] bg-[#222] text-[#a1a1aa] hover:bg-[#2a2a2a]'
      : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800/70';

  const quickButton =
    theme === 'classic'
      ? 'border-lime-500/20 bg-slate-950/40 text-lime-200/80 hover:border-lime-400/50 hover:text-lime-100'
      : theme === 'fulldark'
      ? 'border-[#333] bg-[#202020] text-[#c8c8c8] hover:border-lime-500/40 hover:text-lime-200'
      : 'border-zinc-800 bg-zinc-900/70 text-zinc-300 hover:border-lime-500/40 hover:text-lime-200';

  return (
    <div className={`px-3.5 py-3 rounded-xl border transition-all ${cardClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl grid place-items-center shrink-0 ${
              theme === 'classic'
                ? 'bg-lime-500/20 text-lime-300 border border-lime-500/30'
                : 'bg-zinc-800 text-lime-300 border border-zinc-700'
            }`}
          >
            <GraduationCap size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-zinc-100">Tutor Mode</span>
              {session && (
                <>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-lime-500/15 border border-lime-500/30 text-lime-300">
                    {getTutorLevelLabel(session.level)}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/60 text-zinc-400">
                    {getTutorGoalLabel(session.goal)}
                  </span>
                </>
              )}
            </div>
            <p className={`text-[11px] mt-0.5 truncate ${softText}`}>
              {session ? session.topic : 'Socratic lessons, one step at a time'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {session && (
            <button
              type="button"
              onClick={onNewTopic}
              disabled={loading}
              className={`text-[11px] px-2 py-1 rounded-lg border transition-all flex items-center gap-1 disabled:opacity-50 ${
                theme === 'fulldark'
                  ? 'border-[#333] bg-[#222] text-[#ccc] hover:bg-[#2a2a2a]'
                  : 'border-zinc-700/60 bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700'
              }`}
              title="Start a new topic"
            >
              <RotateCcw size={11} />
              <span className="hidden sm:inline">New topic</span>
            </button>
          )}
          <button
            type="button"
            onClick={onDisable}
            className={`text-[11px] px-2 py-1 rounded-lg border transition-all flex items-center gap-1 ${
              theme === 'fulldark'
                ? 'border-[#333] bg-[#222] text-[#ccc] hover:border-red-500/40 hover:text-red-300'
                : 'border-zinc-700/60 bg-zinc-800/80 text-zinc-300 hover:border-red-500/40 hover:text-red-300'
            }`}
            title="Disable Tutor mode"
            aria-label="Disable Tutor mode"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {session ? (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-1">
            {TUTOR_STAGES.map((stage, index) => {
              const Icon = STAGE_ICONS[stage.id];
              const isActive = index === activeIndex;
              const isComplete = index < activeIndex;
              return (
                <div key={stage.id} className="flex items-center gap-1 flex-1 min-w-0">
                  <button
                    type="button"
                    aria-current={isActive ? 'step' : undefined}
                    disabled={loading}
                    onClick={() => onQuickAction(TUTOR_STAGE_ACTIONS[stage.id])}
                    className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-1.5 py-1.5 rounded-lg border text-[10px] sm:text-[11px] font-medium transition-all cursor-pointer disabled:opacity-50 ${
                      isActive
                        ? 'border-lime-400/60 bg-lime-500/20 text-lime-200 shadow-[0_0_12px_rgba(132,204,22,0.18)]'
                        : isComplete
                        ? 'border-lime-500/25 bg-lime-500/10 text-lime-300/80'
                        : theme === 'fulldark'
                        ? 'border-[#333] bg-[#1e1e1e] text-[#8f8f8f] hover:text-[#ccc]'
                        : theme === 'classic'
                        ? 'border-lime-500/10 bg-slate-950/30 text-lime-200/50'
                        : 'border-zinc-800 bg-zinc-900/60 text-zinc-500'
                    }`}
                    title={`Jump to ${stage.label}`}
                  >
                    {isComplete ? <Check size={11} /> : <Icon size={11} />}
                    <span className="truncate">{stage.label}</span>
                  </button>
                  {index < TUTOR_STAGES.length - 1 && (
                    <span
                      className={`w-3 h-px shrink-0 ${
                        index < activeIndex ? 'bg-lime-400/60' : 'bg-zinc-700/60'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className={`h-1 rounded-full overflow-hidden ${theme === 'fulldark' ? 'bg-[#2a2a2a]' : 'bg-zinc-800'}`}>
            <div
              className="h-full rounded-full bg-gradient-to-r from-lime-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${((activeIndex + 1) / TUTOR_STAGES.length) * 100}%` }}
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {TUTOR_QUICK_ACTIONS.map((action) => {
              const Icon = QUICK_ICONS[action.id];
              return (
                <button
                  key={action.id}
                  type="button"
                  disabled={loading}
                  onClick={() => onQuickAction(action.id)}
                  className={`${pillBase} shrink-0 inline-flex items-center gap-1 border disabled:opacity-50 ${quickButton}`}
                >
                  <Icon size={11} />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>

          <p className={`text-[10px] font-mono flex items-center gap-1.5 ${softText}`}>
            <Target size={10} />
            One step at a time · progress saved to this chat
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div>
            <label className={`text-[10px] font-mono uppercase tracking-wider ${softText}`}>
              What do you want to learn?
            </label>
            <input
              type="text"
              value={topicDraft}
              onChange={(event) => onTopicDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onStart();
                }
              }}
              placeholder="e.g. Bayes' theorem, React hooks, linear algebra..."
              className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-xs outline-none transition-colors ${inputClass}`}
              aria-label="Tutor topic"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] font-mono uppercase tracking-wider ${softText}`}>Level</span>
            {TUTOR_LEVELS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={level === item.id}
                onClick={() => onLevelChange(item.id)}
                title={item.hint}
                className={`${pillBase} ${levelPill(level === item.id)}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] font-mono uppercase tracking-wider ${softText}`}>Goal</span>
            {TUTOR_GOALS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={goal === item.id}
                onClick={() => onGoalChange(item.id)}
                className={`${pillBase} ${levelPill(goal === item.id)}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={loading || !topicDraft.trim()}
            onClick={onStart}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-lime-400/50 bg-gradient-to-r from-lime-500 to-emerald-500 text-[#08120a] text-xs font-semibold transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <GraduationCap size={14} />}
            <span>{loading ? 'Starting lesson...' : 'Start Lesson'}</span>
            {!loading && <ArrowRight size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}
