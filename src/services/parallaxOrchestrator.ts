import { storage, DEFAULT_PARALLAX_AGENTS } from '@/lib/storage';
import { api } from '@/services/api';
import { applyReasoningConfig } from '@/lib/reasoningConfig';
import { AGENT_QUADRANTS } from '@/data/parallaxQuadrants';
import type {
  AIProviderConfig,
  ParallaxAgentConfig,
  ParallaxMessage,
  ParallaxSpecialistDeliberation,
  ParallaxSpecialistOpinion,
  ParallaxSummary,
  ParallaxSystemConfig,
  ParallaxToolRawPayload,
  ParallaxToolRawResult,
} from '@/types';

/**
 * Resolves AI Provider configuration for a Parallax agent.
 * Reuses existing provider selection logic with multi-key failover support and provider-aware reasoning control.
 */
export function resolveParallaxProviderConfig(
  agent: ParallaxAgentConfig,
  overrideMaxTokens?: number,
): { provider: AIProviderConfig | null; model: string; reasoningParams?: Record<string, unknown> | null } {
  const effectiveMaxTokens = overrideMaxTokens !== undefined ? overrideMaxTokens : agent.maxTokens || 100;
  const state = storage.getAIProvidersState();
  const activeCustom = storage.getActiveAIProvider();

  let resolvedConfig: AIProviderConfig | null = null;
  let liveModel = agent.modelId || 'deepseek/deepseek-chat';

  if (!agent.providerId || agent.providerId === 'existing') {
    if (activeCustom) {
      liveModel =
        activeCustom.model && activeCustom.model.trim()
          ? activeCustom.model.trim()
          : agent.modelId || 'deepseek/deepseek-chat';
      resolvedConfig = {
        ...activeCustom,
        model: liveModel,
        maxTokens: effectiveMaxTokens,
      };
    } else {
      resolvedConfig = {
        id: 'existing',
        name: 'Built-in AI',
        url: '',
        model: agent.modelId || 'deepseek/deepseek-chat',
        keyStrategy: 'failover',
        keys: [],
        capabilities: { text: true, tools: true, web: true, wikipedia: true, memory: true },
        maxTokens: effectiveMaxTokens,
      };
    }
  } else {
    const matched = state.providers.find((p) => p.id === agent.providerId);
    if (matched) {
      liveModel = agent.modelId || matched.model || 'deepseek/deepseek-chat';
      resolvedConfig = {
        ...matched,
        model: liveModel,
        maxTokens: effectiveMaxTokens,
      };
    } else {
      if (activeCustom) {
        liveModel =
          activeCustom.model && activeCustom.model.trim()
            ? activeCustom.model.trim()
            : agent.modelId || 'deepseek/deepseek-chat';
        resolvedConfig = {
          ...activeCustom,
          model: liveModel,
          maxTokens: effectiveMaxTokens,
        };
      } else {
        resolvedConfig = {
          id: 'existing',
          name: 'Built-in AI',
          url: '',
          model: agent.modelId || 'deepseek/deepseek-chat',
          keyStrategy: 'failover',
          keys: [],
          capabilities: { text: true, tools: true, web: true, wikipedia: true, memory: true },
          maxTokens: effectiveMaxTokens,
        };
      }
    }
  }

  // Apply explicit provider-aware reasoning control (defaulting to lowest effort / disabled for Parallax personas)
  const { config: reasoningEnhancedConfig, spec: reasoningSpec, params: reasoningParams, desiredLevel } =
    applyReasoningConfig(resolvedConfig, 'low');

  if (reasoningSpec && reasoningParams) {
    console.log(
      `[PARALLAX Reasoning Control] Persona "${agent.name}" (${agent.id}) -> Provider: "${reasoningEnhancedConfig.name}" (${reasoningEnhancedConfig.id}) | Model: "${liveModel}" | Level: "${desiredLevel}" | Reasoning Params:`,
      reasoningParams,
    );
  } else {
    console.log(
      `[PARALLAX Reasoning Control] Persona "${agent.name}" (${agent.id}) -> Provider: "${reasoningEnhancedConfig.name}" (${reasoningEnhancedConfig.id}) | Model: "${liveModel}" | No reasoning config applied (unsupported or not in config map)`,
    );
  }

  console.log(
    `[PARALLAX resolveProviderConfig] Persona "${agent.name}" -> Provider "${reasoningEnhancedConfig.name}" (${reasoningEnhancedConfig.id}) | model: "${liveModel}" | keys configured: ${reasoningEnhancedConfig.keys?.length || 0}`,
  );

  return {
    provider: reasoningEnhancedConfig,
    model: liveModel,
    reasoningParams,
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
  onSpecialistDeliberation?: (deliberation: ParallaxSpecialistDeliberation) => void;
  onComplete?: (summary: ParallaxSummary, allMessages: ParallaxMessage[], deliberation?: ParallaxSpecialistDeliberation) => void;
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

const DOMAIN_EMOJI_KEYWORDS: { keywords: string[]; emoji: string }[] = [
  { keywords: ['space', 'moon', 'mars', 'orbital', 'astro', 'planetary', 'satellite', 'cosm'], emoji: '🪐' },
  { keywords: ['law', 'policy', 'legal', 'juris', 'treaty', 'regulation', 'governance', 'charter', 'constitutional'], emoji: '⚖️' },
  { keywords: ['ethics', 'moral', 'welfare', 'human', 'equity', 'justice', 'dignity', 'rights'], emoji: '🕊️' },
  { keywords: ['bio', 'medical', 'health', 'genetic', 'pathogen', 'ecology', 'life', 'organism'], emoji: '🧬' },
  { keywords: ['defense', 'security', 'protection', 'threat', 'military', 'safeguard', 'shield', 'conflict'], emoji: '🛡️' },
  { keywords: ['physics', 'quantum', 'nuclear', 'energy', 'radiation', 'power'], emoji: '⚛️' },
  { keywords: ['logic', 'systems', 'algorithm', 'causal', 'comput', 'cyber', 'software', 'ai', 'network'], emoji: '📐' },
  { keywords: ['economy', 'economic', 'finance', 'market', 'trade', 'fiscal', 'resource', 'currency', 'capital'], emoji: '📊' },
  { keywords: ['environment', 'climate', 'earth', 'ocean', 'ecological', 'atmosphere'], emoji: '🌍' },
  { keywords: ['philosophy', 'epistem', 'ontology', 'conceptual', 'premise', 'teleolog'], emoji: '📜' },
  { keywords: ['engineering', 'infrastructure', 'propulsion', 'hardware', 'logistics', 'construction'], emoji: '⚙️' },
];

const BACKUP_DISTINCT_EMOJIS = ['🪐', '⚖️', '🧬', '🛡️', '📐', '🕊️', '📊', '⚛️', '📜', '🌍', '⚙️', '🔬', '💡', '🧭'];

function resolveDistinctEmoji(
  requestedEmoji: string | undefined,
  role: string,
  usedEmojis: Set<string>,
): string {
  // If requested emoji is provided, not generic placeholder (✨, 🤖), and not already used
  if (
    requestedEmoji &&
    requestedEmoji.trim() &&
    requestedEmoji !== '✨' &&
    requestedEmoji !== '🤖' &&
    !usedEmojis.has(requestedEmoji.trim())
  ) {
    usedEmojis.add(requestedEmoji.trim());
    return requestedEmoji.trim();
  }

  // Look for keyword match in the role
  const lowerRole = role.toLowerCase();
  for (const entry of DOMAIN_EMOJI_KEYWORDS) {
    if (entry.keywords.some((kw) => lowerRole.includes(kw))) {
      if (!usedEmojis.has(entry.emoji)) {
        usedEmojis.add(entry.emoji);
        return entry.emoji;
      }
    }
  }

  // Pick first unused from backup list
  for (const emoji of BACKUP_DISTINCT_EMOJIS) {
    if (!usedEmojis.has(emoji)) {
      usedEmojis.add(emoji);
      return emoji;
    }
  }

  const fallback = '🔬';
  usedEmojis.add(fallback);
  return fallback;
}

function generateSpecialistCodename(role: string, fallbackIdx: number, existingNames: Set<string>): string {
  const clean = role.replace(/[^a-zA-Z\s]/g, ' ').trim();
  const words = clean
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 3 &&
        !['AND', 'THE', 'FOR', 'SPECIALIST', 'OFFICER', 'SCHOLAR', 'ANALYST', 'EXPERT', 'STUDIES', 'POLICY'].includes(
          w.toUpperCase(),
        ),
    );

  let candidate = '';
  if (words.length > 0) {
    const primary = words[0].toUpperCase();
    if (primary.length <= 8) {
      candidate = primary;
    } else {
      candidate = primary.slice(0, 7);
    }
  }

  if (!candidate || candidate.length < 3) {
    const defaultRoots = ['THEMIS', 'ASTRON', 'BIOS', 'ETHOS', 'JURIS', 'KRONOS', 'LOGOS'];
    candidate = defaultRoots[fallbackIdx % defaultRoots.length];
  }

  let finalName = candidate;
  let counter = 1;
  while (existingNames.has(finalName.toUpperCase())) {
    finalName = `${candidate}-${counter++}`;
  }
  return finalName.toUpperCase();
}

function formatTopicForInstruction(topic: string): string {
  const clean = topic.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, ' ');
  if (clean.length <= 140) return clean;
  // Truncate cleanly at a word boundary to prevent cutting words mid-sentence
  return clean.slice(0, 137).replace(/\s+\S*$/, '') + '…';
}

