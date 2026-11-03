import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ChevronDown } from 'lucide-react';
import { storage, MAX_ENABLED_SKILLS } from '@/lib/storage';
import { getActiveSkills, estimateTokens } from '@/lib/skills';
import type { Skill } from '@/types';

interface SkillsQuickPanelProps {
  onNavigateToSettings?: () => void;
}

function formatSkillCharSize(charCount: number): string {
  const safeChars = Math.max(0, Number(charCount) || 0);
  if (safeChars >= 1000) {
    return `${(safeChars / 1000).toFixed(1)}k chars`;
  }
  return `${safeChars} chars`;
}

function formatApproxTokens(approxTokens: number): string {
  if (approxTokens >= 1000) {
    const kVal = approxTokens / 1000;
    const rounded = Math.round(kVal * 10) / 10;
    return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}k`;
  }
  const minK = Math.max(0.1, Math.round((approxTokens / 1000) * 10) / 10);
  return `${minK.toFixed(1)}k`;
}

export const SkillsQuickPanel: React.FC<SkillsQuickPanelProps> = ({
  onNavigateToSettings,
}) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [savedSkills, setSavedSkills] = useState<Skill[]>(() => storage.getSkills());
  const [limitWarning, setLimitWarning] = useState<string | null>(null);

  const refreshSkillsState = useCallback(() => {
    setSavedSkills(storage.getSkills());
  }, []);

  useEffect(() => {
    refreshSkillsState();
    const handleUpdate = () => refreshSkillsState();
    window.addEventListener('nexus-skills-changed', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('nexus-skills-changed', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [refreshSkillsState]);

  const activeSkills = getActiveSkills();
  const activeCount = activeSkills.length;
  const totalActiveChars = activeSkills.reduce(
    (sum, s) => sum + (s.charCount || s.text?.length || 0),
    0,
  );
  const approxTokens = estimateTokens(totalActiveChars);

  const handleToggleSkill = (skill: Skill, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextEnabled = !skill.enabled;
    if (nextEnabled && activeCount >= MAX_ENABLED_SKILLS) {
      setLimitWarning('Max 3 skills can be ON at the same time. Turn one off first.');
      return;
    }
    try {
      const updated = storage.setSkillEnabled(skill.id, nextEnabled);
      setSavedSkills(updated);
      setLimitWarning(null);
    } catch {
      setLimitWarning('Max 3 skills can be ON at the same time. Turn one off first.');
    }
  };

  const subtitleText =
    activeCount > 0
      ? `${activeCount} ON · ~${formatApproxTokens(approxTokens)} tokens`
      : 'Add repo skills in Settings';

  return (
    <div
      className={`rounded-xl transition-colors ${
        activeCount > 0 ? 'bg-[var(--j-accent)]/10' : 'bg-[var(--j-low)]/75'
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
          setLimitWarning(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen((prev) => !prev);
            setLimitWarning(null);
          }
        }}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 hover:bg-[var(--j-low)] transition-colors text-left cursor-pointer rounded-xl"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Sparkles
            size={14}
            className={`shrink-0 ${
              activeCount > 0 ? 'text-[var(--j-accent)]' : 'text-[var(--j-muted)]'
            }`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`text-[12px] font-medium truncate ${
                  activeCount > 0 ? 'text-[var(--j-text)]' : 'text-[var(--j-text)]/90'
                }`}
              >
                Skills
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold shrink-0 border ${
                  activeCount > 0
                    ? 'bg-[var(--j-accent)]/15 text-[var(--j-accent)] border-[var(--j-accent)]/30'
                    : 'bg-[var(--j-lowest)] text-[var(--j-muted)] border-white/[0.08]'
                }`}
              >
                {activeCount} / 3
              </span>
            </div>
            <div className="text-[10px] text-[var(--j-muted)] truncate">{subtitleText}</div>
          </div>
        </div>
        <ChevronDown
          size={14}
          className={`shrink-0 text-[var(--j-muted)] transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[var(--j-accent)]' : ''
          }`}
        />
      </div>

      {isOpen && (
        <div
          className="px-2.5 pb-2.5 pt-1 border-t border-white/[0.06] space-y-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {limitWarning && (
            <div className="px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[10px] text-amber-300 leading-snug">
              {limitWarning}
            </div>
          )}

          {savedSkills.length === 0 ? (
            <div className="py-1.5 text-[11px] text-[var(--j-muted)]">No skills yet.</div>
          ) : (
            <div className="space-y-1">
              {savedSkills.map((skill) => {
                const isSkillOn = Boolean(skill.enabled);
                return (
                  <div
                    key={skill.id}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-[var(--j-lowest)]/80 border border-white/[0.05] min-w-0"
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-[var(--j-text)] truncate">
                        {skill.name}
                      </span>
                      <span className="text-[9.5px] font-mono text-[var(--j-muted)] shrink-0">
                        {formatSkillCharSize(skill.charCount || skill.text?.length || 0)}
                      </span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isSkillOn}
                      onClick={(e) => handleToggleSkill(skill, e)}
                      className={`w-7 h-4 rounded-full relative transition-colors shrink-0 cursor-pointer ${
                        isSkillOn ? 'bg-[var(--j-accent)]' : 'bg-[var(--j-highest)]'
                      }`}
                      title={isSkillOn ? `Turn off ${skill.name}` : `Turn on ${skill.name}`}
                    >
                      <span
                        className={`block w-3 h-3 rounded-full transition-transform ${
                          isSkillOn
                            ? 'translate-x-3.5 bg-[#031425]'
                            : 'translate-x-0.5 bg-[var(--j-muted)]'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigateToSettings?.();
                navigate('/settings?tab=skills');
              }}
              className="text-[10.5px] font-mono text-[var(--j-accent)] hover:underline transition-colors cursor-pointer"
            >
              Manage skills in Settings →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
