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
      className="py-2.5 border-b border-white/[0.06] font-mono select-none"
    >
      <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
        <div className="flex items-center gap-2">
          <Compass size={13} style={{ color: activeConfig.accentColor }} />
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase tracking-wider">
            DEBATE PROTOCOL PRESET:
          </span>
          <span
            className="text-[10px] sm:text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-900/40 backdrop-blur-xl"
            style={{
              color: activeConfig.accentColor,
            }}
          >
            {activeConfig.label}
          </span>
        </div>

        <span className="text-[10px] sm:text-[11px] text-slate-300 font-sans hidden md:inline">
          {activeConfig.subtitle}
        </span>
      </div>

      {/* Preset Buttons Grid / Scrollable Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none touch-pan-x">
        {PARALLAX_DEBATE_MODES.map((mode) => {
          const isSelected = selectedMode === mode.id;
          const Icon = ICON_MAP[mode.iconName] || Sparkles;

          return (
            <button
              key={mode.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectMode(mode.id)}
              className={`px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 bg-slate-900/40 backdrop-blur-xl ${
                isSelected
                  ? 'text-slate-100 shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-slate-100'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{
                background: isSelected ? `${mode.accentColor}22` : undefined,
                color: isSelected ? mode.accentColor : undefined,
                boxShadow: isSelected ? `0 0 18px ${mode.accentColor}25` : undefined,
              }}
            >
              <Icon size={12} className={isSelected ? '' : 'text-slate-400'} />
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
