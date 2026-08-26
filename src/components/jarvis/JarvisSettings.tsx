import { useState } from 'react';
import {
  Save,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  RotateCcw,
  Sliders,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileCode2,
  Sparkles,
  Info,
  Bot,
  Wand2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  storage,
  DEFAULT_JARVIS_CONFIG,
  DEFAULT_AGENT_SYSTEM_PROMPTS,
} from '@/lib/storage';
import type {
  AIProviderConfig,
  CustomAgentPipelinePosition,
  CustomJarvisAgentConfig,
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
  'architect',
  'dataAnalyst',
  'imageFinder',
];

const PROMPT_HELP_TAGS: Record<string, { vars: string[]; purpose: string }> = {
  planner: {
    vars: ['{query}'],
    purpose: 'Decomposes user query and decides required downstream execution pipeline.',
  },
  researcher: {
    vars: ['{task}', '{searchSnippets}'],
    purpose: 'Investigates live web and Wikipedia contexts, extracting core facts.',
  },
  factChecker: {
    vars: ['{task}', '{claims}'],
    purpose: 'Verifies collected claims, checks for contradictions and accuracy.',
  },
  reviewer: {
    vars: ['{task}', '{facts}', '{issues}'],
    purpose: 'Analyzes logical coherence, structure, and provides executive recommendations.',
  },
  finalSynthesizer: {
    vars: ['System Prompt Only (Receives rich compiled context in user message)'],
    purpose: 'Synthesizes all verified intelligence and custom agent insights into the final response.',
  },
  architect: {
    vars: ['{task}', '{answer}'],
    purpose: 'Generates clean, dark-themed SVG diagrams illustrating structural concepts and workflows.',
  },
  dataAnalyst: {
    vars: ['{task}', '{content}'],
    purpose: 'Extracts quantitative comparative metrics and statistics into chart-ready JSON.',
  },
  imageFinder: {
    vars: ['{task}'],
    purpose: 'Formulates a precise, specific image search query to retrieve real photographs via NEXUS Search & Wikimedia.',
  },
};

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

const EMOJI_OPTIONS = ['🤖', '⚡', '💡', '🛡️', '🧪', '📊', '🎨', '🧠', '⚙️', '🚀', '💎', '🔮', '🧬', '🎯', '📑', '🔍'];

