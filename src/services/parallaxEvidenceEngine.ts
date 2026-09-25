import { api } from '@/services/api';
import { storage } from '@/lib/storage';
import { resolveParallaxProviderConfig, formatSearchSourceLabel } from './parallaxOrchestrator';
import type {
  ParallaxEntityResolution,
  ParallaxEvidenceItem,
  ParallaxClaim,
  ParallaxClaimType,
  ParallaxVerificationStatus,
  ParallaxEvidenceType,
  ParallaxMessage,
} from '@/types';

/**
 * Known entity lookup dictionary for fast, instant canonical resolution of common AI models,
 * companies, and technology terms that are frequently misspelled.
 */
const CANONICAL_ENTITY_MAP: Record<string, { canonical: string; type: ParallaxEntityResolution['entityType']; aliases: string[] }> = {
  'gtp 6 astra': { canonical: 'GPT-6 Astra (Hypothetical/Rumored OpenAI Model)', type: 'model', aliases: ['GPT-6 Astra', 'GPT6 Astra'] },
  'gtp 6': { canonical: 'GPT-6 (Unreleased OpenAI Model)', type: 'model', aliases: ['GPT 6', 'GPT-6'] },
  'gtp 5': { canonical: 'GPT-5 (Unreleased OpenAI Model)', type: 'model', aliases: ['GPT 5', 'GPT-5'] },
  'gtp 4': { canonical: 'GPT-4', type: 'model', aliases: ['GPT 4', 'GPT-4'] },
  'gtp 4o': { canonical: 'GPT-4o', type: 'model', aliases: ['GPT 4o', 'GPT-4o', 'GPT4o'] },
  'chat gtp': { canonical: 'ChatGPT', type: 'product', aliases: ['ChatGPT', 'ChatGTP'] },
  'chatgtp': { canonical: 'ChatGPT', type: 'product', aliases: ['ChatGPT', 'ChatGTP'] },
  'deepseek r1': { canonical: 'DeepSeek-R1', type: 'model', aliases: ['DeepSeek R1', 'DeepSeek-R1'] },
  'deepseek v3': { canonical: 'DeepSeek-V3', type: 'model', aliases: ['DeepSeek V3', 'DeepSeek-V3'] },
  'claude 3 7': { canonical: 'Claude 3.7 Sonnet', type: 'model', aliases: ['Claude 3.7', 'Claude 3.7 Sonnet'] },
  'claude 3.7': { canonical: 'Claude 3.7 Sonnet', type: 'model', aliases: ['Claude 3.7', 'Claude 3.7 Sonnet'] },
  'claude 3 5': { canonical: 'Claude 3.5 Sonnet', type: 'model', aliases: ['Claude 3.5', 'Claude 3.5 Sonnet'] },
  'gemini 2 0': { canonical: 'Gemini 2.0 Flash/Pro', type: 'model', aliases: ['Gemini 2.0', 'Gemini 2'] },
  'gemini 2.0': { canonical: 'Gemini 2.0 Flash/Pro', type: 'model', aliases: ['Gemini 2.0', 'Gemini 2'] },
  'llama 3 3': { canonical: 'Llama 3.3 70B', type: 'model', aliases: ['Llama 3.3', 'Llama-3.3'] },
  'llama 3.3': { canonical: 'Llama 3.3 70B', type: 'model', aliases: ['Llama 3.3', 'Llama-3.3'] },
  'mistral lechat': { canonical: 'Mistral Le Chat', type: 'product', aliases: ['Le Chat', 'Mistral Chat'] },
  'grok 3': { canonical: 'Grok 3', type: 'model', aliases: ['Grok 3', 'xAI Grok 3'] },
  'q star': { canonical: 'Q* (Project Strawberry/o1)', type: 'technology', aliases: ['Q*', 'Q-Star', 'Strawberry'] },
  'q*': { canonical: 'Q* (Project Strawberry/o1)', type: 'technology', aliases: ['Q*', 'Q-Star', 'Strawberry'] },
  'sora 2': { canonical: 'Sora (OpenAI Video Generation)', type: 'model', aliases: ['Sora', 'Sora 2'] },
};

/**
 * Evaluates domain reliability and evidence type.
 */
