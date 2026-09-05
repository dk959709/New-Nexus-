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
  if (alphaChars.length < 3) {
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
    if (words.length >= 2 && alphaChars.length >= 5) {
      cleanCandidates.unshift(seg);
      // Stop after collecting 1 or 2 clean contiguous sentences
      if (cleanCandidates.length >= 2) break;
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
    // Attempt targeted extraction from reasoning trace first (e.g. last clean sentence, draft, or quote)
    const extractedFromReasoning = extractFinalAnswerFromReasoning(fallbackRaw, personaName);
    if (extractedFromReasoning.length > 0 && extractedFromReasoning !== FALLBACK_REPLY) {
      return extractedFromReasoning;
    }

    // Secondary fallback: general sanitization filter
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
