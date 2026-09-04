import { storage } from '@/lib/storage';
import { api } from '@/services/api';
import type {
  AIProviderConfig,
  MultiChatMessage,
  MultiChatPersonaConfig,
  MultiChatPersonaResponse,
  MultiChatSystemConfig,
} from '@/types';

/**
 * Resolves AI Provider configuration for a Multi Chat persona
 */
export function resolvePersonaProviderConfig(
  personaConfig: MultiChatPersonaConfig,
  isFallback = false,
  overrideMaxTokens?: number,
): { provider: AIProviderConfig | null; model: string; error?: string } {
  const providerId = isFallback ? personaConfig.fallbackProviderId : personaConfig.providerId;
  const modelId = isFallback ? personaConfig.fallbackModelId : personaConfig.modelId;
  const effectiveMaxTokens = overrideMaxTokens !== undefined ? overrideMaxTokens : personaConfig.maxTokens;

  const state = storage.getAIProvidersState();
  const activeCustom = storage.getActiveAIProvider();

  if (!providerId || providerId === 'existing') {
    if (activeCustom) {
      const liveModel =
        activeCustom.model && activeCustom.model.trim()
          ? activeCustom.model.trim()
          : modelId || 'deepseek/deepseek-chat';
      return {
        provider: {
          ...activeCustom,
          model: liveModel,
          maxTokens: effectiveMaxTokens,
        },
        model: liveModel,
      };
    }

    return {
      provider: {
        id: 'existing',
        name: 'Built-in AI',
        url: '',
        model: modelId || 'deepseek/deepseek-chat',
        keyStrategy: 'failover',
        keys: [],
        capabilities: { text: true, tools: true, web: true, wikipedia: true, memory: true },
        maxTokens: effectiveMaxTokens,
      },
      model: modelId || 'deepseek/deepseek-chat',
    };
  }

  const matched = state.providers.find((p) => p.id === providerId);
  if (!matched) {
    if (activeCustom) {
      const liveModel =
        activeCustom.model && activeCustom.model.trim()
          ? activeCustom.model.trim()
          : modelId || 'deepseek/deepseek-chat';
      return {
        provider: {
          ...activeCustom,
          model: liveModel,
          maxTokens: effectiveMaxTokens,
        },
        model: liveModel,
      };
    }

    return {
      provider: null,
      model: modelId || '',
      error: `Configured provider "${providerId}" not found in AI Providers settings.`,
    };
  }

  const liveModel =
    matched.model && matched.model.trim()
      ? matched.model.trim()
      : modelId || 'deepseek/deepseek-chat';

  return {
    provider: {
      ...matched,
      model: liveModel,
      maxTokens: effectiveMaxTokens,
    },
    model: liveModel,
  };
}

/**
 * Sanitizes persona output to eliminate any accidental leading labels
 * (e.g. "[ORBIT]:", "ORBIT:", "[NOVA]:", "**COSMOS**:")
 */
export function sanitizePersonaOutput(text: string, personaName: string): string {
  let cleaned = text.trim();
  // Strip target persona's own label
  const personaRegex = new RegExp(
    `^(?:\\[?${personaName}\\]?|\\*\\*${personaName}\\*\\*)\\s*[:\\-—]\\s*`,
    'i',
  );
  cleaned = cleaned.replace(personaRegex, '').trim();

  // Strip any other persona label prefix if it leaked into the output
  cleaned = cleaned
    .replace(
      /^(?:\[?(?:NOVA|ORBIT|COSMOS)\]?|\*\*(?:NOVA|ORBIT|COSMOS)\*\*)\s*[:\-—]\s*/i,
      '',
    )
    .trim();

  return cleaned;
}

/**
 * Builds the last 10 messages of conversation history for a specific persona.
 * ONLY includes the user's queries and THIS persona's prior completed responses as assistant turns.
 * This guarantees no other persona labels or responses leak into this persona's context.
 */
