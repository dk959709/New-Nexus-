import React, { useMemo } from 'react';

export interface JarvisCoreAgent {
  id: string;
  name: string;
  enabled: boolean;
}

interface Jarvis3DCoreProps {
  agents: JarvisCoreAgent[];
  isRunning?: boolean;
  compact?: boolean;
  onToggleCompact?: () => void;
}

const ABBREVIATIONS: Record<string, string> = {
  planner: 'PL',
  researcher: 'RE',
  factChecker: 'FC',
  advisor: 'AD',
  reviewer: 'RV',
  finalSynthesizer: 'SY',
  architect: 'AR',
  dataAnalyst: 'DA',
  imageFinder: 'IM',
  coder: 'CD',
};

const FALLBACK_AGENTS: JarvisCoreAgent[] = [
  { id: 'planner', name: 'Planner', enabled: true },
  { id: 'researcher', name: 'Researcher', enabled: true },
  { id: 'factChecker', name: 'Fact Checker', enabled: true },
  { id: 'advisor', name: 'Advisor', enabled: true },
  { id: 'reviewer', name: 'Reviewer', enabled: true },
  { id: 'finalSynthesizer', name: 'Synthesizer', enabled: true },
  { id: 'architect', name: 'Architect', enabled: true },
  { id: 'dataAnalyst', name: 'Data Analyst', enabled: true },
  { id: 'imageFinder', name: 'Image Finder', enabled: true },
  { id: 'coder', name: 'Coder', enabled: true },
];

const OUTER_COUNT = 6;

/**
 * 3D holographic "cognitive mesh" core: a wireframe nucleus with two orbital
 * rings and the agent constellation connected by pulsing laser beams.
 * Pure SVG/CSS so it stays light and works on mobile.
 */
