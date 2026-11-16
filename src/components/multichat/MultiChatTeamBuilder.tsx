import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Users, EyeOff, Zap, ChevronDown } from 'lucide-react';
import type { MultiChatPersonaConfig, MultiChatTheme } from '@/types';
import { TypingDots } from './TypingDots';

interface MultiChatTeamBuilderProps {
  personas: MultiChatPersonaConfig[];
  theme?: MultiChatTheme;
  /** Optional explicit "active" roster. Defaults to personas with enabled === true. */
  activeIds?: string[];
  /** Personas that are currently generating, used for the thinking dots. */
  busyIds?: string[];
  /** Optional tap handler to move an agent between Active team and Bench. */
  onToggle?: (personaId: string) => void;
  className?: string;
}

const panelTheme = (theme: MultiChatTheme) => {
  if (theme === 'classic') {
    return {
      shell: 'border-cyan-500/25 bg-slate-950/70',
      muted: 'text-cyan-200/60',
      divider: 'border-cyan-500/15',
    };
  }
  if (theme === 'fulldark') {
    return {
      shell: 'border-white/10 bg-[#0c0c0f]',
      muted: 'text-zinc-500',
      divider: 'border-white/10',
    };
  }
  return {
    shell: 'border-indigo-500/25 bg-zinc-900/70',
    muted: 'text-indigo-200/60',
    divider: 'border-indigo-500/15',
  };
};

interface AgentCardProps {
  persona: MultiChatPersonaConfig;
  isActive: boolean;
  isBusy: boolean;
  onToggle?: (personaId: string) => void;
  reduceMotion: boolean;
}

const AgentCard: React.FC<AgentCardProps> = ({ persona, isActive, isBusy, onToggle, reduceMotion }) => {
  const accent = persona.accentColor || '#38bdf8';

  return (
    <motion.button
      type="button"
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: isActive ? 1 : 0.78, scale: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0, scale: 0.94 }}
      whileHover={reduceMotion ? undefined : { scale: 1.02 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.7 }
      }
      onClick={onToggle ? () => onToggle(persona.id) : undefined}
      title={
        onToggle
          ? isActive
            ? `Move ${persona.name} to Bench`
            : `Move ${persona.name} to the Active team`
          : `${persona.name} — ${isActive ? 'active' : 'on the bench'}`
      }
      className={`group relative w-full text-left rounded-xl border px-2.5 py-1.5 transition-colors ${
        onToggle ? 'cursor-pointer' : 'cursor-default'
      }`}
      style={{
        borderColor: isActive ? `${accent}55` : `${accent}22`,
        background: `linear-gradient(150deg, ${accent}${isActive ? '1f' : '0d'} 0%, rgba(9,9,12,0.85) 78%)`,
        boxShadow: isActive
          ? `0 0 0 1px ${accent}22, 0 4px 16px ${accent}1f`
          : 'none',
      }}
    >
      {/* Accent edge */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full"
        style={{ backgroundColor: isActive ? accent : `${accent}55` }}
      />

      <div className="flex items-center gap-2 min-w-0 pl-1">
        <span
          className="shrink-0 w-7 h-7 rounded-lg grid place-items-center text-sm"
          style={{
            background: `${accent}22`,
            border: `1px solid ${accent}45`,
            boxShadow: isActive ? `0 0 10px ${accent}30` : 'none',
          }}
        >
          {persona.icon}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="text-[12px] font-bold text-white truncate">{persona.name}</span>
            <span
              className="shrink-0 w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: isActive ? accent : '#52525b' }}
            />
          </span>
          <span className="block text-[10px] font-mono text-slate-400 truncate">
            {persona.role || persona.toneBadge || `@${persona.id}`}
          </span>
        </span>

        {isBusy ? (
          <span className="shrink-0 flex items-center gap-1.5">
            <TypingDots color={accent} size={3.5} />
          </span>
        ) : (
          persona.toneBadge && (
            <span
              className="hidden xs:inline shrink-0 text-[8.5px] font-mono font-bold px-1.5 py-0.5 rounded-full"
              style={{
                background: `${accent}1a`,
                color: accent,
                border: `1px solid ${accent}33`,
              }}
            >
              {persona.toneBadge}
            </span>
          )
        )}
      </div>
    </motion.button>
  );
};

