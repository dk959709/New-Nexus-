import React from 'react';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Radio,
  X,
  Loader2,
} from 'lucide-react';
import type { MultiChatPersonaId } from '@/types';

export interface PodcastTrack {
  msgId: string;
  personaId: MultiChatPersonaId;
  name: string;
  icon: string;
  accentColor: string;
  toneBadge?: string;
  text: string;
  query: string;
}

interface MultiChatPodcastPlayerProps {
  tracks: PodcastTrack[];
  currentTrackIndex: number;
  isPlaying: boolean;
  isLoading?: boolean;
  playbackRate: number;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSelectTrack?: (index: number) => void;
  onChangePlaybackRate: (rate: number) => void;
  onClose: () => void;
}

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];

export const MultiChatPodcastPlayer: React.FC<MultiChatPodcastPlayerProps> = ({
  tracks,
  currentTrackIndex,
  isPlaying,
  isLoading = false,
  playbackRate,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onChangePlaybackRate,
  onClose,
}) => {
  if (tracks.length === 0) return null;

  const currentTrack = tracks[currentTrackIndex] || tracks[0];

  return (
    <div
      id="nexus-podcast-player-bar"
      className="sticky bottom-4 z-40 my-4 p-3.5 sm:p-4 rounded-2xl bg-black/90 backdrop-blur-xl border border-cyan-500/35 shadow-[0_16px_48px_rgba(0,0,0,0.8),0_0_24px_rgba(0,240,255,0.15)] font-mono select-none animate-slideUp"
    >
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Track Metadata & Persona Identity */}
        <div className="flex items-center gap-3 min-w-0 w-full md:w-auto">
          {/* Persona Avatar */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-md relative"
            style={{
              background: `${currentTrack.accentColor}25`,
              border: `1.5px solid ${currentTrack.accentColor}`,
              color: currentTrack.accentColor,
            }}
          >
            <span>{currentTrack.icon || currentTrack.name.slice(0, 2)}</span>
            {isPlaying && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-white">
                {currentTrack.name}
              </span>
              {currentTrack.toneBadge && (
                <span
                  className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase"
                  style={{
                    background: `${currentTrack.accentColor}20`,
                    color: currentTrack.accentColor,
                    border: `1px solid ${currentTrack.accentColor}40`,
                  }}
                >
                  {currentTrack.toneBadge}
                </span>
              )}
              <span className="text-[10px] text-cyan-300 font-bold">
                TRACK {currentTrackIndex + 1} OF {tracks.length}
              </span>
            </div>

            <p className="m-0 text-xs text-slate-300 font-sans truncate max-w-[320px] sm:max-w-md mt-0.5">
              &ldquo;{currentTrack.text.slice(0, 90)}...&rdquo;
            </p>
          </div>
        </div>

        {/* Center Audio Waveform Visualizer bars */}
        <div className="hidden lg:flex items-center gap-1 px-3 py-1 rounded-lg bg-white/5 border border-white/10">
          <Radio size={12} className={isPlaying ? 'text-cyan-400 animate-pulse' : 'text-slate-500'} />
          <div className="flex items-end gap-0.5 h-4 px-1">
            {[40, 70, 95, 60, 85, 45, 100, 75, 50, 90, 65, 80].map((h, i) => (
              <div
                key={i}
                className="w-1 bg-cyan-400 rounded-full transition-all duration-150"
                style={{
                  height: isPlaying ? `${Math.max(20, (h * Math.random()).toFixed(0))}%` : '25%',
                  opacity: isPlaying ? 0.9 : 0.3,
                }}
              />
            ))}
          </div>
        </div>

        {/* Playback Controls & Speed */}
        <div className="flex items-center gap-2 sm:gap-3 justify-end w-full md:w-auto flex-wrap">
          {/* Speed Selector */}
          <div className="flex items-center p-0.5 rounded-lg bg-white/5 border border-white/10">
            {SPEED_OPTIONS.map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => onChangePlaybackRate(rate)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                  playbackRate === rate
                    ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* Prev Track */}
          <button
            type="button"
            onClick={onPrev}
            disabled={currentTrackIndex === 0}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:border-cyan-400/50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="Previous Persona"
          >
            <ChevronLeft size={15} />
          </button>

          {/* Play / Pause */}
          <button
            type="button"
            onClick={isPlaying ? onPause : onPlay}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 text-black font-black shadow-[0_0_16px_rgba(0,240,255,0.4)] hover:opacity-90 active:scale-95 cursor-pointer transition-all flex items-center justify-center"
            title={isPlaying ? 'Pause Audio' : 'Play Audio'}
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin text-black" />
            ) : isPlaying ? (
              <Pause size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" />
            )}
          </button>

          {/* Next Track */}
          <button
            type="button"
            onClick={onNext}
            disabled={currentTrackIndex >= tracks.length - 1}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:border-cyan-400/50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="Next Persona"
          >
            <ChevronRight size={15} />
          </button>

          {/* Close Podcast Bar */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 cursor-pointer transition-colors"
            title="Close Podcast Bar"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
