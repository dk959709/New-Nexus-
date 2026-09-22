import React, { useEffect, useRef } from 'react';
import {
  Radio,
  Activity,
  Zap,
  Volume2,
  VolumeX,
  Clock,
  Layers,
  CheckCircle2,
  AlertCircle,
  Square,
} from 'lucide-react';

export type LiveConnectionState =
  | 'idle'
  | 'connecting'
  | 'session_ready'
  | 'streaming'
  | 'finishing'
  | 'completed'
  | 'interrupted'
  | 'timeout'
  | 'error';

interface LiveWaveformVisualizerProps {
  analyserNode: AnalyserNode | null;
  isPlaying: boolean;
  isStreaming: boolean;
  status: LiveConnectionState;
  chunksCount: number;
  totalBytes: number;
  timeToFirstChunkMs: number | null;
  streamDurationSec: number;
  wordProgress: { current: number; total: number } | null;
  volume: number;
  isMuted: boolean;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onStop: () => void;
  onHardStop?: () => void;
}

export function LiveWaveformVisualizer({
  analyserNode,
  isPlaying,
  isStreaming,
  status,
  chunksCount,
  totalBytes,
  timeToFirstChunkMs,
  streamDurationSec,
  wordProgress,
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
  onStop,
  onHardStop,
}: LiveWaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const peaksRef = useRef<number[]>(new Array(48).fill(0));
  const simPhaseRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isMounted = true;

    const render = () => {
      if (!isMounted) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Deep dark background
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, width, height);

      // Subtle cyber grid lines
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.04)';
      ctx.lineWidth = 1;
      const gridSpacing = 24;
      for (let x = 0; x < width; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Center baseline glow
      const midY = height * 0.55;
      const gradientCenter = ctx.createRadialGradient(
        width / 2,
        midY,
        10,
        width / 2,
        midY,
        width * 0.45
      );
      if (status === 'streaming') {
        gradientCenter.addColorStop(0, 'rgba(168, 85, 247, 0.18)');
        gradientCenter.addColorStop(0.5, 'rgba(6, 182, 212, 0.08)');
        gradientCenter.addColorStop(1, 'rgba(2, 6, 23, 0)');
      } else if (status === 'connecting') {
        gradientCenter.addColorStop(0, 'rgba(245, 158, 11, 0.15)');
        gradientCenter.addColorStop(1, 'rgba(2, 6, 23, 0)');
      } else {
        gradientCenter.addColorStop(0, 'rgba(99, 102, 241, 0.08)');
        gradientCenter.addColorStop(1, 'rgba(2, 6, 23, 0)');
      }
      ctx.fillStyle = gradientCenter;
      ctx.fillRect(0, 0, width, height);

      // Data extraction or simulation
      const barCount = 48;
      const freqData = new Uint8Array(barCount);
      let hasRealAudio = false;

      if (analyserNode && isPlaying && !isMuted) {
        const bufferLength = analyserNode.frequencyBinCount;
        const rawData = new Uint8Array(bufferLength);
        analyserNode.getByteFrequencyData(rawData);

        // Subsample frequency bins
        const step = Math.floor(bufferLength / barCount) || 1;
        let sum = 0;
        for (let i = 0; i < barCount; i++) {
          const val = rawData[i * step] || 0;
          freqData[i] = val;
          sum += val;
        }
        if (sum > 20) {
          hasRealAudio = true;
        }
      }

      // If playing/streaming without Web Audio tap active, generate organic speech waves
      if (!hasRealAudio && (isPlaying || status === 'streaming')) {
        simPhaseRef.current += 0.08;
        const p = simPhaseRef.current;
        for (let i = 0; i < barCount; i++) {
          const norm = i / barCount;
          // Natural speech envelope bell curve with dynamic harmonic oscillation
          const bell = Math.sin(norm * Math.PI);
          const speechPulse =
            Math.sin(p * 2 + norm * 8) * 0.35 +
            Math.sin(p * 4.3 + norm * 14) * 0.25 +
            Math.sin(p * 0.7) * 0.2 +
            0.55;
          const val = Math.max(12, Math.min(235, bell * speechPulse * 220));
          freqData[i] = val;
        }
      } else if (!hasRealAudio) {
        // Idle gentle breathing baseline
        simPhaseRef.current += 0.02;
        const p = simPhaseRef.current;
        for (let i = 0; i < barCount; i++) {
          const norm = i / barCount;
          const idleWave = Math.sin(p + norm * 4) * 6 + 10;
          freqData[i] = idleWave;
        }
      }

      // Draw Spectrum Bars
      const marginX = 24;
      const usableWidth = width - marginX * 2;
      const barWidth = Math.max(2.5, (usableWidth / barCount) - 3);
      const maxHeight = height * 0.5;

      for (let i = 0; i < barCount; i++) {
        const x = marginX + i * ((usableWidth) / barCount);
        const normalized = freqData[i] / 255;
        const barHeight = Math.max(4, normalized * maxHeight);

        // Decay peak values
        if (barHeight > peaksRef.current[i]) {
          peaksRef.current[i] = barHeight;
        } else {
          peaksRef.current[i] = Math.max(4, peaksRef.current[i] - 1.2);
        }

        // Gradient bar
        const barGrad = ctx.createLinearGradient(x, midY - barHeight, x, midY + barHeight * 0.3);
        if (status === 'streaming' || status === 'finishing' || status === 'session_ready') {
          barGrad.addColorStop(0, '#c084fc'); // purple-400
          barGrad.addColorStop(0.5, '#a855f7'); // purple-500
          barGrad.addColorStop(1, '#06b6d4'); // cyan-500
        } else if (status === 'connecting') {
          barGrad.addColorStop(0, '#fcd34d'); // amber-300
          barGrad.addColorStop(1, '#d97706'); // amber-600
        } else {
          barGrad.addColorStop(0, '#818cf8'); // indigo-400
          barGrad.addColorStop(1, '#3b82f6'); // blue-500
        }

        ctx.fillStyle = barGrad;
        ctx.beginPath();
        // Top half
        ctx.roundRect(x, midY - barHeight, barWidth, barHeight, [2, 2, 0, 0]);
        ctx.fill();

        // Subtle mirror reflection below baseline
        ctx.fillStyle = 'rgba(168, 85, 247, 0.12)';
        ctx.beginPath();
        ctx.roundRect(x, midY + 2, barWidth, barHeight * 0.35, [0, 0, 2, 2]);
        ctx.fill();

        // Floating peak cap
        const peakY = midY - peaksRef.current[i] - 3;
        ctx.fillStyle = status === 'streaming' || status === 'finishing' || status === 'session_ready' ? '#38bdf8' : '#cbd5e1';
        ctx.fillRect(x, peakY, barWidth, 1.5);
      }

      // Draw Center Baseline Horizon
      ctx.strokeStyle = status === 'streaming' || status === 'finishing' || status === 'session_ready' ? 'rgba(168, 85, 247, 0.4)' : 'rgba(148, 163, 184, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(marginX, midY);
      ctx.lineTo(width - marginX, midY);
      ctx.stroke();

      ctx.restore();
      animFrameIdRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isMounted = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [analyserNode, isPlaying, isStreaming, isMuted, status]);

  // Format elapsed seconds as MM:SS.s
  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const tenths = Math.floor((sec % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${tenths}`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="bg-slate-950 border border-purple-500/30 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 left-1/4 w-72 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar: Live Status indicator + Telemetry Chips */}
      <div className="flex items-center justify-between flex-wrap gap-3 relative z-10">
        {/* Status Badge */}
        <div className="flex items-center gap-2.5">
          {status === 'streaming' && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-semibold shadow-sm animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping inline-block" />
              <Radio size={13} className="text-rose-400 animate-bounce" />
              <span className="font-mono tracking-wide">LIVE STREAMING</span>
            </div>
          )}

          {status === 'session_ready' && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-semibold shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
              <Radio size={13} className="text-emerald-400" />
              <span className="font-mono tracking-wide">LIVE SESSION READY</span>
            </div>
          )}

          {status === 'finishing' && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/25 border border-purple-500/50 text-purple-200 text-xs font-semibold shadow-sm animate-pulse">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping inline-block" />
              <Activity size={13} className="text-purple-400 animate-spin" />
              <span className="font-mono tracking-wide">FINISHING PLAYBACK...</span>
            </div>
          )}

          {status === 'connecting' && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
              <Activity size={13} className="text-amber-400 animate-spin" />
              <span className="font-mono tracking-wide">CONNECTING WEBSOCKET...</span>
            </div>
          )}

          {status === 'completed' && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
              <CheckCircle2 size={13} className="text-emerald-400" />
              <span className="font-mono tracking-wide">SESSION ENDED</span>
            </div>
          )}

          {status === 'interrupted' && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold">
              <Square size={12} className="text-slate-400" />
              <span className="font-mono tracking-wide">AUDIO STOPPED</span>
            </div>
          )}

          {status === 'timeout' && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold">
              <Clock size={13} className="text-amber-400" />
              <span className="font-mono tracking-wide">SESSION IDLE TIMEOUT (20s)</span>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold">
              <AlertCircle size={13} className="text-rose-400" />
              <span className="font-mono tracking-wide">STREAM ERROR</span>
            </div>
          )}

          {status === 'idle' && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-slate-500 inline-block" />
              <span className="font-mono tracking-wide">STANDBY • READY TO START</span>
            </div>
          )}

          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            24 kHz PCM Stream
          </span>
          <span className="text-[11px] font-mono text-purple-300/70 hidden lg:inline-block">
            wss://api.elevenlabs.io/v1/text-to-speech/.../stream-input
          </span>
        </div>

        {/* Real-time Session Control Buttons when active */}
        {(status === 'session_ready' || status === 'streaming' || status === 'connecting' || status === 'finishing') && (
          <div className="flex items-center gap-2 animate-fadeIn">
            {onHardStop && (status === 'streaming' || status === 'finishing') && (
              <button
                type="button"
                onClick={onHardStop}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-rose-300 hover:text-white font-semibold text-xs transition shadow-md flex items-center gap-1.5 cursor-pointer transform active:scale-95"
                title="Immediately stop all currently playing audio"
              >
                <Square size={11} className="fill-current" />
                <span>Stop Audio</span>
              </button>
            )}
            <button
              type="button"
              onClick={onStop}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-md flex items-center gap-1.5 cursor-pointer transform active:scale-95"
              title="Gracefully end live session after audio completes"
            >
              <Square size={12} className="fill-current" />
              <span>End Session</span>
            </button>
          </div>
        )}
      </div>

      {/* The Animated Waveform Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950/90 shadow-inner">
        <canvas
          ref={canvasRef}
          className="w-full h-36 sm:h-44 block"
          title="ElevenLabs Real-Time Audio Frequency Stream"
        />

        {/* Corner Telemetry Overlay */}
        <div className="absolute bottom-2 left-3 flex items-center gap-3 text-[10px] font-mono text-slate-400 pointer-events-none select-none">
          <span className="flex items-center gap-1 text-slate-300">
            <Clock size={11} className="text-purple-400" />
            {formatDuration(streamDurationSec)}
          </span>
          <span className="text-slate-600">•</span>
          <span className="flex items-center gap-1 text-slate-300">
            <Layers size={11} className="text-cyan-400" />
            {chunksCount} chunks ({formatBytes(totalBytes)})
          </span>
          {timeToFirstChunkMs !== null && (
            <>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <Zap size={11} />
                TTFB: {timeToFirstChunkMs}ms
              </span>
            </>
          )}
        </div>

        {/* Word progress pill (if available) */}
        {wordProgress && wordProgress.total > 0 && (
          <div className="absolute bottom-2 right-3 flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 px-2.5 py-0.5 rounded-lg text-[10px] font-mono text-purple-300 shadow-sm">
            <span>Speech Progress:</span>
            <span className="font-bold text-white">
              {wordProgress.current} / {wordProgress.total} words (
              {Math.min(100, Math.round((wordProgress.current / wordProgress.total) * 100))}%)
            </span>
          </div>
        )}
      </div>

      {/* Studio Bottom Bar: Volume & Real-time Monitor Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4 pt-1 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleMute}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
            title={isMuted ? 'Unmute Live Audio' : 'Mute Live Audio'}
          >
            {isMuted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono">Monitor:</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-20 sm:w-28 accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="text-[10px] font-mono text-slate-500 w-7">
              {Math.round((isMuted ? 0 : volume) * 100)}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span>Real-Time Stream Protocol: ElevenLabs WebSocket v1</span>
        </div>
      </div>
    </div>
  );
}