export function Jarvis3DCore({
  agents,
  isRunning = false,
  compact = false,
  onToggleCompact,
}: Jarvis3DCoreProps) {
  const roster = agents.length > 0 ? agents : FALLBACK_AGENTS;

  const layout = useMemo(() => {
    const cx = 450;
    const cy = 150;
    const outer = roster.slice(0, OUTER_COUNT);
    const inner = roster.slice(OUTER_COUNT, OUTER_COUNT + 4);

    const outerNodes = outer.map((agent, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(1, outer.length) - Math.PI / 2;
      return {
        agent,
        x: cx + Math.cos(angle) * 312,
        y: cy + Math.sin(angle) * 82,
      };
    });

    const innerNodes = inner.map((agent, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(1, inner.length) - Math.PI / 2 + Math.PI / 4;
      return {
        agent,
        x: cx + Math.cos(angle) * 186,
        y: cy + Math.sin(angle) * 48,
      };
    });

    return { cx, cy, outerNodes, innerNodes };
  }, [roster]);

  const enabledCount = roster.filter((agent) => agent.enabled).length;

  return (
    <section
      className={`j3d-core-panel ${compact ? 'is-compact' : ''}`}
      aria-label="JARVIS 3D cognitive mesh"
    >
      <div className="j3d-core-header">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`j3d-live-dot ${isRunning ? 'is-running' : ''}`} />
          <span className="j3d-core-title">Cognitive Mesh</span>
          <span className="j3d-core-meta font-mono">
            {enabledCount}/{roster.length} online
          </span>
        </div>
        {onToggleCompact && (
          <button
            type="button"
            onClick={onToggleCompact}
            className="j3d-core-toggle font-mono"
            aria-label={compact ? 'Expand cognitive mesh' : 'Collapse cognitive mesh'}
          >
            {compact ? 'EXPAND' : 'COLLAPSE'}
          </button>
        )}
      </div>

      {!compact && (
        <div className="j3d-core-stage">
          <div className="j3d-core-floor" aria-hidden="true" />
          <div className="j3d-core-horizon" aria-hidden="true" />

          <svg
            className="j3d-core-svg"
            viewBox="0 0 900 300"
            role="img"
            aria-label={`${enabledCount} agents linked to the JARVIS core`}
          >
            <defs>
              <radialGradient id="j3dNucleus" cx="50%" cy="42%" r="60%">
                <stop offset="0%" stopColor="#eafeff" />
                <stop offset="38%" stopColor="#49effd" />
                <stop offset="72%" stopColor="#0e7490" />
                <stop offset="100%" stopColor="#04141a" />
              </radialGradient>
              <radialGradient id="j3dHalo" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(73,239,253,0.42)" />
                <stop offset="55%" stopColor="rgba(168,85,247,0.18)" />
                <stop offset="100%" stopColor="rgba(6,8,14,0)" />
              </radialGradient>
              <linearGradient id="j3dBeam" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.05" />
                <stop offset="55%" stopColor="#49effd" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.9" />
              </linearGradient>
            </defs>

            {/* ambient halo */}
            <ellipse cx={layout.cx} cy={layout.cy} rx="430" ry="150" fill="url(#j3dHalo)" />

            {/* orbital rings */}
            <g className="j3d-ring j3d-ring-a">
              <ellipse
                cx={layout.cx}
                cy={layout.cy}
                rx="312"
                ry="82"
                fill="none"
                stroke="rgba(73,239,253,0.28)"
                strokeWidth="1.2"
                strokeDasharray="6 7"
              />
            </g>
            <g className="j3d-ring j3d-ring-b">
              <ellipse
                cx={layout.cx}
                cy={layout.cy}
                rx="186"
                ry="48"
                fill="none"
                stroke="rgba(168,85,247,0.3)"
                strokeWidth="1"
                strokeDasharray="4 6"
              />
            </g>
            <g className="j3d-ring j3d-ring-c">
              <ellipse
                cx={layout.cx}
                cy={layout.cy}
                rx="240"
                ry="120"
                fill="none"
                stroke="rgba(73,239,253,0.14)"
                strokeWidth="1"
              />
            </g>

            {/* beams from core to every agent */}
            {[...layout.outerNodes, ...layout.innerNodes].map(({ agent, x, y }) => (
              <line
                key={`beam-${agent.id}`}
                x1={layout.cx}
                y1={layout.cy}
                x2={x}
                y2={y}
                stroke={agent.enabled ? 'url(#j3dBeam)' : 'rgba(132,148,149,0.25)'}
                strokeWidth={agent.enabled ? 1.3 : 1}
                strokeDasharray="5 5"
                className={agent.enabled ? 'j3d-beam' : undefined}
              />
            ))}

            {/* nucleus */}
            <circle cx={layout.cx} cy={layout.cy} r="46" fill="url(#j3dNucleus)" opacity="0.95" />
            <circle
              cx={layout.cx}
              cy={layout.cy}
              r="46"
              fill="none"
              stroke="rgba(125,244,255,0.65)"
              strokeWidth="1.2"
            />
            <g className="j3d-nucleus-wire">
              {/* wireframe sphere: latitudes */}
              <ellipse cx={layout.cx} cy={layout.cy} rx="46" ry="46" fill="none" stroke="rgba(73,239,253,0.18)" strokeWidth="1" />
              <ellipse cx={layout.cx} cy={layout.cy} rx="46" ry="32" fill="none" stroke="rgba(73,239,253,0.35)" strokeWidth="1" />
              <ellipse cx={layout.cx} cy={layout.cy} rx="46" ry="16" fill="none" stroke="rgba(0,240,255,0.5)" strokeWidth="1" />
              {/* longitudes */}
              <ellipse cx={layout.cx} cy={layout.cy} rx="16" ry="46" fill="none" stroke="rgba(168,85,247,0.4)" strokeWidth="1" />
              <ellipse cx={layout.cx} cy={layout.cy} rx="32" ry="46" fill="none" stroke="rgba(168,85,247,0.26)" strokeWidth="1" />
            </g>
            <circle className="j3d-nucleus-pulse" cx={layout.cx} cy={layout.cy} r="52" fill="none" stroke="rgba(73,239,253,0.45)" strokeWidth="1" />

            {/* agent nodes */}
            {[...layout.outerNodes, ...layout.innerNodes].map(({ agent, x, y }) => {
              const abbr = ABBREVIATIONS[agent.id] || agent.name.slice(0, 2).toUpperCase();
              return (
                <g
                  key={agent.id}
                  className={`j3d-node ${agent.enabled ? 'is-online' : 'is-offline'}`}
                  transform={`translate(${x} ${y})`}
                >
                  <title>{`${agent.name}${agent.enabled ? '' : ' (disabled)'}`}</title>
                  <circle r="17" className="j3d-node-halo" />
                  <circle r="13" className="j3d-node-disc" />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="j3d-node-label"
                  >
                    {abbr}
                  </text>
                  <text y="30" textAnchor="middle" className="j3d-node-name">
                    {agent.name}
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="j3d-dust" aria-hidden="true">
            <span className="j3d-dust-1" />
            <span className="j3d-dust-2" />
            <span className="j3d-dust-3" />
            <span className="j3d-dust-4" />
          </div>
        </div>
      )}
    </section>
  );
}

export default Jarvis3DCore;