function extractJsonFromCompilerResponse(rawText: string): {
  compilerStrategy?: string;
  compilerReasoning?: string;
  selected?: Record<string, unknown>[];
} | null {
  if (!rawText || !rawText.trim()) return null;

  // 1. Clean markdown code blocks
  const text = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

  // 2. Try direct parse first
  try {
    const direct = JSON.parse(text);
    if (direct && typeof direct === 'object') {
      return direct;
    }
  } catch {
    // Continue to regex extraction
  }

  // 3. Find outermost { ... }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = text.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(jsonCandidate);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      // Continue to bracket repair
    }
  }

  // 4. Try auto-repairing truncated JSON if cut off mid-output
  if (firstBrace !== -1) {
    const partial = text.slice(firstBrace);
    const openCurly = (partial.match(/\{/g) || []).length;
    const closeCurly = (partial.match(/\}/g) || []).length;
    const openSquare = (partial.match(/\[/g) || []).length;
    const closeSquare = (partial.match(/\]/g) || []).length;

    let repaired = partial;
    const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      repaired += '"';
    }
    for (let i = 0; i < openSquare - closeSquare; i++) {
      repaired += ']';
    }
    for (let i = 0; i < openCurly - closeCurly; i++) {
      repaired += '}';
    }

    try {
      const parsed = JSON.parse(repaired);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      // Failed repair
    }
  }

  return null;
}

