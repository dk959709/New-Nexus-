import { useState, useRef, useEffect } from 'react';
import {
  Layers,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Download,
  Code2,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Bookmark,
  BookmarkCheck,
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { playTapSound } from '@/lib/audio';

interface JarvisSvgDiagramProps {
  id?: string;
  svgMarkup: string;
  title?: string;
  onSaveChange?: (isSaved: boolean) => void;
}

export function JarvisSvgDiagram({
  id,
  svgMarkup,
  title = 'Architectural Vector Blueprint',
  onSaveChange,
}: JarvisSvgDiagramProps) {
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [saved, setSaved] = useState(false);
  const [recentlySaved, setRecentlySaved] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const diagramId = id || `diagram-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;

  useEffect(() => {
    setSaved(storage.isSaved(diagramId));
  }, [diagramId]);

  const handleToggleSave = () => {
    playTapSound();
    const isNowSaved = !saved;
    if (isNowSaved) {
      storage.saveItem({
        id: diagramId,
        type: 'diagram',
        title: title || 'Architectural Vector Blueprint',
        subtitle: 'JARVIS Architect Vector Blueprint',
        diagramSvg: svgMarkup,
        savedAt: new Date().toISOString(),
      });
      setSaved(true);
      setRecentlySaved(true);
      setTimeout(() => setRecentlySaved(false), 2000);
    } else {
      storage.removeSaved(diagramId);
      setSaved(false);
      setRecentlySaved(false);
    }
    onSaveChange?.(isNowSaved);
  };

  const handleCopySvg = () => {
    playTapSound();
    navigator.clipboard.writeText(svgMarkup);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSvg = () => {
    playTapSound();
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jarvis-diagram-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoomLevel(1);

  return (
    <div
      ref={containerRef}
      className={`my-5 rounded-2xl overflow-hidden border transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-4 z-50 bg-slate-950/95 border-amber-500/50 shadow-2xl flex flex-col p-6'
          : 'border-amber-500/30 bg-slate-950/70 shadow-lg'
      }`}
      style={{
        boxShadow: isFullscreen
          ? '0 24px 64px rgba(0,0,0,0.9), 0 0 32px rgba(245,158,11,0.2)'
          : '0 8px 32px rgba(0,0,0,0.4), 0 0 16px rgba(245,158,11,0.1)',
      }}
    >
      {/* Header Toolbar */}
      <div className="px-4 py-2.5 bg-amber-950/30 border-b border-amber-500/25 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Layers size={14} />
          </div>
          <span className="text-xs font-mono font-bold text-amber-300 tracking-wide uppercase">
            🏗️ ARCHITECT BLUEPRINT
          </span>
          {title && (
            <span className="text-xs text-slate-400 hidden sm:inline">• {title}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Zoom controls for preview */}
          {viewMode === 'preview' && (
            <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-amber-500/20 mr-1">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.5}
                className="p-1 rounded text-slate-300 hover:text-amber-300 disabled:opacity-30 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut size={13} />
              </button>
              <span className="text-[10px] font-mono px-1 text-amber-300/90 font-semibold min-w-[36px] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 2.5}
                className="p-1 rounded text-slate-300 hover:text-amber-300 disabled:opacity-30 transition-colors"
                title="Zoom In"
              >
                <ZoomIn size={13} />
              </button>
              {zoomLevel !== 1 && (
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="p-1 rounded text-slate-400 hover:text-amber-300 transition-colors"
                  title="Reset Zoom"
                >
                  <RotateCcw size={11} />
                </button>
              )}
            </div>
          )}

          {/* Toggle View Mode */}
          <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-amber-500/20">
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all ${
                viewMode === 'preview'
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-400/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye size={12} />
              <span>Visual</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('code')}
              className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all ${
                viewMode === 'code'
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-400/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 size={12} />
              <span>SVG Code</span>
            </button>
          </div>

          {/* Save / Bookmark Blueprint */}
          <button
            type="button"
            onClick={handleToggleSave}
            className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
              recentlySaved
                ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                : saved
                ? 'bg-amber-500/25 text-amber-300 border border-amber-400/40'
                : 'text-slate-300 hover:text-amber-300 hover:bg-amber-500/15 border border-transparent hover:border-amber-500/30'
            }`}
            title={saved ? 'Saved in Library (Click to Remove)' : 'Save Blueprint to Library'}
          >
            {recentlySaved ? (
              <>
                <Check size={13} className="text-emerald-400" />
                <span className="text-emerald-300 font-bold">Saved ✓</span>
              </>
            ) : saved ? (
              <>
                <BookmarkCheck size={13} className="text-amber-400" />
                <span className="text-amber-300">Saved</span>
              </>
            ) : (
              <>
                <Bookmark size={13} />
                <span className="hidden sm:inline">Save</span>
              </>
            )}
          </button>

          {/* Download */}
          <button
            type="button"
            onClick={handleDownloadSvg}
            className="p-1.5 rounded-lg text-slate-300 hover:text-amber-300 hover:bg-amber-500/15 border border-transparent hover:border-amber-500/30 transition-all"
            title="Download .svg File"
          >
            <Download size={14} />
          </button>

          {/* Copy SVG */}
          <button
            type="button"
            onClick={handleCopySvg}
            className="p-1.5 rounded-lg text-slate-300 hover:text-amber-300 hover:bg-amber-500/15 border border-transparent hover:border-amber-500/30 transition-all"
            title="Copy Raw SVG"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-amber-300 hover:bg-amber-500/15 border border-transparent hover:border-amber-500/30 transition-all"
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Blueprint'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`p-4 overflow-auto flex items-center justify-center ${isFullscreen ? 'flex-1 min-h-0' : 'min-h-[260px] max-h-[560px]'}`}>
        {viewMode === 'preview' ? (
          <div
            className="w-full flex items-center justify-center transition-transform duration-150"
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'center center',
            }}
          >
            <div
              className="w-full max-w-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:rounded-xl [&>svg]:drop-shadow-md"
              dangerouslySetInnerHTML={{ __html: svgMarkup }}
            />
          </div>
        ) : (
          <div className="w-full h-full">
            <pre className="p-4 rounded-xl bg-black/60 border border-amber-500/20 text-amber-200/90 font-mono text-xs overflow-x-auto select-all max-h-[420px]">
              <code>{svgMarkup}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
