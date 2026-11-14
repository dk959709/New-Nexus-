import React, { useState, useEffect } from 'react';
import { Check, ArrowLeftRight, Columns } from 'lucide-react';
import type { CanvasArtifact } from '@/components/assistant/LiveArtifactCanvas';
import { extractReactProjectBundle, inlineStaticProject, parseProjectBundle } from '@/lib/canvasProject';
import { buildRunnableSandboxHtml } from '@/lib/canvasSandbox';
import { FormattedText } from '@/components/jarvis/FormattedText';

interface VisualVersionCompareProps {
  artifact: CanvasArtifact;
  draftContent: string;
  hasUnsavedEdits: boolean;
  themeCssOverride: string;
  onSelectVersion: (versionIndex: number) => void;
}

export const VisualVersionCompare: React.FC<VisualVersionCompareProps> = ({
  artifact,
  draftContent,
  hasUnsavedEdits,
  themeCssOverride,
  onSelectVersion,
}) => {
  const versions = artifact.versions || [];
  const defaultB = artifact.currentVersionIndex;
  const defaultA = Math.max(0, defaultB - 1);

  const [versionAIdx, setVersionAIdx] = useState<number>(defaultA);
  const [versionBIdx, setVersionBIdx] = useState<number>(defaultB);
  const [mobilePane, setMobilePane] = useState<'A' | 'B'>('B');

  useEffect(() => {
    const nextB = artifact.currentVersionIndex;
    const nextA = Math.max(0, nextB - 1);
    setVersionAIdx(nextA);
    setVersionBIdx(nextB);
  }, [artifact.id, artifact.currentVersionIndex, versions.length]);

  const safeA = Math.max(0, Math.min(versions.length - 1, versionAIdx));
  const safeB = Math.max(0, Math.min(versions.length - 1, versionBIdx));

  const renderVersionSurface = (versionIdx: number, paneKey: 'A' | 'B') => {
    const ver = versions[versionIdx];
    if (!ver) return null;

    const isLatestDraft =
      hasUnsavedEdits && versionIdx === artifact.currentVersionIndex;
    const rawContent = isLatestDraft ? draftContent : ver.content;

    if (artifact.kind === 'project') {
      const parsed = parseProjectBundle(rawContent);
      const htmlDoc = inlineStaticProject(parsed.files);
      const reactBundle = !htmlDoc ? extractReactProjectBundle(parsed.files) : null;

      if (htmlDoc || reactBundle) {
        const srcDoc = htmlDoc
          ? buildRunnableSandboxHtml({
              artifact: { ...artifact, kind: 'html', content: htmlDoc },
              inspectMode: false,
              themeCssOverride,
            })
          : buildRunnableSandboxHtml({
              artifact: { ...artifact, kind: 'react', content: reactBundle!.code },
              inspectMode: false,
              themeCssOverride,
              extraCss: reactBundle!.css,
            });
        return (
          <iframe
            key={`cmp-${paneKey}-${artifact.id}-${ver.versionNumber}-${rawContent.length}`}
            title={`${artifact.title} v${ver.versionNumber}`}
            sandbox="allow-scripts allow-modals allow-forms"
            srcDoc={srcDoc}
            className="w-full h-full min-h-[380px] border-0 bg-zinc-950 rounded-b-xl"
          />
        );
      }
    }

    if (artifact.kind === 'html' || artifact.kind === 'react') {
      const srcDoc = buildRunnableSandboxHtml({
        artifact: { ...artifact, content: rawContent },
        inspectMode: false,
        themeCssOverride,
      });
      return (
        <iframe
          key={`cmp-${paneKey}-${artifact.id}-${ver.versionNumber}-${rawContent.length}`}
          title={`${artifact.title} v${ver.versionNumber}`}
          sandbox="allow-scripts allow-modals allow-forms"
          srcDoc={srcDoc}
          className="w-full h-full min-h-[380px] border-0 bg-zinc-950 rounded-b-xl"
        />
      );
    }

    if (artifact.kind === 'svg' && rawContent.includes('<svg')) {
      const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(rawContent);
      return (
        <div className="flex-1 min-h-[340px] flex items-center justify-center p-4 bg-[#0c0c10] overflow-auto">
          <img src={svgUrl} alt={`v${ver.versionNumber}`} className="max-w-full max-h-[420px]" />
        </div>
      );
    }

    return (
      <div className="flex-1 min-h-[320px] p-4 overflow-y-auto text-xs sm:text-sm text-zinc-200 bg-zinc-950">
        {artifact.kind === 'markdown' ? (
          <FormattedText content={rawContent} />
        ) : (
          <pre className="font-mono text-xs whitespace-pre-wrap break-words text-zinc-300">
            {rawContent}
          </pre>
        )}
      </div>
    );
  };

  if (versions.length < 2) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-2.5 bg-[#0b0b0e]">
        <Columns size={28} className="text-zinc-600" />
        <p className="text-xs sm:text-sm font-semibold text-zinc-200">
          Need at least 2 versions for Visual A/B Compare
        </p>
        <p className="text-xs text-zinc-400 max-w-sm">
          Apply an AI edit, tune styles, or save a manual edit to create v2 and visually compare versions side-by-side.
        </p>
      </div>
    );
  }

  const verA = versions[safeA];
  const verB = versions[safeB];

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#09090b]">
      {/* Version Pickers Header */}
      <div className="px-3 py-2.5 border-b border-zinc-800 bg-zinc-950 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] font-mono font-bold text-zinc-400">A:</span>
            <select
              value={safeA}
              onChange={(e) => setVersionAIdx(Number(e.target.value))}
              className="min-h-[40px] max-w-[155px] sm:max-w-[200px] rounded-lg bg-zinc-900 border border-zinc-700 px-2.5 text-xs font-mono text-zinc-100 outline-none focus:border-cyan-400 cursor-pointer"
            >
              {versions.map((v, i) => (
                <option key={v.versionNumber} value={i}>
                  v{v.versionNumber} · {v.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setVersionAIdx(safeB);
              setVersionBIdx(safeA);
            }}
            className="min-h-[40px] min-w-[40px] rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 flex items-center justify-center cursor-pointer"
            title="Swap Version A and B"
          >
            <ArrowLeftRight size={14} />
          </button>

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] font-mono font-bold text-cyan-400">B:</span>
            <select
              value={safeB}
              onChange={(e) => setVersionBIdx(Number(e.target.value))}
              className="min-h-[40px] max-w-[155px] sm:max-w-[200px] rounded-lg bg-zinc-900 border border-zinc-700 px-2.5 text-xs font-mono text-cyan-200 outline-none focus:border-cyan-400 cursor-pointer"
            >
              {versions.map((v, i) => (
                <option key={v.versionNumber} value={i}>
                  v{v.versionNumber} · {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mobile Segmented A/B Flip Switcher */}
        <div className="flex lg:hidden w-full items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
          <button
            type="button"
            onClick={() => setMobilePane('A')}
            className={`flex-1 min-h-[42px] px-3 rounded-lg text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              mobilePane === 'A'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Version A (v{verA?.versionNumber})</span>
          </button>
          <button
            type="button"
            onClick={() => setMobilePane('B')}
            className={`flex-1 min-h-[42px] px-3 rounded-lg text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              mobilePane === 'B'
                ? 'bg-cyan-600/25 text-cyan-200 shadow-sm border border-cyan-500/40'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Version B (v{verB?.versionNumber})</span>
          </button>
        </div>
      </div>

      {/* Desktop Side-by-Side Grid / Mobile Full-Width Switched Pane */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800 overflow-hidden">
        {/* Pane A */}
        <div
          className={`flex-col min-h-0 overflow-hidden ${
            mobilePane === 'A' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <div className="px-3 py-2 bg-zinc-900/70 border-b border-zinc-800 flex items-center justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <div className="text-xs font-mono font-bold text-zinc-200 truncate">
                A · v{verA?.versionNumber} ({verA?.label})
              </div>
              <div className="text-[10px] font-mono text-zinc-500 tabular-nums">
                {verA ? new Date(verA.timestamp).toLocaleTimeString() : ''}
              </div>
            </div>
            <button
              type="button"
              disabled={artifact.currentVersionIndex === safeA}
              onClick={() => onSelectVersion(safeA)}
              className="min-h-[38px] px-3 rounded-lg bg-zinc-800 hover:bg-cyan-600 disabled:opacity-45 text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
            >
              <Check size={13} />
              <span>{artifact.currentVersionIndex === safeA ? 'Active' : `Use v${verA?.versionNumber}`}</span>
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto flex flex-col">
            {renderVersionSurface(safeA, 'A')}
          </div>
        </div>

        {/* Pane B */}
        <div
          className={`flex-col min-h-0 overflow-hidden ${
            mobilePane === 'B' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <div className="px-3 py-2 bg-zinc-900/70 border-b border-zinc-800 flex items-center justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <div className="text-xs font-mono font-bold text-cyan-300 truncate">
                B · v{verB?.versionNumber} ({verB?.label})
              </div>
              <div className="text-[10px] font-mono text-zinc-500 tabular-nums">
                {verB ? new Date(verB.timestamp).toLocaleTimeString() : ''}
              </div>
            </div>
            <button
              type="button"
              disabled={artifact.currentVersionIndex === safeB}
              onClick={() => onSelectVersion(safeB)}
              className="min-h-[38px] px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-45 text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
            >
              <Check size={13} />
              <span>{artifact.currentVersionIndex === safeB ? 'Active' : `Use v${verB?.versionNumber}`}</span>
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto flex flex-col">
            {renderVersionSurface(safeB, 'B')}
          </div>
        </div>
      </div>
    </div>
  );
};