const PIPELINE_POSITION_LABELS: Record<CustomAgentPipelinePosition, { label: string; desc: string }> = {
  before_synthesizer: {
    label: 'Before Final Synthesizer (Recommended)',
    desc: 'Runs after Reviewer; insights are injected directly into the Final Synthesizer.',
  },
  parallel_research: {
    label: 'Parallel with Research',
    desc: 'Executes early alongside web and Wikipedia research.',
  },
  extra_step: {
    label: 'Dedicated Pre-Synthesis Step',
    desc: 'Provides specialized auxiliary domain analysis.',
  },
  after_synthesizer: {
    label: 'Post-Synthesizer Refinement',
    desc: 'Executes after Final Synthesizer for post-processing evaluation.',
  },
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
  const [isSavedRecently, setIsSavedRecently] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Collapsible prompt views per agent
  const [expandedPrompts, setExpandedPrompts] = useState<Record<string, boolean>>({
    planner: true,
    researcher: false,
    factChecker: false,
    reviewer: false,
    finalSynthesizer: false,
    architect: false,
    dataAnalyst: false,
    imageFinder: false,
  });

  // Modal / drawer state for "Add New Custom Agent"
  const [showAddModal, setShowAddModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  // New Custom Agent Form State
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentRole, setNewAgentRole] = useState('');
  const [newAgentDescription, setNewAgentDescription] = useState('');
  const [newAgentPrompt, setNewAgentPrompt] = useState(
    'You are a specialized intelligence agent. Analyze the provided inquiry and context carefully, and deliver clear, actionable insights.',
  );
  const [newAgentIcon, setNewAgentIcon] = useState('🤖');
  const [newAgentProviderId, setNewAgentProviderId] = useState('existing');
  const [newAgentModelId, setNewAgentModelId] = useState('deepseek/deepseek-chat');
  const [newAgentMaxTokens, setNewAgentMaxTokens] = useState(400);
  const [newAgentPipelinePos, setNewAgentPipelinePos] = useState<CustomAgentPipelinePosition>('before_synthesizer');
  const [newAgentEnabled, setNewAgentEnabled] = useState(true);
  const [newAgentFormError, setNewAgentFormError] = useState<string | null>(null);

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

  const togglePromptExpanded = (agentId: string) => {
    setExpandedPrompts((prev) => ({
      ...prev,
      [agentId]: !prev[agentId],
    }));
  };

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
            ...prev.agents[agentId as keyof typeof prev.agents],
            ...patch,
          },
        },
      };
      return updated;
    });

    if (validationErrors[agentId]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[agentId];
        return next;
      });
    }
  };

  const handleResetAgentPrompt = (agentId: string) => {
    const defaultPrompt = DEFAULT_AGENT_SYSTEM_PROMPTS[agentId];
    if (defaultPrompt) {
      handleAgentChange(agentId, { systemPrompt: defaultPrompt });
      setSaveStatus(`Restored default prompt for ${config.agents[agentId as keyof typeof config.agents]?.name || agentId}`);
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const handleCustomAgentChange = (
    agentId: string,
    patch: Partial<CustomJarvisAgentConfig>,
  ) => {
    setConfig((prev) => {
      const customList = [...(prev.customAgents || [])];
      const idx = customList.findIndex((c) => c.id === agentId);
      if (idx >= 0) {
        customList[idx] = { ...customList[idx], ...patch };
      }
      return {
        ...prev,
        customAgents: customList,
      };
    });
  };

  const handleDeleteCustomAgent = (agentId: string) => {
    const agentToDelete = (config.customAgents || []).find((c) => c.id === agentId);
    const name = agentToDelete?.name || 'custom agent';
    if (window.confirm(`Are you sure you want to delete the "${name}" custom agent?`)) {
      setConfig((prev) => ({
        ...prev,
        customAgents: (prev.customAgents || []).filter((c) => c.id !== agentId),
      }));
      setSaveStatus(`Deleted custom agent "${name}".`);
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const handleCreateCustomAgent = () => {
    if (!newAgentName.trim()) {
      setNewAgentFormError('Agent Name is required.');
      return;
    }
    if (!newAgentPrompt.trim()) {
      setNewAgentFormError('System prompt / instructions cannot be empty.');
      return;
    }

    const uniqueId = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newAgent: CustomJarvisAgentConfig = {
      id: uniqueId,
      name: newAgentName.trim(),
      role: newAgentRole.trim() || 'Custom Specialized Analysis',
      description: newAgentDescription.trim() || 'Custom user-defined agent.',
      icon: newAgentIcon || '🤖',
      providerId: newAgentProviderId,
      modelId: newAgentModelId.trim() || 'deepseek/deepseek-chat',
      enabled: newAgentEnabled,
      maxTokens: newAgentMaxTokens,
      enableFailover: false,
      pipelinePosition: newAgentPipelinePos,
      systemPrompt: newAgentPrompt.trim(),
      createdAt: Date.now(),
    };

    setConfig((prev) => ({
      ...prev,
      customAgents: [...(prev.customAgents || []), newAgent],
    }));

    // Reset form
    setNewAgentName('');
    setNewAgentRole('');
    setNewAgentDescription('');
    setNewAgentPrompt('You are a specialized intelligence agent. Analyze the provided inquiry and context carefully, and deliver clear, actionable insights.');
    setNewAgentIcon('🤖');
    setNewAgentFormError(null);
    setShowAddModal(false);

    setSaveStatus(`Added new custom agent "${newAgent.name}". Click "Save Configuration" to persist.`);
    setTimeout(() => setSaveStatus(null), 4000);
  };

  const handleSave = () => {
    const errors: Record<string, string> = {};

    // Validate 5 default agents
    AGENT_ORDER.forEach((agentId) => {
      const agent = config.agents[agentId];
      if (agent && agent.enabled) {
        if (!agent.providerId) {
          errors[agentId] = `${agent.name} requires a selected AI Provider.`;
        } else if (!agent.modelId || !agent.modelId.trim()) {
          errors[agentId] = `${agent.name} requires a valid Model ID.`;
        } else if (agent.providerId !== 'existing') {
          const found = providersState.providers.find((p) => p.id === agent.providerId);
          if (!found) {
            errors[agentId] = `Selected provider for ${agent.name} no longer exists. Please reselect a provider.`;
          }
        }

        if (agent.enableFailover && agent.fallbackProviderId && agent.fallbackProviderId !== 'existing') {
          const foundFallback = providersState.providers.find((p) => p.id === agent.fallbackProviderId);
          if (!foundFallback) {
            errors[`${agentId}_fallback`] = `Fallback provider for ${agent.name} no longer exists.`;
          }
        }
      }
    });

    // Validate custom agents
    (config.customAgents || []).forEach((cAgent) => {
      if (cAgent.enabled) {
        if (!cAgent.name.trim()) {
          errors[cAgent.id] = 'Custom agent requires a valid name.';
        }
        if (!cAgent.modelId.trim()) {
          errors[`${cAgent.id}_model`] = `Custom agent ${cAgent.name} requires a Model ID.`;
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setValidationErrors({});
    storage.saveJarvisConfig(config);
    setIsSavedRecently(true);
    setSaveStatus('JARVIS configuration and custom agents saved successfully!');
    onSaved?.(config);

    setTimeout(() => {
      setSaveStatus(null);
      setIsSavedRecently(false);
    }, 3500);
  };

  const executeResetAll = () => {
    setConfig(DEFAULT_JARVIS_CONFIG);
    storage.saveJarvisConfig(DEFAULT_JARVIS_CONFIG);
    setShowResetConfirmModal(false);
    setIsSavedRecently(true);
    setSaveStatus('All 8 agents and custom agents have been reset to original factory defaults.');
    onSaved?.(DEFAULT_JARVIS_CONFIG);
    setTimeout(() => {
      setSaveStatus(null);
      setIsSavedRecently(false);
    }, 3500);
  };

  const customAgentsList = config.customAgents || [];

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      {/* Header Info */}
      <div
        className="card"
        style={{
          padding: '24px',
          background: 'linear-gradient(135deg, rgba(14,31,48,0.85) 0%, rgba(20,24,54,0.85) 100%)',
          border: '1px solid rgba(97,215,201,0.3)',
          borderRadius: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>🤖</span>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                JARVIS Agent Orchestration & Customization
              </h2>
            </div>
            <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '13px', lineHeight: 1.6 }}>
              Inspect and edit custom system prompts for each agent, add new specialized agents to the multi-AI pipeline, and configure custom providers or models.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '12px',
                borderRadius: '8px',
                fontWeight: 700,
                border: '1px solid rgba(97,215,201,0.5)',
                cursor: 'pointer',
                background: 'linear-gradient(135deg, rgba(97,215,201,0.25) 0%, rgba(56,189,248,0.2) 100%)',
                color: '#61d7c9',
                boxShadow: '0 0 12px rgba(97,215,201,0.2)',
              }}
            >
              <Plus size={14} />
              <span>Add New Agent</span>
            </button>

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
                textDecoration: 'none',
              }}
            >
              <ExternalLink size={13} />
              AI Providers
            </Link>

            <button
              type="button"
              onClick={() => setShowResetConfirmModal(true)}
              className="secondary-button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '12px',
                borderRadius: '8px',
                border: '1px solid rgba(244,63,94,0.3)',
                color: '#fb7185',
                background: 'rgba(244,63,94,0.08)',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={13} />
              Reset All Defaults
            </button>

            <button
              type="button"
              onClick={handleSave}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '12px',
                borderRadius: '8px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: isSavedRecently
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #61d7c9 0%, #38bdf8 100%)',
                color: '#051218',
                boxShadow: isSavedRecently ? '0 0 16px rgba(16,185,129,0.45)' : '0 0 12px rgba(97,215,201,0.25)',
                transition: 'all 0.25s ease',
              }}
            >
              {isSavedRecently ? <CheckCircle2 size={13} /> : <Save size={13} />}
              <span>{isSavedRecently ? 'Saved ✓' : 'Save Config'}</span>
            </button>
          </div>
        </div>

        {/* Global Pipeline Summary */}
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
              <strong>8 Core Agents</strong> + <strong>{customAgentsList.length} Custom Agent(s)</strong> active in JARVIS Pipeline.
            </span>
          </div>
          <span style={{ color: 'var(--muted)' }}>
            Fully editable system prompts • Live multi-agent synthesis
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

      {/* SECTION 1: CORE 8 AGENTS */}
      <div style={{ display: 'grid', gap: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bot size={18} className="text-cyan-400" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
              Core 8-Agent Pipeline
            </h3>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
            System Prompts & Model Quotas
          </span>
        </div>

        {AGENT_ORDER.map((agentId) => {
          const agent = config.agents[agentId];
          const hasError = Boolean(validationErrors[agentId]);
          const currentProvider =
            agent.providerId === 'existing'
              ? null
              : providersState.providers.find((p) => p.id === agent.providerId) || null;

          const modelSuggestions = getModelSuggestions(currentProvider);
          const isPromptOpen = Boolean(expandedPrompts[agentId]);
          const defaultPrompt = DEFAULT_AGENT_SYSTEM_PROMPTS[agentId] || '';
          const currentPrompt = agent.systemPrompt || defaultPrompt;
          const isCustomizedPrompt = currentPrompt.trim() !== defaultPrompt.trim();
          const helpInfo = PROMPT_HELP_TAGS[agentId];

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
                      <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#fff' }}>{agent.name}</h3>
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
                      {isCustomizedPrompt && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontFamily: 'DM Mono',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: 'rgba(245,158,11,0.15)',
                            color: '#fbbf24',
                            border: '1px solid rgba(245,158,11,0.3)',
                          }}
                        >
                          Custom Prompt Active
                        </span>
                      )}
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
                <div style={{ display: 'grid', gap: '18px' }}>
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
                          max={agentId === 'architect' ? 6000 : 2500}
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
                          max={8000}
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

                  {/* EDITABLE SYSTEM PROMPT SECTION */}
                  <div
                    style={{
                      borderRadius: '12px',
                      background: 'rgba(5,13,22,0.85)',
                      border: '1px solid rgba(97,215,201,0.25)',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Section Header with Toggle & Reset Button */}
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
                        onClick={() => togglePromptExpanded(agentId)}
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
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          ({currentPrompt.length} chars)
                        </span>
                        {isPromptOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isCustomizedPrompt && (
                          <span style={{ fontSize: '11px', color: '#fbbf24', fontFamily: 'DM Mono' }}>
                            ● Custom Prompt
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleResetAgentPrompt(agentId)}
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
                          title="Restore default system prompt for this agent"
                        >
                          <RotateCcw size={11} />
                          Reset to Default
                        </button>
                      </div>
                    </div>

                    {/* Expandable Textarea & Info */}
                    {isPromptOpen && (
                      <div style={{ padding: '14px 16px', display: 'grid', gap: '10px' }}>
                        {helpInfo && (
                          <div
                            style={{
                              fontSize: '11px',
                              color: 'var(--muted)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              flexWrap: 'wrap',
                            }}
                          >
                            <Info size={13} className="text-cyan-400 shrink-0" />
                            <span>{helpInfo.purpose}</span>
                            {helpInfo.vars.length > 0 && (
                              <span style={{ fontFamily: 'DM Mono', color: '#61d7c9' }}>
                                Available Variables: {helpInfo.vars.join(', ')}
                              </span>
                            )}
                          </div>
                        )}

                        <textarea
                          value={currentPrompt}
                          onChange={(e) => handleAgentChange(agentId, { systemPrompt: e.target.value })}
                          rows={7}
                          style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '8px',
                            background: 'rgba(3,8,14,0.95)',
                            border: '1px solid rgba(97,215,201,0.3)',
                            color: '#e2e8f0',
                            fontSize: '12px',
                            fontFamily: 'DM Mono, monospace',
                            lineHeight: 1.6,
                            resize: 'vertical',
                            outline: 'none',
                          }}
                          placeholder={`Enter custom system instructions for ${agent.name}...`}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* SECTION 2: CUSTOM AGENTS */}
      <div style={{ display: 'grid', gap: '18px', marginTop: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} className="text-cyan-300" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
              Custom User Agents ({customAgentsList.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '8px',
              background: 'rgba(97,215,201,0.2)',
              border: '1px solid rgba(97,215,201,0.4)',
              color: '#61d7c9',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Plus size={13} />
            Add Custom Agent
          </button>
        </div>

        {customAgentsList.length === 0 ? (
          <div
            style={{
              padding: '32px 24px',
              textAlign: 'center',
              borderRadius: '16px',
              background: 'rgba(7,16,24,0.4)',
              border: '1.5px dashed rgba(165,207,214,0.2)',
              display: 'grid',
              placeItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(97,215,201,0.1)',
                display: 'grid',
                placeItems: 'center',
                color: '#61d7c9',
              }}
            >
              <Wand2 size={24} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                No Custom Agents Defined Yet
              </h4>
              <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '13px', maxWidth: '460px' }}>
                Create specialized intelligence agents (such as Code Auditor, Creative Explainer, or Legal Reviewer) that run automatically within the JARVIS neural pipeline.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              style={{
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 700,
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #61d7c9 0%, #38bdf8 100%)',
                color: '#051218',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 0 12px rgba(97,215,201,0.3)',
              }}
            >
              + Create First Custom Agent
            </button>
          </div>
        ) : (
          customAgentsList.map((cAgent) => {
            const hasError = Boolean(validationErrors[cAgent.id]);
            const isPromptOpen = Boolean(expandedPrompts[cAgent.id]);
            const currentProvider =
              cAgent.providerId === 'existing'
                ? null
                : providersState.providers.find((p) => p.id === cAgent.providerId) || null;
            const modelSuggestions = getModelSuggestions(currentProvider);

            return (
              <div
                key={cAgent.id}
                className="card"
                style={{
                  padding: '22px',
                  borderRadius: '16px',
                  background: cAgent.enabled
                    ? 'linear-gradient(135deg, rgba(14,32,48,0.85) 0%, rgba(26,20,54,0.85) 100%)'
                    : 'rgba(10,20,28,0.5)',
                  border: hasError
                    ? '1px solid var(--danger)'
                    : cAgent.enabled
                      ? '1px solid rgba(168,85,247,0.35)'
                      : '1px solid rgba(165,207,214,0.1)',
                  opacity: cAgent.enabled ? 1 : 0.65,
                  transition: 'all 0.25s ease',
                }}
              >
                {/* Custom Agent Header */}
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
                    <span style={{ fontSize: '24px' }}>{cAgent.icon || '🤖'}</span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#fff' }}>{cAgent.name}</h3>
                        <span
                          style={{
                            fontSize: '10px',
                            fontFamily: 'DM Mono',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: 'rgba(168,85,247,0.2)',
                            color: '#c084fc',
                            border: '1px solid rgba(168,85,247,0.3)',
                          }}
                        >
                          Custom Agent
                        </span>
                        <span
                          style={{
                            fontSize: '10px',
                            fontFamily: 'DM Mono',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: 'rgba(97,215,201,0.15)',
                            color: '#61d7c9',
                            border: '1px solid rgba(97,215,201,0.3)',
                          }}
                        >
                          {PIPELINE_POSITION_LABELS[cAgent.pipelinePosition || 'before_synthesizer']?.label.split(' ')[0] || 'Pipeline Stage'}
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '12px' }}>
                        {cAgent.description || cAgent.role}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: cAgent.enabled ? '#c084fc' : 'var(--muted)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={cAgent.enabled}
                        onChange={(e) => handleCustomAgentChange(cAgent.id, { enabled: e.target.checked })}
                        style={{ accentColor: '#a855f7', transform: 'scale(1.2)' }}
                      />
                      {cAgent.enabled ? 'Agent Active ✓' : 'Disabled'}
                    </label>

                    <button
                      type="button"
                      onClick={() => handleDeleteCustomAgent(cAgent.id)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: 'rgba(244,63,94,0.15)',
                        border: '1px solid rgba(244,63,94,0.35)',
                        color: '#fb7185',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="Delete this custom agent"
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  </div>
                </div>

                {/* Custom Agent Controls */}
                {cAgent.enabled && (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                      {/* Name & Role */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontFamily: 'DM Mono', color: '#c084fc', marginBottom: '6px' }}>
                          AGENT NAME & ROLE
                        </label>
                        <input
                          type="text"
                          value={cAgent.name}
                          onChange={(e) => handleCustomAgentChange(cAgent.id, { name: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            background: 'rgba(6,16,24,0.85)',
                            border: '1px solid rgba(165,207,214,0.25)',
                            color: '#fff',
                            fontSize: '13px',
                            fontWeight: 600,
                          }}
                        />
                      </div>

                      {/* Provider */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontFamily: 'DM Mono', color: '#c084fc', marginBottom: '6px' }}>
                          AI PROVIDER
                        </label>
                        <select
                          value={cAgent.providerId}
                          onChange={(e) => {
                            const newProvId = e.target.value;
                            const prov = providersState.providers.find((p) => p.id === newProvId);
                            handleCustomAgentChange(cAgent.id, {
                              providerId: newProvId,
                              modelId: prov ? prov.model : cAgent.modelId || 'deepseek/deepseek-chat',
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
                          }}
                        >
                          {availableProviders.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Model */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontFamily: 'DM Mono', color: '#c084fc', marginBottom: '6px' }}>
                          MODEL IDENTIFIER
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            value={cAgent.modelId}
                            onChange={(e) => handleCustomAgentChange(cAgent.id, { modelId: e.target.value })}
                            style={{
                              flex: 1,
                              padding: '10px 12px',
                              borderRadius: '8px',
                              background: 'rgba(6,16,24,0.85)',
                              border: '1px solid rgba(165,207,214,0.25)',
                              color: '#e7eef2',
                              fontSize: '13px',
                              fontFamily: 'DM Mono',
                            }}
                          />
                          {modelSuggestions.length > 0 && (
                            <select
                              aria-label="Preset Model"
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleCustomAgentChange(cAgent.id, { modelId: e.target.value });
                                }
                              }}
                              style={{
                                width: '40px',
                                borderRadius: '8px',
                                background: 'rgba(14,31,48,0.9)',
                                border: '1px solid rgba(165,207,214,0.25)',
                                color: '#c084fc',
                                fontSize: '12px',
                                cursor: 'pointer',
                              }}
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

                      {/* Pipeline Stage */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontFamily: 'DM Mono', color: '#c084fc', marginBottom: '6px' }}>
                          PIPELINE EXECUTION POSITION
                        </label>
                        <select
                          value={cAgent.pipelinePosition || 'before_synthesizer'}
                          onChange={(e) =>
                            handleCustomAgentChange(cAgent.id, {
                              pipelinePosition: e.target.value as CustomAgentPipelinePosition,
                            })
                          }
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            background: 'rgba(6,16,24,0.85)',
                            border: '1px solid rgba(165,207,214,0.25)',
                            color: '#e7eef2',
                            fontSize: '13px',
                          }}
                        >
                          <option value="before_synthesizer">Before Final Synthesizer (Recommended)</option>
                          <option value="parallel_research">Parallel with Research</option>
                          <option value="extra_step">Dedicated Pre-Synthesis Step</option>
                          <option value="after_synthesizer">Post-Synthesizer Refinement</option>
                        </select>
                      </div>
                    </div>

                    {/* Custom Agent Prompt Box */}
                    <div
                      style={{
                        borderRadius: '12px',
                        background: 'rgba(5,13,22,0.85)',
                        border: '1px solid rgba(168,85,247,0.3)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        onClick={() => togglePromptExpanded(cAgent.id)}
                        style={{
                          padding: '12px 16px',
                          background: 'rgba(18,12,38,0.9)',
                          borderBottom: isPromptOpen ? '1px solid rgba(168,85,247,0.2)' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileCode2 size={16} className="text-purple-400" />
                          <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'DM Mono', color: '#c084fc' }}>
                            CUSTOM AGENT SYSTEM PROMPT
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            ({(cAgent.systemPrompt || '').length} chars)
                          </span>
                        </div>
                        {isPromptOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </div>

                      {isPromptOpen && (
                        <div style={{ padding: '14px 16px' }}>
                          <textarea
                            value={cAgent.systemPrompt || ''}
                            onChange={(e) => handleCustomAgentChange(cAgent.id, { systemPrompt: e.target.value })}
                            rows={6}
                            style={{
                              width: '100%',
                              padding: '12px',
                              borderRadius: '8px',
                              background: 'rgba(3,8,14,0.95)',
                              border: '1px solid rgba(168,85,247,0.3)',
                              color: '#e2e8f0',
                              fontSize: '12px',
                              fontFamily: 'DM Mono, monospace',
                              lineHeight: 1.6,
                              resize: 'vertical',
                              outline: 'none',
                            }}
                            placeholder="Enter custom instructions guiding this agent's specialized task..."
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Save Button Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          padding: '20px 24px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(8,20,34,0.95) 0%, rgba(14,26,48,0.95) 100%)',
          border: '1px solid rgba(97,215,201,0.35)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {saveStatus ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontWeight: 700, fontSize: '13px' }}>
              <CheckCircle2 size={17} />
              <span>{saveStatus}</span>
            </div>
          ) : Object.keys(validationErrors).length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fb7185', fontSize: '13px', fontWeight: 600 }}>
              <ShieldAlert size={16} />
              <span>{Object.keys(validationErrors).length} error(s) found above. Please review your settings.</span>
            </div>
          ) : (
            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
              Configuration updates are stored in local runtime persistence and take effect immediately.
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setShowResetConfirmModal(true)}
            style={{
              padding: '11px 18px',
              fontSize: '13px',
              borderRadius: '10px',
              border: '1px solid rgba(244,63,94,0.35)',
              background: 'rgba(244,63,94,0.1)',
              color: '#fb7185',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 600,
            }}
          >
            <RotateCcw size={14} />
            <span>Reset All to Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="search-submit"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '13px 28px',
              fontSize: '14px',
              borderRadius: '10px',
              fontWeight: 700,
              background: isSavedRecently
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(135deg, #61d7c9 0%, #38bdf8 100%)',
              color: '#051218',
              border: 'none',
              cursor: 'pointer',
              boxShadow: isSavedRecently
                ? '0 0 20px rgba(16,185,129,0.5)'
                : '0 0 16px rgba(97,215,201,0.4)',
              transition: 'all 0.25s ease',
            }}
          >
            {isSavedRecently ? <CheckCircle2 size={17} /> : <Save size={17} />}
            <span>{isSavedRecently ? 'Configuration Saved ✓' : 'Save JARVIS Configuration'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ADD NEW CUSTOM AGENT */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'grid',
            placeItems: 'center',
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '620px',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(12, 28, 48, 0.98) 0%, rgba(18, 20, 56, 0.98) 100%)',
              border: '1.5px solid rgba(97, 215, 201, 0.5)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(97,215,201,0.3)',
              padding: '28px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '26px' }}>{newAgentIcon}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '19px', fontWeight: 800, color: '#fff' }}>
                    Create New JARVIS Agent
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                    Define specialized intelligence tasks and route them inside the pipeline
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  fontSize: '20px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {newAgentFormError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(244,63,94,0.15)',
                  border: '1px solid rgba(244,63,94,0.4)',
                  color: '#fb7185',
                  fontSize: '12px',
                  fontWeight: 600,
                  marginBottom: '16px',
                }}
              >
                {newAgentFormError}
              </div>
            )}

            <div style={{ display: 'grid', gap: '16px' }}>
              {/* Agent Name & Icon */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontFamily: 'DM Mono', color: 'var(--accent)', marginBottom: '6px' }}>
                    AGENT NAME *
                  </label>
                  <input
                    type="text"
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    placeholder="e.g. Code Architect, Security Auditor, Creative Explainer"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(6,16,24,0.85)',
                      border: '1px solid rgba(165,207,214,0.25)',
                      color: '#fff',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontFamily: 'DM Mono', color: 'var(--accent)', marginBottom: '6px' }}>
                    ICON
                  </label>
                  <select
                    value={newAgentIcon}
                    onChange={(e) => setNewAgentIcon(e.target.value)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'rgba(6,16,24,0.85)',
                      border: '1px solid rgba(165,207,214,0.25)',
                      color: '#fff',
                      fontSize: '16px',
                      cursor: 'pointer',
                    }}
                  >
                    {EMOJI_OPTIONS.map((emoji) => (
                      <option key={emoji} value={emoji}>
                        {emoji}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Agent Role / Purpose */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontFamily: 'DM Mono', color: 'var(--accent)', marginBottom: '6px' }}>
                  DESCRIPTION / PURPOSE
                </label>
                <input
                  type="text"
                  value={newAgentDescription}
                  onChange={(e) => setNewAgentDescription(e.target.value)}
                  placeholder="e.g. Audits software architecture, reviews security patterns, and drafts clean code"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(6,16,24,0.85)',
                    border: '1px solid rgba(165,207,214,0.25)',
                    color: '#e2e8f0',
                    fontSize: '13px',
                  }}
                />
              </div>

              {/* System Prompt */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontFamily: 'DM Mono', color: 'var(--accent)', marginBottom: '6px' }}>
                  CUSTOM SYSTEM PROMPT (WHAT IT SHOULD DO) *
                </label>
                <textarea
                  value={newAgentPrompt}
                  onChange={(e) => setNewAgentPrompt(e.target.value)}
                  rows={5}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'rgba(3,8,14,0.95)',
                    border: '1px solid rgba(97,215,201,0.3)',
                    color: '#e2e8f0',
                    fontSize: '12px',
                    fontFamily: 'DM Mono, monospace',
                    lineHeight: 1.6,
                  }}
                  placeholder="Write clear instructions for this agent..."
                />
              </div>

              {/* Provider & Model */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontFamily: 'DM Mono', color: 'var(--accent)', marginBottom: '6px' }}>
                    AI PROVIDER
                  </label>
                  <select
                    value={newAgentProviderId}
                    onChange={(e) => {
                      const pId = e.target.value;
                      const prov = providersState.providers.find((p) => p.id === pId);
                      setNewAgentProviderId(pId);
                      if (prov) setNewAgentModelId(prov.model);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(6,16,24,0.85)',
                      border: '1px solid rgba(165,207,214,0.25)',
                      color: '#e7eef2',
                      fontSize: '12px',
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
                  <label style={{ display: 'block', fontSize: '11px', fontFamily: 'DM Mono', color: 'var(--accent)', marginBottom: '6px' }}>
                    MODEL IDENTIFIER
                  </label>
                  <input
                    type="text"
                    value={newAgentModelId}
                    onChange={(e) => setNewAgentModelId(e.target.value)}
                    placeholder="deepseek/deepseek-chat"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(6,16,24,0.85)',
                      border: '1px solid rgba(165,207,214,0.25)',
                      color: '#e7eef2',
                      fontSize: '12px',
                      fontFamily: 'DM Mono',
                    }}
                  />
                </div>
              </div>

              {/* Pipeline Position */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontFamily: 'DM Mono', color: 'var(--accent)', marginBottom: '6px' }}>
                  PIPELINE EXECUTION POSITION
                </label>
                <select
                  value={newAgentPipelinePos}
                  onChange={(e) => setNewAgentPipelinePos(e.target.value as CustomAgentPipelinePosition)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(6,16,24,0.85)',
                    border: '1px solid rgba(165,207,214,0.25)',
                    color: '#e7eef2',
                    fontSize: '13px',
                  }}
                >
                  <option value="before_synthesizer">Before Final Synthesizer (Recommended - Injects specialized insights)</option>
                  <option value="parallel_research">Parallel with Research (Executes early alongside web search)</option>
                  <option value="extra_step">Dedicated Pre-Synthesis Step</option>
                  <option value="after_synthesizer">Post-Synthesizer Refinement</option>
                </select>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                  {PIPELINE_POSITION_LABELS[newAgentPipelinePos]?.desc}
                </p>
              </div>

              {/* Max Tokens Slider & Enable Toggle */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label style={{ fontSize: '11px', fontFamily: 'DM Mono', color: 'var(--accent)' }}>
                      MAX OUTPUT TOKENS
                    </label>
                    <span style={{ fontSize: '11px', fontFamily: 'DM Mono', color: 'var(--muted)' }}>
                      {newAgentMaxTokens} tokens
                    </span>
                  </div>
                  <input
                    type="range"
                    min={64}
                    max={1500}
                    step={32}
                    value={newAgentMaxTokens}
                    onChange={(e) => setNewAgentMaxTokens(parseInt(e.target.value, 10))}
                    style={{ width: '100%', accentColor: 'var(--accent)' }}
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#fff', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={newAgentEnabled}
                    onChange={(e) => setNewAgentEnabled(e.target.checked)}
                    style={{ accentColor: 'var(--accent)', transform: 'scale(1.2)' }}
                  />
                  Enable on Creation
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'var(--text)',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateCustomAgent}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #61d7c9 0%, #38bdf8 100%)',
                  color: '#051218',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 0 16px rgba(97,215,201,0.35)',
                }}
              >
                Add Agent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RESET ALL TO FACTORY DEFAULTS CONFIRMATION */}
      {/* ========================================================================= */}
      {showResetConfirmModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowResetConfirmModal(false);
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '480px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(28, 14, 24, 0.98) 0%, rgba(36, 12, 28, 0.98) 100%)',
              border: '1.5px solid rgba(244, 63, 94, 0.5)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(244,63,94,0.3)',
              padding: '28px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(244,63,94,0.15)',
                border: '1px solid rgba(244,63,94,0.4)',
                display: 'grid',
                placeItems: 'center',
                color: '#fb7185',
                margin: '0 auto 16px',
              }}
            >
              <RotateCcw size={28} />
            </div>

            <h3 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 800, color: '#fff' }}>
              Reset All JARVIS Configurations?
            </h3>
            <p style={{ margin: '0 0 20px', color: '#cbd5e1', fontSize: '13px', lineHeight: 1.6 }}>
              This master reset will:
              <br />
              • Restore all 5 core agents (Planner, Researcher, Fact Checker, Reviewer, Synthesizer) to their original default system prompts.
              <br />
              • Reset all models and token limits to defaults.
              <br />
              • Remove all custom agents.
              <br />
              <strong>This action cannot be undone.</strong>
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={executeResetAll}
                style={{
                  padding: '10px 24px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 0 16px rgba(244,63,94,0.4)',
                }}
              >
                Yes, Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
