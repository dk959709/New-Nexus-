import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Download,
  Loader2,
  Sliders,
  Music2,
} from 'lucide-react';
import { playTapSound } from '@/lib/audio';

interface StudioWaveformVisualizerProps {
  audioUrl: string;
  voiceName?: string;
  providerName?: string;
  onDownload: () => void;
  isDownloading?: boolean;
}

export function StudioWaveformVisualizer({
  audioUrl,
  voiceName = 'Neural Voice Model',
  providerName = 'Cloud Voice AI',
  onDownload,
  isDownloading = false,
}: StudioWaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [vuLevel, setVuLevel] = useState(0); // 0 to 1

  // Generate a deterministic pseudo-random waveform pattern based on audioUrl
  const waveformPeaks = useRef<number[]>([]);
  useEffect(() => {
    const peaks: number[] = [];
    const count = 75;
    let seed = 0;
    for (let i = 0; i < audioUrl.length; i++) {
      seed = (seed * 31 + audioUrl.charCodeAt(i)) & 0xffffffff;
    }
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 4294967296;
    };

    for (let i = 0; i < count; i++) {
      // Natural speech envelope shape: rises in middle, varied speech cadence
      const normalizedPos = i / count;
      const envelope = Math.sin(normalizedPos * Math.PI) * 0.4 + 0.6;
      const variation = 0.3 + rand() * 0.7;
      peaks.push(Math.min(1.0, Math.max(0.12, envelope * variation)));
    }
    waveformPeaks.current = peaks;
  }, [audioUrl]);

  // Audio lifecycle
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.playbackRate = playbackRate;
    audio.volume = isMuted ? 0 : volume;
    audio.loop = isLooping;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
      if (audio.duration) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      if (!isLooping) {
        setIsPlaying(false);
        setVuLevel(0);
      }
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl, isLooping, isMuted, playbackRate, volume]);

  // Draw waveform canvas
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const peaks = waveformPeaks.current;
    const barCount = peaks.length;
    if (barCount === 0) {
      ctx.restore();
      return;
    }

    const gap = 3;
    const totalGap = gap * (barCount - 1);
    const barWidth = Math.max(2, (width - totalGap) / barCount);
    const progress = duration > 0 ? currentTime / duration : 0;
    const currentBarIndex = Math.floor(progress * barCount);

    for (let i = 0; i < barCount; i++) {
      const x = i * (barWidth + gap);
      let peak = peaks[i];

      // If playing, add subtle dynamic jitter to active playback bar and neighbors
      if (isPlaying && Math.abs(i - currentBarIndex) <= 2) {
        const jitter = (Math.random() - 0.5) * 0.15;
        peak = Math.min(1.0, Math.max(0.15, peak + jitter));
      }

      const barHeight = Math.max(4, peak * (height - 12));
      const y = (height - barHeight) / 2;
      const isPassed = i <= currentBarIndex;

      // Color styling
      if (isPassed) {
        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        grad.addColorStop(0, '#c084fc'); // purple-400
        grad.addColorStop(1, '#a855f7'); // purple-500
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = 'rgba(71, 85, 105, 0.45)'; // slate-600 with opacity
      }

      // Rounded bar
      const radius = Math.min(barWidth / 2, 2.5);
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, radius);
      ctx.fill();
    }

    // Playback head cursor line
    if (duration > 0) {
      const cursorX = Math.min(width - 2, Math.max(0, progress * width));
      ctx.fillStyle = '#f3e8ff';
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 8;
      ctx.fillRect(cursorX - 1, 2, 2, height - 4);
    }

    ctx.restore();
  }, [currentTime, duration, isPlaying]);

  // Animation frame loop
  useEffect(() => {
    let animId: number;
    const render = () => {
      drawWaveform();

      if (isPlaying) {
        // Compute pseudo VU level for visual studio LED meter
        const target = 0.4 + Math.random() * 0.55;
        setVuLevel((prev) => prev * 0.7 + target * 0.3);
      } else {
        setVuLevel((prev) => Math.max(0, prev * 0.85 - 0.05));
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [drawWaveform, isPlaying]);

  // Click on waveform to scrub
  const handleWaveformClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio || !duration) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = ratio * duration;

    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    playTapSound();

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch((err) => {
        console.warn('Playback error:', err);
      });
    }
  };

  const handleRestart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    playTapSound();
    audio.currentTime = 0;
    setCurrentTime(0);
    audio.play().then(() => setIsPlaying(true)).catch(() => {});
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const speeds = [0.8, 1.0, 1.25, 1.5];

  return (
    <div className="bg-slate-950/90 border border-purple-500/30 rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl space-y-5">
      {/* Background Studio Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Top Header & Studio Master Status */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-800/80 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-inner">
            <Music2 size={20} className={isPlaying ? 'animate-bounce text-purple-400' : ''} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>{voiceName}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  44.1 kHz Studio Master
                </span>
              </h3>
            </div>
            <p className="text-xs text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
              <span>{providerName}</span>
              <span>•</span>
              <span className="text-purple-300">Ultra-High Fidelity</span>
              <span>•</span>
              <span>MP3 Stream</span>
            </p>
          </div>
        </div>

        {/* Master Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDownload}
            disabled={isDownloading}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-purple-300 border border-purple-500/30 hover:border-purple-500/60 font-medium text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
            title="Download studio-mastered audio file"
          >
            {isDownloading ? (
              <>
                <Loader2 size={14} className="animate-spin text-purple-400" />
                <span>Downloading...</span>
              </>
            ) : (
              <>
                <Download size={14} />
                <span>Download MP3</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Waveform Canvas & Time Telemetry */}
      <div className="space-y-2 relative z-10">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
          <div className="flex items-center gap-2">
            <span className="text-purple-300 font-bold">{formatTime(currentTime)}</span>
            <span className="text-slate-600">/</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Stereo VU Meter Simulation */}
          <div className="flex items-center gap-1.5" title="Live audio signal level">
            <span className="text-[10px] text-slate-500">SIG</span>
            <div className="flex items-center gap-0.5 h-3 bg-slate-900 px-1 py-0.5 rounded border border-slate-800">
              {[0.15, 0.35, 0.55, 0.75, 0.9].map((thresh, idx) => {
                const active = vuLevel >= thresh;
                const isPeak = idx >= 4;
                const isWarn = idx === 3;
                return (
                  <div
                    key={idx}
                    className={`w-1 h-2 rounded-xs transition-colors duration-75 ${
                      active
                        ? isPeak
                          ? 'bg-rose-500 shadow-xs shadow-rose-500'
                          : isWarn
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                        : 'bg-slate-800'
                    }`}
                  />
                );
              })}
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              {isPlaying ? `${Math.round(vuLevel * -6)} dB` : '-∞ dB'}
            </span>
          </div>
        </div>

        {/* Interactive Waveform Canvas */}
        <div className="relative group cursor-pointer bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 hover:border-purple-500/50 transition">
          <canvas
            ref={canvasRef}
            onClick={handleWaveformClick}
            className="w-full h-20 sm:h-24 block"
          />
          <div className="absolute inset-x-0 bottom-1 flex justify-center opacity-0 group-hover:opacity-100 transition pointer-events-none">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950/80 text-purple-300 border border-purple-500/30 backdrop-blur-xs">
              Click anywhere to scrub timeline
            </span>
          </div>
        </div>
      </div>

      {/* Hardware Transport & Playback Controls Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 pt-1 relative z-10">
        {/* Play / Restart / Scrubber controls */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/30 transition transform active:scale-95 cursor-pointer shrink-0"
            aria-label={isPlaying ? 'Pause Audio' : 'Play Audio'}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={handleRestart}
            className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-purple-300 border border-slate-800 flex items-center justify-center transition cursor-pointer"
            title="Replay from beginning"
          >
            <RotateCcw size={15} />
          </button>

          {/* Loop toggle */}
          <button
            type="button"
            onClick={() => {
              playTapSound();
              setIsLooping(!isLooping);
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium border transition cursor-pointer ${
              isLooping
                ? 'bg-purple-500/20 text-purple-200 border-purple-500/50'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-300'
            }`}
            title="Loop playback"
          >
            Loop {isLooping ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Speed Rate Switcher */}
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-xl">
          <Sliders size={13} className="text-slate-400 ml-1.5 mr-1" />
          {speeds.map((rate) => (
            <button
              key={rate}
              type="button"
              onClick={() => {
                playTapSound();
                setPlaybackRate(rate);
                if (audioRef.current) {
                  audioRef.current.playbackRate = rate;
                }
              }}
              className={`px-2 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
                playbackRate === rate
                  ? 'bg-purple-600 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>

        {/* Volume & Mute Control */}
        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl">
          <button
            type="button"
            onClick={() => {
              playTapSound();
              setIsMuted(!isMuted);
            }}
            className="text-slate-400 hover:text-slate-200 transition cursor-pointer"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setVolume(val);
              if (isMuted && val > 0) setIsMuted(false);
            }}
            className="w-16 sm:w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
            title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
          />
          <span className="text-[10px] font-mono text-slate-400 w-7 text-right">
            {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
          </span>
        </div>
      </div>
    </div>
  );
}