/**
 * Animated Active-team / Bench roster for the Multi Chat personas.
 * Pure presentation: it never mutates config; moves happen when `activeIds`
 * or `onToggle` come from the caller.
 */
export const MultiChatTeamBuilder: React.FC<MultiChatTeamBuilderProps> = ({
  personas,
  theme = 'minimal',
  activeIds,
  busyIds = [],
  onToggle,
  className = '',
}) => {
  const reduceMotion = useReducedMotion();
  const t = panelTheme(theme);
  const [collapsed, setCollapsed] = React.useState(false);

  const activeSet = React.useMemo(
    () => new Set(activeIds ?? personas.filter((p) => p.enabled).map((p) => p.id)),
    [activeIds, personas],
  );
  const busySet = React.useMemo(() => new Set(busyIds), [busyIds]);

  const active = personas.filter((p) => activeSet.has(p.id));
  const bench = personas.filter((p) => !activeSet.has(p.id));

  return (
    <div
      className={`relative overflow-hidden rounded-xl border ${t.shell} ${className}`}
      data-mc-team-builder
    >
      <div className={`flex items-center justify-between gap-2 px-3 py-1.5 border-b ${t.divider}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <Users size={11} className="shrink-0 text-cyan-300" />
          <span className="text-[10px] font-mono font-bold tracking-wider text-slate-200">
            TEAM BUILDER
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[9.5px] font-mono ${t.muted} shrink-0`}>
            {active.length} active · {bench.length} bench
          </span>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Show team roster' : 'Hide team roster'}
            className="shrink-0 -mr-1 p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
          >
            <ChevronDown
              size={12}
              className={`transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
            />
          </button>
        </div>
      </div>

      {!collapsed && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2">
        {/* Active team */}
        <section className="min-w-0">
          <div className="flex items-center gap-1 px-0.5 pb-1">
            <Zap size={9.5} className="text-cyan-300" />
            <span className="text-[9px] font-mono font-bold tracking-wider text-cyan-200/80">
              ACTIVE TEAM
            </span>
            <span className="ml-auto text-[9px] font-mono text-slate-500">{active.length}</span>
          </div>
          <div className="space-y-1">
            <AnimatePresence initial={false} mode="popLayout">
              {active.map((persona) => (
                <AgentCard
                  key={persona.id}
                  persona={persona}
                  isActive
                  isBusy={busySet.has(persona.id)}
                  onToggle={onToggle}
                  reduceMotion={Boolean(reduceMotion)}
                />
              ))}
            </AnimatePresence>
            {active.length === 0 && (
              <p className="text-[10px] font-mono text-slate-500 px-1 py-1.5">No agents active.</p>
            )}
          </div>
        </section>

        {/* Bench */}
        <section className="min-w-0">
          <div className="flex items-center gap-1 px-0.5 pb-1">
            <EyeOff size={9.5} className="text-slate-400" />
            <span className="text-[9px] font-mono font-bold tracking-wider text-slate-400">
              BENCH
            </span>
            <span className="ml-auto text-[9px] font-mono text-slate-500">{bench.length}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-1 gap-1.5">
            <AnimatePresence initial={false} mode="popLayout">
              {bench.map((persona) => (
                <AgentCard
                  key={persona.id}
                  persona={persona}
                  isActive={false}
                  isBusy={busySet.has(persona.id)}
                  onToggle={onToggle}
                  reduceMotion={Boolean(reduceMotion)}
                />
              ))}
            </AnimatePresence>
            {bench.length === 0 && (
              <p className="text-[10px] font-mono text-slate-500 px-1 py-1.5">
                Everyone is on the active team.
              </p>
            )}
          </div>
        </section>
      </div>
      )}
    </div>
  );
};

export default MultiChatTeamBuilder;
