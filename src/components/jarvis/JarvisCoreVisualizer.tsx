import { useState, useEffect } from 'react';
import {
  Activity,
  Radio,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { JarvisSystemConfig } from '@/types';

interface JarvisCoreVisualizerProps {
  config: JarvisSystemConfig;
  isRunning: boolean;
  onLaunchPrompt?: (prompt: string) => void;
}

export function JarvisCoreVisualizer({
  config,
  isRunning,
  onLaunchPrompt,
}: JarvisCoreVisualizerProps) {
  const [pulsePhase, setPulsePhase] = useState(0);
  const [audioHeights, setAudioHeights] = useState<number[]>([40, 65, 80, 50, 90, 70, 45, 85, 60, 95, 55, 75, 40, 80, 60]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulsePhase((prev) => (prev + 1) % 100);
      if (isRunning) {
        setAudioHeights(
          Array.from({ length: 15 }, () => Math.floor(25 + Math.random() * 75)),
        );
      } else {
        setAudioHeights(
          Array.from({ length: 15 }, (_, i) => Math.floor(20 + Math.sin((pulsePhase + i * 5) * 0.1) * 20 + 20)),
        );
      }
    }, 120);
    return () => clearInterval(interval);
  }, [isRunning, pulsePhase]);

  const activeAgents = config?.agents
    ? Object.values(config.agents).filter((a) => a?.enabled)
    : [];

  return (
    <div
      className="jarvis-hud-card jarvis-corner-brackets"
      style={{
        padding: '24px',
        marginBottom: '20px',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', alignItems: 'center' }}>
        {/* Left: Holographic ARC Reactor SVG */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <div
            style={{
              position: 'relative',
              width: '260px',
              height: '260px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Ambient Background Aura */}
            <div
              style={{
                position: 'absolute',
                inset: '10px',
                borderRadius: '50%',
                background: isRunning
                  ? 'radial-gradient(circle, rgba(56,189,248,0.3) 0%, rgba(97,215,201,0.2) 40%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(97,215,201,0.2) 0%, rgba(56,189,248,0.1) 45%, transparent 70%)',
                filter: 'blur(20px)',
                transition: 'all 0.5s ease',
              }}
            />

            {/* Radar Sweep Layer */}
            <div className="jarvis-radar-line" />

            <svg
              viewBox="0 0 260 260"
              style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                zIndex: 2,
                overflow: 'visible',
              }}
            >
              <defs>
                <linearGradient id="jarvisTealSky" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#61d7c9" />
                  <stop offset="50%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
                <filter id="coreGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Outer Dashed Tech Ring (Clockwise) */}
              <circle
                cx="130"
                cy="130"
                r="120"
                fill="none"
                stroke="rgba(165,207,214,0.2)"
                strokeWidth="1.5"
                strokeDasharray="4 8"
                className="jarvis-reactor-spin-cw"
              />

              {/* Outer Segmented Arc Ring (Counter-Clockwise) */}
              <circle
                cx="130"
                cy="130"
                r="108"
                fill="none"
                stroke="url(#jarvisTealSky)"
                strokeWidth="2.5"
                strokeDasharray="24 16 8 16"
                className="jarvis-reactor-spin-ccw"
                opacity="0.85"
              />

              {/* Middle Degree Markers Ring */}
              <circle
                cx="130"
                cy="130"
                r="92"
                fill="none"
                stroke="rgba(97,215,201,0.3)"
                strokeWidth="1"
                strokeDasharray="2 10"
                className="jarvis-reactor-spin-fast"
              />

              {/* Inner Hexagonal Shield Ring */}
              <polygon
                points="130,55 195,92 195,168 130,205 65,168 65,92"
                fill="none"
                stroke="rgba(56,189,248,0.5)"
                strokeWidth="1.5"
                strokeDasharray="8 6"
                className="jarvis-reactor-spin-cw"
              />

              {/* Orbiting Quantum Data Nodes */}
              <g className="jarvis-reactor-spin-ccw">
                <circle cx="130" cy="22" r="4" fill="#61d7c9" filter="url(#coreGlow)" />
                <circle cx="238" cy="130" r="4" fill="#38bdf8" filter="url(#coreGlow)" />
                <circle cx="130" cy="238" r="4" fill="#a855f7" filter="url(#coreGlow)" />
                <circle cx="22" cy="130" r="4" fill="#61d7c9" filter="url(#coreGlow)" />
              </g>

              {/* Central Core Sphere */}
              <circle
                cx="130"
                cy="130"
                r="42"
                fill="rgba(6,20,30,0.85)"
                stroke="rgba(97,215,201,0.7)"
                strokeWidth="2"
                className="jarvis-core-pulse"
              />

              <circle
                cx="130"
                cy="130"
                r="26"
                fill="url(#jarvisTealSky)"
                filter="url(#coreGlow)"
                className="jarvis-core-pulse"
                opacity={isRunning ? '0.95' : '0.75'}
              />

              {/* Inner Core Symbol */}
              <text
                x="130"
                y="135"
                textAnchor="middle"
                fill="#05151f"
                fontSize="14"
                fontFamily="DM Mono, monospace"
                fontWeight="900"
                letterSpacing="1"
              >
                J·5
              </text>
            </svg>
          </div>

          {/* Equalizer Audio / Frequency Visualizer */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '28px', marginTop: '14px' }}>
            {audioHeights.map((h, i) => (
              <div
                key={i}
                className="jarvis-audio-bar-col"
                style={{
                  height: `${h}%`,
                  transition: 'height 0.1s ease',
                  background: isRunning
                    ? 'linear-gradient(180deg, #38bdf8 0%, #61d7c9 100%)'
                    : 'linear-gradient(180deg, rgba(97,215,201,0.5) 0%, rgba(56,189,248,0.3) 100%)',
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: '10px', fontFamily: 'DM Mono', color: 'var(--accent)', marginTop: '4px' }}>
            {isRunning ? 'QUANTUM FLUX: 98.4% (ACTIVE)' : 'QUANTUM FLUX: IDLE HARMONIC'}
          </div>
        </div>

        {/* Right: Telemetry & Autonomous Capabilities */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '18px' }}>⚡</span>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                Autonomous Neural Core
              </h3>
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'DM Mono',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'rgba(97,215,201,0.15)',
                  color: 'var(--accent)',
                  border: '1px solid rgba(97,215,201,0.3)',
                  fontWeight: 600,
                }}
              >
                SYNCED
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)', lineHeight: '1.6' }}>
              Dynamic orchestration combining real-time search synthesis, automated fact audits, and multi-model consensus verification.
            </p>
          </div>

          {/* 4 Telemetry Spec Blocks */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(6,16,24,0.6)',
                border: '1px solid rgba(165,207,214,0.14)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--muted)' }}>
                <Activity size={12} className="text-accent" />
                <span>ACTIVE PIPELINE</span>
              </div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff', marginTop: '2px' }}>
                {activeAgents.length} / 5 AGENTS
              </div>
            </div>

            <div
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(6,16,24,0.6)',
                border: '1px solid rgba(165,207,214,0.14)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--muted)' }}>
                <Radio size={12} style={{ color: '#38bdf8' }} />
                <span>DEEP RESEARCH</span>
              </div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>
                {config.deepResearchDefault ? 'ALWAYS ON' : 'ADAPTIVE'}
              </div>
            </div>

            <div
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(6,16,24,0.6)',
                border: '1px solid rgba(165,207,214,0.14)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--muted)' }}>
                <Cpu size={12} className="text-accent" />
                <span>FAILOVER LOGIC</span>
              </div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff', marginTop: '2px' }}>
                ZERO-FAIL MESH
              </div>
            </div>

            <div
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(6,16,24,0.6)',
                border: '1px solid rgba(165,207,214,0.14)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--muted)' }}>
                <Layers size={12} style={{ color: '#a855f7' }} />
                <span>MAX TOKEN FLUX</span>
              </div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff', marginTop: '2px' }}>
                ~2,250 TOKENS
              </div>
            </div>
          </div>

          {/* Fast Quick Launch Action */}
          {onLaunchPrompt && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <button
                type="button"
                onClick={() => onLaunchPrompt('Synthesize recent breakthroughs in quantum computing and error mitigation.')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, rgba(97,215,201,0.2) 0%, rgba(56,189,248,0.25) 100%)',
                  border: '1px solid rgba(97,215,201,0.4)',
                  color: 'var(--accent)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                }}
              >
                <Sparkles size={13} />
                <span>Launch Quantum Reasoning Protocol</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
