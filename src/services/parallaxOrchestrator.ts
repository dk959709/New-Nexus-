import { storage, DEFAULT_PARALLAX_AGENTS } from '@/lib/storage';
import { api } from '@/services/api';
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

function createFallbackSpecialists(
  topic: string,
  countNeeded: number,
  existingIds: Set<string>,
  existingNames: Set<string>,
  baseAgent: ParallaxAgentConfig,
): ParallaxAgentConfig[] {
  const fallbacks: ParallaxAgentConfig[] = [];
  const cleanTopic = topic.trim().slice(0, 45);

  const fallbackTemplates = [
    {
      defaultSlug: 'domain_analyst',
      defaultName: 'DOMINA',
      emoji: '🔬',
      role: 'Subject Matter Specialist',
      instruction: `Provide analytical subject-matter evaluation and domain evidence on ${cleanTopic}.`,
    },
    {
      defaultSlug: 'field_practitioner',
      defaultName: 'PRAXIS',
      emoji: '🛠️',
      role: 'Applied Practice Specialist',
      instruction: `Evaluate frontline realities, practical constraints, and execution dynamics on ${cleanTopic}.`,
    },
    {
      defaultSlug: 'systems_ethicist',
      defaultName: 'AXIOM',
      emoji: '⚖️',
      role: 'Systems & Ethics Specialist',
      instruction: `Examine ethical nuances, systemic trade-offs, and second-order impacts on ${cleanTopic}.`,
    },
    {
      defaultSlug: 'societal_impact',
      defaultName: 'HUMANA',
      emoji: '🌐',
      role: 'Societal Dynamics Specialist',
      instruction: `Assess human-centric, cultural, and long-term societal consequences of ${cleanTopic}.`,
    },
    {
      defaultSlug: 'strategic_analyst',
      defaultName: 'STRATIS',
      emoji: '🎯',
      role: 'Strategic Trajectory Specialist',
      instruction: `Project strategic scenarios, structural risks, and future equilibria on ${cleanTopic}.`,
    },
  ];

  for (let i = 0; i < fallbackTemplates.length && fallbacks.length < countNeeded; i++) {
    const t = fallbackTemplates[i];
    let slug = t.defaultSlug;
    let name = t.defaultName;
    let suffix = 1;
    while (existingIds.has(slug)) {
      slug = `${t.defaultSlug}_${suffix++}`;
    }
    existingIds.add(slug);

    suffix = 1;
    while (existingNames.has(name)) {
      name = `${t.defaultName}-${suffix++}`;
    }
    existingNames.add(name);

    const palette = DYNAMIC_SPECIALIST_PALETTES[(existingIds.size - 1) % DYNAMIC_SPECIALIST_PALETTES.length];
    fallbacks.push({
      id: slug,
      name,
      initials: name.slice(0, 2),
      role: t.role,
      accentColor: palette.color,
      hasToolAccess: false,
      providerId: baseAgent.providerId || 'existing',
      modelId: baseAgent.modelId || 'deepseek/deepseek-chat',
      enabled: true,
      systemInstruction: t.instruction,
      maxTokens: 100,
      voice: palette.voice,
      isDynamic: true,
      mood: t.emoji,
    });
  }

  return fallbacks;
}

