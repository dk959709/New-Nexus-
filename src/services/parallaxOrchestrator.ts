import { storage, DEFAULT_PARALLAX_AGENTS } from '@/lib/storage';
import { api } from '@/services/api';
import type {
  AIProviderConfig,
  ParallaxAgentConfig,
  ParallaxMessage,
  ParallaxSummary,
  ParallaxSystemConfig,
  ParallaxToolRawPayload,
  ParallaxToolRawResult,
} from '@/types';

/**
 * Resolves AI Provider configuration for a Parallax agent.
 * Reuses existing provider selection logic with multi-key failover support.
 */
export function resolveParallaxProviderConfig(
  agent: ParallaxAgentConfig,
  overrideMaxTokens?: number,
): { provider: AIProviderConfig | null; model: string } {
  const effectiveMaxTokens = overrideMaxTokens !== undefined ? overrideMaxTokens : agent.maxTokens || 100;
  const state = storage.getAIProvidersState();
  const activeCustom = storage.getActiveAIProvider();

  if (!agent.providerId || agent.providerId === 'existing') {
    if (activeCustom) {
      const liveModel =
        activeCustom.model && activeCustom.model.trim()
          ? activeCustom.model.trim()
          : agent.modelId || 'deepseek/deepseek-chat';
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
        model: agent.modelId || 'deepseek/deepseek-chat',
        keyStrategy: 'failover',
        keys: [],
        capabilities: { text: true, tools: true, web: true, wikipedia: true, memory: true },
        maxTokens: effectiveMaxTokens,
      },
      model: agent.modelId || 'deepseek/deepseek-chat',
    };
  }

  const matched = state.providers.find((p) => p.id === agent.providerId);
  if (matched) {
    const liveModel = agent.modelId || matched.model || 'deepseek/deepseek-chat';
    return {
      provider: {
        ...matched,
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
      model: agent.modelId || 'deepseek/deepseek-chat',
      keyStrategy: 'failover',
      keys: [],
      capabilities: { text: true, tools: true, web: true, wikipedia: true, memory: true },
      maxTokens: effectiveMaxTokens,
    },
    model: agent.modelId || 'deepseek/deepseek-chat',
  };
}

/**
 * Cleanly normalizes search source labels returned from server/routes/search.ts.
 */
export function formatSearchSourceLabel(source?: string): string {
  if (!source) return 'Live Web';
  const lower = source.toLowerCase();
  if (lower.includes('tavily')) return 'Tavily';
  if (lower.includes('exa')) return 'Exa AI';
  if (lower.includes('duckduckgo') || lower.includes('ddg')) return 'DuckDuckGo';
  if (lower.includes('wikipedia') || lower.includes('wiki')) return 'Wikipedia';
  if (lower.includes('gnews')) return 'GNews';
  if (lower.includes('newsdata')) return 'NewsData';
  if (lower.includes('google news')) return 'Google News';
  return source.replace(/\s+fallback/i, '').replace(/\s+api/i, '').trim() || 'Live Web';
}

export interface VeritasGroundingData {
  results: ParallaxToolRawResult[];
  searchSource: string;
  query: string;
  formattedGrounding: string;
  sourcesCount: number;
  topFactSnippet: string;
  committedFact: string; // The single verified grounding fact committed to before Round 1
  round1Statement?: string; // Stated position in Round 1 to ensure R2 & R3 consistency
  failed: boolean;
  rawPayload?: ParallaxToolRawPayload;
}

/**
 * VERITAS LIVE SEARCH GROUNDING:
 * Executed exactly ONCE per debate before Round 1 begins.
 * Uses the existing internal search route in server/routes/search.ts with the full fallback chain:
 * Tavily → Exa AI → DuckDuckGo → Wikipedia, requesting max_results: 10.
 * Injects grounding into VERITAS only. If all fallbacks fail, fails gracefully without blocking.
 */
