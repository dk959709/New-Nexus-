import { useState, useEffect, useId } from 'react';
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

export function JarvisQuantumOrb({
  status = 'idle',
  isListening = false,
  isRunning = false,
  query = '',
  size = 'md',
  showBadge = true,
  onClick,
  className = '',
}: JarvisQuantumOrbProps) {
  const [rotation, setRotation] = useState(0);
  const [pulse, setPulse] = useState(1);
  const [audioBars, setAudioBars] = useState<number[]>([40, 65, 80, 50, 90, 70, 45, 85, 60, 95]);
  const uid = useId().replace(/:/g, '');

  // Dimensions
  const dim = size === 'xs' ? 36 : size === 'sm' ? 120 : size === 'lg' ? 220 : 160;
  const radius = dim / 2;
  const isMini = size === 'xs';

  // Animation cycle
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = (time: number) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      const speed = isRunning || status === 'synthesizing' || status === 'thinking' ? 180 : isListening || status === 'listening' ? 120 : query ? 80 : 35;
      setRotation((prev) => (prev + speed * delta) % 360);

      // Pulse breathing
      const pulseSpeed = isRunning || status === 'synthesizing' ? 8 : isListening ? 6 : 2;
      setPulse(1 + 0.08 * Math.sin(time * 0.003 * pulseSpeed));

      // Audio waveform modulation
      if (isRunning || isListening || status === 'listening' || status === 'synthesizing') {
        setAudioBars(
          Array.from({ length: 12 }, () => Math.floor(25 + Math.random() * 75))
        );
      } else {
        setAudioBars(
          Array.from({ length: 12 }, (_, i) =>
            Math.floor(20 + Math.sin(time * 0.004 + i * 0.6) * 20 + 20)
          )
        );
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isRunning, isListening, query, status]);

  // Derive active status label & theme colors
  const activeStatus = isRunning
    ? 'NEURAL SYNTHESIS'
    : isListening
    ? 'VOICE LISTENING'
    : status === 'complete'
    ? 'SYNTHESIS COMPLETE'
    : query
    ? 'QUERY READY'
    : 'ONLINE STANDBY';

  const ballGradId = `jarvis3dBallGrad_${uid}`;
  const ring1GradId = `jarvisRingGradCyanPurple_${uid}`;
  const ring2GradId = `jarvisRingGradGoldRose_${uid}`;
  const ring3GradId = `jarvisRingGradNeon_${uid}`;
  const filterId = `ballGlowFilter_${uid}`;

  return (
    <div
      onClick={onClick}
      className={`jarvis-quantum-orb-container relative flex flex-col items-center justify-center select-none group cursor-pointer transition-all duration-300 ${className}`}
      style={{ minHeight: isMini ? `${dim}px` : `${dim + 40}px` }}
      title="JARVIS Quantum Neural Core - Click to ping"
    >
      {/* Outer Multi-color Aurora Atmosphere Flare */}
      <div
        className="absolute rounded-full pointer-events-none transition-all duration-700"
        style={{
          width: `${dim * (isMini ? 1.3 : 1.6)}px`,
          height: `${dim * (isMini ? 1.3 : 1.6)}px`,
          background: isRunning
            ? 'radial-gradient(circle, rgba(56,189,248,0.45) 0%, rgba(168,85,247,0.35) 40%, rgba(244,63,94,0.2) 70%, transparent 85%)'
            : isListening
            ? 'radial-gradient(circle, rgba(244,63,94,0.5) 0%, rgba(251,191,36,0.35) 45%, rgba(56,189,248,0.2) 75%, transparent 85%)'
            : 'radial-gradient(circle, rgba(97,215,201,0.35) 0%, rgba(56,189,248,0.25) 45%, rgba(168,85,247,0.18) 75%, transparent 85%)',
          filter: `blur(${dim * (isMini ? 0.18 : 0.25)}px)`,
          opacity: 0.9,
          transform: `scale(${pulse})`,
        }}
      />

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
            {/* Multi-color Radiant Core Gradients */}
            <radialGradient id={ballGradId} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="20%" stopColor="#67e8f9" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#0284c7" stopOpacity="0.85" />
              <stop offset="80%" stopColor="#7e22ce" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#051329" stopOpacity="0.98" />
            </radialGradient>

            <linearGradient id={ring1GradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#61d7c9" />
              <stop offset="50%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>

            <linearGradient id={ring2GradId} x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fb7185" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>

            <linearGradient id={ring3GradId} x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#f43f5e" />
            </linearGradient>

            {/* Glowing Drop Filter */}
            <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation={isMini ? 1.5 : isRunning ? 6 : 4} result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Ambient Outer Boundary */}
          <circle
            cx={radius}
            cy={radius}
            r={radius * 0.95}
            fill="none"
            stroke="rgba(97, 215, 201, 0.12)"
            strokeWidth="1"
            strokeDasharray="4 8"
          />

          {/* ======================================================== */}
          {/* ORBITAL RING 1 - Tilted 45deg (Multi-color Cyan-Purple) */}
          {/* ======================================================== */}
          <g
            style={{
              transformOrigin: `${radius}px ${radius}px`,
              transform: `rotate(${rotation}deg)`,
            }}
          >
            <ellipse
              cx={radius}
              cy={radius}
              rx={radius * 0.92}
              ry={radius * 0.35}
              fill="none"
              stroke={`url(#${ring1GradId})`}
              strokeWidth={isMini ? 1.2 : isRunning ? 2.5 : 1.8}
              strokeDasharray={isMini ? "20 6" : "60 12 24 8"}
              filter={`url(#${filterId})`}
              opacity="0.85"
            />
            {/* Glowing Orb Satellite Bead on Ring 1 */}
            <circle
              cx={radius + radius * 0.92}
              cy={radius}
              r={isMini ? 2 : isRunning ? 5 : 4}
              fill="#61d7c9"
              filter={`url(#${filterId})`}
            />
          </g>

          {/* ======================================================== */}
          {/* ORBITAL RING 2 - Tilted -45deg (Multi-color Gold-Rose)  */}
          {/* ======================================================== */}
          <g
            style={{
              transformOrigin: `${radius}px ${radius}px`,
              transform: `rotate(-${rotation * 1.3}deg)`,
            }}
          >
            <ellipse
              cx={radius}
              cy={radius}
              rx={radius * 0.88}
              ry={radius * 0.32}
              fill="none"
              stroke={`url(#${ring2GradId})`}
              strokeWidth={isMini ? 1 : isRunning ? 2.2 : 1.6}
              strokeDasharray={isMini ? "14 6" : "40 16 10 16"}
              filter={`url(#${filterId})`}
              opacity="0.8"
            />
            {/* Glowing Orb Satellite Bead on Ring 2 */}
            <circle
              cx={radius - radius * 0.88}
              cy={radius}
              r={isMini ? 1.8 : isRunning ? 4.5 : 3.5}
              fill="#fbbf24"
              filter={`url(#${filterId})`}
            />
          </g>

          {/* ======================================================== */}
          {/* ORBITAL RING 3 - Equator Spin (Neon Pink-Cyan)           */}
          {/* ======================================================== */}
          {!isMini && (
            <g
              style={{
                transformOrigin: `${radius}px ${radius}px`,
                transform: `rotate(${rotation * 0.7 + 60}deg)`,
              }}
            >
              <ellipse
                cx={radius}
                cy={radius}
                rx={radius * 0.78}
                ry={radius * 0.78}
                fill="none"
                stroke={`url(#${ring3GradId})`}
                strokeWidth="1.2"
                strokeDasharray="4 14"
                opacity="0.6"
              />
            </g>
          )}

          {/* ======================================================== */}
          {/* CENTRAL 3D COLORFUL QUANTUM BALL / SPHERE               */}
          {/* ======================================================== */}
          <g style={{ transformOrigin: `${radius}px ${radius}px`, transform: `scale(${pulse})` }}>
            {/* Plasma Shadow Aura behind ball */}
            <circle
              cx={radius}
              cy={radius}
              r={radius * 0.46}
              fill="rgba(56, 189, 248, 0.4)"
              filter={`url(#${filterId})`}
            />

            {/* 3D Main Sphere Body with Radiant Shader */}
            <circle
              cx={radius}
              cy={radius}
              r={radius * 0.44}
              fill={`url(#${ballGradId})`}
              stroke="rgba(255, 255, 255, 0.4)"
              strokeWidth={isMini ? 0.8 : 1.5}
            />

            {/* Inner Holographic Hex Grid Texture / Lattice */}
            <circle
              cx={radius}
              cy={radius}
              r={radius * 0.38}
              fill="none"
              stroke="rgba(97, 215, 201, 0.4)"
              strokeWidth={isMini ? 0.6 : 1}
              strokeDasharray="2 6"
            />

            {/* Internal Pulsing Energy Core Bead */}
            <circle
              cx={radius}
              cy={radius}
              r={radius * 0.18}
              fill={isRunning ? '#ffffff' : '#67e8f9'}
              filter={`url(#${filterId})`}
              opacity={isRunning ? 1 : 0.9}
            />

            {/* Specular 3D Gloss Highlight reflection */}
            <ellipse
              cx={radius - radius * 0.14}
              cy={radius - radius * 0.16}
              rx={radius * 0.16}
              ry={radius * 0.09}
              fill="rgba(255, 255, 255, 0.85)"
              transform={`rotate(-25 ${radius - radius * 0.14} ${radius - radius * 0.16})`}
            />
          </g>

          {/* Surrounding Audio Spectral Beams */}
          {!isMini && audioBars.map((height, idx) => {
            const angle = (idx / audioBars.length) * Math.PI * 2;
            const barDist = radius * 0.58;
            const x1 = radius + Math.cos(angle) * barDist;
            const y1 = radius + Math.sin(angle) * barDist;
            const barLength = (height / 100) * (radius * 0.22);
            const x2 = radius + Math.cos(angle) * (barDist + barLength);
            const y2 = radius + Math.sin(angle) * (barDist + barLength);

            const colors = ['#61d7c9', '#38bdf8', '#818cf8', '#c084fc', '#f43f5e', '#fbbf24', '#34d399'];
            const strokeCol = colors[idx % colors.length];

            return (
              <line
                key={idx}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={strokeCol}
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.85"
                filter={`url(#${filterId})`}
              />
            );
          })}
        </svg>
      </div>

      {/* Floating Holographic Badge with Colored Status */}
      {showBadge && !isMini && (
        <div className="mt-2.5 flex flex-col items-center">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full backdrop-blur-md transition-all duration-300"
            style={{
              background: isRunning
                ? 'linear-gradient(135deg, rgba(56,189,248,0.25) 0%, rgba(168,85,247,0.25) 100%)'
                : isListening
                ? 'linear-gradient(135deg, rgba(244,63,94,0.25) 0%, rgba(251,191,36,0.25) 100%)'
                : 'rgba(5, 18, 32, 0.75)',
              border: isRunning
                ? '1px solid #38bdf8'
                : isListening
                ? '1px solid #f43f5e'
                : '1px solid rgba(97, 215, 201, 0.35)',
              boxShadow: isRunning ? '0 0 14px rgba(56,189,248,0.4)' : '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isRunning
                  ? 'bg-sky-400 animate-ping'
                  : isListening
                  ? 'bg-rose-400 animate-bounce'
                  : 'bg-cyan-400 animate-pulse'
              }`}
            />
            <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-200 uppercase">
              {activeStatus}
            </span>
            <Sparkles size={11} className="text-cyan-300" />
          </div>
        </div>
      )}
    </div>
  );
}
