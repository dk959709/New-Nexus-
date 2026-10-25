import { storage } from '@/lib/storage';
import { resolveGenesisSlot } from '@/lib/parallaxModelPool';
import { DEFAULT_PARALLAX_VOICES } from '@/data/parallaxVoices';
import { api } from '@/services/api';
import {
  resolveParallaxProviderConfig,
  countWords,
  formatSearchSourceLabel,
  abortableSleep,
  isNetworkOrRateLimitError,
  type ParallaxRunOptions,
} from './parallaxOrchestrator';
import type {
  ParallaxAgentConfig,
  ParallaxMessage,
  ParallaxSummary,
  ParallaxToolRawResult,
} from '@/types';

const GENESIS_18_COLOR_PALETTE: string[] = [
  '#22d3ee', // Cyan
  '#f472b6', // Pink
  '#34d399', // Emerald
  '#fbbf24', // Amber
  '#60a5fa', // Blue
  '#fb923c', // Orange
  '#c084fc', // Purple
  '#2dd4bf', // Teal
  '#f87171', // Red
  '#a3e635', // Lime
  '#e879f9', // Fuchsia
  '#38bdf8', // Sky
  '#facc15', // Yellow
  '#818cf8', // Indigo
  '#4ade80', // Green
  '#fb7185', // Rose
  '#a78bfa', // Violet
  '#67e8f9', // Light Cyan
];

const GENESIS_VOICES: string[] = Object.values(DEFAULT_PARALLAX_VOICES);

interface FallbackRoleSpec {
  name: string;
  role: string;
  emoji: string;
  keyword: string;
  task: string;
  systemPrompt: string;
}

const GENERIC_18_ROLES: FallbackRoleSpec[] = [
  {
    name: 'ANALYST',
    role: 'Core Analyst',
    emoji: '📊',
    keyword: 'overview facts',
    task: 'Identify the primary facts, current state, and key definitions of the topic.',
    systemPrompt: 'You are a rigorous Core Analyst. You break complex topics into structured facts and clear baseline findings.',
  },
  {
    name: 'SKEPTIC',
    role: 'Empirical Skeptic',
    emoji: '🧐',
    keyword: 'criticism doubts',
    task: 'Scrutinize hype, question unverified claims, and test evidentiary quality.',
    systemPrompt: 'You are an Empirical Skeptic. You challenge weak evidence, separate marketing claims from verified proof, and point out missing data.',
  },
  {
    name: 'HISTORIAN',
    role: 'Context Historian',
    emoji: '📜',
    keyword: 'history background',
    task: 'Trace the timeline, prior versions, and historical precedents leading to the current state.',
    systemPrompt: 'You are a Context Historian. You examine how this topic evolved over time and compare current developments with past precedents.',
  },
  {
    name: 'ENGINEER',
    role: 'Practical Engineer',
    emoji: '⚙️',
    keyword: 'architecture implementation',
    task: 'Evaluate how this works in practice, its technical architecture, and real implementation constraints.',
    systemPrompt: 'You are a Practical Implementation Engineer. You focus on real-world mechanics, engineering feasibility, and operational bottlenecks.',
  },
  {
    name: 'ECONOMIST',
    role: 'Economic Strategist',
    emoji: '💹',
    keyword: 'cost pricing market',
    task: 'Analyze costs, pricing, incentives, capital requirements, and market dynamics.',
    systemPrompt: 'You are an Economic Strategist. You follow financial incentives, unit economics, market competition, and resource trade-offs.',
  },
  {
    name: 'ETHICIST',
    role: 'Ethics & Impact',
    emoji: '⚖️',
    keyword: 'ethics societal impact',
    task: 'Examine fairness, human impact, governance, and ethical responsibilities.',
    systemPrompt: 'You are an Ethics and Societal Impact Advisor. You evaluate who benefits, who bears the cost, and what safeguards protect human welfare.',
  },
  {
    name: 'FUTURIST',
    role: 'Horizon Futurist',
    emoji: '🔭',
    keyword: 'future roadmap trends',
    task: 'Assess upcoming milestones, next-phase developments, and second-order effects.',
    systemPrompt: 'You are a Horizon Futurist. You trace current trajectories forward to identify emerging trends and near-term implications.',
  },
  {
    name: 'SENTINEL',
    role: 'Risk Officer',
    emoji: '🛡️',
    keyword: 'risks failure modes',
    task: 'Identify failure modes, downside risks, vulnerabilities, and worst-case scenarios.',
    systemPrompt: 'You are a Chief Risk Officer. You proactively uncover systemic vulnerabilities, tail risks, and operational hazards.',
  },
  {
    name: 'METRICS',
    role: 'Data Scientist',
    emoji: '🔢',
    keyword: 'benchmarks statistics numbers',
    task: 'Extract concrete numbers, benchmarks, dates, percentages, and quantitative comparisons.',
    systemPrompt: 'You are a Quantitative Data Scientist. You focus on measurable statistics, benchmark results, and empirical numbers.',
  },
  {
    name: 'STRATEGOS',
    role: 'Strategic Advisor',
    emoji: '♟️',
    keyword: 'strategy competition',
    task: 'Analyze competitive positioning, strategic trade-offs, and decision-making options.',
    systemPrompt: 'You are a Strategic Advisor. You evaluate competitive dynamics, leverage points, and high-level trade-offs.',
  },
  {
    name: 'REPORTER',
    role: 'Investigative Journalist',
    emoji: '📰',
    keyword: 'latest news announcements',
    task: 'Track recent news reports, official statements, and verified public updates.',
    systemPrompt: 'You are an Investigative Journalist. You prioritize primary-source reporting, recent announcements, and verifiable quotes.',
  },
  {
    name: 'EDUCATOR',
    role: 'Clarity Educator',
    emoji: '💡',
    keyword: 'explained guide',
    task: 'Clarify core concepts and explain why this matters to everyday users.',
    systemPrompt: 'You are a Clarity Educator. You translate complex technical or policy details into clear, concrete takeaways.',
  },
  {
    name: 'OPERATOR',
    role: 'Field Operator',
    emoji: '🔧',
    keyword: 'real world usage workflow',
    task: 'Evaluate day-to-day execution, workflow friction, and practical usability.',
    systemPrompt: 'You are a Field Operator. You judge ideas by how they perform under real-world pressure and daily operational constraints.',
  },
  {
    name: 'COUNSEL',
    role: 'Legal Advisor',
    emoji: '🏛️',
    keyword: 'regulation compliance policy',
    task: 'Assess regulatory rules, compliance requirements, and legal or policy boundaries.',
    systemPrompt: 'You are a Legal and Regulatory Advisor. You examine statutory rules, institutional governance, and liability exposure.',
  },
  {
    name: 'DEFENDER',
    role: 'Security Expert',
    emoji: '🔒',
    keyword: 'security privacy safety',
    task: 'Review security posture, safety controls, abuse vectors, and resilience.',
    systemPrompt: 'You are a Security and Safety Expert. You scrutinize defensive safeguards, privacy protections, and threat mitigation.',
  },
  {
    name: 'HUMANIST',
    role: 'UX Thinker',
    emoji: '🧭',
    keyword: 'user experience adoption',
    task: 'Evaluate human adoption barriers, user experience, and accessibility.',
    systemPrompt: 'You are a UX and Human Factors Thinker. You focus on how real people interact with systems and what drives or blocks adoption.',
  },
  {
    name: 'NEXUS',
    role: 'Systems Thinker',
    emoji: '🕸️',
    keyword: 'ecosystem integration dependencies',
    task: 'Map dependencies, ecosystem effects, and interconnections across domains.',
    systemPrompt: 'You are a Systems Thinker. You analyze feedback loops, supply-chain dependencies, and cross-system interactions.',
  },
  {
    name: 'MAVERICK',
    role: 'Contrarian Analyst',
    emoji: '⚡',
    keyword: 'alternative view debate',
    task: 'Challenge conventional wisdom and surface overlooked counter-arguments.',
    systemPrompt: 'You are a Contrarian Analyst. You test consensus assumptions by highlighting overlooked angles and alternative interpretations.',
  },
];

