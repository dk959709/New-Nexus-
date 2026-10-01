import React, { useState } from 'react';
import {
  User,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Play,
  Download,
  Trash2,
  GitBranch,
  CornerDownRight,
  Send,
  Loader2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Radio,
  Sparkles,
  Clock,
} from 'lucide-react';
import { FormattedText } from '@/components/jarvis/FormattedText';
import { getCategoryById } from '@/data/multiChatCategories';
import type {
  MultiChatMessage,
  MultiChatPersonaResponse,
  MultiChatPersonaId,
} from '@/types';
import type { ViewMode } from './MultiChatToolbar';

interface MultiChatMessageCardProps {
  message: MultiChatMessage;
  viewMode: ViewMode;
  selectedTabId?: string;
  onSelectTab: (msgId: string, personaId: string) => void;
  onCopyText: (text: string, id: string) => void;
  copiedId: string | null;
  onPlayVoice: (text: string, personaName: string, audioKey: string) => void;
  playingAudioKey: string | null;
  loadingAudioKey: string | null;
  onDownloadAudio: (text: string, personaName: string, downloadKey: string) => void;
  downloadingAudioId: string | null;
  onDeleteTurn: (msgId: string) => void;
  onListenAllInTurn: (msg: MultiChatMessage) => void;
  onDownloadAllInTurn: (msg: MultiChatMessage) => void;
  onReAskQuery?: (query: string) => void;
  // 1-on-1 Branching props
  activeBranchCardKey: string | null;
  onOpenBranch: (cardKey: string) => void;
  onCloseBranch: () => void;
  onSendBranchQuery: (msgId: string, personaId: MultiChatPersonaId, query: string) => void;
  branchDraftInputs: Record<string, string>;
  onBranchDraftChange: (cardKey: string, val: string) => void;
  branchLoadingKey: string | null;
  onDeleteBranchTurn: (msgId: string, personaId: MultiChatPersonaId, branchTurnId: string) => void;
}

