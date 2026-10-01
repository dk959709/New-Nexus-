import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Radio,
  Search,
  Maximize2,
  Minimize2,
  Activity,
  Layers,
} from 'lucide-react';
import { AGENT_QUADRANTS } from '@/data/parallaxQuadrants';
import type { ParallaxAgentConfig, ParallaxMessage } from '@/types';

export interface ParallaxOrbitalCoreProps {
  agents: Record<string, ParallaxAgentConfig>;
  messages: ParallaxMessage[];
  currentRound: 1 | 2 | 3 | null;
  isRunning: boolean;
  activeSpeakingAgentId?: string | null;
  selectedAgentId?: string | null;
  onSelectAgent?: (agentId: string | null) => void;
  topic?: string;
  dynamicPersonas?: ParallaxAgentConfig[];
}

export const ParallaxOrbitalCore: React.FC<ParallaxOrbitalCoreProps> = ({
  agents,
  messages,
  currentRound,
  isRunning,
  activeSpeakingAgentId,
  selectedAgentId,
  onSelectAgent,
  topic,
  dynamicPersonas = [],
}) => {
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
  const [orbitAngle, setOrbitAngle] = useState(0);
  const [isOrbiting, setIsOrbiting] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const requestRef = useRef<number | null>(null);

  // Smooth orbital drift animation loop (respects prefers-reduced-motion)
  useEffect(() => {
    let lastTime = performance.now();
    const animate = (time: number) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      if (isOrbiting) {
        // Slow majestic drift: 3 degrees per second
        setOrbitAngle((prev) => (prev + delta * 3) % 360);
      }
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isOrbiting]);

  // Combine static agents with dynamic specialists
  const allAgentsList = useMemo(() => {
    const list: Array<ParallaxAgentConfig & { angleOffset: number; ring: 1 | 2 | 3 }> = [];

    // Core 20 agents
    Object.keys(agents).forEach((key) => {
      const config = agents[key];
      const q = AGENT_QUADRANTS[key];
      if (!config || !q) return;

      const ring: 1 | 2 | 3 = q.quadrant === 'anchors' ? 1 : q.quadrant === 'realists' || q.quadrant === 'optimists' ? 2 : 3;
      list.push({
        ...config,
        angleOffset: q.angle,
        ring,
      });
    });

    // Dynamic Specialists (distributed in ring 1 or 2)
    dynamicPersonas.forEach((spec, idx) => {
      const existing = list.find((a) => a.id === spec.id);
      if (!existing) {
        list.push({
          ...spec,
          angleOffset: (idx * 72 + 45) % 360,
          ring: 1,
        });
      }
    });

    return list;
  }, [agents, dynamicPersonas]);

  // Quick lookup for messages per agent
  const agentRepliesMap = useMemo(() => {
    const map = new Map<string, ParallaxMessage[]>();
    messages.forEach((m) => {
      const arr = map.get(m.agentId) || [];
      arr.push(m);
      map.set(m.agentId, arr);
    });
    return map;
  }, [messages]);

  // Active or hovered agent details
  const activeAgentKey = selectedAgentId || hoveredAgentId || activeSpeakingAgentId;
  const inspectedAgent = activeAgentKey
    ? allAgentsList.find((a) => a.id === activeAgentKey) || agents[activeAgentKey] || null
    : null;
  const inspectedLastMsg = activeAgentKey
    ? [...(agentRepliesMap.get(activeAgentKey) || [])].pop() || null
    : null;

  // Collaborating connection pairs (agents that spoke in the same round)
  const collaborationLinks = useMemo(() => {
    if (messages.length < 2) return [];
    const recent = messages.slice(-8);
    const links: Array<{ from: string; to: string }> = [];

    for (let i = 0; i < recent.length - 1; i++) {
      const a = recent[i];
      const b = recent[i + 1];
      if (a.agentId !== b.agentId && a.round === b.round) {
        links.push({ from: a.agentId, to: b.agentId });
      }
    }
    return links;
  }, [messages]);

  // SVG dimensions
  const viewBoxWidth = 840;
  const viewBoxHeight = isExpanded ? 640 : 480;
  const centerX = viewBoxWidth / 2;
  const centerY = viewBoxHeight / 2;

  // Ring radii
  const r1 = 85; // Core Anchors & Specialists
  const r2 = 160; // Inner Swarm Orbit
  const r3 = 230; // Outer Swarm Orbit

  // Coordinate calculator helper
  const getNodeCoordinates = (ring: 1 | 2 | 3, baseAngle: number) => {
    const currentRot = isOrbiting ? (baseAngle + orbitAngle) % 360 : baseAngle;
    const rad = (currentRot * Math.PI) / 180;
    const radius = ring === 1 ? r1 : ring === 2 ? r2 : r3;
    // Slight vertical compression (0.86) gives a gorgeous dimensional command view
    return {
      x: centerX + Math.cos(rad) * radius,
      y: centerY + Math.sin(rad) * radius * 0.86,
      angle: currentRot,
    };
  };

  return (
    <div
      id="parallax-orbital-core"
      className="nexus-corner-bracket relative rounded-2xl overflow-hidden mb-6 select-none transition-all duration-300"
      style={{
        background: 'linear-gradient(145deg, rgba(3, 10, 18, 0.96) 0%, rgba(2, 6, 12, 0.99) 100%)',
        border: '1.5px solid rgba(0, 240, 255, 0.28)',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.7), inset 0 0 40px rgba(0, 240, 255, 0.05)',
      }}
    >
      {/* Background Holographic Starfield & Polar Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(rgba(0, 240, 255, 0.15) 1px, transparent 1px), radial-gradient(rgba(37, 99, 235, 0.1) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          backgroundPosition: '0 0, 12px 12px',
        }}
      />

      {/* Top HUD Control Bar */}
      <div className="relative z-20 px-5 py-3.5 bg-black/60 backdrop-blur-md border-b border-cyan-500/20 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: 'rgba(0, 240, 255, 0.15)',
              border: '1px solid rgba(0, 240, 255, 0.4)',
              color: 'var(--nexus-cyan)',
            }}
          >
            <Layers size={15} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-black uppercase text-white tracking-wider">
                SWARM ORBITAL CORE
              </span>
              <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 font-bold">
                {allAgentsList.length} NODES
              </span>
              {isRunning && (
                <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1">
                  <Radio size={9} className="animate-pulse" />
                  DELIBERATING
                </span>
              )}
            </div>
            <p className="m-0 text-[11px] text-slate-400 font-mono truncate max-w-[340px]">
              {topic ? `Target: ${topic}` : 'Live multi-agent topology • Interactive orbital matrix • Tap any node to focus'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 font-mono text-[11px]">
          {/* Pause / Resume Rotation */}
          <button
            type="button"
            onClick={() => setIsOrbiting(!isOrbiting)}
            className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-400/40 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
            title={isOrbiting ? 'Freeze orbital motion' : 'Resume orbital motion'}
          >
            <Activity size={12} className={isOrbiting ? 'text-cyan-400 animate-pulse' : 'text-slate-500'} />
            <span>{isOrbiting ? 'Orbiting' : 'Paused'}</span>
          </button>

          {/* Reset selection button */}
          {selectedAgentId && (
            <button
              type="button"
              onClick={() => onSelectAgent?.(null)}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400 text-cyan-200 font-bold transition-all cursor-pointer flex items-center gap-1"
            >
              <span>Reset Focus</span>
            </button>
          )}

          {/* Expand / Minimize view */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-400/40 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1"
            title={isExpanded ? 'Collapse Stage' : 'Expand Stage'}
          >
            {isExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            <span className="hidden sm:inline">{isExpanded ? 'Compact' : 'Expand'}</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas Stage */}
      <div className="relative w-full overflow-hidden flex items-center justify-center p-2 sm:p-4">
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full h-auto max-h-[560px] block overflow-visible"
          style={{ filter: 'drop-shadow(0 0 30px rgba(0, 240, 255, 0.08))' }}
        >
          <defs>
            {/* Holographic Radial Core Glow */}
            <radialGradient id="nexusCorePulse" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.45" />
              <stop offset="40%" stopColor="#0284c7" stopOpacity="0.25" />
              <stop offset="80%" stopColor="#1e1b4b" stopOpacity="0.1" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>

            {/* Radar sweep gradient */}
            <linearGradient id="nexusRadarSweepGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.35" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </linearGradient>

            {/* Speaking beam gradient */}
            <linearGradient id="speakingBeamGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#c084fc" stopOpacity="0.3" />
            </linearGradient>
          </defs>

          {/* Background Polar Coordinate Grid */}
          <g opacity="0.35">
            {/* Crosshairs */}
            <line
              x1="40"
              y1={centerY}
              x2={viewBoxWidth - 40}
              y2={centerY}
              stroke="rgba(0, 240, 255, 0.15)"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
            <line
              x1={centerX}
              y1="30"
              x2={centerX}
              y2={viewBoxHeight - 30}
              stroke="rgba(0, 240, 255, 0.15)"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
            {/* Diagonal guides */}
            <line
              x1={centerX - 240}
              y1={centerY - 180}
              x2={centerX + 240}
              y2={centerY + 180}
              stroke="rgba(0, 240, 255, 0.08)"
              strokeWidth="1"
              strokeDasharray="2 4"
            />
            <line
              x1={centerX - 240}
              y1={centerY + 180}
              x2={centerX + 240}
              y2={centerY - 180}
              stroke="rgba(0, 240, 255, 0.08)"
              strokeWidth="1"
              strokeDasharray="2 4"
            />
          </g>

          {/* Orbital Track Rings */}
          <g>
            {/* Outer Orbit 3 */}
            <ellipse
              cx={centerX}
              cy={centerY}
              rx={r3}
              ry={r3 * 0.86}
              fill="none"
              stroke={selectedAgentId ? 'rgba(0, 240, 255, 0.12)' : 'rgba(0, 240, 255, 0.22)'}
              strokeWidth="1.2"
              strokeDasharray="5 7"
            />

            {/* Middle Orbit 2 */}
            <ellipse
              cx={centerX}
              cy={centerY}
              rx={r2}
              ry={r2 * 0.86}
              fill="none"
              stroke={selectedAgentId ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0, 240, 255, 0.28)'}
              strokeWidth="1.4"
            />

            {/* Inner Core Orbit 1 */}
            <ellipse
              cx={centerX}
              cy={centerY}
              rx={r1}
              ry={r1 * 0.86}
              fill="none"
              stroke="rgba(0, 240, 255, 0.38)"
              strokeWidth="1.6"
              strokeDasharray="3 3"
            />
          </g>

          {/* Radar Sweep Wedge */}
          <g className="nexus-radar-sweep" style={{ transformOrigin: `${centerX}px ${centerY}px` }}>
            <path
              d={`M ${centerX} ${centerY} L ${centerX + r3} ${centerY} A ${r3} ${r3 * 0.86} 0 0 0 ${centerX + Math.cos(0.5) * r3} ${centerY - Math.sin(0.5) * r3 * 0.86} Z`}
              fill="url(#nexusRadarSweepGrad)"
              pointerEvents="none"
            />
          </g>

          {/* Central Holographic Core */}
          <g>
            {/* Outer Quantum Ambient Glow */}
            <circle cx={centerX} cy={centerY} r="65" fill="url(#nexusCorePulse)" />

            {/* Mechanical Outer Core Ring */}
            <circle
              cx={centerX}
              cy={centerY}
              r="40"
              fill="none"
              stroke="rgba(0, 240, 255, 0.4)"
              strokeWidth="1.5"
              strokeDasharray="6 4"
              className="nexus-orbit-spin-slow"
              style={{ transformOrigin: `${centerX}px ${centerY}px` }}
            />

            {/* Solid Center Orb */}
            <circle
              cx={centerX}
              cy={centerY}
              r="30"
              fill="#030c16"
              stroke="rgba(0, 240, 255, 0.8)"
              strokeWidth="2"
              style={{
                filter: isRunning
                  ? 'drop-shadow(0 0 12px rgba(0, 240, 255, 0.9))'
                  : 'drop-shadow(0 0 6px rgba(0, 240, 255, 0.4))',
              }}
            />

            {/* Central Typography Branding */}
            <text
              x={centerX}
              y={centerY - 5}
              textAnchor="middle"
              fill="#00f0ff"
              fontSize="9"
              fontFamily="DM Mono, monospace"
              fontWeight="900"
              letterSpacing="0.1em"
            >
              NEXUS
            </text>
            <text
              x={centerX}
              y={centerY + 8}
              textAnchor="middle"
              fill="#ffffff"
              fontSize="7.5"
              fontFamily="DM Mono, monospace"
              fontWeight="700"
              letterSpacing="0.05em"
            >
              PARALLAX CORE
            </text>
            <text
              x={centerX}
              y={centerY + 19}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="6"
              fontFamily="DM Mono, monospace"
            >
              {isRunning && currentRound ? `ROUND 0${currentRound}` : 'SWARM READY'}
            </text>
          </g>

          {/* Collaboration Connection Lines between communicating agents */}
          <g pointerEvents="none" opacity="0.6">
            {collaborationLinks.map((link, idx) => {
              const fromAgent = allAgentsList.find((a) => a.id === link.from);
              const toAgent = allAgentsList.find((a) => a.id === link.to);
              if (!fromAgent || !toAgent) return null;

              const c1 = getNodeCoordinates(fromAgent.ring, fromAgent.angleOffset);
              const c2 = getNodeCoordinates(toAgent.ring, toAgent.angleOffset);

              return (
                <line
                  key={`collab-${idx}`}
                  x1={c1.x}
                  y1={c1.y}
                  x2={c2.x}
                  y2={c2.y}
                  stroke="rgba(0, 240, 255, 0.35)"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
              );
            })}
          </g>

          {/* Render All Agent Nodes */}
          {allAgentsList.map((agent) => {
            const { x, y } = getNodeCoordinates(agent.ring, agent.angleOffset);
            const isSpeaking = activeSpeakingAgentId === agent.id;
            const isSelected = selectedAgentId === agent.id;
            const isHovered = hoveredAgentId === agent.id;
            const replies = agentRepliesMap.get(agent.id) || [];
            const hasCompleted = replies.length > 0;
            const accentColor = agent.accentColor || '#00f0ff';

            // Radiating beam to core if speaking or selected
            const showBeam = isSpeaking || isSelected;

            return (
              <g
                key={agent.id}
                onClick={() => onSelectAgent?.(selectedAgentId === agent.id ? null : agent.id)}
                onMouseEnter={() => setHoveredAgentId(agent.id)}
                onMouseLeave={() => setHoveredAgentId(null)}
                className="cursor-pointer"
                style={{
                  opacity: selectedAgentId && !isSelected ? 0.45 : 1,
                  transition: 'opacity 0.25s ease',
                }}
              >
                {/* Radiating beam to central core */}
                {showBeam && (
                  <line
                    x1={centerX}
                    y1={centerY}
                    x2={x}
                    y2={y}
                    stroke={isSpeaking ? 'url(#speakingBeamGrad)' : accentColor}
                    strokeWidth={isSpeaking ? '2.5' : '1.5'}
                    strokeOpacity={isSpeaking ? '0.9' : '0.6'}
                    strokeDasharray={isSpeaking ? 'none' : '3 3'}
                  />
                )}

                {/* Animated speaking pulse wave */}
                {isSpeaking && (
                  <>
                    <circle
                      cx={x}
                      cy={y}
                      r="26"
                      fill="none"
                      stroke={accentColor}
                      strokeWidth="1.5"
                      opacity="0.5"
                      className="animate-ping"
                    />
                    <circle
                      cx={x}
                      cy={y}
                      r="21"
                      fill="none"
                      stroke="#00f0ff"
                      strokeWidth="2"
                      opacity="0.8"
                    />
                  </>
                )}

                {/* Outer halo */}
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? '18' : isHovered ? '16' : '13'}
                  fill="#030c16"
                  stroke={isSelected ? '#ffffff' : accentColor}
                  strokeWidth={isSelected ? '2.5' : isSpeaking ? '2' : '1.5'}
                  style={{
                    filter: isSpeaking
                      ? `drop-shadow(0 0 12px ${accentColor}) drop-shadow(0 0 20px #00f0ff)`
                      : isSelected
                      ? `drop-shadow(0 0 10px ${accentColor})`
                      : hasCompleted
                      ? `drop-shadow(0 0 4px ${accentColor}80)`
                      : 'none',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                />

                {/* Agent Initials */}
                <text
                  x={x}
                  y={y + 3.5}
                  textAnchor="middle"
                  fill={isSelected ? '#ffffff' : accentColor}
                  fontSize={isSelected || isHovered ? '9.5' : '8.5'}
                  fontFamily="DM Mono, monospace"
                  fontWeight="bold"
                >
                  {agent.initials || agent.name.slice(0, 2)}
                </text>

                {/* Name Label */}
                <text
                  x={x}
                  y={y > centerY ? y + 21 : y - 16}
                  textAnchor="middle"
                  fill={isSelected ? '#00f0ff' : '#cbd5e1'}
                  fontSize={isSelected ? '10' : '8.5'}
                  fontFamily="DM Mono, monospace"
                  fontWeight={isSelected ? 'bold' : 'normal'}
                  style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
                >
                  {agent.name}
                </text>

                {/* Completed / Active Micro Indicator */}
                {hasCompleted && (
                  <circle
                    cx={x + 10}
                    cy={y - 10}
                    r="3.5"
                    fill="#10b981"
                    stroke="#030c16"
                    strokeWidth="1"
                    style={{ filter: 'drop-shadow(0 0 4px #10b981)' }}
                  />
                )}
                {agent.hasToolAccess && (
                  <circle
                    cx={x - 10}
                    cy={y - 10}
                    r="3.5"
                    fill="#38bdf8"
                    stroke="#030c16"
                    strokeWidth="1"
                    title="Live Tool Grounding (VERITAS)"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Floating HUD Inspector Card at Bottom of Orbital Stage */}
      {inspectedAgent && (
        <div
          id="parallax-agent-inspector"
          className="relative z-30 mx-4 mb-4 p-3.5 rounded-xl bg-black/85 backdrop-blur-xl border border-cyan-500/30 shadow-2xl flex items-center justify-between flex-wrap gap-3"
          style={{
            borderLeft: `4px solid ${inspectedAgent.accentColor || '#00f0ff'}`,
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center font-mono font-bold text-sm shrink-0"
              style={{
                background: `${inspectedAgent.accentColor || '#00f0ff'}20`,
                border: `1.5px solid ${inspectedAgent.accentColor || '#00f0ff'}`,
                color: inspectedAgent.accentColor || '#00f0ff',
              }}
            >
              {inspectedAgent.initials || inspectedAgent.name.slice(0, 2)}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-sm text-white">
                  {inspectedAgent.name}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-slate-300">
                  {inspectedAgent.role}
                </span>
                {inspectedAgent.hasToolAccess && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold flex items-center gap-1">
                    <Search size={10} />
                    VERITAS TOOL GROUNDED
                  </span>
                )}
                {inspectedLastMsg?.conviction !== undefined && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold">
                    Conviction: {inspectedLastMsg.conviction}/10
                  </span>
                )}
              </div>

              {inspectedLastMsg ? (
                <p className="m-0 text-xs text-slate-300 line-clamp-1 mt-0.5 font-sans">
                  &ldquo;{inspectedLastMsg.text.slice(0, 140)}...&rdquo;
                </p>
              ) : (
                <p className="m-0 text-xs text-slate-500 italic mt-0.5 font-mono">
                  Standing by in orbital matrix • Awaiting topic round mobilization
                </p>
              )}
            </div>
          </div>

          {/* Quick Filter toggle */}
          <button
            type="button"
            onClick={() => onSelectAgent?.(selectedAgentId === inspectedAgent.id ? null : inspectedAgent.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap"
            style={{
              background: selectedAgentId === inspectedAgent.id ? 'rgba(0, 240, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)',
              border: `1px solid ${selectedAgentId === inspectedAgent.id ? '#00f0ff' : 'rgba(255, 255, 255, 0.15)'}`,
              color: selectedAgentId === inspectedAgent.id ? '#00f0ff' : '#cbd5e1',
            }}
          >
            {selectedAgentId === inspectedAgent.id ? '✕ Clear Focus' : '◉ Focus Agent'}
          </button>
        </div>
      )}
    </div>
  );
};
