import React, { useState } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  ArrowRight,
  Zap,
  RotateCw,
  Palette,
  Layers,
} from 'lucide-react';

interface JarvisPromptImageCardProps {
  id?: string;
  roughIdea: string;
  variations: string[];
  onUseInChat?: (prompt: string, mode: 'imagesai' | 'image') => void;
  onOpenImageStudio?: (prompt: string) => void;
  onGenerateMore?: (roughIdea: string) => void;
}

export const JarvisPromptImageCard: React.FC<JarvisPromptImageCardProps> = ({
  id,
  roughIdea,
  variations,
  onUseInChat,
  onOpenImageStudio,
  onGenerateMore,
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!variations || variations.length === 0) return null;

  const handleCopy = async (promptText: string, index: number) => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopiedIndex(index);
      setTimeout(() => {
        setCopiedIndex(null);
      }, 2500);
    } catch {
      // Fallback if clipboard API is restricted
      const textarea = document.createElement('textarea');
      textarea.value = promptText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedIndex(index);
      setTimeout(() => {
        setCopiedIndex(null);
      }, 2500);
    }
  };

  const handleGenerateMoreClick = () => {
    if (onGenerateMore) {
      setIsRefreshing(true);
      onGenerateMore(roughIdea);
      setTimeout(() => setIsRefreshing(false), 2000);
    }
  };

  return (
    <div
      id={id || 'jarvis-prompt-image-card'}
      className="my-5 rounded-2xl border border-fuchsia-500/30 bg-gradient-to-b from-slate-950/90 via-slate-900/80 to-slate-950/95 backdrop-blur-xl p-4 sm:p-6 shadow-2xl shadow-fuchsia-950/20 text-slate-100 transition-all duration-300"
    >
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-fuchsia-500/20">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-fuchsia-600/30 to-pink-500/20 border border-fuchsia-400/40 text-fuchsia-300 shadow-inner">
            <Palette size={18} className="text-fuchsia-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold tracking-wider text-fuchsia-300 uppercase">
                IMAGE PROMPT SYNTHESIZER
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-fuchsia-500/20 border border-fuchsia-400/30 text-fuchsia-200">
                5 Variations
              </span>
            </div>
            {roughIdea && (
              <p className="text-xs text-slate-400 mt-0.5 m-0 line-clamp-1">
                Concept:{' '}
                <span className="text-slate-200 font-medium">"{roughIdea}"</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
          <Sparkles size={13} className="text-pink-400" />
          <span className="hidden sm:inline">One-click copy & launch</span>
        </div>
      </div>

      {/* 5 Numbered Prompt Cards */}
      <div className="flex flex-col gap-3">
        {variations.map((promptText, index) => {
          const isCopied = copiedIndex === index;

          return (
            <div
              key={index}
              id={`prompt-variation-${index + 1}`}
              className="group relative rounded-xl border border-slate-800/80 bg-slate-900/60 hover:bg-slate-900/90 hover:border-fuchsia-500/40 transition-all duration-200 p-3.5 sm:p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                {/* Index badge */}
                <div className="shrink-0 w-7 h-7 rounded-lg bg-fuchsia-950/60 border border-fuchsia-500/30 text-fuchsia-300 font-mono text-xs font-bold flex items-center justify-center shadow-inner">
                  {String(index + 1).padStart(2, '0')}
                </div>

                {/* Prompt content & actions */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans select-text m-0 mb-3 break-words">
                    {promptText}
                  </p>

                  {/* Actions toolbar */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {/* Use This Prompt / Copy Button */}
                    <button
                      type="button"
                      id={`btn-copy-prompt-${index + 1}`}
                      onClick={() => handleCopy(promptText, index)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isCopied
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                          : 'bg-fuchsia-600/20 hover:bg-fuchsia-600/30 text-fuchsia-200 hover:text-white border border-fuchsia-500/30 hover:border-fuchsia-400/60'
                      }`}
                      title="Copy prompt to clipboard"
                    >
                      {isCopied ? (
                        <>
                          <Check size={13} className="text-emerald-300" />
                          <span>Copied to Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} className="text-fuchsia-300" />
                          <span>Use This Prompt</span>
                        </>
                      )}
                    </button>

                    {/* Launch in Image Studio */}
                    {onOpenImageStudio && (
                      <button
                        type="button"
                        id={`btn-open-studio-${index + 1}`}
                        onClick={() => {
                          handleCopy(promptText, index);
                          onOpenImageStudio(promptText);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700/80 text-pink-300 hover:text-pink-100 border border-pink-500/20 hover:border-pink-500/40 transition-colors"
                        title="Open this prompt in Image Studio"
                      >
                        <Layers size={13} className="text-pink-400" />
                        <span>Image Studio</span>
                        <ArrowRight size={12} className="text-pink-400" />
                      </button>
                    )}

                    {/* Direct Run /imagesai */}
                    {onUseInChat && (
                      <button
                        type="button"
                        id={`btn-run-imagesai-${index + 1}`}
                        onClick={() => onUseInChat(promptText, 'imagesai')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 hover:text-cyan-100 border border-cyan-500/30 hover:border-cyan-400/50 transition-colors"
                        title="Generate AI image immediately with /imagesai"
                      >
                        <Zap size={12} className="text-cyan-400" />
                        <span>/imagesai</span>
                      </button>
                    )}

                    {/* Direct Run /image (Dual Photo + AI) */}
                    {onUseInChat && (
                      <button
                        type="button"
                        id={`btn-run-image-${index + 1}`}
                        onClick={() => onUseInChat(promptText, 'image')}
                        className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-purple-950/50 hover:bg-purple-900/60 text-purple-300 hover:text-purple-100 border border-purple-500/30 hover:border-purple-400/50 transition-colors"
                        title="Run dual real photo + AI visual search with /image"
                      >
                        <span>/image</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Footer Action: 🔄 Generate 5 More */}
      {onGenerateMore && (
        <div className="mt-5 pt-4 border-t border-fuchsia-500/20 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 font-mono">
            Want different aesthetics or lighting variations?
          </div>

          <button
            type="button"
            id="btn-generate-5-more"
            onClick={handleGenerateMoreClick}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-fuchsia-600/30 via-pink-600/20 to-purple-600/30 hover:from-fuchsia-600/50 hover:via-pink-600/40 hover:to-purple-600/50 text-fuchsia-100 border border-fuchsia-500/40 hover:border-fuchsia-400/70 shadow-lg shadow-fuchsia-950/40 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <RotateCw
              size={15}
              className={`text-fuchsia-300 ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`}
            />
            <span>🔄 Generate 5 More</span>
          </button>
        </div>
      )}
    </div>
  );
};
