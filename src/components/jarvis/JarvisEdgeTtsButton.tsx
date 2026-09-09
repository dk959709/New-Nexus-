import React from 'react';
import { Radio, Loader2 } from 'lucide-react';

export interface JarvisEdgeTtsButtonProps {
  isPlaying: boolean;
  isLoading: boolean;
  onClick: () => void;
  className?: string;
  showText?: boolean;
}

export const JarvisEdgeTtsButton: React.FC<JarvisEdgeTtsButtonProps> = ({
  isPlaying,
  isLoading,
  onClick,
  className = '',
  showText = false,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className={`p-1.5 sm:p-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${
        isPlaying
          ? 'bg-purple-400 text-slate-950 shadow-[0_0_12px_#c084fc]'
          : 'text-slate-300 hover:text-purple-300 hover:bg-purple-500/15'
      } ${className}`}
      title={
        isLoading
          ? 'Generating Neural Audio...'
          : isPlaying
          ? 'Stop Edge TTS Audio'
          : 'Play Edge TTS Neural Voice'
      }
      aria-label="Edge TTS Neural Voice Speaker"
    >
      {isLoading ? (
        <Loader2 size={15} className="animate-spin text-purple-400" />
      ) : isPlaying ? (
        <Radio size={15} className="animate-pulse" />
      ) : (
        <Radio size={15} />
      )}
      {showText && (
        <span className="text-xs hidden sm:inline">
          {isPlaying ? 'Playing' : 'Listen'}
        </span>
      )}
    </button>
  );
};
