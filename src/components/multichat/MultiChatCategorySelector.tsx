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
import type { MultiChatCategoryId, MultiChatTheme } from '@/types';

interface MultiChatCategorySelectorProps {
  selectedCategory: MultiChatCategoryId | string;
  onSelectCategory: (category: MultiChatCategoryId) => void;
  onSelectPrompt?: (promptText: string) => void;
  disabled?: boolean;
  theme?: MultiChatTheme;
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
  theme = 'classic',
}) => {
  const [showPromptsDrawer, setShowPromptsDrawer] = useState(false);
  const activeConfig = getCategoryById(selectedCategory);

  return (
    <div
      id="nexus-category-selector-container"
      className={`rounded-xl sm:rounded-2xl overflow-hidden transition-all border ${
        theme === 'classic'
          ? 'bg-slate-950/85 border-cyan-500/20 shadow-md'
          : theme === 'fulldark'
          ? 'bg-[#171717] border-[#292929]'
          : 'bg-zinc-900/90 border-zinc-800/90'
      }`}
    >
      {/* Compact Category Strip */}
      <div className="px-2.5 sm:px-3.5 py-1.5 sm:py-2">
        <div className="flex items-center justify-between gap-2">
          {/* Scrollable Category Pills List */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar touch-pan-x flex-1 min-w-0 py-0.5">
            {MULTICHAT_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              const Icon = CATEGORY_ICON_MAP[cat.id] || Globe;

              return (
                <button
                  key={cat.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectCategory(cat.id)}
                  className={`px-2 py-1 rounded-lg text-[11px] sm:text-xs font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 shrink-0 border ${
                    isSelected
                      ? theme === 'classic'
                        ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/60 shadow-[0_0_10px_rgba(6,182,212,0.18)]'
                        : theme === 'fulldark'
                        ? 'bg-[#2a2a2a] text-white border-[#48484a]'
                        : 'bg-zinc-800 text-zinc-100 border-zinc-600'
                      : theme === 'classic'
                      ? 'bg-white/[0.03] text-slate-400 border-transparent hover:border-cyan-500/30 hover:text-white'
                      : theme === 'fulldark'
                      ? 'bg-transparent text-[#98989d] border-transparent hover:bg-[#222] hover:text-white'
                      : 'bg-transparent text-zinc-400 border-transparent hover:bg-zinc-800/60 hover:text-zinc-200'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={cat.description}
                >
                  <Icon
                    size={11}
                    className={
                      isSelected
                        ? theme === 'classic'
                          ? 'text-cyan-400'
                          : 'text-white'
                        : 'text-zinc-400'
                    }
                  />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Ideas / Starters Toggle */}
          <button
            type="button"
            onClick={() => setShowPromptsDrawer(!showPromptsDrawer)}
            className={`text-[10.5px] sm:text-[11px] font-medium px-2 py-1 rounded-lg border flex items-center gap-1 cursor-pointer transition-colors shrink-0 ${
              showPromptsDrawer
                ? theme === 'classic'
                  ? 'bg-cyan-950/70 text-cyan-200 border-cyan-500/40'
                  : 'bg-zinc-800 text-zinc-100 border-zinc-700'
                : theme === 'classic'
                ? 'text-cyan-300/80 hover:text-cyan-200 border-white/10 bg-white/[0.03]'
                : theme === 'fulldark'
                ? 'text-[#a1a1aa] hover:text-white border-[#2e2e2e] bg-[#1f1f1f]'
                : 'text-zinc-400 hover:text-zinc-200 border-zinc-800 bg-zinc-800/50'
            }`}
            title="Show suggested domain questions"
          >
            <HelpCircle size={11} />
            <span className="hidden sm:inline">{activeConfig.label} Ideas</span>
            <span className="sm:hidden">Ideas</span>
            {showPromptsDrawer ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        </div>
      </div>

      {/* Suggested Questions Drawer */}
      {showPromptsDrawer && (
        <div
          className={`p-2.5 sm:p-3 border-t animate-fadeIn ${
            theme === 'classic'
              ? 'bg-black/50 border-cyan-500/15'
              : theme === 'fulldark'
              ? 'bg-[#111] border-[#262626]'
              : 'bg-zinc-950/70 border-zinc-800'
          }`}
        >
          <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between">
            <span>Suggested {activeConfig.label} Questions</span>
            <span className="text-cyan-400">Tap to fill</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {activeConfig.suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onSelectPrompt?.(q);
                  setShowPromptsDrawer(false);
                }}
                className={`p-2 rounded-lg border text-left text-[11px] sm:text-xs font-sans transition-all cursor-pointer flex items-center justify-between gap-2 group ${
                  theme === 'classic'
                    ? 'bg-white/[0.03] border-white/5 hover:border-cyan-400/50 hover:bg-cyan-950/20 text-slate-200 hover:text-white'
                    : theme === 'fulldark'
                    ? 'bg-[#1a1a1a] border-[#2a2a2a] hover:border-[#454545] text-[#e4e4e7] hover:text-white'
                    : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-600 text-zinc-200 hover:text-white'
                }`}
              >
                <span className="line-clamp-2 leading-snug">&ldquo;{q}&rdquo;</span>
                <ArrowRight size={11} className="text-zinc-500 group-hover:text-cyan-400 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

