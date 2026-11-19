import React from 'react';
import { ShieldCheck, AlertCircle, AlertTriangle, X, ArrowRight } from 'lucide-react';
import type { WorkflowValidationIssue } from '@/types';

interface WorkflowValidatorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  issues: WorkflowValidationIssue[];
  onFocusNode: (nodeId: string) => void;
}

export const WorkflowValidatorPanel: React.FC<WorkflowValidatorPanelProps> = ({
  isOpen,
  onClose,
  issues,
  onFocusNode,
}) => {
  if (!isOpen) return null;

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  return (
    <div className="wf-modal-backdrop fixed inset-0 z-[1300] bg-[#080b12]/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="wf-cyber-card wf-modal-panel rounded-t-3xl sm:rounded-2xl max-w-xl w-full max-h-[88dvh] flex flex-col overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.85)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                errors.length > 0
                  ? 'bg-rose-500/15 border-rose-400/40 text-rose-300'
                  : warnings.length > 0
                  ? 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                  : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
              }`}
            >
              <ShieldCheck size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-extrabold text-white truncate">
                Pre-Flight Health Check
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400">
                {errors.length} {errors.length === 1 ? 'error' : 'errors'} · {warnings.length}{' '}
                {warnings.length === 1 ? 'warning' : 'warnings'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300"
            aria-label="Close Validator"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {issues.length === 0 ? (
            <div className="p-8 rounded-2xl bg-emerald-500/10 border border-emerald-400/35 text-center space-y-2">
              <ShieldCheck size={34} className="mx-auto text-emerald-400" />
              <h4 className="text-base font-bold text-emerald-200">Pipeline is ready to run</h4>
              <p className="text-sm text-zinc-300 leading-relaxed">
                No missing fields, broken variable links, unreachable nodes, or cycles detected.
              </p>
            </div>
          ) : (
            issues.map((issue) => {
              const isErr = issue.severity === 'error';
              return (
                <div
                  key={issue.id}
                  className={`p-4 rounded-2xl border space-y-2 ${
                    isErr
                      ? 'bg-rose-500/10 border-rose-500/35'
                      : 'bg-amber-500/10 border-amber-500/35'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {isErr ? (
                      <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-mono font-bold uppercase px-2 py-0.5 rounded-md ${
                            isErr
                              ? 'bg-rose-500/20 text-rose-200'
                              : 'bg-amber-500/20 text-amber-200'
                          }`}
                        >
                          {issue.severity}
                        </span>
                        <h4 className="text-sm font-bold text-white">{issue.title}</h4>
                      </div>
                      <p className="text-sm text-zinc-300 mt-1 leading-relaxed">{issue.detail}</p>
                    </div>
                  </div>

                  {issue.nodeId && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          onFocusNode(issue.nodeId!);
                          onClose();
                        }}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-cyan-300 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <span>Inspect “{issue.nodeLabel || 'Step'}”</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
