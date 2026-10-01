import React, { useState } from 'react';
import {
  Globe,
  Search,
  Cpu,
  Atom,
  Target,
  BookOpen,
  Sparkles,
  Compass,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import { MULTICHAT_CATEGORIES, getCategoryById } from '@/data/multiChatCategories';
import type { MultiChatCategoryId } from '@/types';

interface MultiChatCategorySelectorProps {
  selectedCategory: MultiChatCategoryId | string;
  onSelectCategory: (category: MultiChatCategoryId) => void;
  onSelectPrompt?: (promptText: string) => void;
  disabled?: boolean;
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

export const MultiChatCategorySelector: React.FC<MultiChatCategorySelectorProps> = ({
  selectedCategory,
  onSelectCategory,
  onSelectPrompt,
  disabled = false,
}) => {
  const [showPromptsDrawer, setShowPromptsDrawer] = useState(false);
  const activeConfig = getCategoryById(selectedCategory);

  return (
    <div
      id="nexus-category-selector-container"
      className="rounded-lg sm:rounded-xl overflow-hidden mb-2.5 sm:mb-4 transition-all"
      style={{
        background: 'linear-gradient(135deg, rgba(6, 16, 26, 0.85) 0%, rgba(3, 10, 18, 0.95) 100%)',
        border: '1px solid rgba(0, 240, 255, 0.2)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* Category Pills Bar */}
      <div className="p-2 sm:p-3.5 border-b border-white/5">
        <div className="flex items-center justify-between gap-1.5 sm:gap-2 mb-1.5 sm:mb-2 flex-wrap">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 sm:gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
              <span>DOMAIN:</span>
            </span>
            <span className="text-[11px] sm:text-xs font-mono font-black text-cyan-300">
              {activeConfig.label.toUpperCase()}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowPromptsDrawer(!showPromptsDrawer)}
            className="text-[10px] sm:text-[11px] font-mono text-cyan-400 hover:text-cyan-200 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <HelpCircle size={11} className="sm:w-3 sm:h-3" />
            <span>{showPromptsDrawer ? 'Hide Suggestions' : 'Suggested Questions'}</span>
            {showPromptsDrawer ? <ChevronUp size={11} className="sm:w-3 sm:h-3" /> : <ChevronDown size={11} className="sm:w-3 sm:h-3" />}
          </button>
        </div>

        {/* Scrollable Category Pills List */}
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto pb-1 scrollbar-none touch-pan-x">
          {MULTICHAT_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            const Icon = CATEGORY_ICON_MAP[cat.id] || Globe;

            return (
              <button
                key={cat.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelectCategory(cat.id)}
                className={`px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 sm:gap-1.5 shrink-0 ${
                  isSelected
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                    : 'bg-white/[0.03] text-slate-400 border border-white/5 hover:border-cyan-500/30 hover:text-white'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Icon size={11} className={`sm:w-3 sm:h-3 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Description caption */}
        <p className="m-0 mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] text-slate-400 font-sans leading-snug sm:leading-normal line-clamp-1">
          {activeConfig.description}
        </p>
      </div>

      {/* Suggested Questions Drawer */}
      {showPromptsDrawer && (
        <div className="p-2.5 sm:p-4 bg-black/50 border-t border-cyan-500/15 animate-fadeIn">
          <div className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-1.5 sm:mb-2 flex items-center justify-between">
            <span>SUGGESTED {activeConfig.label.toUpperCase()} INQUIRIES:</span>
            <span className="text-cyan-400 text-[9px] sm:text-[10px]">Click to load query</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
            {activeConfig.suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onSelectPrompt?.(q);
                  setShowPromptsDrawer(false);
                }}
                className="p-2 sm:p-2.5 rounded-md sm:rounded-lg bg-white/[0.03] border border-white/5 hover:border-cyan-400/50 hover:bg-cyan-950/20 text-left text-[11px] sm:text-xs font-sans text-slate-200 hover:text-white transition-all cursor-pointer flex items-center justify-between gap-1.5 sm:gap-2 group"
              >
                <span className="line-clamp-2 leading-tight sm:leading-relaxed">&ldquo;{q}&rdquo;</span>
                <ArrowRight size={11} className="sm:w-3 sm:h-3 text-slate-500 group-hover:text-cyan-400 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
