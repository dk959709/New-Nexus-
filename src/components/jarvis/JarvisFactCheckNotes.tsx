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
      {/* ⚠️ Flagged Issues & Severity Notes */}
      {notes.issues.map((issue, idx) => {
        const isPlausible =
          issue.includes('[PLAUSIBLE BUT UNCONFIRMED]') ||
          notes.plausibleUnconfirmed.includes(issue);
        const isFabricated =
          issue.includes('[FABRICATED/CONTRADICTED]') ||
          issue.includes('[FABRICATED]') ||
          notes.fabricatedOrContradicted.includes(issue);

        const cleanIssue = issue
          .replace(/^\[PLAUSIBLE BUT UNCONFIRMED\]\s*/i, '')
          .replace(/^\[FABRICATED\/CONTRADICTED\]\s*/i, '')
          .replace(/^\[FABRICATED\]\s*/i, '')
          .replace(/^\[CONTRADICTED\]\s*/i, '');

        if (isPlausible) {
          return (
            <div
              key={idx}
              className="flex items-start gap-2.5 px-3.5 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-200/90 text-xs leading-relaxed shadow-sm backdrop-blur-sm"
            >
              <Info
                size={14}
                className="text-cyan-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="flex-1">
                <span className="font-semibold text-cyan-300 mr-1.5 font-mono text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-cyan-500/20">
                  Unconfirmed Detail (Hedged)
                </span>
                <span>{cleanIssue}</span>
              </div>
            </div>
          );
        }

        if (isFabricated) {
          return (
            <div
              key={idx}
              className="flex items-start gap-2.5 px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-200/90 text-xs leading-relaxed shadow-sm backdrop-blur-sm"
            >
              <AlertTriangle
                size={14}
                className="text-rose-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="flex-1">
                <span className="font-semibold text-rose-300 mr-1.5 font-mono text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-rose-500/20">
                  Excluded Discrepancy
                </span>
                <span>{cleanIssue}</span>
              </div>
            </div>
          );
        }

        return (
          <div
            key={idx}
            className="flex items-start gap-2.5 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200/90 text-xs leading-relaxed shadow-sm backdrop-blur-sm"
          >
            <AlertTriangle
              size={14}
              className="text-amber-400 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="flex-1">
              <span className="font-semibold text-amber-300 mr-1.5 font-mono text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/20">
                Audit Note
              </span>
              <span>{cleanIssue}</span>
            </div>
          </div>
        );
      })}

      {/* ℹ️ Recency / Date status disclaimer */}
      {notes.hasOutdatedOrUnknownDate && (
        <div className="flex items-start gap-2.5 px-3.5 py-2 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-200/90 text-xs leading-relaxed shadow-sm backdrop-blur-sm">
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
