import React, { useState } from 'react';
import { Sliders, RotateCcw, ChevronDown, Sparkles, Volume2, Gauge } from 'lucide-react';
import { StudioVoiceSettings } from '@/types';
import { playTapSound } from '@/lib/audio';

interface StudioAudioControlsProps {
  settings: StudioVoiceSettings;
  onChangeSettings: (newSettings: StudioVoiceSettings) => void;
}

export function StudioAudioControls({
  settings,
  onChangeSettings,
}: StudioAudioControlsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleReset = () => {
    playTapSound();
    onChangeSettings({
      stability: 0.5,
      similarityBoost: 0.75,
      speed: 1.0,
    });
  };

  const isDefault =
    settings.stability === 0.5 &&
    settings.similarityBoost === 0.75 &&
    settings.speed === 1.0;

  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden transition">
      {/* Header Accordion Bar */}
      <button
        type="button"
        onClick={() => {
          playTapSound();
          setIsOpen(!isOpen);
        }}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-900/50 transition cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Sliders size={13} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <span>Studio Voice Settings & Tuning</span>
              {!isDefault && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  Customized
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Stability: {Math.round(settings.stability * 100)}% • Clarity Boost: {Math.round(settings.similarityBoost * 100)}% • Pace: {settings.speed.toFixed(2)}x
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isDefault && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleReset();
              }}
              className="text-[11px] font-mono text-purple-400 hover:text-purple-300 flex items-center gap-1 transition px-2 py-0.5 rounded hover:bg-purple-500/10 cursor-pointer"
              title="Reset to studio defaults"
            >
              <RotateCcw size={11} /> Reset
            </button>
          )}
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Expanded Controls Drawer */}
      {isOpen && (
        <div className="p-4 pt-2 border-t border-slate-800/80 bg-slate-900/40 space-y-4 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Stability */}
            <div className="space-y-1.5 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Sparkles size={12} className="text-purple-400" />
                  Voice Stability
                </span>
                <span className="font-mono text-purple-300 font-bold">
                  {Math.round(settings.stability * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.stability}
                onChange={(e) =>
                  onChangeSettings({ ...settings, stability: parseFloat(e.target.value) })
                }
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>Expressive</span>
                <span>Stable</span>
              </div>
            </div>

            {/* Similarity / Clarity Boost */}
            <div className="space-y-1.5 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Volume2 size={12} className="text-indigo-400" />
                  Clarity & Similarity
                </span>
                <span className="font-mono text-indigo-300 font-bold">
                  {Math.round(settings.similarityBoost * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.similarityBoost}
                onChange={(e) =>
                  onChangeSettings({ ...settings, similarityBoost: parseFloat(e.target.value) })
                }
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>Low</span>
                <span>High Clarity</span>
              </div>
            </div>

            {/* Speaking Pace / Speed */}
            <div className="space-y-1.5 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Gauge size={12} className="text-cyan-400" />
                  Speaking Pace
                </span>
                <span className="font-mono text-cyan-300 font-bold">
                  {settings.speed.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min={0.7}
                max={1.3}
                step={0.05}
                value={settings.speed}
                onChange={(e) =>
                  onChangeSettings({ ...settings, speed: parseFloat(e.target.value) })
                }
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>0.7x (Slow)</span>
                <span>1.3x (Fast)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
