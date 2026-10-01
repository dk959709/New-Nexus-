import React, { useState } from 'react';
import {
  Sparkles,
  X,
  ArrowRight,
  Globe,
  Search,
  Cpu,
  Atom,
  Target,
  BookOpen,
  Compass,
} from 'lucide-react';
import { MULTICHAT_CATEGORIES } from '@/data/multiChatCategories';
import type { MultiChatCategoryId } from '@/types';

interface MultiChatQuickPromptsProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (promptText: string, categoryId: MultiChatCategoryId) => void;
}

const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  general: Globe,
  research: Search,
  technology: Cpu,
  science: Atom,
  strategy: Target,
  learning: BookOpen,
  creative: Sparkles,
  philosophy: Compass,
};

export const MultiChatQuickPrompts: React.FC<MultiChatQuickPromptsProps> = ({
  isOpen,
  onClose,
  onSelectPrompt,
}) => {
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');

  if (!isOpen) return null;

  const displayedCategories =
    activeCategoryFilter === 'all'
      ? MULTICHAT_CATEGORIES
      : MULTICHAT_CATEGORIES.filter((c) => c.id === activeCategoryFilter);

  return (
    <div
      id="nexus-quick-prompts-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
    >
      <div
        className="nexus-corner-bracket relative w-full max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden bg-slate-950/95 border border-cyan-500/35 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_30px_rgba(0,240,255,0.15)] flex flex-col"
      >
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 bg-black/60 border-b border-cyan-500/20 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-400 text-purple-300 flex items-center justify-center">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="m-0 text-sm sm:text-base font-black text-white font-mono uppercase tracking-wider">
                NEXUS COGNITIVE PROMPT LIBRARY
              </h2>
              <p className="m-0 text-xs text-slate-400 font-sans">
                Curated high-yield inquiries optimized for 3-persona sequential dialogue
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-cyan-400 cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Category Filters Bar */}
        <div className="p-3 bg-black/40 border-b border-white/5 flex items-center gap-1.5 overflow-x-auto font-mono text-xs scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveCategoryFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeCategoryFilter === 'all'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                : 'bg-white/5 text-slate-400 border border-white/5 hover:text-white'
            }`}
          >
            All Domains ({MULTICHAT_CATEGORIES.length})
          </button>

          {MULTICHAT_CATEGORIES.map((cat) => {
            const isSelected = activeCategoryFilter === cat.id;
            const Icon = CATEGORY_ICON_MAP[cat.id] || Globe;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategoryFilter(cat.id)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                    : 'bg-white/5 text-slate-400 border border-white/5 hover:text-white'
                }`}
              >
                <Icon size={12} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Prompts Cards Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {displayedCategories.map((cat) => {
            const Icon = CATEGORY_ICON_MAP[cat.id] || Globe;

            return (
              <div
                key={cat.id}
                className="rounded-xl p-4 bg-white/[0.02] border border-white/10 space-y-2.5 font-mono"
              >
                <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center justify-center text-xs">
                      <Icon size={13} />
                    </div>
                    <span className="font-bold text-white text-xs sm:text-sm">
                      {cat.label.toUpperCase()}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-bold">
                      {cat.badge}
                    </span>
                  </div>
                </div>

                <p className="m-0 text-[11px] text-slate-400 font-sans leading-relaxed">
                  {cat.description}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {cat.suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        onSelectPrompt(q, cat.id);
                        onClose();
                      }}
                      className="p-2.5 rounded-lg bg-black/40 border border-white/10 hover:border-cyan-400/50 hover:bg-cyan-950/20 text-left text-xs font-sans text-slate-200 hover:text-white transition-all cursor-pointer flex items-center justify-between gap-2 group"
                    >
                      <span className="line-clamp-2 leading-relaxed">&ldquo;{q}&rdquo;</span>
                      <ArrowRight size={13} className="text-slate-500 group-hover:text-cyan-400 shrink-0 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
