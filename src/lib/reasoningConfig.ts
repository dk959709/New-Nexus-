/**
 * JARVIS Reasoning Configuration Matrix
 * Provider-aware, extensible reasoning control for multi-agent execution.
 */

export type ReasoningEffortLevel = 'none' | 'low' | 'medium' | 'high';
export type ReasoningTargetLevel = 'low' | 'high'; // 'low' = disable / lowest effort; 'high' = high effort

export type ReasoningParamFormat = 'flat_groq' | 'openrouter_nested' | 'custom';

export interface ReasoningModelSpec {
  provider: string; // Normalized provider ID (e.g. 'groq', 'openrouter', 'huggingface', 'cloudflare')
  model: string; // Model ID (e.g. 'qwen/qwen3.8-27b')
  supportsReasoning: boolean;
  paramFormat: ReasoningParamFormat;
  validEfforts: ReasoningEffortLevel[];
  supportsFullDisable: boolean; // True if 'none' or enabled: false is supported
  supportsHiddenFormat?: boolean; // True if reasoning_format: "hidden" is supported
  supportsIncludeReasoning?: boolean; // True if include_reasoning: false is supported
  isGenericFallback?: boolean; // True if resolved via generic provider fallback
  isGroqSuffixSpecialCase?: boolean; // True if resolved via Hugging Face :groq suffix special case
  isKnownProviderPrefixSpecialCase?: boolean; // True if resolved via Cloudflare AI Gateway known provider prefix
  isDualMechanismWorkersAi?: boolean; // True if resolved via generic dual-mechanism fallback for Workers AI (@cf/ models)
  matchedProvider?: string; // Name of the underlying matched provider (e.g. 'groq', 'bazaarlink', 'openrouter')
  /**
   * Function to build the exact parameter payload to merge into the request body
   */
  buildParams: (target: ReasoningTargetLevel) => Record<string, unknown>;
}

/**
 * Non-chat models (e.g. music/audio generation) that should never be assigned reasoning params or chat roles.
 */
export const NON_CHAT_MODELS = new Set([
  'google/lyria-3-pro-preview',
  'google/lyria-3-clip-preview',
]);

/**
 * REASONING_MODEL_CONFIG Map
 * Key format: `${provider}:${model.toLowerCase()}`
 * Extensible: Add a single entry here to support reasoning on any new model/provider.
 */
