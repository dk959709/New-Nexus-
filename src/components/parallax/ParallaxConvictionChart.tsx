import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { Activity, TrendingUp, Eye, EyeOff, Sparkles } from 'lucide-react';
import { AGENT_QUADRANTS } from '@/data/parallaxQuadrants';
import type { ParallaxMessage } from '@/types';

export interface ParallaxConvictionChartProps {
  messages: ParallaxMessage[];
}

interface QuadrantConfig {
  key: string;
  name: string;
  color: string;
}

const QUADRANTS: QuadrantConfig[] = [
  { key: 'optimists', name: 'Techno-Optimism', color: '#00f0ff' },
  { key: 'realists', name: 'Critical Realism', color: '#f59e0b' },
  { key: 'ethicists', name: 'Ethics & Philosophy', color: '#c084fc' },
  { key: 'visionaries', name: 'Creative Vision', color: '#10b981' },
];

export const ParallaxConvictionChart: React.FC<ParallaxConvictionChartProps> = ({ messages }) => {
  const [visibleQuadrants, setVisibleQuadrants] = useState<Record<string, boolean>>({
    optimists: true,
    realists: true,
    ethicists: true,
    visionaries: true,
  });

  const toggleQuadrant = (key: string) => {
    setVisibleQuadrants((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Compute average conviction percentage (0 to 100%) per quadrant across rounds 1, 2, 3
  const chartData = useMemo(() => {
    const rounds = [1, 2, 3] as const;

    return rounds.map((round) => {
      const roundMsgs = messages.filter((m) => m.round === round && !m.isHuman);
      const dataPoint: Record<string, number | string | null> = {
        name: `Round 0${round}`,
        round: `R${round}`,
      };

      for (const q of QUADRANTS) {
        const qMsgs = roundMsgs.filter((m) => {
          const qInfo = AGENT_QUADRANTS[m.agentId.toLowerCase()];
          return qInfo && qInfo.quadrant === q.key;
        });

        const scored = qMsgs
          .map((m) => {
            const raw =
              typeof m.conviction === 'number'
                ? m.conviction
                : typeof (m as { convictionScore?: number }).convictionScore === 'number'
                ? (m as { convictionScore?: number }).convictionScore!
                : null;
            if (raw === null || Number.isNaN(raw)) return null;
            return raw <= 10 ? Math.round(raw * 10) : Math.round(raw);
          })
          .filter((v): v is number => v !== null);

        if (scored.length > 0) {
          const avgConviction = scored.reduce((acc, val) => acc + val, 0) / scored.length;
          dataPoint[q.key] = Math.round(avgConviction);
        } else {
          dataPoint[q.key] = null;
        }
      }

      return dataPoint;
    });
  }, [messages]);

  const hasData = useMemo(() => {
    return messages.some(
      (m) =>
        !m.isHuman &&
        (typeof m.conviction === 'number' ||
          typeof (m as { convictionScore?: number }).convictionScore === 'number'),
    );
  }, [messages]);

  return (
    <div
      id="parallax-conviction-chart"
      className="py-4 sm:py-5 border-b border-white/[0.06] font-mono select-none min-w-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3.5 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-slate-900/40 backdrop-blur-xl grid place-items-center text-cyan-400 shrink-0">
            <TrendingUp size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-black text-slate-100 uppercase tracking-wider">
                CONVICTION SHIFT TRAJECTORY
              </span>
              <span className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full bg-slate-900/40 backdrop-blur-xl text-cyan-300">
                QUADRANT MEAN (%)
              </span>
            </div>
            <p className="m-0 text-[10px] sm:text-[11px] text-slate-300 font-sans">
              Mean conviction score (0–100%) per ideological quadrant across Round 1 → 2 → 3
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-slate-300">
          <Activity size={12} className="text-cyan-400 animate-pulse" />
          <span>{hasData ? 'LIVE TELEMETRY' : 'AWAITING SCORES'}</span>
        </div>
      </div>

      {/* Interactive Legend Toggle Pills */}
      <div className="flex items-center gap-1.5 sm:gap-2 mb-3.5 flex-wrap">
        <span className="text-[10px] text-slate-300 font-bold uppercase mr-1 hidden sm:inline">
          Filter:
        </span>
        {QUADRANTS.map((q) => {
          const isVisible = visibleQuadrants[q.key];
          return (
            <button
              key={q.key}
              type="button"
              onClick={() => toggleQuadrant(q.key)}
              className={`px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 bg-slate-900/40 backdrop-blur-xl ${
                isVisible
                  ? 'shadow-sm'
                  : 'text-slate-500 opacity-50'
              }`}
              style={{
                background: isVisible ? `${q.color}20` : undefined,
                color: isVisible ? q.color : undefined,
              }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: q.color }} />
              <span>{q.name}</span>
              {isVisible ? <Eye size={11} /> : <EyeOff size={11} />}
            </button>
          );
        })}
      </div>

      {/* Chart Canvas Area */}
      <div className="h-44 sm:h-56 w-full relative">
        {!hasData ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-[#0b101b]/50 rounded-xl border border-white/[0.05]">
            <Sparkles size={18} className="text-cyan-400/40 mb-2 animate-pulse" />
            <span className="text-xs text-slate-400">
              No conviction scores recorded yet. Trajectory will plot as agents log scored turns across rounds.
            </span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="name"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <ReferenceLine y={50} stroke="rgba(0, 240, 255, 0.25)" strokeDasharray="4 4" />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="p-2.5 rounded-xl bg-slate-950/95 border border-cyan-500/40 shadow-2xl backdrop-blur-md text-[11px] font-mono space-y-1">
                        <div className="font-bold text-cyan-300 border-b border-white/10 pb-1 mb-1">
                          {label} Mean Conviction
                        </div>
                        {payload.map((entry, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-3">
                            <span style={{ color: entry.color }}>{entry.name}:</span>
                            <span className="font-bold text-white">
                              {entry.value !== null && entry.value !== undefined
                                ? `${entry.value}%`
                                : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {QUADRANTS.map((q) => {
                if (!visibleQuadrants[q.key]) return null;
                return (
                  <Line
                    key={q.key}
                    type="monotone"
                    dataKey={q.key}
                    name={q.name}
                    stroke={q.color}
                    strokeWidth={2.5}
                    connectNulls={false}
                    dot={{ r: 4, fill: q.color, strokeWidth: 1.5, stroke: '#030810' }}
                    activeDot={{ r: 6, fill: q.color, stroke: '#ffffff', strokeWidth: 2 }}
                    isAnimationActive={true}
                    animationDuration={600}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Axis Guide */}
      <div className="flex items-center justify-between gap-2 text-[9px] sm:text-[10px] text-slate-400 font-mono pt-2 border-t border-white/5 mt-2 flex-wrap">
        <span>0–54% (SKEPTICAL / LOW)</span>
        <span className="text-cyan-400/80">55–74% (BALANCED)</span>
        <span>75–100% (HIGH CONVICTION)</span>
      </div>
    </div>
  );
};

