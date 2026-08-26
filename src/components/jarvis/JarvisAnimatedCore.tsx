import { useState, useEffect, useId, useCallback } from 'react';
import { Sparkles, Cpu } from 'lucide-react';

interface JarvisAnimatedCoreProps {
  status?: 'idle' | 'searching' | 'thinking' | 'synthesizing' | 'success';
  statusText?: string;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  isFocused?: boolean;
  onClick?: () => void;
  reducedMotion?: boolean;
}

export function JarvisAnimatedCore({
  status = 'idle',
  statusText,
  size = 'md',
  interactive = false,
  isFocused = false,
  onClick,
  reducedMotion = false,
}: JarvisAnimatedCoreProps) {
  const isBusy = status === 'searching' || status === 'thinking' || status === 'synthesizing';
  const isSuccess = status === 'success';

  // Dimension scaling (larger canvas for hyper-detailed telemetry rings and blueprint calipers)
  const dim = size === 'sm' ? 220 : size === 'lg' ? 360 : 290;
  const radius = dim / 2;
  const coreRadius = radius * 0.36;

  const [rotation, setRotation] = useState(0);
  const [pulse, setPulse] = useState(1);
  const [floatOffset, setFloatOffset] = useState(0);
  const [corePulse, setCorePulse] = useState(1);
  const [electricArcs, setElectricArcs] = useState<{ d: string; color: string; width: number; opacity: number }[]>([]);
  const [telemetryValues, setTelemetryValues] = useState({ flux: '99.4%', freq: '438.2 THz', temp: '2.41 K', volt: '1.21 GV' });
  const uid = useId().replace(/:/g, '');

  // Generate procedural electric lightning energy arcs inside the glass matrix
  const generateArcs = useCallback((time: number, cR: number, cx: number, cy: number) => {
    const arcCount = isBusy ? 6 : 4;
    const arcs = [];
    const colors = ['#00f5ff', '#38bdf8', '#a855f7', '#ff007f', '#ffffff'];

    for (let i = 0; i < arcCount; i++) {
      const angleStart = (time * 0.002 + i * ((Math.PI * 2) / arcCount)) % (Math.PI * 2);
      const angleEnd = angleStart + (Math.PI * 0.6 + Math.sin(time * 0.005 + i) * 0.4);
      
      const r1 = cR * (0.2 + Math.sin(time * 0.004 + i * 2) * 0.15);
      const r2 = cR * (0.75 + Math.cos(time * 0.003 + i) * 0.18);

      const x1 = cx + Math.cos(angleStart) * r1;
      const y1 = cy + Math.sin(angleStart) * r1;
      const x2 = cx + Math.cos(angleEnd) * r2;
      const y2 = cy + Math.sin(angleEnd) * r2;

      // Jagged zig-zag lightning midpoint
      const midAngle = (angleStart + angleEnd) / 2;
      const midR = (r1 + r2) / 2 + (Math.sin(time * 0.015 + i * 5) * 12);
      const mx = cx + Math.cos(midAngle) * midR;
      const my = cy + Math.sin(midAngle) * midR;

      const d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
      arcs.push({
        d,
        color: colors[i % colors.length],
        width: i === 0 ? 2.2 : 1.4,
        opacity: 0.65 + Math.sin(time * 0.01 + i) * 0.35,
      });
    }
    return arcs;
  }, [isBusy]);

  // Continuous Zero-G Floating, Orbital Rotation, and Reactor Dynamics
  useEffect(() => {
    if (reducedMotion) return;

    let animationFrameId: number;
    let lastTime = performance.now();
    let lastTelemetryUpdate = 0;

    const animate = (time: number) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      // Zero-G zero-gravity floating elevation
      const floatY = Math.sin(time * 0.0016) * 6.5;
      setFloatOffset(floatY);

      // Orbital speed
      const speed = isBusy ? 140 : isFocused ? 65 : 32;
      setRotation((prev) => (prev + speed * delta) % 360);

      // Breathing and resonance
      const breatheRate = isBusy ? 4.2 : isFocused ? 2.8 : 1.6;
      const mainBreathe = 1 + (isBusy ? 0.06 : 0.035) * Math.sin(time * 0.002 * breatheRate);
      setPulse(mainBreathe);

      const coreRes = 1 + 0.045 * Math.sin(time * 0.004 * breatheRate + Math.PI / 3);
      setCorePulse(coreRes);

      // Electric arcs trapped inside the glass sphere
      setElectricArcs(generateArcs(time, coreRadius, radius, radius));

      // Telemetry jitter every 350ms
      if (time - lastTelemetryUpdate > 350) {
        lastTelemetryUpdate = time;
        setTelemetryValues({
          flux: `${(98.8 + Math.sin(time * 0.001) * 1.1).toFixed(1)}%`,
          freq: `${(438.0 + Math.sin(time * 0.002) * 4.2).toFixed(1)} THz`,
          temp: `${(2.40 + Math.cos(time * 0.001) * 0.08).toFixed(2)} K`,
          volt: '1.21 GV',
        });
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isBusy, isFocused, reducedMotion, coreRadius, radius, generateArcs]);

  // Derive status label
  const displayLabel =
    statusText ||
    (status === 'searching'
      ? 'QUANTUM MATRIX SEARCH'
      : status === 'thinking'
      ? 'CORE NEURAL SYNTHESIS'
      : status === 'synthesizing'
      ? 'KNOWLEDGE FUSION ACTIVE'
      : isSuccess
      ? 'SYNTHESIS COMPLETE'
      : isFocused
      ? 'REACTOR COHERENCE: 100%'
      : 'JARVIS ZERO-G CORE [ONLINE]');

  // Unique IDs for SVG gradients, filters, and textPaths
  const coreGradId = `jarvisReactorCoreGrad_${uid}`;
  const glassGradId = `jarvisGlassMatrixGrad_${uid}`;
  const glassFresnelId = `jarvisGlassFresnel_${uid}`;
  const ringCyanVioletId = `jarvisRingCyanViolet_${uid}`;
  const ringDeepVioletId = `jarvisRingDeepViolet_${uid}`;
  const ringMagentaPlasmaId = `jarvisRingMagenta_${uid}`;
  const glowBloomId = `jarvisGlowBloom_${uid}`;
  const intenseLaserBloomId = `jarvisIntenseLaserBloom_${uid}`;
  const codeTextPathOuterId = `jarvisCodeTextPathOuter_${uid}`;
  const codeTextPathInnerId = `jarvisCodeTextPathInner_${uid}`;

  // Radii for orbital telemetry rings
  const rRingOuter = radius * 0.94;
  const rRingCode = radius * 0.82;
  const rRingTelemetry = radius * 0.68;
  const rRingInnerCode = radius * 0.54;

  return (
    <div
      className={`jarvis-sci-fi-reactor-container relative flex flex-col items-center justify-center select-none group ${
        interactive ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
      style={{ minHeight: `${dim + 44}px` }}
      aria-label={`JARVIS AI Core Reactor: ${displayLabel}`}
      title="JARVIS Quantum Core Reactor - Zero-G Confinement Matrix"
    >
      {/* ========================================================= */}
      {/* 1. CINEMATIC BACKGROUND ATMOSPHERE: NEON BLUE & DEEP VIOLET */}
      {/* ========================================================= */}
      <div
        className="absolute rounded-full pointer-events-none transition-all duration-700"
        style={{
          width: `${dim * 1.5}px`,
          height: `${dim * 1.5}px`,
          background: isBusy
            ? 'radial-gradient(circle, rgba(0,245,255,0.4) 0%, rgba(124,58,237,0.35) 35%, rgba(76,29,149,0.3) 65%, rgba(6,4,23,0.1) 85%, transparent 100%)'
            : 'radial-gradient(circle, rgba(0,245,255,0.28) 0%, rgba(124,58,237,0.22) 40%, rgba(76,29,149,0.18) 70%, transparent 100%)',
          filter: `blur(${dim * 0.22}px)`,
          opacity: 0.95,
          transform: `translateY(${floatOffset * 0.6}px) scale(${pulse})`,
        }}
      />

      {/* Deep Violet Secondary Plasma Core Flare */}
      <div
        className="absolute rounded-full pointer-events-none transition-all duration-500"
        style={{
          width: `${dim * 1.15}px`,
          height: `${dim * 1.15}px`,
          background: 'radial-gradient(circle, rgba(147,51,234,0.35) 0%, rgba(0,245,255,0.2) 50%, rgba(6,4,23,0) 80%)',
          filter: `blur(${dim * 0.12}px)`,
          transform: `translateY(${floatOffset * 0.8}px) scale(${corePulse})`,
        }}
      />

      {/* ========================================================= */}
      {/* 2. ZERO-G FLOATING REACTOR SPHERE & BLUEPRINT MATRIX SVG  */}
      {/* ========================================================= */}
      <div
        className="relative flex items-center justify-center transition-transform duration-300"
        style={{
          width: `${dim}px`,
          height: `${dim}px`,
          transform: `translateY(${floatOffset}px) scale(${isFocused ? 1.03 : 1})`,
        }}
      >
        <svg
          width={dim}
          height={dim}
          viewBox={`0 0 ${dim} ${dim}`}
          className="overflow-visible"
        >
          <defs>
            {/* Core Reactor Plasma Radial Gradient: Stark Neon Blue -> Electric Cyan -> Deep Violet -> Cosmic Black */}
            <radialGradient id={coreGradId} cx="36%" cy="32%" r="68%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="12%" stopColor="#00f5ff" stopOpacity="1" />
              <stop offset="28%" stopColor="#00b4d8" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.95" />
              <stop offset="72%" stopColor="#7c3aed" stopOpacity="0.98" />
              <stop offset="88%" stopColor="#4c1d95" stopOpacity="1" />
              <stop offset="100%" stopColor="#060417" stopOpacity="1" />
            </radialGradient>

            {/* Glass Matrix Refraction Sphere Gradient */}
            <radialGradient id={glassGradId} cx="30%" cy="25%" r="75%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.4)" stopOpacity="0.6" />
              <stop offset="35%" stopColor="rgba(0,245,255,0.12)" stopOpacity="0.3" />
              <stop offset="75%" stopColor="rgba(124,58,237,0.18)" stopOpacity="0.4" />
              <stop offset="92%" stopColor="rgba(0,245,255,0.45)" stopOpacity="0.75" />
              <stop offset="100%" stopColor="rgba(147,51,234,0.8)" stopOpacity="0.9" />
            </radialGradient>

            {/* Glass Matrix Fresnel Rim Shader */}
            <radialGradient id={glassFresnelId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="transparent" stopOpacity="0" />
              <stop offset="70%" stopColor="rgba(0,245,255,0.05)" stopOpacity="0.1" />
              <stop offset="88%" stopColor="rgba(0,245,255,0.4)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.9)" stopOpacity="0.9" />
            </radialGradient>

            {/* Stark Neon Blue & Deep Violet Ring Gradients */}
            <linearGradient id={ringCyanVioletId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00f5ff" />
              <stop offset="40%" stopColor="#38bdf8" />
              <stop offset="70%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>

            <linearGradient id={ringDeepVioletId} x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#9333ea" />
              <stop offset="40%" stopColor="#7c3aed" />
              <stop offset="75%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#00f5ff" />
            </linearGradient>

            <linearGradient id={ringMagentaPlasmaId} x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#ff007f" />
              <stop offset="40%" stopColor="#ec4899" />
              <stop offset="75%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#00f5ff" />
            </linearGradient>

            {/* SVG Glow & Bloom Filters */}
            <filter id={glowBloomId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            <filter id={intenseLaserBloomId} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur1" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur2" />
              <feMerge>
                <feMergeNode in="blur1" />
                <feMergeNode in="blur2" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Circular TextPaths for Orbiting Digital Code */}
            <path
              id={codeTextPathOuterId}
              d={`M ${radius - rRingCode} ${radius} A ${rRingCode} ${rRingCode} 0 1 1 ${radius + rRingCode} ${radius} A ${rRingCode} ${rRingCode} 0 1 1 ${radius - rRingCode} ${radius}`}
            />
            <path
              id={codeTextPathInnerId}
              d={`M ${radius + rRingInnerCode} ${radius} A ${rRingInnerCode} ${rRingInnerCode} 0 1 0 ${radius - rRingInnerCode} ${radius} A ${rRingInnerCode} ${rRingInnerCode} 0 1 0 ${radius + rRingInnerCode} ${radius}`}
            />
          </defs>

          {/* ======================================================= */}
          {/* TECHNICAL BLUEPRINT OVERLAY & TELEMETRY RETICLES        */}
          {/* ======================================================= */}
          {/* Blueprint Precision Crosshairs & Alignment Calipers */}
          <g opacity="0.45" stroke="#00f5ff" strokeWidth="0.8">
            {/* Center cross-axes */}
            <line x1={radius} y1="8" x2={radius} y2={dim - 8} strokeDasharray="3 6" />
            <line x1="8" y1={radius} x2={dim - 8} y2={radius} strokeDasharray="3 6" />

            {/* 45° Diagonal Alignment Vector Marks */}
            <line x1={radius - radius * 0.72} y1={radius - radius * 0.72} x2={radius - radius * 0.65} y2={radius - radius * 0.65} strokeWidth="1.2" />
            <line x1={radius + radius * 0.72} y1={radius - radius * 0.72} x2={radius + radius * 0.65} y2={radius - radius * 0.65} strokeWidth="1.2" />
            <line x1={radius - radius * 0.72} y1={radius + radius * 0.72} x2={radius - radius * 0.65} y2={radius + radius * 0.65} strokeWidth="1.2" />
            <line x1={radius + radius * 0.72} y1={radius + radius * 0.72} x2={radius + radius * 0.65} y2={radius + radius * 0.65} strokeWidth="1.2" />

            {/* Blueprint Corner Brackets */}
            <path d={`M 14 26 L 14 14 L 26 14`} fill="none" strokeWidth="1.4" stroke="#00f5ff" />
            <path d={`M ${dim - 26} 14 L ${dim - 14} 14 L ${dim - 14} 26`} fill="none" strokeWidth="1.4" stroke="#00f5ff" />
            <path d={`M 14 ${dim - 26} L 14 ${dim - 14} L 26 ${dim - 14}`} fill="none" strokeWidth="1.4" stroke="#7c3aed" />
            <path d={`M ${dim - 26} ${dim - 14} L ${dim - 14} ${dim - 14} L ${dim - 14} ${dim - 26}`} fill="none" strokeWidth="1.4" stroke="#7c3aed" />
          </g>

          {/* Blueprint Micro Technical Telemetry Labels */}
          <g className="font-mono text-[7px] fill-cyan-400/80 uppercase font-semibold" letterSpacing="0.08em">
            <text x="16" y="24">SYS.ZERO_G [MK-VII]</text>
            <text x="16" y="34" fill="#a855f7">FLUX: {telemetryValues.flux}</text>
            <text x={dim - 96} y="24" textAnchor="start">FRQ: {telemetryValues.freq}</text>
            <text x={dim - 88} y="34" textAnchor="start" fill="#a855f7">TEMP: {telemetryValues.temp}</text>
            <text x="16" y={dim - 18} fill="#38bdf8">COHERENCE // 99.98%</text>
            <text x={dim - 82} y={dim - 18} textAnchor="start" fill="#00f5ff">VOLT: {telemetryValues.volt}</text>
          </g>

          {/* ======================================================= */}
          {/* ORBITAL RING 1 - OUTERMOST TELEMETRY RADAR RING (360°)   */}
          {/* ======================================================= */}
          <circle
            cx={radius}
            cy={radius}
            r={rRingOuter}
            fill="none"
            stroke="rgba(0, 245, 255, 0.22)"
            strokeWidth="1.2"
            strokeDasharray="4 8"
          />

          {/* Outer Segmented HUD Calibration Arcs (Deep Violet & Cyan) */}
          <g
            style={{
              transformOrigin: `${radius}px ${radius}px`,
              transform: `rotate(${rotation * 0.5}deg)`,
            }}
          >
            <circle
              cx={radius}
              cy={radius}
              r={rRingOuter}
              fill="none"
              stroke={`url(#${ringCyanVioletId})`}
              strokeWidth="2.2"
              strokeDasharray="40 18 12 18 80 24"
              filter={`url(#${intenseLaserBloomId})`}
            />
            {/* Precision Angle Calibration Ticks around radar */}
            {Array.from({ length: 16 }).map((_, i) => {
              const angle = (i * 22.5 * Math.PI) / 180;
              const x1 = radius + Math.cos(angle) * (rRingOuter - 4);
              const y1 = radius + Math.sin(angle) * (rRingOuter - 4);
              const x2 = radius + Math.cos(angle) * (rRingOuter + 4);
              const y2 = radius + Math.sin(angle) * (rRingOuter + 4);
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={i % 4 === 0 ? '#00f5ff' : '#7c3aed'}
                  strokeWidth={i % 4 === 0 ? '1.5' : '0.8'}
                  opacity="0.85"
                />
              );
            })}
          </g>

          {/* ======================================================= */}
          {/* ORBITAL RING 2 - GLOWING DIGITAL CODE RING             */}
          {/* ======================================================= */}
          <g
            style={{
              transformOrigin: `${radius}px ${radius}px`,
              transform: `rotate(${rotation}deg)`,
            }}
          >
            <circle
              cx={radius}
              cy={radius}
              r={rRingCode}
              fill="none"
              stroke="rgba(124, 58, 237, 0.25)"
              strokeWidth="1"
              strokeDasharray="2 6"
            />
            <text className="font-mono text-[8px] font-bold fill-cyan-300" filter={`url(#${glowBloomId})`}>
              <textPath href={`#${codeTextPathOuterId}`} startOffset="0%">
                0x7F // QUANTUM_FLUX_DENSITY: 99.8% // NEURAL_LATTICE // CORE_TEMP: 2.4K // ZERO-G // SYS.CORE.v4 //
              </textPath>
            </text>
            {/* Orbiting Laser Photon Node */}
            <circle
              cx={radius + rRingCode}
              cy={radius}
              r="4"
              fill="#00f5ff"
              filter={`url(#${intenseLaserBloomId})`}
            />
          </g>

          {/* ======================================================= */}
          {/* ORBITAL RING 3 - COMPLEX TELEMETRY CHART / WAVEFORMS   */}
          {/* ======================================================= */}
          <g
            style={{
              transformOrigin: `${radius}px ${radius}px`,
              transform: `rotate(-${rotation * 1.3}deg)`,
            }}
          >
            <ellipse
              cx={radius}
              cy={radius}
              rx={rRingTelemetry}
              ry={rRingTelemetry * 0.42}
              fill="none"
              stroke={`url(#${ringMagentaPlasmaId})`}
              strokeWidth="1.8"
              strokeDasharray="50 14 16 12"
              filter={`url(#${intenseLaserBloomId})`}
              opacity="0.9"
            />
            {/* Orbiting Telemetry Waveform Nodes */}
            <circle
              cx={radius - rRingTelemetry}
              cy={radius}
              r="4.5"
              fill="#ff007f"
              filter={`url(#${intenseLaserBloomId})`}
            />
            <circle
              cx={radius + rRingTelemetry * 0.75}
              cy={radius + rRingTelemetry * 0.42 * 0.66}
              r="3"
              fill="#00f5ff"
              filter={`url(#${glowBloomId})`}
            />
          </g>

          {/* ======================================================= */}
          {/* ORBITAL RING 4 - POLAR MATRIX DIGITAL GLYPHS RING      */}
          {/* ======================================================= */}
          <g
            style={{
              transformOrigin: `${radius}px ${radius}px`,
              transform: `rotate(-${rotation * 0.85 + 40}deg)`,
            }}
          >
            <ellipse
              cx={radius}
              cy={radius}
              rx={rRingInnerCode}
              ry={rRingInnerCode * 0.75}
              fill="none"
              stroke={`url(#${ringDeepVioletId})`}
              strokeWidth="1.4"
              strokeDasharray="6 6 18 6"
              opacity="0.8"
            />
            <text className="font-mono text-[7px] font-bold fill-purple-300" opacity="0.85">
              <textPath href={`#${codeTextPathInnerId}`} startOffset="5%">
                • MATRIX_FIELD: ACTIVE • Q-BIT: STABLE • HARMONIC: 1.21GV •
              </textPath>
            </text>
            <circle
              cx={radius + rRingInnerCode * 0.707}
              cy={radius - rRingInnerCode * 0.75 * 0.707}
              r="3.5"
              fill="#a855f7"
              filter={`url(#${intenseLaserBloomId})`}
            />
          </g>

          {/* ======================================================= */}
          {/* 3. SCI-FI AI REACTOR CORE SPHERE WITH GLASS MATRIX     */}
          {/* ======================================================= */}
          <g style={{ transformOrigin: `${radius}px ${radius}px`, transform: `scale(${corePulse})` }}>
            {/* Deep Violet / Electric Cyan Reactor Outer Core Confinement Aura */}
            <circle
              cx={radius}
              cy={radius}
              r={coreRadius * 1.22}
              fill="rgba(124, 58, 237, 0.4)"
              filter={`url(#${intenseLaserBloomId})`}
            />

            {/* 3D Plasma Reactor Sphere Body */}
            <circle
              cx={radius}
              cy={radius}
              r={coreRadius}
              fill={`url(#${coreGradId})`}
              stroke="rgba(0, 245, 255, 0.7)"
              strokeWidth="1.8"
            />

            {/* Hexagonal / Concentric Glass Matrix Lattice Grid */}
            <circle
              cx={radius}
              cy={radius}
              r={coreRadius * 0.82}
              fill="none"
              stroke="#00f5ff"
              strokeWidth="1.2"
              strokeDasharray="3 5"
              opacity="0.85"
              style={{
                transformOrigin: `${radius}px ${radius}px`,
                transform: `rotate(${rotation * 0.6}deg)`,
              }}
            />

            <circle
              cx={radius}
              cy={radius}
              r={coreRadius * 0.62}
              fill="none"
              stroke="#a855f7"
              strokeWidth="1"
              strokeDasharray="2 4"
              opacity="0.8"
              style={{
                transformOrigin: `${radius}px ${radius}px`,
                transform: `rotate(-${rotation * 0.9}deg)`,
              }}
            />

            {/* =================================================== */}
            {/* ELECTRIC ENERGY ARCS TRAPPED INSIDE GLASS MATRIX    */}
            {/* =================================================== */}
            {electricArcs.map((arc, idx) => (
              <path
                key={idx}
                d={arc.d}
                fill="none"
                stroke={arc.color}
                strokeWidth={arc.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={arc.opacity}
                filter={`url(#${intenseLaserBloomId})`}
              />
            ))}

            {/* Super-dense Energy Singularity Aperture (Pure White-Cyan Core) */}
            <circle
              cx={radius}
              cy={radius}
              r={coreRadius * 0.32}
              fill={isBusy ? '#ffffff' : '#00f5ff'}
              filter={`url(#${intenseLaserBloomId})`}
              opacity="0.95"
            />

            <circle
              cx={radius}
              cy={radius}
              r={coreRadius * 0.14}
              fill="#ffffff"
              opacity="1"
            />

            {/* =================================================== */}
            {/* GLASS MATRIX OUTER LAYER & SPECULAR FRESNEL SHADER */}
            {/* =================================================== */}
            <circle
              cx={radius}
              cy={radius}
              r={coreRadius}
              fill={`url(#${glassGradId})`}
            />

            <circle
              cx={radius}
              cy={radius}
              r={coreRadius}
              fill={`url(#${glassFresnelId})`}
            />

            {/* Specular Curved 3D Glass Arc Reflections */}
            <ellipse
              cx={radius - coreRadius * 0.32}
              cy={radius - coreRadius * 0.35}
              rx={coreRadius * 0.42}
              ry={coreRadius * 0.22}
              fill="rgba(255, 255, 255, 0.75)"
              transform={`rotate(-32 ${radius - coreRadius * 0.32} ${radius - coreRadius * 0.35})`}
            />

            {/* Secondary Glass Caustic Reflection */}
            <ellipse
              cx={radius + coreRadius * 0.35}
              cy={radius + coreRadius * 0.38}
              rx={coreRadius * 0.32}
              ry={coreRadius * 0.14}
              fill="rgba(0, 245, 255, 0.4)"
              transform={`rotate(40 ${radius + coreRadius * 0.35} ${radius + coreRadius * 0.38})`}
            />
          </g>
        </svg>
      </div>

      {/* ========================================================= */}
      {/* 4. CYBERPUNK HUD STATUS BADGE WITH LIVE TELEMETRY READOUT */}
      {/* ========================================================= */}
      <div className="mt-2 flex flex-col items-center gap-1.5">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.2 rounded-full backdrop-blur-xl transition-all duration-300 shadow-xl"
          style={{
            background: isBusy
              ? 'linear-gradient(135deg, rgba(0,245,255,0.25) 0%, rgba(124,58,237,0.35) 50%, rgba(255,0,127,0.25) 100%)'
              : isSuccess
              ? 'linear-gradient(135deg, rgba(16,185,129,0.3) 0%, rgba(0,245,255,0.25) 100%)'
              : 'linear-gradient(135deg, rgba(6, 4, 23, 0.92) 0%, rgba(14, 10, 42, 0.92) 100%)',
            border: isBusy
              ? '1.5px solid #00f5ff'
              : '1px solid rgba(0, 245, 255, 0.5)',
            boxShadow: isBusy
              ? '0 0 24px rgba(0,245,255,0.55), inset 0 0 12px rgba(124,58,237,0.4)'
              : '0 4px 18px rgba(0,0,0,0.6), 0 0 14px rgba(0,245,255,0.25)',
          }}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isBusy
                ? 'bg-cyan-300 animate-ping'
                : isSuccess
                ? 'bg-emerald-400'
                : isFocused
                ? 'bg-cyan-300 animate-pulse'
                : 'bg-cyan-400'
            }`}
            style={{
              boxShadow: isBusy ? '0 0 10px #00f5ff' : '0 0 8px #00f5ff',
            }}
          />
          <span
            className="text-[10.5px] font-mono font-bold tracking-widest uppercase text-transparent bg-clip-text"
            style={{
              backgroundImage: 'linear-gradient(90deg, #00f5ff 0%, #a5f3fc 45%, #c084fc 80%, #f472b6 100%)',
              letterSpacing: '0.14em',
            }}
          >
            {displayLabel}
          </span>
          {isBusy ? (
            <Sparkles size={12} className="text-cyan-300 animate-spin" />
          ) : (
            <Cpu size={12} className="text-cyan-300 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}