interface ArchitectAgentBlueprint {
  name: string;
  role: string;
  emoji: string;
  color: string;
  task: string;
  systemPrompt: string;
  searchQuery: string;
}

interface ArchitectParsedOutput {
  plan: string;
  agents: ArchitectAgentBlueprint[];
}

function isValidHexColor(c: unknown): c is string {
  if (typeof c !== 'string') return false;
  return /^#[0-9a-fA-F]{6}$/.test(c.trim());
}

function isBrightReadableHex(hex: string): boolean {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return false;
  // Relative luminance check so it's visible on dark backgrounds
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance >= 85;
}

function sanitizeAgentName(rawName: unknown, fallbackName: string, usedNames: Set<string>): string {
  let clean = typeof rawName === 'string' ? rawName.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
  if (clean.length > 9) {
    clean = clean.slice(0, 9);
  }
  if (clean.length < 2) {
    clean = fallbackName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9);
  }
  let candidate = clean;
  let counter = 2;
  while (usedNames.has(candidate) || candidate === 'ARCHITECT' || candidate === 'ZENITH') {
    const base = clean.slice(0, Math.max(2, 9 - String(counter).length));
    candidate = `${base}${counter}`;
    counter++;
  }
  usedNames.add(candidate);
  return candidate;
}

function clampSearchQuery(rawQuery: unknown, topic: string, roleKeyword: string): string {
  const raw = typeof rawQuery === 'string' ? rawQuery.replace(/\s+/g, ' ').trim() : '';
  if (!raw) {
    const words = `${topic} ${roleKeyword}`.replace(/\s+/g, ' ').trim().split(' ');
    return words.slice(0, 8).join(' ');
  }
  const words = raw.split(' ').filter(Boolean);
  return words.slice(0, 8).join(' ');
}

function parseArchitectJson(rawText: string): { plan?: string; agents?: Record<string, unknown>[] } | null {
  if (!rawText || !rawText.trim()) return null;
  const stripped = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

  try {
    const direct = JSON.parse(stripped);
    if (direct && typeof direct === 'object') return direct;
  } catch {
    // continue
  }

  const firstBrace = stripped.indexOf('{');
  const lastBrace = stripped.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const sub = stripped.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(sub);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // continue
    }
  }

  // Try extracting individual agent JSON objects if array was truncated
  if (firstBrace !== -1) {
    const planMatch = stripped.match(/"plan"\s*:\s*"([^"]*)"/i);
    const extractedAgents: Record<string, unknown>[] = [];
    const agentsStart = stripped.indexOf('"agents"');
    if (agentsStart !== -1) {
      const afterAgents = stripped.slice(agentsStart);
      const objMatches = afterAgents.match(/\{[^{}]+\}/g) || [];
      for (const objStr of objMatches) {
        try {
          const parsedObj = JSON.parse(objStr);
          if (parsedObj && typeof parsedObj === 'object' && (parsedObj.name || parsedObj.role || parsedObj.task)) {
            extractedAgents.push(parsedObj);
          }
        } catch {
          // ignore malformed item
        }
      }
    }
    if (extractedAgents.length > 0) {
      return {
        plan: planMatch?.[1] || '',
        agents: extractedAgents,
      };
    }
  }

  return null;
}