function createFallbackSpecialists(
  topic: string,
  countNeeded: number,
  existingIds: Set<string>,
  existingNames: Set<string>,
  baseAgent: ParallaxAgentConfig,
  opinions?: ParallaxSpecialistOpinion[],
): ParallaxAgentConfig[] {
  const fallbacks: ParallaxAgentConfig[] = [];
  const cleanTopic = formatTopicForInstruction(topic);
  const usedEmojis = new Set<string>();

  // 1. If we have rich persona opinions from Step 1, DIRECTLY USE THEM instead of generic templates!
  if (opinions && opinions.length > 0) {
    for (let i = 0; i < opinions.length && fallbacks.length < countNeeded; i++) {
      const op = opinions[i];
      const role = op.suggestedSpecialist || 'Domain Specialist';
      const codename = generateSpecialistCodename(role, i, existingNames);
      existingNames.add(codename);

      let slug = codename.toLowerCase().replace(/[^a-z0-9]/g, '_');
      let suffix = 1;
      while (existingIds.has(slug)) {
        slug = `${codename.toLowerCase()}_${suffix++}`;
      }
      existingIds.add(slug);

      const emoji = resolveDistinctEmoji(op.emoji, role, usedEmojis);
      const palette = DYNAMIC_SPECIALIST_PALETTES[(existingIds.size - 1) % DYNAMIC_SPECIALIST_PALETTES.length];

      fallbacks.push({
        id: slug,
        name: codename,
        initials: codename.slice(0, 2),
        role,
        accentColor: palette.color,
        hasToolAccess: false,
        providerId: baseAgent.providerId || 'existing',
        modelId: baseAgent.modelId || 'deepseek/deepseek-chat',
        enabled: true,
        systemInstruction: `Serve as ${role} on the debate topic "${cleanTopic}". Apply technical domain methodology focusing on ${op.reason}. Speak with substantive domain authority and distinct evidentiary standards.`,
        selectionReason: `Selected from ${op.agentName}'s recommendation: ${op.reason}`,
        maxTokens: 100,
        voice: palette.voice,
        isDynamic: true,
        mood: emoji,
      });
    }
  }

  // 2. If opinions are not available or not enough, generate topic-aware domain templates (no generic DOMINA/PRAXIS)
  if (fallbacks.length < countNeeded) {
    const topicTemplates = [
      {
        role: 'Empirical Verification & Methodology Specialist',
        nameRoot: 'EMPIRIC',
        instruction: `Ground discourse on "${cleanTopic}" with verifiable empirical datasets, methodology checks, and evidential standards.`,
        reason: 'Required to anchor debate claims in empirical reality and prevent unchecked assertions.',
      },
      {
        role: 'Systems Architecture & Policy Specialist',
        nameRoot: 'THEMIS',
        instruction: `Analyze systemic causal chains, institutional mechanics, and regulatory frameworks governing "${cleanTopic}".`,
        reason: 'Required to model structural constraints, legal dynamics, and institutional trade-offs.',
      },
      {
        role: 'Applied Ethics & Long-Term Welfare Specialist',
        nameRoot: 'ETHOS',
        instruction: `Evaluate human dignity, societal equity, ethical principles, and intergenerational impacts of "${cleanTopic}".`,
        reason: 'Essential to center ethical accountability, human welfare, and moral rights.',
      },
      {
        role: 'Strategic Equilibria & Governance Specialist',
        nameRoot: 'STRATIS',
        instruction: `Project strategic incentives, multi-polar equilibria, and systemic risk trade-offs on "${cleanTopic}".`,
        reason: 'Vital to balance competing stakeholder interests and dynamic multi-polar risks.',
      },
    ];

    for (let i = 0; i < topicTemplates.length && fallbacks.length < countNeeded; i++) {
      const t = topicTemplates[i];
      const codename = generateSpecialistCodename(t.nameRoot, i, existingNames);
      existingNames.add(codename);

      let slug = codename.toLowerCase();
      let suffix = 1;
      while (existingIds.has(slug)) {
        slug = `${codename.toLowerCase()}_${suffix++}`;
      }
      existingIds.add(slug);

      const emoji = resolveDistinctEmoji(undefined, t.role, usedEmojis);
      const palette = DYNAMIC_SPECIALIST_PALETTES[(existingIds.size - 1) % DYNAMIC_SPECIALIST_PALETTES.length];

      fallbacks.push({
        id: slug,
        name: codename,
        initials: codename.slice(0, 2),
        role: t.role,
        accentColor: palette.color,
        hasToolAccess: false,
        providerId: baseAgent.providerId || 'existing',
        modelId: baseAgent.modelId || 'deepseek/deepseek-chat',
        enabled: true,
        systemInstruction: t.instruction,
        selectionReason: t.reason,
        maxTokens: 100,
        voice: palette.voice,
        isDynamic: true,
        mood: emoji,
      });
    }
  }

  return fallbacks;
}

interface PersonaOpinionTarget {
  id: string;
  name: string;
  emoji: string;
  role: string;
  accentColor: string;
  detailedPersona: string;
  worldviewFocus: string;
  defaultSpecialist: string;
  defaultReason: string;
}

