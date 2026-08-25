import { useState } from 'react';
import {
  Save,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { storage, DEFAULT_JARVIS_CONFIG } from '@/lib/storage';
import type {
  AIProviderConfig,
  JarvisAgentConfig,
  JarvisAgentId,
  JarvisSystemConfig,
} from '@/types';

interface JarvisSettingsProps {
  onSaved?: (config: JarvisSystemConfig) => void;
}

const AGENT_ORDER: JarvisAgentId[] = [
  'planner',
  'researcher',
  'factChecker',
  'reviewer',
  'finalSynthesizer',
];

const MODEL_PRESETS: Record<string, string[]> = {
  openrouter: [
    'deepseek/deepseek-chat',
    'openai/gpt-oss-120b',
    'meta-llama/llama-3.3-70b-instruct',
    'anthropic/claude-3.5-sonnet',
    'mistralai/mixtral-8x7b-instruct',
    'qwen/qwen-2.5-72b-instruct',
    'google/gemini-2.0-flash-001',
  ],
  groq: [
    'llama-3.3-70b-versatile',
    'openai/gpt-oss-120b',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
  ],
  deepseek: [
    'deepseek-chat',
    'deepseek-reasoner',
  ],
  general: [
    'deepseek/deepseek-chat',
    'openai/gpt-oss-120b',
    'llama-3.3-70b-versatile',
    'meta-llama/llama-3.3-70b-instruct',
  ],
};

function getModelSuggestions(provider?: AIProviderConfig | null): string[] {
  if (!provider) return MODEL_PRESETS.general;
  const name = provider.name.toLowerCase();
  const url = (provider.url || '').toLowerCase();

  if (name.includes('openrouter') || url.includes('openrouter')) {
    return MODEL_PRESETS.openrouter;
  }
  if (name.includes('groq') || url.includes('groq')) {
    return MODEL_PRESETS.groq;
  }
  if (name.includes('deepseek') || url.includes('deepseek')) {
    return MODEL_PRESETS.deepseek;
  }
  return [provider.model, ...MODEL_PRESETS.general].filter(
    (m, i, arr) => m && arr.indexOf(m) === i,
  );
}

export function JarvisSettings({ onSaved }: JarvisSettingsProps) {
  const [config, setConfig] = useState<JarvisSystemConfig>(() => storage.getJarvisConfig());
  const [providersState] = useState(() => storage.getAIProvidersState());
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const availableProviders: Array<{ id: string; name: string; model: string; keyCount: number }> = [
    {
      id: 'existing',
      name: 'Built-in Server AI (Default)',
      model: 'deepseek/deepseek-chat',
      keyCount: 1,
    },
    ...providersState.providers.map((p) => ({
      id: p.id,
      name: p.name,
      model: p.model,
      keyCount: p.keys?.filter((k) => k.key && k.key.trim().length > 0).length || 0,
    })),
  ];

  const handleAgentChange = (
    agentId: JarvisAgentId,
    patch: Partial<JarvisAgentConfig>,
  ) => {
    setConfig((prev) => {
      const updated = {
        ...prev,
        agents: {
          ...prev.agents,
          [agentId]: {
            ...prev.agents[agentId],
            ...patch,
          },
        },
      };
      return updated;
    });

    // Clear validation error for this agent if edited
    if (validationErrors[agentId]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[agentId];
        return next;
      });
    }
  };

  const handleSave = () => {
    const errors: Record<string, string> = {};

    AGENT_ORDER.forEach((agentId) => {
      const agent = config.agents[agentId];
      if (agent.enabled) {
        if (!agent.providerId) {
          errors[agentId] = `${agent.name} requires a selected AI Provider.`;
        } else if (!agent.modelId || !agent.modelId.trim()) {
          errors[agentId] = `${agent.name} requires a valid Model ID.`;
        } else if (agent.providerId !== 'existing') {
          const found = providersState.providers.find((p) => p.id === agent.providerId);
          if (!found) {
            errors[agentId] = `Selected provider "${agent.providerId}" no longer exists in AI Providers.`;
          }
        }

        if (agent.enableFailover && agent.fallbackProviderId && agent.fallbackProviderId !== 'existing') {
          const foundFallback = providersState.providers.find((p) => p.id === agent.fallbackProviderId);
          if (!foundFallback) {
            errors[`${agentId}_fallback`] = `Fallback provider no longer exists.`;
          }
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    storage.saveJarvisConfig(config);
    setSaveStatus('JARVIS Configuration saved successfully!');
    onSaved?.(config);

    setTimeout(() => {
      setSaveStatus(null);
    }, 3500);
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset all 5 JARVIS agents to optimal default configurations?')) {
      setConfig(DEFAULT_JARVIS_CONFIG);
      storage.saveJarvisConfig(DEFAULT_JARVIS_CONFIG);
      setSaveStatus('Reset to default JARVIS configuration.');
      onSaved?.(DEFAULT_JARVIS_CONFIG);
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      {/* Header Info */}
      <div
        className="card"
        style={{
          padding: '24px',
          background: 'linear-gradient(135deg, rgba(14,31,48,0.7) 0%, rgba(20,24,54,0.7) 100%)',
          border: '1px solid rgba(97,215,201,0.3)',
          borderRadius: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>🤖</span>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em' }}>
                JARVIS Agent Orchestration
              </h2>
            </div>
            <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '13px', lineHeight: 1.6 }}>
              Configure independent AI providers, models, and token quotas for each of the 5 specialized JARVIS agents.
              Reads directly from your configured AI Providers in Settings.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Link
              to="/settings"
              className="secondary-button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '12px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                color: 'var(--text)',
              }}
            >
              <ExternalLink size={13} />
              Manage AI Providers
            </Link>

            <button
              type="button"
              onClick={handleResetDefaults}
              className="secondary-button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '12px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                color: 'var(--muted)',
              }}
            >
              <RotateCcw size={13} />
              Reset Defaults
            </button>
          </div>
        </div>

        {/* Global Providers Summary */}
        <div
          style={{
            marginTop: '16px',
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'rgba(7,16,24,0.6)',
            border: '1px solid rgba(165,207,214,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)' }}>
            <Sliders size={15} />
            <span>
              <strong>{providersState.providers.length} Custom Provider(s)</strong> configured in NEXUS.
            </span>
          </div>
          <span style={{ color: 'var(--muted)' }}>
            No duplicate API keys needed • Independent per-agent AI selection
          </span>
        </div>
      </div>

      {/* Save Notification Banner */}
      {saveStatus && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '12px',
            background: 'rgba(97,215,201,0.15)',
            border: '1px solid rgba(97,215,201,0.4)',
            color: '#61ddd2',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={18} />
          {saveStatus}
        </div>
      )}

      {/* Validation Errors Banner */}
      {Object.keys(validationErrors).length > 0 && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '12px',
            background: 'rgba(237,139,139,0.15)',
            border: '1px solid rgba(237,139,139,0.4)',
            color: 'var(--danger)',
            fontSize: '13px',
            display: 'grid',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
            <ShieldAlert size={16} />
            Please resolve the following configuration issues:
          </div>
          {Object.values(validationErrors).map((err, idx) => (
            <div key={idx} style={{ paddingLeft: '24px' }}>
              • {err}
            </div>
          ))}
        </div>
      )}

      {/* 5 Agent Cards */}
      <div style={{ display: 'grid', gap: '18px' }}>
        {AGENT_ORDER.map((agentId) => {
          const agent = config.agents[agentId];
          const hasError = Boolean(validationErrors[agentId]);
          const currentProvider =
            agent.providerId === 'existing'
              ? null
              : providersState.providers.find((p) => p.id === agent.providerId) || null;

          const modelSuggestions = getModelSuggestions(currentProvider);

          return (
            <div
              key={agentId}
              className="card"
              style={{
                padding: '22px',
                borderRadius: '16px',
                background: agent.enabled
                  ? 'linear-gradient(135deg, rgba(12,26,42,0.85) 0%, rgba(18,22,50,0.88) 100%)'
                  : 'rgba(10,20,28,0.5)',
                border: hasError
                  ? '1px solid var(--danger)'
                  : agent.enabled
                    ? '1px solid rgba(97,215,201,0.3)'
                    : '1px solid rgba(165,207,214,0.1)',
                opacity: agent.enabled ? 1 : 0.65,
                transition: 'all 0.25s ease',
              }}
            >
              {/* Agent Title & Toggle */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  borderBottom: '1px solid rgba(165,207,214,0.12)',
                  paddingBottom: '14px',
                  marginBottom: '18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '24px' }}>{agent.icon}</span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>{agent.name}</h3>
                      <span
                        style={{
                          fontSize: '10px',
                          fontFamily: 'DM Mono',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'rgba(97,215,201,0.15)',
                          color: 'var(--accent)',
                          border: '1px solid rgba(97,215,201,0.25)',
                        }}
                      >
                        {agent.role}
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '12px' }}>
                      {agent.description}
                    </p>
                  </div>
                </div>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: agent.enabled ? 'var(--accent)' : 'var(--muted)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={agent.enabled}
                    onChange={(e) => handleAgentChange(agentId, { enabled: e.target.checked })}
                    style={{ accentColor: 'var(--accent)', transform: 'scale(1.2)' }}
                  />
                  {agent.enabled ? 'Agent Enabled ✓' : 'Disabled'}
                </label>
              </div>

              {/* Agent Settings Grid */}
              {agent.enabled && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  {/* Primary Provider Selector */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '11px',
                        fontFamily: 'DM Mono',
                        color: 'var(--accent)',
                        marginBottom: '6px',
                        letterSpacing: '0.05em',
                      }}
                    >
                      PRIMARY AI PROVIDER
                    </label>
                    <select
                      value={agent.providerId}
                      onChange={(e) => {
                        const newProvId = e.target.value;
                        const prov = providersState.providers.find((p) => p.id === newProvId);
                        handleAgentChange(agentId, {
                          providerId: newProvId,
                          modelId: prov ? prov.model : agent.modelId || 'deepseek/deepseek-chat',
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

                  {/* Primary Model Selector & Input */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '11px',
                        fontFamily: 'DM Mono',
                        color: 'var(--accent)',
                        marginBottom: '6px',
                        letterSpacing: '0.05em',
                      }}
                    >
                      MODEL IDENTIFIER
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={agent.modelId}
                        onChange={(e) => handleAgentChange(agentId, { modelId: e.target.value })}
                        placeholder="e.g. openai/gpt-oss-120b"
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

                      {modelSuggestions.length > 0 && (
                        <select
                          aria-label="Select model preset"
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAgentChange(agentId, { modelId: e.target.value });
                            }
                          }}
                          style={{
                            width: '40px',
                            borderRadius: '8px',
                            background: 'rgba(14,31,48,0.9)',
                            border: '1px solid rgba(165,207,214,0.25)',
                            color: 'var(--accent)',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                          title="Choose preset model"
                        >
                          <option value="">▼</option>
                          {modelSuggestions.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Max Tokens Slider & Input */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label
                        style={{
                          fontSize: '11px',
                          fontFamily: 'DM Mono',
                          color: 'var(--accent)',
                          letterSpacing: '0.05em',
                        }}
                      >
                        MAX OUTPUT TOKENS
                      </label>
                      <span style={{ fontSize: '11px', fontFamily: 'DM Mono', color: 'var(--muted)' }}>
                        {agent.maxTokens} tokens
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="range"
                        min={64}
                        max={1500}
                        step={32}
                        value={agent.maxTokens}
                        onChange={(e) =>
                          handleAgentChange(agentId, { maxTokens: parseInt(e.target.value, 10) })
                        }
                        style={{ flex: 1, accentColor: 'var(--accent)' }}
                      />
                      <input
                        type="number"
                        min={32}
                        max={4096}
                        value={agent.maxTokens}
                        onChange={(e) =>
                          handleAgentChange(agentId, {
                            maxTokens: Math.max(32, parseInt(e.target.value, 10) || 128),
                          })
                        }
                        style={{
                          width: '75px',
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

                  {/* Failover Section */}
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      background: 'rgba(6,16,24,0.5)',
                      border: '1px solid rgba(165,207,214,0.12)',
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        color: agent.enableFailover ? 'var(--orange)' : 'var(--muted)',
                        fontWeight: 600,
                        marginBottom: agent.enableFailover ? '10px' : '0',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={agent.enableFailover}
                        onChange={(e) =>
                          handleAgentChange(agentId, { enableFailover: e.target.checked })
                        }
                        style={{ accentColor: 'var(--orange)' }}
                      />
                      ☑ Enable Agent Failover (Optional)
                    </label>

                    {agent.enableFailover && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', color: 'var(--muted)', marginBottom: '4px' }}>
                            FALLBACK PROVIDER
                          </label>
                          <select
                            value={agent.fallbackProviderId || 'existing'}
                            onChange={(e) =>
                              handleAgentChange(agentId, { fallbackProviderId: e.target.value })
                            }
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              background: 'rgba(4,12,18,0.9)',
                              border: '1px solid rgba(165,207,214,0.2)',
                              color: '#e7eef2',
                              fontSize: '11px',
                            }}
                          >
                            {availableProviders.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '10px', color: 'var(--muted)', marginBottom: '4px' }}>
                            FALLBACK MODEL
                          </label>
                          <input
                            type="text"
                            value={agent.fallbackModelId || ''}
                            onChange={(e) =>
                              handleAgentChange(agentId, { fallbackModelId: e.target.value })
                            }
                            placeholder="e.g. llama-3.3-70b-versatile"
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              background: 'rgba(4,12,18,0.9)',
                              border: '1px solid rgba(165,207,214,0.2)',
                              color: '#e7eef2',
                              fontSize: '11px',
                              fontFamily: 'DM Mono',
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Save Button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '14px',
          padding: '18px 0',
        }}
      >
        <button
          type="button"
          onClick={handleSave}
          className="search-submit"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '14px 28px',
            fontSize: '14px',
            borderRadius: '10px',
            fontWeight: 700,
          }}
        >
          <Save size={17} />
          Save JARVIS Configuration
        </button>
      </div>
    </div>
  );
}