export function buildMultiChatHistoryMessages(
  conversationHistory: MultiChatMessage[],
  maxTurns = 10,
  targetPersonaId?: string,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const historyMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  const recentTurns = conversationHistory.slice(-maxTurns);

  for (const turn of recentTurns) {
    if (turn.query && turn.query.trim()) {
      historyMessages.push({
        role: 'user',
        content: turn.query.trim(),
      });
    }

    if (targetPersonaId) {
      // Find ONLY this persona's completed response in this turn
      const myReply = turn.responses.find(
        (r) =>
          r.personaId === targetPersonaId &&
          r.status === 'completed' &&
          r.text &&
          r.text.trim(),
      );
      if (myReply && myReply.text) {
        // Strip any residual label prefix in the history item
        const cleanContent = sanitizePersonaOutput(myReply.text, myReply.name);
        if (cleanContent) {
          historyMessages.push({
            role: 'assistant',
            content: cleanContent,
          });
        }
      }
    }
  }

  return historyMessages;
}

/**
 * Executes a single persona call
 */
export async function executeSinglePersona(
  persona: MultiChatPersonaConfig,
  query: string,
  conversationHistory: MultiChatMessage[],
): Promise<MultiChatPersonaResponse> {
  const startTime = Date.now();
  const baseResponse: MultiChatPersonaResponse = {
    personaId: persona.id,
    name: persona.name,
    icon: persona.icon,
    accentColor: persona.accentColor,
    toneBadge: persona.toneBadge,
    text: '',
    status: 'running',
  };

  const primary = resolvePersonaProviderConfig(persona, false, persona.maxTokens || 100);
  if (primary.error) {
    return {
      ...baseResponse,
      status: 'failed',
      error: `Provider error: ${primary.error}`,
      durationMs: Date.now() - startTime,
    };
  }

  let fallbackConfig: AIProviderConfig | null = null;
  if (persona.enableFailover && persona.fallbackProviderId) {
    const fb = resolvePersonaProviderConfig(persona, true, persona.maxTokens || 100);
    if (!fb.error && fb.provider) {
      fallbackConfig = fb.provider;
    }
  }

  // Build full message context with system prompt + last 10 messages of history for THIS persona + current user query
  const historyMessages = buildMultiChatHistoryMessages(conversationHistory, 10, persona.id);
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: persona.systemPrompt },
    ...historyMessages,
    { role: 'user', content: query.trim() },
  ];

  try {
    const res = await api.jarvisAgentCall({
      agentId: `multichat_${persona.id}`,
      messages,
      providerConfig: primary.provider,
      fallbackConfig,
      enableFailover: Boolean(persona.enableFailover),
      temperature: persona.id === 'orbit' ? 0.7 : persona.id === 'cosmos' ? 0.5 : 0.2,
      maxTokens: persona.maxTokens || 100,
      timeoutMs: 40000,
    });

    const durationMs = Date.now() - startTime;

    if (res.ok && res.text) {
      const cleanText = sanitizePersonaOutput(res.text, persona.name);
      return {
        ...baseResponse,
        status: 'completed',
        text: cleanText,
        model: res.model || primary.model,
        providerName: res.providerName || primary.provider?.name || 'Configured AI',
        durationMs,
      };
    } else {
      return {
        ...baseResponse,
        status: 'failed',
        error: res.error || 'Failed to generate response.',
        model: res.model || primary.model,
        providerName: res.providerName || primary.provider?.name,
        durationMs,
      };
    }
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      ...baseResponse,
      status: 'failed',
      error: errMsg,
      durationMs,
    };
  }
}

/**
 * Runs a Multi Chat turn across all enabled personas in parallel
 */
export async function executeMultiChatTurn({
  query,
  conversationHistory,
  config,
  onPersonaUpdate,
}: {
  query: string;
  conversationHistory: MultiChatMessage[];
  config: MultiChatSystemConfig;
  onPersonaUpdate?: (response: MultiChatPersonaResponse) => void;
}): Promise<MultiChatPersonaResponse[]> {
  const personas = Object.values(config.personas);
  const enabledPersonas = personas.filter((p) => p.enabled);

  if (enabledPersonas.length === 0) {
    throw new Error('All personas are currently disabled. Please enable at least one persona in Agent Configurations.');
  }

  // Notify initial running status for each enabled persona
  enabledPersonas.forEach((p) => {
    onPersonaUpdate?.({
      personaId: p.id,
      name: p.name,
      icon: p.icon,
      accentColor: p.accentColor,
      toneBadge: p.toneBadge,
      text: '',
      status: 'running',
    });
  });

  // Query each enabled persona concurrently
  const promises = enabledPersonas.map(async (persona) => {
    const result = await executeSinglePersona(persona, query, conversationHistory);
    onPersonaUpdate?.(result);
    return result;
  });

  const results = await Promise.all(promises);
  return results;
}
