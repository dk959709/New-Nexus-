import React from 'react';
import { Smartphone, Loader2, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import type { MobileSmokeReport } from '@/lib/canvasSandbox';

interface MobileSmokeCheckCardProps {
  report: MobileSmokeReport | null;
  running: boolean;
  canRunLive: boolean;
  aiRefining: boolean;
  onRunSmokeCheck: () => void;
  onAutoFixMobileIssues: (report: MobileSmokeReport) => void;
}

export const MobileSmokeCheckCard: React.FC<MobileSmokeCheckCardProps> = ({
  report,
  running,
  canRunLive,
  aiRefining,
  onRunSmokeCheck,
  onAutoFixMobileIssues,
}) => {
  const issueCount = report
    ? (report.horizontalOverflowPx > 0 ? 1 : 0) +
      report.smallTapTargets.length +
      report.brokenImages.length +
      (report.emptyRender ? 1 : 0) +
      report.runtimeErrors.length +
      report.staticHints.length
    : 0;

  return (
    <div className="rounded-2xl bg-zinc-900/75 border border-zinc-800 p-4 space-y-4">
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center text-cyan-300 shrink-0">
            <Smartphone size={16} />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-white">
              375px Mobile Readiness &amp; Smoke Check
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              Tests the live rendered DOM at phone width for horizontal overflow, undersized tap targets (&lt;40px), broken images, and runtime errors.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={running || !canRunLive}
          onClick={onRunSmokeCheck}
          className="min-h-[44px] px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-45 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 w-full sm:w-auto"
        >
          {running ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Smartphone size={14} />
          )}
          <span>{running ? 'Testing 375px Viewport...' : 'Run 375px Smoke Check'}</span>
        </button>
      </div>

      {!canRunLive && (
        <p className="text-xs text-zinc-400">
          Live mobile smoke checks apply to HTML, React/TSX, and web Project artifacts.
        </p>
      )}

      {report && (
        <div className="space-y-3.5 pt-2 border-t border-zinc-800/80">
          {/* Unboxed Tabular Summary Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <div className="text-[11px] text-zinc-400">375px Overflow</div>
              <div
                className={`text-base font-bold font-mono tabular-nums mt-0.5 ${
                  report.horizontalOverflowPx > 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {report.horizontalOverflowPx > 0 ? `+${report.horizontalOverflowPx}px` : '0px'}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-zinc-400">Tap Targets &lt;40px</div>
              <div
                className={`text-base font-bold font-mono tabular-nums mt-0.5 ${
                  report.smallTapTargets.length > 0 ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {report.smallTapTargets.length}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-zinc-400">Broken Images</div>
              <div
                className={`text-base font-bold font-mono tabular-nums mt-0.5 ${
                  report.brokenImages.length > 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {report.brokenImages.length}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-zinc-400">Runtime Errors</div>
              <div
                className={`text-base font-bold font-mono tabular-nums mt-0.5 ${
                  report.runtimeErrors.length > 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {report.runtimeErrors.length}
              </div>
            </div>
          </div>

          {issueCount === 0 ? (
            <div className="flex items-center gap-2 text-xs text-emerald-300 font-medium">
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
              <span>All 375px mobile checks passed cleanly (0 overflow, all tap targets &ge;40px).</span>
            </div>
          ) : (
            <div className="space-y-2">
              {report.horizontalOverflowPx > 0 && (
                <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/35 text-xs text-rose-200 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                  <span>
                    Page overflows horizontally by <strong>{report.horizontalOverflowPx}px</strong> at 375px viewport width.
                  </span>
                </div>
              )}

              {report.emptyRender && (
                <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/35 text-xs text-rose-200 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                  <span>Preview rendered blank at 375px (no visible text or visual nodes mounted).</span>
                </div>
              )}

              {report.smallTapTargets.map((target, idx) => (
                <div
                  key={`${target.tag}-${idx}`}
                  className="p-2.5 rounded-xl bg-amber-950/35 border border-amber-500/35 text-xs text-amber-200 flex items-start justify-between gap-2"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                    <span className="truncate">
                      &lt;{target.tag}&gt; &ldquo;{target.label}&rdquo; is too small for thumb taps
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-amber-300 tabular-nums shrink-0">
                    {target.width}x{target.height}px
                  </span>
                </div>
              ))}

              {report.brokenImages.map((img, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/35 text-xs text-rose-200 flex items-start gap-2"
                >
                  <AlertTriangle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                  <span className="break-all">
                    Broken image ({img.alt || 'no alt'}): {img.src || 'missing src'}
                  </span>
                </div>
              ))}

              {report.staticHints.map((hint, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 flex items-start gap-2"
                >
                  <AlertTriangle size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                  <span>{hint}</span>
                </div>
              ))}

              {report.runtimeErrors.map((errText, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/35 text-xs text-rose-200 font-mono flex items-start gap-2"
                >
                  <AlertTriangle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                  <span className="break-all">{errText}</span>
                </div>
              ))}

              <button
                type="button"
                disabled={aiRefining}
                onClick={() => onAutoFixMobileIssues(report)}
                className="w-full min-h-[44px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-1"
              >
                <Sparkles size={14} />
                <span>Fix Mobile Issues with AI</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
