import React, { useState } from 'react';
import {
  Sparkles,
  CheckSquare,
  Square,
  Bookmark,
  Check,
  FileDown,
  Loader2,
  ChevronDown,
  ChevronUp,
  Scale,
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { getPersonaCleanText } from '@/services/multiChatOrchestrator';
import type { MultiChatMessage, MultiChatConsensusData, MultiChatTheme } from '@/types';

interface MultiChatConsensusCardProps {
  message: MultiChatMessage;
  isGeneratingConsensus: boolean;
  onGenerateConsensus: (msg: MultiChatMessage) => void;
  onToggleChecklistItem: (msgId: string, itemId: string) => void;
  theme?: MultiChatTheme;
}

export const MultiChatConsensusCard: React.FC<MultiChatConsensusCardProps> = ({
  message,
  isGeneratingConsensus,
  onGenerateConsensus,
  onToggleChecklistItem,
  theme = 'classic',
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [savedToVault, setSavedToVault] = useState(() =>
    storage.isSaved(`multichat_${message.id}`),
  );

  const completedResponses = message.responses.filter(
    (r) => r.status === 'completed' && getPersonaCleanText(r).trim().length > 0,
  );

  if (completedResponses.length === 0) {
    return null;
  }

  const consensus: MultiChatConsensusData | undefined = message.consensus;

  const buildMarkdownReport = (): string => {
    const lines: string[] = [
      `# Multi Chat Report: ${message.query}`,
      `Date: ${new Date(message.timestamp).toLocaleString()}`,
      `Mode: ${(message.dialogueMode || 'harmony').toUpperCase()}`,
      '',
    ];

    for (const r of completedResponses) {
      lines.push(`## ${r.icon} ${r.name} (${r.toneBadge || 'Persona'})`);
      lines.push(getPersonaCleanText(r));
      lines.push('');
    }

    if (consensus) {
      lines.push('## ⚖️ Executive Consensus & Verdict');
      lines.push(consensus.verdict);
      lines.push('');
      if (consensus.agreements.length > 0) {
        lines.push('### Key Points of Agreement');
        consensus.agreements.forEach((a) => lines.push(`- ${a}`));
        lines.push('');
      }
      if (consensus.actionChecklist.length > 0) {
        lines.push('### Action Checklist');
        consensus.actionChecklist.forEach((item) =>
          lines.push(`- [${item.done ? 'x' : ' '}] ${item.text}`),
        );
        lines.push('');
      }
    }

    return lines.join('\n');
  };

  const handleSaveToSavedPage = () => {
    const itemId = `multichat_${message.id}`;
    const reportContent = buildMarkdownReport();
    storage.saveItem({
      id: itemId,
      type: 'jarvis',
      title: message.query.slice(0, 90),
      query: message.query,
      subtitle:
        consensus?.verdict ||
        completedResponses
          .map((r) => `${r.name}: ${getPersonaCleanText(r).slice(0, 70)}...`)
          .join(' | '),
      content: reportContent,
      sources: (message.webSources || []).map((ws) => ({
        title: ws.title,
        url: ws.url,
        domain: ws.domain,
      })),
      savedAt: new Date().toLocaleDateString(),
    });
    setSavedToVault(true);
  };

  const handleDownloadMarkdown = () => {
    const md = buildMarkdownReport();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = message.query
      .slice(0, 28)
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .toLowerCase();
    a.href = url;
    a.download = `nexus_multichat_${slug || 'report'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  return (
    <div
      className={`px-3 sm:px-5 py-2.5 sm:py-3 border-t flex flex-col gap-2.5 transition-colors ${
        theme === 'classic'
          ? 'bg-slate-950/90 border-white/10'
          : theme === 'fulldark'
          ? 'bg-[#121212] border-[#262626]'
          : 'bg-zinc-900/90 border-zinc-800'
      }`}
    >
      {/* Top Action Row */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {!consensus ? (
            <button
              type="button"
              onClick={() => onGenerateConsensus(message)}
              disabled={isGeneratingConsensus}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                theme === 'classic'
                  ? 'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 border-cyan-500/35'
                  : theme === 'fulldark'
                  ? 'bg-[#212121] hover:bg-[#2a2a2a] text-[#ececec] border-[#383838]'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700'
              }`}
              title="Synthesize a unified verdict, key agreements, and action checklist from all personas"
            >
              {isGeneratingConsensus ? (
                <>
                  <Loader2 size={12} className="animate-spin text-cyan-400" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Scale size={12} className="text-cyan-400" />
                  <span>Synthesize Consensus</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-cyan-300 hover:text-cyan-200"
            >
              <Sparkles size={12} className="text-cyan-400" />
              <span>EXECUTIVE CONSENSUS &amp; CHECKLIST</span>
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>

        {/* Save to SavedPage & Download .MD Buttons */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={handleSaveToSavedPage}
            className={`px-2 sm:px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1 border transition-all ${
              savedToVault
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : theme === 'classic'
                ? 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10'
                : theme === 'fulldark'
                ? 'bg-[#1c1c1e] hover:bg-[#262629] text-[#d4d4d8] border-[#2e2e32]'
                : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border-zinc-700/70'
            }`}
            title="Save this Multi Chat breakdown to your Saved page"
          >
            {savedToVault ? (
              <>
                <Check size={11} className="text-emerald-400" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Bookmark size={11} />
                <span>Save</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadMarkdown}
            className={`px-2 sm:px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1 border transition-all ${
              theme === 'classic'
                ? 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10'
                : theme === 'fulldark'
                ? 'bg-[#1c1c1e] hover:bg-[#262629] text-[#d4d4d8] border-[#2e2e32]'
                : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border-zinc-700/70'
            }`}
            title="Download full turn + consensus as a Markdown (.md) report"
          >
            <FileDown size={11} />
            <span>.MD</span>
          </button>
        </div>
      </div>

      {/* Expanded Consensus Content */}
      {consensus && isExpanded && (
        <div
          className={`p-3 sm:p-3.5 rounded-2xl border space-y-3 text-xs ${
            theme === 'classic'
              ? 'bg-slate-900/75 border-cyan-500/25'
              : theme === 'fulldark'
              ? 'bg-[#1a1a1a] border-[#2e2e2e]'
              : 'bg-zinc-950/80 border-zinc-800'
          }`}
        >
          {/* Executive Verdict */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold mb-1">
              Panel Verdict
            </div>
            <p className="text-zinc-100 leading-relaxed text-xs sm:text-[13px] m-0">
              {consensus.verdict}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-white/10">
            {/* Key Agreements */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold mb-1.5">
                Key Agreements
              </div>
              <ul className="space-y-1.5 m-0 pl-0 list-none">
                {consensus.agreements.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-zinc-300 leading-snug">
                    <span className="text-emerald-400 font-bold mt-0.5">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Interactive Action Checklist */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold mb-1.5">
                Next Steps Checklist
              </div>
              <div className="space-y-1">
                {consensus.actionChecklist.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onToggleChecklistItem(message.id, item.id)}
                    className="w-full flex items-start gap-2 text-left p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    {item.done ? (
                      <CheckSquare size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <Square size={14} className="text-zinc-400 shrink-0 mt-0.5" />
                    )}
                    <span
                      className={`leading-snug ${
                        item.done ? 'line-through text-zinc-500' : 'text-zinc-200'
                      }`}
                    >
                      {item.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

