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
  committedFact: string; // The single verified grounding fact committed to before Round 1
  round1Statement?: string; // Stated position in Round 1 to ensure R2 & R3 consistency
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
      committedFact: '',
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

  // 1. Initial heuristic candidate for committed fact
  const topCandidate = rawResults.find((r) => r.description && r.description.trim().length > 30) || rawResults[0];
  const rawSnippet = (topCandidate?.description || topCandidate?.title || '').replace(/\s+/g, ' ').trim();
  let committedFact = rawSnippet.length > 180 ? rawSnippet.slice(0, 177) + '…' : rawSnippet;

  // 2. Extract and commit to ONE specific verified fact via active AI provider before Round 1
  try {
    if (signal?.aborted) throw new Error('Search aborted');
    const sysConfig = storage.getParallaxConfig();
    const allAgents = Object.values(sysConfig.agents || DEFAULT_PARALLAX_AGENTS);
    const veritasAgent = allAgents.find((a) => a.id === 'veritas') || DEFAULT_PARALLAX_AGENTS.veritas;
    const { provider } = resolveParallaxProviderConfig(veritasAgent, 100);

    const factExtractPrompt = `You are VERITAS's empirical fact commitment engine.
Topic: "${topic}"

Search Results (${rawResults.length} sources via ${sourceLabel}):
${formattedGrounding}

TASK:
Synthesize the search sources above and commit to EXACTLY ONE definitive, verified fact or empirical summary that directly answers the topic (e.g. "Winner: X, Race/Event: Y, Date: Z", or key verified metric/outcome).

MANDATORY RULES:
1. Commit to ONE specific factual outcome. Do NOT waffle, generalize, or list multiple contradictory winners/claims as equally valid.
2. If the search results themselves are genuinely conflicting or report contradictory winners/outcomes, explicitly state that conflict right here in one crisp sentence (e.g. "Sources conflict: Source A reports X won in [year], while Source B reports Y won in [year]").
3. Maximum 1-2 concise sentences (<40 words). No greeting, no conversational preamble. Output ONLY the committed fact statement.`;

    const factRes = await api.jarvisAgentCall({
      agentId: 'veritas_fact_committer',
      messages: [{ role: 'user', content: factExtractPrompt }],
      providerConfig: provider,
      temperature: 0.1,
      maxTokens: 90,
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

  console.log(`[Parallax Veritas] Live search grounding successful: ${rawResults.length} sources via ${sourceLabel}. Committed Fact: "${committedFact}"`);

  return {
    results: rawResults,
    searchSource: sourceLabel,
    query: topic,
    formattedGrounding,
    sourcesCount: rawResults.length,
    topFactSnippet: committedFact,
    committedFact,
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
      if (veritasGrounding && !veritasGrounding.failed && veritasGrounding.committedFact) {
        // Grounding context injected into VERITAS only
        userPrompt = `Topic: "${topic}"

[COMMITTED VERIFIED GROUNDING FACT]:
"${veritasGrounding.committedFact}"

Supporting search sources (${veritasGrounding.sourcesCount} sources via ${veritasGrounding.searchSource}):
${veritasGrounding.formattedGrounding}

Instruction: Ground your initial 1-2 sentence perspective strictly on the COMMITTED VERIFIED GROUNDING FACT above. Commit to this specific outcome as your baseline. If the search results themselves are genuinely conflicting or ambiguous, state that ambiguity explicitly ONCE right now. Speak with empirical precision as VERITAS.`;
      } else {
        // Graceful failure fallback prompt if search returned 0 results
        userPrompt = `Topic: "${topic}"\n\n[Live Search Notice: Current search fallbacks returned no recent results. Rely on your rigorous training knowledge and first principles.]\nProvide your initial 1-2 sentence perspective on this topic based on your fact-based, skeptical analysis.`;
      }
    } else {
      userPrompt = `Topic: "${topic}"\nProvide your initial 1-2 sentence perspective on this topic based on your archetype.`;
    }
  } else {
    // Rounds 2 & 3:
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

    if (agent.id === 'veritas' && veritasGrounding && !veritasGrounding.failed && veritasGrounding.committedFact) {
      // INJECT THE COMMITTED FACT INTO VERITAS FOR ROUNDS 2 AND 3 (NO raw results, preserving absolute consistency)
      const prevStance = veritasGrounding.round1Statement
        ? `\nYour Round 1 stated position: "${veritasGrounding.round1Statement}"`
        : '';

      userPrompt = `Topic: "${topic}"

[YOUR COMMITTED VERIFIED FACT - DO NOT CONTRADICT OR ALTER]:
"${veritasGrounding.committedFact}"${prevStance}

CRITICAL CONSISTENCY MANDATE FOR VERITAS:
You MUST stay completely consistent with your committed verified fact above and your Round 1 stated position. Do NOT cite a different winner, date, race, or outcome. Do NOT re-interpret or alter the facts. If you noted an ambiguity or conflict in Round 1, maintain that exact same stated ambiguity.

Peer points from Round ${round - 1}:
${peerBullets}

${action} as VERITAS, strictly upholding your committed verified fact.`;
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
 * Sends real quotes from Rounds 1, 2, and 3 to ensure highlights reflect the actual debate transcript.
 */
export async function generateParallaxSummary(
  topic: string,
  allMessages: ParallaxMessage[],
): Promise<ParallaxSummary> {
  const round1Msgs = allMessages.filter((m) => m.round === 1);
  const round2Msgs = allMessages.filter((m) => m.round === 2);
  const round3Msgs = allMessages.filter((m) => m.round === 3);

  const excerpts: string[] = [];

  // 1. Round 1 opening stances (VERITAS first if present, then diverse initial angles)
  const r1Veritas = round1Msgs.find((m) => m.agentId === 'veritas');
  if (r1Veritas) {
    const trimmed = r1Veritas.text.length > 150 ? r1Veritas.text.slice(0, 147) + '…' : r1Veritas.text;
    excerpts.push(`• [Round 1 Opening Fact] VERITAS: "${trimmed}"`);
  }
  for (const m of round1Msgs.filter((m) => m.agentId !== 'veritas').slice(0, 3)) {
    const trimmed = m.text.length > 140 ? m.text.slice(0, 137) + '…' : m.text;
    excerpts.push(`• [Round 1 Opening] ${m.agentName}: "${trimmed}"`);
  }

  // 2. Round 2 cross-debate clashes and friction
  for (const m of round2Msgs.slice(0, 4)) {
    const trimmed = m.text.length > 140 ? m.text.slice(0, 137) + '…' : m.text;
    excerpts.push(`• [Round 2 Rebuttal] ${m.agentName}: "${trimmed}"`);
  }

  // 3. Round 3 final stances and conclusions
  const r3Veritas = round3Msgs.find((m) => m.agentId === 'veritas');
  if (r3Veritas) {
    const trimmed = r3Veritas.text.length > 140 ? r3Veritas.text.slice(0, 137) + '…' : r3Veritas.text;
    excerpts.push(`• [Round 3 Final Stance] VERITAS: "${trimmed}"`);
  }
  for (const m of round3Msgs.filter((m) => m.agentId !== 'veritas').slice(0, 3)) {
    const trimmed = m.text.length > 140 ? m.text.slice(0, 137) + '…' : m.text;
    excerpts.push(`• [Round 3 Conclusion] ${m.agentName}: "${trimmed}"`);
  }

  // Supplement if fewer than 6 collected
  if (excerpts.length < 6 && allMessages.length > 0) {
    for (const m of allMessages.slice(0, 8)) {
      const trimmed = m.text.length > 140 ? m.text.slice(0, 137) + '…' : m.text;
      const str = `• [Round ${m.round}] ${m.agentName}: "${trimmed}"`;
      if (!excerpts.includes(str)) {
        excerpts.push(str);
      }
    }
  }

  // DEBUG CONSOLE LOG: Exact transcript content passed to the synthesizer
  console.log(
    `[Parallax Synthesizer] Generating final summary report for topic: "${topic}". Input transcript excerpts (${excerpts.length} quotes from Rounds 1-3):\n${excerpts.join('\n')}`,
  );

  const prompt = `Synthesize this 20-agent PARALLAX swarm debate on the topic: "${topic}".
Total messages recorded: ${allMessages.length} across Rounds 1, 2, and 3.

Actual debate transcript quotes:
${excerpts.join('\n')}

Instructions:
1. Base your synthesis ENTIRELY on what the personas above actually argued regarding "${topic}".
2. In "highlights", write 4 concise bullet points (1 sentence each). Every highlight MUST explicitly cite specific persona names and their actual claims/tensions from the transcript quotes above (e.g. "VERITAS grounded the debate with verified data on [fact], while [AgentName] contested that [claim]"). Never output generic platitudes.
3. In "verdict", write 1 objective sentence summarizing the swarm's actual final consensus, balance of evidence, or division on "${topic}".
4. In "consensusLean", provide a 2-4 word descriptor of the swarm's collective alignment (e.g. "Empirically Grounded Lean", "Cautiously Split", "Factually Polarized", "Strong Skepticism").

Output JSON format only:
{
  "verdict": "One crisp objective sentence summarizing swarm consensus on ${topic}.",
  "consensusLean": "2-4 words",
  "highlights": ["Highlight 1", "Highlight 2", "Highlight 3", "Highlight 4"]
}`;

  const sysConfig = storage.getParallaxConfig();
  const allAgents = Object.values(sysConfig.agents || DEFAULT_PARALLAX_AGENTS);
  const { provider } = resolveParallaxProviderConfig(allAgents[0] || DEFAULT_PARALLAX_AGENTS.veritas, 700);

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
      maxTokens: 600,
      timeoutMs: 25000,
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
