import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowUpRight, Radio, Timer, TrendingUp, Zap } from 'lucide-react';

export interface WorkflowTelemetryGraphicsProps {
  className?: string;
  isRunning?: boolean;
}

const SPARK_SAMPLES = 22;
const RADAR_NODE_COUNT = 8;
const RUN_BARS = [62, 48, 74, 55, 80, 40, 70, 58, 85, 52, 76, 64, 88, 68];
const FAILED_RUNS = new Set([2, 7, 11]);

function buildSparkPath(
  values: number[],
  width: number,
  height: number,
): { line: string; area: string; points: Array<{ x: number; y: number }> } {
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);
  const step = width / Math.max(values.length - 1, 1);
  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - ((value - min) / range) * (height - 14) - 7;
    return { x, y };
  });
  const line = `M${points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' L')}`;
  const area = `${line} L${width},${height} L0,${height} Z`;
  return { line, area, points };
}

function buildRadarNode(index: number): { x: number; y: number } {
  const angle = (Math.PI * 2 * index) / RADAR_NODE_COUNT - Math.PI / 2;
  return {
    x: 70 + Math.cos(angle) * 52,
    y: 70 + Math.sin(angle) * 52,
  };
}

function seedThroughput(): number[] {
  return Array.from(
    { length: SPARK_SAMPLES },
    (_, index) => 2600 + Math.sin(index / 2.3) * 420 + Math.random() * 280,
  );
}

