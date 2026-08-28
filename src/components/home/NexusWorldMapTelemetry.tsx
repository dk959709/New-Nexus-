import React, { useState, useEffect } from 'react';
import { RefreshCw, Zap, Clock } from 'lucide-react';

interface DataHub {
  id: string;
  name: string;
  x: number; // Percentage 0 - 100
  y: number; // Percentage 0 - 100
  color: string;
  ping: number; // ms
}

const HUBS: DataHub[] = [
  { id: 'us-west', name: 'US-WEST (Silicon Valley)', x: 19, y: 36, color: '#22d3ee', ping: 12 },
  { id: 'us-east', name: 'US-EAST (Virginia)', x: 28, y: 38, color: '#34d399', ping: 18 },
  { id: 'eu-west', name: 'EU-CENTRAL (Frankfurt)', x: 51, y: 28, color: '#a855f7', ping: 32 },
  { id: 'asia-east', name: 'ASIA-EAST (Tokyo)', x: 82, y: 37, color: '#38bdf8', ping: 45 },
  { id: 'asia-se', name: 'ASIA-SE (Singapore)', x: 74, y: 58, color: '#f59e0b', ping: 52 },
  { id: 'aus-east', name: 'AUS-EAST (Sydney)', x: 86, y: 78, color: '#ec4899', ping: 68 },
];

const ARCS = [
  { from: 'us-west', to: 'us-east', stroke: '#38bdf8' },
  { from: 'us-east', to: 'eu-west', stroke: '#a855f7' },
  { from: 'eu-west', to: 'asia-se', stroke: '#f59e0b' },
  { from: 'asia-se', to: 'asia-east', stroke: '#34d399' },
  { from: 'us-west', to: 'asia-east', stroke: '#22d3ee' },
  { from: 'asia-se', to: 'aus-east', stroke: '#ec4899' },
];

interface NexusWorldMapTelemetryProps {
  onSendChatMessage?: (message: string) => void;
  isAiResponding?: boolean;
}

