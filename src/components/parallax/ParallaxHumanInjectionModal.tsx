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
      className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-fadeIn font-mono"
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl relative"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 12, 4, 0.98) 0%, rgba(6, 4, 2, 0.98) 100%)',
          border: '1.5px solid rgba(245, 158, 11, 0.5)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.9), 0 0 35px rgba(245, 158, 11, 0.25)',
        }}
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4.5 border-b border-amber-500/25 flex items-center justify-between bg-amber-950/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/50 grid place-items-center text-amber-400 shrink-0">
              <UserPlus size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="m-0 text-xs sm:text-sm font-black text-amber-300 uppercase tracking-wider">
                  HUMAN OPERATOR INJECTION
                </h3>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-200 border border-amber-500/40 font-bold">
                  ROUND 0{currentRound}
                </span>
              </div>
              <p className="m-0 text-[10px] sm:text-[11px] text-amber-400/70 font-sans">
                Inject custom counter-argument or directive into live swarm deliberation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 sm:space-y-4">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] font-sans text-amber-200 leading-relaxed flex items-start gap-2">
            <ShieldAlert size={15} className="text-amber-400 shrink-0 mt-0.5" />
            <span>
              Your injection will appear with a gold avatar. 3-4 swarm agents in the subsequent turn will be commanded to directly address and rebuttal your statement.
            </span>
          </div>

          <div>
            <label className="block text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              OPERATOR HANDLE:
            </label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="e.g. HUMAN OPERATOR / LEAD RESEARCHER"
              className="w-full px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              DIRECTIVE / OPINION / COUNTER-CLAIM:
            </label>
            <textarea
              rows={4}
              value={opinionText}
              onChange={(e) => setOpinionText(e.target.value)}
              placeholder="State your challenge, factual correction, or philosophical pivot here..."
              required
              className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-white font-sans text-xs sm:text-sm focus:outline-none focus:border-amber-400 resize-none leading-relaxed"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!opinionText.trim()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs transition-all shadow-[0_0_16px_rgba(245,158,11,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
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
