import React, { useState } from 'react';
import {
  RotateCcw,
  Check,
  Search,
  Shield,
  Layers,
} from 'lucide-react';
import { storage, DEFAULT_PARALLAX_AGENTS } from '@/lib/storage';
import type { ParallaxSystemConfig, ParallaxAgentConfig, AIProvidersState } from '@/types';
import { ParallaxAgentAvatar } from './ParallaxAgentIcon';

interface ParallaxSettingsProps {
  config: ParallaxSystemConfig;
  onConfigChange: (updated: ParallaxSystemConfig) => void;
}

export const ParallaxSettings: React.FC<ParallaxSettingsProps> = ({ config, onConfigChange }) => {
  const [providersState] = useState<AIProvidersState>(() => storage.getAIProvidersState());
  const [filterQuery, setFilterQuery] = useState('');
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  const agentsList = Object.values(config.agents || DEFAULT_PARALLAX_AGENTS);
  const enabledCount = agentsList.filter((a) => a.enabled !== false).length;
  const veritasEnabled = config.agents?.veritas?.enabled !== false;

  const showFeedback = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleUpdateAgent = (id: string, updates: Partial<ParallaxAgentConfig>) => {
    const updated = storage.updateParallaxAgent(id, updates);
    onConfigChange(updated);
    showFeedback(`Updated ${updated.agents[id]?.name || 'Agent'} settings.`);
  };

  const handleResetSingleAgent = (id: string) => {
    const def = DEFAULT_PARALLAX_AGENTS[id];
    if (def) {
      handleUpdateAgent(id, {
        systemInstruction: def.systemInstruction,
        providerId: def.providerId,
        modelId: def.modelId,
        enabled: def.enabled,
        maxTokens: def.maxTokens,
      });
      showFeedback(`Reset ${def.name} to default baseline.`);
    }
  };

  const handleResetAll = () => {
    const resetCfg = storage.resetParallaxConfig();
    onConfigChange(resetCfg);
    setConfirmResetAll(false);
    showFeedback('All 20 Parallax agents reset to factory default!');
  };

  const availableProviders = [
    { id: 'existing', name: 'Built-in AI / Active Default' },
    ...providersState.providers.map((p) => ({
      id: p.id,
      name: p.name,
      keyCount: p.keys.filter((k) => k.key && k.key.trim().length > 0).length,
    })),
  ];

  const filteredAgents = agentsList.filter((a) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.role.toLowerCase().includes(q) ||
      a.systemInstruction.toLowerCase().includes(q)
    );
  });

  return (
    <div id="parallax-settings-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast notification */}
      {saveToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'rgba(6, 182, 212, 0.95)',
            color: '#fff',
            padding: '10px 18px',
            borderRadius: '10px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            fontSize: '13px',
            fontWeight: 700,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: '1px solid rgba(255,255,255,0.3)',
          }}
        >
          <Check size={16} />
          {saveToast}
        </div>
      )}

      {/* Summary Header Banner */}
      <div
        id="parallax-settings-summary-banner"
        style={{
          padding: '18px 22px',
          borderRadius: '16px',
          background: 'linear-gradient(145deg, rgba(8, 26, 38, 0.85) 0%, rgba(4, 14, 22, 0.92) 100%)',
          border: '1px solid rgba(97, 215, 201, 0.3)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <Layers size={20} color="#61d7c9" />
            <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
              PARALLAX AGENT ORCHESTRATION PIPELINE
            </span>
          </div>
          <p
            id="parallax-agents-summary-line"
            style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: 1.45 }}
          >
            <strong style={{ color: '#61d7c9' }}>{enabledCount} of 20 Built-in Agents</strong> (
            {veritasEnabled ? '1 with tool access: VERITAS' : '0 with tool access'}
            ) active in Parallax Pipeline.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {confirmResetAll ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#f87171', fontWeight: 600 }}>Reset all 20?</span>
              <button
                type="button"
                onClick={handleResetAll}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Yes, Reset All
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetAll(false)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#cbd5e1',
                  fontSize: '12px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              id="parallax-reset-all-btn"
              type="button"
              onClick={() => setConfirmResetAll(true)}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(165, 207, 214, 0.25)',
                color: '#cbd5e1',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
              className="hover:border-[#61d7c9] hover:text-white"
            >
              <RotateCcw size={14} />
              Reset All to Defaults
            </button>
          )}
        </div>
      </div>

      {/* Safety & Tool Access Notice */}
      <div
        style={{
          padding: '12px 16px',
          borderRadius: '12px',
          background: 'rgba(6, 16, 24, 0.7)',
          border: '1px solid rgba(165, 207, 214, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <Shield size={18} color="#06b6d4" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.45 }}>
          <strong style={{ color: '#e2e8f0' }}>Strict Architecture Safeguards:</strong> Agents cannot autonomously pass messages or initiate rounds. VERITAS is granted exactly ONE live search query in Round 1 only to anchor the discussion with empirical facts. The swarm auto-stops strictly after Round 3.
        </div>
      </div>

      {/* Filter / Search Agents Bar */}
      <div style={{ position: 'relative' }}>
        <input
          id="parallax-search-agents-input"
          type="text"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Filter agents by name, role, or instruction (e.g. 'veritas', 'business', 'logic')..."
          style={{
            width: '100%',
            padding: '10px 14px 10px 38px',
            borderRadius: '10px',
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(165, 207, 214, 0.25)',
            color: '#fff',
            fontSize: '13px',
            outline: 'none',
          }}
          className="focus:border-[#61d7c9] transition-colors"
        />
        <Search
          size={16}
          color="#94a3b8"
          style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
        />
      </div>

      {/* 20 Agents Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '16px',
        }}
      >
        {filteredAgents.map((agent) => {
          const defaultAgent = DEFAULT_PARALLAX_AGENTS[agent.id];
          const isCustomized =
            (agent.systemInstruction || '').trim() !== (defaultAgent?.systemInstruction || '').trim();

          return (
            <div
              key={agent.id}
              id={`parallax-agent-card-${agent.id}`}
              style={{
                borderRadius: '14px',
                background: 'linear-gradient(145deg, rgba(8, 22, 34, 0.8) 0%, rgba(4, 12, 18, 0.9) 100%)',
                border: `1px solid ${agent.enabled ? agent.accentColor + '55' : 'rgba(165, 207, 214, 0.15)'}`,
                boxShadow: agent.enabled ? `0 4px 20px ${agent.accentColor}15` : 'none',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Agent Card Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Avatar Icon */}
                  <ParallaxAgentAvatar
                    agentId={agent.id}
                    agentName={agent.name}
                    accentColor={agent.accentColor}
                    size="md"
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>{agent.name}</span>
                      {agent.id === 'veritas' ? (
                        <span
                          style={{
                            fontSize: '10px',
                            fontFamily: 'DM Mono, monospace',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'rgba(6, 182, 212, 0.2)',
                            color: '#38bdf8',
                            border: '1px solid rgba(6, 182, 212, 0.4)',
                            fontWeight: 700,
                          }}
                        >
                          🔍 Fact Tool (R1)
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '10px',
                            fontFamily: 'DM Mono, monospace',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'rgba(148, 163, 184, 0.1)',
                            color: '#94a3b8',
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                          }}
                        >
                          No Tools
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '1px' }}>
                      {agent.role}
                    </span>
                  </div>
                </div>

                {/* Active Toggle Switch */}
                <label
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    width: '42px',
                    height: '22px',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={agent.enabled}
                    onChange={(e) => handleUpdateAgent(agent.id, { enabled: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: agent.enabled ? agent.accentColor : 'rgba(255,255,255,0.15)',
                      transition: '.25s',
                      borderRadius: '22px',
                      boxShadow: agent.enabled ? `0 0 8px ${agent.accentColor}66` : 'none',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        height: '16px',
                        width: '16px',
                        left: agent.enabled ? '23px' : '3px',
                        bottom: '3px',
                        backgroundColor: '#fff',
                        transition: '.25s',
                        borderRadius: '50%',
                      }}
                    />
                  </span>
                </label>
              </div>

              {/* Editable System Instruction */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label
                    style={{
                      fontSize: '10px',
                      fontFamily: 'DM Mono, monospace',
                      color: 'var(--accent, #61d7c9)',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                    }}
                  >
                    PERSONA INSTRUCTION:
                  </label>
                  {isCustomized && (
                    <button
                      type="button"
                      onClick={() => handleResetSingleAgent(agent.id)}
                      style={{
                        fontSize: '10px',
                        color: '#38bdf8',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: 0,
                      }}
                    >
                      <RotateCcw size={10} /> Reset
                    </button>
                  )}
                </div>
                <textarea
                  value={agent.systemInstruction}
                  onChange={(e) => handleUpdateAgent(agent.id, { systemInstruction: e.target.value })}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid rgba(165, 207, 214, 0.2)',
                    color: '#e2e8f0',
                    fontSize: '12px',
                    lineHeight: 1.4,
                    resize: 'vertical',
                    outline: 'none',
                  }}
                  className="focus:border-[#61d7c9] transition-colors"
                />
              </div>

              {/* AI Provider & Model Select */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '10px',
                      fontFamily: 'DM Mono, monospace',
                      color: '#94a3b8',
                      marginBottom: '3px',
                      fontWeight: 600,
                    }}
                  >
                    AI PROVIDER:
                  </label>
                  <select
                    value={agent.providerId || 'existing'}
                    onChange={(e) => {
                      const newProvId = e.target.value;
                      const prov = providersState.providers.find((p) => p.id === newProvId);
                      handleUpdateAgent(agent.id, {
                        providerId: newProvId,
                        modelId: prov ? prov.model : agent.modelId || 'deepseek/deepseek-chat',
                      });
                    }}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      background: 'rgba(6, 16, 24, 0.85)',
                      border: '1px solid rgba(165, 207, 214, 0.2)',
                      color: '#e2e8f0',
                      fontSize: '11px',
                      outline: 'none',
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
                  <label
                    style={{
                      display: 'block',
                      fontSize: '10px',
                      fontFamily: 'DM Mono, monospace',
                      color: '#94a3b8',
                      marginBottom: '3px',
                      fontWeight: 600,
                    }}
                  >
                    MODEL ID:
                  </label>
                  <input
                    type="text"
                    value={agent.modelId || 'deepseek/deepseek-chat'}
                    onChange={(e) => handleUpdateAgent(agent.id, { modelId: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      background: 'rgba(6, 16, 24, 0.85)',
                      border: '1px solid rgba(165, 207, 214, 0.2)',
                      color: '#e2e8f0',
                      fontSize: '11px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
