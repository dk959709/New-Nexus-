import React, { useMemo, useState } from 'react';
import {
  Search,
  Star,
  Tag,
  X,
  Plus,
  Copy,
  Trash2,
  Layers,
  StickyNote,
} from 'lucide-react';
import type { Workflow } from '@/types';

interface WorkflowLibraryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  workflows: Workflow[];
  activeWorkflowId: string;
  onSelectWorkflow: (id: string) => void;
  onCreateNew: () => void;
  onTogglePin: (id: string) => void;
  onDuplicateWorkflow: (id: string) => void;
  onDeleteWorkflow: (id: string) => void;
  onUpdateMeta: (id: string, patch: { description?: string; tags?: string[] }) => void;
}

export const WorkflowLibraryDrawer: React.FC<WorkflowLibraryDrawerProps> = ({
  isOpen,
  onClose,
  workflows,
  activeWorkflowId,
  onSelectWorkflow,
  onCreateNew,
  onTogglePin,
  onDuplicateWorkflow,
  onDeleteWorkflow,
  onUpdateMeta,
}) => {
  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');
  const [editingMetaId, setEditingMetaId] = useState<string | null>(null);
  const [descDraft, setDescDraft] = useState('');
  const [tagsDraft, setTagsDraft] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const wf of workflows) {
      for (const t of wf.tags || []) {
        if (t.trim()) set.add(t.trim());
      }
    }
    return Array.from(set).sort();
  }, [workflows]);

  const filteredWorkflows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...workflows]
      .filter((wf) => {
        if (selectedTag === 'PINNED' && !wf.pinned) return false;
        if (selectedTag !== 'ALL' && selectedTag !== 'PINNED') {
          if (!(wf.tags || []).some((t) => t.toLowerCase() === selectedTag.toLowerCase())) {
            return false;
          }
        }
        if (!q) return true;
        const inName = wf.name.toLowerCase().includes(q);
        const inDesc = (wf.description || '').toLowerCase().includes(q);
        const inTags = (wf.tags || []).some((t) => t.toLowerCase().includes(q));
        const inNodes = wf.nodes.some(
          (n) => n.label.toLowerCase().includes(q) || n.type.toLowerCase().includes(q),
        );
        return inName || inDesc || inTags || inNodes;
      })
      .sort((a, b) => {
        if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
  }, [workflows, query, selectedTag]);

  if (!isOpen) return null;

  const startEditMeta = (wf: Workflow) => {
    setEditingMetaId(wf.id);
    setDescDraft(wf.description || '');
    setTagsDraft((wf.tags || []).join(', '));
  };

  const saveEditMeta = (id: string) => {
    const tags = tagsDraft
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 6);
    onUpdateMeta(id, { description: descDraft.trim(), tags });
    setEditingMetaId(null);
  };

  return (
    <div className="wf-modal-backdrop fixed inset-0 z-[1300] bg-[#080b12]/80 backdrop-blur-md flex justify-end">
      <div className="wf-drawer-enter w-full max-w-lg h-full bg-[#0b0f18] border-l border-cyan-500/30 shadow-[0_0_60px_rgba(0,0,0,0.85)] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
              <Layers size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-extrabold text-white truncate">
                Workflow Library
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400">
                {workflows.length} saved {workflows.length === 1 ? 'pipeline' : 'pipelines'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300"
            aria-label="Close Library"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Filter */}
        <div className="px-5 py-3.5 border-b border-white/10 space-y-3 shrink-0">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pipelines, tags, or step types..."
              className="wf-field-box w-full rounded-xl pl-10 pr-3.5 py-2.5 text-base sm:text-sm text-white placeholder-zinc-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            <button
              type="button"
              onClick={() => setSelectedTag('ALL')}
              className={`min-h-[36px] px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap border transition-colors ${
                selectedTag === 'ALL'
                  ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                  : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All ({workflows.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedTag('PINNED')}
              className={`min-h-[36px] px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap border flex items-center gap-1 transition-colors ${
                selectedTag === 'PINNED'
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                  : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Star size={13} className="fill-amber-400 text-amber-400" />
              <span>Pinned</span>
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(tag)}
                className={`min-h-[36px] px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap border transition-colors ${
                  selectedTag === tag
                    ? 'bg-violet-500/20 border-violet-400/50 text-violet-200'
                    : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>

        {/* Workflow Cards */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredWorkflows.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-400">
              No workflows match your filter.
            </div>
          ) : (
            filteredWorkflows.map((wf) => {
              const isActive = wf.id === activeWorkflowId;
              const isEditing = editingMetaId === wf.id;

              return (
                <div
                  key={wf.id}
                  className={`p-4 rounded-2xl border transition-all space-y-2.5 ${
                    isActive
                      ? 'bg-cyan-500/10 border-cyan-400/55 shadow-[0_0_24px_rgba(73,239,253,0.12)]'
                      : 'bg-[#101625] border-white/10 hover:border-cyan-400/35'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectWorkflow(wf.id);
                        onClose();
                      }}
                      className="text-left min-w-0 flex-1"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-bold text-white truncate">{wf.name}</h4>
                        {isActive && (
                          <span className="text-xs font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-200 border border-cyan-400/40">
                            Active
                          </span>
                        )}
                      </div>
                      {wf.description && (
                        <p className="text-sm text-zinc-300 mt-1 line-clamp-2 leading-relaxed">
                          {wf.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2.5 mt-2 text-xs font-mono text-zinc-400 flex-wrap">
                        <span>{wf.nodes.length} steps</span>
                        <span>·</span>
                        <span>{wf.edges.length} links</span>
                        {wf.variables && wf.variables.length > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-cyan-300">{wf.variables.length} vars</span>
                          </>
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onTogglePin(wf.id)}
                      className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border transition-colors shrink-0 ${
                        wf.pinned
                          ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                          : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-amber-300'
                      }`}
                      title={wf.pinned ? 'Unpin workflow' : 'Pin to top'}
                    >
                      <Star size={16} className={wf.pinned ? 'fill-amber-300' : ''} />
                    </button>
                  </div>

                  {/* Tags */}
                  {wf.tags && wf.tags.length > 0 && !isEditing && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {wf.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/15 border border-violet-400/30 text-violet-200 text-xs font-mono"
                        >
                          <Tag size={11} />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Inline Notes & Tags Editor */}
                  {isEditing ? (
                    <div className="pt-2 border-t border-white/10 space-y-2.5">
                      <textarea
                        rows={2}
                        value={descDraft}
                        onChange={(e) => setDescDraft(e.target.value)}
                        placeholder="Add workflow notes or description..."
                        className="wf-field-box w-full rounded-xl p-2.5 text-base sm:text-sm text-white focus:outline-none"
                      />
                      <input
                        type="text"
                        value={tagsDraft}
                        onChange={(e) => setTagsDraft(e.target.value)}
                        placeholder="Tags separated by commas (e.g. research, daily, marketing)"
                        className="wf-field-box w-full rounded-xl px-3 py-2 text-base sm:text-sm text-violet-200 font-mono focus:outline-none"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingMetaId(null)}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-300 text-xs sm:text-sm font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEditMeta(wf.id)}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-cyan-400 text-slate-950 text-xs sm:text-sm font-bold"
                        >
                          Save Notes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => startEditMeta(wf)}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs sm:text-sm text-zinc-200 flex items-center gap-1.5"
                      >
                        <StickyNote size={14} className="text-cyan-400" />
                        <span>Notes & Tags</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onDuplicateWorkflow(wf.id)}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs sm:text-sm text-emerald-300 flex items-center gap-1"
                        >
                          <Copy size={14} />
                          <span>Clone</span>
                        </button>

                        {confirmDeleteId === wf.id ? (
                          <div className="flex items-center gap-1 bg-rose-500/15 border border-rose-400/40 rounded-lg px-2 py-1">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteWorkflow(wf.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2 py-1 rounded bg-rose-400 text-slate-950 text-xs font-bold"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="p-1 text-zinc-300"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          workflows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(wf.id)}
                              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-zinc-900 hover:bg-rose-950/60 border border-white/10 text-zinc-400 hover:text-rose-300"
                              title="Delete workflow"
                            >
                              <Trash2 size={15} />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-[#080c15] shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => {
              onCreateNew();
              onClose();
            }}
            className="w-full min-h-[46px] rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-400 hover:brightness-110 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 transition-all"
          >
            <Plus size={18} />
            <span>Create New Blank Workflow</span>
          </button>
        </div>
      </div>
    </div>
  );
};