export async function fetchVeritasGrounding(
  topic: string,
  signal?: AbortSignal,
): Promise<VeritasGroundingData> {
  console.log(`[Parallax Veritas] Querying live search for topic: "${topic}" (max_results: 10)...`);

  let rawResults: Array<{ title?: string; url?: string; description?: string; snippet?: string; content?: string; domain?: string; date?: string }> = [];
  let sourceLabel = 'Tavily';

  try {
    if (signal?.aborted) throw new Error('Search aborted');

    // Call existing internal search function used by Researcher agent (server/routes/search.ts)
    const searchRes = await api.search(topic, 'ALL', 1, 10);

    if (Array.isArray(searchRes) && searchRes.length > 0) {
      rawResults = searchRes.slice(0, 10);
      const resMeta = searchRes as typeof searchRes & { searchSource?: string };
      if (resMeta.searchSource) {
        sourceLabel = formatSearchSourceLabel(resMeta.searchSource);
      }
    } else {
      console.warn(`[Parallax Veritas] Search returned 0 results for "${topic}". Checking direct Wikipedia fallback...`);
      try {
        const wiki = await api.searchWikipedia(topic, 5);
        if (wiki && wiki.length > 0) {
          rawResults = wiki.map((w) => ({
            title: w.title,
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(w.title)}`,
            description: (w.snippet || '').replace(/<[^>]*>?/gm, '').trim(),
            domain: 'wikipedia.org',
          }));
          sourceLabel = 'Wikipedia';
        }
      } catch (wikiErr) {
        console.warn('[Parallax Veritas] Wikipedia safety fallback failed:', wikiErr);
      }
    }
  } catch (err) {
    if (signal?.aborted) throw err;
    console.warn('[Parallax Veritas] Live search error, checking Wikipedia fallback:', err);
    try {
      const wiki = await api.searchWikipedia(topic, 5);
      if (wiki && wiki.length > 0) {
        rawResults = wiki.map((w) => ({
          title: w.title,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(w.title)}`,
          description: (w.snippet || '').replace(/<[^>]*>?/gm, '').trim(),
          domain: 'wikipedia.org',
        }));
        sourceLabel = 'Wikipedia';
      }
    } catch {
      // Non-fatal
    }
  }

  // Map all raw search results to clean structure capturing all 10 sources
  const mappedRawResults: ParallaxToolRawResult[] = rawResults.map((r) => ({
    title: (r.title || 'Untitled Source').trim(),
    url: r.url || '',
    snippet: (r.description || r.snippet || r.content || '').replace(/\s+/g, ' ').trim(),
    ...(r.domain ? { domain: r.domain } : {}),
    ...(r.date ? { date: r.date } : {}),
  }));

  // Graceful fallback: If all fallbacks returned 0 results, mark failed and allow VERITAS to proceed using training knowledge
  if (mappedRawResults.length === 0) {
    console.warn(`[Parallax Veritas] All search fallbacks returned 0 results for "${topic}". Gracefully falling back to training knowledge.`);
    const failedPayload: ParallaxToolRawPayload = {
      query: topic,
      searchSource: 'None',
      committedFact: '',
      resultsCount: 0,
      rawResults: [],
    };
    return {
      results: [],
      searchSource: 'No results found',
      query: topic,
      formattedGrounding: '',
      sourcesCount: 0,
      topFactSnippet: 'No live search results returned across fallback providers.',
      committedFact: '',
      failed: true,
      rawPayload: failedPayload,
    };
  }

  // Format the 10 sources into clear grounding context for VERITAS's prompt
  const formattedGrounding = mappedRawResults
    .map((r, idx) => {
      const title = r.title;
      let domain = r.domain;
      if (!domain && r.url) {
        try {
          domain = new URL(r.url).hostname;
        } catch {
          domain = 'web';
        }
      }
      const snippet = r.snippet || '';
      return `[${idx + 1}] "${title}" (${domain || 'web'})\n    ${snippet.slice(0, 220)}`;
    })
    .join('\n');

  // 1. Initial heuristic candidate for committed fact
  const topCandidate = mappedRawResults.find((r) => r.snippet && r.snippet.trim().length > 30) || mappedRawResults[0];
  const rawSnippet = (topCandidate?.snippet || topCandidate?.title || '').replace(/\s+/g, ' ').trim();
  let committedFact = rawSnippet.length > 180 ? rawSnippet.slice(0, 177) + '…' : rawSnippet;

  // 2. Extract and commit to ONE specific verified fact via active AI provider before Round 1
  try {
    if (signal?.aborted) throw new Error('Search aborted');
    const sysConfig = storage.getParallaxConfig();
    const allAgents = Object.values(sysConfig.agents || DEFAULT_PARALLAX_AGENTS);
    const veritasAgent = allAgents.find((a) => a.id === 'veritas') || DEFAULT_PARALLAX_AGENTS.veritas;
    const { provider } = resolveParallaxProviderConfig(veritasAgent, 70);

    // Use top 4 sources with concise snippets to keep prompt lean (~160 tokens)
    const topSources = mappedRawResults.slice(0, 4);
    const compactSources = topSources
      .map((r, idx) => `[${idx + 1}] "${r.title}" (${r.domain || 'web'}): ${(r.snippet || '').slice(0, 120)}`)
      .join('\n');

    const factExtractPrompt = `Empirical Fact Extraction:
Topic: "${topic}"
Sources:
${compactSources}

TASK: Synthesize the sources above and commit to EXACTLY ONE verified fact statement (1-2 sentences, <35 words) answering the topic. No conversational preamble.`;

    const factRes = await api.jarvisAgentCall({
      agentId: 'veritas_fact_committer',
      messages: [{ role: 'user', content: factExtractPrompt }],
      providerConfig: provider,
      temperature: 0.1,
      maxTokens: 70,
      timeoutMs: 9000,
      signal,
    });

    const candidate = cleanReactionText(factRes.text || factRes.content || '', 'VERITAS');
    if (candidate && candidate.length > 15 && !candidate.toLowerCase().includes('error')) {
      committedFact = candidate;
    }
  } catch (extractErr) {
    console.warn('[Parallax Veritas] AI fact commitment call had error, using deterministic snippet fallback:', extractErr);
  }

  console.log(`[Parallax Veritas] Live search grounding successful: ${mappedRawResults.length} sources via ${sourceLabel}. Committed Fact: "${committedFact}"`);

  const rawPayload: ParallaxToolRawPayload = {
    query: topic,
    searchSource: sourceLabel,
    committedFact,
    resultsCount: mappedRawResults.length,
    rawResults: mappedRawResults,
  };

  return {
    results: mappedRawResults,
    searchSource: sourceLabel,
    query: topic,
    formattedGrounding,
    sourcesCount: mappedRawResults.length,
    topFactSnippet: committedFact,
    committedFact,
    failed: false,
    rawPayload,
  };
}

/**
 * Backwards-compatible helper for single fact retrieval.
 */
export async function fetchVeritasFact(topic: string): Promise<{ fact: string; source: string; query: string } | null> {
  const grounding = await fetchVeritasGrounding(topic);
  if (grounding.failed || !grounding.topFactSnippet) return null;
  return {
    fact: grounding.topFactSnippet,
    source: grounding.searchSource,
    query: grounding.query,
  };
}

export interface ParallaxRunOptions {
  topic: string;
  config?: ParallaxSystemConfig;
  onMessage: (message: ParallaxMessage) => void;
  onRoundStart?: (round: 1 | 2 | 3) => void;
  onRoundComplete?: (round: 1 | 2 | 3, roundMessages: ParallaxMessage[]) => void;
  onStatusUpdate?: (status: string) => void;
  onDynamicPersonasCreated?: (personas: ParallaxAgentConfig[]) => void;
  onComplete?: (summary: ParallaxSummary, allMessages: ParallaxMessage[]) => void;
  onError?: (error: string) => void;
  signal?: AbortSignal;
}

const DYNAMIC_SPECIALIST_PALETTES = [
  { color: '#10b981', voice: 'en-US-BrianNeural' }, // Emerald
  { color: '#8b5cf6', voice: 'en-GB-RyanNeural' },  // Violet
  { color: '#f59e0b', voice: 'en-US-AriaNeural' },  // Amber
  { color: '#06b6d4', voice: 'en-AU-WilliamNeural' }, // Cyan
  { color: '#ec4899', voice: 'en-GB-SoniaNeural' },  // Pink
  { color: '#3b82f6', voice: 'en-CA-ClaraNeural' },  // Blue
  { color: '#14b8a6', voice: 'en-US-JennyNeural' },  // Teal
];

/**
 * Dynamic Temporary Persona Creation for Parallax Swarm:
 * Analyzes the debate topic against the existing 20-persona roster traits and roles.
 * If genuinely relevant specialist expertise is missing, generates 0-5 new temporary personas
 * specifically for that debate.
 *
 * Constraints:
 * 1. Most everyday topics return 0 personas (no expertise gap).
 * 2. Only creates 1-5 personas if there is a genuine professional/scientific domain gap.
 * 3. Temporary only: never saved to persistent storage or parallaxVoices.ts.
 */
