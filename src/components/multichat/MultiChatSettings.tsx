import { useState, useEffect } from 'react';
import {
  Sliders,
  RotateCcw,
  Save,
  Check,
  ChevronDown,
  ChevronUp,
  FileCode2,
  AlertCircle,
  Bookmark,
  Languages,
  Plus,
  Trash2,
  Brain,
  Smile,
  Compass,
  CheckCircle2,
} from 'lucide-react';
import { storage, DEFAULT_MULTICHAT_CONFIG } from '@/lib/storage';
import type { MultiChatSystemConfig, MultiChatPersonaConfig, AIProvidersState } from '@/types';

interface MultiChatSettingsProps {
  onSaved?: (config: MultiChatSystemConfig) => void;
}

const PERSONA_THEMES: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  nova: {
    icon: Brain,
    color: '#00f0ff',
    bg: 'rgba(0, 240, 255, 0.08)',
    border: 'rgba(0, 240, 255, 0.3)',
  },
  orbit: {
    icon: Smile,
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.08)',
    border: 'rgba(245, 158, 11, 0.3)',
  },
  cosmos: {
    icon: Compass,
    color: '#c084fc',
    bg: 'rgba(192, 132, 252, 0.08)',
    border: 'rgba(192, 132, 252, 0.3)',
  },
};