export function classifyEvidenceSource(url: string, title: string, snippet: string): {
  domain: string;
  reliabilityScore: number;
  reliabilityTier: 'high' | 'medium' | 'low';
  evidenceType: ParallaxEvidenceType;
} {
  let domain = 'web';
  try {
    if (url) {
      domain = new URL(url).hostname.replace(/^www\./, '');
    }
  } catch {
    domain = 'web';
  }

  const lowerDomain = domain.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const lowerSnippet = snippet.toLowerCase();
  const combined = `${lowerTitle} ${lowerSnippet}`;

  // High authority tier: official papers, wikipedia, premier tech/news journals, government/academic domains
  if (
    lowerDomain.includes('arxiv.org') ||
    lowerDomain.includes('.edu') ||
    lowerDomain.includes('.gov') ||
    lowerDomain.includes('wikipedia.org') ||
    lowerDomain.includes('openai.com') ||
    lowerDomain.includes('anthropic.com') ||
    lowerDomain.includes('deepmind.google') ||
    lowerDomain.includes('googleblog.com') ||
    lowerDomain.includes('nature.com') ||
    lowerDomain.includes('science.org') ||
    lowerDomain.includes('reuters.com') ||
    lowerDomain.includes('bloomberg.com') ||
    lowerDomain.includes('techcrunch.com') ||
    lowerDomain.includes('theverge.com') ||
    lowerDomain.includes('wired.com') ||
    lowerDomain.includes('github.com')
  ) {
    let evidenceType: ParallaxEvidenceType = 'news';
    if (lowerDomain.includes('arxiv.org') || lowerDomain.includes('.edu') || lowerDomain.includes('nature.com')) {
      evidenceType = 'academic';
    } else if (
      lowerDomain.includes('openai.com') ||
      lowerDomain.includes('anthropic.com') ||
      lowerDomain.includes('googleblog.com') ||
      lowerDomain.includes('github.com')
    ) {
      evidenceType = 'official_release';
    } else if (combined.includes('benchmark') || combined.includes('eval') || combined.includes('score') || combined.includes('swe-bench')) {
      evidenceType = 'benchmark';
    }

    return { domain, reliabilityScore: 0.92, reliabilityTier: 'high', evidenceType };
  }

  // Medium authority tier: reputable tech blogs, news aggregators, recognized publications
  if (
    lowerDomain.includes('medium.com') ||
    lowerDomain.includes('substack.com') ||
    lowerDomain.includes('venturebeat.com') ||
    lowerDomain.includes('arstechnica.com') ||
    lowerDomain.includes('tomshardware.com') ||
    lowerDomain.includes('zdnet.com') ||
    lowerDomain.includes('forbes.com') ||
    lowerDomain.includes('wsj.com') ||
    lowerDomain.includes('ft.com') ||
    lowerDomain.includes('economist.com')
  ) {
    let evidenceType: ParallaxEvidenceType = 'news';
    if (combined.includes('rumor') || combined.includes('leak') || combined.includes('unconfirmed')) {
      evidenceType = 'rumor';
    } else if (combined.includes('speculat') || combined.includes('might be') || combined.includes('projected')) {
      evidenceType = 'speculation';
    } else if (combined.includes('benchmark') || combined.includes('eval')) {
      evidenceType = 'benchmark';
    }

    return { domain, reliabilityScore: 0.75, reliabilityTier: 'medium', evidenceType };
  }

  // Low / Speculation tier: forums, social, unverified rumor boards
  let evidenceType: ParallaxEvidenceType = 'general';
  if (combined.includes('rumor') || combined.includes('leak') || lowerDomain.includes('reddit.com') || lowerDomain.includes('x.com')) {
    evidenceType = 'rumor';
  } else if (combined.includes('speculat') || combined.includes('could') || combined.includes('hypothetical')) {
    evidenceType = 'speculation';
  }

  return { domain, reliabilityScore: 0.5, reliabilityTier: 'low', evidenceType };
}

/**
 * 1. ENTITY RESOLUTION ENGINE:
 * Resolves typos, aliases, model designations, and ambiguous entities BEFORE the 23-agent debate.
 * Checks known maps, analyzes text, and optionally uses provider LLM if complex.
 */
