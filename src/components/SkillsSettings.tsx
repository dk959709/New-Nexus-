import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  GitBranch,
  ExternalLink,
  Trash2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Check,
  X,
  FileText,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';
import {
  storage,
  MAX_SKILLS,
  MAX_ENABLED_SKILLS,
  MAX_SKILL_CHARS,
} from '@/lib/storage';
import type { Skill } from '@/types';

interface GithubSkillPreview {
  ok: true;
  repo: string;
  branch: string;
  files: Array<{ path: string; chars: number }>;
  suggestedName: string;
  text: string;
  truncated: boolean;
  license: string | null;
  sourceUrl: string;
}

const PREVIEW_COLLAPSED_CHARS = 3000;

function formatCharCount(chars: number): string {
  if (chars >= 1000) {
    return `${(chars / 1000).toFixed(1)}k chars`;
  }
  return `${chars} chars`;
}

export const SkillsSettings: React.FC = () => {
  const [skills, setSkills] = useState<Skill[]>(() => storage.getSkills());
  const [githubUrl, setGithubUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Preview state after fetching from GitHub
  const [preview, setPreview] = useState<GithubSkillPreview | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [showFullPreview, setShowFullPreview] = useState(false);

  // Inline rename state
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');

  // Inline delete confirmation ("Tap again to confirm")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Collapsed help card state
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const syncSkillsFromStorage = useCallback(() => {
    setSkills(storage.getSkills());
  }, []);

  useEffect(() => {
    syncSkillsFromStorage();
    const handleSkillsChanged = () => {
      syncSkillsFromStorage();
    };
    const handleStorageEvent = (e: StorageEvent) => {
      if (!e.key || e.key === 'nexus-skills-v1') {
        syncSkillsFromStorage();
      }
    };

    window.addEventListener('nexus-skills-changed', handleSkillsChanged);
    window.addEventListener('storage', handleStorageEvent);
    return () => {
      window.removeEventListener('nexus-skills-changed', handleSkillsChanged);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [syncSkillsFromStorage]);

  const isMaxSkillsReached = skills.length >= MAX_SKILLS;
  const enabledCount = skills.filter((s) => s.enabled).length;

  const handleFetchPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isMaxSkillsReached || fetching) return;

    const trimmedUrl = githubUrl.trim();
    if (!trimmedUrl) {
      setErrorMsg('Please paste a GitHub link first.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setFetching(true);

    try {
      const response = await fetch('/api/skills/fetch-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      const payload = (await response.json().catch(() => null)) as
        | GithubSkillPreview
        | { error?: string }
        | null;

      if (!response.ok || !payload || !('ok' in payload) || payload.ok !== true) {
        const msg =
          (payload && 'error' in payload && typeof payload.error === 'string' && payload.error) ||
          'Failed to fetch skill from GitHub.';
        setErrorMsg(msg);
        return;
      }

      setPreview(payload);
      setPreviewName((payload.suggestedName || payload.repo || 'Custom Skill').slice(0, 60));
      setShowFullPreview(false);
    } catch {
      setErrorMsg('Network error while contacting the server. Please try again.');
    } finally {
      setFetching(false);
    }
  };

  const handleCancelPreview = () => {
    setPreview(null);
    setPreviewName('');
    setShowFullPreview(false);
  };

  const handleSaveSkill = () => {
    if (!preview) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (skills.length >= MAX_SKILLS) {
      setErrorMsg('Delete one skill to add a new one.');
      return;
    }

    const cleanName = (previewName.trim() || preview.suggestedName || preview.repo).slice(0, 60);
    const cleanText = preview.text.replace(/\0/g, '').slice(0, MAX_SKILL_CHARS);
    const canAutoEnable = enabledCount < MAX_ENABLED_SKILLS;

    const newSkill: Skill = {
      id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: cleanName,
      sourceUrl: preview.sourceUrl,
      repo: preview.repo,
      text: cleanText,
      chars: cleanText.length,
      truncated: Boolean(preview.truncated) || preview.text.length > MAX_SKILL_CHARS,
      license: preview.license || null,
      enabled: canAutoEnable,
      addedAt: Date.now(),
    };

    try {
      const updated = storage.addSkill(newSkill);
      setSkills(updated);
      setPreview(null);
      setPreviewName('');
      setGithubUrl('');
      setShowFullPreview(false);
      setSuccessMsg(
        canAutoEnable
          ? `Saved "${cleanName}" and turned it ON.`
          : `Saved "${cleanName}" (OFF because 3 skills are already ON).`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save skill.';
      setErrorMsg(msg);
    }
  };

  const handleToggleSkill = (skill: Skill) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const nextEnabled = !skill.enabled;

    if (nextEnabled && enabledCount >= MAX_ENABLED_SKILLS) {
      setErrorMsg('Max 3 skills can be ON at the same time. Turn one off first.');
      return;
    }

    try {
      const updated = storage.setSkillEnabled(skill.id, nextEnabled);
      setSkills(updated);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Max 3 skills can be ON at the same time. Turn one off first.';
      setErrorMsg(msg);
    }
  };

  const handleStartRename = (skill: Skill) => {
    setEditingSkillId(skill.id);
    setEditingNameValue(skill.name);
    setConfirmDeleteId(null);
  };

  const handleConfirmRename = (skillId: string) => {
    const trimmed = editingNameValue.trim().slice(0, 60);
    if (trimmed) {
      const updated = storage.renameSkill(skillId, trimmed);
      setSkills(updated);
    }
    setEditingSkillId(null);
    setEditingNameValue('');
  };

  const handleCancelRename = () => {
    setEditingSkillId(null);
    setEditingNameValue('');
  };

  const handleDeleteClick = (skillId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (confirmDeleteId === skillId) {
      const updated = storage.deleteSkill(skillId);
      setSkills(updated);
      setConfirmDeleteId(null);
      if (editingSkillId === skillId) {
        setEditingSkillId(null);
      }
    } else {
      setConfirmDeleteId(skillId);
    }
  };

  const previewTextToShow = preview
    ? showFullPreview || preview.text.length <= PREVIEW_COLLAPSED_CHARS
      ? preview.text
      : `${preview.text.slice(0, PREVIEW_COLLAPSED_CHARS)}...`
    : '';

  return (
    <div className="space-y-6 pb-12 max-w-full overflow-x-hidden">
      {/* 1. Header Card */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-6 backdrop-blur-md shadow-lg shadow-black/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-56 h-56 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="p-2.5 sm:p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex-shrink-0">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-semibold text-white tracking-wide">
                  Skills
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                  {skills.length} / {MAX_SKILLS} skills
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800/90 text-slate-300 border border-white/10 font-mono">
                  {enabledCount} / {MAX_ENABLED_SKILLS} ON
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
                Add instructions from a GitHub repo to give your AI a new skill.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3.5 sm:p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs sm:text-sm flex items-start gap-3">
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-rose-400 mt-0.5" />
          <div className="flex-1 min-w-0 break-words">{errorMsg}</div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-400 hover:text-white flex-shrink-0"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 sm:p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs sm:text-sm flex items-start gap-3">
          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-emerald-400 mt-0.5" />
          <div className="flex-1 min-w-0 break-words">{successMsg}</div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-400 hover:text-white flex-shrink-0"
            aria-label="Dismiss message"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Add Skill Card */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-6 backdrop-blur-md shadow-lg shadow-black/20">
        <label
          htmlFor="github-skill-url-input"
          className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
        >
          Import from GitHub
        </label>
        <form onSubmit={handleFetchPreview} className="flex flex-col sm:flex-row gap-2.5">
          <input
            id="github-skill-url-input"
            type="url"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            disabled={isMaxSkillsReached || fetching}
            placeholder="Paste GitHub link (e.g. https://github.com/owner/repo)"
            maxLength={300}
            className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/60 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={isMaxSkillsReached || fetching || !githubUrl.trim()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {fetching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <GitBranch className="w-4 h-4" />
                Fetch preview
              </>
            )}
          </button>
        </form>

        {isMaxSkillsReached ? (
          <p className="mt-2.5 text-xs text-amber-300 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
            <span>Delete one skill to add a new one.</span>
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-slate-400 leading-relaxed break-words">
            Supports repo root, <code className="text-slate-300">/tree/branch/folder</code>, or{' '}
            <code className="text-slate-300">/blob/branch/SKILL.md</code> links (.md, .mdx, .txt).
          </p>
        )}
      </div>

      {/* 3. Preview Card (shown after fetch) */}
      {preview && (
        <div className="rounded-2xl border border-cyan-500/40 bg-slate-900/80 p-4 sm:p-6 backdrop-blur-md shadow-xl shadow-black/30 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 break-all">
                {preview.repo}
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-white/10">
                branch: {preview.branch}
              </span>
              {preview.license && (
                <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  License: {preview.license}
                </span>
              )}
              {preview.truncated && (
                <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Truncated to 24k chars
                </span>
              )}
            </div>
            <span className="text-xs font-mono text-slate-400">
              {formatCharCount(preview.text.length)}
            </span>
          </div>

          {/* File list with sizes */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-slate-400">Files included:</div>
            <div className="flex flex-wrap gap-2">
              {preview.files.map((file) => (
                <div
                  key={file.path}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/70 border border-white/10 text-xs text-slate-200 max-w-full"
                >
                  <FileText className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                  <span className="truncate font-mono">{file.path}</span>
                  <span className="text-slate-400 font-mono flex-shrink-0">
                    ({formatCharCount(file.chars)})
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Editable Skill Name */}
          <div>
            <label
              htmlFor="skill-preview-name-input"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Skill Name (max 60 chars)
            </label>
            <input
              id="skill-preview-name-input"
              type="text"
              value={previewName}
              maxLength={60}
              onChange={(e) => setPreviewName(e.target.value.slice(0, 60))}
              placeholder="Enter skill name"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-white/15 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Security / Trust Note */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <span>
              Read this text before saving. Only add repos you trust. Skills only add text
              instructions; they cannot run code or see your API keys.
            </span>
          </div>

          {/* Read-only plain-text preview */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>Instruction Text Preview (Plain Text)</span>
              {preview.text.length > PREVIEW_COLLAPSED_CHARS && (
                <button
                  type="button"
                  onClick={() => setShowFullPreview((prev) => !prev)}
                  className="text-cyan-400 hover:text-cyan-300 font-medium inline-flex items-center gap-1"
                >
                  {showFullPreview ? (
                    <>
                      Show less <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      Show more ({formatCharCount(preview.text.length)}){' '}
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>
            <pre className="w-full max-h-72 overflow-y-auto p-3.5 rounded-xl bg-slate-950/90 border border-white/10 text-xs text-slate-200 font-mono whitespace-pre-wrap break-words leading-relaxed">
              {previewTextToShow}
            </pre>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleCancelPreview}
              className="px-4 py-2 rounded-xl border border-white/10 bg-slate-800/80 hover:bg-slate-700/80 text-xs sm:text-sm font-medium text-slate-300 hover:text-white transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveSkill}
              disabled={isMaxSkillsReached}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-cyan-500/40 bg-cyan-500/20 hover:bg-cyan-500/30 text-xs sm:text-sm font-semibold text-cyan-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4" />
              Save skill
            </button>
          </div>
        </div>
      )}

      {/* 4. Saved Skills List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-semibold text-slate-200 tracking-wide">
            Saved Skills ({skills.length} / {MAX_SKILLS})
          </h3>
          <span className="text-xs text-slate-400">
            Max {MAX_ENABLED_SKILLS} ON at once
          </span>
        </div>

        {skills.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-8 text-center">
            <Sparkles className="w-8 h-8 text-slate-500 mx-auto mb-2.5 opacity-70" />
            <p className="text-sm font-medium text-slate-300">No skills saved yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Paste a public GitHub link above to preview and save up to 5 reusable text skills.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {skills.map((skill) => {
              const isEditing = editingSkillId === skill.id;
              const isConfirmingDelete = confirmDeleteId === skill.id;

              return (
                <div
                  key={skill.id}
                  className={`rounded-2xl border p-4 transition-all ${
                    skill.enabled
                      ? 'border-cyan-500/35 bg-slate-900/70 shadow-md shadow-cyan-950/20'
                      : 'border-white/10 bg-slate-900/40 opacity-85'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left: Name + Repo metadata */}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 max-w-md">
                          <input
                            type="text"
                            value={editingNameValue}
                            maxLength={60}
                            autoFocus
                            onChange={(e) => setEditingNameValue(e.target.value.slice(0, 60))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleConfirmRename(skill.id);
                              if (e.key === 'Escape') handleCancelRename();
                            }}
                            className="flex-1 min-w-0 px-2.5 py-1 rounded-lg bg-slate-950 border border-cyan-400/50 text-sm text-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleConfirmRename(skill.id)}
                            className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                            title="Save name"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelRename}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 border border-white/10 hover:text-white"
                            title="Cancel rename"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleStartRename(skill)}
                            className="group inline-flex items-center gap-1.5 text-left font-semibold text-sm sm:text-base text-white hover:text-cyan-300 transition-colors min-w-0"
                            title="Tap to rename skill"
                          >
                            <span className="truncate">{skill.name}</span>
                            <Pencil className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 flex-shrink-0" />
                          </button>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <a
                          href={skill.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 hover:underline font-mono break-all"
                        >
                          <span>{skill.repo}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                        <span>•</span>
                        <span className="font-mono text-slate-300">
                          {formatCharCount(skill.chars)}
                        </span>
                        {skill.truncated && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-mono">
                            Truncated
                          </span>
                        )}
                        {skill.license && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-white/10 text-[11px] font-mono">
                            {skill.license}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: ON/OFF Switch + Delete button */}
                    <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5 flex-shrink-0">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={skill.enabled}
                        onClick={() => handleToggleSkill(skill)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                          skill.enabled
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            : 'bg-slate-800/80 text-slate-400 border-white/10 hover:text-slate-200'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            skill.enabled ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-slate-500'
                          }`}
                        />
                        <span>{skill.enabled ? 'ON' : 'OFF'}</span>
                      </button>

                      {isConfirmingDelete ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(skill.id)}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-500/25 border border-rose-500/50 text-rose-200 hover:bg-rose-500/35 text-xs font-semibold transition-all whitespace-nowrap"
                          >
                            Tap again to confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="p-1.5 rounded-xl bg-slate-800/80 border border-white/10 text-slate-400 hover:text-white"
                            title="Cancel delete"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(skill.id)}
                          className="p-2 rounded-xl border border-white/10 bg-slate-800/60 hover:bg-rose-500/20 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 transition-all"
                          title="Delete skill"
                          aria-label={`Delete ${skill.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Small Collapsed Help Card */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/40 overflow-hidden">
        <button
          type="button"
          onClick={() => setIsHelpOpen((prev) => !prev)}
          className="w-full flex items-center justify-between p-4 text-left text-xs sm:text-sm font-medium text-slate-300 hover:text-white transition-colors"
        >
          <span className="inline-flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span>How skills work</span>
          </span>
          {isHelpOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {isHelpOpen && (
          <div className="px-4 pb-4 pt-1 border-t border-white/5 text-xs text-slate-400 space-y-1.5 leading-relaxed">
            <p>• Text instructions are added to your AI messages.</p>
            <p>• More skills ON = slower responses and more tokens used.</p>
            <p>• Works best with repos that have a SKILL.md or clear instructions.</p>
            <p>• Code-only repos won&apos;t work as skills.</p>
          </div>
        )}
      </div>
    </div>
  );
};
