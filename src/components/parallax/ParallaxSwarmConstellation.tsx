import React, { useState, useMemo } from 'react';
import {
  Radar,
  ChevronDown,
  ChevronUp,
  Filter,
  Sparkles,
  Radio,
  Flame,
} from 'lucide-react';
import { ParallaxAgentAvatar } from './ParallaxAgentIcon';
import { getParallaxAgentIcon } from './agentIcons';
import { AGENT_QUADRANTS } from '@/data/parallaxQuadrants';
import type { ParallaxAgentConfig, ParallaxMessage } from '@/types';

export interface ParallaxSwarmConstellationProps {
  agents: Record<string, ParallaxAgentConfig>;
  messages: ParallaxMessage[];
  currentRound: 1 | 2 | 3 | null;
  isRunning: boolean;
  activeSpeakingAgentId?: string | null;
  selectedAgentId?: string | null;
  onSelectAgent?: (agentId: string | null) => void;
  topic?: string;
}

export const ParallaxSwarmConstellation: React.FC<ParallaxSwarmConstellationProps> = ({
  agents,
  messages,
  currentRound,
  isRunning,
  activeSpeakingAgentId,
  selectedAgentId,
  onSelectAgent,
  topic,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [viewMode, setViewMode] = useState<'orbit' | 'quadrant' | 'telemetry'>('orbit');
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);

  // Compute swarm statistics from actual state
  const stats = useMemo(() => {
    const agentMsgs = messages.filter((m) => !m.isHuman);
    const totalMsgs = agentMsgs.length;
    const convictionScores = agentMsgs
      .filter((m) => typeof m.conviction === 'number')
      .map((m) => {
        const raw = m.conviction as number;
        return raw <= 10 ? raw : raw / 10;
      });
    const avgConviction: string | null =
      convictionScores.length > 0
        ? (convictionScores.reduce((a, b) => a + b, 0) / convictionScores.length).toFixed(1)
        : null;

    const factsUsed = agentMsgs.filter((m) => m.toolUsed && !m.toolUsed.failed).length;
    const configuredCount = Object.keys(agents).length;
    const enabledCount = Object.values(agents).filter((a) => a.enabled !== false).length;
    const respondedCount = new Set(agentMsgs.map((m) => m.agentId)).size;

    // Mood distribution
    const moodCounts: Record<string, number> = {};
    agentMsgs.forEach((m) => {
      if (m.mood) {
        moodCounts[m.mood] = (moodCounts[m.mood] || 0) + 1;
      }
    });

    return {
      totalMsgs,
      avgConviction,
      scoredCount: convictionScores.length,
      factsUsed,
      configuredCount,
      enabledCount,
      respondedCount,
      moodCounts,
    };
  }, [messages, agents]);

  const activeAgent = selectedAgentId
    ? agents[selectedAgentId]
    : hoveredAgentId
    ? agents[hoveredAgentId]
    : null;

  const activeAgentLastMsg = activeAgent
    ? [...messages].reverse().find((m) => m.agentId === activeAgent.id)
    : null;

  return (
    <div
      id="parallax-swarm-constellation"
      className="parallax-swarm-constellation-container"
      style={{
        borderRadius: '16px',
        background: 'linear-gradient(145deg, rgba(6, 18, 28, 0.95) 0%, rgba(3, 10, 16, 0.98) 100%)',
        border: '1.5px solid rgba(97, 215, 201, 0.35)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 0 40px rgba(6, 182, 212, 0.05)',
        overflow: 'hidden',
        position: 'relative',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Ambient background grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(rgba(97, 215, 201, 0.12) 1px, transparent 1px), radial-gradient(rgba(6, 182, 212, 0.08) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          backgroundPosition: '0 0, 12px 12px',
          pointerEvents: 'none',
          opacity: 0.7,
        }}
      />

      {/* Cyber HUD Header Bar */}
      <div
        id="parallax-constellation-hud-bar"
        className="parallax-constellation-header"
        style={{
          position: 'relative',
          zIndex: 10,
          padding: '12px 18px',
          borderBottom: '1px solid rgba(97, 215, 201, 0.2)',
          background: 'rgba(4, 14, 22, 0.85)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        {/* Left Title & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(6, 182, 212, 0.2)',
              border: '1px solid rgba(97, 215, 201, 0.5)',
              display: 'grid',
              placeItems: 'center',
              color: '#61d7c9',
              boxShadow: '0 0 12px rgba(6, 182, 212, 0.3)',
            }}
          >
            <Radar size={18} className={isRunning ? 'animate-spin' : ''} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="parallax-constellation-title" style={{ fontSize: '13px', fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.01em' }}>
                SWARM CONSTELLATION & TOPOLOGY
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: 'DM Mono, monospace',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: isRunning ? 'rgba(34, 197, 94, 0.2)' : 'rgba(6, 182, 212, 0.15)',
                  color: isRunning ? '#4ade80' : '#61d7c9',
                  border: `1px solid ${isRunning ? 'rgba(34, 197, 94, 0.4)' : 'rgba(6, 182, 212, 0.3)'}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {isRunning && <Radio size={10} className="animate-pulse" />}
                {isRunning
                  ? `DELIBERATING (${stats.respondedCount}/${stats.enabledCount} RESPONDED)`
                  : `${stats.enabledCount}/${stats.configuredCount} NODES ENABLED`}
              </span>
            </div>
            <span className="parallax-constellation-desc" style={{ fontSize: '11px', color: '#94a3b8' }}>
              {topic ? `Topic: "${topic.slice(0, 45)}${topic.length > 45 ? '...' : ''}" • ` : ''}
              {stats.respondedCount} Responded • {stats.enabledCount} Enabled {currentRound ? `• Round ${currentRound}/3` : ''}
            </span>
          </div>
        </div>

        {/* Right: View Mode Switcher + Minimize Toggle */}
        <div className="parallax-constellation-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Mode Tabs */}
          <div
            className="parallax-constellation-modes"
            style={{
              display: 'flex',
              background: 'rgba(15, 23, 42, 0.8)',
              borderRadius: '8px',
              padding: '2px',
              border: '1px solid rgba(97, 215, 201, 0.25)',
            }}
          >
            <button
              id="constellation-mode-orbit"
              type="button"
              onClick={() => setViewMode('orbit')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                background: viewMode === 'orbit' ? 'rgba(6, 182, 212, 0.3)' : 'transparent',
                border: 'none',
                color: viewMode === 'orbit' ? '#61d7c9' : '#94a3b8',
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: 'DM Mono, monospace',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Orbit Radar
            </button>
            <button
              id="constellation-mode-quadrant"
              type="button"
              onClick={() => setViewMode('quadrant')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                background: viewMode === 'quadrant' ? 'rgba(6, 182, 212, 0.3)' : 'transparent',
                border: 'none',
                color: viewMode === 'quadrant' ? '#61d7c9' : '#94a3b8',
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: 'DM Mono, monospace',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Ideology Matrix
            </button>
            <button
              id="constellation-mode-telemetry"
              type="button"
              onClick={() => setViewMode('telemetry')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                background: viewMode === 'telemetry' ? 'rgba(6, 182, 212, 0.3)' : 'transparent',
                border: 'none',
                color: viewMode === 'telemetry' ? '#61d7c9' : '#94a3b8',
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: 'DM Mono, monospace',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Telemetry HUD
            </button>
          </div>

          {/* Expand / Minimize Toggle */}
          <button
            id="parallax-constellation-collapse-btn"
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse Constellation' : 'Expand Constellation'}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(97, 215, 201, 0.25)',
              color: '#cbd5e1',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            className="hover:border-[#61d7c9] hover:text-white"
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span style={{ fontFamily: 'DM Mono, monospace' }}>
              {isExpanded ? 'Minimize' : 'Expand Radar'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Collapsible Graphic Stage */}
      {isExpanded && (
        <div
          id="parallax-constellation-stage"
          style={{
            position: 'relative',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* MODE 1: ORBIT RADAR */}
          {viewMode === 'orbit' && (
            <div
              style={{
                position: 'relative',
                width: '100%',
                minHeight: '340px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {/* Concentric Aerospace & Quantum Hologram Radar SVG */}
              <svg
                viewBox="0 0 700 360"
                className="parallax-radar-svg"
                style={{
                  width: '100%',
                  maxHeight: '360px',
                  display: 'block',
                }}
              >
                <defs>
                  <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.42" />
                    <stop offset="45%" stopColor="#06b6d4" stopOpacity="0.18" />
                    <stop offset="75%" stopColor="#a855f7" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="nodeInnerGrad" cx="35%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#0f293a" />
                    <stop offset="100%" stopColor="#040d14" />
                  </radialGradient>
                  <linearGradient id="sweepGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#61d7c9" stopOpacity="0.32" />
                    <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                  </linearGradient>
                  <filter id="radarNodeGlow" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Radar Grid Crosshairs & Diagonal Astrometric Vectors */}
                <line x1="36" y1="180" x2="664" y2="180" stroke="rgba(97, 215, 201, 0.14)" strokeWidth="1" strokeDasharray="3 5" />
                <line x1="350" y1="14" x2="350" y2="346" stroke="rgba(97, 215, 201, 0.14)" strokeWidth="1" strokeDasharray="3 5" />
                <line x1="140" y1="40" x2="560" y2="320" stroke="rgba(56, 189, 248, 0.08)" strokeWidth="0.8" strokeDasharray="2 6" />
                <line x1="140" y1="320" x2="560" y2="40" stroke="rgba(168, 85, 247, 0.08)" strokeWidth="0.8" strokeDasharray="2 6" />

                {/* Outer Astrometric Degree Tick Ring */}
                <ellipse
                  cx="350"
                  cy="180"
                  rx="192"
                  ry="163"
                  fill="none"
                  stroke="rgba(97, 215, 201, 0.14)"
                  strokeWidth="3"
                  strokeDasharray="1.5 7.5"
                />

                {/* Orbital Rings (Elliptical Perspective Projection) */}
                <ellipse cx="350" cy="180" rx="178" ry="151" fill="none" stroke="rgba(97, 215, 201, 0.12)" strokeWidth="0.9" />
                <ellipse cx="350" cy="180" rx="155" ry="132" fill="none" stroke="rgba(97, 215, 201, 0.22)" strokeWidth="1.2" strokeDasharray="6 4" />
                <ellipse cx="350" cy="180" rx="105" ry="89" fill="none" stroke="rgba(56, 189, 248, 0.26)" strokeWidth="1.1" />
                <ellipse cx="350" cy="180" rx="58" ry="49" fill="none" stroke="rgba(168, 85, 247, 0.28)" strokeWidth="1" strokeDasharray="3 3" />

                {/* Animated Radar Sweep Sector */}
                <g style={{ transformOrigin: '350px 180px' }} className="nexus-orbit-spin-slow">
                  <path
                    d="M 350 180 L 528 180 A 178 151 0 0 1 475 287 Z"
                    fill="url(#sweepGrad)"
                    opacity={isRunning ? 0.85 : 0.4}
                  />
                </g>

                {/* Deliberation Core Singularity Glow */}
                <circle cx="350" cy="180" r="64" fill="url(#coreGlow)" />
                <circle
                  cx="350"
                  cy="180"
                  r="31"
                  fill="none"
                  stroke="rgba(97, 215, 201, 0.45)"
                  strokeWidth="1.2"
                  strokeDasharray="8 4 2 4"
                  style={{ transformOrigin: '350px 180px' }}
                  className="nexus-orbit-spin-reverse"
                />
                <circle cx="350" cy="180" r="24" fill="#051520" stroke="#61d7c9" strokeWidth="1.8" filter="url(#radarNodeGlow)" />

                {/* Synaptic Bezier Filaments between responded/speaking agents and Core */}
                {Object.keys(agents).map((agentKey) => {
                  const q = AGENT_QUADRANTS[agentKey];
                  if (!q) return null;
                  const rad = (q.angle * Math.PI) / 180;
                  const orbitRadius = q.quadrant === 'anchors' ? 105 : 155;
                  const x = 350 + Math.cos(rad) * orbitRadius;
                  const y = 180 + Math.sin(rad) * orbitRadius * 0.85;

                  const isSpeaking = activeSpeakingAgentId === agentKey;
                  const isSelected = selectedAgentId === agentKey;
                  const hasReplied = messages.some((m) => m.agentId === agentKey);
                  const accent = agents[agentKey]?.accentColor || '#61d7c9';

                  // Control point for a graceful curved synaptic arc
                  const ctrlX = 350 + (x - 350) * 0.45 - (y - 180) * 0.18;
                  const ctrlY = 180 + (y - 180) * 0.45 + (x - 350) * 0.12;

                  return (
                    <g key={`beam-${agentKey}`}>
                      {hasReplied && !isSpeaking && !isSelected && (
                        <path
                          d={`M 350 180 Q ${ctrlX} ${ctrlY} ${x} ${y}`}
                          fill="none"
                          stroke={accent}
                          strokeWidth="0.9"
                          strokeOpacity="0.24"
                          strokeDasharray="3 3"
                        />
                      )}
                      {(isSpeaking || isSelected) && (
                        <>
                          <path
                            d={`M 350 180 Q ${ctrlX} ${ctrlY} ${x} ${y}`}
                            fill="none"
                            stroke={accent}
                            strokeWidth={isSpeaking ? '2.4' : '1.8'}
                            strokeOpacity={isSpeaking ? '0.92' : '0.75'}
                            filter="url(#radarNodeGlow)"
                          />
                          <circle cx={(350 + x) / 2} cy={(180 + y) / 2} r="2.5" fill="#ffffff" />
                        </>
                      )}
                    </g>
                  );
                })}

                {/* Central Core Label */}
                <text x="350" y="177" textAnchor="middle" fill="#61d7c9" fontSize="9.5" fontFamily="DM Mono, monospace" fontWeight="bold" letterSpacing="0.08em">
                  SWARM
                </text>
                <text x="350" y="189" textAnchor="middle" fill="#e2e8f0" fontSize="8.5" fontFamily="DM Mono, monospace" letterSpacing="0.06em">
                  CORE
                </text>

                {/* Render the 20 Agent Nodes */}
                {Object.keys(agents).map((agentKey) => {
                  const agent = agents[agentKey];
                  const q = AGENT_QUADRANTS[agentKey];
                  if (!q || !agent) return null;

                  const rad = (q.angle * Math.PI) / 180;
                  const orbitRadius = q.quadrant === 'anchors' ? 105 : 155;
                  const x = 350 + Math.cos(rad) * orbitRadius;
                  const y = 180 + Math.sin(rad) * orbitRadius * 0.85;

                  const isSpeaking = activeSpeakingAgentId === agentKey;
                  const isSelected = selectedAgentId === agentKey;
                  const isHovered = hoveredAgentId === agentKey;
                  const accentColor = agent.accentColor || '#61d7c9';

                  const agentMsgs = messages.filter((m) => m.agentId === agentKey);
                  const replyCount = agentMsgs.length;
                  const lastMsg = agentMsgs[agentMsgs.length - 1];

                  return (
                    <g
                      key={agentKey}
                      onClick={() => onSelectAgent?.(selectedAgentId === agentKey ? null : agentKey)}
                      onMouseEnter={() => setHoveredAgentId(agentKey)}
                      onMouseLeave={() => setHoveredAgentId(null)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Outer orbital halo for active / hovered / speaking nodes */}
                      {(isSpeaking || isSelected || isHovered || replyCount > 0) && (
                        <circle
                          cx={x}
                          cy={y}
                          r={isSpeaking ? '21' : isSelected || isHovered ? '19' : '16.5'}
                          fill="none"
                          stroke={accentColor}
                          strokeWidth={isSpeaking ? '1.6' : '1'}
                          strokeDasharray={isSpeaking ? 'none' : '4 3'}
                          opacity={isSpeaking ? '0.85' : isSelected || isHovered ? '0.65' : '0.35'}
                        />
                      )}

                      {/* Node circle background */}
                      <circle
                        cx={x}
                        cy={y}
                        r={isSelected ? '15.5' : isHovered ? '14.5' : '13'}
                        fill="url(#nodeInnerGrad)"
                        stroke={accentColor}
                        strokeWidth={isSelected ? '2.5' : isSpeaking ? '2.2' : '1.5'}
                        style={{
                          filter: isSpeaking || isSelected || isHovered ? `drop-shadow(0 0 8px ${accentColor})` : 'none',
                          transition: 'all 0.2s ease',
                        }}
                      />

                      {/* Initials */}
                      <text
                        x={x}
                        y={y + 3.5}
                        textAnchor="middle"
                        fill={accentColor}
                        fontSize={isSelected || isHovered ? '9.5' : '8.5'}
                        fontFamily="DM Mono, monospace"
                        fontWeight="bold"
                      >
                        {agent.initials || agent.name.slice(0, 2)}
                      </text>

                      {/* Agent Name label */}
                      <text
                        x={x}
                        y={y > 180 ? y + 22 : y - 17}
                        textAnchor="middle"
                        fill={isSelected || isHovered ? '#ffffff' : '#cbd5e1'}
                        fontSize="9"
                        fontFamily="DM Mono, monospace"
                        fontWeight={isSelected || isHovered ? 'bold' : 'normal'}
                      >
                        {agent.name.split(' (')[0]}
                      </text>

                      {/* Conviction / Reply indicator pip */}
                      {lastMsg?.mood ? (
                        <text
                          x={x + 12}
                          y={y - 8}
                          fontSize="10"
                          textAnchor="middle"
                        >
                          {lastMsg.mood}
                        </text>
                      ) : replyCount > 0 ? (
                        <circle
                          cx={x + 11}
                          cy={y - 9}
                          r="3.2"
                          fill="#10b981"
                          stroke="#041016"
                          strokeWidth="1"
                        />
                      ) : null}
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {/* MODE 2: IDEOLOGICAL 4-QUADRANT MATRIX */}
          {viewMode === 'quadrant' && (
            <div
              id="constellation-quadrant-view"
              style={{
                position: 'relative',
                borderRadius: '12px',
                background: 'rgba(4, 12, 20, 0.8)',
                border: '1px solid rgba(97, 215, 201, 0.2)',
                padding: '16px',
                minHeight: '340px',
              }}
            >
              {/* Quadrant Axis Labels */}
              <div
                className="parallax-quadrant-axis-label"
                style={{
                  position: 'absolute',
                  top: '8px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '10px',
                  fontFamily: 'DM Mono, monospace',
                  color: '#61d7c9',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                }}
              >
                ▲ SYSTEMIC ACCELERATION & OPTIMISM
              </div>
              <div
                className="parallax-quadrant-axis-label"
                style={{
                  position: 'absolute',
                  bottom: '8px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '10px',
                  fontFamily: 'DM Mono, monospace',
                  color: '#61d7c9',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                }}
              >
                ▼ HUMAN ETHICS & ONTOLOGY
              </div>
              <div
                className="parallax-quadrant-axis-label"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '10px',
                  fontFamily: 'DM Mono, monospace',
                  color: '#94a3b8',
                  fontWeight: 700,
                  writingMode: 'vertical-rl',
                }}
              >
                ◄ CRITICAL REALISM & RISK
              </div>
              <div
                className="parallax-quadrant-axis-label"
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '10px',
                  fontFamily: 'DM Mono, monospace',
                  color: '#94a3b8',
                  fontWeight: 700,
                  writingMode: 'vertical-rl',
                }}
              >
                CULTURE & SYMBOLISM ►
              </div>

              {/* 4 Quadrants Visual Grid */}
              <div
                className="parallax-quadrant-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gridTemplateRows: '1fr 1fr',
                  gap: '12px',
                  minHeight: '300px',
                  padding: '24px 28px',
                }}
              >
                {/* Quadrant 1: Critical Realists */}
                <div
                  className="parallax-quadrant-box"
                  style={{
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.04)',
                    border: '1px dashed rgba(239, 68, 68, 0.25)',
                    padding: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div className="parallax-quadrant-title" style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', fontWeight: 800, color: '#f87171' }}>
                    CRITICAL REALISM & RISK
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {['gravity', 'ledger', 'sentinel', 'vanguard'].map((id) => (
                      <AgentChip
                        key={id}
                        agent={agents[id]}
                        isSelected={selectedAgentId === id}
                        onSelect={() => onSelectAgent?.(selectedAgentId === id ? null : id)}
                        messages={messages}
                      />
                    ))}
                  </div>
                </div>

                {/* Quadrant 2: Techno-Optimism */}
                <div
                  className="parallax-quadrant-box"
                  style={{
                    borderRadius: '8px',
                    background: 'rgba(6, 182, 212, 0.04)',
                    border: '1px dashed rgba(6, 182, 212, 0.25)',
                    padding: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div className="parallax-quadrant-title" style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', fontWeight: 800, color: '#38bdf8' }}>
                    TECHNO-OPTIMISM & DEDUCTION
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {['aurora', 'axiom', 'cipher', 'catalyst'].map((id) => (
                      <AgentChip
                        key={id}
                        agent={agents[id]}
                        isSelected={selectedAgentId === id}
                        onSelect={() => onSelectAgent?.(selectedAgentId === id ? null : id)}
                        messages={messages}
                      />
                    ))}
                  </div>
                </div>

                {/* Quadrant 3: Ethics & Philosophy */}
                <div
                  className="parallax-quadrant-box"
                  style={{
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.04)',
                    border: '1px dashed rgba(16, 185, 129, 0.25)',
                    padding: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div className="parallax-quadrant-title" style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', fontWeight: 800, color: '#4ade80' }}>
                    ETHICS, DIGNITY & ONTOLOGY
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {['socrates', 'harmony', 'lumen', 'echo'].map((id) => (
                      <AgentChip
                        key={id}
                        agent={agents[id]}
                        isSelected={selectedAgentId === id}
                        onSelect={() => onSelectAgent?.(selectedAgentId === id ? null : id)}
                        messages={messages}
                      />
                    ))}
                  </div>
                </div>

                {/* Quadrant 4: Vision & Aesthetics */}
                <div
                  className="parallax-quadrant-box"
                  style={{
                    borderRadius: '8px',
                    background: 'rgba(236, 72, 153, 0.04)',
                    border: '1px dashed rgba(236, 72, 153, 0.25)',
                    padding: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div className="parallax-quadrant-title" style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', fontWeight: 800, color: '#f472b6' }}>
                    AESTHETICS, VISION & EMOTION
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {['pixel', 'nomad', 'oracle', 'ember'].map((id) => (
                      <AgentChip
                        key={id}
                        agent={agents[id]}
                        isSelected={selectedAgentId === id}
                        onSelect={() => onSelectAgent?.(selectedAgentId === id ? null : id)}
                        messages={messages}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Anchors Bar at Center Bottom */}
              <div
                style={{
                  marginTop: '10px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid rgba(97, 215, 201, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', fontWeight: 700, color: '#61d7c9' }}>
                  CORE SYNTHESIZERS & EMPIRICAL ANCHORS:
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['veritas', 'nexus9', 'chronos', 'mosaic'].map((id) => (
                    <AgentChip
                      key={id}
                      agent={agents[id]}
                      isSelected={selectedAgentId === id}
                      onSelect={() => onSelectAgent?.(selectedAgentId === id ? null : id)}
                      messages={messages}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MODE 3: TELEMETRY HUD */}
          {viewMode === 'telemetry' && (
            <div
              id="constellation-telemetry-view"
              className="parallax-telemetry-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px',
              }}
            >
              {/* Average Conviction Meter */}
              <div
                className="parallax-telemetry-card"
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background: 'rgba(8, 22, 34, 0.7)',
                  border: '1px solid rgba(97, 215, 201, 0.25)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Flame size={14} color="#f59e0b" />
                  <span style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#61d7c9', fontWeight: 700 }}>
                    AVERAGE CONVICTION
                  </span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#fff', fontFamily: 'DM Mono, monospace' }}>
                  {stats.avgConviction !== null ? (
                    <>
                      {stats.avgConviction} <span style={{ fontSize: '14px', color: '#94a3b8' }}>/ 10</span>
                    </>
                  ) : (
                    <span style={{ fontSize: '18px', color: '#94a3b8' }}>— (Awaiting turns)</span>
                  )}
                </div>
                <div style={{ marginTop: '6px', height: '4px', borderRadius: '2px', background: 'rgba(15, 23, 42, 0.8)' }}>
                  <div
                    style={{
                      width: `${stats.avgConviction !== null ? (parseFloat(stats.avgConviction) / 10) * 100 : 0}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
                    }}
                  />
                </div>
              </div>

              {/* Tool Grounding Count */}
              <div
                className="parallax-telemetry-card"
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background: 'rgba(8, 22, 34, 0.7)',
                  border: '1px solid rgba(97, 215, 201, 0.25)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Sparkles size={14} color="#38bdf8" />
                  <span style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#61d7c9', fontWeight: 700 }}>
                    GROUNDED TURNS
                  </span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#fff', fontFamily: 'DM Mono, monospace' }}>
                  {stats.factsUsed} <span style={{ fontSize: '12px', color: '#94a3b8' }}>Verified Search Turns</span>
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                  VERITAS live grounding in Round 1
                </div>
              </div>

              {/* Swarm Dialectic Velocity */}
              <div
                className="parallax-telemetry-card"
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background: 'rgba(8, 22, 34, 0.7)',
                  border: '1px solid rgba(97, 215, 201, 0.25)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Radio size={14} color="#34d399" />
                  <span style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#61d7c9', fontWeight: 700 }}>
                    SWARM VELOCITY
                  </span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#fff', fontFamily: 'DM Mono, monospace' }}>
                  {stats.totalMsgs} <span style={{ fontSize: '12px', color: '#94a3b8' }}>agent turns logged</span>
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                  {stats.respondedCount} Responded · {stats.enabledCount}/{stats.configuredCount} Enabled
                </div>
              </div>
            </div>
          )}

          {/* Interactive Agent Dossier Preview (Appears when an agent is hovered or clicked) */}
          {activeAgent && (
            <div
              id={`constellation-agent-dossier-${activeAgent.id}`}
              style={{
                borderRadius: '12px',
                padding: '12px 16px',
                background: 'rgba(4, 14, 22, 0.95)',
                border: `1.5px solid ${activeAgent.accentColor || '#61d7c9'}`,
                boxShadow: `0 0 20px ${activeAgent.accentColor}33`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                animation: 'fadeIn 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <ParallaxAgentAvatar
                  agentId={activeAgent.id}
                  agentName={activeAgent.name}
                  accentColor={activeAgent.accentColor}
                  size="md"
                />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: activeAgent.accentColor, fontFamily: 'DM Mono, monospace' }}>
                      {activeAgent.name}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: 'rgba(15, 23, 42, 0.8)',
                        color: '#cbd5e1',
                        border: '1px solid rgba(165, 207, 214, 0.2)',
                      }}
                    >
                      {activeAgent.role}
                    </span>
                    {activeAgentLastMsg?.conviction !== undefined && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontFamily: 'DM Mono, monospace',
                          color: '#facc15',
                          fontWeight: 700,
                        }}
                      >
                        Conviction: {activeAgentLastMsg.conviction}/10 {activeAgentLastMsg.mood || ''}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px', maxWidth: '600px' }}>
                    &ldquo;{activeAgent.systemInstruction}&rdquo;
                  </div>
                </div>
              </div>

              {/* Action: Filter in Deliberation Feed */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => onSelectAgent?.(selectedAgentId === activeAgent.id ? null : activeAgent.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    background: selectedAgentId === activeAgent.id
                      ? 'rgba(6, 182, 212, 0.3)'
                      : 'rgba(15, 23, 42, 0.85)',
                    border: `1px solid ${selectedAgentId === activeAgent.id ? '#61d7c9' : 'rgba(97, 215, 201, 0.3)'}`,
                    color: selectedAgentId === activeAgent.id ? '#61d7c9' : '#cbd5e1',
                    fontSize: '11px',
                    fontWeight: 700,
                    fontFamily: 'DM Mono, monospace',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  className="hover:border-[#61d7c9] hover:text-white"
                >
                  <Filter size={12} />
                  <span>
                    {selectedAgentId === activeAgent.id
                      ? 'Clear Filter'
                      : `Filter ${activeAgent.name} in Feed`}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Sub-component: Small Agent Chip for the Quadrant View
const AgentChip: React.FC<{
  agent?: ParallaxAgentConfig;
  isSelected: boolean;
  onSelect: () => void;
  messages: ParallaxMessage[];
}> = ({ agent, isSelected, onSelect, messages }) => {
  if (!agent) return null;
  const accentColor = agent.accentColor || '#61d7c9';
  const Icon = getParallaxAgentIcon(agent.id);
  const count = messages.filter((m) => m.agentId === agent.id).length;

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 8px',
        borderRadius: '6px',
        background: isSelected ? `${accentColor}33` : 'rgba(15, 23, 42, 0.7)',
        border: `1px solid ${isSelected ? accentColor : `${accentColor}55`}`,
        color: isSelected ? '#fff' : '#cbd5e1',
        fontSize: '11px',
        fontWeight: 600,
        fontFamily: 'DM Mono, monospace',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      className="hover:border-[#61d7c9] active:scale-95"
    >
      <Icon size={12} color={accentColor} />
      <span>{agent.name}</span>
      {count > 0 && (
        <span
          style={{
            fontSize: '9px',
            padding: '0 4px',
            borderRadius: '999px',
            background: `${accentColor}25`,
            color: accentColor,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
};
