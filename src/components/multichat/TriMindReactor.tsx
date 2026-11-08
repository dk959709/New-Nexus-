import React, { useState, useId } from 'react';
import {
  Brain,
  Smile,
  Compass,
  Activity,
  Zap,
  Sparkles,
  Flame,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { MultiChatPersonaId } from '@/types';

export type ReactorVisualState = 'idle' | 'thinking' | 'debating' | 'synthesizing';

export interface TriMindReactorTelemetry {
  latencySec?: number | null;
  tokensCount?: number | null;
  tokensPerSec?: number | null;
  consensusAgreementsCount?: number | null;
}

export interface TriMindReactorProps {
  // Live execution triggers
  isGenerating?: boolean;
  isConsensusGenerating?: boolean;
  isDebating?: boolean;
  activePersonaId?: string | null;

  // Targeting & config
  targetedPersonaIds?: string[];
  onToggleTargetPersona?: (personaId: MultiChatPersonaId) => void;

  // Real telemetry data (strictly real values; N/A if absent)
  telemetry?: TriMindReactorTelemetry;

  // Visual mode & theme
  isCompact?: boolean;
  theme?: 'classic' | 'fulldark' | 'minimal';
  collapsible?: boolean;
}

export const TriMindReactor: React.FC<TriMindReactorProps> = ({
  isGenerating = false,
  isConsensusGenerating = false,
  isDebating = false,
  activePersonaId = null,
  targetedPersonaIds = [],
  onToggleTargetPersona,
  telemetry,
  isCompact = false,
  theme = 'classic',
  collapsible = false,
}) => {
  const [selectedStateMode, setSelectedStateMode] = useState<'auto' | ReactorVisualState>('auto');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const uid = useId().replace(/:/g, '');

  // Determine active visual state (either manual preview or auto-detected from live agent activity)
  const resolvedState: ReactorVisualState =
    selectedStateMode !== 'auto'
      ? selectedStateMode
      : isConsensusGenerating
      ? 'synthesizing'
      : isDebating
      ? 'debating'
      : isGenerating
      ? 'thinking'
      : 'idle';

  const isIdle = resolvedState === 'idle';
  const isThinking = resolvedState === 'thinking';
  const isDebatingState = resolvedState === 'debating';
  const isSynthesizing = resolvedState === 'synthesizing';

  const isClassic = theme === 'classic';
  const isFullDark = theme === 'fulldark';

  // 3 Persona Vertex Coordinates in 240x240 SVG space:
  // Center: (120, 120), Radius R = 75
  // NOVA (Top): 0 deg (or 270 deg) -> (120, 45)
  // ORBIT (Bottom-Right): 120 deg -> (185, 157.5)
  // COSMOS (Bottom-Left): 240 deg -> (55, 157.5)
  const nodes = [
    {
      id: 'nova' as MultiChatPersonaId,
      name: 'NOVA',
      role: 'Empirical Research',
      accentColor: '#00F0FF',
      glowColor: 'rgba(0, 240, 255, 0.45)',
      x: 120,
      y: 45,
      degLabel: '000°',
      icon: Brain,
    },
    {
      id: 'orbit' as MultiChatPersonaId,
      name: 'ORBIT',
      role: 'Critical Validator',
      accentColor: '#F59E0B',
      glowColor: 'rgba(245, 158, 11, 0.45)',
      x: 185,
      y: 157.5,
      degLabel: '120°',
      icon: Smile,
    },
    {
      id: 'cosmos' as MultiChatPersonaId,
      name: 'COSMOS',
      role: 'Holistic Mentor',
      accentColor: '#C084FC',
      glowColor: 'rgba(192, 132, 252, 0.45)',
      x: 55,
      y: 157.5,
      degLabel: '240°',
      icon: Compass,
    },
  ];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl sm:rounded-3xl border transition-all duration-300 ${
        isCompact
          ? 'py-2.5 sm:py-3.5 px-3 sm:px-5'
          : 'py-5 sm:py-8 px-3.5 sm:px-8 shadow-2xl'
      } ${
        isFullDark
          ? 'bg-[#09090b] border-white/[0.1] shadow-black'
          : isClassic
          ? 'bg-gradient-to-b from-slate-900/85 via-slate-950/95 to-black border-cyan-500/30 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_35px_rgba(0,240,255,0.1)]'
          : 'bg-zinc-900/85 border-indigo-500/25 backdrop-blur-xl shadow-black/50'
      }`}
    >
      {/* Tactical Google Stitch Aerospace Corner Reticles */}
      <div className="stitch-corner-bracket stitch-corner-tl" />
      <div className="stitch-corner-bracket stitch-corner-tr" />
      <div className="stitch-corner-bracket stitch-corner-bl" />
      <div className="stitch-corner-bracket stitch-corner-br" />

      {/* Top Animated Laser Sweep */}
      <div className="mc-laser-line" />

      {/* Ambient Radial Reactor Glow */}
      <div
        className={`pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl transition-all duration-700 ${
          isCompact ? 'w-48 h-48 opacity-25' : 'w-72 h-72 opacity-35'
        } ${
          isSynthesizing
            ? 'bg-gradient-to-tr from-emerald-500/40 via-cyan-400/35 to-violet-500/40'
            : isDebatingState
            ? 'bg-gradient-to-tr from-amber-500/45 via-rose-500/35 to-cyan-500/35'
            : isThinking
            ? 'bg-gradient-to-tr from-cyan-500/40 via-sky-500/35 to-indigo-500/30'
            : 'bg-cyan-500/15'
        }`}
      />

      {/* HUD Top Bar: System ID, State Indicators & Optional Collapse Trigger */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 mb-3 sm:mb-4">
        {/* Left: Tactical Emblem & Status */}
        <div className="flex items-center gap-2">
          <div
            className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg grid place-items-center border ${
              isSynthesizing
                ? 'bg-emerald-950/60 border-emerald-400/50 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.4)]'
                : isDebatingState
                ? 'bg-amber-950/60 border-amber-400/50 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                : isThinking
                ? 'bg-cyan-950/60 border-cyan-400/50 text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                : 'bg-slate-900 border-white/15 text-slate-400'
            }`}
          >
            {isSynthesizing ? (
              <Sparkles size={14} className="animate-spin" style={{ animationDuration: '4s' }} />
            ) : isDebatingState ? (
              <Flame size={14} className="animate-pulse" />
            ) : isThinking ? (
              <Zap size={14} className="animate-pulse" />
            ) : (
              <Activity size={14} />
            )}
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] sm:text-xs font-mono font-bold tracking-wider uppercase text-white">
                TRI-MIND SYNAPSE REACTOR
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-slate-300">
                v2.4
              </span>
            </div>
            <span className="text-[9.5px] font-mono text-slate-400 flex items-center gap-1">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isSynthesizing
                    ? 'bg-emerald-400 animate-ping'
                    : isDebatingState
                    ? 'bg-amber-400 animate-ping'
                    : isThinking
                    ? 'bg-cyan-400 animate-ping'
                    : 'bg-slate-500'
                }`}
              />
              STATE:{' '}
              <strong
                className={
                  isSynthesizing
                    ? 'text-emerald-300'
                    : isDebatingState
                    ? 'text-amber-300'
                    : isThinking
                    ? 'text-cyan-300'
                    : 'text-slate-300'
                }
              >
                {resolvedState.toUpperCase()}
              </strong>
            </span>
          </div>
        </div>

        {/* Right: State Mode Selector Tabs & Optional Collapse */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="inline-flex items-center p-0.5 rounded-xl bg-black/60 border border-white/10 text-[10px] font-mono">
            <button
              type="button"
              onClick={() => setSelectedStateMode('auto')}
              className={`px-2 py-0.5 rounded-lg transition-all ${
                selectedStateMode === 'auto'
                  ? 'bg-cyan-500/25 text-cyan-200 font-bold border border-cyan-400/30'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Automatically follow live AI deliberation"
            >
              AUTO
            </button>
            <button
              type="button"
              onClick={() => setSelectedStateMode('idle')}
              className={`px-1.5 py-0.5 rounded-lg transition-all ${
                selectedStateMode === 'idle'
                  ? 'bg-slate-700 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              IDLE
            </button>
            <button
              type="button"
              onClick={() => setSelectedStateMode('thinking')}
              className={`px-1.5 py-0.5 rounded-lg transition-all ${
                selectedStateMode === 'thinking'
                  ? 'bg-cyan-500/30 text-cyan-200 font-bold border border-cyan-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              THINK
            </button>
            <button
              type="button"
              onClick={() => setSelectedStateMode('debating')}
              className={`px-1.5 py-0.5 rounded-lg transition-all ${
                selectedStateMode === 'debating'
                  ? 'bg-amber-500/30 text-amber-200 font-bold border border-amber-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              DEBATE
            </button>
            <button
              type="button"
              onClick={() => setSelectedStateMode('synthesizing')}
              className={`px-1.5 py-0.5 rounded-lg transition-all ${
                selectedStateMode === 'synthesizing'
                  ? 'bg-emerald-500/30 text-emerald-200 font-bold border border-emerald-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              SYNTH
            </button>
          </div>

          {collapsible && (
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/10"
              title={isCollapsed ? 'Expand Reactor' : 'Collapse Reactor'}
            >
              {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Main Collapsible Reactor Body */}
      {!isCollapsed && (
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
          {/* Left/Center: Interactive SVG Holographic Reactor */}
          <div
            className={`relative mx-auto grid place-items-center shrink-0 ${
              isCompact ? 'w-44 h-44 sm:w-52 sm:h-52' : 'w-56 h-56 sm:w-64 sm:h-64'
            }`}
          >
            <svg
              viewBox="0 0 240 240"
              className="w-full h-full overflow-visible select-none"
              style={{ willChange: 'transform' }}
            >
              <defs>
                {/* Dynamic Singularity Gradients */}
                <radialGradient id={`coreGlow_${uid}`} cx="50%" cy="50%" r="50%">
                  <stop
                    offset="0%"
                    stopColor={isSynthesizing ? '#ffffff' : isDebatingState ? '#f59e0b' : '#00f0ff'}
                    stopOpacity="1"
                  />
                  <stop
                    offset="50%"
                    stopColor={isSynthesizing ? '#34d399' : isDebatingState ? '#fb7185' : '#6366f1'}
                    stopOpacity="0.75"
                  />
                  <stop
                    offset="100%"
                    stopColor={isSynthesizing ? '#00f0ff' : isDebatingState ? '#c084fc' : '#a855f7'}
                    stopOpacity="0"
                  />
                </radialGradient>

                <linearGradient id={`triNovaGrad_${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#34d399" stopOpacity="0.8" />
                </linearGradient>

                <linearGradient id={`triOrbitGrad_${uid}`} x1="100%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#34d399" stopOpacity="0.8" />
                </linearGradient>

                <linearGradient id={`triCosmosGrad_${uid}`} x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#c084fc" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#34d399" stopOpacity="0.8" />
                </linearGradient>

                <linearGradient id={`outerRimGrad_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.6" />
                  <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#c084fc" stopOpacity="0.6" />
                </linearGradient>
              </defs>

              {/* 1. Outermost Tactical Instrumentation Ring with Degrees & Ticks */}
              <circle
                cx="120"
                cy="120"
                r="108"
                fill="none"
                stroke={`url(#outerRimGrad_${uid})`}
                strokeWidth="1"
                strokeDasharray="4 8 2 8"
                className={isThinking || isDebatingState ? 'stitch-orbit-spin' : ''}
                style={{
                  animationDuration: isThinking ? '8s' : isDebatingState ? '5s' : '28s',
                  transformOrigin: '120px 120px',
                }}
              />

              {/* Orbital Degree Markings */}
              <g
                className="text-[7.5px] font-mono fill-slate-500 font-bold select-none"
                style={{ letterSpacing: '0.08em' }}
              >
                <text x="120" y="8" textAnchor="middle">
                  000°
                </text>
                <text x="232" y="180" textAnchor="middle">
                  120°
                </text>
                <text x="8" y="180" textAnchor="middle">
                  240°
                </text>
              </g>

              {/* 2. Middle Gyroscopic Counter-Rotating Ring */}
              <circle
                cx="120"
                cy="120"
                r="92"
                fill="none"
                stroke="rgba(0, 240, 255, 0.3)"
                strokeWidth="1.2"
                strokeDasharray="16 10 3 10"
                className="stitch-orbit-reverse"
                style={{
                  animationDuration: isThinking ? '6s' : isDebatingState ? '3.5s' : '18s',
                  transformOrigin: '120px 120px',
                }}
              />

              {/* 3. Dedicated Orbital Circles For Each Agent */}
              {/* NOVA Orbital Ring */}
              <circle
                cx="120"
                cy="120"
                r="75"
                fill="none"
                stroke="rgba(0, 240, 255, 0.22)"
                strokeWidth="1"
                strokeDasharray="6 6"
              />
              {/* ORBIT Orbital Ring */}
              <circle
                cx="120"
                cy="120"
                r="58"
                fill="none"
                stroke="rgba(245, 158, 11, 0.2)"
                strokeWidth="1"
                strokeDasharray="4 8"
              />
              {/* COSMOS Orbital Ring */}
              <circle
                cx="120"
                cy="120"
                r="42"
                fill="none"
                stroke="rgba(192, 132, 252, 0.2)"
                strokeWidth="1"
                strokeDasharray="3 6"
              />

              {/* 4. Energy Conduits Connecting Agents (Equilateral Synapse Perimeter) */}
              <polygon
                points="120,45 185,157.5 55,157.5"
                fill="none"
                stroke={
                  isDebatingState
                    ? '#f59e0b'
                    : isThinking
                    ? '#00f0ff'
                    : 'rgba(148, 163, 184, 0.35)'
                }
                strokeWidth={isThinking || isDebatingState ? '1.8' : '1'}
                strokeDasharray={isThinking || isDebatingState ? '8 6' : '3 5'}
                className={isThinking ? 'synapse-laser-pulse' : ''}
              />

              {/* 5. Debate Clash Friction Sparks (When In Debating State) */}
              {isDebatingState && (
                <g className="tri-clash-spark">
                  {/* Friction burst between NOVA and ORBIT */}
                  <line
                    x1="145"
                    y1="90"
                    x2="160"
                    y2="112"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    filter="drop-shadow(0 0 8px #f59e0b)"
                  />
                  <line
                    x1="152"
                    y1="101"
                    x2="140"
                    y2="108"
                    stroke="#00f0ff"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle cx="152" cy="101" r="4" fill="#ffffff" />
                </g>
              )}

              {/* 6. Three Inward Converging Energy Streams (During Synthesis State) */}
              {isSynthesizing && (
                <g>
                  {/* NOVA Inward Stream: Cyan into Center (120, 120) */}
                  <path
                    d="M 120 45 Q 135 85 120 120"
                    fill="none"
                    stroke={`url(#triNovaGrad_${uid})`}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    className="tri-stream-nova"
                    filter="drop-shadow(0 0 10px #00f0ff)"
                  />
                  {/* ORBIT Inward Stream: Amber into Center */}
                  <path
                    d="M 185 157.5 Q 160 125 120 120"
                    fill="none"
                    stroke={`url(#triOrbitGrad_${uid})`}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    className="tri-stream-orbit"
                    filter="drop-shadow(0 0 10px #f59e0b)"
                  />
                  {/* COSMOS Inward Stream: Violet into Center */}
                  <path
                    d="M 55 157.5 Q 80 125 120 120"
                    fill="none"
                    stroke={`url(#triCosmosGrad_${uid})`}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    className="tri-stream-cosmos"
                    filter="drop-shadow(0 0 10px #c084fc)"
                  />
                </g>
              )}

              {/* 7. Central Intelligence Core Singularity */}
              {isSynthesizing ? (
                /* Glowing Converging Emerald-White Fusion Vortex */
                <g className="fusion-vortex-spin" style={{ transformOrigin: '120px 120px' }}>
                  <circle
                    cx="120"
                    cy="120"
                    r="24"
                    fill={`url(#coreGlow_${uid})`}
                    className="tri-core-bloom"
                  />
                  <circle
                    cx="120"
                    cy="120"
                    r="32"
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="1.5"
                    strokeDasharray="6 6"
                    className="fusion-shockwave-ring"
                    style={{ transformOrigin: '120px 120px' }}
                  />
                  <circle
                    cx="120"
                    cy="120"
                    r="10"
                    fill="#ffffff"
                    style={{ filter: 'drop-shadow(0 0 12px #34d399)' }}
                  />
                </g>
              ) : (
                /* Idle/Thinking/Debating Standard Core */
                <g>
                  <circle
                    cx="120"
                    cy="120"
                    r={isThinking ? '20' : '16'}
                    fill={`url(#coreGlow_${uid})`}
                    className={isThinking ? 'animate-pulse' : ''}
                  />
                  <circle
                    cx="120"
                    cy="120"
                    r="7"
                    fill="#ffffff"
                    style={{
                      filter: `drop-shadow(0 0 8px ${
                        isDebatingState ? '#f59e0b' : '#00f0ff'
                      })`,
                    }}
                  />
                </g>
              )}

              {/* 8. The Three Interactive Agent Satellite Nodes */}
              {nodes.map((node) => {
                const isTargeted = targetedPersonaIds.includes(node.id);
                const isActive = activePersonaId === node.id || isGenerating;

                return (
                  <g
                    key={node.id}
                    className="cursor-pointer group"
                    onClick={() => onToggleTargetPersona?.(node.id)}
                  >
                    {/* Glowing Aura Halo */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={isTargeted ? 16 : 13}
                      fill={node.glowColor}
                      className={isActive ? 'animate-pulse' : ''}
                    />

                    {/* Outer Target Reticle Ring */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={isTargeted ? 15 : 12}
                      fill="none"
                      stroke={node.accentColor}
                      strokeWidth={isTargeted ? '2' : '1.2'}
                      strokeDasharray={isTargeted ? 'none' : '3 3'}
                    />

                    {/* Node Core Orb */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r="6.5"
                      fill={node.accentColor}
                      style={{
                        filter: `drop-shadow(0 0 8px ${node.accentColor})`,
                      }}
                    />
                    <circle cx={node.x} cy={node.y} r="2.5" fill="#ffffff" />

                    {/* Monospace Node Label */}
                    <text
                      x={node.x}
                      y={node.id === 'nova' ? node.y - 14 : node.y + 19}
                      textAnchor="middle"
                      className="text-[9px] font-mono font-black select-none pointer-events-none tracking-widest"
                      fill={isTargeted ? '#ffffff' : node.accentColor}
                    >
                      {node.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Right/Side: Live Real Telemetry Metrics & Agent Matrix (Rule 7: Real data only or N/A) */}
          <div className="flex-1 w-full flex flex-col justify-between gap-3 min-w-0">
            {/* Real Telemetry Readout Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Latency */}
              <div className="p-2 sm:p-2.5 rounded-xl bg-black/45 border border-white/10 flex flex-col">
                <span className="text-[9.5px] font-mono text-slate-400 uppercase tracking-wider">
                  Latency
                </span>
                <span className="text-xs sm:text-sm font-mono font-bold text-white cyber-telemetry-number">
                  {telemetry?.latencySec != null ? `${telemetry.latencySec.toFixed(1)}s` : 'N/A'}
                </span>
              </div>

              {/* Token Velocity */}
              <div className="p-2 sm:p-2.5 rounded-xl bg-black/45 border border-white/10 flex flex-col">
                <span className="text-[9.5px] font-mono text-slate-400 uppercase tracking-wider">
                  Speed
                </span>
                <span className="text-xs sm:text-sm font-mono font-bold text-cyan-300 cyber-telemetry-number">
                  {telemetry?.tokensPerSec != null ? `${telemetry.tokensPerSec} tok/s` : 'N/A'}
                </span>
              </div>

              {/* Total Tokens */}
              <div className="p-2 sm:p-2.5 rounded-xl bg-black/45 border border-white/10 flex flex-col">
                <span className="text-[9.5px] font-mono text-slate-400 uppercase tracking-wider">
                  Tokens
                </span>
                <span className="text-xs sm:text-sm font-mono font-bold text-slate-200 cyber-telemetry-number">
                  {telemetry?.tokensCount != null ? `~${telemetry.tokensCount}` : 'N/A'}
                </span>
              </div>

              {/* Consensus Points */}
              <div className="p-2 sm:p-2.5 rounded-xl bg-black/45 border border-white/10 flex flex-col">
                <span className="text-[9.5px] font-mono text-slate-400 uppercase tracking-wider">
                  Consensus
                </span>
                <span className="text-xs sm:text-sm font-mono font-bold text-emerald-300 cyber-telemetry-number">
                  {telemetry?.consensusAgreementsCount != null
                    ? `${telemetry.consensusAgreementsCount} points`
                    : 'N/A'}
                </span>
              </div>
            </div>

            {/* Quick Agent Target Selector Strip */}
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/10 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span className="uppercase tracking-wider">TRI-MIND AGENT MATRIX:</span>
                <span className="text-cyan-400">Tap node to target</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {nodes.map((node) => {
                  const isTargeted = targetedPersonaIds.includes(node.id);
                  const Icon = node.icon;
                  return (
                    <button
                      key={`strip_${node.id}`}
                      type="button"
                      onClick={() => onToggleTargetPersona?.(node.id)}
                      className={`px-2 py-1.5 rounded-lg border text-left transition-all flex items-center justify-between gap-1 ${
                        isTargeted
                          ? 'bg-white/10 border-white/40 shadow-sm'
                          : 'bg-black/30 border-white/10 hover:border-white/20'
                      }`}
                      style={{
                        borderColor: isTargeted ? node.accentColor : undefined,
                        boxShadow: isTargeted ? `0 0 10px ${node.accentColor}30` : undefined,
                      }}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Icon size={12} style={{ color: node.accentColor }} className="shrink-0" />
                        <span className="text-[11px] font-mono font-bold text-white truncate">
                          {node.name}
                        </span>
                      </div>
                      {isTargeted && (
                        <CheckCircle2 size={11} className="text-white shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