function validateAndRepairArchitectAgents(
  parsed: { plan?: string; agents?: Record<string, unknown>[] } | null,
  topic: string,
): { validCount: number; output: ArchitectParsedOutput } {
  const rawList = Array.isArray(parsed?.agents) ? parsed!.agents! : [];
  const usedNames = new Set<string>();
  const usedColors = new Set<string>();
  const validAgents: ArchitectAgentBlueprint[] = [];

  for (let i = 0; i < rawList.length && validAgents.length < 18; i++) {
    const item = rawList[i];
    if (!item || typeof item !== 'object') continue;
    const fb = GENERIC_18_ROLES[validAgents.length % GENERIC_18_ROLES.length];

    const hasSomeContent =
      (typeof item.name === 'string' && item.name.trim().length > 0) ||
      (typeof item.role === 'string' && item.role.trim().length > 0) ||
      (typeof item.task === 'string' && item.task.trim().length > 0);
    if (!hasSomeContent) continue;

    const idx = validAgents.length;
    const name = sanitizeAgentName(item.name, fb.name, usedNames);
    const role =
      typeof item.role === 'string' && item.role.trim()
        ? item.role.trim().slice(0, 48)
        : fb.role;
    const emoji =
      typeof item.emoji === 'string' && item.emoji.trim()
        ? item.emoji.trim().slice(0, 4)
        : fb.emoji;

    let color = GENESIS_18_COLOR_PALETTE[idx % GENESIS_18_COLOR_PALETTE.length];
    if (
      isValidHexColor(item.color) &&
      isBrightReadableHex(item.color.trim()) &&
      !usedColors.has(item.color.trim().toLowerCase())
    ) {
      color = item.color.trim();
    } else {
      for (const c of GENESIS_18_COLOR_PALETTE) {
        if (!usedColors.has(c.toLowerCase())) {
          color = c;
          break;
        }
      }
    }
    usedColors.add(color.toLowerCase());

    const task =
      typeof item.task === 'string' && item.task.trim()
        ? item.task.trim().slice(0, 220)
        : `${fb.task} Focus on: ${topic.slice(0, 100)}.`;

    const systemPrompt =
      typeof item.systemPrompt === 'string' && item.systemPrompt.trim()
        ? item.systemPrompt.trim().slice(0, 360)
        : fb.systemPrompt;

    const searchQuery = clampSearchQuery(item.searchQuery, topic, fb.keyword);

    validAgents.push({
      name,
      role,
      emoji,
      color,
      task,
      systemPrompt,
      searchQuery,
    });
  }

  const validCount = validAgents.length;

  // Fill any missing slots up to 18 from GENERIC_18_ROLES
  for (let i = 0; i < GENERIC_18_ROLES.length && validAgents.length < 18; i++) {
    const fb = GENERIC_18_ROLES[i];
    if (usedNames.has(fb.name)) continue;
    const idx = validAgents.length;
    const name = sanitizeAgentName(fb.name, fb.name, usedNames);
    let color = GENESIS_18_COLOR_PALETTE[idx % GENESIS_18_COLOR_PALETTE.length];
    for (const c of GENESIS_18_COLOR_PALETTE) {
      if (!usedColors.has(c.toLowerCase())) {
        color = c;
        break;
      }
    }
    usedColors.add(color.toLowerCase());

    validAgents.push({
      name,
      role: fb.role,
      emoji: fb.emoji,
      color,
      task: `${fb.task} Focus specifically on "${topic.slice(0, 100)}".`,
      systemPrompt: fb.systemPrompt,
      searchQuery: clampSearchQuery('', topic, fb.keyword),
    });
  }

  // In case still < 18
  while (validAgents.length < 18) {
    const idx = validAgents.length;
    const fb = GENERIC_18_ROLES[idx % GENERIC_18_ROLES.length];
    const name = sanitizeAgentName(fb.name, fb.name, usedNames);
    const color = GENESIS_18_COLOR_PALETTE[idx % GENESIS_18_COLOR_PALETTE.length];
    validAgents.push({
      name,
      role: fb.role,
      emoji: fb.emoji,
      color,
      task: `${fb.task} Focus specifically on "${topic.slice(0, 100)}".`,
      systemPrompt: fb.systemPrompt,
      searchQuery: clampSearchQuery('', topic, fb.keyword),
    });
  }

  const defaultPlan = `ARCHITECT assembled 18 specialized agents to investigate "${topic.slice(0, 90)}" across empirical facts, technical feasibility, economics, risk, and practical execution. Each agent runs targeted search grounding before ZENITH synthesizes the final verdict.`;
  const plan =
    typeof parsed?.plan === 'string' && parsed.plan.trim().length >= 15
      ? parsed.plan.trim().slice(0, 380)
      : defaultPlan;

  return {
    validCount,
    output: {
      plan,
      agents: validAgents.slice(0, 18),
    },
  };
}

interface GenesisSearchEntry {
  query: string;
  results: ParallaxToolRawResult[];
  sourceLabel: string;
  hadOwnSearch: boolean;
}

async function runSingleSearchWithTimeoutAndRetry(
  query: string,
  signal?: AbortSignal,
): Promise<{ results: ParallaxToolRawResult[]; sourceLabel: string; ok: boolean }> {
  const attemptSearch = async (): Promise<{ results: ParallaxToolRawResult[]; sourceLabel: string }> => {
    if (signal?.aborted) throw new Error('Swarm aborted');
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Search timeout (12s)')), 12000);
      });
      const searchPromise = api.search(query, 'ALL', 1, 5);
      const rawRes = await Promise.race([searchPromise, timeoutPromise]);
      if (!Array.isArray(rawRes) || rawRes.length === 0) {
        return { results: [], sourceLabel: 'Live Web' };
      }
      const resMeta = rawRes as typeof rawRes & { searchSource?: string };
      const sourceLabel = formatSearchSourceLabel(resMeta.searchSource);
      const mapped: ParallaxToolRawResult[] = rawRes.slice(0, 4).map((r) => {
        let domain = r.domain;
        if (!domain && r.url) {
          try {
            domain = new URL(r.url).hostname.replace(/^www\./, '');
          } catch {
            domain = 'web';
          }
        }
        const rawSnippet = (r.description || (r as { snippet?: string }).snippet || '').replace(/\s+/g, ' ').trim();
        return {
          title: (r.title || 'Source').trim(),
          url: r.url || '',
          domain: domain || 'web',
          snippet: rawSnippet.slice(0, 200),
        };
      });
      return { results: mapped, sourceLabel };
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  try {
    const first = await attemptSearch();
    return { ...first, ok: first.results.length > 0 };
  } catch (err) {
    if (signal?.aborted) throw err;
    if (isNetworkOrRateLimitError(err)) {
      try {
        await abortableSleep(1500, signal);
        const second = await attemptSearch();
        return { ...second, ok: second.results.length > 0 };
      } catch (retryErr) {
        if (signal?.aborted) throw retryErr;
        return { results: [], sourceLabel: 'Live Web', ok: false };
      }
    }
    return { results: [], sourceLabel: 'Live Web', ok: false };
  }
}

