import React, { useEffect, useState } from 'react';
import { Gauge, ShieldCheck, AlertTriangle, Scale, Sparkles } from 'lucide-react';
import type { ParallaxConfidenceVerdict } from '@/types';

export interface ParallaxConfidenceMeterProps {
  verdict: ParallaxConfidenceVerdict;
}

export const ParallaxConfidenceMeter: React.FC<ParallaxConfidenceMeterProps> = ({ verdict }) => {
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(1);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const pro = Math.round(verdict.proPercent * animatedProgress);
  const con = Math.round(verdict.conPercent * animatedProgress);
  const undecided = Math.max(0, 100 - pro - con);

  // Map weightedScore (-100 to +100) to needle rotation (-75deg to +75deg)
  const needleAngle = Math.max(-75, Math.min(75, Math.round((verdict.weightedScore * 0.75) * animatedProgress)));

  const isProDominant = verdict.dominantLean === 'PRO';
  const isConDominant = verdict.dominantLean === 'CON';

  return (
    <div
      id="parallax-confidence-meter"
      className="p-4 sm:p-5 rounded-xl bg-black/60 border border-cyan-500/25 space-y-4 font-mono select-none"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 grid place-items-center text-cyan-400 shrink-0">
            <Gauge size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                CONFIDENCE-WEIGHTED VERDICT METER
              </span>
              <span
                className={`text-[9px] sm:text-[10px] px-2 py-0.2 rounded font-bold uppercase ${
                  isProDominant
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : isConDominant
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-slate-500/20 text-slate-300 border border-slate-500/40'
                }`}
              >
                LEAN: {verdict.dominantLean} ({verdict.weightedScore > 0 ? `+${verdict.weightedScore}` : verdict.weightedScore})
              </span>
            </div>
            <p className="m-0 text-[10px] sm:text-[11px] text-slate-400 font-sans">
              Weighted by {verdict.totalClaimsChecked} verified empirical claims & source reliability tiers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <Scale size={12} className="text-cyan-400" />
          <span>EVIDENCE MULTIPLIER ACTIVE</span>
        </div>
      </div>

      {/* Main Gauge Visualizer & Needle */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center pt-1">
        {/* Left: Animated Arc Dial Graphic */}
        <div className="flex flex-col items-center justify-center relative col-span-1 py-1">
          <svg viewBox="0 0 160 90" className="w-36 sm:w-44 overflow-visible">
            {/* Background Arc Tracks */}
            <path
              d="M 15 80 A 65 65 0 0 1 145 80"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="10"
              strokeLinecap="round"
            />
            {/* Con Arc (Left segment) */}
            <path
              d="M 15 80 A 65 65 0 0 1 60 28"
              fill="none"
              stroke="#f43f5e"
              strokeWidth="8"
              strokeOpacity="0.85"
              strokeLinecap="round"
            />
            {/* Neutral Arc (Center segment) */}
            <path
              d="M 64 25 A 65 65 0 0 1 96 25"
              fill="none"
              stroke="#64748b"
              strokeWidth="8"
              strokeOpacity="0.7"
            />
            {/* Pro Arc (Right segment) */}
            <path
              d="M 100 28 A 65 65 0 0 1 145 80"
              fill="none"
              stroke="#10b981"
              strokeWidth="8"
              strokeOpacity="0.85"
              strokeLinecap="round"
            />

            {/* Pivot Center Cap */}
            <circle cx="80" cy="80" r="7" fill="#020810" stroke="#00f0ff" strokeWidth="2.5" />
            <circle cx="80" cy="80" r="3" fill="#00f0ff" />

            {/* Needle Line with smooth rotation transition */}
            <g
              transform={`rotate(${needleAngle} 80 80)`}
              style={{ transition: 'transform 1s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            >
              <line
                x1="80"
                y1="80"
                x2="80"
                y2="20"
                stroke={isProDominant ? '#10b981' : isConDominant ? '#f43f5e' : '#00f0ff'}
                strokeWidth="2.5"
                strokeLinecap="round"
                filter="drop-shadow(0 0 4px rgba(0,240,255,0.6))"
              />
              <polygon
                points="77,24 83,24 80,14"
                fill={isProDominant ? '#10b981' : isConDominant ? '#f43f5e' : '#00f0ff'}
              />
            </g>
          </svg>

          <div className="flex items-center justify-between w-36 sm:w-44 text-[9px] text-slate-500 font-bold px-1 -mt-1">
            <span className="text-rose-400">CON (-100)</span>
            <span className="text-slate-400">0</span>
            <span className="text-emerald-400">PRO (+100)</span>
          </div>
        </div>

        {/* Center & Right: Segmented Percentages Breakdown & Fact Support */}
        <div className="col-span-1 md:col-span-2 space-y-3">
          {/* Tri-Color Split Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-emerald-400">PRO: {pro}%</span>
              <span className="text-slate-400">UNDECIDED: {undecided}%</span>
              <span className="text-rose-400">CON: {con}%</span>
            </div>

            <div className="h-3 rounded-full bg-white/5 border border-white/10 overflow-hidden flex p-0.5 gap-0.5">
              <div
                className="h-full rounded-l-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-1000 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                style={{ width: `${pro}%` }}
              />
              <div
                className="h-full bg-slate-600/70 transition-all duration-1000"
                style={{ width: `${undecided}%` }}
              />
              <div
                className="h-full rounded-r-full bg-gradient-to-r from-rose-500 to-red-600 transition-all duration-1000 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
                style={{ width: `${con}%` }}
              />
            </div>
          </div>

          {/* Evidence Metric Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] sm:text-[11px]">
            <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 flex items-center gap-1.5">
              <ShieldCheck size={13} className="shrink-0" />
              <span>{verdict.verifiedSupportCount} Verified Supported</span>
            </div>

            <div className="p-2 rounded-lg bg-rose-950/30 border border-rose-500/30 text-rose-300 flex items-center gap-1.5">
              <AlertTriangle size={13} className="shrink-0" />
              <span>{verdict.refutedCount} Refuted / Disputed</span>
            </div>

            <div className="p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/30 text-cyan-300 flex items-center gap-1.5 col-span-2 sm:col-span-1">
              <Sparkles size={13} className="shrink-0" />
              <span>Score: {verdict.weightedScore > 0 ? `+${verdict.weightedScore}` : verdict.weightedScore}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
