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
  const [corePulse, setCorePulse] = useState(1);
  const [plasmaPhase, setPlasmaPhase] = useState(0);
  const [audioBars, setAudioBars] = useState<number[]>([45, 75, 90, 60, 95, 80, 50, 85, 65, 100, 70, 88]);
  const uid = useId().replace(/:/g, '');

  // Dimensions
  const dim = size === 'xs' ? 36 : size === 'sm' ? 120 : size === 'lg' ? 240 : 175;
  const radius = dim / 2;
  const isMini = size === 'xs';

  // Animation cycle
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = (time: number) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      // Dynamic rotation speed based on state
      const speed = isRunning || status === 'synthesizing' || status === 'thinking'
        ? 190
        : isListening || status === 'listening'
        ? 135
        : query
        ? 85
        : 40;
      setRotation((prev) => (prev + speed * delta) % 360);

      // Phase cycle for energetic shifting plasma
      setPlasmaPhase((prev) => (prev + delta * 1.5) % (Math.PI * 2));

      // Multi-layer organic breathing and energetic core pulse
      const breatheRate = isRunning || status === 'synthesizing' ? 4.5 : isListening ? 3.5 : 1.8;
      const breatheAmp = isRunning ? 0.09 : isListening ? 0.07 : 0.055;
      
      // Outer aura breathing
      const mainBreathe = 1 + breatheAmp * Math.sin(time * 0.0018 * breatheRate);
      setPulse(mainBreathe);

      // Inner core rapid energetic resonance
      const coreResonance = 1 + 0.06 * Math.sin(time * 0.0035 * breatheRate + Math.PI / 4);
      setCorePulse(coreResonance);

      // Cyberpunk audio spectral filaments modulation
      if (isRunning || isListening || status === 'listening' || status === 'synthesizing') {
        setAudioBars(
          Array.from({ length: 14 }, () => Math.floor(30 + Math.random() * 70))
        );
      } else {
        setAudioBars(
          Array.from({ length: 14 }, (_, i) =>
            Math.floor(22 + Math.sin(time * 0.0035 + i * 0.55) * 22 + 22)
          )
        );
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isRunning, isListening, query, status]);

  // Derive active status label
  const activeStatus = isRunning
    ? 'NEURAL SYNTHESIS'
    : isListening
    ? 'VOICE LISTENING'
    : status === 'complete'
    ? 'SYNTHESIS COMPLETE'
    : query
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
        className="absolute rounded-full pointer-events-none transition-all duration-700"
        style={{
          width: `${dim * (isMini ? 1.4 : 1.75)}px`,
          height: `${dim * (isMini ? 1.4 : 1.75)}px`,
          background: isRunning
            ? 'radial-gradient(circle, rgba(0,245,255,0.45) 0%, rgba(168,85,247,0.38) 35%, rgba(244,63,94,0.3) 65%, rgba(16,185,129,0.15) 85%, transparent 100%)'
            : isListening
            ? 'radial-gradient(circle, rgba(244,63,94,0.5) 0%, rgba(251,191,36,0.4) 35%, rgba(0,245,255,0.25) 70%, transparent 90%)'
            : 'radial-gradient(circle, rgba(0,245,255,0.32) 0%, rgba(139,92,246,0.26) 38%, rgba(236,72,153,0.2) 68%, rgba(16,185,129,0.1) 85%, transparent 100%)',
          filter: `blur(${dim * (isMini ? 0.2 : 0.28)}px)`,
          opacity: 0.95,
          transform: `scale(${pulse})`,
        }}
      />

      {/* Secondary Plasma Core Flare Ring */}
      <div
        className="absolute rounded-full pointer-events-none transition-all duration-500"
        style={{
          width: `${dim * (isMini ? 1.1 : 1.25)}px`,
          height: `${dim * (isMini ? 1.1 : 1.25)}px`,
          background: 'radial-gradient(circle, rgba(168,85,247,0.4) 0%, rgba(244,63,94,0.25) 45%, rgba(0,245,255,0.2) 75%, transparent 100%)',
          filter: `blur(${dim * 0.15}px)`,
          transform: `scale(${corePulse})`,
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
            {/* 1. Multi-Layered Radial Gradient for Core Sphere: Deep Electric Violet -> Neon Cyan -> Magenta Plasma -> Laser Blue */}
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
            {/* Ring 1: Electric Violet -> Laser Cyan -> Vivid Purple */}
            <linearGradient id={ring1GradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00f5ff" />
              <stop offset="30%" stopColor="#38bdf8" />
              <stop offset="65%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>

            {/* Ring 2: Emerald Green -> Solar Gold -> Laser Cyan Sparks */}
            <linearGradient id={ring2GradId} x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="35%" stopColor="#34d399" />
              <stop offset="68%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#00f5ff" />
            </linearGradient>

            {/* Ring 3: Magenta Plasma -> Neon Pink -> Deep Violet */}
            <linearGradient id={ring3GradId} x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#ff007f" />
              <stop offset="45%" stopColor="#f43f5e" />
              <stop offset="80%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#00f5ff" />
            </linearGradient>

            {/* Ring 4: Holographic Aqua -> Gold Spark -> Neon Blue */}
            <linearGradient id={ring4GradId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>

            {/* Glow / Bloom Filters */}
            <filter id={glowFilterId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation={isMini ? 1.5 : isRunning ? 5.5 : 3.5} result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            <filter id={intenseGlowFilterId} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur in="SourceGraphic" stdDeviation={isMini ? 2 : isRunning ? 8 : 6} result="blur1" />
              <feGaussianBlur in="SourceGraphic" stdDeviation={isMini ? 1 : 2.5} result="blur2" />
              <feMerge>
                <feMergeNode in="blur1" />
                <feMergeNode in="blur2" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
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
          {/* ORBITAL RING 1 - Tilted 35deg (Electric Cyan -> Violet)  */}
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
              ry={radius * 0.36}
              fill="none"
              stroke={`url(#${ring1GradId})`}
              strokeWidth={isMini ? 1.4 : isRunning ? 2.8 : 2}
              strokeDasharray={isMini ? "22 6" : "75 14 30 10"}
              filter={`url(#${intenseGlowFilterId})`}
              opacity="0.9"
            />
            {/* Orbiting Satellite Node 1 (Neon Cyan Spark) */}
            <circle
              cx={radius + radius * 0.92}
              cy={radius}
              r={isMini ? 2.2 : isRunning ? 5.5 : 4.5}
              fill="#00f5ff"
              filter={`url(#${intenseGlowFilterId})`}
            />
            {/* Micro-spark node */}
            <circle
              cx={radius - radius * 0.92 * 0.6}
              cy={radius - radius * 0.36 * 0.8}
              r={isMini ? 1.2 : 2.5}
              fill="#ec4899"
              filter={`url(#${glowFilterId})`}
            />
          </g>

          {/* ======================================================== */}
          {/* ORBITAL RING 2 - Tilted -40deg (Emerald -> Solar Gold)   */}
          {/* ======================================================== */}
          <g
            style={{
              transformOrigin: `${radius}px ${radius}px`,
              transform: `rotate(-${rotation * 1.25}deg)`,
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
              strokeDasharray={isMini ? "16 6" : "50 18 16 14"}
              filter={`url(#${intenseGlowFilterId})`}
              opacity="0.88"
            />
            {/* Orbiting Satellite Node 2 (Solar Gold Spark) */}
            <circle
              cx={radius - radius * 0.86}
              cy={radius}
              r={isMini ? 2 : isRunning ? 5 : 4}
              fill="#fbbf24"
              filter={`url(#${intenseGlowFilterId})`}
            />
            {/* Orbiting Satellite Node 2B (Emerald Spark) */}
            <circle
              cx={radius + radius * 0.86 * 0.7}
              cy={radius + radius * 0.31 * 0.71}
              r={isMini ? 1.5 : 3.2}
              fill="#10b981"
              filter={`url(#${glowFilterId})`}
            />
          </g>

          {/* ======================================================== */}
          {/* ORBITAL RING 3 - Polar Equator Tilt (Magenta -> Violet)  */}
          {/* ======================================================== */}
          {!isMini && (
            <g
              style={{
                transformOrigin: `${radius}px ${radius}px`,
                transform: `rotate(${rotation * 0.75 + 55}deg)`,
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
                filter={`url(#${glowFilterId})`}
                opacity="0.75"
              />
              {/* Satellite Node 3 (Magenta Plasma Spark) */}
              <circle
                cx={radius + radius * 0.78 * 0.707}
                cy={radius - radius * 0.65 * 0.707}
                r={isRunning ? 4.5 : 3.5}
                fill="#ff007f"
                filter={`url(#${intenseGlowFilterId})`}
              />
            </g>
          )}

          {/* ======================================================== */}
          {/* ORBITAL RING 4 - Tight Core Resonance Ring (Aqua -> Blue) */}
          {/* ======================================================== */}
          {!isMini && (
            <g
              style={{
                transformOrigin: `${radius}px ${radius}px`,
                transform: `rotate(-${rotation * 1.6 - 20}deg)`,
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
                filter={`url(#${intenseGlowFilterId})`}
              />
            </g>
          )}

          {/* ======================================================== */}
          {/* CENTRAL 3D CYBERPUNK MULTI-LAYERED SPHERE CORE           */}
          {/* ======================================================== */}
          <g style={{ transformOrigin: `${radius}px ${radius}px`, transform: `scale(${corePulse})` }}>
            {/* Plasma Shadow Aura behind ball with rich purple/cyan bloom */}
            <circle
              cx={radius}
              cy={radius}
              r={radius * 0.47}
              fill="rgba(168, 85, 247, 0.45)"
              filter={`url(#${intenseGlowFilterId})`}
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
              style={{
                transformOrigin: `${radius}px ${radius}px`,
                transform: `rotate(${plasmaPhase * 20}deg)`,
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
              style={{
                transformOrigin: `${radius}px ${radius}px`,
                transform: `rotate(-${plasmaPhase * 30}deg)`,
              }}
            />

            {/* Internal Intense Pulsing Energy Singularity Core */}
            <circle
              cx={radius}
              cy={radius}
              r={radius * 0.18}
              fill={isRunning ? '#ffffff' : '#00f5ff'}
              filter={`url(#${intenseGlowFilterId})`}
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
          {!isMini && audioBars.map((height, idx) => {
            const angle = (idx / audioBars.length) * Math.PI * 2;
            const barDist = radius * 0.58;
            const x1 = radius + Math.cos(angle) * barDist;
            const y1 = radius + Math.sin(angle) * barDist;
            const barLength = (height / 100) * (radius * 0.24);
            const x2 = radius + Math.cos(angle) * (barDist + barLength);
            const y2 = radius + Math.sin(angle) * (barDist + barLength);

            // Shifting multi-color spectrum: cyan, electric violet, gold, emerald, magenta, laser-blue
            const spectrumColors = [
              '#00f5ff',
              '#38bdf8',
              '#a855f7',
              '#ec4899',
              '#fbbf24',
              '#10b981',
              '#ff007f',
            ];
            const strokeCol = spectrumColors[idx % spectrumColors.length];

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
                filter={`url(#${glowFilterId})`}
              />
            );
          })}
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
