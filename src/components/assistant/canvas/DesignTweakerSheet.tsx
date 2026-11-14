import React from 'react';
import { X, RotateCcw, Check, Sliders, Sun, Moon, Monitor } from 'lucide-react';
import {
  DEFAULT_DESIGN_TWEAKS,
  hasActiveDesignTweaks,
  type DesignTweakState,
} from '@/lib/canvasSandbox';

interface DesignTweakerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tweaks: DesignTweakState;
  onChange: (next: DesignTweakState) => void;
  onBakeIntoCode: () => void;
  canBakeDirectly: boolean;
  aiRefining?: boolean;
}

const ACCENT_SWATCHES: Array<{ label: string; value: string }> = [
  { label: 'Default', value: '' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Violet', value: '#8b5cf6' },
];

const RADIUS_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: 'Auto', value: null },
  { label: '0px', value: 0 },
  { label: '8px', value: 8 },
  { label: '14px', value: 14 },
  { label: '22px', value: 22 },
];

export const DesignTweakerSheet: React.FC<DesignTweakerSheetProps> = ({
  isOpen,
  onClose,
  tweaks,
  onChange,
  onBakeIntoCode,
  canBakeDirectly,
  aiRefining = false,
}) => {
  if (!isOpen) return null;

  const dirty = hasActiveDesignTweaks(tweaks);

  return (
    <div
      className="fixed inset-0 flex items-end lg:items-center justify-center lg:justify-end bg-black/55 backdrop-blur-sm"
      style={{ zIndex: 1180 }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Live Design Tweaker"
        onClick={(e) => e.stopPropagation()}
        style={{
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))',
        }}
        className="w-full lg:w-[400px] lg:mr-5 max-h-[84dvh] rounded-t-3xl lg:rounded-2xl border border-zinc-800 bg-zinc-950/95 text-zinc-100 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Mobile Drag Handle Affordance */}
        <div className="lg:hidden pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-zinc-700" />
        </div>

        {/* Sheet Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center text-cyan-300 shrink-0">
              <Sliders size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">
                Live Design Tweaker
              </h3>
              <p className="text-[11px] text-zinc-400 truncate">
                Instant zero-latency CSS preview overrides
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close Design Tweaker"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Sheet Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Surface Theme Polarity */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300 block">
              Surface Polarity
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'inherit' as const, label: 'Auto', icon: Monitor },
                { id: 'dark' as const, label: 'Dark', icon: Moon },
                { id: 'light' as const, label: 'Light', icon: Sun },
              ].map((opt) => {
                const Icon = opt.icon;
                const active = tweaks.surfaceMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChange({ ...tweaks, surfaceMode: opt.id })}
                    className={`min-h-[44px] px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      active
                        ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                        : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accent Color Swatches */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300">
                Accent Color
              </label>
              <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
                {tweaks.accentColor || 'Inherit'}
              </span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {ACCENT_SWATCHES.map((swatch) => {
                const selected = tweaks.accentColor === swatch.value;
                return (
                  <button
                    key={swatch.label}
                    type="button"
                    onClick={() => onChange({ ...tweaks, accentColor: swatch.value })}
                    title={swatch.label}
                    className={`min-h-[44px] rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      selected
                        ? 'border-white ring-2 ring-cyan-400/50 bg-zinc-800'
                        : 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800'
                    }`}
                  >
                    {swatch.value ? (
                      <span
                        className="w-5 h-5 rounded-full border border-white/25"
                        style={{ backgroundColor: swatch.value }}
                      />
                    ) : (
                      <span className="text-[10px] font-mono text-zinc-300">Auto</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Corner Radius Options */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300">
                Corner Radius
              </label>
              <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
                {tweaks.borderRadiusPx === null ? 'Auto' : `${tweaks.borderRadiusPx}px`}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {RADIUS_OPTIONS.map((opt) => {
                const selected = tweaks.borderRadiusPx === opt.value;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => onChange({ ...tweaks, borderRadiusPx: opt.value })}
                    className={`min-h-[44px] px-2 rounded-xl border text-xs font-mono transition-colors cursor-pointer ${
                      selected
                        ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200 font-semibold'
                        : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font Size Scale Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="canvas-tweak-font" className="text-xs font-semibold text-zinc-300">
                Base Typography Scale
              </label>
              <span className="text-xs font-mono text-cyan-300 tabular-nums">
                {tweaks.fontScalePct}%
              </span>
            </div>
            <div className="min-h-[44px] flex items-center px-3 rounded-xl bg-zinc-900 border border-zinc-800">
              <input
                id="canvas-tweak-font"
                type="range"
                min={85}
                max={125}
                step={5}
                value={tweaks.fontScalePct}
                onChange={(e) =>
                  onChange({ ...tweaks, fontScalePct: Number(e.target.value) })
                }
                className="w-full accent-cyan-400 cursor-pointer h-2"
              />
            </div>
          </div>

          {/* Layout Spacing Scale Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="canvas-tweak-spacing" className="text-xs font-semibold text-zinc-300">
                Padding &amp; Breathing Room
              </label>
              <span className="text-xs font-mono text-cyan-300 tabular-nums">
                {tweaks.spacingScalePct}%
              </span>
            </div>
            <div className="min-h-[44px] flex items-center px-3 rounded-xl bg-zinc-900 border border-zinc-800">
              <input
                id="canvas-tweak-spacing"
                type="range"
                min={75}
                max={140}
                step={5}
                value={tweaks.spacingScalePct}
                onChange={(e) =>
                  onChange({ ...tweaks, spacingScalePct: Number(e.target.value) })
                }
                className="w-full accent-cyan-400 cursor-pointer h-2"
              />
            </div>
          </div>
        </div>

        {/* Sticky Sheet Action Footer */}
        <div className="px-4 pt-3 border-t border-zinc-800 bg-zinc-950 flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={!dirty}
            onClick={() => onChange(DEFAULT_DESIGN_TWEAKS)}
            className="min-h-[44px] px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-700 text-xs font-medium text-zinc-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>

          <button
            type="button"
            disabled={!dirty || aiRefining}
            onClick={onBakeIntoCode}
            className="flex-1 min-h-[44px] px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Check size={15} />
            <span>{canBakeDirectly ? 'Bake Tweaks into Code' : 'Apply Tweaks with AI'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