const PERSONA_OPINION_TARGETS: PersonaOpinionTarget[] = [
  {
    id: 'veritas',
    name: 'VERITAS',
    emoji: '🧠',
    role: 'Fact-based, skeptical analysis',
    accentColor: '#06b6d4',
    detailedPersona:
      'You are VERITAS 🧠, the fact-based, hyper-skeptical reality anchor of the Parallax Swarm. Your role is to provide rigorous empirical scrutiny, demand verifiable evidence, uncover unverified assumptions, and flag factual voids. In any debate, you refuse to accept speculative rhetoric without concrete documentation, empirical research benchmarks, or methodological validation.',
    worldviewFocus:
      'Empirical voids, unverified statistical assertions, lack of historical or scientific datasets, and methodological validation.',
    defaultSpecialist: 'Empirical Research & Verification Methodology Specialist',
    defaultReason:
      'Discussion on this topic risks resting on unverified assertions without rigorous empirical datasets and methodological validation. A dedicated specialist is necessary to ground claims in documented evidence and empirical reality.',
  },
  {
    id: 'axiom',
    name: 'AXIOM',
    emoji: '📐',
    role: 'Pure logic & scientific reasoning',
    accentColor: '#10b981',
    detailedPersona:
      'You are AXIOM 📐, the pure logic and first-principles scientific reasoning engine of the Parallax Swarm. Your role is to enforce formal deductive validity, trace systemic causal dependency chains, expose cognitive fallacies, and evaluate physical or computational constraints. You model problems as interconnected, falsifiable causal systems where every conclusion must follow sound premises.',
    worldviewFocus:
      'First-principles causality, formal deductive consistency, broken causal links, and systemic dynamic feedback loops.',
    defaultSpecialist: 'Systems Logic & Causal Architecture Specialist',
    defaultReason:
      'Prevailing viewpoints on this topic conflate correlation with causation and lack formal first-principles consistency. An architecture and causal dynamics specialist is required to trace systemic dependencies and constraints.',
  },
  {
    id: 'socrates',
    name: 'SOCRATES',
    emoji: '🤔',
    role: 'Deep philosophical questioning',
    accentColor: '#8b5cf6',
    detailedPersona:
      'You are SOCRATES 🤔, the philosophical interrogator and conceptual foundation analyst of the Parallax Swarm. Your role is to interrogate unexamined premises, expose tacit ideological dogmas, deconstruct ambiguous definitions, and dissect the teleological intent behind arguments. You refuse to let participants proceed without confronting the core epistemological and metaphysical questions they take for granted.',
    worldviewFocus:
      'Unexamined premises, linguistic ambiguities, tacit ideological dogmas, and foundational philosophical or epistemological dilemmas.',
    defaultSpecialist: 'Epistemology & Conceptual Foundations Specialist',
    defaultReason:
      'The foundational definitions and tacit philosophical presuppositions framing this debate remain completely unexamined. A specialist in conceptual foundations is vital to clarify core premises before meaningful debate can proceed.',
  },
  {
    id: 'harmony',
    name: 'HARMONY',
    emoji: '🕊️',
    role: 'Ethical & ontological concerns',
    accentColor: '#14b8a6',
    detailedPersona:
      'You are HARMONY 🕊️, the ethical conscience and human dignity advocate of the Parallax Swarm. Your role is to champion human dignity, societal equity, ecological preservation, vulnerable communities, and moral accountability. You insist that utilitarian or technocratic metrics must never overshadow human suffering, moral rights, and generational justice.',
    worldviewFocus:
      'Moral obligations, human rights, societal equity, ecological stewardship, and impacts on vulnerable communities.',
    defaultSpecialist: 'Applied Ethics & Human Welfare Specialist',
    defaultReason:
      'Technocratic and utilitarian arguments on this topic consistently neglect human dignity, societal equity, and disproportionate impacts on vulnerable communities. An applied ethics specialist is essential to center moral accountability and welfare.',
  },
  {
    id: 'nexus9',
    name: 'NEXUS-9',
    emoji: '⚖️',
    role: 'Neutral synthesizer/summarizer',
    accentColor: '#67e8f9',
    detailedPersona:
      'You are NEXUS-9 ⚖️, the systemic synthesizer and objective equilibrium architect of the Parallax Swarm. Your role is to map multi-polar trade-offs, institutional governance frameworks, regulatory friction, and practical consensus mechanics across divergent paradigms. You identify where competing stakeholder incentives collide and how structural balance can be achieved.',
    worldviewFocus:
      'Multi-stakeholder governance, institutional friction, cross-domain trade-offs, and practical equilibrium mechanics.',
    defaultSpecialist: 'Cross-Domain Governance & Policy Trade-Offs Specialist',
    defaultReason:
      'Conflicting stakeholder interests on this topic will produce institutional gridlock without a structured governance framework. A cross-domain trade-offs specialist is critical to map sustainable regulatory mechanisms and equilibrium.',
  },
];

/**
 * Step 1: 5-Persona Opinion Step
 * VERITAS 🧠, AXIOM 📐, SOCRATES 🤔, HARMONY 🕊️, and NEXUS-9 ⚖️ each independently
 * give a rich, 2-sentence reasoned opinion on what specialist expertise this specific topic needs
 * grounded in their distinctive persona worldview and system prompt identity.
 * Token budget: ~150-180 input tokens, ~80-100 output tokens each.
 */