export const MultiChatMessageCard: React.FC<MultiChatMessageCardProps> = ({
  message,
  viewMode,
  selectedTabId,
  onSelectTab,
  onCopyText,
  copiedId,
  onPlayVoice,
  playingAudioKey,
  loadingAudioKey,
  onDownloadAudio,
  downloadingAudioId,
  onDeleteTurn,
  onListenAllInTurn,
  onDownloadAllInTurn,
  onReAskQuery,
  activeBranchCardKey,
  onOpenBranch,
  onCloseBranch,
  onSendBranchQuery,
  branchDraftInputs,
  onBranchDraftChange,
  branchLoadingKey,
  onDeleteBranchTurn,
}) => {
  const [docLensExpanded, setDocLensExpanded] = useState(false);
  const [copiedQuery, setCopiedQuery] = useState(false);

  const categoryConfig = message.category ? getCategoryById(message.category) : null;
  const activeTabPersonaId = selectedTabId || message.responses[0]?.personaId || 'nova';

  const handleCopyUserQuery = () => {
    onCopyText(message.query, `query_${message.id}`);
    setCopiedQuery(true);
    setTimeout(() => setCopiedQuery(false), 2000);
  };

  // Format combined text for copy all
  const formatCombinedTurnText = () => {
    let out = `USER INQUIRY: "${message.query}"\n\n`;
    for (const r of message.responses) {
      out += `=== ${r.name.toUpperCase()} (${r.toneBadge || 'PERSONA'}) ===\n${r.text}\n\n`;
    }
    return out.trim();
  };

  return (
    <div
      id={`multichat-turn-${message.id}`}
      className="nexus-corner-bracket relative rounded-2xl overflow-hidden mb-6 transition-all duration-300 select-text"
      style={{
        background: 'linear-gradient(135deg, rgba(4, 12, 22, 0.96) 0%, rgba(2, 6, 14, 0.99) 100%)',
        border: '1px solid rgba(0, 240, 255, 0.25)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), inset 0 0 24px rgba(0, 240, 255, 0.03)',
      }}
    >
      {/* 1. USER INQUIRY HEADER */}
      <div className="p-4 sm:p-5 bg-black/60 border-b border-cyan-500/15">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {/* User Avatar */}
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5 shadow-sm">
              <User size={15} />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1 font-mono text-[11px]">
                <span className="font-bold text-cyan-400 uppercase tracking-wider">
                  USER INQUIRY
                </span>

                {categoryConfig && (
                  <span className="text-[10px] px-2 py-0.2 rounded font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    {categoryConfig.label.toUpperCase()}
                  </span>
                )}

                <span className="text-slate-500 text-[10px]">
                  {new Date(message.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>

              <h3 className="m-0 text-sm sm:text-base font-bold text-white font-sans leading-relaxed">
                {message.query}
              </h3>
            </div>
          </div>

          {/* User Query Actions */}
          <div className="flex items-center gap-1 font-mono text-xs shrink-0">
            {onReAskQuery && (
              <button
                type="button"
                onClick={() => onReAskQuery(message.query)}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-400/40 text-slate-400 hover:text-white cursor-pointer transition-colors"
                title="Re-ask this query in composer"
              >
                <CornerDownRight size={13} />
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyUserQuery}
              className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-400/40 text-slate-400 hover:text-white cursor-pointer transition-colors"
              title="Copy Query Text"
            >
              {copiedQuery ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
          </div>
        </div>

        {/* Doc Lens Extracted Chunks Dropdown (if present) */}
        {message.docChunks && message.docChunks.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-white/5 font-mono text-xs">
            <button
              type="button"
              onClick={() => setDocLensExpanded(!docLensExpanded)}
              className="w-full flex items-center justify-between p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/25 text-cyan-300 hover:bg-cyan-950/50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <BookOpen size={13} className="text-cyan-400" />
                <span className="font-bold">
                  DOC LENS CONTEXT APPLIED ({message.docChunks.length} EXCERPTS)
                </span>
              </div>
              {docLensExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {docLensExpanded && (
              <div className="mt-2 space-y-2 p-3 rounded-lg bg-black/60 border border-white/10 max-h-48 overflow-y-auto">
                {message.docChunks.map((chunk, idx) => (
                  <div key={idx} className="text-[11px] font-sans text-slate-300 border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                    <div className="font-mono text-[10px] text-cyan-400 font-bold mb-0.5">
                      Excerpt {idx + 1} {chunk.title ? `• ${chunk.title}` : ''}:
                    </div>
                    <p className="m-0 italic">&ldquo;{chunk.snippet || chunk.content}&rdquo;</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. COMBINED INTELLIGENCE STATUS & ACTIONS BANNER */}
      <div className="px-4 py-2.5 sm:px-5 bg-black/40 border-b border-white/5 flex items-center justify-between flex-wrap gap-2.5 font-mono text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black uppercase text-cyan-300 tracking-wider flex items-center gap-1.5">
            <Sparkles size={13} className="text-cyan-400" />
            <span>COMBINED INTELLIGENCE:</span>
          </span>

          {/* Persona Completion Checklist */}
          {message.responses.map((r) => {
            const isCompleted = r.status === 'completed';
            const isRunning = r.status === 'running';

            return (
              <span
                key={r.personaId}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  background: `${r.accentColor}15`,
                  color: r.accentColor,
                  border: `1px solid ${r.accentColor}35`,
                }}
              >
                {isRunning ? (
                  <Radio size={9} className="animate-ping" />
                ) : isCompleted ? (
                  <CheckCircle2 size={10} />
                ) : (
                  <Clock size={9} />
                )}
                <span>{r.name}</span>
                {isCompleted && <span>✓</span>}
              </span>
            );
          })}
        </div>

        {/* Turn Level Actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => onListenAllInTurn(message)}
            className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/25 font-bold cursor-pointer transition-colors flex items-center gap-1 text-[11px]"
            title="Listen to all personas back-to-back"
          >
            <Play size={11} fill="currentColor" />
            <span>Listen All</span>
          </button>

          <button
            type="button"
            onClick={() => onDownloadAllInTurn(message)}
            className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-400/40 text-slate-300 hover:text-white font-bold cursor-pointer transition-colors flex items-center gap-1 text-[11px]"
            title="Download full turn audio as stitched MP3"
          >
            <Download size={11} />
            <span className="hidden sm:inline">MP3</span>
          </button>

          <button
            type="button"
            onClick={() => onCopyText(formatCombinedTurnText(), `all_${message.id}`)}
            className="p-1 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-400/40 text-slate-300 hover:text-white cursor-pointer transition-colors"
            title="Copy all persona responses"
          >
            {copiedId === `all_${message.id}` ? (
              <Check size={12} className="text-emerald-400" />
            ) : (
              <Copy size={12} />
            )}
          </button>

          <button
            type="button"
            onClick={() => onDeleteTurn(message.id)}
            className="p-1 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400 hover:bg-rose-500/20 cursor-pointer transition-colors"
            title="Delete this Q&A turn"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* 3. PERSONA RESPONSES CONTAINER */}
      <div className="p-4 sm:p-5">
        {/* VIEW MODE: TABS */}
        {viewMode === 'tabs' && (
          <div>
            {/* Tabs Selector */}
            <div className="flex items-center gap-1.5 border-b border-white/10 pb-3 mb-4 overflow-x-auto font-mono text-xs">
              {message.responses.map((resp) => {
                const isSelected = activeTabPersonaId === resp.personaId;
                return (
                  <button
                    key={resp.personaId}
                    type="button"
                    onClick={() => onSelectTab(message.id, resp.personaId)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                      isSelected
                        ? 'bg-slate-900 border shadow-md'
                        : 'bg-white/[0.02] text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                    style={{
                      borderColor: isSelected ? resp.accentColor : 'rgba(255, 255, 255, 0.1)',
                      color: isSelected ? '#ffffff' : undefined,
                    }}
                  >
                    <span>{resp.icon || resp.name.slice(0, 2)}</span>
                    <span>{resp.name}</span>
                    {resp.toneBadge && (
                      <span
                        className="text-[9px] px-1 py-0.2 rounded font-bold"
                        style={{
                          background: `${resp.accentColor}25`,
                          color: resp.accentColor,
                        }}
                      >
                        {resp.toneBadge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected Persona Card */}
            {message.responses
              .filter((r) => r.personaId === activeTabPersonaId)
              .map((resp) => renderPersonaCard(resp))}
          </div>
        )}

        {/* VIEW MODE: GRID */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            {message.responses.map((resp) => renderPersonaCard(resp))}
          </div>
        )}

        {/* VIEW MODE: UNIFIED (Default Sequential Stack) */}
        {viewMode === 'unified' && (
          <div className="space-y-4">
            {message.responses.map((resp) => renderPersonaCard(resp))}
          </div>
        )}
      </div>
    </div>
  );

  // Helper renderer for single Persona Card
  function renderPersonaCard(resp: MultiChatPersonaResponse) {
    const cardKey = `${message.id}_${resp.personaId}`;
    const isBranchOpen = activeBranchCardKey === cardKey;
    const isVoicePlaying = playingAudioKey === cardKey;
    const isVoiceLoading = loadingAudioKey === cardKey;
    const isDownloadingAudio = downloadingAudioId === cardKey;
    const branches = resp.branches || [];

    return (
      <div
        key={resp.personaId}
        id={`multichat-card-${cardKey}`}
        className="rounded-xl p-4 sm:p-5 relative transition-all duration-200 font-mono"
        style={{
          background: 'rgba(6, 16, 26, 0.75)',
          border: `1px solid ${resp.accentColor}35`,
          borderLeft: `3.5px solid ${resp.accentColor}`,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Card Header: Avatar + Persona Name + Tone Badge + Status */}
        <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-white/5 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 shadow-sm"
              style={{
                background: `${resp.accentColor}25`,
                border: `1.5px solid ${resp.accentColor}`,
                color: resp.accentColor,
              }}
            >
              <span>{resp.icon || resp.name.slice(0, 2)}</span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black text-white truncate">
                  {resp.name}
                </span>
                {resp.toneBadge && (
                  <span
                    className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase"
                    style={{
                      background: `${resp.accentColor}20`,
                      color: resp.accentColor,
                      border: `1px solid ${resp.accentColor}40`,
                    }}
                  >
                    {resp.toneBadge}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Button Cluster for this Persona */}
          <div className="flex items-center gap-1.5 text-xs font-mono">
            {/* Listen button (Edge TTS) */}
            <button
              type="button"
              disabled={isVoiceLoading || !resp.text}
              onClick={() => onPlayVoice(resp.text, resp.name, cardKey)}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1 ${
                isVoicePlaying
                  ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
              } ${!resp.text ? 'opacity-40 cursor-not-allowed' : ''}`}
              title="Listen to this persona voice"
            >
              {isVoiceLoading ? (
                <Loader2 size={11} className="animate-spin text-cyan-300" />
              ) : isVoicePlaying ? (
                <VolumeX size={11} />
              ) : (
                <Volume2 size={11} />
              )}
              <span>{isVoicePlaying ? 'Stop' : 'Listen'}</span>
            </button>

            {/* Download Individual MP3 */}
            <button
              type="button"
              disabled={isDownloadingAudio || !resp.text}
              onClick={() => onDownloadAudio(resp.text, resp.name, cardKey)}
              className="p-1 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-400/40 text-slate-300 hover:text-white cursor-pointer transition-colors"
              title="Download persona speech as MP3"
            >
              {isDownloadingAudio ? (
                <Loader2 size={11} className="animate-spin text-cyan-300" />
              ) : (
                <Download size={11} />
              )}
            </button>

            {/* Copy Response */}
            <button
              type="button"
              onClick={() => onCopyText(resp.text, cardKey)}
              className="p-1 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-400/40 text-slate-300 hover:text-white cursor-pointer transition-colors"
              title="Copy persona response text"
            >
              {copiedId === cardKey ? (
                <Check size={11} className="text-emerald-400" />
              ) : (
                <Copy size={11} />
              )}
            </button>

            {/* Branch / 1-on-1 Reply Button */}
            <button
              type="button"
              onClick={() => (isBranchOpen ? onCloseBranch() : onOpenBranch(cardKey))}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1 ${
                isBranchOpen
                  ? 'bg-purple-500/30 text-purple-200 border border-purple-400'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
              }`}
              title="Start private 1-on-1 branch thread with this persona"
            >
              <GitBranch size={11} />
              <span>{isBranchOpen ? 'Close 1-on-1' : 'Reply / Branch'}</span>
              {branches.length > 0 && (
                <span className="text-[9px] px-1 rounded-full bg-purple-500/40 text-purple-200">
                  {branches.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Message Content Body */}
        {resp.status === 'running' ? (
          <div className="py-4 flex items-center gap-2.5 text-cyan-300 font-mono text-xs animate-pulse">
            <Loader2 size={14} className="animate-spin" />
            <span>{resp.name} is synthesizing cognitive analysis...</span>
          </div>
        ) : resp.status === 'failed' ? (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-sans">
            {resp.error || 'Inference generation failed.'}
          </div>
        ) : (
          <div className="text-slate-200 font-sans text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap selection:bg-cyan-500/30">
            <FormattedText content={resp.text} />
          </div>
        )}

        {/* Duration / Metadata Footnote */}
        {resp.durationMs !== undefined && (
          <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>Latency: {(resp.durationMs / 1000).toFixed(1)}s</span>
            {resp.model && <span className="truncate max-w-[160px]">Model: {resp.model}</span>}
          </div>
        )}

        {/* 1-ON-1 PERSONA BRANCHING CONTINUATION PANEL */}
        {isBranchOpen && (
          <div
            id={`branch-panel-${cardKey}`}
            className="mt-4 pt-4 border-t border-purple-500/30 space-y-3 font-mono"
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-purple-300 flex items-center gap-1.5">
                <GitBranch size={13} />
                <span>1-ON-1 PRIVATE THREAD WITH {resp.name.toUpperCase()}</span>
              </span>
              <span className="text-[10px] text-slate-500">
                Direct continuation isolated from pipeline
              </span>
            </div>

            {/* Prior Branch Turns History */}
            {branches.length > 0 && (
              <div className="space-y-2.5 pl-2 sm:pl-3 border-l-2 border-purple-500/30 my-2">
                {branches.map((b) => (
                  <div key={b.id} className="p-3 rounded-xl bg-black/60 border border-purple-500/20 text-xs space-y-2">
                    <div className="flex items-center justify-between text-slate-400 text-[10px]">
                      <span className="font-bold text-cyan-300">You asked:</span>
                      <button
                        type="button"
                        onClick={() => onDeleteBranchTurn(message.id, resp.personaId, b.id)}
                        className="text-slate-500 hover:text-rose-400 cursor-pointer"
                        title="Delete branch turn"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                    <p className="m-0 text-white font-sans text-xs">{b.query}</p>

                    <div className="pt-1.5 border-t border-white/5 text-[11px] font-sans text-slate-200">
                      <div className="font-mono text-[10px] font-bold mb-0.5" style={{ color: resp.accentColor }}>
                        {resp.name}:
                      </div>
                      <FormattedText content={b.text || b.response?.text || ''} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Branch Composer Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={branchDraftInputs[cardKey] || ''}
                onChange={(e) => onBranchDraftChange(cardKey, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && (branchDraftInputs[cardKey] || '').trim()) {
                    e.preventDefault();
                    onSendBranchQuery(message.id, resp.personaId, branchDraftInputs[cardKey].trim());
                  }
                }}
                placeholder={`Ask ${resp.name} a private follow-up question...`}
                disabled={branchLoadingKey === cardKey}
                className="flex-1 px-3 py-2 rounded-xl bg-black/70 border border-purple-500/40 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 transition-colors"
              />

              <button
                type="button"
                disabled={!(branchDraftInputs[cardKey] || '').trim() || branchLoadingKey === cardKey}
                onClick={() => onSendBranchQuery(message.id, resp.personaId, (branchDraftInputs[cardKey] || '').trim())}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold text-xs cursor-pointer hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(192,132,252,0.3)]"
              >
                {branchLoadingKey === cardKey ? (
                  <Loader2 size={13} className="animate-spin text-white" />
                ) : (
                  <Send size={13} />
                )}
                <span>Reply</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
};
