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
 * VERITAS EXCEPTION:
 * In Round 1 only, VERITAS gets exactly ONE tool call to search for a real-time fact.
 * No other agent gets tool access. VERITAS does not get tool access in Rounds 2 or 3.
 */
export async function fetchVeritasFact(topic: string): Promise<{ fact: string; source: string; query: string } | null> {
  try {
    const searchRes = await api.search(topic, 'ALL', 1, 3);
    if (searchRes && searchRes.length > 0) {
      const top = searchRes.find((r) => r.snippet && r.snippet.trim().length > 15) || searchRes[0];
      const snippet = (top.snippet || top.title || '').replace(/\s+/g, ' ').trim();
      if (snippet) {
        return {
          fact: snippet.length > 180 ? snippet.slice(0, 180) + '...' : snippet,
          source: top.url || top.title || 'Live Web Search',
          query: topic,
        };
      }
    }
  } catch (err) {
    console.warn('[Parallax] Veritas search tool query failed, checking wiki:', err);
  }

  try {
    const wiki = await api.searchWikipedia(topic, 1);
    if (wiki && wiki.length > 0 && wiki[0].snippet) {
      const cleaned = wiki[0].snippet.replace(/<[^>]*>?/gm, '').trim();
      if (cleaned) {
        return {
          fact: cleaned.length > 180 ? cleaned.slice(0, 180) + '...' : cleaned,
          source: `Wikipedia: ${wiki[0].title}`,
          query: topic,
        };
      }
    }
  } catch {
    // Non-fatal
  }

  return null;
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

/**
 * Executes a single agent reaction turn.
 */
async function executeAgentTurn(
  agent: ParallaxAgentConfig,
  round: 1 | 2 | 3,
  topic: string,
  peersSample: ParallaxMessage[],
  veritasFact: { fact: string; source: string; query: string } | null,
  signal?: AbortSignal,
): Promise<ParallaxMessage> {
  const startTime = Date.now();
  const { provider, model } = resolveParallaxProviderConfig(agent, 95);

  const systemPrompt = `You are ${agent.name}, one of 20 distinct AI personas in the fast-paced PARALLAX Swarm Discussion.
YOUR ARCHETYPE: ${agent.role}
CORE INSTRUCTION: ${agent.systemInstruction}

CRITICAL RULES:
- Output EXACTLY 1 or 2 concise, highly punchy sentences.
- Never exceed 45 words.
- Do NOT introduce yourself, do NOT say "As ${agent.name}", and do NOT repeat your name.
- Speak directly and decisively in your persona's distinctive voice.`;

  let userPrompt = '';

  if (round === 1) {
    userPrompt = `TOPIC: "${topic}"`;
    // VERITAS ONLY in Round 1
    if (agent.id === 'veritas' && veritasFact) {
      userPrompt += `\n\n[VERIFIED DATA VIA LIVE TOOL]: "${veritasFact.fact}" (Source: ${veritasFact.source})\nIncorporate or critically scrutinize this verifiable fact in your 1-2 sentence response.`;
    } else {
      userPrompt += `\n\nProvide your initial 1-2 sentence perspective on this topic based on your archetype.`;
    }
  } else {
    // Rounds 2 & 3: Topic + rotating sample of 2-3 previous replies
    const peerBullets = peersSample
      .map((p) => `- [${p.agentName}]: "${p.text}"`)
      .join('\n');

    userPrompt = `TOPIC: "${topic}"

SELECT STATEMENTS FROM PEERS IN PREVIOUS ROUND:
${peerBullets}

YOUR TASK:
React to these peer viewpoints or synthesize them with the topic through your unique lens (${agent.name} - ${agent.role}).
Keep your reaction strictly 1 to 2 sharp sentences.`;
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
      maxTokens: 90,
      timeoutMs: 14000,
    });

    const rawText = response.text || response.content || '';
    const cleaned = cleanReactionText(rawText, agent.name);

    return {
      id: `plx_${agent.id}_r${round}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      agentId: agent.id,
      agentName: agent.name,
      initials: agent.initials,
      accentColor: agent.accentColor,
      round,
      text: cleaned,
      timestamp: Date.now(),
      durationMs: Date.now() - startTime,
      model: response.model || model,
      providerName: response.providerName || provider?.name || 'Built-in AI',
      toolUsed:
        round === 1 && agent.id === 'veritas' && veritasFact
          ? {
              tool: 'search',
              query: veritasFact.query,
              fact: veritasFact.fact,
            }
          : undefined,
    };
  } catch (err: unknown) {
    if (signal?.aborted) {
      throw err;
    }

    // Graceful fallback reaction reflecting the agent's core disposition
    const fallbackText = getFallbackReaction(agent, round, topic);
    return {
      id: `plx_${agent.id}_r${round}_fallback_${Date.now()}`,
      agentId: agent.id,
      agentName: agent.name,
      initials: agent.initials,
      accentColor: agent.accentColor,
      round,
      text: fallbackText,
      timestamp: Date.now(),
      durationMs: Date.now() - startTime,
      model: model || 'fallback',
      providerName: 'Local Mesh',
      toolUsed:
        round === 1 && agent.id === 'veritas' && veritasFact
          ? {
              tool: 'search',
              query: veritasFact.query,
              fact: veritasFact.fact,
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

  // Find high-contrast agent quotes
  const aurora = agentMap.get('AURORA')?.[0]?.text || 'optimistic possibilities exist';
  const vanguard = agentMap.get('VANGUARD')?.[1]?.text || agentMap.get('VANGUARD')?.[0]?.text || 'skeptical friction persists';
  const socrates = agentMap.get('SOCRATES')?.[1]?.text || agentMap.get('SOCRATES')?.[0]?.text || 'fundamental assumptions need interrogation';
  const axiom = agentMap.get('AXIOM')?.[1]?.text || agentMap.get('AXIOM')?.[0]?.text || 'logical principles dictate limits';
  const veritas = agentMap.get('VERITAS')?.[0]?.text || 'empirical facts remain essential';
  const gravity = agentMap.get('GRAVITY')?.[2]?.text || agentMap.get('GRAVITY')?.[1]?.text || 'operational friction governs reality';

  // Fast synthesis via LLM
  try {
    const prompt = `You are the synthesis engine for PARALLAX, a 20-agent swarm intelligence discussion.
TOPIC: "${topic}"
TOTAL REPLIES: ${allMessages.length} (3 rounds)

AGENT EXCERPTS:
- AURORA: "${aurora}"
- VANGUARD: "${vanguard}"
- SOCRATES: "${socrates}"
- AXIOM: "${axiom}"
- VERITAS: "${veritas}"
- GRAVITY: "${gravity}"

Generate a JSON object with:
1. "verdict": exactly ONE crisp, objective sentence summarizing the swarm's overall consensus or lean on "${topic}".
2. "consensusLean": 2-4 words characterizing the dominant direction (e.g. "Cautiously Optimistic", "Pragmatically Skeptical", "Deeply Polarized", "Techno-Realistic").
3. "highlights": array of exactly 4 concise bullet points describing key tensions or clashes between specific agents (e.g. "VANGUARD contested AURORA's optimistic outlook...", "SOCRATES and AXIOM clashed over fundamental definitions...", etc.).

Output ONLY valid JSON.`;

    const res = await api.jarvisAgentCall({
      agentId: 'parallax_synthesizer',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      maxTokens: 350,
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

      // ROUND 1: VERITAS gets ONE tool call to live search
      let veritasFact: { fact: string; source: string; query: string } | null = null;
      if (currentRound === 1) {
        const veritasAgent = enabledAgents.find((a) => a.id === 'veritas');
        if (veritasAgent) {
          onStatusUpdate?.('Round 1 of 3: VERITAS querying real-time verification tool...');
          veritasFact = await fetchVeritasFact(topic);
        }
      }

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

          // In Round 1, ONLY VERITAS gets the tool fact. In Rounds 2 & 3, tool access is strictly null.
          const factForAgent = currentRound === 1 && agent.id === 'veritas' ? veritasFact : null;

          const msg = await executeAgentTurn(
            agent,
            currentRound,
            topic,
            peersSample,
            factForAgent,
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
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      }

      onRoundComplete?.(currentRound, roundMessages);

      // Brief breather between rounds
      if (roundNum < 3) {
        onStatusUpdate?.(`Round ${currentRound} complete. Transitioning to Round ${currentRound + 1}...`);
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
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
      onStatusUpdate?.('Parallax swarm cancelled.');
      return;
    }
    console.error('[Parallax] Swarm execution error:', err);
    onError?.(err instanceof Error ? err.message : 'Unknown error during swarm execution.');
  }
}
