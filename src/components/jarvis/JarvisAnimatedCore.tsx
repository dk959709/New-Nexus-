import React from 'react';

interface JarvisAnimatedCoreProps {
  status?: 'idle' | 'searching' | 'thinking' | 'synthesizing' | 'success';
  statusText?: string;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onClick?: () => void;
  reducedMotion?: boolean;
}

export function JarvisAnimatedCore({
  status = 'idle',
  statusText,
  size = 'md',
  interactive = false,
  onClick,
  reducedMotion = false,
}: JarvisAnimatedCoreProps) {
  const isBusy = status === 'searching' || status === 'thinking' || status === 'synthesizing';
  const isSuccess = status === 'success';

  // Dimension scaling
  const dim = size === 'sm' ? 120 : size === 'lg' ? 220 : 160;
  const center = dim / 2;

  // Derive status label
  const displayLabel =
    statusText ||
    (status === 'searching'
      ? 'SEARCHING...'
      : status === 'thinking'
      ? 'THINKING...'
      : status === 'synthesizing'
      ? 'SYNTHESIZING...'
      : isSuccess
      ? 'SYNTHESIS COMPLETE'
      : 'JARVIS ONLINE');

  return (
    <div
      className={`jarvis-animated-core-container relative flex flex-col items-center justify-center select-none ${
        interactive ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
      style={{ minHeight: `${dim + 36}px` }}
      aria-label={`JARVIS AI Core: ${displayLabel}`}
    >
      {/* Dynamic Ambient Core Halo Glow */}
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          width: `${dim * 1.35}px`,
          height: `${dim * 1.35}px`,
          top: `18px`,
          background: isBusy
            ? 'radial-gradient(circle, rgba(97,215,201,0.38) 0%, rgba(56,189,248,0.28) 35%, rgba(168,85,247,0.22) 65%, transparent 80%)'
            : isSuccess
            ? 'radial-gradient(circle, rgba(52,211,153,0.35) 0%, rgba(97,215,201,0.25) 45%, transparent 75%)'
            : 'radial-gradient(circle, rgba(97,215,201,0.22) 0%, rgba(56,189,248,0.14) 40%, rgba(168,85,247,0.1) 70%, transparent 80%)',
          filter: `blur(${dim * 0.22}px)`,
          opacity: isBusy ? 1 : 0.85,
          transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          animation: reducedMotion ? 'none' : isBusy ? 'jarvisCorePulseFast 1.6s ease-in-out infinite' : 'jarvisCorePulse 6s ease-in-out infinite',
        }}
      />

      {/* SVG Multi-Ring Holographic Reactor Core */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: `${dim}px`, height: `${dim}px` }}
      >
        <svg
          width={dim}
          height={dim}
          viewBox={`0 0 ${dim} ${dim}`}
          className="overflow-visible"
          style={{ transformOrigin: 'center center' }}
        >
          <defs>
            {/* Gradients */}
            <linearGradient id="jarvisCoreGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#61d7c9" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="jarvisCoreGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="jarvisCoreGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2dd4bf" />
              <stop offset="50%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>

            <filter id="jarvisCoreDropGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation={isBusy ? '5' : '3'} result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Core Aura Circle */}
          <circle
            cx={center}
            cy={center}
            r={center * 0.88}
            fill="none"
            stroke="rgba(97, 215, 201, 0.08)"
            strokeWidth="1"
          />

          {/* Ring 4: Outer Target Reticle & Micro-Ticks */}
          <g
            style={{
              transformOrigin: `${center}px ${center}px`,
              animation: reducedMotion ? 'none' : isBusy ? 'jarvisSpinCW 10s linear infinite' : 'jarvisSpinCW 40s linear infinite',
            }}
          >
            <circle
              cx={center}
              cy={center}
              r={center * 0.84}
              fill="none"
              stroke="rgba(165, 207, 214, 0.18)"
              strokeWidth="1"
              strokeDasharray="4 16"
            />
            {/* 4 Cardinal Reticles */}
            <line
              x1={center}
              y1={center - center * 0.88}
              x2={center}
              y2={center - center * 0.8}
              stroke="#61d7c9"
              strokeWidth="1.5"
              opacity="0.8"
            />
            <line
              x1={center}
              y1={center + center * 0.8}
              x2={center}
              y2={center + center * 0.88}
              stroke="#61d7c9"
              strokeWidth="1.5"
              opacity="0.8"
            />
            <line
              x1={center - center * 0.88}
              y1={center}
              x2={center - center * 0.8}
              y2={center}
              stroke="#61d7c9"
              strokeWidth="1.5"
              opacity="0.8"
            />
            <line
              x1={center + center * 0.8}
              y1={center}
              x2={center + center * 0.88}
              y2={center}
              stroke="#61d7c9"
              strokeWidth="1.5"
              opacity="0.8"
            />
          </g>

          {/* Ring 3: Middle-Outer Cyan/Purple Ring with Orbiting Nodes */}
          <g
            style={{
              transformOrigin: `${center}px ${center}px`,
              animation: reducedMotion ? 'none' : isBusy ? 'jarvisSpinCCW 6s linear infinite' : 'jarvisSpinCCW 24s linear infinite',
            }}
          >
            <circle
              cx={center}
              cy={center}
              r={center * 0.68}
              fill="none"
              stroke="url(#jarvisCoreGrad2)"
              strokeWidth={isBusy ? '1.8' : '1.2'}
              strokeDasharray="18 10 4 10"
              filter="url(#jarvisCoreDropGlow)"
              opacity="0.75"
            />
            {/* Orbiting Particle 1 */}
            <circle
              cx={center + center * 0.68}
              cy={center}
              r={isBusy ? 3.5 : 2.5}
              fill="#c084fc"
              filter="url(#jarvisCoreDropGlow)"
            />
            {/* Orbiting Particle 2 */}
            <circle
              cx={center - center * 0.68}
              cy={center}
              r={isBusy ? 3 : 2}
              fill="#38bdf8"
              filter="url(#jarvisCoreDropGlow)"
            />
          </g>

          {/* Ring 2: Intermediate Sky-Blue Ring with 3 Fast Data Nodes */}
          <g
            style={{
              transformOrigin: `${center}px ${center}px`,
              animation: reducedMotion ? 'none' : isBusy ? 'jarvisSpinCW 3.5s linear infinite' : 'jarvisSpinCW 16s linear infinite',
            }}
          >
            <circle
              cx={center}
              cy={center}
              r={center * 0.5}
              fill="none"
              stroke="url(#jarvisCoreGrad1)"
              strokeWidth={isBusy ? '2' : '1.4'}
              strokeDasharray="12 6"
              filter="url(#jarvisCoreDropGlow)"
              opacity="0.85"
            />
            {/* Orbiting Node A */}
            <circle
              cx={center}
              cy={center - center * 0.5}
              r={isBusy ? 3.5 : 2.5}
              fill="#61d7c9"
            />
            {/* Orbiting Node B */}
            <circle
              cx={center + (center * 0.5 * 0.866)}
              cy={center + (center * 0.5 * 0.5)}
              r={isBusy ? 3 : 2}
              fill="#60a5fa"
            />
            {/* Orbiting Node C */}
            <circle
              cx={center - (center * 0.5 * 0.866)}
              cy={center + (center * 0.5 * 0.5)}
              r={isBusy ? 3 : 2}
              fill="#61d7c9"
            />
          </g>

          {/* Ring 1: Inner Concentric Resonant Core Ring */}
          <g
            style={{
              transformOrigin: `${center}px ${center}px`,
              animation: reducedMotion ? 'none' : isBusy ? 'jarvisSpinCCW 2.5s linear infinite' : 'jarvisSpinCCW 11s linear infinite',
            }}
          >
            <circle
              cx={center}
              cy={center}
              r={center * 0.32}
              fill="none"
              stroke="#61d7c9"
              strokeWidth={isBusy ? '2.2' : '1.5'}
              strokeDasharray="6 4"
              opacity="0.9"
            />
            <circle
              cx={center + center * 0.32}
              cy={center}
              r={isBusy ? 2.5 : 1.8}
              fill="#ffffff"
            />
          </g>

          {/* Central JARVIS Arc Node */}
          <circle
            cx={center}
            cy={center}
            r={center * 0.18}
            fill={isBusy ? '#61d7c9' : isSuccess ? '#34d399' : '#38bdf8'}
            filter="url(#jarvisCoreDropGlow)"
            opacity={isBusy ? '0.95' : '0.8'}
          />

          {/* Center Micro-Pulse Aperture */}
          <circle
            cx={center}
            cy={center}
            r={center * 0.08}
            fill="#ffffff"
            opacity="0.95"
          />
        </svg>

        {/* Floating Core Status Dot */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ width: `${dim}px`, height: `${dim}px` }}
        >
          <div
            className={`w-3 h-3 rounded-full ${
              isBusy
                ? 'bg-white shadow-[0_0_12px_#61d7c9] animate-ping'
                : isSuccess
                ? 'bg-emerald-300 shadow-[0_0_10px_#34d399]'
                : 'bg-cyan-200 shadow-[0_0_8px_#38bdf8]'
            }`}
          />
        </div>
      </div>

      {/* Futuristic Status Badge Pill */}
      <div className="mt-3 flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-950/80 border border-cyan-500/30 backdrop-blur-md shadow-lg shadow-cyan-950/40">
        <span
          className={`w-2 h-2 rounded-full ${
            isBusy
              ? 'bg-cyan-400 animate-ping'
              : isSuccess
              ? 'bg-emerald-400'
              : 'bg-cyan-400 shadow-[0_0_6px_#61d7c9]'
          }`}
        />
        <span
          className="text-[11px] font-mono tracking-widest uppercase font-bold"
          style={{
            color: isBusy ? '#61d7c9' : isSuccess ? '#34d399' : '#a5cfd6',
            letterSpacing: '0.14em',
          }}
        >
          {displayLabel}
        </span>
      </div>
    </div>
  );
}
