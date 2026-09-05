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

export const FALLBACK_REPLY = 'Let me think about that differently — could you ask again?';
export const FALLBACK_REASONING_REPLY = FALLBACK_REPLY;

/**
 * Sanitizes persona output to eliminate internal reasoning traces,
 * thinking blocks (<think>...</think>, ```thought```, CoT preambles,
 * "Here's a thinking process...", "Analyze User Input:", "Check Constraints:",
 * "Let's draft", "Wait,", numbered reasoning steps), and leading labels
 * (e.g. "[ORBIT]:", "ORBIT:", "[NOVA]:", "**COSMOS**:").
 */
export function sanitizePersonaOutput(text: string, personaName: string): string {
  if (!text) return '';
  let cleaned = text.trim();

  // 1. Strip markdown thought/reasoning code blocks
  cleaned = cleaned.replace(/```(?:thought|thinking|reasoning|plan)[\s\S]*?```/gi, '').trim();

  // 2. Strip XML/HTML-like reasoning/thought tags (<think>...</think>, etc.)
  cleaned = cleaned
    .replace(
      /<(?:think|thought|reasoning|reflection|internal_reasoning|plan|details)>[\s\S]*?<\/(?:think|thought|reasoning|reflection|internal_reasoning|plan|details)>/gi,
      '',
    )
    .trim();

  // 2b. Handle unclosed opening thought tags at start (e.g. <think>... with no closing tag)
  cleaned = cleaned
    .replace(/^<(?:think|thought|reasoning|reflection|internal_reasoning|plan|details)>[\s\S]*?(?:<\/[^>]+>|$)/gi, '')
    .trim();

  // 3. Strip preambles like "Here's a thinking process:", "Thinking Process:", etc.
  cleaned = cleaned
    .replace(
      /^(?:Here(?:\x27s|\x20is)\s+(?:a\s+)?thinking\s+process\s*[-:—]?|Thinking\s+Process\s*[-:—]?|Internal\s+Reasoning\s*[-:—]?|Reasoning\s*Process\s*[-:—]?|Reasoning\s*[-:—]?|Thought\s*Process\s*[-:—]?|Thought\s*[-:—]?|Analysis\s*[-:—]?)\s*/i,
      '',
    )
    .trim();

  // 4. Check for explicit final answer marker
  const answerMarker = cleaned.match(
    /(?:(?:Final\s+Answer|Final\s+Response|Clean\s+Answer|Final\s+Draft|Final\s+Polish|Actual\s+Response|Response|Answer)\s*[-:—]?|(?:Let\x27s\s+craft|Let\x27s\s+draft|Let\x27s\s+respond|Let\x27s\s+write|Let\x27s\s+say|Let\x27s\s+output)\s*[-:—]?)\s*(?:[\x27"]([^\x27"]+)[\x27"]|([^\n\r]+.*))$/is,
  );
  if (answerMarker) {
    const candidate = (answerMarker[1] || answerMarker[2] || '').trim();
    if (candidate && !/^(?:Analyze\s+User\s+Input|Check\s+Constraints|Persona:|Step\s+\d)/i.test(candidate)) {
      cleaned = candidate;
    }
  }

  // 5. Strip numbered reasoning steps like:
  // "1. Analyze User Input: ... 2. Check Constraints: ..."
  cleaned = cleaned
    .replace(
      /(?:^|\n|\s+)\d+[.)]\s*(?:Analyze\s+User\s+Input|Check\s+Constraints|User\s+Input|Constraints|Persona|Goal|Plan|Draft|Identify|Evaluate|Reflect|Consider|Tone|Brevity|Rule)[^\n.]*(?:\.|$)/gi,
      ' ',
    )
    .trim();

  // 6. Strip standalone meta patterns like "Analyze User Input:", "Check Constraints:", "Wait, ..."
  cleaned = cleaned.replace(/(?:Analyze\s+User\s+Input|User\s+Input)[^:.\n]*[:.\n][^.\n]*(?:\.|$)/gi, ' ').trim();
  cleaned = cleaned.replace(/(?:Check\s+Constraints|Constraints)[^:.\n]*[:.\n][^.\n]*(?:\.|$)/gi, ' ').trim();
  cleaned = cleaned.replace(/Wait\s*[,.][^.\n]*(?:\.|$)/gi, ' ').trim();

  // Meta commentary phrases
  cleaned = cleaned.replace(/(?:Persona|Tone|Role|Word\s*count|Word\s*limit)\s*:\s*(?:NOVA|ORBIT|COSMOS|[^.\n]+)(?:\.|$)/gi, '').trim();
  cleaned = cleaned
    .replace(
      /\b(?:\d+\s*words?\s*max|under\s*\d+\s*words|around\s*\d+\s*words|zero\s*fluff|no\s*emojis|ultra\s*short|keep\s*answers?\s*ultra[\s-]short)\b/gi,
      '',
    )
    .trim();

  // 7. Strip CoT meta-thinking traces like "We need to respond as NOVA persona, ultra short..."
  cleaned = cleaned
    .replace(
      /^(?:We\s+need\s+to\s+respond\s+as|In\s+this\s+persona|As\s+(?:NOVA|ORBIT|COSMOS)|Let\x27s\s+think|Thinking:)[^]*?(?:Let\x27s\s+craft|Let\x27s\s+draft|Let\x27s\s+respond|Let\x27s\s+say|Let\x27s\s+output|Final\s+Answer|Response)\s*[-:—]?\s*(?:[\x27"]([^\x27"]+)[\x27"]|(.+))$/is,
      '$1$2',
    )
    .trim();

  // 8. Strip leading persona labels (e.g. "[NOVA]:", "NOVA:", "**COSMOS**:")
  const personaRegex = new RegExp(`^(?:\\[?${personaName}\\]?|\\*\\*${personaName}\\*\\*)\\s*[-:—]\\s*`, 'i');
  cleaned = cleaned.replace(personaRegex, '').trim();
  cleaned = cleaned.replace(/^(?:\[?(?:NOVA|ORBIT|COSMOS)\]?|\*\*(?:NOVA|ORBIT|COSMOS)\*\*)\s*[-:—]\s*/i, '').trim();

  // 9. If text has multiple paragraphs and previous was reasoning, extract the last coherent paragraph
  const paragraphs = cleaned.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length > 1) {
    const lastP = paragraphs[paragraphs.length - 1];
    if (!/^(?:Here(?:\x27s|\x20is)|Analyze|Check|1\.|2\.|3\.|Wait,|Thinking)/i.test(lastP)) {
      cleaned = lastP;
    }
  }

  // 10. Unwrap outer quotes
  if (
    (cleaned.startsWith("'") && cleaned.endsWith("'") && cleaned.length > 2) ||
    (cleaned.startsWith('"') && cleaned.endsWith('"') && cleaned.length > 2) ||
    (cleaned.startsWith('“') && cleaned.endsWith('”') && cleaned.length > 2)
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // 11. Check if usable in-character text remains
  const alphaChars = cleaned.replace(/[^a-zA-Z0-9]/g, '');
  if (alphaChars.length < 3) {
    return '';
  }

  // Reject if the remainder is still pure meta-reasoning
  if (
    /^(?:Here(?:\x27s|\x20is)\s+(?:a\s+)?thinking\s+process|Analyze\s+User\s+Input|Check\s+Constraints|Wait\s*,)/i.test(cleaned) ||
    /\b(?:thinking process|check constraints|persona rules|word limit)\b/i.test(cleaned)
  ) {
    return '';
  }

  return cleaned;
}

/**
 * Extracts and sanitizes the clean final answer for a Multi Chat persona response.
 *
 * Rules:
 * 1. Extract message.content as the primary/preferred answer. If non-empty,
 *    display ONLY that — ignore any message.reasoning or message.reasoning_content.
 * 2. If message.content is empty/null (or contained only meta-reasoning that was stripped),
 *    fall back to message.reasoning/message.reasoning_content (or raw text).
 *    Apply the cleanup filter to strip thinking steps, preambles, and meta-commentary.
 * 3. Keep only the last coherent in-character answer.
 * 4. If nothing usable remains after stripping, return the fallback:
 *    "Let me think about that differently — could you ask again?"
 */
export function extractCleanPersonaResponse(
  raw: { text?: string; content?: string; reasoning?: string },
  personaName: string,
): string {
  const contentCandidate = typeof raw.content === 'string' ? raw.content.trim() : '';
  const reasoningCandidate = typeof raw.reasoning === 'string' ? raw.reasoning.trim() : '';
  const textCandidate = typeof raw.text === 'string' ? raw.text.trim() : '';

  // 1. Primary: message.content
  if (contentCandidate.length > 0) {
    const cleanContent = sanitizePersonaOutput(contentCandidate, personaName);
    if (cleanContent.length > 0) {
      return cleanContent;
    }
  }

  // 2. Fallback: message.reasoning / message.reasoning_content (or raw.text if content is empty)
  const fallbackRaw = reasoningCandidate.length > 0 ? reasoningCandidate : textCandidate;
  if (fallbackRaw.length > 0) {
    const cleanReasoning = sanitizePersonaOutput(fallbackRaw, personaName);
    if (cleanReasoning.length > 0) {
      return cleanReasoning;
    }
  }

  return FALLBACK_REPLY;
}

/**
 * Gets the clean final text for display, speech, copy, and export in Multi Chat.
 */
export function getPersonaCleanText(resp: MultiChatPersonaResponse): string {
  if (resp.text && resp.text.trim()) {
    const cleaned = extractCleanPersonaResponse(
      { content: resp.text, reasoning: resp.reasoning },
      resp.name,
    );
    if (cleaned && cleaned !== FALLBACK_REPLY) return cleaned;
  }
  return extractCleanPersonaResponse(
    { content: resp.content, reasoning: resp.reasoning, text: resp.text },
    resp.name,
  );
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
      maxTokens: Math.max(persona.maxTokens || 100, 350),
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
        content: cleanText,
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