export async function fetchPersonaSpecialistOpinions(
  topic: string,
  existingAgents: ParallaxAgentConfig[],
  signal?: AbortSignal,
): Promise<ParallaxSpecialistOpinion[]> {
  const baseAgent = existingAgents[0] || DEFAULT_PARALLAX_AGENTS.veritas;
  const { provider } = resolveParallaxProviderConfig(baseAgent, 150);

  const opinionPromises = PERSONA_OPINION_TARGETS.map(async (target) => {
    const matchedAgent = existingAgents.find((a) => a.id.toLowerCase() === target.id) || baseAgent;
    const targetProvider = resolveParallaxProviderConfig(matchedAgent, 150).provider || provider;

    const sysContent = `${target.detailedPersona}

Worldview Focus: ${target.worldviewFocus}

TASK:
Analyze the debate topic below through your distinct philosophical lens and persona worldview.
Identify the single most critical domain expertise missing from conventional discussions on this topic, and propose ONE domain specialist.
Provide exactly 2 substantive sentences of reasoning in your persona voice:
• Sentence 1: Identify the specific empirical, logical, philosophical, ethical, or governance gap you detect on this topic.
• Sentence 2: Explain specifically how this proposed specialist resolves that gap and elevates swarm deliberation.

FORMAT STRICTLY (No preamble, no markdown formatting):
Specialist: [Precise Domain Specialist Title]
Reason: [Sentence 1 explaining the specific domain gap. Sentence 2 explaining how this specialist resolves it.]`;

    const userContent = `Debate Topic: "${topic}"

From your distinct persona identity, worldview principles, and analytical role, propose the single most essential domain specialist expertise needed for this deliberation.`;

    try {
      const res = await api.jarvisAgentCall({
        agentId: `opinion_${target.id}`,
        messages: [
          { role: 'system', content: sysContent },
          { role: 'user', content: userContent },
        ],
        providerConfig: targetProvider,
        temperature: 0.35,
        maxTokens: 150,
        timeoutMs: 14000,
        signal,
      });

      const raw = (res.text || res.content || '').trim();
      let specialist = '';
      let reason = '';

      const specMatch = raw.match(/Specialist:\s*([^\n\r]+)/i);
      const reasonMatch = raw.match(/Reason:\s*([\s\S]+)$/i);

      if (specMatch && specMatch[1]) {
        specialist = specMatch[1].replace(/[*_#`[\]]/g, '').trim();
      }
      if (reasonMatch && reasonMatch[1]) {
        reason = reasonMatch[1].replace(/[*_#`]/g, '').trim();
      }

      if (!specialist || !reason) {
        const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (lines.length >= 2) {
          specialist = specialist || lines[0].replace(/^[^:]*:\s*/, '').replace(/[*_#`[\]]/g, '').trim();
          reason = reason || lines.slice(1).join(' ').replace(/^Reason:\s*/i, '').replace(/[*_#`]/g, '').trim();
        } else if (lines.length === 1) {
          specialist = specialist || target.defaultSpecialist;
          reason = reason || lines[0];
        }
      }

      specialist = specialist || target.defaultSpecialist;
      reason = reason || target.defaultReason;

      return {
        agentId: target.id,
        agentName: target.name,
        emoji: target.emoji,
        role: target.role,
        accentColor: target.accentColor,
        suggestedSpecialist: specialist,
        reason,
      };
    } catch (err) {
      if (signal?.aborted) throw err;
      console.warn(`[Parallax Specialist Opinions] ${target.name} opinion call failed, using default:`, err);
      return {
        agentId: target.id,
        agentName: target.name,
        emoji: target.emoji,
        role: target.role,
        accentColor: target.accentColor,
        suggestedSpecialist: target.defaultSpecialist,
        reason: target.defaultReason,
      };
    }
  });

  const settled = await Promise.allSettled(opinionPromises);
  return settled.map((result, idx) => {
    if (result.status === 'fulfilled') return result.value;
    const target = PERSONA_OPINION_TARGETS[idx];
    return {
      agentId: target.id,
      agentName: target.name,
      emoji: target.emoji,
      role: target.role,
      accentColor: target.accentColor,
      suggestedSpecialist: target.defaultSpecialist,
      reason: target.defaultReason,
    };
  });
}

export interface CompiledSpecialistsResult {
  specialists: ParallaxAgentConfig[];
  compilerReasoning?: string;
}

/**
 * Step 2: Compile Step
 * Reviews the 5 suggestions and selects the 3 most distinct, non-overlapping specialist
 * ideas among them to eliminate redundancy. Compiles into exactly 3 mandatory specialists
 * and provides explicit selection reasoning explaining why each was chosen.
 * Token budget: ~350 input tokens, ~200 output tokens.
 */
export async function compileMandatorySpecialists(
  topic: string,
  opinions: ParallaxSpecialistOpinion[],
  existingAgents: ParallaxAgentConfig[],
  signal?: AbortSignal,
): Promise<CompiledSpecialistsResult> {
  const baseAgent = existingAgents[0] || DEFAULT_PARALLAX_AGENTS.veritas;
  // Generous token headroom so the compiled JSON is never cut off
  const { provider } = resolveParallaxProviderConfig(baseAgent, 750);

  const existingIds = new Set(existingAgents.map((a) => a.id.toLowerCase()));
  const existingNames = new Set(existingAgents.map((a) => a.name.toUpperCase()));

  const opinionLines = opinions
    .map(
      (op, idx) =>
        `[PROPOSAL ${idx + 1} from ${op.agentName} ${op.emoji} (${op.role})]\n` +
        `• Proposed Specialist: "${op.suggestedSpecialist}"\n` +
        `• Persona Rationale: "${op.reason}"`,
    )
    .join('\n\n');

  const compilePrompt = `Debate Topic: "${topic}"

5 Core Persona Specialist Proposals:
${opinionLines}

TASK:
You are the PARALLAX Swarm Specialist Compiler.
Carefully review all 5 detailed specialist proposals from VERITAS, AXIOM, SOCRATES, HARMONY, and NEXUS-9.
Select the top 3 most distinct, high-impact, non-overlapping specialist roles to maximize analytical coverage for this specific debate topic, eliminating redundant domains.

CRITICAL REQUIREMENTS:
1. DIRECTLY DERIVE FROM PROPOSALS: The 3 selected specialists MUST directly adopt or refine 3 of the 5 proposals above. The "role" field MUST match the domain specialist proposed (e.g. if VERITAS proposed "Planetary Protection Officer", use that exact title or close equivalent). DO NOT invent generic roles like "Subject Matter Specialist" or "Applied Practice Specialist".
2. DISTINCT UPPERCASE CODENAMES: Assign a punchy, evocative 1-word Greek/Latin/thematic uppercase codename for each (e.g., ASTRON, BIOS, THEMIS, JURIS, ETHOS, LOGOS, CUSTOS). NEVER use generic names like "SPECIALIST-1", "DOMINA", or "PRAXIS".
3. DISTINCT DOMAIN EMOJIS: Assign a unique, contextually relevant emoji to EACH of the 3 specialists (e.g., 🪐, ⚖️, 🧬, 🛡️, 📐, 📜). All 3 specialists MUST have different emojis—never repeat the same emoji or give all 3 generic emojis like ✨ or 🚀.
4. SPECIFIC DEBATE INSTRUCTION: Write a focused 2-sentence systemInstruction instructing this specialist on their distinct technical methodology, evidentiary standards, and domain perspective on the topic, ensuring they debate with a unique, distinct voice.
5. SELECTION REASON: In selectionReason, explicitly state which persona proposed it and why it was chosen over the omitted proposals.

OUTPUT STRICT JSON ONLY with this schema:
{
  "compilerStrategy": "2 sentences explaining the synthesis strategy behind choosing these 3 specialists and why they cover the topic's primary axes over the 2 omitted proposals.",
  "selected": [
    {
      "id": "short_slug",
      "name": "CODENAME",
      "emoji": "🪐",
      "role": "Full Domain Specialist Title (matching chosen proposal)",
      "selectionReason": "Proposed by [PERSONA]: 1-2 concise sentences explaining why this specialist was selected over the other proposals.",
      "systemInstruction": "2 concise sentences directing this specialist's domain methodology, analytical standards, and debate contributions."
    }
  ]
}`;

  try {
    const res = await api.jarvisAgentCall({
      agentId: 'specialist_compiler',
      messages: [
        {
          role: 'system',
          content:
            'You are the PARALLAX Swarm Specialist Compiler. You review 5 detailed persona proposals and select the top 3 distinct, non-overlapping specialist personas. You MUST derive the 3 specialists directly from the provided proposals, assign distinct domain emojis, and provide transparent selection reasoning. You output strict JSON only.',
        },
        { role: 'user', content: compilePrompt },
      ],
      providerConfig: provider,
      temperature: 0.25,
      maxTokens: 750,
      timeoutMs: 24000,
      signal,
    });

    const rawText = (res.text || res.content || '').trim();
    console.log(`[Parallax Compile] Compiler raw response received (length: ${rawText.length}):\n${rawText}`);

    const parsedJson = extractJsonFromCompilerResponse(rawText);
    let rawList: Record<string, unknown>[] = [];
    let compilerReasoning = '';

    if (parsedJson) {
      if (Array.isArray(parsedJson.selected)) {
        rawList = parsedJson.selected.slice(0, 3);
      }
      if (typeof parsedJson.compilerStrategy === 'string' && parsedJson.compilerStrategy.trim()) {
        compilerReasoning = parsedJson.compilerStrategy.trim();
      } else if (typeof parsedJson.compilerReasoning === 'string' && parsedJson.compilerReasoning.trim()) {
        compilerReasoning = parsedJson.compilerReasoning.trim();
      }
    } else {
      console.warn('[Parallax Compile] Failed to parse compiler response into JSON. Raw response was:\n', rawText);
    }

    const mandatorySpecialists: ParallaxAgentConfig[] = [];
    const usedEmojis = new Set<string>();

    rawList.forEach((item: Record<string, unknown>, idx: number) => {
      if (!item || typeof item !== 'object') return;
      const role = typeof item.role === 'string' && item.role.trim() ? item.role.trim() : `Specialist ${idx + 1}`;

      let rawName =
        typeof item.name === 'string' && item.name.trim()
          ? item.name.toUpperCase().replace(/[^A-Z0-9-]/g, '').trim()
          : '';

      // If name is missing, generic, or duplicated, generate a tailored domain codename
      if (
        !rawName ||
        rawName.startsWith('SPECIALIST') ||
        rawName === 'DOMINA' ||
        rawName === 'PRAXIS' ||
        existingNames.has(rawName)
      ) {
        rawName = generateSpecialistCodename(role, idx, existingNames);
      }
      existingNames.add(rawName);

      let rawId =
        typeof item.id === 'string' && item.id.trim()
          ? item.id.toLowerCase().replace(/[^a-z0-9_]/g, '')
          : rawName.toLowerCase();
      if (!rawId || existingIds.has(rawId)) {
        rawId = `${rawName.toLowerCase()}_${idx + 1}`;
      }
      existingIds.add(rawId);

      const rawEmoji = typeof item.emoji === 'string' ? item.emoji.trim() : undefined;
      const emoji = resolveDistinctEmoji(rawEmoji, role, usedEmojis);

      const systemInstruction =
        typeof item.systemInstruction === 'string' && item.systemInstruction.trim()
          ? item.systemInstruction.trim()
          : `Apply rigorous domain-specific analysis from the perspective of a ${role} on the debate topic "${formatTopicForInstruction(topic)}".`;

      const selectionReason =
        typeof item.selectionReason === 'string' && item.selectionReason.trim()
          ? item.selectionReason.trim()
          : 'Selected for domain complementarity and non-overlapping analytical rigor.';

      const palette = DYNAMIC_SPECIALIST_PALETTES[idx % DYNAMIC_SPECIALIST_PALETTES.length];
      const initials = rawName.replace(/[^A-Z]/g, '').slice(0, 2) || 'SP';

      mandatorySpecialists.push({
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
        selectionReason,
        maxTokens: 100,
        voice: palette.voice,
        isDynamic: true,
        mood: emoji,
      });
    });

    if (mandatorySpecialists.length < 3) {
      const needed = 3 - mandatorySpecialists.length;
      console.warn(`[Parallax Compile] Compiler produced ${mandatorySpecialists.length}/3 specialists. Generating ${needed} from persona proposals...`);
      const supplemental = createFallbackSpecialists(topic, needed, existingIds, existingNames, baseAgent, opinions);
      mandatorySpecialists.push(...supplemental);
    }

    const finalSpecialists = mandatorySpecialists.slice(0, 3);
    if (!compilerReasoning && finalSpecialists.length >= 3) {
      compilerReasoning = `Selected ${finalSpecialists.map((s) => `${s.name} (${s.role})`).join(', ')} to balance empirical, structural, and ethical domain axes without analytical overlap.`;
    }

    return {
      specialists: finalSpecialists,
      compilerReasoning,
    };
  } catch (err) {
    if (signal?.aborted) throw err;
    console.warn('[Parallax Compile] Compiler call failed with error, generating from persona proposals:', err);
    const fallbacks = createFallbackSpecialists(topic, 3, existingIds, existingNames, baseAgent, opinions);
    return {
      specialists: fallbacks,
      compilerReasoning: `Compiled from persona proposals: Mobilized ${fallbacks.map((s) => `${s.name} (${s.role})`).join(', ')} across key analytical axes.`,
    };
  }
}

/**
 * Step 3: Invisible System (Optional Specialists #4 and #5)
 * After the 3 mandatory specialists are set, the anonymous topic-analysis logic runs
 * to decide if 1-2 additional specialists are genuinely needed beyond those 3.
 * Token budget: ~220 input tokens, ~180 output tokens.
 */
export async function evaluateAdditionalSpecialists(
  topic: string,
  coreAgents: ParallaxAgentConfig[],
  mandatorySpecialists: ParallaxAgentConfig[],
  signal?: AbortSignal,
): Promise<ParallaxAgentConfig[]> {
  const baseAgent = coreAgents[0] || DEFAULT_PARALLAX_AGENTS.veritas;
  const { provider } = resolveParallaxProviderConfig(baseAgent, 200);

  const existingIds = new Set([
    ...coreAgents.map((a) => a.id.toLowerCase()),
    ...mandatorySpecialists.map((s) => s.id.toLowerCase()),
  ]);
  const existingNames = new Set([
    ...coreAgents.map((a) => a.name.toUpperCase()),
    ...mandatorySpecialists.map((s) => s.name.toUpperCase()),
  ]);

  const coreSummary = coreAgents.map((a) => a.name).join(', ');
  const mandatorySummary = mandatorySpecialists.map((s) => `${s.name} (${s.role})`).join(', ');

  const prompt = `Topic: "${topic}"
Core Swarm (20 personas): ${coreSummary}
Mandatory Specialists: ${mandatorySummary}

TASK: Decide if 1 or 2 additional specialists (max 2) are genuinely needed because of acute domain expertise gaps not covered by the 23 agents above.
RULE: Most everyday and general topics are already fully covered. Return 0 additional specialists: {"additional": []}. Only add 1-2 if a profound domain gap remains (e.g. surgical medicine, aerospace propulsion, constitutional jurisprudence).

OUTPUT STRICT JSON ONLY:
{
  "gapAnalysis": "1-sentence assessment",
  "additional": [
    {
      "id": "slug",
      "name": "UPPERCASE_NAME",
      "emoji": "✨",
      "role": "Specific Domain Specialist Role",
      "systemInstruction": "1-2 sentences on analytical priorities."
    }
  ]
}`;

  try {
    const res = await api.jarvisAgentCall({
      agentId: 'invisible_gap_analyzer',
      messages: [
        {
          role: 'system',
          content: 'You are the PARALLAX Invisible Gap Analyzer. You evaluate if 1-2 additional specialists are genuinely needed beyond the 23 existing agents. You output strict JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      providerConfig: provider,
      temperature: 0.2,
      maxTokens: 220,
      timeoutMs: 14000,
      signal,
    });

    const rawText = (res.text || res.content || '').trim();
    const cleanJsonText = rawText.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
    const jsonMatch = cleanJsonText.match(/\{[\s\S]*\}/);

    let rawList: Record<string, unknown>[] = [];
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.additional)) {
          rawList = parsed.additional.slice(0, 2);
        }
      } catch (e) {
        console.warn('[Parallax Additional Specialists] JSON parse warning:', e);
      }
    }

    const additionalSpecialists: ParallaxAgentConfig[] = [];
    rawList.forEach((item: Record<string, unknown>, idx: number) => {
      if (!item || typeof item !== 'object') return;
      let rawId = typeof item.id === 'string' ? item.id.toLowerCase().replace(/[^a-z0-9]/g, '') : `add_spec_${idx + 1}`;
      if (!rawId || existingIds.has(rawId)) {
        rawId = `${rawId}_add_${idx + 1}`;
      }
      existingIds.add(rawId);

      let rawName = typeof item.name === 'string' ? item.name.toUpperCase().replace(/[^A-Z0-9-]/g, '').trim() : `SPECIALIST-PLUS-${idx + 1}`;
      if (!rawName || existingNames.has(rawName)) {
        rawName = `${rawName}-${idx + 1}`;
      }
      existingNames.add(rawName);

      const emoji = typeof item.emoji === 'string' && item.emoji.trim() ? item.emoji.trim() : '✨';
      const role = typeof item.role === 'string' && item.role.trim() ? item.role.trim() : 'Domain Specialist';
      const systemInstruction = typeof item.systemInstruction === 'string' && item.systemInstruction.trim()
        ? item.systemInstruction.trim()
        : `Apply rigorous domain-specific analysis from the perspective of a ${role}.`;

      // Palette offset by 3 so additional specialists get distinct colors
      const palette = DYNAMIC_SPECIALIST_PALETTES[(3 + idx) % DYNAMIC_SPECIALIST_PALETTES.length];
      const initials = rawName.replace(/[^A-Z]/g, '').slice(0, 2) || 'SP';

      additionalSpecialists.push({
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

    return additionalSpecialists.slice(0, 2);
  } catch (err) {
    if (signal?.aborted) throw err;
    console.warn('[Parallax Additional Specialists] Invisible gap check error, proceeding with 0 additional:', err);
    return [];
  }
}

/**
 * Deliberate and Create Dynamic Specialists:
 * Orchestrates the full pre-Round-1 specialist creation flow:
 * 1. 5-Persona Opinion Step (VERITAS, AXIOM, SOCRATES, HARMONY, NEXUS-9)
 * 2. Compile Step (3 top distinct non-overlapping picks as mandatory specialists)
 * 3. Invisible System (0 to 2 additional specialists for acute gaps)
 */
export async function deliberateAndCreateSpecialists(
  topic: string,
  existingAgents: ParallaxAgentConfig[],
  signal?: AbortSignal,
  onStatusUpdate?: (status: string) => void,
): Promise<ParallaxSpecialistDeliberation> {
  onStatusUpdate?.('Pre-Round 1: Gathering specialist recommendations from VERITAS, AXIOM, SOCRATES, HARMONY, and NEXUS-9...');
  const opinions = await fetchPersonaSpecialistOpinions(topic, existingAgents, signal);

  onStatusUpdate?.('Pre-Round 1: Compiling top 3 distinct mandatory specialists from persona proposals...');
  const compiledResult = await compileMandatorySpecialists(topic, opinions, existingAgents, signal);
  const selectedMandatory = compiledResult.specialists;
  const compilerReasoning = compiledResult.compilerReasoning;

  onStatusUpdate?.('Pre-Round 1: Evaluating if acute domain gaps require additional specialists...');
  const additionalSpecialists = await evaluateAdditionalSpecialists(topic, existingAgents, selectedMandatory, signal);

  const allSpecialists = [...selectedMandatory, ...additionalSpecialists];

  return {
    opinions,
    selectedMandatory,
    additionalSpecialists,
    allSpecialists,
    compilerReasoning,
  };
}

/**
 * Dynamic Temporary Persona Creation for Parallax Swarm:
 * Backward compatible entry point that runs deliberateAndCreateSpecialists and returns all created specialists.
 */
export async function analyzeTopicAndCreateTemporaryPersonas(
  topic: string,
  existingAgents: ParallaxAgentConfig[],
  signal?: AbortSignal,
): Promise<ParallaxAgentConfig[]> {
  const deliberation = await deliberateAndCreateSpecialists(topic, existingAgents, signal);
  return deliberation.allSpecialists;
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
 * Pure helper function to compute ideological divergence using AGENT_QUADRANTS.
 * Calculates Euclidean distance Math.hypot(dx, dy) between agent and candidates.
 * Returns candidate IDs sorted by descending distance (most distant/opposing first).
 * Returns empty array if agent or candidates have no quadrant entry.
 */
export function findIdeologicalOpponents(agentId: string, candidateIds: string[]): string[] {
  if (!agentId || !candidateIds || candidateIds.length === 0) {
    return [];
  }

  const currentQ = AGENT_QUADRANTS[agentId.toLowerCase()] || AGENT_QUADRANTS[agentId.toLowerCase().replace(/[-_]/g, '')];
  if (!currentQ) {
    return [];
  }

  const scored: { id: string; distance: number }[] = [];

  for (const cid of candidateIds) {
    if (!cid || cid.toLowerCase() === agentId.toLowerCase()) continue;
    const candQ = AGENT_QUADRANTS[cid.toLowerCase()] || AGENT_QUADRANTS[cid.toLowerCase().replace(/[-_]/g, '')];
    if (candQ) {
      const dx = candQ.x - currentQ.x;
      const dy = candQ.y - currentQ.y;
      const distance = Math.hypot(dx, dy);
      scored.push({ id: cid, distance });
    }
  }

  if (scored.length === 0) {
    return [];
  }

  scored.sort((a, b) => b.distance - a.distance);
  return scored.map((s) => s.id);
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
    } else if (agent.isDynamic) {
      userPrompt = `Topic: "${topic}"\nProvide your initial 1-2 sentence perspective on this topic strictly applying your specialized domain expertise as ${agent.name} (${agent.role}).`;
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
        ? 'Rebut the view you most disagree with in 1-2 sharp sentences'
        : 'Deliver your final 1-2 sentence synthesis';

    if (agent.id === 'veritas' && veritasGrounding && !veritasGrounding.failed && veritasGrounding.committedFact) {
      userPrompt = `Topic: "${topic}"\n\n[Committed Verified Fact]: "${veritasGrounding.committedFact}"\n\nPeer points from Round ${round - 1}:\n${peerBullets}\n\n${action} as VERITAS, upholding your verified fact.`;
    } else if (agent.isDynamic) {
      userPrompt = `Topic: "${topic}"\n\nPeer points from Round ${round - 1}:\n${peerBullets}\n\n${action} as ${agent.name} strictly applying your specialized domain expertise as ${agent.role}.`;
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

  // 4. Dynamic specialists: Up to 2 representative quotes from dynamic specialists
  const dynamicMsgs = allMessages.filter((m) => m.isDynamic);
  for (const dm of dynamicMsgs.slice(0, 2)) {
    const trimmed = dm.text.length > 110 ? dm.text.slice(0, 107) + '…' : dm.text;
    excerpts.push(`• [Round ${dm.round} Specialist] ${dm.agentName} (${dm.role || 'Specialist'}): "${trimmed}"`);
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
2. In "highlights", write 4 concise bullet points (1 sentence each) citing specific personas and their arguments (core personas or dynamically generated specialists).
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
    // DYNAMIC SPECIALIST CREATION (2-STEP HYBRID ARCHITECTURE):
    // 1. 5-Persona Opinion Step (VERITAS, AXIOM, SOCRATES, HARMONY, NEXUS-9)
    // 2. Compile Step (Selects top 3 distinct non-overlapping picks as mandatory)
    // 3. Invisible System (Assesses if 1-2 additional specialists are genuinely needed)
    // -------------------------------------------------------------
    let specialistDeliberation: ParallaxSpecialistDeliberation | null = null;
    let dynamicAgents: ParallaxAgentConfig[] = [];
    try {
      specialistDeliberation = await deliberateAndCreateSpecialists(topic, enabledAgents, signal, onStatusUpdate);
      dynamicAgents = specialistDeliberation.allSpecialists;

      options.onSpecialistDeliberation?.(specialistDeliberation);
      options.onDynamicPersonasCreated?.(dynamicAgents);

      const mandatoryNames = specialistDeliberation.selectedMandatory.map((s) => `${s.name} ${s.mood || ''}`).join(', ');
      const addCount = specialistDeliberation.additionalSpecialists.length;
      onStatusUpdate?.(
        `Dynamic Specialists finalized: 3 mandatory (${mandatoryNames})${addCount > 0 ? ` + ${addCount} additional` : ''}. Mobilizing swarm...`
      );
    } catch (dynamicErr) {
      if (signal?.aborted) throw dynamicErr;
      console.warn('[Parallax Dynamic Personas] Deliberation error, applying fallback specialists:', dynamicErr);
      const baseAgent = enabledAgents[0] || DEFAULT_PARALLAX_AGENTS.veritas;
      const existingIds = new Set(enabledAgents.map((a) => a.id.toLowerCase()));
      const existingNames = new Set(enabledAgents.map((a) => a.name.toUpperCase()));
      const fallbackMandatory = createFallbackSpecialists(topic, 3, existingIds, existingNames, baseAgent, specialistDeliberation?.opinions);
      dynamicAgents = fallbackMandatory;
      specialistDeliberation = {
        opinions: [],
        selectedMandatory: fallbackMandatory,
        additionalSpecialists: [],
        allSpecialists: fallbackMandatory,
      };
      options.onSpecialistDeliberation?.(specialistDeliberation);
      options.onDynamicPersonasCreated?.(dynamicAgents);
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

            // In Round 2: Select the top 2 most ideologically distant opponents from Round 1
            if (currentRound === 2 && prevRoundMsgs.length > 0) {
              const validSpeakerMsgs = prevRoundMsgs.filter(
                (p) => p && p.agentId !== agent.id && p.text && p.text.trim().length > 0,
              );
              const speakerIds = validSpeakerMsgs.map((p) => p.agentId);
              const opponentIds = findIdeologicalOpponents(agent.id, speakerIds);

              if (opponentIds.length >= 2) {
                const top2Opponents = opponentIds.slice(0, 2);
                const matchedMsgs = top2Opponents
                  .map((oppId) => validSpeakerMsgs.find((m) => m.agentId.toLowerCase() === oppId.toLowerCase()))
                  .filter((m): m is ParallaxMessage => Boolean(m));

                if (matchedMsgs.length >= 2) {
                  peersSample = matchedMsgs.slice(0, 2);
                }
              }
            }

            // Fallback for Round 2 (if fewer than 2 distant speakers exist / no quadrant data) or default rotating sampling for Round 3
            if (peersSample.length < 2 && prevRoundMsgs.length > 0) {
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
      specialistDeliberation: specialistDeliberation || undefined,
    });

    onStatusUpdate?.('Parallax Swarm complete. Auto-stopped after Round 3.');
    onComplete?.(summary, allMessages, specialistDeliberation || undefined);
  } catch (err: unknown) {
    if (signal?.aborted) {
      onStatusUpdate?.('Swarm stopped early by user.');
      return;
    }
    console.error('[Parallax] Swarm execution error:', err);
    onError?.(err instanceof Error ? err.message : 'Unknown error during swarm execution.');
  }
}