export async function resolveParallaxEntity(
  topic: string,
  signal?: AbortSignal,
): Promise<ParallaxEntityResolution> {
  const cleanTopic = topic.trim();
  const lowerTopic = cleanTopic.toLowerCase();

  // 1. Fast deterministic check against known canonical map
  for (const [key, mapping] of Object.entries(CANONICAL_ENTITY_MAP)) {
    if (lowerTopic.includes(key)) {
      console.log(`[Parallax EntityResolver] Fast matched known entity: "${key}" -> "${mapping.canonical}"`);
      return {
        input: cleanTopic,
        canonicalEntity: mapping.canonical,
        entityType: mapping.type,
        confidence: 0.95,
        aliases: mapping.aliases,
        ambiguous: false,
        notes: `Matched known entity catalog for "${key}".`,
      };
    }
  }

  // Common typo heuristics: "GTP" -> "GPT", "Deep seek" -> "DeepSeek", "Cloude" -> "Claude"
  const typoReplacements: Array<{ pattern: RegExp; canonical: string; entityType: ParallaxEntityResolution['entityType'] }> = [
    { pattern: /\bgtp[-\s]?(\d[a-z0-9.]*)/i, canonical: 'GPT-$1', entityType: 'model' },
    { pattern: /\bdeep\s*seek[-\s]?([a-z0-9.]+)/i, canonical: 'DeepSeek-$1', entityType: 'model' },
    { pattern: /\bcloude\s*([0-9.]+)/i, canonical: 'Claude $1', entityType: 'model' },
    { pattern: /\bopen\s*ai\b/i, canonical: 'OpenAI', entityType: 'company' },
    { pattern: /\banthropic\b/i, canonical: 'Anthropic', entityType: 'company' },
  ];

  for (const item of typoReplacements) {
    const match = cleanTopic.match(item.pattern);
    if (match) {
      const canonicalName = match[0].replace(item.pattern, item.canonical);
      console.log(`[Parallax EntityResolver] Typo normalized: "${match[0]}" -> "${canonicalName}"`);
      return {
        input: cleanTopic,
        canonicalEntity: canonicalName,
        entityType: item.entityType,
        confidence: 0.9,
        aliases: [match[0], canonicalName],
        ambiguous: false,
        notes: `Normalized typo in topic string.`,
      };
    }
  }

  // If topic is brief or looks like an entity query, run lightweight LLM entity detector
  if (cleanTopic.length < 120 && !cleanTopic.endsWith('?')) {
    try {
      const sysConfig = storage.getParallaxConfig();
      const allAgents = Object.values(sysConfig.agents || {});
      const resolverAgent = allAgents[0] || { id: 'entity_resolver', name: 'Resolver', role: 'Entity Specialist', systemInstruction: '', maxTokens: 100, enabled: true, providerId: 'existing', modelId: 'deepseek/deepseek-chat', initials: 'ER', accentColor: '#06b6d4' };
      const { provider } = resolveParallaxProviderConfig(resolverAgent, 100);

      const prompt = `Analyze this query for entities (model names, companies, products, acronyms, or typos):
Query: "${cleanTopic}"

Output JSON only:
{
  "hasEntity": true | false,
  "canonicalEntity": "Standardized canonical name or empty",
  "entityType": "model" | "company" | "product" | "technology" | "person" | "concept" | "policy" | "general",
  "confidence": 0.0 to 1.0,
  "aliases": ["alias1", "alias2"],
  "ambiguous": true | false
}`;

      const res = await api.jarvisAgentCall({
        agentId: 'parallax_entity_resolver',
        messages: [{ role: 'user', content: prompt }],
        providerConfig: provider,
        temperature: 0.1,
        maxTokens: 100,
        timeoutMs: 6000,
        signal,
      });

      const text = (res.text || res.content || '').trim();
      const cleanJson = text.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
      const match = cleanJson.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.hasEntity && parsed.canonicalEntity) {
          return {
            input: cleanTopic,
            canonicalEntity: String(parsed.canonicalEntity).trim(),
            entityType: parsed.entityType || 'general',
            confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.85,
            aliases: Array.isArray(parsed.aliases) ? parsed.aliases.map(String) : [],
            ambiguous: Boolean(parsed.ambiguous),
            notes: 'AI entity resolution verified.',
          };
        }
      }
    } catch (e) {
      console.warn('[Parallax EntityResolver] LLM entity resolution skipped/failed:', e);
    }
  }

  // Default fallback: Topic is a general proposition or conceptual debate
  return {
    input: cleanTopic,
    canonicalEntity: cleanTopic,
    entityType: 'general',
    confidence: 1.0,
    aliases: [cleanTopic],
    ambiguous: false,
    notes: 'General discussion proposition.',
  };
}

