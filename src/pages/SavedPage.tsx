import { useState } from 'react';
import {
  BarChart3,
  Bookmark,
  Check,
  Copy,
  ExternalLink,
  Layers,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  JarvisSvgDiagram,
  JarvisChartCard,
  JarvisDeepResearchMeshAnswers,
  JarvisImageGallery,
} from '@/components/jarvis';
import { formatModelsUsedFooter } from '@/components/jarvis/formatJarvisPipelineExport';
import { storage } from '@/lib/storage';
import { playTapSound } from '@/lib/audio';
import { copyToClipboard } from '@/lib/clipboard';

function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-intro"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>;
}

export function SavedPage() {
  const [items, setItems] = useState(storage.getSaved());
  const [filter, setFilter] = useState<'all' | 'jarvis' | 'diagram' | 'chart' | 'other'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const remove = (id: string) => {
    playTapSound();
    setItems(storage.removeSaved(id));
  };

  const handleCopy = async (text: string, id: string, item?: typeof items[0]) => {
    playTapSound();
    let textToCopy = text;
    if (item && item.type === 'jarvis' && item.steps && item.steps.length > 0) {
      const modelsFooter = formatModelsUsedFooter(item.steps);
      if (modelsFooter) {
        textToCopy = `${text.trim()}\n\n${modelsFooter}`;
      }
    }
    const success = await copyToClipboard(textToCopy);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const jarvisItems = items.filter((i) => i.type === 'jarvis');
  const diagramItems = items.filter((i) => i.type === 'diagram' || (i.type !== 'jarvis' && !!i.diagramSvg));
  const chartItems = items.filter((i) => i.type === 'chart' || (i.type !== 'jarvis' && !!i.chartData));
  const otherItems = items.filter(
    (i) => i.type !== 'jarvis' && i.type !== 'diagram' && i.type !== 'chart' && !i.diagramSvg && !i.chartData
  );

  const filteredItems = items.filter((item) => {
    if (filter === 'jarvis') return item.type === 'jarvis';
    if (filter === 'diagram') return item.type === 'diagram' || (item.type !== 'jarvis' && !!item.diagramSvg);
    if (filter === 'chart') return item.type === 'chart' || (item.type !== 'jarvis' && !!item.chartData);
    if (filter === 'other') return item.type !== 'jarvis' && item.type !== 'diagram' && item.type !== 'chart' && !item.diagramSvg && !item.chartData;
    return true;
  });

  return (
    <>
      <PageIntro
        eyebrow="YOUR LIBRARY"
        title="Saved for later."
        description="Search results, stories, and JARVIS multi-agent syntheses you want to return to."
      />

      {items.length > 0 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filter === 'all'
                ? 'bg-gradient-to-r from-cyan-400 to-sky-400 text-slate-950 shadow-[0_0_12px_rgba(97,215,201,0.35)]'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
            }`}
          >
            All ({items.length})
          </button>

          {jarvisItems.length > 0 && (
            <button
              type="button"
              onClick={() => setFilter('jarvis')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                filter === 'jarvis'
                  ? 'bg-cyan-400 text-slate-950 shadow-[0_0_12px_rgba(97,215,201,0.35)]'
                  : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              }`}
            >
              <Sparkles size={13} />
              <span>JARVIS Syntheses ({jarvisItems.length})</span>
            </button>
          )}

          {chartItems.length > 0 && (
            <button
              type="button"
              onClick={() => setFilter('chart')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                filter === 'chart'
                  ? 'bg-sky-400 text-slate-950 shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                  : 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30'
              }`}
            >
              <BarChart3 size={13} />
              <span>Data Analyst Charts ({chartItems.length})</span>
            </button>
          )}

          {diagramItems.length > 0 && (
            <button
              type="button"
              onClick={() => setFilter('diagram')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                filter === 'diagram'
                  ? 'bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              <Layers size={13} />
              <span>Architect Blueprints ({diagramItems.length})</span>
            </button>
          )}

          {otherItems.length > 0 && (
            <button
              type="button"
              onClick={() => setFilter('other')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                filter === 'other'
                  ? 'bg-gradient-to-r from-cyan-400 to-sky-400 text-slate-950 shadow-[0_0_12px_rgba(97,215,201,0.35)]'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
              }`}
            >
              Web & Stories ({otherItems.length})
            </button>
          )}
        </div>
      )}

      {!filteredItems.length ? (
        <div className="empty-state">
          <Bookmark size={34} />
          <h2>Your library is empty</h2>
          <p>Save search results, stories, and JARVIS multi-agent answers to see them here.</p>
        </div>
      ) : (
        <div className="saved-list">
          {filteredItems.map((item) => {
            const isJarvis = item.type === 'jarvis';
            const isDiagram = item.type === 'diagram';
            const isChart = item.type === 'chart';
            const answerText = item.content || item.subtitle;

            if (isDiagram && item.diagramSvg) {
              return (
                <div
                  key={item.id}
                  className="w-full rounded-2xl p-5 sm:p-6 mb-4 bg-gradient-to-b from-[#181104]/90 via-[#0e0c06]/95 to-[#050402]/95 border border-amber-500/35 shadow-[0_4px_24px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all"
                >
                  {/* Top Bar */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-3 mb-3 border-b border-amber-500/20">
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/35 text-[10px] font-mono tracking-widest text-amber-300 font-bold uppercase">
                        <Layers size={12} className="text-amber-400" />
                        <span>ARCHITECT BLUEPRINT</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(item.savedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}{' '}
                        ·{' '}
                        {new Date(item.savedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        to={`/jarvis?q=${encodeURIComponent(item.title)}`}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-xs text-amber-300 flex items-center gap-1 transition-all"
                        title="Open in JARVIS Workspace"
                      >
                        <span>Open in JARVIS</span>
                        <ExternalLink size={12} />
                      </Link>

                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 transition-colors"
                        aria-label="Remove saved item"
                        title="Remove from saved library"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  <h2 className="text-base sm:text-lg font-bold text-white mb-2 leading-snug">
                    {item.title}
                  </h2>

                  {/* Full Interactive SVG Diagram */}
                  <JarvisSvgDiagram
                    id={item.id}
                    svgMarkup={item.diagramSvg}
                    title={item.title}
                    onSaveChange={(isStillSaved) => {
                      if (!isStillSaved) {
                        setItems(storage.getSaved());
                      }
                    }}
                  />
                </div>
              );
            }

            if ((isChart || item.type === 'chart') && item.chartData) {
              return (
                <div
                  key={item.id}
                  className="w-full rounded-2xl p-5 sm:p-6 mb-4 bg-gradient-to-b from-[#081828]/90 via-[#0a122e]/95 to-[#040814]/95 border border-sky-500/35 shadow-[0_4px_24px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all"
                >
                  {/* Top Bar */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-3 mb-3 border-b border-sky-500/20">
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-500/35 text-[10px] font-mono tracking-widest text-sky-300 font-bold uppercase">
                        <BarChart3 size={12} className="text-sky-400" />
                        <span>DATA ANALYST CHART</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(item.savedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}{' '}
                        ·{' '}
                        {new Date(item.savedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        to={`/jarvis?q=${encodeURIComponent(item.title)}`}
                        className="px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-xs text-sky-300 flex items-center gap-1 transition-all"
                        title="Open in JARVIS Workspace"
                      >
                        <span>Open in JARVIS</span>
                        <ExternalLink size={12} />
                      </Link>

                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 transition-colors"
                        aria-label="Remove saved item"
                        title="Remove from saved library"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  <h2 className="text-base sm:text-lg font-bold text-white mb-2 leading-snug">
                    {item.title}
                  </h2>

                  {/* Full Interactive Chart Card */}
                  <JarvisChartCard
                    id={item.id}
                    chartData={item.chartData}
                    title={item.title}
                    onSaveChange={(isStillSaved) => {
                      if (!isStillSaved) {
                        setItems(storage.getSaved());
                      }
                    }}
                  />
                </div>
              );
            }

            if (isJarvis) {
              return (
                <div
                  key={item.id}
                  className="w-full rounded-2xl p-5 sm:p-6 mb-4 bg-gradient-to-b from-[#0c1a26]/90 via-[#07131d]/95 to-[#040a10]/95 border border-cyan-500/30 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all"
                >
                  {/* Top Bar */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-3 mb-3 border-b border-cyan-500/20">
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/35 text-[10px] font-mono tracking-widest text-cyan-300 font-bold uppercase">
                        <Sparkles size={12} className="text-cyan-400" />
                        <span>JARVIS SYNTHESIS</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(item.savedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}{' '}
                        ·{' '}
                        {new Date(item.savedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(answerText, item.id, item)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white flex items-center gap-1.5 transition-all"
                        title="Copy synthesis text"
                      >
                        {copiedId === item.id ? (
                          <>
                            <Check size={13} className="text-emerald-400" />
                            <span className="text-emerald-300">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      <Link
                        to={`/jarvis?q=${encodeURIComponent(item.title)}`}
                        className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/35 text-xs text-cyan-300 flex items-center gap-1 transition-all"
                        title="Open in JARVIS Workspace"
                      >
                        <span>Open in JARVIS</span>
                        <ExternalLink size={12} />
                      </Link>

                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 transition-colors"
                        aria-label="Remove saved item"
                        title="Remove from saved library"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Question / Title */}
                  <h2 className="text-base sm:text-lg font-bold text-white mb-3 leading-snug">
                    {item.title}
                  </h2>

                  {/* Multi-Agent Breakdown (Full individual agent answers in saved library) */}
                  {item.steps && item.steps.length > 0 && (
                    <JarvisDeepResearchMeshAnswers
                      steps={item.steps}
                      query={item.title}
                      isDeepResearch={item.deepResearch}
                    />
                  )}

                  {/* Synthesized Answer Content */}
                  <div className="text-slate-200 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-sans">
                    {(item.deepResearch || (item.steps && item.steps.some((s) => s.status === 'completed' && s.agentId !== 'finalSynthesizer'))) && (
                      <div className="flex items-center gap-2 mb-3 pt-3 border-t border-purple-500/30">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/40 text-xs font-mono font-bold text-purple-300 shadow-[0_0_10px_rgba(192,132,252,0.2)]">
                          <Zap size={13} className="text-purple-400" />
                          <span>JARVIS // UNIFIED FINAL SYNTHESIS</span>
                        </div>
                      </div>
                    )}
                    {answerText}
                  </div>

                  {/* Retrieved Real Photographic Media if present */}
                  {item.images && item.images.length > 0 && (
                    <JarvisImageGallery images={item.images} title={item.title} />
                  )}

                  {/* Embedded Data Analyst Quantitative Chart if present */}
                  {(() => {
                    const effectiveChartData = item.chartData || (() => {
                      if (!item.steps) return null;
                      const daStep = item.steps.find((s) => s.agentId === 'dataAnalyst' && (s.status === 'completed' || s.outputPreview || s.rawOutput));
                      const raw = daStep?.outputPreview || daStep?.rawOutput;
                      if (raw) {
                        try {
                          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                          if (parsed && Array.isArray(parsed.labels) && Array.isArray(parsed.series)) {
                            return parsed;
                          }
                        } catch (err) {
                          void err;
                        }
                      }
                      return null;
                    })();

                    if (!effectiveChartData) return null;

                    return (
                      <JarvisChartCard
                        id={`chart-${item.id}`}
                        chartData={effectiveChartData}
                        title={item.title}
                      />
                    );
                  })()}

                  {/* Embedded SVG Architectural Blueprint if present */}
                  {(() => {
                    const effectiveDiagramSvg = item.diagramSvg || (() => {
                      if (!item.steps) return undefined;
                      const archStep = item.steps.find((s) => s.agentId === 'architect' && (s.status === 'completed' || s.outputPreview || s.rawOutput));
                      const raw = archStep?.outputPreview || archStep?.rawOutput;
                      if (raw && typeof raw === 'string' && raw.includes('<svg')) {
                        const start = raw.indexOf('<svg');
                        const end = raw.lastIndexOf('</svg>');
                        if (start !== -1 && end !== -1 && end > start) {
                          return raw.substring(start, end + 6);
                        }
                      }
                      return undefined;
                    })();

                    if (!effectiveDiagramSvg) return null;

                    return (
                      <JarvisSvgDiagram
                        id={`diagram-${item.id}`}
                        svgMarkup={effectiveDiagramSvg}
                        title={item.title}
                      />
                    );
                  })()}

                  {/* Grounded Sources */}
                  {item.sources && item.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-cyan-500/20 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-mono text-cyan-300/80 font-bold uppercase tracking-wider">
                        Grounded Sources ({item.sources.length}):
                      </span>
                      {item.sources.map((src, i) => (
                        <a
                          key={i}
                          href={src.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/30 text-xs text-cyan-200 hover:text-cyan-100 transition-colors"
                        >
                          <span className="max-w-[220px] truncate">{src.title || src.domain || 'Source'}</span>
                          <ExternalLink size={11} className="text-cyan-400" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div className="saved-item" key={item.id}>
                <div>
                  <span className="eyebrow">{item.type}</span>
                  <h2>{item.title}</h2>
                  <p>{item.subtitle}</p>
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noreferrer">
                      Open source <ExternalLink size={13} />
                    </a>
                  )}
                </div>
                <button onClick={() => remove(item.id)} aria-label="Remove saved item">
                  <Trash2 size={17} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
