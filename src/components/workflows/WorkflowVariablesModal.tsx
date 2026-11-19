import React, { useState } from 'react';
import { Sliders, Plus, Trash2, X, Copy, Check, Play } from 'lucide-react';
import type { WorkflowVariable } from '@/types';

interface WorkflowVariablesModalProps {
  isOpen: boolean;
  onClose: () => void;
  variables: WorkflowVariable[];
  onSaveVariables: (next: WorkflowVariable[]) => void;
  onRunWithVariables?: (values: Record<string, string>) => void;
  isRunning?: boolean;
}

export const WorkflowVariablesModal: React.FC<WorkflowVariablesModalProps> = ({
  isOpen,
  onClose,
  variables,
  onSaveVariables,
  onRunWithVariables,
  isRunning = false,
}) => {
  const [draft, setDraft] = useState<WorkflowVariable[]>(() =>
    variables.map((v) => ({ ...v })),
  );
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setDraft(variables.map((v) => ({ ...v })));
    }
  }, [isOpen, variables]);

  if (!isOpen) return null;

  const sanitizeKey = (raw: string) =>
    raw
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '');

  const handleAdd = () => {
    const cleanKey = sanitizeKey(newKey || newLabel);
    if (!cleanKey) return;
    if (draft.some((v) => v.key.toLowerCase() === cleanKey.toLowerCase())) return;
    setDraft((prev) => [
      ...prev,
      {
        key: cleanKey,
        label: newLabel.trim() || cleanKey,
        defaultValue: newValue,
      },
    ]);
    setNewKey('');
    setNewLabel('');
    setNewValue('');
  };

  const handleUpdate = (idx: number, field: keyof WorkflowVariable, val: string) => {
    setDraft((prev) =>
      prev.map((item, i) =>
        i === idx
          ? {
              ...item,
              [field]: field === 'key' ? sanitizeKey(val) : val,
            }
          : item,
      ),
    );
  };

  const handleDelete = (idx: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCopyTag = (key: string) => {
    navigator.clipboard.writeText(`{{vars.${key}}}`);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 1800);
  };

  const handleSave = () => {
    const cleaned = draft.filter((v) => v.key.trim().length > 0);
    onSaveVariables(cleaned);
    onClose();
  };

  const handleSaveAndRun = () => {
    const cleaned = draft.filter((v) => v.key.trim().length > 0);
    onSaveVariables(cleaned);
    const map: Record<string, string> = {};
    for (const v of cleaned) {
      map[v.key] = v.defaultValue ?? '';
    }
    onClose();
    onRunWithVariables?.(map);
  };

  return (
    <div className="wf-modal-backdrop fixed inset-0 z-[1300] bg-[#080b12]/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="wf-cyber-card wf-modal-panel rounded-t-3xl sm:rounded-2xl max-w-2xl w-full max-h-[92dvh] flex flex-col overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.85)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
              <Sliders size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-extrabold text-white truncate">
                Workflow Variables
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 truncate">
                Use <code className="text-cyan-300">{'{{vars.key}}'}</code> inside any step prompt or query
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300"
            aria-label="Close Variables"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Existing Variables List */}
          {draft.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#0a0f18] border border-dashed border-white/15 text-center space-y-1.5">
              <p className="text-sm font-semibold text-zinc-200">No global variables yet</p>
              <p className="text-xs sm:text-sm text-zinc-400">
                Define reusable values like <code className="text-cyan-300">audience</code>,{' '}
                <code className="text-cyan-300">language</code>, or{' '}
                <code className="text-cyan-300">brand_voice</code> below.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {draft.map((item, idx) => (
                <div
                  key={`${item.key}-${idx}`}
                  className="p-4 rounded-2xl bg-[#0c111c] border border-white/10 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <code className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/35 text-cyan-200 text-xs sm:text-sm font-mono font-bold">
                        {`{{vars.${item.key || 'key'}}}`}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopyTag(item.key)}
                        className="min-h-[36px] px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs text-zinc-300 flex items-center gap-1"
                      >
                        {copiedKey === item.key ? (
                          <>
                            <Check size={13} className="text-emerald-400" />
                            <span className="text-emerald-300">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span>Copy Tag</span>
                          </>
                        )}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(idx)}
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300"
                      aria-label={`Remove ${item.key}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-mono uppercase text-zinc-400 block mb-1">
                        Key
                      </label>
                      <input
                        type="text"
                        value={item.key}
                        onChange={(e) => handleUpdate(idx, 'key', e.target.value)}
                        className="wf-field-box w-full rounded-xl px-3 py-2.5 text-base sm:text-sm text-cyan-200 font-mono focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-mono uppercase text-zinc-400 block mb-1">
                        Display Label
                      </label>
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) => handleUpdate(idx, 'label', e.target.value)}
                        className="wf-field-box w-full rounded-xl px-3 py-2.5 text-base sm:text-sm text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-mono uppercase text-zinc-400 block mb-1">
                      Value
                    </label>
                    <input
                      type="text"
                      value={item.defaultValue ?? ''}
                      onChange={(e) => handleUpdate(idx, 'defaultValue', e.target.value)}
                      placeholder="Enter runtime value..."
                      className="wf-field-box w-full rounded-xl px-3 py-2.5 text-base sm:text-sm text-emerald-200 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add New Variable Form */}
          <div className="p-4 rounded-2xl bg-[#0a0f18] border border-cyan-500/30 space-y-3">
            <h4 className="text-sm font-bold text-cyan-200">Add New Variable</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="Key (e.g. tone)"
                className="wf-field-box rounded-xl px-3 py-2.5 text-base sm:text-sm text-cyan-200 font-mono focus:outline-none"
              />
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Label (e.g. Writing Tone)"
                className="wf-field-box rounded-xl px-3 py-2.5 text-base sm:text-sm text-white focus:outline-none"
              />
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd();
                }}
                placeholder="Default value..."
                className="wf-field-box rounded-xl px-3 py-2.5 text-base sm:text-sm text-emerald-200 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!sanitizeKey(newKey || newLabel)}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 font-bold text-sm flex items-center gap-2 disabled:opacity-40 transition-colors"
            >
              <Plus size={16} />
              <span>Add Variable</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 bg-[#090d16] flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleSave}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-white font-bold text-sm transition-colors"
          >
            Save Variables
          </button>
          {onRunWithVariables && (
            <button
              type="button"
              disabled={isRunning}
              onClick={handleSaveAndRun}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-400 hover:brightness-110 disabled:opacity-40 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 transition-all"
            >
              <Play size={15} className="fill-slate-950" />
              <span>Save & Run Pipeline</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
