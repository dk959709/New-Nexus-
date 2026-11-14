import React, { useMemo, useState } from 'react';
import {
  X,
  Sparkles,
  Palette,
  Globe,
  Share2,
  Copy,
  Check,
  Download,
  Code2,
  Smartphone,
  Wand2,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import {
  extractColorPalette,
  extractSeoMetaInfo,
} from '@/lib/canvasSandbox';
import { copyToClipboard } from '@/lib/clipboard';
import type { CanvasArtifact } from '@/components/assistant/LiveArtifactCanvas';

export type StudioToolsTab = 'prompts' | 'colors' | 'seo' | 'share';

interface CanvasToolsSheetProps {
  isOpen: boolean;
  activeTab: StudioToolsTab;
  onChangeTab: (tab: StudioToolsTab) => void;
  onClose: () => void;
  artifact: CanvasArtifact | null;
  sourceCode: string;
  standaloneHtml: string;
  aiRefining?: boolean;
  onApplyAiPrompt: (prompt: string, label: string) => void;
  onApplyReplaceColor: (oldColor: string, newColor: string) => number;
  onDownloadStandaloneHtml: () => void;
}

const PROMPT_CATEGORIES: Array<{
  category: string;
  icon: 'mobile' | 'interact' | 'visual';
  items: Array<{ title: string; subtitle: string; prompt: string }>;
}> = [
  {
    category: 'Mobile & Ergonomics',
    icon: 'mobile',
    items: [
      {
        title: 'Thumb-Friendly Navigation',
        subtitle: 'Add sticky bottom tab bar & >=44px tap targets',
        prompt:
          'Refactor navigation into a mobile-first sticky bottom bar on small screens and ensure every button, tab, and form input is at least 44px tall with generous spacing.',
      },
      {
        title: 'Zero Horizontal Scroll',
        subtitle: 'Fix overflow, wrap grids & make tables scroll cleanly',
        prompt:
          'Make this 100% responsive down to 375px wide with zero horizontal page overflow: wrap wide flex rows cleanly, add overflow-x-auto to tables, and stack multi-column grids vertically on phones.',
      },
      {
        title: 'Clean Bottom Sheet Modals',
        subtitle: 'Convert cramped popups into mobile bottom sheets',
        prompt:
          'Upgrade any modal dialogs or dropdown drawers into smooth mobile bottom sheets with drag handle affordances and safe-area padding on phone viewports.',
      },
    ],
  },
  {
    category: 'Interactivity & Persistence',
    icon: 'interact',
    items: [
      {
        title: 'Save State to localStorage',
        subtitle: 'Persist user changes across reloads automatically',
        prompt:
          'Persist the primary interactive state and user edits cleanly into window.localStorage with a Reset to Defaults action so changes survive reloads.',
      },
      {
        title: 'Live Search, Filter & Sort',
        subtitle: 'Instant client-side filtering and sort toggles',
        prompt:
          'Add instant search filtering, category/status filter chips, and sort controls wired cleanly to the primary data items with an empty-state message when no items match.',
      },
      {
        title: 'Interactive Toast & Undo',
        subtitle: 'Non-blocking feedback banner on user actions',
        prompt:
          'Add lightweight non-blocking toast confirmations with a brief Undo action whenever users create, update, or delete records.',
      },
    ],
  },
  {
    category: 'Visual Hierarchy & Semantics',
    icon: 'visual',
    items: [
      {
        title: 'Empty, Loading & Error States',
        subtitle: 'Handle edge cases with clear action recovery',
        prompt:
          'Add polished loading skeletons, helpful empty states with clear primary CTAs, and inline error recovery banners without using browser alert() prompts.',
      },
      {
        title: 'CSV & JSON Export Action',
        subtitle: 'Let users download displayed records or copy summary',
        prompt:
          'Add a clean Export Data action allowing users to download the current filtered items as CSV or copy a formatted summary to clipboard.',
      },
      {
        title: 'Micro-Typography & Contrast',
        subtitle: 'Tabular figures, crisp hierarchy & WCAG contrast',
        prompt:
          'Refine typography hierarchy, apply tabular-nums to all numeric counters/prices/dates, improve text contrast on dark surfaces, and ensure semantic ARIA labels.',
      },
    ],
  },
];

const QUICK_SWAP_TARGETS = [
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#10b981',
  '#f59e0b',
  '#f43f5e',
  '#ec4899',
  '#18181b',
  '#f8fafc',
];

export const CanvasToolsSheet: React.FC<CanvasToolsSheetProps> = ({
  isOpen,
  activeTab,
  onChangeTab,
  onClose,
  artifact,
  sourceCode,
  standaloneHtml,
  aiRefining = false,
  onApplyAiPrompt,
  onApplyReplaceColor,
  onDownloadStandaloneHtml,
}) => {
  const [selectedOldColor, setSelectedOldColor] = useState<string>('');
  const [customNewColor, setCustomNewColor] = useState<string>('#06b6d4');
  const [copiedSwatch, setCopiedSwatch] = useState<string | null>(null);
  const [swapFeedback, setSwapFeedback] = useState<string | null>(null);
  const [copiedShareKey, setCopiedShareKey] = useState<'html' | 'iframe' | null>(null);

  const palette = useMemo(() => extractColorPalette(sourceCode), [sourceCode]);
  const seoInfo = useMemo(
    () => extractSeoMetaInfo(sourceCode, artifact?.title || 'Live Canvas App'),
    [sourceCode, artifact?.title],
  );

  const embedIframeSnippet = useMemo(() => {
    if (!standaloneHtml) return '';
    const escapedAttr = standaloneHtml
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;');
    return `<iframe title="${(artifact?.title || 'Live App').replace(/"/g, '')}" sandbox="allow-scripts allow-forms" style="width:100%;height:640px;border:0;border-radius:12px;" srcdoc="${escapedAttr}"></iframe>`;
  }, [standaloneHtml, artifact?.title]);

  if (!isOpen || !artifact) return null;

  const activeSourceColor = selectedOldColor || palette[0]?.color || '';

  const handleCopyColor = async (hex: string) => {
    const ok = await copyToClipboard(hex);
    if (ok) {
      setCopiedSwatch(hex);
      setTimeout(() => setCopiedSwatch(null), 1500);
    }
  };

  const handleSwapColor = () => {
    if (!activeSourceColor || !customNewColor) return;
    if (activeSourceColor.toLowerCase() === customNewColor.toLowerCase()) return;
    const replacements = onApplyReplaceColor(activeSourceColor, customNewColor);
    if (replacements > 0) {
      setSwapFeedback(`Replaced ${replacements} occurrence(s) of ${activeSourceColor} with ${customNewColor}.`);
      setSelectedOldColor(customNewColor.toLowerCase());
      setTimeout(() => setSwapFeedback(null), 2600);
    } else {
      setSwapFeedback(`No exact matches found for ${activeSourceColor} in source.`);
      setTimeout(() => setSwapFeedback(null), 2200);
    }
  };

  const handleCopyShare = async (kind: 'html' | 'iframe') => {
    const payload = kind === 'html' ? standaloneHtml : embedIframeSnippet;
    if (!payload) return;
    const ok = await copyToClipboard(payload);
    if (ok) {
      setCopiedShareKey(kind);
      setTimeout(() => setCopiedShareKey(null), 1800);
    }
  };

  const seoChecks = [
    { label: 'HTML <title>', ok: Boolean(seoInfo.title), value: seoInfo.title },
    { label: 'Meta description', ok: Boolean(seoInfo.description), value: seoInfo.description || 'Missing <meta name="description">' },
    { label: 'Mobile viewport', ok: Boolean(seoInfo.viewport), value: seoInfo.viewport || 'Missing viewport tag' },
    { label: 'OpenGraph tags', ok: Boolean(seoInfo.ogTitle || seoInfo.ogDescription), value: seoInfo.ogTitle || 'Missing og:title / og:description' },
    { label: 'Document lang & H1', ok: seoInfo.hasLangAttr && seoInfo.hasH1, value: `${seoInfo.hasLangAttr ? 'lang set' : 'missing lang'} · ${seoInfo.hasH1 ? '<h1> present' : 'no <h1>'}` },
  ];

  return (
    <div
      className="fixed inset-0 flex items-end lg:items-center justify-center bg-black/60 backdrop-blur-sm"
      style={{ zIndex: 1185 }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Live Studio Toolbox"
        onClick={(e) => e.stopPropagation()}
        style={{
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))',
        }}
        className="w-full lg:max-w-2xl max-h-[88dvh] rounded-t-3xl lg:rounded-2xl border border-zinc-800 bg-zinc-950/98 text-zinc-100 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Mobile Drag Handle */}
        <div className="lg:hidden pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-zinc-700" />
        </div>

        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate">
              Canvas Studio Tools
            </h3>
            <p className="text-[11px] text-zinc-400 truncate">
              {artifact.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
            aria-label="Close Studio Tools"
          >
            <X size={16} />
          </button>
        </div>

        {/* Mobile-First Category Tabs (>=44px touch targets) */}
        <div className="px-3 py-2 border-b border-zinc-800/80 bg-zinc-900/50 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {[
            { id: 'prompts' as const, label: 'Quick Prompts', icon: Sparkles },
            { id: 'colors' as const, label: `Colors (${palette.length})`, icon: Palette },
            { id: 'seo' as const, label: 'SEO & Meta', icon: Globe },
            { id: 'share' as const, label: 'Export HTML', icon: Share2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeTab(tab.id)}
                className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200 font-semibold'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
                }`}
              >
                <Icon size={14} className={active ? 'text-cyan-300' : 'text-zinc-400'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sheet Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {activeTab === 'prompts' && (
            <div className="space-y-5">
              <p className="text-xs text-zinc-400 leading-relaxed">
                Tap any curated upgrade below to refine this artifact without typing long instructions on mobile.
              </p>
              {PROMPT_CATEGORIES.map((group) => (
                <div key={group.category} className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                    {group.icon === 'mobile' ? (
                      <Smartphone size={12} className="text-cyan-400" />
                    ) : group.icon === 'interact' ? (
                      <Wand2 size={12} className="text-emerald-400" />
                    ) : (
                      <Sparkles size={12} className="text-amber-400" />
                    )}
                    <span>{group.category}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {group.items.map((item) => (
                      <button
                        key={item.title}
                        type="button"
                        disabled={aiRefining}
                        onClick={() => {
                          onApplyAiPrompt(item.prompt, item.title);
                          onClose();
                        }}
                        className="min-h-[52px] w-full p-3 rounded-xl bg-zinc-900/90 hover:bg-zinc-800/90 border border-zinc-800 hover:border-cyan-500/40 text-left flex items-center justify-between gap-3 transition-colors disabled:opacity-45 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-zinc-100">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-zinc-400 mt-0.5">
                            {item.subtitle}
                          </div>
                        </div>
                        <ArrowRight size={15} className="text-cyan-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'colors' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-zinc-200">
                    Extracted Palette ({palette.length})
                  </h4>
                  <span className="text-[11px] text-zinc-500">Tap swatch to select or copy</span>
                </div>

                {palette.length === 0 ? (
                  <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
                    No explicit HEX color tokens found in this artifact source. Try editing Tailwind utility classes via AI or Design Tune.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {palette.map((item) => {
                      const selected = activeSourceColor.toLowerCase() === item.color.toLowerCase();
                      const copied = copiedSwatch === item.color;
                      return (
                        <div
                          key={item.color}
                          className={`rounded-xl border p-2 flex items-center justify-between gap-2 transition-colors ${
                            selected
                              ? 'bg-cyan-950/35 border-cyan-400/60'
                              : 'bg-zinc-900 border-zinc-800'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedOldColor(item.color)}
                            className="min-h-[44px] flex-1 flex items-center gap-2 text-left min-w-0 cursor-pointer"
                          >
                            <span
                              className="w-7 h-7 rounded-lg border border-white/20 shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-mono text-zinc-100 truncate">
                                {item.color}
                              </div>
                              <div className="text-[10px] font-mono text-zinc-500 tabular-nums">
                                {item.count}x
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyColor(item.color)}
                            className="min-h-[44px] min-w-[44px] rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
                            title={`Copy ${item.color}`}
                          >
                            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {palette.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-zinc-200">
                      Instant Source Color Swapper
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400">
                      {activeSourceColor} → {customNewColor}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {QUICK_SWAP_TARGETS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setCustomNewColor(hex)}
                        className={`min-h-[44px] min-w-[44px] rounded-xl border flex items-center justify-center cursor-pointer transition-transform ${
                          customNewColor.toLowerCase() === hex.toLowerCase()
                            ? 'border-white scale-105 ring-2 ring-cyan-400/50'
                            : 'border-zinc-700'
                        }`}
                        style={{ backgroundColor: hex }}
                        aria-label={`Select target color ${hex}`}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="color"
                      value={/^#[0-9a-f]{6}$/i.test(customNewColor) ? customNewColor : '#06b6d4'}
                      onChange={(e) => setCustomNewColor(e.target.value)}
                      className="min-h-[44px] w-14 rounded-xl bg-zinc-950 border border-zinc-700 p-1 cursor-pointer"
                      aria-label="Pick replacement color"
                    />
                    <input
                      type="text"
                      value={customNewColor}
                      onChange={(e) => setCustomNewColor(e.target.value)}
                      placeholder="#06b6d4"
                      className="min-h-[44px] flex-1 min-w-[110px] px-3 rounded-xl bg-zinc-950 border border-zinc-700 text-xs font-mono text-zinc-100 outline-none focus:border-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={handleSwapColor}
                      className="min-h-[44px] px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold cursor-pointer"
                    >
                      Replace All
                    </button>
                  </div>

                  {swapFeedback && (
                    <div className="text-xs font-mono text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 rounded-xl px-3 py-2">
                      {swapFeedback}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'seo' && (
            <div className="space-y-4">
              {/* Live Search Result Preview Card */}
              <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1.5">
                <div className="text-[11px] font-mono text-zinc-500">
                  Search &amp; Social Share Preview
                </div>
                <div className="text-sm font-semibold text-cyan-400 leading-snug">
                  {seoInfo.ogTitle || seoInfo.title}
                </div>
                <div className="text-[11px] font-mono text-emerald-400 truncate">
                  https://app.preview/{artifact.id.slice(0, 18)}
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {seoInfo.ogDescription ||
                    seoInfo.description ||
                    'No meta description detected yet. Add structured metadata so search engines and social cards render cleanly.'}
                </p>
              </div>

              <div className="space-y-2">
                {seoChecks.map((check) => (
                  <div
                    key={check.label}
                    className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                        {check.ok ? (
                          <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                        )}
                        <span>{check.label}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 break-words font-mono">
                        {check.value}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold shrink-0 ${
                        check.ok
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {check.ok ? 'PASS' : 'MISSING'}
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                disabled={aiRefining}
                onClick={() => {
                  onApplyAiPrompt(
                    'Add clean SEO & social share metadata (<title>, <meta name="description">, <meta name="viewport" content="width=device-width, initial-scale=1.0">, og:title, og:description, html lang="en", and a semantic <h1> heading) without altering visual layout.',
                    'Upgrade SEO & Social Meta Tags',
                  );
                  onClose();
                }}
                className="w-full min-h-[44px] px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-45 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles size={14} />
                <span>Add / Upgrade SEO &amp; OpenGraph Tags with AI</span>
              </button>
            </div>
          )}

          {activeTab === 'share' && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-400 leading-relaxed">
                Export a standalone, zero-build runnable HTML file (works offline/static even for React TSX and multi-file Projects) or copy an embeddable iframe snippet.
              </p>

              {!standaloneHtml ? (
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
                  Standalone HTML bundling applies to HTML, React TSX, and Web Project artifacts. Switch to a web artifact or port this artifact to HTML/React first.
                </div>
              ) : (
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={onDownloadStandaloneHtml}
                    className="w-full min-h-[48px] px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Download size={15} />
                    <span>Download Standalone Single-File .html</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyShare('html')}
                    className="w-full min-h-[48px] px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs font-medium flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {copiedShareKey === 'html' ? (
                      <Check size={15} className="text-emerald-400" />
                    ) : (
                      <Copy size={15} className="text-cyan-400" />
                    )}
                    <span>
                      {copiedShareKey === 'html'
                        ? 'Copied Complete Standalone HTML'
                        : 'Copy Complete Standalone HTML'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyShare('iframe')}
                    className="w-full min-h-[48px] px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs font-medium flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {copiedShareKey === 'iframe' ? (
                      <Check size={15} className="text-emerald-400" />
                    ) : (
                      <Code2 size={15} className="text-purple-400" />
                    )}
                    <span>
                      {copiedShareKey === 'iframe'
                        ? 'Copied <iframe srcdoc> Embed'
                        : 'Copy <iframe srcdoc="..."> Embed Snippet'}
                    </span>
                  </button>

                  <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800 text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                    <span>Bundled size</span>
                    <span className="text-zinc-200 tabular-nums">
                      {(standaloneHtml.length / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