export const REASONING_MODEL_CONFIG: Record<string, ReasoningModelSpec> = {
  // Cloudflare Workers AI @cf/nvidia/nemotron-3-120b-a12b: reasoning_effort: "low" for fast roles, "high" for Coder/Architect/Data Analyst (no "none" support per Cloudflare docs)
  'cloudflare:@cf/nvidia/nemotron-3-120b-a12b': {
    provider: 'cloudflare',
    model: '@cf/nvidia/nemotron-3-120b-a12b',
    supportsReasoning: true,
    paramFormat: 'flat_groq',
    validEfforts: ['low', 'medium', 'high'],
    supportsFullDisable: false,
    supportsHiddenFormat: false,
    buildParams: (target: ReasoningTargetLevel) => ({
      reasoning_effort: target === 'high' ? 'high' : 'low',
    }),
  },
  // Groq qwen/qwen3.8-27b: flat reasoning_effort param (none/low/medium/high); supports full disable via none; supports reasoning_format: "hidden"
  'groq:qwen/qwen3.8-27b': {
    provider: 'groq',
    model: 'qwen/qwen3.8-27b',
    supportsReasoning: true,
    paramFormat: 'flat_groq',
    validEfforts: ['none', 'low', 'medium', 'high'],
    supportsFullDisable: true,
    supportsHiddenFormat: true,
    buildParams: (target: ReasoningTargetLevel) => ({
      reasoning_effort: target === 'high' ? 'high' : 'none',
      reasoning_format: 'hidden',
    }),
  },

  // Groq openai/gpt-oss-120b: flat reasoning_effort param (low/medium/high only, NO none); supports include_reasoning: false
  'groq:openai/gpt-oss-120b': {
    provider: 'groq',
    model: 'openai/gpt-oss-120b',
    supportsReasoning: true,
    paramFormat: 'flat_groq',
    validEfforts: ['low', 'medium', 'high'],
    supportsFullDisable: false,
    supportsHiddenFormat: false,
    supportsIncludeReasoning: true,
    buildParams: (target: ReasoningTargetLevel) => ({
      reasoning_effort: target === 'high' ? 'high' : 'low',
      include_reasoning: false,
    }),
  },

  // Groq openai/gpt-oss-20b: flat reasoning_effort param (low/medium/high only, NO none); supports include_reasoning: false
  'groq:openai/gpt-oss-20b': {
    provider: 'groq',
    model: 'openai/gpt-oss-20b',
    supportsReasoning: true,
    paramFormat: 'flat_groq',
    validEfforts: ['low', 'medium', 'high'],
    supportsFullDisable: false,
    supportsHiddenFormat: false,
    supportsIncludeReasoning: true,
    buildParams: (target: ReasoningTargetLevel) => ({
      reasoning_effort: target === 'high' ? 'high' : 'low',
      include_reasoning: false,
    }),
  },

  // BazaarLink qwen/qwen3.7-flash:free: flat reasoning_effort string param ("low", "medium", "high" per BazaarLink docs); "low" is default first attempt for fast/disabled roles
  'bazaarlink:qwen/qwen3.7-flash:free': {
    provider: 'bazaarlink',
    model: 'qwen/qwen3.7-flash:free',
    supportsReasoning: true,
    paramFormat: 'flat_groq',
    validEfforts: ['low', 'medium', 'high'],
    supportsFullDisable: false,
    supportsHiddenFormat: false,
    buildParams: (target: ReasoningTargetLevel) => ({
      reasoning_effort: target === 'high' ? 'high' : 'low',
    }),
  },

  // OpenRouter nvidia/nemotron-3-super-120b-a12b:free: nested reasoning: { effort: "none" } or { effort: "high", exclude: true }
  'openrouter:nvidia/nemotron-3-super-120b-a12b:free': {
    provider: 'openrouter',
    model: 'nvidia/nemotron-3-super-120b-a12b:free',
    supportsReasoning: true,
    paramFormat: 'openrouter_nested',
    validEfforts: ['none', 'low', 'medium', 'high'],
    supportsFullDisable: true,
    supportsHiddenFormat: false,
    buildParams: (target: ReasoningTargetLevel) => ({
      reasoning: target === 'high'
        ? { effort: 'high', exclude: true }
        : { effort: 'none' },
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
    if (s.includes('groq') || s.includes('api.groq.com')) return 'groq';
    if (
      s.includes('bazaarlink') ||
      s.includes('api.bazaarlink.ai') ||
      s.includes('bazaarlink.ai/api') ||
      s.includes('bazaarlink.ai')
    ) return 'bazaarlink';
    if (s.includes('openrouter')) return 'openrouter';
    if (
      s.includes('router.huggingface.co') ||
      s.includes('huggingface') ||
      s.includes('hf.co') ||
      s === 'hf'
    ) return 'huggingface';
    if (
      s.includes('gateway.ai.cloudflare.com') ||
      s.includes('cloudflare') ||
      s.includes('cf-gateway') ||
      s.includes('ai-gateway')
    ) return 'cloudflare';
    if (s.includes('ollama.com') || s.includes('ollama') || s.includes('11434')) return 'ollama';
    if (
      s.includes('google') ||
      s.includes('gemini') ||
      s.includes('generativelanguage.googleapis.com') ||
      s.includes('ai.google.dev')
    ) return 'google';
    if (s.includes('deepseek')) return 'deepseek';
    if (s.includes('openai')) return 'openai';
    if (s.includes('anthropic')) return 'anthropic';
    return s;
  }

  const url = (provider.url || '').toLowerCase();
  const id = (provider.id || '').toLowerCase();
  const name = (provider.name || '').toLowerCase();

  if (
    url.includes('bazaarlink.ai') ||
    url.includes('api.bazaarlink.ai') ||
    url.includes('bazaarlink.ai/api') ||
    id.includes('bazaarlink') ||
    name.includes('bazaarlink')
  ) {
    return 'bazaarlink';
  }
  if (url.includes('groq.com') || url.includes('api.groq.com') || id.includes('groq') || name.includes('groq')) {
    return 'groq';
  }
  if (url.includes('openrouter.ai') || id.includes('openrouter') || name.includes('openrouter')) {
    return 'openrouter';
  }
  if (
    url.includes('router.huggingface.co') ||
    url.includes('huggingface.co') ||
    url.includes('hf.co') ||
    id.includes('huggingface') ||
    id.includes('hf') ||
    name.includes('huggingface')
  ) {
    return 'huggingface';
  }
  if (
    url.includes('gateway.ai.cloudflare.com') ||
    url.includes('cloudflare.com') ||
    id.includes('cloudflare') ||
    id.includes('cf-gateway') ||
    id.includes('ai-gateway') ||
    name.includes('cloudflare') ||
    name.includes('ai gateway')
  ) {
    return 'cloudflare';
  }
  if (
    url.includes('generativelanguage.googleapis.com') ||
    url.includes('ai.google.dev') ||
    url.includes('googleapis.com') ||
    id.includes('google') ||
    id.includes('gemini') ||
    name.includes('google') ||
    name.includes('gemini')
  ) {
    return 'google';
  }
  if (
    url.includes('ollama.com') ||
    url.includes('11434') ||
    id.includes('ollama') ||
    name.includes('ollama')
  ) {
    return 'ollama';
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
 * - Explicit entry check first (like nvidia/nemotron-3-super-120b-a12b:free)
 * - Excludes non-chat models (google/lyria-3-pro-preview, google/lyria-3-clip-preview)
 * - Generic OpenRouter provider-level fallback for any OpenRouter chat model not explicitly listed
 * Returns null if the model/provider does not support reasoning or is not registered.
 */
export function lookupReasoningConfig(
  provider: { id?: string; name?: string; url?: string } | string | null | undefined,
  model: string | null | undefined,
): ReasoningModelSpec | null {
  if (!model) return null;
  const provKey = normalizeProviderId(provider);
  const normModel = normalizeModelId(model);

  // Exclude non-chat / music generation models
  if (
    NON_CHAT_MODELS.has(normModel) ||
    normModel.includes('lyria-3-pro-preview') ||
    normModel.includes('lyria-3-clip-preview')
  ) {
    console.warn(
      `[Reasoning Control Warning] Non-chat music model "${model}" selected for agent role. Reasoning parameters skipped and model marked incompatible for chat/reasoning.`,
    );
    return null;
  }

  // 1. Exact match in explicit config map
  const directKey = `${provKey}:${normModel}`;
  if (REASONING_MODEL_CONFIG[directKey]) {
    return REASONING_MODEL_CONFIG[directKey];
  }

  // 2. Raw model match in explicit config map
  const rawKey = `${provKey}:${(model || '').trim()}`;
  if (REASONING_MODEL_CONFIG[rawKey]) {
    return REASONING_MODEL_CONFIG[rawKey];
  }

  // 3. Generic BazaarLink provider fallback (applies to ANY BazaarLink chat model not explicitly listed)
  if (provKey === 'bazaarlink') {
    return {
      provider: 'bazaarlink',
      model: (model || '').trim(),
      supportsReasoning: true,
      paramFormat: 'flat_groq',
      validEfforts: ['low', 'medium', 'high'],
      supportsFullDisable: false,
      supportsHiddenFormat: false,
      isGenericFallback: true,
      buildParams: (target: ReasoningTargetLevel) => ({
        reasoning_effort: target === 'high' ? 'high' : 'low',
      }),
    };
  }

  // 4. Generic Groq provider fallback (applies to ANY Groq chat model not explicitly listed)
  if (provKey === 'groq') {
    return {
      provider: 'groq',
      model: (model || '').trim(),
      supportsReasoning: true,
      paramFormat: 'flat_groq',
      validEfforts: ['none', 'low', 'medium', 'high'],
      supportsFullDisable: true,
      supportsHiddenFormat: false,
      isGenericFallback: true,
      buildParams: (target: ReasoningTargetLevel) => ({
        reasoning_effort: target === 'high' ? 'high' : 'none',
      }),
    };
  }

  // 5. Generic OpenRouter provider fallback (applies to ANY OpenRouter chat model not explicitly listed)
  // Note: OpenRouter's /api/v1/models endpoint can report per-model reasoning.supported_efforts and whether reasoning is mandatory for that model.
  // If a future model has reasoning marked mandatory (cannot be disabled), the generic fallback should gracefully fall back to just { exclude: true } instead of attempting effort: "none", to avoid a possible rejection.
  if (provKey === 'openrouter') {
    return {
      provider: 'openrouter',
      model: (model || '').trim(),
      supportsReasoning: true,
      paramFormat: 'openrouter_nested',
      validEfforts: ['none', 'low', 'medium', 'high'],
      supportsFullDisable: true,
      supportsHiddenFormat: false,
      isGenericFallback: true,
      buildParams: (target: ReasoningTargetLevel) => ({
        reasoning: target === 'high'
          ? { effort: 'high', exclude: true }
          : { effort: 'none' },
      }),
    };
  }

  // 5b. Generic Google Gemini provider fallback (generativelanguage.googleapis.com)
  if (provKey === 'google' || normModel.startsWith('gemini-') || normModel.includes('gemini')) {
    return {
      provider: 'google',
      model: (model || '').trim(),
      supportsReasoning: true,
      paramFormat: 'flat_groq',
      validEfforts: ['none', 'low', 'medium', 'high'],
      supportsFullDisable: true,
      supportsHiddenFormat: false,
      isGenericFallback: true,
      buildParams: (target: ReasoningTargetLevel) => ({
        reasoning_effort: target === 'high' ? 'high' : target === 'off' ? 'none' : 'low',
      }),
    };
  }

  // 6. Hugging Face Router fallback (applies to HF router endpoints e.g. router.huggingface.co)
  if (provKey === 'huggingface') {
    const isGroqBackend = normModel.endsWith(':groq') || normModel.includes(':groq');

    // Special-case models routed to Groq backend on Hugging Face (:groq suffix)
    if (isGroqBackend) {
      const baseModel = normModel.replace(/:groq$/, '').trim();
      const isGptOss = baseModel.includes('gpt-oss') || baseModel.includes('gpt_oss');
      const isQwen38 = baseModel.includes('qwen3.8') || baseModel.includes('qwen/qwen3.8-27b');

      if (isGptOss) {
        return {
          provider: 'huggingface',
          model: (model || '').trim(),
          supportsReasoning: true,
          paramFormat: 'flat_groq',
          validEfforts: ['low', 'medium', 'high'],
          supportsFullDisable: false,
          supportsHiddenFormat: false,
          supportsIncludeReasoning: true,
          isGroqSuffixSpecialCase: true,
          buildParams: (target: ReasoningTargetLevel) => ({
            reasoning_effort: target === 'high' ? 'high' : 'low',
            include_reasoning: false,
          }),
        };
      }

      if (isQwen38) {
        return {
          provider: 'huggingface',
          model: (model || '').trim(),
          supportsReasoning: true,
          paramFormat: 'flat_groq',
          validEfforts: ['none', 'low', 'medium', 'high'],
          supportsFullDisable: true,
          supportsHiddenFormat: true,
          isGroqSuffixSpecialCase: true,
          buildParams: (target: ReasoningTargetLevel) => ({
            reasoning_effort: target === 'high' ? 'high' : 'none',
            reasoning_format: 'hidden',
          }),
        };
      }

      return {
        provider: 'huggingface',
        model: (model || '').trim(),
        supportsReasoning: true,
        paramFormat: 'flat_groq',
        validEfforts: ['none', 'low', 'medium', 'high'],
        supportsFullDisable: true,
        supportsHiddenFormat: false,
        isGroqSuffixSpecialCase: true,
        buildParams: (target: ReasoningTargetLevel) => ({
          reasoning_effort: target === 'high' ? 'high' : 'none',
        }),
      };
    }

    // Generic Hugging Face backend fallback (pass-through best effort)
    return {
      provider: 'huggingface',
      model: (model || '').trim(),
      supportsReasoning: true,
      paramFormat: 'flat_groq',
      validEfforts: ['none', 'low', 'medium', 'high'],
      supportsFullDisable: true,
      supportsHiddenFormat: false,
      isGenericFallback: true,
      buildParams: (target: ReasoningTargetLevel) => ({
        reasoning_effort: target === 'high' ? 'high' : 'none',
      }),
    };
  }

  // 7. Cloudflare AI Gateway & Workers AI fallback (applies to gateway.ai.cloudflare.com or @cf/ models)
  if (provKey === 'cloudflare' || normModel.startsWith('@cf/') || normModel.includes('@cf/')) {
    // Check if the model is a Workers AI (@cf/) model not explicitly listed in REASONING_MODEL_CONFIG
    if (normModel.startsWith('@cf/') || normModel.includes('@cf/')) {
      return {
        provider: 'cloudflare',
        model: (model || '').trim(),
        supportsReasoning: true,
        paramFormat: 'flat_groq',
        validEfforts: ['low', 'medium', 'high'],
        supportsFullDisable: false,
        supportsHiddenFormat: false,
        isGenericFallback: true,
        isDualMechanismWorkersAi: true,
        buildParams: (target: ReasoningTargetLevel) => ({
          reasoning_effort: target === 'high' ? 'high' : 'low',
          ...(target === 'high' ? {} : { chat_template_kwargs: { enable_thinking: false } }),
        }),
      };
    }

    // Check if the model string indicates a known underlying provider (e.g. groq/, bazaarlink/, openrouter/)
    const hasGroqPrefix = normModel.startsWith('groq/') || normModel.includes('/groq/') || normModel.includes('groq:');
    const hasBazaarLinkPrefix = normModel.startsWith('bazaarlink/') || normModel.includes('/bazaarlink/');
    const hasOpenRouterPrefix = normModel.startsWith('openrouter/') || normModel.includes('/openrouter/');

    if (hasGroqPrefix) {
      const strippedModel = normModel.replace(/^groq\//, '').replace(/^.*\/groq\//, '').trim();
      const isGptOss = strippedModel.includes('gpt-oss') || strippedModel.includes('gpt_oss');
      const isQwen38 = strippedModel.includes('qwen3.8') || strippedModel.includes('qwen/qwen3.8-27b');

      if (isGptOss) {
        return {
          provider: 'cloudflare',
          model: (model || '').trim(),
          supportsReasoning: true,
          paramFormat: 'flat_groq',
          validEfforts: ['low', 'medium', 'high'],
          supportsFullDisable: false,
          supportsHiddenFormat: false,
          supportsIncludeReasoning: true,
          isKnownProviderPrefixSpecialCase: true,
          matchedProvider: 'groq (gpt-oss)',
          buildParams: (target: ReasoningTargetLevel) => ({
            reasoning_effort: target === 'high' ? 'high' : 'low',
            include_reasoning: false,
          }),
        };
      }

      if (isQwen38) {
        return {
          provider: 'cloudflare',
          model: (model || '').trim(),
          supportsReasoning: true,
          paramFormat: 'flat_groq',
          validEfforts: ['none', 'low', 'medium', 'high'],
          supportsFullDisable: true,
          supportsHiddenFormat: true,
          isKnownProviderPrefixSpecialCase: true,
          matchedProvider: 'groq (qwen3.8)',
          buildParams: (target: ReasoningTargetLevel) => ({
            reasoning_effort: target === 'high' ? 'high' : 'none',
            reasoning_format: 'hidden',
          }),
        };
      }

      return {
        provider: 'cloudflare',
        model: (model || '').trim(),
        supportsReasoning: true,
        paramFormat: 'flat_groq',
        validEfforts: ['none', 'low', 'medium', 'high'],
        supportsFullDisable: true,
        supportsHiddenFormat: false,
        isKnownProviderPrefixSpecialCase: true,
        matchedProvider: 'groq',
        buildParams: (target: ReasoningTargetLevel) => ({
          reasoning_effort: target === 'high' ? 'high' : 'none',
        }),
      };
    }

    if (hasBazaarLinkPrefix) {
      return {
        provider: 'cloudflare',
        model: (model || '').trim(),
        supportsReasoning: true,
        paramFormat: 'flat_groq',
        validEfforts: ['low', 'medium', 'high'],
        supportsFullDisable: false,
        supportsHiddenFormat: false,
        isKnownProviderPrefixSpecialCase: true,
        matchedProvider: 'bazaarlink',
        buildParams: (target: ReasoningTargetLevel) => ({
          reasoning_effort: target === 'high' ? 'high' : 'low',
        }),
      };
    }

    if (hasOpenRouterPrefix) {
      return {
        provider: 'cloudflare',
        model: (model || '').trim(),
        supportsReasoning: true,
        paramFormat: 'openrouter_nested',
        validEfforts: ['none', 'low', 'medium', 'high'],
        supportsFullDisable: true,
        supportsHiddenFormat: false,
        isKnownProviderPrefixSpecialCase: true,
        matchedProvider: 'openrouter',
        buildParams: (target: ReasoningTargetLevel) => ({
          reasoning: target === 'high'
            ? { effort: 'high', exclude: true }
            : { effort: 'none' },
        }),
      };
    }

    // Generic Cloudflare AI Gateway fallback rule: flat reasoning_effort ("none" for fast/disabled, "high" for Coder/Architect/Data Analyst)
    return {
      provider: 'cloudflare',
      model: (model || '').trim(),
      supportsReasoning: true,
      paramFormat: 'flat_groq',
      validEfforts: ['none', 'low', 'medium', 'high'],
      supportsFullDisable: true,
      supportsHiddenFormat: false,
      isGenericFallback: true,
      buildParams: (target: ReasoningTargetLevel) => ({
        reasoning_effort: target === 'high' ? 'high' : 'none',
      }),
    };
  }

  // 8. Generic Ollama provider fallback (applies to ANY Ollama chat model e.g. ollama.com/v1/chat/completions)
  if (provKey === 'ollama') {
    return {
      provider: 'ollama',
      model: (model || '').trim(),
      supportsReasoning: true,
      paramFormat: 'flat_groq',
      validEfforts: ['none', 'low', 'medium', 'high'],
      supportsFullDisable: true,
      supportsHiddenFormat: false,
      isGenericFallback: true,
      buildParams: (target: ReasoningTargetLevel) => ({
        reasoning_effort: target === 'high' ? 'high' : 'none',
      }),
    };
  }

  return null;
}

export type ReasoningOverrideMode = 'auto' | 'force_on' | 'force_off';

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
 * Resolves the effective reasoning target level by checking the per-provider reasoning override FIRST.
 * - If set to 'force_off': always 'low' (disabled / lowest effort) regardless of caller
 * - If set to 'force_on': always 'high' (high reasoning effort) regardless of caller
 * - If set to 'auto' (or unset/null): falls back to standard role-based logic
 */
export function getEffectiveReasoningTargetLevel(
  provider?: { reasoningOverride?: ReasoningOverrideMode; name?: string; id?: string } | null,
  agentOrTargetLevel?: { id?: string; name?: string } | string | ReasoningTargetLevel | null,
): ReasoningTargetLevel {
  if (provider?.reasoningOverride === 'force_off') {
    return 'low';
  }
  if (provider?.reasoningOverride === 'force_on') {
    return 'high';
  }
  return getAgentDesiredReasoningLevel(agentOrTargetLevel);
}

/**
 * Applies reasoning configuration parameters to a provider config.
 * Supports explicit matrix entries and generic OpenRouter fallback.
 */
export function applyReasoningConfig<T extends { extraParams?: Record<string, unknown>; reasoningParams?: Record<string, unknown>; model?: string; id?: string; name?: string; url?: string; reasoningOverride?: ReasoningOverrideMode }>(
  provider: T,
  agentOrTargetLevel?: { id?: string; name?: string } | string | ReasoningTargetLevel | null,
  modelOverride?: string,
): {
  config: T;
  spec: ReasoningModelSpec | null;
  params: Record<string, unknown> | null;
  desiredLevel: ReasoningTargetLevel;
} {
  const desiredLevel = getEffectiveReasoningTargetLevel(provider, agentOrTargetLevel);
  const effectiveModel = modelOverride || provider.model;
  const provKey = normalizeProviderId(provider);
  const normModel = normalizeModelId(effectiveModel);

  if (provider.reasoningOverride === 'force_off') {
    console.log(
      `[Reasoning Control Override] Provider "${provider.name || provider.id || 'unnamed'}" reasoning override active: FORCE OFF (sending disabled reasoning parameters regardless of agent role)`,
    );
  } else if (provider.reasoningOverride === 'force_on') {
    console.log(
      `[Reasoning Control Override] Provider "${provider.name || provider.id || 'unnamed'}" reasoning override active: FORCE ON (sending high reasoning effort parameters regardless of agent role)`,
    );
  }

  // Exclude non-chat models
  if (
    NON_CHAT_MODELS.has(normModel) ||
    normModel.includes('lyria-3-pro-preview') ||
    normModel.includes('lyria-3-clip-preview')
  ) {
    console.warn(
      `[Reasoning Control Warning] Non-chat music model "${effectiveModel}" selected for agent role. Reasoning parameters skipped.`,
    );
    return {
      config: provider,
      spec: null,
      params: null,
      desiredLevel,
    };
  }

  // Special auto-routing alias note
  if (normModel === 'openrouter/free' || normModel === 'openrouter/auto') {
    console.log(
      `[OpenRouter Reasoning Control] Note: "${effectiveModel}" is an auto-routing alias; the actual underlying model is not guaranteed to be consistent, so reasoning behavior may vary between calls. Reasoning applied as best-effort.`,
    );
  }
  if (
    normModel === 'auto:free' ||
    normModel === 'bazaarlink/auto:free' ||
    (provKey === 'bazaarlink' && (normModel.includes('auto:free') || normModel === 'auto'))
  ) {
    console.log(
      `[BazaarLink Reasoning Control] Note: "${effectiveModel}" is an auto-routing alias; the actual underlying model is not guaranteed to be consistent, so reasoning behavior may vary between calls. Reasoning applied as best-effort.`,
    );
  }

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

  // Log whether generic fallback or explicit config was applied for BazaarLink models
  if (provKey === 'bazaarlink') {
    if (spec.isGenericFallback) {
      console.log(
        `[BazaarLink Reasoning Control] Model "${effectiveModel}" -> using GENERIC BazaarLink fallback rule (params: ${JSON.stringify(params)})`,
      );
    } else {
      console.log(
        `[BazaarLink Reasoning Control] Model "${effectiveModel}" -> using EXPLICIT config entry in reasoning matrix (params: ${JSON.stringify(params)})`,
      );
    }
  }

  // Log whether generic fallback or explicit config was applied for Groq models
  if (provKey === 'groq') {
    const hidingDetail =
      params.include_reasoning === false
        ? ' [hiding reasoning via include_reasoning: false]'
        : params.reasoning_format === 'hidden'
        ? ' [hiding reasoning via reasoning_format: "hidden"]'
        : ' [reasoning format parameter omitted for generic compatibility]';

    if (spec.isGenericFallback) {
      console.log(
        `[Groq Reasoning Control] Model "${effectiveModel}" -> using GENERIC Groq fallback rule (params: ${JSON.stringify(params)})${hidingDetail}`,
      );
    } else {
      console.log(
        `[Groq Reasoning Control] Model "${effectiveModel}" -> using EXPLICIT config entry in reasoning matrix (params: ${JSON.stringify(params)})${hidingDetail}`,
      );
    }
  }

  // Log whether generic fallback or explicit config was applied for OpenRouter models
  if (provKey === 'openrouter') {
    const reasoningObj = params.reasoning as { effort?: string; exclude?: boolean } | undefined;
    const shapeDetail = reasoningObj
      ? ` [effort: "${reasoningObj.effort || 'unknown'}", exclude: ${Boolean(reasoningObj.exclude)}]`
      : '';

    if (spec.isGenericFallback) {
      console.log(
        `[OpenRouter Reasoning Control] Model "${effectiveModel}" -> using GENERIC OpenRouter fallback rule (params: ${JSON.stringify(params)})${shapeDetail}`,
      );
    } else {
      console.log(
        `[OpenRouter Reasoning Control] Model "${effectiveModel}" -> using EXPLICIT config entry in reasoning matrix (params: ${JSON.stringify(params)})${shapeDetail}`,
      );
    }
  }

  // Log whether generic fallback or :groq suffix special-case was applied for Hugging Face models
  if (provKey === 'huggingface') {
    if (spec.isGroqSuffixSpecialCase) {
      console.log(
        `[Hugging Face Reasoning Control] Model "${effectiveModel}" -> using :groq-suffix SPECIAL-CASE rule (reusing Groq reasoning parameters: ${JSON.stringify(params)})`,
      );
    } else {
      console.log(
        `[Hugging Face Reasoning Control] Model "${effectiveModel}" -> using GENERIC Hugging Face fallback rule (params: ${JSON.stringify(params)})`,
      );
    }
    console.log(
      '[Hugging Face Reasoning Control] HF reasoning_effort sent — actual effect not guaranteed on this backend; no error does not confirm success',
    );
  }

  // Log whether generic fallback, dual-mechanism Workers AI fallback, or known-provider-prefix special-case was applied for Cloudflare / @cf models
  if (provKey === 'cloudflare' || normModel.startsWith('@cf/') || normModel.includes('@cf/')) {
    if (spec.isDualMechanismWorkersAi) {
      console.log(
        `[Cloudflare Workers AI Reasoning Control] Model "${effectiveModel}" -> using GENERIC DUAL-MECHANISM fallback rule (sending both reasoning_effort: "${params.reasoning_effort}" and chat_template_kwargs: ${JSON.stringify(params.chat_template_kwargs || 'omitted (thinking on)')}) (params: ${JSON.stringify(params)})`,
      );
    } else if (spec.isKnownProviderPrefixSpecialCase) {
      console.log(
        `[Cloudflare AI Gateway Reasoning Control] Model "${effectiveModel}" -> using ${spec.matchedProvider || 'known-provider'}-prefix SPECIAL-CASE rule (reusing known provider reasoning parameters: ${JSON.stringify(params)})`,
      );
    } else if (spec.isGenericFallback) {
      console.log(
        `[Cloudflare AI Gateway Reasoning Control] Model "${effectiveModel}" -> using GENERIC Cloudflare AI Gateway fallback rule (params: ${JSON.stringify(params)})`,
      );
    } else {
      console.log(
        `[Cloudflare AI Gateway Reasoning Control] Model "${effectiveModel}" -> using EXPLICIT config entry in reasoning matrix (params: ${JSON.stringify(params)})`,
      );
    }
    console.log(
      '[Cloudflare AI Gateway Reasoning Control] Cloudflare AI Gateway reasoning_effort sent — actual effect depends on the underlying routed provider; no error does not confirm success.',
    );
  }

  // Log whether generic fallback or explicit config was applied for Ollama models
  if (provKey === 'ollama') {
    if (spec.isGenericFallback) {
      console.log(
        `[Ollama Reasoning Control] Model "${effectiveModel}" -> using GENERIC Ollama fallback rule (params: ${JSON.stringify(params)})`,
      );
    } else {
      console.log(
        `[Ollama Reasoning Control] Model "${effectiveModel}" -> using EXPLICIT config entry in reasoning matrix (params: ${JSON.stringify(params)})`,
      );
    }
  }

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