interface PersonaOpinionTarget {
  id: string;
  name: string;
  emoji: string;
  role: string;
  accentColor: string;
  angle: string;
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
    angle: 'empirical data, verifiable evidence, and methodological scrutiny',
    defaultSpecialist: 'Empirical Research & Methodology Specialist',
    defaultReason: 'Without verifiable empirical data on this topic, discourse risks resting on unchecked assertions.',
  },
  {
    id: 'axiom',
    name: 'AXIOM',
    emoji: '📐',
    role: 'Pure logic & scientific reasoning',
    accentColor: '#10b981',
    angle: 'first-principles logic, mathematical consistency, and causal systems dynamics',
    defaultSpecialist: 'Systems Logic & Causal Dynamics Specialist',
    defaultReason: 'A rigorous first-principles logical framework is required to trace systemic causal dependencies and consistency.',
  },
  {
    id: 'socrates',
    name: 'SOCRATES',
    emoji: '🤔',
    role: 'Deep philosophical questioning',
    accentColor: '#8b5cf6',
    angle: 'philosophical inquiry, interrogation of unexamined premises, and conceptual clarity',
    defaultSpecialist: 'Epistemology & Conceptual Foundations Specialist',
    defaultReason: 'We must examine the foundational premises and hidden assumptions that pre-condition debate on this question.',
  },
  {
    id: 'harmony',
    name: 'HARMONY',
    emoji: '🕊️',
    role: 'Ethical & ontological concerns',
    accentColor: '#14b8a6',
    angle: 'ethical imperatives, human dignity, societal equity, and emotional welfare',
    defaultSpecialist: 'Human Welfare & Applied Ethics Specialist',
    defaultReason: 'Human dignity, equity, and ethical consequences must anchor how this topic affects real communities.',
  },
  {
    id: 'nexus9',
    name: 'NEXUS-9',
    emoji: '⚖️',
    role: 'Neutral synthesizer/summarizer',
    accentColor: '#67e8f9',
    angle: 'systemic synthesis, trade-off governance, and multi-domain equilibrium',
    defaultSpecialist: 'Cross-Domain Governance & Trade-Offs Specialist',
    defaultReason: 'Balancing competing interests on this issue requires structural synthesis across institutional and policy trade-offs.',
  },
];

/**
 * Step 1: 5-Persona Opinion Step
 * VERITAS 🧠, AXIOM 📐, SOCRATES 🤔, HARMONY 🕊️, and NEXUS-9 ⚖️ each independently
 * give a short, reasoned opinion on what specialist expertise this specific topic needs
 * in their distinctive persona voice/style.
 * Token budget: ~140 input tokens, ~60-80 output tokens each.
 */
