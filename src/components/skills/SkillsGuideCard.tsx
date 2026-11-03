import React, { useState, useRef } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';
import { SKILLS_GUIDE_TEXT, buildGuideWithGoal } from '@/lib/skillsGuide';

export const SkillsGuideCard: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [goal, setGoal] = useState('');
  const [showGuideText, setShowGuideText] = useState(false);
  const [copiedGuide, setCopiedGuide] = useState(false);
  const [copiedWithGoal, setCopiedWithGoal] = useState(false);

  const fallbackTextareaRef = useRef<HTMLTextAreaElement>(null);

  const copyToClipboardWithFallback = async (
    textToCopy: string,
    setCopied: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }
    } catch {
      // Fallback below
    }

    const el = fallbackTextareaRef.current;
    if (el) {
      el.value = textToCopy;
      el.focus();
      el.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Ignore if execCommand is unavailable
      }
    }
  };

  const handleCopyGuide = () => {
    void copyToClipboardWithFallback(SKILLS_GUIDE_TEXT, setCopiedGuide);
  };

  const handleCopyGuideWithGoal = () => {
    const combined = buildGuideWithGoal(goal);
    void copyToClipboardWithFallback(combined, setCopiedWithGoal);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-start justify-between gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-200">
            <BookOpen className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            <span>Guide for AI</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Copy this and give it to any AI (Claude, ChatGPT...). It will learn how NEXUS skills work and write a correct skill for you.
          </p>
        </div>
        <span className="mt-0.5 flex-shrink-0 text-slate-400">
          {isOpen ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </span>
      </button>

      {isOpen && (
        <div className="px-3.5 pb-3.5 pt-2.5 border-t border-white/5 space-y-3">
          {/* Hidden fallback textarea for clipboard copy when navigator.clipboard is unavailable */}
          <textarea
            ref={fallbackTextareaRef}
            readOnly
            tabIndex={-1}
            aria-hidden="true"
            value={SKILLS_GUIDE_TEXT}
            className="sr-only"
          />

          {/* 1. Copy guide & 3. Show guide text toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleCopyGuide}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition-all"
            >
              {copiedGuide ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Copy guide</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowGuideText((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800/80 text-slate-300 hover:text-white border border-white/10 text-xs font-medium transition-all"
            >
              {showGuideText ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span>Hide guide text</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span>Show guide text</span>
                </>
              )}
            </button>
          </div>

          {/* 2. Optional skill goal input + Copy guide + my goal */}
          <div className="space-y-1.5">
            <label
              htmlFor="skills-guide-goal-input"
              className="block text-[11px] font-medium text-slate-300"
            >
              Your skill goal (optional)
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                id="skills-guide-goal-input"
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value.slice(0, 300))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}
                maxLength={300}
                placeholder="e.g. Review SQL queries for slow joins and suggest indexes"
                className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 transition-all"
              />
              <button
                type="button"
                onClick={handleCopyGuideWithGoal}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-all flex-shrink-0"
              >
                {copiedWithGoal ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Copy guide + my goal</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 3. Read-only scrollable plain-text box when toggled */}
          {showGuideText && (
            <div className="max-h-[220px] overflow-y-auto p-2.5 rounded-lg bg-slate-900/90 border border-white/10 text-[11px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed select-all">
              {SKILLS_GUIDE_TEXT}
            </div>
          )}

          {/* 4. 3-step hint */}
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {"1. Copy  2. Paste it into your AI and add your goal  3. Paste the AI's answer in the Name and Text boxes below, then Save."}
          </p>
        </div>
      )}
    </div>
  );
};
