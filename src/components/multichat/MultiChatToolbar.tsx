import React, { useState } from 'react';
import {
  Trash2,
  Copy,
  Check,
  VolumeX,
  Layers,
  Columns,
  Search,
  BookOpen,
  Sparkles,
  Download,
  X,
  Radio,
} from 'lucide-react';

export type ViewMode = 'unified' | 'tabs' | 'grid';

interface MultiChatToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  docLensEnabled: boolean;
  onToggleDocLens: () => void;
  showQuickPrompts: boolean;
  onToggleQuickPrompts: () => void;
  isPodcastActive: boolean;
  onTogglePodcast: () => void;
  hasMessages: boolean;
  onClearConversation: () => void;
  onCopyAll: () => void;
  onExportMarkdown: () => void;
  isAudioPlaying?: boolean;
  onStopAudio?: () => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
}

export const MultiChatToolbar: React.FC<MultiChatToolbarProps> = ({
  viewMode,
  onViewModeChange,
  docLensEnabled,
  onToggleDocLens,
  showQuickPrompts,
  onToggleQuickPrompts,
  isPodcastActive,
  onTogglePodcast,
  hasMessages,
  onClearConversation,
  onCopyAll,
  onExportMarkdown,
  isAudioPlaying,
  onStopAudio,
  searchQuery,
  onSearchQueryChange,
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const handleCopy = () => {
    onCopyAll();
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div
      id="nexus-multichat-toolbar"
      className="p-2.5 sm:p-3 rounded-xl bg-black/60 backdrop-blur-md border border-cyan-500/20 mb-4 flex items-center justify-between flex-wrap gap-2.5 font-mono text-xs"
    >
      {/* Group 1: Display Mode Selector */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-slate-500 font-bold uppercase mr-0.5 hidden sm:inline">
          VIEW:
        </span>
        <div className="flex items-center p-0.5 rounded-lg bg-white/5 border border-white/10">
          <button
            type="button"
            onClick={() => onViewModeChange('unified')}
            className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
              viewMode === 'unified'
                ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Unified Sequential Dialogue View"
          >
            <Columns size={12} />
            <span>Unified</span>
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange('tabs')}
            className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
              viewMode === 'tabs'
                ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Individual Persona Tabs"
          >
            <Layers size={12} />
            <span>Tabs</span>
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange('grid')}
            className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
              viewMode === 'grid'
                ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Side-by-Side Comparative Grid"
          >
            <Columns size={12} />
            <span>Grid</span>
          </button>
        </div>
      </div>

      {/* Group 2: Intelligence Tools (Doc Lens & Quick Prompts) */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={onToggleDocLens}
          className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            docLensEnabled
              ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
              : 'bg-white/5 text-slate-400 border border-white/10 hover:border-cyan-500/30 hover:text-white'
          }`}
          title="Toggle On-Device Document Lens Context"
        >
          <BookOpen size={12} className={docLensEnabled ? 'text-cyan-400' : 'text-slate-400'} />
          <span>Doc Lens</span>
          <span
            className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
              docLensEnabled ? 'bg-cyan-400 text-black' : 'bg-white/10 text-slate-500'
            }`}
          >
            {docLensEnabled ? 'ON' : 'OFF'}
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleQuickPrompts}
          className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            showQuickPrompts
              ? 'bg-purple-500/20 text-purple-200 border border-purple-400 shadow-[0_0_10px_rgba(192,132,252,0.2)]'
              : 'bg-white/5 text-slate-400 border border-white/10 hover:border-purple-500/30 hover:text-white'
          }`}
          title="Toggle Quick Prompt Library"
        >
          <Sparkles size={12} className={showQuickPrompts ? 'text-purple-300' : 'text-slate-400'} />
          <span className="hidden sm:inline">Prompt Library</span>
        </button>
      </div>

      {/* Group 3: Audio & Podcast Studio */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={onTogglePodcast}
          className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            isPodcastActive
              ? 'bg-amber-500/20 text-amber-200 border border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
              : 'bg-white/5 text-slate-400 border border-white/10 hover:border-amber-500/30 hover:text-white'
          }`}
          title="Toggle Podcast Mode Player"
        >
          <Radio size={12} className={isPodcastActive ? 'text-amber-400 animate-pulse' : 'text-slate-400'} />
          <span>Podcast Studio</span>
        </button>

        {isAudioPlaying && onStopAudio && (
          <button
            type="button"
            onClick={onStopAudio}
            className="px-2 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold transition-all cursor-pointer flex items-center gap-1"
            title="Stop Audio Playback"
          >
            <VolumeX size={12} />
            <span>Stop</span>
          </button>
        )}
      </div>

      {/* Group 4: Search & Actions */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Search input */}
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search turns..."
            className="pl-7 pr-2 py-1 text-xs font-mono bg-black/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/50 w-28 sm:w-36 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchQueryChange('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={11} />
            </button>
          )}
        </div>

        {/* Copy All */}
        {hasMessages && (
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-400/40 text-slate-300 hover:text-white cursor-pointer transition-colors"
            title="Copy Entire Conversation"
          >
            {copiedAll ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          </button>
        )}

        {/* Export Markdown */}
        {hasMessages && (
          <button
            type="button"
            onClick={onExportMarkdown}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-400/40 text-slate-300 hover:text-white cursor-pointer transition-colors"
            title="Export Conversation as Markdown"
          >
            <Download size={13} />
          </button>
        )}

        {/* Clear Conversation */}
        {hasMessages && (
          <div className="relative">
            {showClearConfirm ? (
              <div className="flex items-center gap-1 bg-rose-950/80 border border-rose-500/60 p-1 rounded-lg">
                <span className="text-[10px] text-rose-300 font-bold px-1">Clear all?</span>
                <button
                  type="button"
                  onClick={() => {
                    onClearConversation();
                    setShowClearConfirm(false);
                  }}
                  className="px-1.5 py-0.5 rounded bg-rose-500 text-white font-bold text-[10px] cursor-pointer"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 text-[10px] cursor-pointer"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 cursor-pointer transition-colors"
                title="Clear Conversation History"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
