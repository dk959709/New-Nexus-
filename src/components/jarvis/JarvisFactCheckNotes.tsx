import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import type { JarvisExecutionStep } from '@/types';
import { extractFactCheckerNotes } from '@/lib/factCheckerHelper';

interface JarvisFactCheckNotesProps {
  steps?: JarvisExecutionStep[];
  className?: string;
}

/**
 * Distinctly styled frontend note panel appended to Final Synthesis
 * when Fact Checker reports issues or older/unknown date statuses.
 */
export const JarvisFactCheckNotes: React.FC<JarvisFactCheckNotesProps> = ({
  steps,
  className = '',
}) => {
  const notes = extractFactCheckerNotes(steps);
  if (!notes) return null;

  return (
    <div
      className={`mt-4 pt-3.5 border-t border-amber-500/20 flex flex-col gap-2.5 not-prose ${className}`}
    >
      {/* ⚠️ Issue Notes */}
      {notes.issues.map((issue, idx) => (
        <div
          key={idx}
          className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200/90 text-xs leading-relaxed shadow-sm backdrop-blur-sm"
        >
          <AlertTriangle
            size={14}
            className="text-amber-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="flex-1">
            <span className="font-semibold text-amber-300 mr-1.5 font-mono text-[11px] uppercase tracking-wide">
              Note:
            </span>
            <span>{issue}</span>
          </div>
        </div>
      ))}

      {/* ℹ️ Recency / Date status disclaimer */}
      {notes.hasOutdatedOrUnknownDate && (
        <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-200/90 text-xs leading-relaxed shadow-sm backdrop-blur-sm">
          <Info
            size={14}
            className="text-sky-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="flex-1">
            <span>Some information in this answer may not reflect the most recent developments.</span>
          </div>
        </div>
      )}
    </div>
  );
};
