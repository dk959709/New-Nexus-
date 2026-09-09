import React from 'react';
import { Contrast } from 'lucide-react';
import type { JarvisSynthesisTheme } from '@/hooks/useJarvisSynthesisTheme';

export interface JarvisSynthesisThemeToggleProps {
  theme: JarvisSynthesisTheme;
  onToggle: () => void;
  className?: string;
  showText?: boolean;
}

export const JarvisSynthesisThemeToggle: React.FC<JarvisSynthesisThemeToggleProps> = ({
  theme,
  onToggle,
  className = '',
  showText = false,
}) => {
  const isBlack = theme === 'black';

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`p-1.5 sm:p-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${
        isBlack
          ? 'bg-white/15 text-white border border-white/20 shadow-sm hover:bg-white/20'
          : 'text-slate-300 hover:text-cyan-300 hover:bg-cyan-500/15'
      } ${className}`}
      title={
        isBlack
          ? 'Theme: Plain Black active (Click to switch to Cyan Glow)'
          : 'Theme: Cyan Glow active (Click to switch to Plain Black)'
      }
      aria-label="Toggle synthesis box theme"
    >
      <Contrast size={15} />
      {showText && (
        <span className="text-xs hidden sm:inline">
          {isBlack ? 'Black' : 'Cyan'}
        </span>
      )}
    </button>
  );
};
