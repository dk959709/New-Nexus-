import React, { useId, memo } from 'react';
import { Sparkles } from 'lucide-react';

interface JarvisQuantumOrbProps {
  status?: 'idle' | 'listening' | 'thinking' | 'synthesizing' | 'complete';
  isListening?: boolean;
  isRunning?: boolean;
  query?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showBadge?: boolean;
  onClick?: () => void;
  className?: string;
}

const STATIC_AUDIO_BARS = [45, 75, 90, 60, 95, 80, 50, 85, 65, 100, 70, 88, 58, 82];

const SPECTRUM_COLORS = [
  '#00f5ff',
  '#38bdf8',
  '#a855f7',
  '#ec4899',
  '#fbbf24',
  '#10b981',
  '#ff007f',
];

function JarvisQuantumOrbComponent({
  status = 'idle',
  isListening = false,
  isRunning = false,
  query = '',
  size = 'md',
  showBadge = true,
  onClick,
  className = '',
}: JarvisQuantumOrbProps) {
  const uid = useId().replace(/:/g, '');
  const hasQuery = Boolean(query);

  // Dimensions
  const dim = size === 'xs' ? 36 : size === 'sm' ? 120 : size === 'lg' ? 240 : 175;
  const radius = dim / 2;
  const isMini = size === 'xs';

  // Dynamic rotation cycle duration in seconds (pure GPU CSS animation, 0 React re-renders)
  const spinDurationSec =
    isRunning || status === 'synthesizing' || status === 'thinking'
      ? 2.2
      : isListening || status === 'listening'
      ? 3.0
      : hasQuery
      ? 4.5
      : 8.5;

  const pulseDurationSec =
    isRunning || status === 'synthesizing'
      ? 1.2
      : isListening
      ? 1.5
      : 2.8;

  // Derive active status label
  const activeStatus = isRunning
    ? 'NEURAL SYNTHESIS'
    : isListening
    ? 'VOICE LISTENING'
    : status === 'complete'
    ? 'SYNTHESIS COMPLETE'
    : hasQuery
    ? 'QUERY READY'
    : 'ONLINE STANDBY';

  // Unique IDs for SVG filters and gradients to prevent DOM collisions
  const coreGradId = `jarvisCyberCoreGrad_${uid}`;
  const coreShellGradId = `jarvisCyberShellGrad_${uid}`;
  const plasmaHighlightGradId = `jarvisPlasmaHighlight_${uid}`;
  const ring1GradId = `jarvisRingGradElectricCyanViolet_${uid}`;
  const ring2GradId = `jarvisRingGradEmeraldGold_${uid}`;
  const ring3GradId = `jarvisRingGradMagentaLaser_${uid}`;
  const ring4GradId = `jarvisRingGradAquaRose_${uid}`;
  const glowFilterId = `jarvisCyberGlowFilter_${uid}`;
  const intenseGlowFilterId = `jarvisIntenseBloomFilter_${uid}`;

  return (
    <div
      onClick={onClick}
      className={`jarvis-quantum-orb-container relative flex flex-col items-center justify-center select-none group cursor-pointer transition-all duration-300 ${className}`}
      style={{ minHeight: isMini ? `${dim}px` : `${dim + 44}px` }}
      title="JARVIS Quantum Neural Core - Online Cyberpunk Hologram"
    >
      {/* Multi-Layer Cinematic Cyberpunk Atmosphere Aura */}
      <div
        className="absolute rounded-full pointer-events-none transition-opacity duration-500 jarvis-core-pulse"
        style={{
          width: `${dim * (isMini ? 1.35 : 1.65)}px`,
          height: `${dim * (isMini ? 1.35 : 1.65)}px`,
          background: isRunning
            ? 'radial-gradient(circle, rgba(0,245,255,0.42) 0%, rgba(168,85,247,0.34) 35%, rgba(244,63,94,0.26) 58%, transparent 76%)'
            : isListening
            ? 'radial-gradient(circle, rgba(244,63,94,0.45) 0%, rgba(251,191,36,0.34) 38%, rgba(0,245,255,0.2) 62%, transparent 78%)'
            : 'radial-gradient(circle, rgba(0,245,255,0.28) 0%, rgba(139,92,246,0.22) 38%, rgba(236,72,153,0.16) 60%, transparent 76%)',
          opacity: 0.95,
          animationDuration: `${pulseDurationSec}s`,
          willChange: 'transform, opacity',
        }}
      />

      {/* Secondary Plasma Core Flare Ring */}
      {!isMini && (
        <div
          className="absolute rounded-full pointer-events-none transition-opacity duration-500 jarvis-core-pulse"
          style={{
            width: `${dim * 1.2}px`,
            height: `${dim * 1.2}px`,
            background:
              'radial-gradient(circle, rgba(168,85,247,0.35) 0%, rgba(244,63,94,0.22) 42%, rgba(0,245,255,0.16) 65%, transparent 78%)',
            animationDuration: `${pulseDurationSec * 0.85}s`,
            willChange: 'transform, opacity',
          }}
        />
      )}

      {/* SVG Sphere & Orbital Rings */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: `${dim}px`, height: `${dim}px` }}
      >
        <svg
          width={dim}
          height={dim}
          viewBox={`0 0 ${dim} ${dim}`}
          className="overflow-visible"
        >
          <defs>
            {/* 1. Multi-Layered Radial Gradient for Core Sphere */}
            <radialGradient id={coreGradId} cx="32%" cy="28%" r="72%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="12%" stopColor="#00f5ff" stopOpacity="0.95" />
              <stop offset="28%" stopColor="#00b4d8" stopOpacity="0.9" />
              <stop offset="48%" stopColor="#3b82f6" stopOpacity="0.92" />
              <stop offset="68%" stopColor="#9333ea" stopOpacity="0.95" />
              <stop offset="85%" stopColor="#f43f5e" stopOpacity="0.95" />
              <stop offset="96%" stopColor="#4c1d95" stopOpacity="0.98" />
              <stop offset="100%" stopColor="#090520" stopOpacity="1" />
            </radialGradient>

            {/* Core Outer Shell Gradient */}
            <radialGradient id={coreShellGradId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="transparent" stopOpacity="0" />
              <stop offset="70%" stopColor="#00f5ff" stopOpacity="0.15" />
              <stop offset="88%" stopColor="#ec4899" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.75" />
            </radialGradient>

            {/* Specular Plasma Highlight Gradient */}
            <linearGradient id={plasmaHighlightGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="40%" stopColor="#a5f3fc" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#f472b6" stopOpacity="0" />
            </linearGradient>

            {/* 2. Cyberpunk Dynamic Multi-stop Ring Gradients */}
            <linearGradient id={ring1GradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00f5ff" />
              <stop offset="30%" stopColor="#38bdf8" />
              <stop offset="65%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>

            <linearGradient id={ring2GradId} x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="35%" stopColor="#34d399" />
              <stop offset="68%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#00f5ff" />
            </linearGradient>

            <linearGradient id={ring3GradId} x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#ff007f" />
              <stop offset="45%" stopColor="#f43f5e" />
              <stop offset="80%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#00f5ff" />
            </linearGradient>

            <linearGradient id={ring4GradId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>

            {/* Optimized Lightweight Glow Filters */}
            {!isMini && (
              <>
                <filter id={glowFilterId} x="-25%" y="-25%" width="150%" height="150%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation={isRunning ? 3.5 : 2.5} result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>

                <filter id={intenseGlowFilterId} x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation={isRunning ? 4.5 : 3.2} result="blur1" />
                  <feMerge>
                    <feMergeNode in="blur1" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </>
            )}
          </defs>

          {/* Outer Holographic Reticle Radar Calibration Ring */}
          <circle
            cx={radius}
            cy={radius}
            r={radius * 0.96}
            fill="none"
            stroke="rgba(0, 245, 255, 0.18)"
            strokeWidth="1"
            strokeDasharray="4 10"
          />

          {/* Precision Cardinal Compass Ticks */}
          {!isMini && (
            <g opacity="0.65">
              <line x1={radius} y1={radius - radius * 0.98} x2={radius} y2={radius - radius * 0.91} stroke="#00f5ff" strokeWidth="1.5" />
              <line x1={radius} y1={radius + radius * 0.91} x2={radius} y2={radius + radius * 0.98} stroke="#00f5ff" strokeWidth="1.5" />
              <line x1={radius - radius * 0.98} y1={radius} x2={radius - radius * 0.91} y2={radius} stroke="#ec4899" strokeWidth="1.5" />
              <line x1={radius + radius * 0.91} y1={radius} x2={radius + radius * 0.98} y2={radius} stroke="#10b981" strokeWidth="1.5" />
            </g>
          )}

          {/* ======================================================== */}
          {/* ORBITAL RING 1 - Clockwise (Electric Cyan -> Violet)     */}
          {/* ======================================================== */}
          <g
            className="jarvis-reactor-spin-cw"
            style={{
              transformOrigin: `${radius}px ${radius}px`,
              animationDuration: `${spinDurationSec}s`,
            }}
          >
            <ellipse
              cx={radius}
              cy={radius}
              rx={radius * 0.92}
              ry={radius * 0.36}
              fill="none"
              stroke={`url(#${ring1GradId})`}
              strokeWidth={isMini ? 1.4 : isRunning ? 2.8 : 2}
              strokeDasharray={isMini ? '22 6' : '75 14 30 10'}
              filter={isMini ? undefined : `url(#${intenseGlowFilterId})`}
              opacity="0.9"
            />
            {/* Orbiting Satellite Node 1 (Neon Cyan Spark) */}
            <circle
              cx={radius + radius * 0.92}
              cy={radius}
              r={isMini ? 2.2 : isRunning ? 5.5 : 4.5}
              fill="#00f5ff"
            />
            {/* Micro-spark node */}
            <circle
              cx={radius - radius * 0.92 * 0.6}
              cy={radius - radius * 0.36 * 0.8}
              r={isMini ? 1.2 : 2.5}
              fill="#ec4899"
            />
          </g>

          {/* ======================================================== */}
          {/* ORBITAL RING 2 - Counter-Clockwise (Emerald -> Gold)     */}
          {/* ======================================================== */}
          <g
            className="jarvis-reactor-spin-ccw"
            style={{
              transformOrigin: `${radius}px ${radius}px`,
              animationDuration: `${(spinDurationSec * 0.8).toFixed(2)}s`,
            }}
          >
            <ellipse
              cx={radius}
              cy={radius}
              rx={radius * 0.86}
              ry={radius * 0.31}
              fill="none"
              stroke={`url(#${ring2GradId})`}
              strokeWidth={isMini ? 1.2 : isRunning ? 2.6 : 1.8}
              strokeDasharray={isMini ? '16 6' : '50 18 16 14'}
              filter={isMini ? undefined : `url(#${intenseGlowFilterId})`}
              opacity="0.88"
            />
            {/* Orbiting Satellite Node 2 (Solar Gold Spark) */}
            <circle
              cx={radius - radius * 0.86}
              cy={radius}
              r={isMini ? 2 : isRunning ? 5 : 4}
              fill="#fbbf24"
            />
            {/* Orbiting Satellite Node 2B (Emerald Spark) */}
            <circle
              cx={radius + radius * 0.86 * 0.7}
              cy={radius + radius * 0.31 * 0.71}
              r={isMini ? 1.5 : 3.2}
              fill="#10b981"
            />
          </g>

          {/* ======================================================== */}
          {/* ORBITAL RING 3 - Polar Equator Tilt (Magenta -> Violet)  */}
          {/* ======================================================== */}
          {!isMini && (
            <g
              className="jarvis-reactor-spin-cw"
              style={{
                transformOrigin: `${radius}px ${radius}px`,
                animationDuration: `${(spinDurationSec * 1.35).toFixed(2)}s`,
              }}
            >
              <ellipse
                cx={radius}
                cy={radius}
                rx={radius * 0.78}
                ry={radius * 0.65}
                fill="none"
                stroke={`url(#${ring3GradId})`}
                strokeWidth="1.6"
                strokeDasharray="12 18 6 18"
                opacity="0.78"
              />
              {/* Satellite Node 3 (Magenta Plasma Spark) */}
              <circle
                cx={radius + radius * 0.78 * 0.707}
                cy={radius - radius * 0.65 * 0.707}
                r={isRunning ? 4.5 : 3.5}
                fill="#ff007f"
              />
            </g>
          )}

          {/* ======================================================== */}
          {/* ORBITAL RING 4 - Tight Core Resonance Ring (Aqua -> Blue) */}
          {/* ======================================================== */}
          {!isMini && (
            <g
              className="jarvis-reactor-spin-ccw"
              style={{
                transformOrigin: `${radius}px ${radius}px`,
                animationDuration: `${(spinDurationSec * 0.65).toFixed(2)}s`,
              }}
            >
              <ellipse
                cx={radius}
                cy={radius}
                rx={radius * 0.58}
                ry={radius * 0.22}
                fill="none"
                stroke={`url(#${ring4GradId})`}
                strokeWidth="1.5"
                strokeDasharray="8 8"
                opacity="0.8"
              />
              {/* Ultra-fast orbiting energy photon */}
              <circle
                cx={radius + radius * 0.58}
                cy={radius}
                r="2.8"
                fill="#00f5ff"
              />
            </g>
          )}

          {/* ======================================================== */}
          {/* CENTRAL 3D CYBERPUNK MULTI-LAYERED SPHERE CORE           */}
          {/* ======================================================== */}
          <g
            className="jarvis-core-pulse"
            style={{
              transformOrigin: `${radius}px ${radius}px`,
              animationDuration: `${pulseDurationSec}s`,
            }}
          >
            {/* Plasma Shadow Aura behind ball with rich purple/cyan bloom */}
            <circle
              cx={radius}
              cy={radius}
              r={radius * 0.47}
              fill="rgba(168, 85, 247, 0.45)"
              filter={isMini ? undefined : `url(#${glowFilterId})`}
            />

            {/* 3D Main Sphere Body with Multi-layered Radial Shader */}
            <circle
              cx={radius}
              cy={radius}
              r={radius * 0.44}
              fill={`url(#${coreGradId})`}
              stroke="rgba(255, 255, 255, 0.5)"
              strokeWidth={isMini ? 0.9 : 1.8}
            />

            {/* Holographic Outer Corona Ring */}
            <circle
              cx={radius}
              cy={radius}
              r={radius * 0.44}
              fill={`url(#${coreShellGradId})`}
            />

            {/* Inner Holographic Geometric Mesh / Quantum Energy Lattice */}
            <circle
              cx={radius}
              cy={radius}
              r={radius * 0.36}
              fill="none"
              stroke="#00f5ff"
              strokeWidth={isMini ? 0.6 : 1.2}
              strokeDasharray="3 6"
              opacity="0.75"
              className="jarvis-reactor-spin-cw"
              style={{
                transformOrigin: `${radius}px ${radius}px`,
                animationDuration: `${(spinDurationSec * 1.8).toFixed(2)}s`,
              }}
            />

            {/* Secondary Concentric Resonant Lattice */}
            <circle
              cx={radius}
              cy={radius}
              r={radius * 0.28}
              fill="none"
              stroke="#ec4899"
              strokeWidth={isMini ? 0.5 : 1}
              strokeDasharray="2 4"
              opacity="0.7"
              className="jarvis-reactor-spin-ccw"
              style={{
                transformOrigin: `${radius}px ${radius}px`,
                animationDuration: `${(spinDurationSec * 1.4).toFixed(2)}s`,
              }}
            />

            {/* Internal Intense Pulsing Energy Singularity Core */}
            <circle
              cx={radius}
              cy={radius}
              r={radius * 0.18}
              fill={isRunning ? '#ffffff' : '#00f5ff'}
              filter={isMini ? undefined : `url(#${intenseGlowFilterId})`}
              opacity={isRunning ? 1 : 0.95}
            />

            {/* Ultra-Bright Center Spark Aperture */}
            <circle
              cx={radius}
              cy={radius}
              r={radius * 0.08}
              fill="#ffffff"
              opacity="1"
            />

            {/* Specular 3D Holographic Gloss Highlight Reflection */}
            <ellipse
              cx={radius - radius * 0.15}
              cy={radius - radius * 0.17}
              rx={radius * 0.18}
              ry={radius * 0.10}
              fill={`url(#${plasmaHighlightGradId})`}
              transform={`rotate(-28 ${radius - radius * 0.15} ${radius - radius * 0.17})`}
            />
          </g>

          {/* Surrounding Cyberpunk Audio Spectral Beams & Neural Sparks */}
          {!isMini && (
            <g
              className="jarvis-core-pulse"
              style={{
                transformOrigin: `${radius}px ${radius}px`,
                animationDuration: `${(pulseDurationSec * 0.9).toFixed(2)}s`,
              }}
            >
              {STATIC_AUDIO_BARS.map((height, idx) => {
                const angle = (idx / STATIC_AUDIO_BARS.length) * Math.PI * 2;
                const barDist = radius * 0.58;
                const x1 = radius + Math.cos(angle) * barDist;
                const y1 = radius + Math.sin(angle) * barDist;
                const barLength =
                  ((isRunning || isListening ? Math.min(100, height + 12) : height) / 100) *
                  (radius * 0.24);
                const x2 = radius + Math.cos(angle) * (barDist + barLength);
                const y2 = radius + Math.sin(angle) * (barDist + barLength);
                const strokeCol = SPECTRUM_COLORS[idx % SPECTRUM_COLORS.length];

                return (
                  <line
                    key={idx}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={strokeCol}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    opacity="0.9"
                  />
                );
              })}
            </g>
          )}
        </svg>
      </div>

      {/* Floating Holographic Cyberpunk Badge with Shifting Status */}
      {showBadge && !isMini && (
        <div className="mt-3 flex flex-col items-center">
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full backdrop-blur-md transition-all duration-300 shadow-lg"
            style={{
              background: isRunning
                ? 'linear-gradient(135deg, rgba(0,245,255,0.25) 0%, rgba(168,85,247,0.3) 50%, rgba(244,63,94,0.25) 100%)'
                : isListening
                ? 'linear-gradient(135deg, rgba(244,63,94,0.3) 0%, rgba(251,191,36,0.3) 100%)'
                : 'linear-gradient(135deg, rgba(5, 18, 36, 0.85) 0%, rgba(24, 12, 44, 0.85) 100%)',
              border: isRunning
                ? '1.5px solid #00f5ff'
                : isListening
                ? '1.5px solid #f43f5e'
                : '1px solid rgba(0, 245, 255, 0.45)',
              boxShadow: isRunning
                ? '0 0 20px rgba(0,245,255,0.5), inset 0 0 10px rgba(168,85,247,0.3)'
                : '0 4px 14px rgba(0,0,0,0.4), 0 0 12px rgba(0,245,255,0.2)',
            }}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isRunning
                  ? 'bg-cyan-300 animate-ping'
                  : isListening
                  ? 'bg-rose-400 animate-bounce'
                  : 'bg-cyan-400 animate-pulse'
              }`}
              style={{
                boxShadow: isRunning ? '0 0 10px #00f5ff' : '0 0 8px #00f5ff',
              }}
            />
            <span
              className="text-[10px] font-mono font-bold tracking-widest uppercase text-transparent bg-clip-text"
              style={{
                backgroundImage: 'linear-gradient(90deg, #00f5ff 0%, #a5f3fc 50%, #f472b6 100%)',
                letterSpacing: '0.14em',
              }}
            >
              {activeStatus}
            </span>
            <Sparkles size={11} className="text-cyan-300 animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );
}

export const JarvisQuantumOrb = memo(JarvisQuantumOrbComponent, (prev, next) => {
  return (
    prev.status === next.status &&
    prev.isListening === next.isListening &&
    prev.isRunning === next.isRunning &&
    Boolean(prev.query) === Boolean(next.query) &&
    prev.size === next.size &&
    prev.showBadge === next.showBadge &&
    prev.className === next.className
  );
});

