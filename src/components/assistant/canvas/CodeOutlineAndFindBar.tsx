import React, { useMemo, useState } from 'react';
import {
  Search,
  Replace,
  ListTree,
  Sparkles,
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-react';
import { extractCodeOutline, formatCanvasCode } from '@/lib/canvasSandbox';

interface CodeOutlineAndFindBarProps {
  code: string;
  kind: string;
  canEdit?: boolean;
  onChangeCode: (nextCode: string) => void;
  onJumpToLine: (lineNum: number, highlightStart?: number, highlightEnd?: number) => void;
}

export const CodeOutlineAndFindBar: React.FC<CodeOutlineAndFindBarProps> = ({
  code,
  kind,
  canEdit = true,
  onChangeCode,
  onJumpToLine,
}) => {
  const [findOpen, setFindOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);
  const [formattedToast, setFormattedToast] = useState(false);

  const outlineSymbols = useMemo(() => extractCodeOutline(code, kind), [code, kind]);

  const matches = useMemo(() => {
    if (!query) return [];
    const results: Array<{ start: number; end: number; line: number }> = [];
    const haystack = caseSensitive ? code : code.toLowerCase();
    const needle = caseSensitive ? query : query.toLowerCase();
    if (!needle) return results;

    let pos = 0;
    while (pos <= haystack.length - needle.length) {
      const idx = haystack.indexOf(needle, pos);
      if (idx === -1) break;
      const line = code.slice(0, idx).split('\n').length;
      results.push({ start: idx, end: idx + needle.length, line });
      pos = idx + Math.max(1, needle.length);
      if (results.length >= 250) break;
    }
    return results;
  }, [code, query, caseSensitive]);

  const safeMatchIdx = matches.length > 0 ? activeMatchIdx % matches.length : 0;

  const jumpToMatch = (idx: number) => {
    if (matches.length === 0) return;
    const normalized = ((idx % matches.length) + matches.length) % matches.length;
    setActiveMatchIdx(normalized);
    const m = matches[normalized];
    onJumpToLine(m.line, m.start, m.end);
  };

  const handleReplaceCurrent = () => {
    if (!canEdit || matches.length === 0) return;
    const m = matches[safeMatchIdx];
    const next = code.slice(0, m.start) + replaceText + code.slice(m.end);
    onChangeCode(next);
  };

  const handleReplaceAll = () => {
    if (!canEdit || !query || matches.length === 0) return;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
    const next = code.replace(regex, replaceText);
    onChangeCode(next);
  };

  const handleFormat = () => {
    if (!canEdit) return;
    const formatted = formatCanvasCode(code, kind);
    onChangeCode(formatted);
    setFormattedToast(true);
    setTimeout(() => setFormattedToast(false), 1500);
  };

  return (
    <div className="border-b border-zinc-800 bg-zinc-950/90 flex flex-col shrink-0">
      {/* Compact Scrollable Bar */}
      <div className="px-2.5 py-1.5 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setFindOpen((p) => !p);
              setOutlineOpen(false);
            }}
            className={`min-h-[36px] px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              findOpen
                ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
            }`}
          >
            <Search size={12} className="text-cyan-400" />
            <span>Find &amp; Replace</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setOutlineOpen((p) => !p);
              setFindOpen(false);
            }}
            className={`min-h-[36px] px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer tabular-nums ${
              outlineOpen
                ? 'bg-indigo-500/20 border-indigo-400/60 text-indigo-200'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
            }`}
          >
            <ListTree size={12} className="text-indigo-400" />
            <span>Outline ({outlineSymbols.length})</span>
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={handleFormat}
              className={`min-h-[36px] px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                formattedToast
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
              }`}
              title="Clean trailing whitespace & normalize spacing"
            >
              <Sparkles size={12} className="text-emerald-400" />
              <span>{formattedToast ? 'Formatted' : 'Format'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Expandable Find & Replace Drawer */}
      {findOpen && (
        <div className="px-2.5 pb-2.5 pt-1 border-t border-zinc-800/70 space-y-2 bg-zinc-900/60">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex-1 min-w-[140px] flex items-center bg-zinc-950 border border-zinc-700 focus-within:border-cyan-400 rounded-lg px-2.5 min-h-[40px]">
              <Search size={13} className="text-zinc-500 mr-1.5 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveMatchIdx(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    jumpToMatch(e.shiftKey ? safeMatchIdx - 1 : safeMatchIdx + 1);
                  }
                }}
                placeholder="Find text..."
                className="w-full bg-transparent text-xs font-mono text-zinc-100 outline-none"
              />
              <span className="text-[10px] font-mono text-zinc-400 ml-1.5 shrink-0 tabular-nums">
                {query ? `${matches.length ? safeMatchIdx + 1 : 0}/${matches.length}` : ''}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setCaseSensitive((p) => !p)}
              className={`min-h-[40px] px-2.5 rounded-lg border text-xs font-mono cursor-pointer ${
                caseSensitive
                  ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200 font-bold'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400'
              }`}
              title="Match Case"
            >
              Aa
            </button>

            <button
              type="button"
              disabled={matches.length === 0}
              onClick={() => jumpToMatch(safeMatchIdx - 1)}
              className="min-h-[40px] min-w-[40px] rounded-lg bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-800 text-zinc-300 flex items-center justify-center cursor-pointer"
              aria-label="Previous match"
            >
              <ChevronUp size={14} />
            </button>

            <button
              type="button"
              disabled={matches.length === 0}
              onClick={() => jumpToMatch(safeMatchIdx + 1)}
              className="min-h-[40px] min-w-[40px] rounded-lg bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-800 text-zinc-300 flex items-center justify-center cursor-pointer"
              aria-label="Next match"
            >
              <ChevronDown size={14} />
            </button>

            <button
              type="button"
              onClick={() => setFindOpen(false)}
              className="min-h-[40px] min-w-[40px] rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
              aria-label="Close Find bar"
            >
              <X size={14} />
            </button>
          </div>

          {canEdit && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex-1 min-w-[140px] flex items-center bg-zinc-950 border border-zinc-700 focus-within:border-cyan-400 rounded-lg px-2.5 min-h-[40px]">
                <Replace size={13} className="text-zinc-500 mr-1.5 shrink-0" />
                <input
                  type="text"
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  placeholder="Replace with..."
                  className="w-full bg-transparent text-xs font-mono text-zinc-100 outline-none"
                />
              </div>

              <button
                type="button"
                disabled={matches.length === 0}
                onClick={handleReplaceCurrent}
                className="min-h-[40px] px-3 rounded-lg bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-700 text-xs font-medium text-zinc-200 cursor-pointer"
              >
                Replace
              </button>
              <button
                type="button"
                disabled={matches.length === 0}
                onClick={handleReplaceAll}
                className="min-h-[40px] px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-xs font-semibold text-white cursor-pointer"
              >
                All
              </button>
            </div>
          )}
        </div>
      )}

      {/* Expandable Outline Navigator Panel */}
      {outlineOpen && (
        <div className="px-2.5 pb-2.5 pt-1.5 border-t border-zinc-800/70 bg-zinc-900/60 max-h-52 overflow-y-auto space-y-1">
          {outlineSymbols.length === 0 ? (
            <div className="p-2 text-xs font-mono text-zinc-500">
              No components, functions, or sections detected in this file.
            </div>
          ) : (
            outlineSymbols.map((sym, idx) => (
              <button
                key={`${sym.line}-${idx}`}
                type="button"
                onClick={() => {
                  onJumpToLine(sym.line);
                  setOutlineOpen(false);
                }}
                className="w-full min-h-[40px] px-2.5 py-1 rounded-lg bg-zinc-950/80 hover:bg-zinc-800 border border-zinc-800/80 flex items-center justify-between gap-2 text-left cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded shrink-0 ${
                      sym.kind === 'component'
                        ? 'bg-cyan-500/15 text-cyan-300'
                        : sym.kind === 'function'
                        ? 'bg-purple-500/15 text-purple-300'
                        : sym.kind === 'heading'
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    {sym.kind}
                  </span>
                  <span className="text-xs font-mono text-zinc-200 truncate">
                    {sym.label}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-zinc-500 tabular-nums shrink-0">
                  L{sym.line}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
