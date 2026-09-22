/**
 * JARVIS Reasoning Configuration Matrix
 * Provider-aware, extensible reasoning control for multi-agent execution.
 */

export type ReasoningEffortLevel = 'none' | 'low' | 'medium' | 'high';
export type ReasoningTargetLevel = 'low' | 'high'; // 'low' = disable / lowest effort; 'high' = high effort

export type ReasoningParamFormat = 'flat_groq' | 'openrouter_nested' | 'custom';

export interface ReasoningModelSpec {
  provider: string; // Normalized provider ID (e.g. 'groq', 'openrouter')
  model: string; // Model ID (e.g. 'qwen/qwen3.8-27b')
  supportsReasoning: boolean;
  paramFormat: ReasoningParamFormat;
  validEfforts: ReasoningEffortLevel[];
  supportsFullDisable: boolean; // True if 'none' or enabled: false is supported
  supportsHiddenFormat?: boolean; // True if reasoning_format: "hidden" is supported
  /**
   * Function to build the exact parameter payload to merge into the request body
   */
  buildParams: (target: ReasoningTargetLevel) => Record<string, unknown>;
}

/**
 * REASONING_MODEL_CONFIG Map
 * Key format: `${provider}:${model.toLowerCase()}`
 * Extensible: Add a single entry here to support reasoning on any new model/provider.
 */
export const REASONING_MODEL_CONFIG: Record<string, ReasoningModelSpec> = {
  // Groq qwen/qwen3.8-27b: flat reasoning_effort param (none/low/medium/high); supports full disable via none
  'groq:qwen/qwen3.8-27b': {
    provider: 'groq',
    model: 'qwen/qwen3.8-27b',
    supportsReasoning: true,
    paramFormat: 'flat_groq',
    validEfforts: ['none', 'low', 'medium', 'high'],
    supportsFullDisable: true,
    supportsHiddenFormat: false,
    buildParams: (target: ReasoningTargetLevel) => ({
      reasoning_effort: target === 'high' ? 'high' : 'none',
    }),
  },

  // Groq openai/gpt-oss-120b: flat reasoning_effort param (low/medium/high only, NO none); supports reasoning_format: "hidden"
  'groq:openai/gpt-oss-120b': {
    provider: 'groq',
    model: 'openai/gpt-oss-120b',
    supportsReasoning: true,
    paramFormat: 'flat_groq',
    validEfforts: ['low', 'medium', 'high'],
    supportsFullDisable: false,
    supportsHiddenFormat: true,
    buildParams: (target: ReasoningTargetLevel) => ({
      reasoning_effort: target === 'high' ? 'high' : 'low',
      reasoning_format: 'hidden',
    }),
  },

  // Groq openai/gpt-oss-20b: flat reasoning_effort param (low/medium/high only, NO none); supports reasoning_format: "hidden"
  'groq:openai/gpt-oss-20b': {
    provider: 'groq',
    model: 'openai/gpt-oss-20b',
    supportsReasoning: true,
    paramFormat: 'flat_groq',
    validEfforts: ['low', 'medium', 'high'],
    supportsFullDisable: false,
    supportsHiddenFormat: true,
    buildParams: (target: ReasoningTargetLevel) => ({
      reasoning_effort: target === 'high' ? 'high' : 'low',
      reasoning_format: 'hidden',
    }),
  },

  // OpenRouter nvidia/nemotron-3-super-120b-a12b:free: nested reasoning: { enabled: boolean, effort: "low"|"medium"|"high" }
  'openrouter:nvidia/nemotron-3-super-120b-a12b:free': {
    provider: 'openrouter',
    model: 'nvidia/nemotron-3-super-120b-a12b:free',
    supportsReasoning: true,
    paramFormat: 'openrouter_nested',
    validEfforts: ['low', 'medium', 'high'],
    supportsFullDisable: true,
    supportsHiddenFormat: false,
    buildParams: (target: ReasoningTargetLevel) => ({
      reasoning: {
        enabled: target === 'high',
        effort: target === 'high' ? 'high' : 'low',
      },
    }),
  },
};

/**
 * Normalizes provider identifier from a provider config, URL, or string ID.
 */
export function normalizeProviderId(
  provider: { id?: string; name?: string; url?: string } | string | null | undefined,
): string {
  if (!provider) return 'unknown';
  if (typeof provider === 'string') {
    const s = provider.toLowerCase().trim();
    if (s.includes('groq')) return 'groq';
    if (s.includes('openrouter')) return 'openrouter';
    if (s.includes('deepseek')) return 'deepseek';
    if (s.includes('openai')) return 'openai';
    if (s.includes('anthropic')) return 'anthropic';
    return s;
  }

  const url = (provider.url || '').toLowerCase();
  const id = (provider.id || '').toLowerCase();
  const name = (provider.name || '').toLowerCase();

  if (url.includes('groq.com') || id.includes('groq') || name.includes('groq')) {
    return 'groq';
  }
  if (url.includes('openrouter.ai') || id.includes('openrouter') || name.includes('openrouter')) {
    return 'openrouter';
  }
  if (url.includes('deepseek.com') || id.includes('deepseek') || name.includes('deepseek')) {
    return 'deepseek';
  }
  if (url.includes('openai.com') || id.includes('openai') || name.includes('openai')) {
    return 'openai';
  }
  if (url.includes('anthropic.com') || id.includes('anthropic') || name.includes('anthropic')) {
    return 'anthropic';
  }

  return id || name || 'custom';
}

