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
 * Sanitizes persona output to eliminate internal reasoning traces,
 * thinking blocks (<think>...</think>, ```thought```, CoT preambles),
 * and leading labels (e.g. "[ORBIT]:", "ORBIT:", "[NOVA]:", "**COSMOS**:").
 */
export function sanitizePersonaOutput(text: string, personaName: string): string {
  if (!text) return '';
  let cleaned = text.trim();

  // 1. Strip markdown thought/reasoning code blocks
  cleaned = cleaned.replace(/```(?:thought|thinking|reasoning)[\s\S]*?```/gi, '').trim();

  // 2. Strip XML/HTML-like reasoning/thought tags (<think>...</think>, etc.)
  cleaned = cleaned
    .replace(
      /<(?:think|thought|reasoning|reflection|internal_reasoning|plan)>[\s\S]*?<\/(?:think|thought|reasoning|reflection|internal_reasoning|plan)>/gi,
      '',
    )
    .trim();

  // 2b. Handle unclosed opening thought tags at start (e.g. <think>... with no closing tag)
  if (/^<(?:think|thought|reasoning|reflection|internal_reasoning|plan)>/i.test(cleaned)) {
    const craftMatch = cleaned.match(
      /(?:Let's craft|Let's draft|Let's respond|Let's write|Final Answer|Answer|Response)\s*[-:—]?\s*(?:['"]([^'"]+)['"]|([^\n\r]+))/i,
    );
    if (craftMatch) {
      cleaned = (craftMatch[1] || craftMatch[2] || '').trim();
    } else {
      cleaned = cleaned.replace(/^<[^>]+>[\s\S]*?(?:<\/[^>]+>|$)/i, '').trim();
    }
  }

  // 3. Strip structured "Thinking Process: ... Final Answer: ..." blocks
  cleaned = cleaned
    .replace(
      /^(?:Thinking Process|Thinking|Thought|Internal Reasoning|Reasoning|Analysis)\s*[-:—]?[\s\S]*?(?:(?:Final Answer|Answer|Response)\s*[-:—]?\s*|\n\n+)/i,
      '',
    )
    .trim();

  // 4. Strip Nemotron / CoT meta-thinking traces like:
  // "We need to respond as NOVA persona, ultra short, 30 words max... Let's craft: 'Hello!...' "
  const cotPattern = /(?:(?:We need to respond as|In this persona|As\s+(?:NOVA|ORBIT|COSMOS)|Let's think|Thinking:)[^]*?)(?:Let's craft|Let's draft|Let's respond|Let's say|Let's output|Final Answer|Response)\s*[-:—]?\s*(?:['"]([^'"]+)['"]|(.+))/is;
  const cotMatch = cleaned.match(cotPattern);
  if (cotMatch) {
    cleaned = (cotMatch[1] || cotMatch[2] || '').trim();
  } else {
    // Check for standalone "Let's craft: '...'" or "Let's draft: '...'" preceded by thought-like phrasing
    const craftMatch = cleaned.match(
      /(?:Let's craft|Let's draft|Let's write|Let's output)\s*[-:—]?\s*(?:['"]([^'"]+)['"]|(.+))/is,
    );
    if (craftMatch && /^(?:We need|Thinking|To respond|Persona|Short answer|Goal)/i.test(cleaned)) {
      cleaned = (craftMatch[1] || craftMatch[2] || '').trim();
    }
  }

  // 5. Strip leading persona labels (e.g. "[NOVA]:", "NOVA:", "**COSMOS**:")
  const personaRegex = new RegExp(
    `^(?:\\[?${personaName}\\]?|\\*\\*${personaName}\\*\\*)\\s*[-:—]\\s*`,
    'i',
  );
  cleaned = cleaned.replace(personaRegex, '').trim();

  cleaned = cleaned
    .replace(
      /^(?:\[?(?:NOVA|ORBIT|COSMOS)\]?|\*\*(?:NOVA|ORBIT|COSMOS)\*\*)\s*[-:—]\\s*/i,
      '',
    )
    .trim();

  // 6. If remaining answer is wrapped in outer quotes (e.g. 'Hello!...' or "Hello!..."), unwrap them
  if (
    (cleaned.startsWith("'") && cleaned.endsWith("'") && cleaned.length > 2) ||
    (cleaned.startsWith('"') && cleaned.endsWith('"') && cleaned.length > 2) ||
    (cleaned.startsWith('“') && cleaned.endsWith('”') && cleaned.length > 2)
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  return cleaned;
}

/**
 * Extracts and sanitizes the clean final answer for a Multi Chat persona response.
 * Priority:
 * 1. Primary: message.content (raw.content)
 * 2. Fallback: message.reasoning (raw.reasoning) ONLY if content is empty
 * 3. Fallback: raw.text
 */
export function extractCleanPersonaResponse(
  raw: { text?: string; content?: string; reasoning?: string },
  personaName: string,
): string {
  const contentCandidate = typeof raw.content === 'string' ? raw.content.trim() : '';
  const reasoningCandidate = typeof raw.reasoning === 'string' ? raw.reasoning.trim() : '';
  const textCandidate = typeof raw.text === 'string' ? raw.text.trim() : '';

  let chosenRaw = '';
  if (contentCandidate.length > 0) {
    chosenRaw = contentCandidate;
  } else if (reasoningCandidate.length > 0) {
    chosenRaw = reasoningCandidate;
  } else {
    chosenRaw = textCandidate;
  }

  return sanitizePersonaOutput(chosenRaw, personaName);
}

/**
 * Gets the clean final text for display, speech, copy, and export in Multi Chat.
 */
export function getPersonaCleanText(resp: MultiChatPersonaResponse): string {
  if (resp.content && resp.content.trim()) {
    return sanitizePersonaOutput(resp.content, resp.name).trim();
  }
  if (resp.text && resp.text.trim()) {
    return sanitizePersonaOutput(resp.text, resp.name).trim();
  }
  if (resp.reasoning && resp.reasoning.trim()) {
    return sanitizePersonaOutput(resp.reasoning, resp.name).trim();
  }
  return '';
}

/**
 * Builds the last 20 messages of conversation history for a specific persona.
 * ONLY includes the user's queries and THIS persona's prior completed responses as assistant turns.
 * This guarantees no other persona labels or responses leak into this persona's context.
 */
export function buildMultiChatHistoryMessages(
  conversationHistory: MultiChatMessage[],
  maxTurns = 20,
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

export interface PriorPersonaTurnAnswer {
  personaId: string;
  name: string;
  text: string;
}

/**
 * Executes a single persona call
 */
export async function executeSinglePersona(
  persona: MultiChatPersonaConfig,
  query: string,
  conversationHistory: MultiChatMessage[],
  priorTurnResponses: PriorPersonaTurnAnswer[] = [],
  permanentMemories?: string[],
  responseLanguage?: string,
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

  // Build full message context with system prompt + last 20 messages of history for THIS persona
  const historyMessages = buildMultiChatHistoryMessages(conversationHistory, 20, persona.id);

  // Inject permanent memories into persona context if any exist
  const memoriesToInject = permanentMemories ?? storage.getMultiChatMemories();
  let systemContent = persona.systemPrompt;
  if (memoriesToInject && memoriesToInject.length > 0) {
    const validMemories = memoriesToInject.map((m) => m.trim()).filter(Boolean);
    if (validMemories.length > 0) {
      const memoryBlock = validMemories.map((m) => `- ${m}`).join('\n');
      systemContent = `Known facts about the user:\n${memoryBlock}\n\n${persona.systemPrompt}`;
    }
  }

  // Inject chosen response language instruction
  const rawLang = responseLanguage ?? storage.getMultiChatResponseLanguage();
  const lang = (typeof rawLang === 'string' && rawLang.trim()) ? rawLang.trim() : 'English';
  if (lang) {
    systemContent += `\n\nRespond only in: ${lang}. Strictly output your response in ${lang} while maintaining your personality style and staying under 30 words.`;
  }

  // If previous personas answered in this turn, provide their answers as live turn context
  let userContent = query.trim();
  if (priorTurnResponses && priorTurnResponses.length > 0) {
    const validPrior = priorTurnResponses.filter((p) => p.text && p.text.trim());
    if (validPrior.length > 0) {
      const priorContext = validPrior
        .map((p) => `• ${p.name.toUpperCase()} said:\n"${p.text.trim()}"`)
        .join('\n\n');

      userContent += `\n\n=== CONTEXT FROM OTHER PERSONAS THIS TURN ===\n${priorContext}\n============================================\n(You may react to, agree/disagree with, or build on what they said, while answering the user and keeping your answer under 30 words in your own voice.)`;
    }
  }

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemContent },
    ...historyMessages,
    { role: 'user', content: userContent },
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

    if (res.ok && (res.content || res.text || res.reasoning)) {
      const cleanText = extractCleanPersonaResponse(
        {
          content: res.content,
          reasoning: res.reasoning,
          text: res.text,
        },
        persona.name,
      );
      return {
        ...baseResponse,
        status: 'completed',
        text: cleanText,
        content: res.content,
        reasoning: res.reasoning,
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
 * Runs a Multi Chat turn across all enabled personas in SEQUENCE (NOVA -> ORBIT -> COSMOS).
 * Each subsequent persona receives what prior personas answered in THIS turn as additional context.
 */
export async function executeMultiChatTurn({
  query,
  conversationHistory,
  config,
  onPersonaUpdate,
  permanentMemories,
  responseLanguage,
}: {
  query: string;
  conversationHistory: MultiChatMessage[];
  config: MultiChatSystemConfig;
  onPersonaUpdate?: (response: MultiChatPersonaResponse) => void;
  permanentMemories?: string[];
  responseLanguage?: string;
}): Promise<MultiChatPersonaResponse[]> {
  const activeMemories = permanentMemories ?? storage.getMultiChatMemories();
  const activeLanguage = responseLanguage ?? config.responseLanguage ?? storage.getMultiChatResponseLanguage();
  const personas = Object.values(config.personas);
  const enabledPersonas = personas.filter((p) => p.enabled);

  if (enabledPersonas.length === 0) {
    throw new Error('All personas are currently disabled. Please enable at least one persona in Agent Configurations.');
  }

  // Enforce connected sequential order: NOVA -> ORBIT -> COSMOS
  const orderedIds = ['nova', 'orbit', 'cosmos'];
  enabledPersonas.sort((a, b) => {
    const idxA = orderedIds.indexOf(a.id);
    const idxB = orderedIds.indexOf(b.id);
    return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
  });

  // Notify initial statuses:
  // First persona is 'running'; subsequent personas are queued as 'pending'
  enabledPersonas.forEach((p, index) => {
    onPersonaUpdate?.({
      personaId: p.id,
      name: p.name,
      icon: p.icon,
      accentColor: p.accentColor,
      toneBadge: p.toneBadge,
      text: '',
      status: index === 0 ? 'running' : 'pending',
    });
  });

  const results: MultiChatPersonaResponse[] = [];
  const turnContext: PriorPersonaTurnAnswer[] = [];

  // Execute personas sequentially
  for (let i = 0; i < enabledPersonas.length; i++) {
    const persona = enabledPersonas[i];

    // If not the first, transition status from 'pending' to 'running'
    if (i > 0) {
      onPersonaUpdate?.({
        personaId: persona.id,
        name: persona.name,
        icon: persona.icon,
        accentColor: persona.accentColor,
        toneBadge: persona.toneBadge,
        text: '',
        status: 'running',
      });
    }

    const result = await executeSinglePersona(
      persona,
      query,
      conversationHistory,
      [...turnContext],
      activeMemories,
      activeLanguage,
    );

    results.push(result);
    onPersonaUpdate?.(result);

    // If completed, record this persona's clean answer for subsequent personas
    const cleanAnswer = getPersonaCleanText(result);
    if (result.status === 'completed' && cleanAnswer) {
      turnContext.push({
        personaId: persona.id,
        name: persona.name,
        text: cleanAnswer,
      });
    }
  }

  return results;
}
