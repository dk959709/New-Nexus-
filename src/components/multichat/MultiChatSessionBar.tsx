import React, { useState } from 'react';
import {
  FolderKanban,
  Plus,
  Star,
  Trash2,
  Edit3,
  Check,
  X,
  Wrench,
  Swords,
  Zap,
  Link2,
} from 'lucide-react';
import { storage } from '@/lib/storage';
import type {
  MultiChatSession,
  MultiChatDialogueMode,
  MultiChatTheme,
  Skill,
  MultiChatPersonaConfig,
} from '@/types';

interface MultiChatSessionBarProps {
  sessions: MultiChatSession[];
  activeSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onDeleteSession: (sessionId: string) => void;
  showPinnedOnly: boolean;
  onTogglePinnedOnly: () => void;
  pinnedCount: number;
  dialogueMode: MultiChatDialogueMode;
  onSelectDialogueMode: (mode: MultiChatDialogueMode) => void;
  skillsEnabled: boolean;
  onToggleSkillsEnabled: () => void;
  skills: Skill[];
  onRefreshSkills: () => void;
  personas: Record<string, MultiChatPersonaConfig>;
  theme?: MultiChatTheme;
}

export const MultiChatSessionBar: React.FC<MultiChatSessionBarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onRenameSession,
  onDeleteSession,
  showPinnedOnly,
  onTogglePinnedOnly,
  pinnedCount,
  dialogueMode,
  onSelectDialogueMode,
  skillsEnabled,
  onToggleSkillsEnabled,
  skills,
  onRefreshSkills,
  personas,
  theme = 'classic',
}) => {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [showSkillsMenu, setShowSkillsMenu] = useState(false);
  const [skillError, setSkillError] = useState<string | null>(null);

  const activeSkillsCount = skills.filter((s) => s.enabled).length;
  const pinnedPersonaSkillsCount = Object.values(personas).filter(
    (p) => p.enabled && p.pinnedSkillId && skills.some((s) => s.id === p.pinnedSkillId),
  ).length;

  const handleToggleSingleSkill = (skill: Skill) => {
    setSkillError(null);
    try {
      storage.setSkillEnabled(skill.id, !skill.enabled);
      onRefreshSkills();
    } catch (err) {
      setSkillError(err instanceof Error ? err.message : 'Could not toggle skill');
    }
  };

  const startRename = (session: MultiChatSession) => {
    setEditingSessionId(session.id);
    setEditTitle(session.title);
  };

  const commitRename = (sessionId: string) => {
    if (editTitle.trim()) {
      onRenameSession(sessionId, editTitle.trim());
    }
    setEditingSessionId(null);
  };

  return (
    <div
      className={`flex flex-col gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl border transition-colors ${
        theme === 'classic'
          ? 'bg-slate-950/85 backdrop-blur-xl border-cyan-500/20 shadow-lg'
          : theme === 'fulldark'
          ? 'bg-[#141414] border-[#262626]'
          : 'bg-zinc-900/90 border-zinc-800/90 shadow-sm'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 min-w-0">
        {/* Left: Scrollable Multi-Session Boards Rail */}
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar max-w-full py-0.5 min-w-0">
          <div
            className={`flex items-center gap-1 text-[10px] sm:text-xs font-mono font-semibold pr-0.5 shrink-0 ${
              theme === 'classic'
                ? 'text-slate-400'
                : theme === 'fulldark'
                ? 'text-[#8e8e93]'
                : 'text-zinc-400'
            }`}
          >
            <FolderKanban
              size={12}
              className={theme === 'classic' ? 'text-cyan-400' : 'text-zinc-400'}
            />
            <span className="hidden md:inline">Boards:</span>
          </div>

          {sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const isEditing = editingSessionId === session.id;

            if (isEditing) {
              return (
                <div
                  key={session.id}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border shrink-0 ${
                    theme === 'classic'
                      ? 'bg-slate-900 border-cyan-400/50'
                      : theme === 'fulldark'
                      ? 'bg-[#1f1f1f] border-[#454545]'
                      : 'bg-zinc-800 border-zinc-600'
                  }`}
                >
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(session.id);
                      if (e.key === 'Escape') setEditingSessionId(null);
                    }}
                    className="bg-transparent text-[11px] sm:text-xs text-white focus:outline-none w-24 sm:w-28 font-sans"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => commitRename(session.id)}
                    className="text-emerald-400 hover:text-emerald-300 p-0.5"
                    title="Save name"
                  >
                    <Check size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingSessionId(null)}
                    className="text-zinc-400 hover:text-white p-0.5"
                    title="Cancel"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            }

            return (
              <div
                key={session.id}
                className={`group inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-medium transition-all shrink-0 border ${
                  isActive
                    ? theme === 'classic'
                      ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40 shadow-sm'
                      : theme === 'fulldark'
                      ? 'bg-[#262626] text-white border-[#404040]'
                      : 'bg-zinc-800 text-zinc-100 border-zinc-600/80'
                    : theme === 'classic'
                    ? 'bg-white/[0.03] hover:bg-white/[0.08] text-slate-400 hover:text-slate-200 border-white/10'
                    : theme === 'fulldark'
                    ? 'bg-[#1a1a1a] hover:bg-[#222] text-[#a1a1aa] hover:text-white border-[#2a2a2a]'
                    : 'bg-zinc-900/60 hover:bg-zinc-800/70 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectSession(session.id)}
                  className="flex items-center gap-1 text-left truncate max-w-[105px] sm:max-w-[155px]"
                  title={`${session.title} (${session.messages?.length || 0} turns)`}
                >
                  <span className="truncate">{session.title}</span>
                  <span className="text-[9.5px] font-mono opacity-65">
                    ({session.messages?.length || 0})
                  </span>
                </button>

                {isActive && (
                  <div className="flex items-center gap-0.5 ml-0.5">
                    <button
                      type="button"
                      onClick={() => startRename(session)}
                      className="p-0.5 text-zinc-400 hover:text-cyan-300 transition-colors"
                      title="Rename board"
                    >
                      <Edit3 size={10} />
                    </button>
                    {sessions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteSession(session.id)}
                        className="p-0.5 text-zinc-400 hover:text-rose-400 transition-colors"
                        title="Delete board"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={onCreateSession}
            className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold border transition-all shrink-0 ${
              theme === 'classic'
                ? 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                : theme === 'fulldark'
                ? 'bg-[#1f1f1f] hover:bg-[#2a2a2a] text-[#e4e4e7] border-[#333]'
                : 'bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 border-zinc-700'
            }`}
            title="Create a new Multi Chat board"
          >
            <Plus size={11} />
            <span>New</span>
          </button>
        </div>

        {/* Right: Pinned Filter + Skills Popover + Dialogue Mode Switcher */}
        <div className="flex items-center justify-between sm:justify-end gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar sm:overflow-visible min-w-0">
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Pinned Filter Button */}
            <button
              type="button"
              onClick={onTogglePinnedOnly}
              className={`px-2 py-1 rounded-lg sm:rounded-xl border text-[11px] sm:text-xs font-medium flex items-center gap-1 transition-all shrink-0 ${
                showPinnedOnly
                  ? 'bg-amber-500/20 text-amber-200 border-amber-400/50 shadow-sm'
                  : theme === 'classic'
                  ? 'bg-white/5 border-white/10 hover:bg-amber-500/10 text-slate-300 hover:text-amber-300'
                  : theme === 'fulldark'
                  ? 'bg-[#1c1c1e] border-[#2c2c2e] text-[#a1a1aa] hover:text-amber-300'
                  : 'bg-zinc-800/70 border-zinc-700/70 text-zinc-300 hover:text-amber-300'
              }`}
              title="Filter conversation to show only starred/pinned turns"
            >
              <Star
                size={11}
                className={showPinnedOnly ? 'text-amber-400 fill-amber-400' : 'text-zinc-400'}
              />
              <span>Pinned</span>
              {pinnedCount > 0 && (
                <span className="text-[9.5px] font-mono opacity-80">({pinnedCount})</span>
              )}
            </button>

            {/* Skills Integration Popover Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSkillsMenu((prev) => !prev)}
                className={`px-2 py-1 rounded-lg sm:rounded-xl border text-[11px] sm:text-xs font-medium flex items-center gap-1 transition-all shrink-0 ${
                  skillsEnabled && (activeSkillsCount > 0 || pinnedPersonaSkillsCount > 0)
                    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/45 shadow-sm'
                    : theme === 'classic'
                    ? 'bg-white/5 border-white/10 hover:bg-emerald-500/10 text-slate-300 hover:text-emerald-300'
                    : theme === 'fulldark'
                    ? 'bg-[#1c1c1e] border-[#2c2c2e] text-[#a1a1aa] hover:text-emerald-300'
                    : 'bg-zinc-800/70 border-zinc-700/70 text-zinc-300 hover:text-emerald-300'
                }`}
                title="Manage active Skills injected into NOVA, ORBIT & COSMOS"
              >
                <Wrench
                  size={11}
                  className={
                    skillsEnabled && (activeSkillsCount > 0 || pinnedPersonaSkillsCount > 0)
                      ? 'text-emerald-400'
                      : 'text-zinc-400'
                  }
                />
                <span>Skills</span>
                <span className="text-[9.5px] font-mono opacity-80">
                  {skillsEnabled ? `${activeSkillsCount}` : 'OFF'}
                </span>
              </button>

              {showSkillsMenu && (
                <div
                  className={`fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 mt-2 sm:w-80 rounded-2xl border shadow-2xl p-3.5 z-50 space-y-2.5 ${
                    theme === 'classic'
                      ? 'bg-slate-950 border-cyan-500/30'
                      : theme === 'fulldark'
                      ? 'bg-[#18181b] border-[#2e2e2e]'
                      : 'bg-zinc-900 border-zinc-700/80'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Wrench size={13} className="text-emerald-400" />
                        <span>Multi Chat Skills</span>
                      </div>
                      <p className="text-[10px] text-zinc-400">
                        Injects enabled skills into NOVA, ORBIT &amp; COSMOS
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={onToggleSkillsEnabled}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border transition-colors ${
                          skillsEnabled
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-white/5 text-zinc-400 border-white/10'
                        }`}
                      >
                        {skillsEnabled ? 'ENABLED' : 'MUTED'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSkillsMenu(false)}
                        className="p-1 rounded-md text-zinc-400 hover:text-white"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>

                  {skillError && (
                    <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-[11px] text-rose-300">
                      {skillError}
                    </div>
                  )}

                  {skills.length === 0 ? (
                    <p className="text-xs text-zinc-400 py-2">
                      No skills installed yet. Add skills in Settings → Skills.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {skills.map((sk) => (
                        <div
                          key={sk.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/10"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-zinc-200 truncate">
                              {sk.name}
                            </div>
                            <div className="text-[10px] font-mono text-zinc-500">
                              {sk.chars.toLocaleString()} chars · {sk.kind === 'pasted' ? 'Pasted' : 'GitHub'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleSingleSkill(sk)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition-colors ${
                              sk.enabled
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-white/5 text-zinc-400 border-white/10 hover:text-white'
                            }`}
                          >
                            {sk.enabled ? 'ON' : 'OFF'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {pinnedPersonaSkillsCount > 0 && (
                    <div className="pt-1 border-t border-white/10 text-[10px] font-mono text-cyan-300">
                      📌 {pinnedPersonaSkillsCount} persona-pinned skill(s) configured in Settings
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Dialogue Mode Segmented Switcher: Harmony / Debate / Parallel */}
          <div
            className={`flex items-center p-0.5 rounded-lg sm:rounded-xl border text-[11px] sm:text-xs shrink-0 ${
              theme === 'classic'
                ? 'bg-black/50 border-white/10'
                : theme === 'fulldark'
                ? 'bg-[#0d0d0d] border-[#262626]'
                : 'bg-zinc-950/80 border-zinc-800'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectDialogueMode('harmony')}
              className={`flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg font-medium transition-all ${
                dialogueMode === 'harmony'
                  ? theme === 'classic'
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35'
                    : theme === 'fulldark'
                    ? 'bg-[#262626] text-white border border-[#3f3f46]'
                    : 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Harmony Chain: NOVA → ORBIT → COSMOS build cooperatively on each other"
            >
              <Link2 size={11} />
              <span>Harmony</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectDialogueMode('debate')}
              className={`flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg font-medium transition-all ${
                dialogueMode === 'debate'
                  ? 'bg-amber-500/25 text-amber-200 border border-amber-500/40'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Debate / Red-Team: ORBIT challenges NOVA's assumptions, COSMOS acts as final Judge"
            >
              <Swords size={11} />
              <span>Debate</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectDialogueMode('parallel')}
              className={`flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg font-medium transition-all ${
                dialogueMode === 'parallel'
                  ? 'bg-indigo-500/25 text-indigo-200 border border-indigo-500/40'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Blind Parallel: All 3 personas run simultaneously with independent, unbiased views"
            >
              <Zap size={11} />
              <span>Parallel</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectDialogueMode('relay')}
              className={`flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg font-medium transition-all ${
                dialogueMode === 'relay'
                  ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-500/40'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Relay Pipeline (Chain-of-Custody): NOVA drafts blueprint → ORBIT expands with examples → COSMOS audits & polishes"
            >
              <span>🔗</span>
              <span>Relay</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

