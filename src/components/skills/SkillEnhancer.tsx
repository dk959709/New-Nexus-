import React, { useState } from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Wand2,
  Check,
  X,
} from 'lucide-react';
import { generateSkillFromIdea } from '@/lib/skillEnhancer';

interface SkillEnhancerProps {
  currentName: string;
  currentText: string;
  onChangeName: (name: string) => void;
  onChangeText: (text: string) => void;
  isMaxSkillsReached: boolean;
}

interface PendingGeneratedSkill {
  name: string;
  text: string;
  shortened: boolean;
}

export const SkillEnhancer: React.FC<SkillEnhancerProps> = ({
  currentName,
  currentText,
  onChangeName,
  onChangeText,
  isMaxSkillsReached,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [idea, setIdea] = useState('');
  const [loadingMode, setLoadingMode] = useState<'generate' | 'improve' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedNotice, setGeneratedNotice] = useState(false);
  const [shortenedNotice, setShortenedNotice] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingGeneratedSkill | null>(null);

  const isLoading = loadingMode !== null;
  const trimmedIdea = idea.trim();
  const hasExistingText = currentText.trim().length > 0;

  const applyGeneratedSkill = (result: PendingGeneratedSkill) => {
    if (!currentName.trim() && result.name.trim()) {
      onChangeName(result.name.trim().slice(0, 60));
    }
    onChangeText(result.text);
    setGeneratedNotice(true);
    setShortenedNotice(result.shortened);
    setPendingConfirm(null);
  };

  const handleRunEnhancer = async (mode: 'generate' | 'improve') => {
    if (isLoading || isMaxSkillsReached) return;
    if (mode === 'generate' && !trimmedIdea) return;
    if (mode === 'improve' && !hasExistingText) return;

    setErrorMsg(null);
    setGeneratedNotice(false);
    setShortenedNotice(false);
    setPendingConfirm(null);
    setLoadingMode(mode);

    try {
      const isNameEmpty = !currentName.trim();
      const res = await generateSkillFromIdea(
        idea,
        mode === 'improve' ? currentText : undefined,
        { isNameFieldEmpty: isNameEmpty },
      );

      const candidate: PendingGeneratedSkill = {
        name: res.name,
        text: res.text,
        shortened: Boolean(res.shortened),
      };

      if (currentText.trim().length > 0) {
        setPendingConfirm(candidate);
      } else {
        applyGeneratedSkill(candidate);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'AI provider unavailable. Check Settings → AI Providers.';
      setErrorMsg(msg);
    } finally {
      setLoadingMode(null);
    }
  };

  return (
    <div className="rounded-xl border border-cyan-500/25 bg-slate-950/70 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs font-semibold text-cyan-300 hover:text-cyan-200 transition-colors"
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span className="truncate">AI Skill Enhancer</span>
        </span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="px-3.5 pb-3.5 pt-2.5 border-t border-white/10 space-y-3">
          <div>
            <label
              htmlFor="skill-enhancer-idea-input"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              What should the skill do?
            </label>
            <input
              id="skill-enhancer-idea-input"
              type="text"
              value={idea}
              maxLength={300}
              disabled={isLoading || isMaxSkillsReached}
              onChange={(e) => setIdea(e.target.value.slice(0, 300))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (trimmedIdea && !isLoading && !isMaxSkillsReached) {
                    void handleRunEnhancer('generate');
                  }
                }
              }}
              placeholder="e.g. write the best image prompts for FLUX"
              className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-white/10 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/60 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleRunEnhancer('generate')}
              disabled={isLoading || !trimmedIdea || isMaxSkillsReached}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-cyan-500/40 bg-cyan-500/20 hover:bg-cyan-500/30 text-xs font-semibold text-cyan-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingMode === 'generate' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate skill</span>
                </>
              )}
            </button>

            {hasExistingText && (
              <button
                type="button"
                onClick={() => void handleRunEnhancer('improve')}
                disabled={isLoading || isMaxSkillsReached}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-slate-800/70 hover:bg-slate-700/80 text-xs font-medium text-slate-300 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMode === 'improve' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                    <span>Improving...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Improve my text</span>
                  </>
                )}
              </button>
            )}
          </div>

          {pendingConfirm && (
            <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-amber-200">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="font-medium">Replace the current text?</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => applyGeneratedSkill(pendingConfirm)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-500/25 border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/35 font-semibold transition-all"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Replace</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPendingConfirm(null)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/90 border border-white/10 text-slate-300 hover:text-white transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          )}

          {generatedNotice && (
            <div className="p-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-xs text-cyan-200 space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                <span>AI-generated. Read and edit before saving.</span>
              </div>
              {shortenedNotice && (
                <div className="flex items-center gap-2 text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span>The text was shortened to fit 24,000 characters.</span>
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span className="flex-1 min-w-0 break-words">{errorMsg}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
