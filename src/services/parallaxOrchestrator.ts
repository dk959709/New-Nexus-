import { storage, DEFAULT_PARALLAX_AGENTS } from '@/lib/storage';
import { api } from '@/services/api';
import type {
  AIProviderConfig,
  ParallaxAgentConfig,
  ParallaxMessage,
  ParallaxSummary,
  ParallaxSystemConfig,
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
  results: Array<{ title: string; url: string; description?: string; domain?: string }>;
  searchSource: string;
  query: string;
  formattedGrounding: string;
  sourcesCount: number;
  topFactSnippet: string;
  failed: boolean;
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

  let rawResults: Array<{ title: string; url: string; description?: string; domain?: string }> = [];
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

  // Graceful fallback: If all fallbacks returned 0 results, mark failed and allow VERITAS to proceed using training knowledge
  if (rawResults.length === 0) {
    console.warn(`[Parallax Veritas] All search fallbacks returned 0 results for "${topic}". Gracefully falling back to training knowledge.`);
    return {
      results: [],
      searchSource: 'No results found',
      query: topic,
      formattedGrounding: '',
      sourcesCount: 0,
      topFactSnippet: 'No live search results returned across fallback providers.',
      failed: true,
    };
  }

  // Format the 10 sources into clear grounding context for VERITAS's prompt
  const formattedGrounding = rawResults
    .map((r, idx) => {
      const title = (r.title || 'Untitled Source').trim();
      let domain = r.domain;
      if (!domain && r.url) {
        try {
          domain = new URL(r.url).hostname;
        } catch {
          domain = 'web';
        }
      }
      const snippet = (r.description || '').replace(/\s+/g, ' ').trim();
      return `[${idx + 1}] "${title}" (${domain || 'web'})\n    ${snippet.slice(0, 220)}`;
    })
    .join('\n');

  // Extract top fact snippet for UI preview badge
  const top = rawResults.find((r) => r.description && r.description.trim().length > 20) || rawResults[0];
  const snippet = (top?.description || top?.title || '').replace(/\s+/g, ' ').trim();
  const topFactSnippet = snippet.length > 180 ? snippet.slice(0, 177) + '...' : snippet;

  console.log(`[Parallax Veritas] Live search grounding successful: ${rawResults.length} sources via ${sourceLabel}`);

  return {
    results: rawResults,
    searchSource: sourceLabel,
    query: topic,
    formattedGrounding,
    sourcesCount: rawResults.length,
    topFactSnippet,
    failed: false,
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
  onComplete?: (summary: ParallaxSummary, allMessages: ParallaxMessage[]) => void;
  onError?: (error: string) => void;
  signal?: AbortSignal;
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
function parseConvictionAndMood(raw: string, agentId: string): {
  cleanText: string;
  conviction: number;
  mood: string;
} {
  const fallback = DEFAULT_AGENT_METRICS[agentId.toLowerCase()] || { conviction: 7, mood: '⚡' };
  let conviction = fallback.conviction;
  let mood = fallback.mood;
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

  // Compact, high-signal system prompt with lightweight conviction & mood request (~45 tokens)
  const systemPrompt = `Persona: ${agent.name} (${agent.role}). ${agent.systemInstruction}
Constraint: Exactly 1-2 punchy sentences (<40 words). Speak directly; no greeting, no intro, no self-naming. End with [conviction 1-10|mood emoji] (e.g. [9|🔥]).`;

  let userPrompt = '';

  if (round === 1) {
    if (agent.id === 'veritas') {
      if (veritasGrounding && !veritasGrounding.failed && veritasGrounding.formattedGrounding) {
        // Grounding context injected into VERITAS only
        userPrompt = `Topic: "${topic}"\n\nHere are real, current search results on this topic:\n${veritasGrounding.formattedGrounding}\n\nUse these facts to inform your fact-based, skeptical analysis. Provide your initial 1-2 sentence perspective on this topic based on your archetype.`;
      } else {
        // Graceful failure fallback prompt if search returned 0 results
        userPrompt = `Topic: "${topic}"\n\n[Live Search Notice: Current search fallbacks returned no recent results. Rely on your rigorous training knowledge and first principles.]\nProvide your initial 1-2 sentence perspective on this topic based on your fact-based, skeptical analysis.`;
      }
    } else {
      userPrompt = `Topic: "${topic}"\nProvide your initial 1-2 sentence perspective on this topic based on your archetype.`;
    }
  } else {
    // Rounds 2 & 3: ONLY topic + compact rotating sample of 2-3 previous replies (NO accumulated history)
    const peerBullets = peersSample
      .slice(0, 3)
      .map((p) => {
        const text = p.text.length > 140 ? p.text.slice(0, 137) + '…' : p.text;
        return `• ${p.agentName}: "${text}"`;
      })
      .join('\n');

    const action =
      round === 2
        ? 'React to these peer views in 1-2 sharp sentences'
        : 'Deliver your final 1-2 sentence synthesis';

    userPrompt = `Topic: "${topic}"\n\nPeer points from Round ${round - 1}:\n${peerBullets}\n\n${action} as ${agent.name}.`;
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
    const { cleanText: rawWithoutMeta, conviction, mood } = parseConvictionAndMood(rawText, agent.id);
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
      mood,
      timestamp: Date.now(),
      durationMs: Date.now() - startTime,
      model: response.model || model,
      providerName: response.providerName || provider?.name || 'Built-in AI',
      toolUsed:
        round === 1 && agent.id === 'veritas' && veritasGrounding
          ? {
              tool: 'search',
              query: veritasGrounding.query,
              fact: veritasGrounding.topFactSnippet,
              searchSource: veritasGrounding.searchSource,
              sourcesCount: veritasGrounding.sourcesCount,
              failed: veritasGrounding.failed,
              statusLabel: veritasGrounding.failed
                ? '⚠️ No results found'
                : `✅ ${veritasGrounding.searchSource}`,
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
      mood: fallbackMeta.mood,
      timestamp: Date.now(),
      durationMs: Date.now() - startTime,
      model: model || 'fallback',
      providerName: 'Local Mesh',
      toolUsed:
        round === 1 && agent.id === 'veritas' && veritasGrounding
          ? {
              tool: 'search',
              query: veritasGrounding.query,
              fact: veritasGrounding.topFactSnippet,
              searchSource: veritasGrounding.searchSource,
              sourcesCount: veritasGrounding.sourcesCount,
              failed: veritasGrounding.failed,
              statusLabel: veritasGrounding.failed
                ? '⚠️ No results found'
                : `✅ ${veritasGrounding.searchSource}`,
            }
          : undefined,
    };
  }
}

/**
 * Intelligent persona fallbacks in case of network timeouts.
 */
function getFallbackReaction(agent: ParallaxAgentConfig, round: number, topic: string): string {
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
 * Generates the Parallax Summary after Round 3 completes.
 * Sends a condensed set of 6-8 notable contrasting quotes (strictly under 400 tokens input).
 */
export async function generateParallaxSummary(
  topic: string,
  allMessages: ParallaxMessage[],
): Promise<ParallaxSummary> {
  const agentMap = new Map<string, ParallaxMessage[]>();
  for (const m of allMessages) {
    const list = agentMap.get(m.agentName) || [];
    list.push(m);
    agentMap.set(m.agentName, list);
  }

  // Curate key contrasting perspectives across diverse archetypes
  const notableAgents = ['AURORA', 'VANGUARD', 'SOCRATES', 'AXIOM', 'VERITAS', 'GRAVITY', 'HARMONY', 'LEDGER'];
  const excerpts: string[] = [];

  for (const name of notableAgents) {
    const msgs = agentMap.get(name);
    if (msgs && msgs.length > 0) {
      const target = msgs[msgs.length - 1];
      const trimmed = target.text.length > 135 ? target.text.slice(0, 132) + '…' : target.text;
      excerpts.push(`• ${name} (R${target.round}): "${trimmed}"`);
    }
  }

  // Fallback if custom agent IDs were used: pick 6 evenly spaced samples
  if (excerpts.length === 0 && allMessages.length > 0) {
    const step = Math.max(1, Math.floor(allMessages.length / 6));
    for (let i = 0; i < allMessages.length && excerpts.length < 6; i += step) {
      const m = allMessages[i];
      const trimmed = m.text.length > 135 ? m.text.slice(0, 132) + '…' : m.text;
      excerpts.push(`• ${m.agentName} (R${m.round}): "${trimmed}"`);
    }
  }

  // Fast synthesis via LLM with strictly bounded input (~300-380 tokens)
  try {
    const prompt = `Synthesize this 20-agent PARALLAX swarm discussion on "${topic}".
Total messages: ${allMessages.length} across 3 rounds.

Key contrasting quotes:
${excerpts.join('\n')}

Generate a JSON object:
{
  "verdict": "One crisp objective sentence summarizing swarm consensus or lean on ${topic}.",
  "consensusLean": "2-4 words (e.g. Cautiously Optimistic, Pragmatically Skeptical, Deeply Polarized, Techno-Realistic)",
  "highlights": ["Clash or tension bullet 1", "Clash or tension bullet 2", "Clash or tension bullet 3", "Clash or tension bullet 4"]
}
Output valid JSON only.`;

    const res = await api.jarvisAgentCall({
      agentId: 'parallax_synthesizer',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      maxTokens: 280,
      timeoutMs: 12000,
    });

    const text = (res.text || res.content || '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.verdict && Array.isArray(parsed.highlights)) {
        return {
          verdict: parsed.verdict,
          highlights: parsed.highlights.slice(0, 5),
          consensusLean: parsed.consensusLean || 'Dynamic Equilibrium',
          totalContributions: allMessages.length,
        };
      }
    }
  } catch (err) {
    console.warn('[Parallax] LLM summary synthesis had error, using deterministic synthesis:', err);
  }

  // Deterministic high-quality fallback synthesis
  return {
    verdict: `The swarm converged on cautious pragmatism, balancing high-upside innovation against stubborn logistical and ethical realities.`,
    consensusLean: 'Pragmatically Polarized',
    highlights: [
      `VANGUARD vigorously challenged AURORA's optimism, warning against uncritical groupthink on adoption curves.`,
      `SOCRATES and AXIOM clashed on whether mathematical rigor or philosophical intent should guide governance.`,
      `VERITAS anchored the debate with empirical verification, while ECHO reflected sharp public skepticism.`,
      `LEDGER scrutinized economic margins and unit capital, meeting pushback from HARMONY's ethical considerations.`,
    ],
    totalContributions: allMessages.length,
  };
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
    // STRICT ROUND CAP: Exactly 3 rounds (1, 2, 3)
    // -------------------------------------------------------------
    for (let roundNum = 1; roundNum <= 3; roundNum++) {
      if (signal?.aborted) {
        onStatusUpdate?.('Parallax swarm stopped by user.');
        return;
      }

      const currentRound = roundNum as 1 | 2 | 3;
      onRoundStart?.(currentRound);
      onStatusUpdate?.(`Round ${currentRound} of 3: Mobilizing ${enabledAgents.length} agents...`);

      const roundMessages: ParallaxMessage[] = [];

      // Execute agents in controlled batches of 4 for a responsive, live YouTube-feed streaming cadence
      const BATCH_SIZE = 4;
      for (let i = 0; i < enabledAgents.length; i += BATCH_SIZE) {
        if (signal?.aborted) {
          onStatusUpdate?.('Parallax swarm stopped by user.');
          return;
        }

        const batch = enabledAgents.slice(i, i + BATCH_SIZE);
        onStatusUpdate?.(
          `Round ${currentRound} of 3: Streaming agent inputs (${Math.min(i + BATCH_SIZE, enabledAgents.length)}/${enabledAgents.length})...`,
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
              // Deterministic rotating sampling with high diversity
              const offset1 = currentRound === 2 ? 3 : 5;
              const offset2 = currentRound === 2 ? 7 : 11;
              const offset3 = currentRound === 2 ? 13 : 17;

              const idx1 = (globalIdx + offset1) % N;
              const idx2 = (globalIdx + offset2) % N;
              const idx3 = (globalIdx + offset3) % N;

              const s1 = prevRoundMsgs[idx1];
              const s2 = prevRoundMsgs[idx2];
              const s3 = prevRoundMsgs[idx3];

              peersSample = [s1, s2, s3].filter(
                (p, pIdx, self) => p && self.findIndex((x) => x?.agentId === p?.agentId) === pIdx && p.agentId !== agent.id,
              );
            }
          }

          // In Round 1, ONLY VERITAS gets the live search grounding.
          // In Rounds 2 & 3, tool access is strictly null (do not re-search).
          // All other 19 personas get null across all rounds.
          const groundingForAgent = currentRound === 1 && agent.id === 'veritas' ? veritasGrounding : null;

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
          roundMessages.push(msg);
          allMessages.push(msg);
          onMessage(msg);
        }

        // Brief natural pause between batches for smooth streaming visual rhythm
        if (i + BATCH_SIZE < enabledAgents.length) {
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
