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
  Sparkles,
} from 'lucide-react';
import { storage, DEFAULT_MULTICHAT_CONFIG, DEFAULT_MULTICHAT_SYSTEM_PROMPTS } from '@/lib/storage';
import type { MultiChatSystemConfig, MultiChatPersonaConfig, AIProvidersState } from '@/types';

interface MultiChatSettingsProps {
  onSaved?: (config: MultiChatSystemConfig) => void;
}

const MODEL_PRESETS = [
  'nvidia/nemotron-3-nano-30b-a3b',
  'nemotron-3-nano-30b-a3b',
  'deepseek/deepseek-chat',
  'deepseek/deepseek-r1',
  'google/gemini-2.0-flash-001',
  'anthropic/claude-3.5-sonnet',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'meta-llama/llama-3.3-70b-instruct',
  'mistralai/mistral-large-2411',
  'qwen/qwen-2.5-72b-instruct',
];

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

  useEffect(() => {
    const handleStorage = () => {
      setProvidersState(storage.getAIProvidersState());
      setConfig(storage.getMultiChatConfig());
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleStorage);
    };
  }, []);

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
      name: 'Built-in AI (DeepSeek / Server Default)',
      model: 'deepseek/deepseek-chat',
      keyCount: 1,
    },
    ...providersState.providers.map((p) => ({
      id: p.id,
      name: p.name,
      model: p.model,
      keyCount: p.keys.length,
    })),
  ];

  const personasList = Object.values(config.personas);
  const enabledCount = personasList.filter((p) => p.enabled).length;

  return (
    <div className="flex flex-col gap-6" style={{ maxWidth: '1160px', margin: '0 auto' }}>
      {/* Settings Top Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(8, 22, 34, 0.85) 0%, rgba(5, 14, 22, 0.95) 100%)',
          borderRadius: '16px',
          border: '1px solid rgba(97, 215, 201, 0.25)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(97,215,201,0.2) 0%, rgba(129,140,248,0.2) 100%)',
              border: '1px solid rgba(97,215,201,0.4)',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 0 16px rgba(97,215,201,0.2)',
            }}
          >
            <Sliders size={22} className="text-cyan-400" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
              Multi Chat Persona Configurations
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
              Configure AI providers, models, token limits, and prompt baselines for NOVA, ORBIT, and COSMOS.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'DM Mono',
              padding: '6px 12px',
              borderRadius: '8px',
              background: enabledCount > 0 ? 'rgba(97,215,201,0.15)' : 'rgba(239,68,68,0.15)',
              color: enabledCount > 0 ? '#61d7c9' : '#f87171',
              border: `1px solid ${enabledCount > 0 ? 'rgba(97,215,201,0.3)' : 'rgba(239,68,68,0.3)'}`,
              fontWeight: 700,
            }}
          >
            {enabledCount} of {personasList.length} Personas Active
          </span>

          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#cbd5e1',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            title="Reset all personas to factory default prompts and parameters"
          >
            <RotateCcw size={14} />
            Reset All to Default
          </button>

          <button
            type="button"
            onClick={handleSave}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              borderRadius: '8px',
              background: isSavedRecently
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(135deg, var(--accent) 0%, #38bdf8 100%)',
              border: 'none',
              color: '#04121a',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: isSavedRecently
                ? '0 0 16px rgba(16,185,129,0.4)'
                : '0 0 16px rgba(97,215,201,0.3)',
              transition: 'all 0.2s',
            }}
          >
            {isSavedRecently ? <Check size={16} /> : <Save size={16} />}
            {isSavedRecently ? 'Saved ✓' : 'Save Configurations'}
          </button>
        </div>
      </div>

      {/* Save Status Notification */}
      {saveStatus && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '10px',
            background: 'rgba(97, 215, 201, 0.15)',
            border: '1px solid rgba(97, 215, 201, 0.4)',
            color: '#61d7c9',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Check size={16} />
          {saveStatus}
        </div>
      )}

      {/* Connected Sequential Pipeline Callout */}
      <div
        style={{
          padding: '14px 18px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(15, 23, 42, 0.75) 100%)',
          border: '1px solid rgba(6, 182, 212, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(6, 182, 212, 0.15)',
              border: '1px solid rgba(6, 182, 212, 0.35)',
              display: 'grid',
              placeItems: 'center',
              color: '#67e8f9',
              flexShrink: 0,
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
                Connected Sequential Pipeline
              </span>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: 'rgba(6, 182, 212, 0.2)',
                  color: '#67e8f9',
                  fontSize: '11px',
                  fontFamily: 'DM Mono, monospace',
                  fontWeight: 700,
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                }}
              >
                NOVA 🧠 → ORBIT 😎 → COSMOS 🧘
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
              Personas respond in sequence instead of in a vacuum. NOVA answers first; ORBIT receives NOVA's answer to react or build upon it; COSMOS receives both answers to reflect and synthesize. Note: Responses are generated one after another.
            </p>
          </div>
        </div>
      </div>

      {/* 3 Persona Cards Grid */}
      <div className="grid grid-cols-1 gap-6">
        {personasList.map((persona) => {
          const isPromptOpen = Boolean(expandedPrompts[persona.id]);
          const defaultPrompt = DEFAULT_MULTICHAT_SYSTEM_PROMPTS[persona.id] || '';
          const isCustomized = (persona.systemPrompt || '').trim() !== defaultPrompt.trim();

          return (
            <div
              key={persona.id}
              style={{
                borderRadius: '16px',
                background: 'linear-gradient(145deg, rgba(8, 22, 34, 0.75) 0%, rgba(4, 12, 18, 0.85) 100%)',
                border: `1px solid ${persona.enabled ? persona.accentColor + '55' : 'rgba(165, 207, 214, 0.15)'}`,
                boxShadow: persona.enabled
                  ? `0 4px 24px ${persona.accentColor}18`
                  : 'none',
                transition: 'all 0.25s ease',
                overflow: 'hidden',
              }}
            >
              {/* Persona Card Header */}
              <div
                style={{
                  padding: '16px 20px',
                  background: 'rgba(10, 26, 40, 0.65)',
                  borderBottom: '1px solid rgba(165, 207, 214, 0.12)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      background: `${persona.accentColor}22`,
                      border: `1.5px solid ${persona.accentColor}66`,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '22px',
                      boxShadow: `0 0 16px ${persona.accentColor}33`,
                    }}
                  >
                    {persona.icon}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#fff' }}>
                        {persona.name}
                      </h3>
                      <span
                        style={{
                          fontSize: '11px',
                          fontFamily: 'DM Mono',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: `${persona.accentColor}20`,
                          color: persona.accentColor,
                          border: `1px solid ${persona.accentColor}40`,
                          fontWeight: 700,
                        }}
                      >
                        {persona.toneBadge}
                      </span>
                    </div>
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                      {persona.description}
                    </p>
                  </div>
                </div>

                {/* Enable / Disable Switch */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      fontFamily: 'DM Mono',
                      color: persona.enabled ? persona.accentColor : 'var(--muted)',
                    }}
                  >
                    {persona.enabled ? 'ACTIVE' : 'DISABLED'}
                  </span>
                  <label
                    style={{
                      position: 'relative',
                      display: 'inline-block',
                      width: '46px',
                      height: '24px',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={persona.enabled}
                      onChange={(e) => handlePersonaChange(persona.id, { enabled: e.target.checked })}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: persona.enabled ? persona.accentColor : 'rgba(255,255,255,0.15)',
                        transition: '.3s',
                        borderRadius: '24px',
                        boxShadow: persona.enabled ? `0 0 10px ${persona.accentColor}66` : 'none',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          height: '18px',
                          width: '18px',
                          left: persona.enabled ? '24px' : '3px',
                          bottom: '3px',
                          backgroundColor: '#fff',
                          transition: '.3s',
                          borderRadius: '50%',
                        }}
                      />
                    </span>
                  </label>
                </div>
              </div>

              {/* Persona Controls Body */}
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* 2-Column Settings Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  {/* Primary AI Provider */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '11px',
                        fontFamily: 'DM Mono',
                        color: 'var(--accent)',
                        marginBottom: '6px',
                        letterSpacing: '0.05em',
                        fontWeight: 700,
                      }}
                    >
                      AI PROVIDER
                    </label>
                    <select
                      value={persona.providerId}
                      onChange={(e) => {
                        const newProvId = e.target.value;
                        const prov = providersState.providers.find((p) => p.id === newProvId);
                        handlePersonaChange(persona.id, {
                          providerId: newProvId,
                          modelId: prov ? prov.model : persona.modelId || 'deepseek/deepseek-chat',
                        });
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: 'rgba(6,16,24,0.85)',
                        border: '1px solid rgba(165,207,214,0.25)',
                        color: '#e7eef2',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    >
                      {availableProviders.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.keyCount > 0 ? `(${p.keyCount} key)` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Model Identifier */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '11px',
                        fontFamily: 'DM Mono',
                        color: 'var(--accent)',
                        marginBottom: '6px',
                        letterSpacing: '0.05em',
                        fontWeight: 700,
                      }}
                    >
                      MODEL IDENTIFIER
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={persona.modelId}
                        onChange={(e) => handlePersonaChange(persona.id, { modelId: e.target.value })}
                        placeholder="e.g. deepseek/deepseek-chat"
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          borderRadius: '8px',
                          background: 'rgba(6,16,24,0.85)',
                          border: '1px solid rgba(165,207,214,0.25)',
                          color: '#e7eef2',
                          fontSize: '13px',
                          outline: 'none',
                          fontFamily: 'DM Mono',
                        }}
                      />

                      <select
                        aria-label="Select model preset"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handlePersonaChange(persona.id, { modelId: e.target.value });
                          }
                        }}
                        style={{
                          width: '42px',
                          borderRadius: '8px',
                          background: 'rgba(14,31,48,0.9)',
                          border: '1px solid rgba(165,207,214,0.25)',
                          color: 'var(--accent)',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                        title="Choose model preset"
                      >
                        <option value="">▼</option>
                        {MODEL_PRESETS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Max Output Tokens Slider & Number Input */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label
                      style={{
                        fontSize: '11px',
                        fontFamily: 'DM Mono',
                        color: 'var(--accent)',
                        letterSpacing: '0.05em',
                        fontWeight: 700,
                      }}
                    >
                      MAX OUTPUT TOKENS
                    </label>
                    <span style={{ fontSize: '11px', fontFamily: 'DM Mono', color: 'var(--muted)' }}>
                      {persona.maxTokens} tokens
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="range"
                      min={40}
                      max={2000}
                      step={10}
                      value={persona.maxTokens}
                      onChange={(e) =>
                        handlePersonaChange(persona.id, { maxTokens: parseInt(e.target.value, 10) })
                      }
                      style={{ flex: 1, accentColor: persona.accentColor }}
                    />
                    <input
                      type="number"
                      min={40}
                      max={4000}
                      value={persona.maxTokens}
                      onChange={(e) =>
                        handlePersonaChange(persona.id, {
                          maxTokens: Math.max(40, parseInt(e.target.value, 10) || 100),
                        })
                      }
                      style={{
                        width: '80px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: 'rgba(6,16,24,0.85)',
                        border: '1px solid rgba(165,207,214,0.2)',
                        color: '#e7eef2',
                        fontSize: '12px',
                        fontFamily: 'DM Mono',
                        textAlign: 'center',
                      }}
                    />
                  </div>
                </div>

                {/* Editable System Prompt Section */}
                <div
                  style={{
                    borderRadius: '12px',
                    background: 'rgba(5,13,22,0.85)',
                    border: '1px solid rgba(97,215,201,0.25)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Prompt Header */}
                  <div
                    style={{
                      padding: '12px 16px',
                      background: 'rgba(10,22,36,0.9)',
                      borderBottom: isPromptOpen ? '1px solid rgba(97,215,201,0.2)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    <div
                      onClick={() => togglePromptExpanded(persona.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      <FileCode2 size={16} className="text-cyan-400" />
                      <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'DM Mono', color: '#61d7c9' }}>
                        SYSTEM PROMPT / INSTRUCTIONS
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
                        ({(persona.systemPrompt || '').length} chars)
                      </span>
                      {isPromptOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isCustomized && (
                        <span style={{ fontSize: '11px', color: '#fbbf24', fontFamily: 'DM Mono' }}>
                          ● Custom Prompt
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleResetSinglePersona(persona.id)}
                        style={{
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontFamily: 'DM Mono',
                          borderRadius: '6px',
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.18)',
                          color: '#cbd5e1',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        title="Reset this persona prompt to factory default"
                      >
                        <RotateCcw size={12} />
                        Reset to Default
                      </button>
                    </div>
                  </div>

                  {/* Prompt Textarea */}
                  {isPromptOpen && (
                    <div style={{ padding: '12px' }}>
                      <textarea
                        rows={6}
                        value={persona.systemPrompt || ''}
                        onChange={(e) => handlePersonaChange(persona.id, { systemPrompt: e.target.value })}
                        placeholder="Define system persona directives..."
                        style={{
                          width: '100%',
                          padding: '12px',
                          borderRadius: '8px',
                          background: 'rgba(4,10,16,0.95)',
                          border: '1px solid rgba(165,207,214,0.18)',
                          color: '#e2e8f0',
                          fontSize: '13px',
                          lineHeight: '1.6',
                          fontFamily: 'DM Mono, monospace',
                          resize: 'vertical',
                          outline: 'none',
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal for Reset All */}
      {showResetModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            padding: '16px',
          }}
        >
          <div
            style={{
              maxWidth: '460px',
              width: '100%',
              background: '#071622',
              borderRadius: '16px',
              border: '1px solid rgba(239,68,68,0.4)',
              padding: '24px',
              boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#f87171', marginBottom: '14px' }}>
              <AlertCircle size={24} />
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#fff' }}>
                Reset All Personas?
              </h3>
            </div>
            <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: 1.6, margin: '0 0 20px' }}>
              This will restore NOVA, ORBIT, and COSMOS to their initial factory default system prompts, providers, and token limits. Any custom edits you made will be overwritten.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#cbd5e1',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetAllToDefault}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  background: '#ef4444',
                  border: 'none',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
