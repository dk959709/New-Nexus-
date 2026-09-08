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

export const FALLBACK_REPLY = 'Understood. Standing by for your next query or directive.';
export const FALLBACK_REASONING_REPLY = FALLBACK_REPLY;

/**
 * Returns a persona-specific, context-aware fallback response when extraction or response generation is empty,
 * preventing confusing prompts like "could you ask again?" from confusing the user or other personas.
 */
export function getPersonaFallbackReply(personaName: string, query?: string): string {
  const normName = (personaName || '').toLowerCase();
  const isAck = query ? isAcknowledgmentOrReaction(query) : false;

  if (normName.includes('nova')) {
    if (isAck) return 'Acknowledged. Standing by for your next directive or topic.';
    return 'Understood. Standing by for your next query or directive.';
  }
  if (normName.includes('orbit')) {
    if (isAck) return 'Awesome, you got it! Let me know if you need anything else! ✨';
    return 'Got it! Whenever you want to explore something new, let me know! 🚀';
  }
  if (normName.includes('cosmos')) {
    if (isAck) return 'You are very welcome. I am here whenever you wish to proceed.';
    return 'Understood. I am here whenever you wish to explore further.';
  }
  return 'Understood. Standing by for your next query.';
}

/**
 * Checks if a line or clause represents meta-reasoning, self-critique,
 * constraints checking, drafting indicator, or instructions rather than
 * an in-character persona utterance.
 */