/**
 * Normalizes model identifier by lowercasing and trimming.
 */
export function normalizeModelId(model: string | null | undefined): string {
  return (model || '').trim().toLowerCase();
}

/**
 * Looks up reasoning configuration for a provider and model.
 * Returns null if the model/provider does not support reasoning or is not registered.
 */
export function lookupReasoningConfig(
  provider: { id?: string; name?: string; url?: string } | string | null | undefined,
  model: string | null | undefined,
): ReasoningModelSpec | null {
  if (!model) return null;
  const provKey = normalizeProviderId(provider);
  const normModel = normalizeModelId(model);

  // Exact match
  const directKey = `${provKey}:${normModel}`;
  if (REASONING_MODEL_CONFIG[directKey]) {
    return REASONING_MODEL_CONFIG[directKey];
  }

  // Raw model match (in case of specific case sensitivity)
  const rawKey = `${provKey}:${(model || '').trim()}`;
  if (REASONING_MODEL_CONFIG[rawKey]) {
    return REASONING_MODEL_CONFIG[rawKey];
  }

  return null;
}

/**
 * Determines an agent's or caller's desired reasoning level:
 * - If explicitly 'low' or 'high', returns that level directly.
 * - Coder, Architect, Data Analyst = 'high' (high reasoning effort)
 * - Planner, Researcher, Fact Checker, Advisor, Reviewer, Synthesizer, Image Finder, dynamic specialists, Multi Chat personas (NOVA/ORBIT/COSMOS), AI Assistant, Parallax 20-agent swarm = 'low' (disable / lowest effort)
 */
export function getAgentDesiredReasoningLevel(
  agentOrTargetLevel?: { id?: string; name?: string } | string | ReasoningTargetLevel | null,
): ReasoningTargetLevel {
  if (!agentOrTargetLevel) return 'low';
  if (agentOrTargetLevel === 'low' || agentOrTargetLevel === 'high') {
    return agentOrTargetLevel;
  }
  const agentId = (typeof agentOrTargetLevel === 'string' ? agentOrTargetLevel : agentOrTargetLevel.id || '').toLowerCase().trim();
  const agentName = (typeof agentOrTargetLevel === 'object' && agentOrTargetLevel.name ? agentOrTargetLevel.name : '').toLowerCase().trim();

  // High effort agents: Coder, Architect, Data Analyst
  if (
    agentId === 'coder' ||
    agentId === 'architect' ||
    agentId === 'dataanalyst' ||
    agentId === 'data_analyst' ||
    agentName.includes('coder') ||
    agentName.includes('architect') ||
    agentName.includes('data analyst')
  ) {
    return 'high';
  }

  // All other agents / callers (Planner, Researcher, Fact Checker, Advisor, Reviewer, Synthesizer, Image Finder, Dynamic Specialists, Multi Chat personas, AI Assistant, Parallax personas) = lowest effort / disabled
  return 'low';
}

/**
 * Applies reasoning configuration parameters to a provider config.
 * If the model/provider is NOT in the config map, no parameters are added.
 */
export function applyReasoningConfig<T extends { extraParams?: Record<string, unknown>; reasoningParams?: Record<string, unknown>; model?: string; id?: string; name?: string; url?: string }>(
  provider: T,
  agentOrTargetLevel?: { id?: string; name?: string } | string | ReasoningTargetLevel | null,
  modelOverride?: string,
): {
  config: T;
  spec: ReasoningModelSpec | null;
  params: Record<string, unknown> | null;
  desiredLevel: ReasoningTargetLevel;
} {
  const desiredLevel = getAgentDesiredReasoningLevel(agentOrTargetLevel);
  const effectiveModel = modelOverride || provider.model;
  const spec = lookupReasoningConfig(provider, effectiveModel);

  if (!spec || !spec.supportsReasoning) {
    return {
      config: provider,
      spec: null,
      params: null,
      desiredLevel,
    };
  }

  const params = spec.buildParams(desiredLevel);
  const updatedConfig: T = {
    ...provider,
    extraParams: {
      ...(provider.extraParams || {}),
      ...params,
    },
    reasoningParams: {
      ...(provider.reasoningParams || {}),
      ...params,
    },
  };

  return {
    config: updatedConfig,
    spec,
    params,
    desiredLevel,
  };
}