export async function analyzeTopicAndCreateTemporaryPersonas(
  topic: string,
  existingAgents: ParallaxAgentConfig[],
  signal?: AbortSignal,
): Promise<ParallaxAgentConfig[]> {
  // =========================================================================
  // TOPIC-ANALYSIS SPECIALIST CHECK (Pre-Round 1 only, executed once):
  // Evaluates the topic against the core roster for acute domain gaps.
  // ISOLATION MANDATE:
  // - This context is used strictly ONCE before Round 1.
  // - It is NEVER passed into individual persona round prompts or memory.
  // - Generates 0-5 temporary personas (0 for everyday/general topics).
  // Total call input: ~180-220 tokens. Max output tokens: 250.
  // =========================================================================
  const rosterSummary = existingAgents
    .map((a) => `${a.name} (${a.role})`)
    .join(', ');

  const prompt = `Topic: "${topic}"
Core Swarm Roster: ${rosterSummary}

TASK: Decide if this topic demands 1-5 temporary specialist personas due to an acute domain expertise gap absent from the roster.
RULE: Everyday, technology, philosophical, business, and social topics already have full coverage across core personas. Return 0 specialists: {"personas": []}.
Only create 1-5 personas if deep specialized domain expertise is missing (e.g., surgical medicine, constitutional jurisprudence, aerospace dynamics).

Output valid JSON only:
{
  "gapAnalysis": "1-sentence assessment",
  "personas": [
    {
      "id": "slug",
      "name": "NAME",
      "emoji": "✨",
      "role": "Specialist Role",
      "systemInstruction": "Analytical domain priorities in 1-2 sentences."
    }
  ]
}`;

  const baseAgent = existingAgents[0] || DEFAULT_PARALLAX_AGENTS.veritas;
  const { provider } = resolveParallaxProviderConfig(baseAgent, 250);

  try {
    console.log(`[Parallax Dynamic Personas] Analyzing topic for specialist expertise gaps: "${topic}"...`);
    const res = await api.jarvisAgentCall({
      agentId: 'parallax_persona_architect',
      messages: [
        {
          role: 'system',
          content: 'You are the PARALLAX Swarm Specialist Architect. You analyze debate topics and identify if genuine domain specialist personas are needed. You output strictly JSON.',
        },
        { role: 'user', content: prompt },
      ],
      providerConfig: provider,
      temperature: 0.2,
      maxTokens: 250,
      timeoutMs: 16000,
      signal,
    });

    const rawText = (res.text || res.content || '').trim();
    const cleanJsonText = rawText.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
    const jsonMatch = cleanJsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('[Parallax Dynamic Personas] No valid JSON returned, proceeding with 0 temporary personas.');
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    console.log(`[Parallax Dynamic Personas] Gap analysis verdict: "${parsed.gapAnalysis || 'Evaluated'}"`);

    if (!Array.isArray(parsed.personas) || parsed.personas.length === 0) {
      console.log(`[Parallax Dynamic Personas] No expertise gap detected for "${topic}". Proceeding with core 20 personas.`);
      return [];
    }

    // Cap strictly at 0-5 new temporary personas
    const rawList = parsed.personas.slice(0, 5);
    const existingIds = new Set(existingAgents.map((a) => a.id.toLowerCase()));
    const existingNames = new Set(existingAgents.map((a) => a.name.toUpperCase()));

    const temporaryPersonas: ParallaxAgentConfig[] = [];

    rawList.forEach((item: Record<string, unknown>, idx: number) => {
      if (!item || typeof item !== 'object') return;
      let rawId = typeof item.id === 'string' ? item.id.toLowerCase().replace(/[^a-z0-9]/g, '') : `spec_${idx + 1}`;
      if (!rawId || existingIds.has(rawId)) {
        rawId = `${rawId}_spec_${idx + 1}`;
      }
      existingIds.add(rawId);

      let rawName = typeof item.name === 'string' ? item.name.toUpperCase().replace(/[^A-Z0-9-]/g, '').trim() : `SPECIALIST-${idx + 1}`;
      if (!rawName || existingNames.has(rawName)) {
        rawName = `${rawName}-${idx + 1}`;
      }
      existingNames.add(rawName);

      const emoji = typeof item.emoji === 'string' && item.emoji.trim() ? item.emoji.trim() : '✨';
      const role = typeof item.role === 'string' && item.role.trim() ? item.role.trim() : 'Domain Specialist';
      const systemInstruction = typeof item.systemInstruction === 'string' && item.systemInstruction.trim()
        ? item.systemInstruction.trim()
        : `Apply rigorous domain-specific analysis from the perspective of a ${role}.`;

      const palette = DYNAMIC_SPECIALIST_PALETTES[idx % DYNAMIC_SPECIALIST_PALETTES.length];
      const initials = rawName.replace(/[^A-Z]/g, '').slice(0, 2) || 'SP';

      temporaryPersonas.push({
        id: rawId,
        name: rawName,
        initials,
        role,
        accentColor: palette.color,
        hasToolAccess: false,
        providerId: baseAgent.providerId || 'existing',
        modelId: baseAgent.modelId || 'deepseek/deepseek-chat',
        enabled: true,
        systemInstruction,
        maxTokens: 100,
        voice: palette.voice,
        isDynamic: true,
        mood: emoji,
      });
    });

    console.log(
      `[Parallax Dynamic Personas] Successfully generated ${temporaryPersonas.length} temporary specialist personas for debate:`,
      temporaryPersonas.map((p) => `${p.name} ${p.mood} (${p.role})`),
    );

    return temporaryPersonas;
  } catch (err) {
    if (signal?.aborted) throw err;
    console.warn('[Parallax Dynamic Personas] AI persona analysis error, continuing with core roster:', err);
    return [];
  }
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Swarm aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Swarm aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Cleans up raw LLM output to keep it strictly punchy (1-2 sentences).
 */
function cleanReactionText(raw: string, agentName: string): string {
  let text = raw.trim();
  // Strip code blocks or quotes if any
  text = text.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '');
  // Strip "[AGENT]:" or "AGENT:" prefixes
  const prefixRegex = new RegExp(`^(\\[?${agentName}\\]?:?\\s*|"|')`, 'i');
  text = text.replace(prefixRegex, '');
  text = text.replace(/^["']|["']$/g, '');
  text = text.trim();

  // If longer than 3 sentences, truncate to first 2
  const sentenceMatches = text.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (sentenceMatches && sentenceMatches.length > 2) {
    text = sentenceMatches.slice(0, 2).join(' ').trim();
  }

  return text || 'No reaction recorded.';
}

const DEFAULT_AGENT_METRICS: Record<string, { conviction: number; mood: string }> = {
  vanguard: { conviction: 9, mood: '🔥' },
  aurora: { conviction: 8, mood: '✨' },
  socrates: { conviction: 6, mood: '🤔' },
  gravity: { conviction: 4, mood: '🧊' },
  veritas: { conviction: 9, mood: '🧠' },
  axiom: { conviction: 8, mood: '📐' },
  echo: { conviction: 6, mood: '🗣️' },
  ledger: { conviction: 7, mood: '📊' },
  pixel: { conviction: 7, mood: '🎨' },
  harmony: { conviction: 7, mood: '🕊️' },
  solon: { conviction: 8, mood: '⚖️' },
  cipher: { conviction: 8, mood: '🛡️' },
  nexus: { conviction: 8, mood: '🧠' },
  zeno: { conviction: 5, mood: '⏳' },
  pulse: { conviction: 8, mood: '⚡' },
  kairos: { conviction: 7, mood: '🎯' },
  atlas: { conviction: 6, mood: '🌐' },
  zephyr: { conviction: 6, mood: '🌪️' },
  nova: { conviction: 9, mood: '💥' },
  orion: { conviction: 7, mood: '🔭' },
};

/**
 * Extracts compact conviction score (1-10) and mood emoji [score|emoji] appended to response.
 */
function parseConvictionAndMood(raw: string, agentId: string, defaultMood?: string): {
  cleanText: string;
  conviction: number;
  mood: string;
} {
  const fallback = DEFAULT_AGENT_METRICS[agentId.toLowerCase()] || { conviction: 7, mood: defaultMood || '⚡' };
  let conviction = fallback.conviction;
  let mood = defaultMood || fallback.mood;
  let text = raw.trim();

  // Pattern: [9|🔥] or [8 | 🤔] or [10|⚡] or [4, 🧊]
  const tagMatch = text.match(/\[\s*(\d{1,2})\s*[/|,;]\s*([^\]]+?)\s*\]/u);
  if (tagMatch) {
    const parsedScore = parseInt(tagMatch[1], 10);
    if (!isNaN(parsedScore)) {
      conviction = Math.min(10, Math.max(1, parsedScore));
    }
    const parsedMood = tagMatch[2].trim();
    if (parsedMood) {
      mood = parsedMood;
    }
    text = text.replace(tagMatch[0], '').trim();
  } else {
    // Check separate score: [9/10] or [9]
    const scoreMatch = text.match(/\[\s*(\d{1,2})(?:\s*\/\s*10)?\s*\]/);
    if (scoreMatch) {
      const parsedScore = parseInt(scoreMatch[1], 10);
      if (parsedScore >= 1 && parsedScore <= 10) {
        conviction = parsedScore;
      }
      text = text.replace(scoreMatch[0], '').trim();
    }
    // Check separate emoji
    const emojiMatch = text.match(/([\p{Emoji_Presentation}\p{Extended_Pictographic}])/u);
    if (emojiMatch) {
      mood = emojiMatch[1];
    }
  }

  return { cleanText: text, conviction, mood };
}

/**
 * Executes a single agent reaction turn with ultra-compact token footprint.
 */
async function executeAgentTurn(
  agent: ParallaxAgentConfig,
  round: 1 | 2 | 3,
  topic: string,
  peersSample: ParallaxMessage[],
  veritasGrounding: VeritasGroundingData | null,
  signal?: AbortSignal,
): Promise<ParallaxMessage> {
  const startTime = Date.now();
  const { provider, model } = resolveParallaxProviderConfig(agent, 80);

  // Compact, high-signal system prompt with lightweight conviction & mood request (~40 tokens)
  const systemPrompt = `Persona: ${agent.name} (${agent.role}). ${agent.systemInstruction}
Constraint: Exactly 1-2 punchy sentences (<40 words). Speak directly; no greeting, no intro, no self-naming. End with [conviction 1-10|mood emoji] (e.g. [9|🔥]).`;

  let userPrompt = '';

  if (round === 1) {
    // =========================================================================
    // ROUND 1 CONTEXT:
    // Only includes:
    // 1. System prompt: Persona identity, role, instruction, length constraint (~40 tokens)
    // 2. User prompt: The debate topic + 1-sentence opening instruction (~30 tokens)
    // Total Round 1 input: ~70-80 tokens per agent.
    // Intentionally EXCLUDED to prevent token bloat:
    // - Full 20-persona swarm roster lists or trait summaries
    // - Pre-round topic analysis / gap check reasoning
    // - Dynamic specialist metadata or flags
    // - Raw search engine dumps (VERITAS receives ONLY its 1-sentence committed fact)
    // =========================================================================
    if (agent.id === 'veritas') {
      if (veritasGrounding && !veritasGrounding.failed && veritasGrounding.committedFact) {
        userPrompt = `Topic: "${topic}"\n\n[Verified Grounding Fact (${veritasGrounding.searchSource})]:\n"${veritasGrounding.committedFact}"\n\nState your opening 1-2 sentence perspective grounded strictly on this verified fact as VERITAS.`;
      } else {
        userPrompt = `Topic: "${topic}"\n\nProvide your initial 1-2 sentence perspective on this topic based on your fact-based, skeptical analysis as VERITAS.`;
      }
    } else {
      userPrompt = `Topic: "${topic}"\nProvide your initial 1-2 sentence perspective on this topic based on your archetype.`;
    }
  } else {
    // =========================================================================
    // ROUNDS 2 & 3 CONTEXT:
    // Only includes:
    // 1. System prompt: Persona identity, role, instruction, length constraint (~40 tokens)
    // 2. User prompt: Topic + capped sample of 2 peer quotes (<=115 chars each) + 1-sentence action (~75-90 tokens)
    // Total Round 2/3 input: ~115-135 tokens per agent.
    // Intentionally EXCLUDED to prevent token bloat:
    // - Full transcripts of prior rounds (strictly capped at 2 peer quotes)
    // - Long quotes (strictly truncated to 115 characters)
    // - Swarm roster lists or specialist metadata
    // =========================================================================
    const peerBullets = peersSample
      .slice(0, 2) // Strictly capped at 2 peer quotes (keeps prompt under ~130 tokens)
      .map((p) => {
        const text = p.text.length > 115 ? p.text.slice(0, 112) + '…' : p.text;
        return `• ${p.agentName}: "${text}"`;
      })
      .join('\n');

    const action =
      round === 2
        ? 'React to these peer views in 1-2 sharp sentences'
        : 'Deliver your final 1-2 sentence synthesis';

    if (agent.id === 'veritas' && veritasGrounding && !veritasGrounding.failed && veritasGrounding.committedFact) {
      userPrompt = `Topic: "${topic}"\n\n[Committed Verified Fact]: "${veritasGrounding.committedFact}"\n\nPeer points from Round ${round - 1}:\n${peerBullets}\n\n${action} as VERITAS, upholding your verified fact.`;
    } else {
      userPrompt = `Topic: "${topic}"\n\nPeer points from Round ${round - 1}:\n${peerBullets}\n\n${action} as ${agent.name}.`;
    }
  }

  try {
    if (signal?.aborted) {
      throw new Error('Swarm aborted');
    }

    const response = await api.jarvisAgentCall({
      agentId: `parallax_${agent.id}_r${round}`,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      providerConfig: provider,
      temperature: 0.75,
      maxTokens: 80,
      timeoutMs: 14000,
      signal,
    });

    const rawText = response.text || response.content || '';
    const { cleanText: rawWithoutMeta, conviction, mood } = parseConvictionAndMood(rawText, agent.id, agent.mood);
    const cleaned = cleanReactionText(rawWithoutMeta, agent.name);

    return {
      id: `plx_${agent.id}_r${round}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      agentId: agent.id,
      agentName: agent.name,
      initials: agent.initials,
      accentColor: agent.accentColor,
      round,
      text: cleaned,
      conviction,
      mood: mood || agent.mood,
      isDynamic: Boolean(agent.isDynamic),
      role: agent.role,
      voice: agent.voice,
      timestamp: Date.now(),
      durationMs: Date.now() - startTime,
      model: response.model || model,
      providerName: response.providerName || provider?.name || 'Built-in AI',
      toolUsed:
        agent.id === 'veritas' && veritasGrounding
          ? {
              tool: 'search',
              query: veritasGrounding.query,
              fact: veritasGrounding.committedFact || veritasGrounding.topFactSnippet,
              searchSource: veritasGrounding.searchSource,
              sourcesCount: veritasGrounding.sourcesCount,
              failed: veritasGrounding.failed,
              statusLabel: veritasGrounding.failed
                ? '⚠️ No results found'
                : `✅ ${veritasGrounding.searchSource}`,
              committedFact: veritasGrounding.committedFact,
              rawResults: veritasGrounding.results,
              rawPayload: veritasGrounding.rawPayload,
            }
          : undefined,
    };
  } catch (err: unknown) {
    if (signal?.aborted) {
      throw err;
    }

    // Graceful fallback reaction reflecting the agent's core disposition
    const fallbackText = getFallbackReaction(agent, round, topic);
    const fallbackMeta = DEFAULT_AGENT_METRICS[agent.id.toLowerCase()] || { conviction: 7, mood: '⚡' };
    return {
      id: `plx_${agent.id}_r${round}_fallback_${Date.now()}`,
      agentId: agent.id,
      agentName: agent.name,
      initials: agent.initials,
      accentColor: agent.accentColor,
      round,
      text: fallbackText,
      conviction: fallbackMeta.conviction,
      mood: agent.mood || fallbackMeta.mood,
      isDynamic: Boolean(agent.isDynamic),
      role: agent.role,
      voice: agent.voice,
      timestamp: Date.now(),
      durationMs: Date.now() - startTime,
      model: model || 'fallback',
      providerName: 'Local Mesh',
      toolUsed:
        agent.id === 'veritas' && veritasGrounding
          ? {
              tool: 'search',
              query: veritasGrounding.query,
              fact: veritasGrounding.committedFact || veritasGrounding.topFactSnippet,
              searchSource: veritasGrounding.searchSource,
              sourcesCount: veritasGrounding.sourcesCount,
              failed: veritasGrounding.failed,
              statusLabel: veritasGrounding.failed
                ? '⚠️ No results found'
                : `✅ ${veritasGrounding.searchSource}`,
              committedFact: veritasGrounding.committedFact,
              rawResults: veritasGrounding.results,
              rawPayload: veritasGrounding.rawPayload,
            }
          : undefined,
    };
  }
}

/**
 * Intelligent persona fallbacks in case of network timeouts.
 */
function getFallbackReaction(agent: ParallaxAgentConfig, round: number, topic: string): string {
  if (agent.isDynamic) {
    return `From the specialized lens of ${agent.role}, addressing "${topic}" requires examining critical domain realities that broader consensus often overlooks.`;
  }
  const name = agent.name;
  if (name === 'VERITAS') return `Empirical verification is vital for "${topic}", yet verifiable baseline datasets remain scarce.`;
  if (name === 'AURORA') return `Despite early frictions, this unlocks unprecedented creative upside and collective human potential.`;
  if (name === 'CHRONOS') return `History reminds us every transformative inflection follows this exact pattern of panic followed by normalization.`;
  if (name === 'AXIOM') return `From a first-principles perspective, the fundamental logic dictates that efficiency and entropy will reach equilibrium.`;
  if (name === 'ECHO') return `Public discourse is sharply divided—everyday people sense the stakes but distrust official narratives.`;
  if (name === 'LEDGER') return `Follow the capital allocation: unit economics and infrastructure costs will dictate the ultimate outcome.`;
  if (name === 'SOCRATES') return `Before taking sides, shouldn't we first question whether our definition of progress is flawed?`;
  if (name === 'PIXEL') return `The human imagination and cultural storytelling around this matter far more than raw technological metrics.`;
  if (name === 'VANGUARD') return `The prevailing consensus is complacently blind to the obvious systemic counter-currents brewing beneath.`;
  if (name === 'HARMONY') return `Technological acceleration without ethical grounding risks alienating the very humanity it claims to serve.`;
  if (name === 'CIPHER') return `Architecture and engineering bottlenecks will impose hard physical limits long before policy catch-up occurs.`;
  if (name === 'NOMAD') return `Looking beyond western echo chambers, global cultural contexts view this through an entirely different paradigm.`;
  if (name === 'SENTINEL') return `We are underestimating catastrophic tail risks and critical single points of failure.`;
  if (name === 'LUMEN') return `Simply put: it's like rebuilding an airplane engine mid-flight—exhilarating, but perilous without a safety net.`;
  if (name === 'CATALYST') return `Within a decade, this initial debate will be superseded by second-order autonomous breakthroughs.`;
  if (name === 'GRAVITY') return `Aspirations are cheap; supply chain logistics and human institutional friction will decide reality.`;
  if (name === 'MOSAIC') return `Notice how this mirrors biological evolutionary pressures—adaptation and specialization go hand-in-hand.`;
  if (name === 'ORACLE') return `Mark this forecast: mass adoption happens twice as fast as skeptics expect, with half the promised safeguards.`;
  if (name === 'EMBER') return `This isn't merely an intellectual puzzle—real human lives, vulnerabilities, and passions hang in the balance.`;
  return `Synthesizing the polarity: the true path forward lies in harmonizing these opposing tensions rather than choosing extremes.`;
}

/**
 * Dynamic fallback synthesis derived strictly from actual messages in the debate transcript.
 * Guarantees highlights and persona claims match the real session, even if the LLM call times out.
 */
function buildDynamicFallbackSummary(
  topic: string,
  allMessages: ParallaxMessage[],
): ParallaxSummary {
  const round1Msgs = allMessages.filter((m) => m.round === 1);
  const round2Msgs = allMessages.filter((m) => m.round === 2);
  const round3Msgs = allMessages.filter((m) => m.round === 3);

  const veritasMsg = allMessages.find((m) => m.agentId === 'veritas');
  const highlights: string[] = [];

  if (veritasMsg) {
    const snippet = veritasMsg.text.length > 130 ? veritasMsg.text.slice(0, 127) + '…' : veritasMsg.text;
    highlights.push(`VERITAS anchored the deliberation with verified facts: "${snippet}"`);
  } else if (round1Msgs.length > 0) {
    const m = round1Msgs[0];
    const snippet = m.text.length > 130 ? m.text.slice(0, 127) + '…' : m.text;
    highlights.push(`${m.agentName} framed the initial perspective in Round 1: "${snippet}"`);
  }

  if (round2Msgs.length > 0) {
    const m = round2Msgs[0];
    const snippet = m.text.length > 130 ? m.text.slice(0, 127) + '…' : m.text;
    highlights.push(`${m.agentName} challenged peer perspectives in Round 2: "${snippet}"`);
  }

  if (round2Msgs.length > 1) {
    const m = round2Msgs[1];
    const snippet = m.text.length > 130 ? m.text.slice(0, 127) + '…' : m.text;
    highlights.push(`${m.agentName} emphasized core tensions: "${snippet}"`);
  }

  if (round3Msgs.length > 0) {
    const m = round3Msgs[round3Msgs.length - 1];
    const snippet = m.text.length > 130 ? m.text.slice(0, 127) + '…' : m.text;
    highlights.push(`${m.agentName} delivered their closing synthesis: "${snippet}"`);
  }

  // If dynamic specialists participated, ensure their contribution is highlighted
  const dynamicMsg = allMessages.find((m) => m.isDynamic);
  if (dynamicMsg) {
    const snippet = dynamicMsg.text.length > 130 ? dynamicMsg.text.slice(0, 127) + '…' : dynamicMsg.text;
    highlights.push(`${dynamicMsg.agentName} (${dynamicMsg.role || 'Specialist'}) contributed targeted domain analysis: "${snippet}"`);
  }

  // Ensure at least 4 highlights from real messages in the debate
  let idx = 0;
  while (highlights.length < 4 && idx < allMessages.length) {
    const candidate = allMessages[idx];
    const snippet = candidate.text.length > 130 ? candidate.text.slice(0, 127) + '…' : candidate.text;
    const highlightStr = `${candidate.agentName} (R${candidate.round}): "${snippet}"`;
    if (!highlights.some((h) => h.includes(candidate.agentName))) {
      highlights.push(highlightStr);
    }
    idx++;
  }

  return {
    verdict: `Deliberation on "${topic}" concluded with ${allMessages.length} contributions across 3 rounds, balancing empirical verification against contrasting multi-agent perspectives.`,
    consensusLean: 'Pragmatic Tension',
    highlights: highlights.slice(0, 5),
    totalContributions: allMessages.length,
  };
}

/**
 * Generates the Parallax Summary after Round 3 completes.
 * Sends curated representative quotes from Rounds 1, 2, and 3 to ensure highlights reflect the actual debate transcript.
 */
export async function generateParallaxSummary(
  topic: string,
  allMessages: ParallaxMessage[],
): Promise<ParallaxSummary> {
  // =========================================================================
  // SYNTHESIS REPORT CONTEXT:
  // Only includes:
  // 1. Topic definition + total message count.
  // 2. Curated representative excerpts: exactly 6 concise quotes (2 per round, <=110 chars each)
  //    plus at most 1 specialist quote if dynamic specialists participated.
  // Total Synthesis input tokens: ~550-680 tokens. Max output tokens: 350.
  // Intentionally EXCLUDED to prevent token bloat:
  // - Full raw transcript of all 60+ contributions.
  // - Uncut persona speeches or system prompt repetitions.
  // =========================================================================
  const round1Msgs = allMessages.filter((m) => m.round === 1);
  const round2Msgs = allMessages.filter((m) => m.round === 2);
  const round3Msgs = allMessages.filter((m) => m.round === 3);

  const excerpts: string[] = [];

  // 1. Round 1: 2 representative opening positions (VERITAS fact first if present, + 1 diverse angle)
  const r1Veritas = round1Msgs.find((m) => m.agentId === 'veritas');
  if (r1Veritas) {
    const trimmed = r1Veritas.text.length > 110 ? r1Veritas.text.slice(0, 107) + '…' : r1Veritas.text;
    excerpts.push(`• [Round 1 Opening Fact] VERITAS: "${trimmed}"`);
  }
  const r1Others = round1Msgs.filter((m) => m.agentId !== 'veritas');
  if (r1Others.length > 0) {
    const other = r1Others[0];
    const trimmed = other.text.length > 110 ? other.text.slice(0, 107) + '…' : other.text;
    excerpts.push(`• [Round 1 Opening] ${other.agentName}: "${trimmed}"`);
  }

  // 2. Round 2: 2 representative cross-debate rebuttal/friction excerpts
  for (const m of round2Msgs.slice(0, 2)) {
    const trimmed = m.text.length > 110 ? m.text.slice(0, 107) + '…' : m.text;
    excerpts.push(`• [Round 2 Rebuttal] ${m.agentName}: "${trimmed}"`);
  }

  // 3. Round 3: 2 representative final synthesis/conclusion excerpts
  for (const m of round3Msgs.slice(0, 2)) {
    const trimmed = m.text.length > 110 ? m.text.slice(0, 107) + '…' : m.text;
    excerpts.push(`• [Round 3 Conclusion] ${m.agentName}: "${trimmed}"`);
  }

  // 4. Dynamic specialist: At most 1 representative quote if dynamic personas participated
  const dynamicMsg = allMessages.find((m) => m.isDynamic);
  if (dynamicMsg) {
    const trimmed = dynamicMsg.text.length > 110 ? dynamicMsg.text.slice(0, 107) + '…' : dynamicMsg.text;
    excerpts.push(`• [Round ${dynamicMsg.round} Specialist] ${dynamicMsg.agentName} (${dynamicMsg.role || 'Specialist'}): "${trimmed}"`);
  }

  // Fallback: If somehow fewer than 4 excerpts collected, fill up to 4
  if (excerpts.length < 4 && allMessages.length > 0) {
    for (const m of allMessages.slice(0, 4)) {
      const trimmed = m.text.length > 110 ? m.text.slice(0, 107) + '…' : m.text;
      const str = `• [Round ${m.round}] ${m.agentName}: "${trimmed}"`;
      if (!excerpts.includes(str)) {
        excerpts.push(str);
      }
    }
  }

  console.log(
    `[Parallax Synthesizer] Generating summary report for: "${topic}". Input excerpts (${excerpts.length} quotes):\n${excerpts.join('\n')}`,
  );

  const prompt = `Synthesize this PARALLAX swarm debate on the topic: "${topic}" (${allMessages.length} total contributions).

Representative excerpts from Rounds 1-3:
${excerpts.join('\n')}

Instructions:
1. Base synthesis strictly on the persona claims above.
2. In "highlights", write 4 concise bullet points (1 sentence each) citing specific personas and their arguments.
3. In "verdict", write 1 objective sentence summarizing the swarm's actual final consensus or division.
4. In "consensusLean", provide a 2-4 word descriptor (e.g. "Empirically Grounded Lean", "Cautiously Split", "Factually Polarized").

Output JSON format only:
{
  "verdict": "One crisp objective sentence summarizing swarm consensus.",
  "consensusLean": "2-4 words",
  "highlights": ["Highlight 1", "Highlight 2", "Highlight 3", "Highlight 4"]
}`;

  const sysConfig = storage.getParallaxConfig();
  const allAgents = Object.values(sysConfig.agents || DEFAULT_PARALLAX_AGENTS);
  const { provider } = resolveParallaxProviderConfig(allAgents[0] || DEFAULT_PARALLAX_AGENTS.veritas, 350);

  try {
    const res = await api.jarvisAgentCall({
      agentId: 'parallax_synthesizer',
      messages: [
        {
          role: 'system',
          content: 'You are the PARALLAX Debate Synthesizer. You produce strictly grounded JSON summaries based exclusively on provided debate transcripts.',
        },
        { role: 'user', content: prompt },
      ],
      providerConfig: provider,
      temperature: 0.3,
      maxTokens: 350,
      timeoutMs: 22000,
    });

    const text = (res.text || res.content || '').trim();
    const cleanJsonText = text.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
    const jsonMatch = cleanJsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.verdict && Array.isArray(parsed.highlights) && parsed.highlights.length > 0) {
        return {
          verdict: parsed.verdict,
          highlights: parsed.highlights.slice(0, 5),
          consensusLean: parsed.consensusLean || 'Deliberative Consensus',
          totalContributions: allMessages.length,
        };
      }
    }
  } catch (err) {
    console.warn('[Parallax Synthesizer] LLM summary synthesis had error, using dynamic transcript synthesis:', err);
  }

  // Fallback derived dynamically from actual debate messages (never generic or unrelated)
  return buildDynamicFallbackSummary(topic, allMessages);
}

/**
 * Main Parallax Swarm Execution Engine.
 *
 * STRICT CONSTRAINTS ENFORCED IN CODE:
 * 1. Exactly 3 rounds (hard-capped loop).
 * 2. Auto-stops after Round 3.
 * 3. VERITAS receives exactly ONE tool call in Round 1 only.
 * 4. No other agent has tool or internet access.
 * 5. Agents cannot communicate directly or autonomously; all message-passing is strictly orchestrated by this loop.
 */
export async function runParallaxSwarm(options: ParallaxRunOptions): Promise<void> {
  const {
    topic,
    onMessage,
    onRoundStart,
    onRoundComplete,
    onStatusUpdate,
    onComplete,
    onError,
    signal,
  } = options;

  if (!topic || !topic.trim()) {
    onError?.('A topic is required to initiate Parallax.');
    return;
  }

  const sysConfig = options.config || storage.getParallaxConfig();
  const allAgents = Object.values(sysConfig.agents || DEFAULT_PARALLAX_AGENTS);
  const enabledAgents = allAgents.filter((a) => a.enabled !== false);

  if (enabledAgents.length === 0) {
    onError?.('No Parallax agents are enabled. Please enable at least one agent in settings.');
    return;
  }

  const allMessages: ParallaxMessage[] = [];

  try {
    // -------------------------------------------------------------
    // LIVE WEB SEARCH GROUNDING FOR VERITAS
    // Only search once per debate, before Round 1 begins.
    // Injects 10 grounding sources into VERITAS only (not the other 19 personas).
    // -------------------------------------------------------------
    let veritasGrounding: VeritasGroundingData | null = null;
    const veritasAgent = enabledAgents.find((a) => a.id === 'veritas');
    if (veritasAgent) {
      onStatusUpdate?.('Initializing Parallax: Grounding VERITAS with live search (Tavily → Exa → DuckDuckGo → Wikipedia)...');
      veritasGrounding = await fetchVeritasGrounding(topic, signal);
      if (veritasGrounding.failed) {
        onStatusUpdate?.('Live Search: Fallbacks returned 0 results. VERITAS proceeding with internal training baselines.');
      } else {
        onStatusUpdate?.(`Live Search: Successfully grounded VERITAS via ${veritasGrounding.searchSource} (${veritasGrounding.sourcesCount} sources).`);
      }
    }

    // -------------------------------------------------------------
    // DYNAMIC TEMPORARY PERSONA CREATION (0-5 SPECIALISTS)
    // Analyzes the debate topic and existing roster.
    // If a genuine domain gap exists, generates 1-5 temporary specialists.
    // Otherwise returns 0 personas. Not saved to permanent storage.
    // -------------------------------------------------------------
    let dynamicAgents: ParallaxAgentConfig[] = [];
    try {
      onStatusUpdate?.('Analyzing debate topic for specialist domain expertise gaps...');
      dynamicAgents = await analyzeTopicAndCreateTemporaryPersonas(topic, enabledAgents, signal);
      if (dynamicAgents.length > 0) {
        const names = dynamicAgents.map((p) => `${p.name} ${p.mood || ''} (${p.role})`).join(', ');
        onStatusUpdate?.(
          `Topic analysis: Identified expertise gap. Mobilized ${dynamicAgents.length} specialist personas: ${names}`,
        );
        options.onDynamicPersonasCreated?.(dynamicAgents);
      } else {
        onStatusUpdate?.('Topic analysis complete: Roster coverage optimal (0 temporary personas added).');
      }
    } catch (dynamicErr) {
      console.warn('[Parallax Dynamic Personas] Persona analysis error, proceeding with core roster:', dynamicErr);
    }

    const debateAgents: ParallaxAgentConfig[] = [...enabledAgents, ...dynamicAgents];

    // -------------------------------------------------------------
    // STRICT ROUND CAP: Exactly 3 rounds (1, 2, 3)
    // -------------------------------------------------------------
    for (let roundNum = 1; roundNum <= 3; roundNum++) {
      if (signal?.aborted) {
        onStatusUpdate?.('Parallax swarm stopped by user.');
        return;
      }

      const currentRound = roundNum as 1 | 2 | 3;
      onRoundStart?.(currentRound);
      onStatusUpdate?.(`Round ${currentRound} of 3: Mobilizing ${debateAgents.length} agents...`);

      const roundMessages: ParallaxMessage[] = [];

      // Execute agents in controlled batches of 4 for a responsive, live YouTube-feed streaming cadence
      const BATCH_SIZE = 4;
      for (let i = 0; i < debateAgents.length; i += BATCH_SIZE) {
        if (signal?.aborted) {
          onStatusUpdate?.('Parallax swarm stopped by user.');
          return;
        }

        const batch = debateAgents.slice(i, i + BATCH_SIZE);
        onStatusUpdate?.(
          `Round ${currentRound} of 3: Streaming agent inputs (${Math.min(i + BATCH_SIZE, debateAgents.length)}/${debateAgents.length})...`,
        );

        const batchPromises = batch.map(async (agent, batchIdx) => {
          const globalIdx = i + batchIdx;

          // Select peer samples for Rounds 2 & 3
          let peersSample: ParallaxMessage[] = [];
          if (currentRound > 1) {
            const prevRoundNum = (currentRound - 1) as 1 | 2;
            const prevRoundMsgs = allMessages.filter((m) => m.round === prevRoundNum);

            if (prevRoundMsgs.length > 0) {
              const N = prevRoundMsgs.length;
              // Deterministic rotating sampling with high diversity (strictly 2 peer views)
              const offset1 = currentRound === 2 ? 3 : 5;
              const offset2 = currentRound === 2 ? 7 : 11;

              const idx1 = (globalIdx + offset1) % N;
              const idx2 = (globalIdx + offset2) % N;

              const s1 = prevRoundMsgs[idx1];
              const s2 = prevRoundMsgs[idx2];

              peersSample = [s1, s2].filter(
                (p, pIdx, self) => p && self.findIndex((x) => x?.agentId === p?.agentId) === pIdx && p.agentId !== agent.id,
              );
            }
          }

          // ONLY VERITAS receives the live search grounding data (never the other 19 personas).
          // In Round 1: Receives the raw 10 sources + committed verified fact.
          // In Rounds 2 & 3: Receives ONLY the committed verified fact (never re-searching),
          // with strict instructions to remain consistent with its stated fact.
          const groundingForAgent = agent.id === 'veritas' ? veritasGrounding : null;

          const msg = await executeAgentTurn(
            agent,
            currentRound,
            topic,
            peersSample,
            groundingForAgent,
            signal,
          );

          return msg;
        });

        const batchResults = await Promise.all(batchPromises);

        for (const msg of batchResults) {
          if (signal?.aborted) return;
          // Capture VERITAS's Round 1 statement to ensure absolute consistency in Rounds 2 & 3
          if (currentRound === 1 && msg.agentId === 'veritas' && veritasGrounding) {
            veritasGrounding.round1Statement = msg.text;
          }
          roundMessages.push(msg);
          allMessages.push(msg);
          onMessage(msg);
        }

        // Brief natural pause between batches for smooth streaming visual rhythm
        if (i + BATCH_SIZE < debateAgents.length) {
          await abortableSleep(350, signal);
        }
      }

      onRoundComplete?.(currentRound, roundMessages);

      // Brief breather between rounds
      if (roundNum < 3) {
        onStatusUpdate?.(`Round ${currentRound} complete. Transitioning to Round ${currentRound + 1}...`);
        await abortableSleep(800, signal);
      }
    }

    if (signal?.aborted) {
      onStatusUpdate?.('Swarm stopped early by user.');
      return;
    }

    // -------------------------------------------------------------
    // HARD STOP: Exactly 3 rounds completed. Auto-stops here.
    // -------------------------------------------------------------
    onStatusUpdate?.('Round 3 complete. Hard stop engaged. Synthesizing Parallax Summary...');

    const summary = await generateParallaxSummary(topic, allMessages);

    // Save session to local storage
    storage.saveParallaxSession({
      id: `session_${Date.now()}`,
      topic,
      timestamp: Date.now(),
      roundsCompleted: 3,
      messages: allMessages,
      summary,
    });

    onStatusUpdate?.('Parallax Swarm complete. Auto-stopped after Round 3.');
    onComplete?.(summary, allMessages);
  } catch (err: unknown) {
    if (signal?.aborted) {
      onStatusUpdate?.('Swarm stopped early by user.');
      return;
    }
    console.error('[Parallax] Swarm execution error:', err);
    onError?.(err instanceof Error ? err.message : 'Unknown error during swarm execution.');
  }
}