function formatSearchResultsBlock(results: ParallaxToolRawResult[]): string {
  if (!results || results.length === 0) {
    return 'SEARCH RESULTS:\n(No live search results returned; mark unverified details clearly as unverified.)';
  }
  const lines = results.slice(0, 4).map((r, idx) => {
    const dom = r.domain || 'web';
    const snip = (r.snippet || '').slice(0, 200);
    return `[${idx + 1}] ${r.title} (${dom}): ${snip}`;
  });
  return `SEARCH RESULTS:\n${lines.join('\n')}`;
}

function parseGenesisTag(
  raw: string,
  defaultMood: string,
): { cleanText: string; conviction: number; mood: string } {
  const trimmed = (raw || '').trim();
  const endTagRegex = /\[\s*(\d{1,2})\s*[|\/,;]\s*([^\]]{1,12}?)\s*\]\s*$/u;
  const match = trimmed.match(endTagRegex);
  if (match && typeof match.index === 'number') {
    const parsedScore = parseInt(match[1], 10);
    const conviction = Number.isNaN(parsedScore)
      ? 7
      : Math.max(1, Math.min(10, parsedScore));
    const mood = match[2].trim() || defaultMood;
    const cleanText = trimmed.slice(0, match.index).trim();
    return { cleanText, conviction, mood };
  }
  return {
    cleanText: trimmed,
    conviction: 7,
    mood: defaultMood,
  };
}

function extractFirstSentence(text: string): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const match = clean.match(/^[^.!?]+[.!?]/);
  if (match && match[0].trim().length >= 15) {
    return match[0].trim();
  }
  return clean.length > 180 ? clean.slice(0, 177) + '…' : clean;
}

