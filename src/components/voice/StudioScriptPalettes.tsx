import React from 'react';
import { BookOpen, Wand2, Clock, AlignLeft } from 'lucide-react';
import { playTapSound } from '@/lib/audio';

interface StudioScriptPalettesProps {
  onSelectScript: (text: string) => void;
  currentText: string;
}

export function StudioScriptPalettes({
  onSelectScript,
  currentText,
}: StudioScriptPalettesProps) {
  const scriptPresets = [
    {
      category: 'Commercial',
      label: 'Brand Voiceover',
      text: 'Experience sound like never before. With cutting-edge neural synthesis, your story comes to life with breathtaking clarity, dynamic range, and authentic human emotion.',
    },
    {
      category: 'Podcast',
      label: 'Show Intro',
      text: 'Welcome back to the Intelligence Brief. Today, we delve into the next frontier of artificial neural models, synthetic cognition, and how ambient computing is reshaping our daily workflow.',
    },
    {
      category: 'Narrative',
      label: 'Audiobook Story',
      text: 'The rain drummed steadily against the glass observatory. Far below, the city streets glowed with neon ribbons, whispering secrets of an empire that vanished centuries ago.',
    },
    {
      category: 'Tech Explainer',
      label: 'Product Showcase',
      text: 'Introducing the next generation audio engine: featuring sub-millisecond latency, multilingual neural timbre, and real-time adaptive prosody across forty global dialects.',
    },
  ];

  // Telemetry
  const wordCount = currentText.trim() ? currentText.trim().split(/\s+/).length : 0;
  const estimatedSeconds = Math.round((wordCount / 145) * 60);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider">
          <BookOpen size={13} className="text-purple-400" />
          <span>Production Script Presets</span>
        </div>

        {/* Real-time Telemetry */}
        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1">
            <AlignLeft size={11} className="text-slate-500" />
            {wordCount} words
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 text-purple-300">
            <Clock size={11} />
            Est. ~{estimatedSeconds > 0 ? `${estimatedSeconds}s` : '0s'}
          </span>
        </div>
      </div>

      {/* Preset Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {scriptPresets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              playTapSound();
              onSelectScript(preset.text);
            }}
            className="p-2.5 rounded-xl bg-slate-950/50 hover:bg-slate-900 border border-slate-800 hover:border-purple-500/40 text-left transition group cursor-pointer"
          >
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] font-mono text-purple-400 font-semibold">
                {preset.category}
              </span>
              <Wand2 size={11} className="text-slate-500 group-hover:text-purple-300 transition" />
            </div>
            <div className="text-xs font-semibold text-slate-200 truncate group-hover:text-white transition">
              {preset.label}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