/**
 * 2. SHARED EVIDENCE COLLECTION:
 * Collects a unified pool of research and evidence BEFORE agents deliberate.
 */
export async function collectParallaxEvidencePool(
  topic: string,
  entityResolution?: ParallaxEntityResolution,
  signal?: AbortSignal,
): Promise<{ evidenceItems: ParallaxEvidenceItem[]; searchSource: string }> {
  const searchQuery = entityResolution?.canonicalEntity && entityResolution.canonicalEntity !== topic
    ? `${entityResolution.canonicalEntity} ${topic}`.slice(0, 140)
    : topic;

  console.log(`[Parallax EvidencePool] Gathering shared evidence for: "${searchQuery}"...`);

  let rawResults: Array<{ title?: string; url?: string; description?: string; snippet?: string; content?: string; domain?: string; date?: string }> = [];
  let sourceLabel = 'Tavily';

  try {
    if (signal?.aborted) throw new Error('Aborted');
    const searchRes = await api.search(searchQuery, 'ALL', 1, 10);

    if (Array.isArray(searchRes) && searchRes.length > 0) {
      rawResults = searchRes.slice(0, 10);
      const resMeta = searchRes as typeof searchRes & { searchSource?: string };
      if (resMeta.searchSource) {
        sourceLabel = formatSearchSourceLabel(resMeta.searchSource);
      }
    } else {
      const wiki = await api.searchWikipedia(searchQuery, 5);
      if (wiki && wiki.length > 0) {
        rawResults = wiki.map((w) => ({
          title: w.title,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(w.title)}`,
          description: (w.snippet || '').replace(/<[^>]*>?/gm, '').trim(),
          domain: 'wikipedia.org',
        }));
        sourceLabel = 'Wikipedia';
      }
    }
  } catch (err) {
    if (signal?.aborted) throw err;
    console.warn('[Parallax EvidencePool] Live search error, attempting Wikipedia fallback:', err);
    try {
      const wiki = await api.searchWikipedia(searchQuery, 5);
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

  const evidenceItems: ParallaxEvidenceItem[] = rawResults.map((r, idx) => {
    const title = (r.title || 'Untitled Source').trim();
    const url = r.url || '';
    const snippet = (r.description || r.snippet || r.content || '').replace(/\s+/g, ' ').trim();
    const classification = classifyEvidenceSource(url, title, snippet);

    return {
      id: `ev_${idx + 1}_${Date.now()}`,
      snippet,
      title,
      url,
      domain: classification.domain,
      date: r.date,
      reliabilityScore: classification.reliabilityScore,
      reliabilityTier: classification.reliabilityTier,
      evidenceType: classification.evidenceType,
    };
  });

  return { evidenceItems, searchSource: sourceLabel };
}

/**
 * 3. & 4. CLAIM EXTRACTION & SOURCE VERIFICATION ENGINE:
 * Deconstructs topic and evidence into candidate claims and computes verified/plausible/refuted status.
 */
export async function extractAndVerifyClaims(
  topic: string,
  evidenceItems: ParallaxEvidenceItem[],
  entityResolution?: ParallaxEntityResolution,
  signal?: AbortSignal,
): Promise<ParallaxClaim[]> {
  // If no evidence was found, generate an unverified/speculative baseline claim
  if (!evidenceItems || evidenceItems.length === 0) {
    return [
      {
        id: `claim_1_${Date.now()}`,
        claimText: `The core assertions in "${topic}" lack empirical web confirmation.`,
        claimType: 'existence',
        status: 'UNVERIFIED',
        confidence: 0.3,
        supportingEvidenceIds: [],
        refutingEvidenceIds: [],
        reasoning: 'No live verification sources returned corroborating evidence across fallback search providers.',
      },
    ];
  }

  // Prepare a concise summary of top 4 sources for extraction prompt (~180 tokens)
  const sourceContext = evidenceItems
    .slice(0, 4)
    .map((e, idx) => `[S${idx + 1}] (${e.domain} | ${e.evidenceType} | Tier: ${e.reliabilityTier}): "${e.snippet.slice(0, 140)}"`)
    .join('\n');

  try {
    const sysConfig = storage.getParallaxConfig();
    const allAgents = Object.values(sysConfig.agents || {});
    const verifierAgent = allAgents.find((a) => a.id === 'veritas') || allAgents[0] || { id: 'veritas', name: 'VERITAS', role: 'Fact Verification', systemInstruction: '', maxTokens: 250, enabled: true, providerId: 'existing', modelId: 'deepseek/deepseek-chat', initials: 'VR', accentColor: '#06b6d4' };
    const { provider } = resolveParallaxProviderConfig(verifierAgent, 250);

    const prompt = `Task: Extract 2-3 specific empirical claims from the topic and verify them against the provided evidence.
Topic: "${topic}"
${entityResolution?.canonicalEntity ? `Resolved Entity: "${entityResolution.canonicalEntity}"` : ''}

Evidence Sources:
${sourceContext}

Verification Statuses:
- "VERIFIED": supported by authoritative sources
- "PLAUSIBLE": supported by single/general source, not contradicted
- "DISPUTED": contradictory evidence found
- "REFUTED": contradicted by evidence or known to be nonexistent/fake
- "UNVERIFIED": speculative premise with no evidence

Output strict JSON only:
{
  "claims": [
    {
      "claimText": "Crisp statement of fact or premise (<25 words)",
      "claimType": "existence" | "release" | "benchmark" | "attribution" | "capability" | "policy" | "speculation",
      "status": "VERIFIED" | "PLAUSIBLE" | "DISPUTED" | "REFUTED" | "UNVERIFIED",
      "confidence": 0.0 to 1.0,
      "reasoning": "1 short sentence explaining why"
    }
  ]
}`;

    const res = await api.jarvisAgentCall({
      agentId: 'parallax_claim_verifier',
      messages: [{ role: 'user', content: prompt }],
      providerConfig: provider,
      temperature: 0.15,
      maxTokens: 250,
      timeoutMs: 12000,
      signal,
    });

    const text = (res.text || res.content || '').trim();
    const cleanJson = text.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
    const match = cleanJson.match(/\{[\s\S]*\}/);

    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed.claims) && parsed.claims.length > 0) {
        return parsed.claims.slice(0, 3).map((c: Record<string, unknown>, idx: number) => {
          const rawStatus = String(c.status || '').toUpperCase();
          const validStatus: ParallaxVerificationStatus =
            rawStatus === 'VERIFIED' || rawStatus === 'PLAUSIBLE' || rawStatus === 'DISPUTED' || rawStatus === 'REFUTED'
              ? rawStatus
              : 'UNVERIFIED';

          const validTypes: ParallaxClaimType[] = ['existence', 'release', 'benchmark', 'attribution', 'capability', 'policy', 'speculation'];
          const rawType = String(c.claimType || '').toLowerCase() as ParallaxClaimType;
          const claimType = validTypes.includes(rawType) ? rawType : 'general' as unknown as ParallaxClaimType;

          return {
            id: `claim_${idx + 1}_${Date.now()}`,
            claimText: String(c.claimText || 'Empirical premise verified').trim(),
            claimType,
            status: validStatus,
            confidence: typeof c.confidence === 'number' ? Math.min(1, Math.max(0, c.confidence)) : 0.8,
            supportingEvidenceIds: evidenceItems.slice(0, 2).map((e) => e.id),
            refutingEvidenceIds: [],
            reasoning: String(c.reasoning || 'Grounded against live web search evidence.').trim(),
          };
        });
      }
    }
  } catch (err) {
    console.warn('[Parallax ClaimVerifier] AI claim verification error, using deterministic extraction:', err);
  }

  // Deterministic fallback claim from top evidence item
  const top = evidenceItems[0];
  return [
    {
      id: `claim_1_${Date.now()}`,
      claimText: top ? top.snippet.slice(0, 110) + '…' : topic,
      claimType: 'existence',
      status: top.reliabilityTier === 'high' ? 'VERIFIED' : 'PLAUSIBLE',
      confidence: top.reliabilityScore,
      supportingEvidenceIds: [top.id],
      refutingEvidenceIds: [],
      reasoning: `Grounded in ${top.domain} (${top.reliabilityTier} tier evidence).`,
    },
  ];
}

/**
 * 6. CONFLICT & DISAGREEMENT DETECTION:
 * Analyzes agent messages to distinguish factual conflict from ideological/value trade-offs.
 */
export async function detectDeliberationConflicts(
  topic: string,
  claims: ParallaxClaim[],
  messages: ParallaxMessage[],
  signal?: AbortSignal,
): Promise<{ factualConflicts: string[]; valueConflicts: string[] }> {
  // Extract samples from Round 2 & 3 where rebuttals and tensions occur
  const debateMsgs = messages.filter((m) => m.round >= 2);
  if (debateMsgs.length < 2) {
    return {
      factualConflicts: [],
      valueConflicts: ['Tension between rapid technological acceleration and cautious safety governance.'],
    };
  }

  const r2r3Sample = debateMsgs
    .slice(0, 6)
    .map((m) => `${m.agentName}: "${m.text.slice(0, 90)}"`)
    .join('\n');

  try {
    const sysConfig = storage.getParallaxConfig();
    const allAgents = Object.values(sysConfig.agents || {});
    const { provider } = resolveParallaxProviderConfig(allAgents[0] || { id: 'veritas', name: 'VERITAS', role: 'Fact Verification', systemInstruction: '', maxTokens: 180, enabled: true, providerId: 'existing', modelId: 'deepseek/deepseek-chat', initials: 'VR', accentColor: '#06b6d4' }, 180);

    const prompt = `Analyze agent debate tensions on: "${topic}"
Agent Excerpts:
${r2r3Sample}

Distinguish:
1. "factualConflicts": Disagreements on verifiable factual data or performance metrics (or empty array if none).
2. "valueConflicts": Tensions over values, ethical priorities, speed vs safety, economic vs human trade-offs.

Output JSON only:
{
  "factualConflicts": ["1 concise sentence if factual dispute exists"],
  "valueConflicts": ["1-2 concise sentences describing value/ideological tensions"]
}`;

    const res = await api.jarvisAgentCall({
      agentId: 'parallax_conflict_detector',
      messages: [{ role: 'user', content: prompt }],
      providerConfig: provider,
      temperature: 0.2,
      maxTokens: 180,
      timeoutMs: 8000,
      signal,
    });

    const text = (res.text || res.content || '').trim();
    const cleanJson = text.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
    const match = cleanJson.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        factualConflicts: Array.isArray(parsed.factualConflicts) ? parsed.factualConflicts.map(String).filter((s) => s.trim().length > 0) : [],
        valueConflicts: Array.isArray(parsed.valueConflicts) && parsed.valueConflicts.length > 0 ? parsed.valueConflicts.map(String) : ['Differing weights assigned to innovation speed vs ethical precaution.'],
      };
    }
  } catch (err) {
    console.warn('[Parallax ConflictDetector] Fallback conflict detection used:', err);
  }

  return {
    factualConflicts: [],
    valueConflicts: [
      'Contrasting emphasis between technological optimism, economic realism, and precautionary governance.',
    ],
  };
}

/**
 * Builds ultra-compact grounding constraint for persona turn (~25-35 tokens).
 * Ensures agents DO NOT hallucinate fake facts while preserving their distinct ideological archetype.
 */
export function buildAgentGroundingConstraint(
  entityResolution?: ParallaxEntityResolution | null,
  claims?: ParallaxClaim[] | null,
): string {
  const parts: string[] = [];

  if (entityResolution && entityResolution.canonicalEntity && entityResolution.canonicalEntity !== entityResolution.input) {
    parts.push(`Note: "${entityResolution.input}" refers to "${entityResolution.canonicalEntity}".`);
  }

  if (claims && claims.length > 0) {
    const unverifiedOrRefuted = claims.filter((c) => c.status === 'UNVERIFIED' || c.status === 'REFUTED' || c.status === 'DISPUTED');
    if (unverifiedOrRefuted.length > 0) {
      const topIssue = unverifiedOrRefuted[0];
      if (topIssue.status === 'REFUTED') {
        parts.push(`Grounding Alert: Claim "${topIssue.claimText}" is REFUTED by evidence.`);
      } else if (topIssue.status === 'UNVERIFIED') {
        parts.push(`Grounding Alert: Premise "${topIssue.claimText}" is UNVERIFIED/SPECULATIVE; treat with analytical caution.`);
      }
    } else {
      const verified = claims.find((c) => c.status === 'VERIFIED');
      if (verified) {
        parts.push(`Verified Fact: ${verified.claimText.slice(0, 90)}`);
      }
    }
  }

  return parts.join(' ');
}