export function MultiChatSettings({ onSaved }: MultiChatSettingsProps) {
  const [config, setConfig] = useState<MultiChatSystemConfig>(() => storage.getMultiChatConfig());
  const [providersState, setProvidersState] = useState<AIProvidersState>(() => storage.getAIProvidersState());
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSavedRecently, setIsSavedRecently] = useState(false);
  const [expandedPrompts, setExpandedPrompts] = useState<Record<string, boolean>>({
    nova: true,
    orbit: true,
    cosmos: true,
  });
  const [showResetModal, setShowResetModal] = useState(false);
  const [memories, setMemories] = useState<string[]>(() => storage.getMultiChatMemories());
  const [newMemoryInput, setNewMemoryInput] = useState('');

  const handleAddMemory = () => {
    const trimmed = newMemoryInput.trim();
    if (!trimmed) return;
    const updated = storage.addMultiChatMemory(trimmed);
    setMemories(updated);
    setNewMemoryInput('');
  };

  const handleDeleteMemory = (index: number) => {
    const updated = storage.deleteMultiChatMemory(index);
    setMemories(updated);
  };

  useEffect(() => {
    const handleStorage = () => {
      setProvidersState(storage.getAIProvidersState());
      setConfig(storage.getMultiChatConfig());
      setMemories(storage.getMultiChatMemories());
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleStorage);
    };
  }, []);

  const handleResponseLanguageChange = (val: string) => {
    const updated: MultiChatSystemConfig = {
      ...config,
      responseLanguage: val,
    };
    setConfig(updated);
    storage.saveMultiChatConfig(updated);
    onSaved?.(updated);
  };

  const handlePersonaChange = (id: string, updates: Partial<MultiChatPersonaConfig>) => {
    setConfig((prev) => ({
      ...prev,
      personas: {
        ...prev.personas,
        [id]: {
          ...prev.personas[id],
          ...updates,
        },
      },
    }));
    setIsSavedRecently(false);
  };

  const togglePromptExpanded = (id: string) => {
    setExpandedPrompts((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleResetSinglePersona = (id: string) => {
    const defaultPersona = DEFAULT_MULTICHAT_CONFIG.personas[id];
    if (defaultPersona) {
      handlePersonaChange(id, {
        systemPrompt: defaultPersona.systemPrompt,
        maxTokens: defaultPersona.maxTokens,
        providerId: defaultPersona.providerId,
        modelId: defaultPersona.modelId,
      });
      setSaveStatus(`Reset ${defaultPersona.name} to default baseline.`);
      setTimeout(() => setSaveStatus(null), 3500);
    }
  };

  const handleResetAllToDefault = () => {
    const defaultCfg = storage.resetMultiChatConfig();
    setConfig(defaultCfg);
    setShowResetModal(false);
    setIsSavedRecently(true);
    setSaveStatus('All personas reset to default baseline configuration!');
    onSaved?.(defaultCfg);
    setTimeout(() => {
      setIsSavedRecently(false);
      setSaveStatus(null);
    }, 3500);
  };

  const handleSave = () => {
    storage.saveMultiChatConfig(config);
    setIsSavedRecently(true);
    setSaveStatus('Multi Chat persona configurations saved successfully!');
    onSaved?.(config);
    setTimeout(() => {
      setIsSavedRecently(false);
      setSaveStatus(null);
    }, 3500);
  };

  const availableProviders = [
    {
      id: 'existing',
      name: 'Default Active AI Provider (Global Settings)',
    },
    ...providersState.providers.map((p) => ({
      id: p.id,
      name: `${p.name} (${p.model || 'default model'})`,
    })),
  ];

  return (
    <div id="nexus-multichat-settings" className="space-y-6 max-w-5xl mx-auto font-mono text-xs">
      {/* Top Banner & Global Actions */}
      <div
        className="nexus-corner-bracket relative rounded-2xl p-4 sm:p-6 bg-slate-950/90 border border-cyan-500/25 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sliders size={18} className="text-cyan-400" />
            <h2 className="m-0 text-base sm:text-lg font-black text-white uppercase tracking-wider">
              PERSONA ORCHESTRATION & MEMORY MATRIX
            </h2>
          </div>
          <p className="m-0 text-slate-400 font-sans text-xs">
            Fine-tune prompts, token budgets, AI engine models, and permanent memories across the 3 cognitive personas.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-rose-500/50 text-slate-300 hover:text-white font-bold cursor-pointer transition-colors flex items-center gap-1.5"
          >
            <RotateCcw size={13} />
            <span>Reset Baseline</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-lg ${
              isSavedRecently
                ? 'bg-emerald-500 text-black shadow-[0_0_15px_#10b981]'
                : 'bg-gradient-to-r from-cyan-500 to-sky-600 text-black hover:opacity-90 active:scale-95 shadow-[0_0_15px_rgba(0,240,255,0.4)]'
            }`}
          >
            {isSavedRecently ? <Check size={14} /> : <Save size={14} />}
            <span>{isSavedRecently ? 'Saved!' : 'Save Configurations'}</span>
          </button>
        </div>
      </div>

      {/* Save Status Notification Banner */}
      {saveStatus && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 size={15} />
          <span className="font-bold">{saveStatus}</span>
        </div>
      )}

      {/* Response Language & Global Defaults */}
      <div className="rounded-xl p-4 sm:p-5 bg-black/60 border border-white/10 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Languages size={16} className="text-cyan-400" />
            <span className="font-bold text-white uppercase tracking-wider">
              GLOBAL RESPONSE LANGUAGE
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            Forces all 3 personas to communicate strictly in the chosen language
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            value={config.responseLanguage || 'English'}
            onChange={(e) => handleResponseLanguageChange(e.target.value)}
            placeholder="e.g. English, Spanish, French, Japanese, German..."
            className="flex-1 min-w-[200px] px-3.5 py-2 rounded-xl bg-slate-900 border border-white/15 text-white focus:outline-none focus:border-cyan-400 font-mono text-xs"
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            {['English', 'Spanish', 'French', 'German', 'Japanese', 'Chinese'].map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => handleResponseLanguageChange(lang)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                  (config.responseLanguage || 'English').toLowerCase() === lang.toLowerCase()
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400'
                    : 'bg-white/5 text-slate-400 border border-white/5 hover:text-white'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* THREE PERSONA CONFIGURATION CARDS */}
      <div className="space-y-5">
        {(['nova', 'orbit', 'cosmos'] as const).map((personaId) => {
          const persona = config.personas[personaId];
          if (!persona) return null;

          const theme = PERSONA_THEMES[personaId] || PERSONA_THEMES.nova;
          const Icon = theme.icon;
          const isPromptExpanded = Boolean(expandedPrompts[personaId]);

          return (
            <div
              key={personaId}
              id={`multichat-config-${personaId}`}
              className="nexus-corner-bracket relative rounded-2xl overflow-hidden bg-slate-950/80 border transition-all"
              style={{
                borderColor: theme.border,
                boxShadow: `0 8px 32px rgba(0, 0, 0, 0.5), inset 0 0 20px ${theme.bg}`,
              }}
            >
              {/* Persona Section Header */}
              <div
                className="p-4 sm:p-5 bg-black/60 border-b border-white/10 flex items-center justify-between flex-wrap gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-base shadow-md"
                    style={{
                      background: theme.bg,
                      border: `1.5px solid ${theme.color}`,
                      color: theme.color,
                    }}
                  >
                    <Icon size={20} />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-white">
                        {persona.name}
                      </span>
                      <span
                        className="text-[9px] px-2 py-0.5 rounded font-bold uppercase"
                        style={{
                          background: `${theme.color}20`,
                          color: theme.color,
                          border: `1px solid ${theme.color}40`,
                        }}
                      >
                        {persona.toneBadge}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {persona.role} • {persona.description}
                    </div>
                  </div>
                </div>

                {/* Enable / Disable Toggle & Reset Single */}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleResetSinglePersona(personaId)}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-400/40 text-slate-400 hover:text-white transition-colors cursor-pointer text-[11px]"
                    title="Reset this persona prompt and defaults"
                  >
                    Reset Persona
                  </button>

                  <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded-xl bg-white/5 border border-white/10">
                    <input
                      type="checkbox"
                      checked={persona.enabled}
                      onChange={(e) => handlePersonaChange(personaId, { enabled: e.target.checked })}
                      className="accent-cyan-400 w-4 h-4 cursor-pointer"
                    />
                    <span className={`text-xs font-bold ${persona.enabled ? 'text-cyan-300' : 'text-slate-500'}`}>
                      {persona.enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </label>
                </div>
              </div>

              {/* Persona Engine Controls Grid */}
              <div className="p-4 sm:p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Provider Selector */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                      AI PROVIDER:
                    </label>
                    <select
                      value={persona.providerId || 'existing'}
                      onChange={(e) => handlePersonaChange(personaId, { providerId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white focus:outline-none focus:border-cyan-400 font-mono text-xs"
                    >
                      {availableProviders.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Model Name */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                      MODEL NAME:
                    </label>
                    <input
                      type="text"
                      value={persona.modelId || ''}
                      onChange={(e) => handlePersonaChange(personaId, { modelId: e.target.value })}
                      placeholder="e.g. deepseek/deepseek-chat"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white focus:outline-none focus:border-cyan-400 font-mono text-xs"
                    />
                  </div>

                  {/* Max Tokens Budget */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                      MAX TOKENS BUDGET: ({persona.maxTokens || 350})
                    </label>
                    <input
                      type="number"
                      min={100}
                      max={4000}
                      step={50}
                      value={persona.maxTokens || 350}
                      onChange={(e) =>
                        handlePersonaChange(personaId, { maxTokens: parseInt(e.target.value, 10) || 350 })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white focus:outline-none focus:border-cyan-400 font-mono text-xs"
                    />
                  </div>
                </div>

                {/* System Prompt Accordion */}
                <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => togglePromptExpanded(personaId)}
                    className="w-full p-3 flex items-center justify-between text-left font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FileCode2 size={13} style={{ color: theme.color }} />
                      <span>SYSTEM PROMPT INSTRUCTION</span>
                    </div>
                    {isPromptExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {isPromptExpanded && (
                    <div className="p-3 pt-0 border-t border-white/5">
                      <textarea
                        rows={7}
                        value={persona.systemPrompt || ''}
                        onChange={(e) => handlePersonaChange(personaId, { systemPrompt: e.target.value })}
                        className="w-full p-3 rounded-lg bg-slate-950 border border-white/10 text-slate-200 font-mono text-xs leading-relaxed focus:outline-none focus:border-cyan-400 resize-y"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* PERMANENT MEMORIES SECTION */}
      <div
        id="multichat-memories-section"
        className="nexus-corner-bracket relative rounded-2xl p-4 sm:p-6 bg-slate-950/80 border border-cyan-500/25 shadow-xl space-y-4 font-mono"
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Bookmark size={18} className="text-cyan-400" />
            <h3 className="m-0 text-sm sm:text-base font-black text-white uppercase tracking-wider">
              PERMANENT MEMORIES & USER FACTS ({memories.length})
            </h3>
          </div>
          <span className="text-[10px] text-slate-400">
            Injected automatically into all 3 personas as foundational user context
          </span>
        </div>

        {/* Add Memory Row */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newMemoryInput}
            onChange={(e) => setNewMemoryInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newMemoryInput.trim()) {
                e.preventDefault();
                handleAddMemory();
              }
            }}
            placeholder="Add permanent user fact (e.g. 'I am building a Next.js robotics dashboard in Tokyo')..."
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/70 border border-cyan-500/30 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-xs"
          />
          <button
            type="button"
            disabled={!newMemoryInput.trim()}
            onClick={handleAddMemory}
            className="px-4 py-2.5 rounded-xl bg-cyan-500/20 text-cyan-200 border border-cyan-400 hover:bg-cyan-500/30 disabled:opacity-40 disabled:cursor-not-allowed font-bold cursor-pointer transition-colors flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Add Fact</span>
          </button>
        </div>

        {/* Memories List */}
        {memories.length === 0 ? (
          <div className="p-6 text-center text-slate-500 italic text-xs rounded-xl bg-black/40 border border-white/5">
            No permanent memories recorded yet. Add facts above to ground NOVA, ORBIT, and COSMOS in your context.
          </div>
        ) : (
          <div className="space-y-2">
            {memories.map((mem, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-black/50 border border-white/10 flex items-center justify-between gap-3 text-slate-200 font-sans text-xs group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                  <span className="leading-relaxed">{mem}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteMemory(idx)}
                  className="text-slate-500 hover:text-rose-400 p-1 rounded cursor-pointer transition-colors shrink-0"
                  title="Delete memory"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="nexus-corner-bracket relative w-full max-w-md rounded-2xl p-6 bg-slate-950 border border-rose-500/50 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500 text-rose-400 flex items-center justify-center">
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 className="m-0 text-base font-black text-white font-mono">
                  RESET ALL TO DEFAULT?
                </h3>
                <p className="m-0 text-xs text-slate-400 font-sans">
                  This will restore NOVA, ORBIT, and COSMOS system prompts and baseline settings.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetAllToDefault}
                className="px-4 py-2 rounded-xl bg-rose-500 text-white font-bold cursor-pointer hover:bg-rose-600 transition-colors"
              >
                Reset All Personas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
