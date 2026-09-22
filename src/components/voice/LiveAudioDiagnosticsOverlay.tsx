import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Activity,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Zap,
  Radio,
  Clock,
  ShieldCheck,
} from 'lucide-react';

export interface DiagnosticEvent {
  id: string;
  timeMs: number;
  type: 'chunk' | 'scheduled' | 'started' | 'ended' | 'error' | 'resumed' | 'info';
  text: string;
}

export interface DiagnosticSnapshot {
  audioContextState: string;
  heartbeatResumeCount: number;
  nextPlayTime: number;
  currentTime: number;
  gapSeconds: number;
  isKeepAliveActive: boolean;
  activeSourcesCount: number;
  streamDurationSec: number;
  connectionStatus: string;
  events: DiagnosticEvent[];
}

interface LiveAudioDiagnosticsOverlayProps {
  getSnapshot: () => DiagnosticSnapshot;
  defaultExpanded?: boolean;
}

export function LiveAudioDiagnosticsOverlay({
  getSnapshot,
  defaultExpanded = true,
}: LiveAudioDiagnosticsOverlayProps) {
  const [snapshot, setSnapshot] = useState<DiagnosticSnapshot>(() => getSnapshot());
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [hasCopied, setHasCopied] = useState<boolean>(false);

  // Poll diagnostics at least twice per second (250ms = 4 times per second)
  useEffect(() => {
    // Initial fetch
    setSnapshot(getSnapshot());

    const timer = window.setInterval(() => {
      setSnapshot(getSnapshot());
    }, 250);

    return () => {
      window.clearInterval(timer);
    };
  }, [getSnapshot]);

  const handleCopyDiagnostics = async () => {
    const textDump = [
      `=== LIVE VOICE STREAMING AUDIO DIAGNOSTICS ===`,
      `Timestamp: ${new Date().toISOString()}`,
      `Status: ${snapshot.connectionStatus}`,
      `AudioContext.state: ${snapshot.audioContextState}`,
      `Heartbeat Suspended Resumes: ${snapshot.heartbeatResumeCount}`,
      `Keep-Alive Silent Source Active: ${snapshot.isKeepAliveActive ? 'YES (0.0001 amp looping)' : 'NO'}`,
      `ctx.currentTime: ${snapshot.currentTime.toFixed(4)}s`,
      `nextPlayTimeRef: ${snapshot.nextPlayTime.toFixed(4)}s`,
      `Lead Gap (nextPlay - current): ${(snapshot.gapSeconds >= 0 ? '+' : '')}${snapshot.gapSeconds.toFixed(4)}s (${(snapshot.gapSeconds * 1000).toFixed(0)}ms)`,
      `Active AudioBufferSourceNodes: ${snapshot.activeSourcesCount}`,
      `Stream Duration: ${snapshot.streamDurationSec.toFixed(2)}s`,
      ``,
      `=== LAST 10 AUDIO PIPELINE EVENTS ===`,
      ...snapshot.events.map(
        (e) => `[+${e.timeMs.toString().padStart(5, '0')}ms] [${e.type.toUpperCase().padEnd(9)}] ${e.text}`
      ),
    ].join('\n');

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textDump);
      } else {
        // Fallback for older mobile webview contexts
        const textArea = document.createElement('textarea');
        textArea.value = textDump;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy diagnostics:', err);
    }
  };

  const getCtxStateColor = (state: string) => {
    switch (state.toLowerCase()) {
      case 'running':
        return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40';
      case 'suspended':
        return 'text-rose-400 bg-rose-500/20 border-rose-500/50 animate-pulse';
      case 'closed':
        return 'text-slate-400 bg-slate-800 border-slate-700';
      default:
        return 'text-amber-400 bg-amber-500/15 border-amber-500/30';
    }
  };

  const getEventBadgeClass = (type: DiagnosticEvent['type']) => {
    switch (type) {
      case 'chunk':
        return 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30';
      case 'scheduled':
        return 'text-purple-300 bg-purple-500/15 border-purple-500/30';
      case 'started':
        return 'text-blue-300 bg-blue-500/15 border-blue-500/30';
      case 'ended':
        return 'text-slate-300 bg-slate-800 border-slate-700';
      case 'resumed':
        return 'text-amber-300 bg-amber-500/20 border-amber-500/40 font-bold animate-pulse';
      case 'error':
        return 'text-rose-300 bg-rose-500/25 border-rose-500/50 font-bold';
      default:
        return 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30';
    }
  };

  const gapColor =
    snapshot.gapSeconds > 0.05
      ? 'text-cyan-300'
      : snapshot.gapSeconds >= 0
      ? 'text-emerald-300'
      : 'text-rose-400 font-bold';

  return (
    <div
      id="live-audio-diagnostics-overlay"
      className="bg-slate-950/95 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md font-mono transition duration-200"
    >
      {/* Top Header / Collapsible Control Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-900/90 border-b border-slate-800/80 flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
            <Terminal size={13} />
          </div>
          <span className="font-bold text-slate-200 tracking-wider text-[11px] sm:text-xs">
            LIVE AUDIO DIAGNOSTICS
          </span>
          <span className="text-[10px] text-slate-500 hidden md:inline">
            (4Hz Real-Time Heartbeat)
          </span>
        </div>

        {/* Live Status Indicators (Always visible even when collapsed) */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-[10px] sm:text-[11px]">
          {/* AudioContext State Badge */}
          <span
            className={`px-2 py-0.5 rounded-md border flex items-center gap-1 font-semibold ${getCtxStateColor(
              snapshot.audioContextState
            )}`}
            title="audioContext.state"
          >
            <Activity size={10} className={snapshot.audioContextState === 'running' ? 'animate-pulse' : ''} />
            <span>ctx: {snapshot.audioContextState}</span>
          </span>

          {/* Lead Gap Badge */}
          <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1">
            <Clock size={10} className="text-purple-400" />
            <span>gap:</span>
            <span className={gapColor}>
              {snapshot.gapSeconds >= 0 ? '+' : ''}
              {snapshot.gapSeconds.toFixed(3)}s
            </span>
          </span>

          {/* Suspended Resumes Counter */}
          <span
            className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${
              snapshot.heartbeatResumeCount > 0
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
            title="Heartbeat Suspended Resumes Count"
          >
            <AlertTriangle size={10} />
            <span>resumes: {snapshot.heartbeatResumeCount}</span>
          </span>

          {/* Keep-Alive Status */}
          <span
            className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${
              snapshot.isKeepAliveActive
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title="Inaudible Anti-Silence Keep-Alive Loop"
          >
            <ShieldCheck size={10} />
            <span>keep-alive: {snapshot.isKeepAliveActive ? 'ON' : 'OFF'}</span>
          </span>

          {/* Copy Diagnostics Button */}
          <button
            type="button"
            onClick={handleCopyDiagnostics}
            className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1 cursor-pointer"
            title="Copy Diagnostics Text Dump"
          >
            {hasCopied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
            <span>{hasCopied ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Toggle Expand/Collapse */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
            title={isExpanded ? 'Collapse Diagnostics' : 'Expand Diagnostics'}
          >
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Expanded Console Panel */}
      {isExpanded && (
        <div className="p-3 sm:p-4 space-y-3.5 text-[11px] sm:text-xs">
          {/* Real-time Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Cell 1: audioContext.state */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/90 space-y-1">
              <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">
                audioContext.state
              </div>
              <div className="text-sm font-bold flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full inline-block ${
                    snapshot.audioContextState === 'running'
                      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                      : snapshot.audioContextState === 'suspended'
                      ? 'bg-rose-400 animate-ping'
                      : 'bg-slate-500'
                  }`}
                />
                <span className={snapshot.audioContextState === 'running' ? 'text-emerald-300' : 'text-rose-400'}>
                  {snapshot.audioContextState.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Cell 2: Heartbeat Resumed Count */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/90 space-y-1">
              <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">
                Suspended Resumes
              </div>
              <div className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <Zap
                  size={13}
                  className={snapshot.heartbeatResumeCount > 0 ? 'text-amber-400 animate-bounce' : 'text-slate-500'}
                />
                <span className={snapshot.heartbeatResumeCount > 0 ? 'text-amber-300' : 'text-slate-300'}>
                  {snapshot.heartbeatResumeCount}
                </span>
                <span className="text-[10px] text-slate-500 font-normal">
                  {snapshot.heartbeatResumeCount === 1 ? 'event' : 'events'}
                </span>
              </div>
            </div>

            {/* Cell 3: nextPlayTime vs currentTime */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/90 space-y-1">
              <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">
                Scheduling Lead Gap
              </div>
              <div className="text-sm font-bold flex items-center gap-1">
                <span className={gapColor}>
                  {snapshot.gapSeconds >= 0 ? '+' : ''}
                  {snapshot.gapSeconds.toFixed(3)}s
                </span>
                <span className="text-[10px] text-slate-500 font-normal">
                  ({(snapshot.gapSeconds * 1000).toFixed(0)}ms)
                </span>
              </div>
            </div>

            {/* Cell 4: Keep-Alive Silent Source */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/90 space-y-1">
              <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">
                Keep-Alive Source
              </div>
              <div className="text-sm font-bold flex items-center gap-1.5">
                <Radio
                  size={13}
                  className={snapshot.isKeepAliveActive ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}
                />
                <span className={snapshot.isKeepAliveActive ? 'text-emerald-300' : 'text-slate-500'}>
                  {snapshot.isKeepAliveActive ? 'PLAYING' : 'OFF'}
                </span>
                <span className="text-[9px] text-slate-500 font-normal hidden lg:inline">
                  {snapshot.isKeepAliveActive ? '(0.0001 amp)' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Timing Sub-Bar: nextPlayTime vs currentTime details */}
          <div className="px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800/60 flex items-center justify-between flex-wrap gap-2 text-[10px] text-slate-400">
            <div className="flex items-center gap-3">
              <span>
                <strong className="text-slate-300">currentTime:</strong> {snapshot.currentTime.toFixed(4)}s
              </span>
              <span>•</span>
              <span>
                <strong className="text-slate-300">nextPlayTime:</strong> {snapshot.nextPlayTime.toFixed(4)}s
              </span>
              <span>•</span>
              <span>
                <strong className="text-slate-300">activeBuffers:</strong> {snapshot.activeSourcesCount}
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <span>connection: {snapshot.connectionStatus}</span>
              <span>•</span>
              <span>elapsed: {snapshot.streamDurationSec.toFixed(1)}s</span>
            </div>
          </div>

          {/* Running Event Log (Last 10 Events) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] uppercase text-slate-500 font-semibold tracking-wider px-1">
              <span>Event Chronology (Last 10 Events)</span>
              <span className="text-slate-600">t = ms since stream start</span>
            </div>

            <div className="bg-slate-950 rounded-xl border border-slate-800 p-2 sm:p-2.5 max-h-56 overflow-y-auto space-y-1.5 select-text">
              {snapshot.events.length === 0 ? (
                <div className="text-slate-600 text-center py-4 italic text-[11px]">
                  No events logged yet. Start streaming to begin real-time telemetry.
                </div>
              ) : (
                snapshot.events.map((evt) => (
                  <div
                    key={evt.id}
                    className="flex items-start gap-2 text-[10px] sm:text-[11px] leading-tight hover:bg-slate-900/60 px-1.5 py-1 rounded transition"
                  >
                    {/* Timestamp */}
                    <span className="text-slate-400 font-bold shrink-0 w-16">
                      +{evt.timeMs}ms
                    </span>

                    {/* Badge */}
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold border shrink-0 ${getEventBadgeClass(
                        evt.type
                      )}`}
                    >
                      {evt.type}
                    </span>

                    {/* Event Text */}
                    <span className="text-slate-200 break-words flex-1">
                      {evt.text}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