export async function runGenesisSwarm(options: ParallaxRunOptions): Promise<void> {
  const {
    topic,
    onMessage,
    onRoundStart,
    onRoundComplete,
    onStatusUpdate,
    onDynamicPersonasCreated,
    onComplete,
    onError,
    signal,
  } = options;

  const cleanTopic = (topic || '').trim();
  if (!cleanTopic) {
    onError?.('A topic is required to initiate Genesis Swarm.');
    return;
  }

  const todayDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const genesisSettings = storage.getParallaxGenesisSettings();
  const maxSearches = Math.max(0, Math.min(18, genesisSettings.maxSearches ?? 10));
  const allMessages: ParallaxMessage[] = [];

  try {
    if (signal?.aborted) return;
    onRoundStart?.(1);

    // =========================================================================
    // STEP 1: Initial Quick Scan Search (top 5 titles + snippets, max 700 chars)
    // Skipped completely if maxSearches === 0
    // =========================================================================
    let sharedBriefText = '';
    let sharedBriefResults: ParallaxToolRawResult[] = [];
    let sharedBriefSourceLabel = 'Live Web';

    if (maxSearches > 0) {
      onStatusUpdate?.('Genesis: scanning the topic...');
      try {
        const scanRes = await runSingleSearchWithTimeoutAndRetry(cleanTopic, signal);
        if (scanRes.results.length > 0) {
          sharedBriefResults = scanRes.results.slice(0, 4);
          sharedBriefSourceLabel = scanRes.sourceLabel;
          const rawBrief = scanRes.results
            .slice(0, 5)
            .map((r, idx) => `[${idx + 1}] ${r.title} (${r.domain || 'web'}): ${r.snippet || ''}`)
            .join('\n');
          sharedBriefText = rawBrief.length > 700 ? rawBrief.slice(0, 697) + '…' : rawBrief;
        }
      } catch (scanErr) {
        if (signal?.aborted) return;
        console.warn('[Genesis] Initial topic scan failed, continuing:', scanErr);
      }
    } else {
      onStatusUpdate?.('Genesis: ARCHITECT designing 18 agents...');
    }

    if (signal?.aborted) return;

    // =========================================================================
    // STEP 2: ARCHITECT Call (Slot 0)
    // =========================================================================
    const architectSlot = resolveGenesisSlot(0, genesisSettings);
    const zenithSlot = resolveGenesisSlot(1, genesisSettings);

    const architectConfig: ParallaxAgentConfig = {
      id: 'architect',
      name: 'ARCHITECT',
      initials: 'AR',
      role: 'Swarm Team Builder',
      accentColor: '#a78bfa',
      providerId: architectSlot.providerId,
      modelId: architectSlot.modelId,
      enabled: true,
      systemInstruction: 'You are ARCHITECT, the Genesis Swarm team builder. Output strict JSON only.',
      maxTokens: 2500,
      mood: '🏗️',
      voice: DEFAULT_PARALLAX_VOICES.veritas,
    };

    const zenithConfig: ParallaxAgentConfig = {
      id: 'zenith',
      name: 'ZENITH',
      initials: 'ZE',
      role: 'Final Synthesis Architect',
      accentColor: '#fbbf24',
      providerId: zenithSlot.providerId,
      modelId: zenithSlot.modelId,
      enabled: true,
      systemInstruction: 'You are ZENITH, the final answer synthesizer for Genesis Swarm.',
      maxTokens: 1000,
      mood: '🌟',
      voice: DEFAULT_PARALLAX_VOICES.nexus9,
    };

    const { provider: architectProvider, model: architectModel } = resolveParallaxProviderConfig(
      architectConfig,
      2500,
    );

    const architectSystemPrompt = `Today is ${todayDate}. You are ARCHITECT, the master team designer for Genesis Swarm.
Your job is to design an 18-agent research team tailored specifically to the user's topic.
Rules:
1. Create EXACTLY 18 agents with different roles covering the topic from distinct angles.
2. You MUST include at least: one skeptic, one practical/implementation expert, one risk expert, and one numbers/data expert.
3. Every agent must have a unique ONE WORD UPPERCASE name (max 9 letters), a short role, one emoji, a unique bright hex color (#rrggbb readable on dark background), a specific task, a 2-3 sentence systemPrompt ("who you are and how you think"), and a specific web searchQuery (max 8 words) different from the other agents.
4. Output JSON ONLY, with no markdown fences and no extra commentary:
{"plan":"1-2 sentences about the team","agents":[{"name":"ONE WORD UPPERCASE max 9 letters","role":"short role","emoji":"one emoji","color":"#rrggbb","task":"what this agent must find/decide","systemPrompt":"2-3 sentences: who you are and how you think","searchQuery":"a short web search query (max 8 words)"}]}`;

    const architectUserPrompt = `Today is ${todayDate}.
Topic: "${cleanTopic}"
${sharedBriefText ? `\nInitial Web Scan Brief:\n${sharedBriefText}\n` : ''}
Return the JSON object with "plan" and exactly 18 "agents".`;

    const callArchitectOnce = async (attempt: number): Promise<string> => {
      const res = await api.jarvisAgentCall({
        agentId: `genesis_architect_${attempt}`,
        messages: [
          { role: 'system', content: architectSystemPrompt },
          { role: 'user', content: architectUserPrompt },
        ],
        providerConfig: architectProvider,
        temperature: 0.6,
        maxTokens: 2500,
        timeoutMs: 40000,
        signal,
      });
      return (res.text || res.content || '').trim();
    };

    const archStart = Date.now();
    let archRaw = '';
    try {
      archRaw = await callArchitectOnce(1);
    } catch (archErr) {
      if (signal?.aborted) return;
      console.warn('[Genesis] ARCHITECT attempt 1 failed:', archErr);
    }

    let parsedArch = parseArchitectJson(archRaw);
    let validated = validateAndRepairArchitectAgents(parsedArch, cleanTopic);

    if (validated.validCount < 18 && !signal?.aborted) {
      console.warn(
        `[Genesis] ARCHITECT produced ${validated.validCount}/18 valid agents on attempt 1. Retrying once...`,
      );
      try {
        const retryRaw = await callArchitectOnce(2);
        const retryParsed = parseArchitectJson(retryRaw);
        const retryValidated = validateAndRepairArchitectAgents(retryParsed, cleanTopic);
        if (retryValidated.validCount >= validated.validCount) {
          validated = retryValidated;
        }
      } catch (retryErr) {
        if (signal?.aborted) return;
        console.warn('[Genesis] ARCHITECT retry failed, using repaired fallback list:', retryErr);
      }
    }

    if (signal?.aborted) return;

    const blueprints = validated.output.agents;
    const architectPlan = validated.output.plan;

    // =========================================================================
    // STEP 3: Build 18 ParallaxAgentConfig objects
    // =========================================================================
    const genesisAgents: ParallaxAgentConfig[] = blueprints.map((bp, idx) => {
      const slotChoice = resolveGenesisSlot(idx + 2, genesisSettings);
      const sharedRules = `SHARED RULES: Today is ${todayDate}. Topic: ${cleanTopic}. Your task: ${bp.task}. Use ONLY the SEARCH RESULTS below for facts and cite them like [1], [2] with the source domain. If the results do not cover something, say it is unverified. Do NOT say a thing does not exist if the search results show it exists. Stay in your role. Write 90-170 words, clear full sentences, no markdown headings, no 'OK'. Finish with a confidence tag on the last line: [n|emoji] where n is 1-10.`;

      return {
        id: `genesis_${idx + 1}_${bp.name.toLowerCase()}`,
        name: bp.name,
        initials: bp.name.slice(0, 2).toUpperCase(),
        role: bp.role,
        accentColor: bp.color,
        providerId: slotChoice.providerId,
        modelId: slotChoice.modelId,
        enabled: true,
        isDynamic: true,
        systemInstruction: `${bp.systemPrompt}\n\n${sharedRules}`,
        maxTokens: 700,
        mood: bp.emoji,
        voice: GENESIS_VOICES[idx % GENESIS_VOICES.length] || 'en-US-JennyNeural',
        selectionReason: bp.task,
      };
    });

    onDynamicPersonasCreated?.(genesisAgents);

    // =========================================================================
    // STEP 4: Post ARCHITECT Message (Round 1)
    // =========================================================================
    const roleListLine = blueprints.map((bp) => `${bp.emoji} ${bp.name} (${bp.role})`).join(' · ');
    const architectMsg: ParallaxMessage = {
      id: `plx_architect_r1_${Date.now()}`,
      agentId: 'architect',
      agentName: 'ARCHITECT',
      initials: 'AR',
      accentColor: '#a78bfa',
      round: 1,
      text: `${architectPlan}\n\nAssembled Team (18): ${roleListLine}`,
      conviction: 9,
      mood: '🏗️',
      isDynamic: false,
      role: 'Swarm Team Builder',
      voice: architectConfig.voice,
      side: 'genesis',
      sideLabel: 'Swarm Team Builder',
      timestamp: Date.now(),
      durationMs: Date.now() - archStart,
      model: architectModel,
      providerName: architectProvider?.name || 'Built-in AI',
    };

    allMessages.push(architectMsg);
    onMessage(architectMsg);
    onStatusUpdate?.(
      maxSearches > 0
        ? 'Genesis: ARCHITECT created 18 agents. Searching...'
        : 'Genesis: ARCHITECT created 18 agents. Starting deliberation...',
    );

    if (signal?.aborted) return;

    // =========================================================================
    // STEP 5: SEARCH Step (shared scan counts inside maxSearches limit)
    // If maxSearches > 0, number of agent searches is maxSearches - 1 (min 1 if maxSearches >= 1).
    // If maxSearches is 0, skip agent searches too.
    // =========================================================================
    const agentSearchCount = maxSearches > 0 ? Math.max(1, maxSearches - 1) : 0;
    const uniqueQueryList: string[] = [];
    const querySeen = new Set<string>();

    for (const bp of blueprints) {
      const qKey = bp.searchQuery.toLowerCase().trim();
      if (qKey && !querySeen.has(qKey)) {
        querySeen.add(qKey);
        uniqueQueryList.push(bp.searchQuery.trim());
      }
    }

    const queriesToRun = uniqueQueryList.slice(0, agentSearchCount);
    const queryResultsMap = new Map<
      string,
      { results: ParallaxToolRawResult[]; sourceLabel: string; ok: boolean }
    >();

    const SEARCH_CONCURRENCY = 3;
    for (let i = 0; i < queriesToRun.length; i += SEARCH_CONCURRENCY) {
      if (signal?.aborted) return;
      if (i > 0) {
        await abortableSleep(450, signal);
      }
      const batchQueries = queriesToRun.slice(i, i + SEARCH_CONCURRENCY);
      const batchResults = await Promise.all(
        batchQueries.map(async (q) => {
          const res = await runSingleSearchWithTimeoutAndRetry(q, signal);
          return { key: q.toLowerCase().trim(), res };
        }),
      );
      for (const item of batchResults) {
        if (item.res.ok && item.res.results.length > 0) {
          queryResultsMap.set(item.key, item.res);
        }
      }
    }

    // Map each of the 18 agents to its search results (own search -> nearest successful agent search -> shared brief)
    const agentSearchEntries: GenesisSearchEntry[] = blueprints.map((bp) => {
      const qKey = bp.searchQuery.toLowerCase().trim();
      const matched = queryResultsMap.get(qKey);
      if (matched && matched.ok && matched.results.length > 0) {
        return {
          query: bp.searchQuery,
          results: matched.results.slice(0, 4),
          sourceLabel: matched.sourceLabel,
          hadOwnSearch: true,
        };
      }
      return {
        query: bp.searchQuery,
        results: [],
        sourceLabel: sharedBriefSourceLabel,
        hadOwnSearch: false,
      };
    });

    // Second pass: fill agents that didn't get their own search with nearest agent's successful search or sharedBriefResults
    for (let idx = 0; idx < agentSearchEntries.length; idx++) {
      if (agentSearchEntries[idx].results.length > 0) continue;
      let nearestIdx = -1;
      let minDist = Infinity;
      for (let j = 0; j < agentSearchEntries.length; j++) {
        if (agentSearchEntries[j].hadOwnSearch && agentSearchEntries[j].results.length > 0) {
          const dist = Math.abs(j - idx);
          if (dist < minDist) {
            minDist = dist;
            nearestIdx = j;
          }
        }
      }
      if (nearestIdx !== -1) {
        agentSearchEntries[idx].results = agentSearchEntries[nearestIdx].results;
        agentSearchEntries[idx].sourceLabel = agentSearchEntries[nearestIdx].sourceLabel;
      } else {
        agentSearchEntries[idx].results = sharedBriefResults;
        agentSearchEntries[idx].sourceLabel = sharedBriefSourceLabel;
      }
    }

    if (signal?.aborted) return;

    // =========================================================================
    // STEP 6: ANSWER Step (18 agents in batches of 4, streaming as each finishes)
    // =========================================================================
    let answeredCount = 0;
    onStatusUpdate?.(`Genesis: agents answering (0/18)...`);

    const executeSingleGenesisAgent = async (
      agent: ParallaxAgentConfig,
      bp: ArchitectAgentBlueprint,
      searchEntry: GenesisSearchEntry,
    ): Promise<ParallaxMessage> => {
      const turnStart = Date.now();
      const { provider, model } = resolveParallaxProviderConfig(agent, 700);
      const searchBlock = formatSearchResultsBlock(searchEntry.results);
      const userPrompt = `${searchBlock}\n\nTopic: "${cleanTopic}"\nYour assigned task (${bp.role}): ${bp.task}`;

      const createAgentFallback = (reason: string): ParallaxMessage => {
        const shortReason = (reason || 'request failed').replace(/\s+/g, ' ').trim().slice(0, 90);
        return {
          id: `plx_${agent.id}_r1_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          agentId: agent.id,
          agentName: agent.name,
          initials: agent.initials,
          accentColor: agent.accentColor,
          round: 1,
          text: `(This agent could not answer: ${shortReason})`,
          conviction: 5,
          mood: agent.mood || '⚠️',
          isDynamic: true,
          role: agent.role,
          voice: agent.voice,
          side: 'genesis',
          sideLabel: agent.role,
          timestamp: Date.now(),
          durationMs: Date.now() - turnStart,
          model: model || 'fallback',
          providerName: provider?.name || 'Local Mesh',
          fallbackReason: shortReason,
          toolUsed: searchEntry.hadOwnSearch
            ? {
                tool: 'search',
                query: searchEntry.query,
                searchSource: searchEntry.sourceLabel,
                sourcesCount: searchEntry.results.length,
                rawResults: searchEntry.results,
              }
            : undefined,
        };
      };

      let response: { text?: string; content?: string; model?: string; providerName?: string } | null = null;
      let rawText = '';

      try {
        if (signal?.aborted) throw new Error('Swarm aborted');
        try {
          response = await api.jarvisAgentCall({
            agentId: `genesis_turn_${agent.id}`,
            messages: [
              { role: 'system', content: agent.systemInstruction },
              { role: 'user', content: userPrompt },
            ],
            providerConfig: provider,
            temperature: 0.7,
            maxTokens: 700,
            timeoutMs: 30000,
            signal,
          });
          rawText = (response.text || response.content || '').trim();
        } catch (err1) {
          if (signal?.aborted) throw err1;
          if (isNetworkOrRateLimitError(err1)) {
            await abortableSleep(1500, signal);
            response = await api.jarvisAgentCall({
              agentId: `genesis_turn_${agent.id}_netretry`,
              messages: [
                { role: 'system', content: agent.systemInstruction },
                { role: 'user', content: userPrompt },
              ],
              providerConfig: provider,
              temperature: 0.7,
              maxTokens: 700,
              timeoutMs: 30000,
              signal,
            });
            rawText = (response?.text || response?.content || '').trim();
          } else {
            return createAgentFallback(err1 instanceof Error ? err1.message : String(err1));
          }
        }

        let parsed = parseGenesisTag(rawText, agent.mood || '💡');
        let fullText = parsed.cleanText.trim();

        if (countWords(fullText) < 20 && !signal?.aborted) {
          const { provider: retryProvider } = resolveParallaxProviderConfig(agent, 1100);
          const retryUserPrompt = `${userPrompt}\n\nYour last reply was too short. Write at least 60 words.`;
          try {
            const retryRes = await api.jarvisAgentCall({
              agentId: `genesis_turn_${agent.id}_shortretry`,
              messages: [
                { role: 'system', content: agent.systemInstruction },
                { role: 'user', content: retryUserPrompt },
              ],
              providerConfig: retryProvider,
              temperature: 0.7,
              maxTokens: 1100,
              timeoutMs: 30000,
              signal,
            });
            const retryRaw = (retryRes.text || retryRes.content || '').trim();
            const retryParsed = parseGenesisTag(retryRaw, agent.mood || '💡');
            if (countWords(retryParsed.cleanText) >= 20) {
              parsed = retryParsed;
              fullText = retryParsed.cleanText.trim();
              response = retryRes;
            } else {
              return createAgentFallback('reply under 20 words after retry');
            }
          } catch (retryErr) {
            if (signal?.aborted) throw retryErr;
            return createAgentFallback(retryErr instanceof Error ? retryErr.message : String(retryErr));
          }
        }

        if (countWords(fullText) < 20) {
          return createAgentFallback('reply under 20 words');
        }

        return {
          id: `plx_${agent.id}_r1_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          agentId: agent.id,
          agentName: agent.name,
          initials: agent.initials,
          accentColor: agent.accentColor,
          round: 1,
          text: fullText,
          conviction: parsed.conviction,
          mood: parsed.mood || agent.mood,
          isDynamic: true,
          role: agent.role,
          voice: agent.voice,
          side: 'genesis',
          sideLabel: agent.role,
          timestamp: Date.now(),
          durationMs: Date.now() - turnStart,
          model: response?.model || model,
          providerName: response?.providerName || provider?.name || 'Built-in AI',
          toolUsed: searchEntry.hadOwnSearch
            ? {
                tool: 'search',
                query: searchEntry.query,
                searchSource: searchEntry.sourceLabel,
                sourcesCount: searchEntry.results.length,
                rawResults: searchEntry.results,
              }
            : undefined,
        };
      } catch (err) {
        if (signal?.aborted) throw err;
        return createAgentFallback(err instanceof Error ? err.message : String(err));
      }
    };

    const agentMessages: ParallaxMessage[] = [];
    const AGENT_BATCH_SIZE = 4;

    for (let i = 0; i < genesisAgents.length; i += AGENT_BATCH_SIZE) {
      if (signal?.aborted) return;
      const batchAgents = genesisAgents.slice(i, i + AGENT_BATCH_SIZE);
      const batchPromises = batchAgents.map(async (ag, bIdx) => {
        const idx = i + bIdx;
        const msg = await executeSingleGenesisAgent(ag, blueprints[idx], agentSearchEntries[idx]);
        if (!signal?.aborted) {
          answeredCount++;
          agentMessages.push(msg);
          allMessages.push(msg);
          onMessage(msg);
          onStatusUpdate?.(`Genesis: agents answering (${answeredCount}/18)...`);
        }
        return msg;
      });
      await Promise.all(batchPromises);
    }

    if (signal?.aborted) return;

    // =========================================================================
    // STEP 7: ZENITH Final Synthesis (Slot 1)
    // =========================================================================
    onStatusUpdate?.('Genesis: ZENITH writing final synthesis...');

    // Collect unique sources across all searches (max 10 for prompt, up to 8 for summary)
    const uniqueSources: Array<{ title: string; url: string; domain: string }> = [];
    const seenUrls = new Set<string>();
    const addSource = (r: ParallaxToolRawResult) => {
      const key = (r.url || r.title || '').toLowerCase().trim();
      if (!key || seenUrls.has(key)) return;
      seenUrls.add(key);
      uniqueSources.push({
        title: r.title || 'Source',
        url: r.url || '',
        domain: r.domain || 'web',
      });
    };

    for (const entry of agentSearchEntries) {
      for (const r of entry.results) {
        addSource(r);
      }
    }
    for (const r of sharedBriefResults) {
      addSource(r);
    }

    const sourcesForZenith = uniqueSources
      .slice(0, 10)
      .map((s, idx) => `[${idx + 1}] ${s.title} - ${s.domain}`)
      .join('\n');

    const agentExcerptsForZenith = agentMessages
      .filter((m) => !m.fallbackReason)
      .map((m) => `${m.agentName} (${m.role || 'Specialist'}): ${m.text.slice(0, 450)}`)
      .join('\n\n');

    const { provider: zenithProvider, model: zenithModel } = resolveParallaxProviderConfig(
      zenithConfig,
      1000,
    );

    const zenithSystemPrompt = `Today is ${todayDate}. You are ZENITH, the final answer synthesizer of the Genesis Swarm.
Rules:
1. Use ONLY the facts and findings provided by the 18 agents and the verified sources below. Do NOT invent facts.
2. Write plain text with these exact 4 sections, each starting on a new line:
FINAL ANSWER: (4-8 clear sentences directly answering the topic)
KEY FACTS: (3-5 bullet points citing source domains)
WHERE AGENTS DISAGREE: (1-3 bullet points on key tensions or uncertainties)
CONFIDENCE: (one line: High, Medium, or Low + why)`;

    const zenithUserPrompt = `Today is ${todayDate}.
Topic: "${cleanTopic}"

AGENT FINDINGS:
${agentExcerptsForZenith || '(No agent findings available)'}

UNIQUE SOURCES:
${sourcesForZenith || '(No live web sources available)'}

Write the final synthesis using the 4 required sections: FINAL ANSWER:, KEY FACTS:, WHERE AGENTS DISAGREE:, CONFIDENCE:.`;

    const buildZenithFallbackText = (): string => {
      const nonFallback = agentMessages
        .filter((m) => !m.fallbackReason)
        .sort((a, b) => (b.conviction ?? 7) - (a.conviction ?? 7));
      const top3 = nonFallback.slice(0, 3);
      const sentences = top3
        .map((m) => `${m.agentName}: ${extractFirstSentence(m.text)}`)
        .filter(Boolean);
      const combined =
        sentences.length > 0
          ? sentences.join(' ')
          : `Genesis Swarm completed its single-round investigation on "${cleanTopic}".`;
      return `FINAL ANSWER:\n${combined}\n\nKEY FACTS:\n• Synthesized from top-conviction Genesis agents.\n\nWHERE AGENTS DISAGREE:\n• Agents emphasized different domain trade-offs across implementation and risk.\n\nCONFIDENCE:\nMedium — Estimated from top agents.`;
    };

    const zenithStart = Date.now();
    let zenithText = '';
    let zenithFallbackReason: string | undefined;
    let zenithRespModel = zenithModel;
    let zenithRespProvider = zenithProvider?.name || 'Built-in AI';

    try {
      const zRes = await api.jarvisAgentCall({
        agentId: 'genesis_zenith_final',
        messages: [
          { role: 'system', content: zenithSystemPrompt },
          { role: 'user', content: zenithUserPrompt },
        ],
        providerConfig: zenithProvider,
        temperature: 0.4,
        maxTokens: 1000,
        timeoutMs: 40000,
        signal,
      });
      const rawZ = (zRes.text || zRes.content || '').trim();
      if (countWords(rawZ) >= 15) {
        zenithText = rawZ;
        zenithRespModel = zRes.model || zenithModel;
        zenithRespProvider = zRes.providerName || zenithRespProvider;
      } else {
        zenithText = buildZenithFallbackText();
        zenithFallbackReason = 'Estimated from top agents';
      }
    } catch (zErr) {
      if (signal?.aborted) return;
      console.warn('[Genesis] ZENITH synthesis failed, using fallback:', zErr);
      zenithText = buildZenithFallbackText();
      zenithFallbackReason = zErr instanceof Error ? zErr.message : String(zErr);
    }

    const zenithMsg: ParallaxMessage = {
      id: `plx_zenith_r1_${Date.now()}`,
      agentId: 'zenith',
      agentName: 'ZENITH',
      initials: 'ZE',
      accentColor: '#fbbf24',
      round: 1,
      text: zenithText,
      conviction: 9,
      mood: '🌟',
      isDynamic: false,
      role: 'Final Synthesis Architect',
      voice: zenithConfig.voice,
      side: 'genesis',
      sideLabel: 'Final Synthesis Architect',
      timestamp: Date.now(),
      durationMs: Date.now() - zenithStart,
      model: zenithRespModel,
      providerName: zenithRespProvider,
      fallbackReason: zenithFallbackReason,
    };

    allMessages.push(zenithMsg);
    onMessage(zenithMsg);

    // =========================================================================
    // STEP 8: Build ParallaxSummary WITHOUT another AI call & Save Session
    // =========================================================================
    const finalAnswerSegment = zenithText
      .replace(/^[\s\S]*?FINAL ANSWER:\s*/i, '')
      .split(/\n\s*(?:KEY FACTS|WHERE AGENTS DISAGREE|CONFIDENCE):/i)[0]
      .trim();
    const verdict =
      extractFirstSentence(finalAnswerSegment || zenithText) ||
      `Genesis Swarm completed its 18-agent investigation into "${cleanTopic}".`;

    const top4Agents = agentMessages
      .filter((m) => !m.fallbackReason)
      .sort((a, b) => (b.conviction ?? 7) - (a.conviction ?? 7))
      .slice(0, 4);

    const highlights = top4Agents.map(
      (m) => `${m.agentName}: ${extractFirstSentence(m.text)}`,
    );
    if (highlights.length === 0) {
      highlights.push(`ARCHITECT: ${extractFirstSentence(architectPlan)}`);
    }

    const groundingLevel: 'HIGH' | 'MODERATE' | 'SPECULATIVE' =
      uniqueSources.length >= 6
        ? 'HIGH'
        : uniqueSources.length >= 1
        ? 'MODERATE'
        : 'SPECULATIVE';

    const evidenceSources = uniqueSources.slice(0, 8).map((s) => ({
      title: s.title,
      url: s.url,
      domain: s.domain,
      tier: 'medium',
    }));

    const summary: ParallaxSummary = {
      verdict,
      highlights,
      consensusLean: 'Auto-Assembled Swarm',
      totalContributions: allMessages.length,
      groundingLevel,
      evidenceSources,
      debateMode: 'genesis',
      swarmSize: 20,
    };

    storage.saveParallaxSession({
      id: `session_${Date.now()}`,
      topic: cleanTopic,
      timestamp: Date.now(),
      roundsCompleted: 1,
      messages: allMessages,
      summary,
      debateMode: 'genesis',
      swarmSize: 20,
      genesisAgents,
    });

    onRoundComplete?.(1, allMessages);
    onStatusUpdate?.('Genesis Swarm complete.');
    onComplete?.(summary, allMessages);
  } catch (err: unknown) {
    if (signal?.aborted) {
      return;
    }
    console.error('[Genesis Swarm] Execution error:', err);
    onError?.(err instanceof Error ? err.message : 'Unknown error during Genesis Swarm execution.');
  }
}