export function NexusWorldMapTelemetry({
  onSendChatMessage,
  isAiResponding = false,
}: NexusWorldMapTelemetryProps) {
  const [activeHub, setActiveHub] = useState<DataHub>(HUBS[0]);
  const [pulseCount, setPulseCount] = useState(0);
  const [inputQuery, setInputQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  });

  // Live updating clock (every second)
  useEffect(() => {
    const clockTimer = setInterval(() => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      setCurrentTime(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Hub pulse cycle
  useEffect(() => {
    const timer = setInterval(() => {
      setPulseCount((prev) => prev + 1);
      const nextIdx = Math.floor(Math.random() * HUBS.length);
      setActiveHub(HUBS[nextIdx]);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputQuery.trim();
    if (!trimmed || isAiResponding) return;
    if (onSendChatMessage) {
      onSendChatMessage(trimmed);
      setInputQuery('');
    }
  };

  return (
    <div
      id="nexus-world-map-telemetry"
      className="relative w-full h-72 sm:h-80 rounded-2xl overflow-hidden bg-slate-950/85 border border-cyan-500/30 p-2.5 flex flex-col items-center justify-between select-none shadow-[inset_0_0_30px_rgba(6,182,212,0.12)]"
    >
      {/* Background Matrix Grid */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(34,211,238,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.15) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Top Telemetry Header Bar with Live Clock */}
      <div className="relative z-10 w-full flex items-center justify-between px-2 pt-1 text-[11px] font-mono">
        <div className="flex items-center gap-2 text-cyan-400">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping inline-block" />
          <span className="tracking-widest font-bold uppercase text-[10px] text-cyan-300/90">
            GLOBAL TELEMETRY RADAR
          </span>
        </div>

        {/* Live-Updating Clock (HH:MM:SS) */}
        <div
          id="map-telemetry-live-clock"
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 font-mono text-[11px] tracking-widest shadow-[0_0_10px_rgba(34,211,238,0.2)]"
        >
          <Clock size={11} className="text-emerald-400 animate-pulse" />
          <span className="text-emerald-300 font-bold">{currentTime}</span>
          <span className="text-[9px] text-cyan-400/70">UTC</span>
        </div>
      </div>

      {/* Map + Radar Container Area */}
      <div className="relative w-full flex-1 flex items-center justify-center overflow-hidden my-1">
        {/* Radar Sweep Effect (Rotating 360° around center at 18-22% opacity) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-20">
          {/* Rotating Radar Conical Fan with bright leading edge */}
          <div
            className="w-[420px] h-[420px] rounded-full relative"
            style={{
              background:
                'conic-gradient(from 0deg, rgba(34, 211, 238, 0.8) 0deg, rgba(52, 211, 153, 0.4) 30deg, rgba(168, 85, 247, 0.15) 60deg, transparent 90deg, transparent 360deg)',
              animation: 'spin 4s linear infinite',
            }}
          >
            {/* Leading Edge Highlight Line */}
            <div
              className="absolute top-0 left-1/2 w-[2px] h-[210px] bg-gradient-to-t from-cyan-300 to-white shadow-[0_0_8px_#22d3ee] origin-bottom transform -translate-x-1/2"
            />
          </div>

          {/* Subtle Radar Concentric Distance Rings */}
          <div className="absolute w-[140px] h-[140px] rounded-full border border-cyan-400/30 pointer-events-none" />
          <div className="absolute w-[280px] h-[280px] rounded-full border border-cyan-400/20 pointer-events-none" />
          <div className="absolute w-[400px] h-[400px] rounded-full border border-cyan-400/10 pointer-events-none" />
          {/* Crosshair grid lines */}
          <div className="absolute w-full h-[1px] bg-cyan-500/10 pointer-events-none" />
          <div className="absolute h-full w-[1px] bg-cyan-500/10 pointer-events-none" />
        </div>

        {/* SVG World Map & Telemetry Mesh */}
        <svg
          viewBox="0 0 1000 500"
          className="relative w-full h-40 sm:h-48 object-contain filter drop-shadow-[0_0_16px_rgba(6,182,212,0.3)] z-0"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="arcGlowCyan" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#a855f7" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.8" />
            </linearGradient>

            <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Continents Silhouettes */}
          {/* North America */}
          <path
            d="M130,70 Q210,60 270,100 Q310,140 280,190 Q240,210 210,270 Q170,250 130,190 Q90,150 130,70 Z"
            fill="rgba(34,211,238,0.08)"
            stroke="#22d3ee"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.6"
          />
          {/* South America */}
          <path
            d="M250,270 Q310,290 330,350 Q310,430 260,460 Q230,410 240,330 Z"
            fill="rgba(34,211,238,0.06)"
            stroke="#22d3ee"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.5"
          />
          {/* Europe */}
          <path
            d="M450,80 Q530,70 560,130 Q520,180 470,170 Q430,140 450,80 Z"
            fill="rgba(168,85,247,0.08)"
            stroke="#a855f7"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.6"
          />
          {/* Africa */}
          <path
            d="M450,190 Q540,190 560,270 Q540,390 480,410 Q420,330 450,190 Z"
            fill="rgba(34,211,238,0.06)"
            stroke="#22d3ee"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.5"
          />
          {/* Asia */}
          <path
            d="M560,90 Q720,60 850,110 Q890,210 820,290 Q740,250 670,220 Q580,200 560,90 Z"
            fill="rgba(52,211,153,0.08)"
            stroke="#34d399"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.6"
          />
          {/* Australia */}
          <path
            d="M770,330 Q870,320 890,390 Q850,440 780,420 Q750,370 770,330 Z"
            fill="rgba(236,72,153,0.08)"
            stroke="#ec4899"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.6"
          />

          {/* Global Connection Arcs */}
          {ARCS.map((arc, i) => {
            const fromHub = HUBS.find((h) => h.id === arc.from)!;
            const toHub = HUBS.find((h) => h.id === arc.to)!;
            const x1 = (fromHub.x / 100) * 1000;
            const y1 = (fromHub.y / 100) * 500;
            const x2 = (toHub.x / 100) * 1000;
            const y2 = (toHub.y / 100) * 500;
            const midX = (x1 + x2) / 2;
            const midY = Math.min(y1, y2) - 60 - (i % 3) * 15;

            const pathD = `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`;

            return (
              <g key={`arc-${arc.from}-${arc.to}`}>
                {/* Background trace line */}
                <path
                  d={pathD}
                  stroke={arc.stroke}
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.4"
                  fill="none"
                />
                {/* Animated pulse packet traveling the arc */}
                <path
                  d={pathD}
                  stroke="url(#arcGlowCyan)"
                  strokeWidth="2.5"
                  strokeDasharray="20 180"
                  strokeDashoffset={-(pulseCount * 40 + i * 30) % 200}
                  filter="url(#glowFilter)"
                  fill="none"
                  opacity="0.85"
                />
              </g>
            );
          })}

          {/* Telemetry Node Points */}
          {HUBS.map((hub) => {
            const cx = (hub.x / 100) * 1000;
            const cy = (hub.y / 100) * 500;
            const isSelected = activeHub.id === hub.id;

            return (
              <g
                key={hub.id}
                className="cursor-pointer"
                onClick={() => setActiveHub(hub)}
              >
                {/* Pulsing Outer Rings */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? 18 : 12}
                  fill={hub.color}
                  fillOpacity={isSelected ? '0.2' : '0.1'}
                  stroke={hub.color}
                  strokeWidth="1"
                  className="animate-ping"
                  style={{ animationDuration: isSelected ? '1.8s' : '3s' }}
                />

                {/* Middle Circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? 8 : 5}
                  fill="#050814"
                  stroke={hub.color}
                  strokeWidth="2"
                />

                {/* Core Dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? 4 : 2.5}
                  fill={hub.color}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* COLORFUL INLINE CHAT INPUT BAR (Vibrant Neon Gradient Border Pill Style) */}
      <div className="relative z-10 w-full mt-auto pt-1">
        <form
          onSubmit={handleSearchSubmit}
          className="relative group rounded-full p-[2px] bg-gradient-to-r from-emerald-400 via-cyan-400 to-fuchsia-500 shadow-[0_0_25px_rgba(45,212,191,0.3)] hover:shadow-[0_0_35px_rgba(168,85,247,0.45)] transition-all duration-300"
        >
          <div className="flex items-center gap-2 bg-[#030712] rounded-full px-3.5 py-1.5 sm:py-2">
            {/* Bright Green "$" prompt symbol */}
            <span className="text-emerald-400 font-bold text-base sm:text-lg select-none pl-1">
              $
            </span>

            {/* Chat text input */}
            <input
              id="terminal-chat-input"
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              disabled={isAiResponding}
              placeholder="Ask JARVIS AI assistant anything..."
              aria-label="JARVIS AI Assistant Chat input"
              className="w-full bg-transparent border-none text-slate-100 placeholder:text-slate-500 font-mono text-xs sm:text-sm outline-none tracking-wide focus:outline-none focus:ring-0 px-1 py-0.5 disabled:opacity-50"
            />

            {/* Glowing Neon ASK button */}
            <button
              type="submit"
              disabled={!inputQuery.trim() || isAiResponding}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-teal-300 hover:from-cyan-300 hover:to-emerald-200 text-slate-950 font-bold font-mono tracking-wider text-xs shadow-[0_0_16px_rgba(34,211,238,0.55)] hover:shadow-[0_0_22px_rgba(52,211,153,0.7)] active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all select-none shrink-0"
            >
              {isAiResponding ? (
                <RefreshCw size={12} className="animate-spin text-slate-950" />
              ) : (
                <>
                  <Zap size={12} className="fill-slate-950 text-slate-950" />
                  <span className="font-extrabold text-[11px]">ASK</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