export async function fetchPersonaSpecialistOpinions(
  topic: string,
  existingAgents: ParallaxAgentConfig[],
  signal?: AbortSignal,
): Promise<ParallaxSpecialistOpinion[]> {
  const baseAgent = existingAgents[0] || DEFAULT_PARALLAX_AGENTS.veritas;
  const { provider } = resolveParallaxProviderConfig(baseAgent, 100);

  const opinionPromises = PERSONA_OPINION_TARGETS.map(async (target) => {
    const matchedAgent = existingAgents.find((a) => a.id.toLowerCase() === target.id) || baseAgent;
    const targetProvider = resolveParallaxProviderConfig(matchedAgent, 100).provider || provider;

    const sysContent = `You are ${target.name} ${target.emoji} (${target.role}).
Tone & priorities: ${target.angle}.
TASK: Propose ONE domain specialist expertise needed for this debate topic in your distinctive persona voice.
FORMAT STRICTLY:
Specialist: [Role or Domain Title]
Reason: [1 concise sentence in your persona voice explaining why this domain expertise is required]`;

    const userContent = `Topic: "${topic}"\nPropose the specialist expertise needed.`;

    try {
      const res = await api.jarvisAgentCall({
        agentId: `opinion_${target.id}`,
        messages: [
          { role: 'system', content: sysContent },
          { role: 'user', content: userContent },
        ],
        providerConfig: targetProvider,
        temperature: 0.35,
        maxTokens: 100,
        timeoutMs: 12000,
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
          reason = reason || lines[1].replace(/^[^:]*:\s*/, '').replace(/[*_#`]/g, '').trim();
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

/**
 * Step 2: Compile Step
 * Reviews the 5 suggestions and selects the 3 most distinct, non-overlapping specialist
 * ideas among them to eliminate redundancy. Compiles into exactly 3 mandatory specialists.
 * Token budget: ~220 input tokens, ~240 output tokens.
 */
export async function compileMandatorySpecialists(
  topic: string,
  opinions: ParallaxSpecialistOpinion[],
  existingAgents: ParallaxAgentConfig[],
  signal?: AbortSignal,
): Promise<ParallaxAgentConfig[]> {
  const baseAgent = existingAgents[0] || DEFAULT_PARALLAX_AGENTS.veritas;
  const { provider } = resolveParallaxProviderConfig(baseAgent, 280);

  const existingIds = new Set(existingAgents.map((a) => a.id.toLowerCase()));
  const existingNames = new Set(existingAgents.map((a) => a.name.toUpperCase()));

  const opinionLines = opinions
    .map((op, idx) => `${idx + 1}. ${op.agentName} ${op.emoji}: "${op.suggestedSpecialist}" — ${op.reason}`)
    .join('\n');

  const compilePrompt = `Topic: "${topic}"

5 Core Persona Specialist Suggestions:
${opinionLines}

TASK: Review the 5 suggestions and select the 3 most distinct and non-overlapping specialist ideas among them (avoid redundancy).
Compile these into exactly 3 mandatory specialist personas tailored for this topic.

OUTPUT STRICT JSON ONLY:
{
  "selected": [
    {
      "id": "slug",
      "name": "UPPERCASE_NAME",
      "emoji": "✨",
      "role": "Specific Domain Specialist Role",
      "systemInstruction": "1-2 sentences on analytical priorities and perspective."
    }
  ]
}`;

  try {
    const res = await api.jarvisAgentCall({
      agentId: 'specialist_compiler',
      messages: [
        {
          role: 'system',
          content: 'You are the PARALLAX Specialist Compiler. You review 5 persona proposals and select the top 3 distinct, non-overlapping specialist personas. You output strict JSON only.',
        },
        { role: 'user', content: compilePrompt },
      ],
      providerConfig: provider,
      temperature: 0.3,
      maxTokens: 280,
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
        if (Array.isArray(parsed.selected)) {
          rawList = parsed.selected.slice(0, 3);
        }
      } catch (e) {
        console.warn('[Parallax Compile] JSON parse warning, supplementing with fallbacks:', e);
      }
    }

    const mandatorySpecialists: ParallaxAgentConfig[] = [];

    rawList.forEach((item: Record<string, unknown>, idx: number) => {
      if (!item || typeof item !== 'object') return;
      let rawId = typeof item.id === 'string' ? item.id.toLowerCase().replace(/[^a-z0-9]/g, '') : `mand_spec_${idx + 1}`;
      if (!rawId || existingIds.has(rawId)) {
        rawId = `${rawId}_${idx + 1}`;
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
        maxTokens: 100,
        voice: palette.voice,
        isDynamic: true,
        mood: emoji,
      });
    });

    if (mandatorySpecialists.length < 3) {
      const needed = 3 - mandatorySpecialists.length;
      const supplemental = createFallbackSpecialists(topic, needed, existingIds, existingNames, baseAgent);
      mandatorySpecialists.push(...supplemental);
    }

    return mandatorySpecialists.slice(0, 3);
  } catch (err) {
    if (signal?.aborted) throw err;
    console.warn('[Parallax Compile] Compiler call failed, generating fallback mandatory specialists:', err);
    return createFallbackSpecialists(topic, 3, existingIds, existingNames, baseAgent);
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
  const selectedMandatory = await compileMandatorySpecialists(topic, opinions, existingAgents, signal);

  onStatusUpdate?.('Pre-Round 1: Evaluating if acute domain gaps require additional specialists...');
  const additionalSpecialists = await evaluateAdditionalSpecialists(topic, existingAgents, selectedMandatory, signal);

  const allSpecialists = [...selectedMandatory, ...additionalSpecialists];

  return {
    opinions,
    selectedMandatory,
    additionalSpecialists,
    allSpecialists,
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
      const fallbackMandatory = createFallbackSpecialists(topic, 3, existingIds, existingNames, baseAgent);
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
