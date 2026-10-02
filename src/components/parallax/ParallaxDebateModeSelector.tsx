import React from 'react';
import {
  Sparkles,
  Gavel,
  Landmark,
  Rocket,
  Newspaper,
  Compass,
} from 'lucide-react';
import { PARALLAX_DEBATE_MODES, getDebateModeConfig } from '@/data/parallaxDebateModes';
import type { ParallaxDebateMode } from '@/types';

export interface ParallaxDebateModeSelectorProps {
  selectedMode: ParallaxDebateMode;
  onSelectMode: (mode: ParallaxDebateMode) => void;
  disabled?: boolean;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Sparkles: Sparkles,
  Gavel: Gavel,
  Landmark: Landmark,
  Rocket: Rocket,
  Newspaper: Newspaper,
};

export const ParallaxDebateModeSelector: React.FC<ParallaxDebateModeSelectorProps> = ({
  selectedMode,
  onSelectMode,
  disabled = false,
}) => {
  const activeConfig = getDebateModeConfig(selectedMode);

  return (
    <div
      id="parallax-debate-mode-selector"
      className="rounded-xl p-2 sm:p-2.5 bg-black/60 backdrop-blur-md border border-cyan-500/20 mb-3 sm:mb-4 font-mono select-none"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Compass size={13} style={{ color: activeConfig.accentColor }} />
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            DEBATE PROTOCOL PRESET:
          </span>
          <span
            className="text-[10px] sm:text-[11px] font-black uppercase px-1.5 py-0.2 rounded"
            style={{
              background: `${activeConfig.accentColor}20`,
              color: activeConfig.accentColor,
              border: `1px solid ${activeConfig.accentColor}40`,
            }}
          >
            {activeConfig.label}
          </span>
        </div>

        <span className="text-[9.5px] sm:text-[10px] text-slate-500 font-sans hidden md:inline">
          {activeConfig.subtitle}
        </span>
      </div>

      {/* Preset Buttons Grid / Scrollable Bar */}
      <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto pb-0.5 scrollbar-none touch-pan-x">
        {PARALLAX_DEBATE_MODES.map((mode) => {
          const isSelected = selectedMode === mode.id;
          const Icon = ICON_MAP[mode.iconName] || Sparkles;

          return (
            <button
              key={mode.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectMode(mode.id)}
              className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 sm:gap-1.5 shrink-0 ${
                isSelected
                  ? 'border shadow-md'
                  : 'bg-white/[0.03] text-slate-400 border border-white/5 hover:border-white/20 hover:text-white'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{
                background: isSelected ? `${mode.accentColor}25` : undefined,
                color: isSelected ? mode.accentColor : undefined,
                borderColor: isSelected ? mode.accentColor : undefined,
                boxShadow: isSelected ? `0 0 14px ${mode.accentColor}35` : undefined,
              }}
            >
              <Icon size={12} className={isSelected ? '' : 'text-slate-500'} />
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