export const WorkflowTelemetryGraphics: React.FC<WorkflowTelemetryGraphicsProps> = ({
  className = '',
  isRunning = false,
}) => {
  const [throughput, setThroughput] = useState<number>(3420);
  const [samples, setSamples] = useState<number[]>(seedThroughput);
  const [activeNode, setActiveNode] = useState(2);
  const [sweep, setSweep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const nextValue = 3150 + Math.floor(Math.random() * 520);
      setThroughput(nextValue);
      setSamples((previous) => [...previous.slice(1), nextValue]);
      setActiveNode((previous) => (previous + 1) % RADAR_NODE_COUNT);
      setSweep((previous) => (previous + 1) % RUN_BARS.length);
    }, 2200);

    return () => clearInterval(interval);
  }, []);

  const spark = useMemo(() => buildSparkPath(samples, 220, 72), [samples]);
  const lastPoint = useMemo(() => {
    const max = Math.max(...samples, 1);
    const min = Math.min(...samples);
    const range = Math.max(max - min, 1);
    const value = samples[samples.length - 1];
    return {
      x: 216,
      y: 72 - ((value - min) / range) * (72 - 14) - 7,
    };
  }, [samples]);

  const runSuccessRate = ((RUN_BARS.length - FAILED_RUNS.size) / RUN_BARS.length) * 100;

  return (
    <section
      aria-label="Workflow telemetry graphics"
      className={`w-full max-w-full overflow-hidden rounded-2xl bg-[#080d16]/95 border border-cyan-500/25 shadow-[0_12px_40px_rgba(0,0,0,0.6),0_0_24px_rgba(73,239,253,0.07)] backdrop-blur-xl mb-4 ${className}`}
    >
      <div className="relative px-3.5 sm:px-5 py-2.5 border-b border-cyan-500/20 bg-[#060a12]/80 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 shrink-0">
            <Activity size={14} className="text-cyan-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-mono text-xs sm:text-sm font-bold tracking-tight text-white uppercase truncate">
                Workflow Telemetry
              </h3>
              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                {isRunning ? 'EXECUTING' : 'LIVE MESH'}
              </span>
            </div>
            <p className="text-[11px] font-mono text-zinc-400 truncate">
              Throughput <span className="text-cyan-400">/</span> Node health{' '}
              <span className="text-emerald-400">/</span> Run timeline
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-auto font-mono text-[10px]">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#0b0f18] border border-zinc-800 text-zinc-400">
            <Radio size={11} className={isRunning ? 'text-cyan-400 animate-pulse' : 'text-zinc-500'} />
            SYNC <span className="text-emerald-400 font-semibold">99.8%</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#0b0f18] border border-zinc-800 text-zinc-400">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isRunning ? 'bg-cyan-400 animate-ping' : 'bg-emerald-400'
              }`}
            />
            {isRunning ? 'PROCESSING' : 'STANDBY'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 sm:p-4">
        <div className="relative rounded-xl border border-[#1f2128] bg-[#0b0f18]/80 p-3.5 overflow-hidden">
          <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-cyan-400/50 rounded-tl-xl" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-cyan-400/30 rounded-br-xl" />
          <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-cyan-400/25 rounded-tr-xl" />
          <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-cyan-400/25 rounded-bl-xl" />

          <div className="flex items-center justify-between mb-1.5 font-mono text-[8.5px] uppercase tracking-[0.12em]">
            <span className="text-zinc-500 flex items-center gap-1.5">
              <TrendingUp size={10} className="text-cyan-400" />
              SYS.METRIC // 01
            </span>
            <span className="text-zinc-600">PIPE: WF_STUDIO</span>
          </div>

          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-zinc-400">
              Throughput velocity
            </span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 font-mono text-[9px] text-emerald-300">
              <ArrowUpRight size={9} />
              +12.4%
            </span>
          </div>

          <div className="flex items-end gap-1.5 mb-1">
            <span className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-white leading-none">
              {throughput.toLocaleString()}
            </span>
            <span className="font-mono text-[10px] text-zinc-500 mb-0.5">tok/s</span>
            <span className="ml-auto font-mono text-[8.5px] text-zinc-500 mb-0.5 text-right leading-tight">
              PEAK
              <br />
              <span className="text-cyan-300">3,890</span>
            </span>
          </div>

          <div className="relative h-[72px] w-full">
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 220 72"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="wfTelemetryArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#49effd" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#49effd" stopOpacity="0" />
                </linearGradient>
                <filter id="wfTelemetryGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              {[18, 36, 54].map((y) => (
                <line
                  key={y}
                  x1="0"
                  x2="220"
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.05)"
                  strokeDasharray="2 4"
                />
              ))}
              <path d={spark.area} fill="url(#wfTelemetryArea)" />
              <path
                d={spark.line}
                fill="none"
                stroke="#49effd"
                strokeWidth="1.6"
                strokeLinejoin="miter"
                strokeLinecap="square"
                filter="url(#wfTelemetryGlow)"
              />
              {spark.points.map((point, index) =>
                index % 4 === 0 ? (
                  <circle
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    r="2.2"
                    fill="#0b0f18"
                    stroke="#49effd"
                    strokeWidth="1.2"
                  />
                ) : null,
              )}
              <circle cx={lastPoint.x} cy={lastPoint.y} r="2.6" fill="#49effd" />
              <circle
                cx={lastPoint.x}
                cy={lastPoint.y}
                r="5.5"
                fill="none"
                stroke="#49effd"
                strokeWidth="1"
                className="animate-ping"
                style={{ transformOrigin: `${lastPoint.x}px ${lastPoint.y}px` }}
              />
            </svg>
          </div>

          <div className="mt-1 flex items-center justify-between border-t border-white/5 pt-1 font-mono text-[8px] text-zinc-600">
            <span>-60s</span>
            <span>-45s</span>
            <span>-30s</span>
            <span>-15s</span>
            <span className="text-cyan-300">0s (NOW)</span>
          </div>

          <div className="mt-2">
            <div className="flex items-center justify-between font-mono text-[8px] uppercase tracking-[0.1em]">
              <span className="text-zinc-500">Synapse buffer capacity</span>
              <span className="text-cyan-300">78.5% engaged</span>
            </div>
            <div className="mt-1 flex gap-[2px] rounded-sm border border-[#1f2128] bg-[#090d15] p-[2px]">
              {Array.from({ length: 20 }, (_, index) => (
                <span
                  key={index}
                  className={`h-1.5 flex-1 ${
                    index < 16
                      ? 'bg-cyan-400 shadow-[0_0_5px_rgba(73,239,253,0.45)]'
                      : 'bg-[#272a32] border border-white/5'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="relative rounded-xl border border-[#1f2128] bg-[#0b0f18]/80 p-3.5 overflow-hidden">
          <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-cyan-400/50 rounded-tl-xl" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-cyan-400/30 rounded-br-xl" />
          <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-cyan-400/25 rounded-tr-xl" />
          <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-cyan-400/25 rounded-bl-xl" />

          <div className="flex items-center justify-between mb-1.5 font-mono text-[8.5px] uppercase tracking-[0.12em]">
            <span className="text-zinc-500 flex items-center gap-1.5">
              <Radio size={10} className="text-cyan-400" />
              SYS.MESH // 02
            </span>
            <span className="text-zinc-600">RING: CONSENSUS</span>
          </div>

          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-zinc-400">
              Node mesh health
            </span>
            <span className="font-mono text-[9px] text-zinc-500">8 NODES</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-[118px] h-[118px] shrink-0">
              <svg viewBox="0 0 140 140" className="h-full w-full" aria-hidden="true">
                <circle cx="70" cy="70" r="56" fill="none" stroke="#1f2128" strokeDasharray="3 5" />
                <circle
                  cx="70"
                  cy="70"
                  r="52"
                  fill="none"
                  stroke="rgba(73,239,253,0.28)"
                  strokeDasharray="18 12 4 14"
                  strokeWidth="1"
                  className="wf-telemetry-dash"
                  style={{ transformOrigin: '70px 70px' }}
                />
                <circle cx="70" cy="70" r="34" fill="none" stroke="#24272c" strokeDasharray="2 6" />
                <circle cx="70" cy="70" r="16" fill="rgba(73,239,253,0.06)" stroke="rgba(73,239,253,0.25)" />
                {Array.from({ length: RADAR_NODE_COUNT }, (_, index) => {
                  const { x, y } = buildRadarNode(index);
                  const isActive = index === activeNode;
                  const isError = index === 5;
                  const color = isError ? '#ef4444' : isActive ? '#49effd' : '#10b981';
                  return (
                    <g key={index}>
                      <circle cx={x} cy={y} r="4.5" fill={color} fillOpacity="0.16" stroke={color} strokeOpacity="0.45" />
                      <circle cx={x} cy={y} r="2" fill={color} />
                    </g>
                  );
                })}
                <circle
                  cx={buildRadarNode(activeNode).x}
                  cy={buildRadarNode(activeNode).y}
                  r="6"
                  fill="none"
                  stroke="#49effd"
                  className="wf-telemetry-pulse"
                  style={{ transformOrigin: `${buildRadarNode(activeNode).x}px ${buildRadarNode(activeNode).y}px` }}
                />
                <text
                  x="70"
                  y="67"
                  textAnchor="middle"
                  className="fill-white font-mono"
                  style={{ fontSize: '15px', fontWeight: 700 }}
                >
                  99.8%
                </text>
                <text
                  x="70"
                  y="80"
                  textAnchor="middle"
                  className="fill-zinc-500 font-mono"
                  style={{ fontSize: '6.4px', letterSpacing: '0.14em' }}
                >
                  SYNC QUALITY
                </text>
              </svg>
            </div>

            <div className="flex flex-col gap-1.5 font-mono text-[9px] text-zinc-400 min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#49effd]" /> ACTIVE 1
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> SYNCED 6
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> FAULT 1
              </span>
              <span className="mt-1 text-[8.5px] text-zinc-500 leading-snug">
                MESH LATENCY
                <br />
                <span className="text-cyan-300">18 ms</span>
              </span>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1 font-mono">
            {[
              { label: 'SAMPLE RATE', value: '100.2 kS/s', tone: 'text-cyan-200' },
              { label: 'DELTA JITTER', value: '±0.12 ms', tone: 'text-emerald-300' },
              { label: 'MEM ALLOC', value: '1.42 GB', tone: 'text-cyan-200' },
              { label: 'FRAME STATE', value: 'STABLE // OK', tone: 'text-cyan-300' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-sm border border-[#1f2128] bg-[#090d15] px-1.5 py-1">
                <p className="text-[7.5px] uppercase tracking-[0.08em] text-zinc-500">{stat.label}</p>
                <p className={`text-[9px] font-semibold tabular-nums ${stat.tone}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-1.5 flex items-center justify-between font-mono text-[8px] text-zinc-600">
            <span>CONSENSUS RING</span>
            <span className="text-emerald-300">stable</span>
          </div>
        </div>

        <div className="relative rounded-xl border border-[#1f2128] bg-[#0b0f18]/80 p-3.5 overflow-hidden">
          <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-cyan-400/50 rounded-tl-xl" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-cyan-400/30 rounded-br-xl" />
          <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-cyan-400/25 rounded-tr-xl" />
          <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-cyan-400/25 rounded-bl-xl" />

          <div className="flex items-center justify-between mb-1.5 font-mono text-[8.5px] uppercase tracking-[0.12em]">
            <span className="text-zinc-500 flex items-center gap-1.5">
              <Timer size={10} className="text-cyan-400" />
              SYS.RUNS // 03
            </span>
            <span className="text-zinc-600">QUEUE: PRIORITY</span>
          </div>

          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-zinc-400">
              Run timeline
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 font-mono text-[9px] text-cyan-300">
              <Zap size={9} />
              {isRunning ? 'LIVE' : 'CACHED'}
            </span>
          </div>

          <div className="relative h-16 flex items-end gap-1 overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-transparent via-cyan-300/15 to-transparent wf-telemetry-scan pointer-events-none" />
            {RUN_BARS.map((height, index) => {
              const failed = FAILED_RUNS.has(index);
              const isCurrent = index === sweep;
              return (
                <div
                  key={index}
                  title={`Run ${index + 1} — ${failed ? 'failed' : 'success'}`}
                  className={`flex-1 rounded-t-sm transition-all duration-300 ${
                    failed
                      ? 'bg-red-400/70'
                      : isCurrent
                        ? 'bg-cyan-300 shadow-[0_0_8px_rgba(73,239,253,0.55)]'
                        : 'bg-emerald-400/60'
                  }`}
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <div className="rounded-md border border-[#1f2128] bg-[#090d15] px-2 py-1.5">
              <p className="font-mono text-[8.5px] uppercase tracking-wider text-zinc-500">Success</p>
              <p className="font-mono text-sm font-bold tabular-nums text-emerald-300">
                {runSuccessRate.toFixed(1)}%
              </p>
            </div>
            <div className="rounded-md border border-[#1f2128] bg-[#090d15] px-2 py-1.5">
              <p className="font-mono text-[8.5px] uppercase tracking-wider text-zinc-500">P95 Latency</p>
              <p className="font-mono text-sm font-bold tabular-nums text-cyan-300">4.8s</p>
            </div>
          </div>

          <div className="mt-1.5 flex items-center justify-between font-mono text-[8px] text-zinc-600">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-1 h-1 bg-cyan-400" />
              ORCHESTRATOR // CLUSTER: US_EAST_4
            </span>
            <span>
              <span className="text-red-300">{FAILED_RUNS.size}</span>/{RUN_BARS.length} failed
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
