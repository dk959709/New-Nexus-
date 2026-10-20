import React, { useState } from 'react';
import { UserPlus, Send, X, ShieldAlert } from 'lucide-react';
import type { ParallaxHumanInjection } from '@/types';

export interface ParallaxHumanInjectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (injection: ParallaxHumanInjection) => void;
  currentRound: number;
}

export const ParallaxHumanInjectionModal: React.FC<ParallaxHumanInjectionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  currentRound,
}) => {
  const [opinionText, setOpinionText] = useState('');
  const [authorName, setAuthorName] = useState('HUMAN OPERATOR');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!opinionText.trim()) return;

    onSubmit({
      id: `human_${Date.now()}`,
      text: opinionText.trim(),
      timestamp: Date.now(),
      authorName: authorName.trim() || 'HUMAN OPERATOR',
      roundInjected: currentRound,
    });

    setOpinionText('');
    onClose();
  };

  return (
    <div
      id="parallax-human-injection-modal"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 backdrop-blur-md p-3 sm:p-4 animate-fadeIn font-mono"
    >
      <div className="w-full max-w-lg rounded-2xl bg-slate-900/85 backdrop-blur-2xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.65)] relative">
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-500/15 grid place-items-center text-amber-300 shrink-0">
              <UserPlus size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="m-0 text-xs sm:text-sm font-black text-slate-100 uppercase tracking-wider">
                  HUMAN OPERATOR INJECTION
                </h3>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 font-bold">
                  ROUND 0{currentRound}
                </span>
              </div>
              <p className="m-0 text-[10px] sm:text-[11px] text-slate-300 font-sans">
                Inject custom counter-argument or directive into live swarm deliberation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-900/40 text-slate-300 hover:text-slate-100 hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 sm:space-y-4">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-[11px] font-sans text-amber-100 leading-relaxed flex items-start gap-2">
            <ShieldAlert size={15} className="text-amber-300 shrink-0 mt-0.5" />
            <span>
              Your injection will appear with a gold avatar. 3-4 swarm agents in the subsequent turn will be commanded to directly address and rebuttal your statement.
            </span>
          </div>

          <div>
            <label className="block text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
              OPERATOR HANDLE:
            </label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="e.g. HUMAN OPERATOR / LEAD RESEARCHER"
              className="w-full px-3 py-2 rounded-xl bg-slate-950/60 text-slate-100 placeholder-slate-400 font-mono text-xs focus:outline-none focus:bg-slate-900/80"
            />
          </div>

          <div>
            <label className="block text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
              DIRECTIVE / OPINION / COUNTER-CLAIM:
            </label>
            <textarea
              rows={4}
              value={opinionText}
              onChange={(e) => setOpinionText(e.target.value)}
              placeholder="State your challenge, factual correction, or philosophical pivot here..."
              required
              className="w-full p-3 rounded-xl bg-slate-950/60 text-slate-100 placeholder-slate-400 font-sans text-xs sm:text-sm focus:outline-none focus:bg-slate-900/80 resize-none leading-relaxed"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full bg-slate-800/50 hover:bg-slate-800/80 text-slate-200 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!opinionText.trim()}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs transition-all shadow-[0_0_16px_rgba(245,158,11,0.35)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
            >
              <Send size={13} />
              <span>Broadcast Directive</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