export function isMetaReasoningLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;

  // XML-like tags
  if (/^<[\s\S]*>$/i.test(trimmed)) return true;

  // Preambles and header lines
  if (
    /^(?:Here(?:\x27s|\x20is)\s+(?:a\s+)?(?:thinking|thought|reasoning)\s+process|Thinking\s+Process|Thought\s+Process|Internal\s+Reasoning|Reasoning\s+Process|Reasoning|Analysis|Thoughts?|Plan|Reflection)\b/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  // Numbered or bullet analysis / critique steps (e.g. "1. Analyze User Input:", "2. Persona constraints:", "3. Draft response:")
  if (
    /^\s*(?:\d+[.)]|Step\s+\d+[:.]?|[-*•])\s*(?:Analyze|Analysis|Understand|User\s+Input|Check|Constraint|Constraints|Persona|Tone|Role|Goal|Target|Objective|Draft|Drafting|Refine|Refining|Evaluate|Review|Consider|Identify|Examine|Verify|Ensure|Word\s*count|Formatting|Critique|Correction|Revision|Decision|Formulate|Step)\b/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  // Numbered lines instructing tone or limits (e.g. "1. The user said Hello.", "2. NOVA must be concise.")
  if (
    /^\s*\d+[.)]\s+(?:The\s+user|We\s+need|I\s+need|I\s+should|Keep\s+it|Make\s+sure|Ensure|Zero\s+fluff|No\s+emojis)\b/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  // Standalone draft markers (e.g. "Draft 1:", "**Draft 2**:", "Initial Draft:")
  if (
    /^\s*(?:\*\*)?(?:Draft\s*\d*|Initial\s*Draft|First\s*Draft|Second\s*Draft|Third\s*Draft|Revised\s*Draft|Final\s*Draft)(?:\*\*)?\s*[-:—]?\s*$/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  // Check and constraint headers (e.g. "Word count check: ...", "Format check: ...", "Refine against constraints: ...")
  if (
    /^\s*(?:\*\*)?(?:Word\s*count(?:\s*check)?|Length\s*check|Token\s*count|Count|Format(?:ting)?(?:\s*check)?|Style(?:\s*check)?|Tone(?:\s*check)?|Persona(?:\s*check)?|Refin(?:e|ing|ed)?(?:\s*against)?\s*constraints?|Constraint(?:\s*check)?|Constraints?|Check(?:ing)?(?:\s*against)?\s*constraints?|Brevity(?:\s*check)?|Rule(?:\s*check)?|Sanity\s*check|Self-critique|Critique|Self-correction|Correction|Adjustment|Revision|Evaluation|Final\s*check|Polish|Final\s*Polish)(?:\*\*)?\s*[-:—]?/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  // Inline meta-check expressions
  if (
    /\b(?:word\s*count\s*check|format(?:ting)?\s*check|tone\s*check|persona\s*check|refin(?:e|ing|ed)?\s*against\s*constraints?|check(?:ing)?\s*constraints?|meets?\s*(?:all\s*)?constraints?|under\s*\d+\s*words|within\s*(?:the\s*)?\d+[\s-]words?|words?\s*max\b|zero\s*fluff|no\s*emojis?|keep\s*(?:it\s*)?ultra[\s-]short|strictly\s*(?:under|within)\b)/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  // Word count evaluation summary (e.g. "7 words. Perfect.", "14 words total.", "Word count: 9")
  if (
    /^(?:Word\s*count\s*:\s*\d+|\d+\s*words?\s*(?:total|count)?\.?\s*(?:Good|Perfect|Nice|Within|Great|Too\s*(?:long|short)|Fits|Satisfies|Matches|Fine)?)$/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  // Meta commentary regarding prompt or instructions
  if (
    /^(?:The\s+user\s+(?:said|says|is\s+asking|wants|greets)|User\s+wants|User\s+input\s*:|Input\s*:|Prompt\s*:|System\s*prompt\s*:)/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  if (
    /^(?:We\s+need\s+to\s+respond|I\s+need\s+to\s+(?:respond|act|be)|I\s+should\s+(?:be|keep|use|respond)|As\s+(?:NOVA|ORBIT|COSMOS),\s*(?:I|we)\s*(?:should|must|will)|In\s+this\s+persona)/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  if (
    /^(?:Let\x27s\s+(?:draft|craft|write|formulate|refine|check|create|say|respond|see)|Now\s+(?:draft|refine|check))\b/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  if (/^(?:Wait\s*[,.]|Hmm\s*[,.]|Let\s+me\s+think\b)/i.test(trimmed)) {
    return true;
  }

  if (
    /^(?:This\s+(?:satisfies|meets|fits|matches|looks)\s+(?:all\s+)?(?:constraints|criteria|good|fine|requirements)\.?)$/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Strips leading persona labels like "[NOVA]:", "NOVA:", "**ORBIT**:", "COSMOS -"
 */
export function cleanPersonaPrefix(text: string, personaName: string): string {
  let res = text.trim();
  const escapedName = personaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nameRegex = new RegExp(
    `^(?:\\[?${escapedName}\\]?|\\*\\*${escapedName}\\*\\*|\\(${escapedName}\\))\\s*[-:—]\\s*`,
    'i',
  );
  res = res.replace(nameRegex, '');
  res = res.replace(
    /^(?:\[?(?:NOVA|ORBIT|COSMOS)\]?|\*\*(?:NOVA|ORBIT|COSMOS)\*\*|\((?:NOVA|ORBIT|COSMOS)\))\s*[-:—]\s*/i,
    '',
  );
  return res.trim();
}

/**
 * Strips matching outer quotation marks ('...', "...", “...”)
 */
function unwrapOuterQuotes(text: string): string {
  let cleaned = text.trim();
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
 * Sanitizes persona output using general pattern detection to strip:
 * - Reasoning traces and thoughts (<think>, ```thought```, preambles)
 * - Drafting iterations ("Draft 1: ... Draft 2: ...")
 * - Word count and format checks ("Word count check: ...", "Format check: ...")
 * - Constraint checks and self-critiques ("Refine against constraints: ...")
 * - Standalone numbered analysis steps without "thinking process" header
 * - Leading persona labels ("NOVA:", "[ORBIT]:", "**COSMOS**:")
 * and keeps only the final coherent in-character reply.
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
      /^(?:Here(?:\x27s|\x20is)\s+(?:a\s+)?(?:thinking|thought|reasoning)\s+process\s*[-:—]?|Thinking\s+Process\s*[-:—]?|Internal\s+Reasoning\s*[-:—]?|Reasoning\s*Process\s*[-:—]?|Reasoning\s*[-:—]?|Thought\s*Process\s*[-:—]?|Thought\s*[-:—]?|Analysis\s*[-:—]?)\s*/i,
      '',
    )
    .trim();

  // 4. Check for explicit final answer marker at or near the end (e.g. "Final Answer: ...", "Final Response: ...")
  const answerMarker = cleaned.match(
    /(?:^|\n)\s*(?:\*\*)?(?:Final\s+Answer|Final\s+Response|Clean\s+Answer|Final\s+Output|Actual\s+Response)\s*(?:\*\*)?\s*[-:—]\s*([\s\S]+)$/i,
  );
  if (answerMarker && answerMarker[1]) {
    const candidate = answerMarker[1].trim();
    if (!isMetaReasoningLine(candidate)) {
      cleaned = candidate;
    }
  }

  // 5. Check if drafting iterations exist (e.g. "Draft 1: ... Draft 2: ...")
  // If multiple drafts are present, extract the contents of the LAST draft
  const draftMatches = Array.from(
    cleaned.matchAll(
      /(?:^|\n)\s*(?:\*\*)?Draft\s*\d*(?:\*\*)?\s*[-:—]?\s*([\s\S]*?)(?=(?:\n\s*(?:\*\*)?Draft\s*\d*(?:\*\*)?\s*[-:—]|\n\s*(?:\*\*)?Final\s*(?:Answer|Response)|$))/gi,
    ),
  );
  if (draftMatches.length > 0) {
    const lastDraftBlock = draftMatches[draftMatches.length - 1][1]?.trim();
    if (lastDraftBlock) {
      // Clean that draft block by stripping check lines from it
      const draftLines = lastDraftBlock
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !isMetaReasoningLine(l));
      if (draftLines.length > 0) {
        cleaned = draftLines.join(' ');
      }
    }
  }

  // 6. Process line-by-line using general pattern detection:
  // Strip any line that matches meta-commentary, self-critique, word counts, format checks, constraint checks, or numbered steps
  const rawLines = cleaned.split('\n');
  const keptLines: string[] = [];

  for (const rawLine of rawLines) {
    let line = rawLine.trim();
    if (!line) continue;

    // Check if line begins with a draft prefix like "Draft 1: Hello." or "Draft 2: State your query."
    line = line
      .replace(
        /^(?:\*\*)?(?:Draft\s*\d*|Initial\s*Draft|First\s*Draft|Second\s*Draft|Third\s*Draft|Revised\s*Draft|Final\s*Draft)\s*(?:\*\*)?\s*[-:—]?\s*/i,
        '',
      )
      .trim();

    // Check if line begins with final answer marker like "Final Answer: Hello."
    line = line
      .replace(
        /^(?:\*\*)?(?:Final\s+Answer|Final\s+Response|Clean\s+Answer|Response|Answer)\s*(?:\*\*)?\s*[-:—]?\s*/i,
        '',
      )
      .trim();

    if (!line) continue;

    if (isMetaReasoningLine(line)) {
      // If this meta line is a refinement/adjustment/revision step,
      // any draft accumulated before it was rejected in favor of the revision
      if (
        /^\s*(?:\*\*)?(?:Refin(?:e|ing|ed)?(?:\s*against)?\s*constraints?|Self-critique|Critique|Self-correction|Correction|Adjustment|Revision|Revised|Let\x27s\s+(?:refine|adjust|revise|try\s+again|make\s+it)|Second\s*thought)/i.test(
          line,
        )
      ) {
        keptLines.length = 0;
      }
      continue;
    }

    keptLines.push(line);
  }

  if (keptLines.length > 0) {
    cleaned = keptLines.join(' ');
  }

  // 7. Strip leading persona labels (e.g. "[NOVA]:", "NOVA:", "**COSMOS**:")
  cleaned = cleanPersonaPrefix(cleaned, personaName);

  // 8. Unwrap outer quotes
  cleaned = unwrapOuterQuotes(cleaned);

  // 9. Strip any inline meta-check artifacts that may be blended inside the sentence
  cleaned = cleaned
    .replace(
      /\b(?:word\s*count\s*check|format\s*check|formatting\s*check|tone\s*check|persona\s*check|refine\s*against\s*constraints?|meets?\s*(?:all\s*)?constraints?)[^.\n]*(?:\.|$)/gi,
      ' ',
    )
    .replace(
      /\b\d+\s*words?\s*(?:total|count)?\.?\s*(?:Good|Perfect|Nice|Within|Great|Too|Fits|Satisfies|Matches|Fine)?$/gi,
      '',
    )
    .trim();

  cleaned = cleanPersonaPrefix(cleaned, personaName);
  cleaned = unwrapOuterQuotes(cleaned);

  // 10. Check if usable in-character text remains
  const alphaChars = cleaned.replace(/[^a-zA-Z0-9]/g, '');
  if (alphaChars.length < 2) {
    return '';
  }

  // Reject if remainder is still pure meta-reasoning
  if (
    isMetaReasoningLine(cleaned) ||
    /^(?:Here(?:\x27s|\x20is)\s+(?:a\s+)?thinking\s+process|Analyze\s+User\s+Input|Check\s+Constraints|Wait\s*,)/i.test(
      cleaned,
    ) ||
    /\b(?:thinking process|check constraints|persona rules|word limit)\b/i.test(cleaned)
  ) {
    return '';
  }

  return cleaned;
}

/**
 * When message.content is empty and only reasoning is available,
 * extracts the actual final in-character answer from within the reasoning text
 * (such as the last clean draft, a quoted response, or the last clean sentence)
 * rather than displaying a generic fallback.
 */
export function extractFinalAnswerFromReasoning(
  reasoningText: string,
  personaName: string,
): string {
  if (!reasoningText) return '';
  const trimmed = reasoningText.trim();

  // 1. Look for explicit final answer marker
  const answerMarker = trimmed.match(
    /(?:^|\n)\s*(?:\*\*)?(?:Final\s+Answer|Final\s+Response|Clean\s+Answer|Final\s+Output|Actual\s+Response)\s*(?:\*\*)?\s*[-:—]\s*([\s\S]+)$/i,
  );
  if (answerMarker && answerMarker[1]) {
    const candidate = sanitizePersonaOutput(answerMarker[1], personaName);
    if (candidate.length > 0 && !isMetaReasoningLine(candidate)) {
      return candidate;
    }
  }

  // 2. Look for Draft blocks (take the last draft)
  const draftMatches = Array.from(
    trimmed.matchAll(
      /(?:^|\n)\s*(?:\*\*)?Draft\s*\d*(?:\*\*)?\s*[-:—]?\s*([\s\S]*?)(?=(?:\n\s*(?:\*\*)?Draft\s*\d*(?:\*\*)?\s*[-:—]|\n\s*(?:\*\*)?Final\s*(?:Answer|Response)|$))/gi,
    ),
  );
  if (draftMatches.length > 0) {
    const lastDraft = draftMatches[draftMatches.length - 1][1];
    if (lastDraft) {
      const candidate = sanitizePersonaOutput(lastDraft, personaName);
      if (candidate.length > 0 && !isMetaReasoningLine(candidate)) {
        return candidate;
      }
    }
  }

  // 3. Search for quoted strings near the end of the reasoning (e.g. The response should be "Hello.")
  const quotes = Array.from(trimmed.matchAll(/(?:["'“])([^"'”\n\r]{6,300})(?:["'”])/g));
  for (let i = quotes.length - 1; i >= 0; i--) {
    const quoteText = quotes[i][1]?.trim();
    if (!quoteText) continue;
    if (isMetaReasoningLine(quoteText)) continue;

    // Must not contain meta keywords
    if (
      /\b(?:analyze|user\s+input|word\s*count|constraint|draft|persona|prompt|fluff|token|rule|step)\b/i.test(
        quoteText,
      )
    ) {
      continue;
    }

    const cleaned = cleanPersonaPrefix(quoteText, personaName);
    const alphaChars = cleaned.replace(/[^a-zA-Z0-9]/g, '');
    if (alphaChars.length >= 4) {
      return cleaned;
    }
  }

  // 4. Split reasoning into sentences/segments working backwards
  // to find the last clean in-character sentence(s)
  const segments = trimmed
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const cleanCandidates: string[] = [];
  for (let i = segments.length - 1; i >= Math.max(0, segments.length - 15); i--) {
    let seg = segments[i];

    // Strip leading draft or answer labels if present
    seg = seg
      .replace(
        /^(?:\*\*)?(?:Draft\s*\d*|Initial\s*Draft|Revised\s*Draft|Final\s*Draft|Final\s*Answer|Response)\s*(?:\*\*)?\s*[-:—]?\s*/i,
        '',
      )
      .trim();
    seg = cleanPersonaPrefix(seg, personaName);
    seg = unwrapOuterQuotes(seg);

    if (isMetaReasoningLine(seg)) continue;

    // Ensure it doesn't contain internal reasoning commentary
    if (
      /\b(?:draft|word\s*count|format\s*check|constraint|persona|prompt|rule|fluff|emoji|token|step|analyze|analysis|user\s*input|self-critique|critique|brevity|under\s*\d+\s*words)\b/i.test(
        seg,
      )
    ) {
      continue;
    }

    // Must be a coherent sentence/phrase
    const words = seg.split(/\s+/).filter(Boolean);
    const alphaChars = seg.replace(/[^a-zA-Z0-9]/g, '');
    if (words.length >= 1 && alphaChars.length >= 2) {
      cleanCandidates.unshift(seg);
      // Stop after collecting up to 6 clean contiguous sentences to accommodate adaptive length
      if (cleanCandidates.length >= 6) break;
    } else if (cleanCandidates.length > 0) {
      // Break contiguous sequence
      break;
    }
  }

  if (cleanCandidates.length > 0) {
    const combined = cleanCandidates.join(' ');
    const finalClean = sanitizePersonaOutput(combined, personaName);
    if (finalClean.length > 0) {
      return finalClean;
    }
  }

  return '';
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
 * 3. Attempt to extract the actual final answer from within the reasoning text (e.g. last clean sentence or draft).
 * 4. If nothing usable remains after stripping, return a clean, persona-appropriate fallback.
 */
export function extractCleanPersonaResponse(
  raw: { text?: string; content?: string; reasoning?: string },
  personaName: string,
  userQuery?: string,
): string {
  const contentCandidate = typeof raw.content === 'string' ? raw.content.trim() : '';
  const reasoningCandidate = typeof raw.reasoning === 'string' ? raw.reasoning.trim() : '';
  const textCandidate = typeof raw.text === 'string' ? raw.text.trim() : '';

  // 1. Primary: message.content
  if (contentCandidate.length > 0) {
    const cleanContent = sanitizePersonaOutput(contentCandidate, personaName);
    if (
      cleanContent.length > 0 &&
      !cleanContent.includes('think about that differently') &&
      !cleanContent.includes('could you ask again')
    ) {
      return cleanContent;
    }
  }

  // 2. Fallback: message.reasoning / message.reasoning_content (or raw.text if content is empty)
  const fallbackRaw = reasoningCandidate.length > 0 ? reasoningCandidate : textCandidate;
  if (fallbackRaw.length > 0) {
    // Attempt targeted extraction from reasoning trace first (e.g. last clean sentence, draft, or quote)
    const extractedFromReasoning = extractFinalAnswerFromReasoning(fallbackRaw, personaName);
    if (
      extractedFromReasoning.length > 0 &&
      extractedFromReasoning !== FALLBACK_REPLY &&
      !extractedFromReasoning.includes('think about that differently') &&
      !extractedFromReasoning.includes('could you ask again')
    ) {
      return extractedFromReasoning;
    }

    // Secondary fallback: general sanitization filter
    const cleanReasoning = sanitizePersonaOutput(fallbackRaw, personaName);
    if (
      cleanReasoning.length > 0 &&
      !cleanReasoning.includes('think about that differently') &&
      !cleanReasoning.includes('could you ask again')
    ) {
      return cleanReasoning;
    }
  }

  return getPersonaFallbackReply(personaName, userQuery);
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

export type QueryLengthIntent = 'detailed' | 'concise' | 'standard';

export type QueryLengthCategory =
  | 'acknowledgment'
  | 'greeting'
  | 'storytelling'
  | 'explanation'
  | 'complex'
  | 'general';

export interface QueryLengthProfile {
  intent: QueryLengthIntent;
  category: QueryLengthCategory;
  reason: string;
  targetWords: string;
  minTokens: number;
}

/**
 * Detects whether a user query is a simple acknowledgment, affirmation, or short reaction
 * (e.g. "ok", "cool", "nice", "got it", "thanks", "lol", "awesome", "sounds good", "understood").
 */
export function isAcknowledgmentOrReaction(query: string): boolean {
  const clean = query
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return false;

  const words = clean.split(' ').filter(Boolean);
  if (words.length > 8) return false;

  const exactAckPhrases = new Set([
    'ok', 'okay', 'oki', 'okey', 'k', 'kk', 'k thanks', 'ok thanks', 'ok thank you',
    'ok cool', 'ok got it', 'cool', 'cool cool', 'cool beans', 'nice', 'very nice',
    'nice one', 'noice', 'got it', 'gotcha', 'get it', 'i get it', 'understood',
    'acknowledged', 'noted', 'copy', 'copy that', 'roger', 'roger that', 'thanks',
    'thank you', 'thank u', 'thx', 'ty', 'tysm', 'many thanks', 'cheers',
    'appreciate it', 'much appreciated', 'awesome', 'great', 'excellent',
    'perfect', 'sweet', 'neat', 'super', 'sounds good', 'sounds great', 'sound good',
    'looks good', 'look good', 'works for me', 'works', 'fair enough', 'makes sense',
    'good to know', 'alright', 'all right', 'alrighty', 'aight', 'sure', 'sure thing',
    'for sure', 'yep', 'yup', 'yeah', 'yea', 'yes', 'aye', 'definitely', 'certainly',
    'no problem', 'no worries', 'np', 'anytime', 'my pleasure', 'all set', 'done',
    'i see', 'oh i see', 'agreed', 'indeed', 'true', 'valid', 'right on',
    'lol', 'lmao', 'rofl', 'haha', 'hahaha', 'hahahaha', 'hehe', 'hehehe', 'heh',
    'wow', 'whoa', 'woah', 'omg', 'interesting', 'fascinating', 'good', 'fine',
  ]);

  if (exactAckPhrases.has(clean)) {
    return true;
  }

  const ackRegex =
    /^(?:ok(?:ay|i|ey)?|k{1,2}|cool(?: beans)?|nice(?: one)?|noice|got\s*(?:it|cha)|understood|acknowledged|noted|copy(?:\s*that)?|roger(?:\s*that)?|thanks?(?:\s*(?:you|u))?|thx|ty|tysm|cheers|much\s*appreciated|appreciate\s*it|awesome|great|perfect|sweet|neat|super|sounds?\s*(?:good|great)|looks?\s*good|works?\s*(?:for\s*me)?|fair\s*enough|makes?\s*sense|good\s*to\s*know|alright(?:y)?|all\s*right|aight|sure(?:\s*thing)?|for\s*sure|yep|yup|yeah|yea|yes|aye|definitely|certainly|no\s*problem|no\s*worries|np|anytime|my\s*pleasure|all\s*set|done|i\s*see|oh\s*i\s*see|agreed|indeed|true|valid|right\s*on|lol|lmao|rofl|haha+|hehe+|heh+|wow|whoa|woah|omg|interesting|fascinating|good|fine)(?:\s+(?:thanks?(?:\s*(?:you|u))?|thx|ty|so\s*much|a\s*lot|bro|man|dude|buddy|team|all|everyone|nova|orbit|cosmos|mate|folks|friend|it|too|as\s*well|then|for\s*(?:that|now|the\s*help)|now|sounds?\s*good|got\s*it|perfect|cool|nice|ok|awesome))*\s*$/i;

  return ackRegex.test(clean);
}

/**
 * Dynamically categorizes a user query into:
 * - 'detailed' (e.g. "Tell me a story about a dragon", "explain X", "why does Y happen", "how does Z work"):
 *   Triggers ~80-100 word rich narrative or comprehensive depth.
 * - 'concise' (e.g. "Hello", "How are you", "Good morning", "Who are you"):
 *   Triggers 20-30 word concise, punchy reply.
 * - 'standard' (general questions):
 *   Defaults to comprehensive/detailed mode (~70-100 words) to avoid telegraphic 10-word fragments.
 */
export function detectQueryLengthIntent(query: string): QueryLengthProfile {
  const q = query.trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // 1. Explicit Storytelling & Creative Triggers -> FORCE DETAILED (~100 words)
  const storytellingTriggers = [
    /\b(?:tell\s+me\s+a\s+story|tell\s+a\s+story|write\s+a\s+story|make\s+up\s+a\s+story|bedtime\s+story|short\s+story)\b/,
    /\b(?:story|tale|fable|narrative|parable|legend|myth|folklore|epic|saga)\b/,
    /\b(?:poem|poetry|rhyme|ballad|song|lyrics|script|dialogue|scene|play)\b/,
    /\b(?:roleplay|pretend\s+you\s+are|act\s+like|imagine\s+that|what\s+if)\b/,
    /\b(?:adventure|journey|chronicle|quest)\b/,
  ];

  for (const regex of storytellingTriggers) {
    if (regex.test(q)) {
      return {
        intent: 'detailed',
        category: 'storytelling',
        reason: 'Explicit storytelling/creative request',
        targetWords: '80-100 words',
        minTokens: 500,
      };
    }
  }

  // 2. Explicit Explanation & Deep Understanding Triggers -> FORCE DETAILED (~100 words)
  const explanationTriggers = [
    /\b(?:explain|elucidate|clarify|teach\s+me|break\s+down|demystify)\b/,
    /\b(?:tell\s+me\s+about|talk\s+about|what\s+do\s+you\s+know\s+about)\b/,
    /\b(?:how\s+does|how\s+do|how\s+can|how\s+would|how\s+to|how\s+is|how\s+come)\b/,
    /\b(?:why\s+is|why\s+are|why\s+do|why\s+does|why\s+did|why\s+would|why\s+can|why\s+should)\b/,
    /\b(?:what\s+causes|what\s+is\s+the\s+difference|compare|contrast|pros\s+and\s+cons)\b/,
    /\b(?:describe|give\s+me\s+details|in[\s-]depth|in\s+detail|elaborate|expand\s+on)\b/,
    /\b(?:history\s+of|origin\s+of|background\s+of|future\s+of|mechanics\s+of)\b/,
    /\b(?:step\s+by\s+step|guide\s+me|tutorial|overview|deep\s+dive|analysis|analyze)\b/,
    /\b(?:philosophy\s+of|meaning\s+of|significance\s+of|impact\s+of|implications\s+of)\b/,
  ];

  for (const regex of explanationTriggers) {
    if (regex.test(q)) {
      return {
        intent: 'detailed',
        category: 'explanation',
        reason: 'Explicit explanation or breakdown request',
        targetWords: '80-100 words',
        minTokens: 500,
      };
    }
  }

  // 3. Simple Acknowledgments & Short Reactions ("ok", "cool", "got it", "thanks", "nice", "lol", etc.) -> CONCISE (15-30 words)
  if (isAcknowledgmentOrReaction(q)) {
    return {
      intent: 'concise',
      category: 'acknowledgment',
      reason: 'Simple acknowledgment or short reaction',
      targetWords: '15-30 words',
      minTokens: 200,
    };
  }

  // 4. Multi-clause or substantial query length (>= 10 words or multiple questions)
  if (wordCount >= 10 || (q.includes('?') && q.split(/[.?!]+/).filter((s) => s.trim().length > 0).length >= 2)) {
    return {
      intent: 'detailed',
      category: 'complex',
      reason: 'Complex or multi-sentence user inquiry',
      targetWords: '80-100 words',
      minTokens: 500,
    };
  }

  // 5. Greetings & Small Talk -> CONCISE (20-30 words)
  const greetingRegex = /^(?:hi|hello|hey|heya|howdy|sup|yo|greetings|salutations|good\s+(?:morning|afternoon|evening|night|day))\b/i;
  const smallTalkRegex = /^(?:how\s+are\s+you|how\s+r\s+u|how\s+(?:are\s+things|is\s+it\s+going)|what(?:\x27s|\s+is)\s+up|what\s+are\s+you|who\s+are\s+you|what\s+can\s+you\s+do|nice\s+to\s+meet\s+you|bye|goodbye|see\s+ya|ping|test)\b/i;

  if (wordCount <= 6 && (greetingRegex.test(q) || smallTalkRegex.test(q))) {
    return {
      intent: 'concise',
      category: 'greeting',
      reason: 'Simple greeting or short small talk',
      targetWords: '20-30 words',
      minTokens: 200,
    };
  }

  // 6. General inquiries (e.g. "What is photosynthesis?", "Who was Ada Lovelace?"):
  // Default to detailed/comprehensive (70-100 words) so users never receive 10-word fragments!
  return {
    intent: 'detailed',
    category: 'general',
    reason: 'General inquiry requiring complete, well-developed answer',
    targetWords: '70-100 words',
    minTokens: 500,
  };
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

  const lengthProfile = detectQueryLengthIntent(query);
  const targetTokens = Math.max(persona.maxTokens || 350, lengthProfile.minTokens);

  const primary = resolvePersonaProviderConfig(persona, false, targetTokens);
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
    const fb = resolvePersonaProviderConfig(persona, true, targetTokens);
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
    systemContent += `\n\nRespond only in: ${lang}. Strictly output your response in ${lang} while maintaining your personality style and adhering to your adaptive length rules.`;
  }

  // Inject mandatory current turn directive based on detected intent
  let turnDirective = '';
  if (lengthProfile.intent === 'concise') {
    if (lengthProfile.category === 'acknowledgment') {
      let ackGuidance = '';
      if (persona.id === 'nova') {
        ackGuidance =
          'As NOVA (Professional & Factual): provide a crisp, natural confirmation or statement of readiness (e.g. "Acknowledged. Standing by for your next directive or topic.") with zero fluff or emojis. Do NOT say you are confused or ask the user to ask again.';
      } else if (persona.id === 'orbit') {
        ackGuidance =
          'As ORBIT (Casual & Friendly): give a brief, cheerful confirmation or friendly sign-off with an emoji (e.g. "Awesome, you got it! Let me know if you need anything else! ✨") without inventing any story or going off-topic.';
      } else {
        ackGuidance =
          'As COSMOS (Calm & Wise): offer a tranquil, warm, and gentle acknowledgment (e.g. "You are very welcome. Take your time, and I am here whenever you wish to proceed.") without introducing a new unrelated topic.';
      }

      turnDirective = `\n\n[MANDATORY CURRENT TURN INSTRUCTION - CONCISE ACKNOWLEDGMENT MODE]:
- The user sent a simple acknowledgment or short reaction: "${query.trim()}".
- Keep your response brief, natural, and concise (around 15 to 30 words).
- STRICTLY FORBIDDEN:
  • Do NOT invent a new story, fable, or narrative.
  • Do NOT go off-topic or introduce unrelated concepts.
  • Do NOT output a confused response asking the user to repeat, rephrase, or "think about that differently".
- Simply acknowledge, confirm, or state readiness for the next topic in your own authentic persona voice.
- ${ackGuidance}
- Conclude on a complete, finished sentence.`;
    } else {
      turnDirective = `\n\n[MANDATORY CURRENT TURN INSTRUCTION - CONCISE GREETING / SMALL TALK MODE]:
- The user is offering a brief greeting or casual small talk: "${query.trim()}".
- Keep your response concise, sharp, and friendly (around 20 to 30 words).
- End on a complete, finished sentence.`;
    }
  } else {
    let personaGuidance = '';
    if (persona.id === 'nova') {
      personaGuidance = 'As NOVA (Professional & Factual), write an informative, precise, and descriptive narrative or explanation with zero fluff or emojis.';
    } else if (persona.id === 'orbit') {
      personaGuidance = 'As ORBIT (Casual & Friendly), tell an exciting, fun, and engaging story or explanation with lively banter and emojis.';
    } else {
      personaGuidance = 'As COSMOS (Calm & Wise), share a tranquil, evocative, and thoughtful story or philosophical reflection.';
    }

    turnDirective = `\n\n[MANDATORY CURRENT TURN INSTRUCTION - DETAILED / STORYTELLING MODE]:
- The user is explicitly requesting a story, explanation, or detailed breakdown: "${query.trim()}".
- You MUST generate an expansive, immersive, and fully developed response of approximately 80 to 100 words.
- STRICTLY FORBIDDEN: Do NOT output a brief 10-20 word fragment. Do NOT compress your response into telegram-style bullet points.
- ${personaGuidance}
- Write full, expressive sentences that fully develop the narrative or explanation.
- CRITICAL: Never cut off mid-sentence. Always conclude on a finished, complete thought within the target length.`;
  }

  systemContent += turnDirective;

  // If previous personas answered in this turn, provide their answers as live turn context
  let userContent = query.trim();
  if (priorTurnResponses && priorTurnResponses.length > 0) {
    const validPrior = priorTurnResponses.filter((p) => p.text && p.text.trim());
    if (validPrior.length > 0) {
      const priorContext = validPrior
        .map((p) => `• ${p.name.toUpperCase()} said:\n"${p.text.trim()}"`)
        .join('\n\n');

      const ackNote =
        lengthProfile.category === 'acknowledgment'
          ? '\n(Since the user gave a simple acknowledgment, stay brief and natural. Do NOT start a new story, debate, or go off-topic based on what other personas said.)'
          : '\n(You may react to, agree/disagree with, or build on what they said, while answering the user in your own voice and following your adaptive length rules.)';

      userContent += `\n\n=== CONTEXT FROM OTHER PERSONAS THIS TURN ===\n${priorContext}\n============================================${ackNote}`;
    }
  }

  // Reinforce length requirement directly in the user prompt as well
  if (lengthProfile.intent === 'detailed') {
    userContent += `\n\n(Please write a rich, complete response of around 80-100 words in your voice. Do not summarize into a few words or fragments.)`;
  } else if (lengthProfile.intent === 'concise') {
    if (lengthProfile.category === 'acknowledgment') {
      userContent += `\n\n(Acknowledge naturally and briefly in around 15-30 words. Do not invent a story or ask to rephrase.)`;
    } else {
      userContent += `\n\n(Keep reply concise, around 20-30 words.)`;
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
      maxTokens: Math.max(persona.maxTokens || 350, lengthProfile.minTokens, 500),
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
        query,
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
