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

  // Compute average conviction score (-100 to +100) per quadrant across rounds 1, 2, 3
  const chartData = useMemo(() => {
    const rounds = [1, 2, 3] as const;

    return rounds.map((round) => {
      const roundMsgs = messages.filter((m) => m.round === round);
      const dataPoint: Record<string, number | string> = {
        name: `Round 0${round}`,
        round: `R${round}`,
      };

      for (const q of QUADRANTS) {
        // Collect messages from agents belonging to this quadrant
        const qMsgs = roundMsgs.filter((m) => {
          const qInfo = AGENT_QUADRANTS[m.agentId.toLowerCase()];
          return qInfo && qInfo.quadrant === q.key;
        });

        if (qMsgs.length > 0) {
          // Normalize conviction score to -100 to +100
          const avgConviction =
            qMsgs.reduce((acc, m) => {
              const raw = typeof m.conviction === 'number' ? m.conviction : 0;
              // Normalize: if in range 0-10, scale to -100..+100 based on quadrant baseline
              if (raw >= -100 && raw <= 100) return acc + raw;
              return acc + raw * 10;
            }, 0) / qMsgs.length;

          dataPoint[q.key] = Math.round(avgConviction);
        } else {
          // Fallback baseline position if round has not arrived yet
          dataPoint[q.key] = 0;
        }
      }

      return dataPoint;
    });
  }, [messages]);

  const hasData = messages.length > 0;

  return (
    <div
      id="parallax-conviction-chart"
      className="rounded-xl sm:rounded-2xl p-3 sm:p-5 font-mono select-none"
      style={{
        background: 'linear-gradient(135deg, rgba(4, 16, 28, 0.94) 0%, rgba(2, 8, 16, 0.98) 100%)',
        border: '1px solid rgba(0, 240, 255, 0.25)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 0 20px rgba(0, 240, 255, 0.04)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 grid place-items-center text-cyan-400 shrink-0">
            <TrendingUp size={15} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                CONVICTION SHIFT TRAJECTORY
              </span>
              <span className="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                QUADRANT DYNAMICS
              </span>
            </div>
            <p className="m-0 text-[10px] sm:text-[11px] text-slate-400 font-sans">
              Tracks ideological position shifts (-100 to +100) across Round 1 → 2 → 3
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <Activity size={12} className="text-cyan-400 animate-pulse" />
          <span>REAL-TIME TELEMETRY</span>
        </div>
      </div>

      {/* Interactive Legend Toggle Pills */}
      <div className="flex items-center gap-1.5 sm:gap-2 mb-3.5 flex-wrap">
        <span className="text-[10px] text-slate-500 font-bold uppercase mr-1 hidden sm:inline">
          Filter:
        </span>
        {QUADRANTS.map((q) => {
          const isVisible = visibleQuadrants[q.key];
          return (
            <button
              key={q.key}
              type="button"
              onClick={() => toggleQuadrant(q.key)}
              className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                isVisible
                  ? 'border shadow-sm'
                  : 'bg-white/[0.02] text-slate-600 border border-white/5 opacity-50'
              }`}
              style={{
                background: isVisible ? `${q.color}15` : undefined,
                color: isVisible ? q.color : undefined,
                borderColor: isVisible ? `${q.color}50` : undefined,
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
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
            <Sparkles size={18} className="text-cyan-400/40 mb-2 animate-pulse" />
            <span className="text-xs text-slate-400">
              Conviction trajectory will stream as agents deliver perspectives across rounds.
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
                domain={[-100, 100]}
                ticks={[-100, -50, 0, 50, 100]}
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <ReferenceLine y={0} stroke="rgba(0, 240, 255, 0.25)" strokeDasharray="4 4" />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="p-2.5 rounded-xl bg-slate-950/95 border border-cyan-500/40 shadow-2xl backdrop-blur-md text-[11px] font-mono space-y-1">
                        <div className="font-bold text-cyan-300 border-b border-white/10 pb-1 mb-1">
                          {label} Trajectory
                        </div>
                        {payload.map((entry, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-3">
                            <span style={{ color: entry.color }}>{entry.name}:</span>
                            <span className="font-bold text-white">
                              {Number(entry.value) > 0 ? `+${entry.value}` : entry.value}
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
      <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-slate-500 font-mono pt-2 border-t border-white/5 mt-2">
        <span>-100 (HIGH CRITICISM / RESISTANCE)</span>
        <span className="text-cyan-400/80">0 (NEUTRAL EQUILIBRIUM)</span>
        <span>+100 (HIGH CONVICTION / ACCELERATION)</span>
      </div>
    </div>
  );
};
