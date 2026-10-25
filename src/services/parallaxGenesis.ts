import { storage } from '@/lib/storage';
import { isValidSwarmSize } from '@/lib/parallaxSwarmSize';
import { resolveGenesisSlot, getModelPool } from '@/lib/parallaxModelPool';
import { DEFAULT_PARALLAX_VOICES } from '@/data/parallaxVoices';
import { api } from '@/services/api';
import { parallaxSearch } from '@/lib/parallaxSearch';
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
  agentCount: number,
): { validCount: number; output: ArchitectParsedOutput } {
  const rawList = Array.isArray(parsed?.agents) ? parsed!.agents! : [];
  const usedNames = new Set<string>();
  const usedColors = new Set<string>();
  const validAgents: ArchitectAgentBlueprint[] = [];

  for (let i = 0; i < rawList.length && validAgents.length < agentCount; i++) {
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

  // Fill any missing slots up to agentCount from GENERIC_18_ROLES in priority order
  for (let i = 0; i < GENERIC_18_ROLES.length && validAgents.length < agentCount; i++) {
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

  // In case still < agentCount
  while (validAgents.length < agentCount) {
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

  const defaultPlan = `ARCHITECT assembled ${agentCount} specialized agents to investigate "${topic.slice(0, 90)}" across empirical facts, technical feasibility, economics, risk, and practical execution. Each agent runs targeted search grounding before ZENITH synthesizes the final verdict.`;
  const plan =
    typeof parsed?.plan === 'string' && parsed.plan.trim().length >= 15
      ? parsed.plan.trim().slice(0, 380)
      : defaultPlan;

  return {
    validCount,
    output: {
      plan,
      agents: validAgents.slice(0, agentCount),
    },
  };
}

interface GenesisSearchEntry {
  query: string;
  results: ParallaxToolRawResult[];
  sourceLabel: string;
  hadOwnSearch: boolean;
}

interface TimeoutMeta {
  step: string;
  agentId: string;
  model: string;
}

function isTimeoutError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return /^timeout after \d+s$/i.test(msg.trim());
}

export async function withHardTimeout<T>(
  promiseFactory: (signal: AbortSignal) => Promise<T>,
  ms: number,
  parentSignal?: AbortSignal,
  meta?: TimeoutMeta,
): Promise<T> {
  if (parentSignal?.aborted) {
    throw new Error('Swarm aborted');
  }

  const callStart = Date.now();
  const controller = new AbortController();
  const seconds = Math.round(ms / 1000);
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let onParentAbort: (() => void) | null = null;

  const raceControlPromise = new Promise<never>((_, reject) => {
    onParentAbort = () => {
      controller.abort();
      reject(new Error('Swarm aborted'));
    };
    if (parentSignal) {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
    timer = setTimeout(() => {
      timedOut = true;
      const elapsedMs = Date.now() - callStart;
      console.warn(
        `[Genesis Timeout] step=${meta?.step || 'genesis_call'} | agentId=${meta?.agentId || 'unknown'} | model=${meta?.model || 'unknown'} | elapsedMs=${elapsedMs}`,
      );
      controller.abort();
      reject(new Error(`timeout after ${seconds}s`));
    }, ms);
  });

  try {
    return await Promise.race([promiseFactory(controller.signal), raceControlPromise]);
  } catch (err) {
    if (parentSignal?.aborted) {
      throw new Error('Swarm aborted');
    }
    if (timedOut) {
      throw new Error(`timeout after ${seconds}s`);
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
    if (parentSignal && onParentAbort) {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  }
}

async function runSingleSearchWithTimeoutAndRetry(
  query: string,
  signal?: AbortSignal,
  stepName = 'web_search',
  agentId = 'search',
): Promise<{ results: ParallaxToolRawResult[]; sourceLabel: string; ok: boolean }> {
  const attemptSearch = async (attemptLabel: string): Promise<{ results: ParallaxToolRawResult[]; sourceLabel: string }> => {
    if (signal?.aborted) throw new Error('Swarm aborted');
    const rawRes = await withHardTimeout(
      () => parallaxSearch(query, 'ALL', 1, 5),
      12000,
      signal,
      { step: attemptLabel, agentId, model: 'web_search' },
    );
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
  };

  try {
    const first = await attemptSearch(stepName);
    return { ...first, ok: first.results.length > 0 };
  } catch (err) {
    if (signal?.aborted) throw err;
    if (!isTimeoutError(err) && isNetworkOrRateLimitError(err)) {
      try {
        await abortableSleep(1500, signal);
        const second = await attemptSearch(`${stepName}_retry`);
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
  const endTagRegex = /\[\s*(\d{1,2})\s*[|/,;]\s*([^\]]{1,12}?)\s*\]\s*$/u;
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

function endsWithFinishedSentence(text: string): boolean {
  const trimmed = (text || '').trim();
  if (!trimmed) return false;
  // Ignore trailing citations like [3] or [1, 2]
  const withoutTrailingCitations = trimmed.replace(/(?:\s*\[[^\]]*\])+\s*$/, '').trim();
  if (!withoutTrailingCitations) return false;
  return /[.!?)"'”’]$/.test(withoutTrailingCitations);
}

function trimToLastCompleteSentence(text: string): string {
  const trimmed = (text || '').trim();
  if (!trimmed) return '';
  if (endsWithFinishedSentence(trimmed)) return trimmed;

  const boundaryRegex =
    /(?<!\b(?:vs|Vs|VS|Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St|Fig|No|Vol|Inc|Ltd|Co|Corp|etc|al|e\.g|i\.e|U\.S|U\.K))[.!?]['"”’)]*(?:\s*\[[^\]]*\])*(?=\s+[A-Z0-9"'\u201C\u2018•\-*]|\s*$)/g;
  let lastValidEnd = -1;
  let match: RegExpExecArray | null;

  while ((match = boundaryRegex.exec(trimmed)) !== null) {
    const endIdx = match.index + match[0].length;
    const prefix = trimmed.slice(0, endIdx);
    const openBrackets = (prefix.match(/\[/g) || []).length;
    const closeBrackets = (prefix.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) continue;
    if (/(?:^|\s)\d+\.$/.test(prefix)) continue;
    lastValidEnd = endIdx;
  }

  if (lastValidEnd > 0) {
    const cut = trimmed.slice(0, lastValidEnd).replace(/\s*\[[^\]]*$/, '').trim();
    if (cut.length > 0) return cut;
  }
  return trimmed.replace(/\s*\[[^\]]*$/, '').trim();
}

function trimZenithMarkdown(text: string): string {
  const raw = (text || '').trim();
  if (!raw) return '';

  const lines = raw.split('\n');
  while (lines.length > 0) {
    const lastLine = lines[lines.length - 1].trim();
    if (!lastLine) {
      lines.pop();
      continue;
    }
    // Remove dangling empty heading at the very end
    if (/^#{1,6}\s+/.test(lastLine)) {
      lines.pop();
      continue;
    }
    // Table row check
    if (lastLine.startsWith('|')) {
      const isSeparator = /^\|[\s:-]+(?:\|[\s:-]+)+\|?\s*$/.test(lastLine);
      const isCompleteRow = /^\|.+\|\s*$/.test(lastLine) && !isSeparator;
      if (isCompleteRow) {
        return lines.join('\n').trim();
      }
      // Incomplete table row or trailing separator row: pop it
      lines.pop();
      continue;
    }
    // Source line check: e.g., "- [1] Title - domain" or "[1] Title - domain"
    if (/^[-*•]?\s*\[\d+\]\s+\S+/.test(lastLine)) {
      const hasUnclosedBracket =
        (lastLine.match(/\[/g) || []).length !== (lastLine.match(/\]/g) || []).length;
      const endsWithDanglingPunct = /[-—:,]\s*$/.test(lastLine);
      if (!hasUnclosedBracket && !endsWithDanglingPunct) {
        return lines.join('\n').trim();
      }
      if (lines.length > 1) {
        lines.pop();
        continue;
      }
      return lastLine.replace(/[-—:,\s]+$/, '').trim();
    }
    // Confidence line check (e.g. "High — ...", "Medium - ...", "Low: ...")
    if (/^(?:\*\*)?(?:High|Medium|Low)(?:\*\*)?\b/i.test(lastLine)) {
      if (endsWithFinishedSentence(lastLine)) {
        return lines.join('\n').trim();
      }
      const trimmedSent = trimToLastCompleteSentence(lastLine);
      if (trimmedSent && trimmedSent !== lastLine && countWords(trimmedSent) >= 3) {
        lines[lines.length - 1] = trimmedSent;
        return lines.join('\n').trim();
      }
      lines[lines.length - 1] = lastLine
        .replace(/\s*\[[^\]]*$/, '')
        .replace(/\s+[-—:,]\s*$/, '')
        .trim();
      return lines.join('\n').trim();
    }
    // Bullet line check
    if (/^[-*•]\s+/.test(lastLine)) {
      if (endsWithFinishedSentence(lastLine)) {
        return lines.join('\n').trim();
      }
      const trimmedBullet = trimToLastCompleteSentence(lastLine);
      if (
        trimmedBullet &&
        endsWithFinishedSentence(trimmedBullet) &&
        countWords(trimmedBullet) >= 4
      ) {
        lines[lines.length - 1] = trimmedBullet;
        return lines.join('\n').trim();
      }
      if (lines.length > 1) {
        lines.pop();
        continue;
      }
      lines[lines.length - 1] = trimmedBullet || lastLine;
      return lines.join('\n').trim();
    }
    // Standard paragraph line
    if (endsWithFinishedSentence(lastLine)) {
      return lines.join('\n').trim();
    }
    const trimmedPara = trimToLastCompleteSentence(lastLine);
    if (trimmedPara && endsWithFinishedSentence(trimmedPara)) {
      lines[lines.length - 1] = trimmedPara;
      return lines.join('\n').trim();
    }
    if (lines.length > 1) {
      lines.pop();
      continue;
    }
    return trimmedPara || lastLine;
  }

  return raw;
}

function stripCitationBrackets(text: string): string {
  let result = text || '';
  const citationRegex = /\s*\[\s*\d+(?:\s*[,;/–-]\s*[^\]]*)?\]/g;
  let prev = '';
  while (result !== prev) {
    prev = result;
    result = result.replace(citationRegex, '');
  }
  return result
    .replace(/\s*\[[^\]]*$/, '')
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function stripMarkdownMarks(text: string): string {
  if (!text) return '';
  return text
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/__/g, '')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/(?:^|\s)\*(?=\S)|(?<=\S)\*(?=\s|$|[.,!?;:])/g, '')
    .replace(/`+/g, '')
    .replace(/\|+/g, ' ')
    .replace(/^[\s#-]+/, '')
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function splitCleanSentences(text: string): string[] {
  if (!text) return [];
  const filteredLines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => {
      if (!l) return false;
      if (/^#{1,6}\s+/.test(l)) return false;
      if (/^\|?[\s:-]+\|[\s|:-]*$/.test(l)) return false;
      return true;
    })
    .map((l) => l.replace(/^[-*•#]+\s*/, '').trim());

  let clean = filteredLines.join(' ');
  clean = stripCitationBrackets(clean);
  clean = stripMarkdownMarks(clean);
  if (!clean) return [];

  const sentenceBoundaryRegex =
    /(?:[^[\]]|\[[^\]]*\])+?(?<!\b(?:vs|Vs|VS|Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St|Fig|No|Vol|Inc|Ltd|Co|Corp|etc|al|e\.g|i\.e|U\.S|U\.K))[.!?](?=\s+[A-Z0-9"']|\s*$)/g;
  const matches = clean.match(sentenceBoundaryRegex);
  if (matches && matches.length > 0) {
    return matches
      .map((s) => stripMarkdownMarks(stripCitationBrackets(s)))
      .filter((s) => s.length > 0);
  }
  const fallback = stripMarkdownMarks(stripCitationBrackets(clean));
  return fallback ? [fallback] : [];
}

function capSentenceLength(sentence: string): string {
  const cleaned = stripMarkdownMarks(stripCitationBrackets(sentence));
  if (cleaned.length > 180) {
    return stripMarkdownMarks(stripCitationBrackets(cleaned.slice(0, 177))) + '…';
  }
  return cleaned;
}

function extractFirstSentence(text: string): string {
  const sentences = splitCleanSentences(text);
  if (sentences.length > 0) {
    for (const s of sentences) {
      if (s.length >= 15) {
        return capSentenceLength(s);
      }
    }
    return capSentenceLength(sentences[0]);
  }
  const fallback = stripMarkdownMarks(stripCitationBrackets(text || ''));
  return capSentenceLength(fallback);
}

function extractHighlightSentence(text: string, topic?: string): string {
  const sentences = splitCleanSentences(text);
  if (sentences.length === 0) return extractFirstSentence(text);

  const first = sentences[0];
  const isGenericOpening = /^(?:based on|according to|from a|from an|as a|in summary)\b/i.test(
    first.trim(),
  );
  const isTooShort = first.trim().length < 40;

  if ((isGenericOpening || isTooShort) && sentences.length > 1) {
    const topicWords = topic
      ? topic
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 4 && !TOPIC_STOP_WORDS.has(w))
      : [];

    const dateRegex =
      /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|20\d{2}|19\d{2})\b/i;

    for (let i = 1; i < sentences.length; i++) {
      const candidate = sentences[i].trim();
      if (!candidate) continue;
      const hasNumber = /\d/.test(candidate);
      const hasDate = dateRegex.test(candidate);
      const withoutFirstWord = candidate.replace(/^\S+\s+/, '');
      const hasProductName =
        /\b[A-Z][a-zA-Z0-9.+_-]{2,}\b/.test(withoutFirstWord) ||
        topicWords.some((tw) => candidate.toLowerCase().includes(tw));
      const isLongEnough = candidate.length >= 60;

      if (hasNumber || hasDate || hasProductName || isLongEnough) {
        return capSentenceLength(candidate);
      }
    }
  }

  return capSentenceLength(first);
}

const HIGH_TIER_EXACT_OR_SUBDOMAINS = [
  'arxiv.org',
  'nasa.gov',
  'nature.com',
  'science.org',
  'openai.com',
  'anthropic.com',
  'deepmind.google',
  'blog.google',
  'ai.google.dev',
  'github.com',
  'who.int',
  'un.org',
];

const LOW_TIER_EXACT_OR_SUBDOMAINS = [
  'youtube.com',
  'youtu.be',
  'reddit.com',
  'x.com',
  'twitter.com',
  'facebook.com',
  'tiktok.com',
  'instagram.com',
  'quora.com',
  'medium.com',
  'pinterest.com',
];

function getGenesisSourceTier(domainOrUrl: string): 'high' | 'medium' | 'low' {
  let host = (domainOrUrl || '').toLowerCase().trim();
  if (!host) return 'medium';
  if (host.includes('://')) {
    try {
      host = new URL(host).hostname.toLowerCase();
    } catch {
      host = host.split('/')[2] || host;
    }
  } else {
    host = host.split('/')[0];
  }
  host = host.replace(/^www\./, '').trim();
  if (!host) return 'medium';

  if (
    host.endsWith('.gov') ||
    host.endsWith('.edu') ||
    host.startsWith('developers.') ||
    host.startsWith('docs.') ||
    host.includes('.developers.') ||
    host.includes('.docs.') ||
    HIGH_TIER_EXACT_OR_SUBDOMAINS.some((d) => host === d || host.endsWith(`.${d}`))
  ) {
    return 'high';
  }

  if (LOW_TIER_EXACT_OR_SUBDOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) {
    return 'low';
  }

  return 'medium';
}

function findGlobalSourceNumber(
  localSource: ParallaxToolRawResult | undefined,
  globalSources: Array<{ url: string; title: string }>,
): number | null {
  if (!localSource) return null;
  const localUrl = (localSource.url || '').toLowerCase().trim();
  if (localUrl) {
    const byUrlIdx = globalSources.findIndex(
      (g) => (g.url || '').toLowerCase().trim() === localUrl,
    );
    if (byUrlIdx !== -1) return byUrlIdx + 1;
  }
  const localTitle = (localSource.title || '').toLowerCase().trim();
  if (localTitle) {
    const byTitleIdx = globalSources.findIndex(
      (g) => (g.title || '').toLowerCase().trim() === localTitle,
    );
    if (byTitleIdx !== -1) return byTitleIdx + 1;
  }
  return null;
}

function remapAgentCitationsToGlobal(
  text: string,
  localResults: ParallaxToolRawResult[],
  globalSources: Array<{ url: string; title: string }>,
): string {
  if (!text) return '';
  const replaced = text.replace(/\[\s*\d+(?:\s*[,;/]\s*[^\]]*)?\]/g, (fullBracket) => {
    const inner = fullBracket.slice(1, -1);
    const parts = inner.split(/[,;/]/);
    const globalNums: number[] = [];

    for (const rawPart of parts) {
      const token = rawPart.trim();
      if (!/^\d+$/.test(token)) {
        // Ignore non-numeric citation parts like "youtube.com" in "[4, youtube.com]"
        continue;
      }
      const localNum = parseInt(token, 10);
      if (Number.isNaN(localNum) || localNum < 1 || localNum > localResults.length) {
        continue;
      }
      const globalNum = findGlobalSourceNumber(localResults[localNum - 1], globalSources);
      if (globalNum !== null && !globalNums.includes(globalNum)) {
        globalNums.push(globalNum);
      }
    }

    if (globalNums.length === 0) {
      return '';
    }
    return `[${globalNums.join(', ')}]`;
  });

  return replaced
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

interface RankedGenesisSource {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  tier: 'high' | 'medium' | 'low';
}

function stripZenithAiSourcesSection(text: string): string {
  if (!text) return '';
  return text
    .replace(/(?:^|\n)\s*(?:#{1,6}\s*Sources\b|SOURCES\s*:?)[\s\S]*$/i, '')
    .trim();
}

function renumberAndBuildZenithSources(
  bodyWithoutSources: string,
  globalSources: RankedGenesisSource[],
): { finalText: string; orderedSources: RankedGenesisSource[] } {
  const oldToNew = new Map<number, number>();
  const usedSources: RankedGenesisSource[] = [];

  const citationGroupRegex =
    /(?:\[\s*\d+(?:\s*[,;/]\s*[^\]]*)?\](?!\())(?:\s*\[\s*\d+(?:\s*[,;/]\s*[^\]]*)?\](?!\())*/g;

  const renumberedBody = (bodyWithoutSources || '')
    .replace(citationGroupRegex, (groupMatch) => {
      const brackets = groupMatch.match(/\[[^\]]+\]/g) || [];
      const groupNewNums: number[] = [];

      for (const br of brackets) {
        const inner = br.slice(1, -1);
        const parts = inner.split(/[,;/]/);
        for (const rawPart of parts) {
          const token = rawPart.trim();
          if (!/^\d+$/.test(token)) continue;
          const oldNum = parseInt(token, 10);
          if (Number.isNaN(oldNum) || oldNum < 1 || oldNum > globalSources.length) {
            continue;
          }
          let newNum = oldToNew.get(oldNum);
          if (newNum === undefined) {
            newNum = usedSources.length + 1;
            oldToNew.set(oldNum, newNum);
            usedSources.push(globalSources[oldNum - 1]);
          }
          groupNewNums.push(newNum);
        }
      }

      const uniqueSorted = Array.from(new Set(groupNewNums)).sort((a, b) => a - b);
      if (uniqueSorted.length === 0) {
        return '';
      }
      return uniqueSorted.map((n) => `[${n}]`).join('');
    })
    .replace(/[ \t]+([.,!?;:])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  const orderedSources =
    usedSources.length > 0 ? usedSources : globalSources.slice(0, 5);

  const sourceLines =
    orderedSources.length > 0
      ? orderedSources.map((s, idx) => {
          const k = idx + 1;
          const safeTitle = (s.title || 'Source').replace(/[[\]]/g, '').trim() || 'Source';
          const cleanUrl = (s.url || '').trim();
          const hasValidUrl = /^https?:\/\/[^\s)]+$/.test(cleanUrl);
          const titlePart = hasValidUrl ? `[${safeTitle}](${cleanUrl})` : safeTitle;
          return `- [${k}] ${titlePart} - ${s.domain || 'web'} (${s.tier || 'medium'})`;
        })
      : ['- [1] Synthesized from Genesis Swarm agent findings - local (medium)'];

  const finalText = `${renumberedBody}\n\n## Sources\n${sourceLines.join('\n')}`;
  return { finalText, orderedSources };
}

const TOPIC_STOP_WORDS = new Set([
  'tell',
  'latest',
  'letest',
  'updates',
  'update',
  'about',
  'what',
  'with',
  'from',
  'that',
  'this',
  'they',
  'them',
  'then',
  'than',
  'have',
  'will',
  'would',
  'could',
  'should',
  'into',
  'more',
  'most',
  'some',
  'such',
  'only',
  'other',
  'which',
  'when',
  'where',
  'there',
  'their',
  'these',
  'those',
  'give',
  'show',
  'explain',
  'please',
]);

function extractTopicKeywords(topic: string): string[] {
  const words = (topic || '').toLowerCase().match(/[a-z]{4,}/g) || [];
  const filtered = words.filter((w) => !TOPIC_STOP_WORDS.has(w));
  return Array.from(new Set(filtered));
}

const MAX_GENESIS_RUN_MS = 8 * 60 * 1000; // 8 minutes total safety cap

export async function runGenesisSwarm(options: ParallaxRunOptions): Promise<void> {
  options.onStatusUpdate?.('Genesis: starting...');

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

  const runStart = Date.now();
  const todayDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Controller that aborts either when the user stops the swarm OR when the 8-minute total run cap expires
  const agentPhaseController = new AbortController();
  let eightMinLimitReached = false;
  const onUserAbort = () => {
    agentPhaseController.abort();
  };
  if (signal) {
    if (signal.aborted) return;
    signal.addEventListener('abort', onUserAbort, { once: true });
  }
  const eightMinTimer = setTimeout(() => {
    eightMinLimitReached = true;
    console.warn(
      `[Genesis Timeout] step=total_run_cap_8m | agentId=genesis_swarm | model=all | elapsedMs=${Date.now() - runStart}`,
    );
    agentPhaseController.abort();
  }, MAX_GENESIS_RUN_MS);

  const agentPhaseSignal = agentPhaseController.signal;

  try {
    if (signal?.aborted) return;

    const size = isValidSwarmSize(options.swarmSize)
      ? options.swarmSize
      : storage.getParallaxSwarmSize();
    const agentCount = size - 2;
    const architectMaxTokens = Math.max(1000, Math.min(2500, 700 + 100 * agentCount));

    const genesisSettings = storage.getParallaxGenesisSettings();
    const maxSearches = Math.max(0, Math.min(18, genesisSettings.maxSearches ?? 10));
    const allMessages: ParallaxMessage[] = [];

    onRoundStart?.(1);

    // =========================================================================
    // STEP 1: Initial Quick Scan Search (top 5 titles + snippets, max 700 chars)
    // Skipped completely if maxSearches === 0
    // =========================================================================
    let sharedBriefText = '';
    let sharedBriefResults: ParallaxToolRawResult[] = [];
    let sharedBriefSourceLabel = 'Live Web';

    if (maxSearches > 0) {
      onStatusUpdate?.('Genesis: scanning the topic (web search)...');
      try {
        const scanRes = await runSingleSearchWithTimeoutAndRetry(
          cleanTopic,
          agentPhaseSignal,
          'topic_scan_search',
          'architect',
        );
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
      maxTokens: architectMaxTokens,
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
      maxTokens: 1500,
      mood: '🌟',
      voice: DEFAULT_PARALLAX_VOICES.nexus9,
    };

    const { provider: architectProvider, model: architectModel } = resolveParallaxProviderConfig(
      architectConfig,
      architectMaxTokens,
    );

    onStatusUpdate?.(`Genesis: ARCHITECT is designing the team (${architectModel})...`);

    const article = agentCount === 8 || agentCount === 18 ? 'an' : 'a';
    const architectSystemPrompt = `Today is ${todayDate}. You are ARCHITECT, the master team designer for Genesis Swarm.
Your job is to design ${article} ${agentCount}-agent research team tailored specifically to the user's topic.
Rules:
1. Create EXACTLY ${agentCount} agents with different roles covering the topic from distinct angles.
2. You MUST always include, in this order of importance: a skeptic, a practical/implementation expert, a risk expert, a numbers/data expert, then the rest (if the team is small, pick the most useful roles first; never skip the skeptic, the practical expert and the risk expert).
3. Every agent must have a unique ONE WORD UPPERCASE name (max 9 letters), a short role, one emoji, a unique bright hex color (#rrggbb readable on dark background), a specific task, a 2-3 sentence systemPrompt ("who you are and how you think"), and a specific web searchQuery (max 8 words) different from the other agents.
4. Output JSON ONLY, with no markdown fences and no extra commentary:
{"plan":"1-2 sentences about the team","agents":[{"name":"ONE WORD UPPERCASE max 9 letters","role":"short role","emoji":"one emoji","color":"#rrggbb","task":"what this agent must find/decide","systemPrompt":"2-3 sentences: who you are and how you think","searchQuery":"a short web search query (max 8 words)"}]}`;

    const architectUserPrompt = `Today is ${todayDate}.
Topic: "${cleanTopic}"
${sharedBriefText ? `\nInitial Web Scan Brief:\n${sharedBriefText}\n` : ''}
Return the JSON object with "plan" and exactly ${agentCount} "agents".`;

    const callArchitectOnce = async (attempt: number): Promise<string> => {
      const res = await withHardTimeout(
        (callSignal) =>
          api.jarvisAgentCall({
            agentId: `genesis_architect_${attempt}`,
            messages: [
              { role: 'system', content: architectSystemPrompt },
              { role: 'user', content: architectUserPrompt },
            ],
            providerConfig: architectProvider,
            temperature: 0.6,
            maxTokens: architectMaxTokens,
            timeoutMs: 45000,
            signal: callSignal,
          }),
        45000,
        agentPhaseSignal,
        { step: `architect_attempt_${attempt}`, agentId: 'architect', model: architectModel },
      );
      return (res.text || res.content || '').trim();
    };

    const archStart = Date.now();
    let archRaw = '';
    let archAttempt1Error: string | null = null;
    let archAttempt2Error: string | null = null;

    if (!eightMinLimitReached) {
      try {
        archRaw = await callArchitectOnce(1);
        if (!archRaw) {
          archAttempt1Error = 'empty response';
        }
      } catch (archErr) {
        if (signal?.aborted) return;
        archAttempt1Error = archErr instanceof Error ? archErr.message : String(archErr);
        console.warn('[Genesis] ARCHITECT attempt 1 failed:', archErr);
      }
    } else {
      archAttempt1Error = 'timeout after 45s';
    }

    const parsedArch = parseArchitectJson(archRaw);
    let validated = validateAndRepairArchitectAgents(parsedArch, cleanTopic, agentCount);
    if (!archAttempt1Error && validated.validCount === 0) {
      archAttempt1Error = 'invalid response format';
    }

    let architectFailedTwice = false;

    if (validated.validCount < agentCount && !signal?.aborted && !eightMinLimitReached) {
      console.warn(
        `[Genesis] ARCHITECT produced ${validated.validCount}/${agentCount} valid agents on attempt 1. Retrying once...`,
      );
      try {
        const retryRaw = await callArchitectOnce(2);
        if (!retryRaw) {
          archAttempt2Error = 'empty response';
        }
        const retryParsed = parseArchitectJson(retryRaw);
        const retryValidated = validateAndRepairArchitectAgents(retryParsed, cleanTopic, agentCount);
        if (!archAttempt2Error && retryValidated.validCount === 0) {
          archAttempt2Error = 'invalid response format';
        }
        if (retryValidated.validCount >= validated.validCount) {
          validated = retryValidated;
        }
        if (validated.validCount === 0 || (archAttempt1Error && archAttempt2Error)) {
          architectFailedTwice = true;
        }
      } catch (retryErr) {
        if (signal?.aborted) return;
        archAttempt2Error = retryErr instanceof Error ? retryErr.message : String(retryErr);
        if (validated.validCount === 0 || archAttempt1Error) {
          architectFailedTwice = true;
        }
        console.warn('[Genesis] ARCHITECT retry failed, using built-in fallback team:', retryErr);
      }
    } else if (validated.validCount === 0) {
      architectFailedTwice = true;
    }

    if (signal?.aborted) return;

    const blueprints = validated.output.agents;
    const archFailureShortReason = (
      archAttempt2Error ||
      archAttempt1Error ||
      'timeout after 45s'
    )
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);

    const architectPlan = architectFailedTwice
      ? `ARCHITECT could not answer in time (${archFailureShortReason}). Using a built-in team of ${agentCount} agents.`
      : validated.output.plan;

    // =========================================================================
    // STEP 3: Build agentCount ParallaxAgentConfig objects
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
        maxTokens: 1000,
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
    const architectMsgText = architectFailedTwice
      ? `${architectPlan}\n\nAssembled Team (${agentCount}): ${roleListLine}`
      : `${architectPlan}\n\nAssembled Team (${agentCount}): ${roleListLine}`;

    const genesisTeamSource: 'ai' | 'repaired' | 'fallback' =
      architectFailedTwice || validated.validCount === 0
        ? 'fallback'
        : validated.validCount === agentCount
        ? 'ai'
        : 'repaired';

    const genesisBlueprint = blueprints.map((bp, idx) => {
      const ag = genesisAgents[idx];
      const resolvedModel = ag
        ? resolveParallaxProviderConfig(ag, 1000).model || ag.modelId
        : undefined;
      return {
        name: bp.name,
        role: bp.role,
        emoji: bp.emoji,
        color: bp.color,
        task: bp.task,
        systemPrompt: bp.systemPrompt,
        searchQuery: bp.searchQuery,
        model: resolvedModel || undefined,
      };
    });

    const architectMsg: ParallaxMessage = {
      id: `plx_architect_r1_${Date.now()}`,
      agentId: 'architect',
      agentName: 'ARCHITECT',
      initials: 'AR',
      accentColor: '#a78bfa',
      round: 1,
      text: architectMsgText,
      conviction: architectFailedTwice ? 6 : 9,
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
      fallbackReason: architectFailedTwice ? archFailureShortReason : undefined,
      genesisTeamSource,
      genesisBlueprint,
    };

    allMessages.push(architectMsg);
    onMessage(architectMsg);

    if (signal?.aborted) return;

    // =========================================================================
    // STEP 5: SEARCH Step (shared scan counts inside maxSearches limit, capped at agentCount)
    // =========================================================================
    const agentSearchCount =
      maxSearches > 0 ? Math.min(agentCount, Math.max(1, maxSearches - 1)) : 0;
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
    const totalSearchesToRun = queriesToRun.length;
    let completedSearches = 0;

    if (totalSearchesToRun > 0 && !eightMinLimitReached) {
      onStatusUpdate?.(`Genesis: ARCHITECT done. Searching (0/${totalSearchesToRun})...`);
    }

    const queryResultsMap = new Map<
      string,
      { results: ParallaxToolRawResult[]; sourceLabel: string; ok: boolean }
    >();

    const SEARCH_CONCURRENCY = 3;
    for (let i = 0; i < queriesToRun.length; i += SEARCH_CONCURRENCY) {
      if (signal?.aborted) return;
      if (eightMinLimitReached) break;

      if (i > 0) {
        try {
          await abortableSleep(450, agentPhaseSignal);
        } catch {
          if (signal?.aborted) return;
          if (eightMinLimitReached) break;
        }
      }
      const batchQueries = queriesToRun.slice(i, i + SEARCH_CONCURRENCY);
      const batchResults = await Promise.all(
        batchQueries.map(async (q, bIdx) => {
          try {
            const res = await runSingleSearchWithTimeoutAndRetry(
              q,
              agentPhaseSignal,
              'agent_search',
              `search_${i + bIdx + 1}`,
            );
            if (!signal?.aborted && !eightMinLimitReached) {
              completedSearches++;
              onStatusUpdate?.(
                `Genesis: ARCHITECT done. Searching (${completedSearches}/${totalSearchesToRun})...`,
              );
            }
            return { key: q.toLowerCase().trim(), res };
          } catch {
            if (!signal?.aborted && !eightMinLimitReached) {
              completedSearches++;
              onStatusUpdate?.(
                `Genesis: ARCHITECT done. Searching (${completedSearches}/${totalSearchesToRun})...`,
              );
            }
            return {
              key: q.toLowerCase().trim(),
              res: { results: [] as ParallaxToolRawResult[], sourceLabel: 'Live Web', ok: false },
            };
          }
        }),
      );
      for (const item of batchResults) {
        if (item.res.ok && item.res.results.length > 0) {
          queryResultsMap.set(item.key, item.res);
        }
      }
    }

    // Map each of the agentCount agents to its search results (own search -> nearest successful agent search -> shared brief)
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
    // STEP 6: ANSWER Step (agentCount agents in batches of 4, streaming as each finishes)
    // =========================================================================
    let answeredCount = 0;
    onStatusUpdate?.(`Genesis: agents answering (0/${agentCount})...`);

    const executeSingleGenesisAgent = async (
      agent: ParallaxAgentConfig,
      bp: ArchitectAgentBlueprint,
      searchEntry: GenesisSearchEntry,
    ): Promise<ParallaxMessage> => {
      const turnStart = Date.now();
      const { provider, model } = resolveParallaxProviderConfig(agent, 1000);
      const searchBlock = formatSearchResultsBlock(searchEntry.results);
      const userPrompt = `${searchBlock}\n\nTopic: "${cleanTopic}"\nYour assigned task (${bp.role}): ${bp.task}`;

      let response: { text?: string; content?: string; model?: string; providerName?: string } | null = null;
      let rawText = '';
      let latestRawText = '';
      let activeModel = model;
      let activeProviderName = provider?.name || 'Built-in AI';
      let retriedOnce = false;

      const createAgentFallback = (reason: string): ParallaxMessage => {
        const shortReason = (reason || 'request failed').replace(/\s+/g, ' ').trim().slice(0, 90);
        console.warn('[Genesis] Agent failed:', {
          agentId: agent.id,
          model: activeModel || model || 'fallback',
          rawReplyPreview: (latestRawText || '').slice(0, 200),
        });
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
          model: activeModel || model || 'fallback',
          providerName: activeProviderName || provider?.name || 'Local Mesh',
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

      try {
        if (agentPhaseSignal.aborted) throw new Error('Swarm aborted');
        let initialErrorReason = '';
        try {
          response = await withHardTimeout(
            (callSignal) =>
              api.jarvisAgentCall({
                agentId: `genesis_turn_${agent.id}`,
                messages: [
                  { role: 'system', content: agent.systemInstruction },
                  { role: 'user', content: userPrompt },
                ],
                providerConfig: provider,
                temperature: 0.7,
                maxTokens: 1000,
                timeoutMs: 40000,
                signal: callSignal,
              }),
            40000,
            agentPhaseSignal,
            { step: 'agent_turn', agentId: agent.id, model },
          );
          rawText = (response.text || response.content || '').trim();
          latestRawText = rawText;
          activeModel = response.model || activeModel;
          activeProviderName = response.providerName || activeProviderName;
        } catch (err1) {
          if (agentPhaseSignal.aborted) throw err1;
          if (isTimeoutError(err1)) {
            return createAgentFallback('timeout after 40s');
          }
          if (isNetworkOrRateLimitError(err1)) {
            retriedOnce = true;
            await abortableSleep(1500, agentPhaseSignal);
            try {
              response = await withHardTimeout(
                (callSignal) =>
                  api.jarvisAgentCall({
                    agentId: `genesis_turn_${agent.id}_netretry`,
                    messages: [
                      { role: 'system', content: agent.systemInstruction },
                      { role: 'user', content: userPrompt },
                    ],
                    providerConfig: provider,
                    temperature: 0.7,
                    maxTokens: 1000,
                    timeoutMs: 40000,
                    signal: callSignal,
                  }),
                40000,
                agentPhaseSignal,
                { step: 'agent_turn_retry', agentId: agent.id, model },
              );
              rawText = (response?.text || response?.content || '').trim();
              latestRawText = rawText;
              activeModel = response?.model || activeModel;
              activeProviderName = response?.providerName || activeProviderName;
            } catch (retryErr) {
              if (agentPhaseSignal.aborted) throw retryErr;
              if (isTimeoutError(retryErr)) {
                return createAgentFallback('timeout after 40s');
              }
              initialErrorReason =
                retryErr instanceof Error ? retryErr.message : String(retryErr);
            }
          } else {
            initialErrorReason = err1 instanceof Error ? err1.message : String(err1);
          }
        }

        let parsed = parseGenesisTag(rawText, agent.mood || '💡');
        let fullText = parsed.cleanText.trim();

        // Check if non-empty answer ends like a finished sentence; if not:
        // a) if >= 60 words, cut back to last complete sentence
        // b) otherwise retry ONCE with maxTokens 1400 and cut-off prompt, then apply (a) if still unfinished
        if (fullText.length > 0 && !endsWithFinishedSentence(fullText)) {
          if (countWords(fullText) >= 60) {
            fullText = trimToLastCompleteSentence(fullText);
          } else if (!retriedOnce && !agentPhaseSignal.aborted) {
            retriedOnce = true;
            const { provider: retryProvider } = resolveParallaxProviderConfig(agent, 1400);
            const cutOffUserPrompt = `${userPrompt}\n\nYour last reply was cut off. Write 90-170 words and finish with a complete sentence.`;
            try {
              const retryRes = await withHardTimeout(
                (callSignal) =>
                  api.jarvisAgentCall({
                    agentId: `genesis_turn_${agent.id}_cutoffretry`,
                    messages: [
                      { role: 'system', content: agent.systemInstruction },
                      { role: 'user', content: cutOffUserPrompt },
                    ],
                    providerConfig: retryProvider,
                    temperature: 0.7,
                    maxTokens: 1400,
                    timeoutMs: 40000,
                    signal: callSignal,
                  }),
                40000,
                agentPhaseSignal,
                { step: 'agent_turn_cutoff_retry', agentId: agent.id, model },
              );
              const retryRaw = (retryRes.text || retryRes.content || '').trim();
              latestRawText = retryRaw;
              const retryParsed = parseGenesisTag(retryRaw, agent.mood || '💡');
              let retryClean = retryParsed.cleanText.trim();
              if (!endsWithFinishedSentence(retryClean)) {
                retryClean = trimToLastCompleteSentence(retryClean);
              }
              if (countWords(retryClean) >= 20) {
                parsed = retryParsed;
                fullText = retryClean;
                response = retryRes;
                activeModel = retryRes.model || activeModel;
                activeProviderName = retryRes.providerName || activeProviderName;
              } else {
                fullText = trimToLastCompleteSentence(fullText);
              }
            } catch (retryErr) {
              if (agentPhaseSignal.aborted) throw retryErr;
              if (countWords(fullText) >= 20) {
                fullText = trimToLastCompleteSentence(fullText);
              } else if (isTimeoutError(retryErr)) {
                return createAgentFallback('timeout after 40s');
              }
            }
          } else {
            fullText = trimToLastCompleteSentence(fullText);
          }
        }

        if (countWords(fullText) < 20 && !retriedOnce && !agentPhaseSignal.aborted) {
          retriedOnce = true;
          const { provider: retryProvider } = resolveParallaxProviderConfig(agent, 1400);
          const retryUserPrompt = `${userPrompt}\n\nYour last reply was too short. Write at least 60 words.`;
          try {
            const retryRes = await withHardTimeout(
              (callSignal) =>
                api.jarvisAgentCall({
                  agentId: `genesis_turn_${agent.id}_shortretry`,
                  messages: [
                    { role: 'system', content: agent.systemInstruction },
                    { role: 'user', content: retryUserPrompt },
                  ],
                  providerConfig: retryProvider,
                  temperature: 0.7,
                  maxTokens: 1400,
                  timeoutMs: 40000,
                  signal: callSignal,
                }),
              40000,
              agentPhaseSignal,
              { step: 'agent_turn_short_retry', agentId: agent.id, model },
            );
            const retryRaw = (retryRes.text || retryRes.content || '').trim();
            latestRawText = retryRaw;
            const retryParsed = parseGenesisTag(retryRaw, agent.mood || '💡');
            let retryClean = retryParsed.cleanText.trim();
            if (!endsWithFinishedSentence(retryClean)) {
              retryClean = trimToLastCompleteSentence(retryClean);
            }
            if (countWords(retryClean) >= 20) {
              parsed = retryParsed;
              fullText = retryClean;
              response = retryRes;
              activeModel = retryRes.model || activeModel;
              activeProviderName = retryRes.providerName || activeProviderName;
            }
          } catch (retryErr) {
            if (agentPhaseSignal.aborted) throw retryErr;
            if (isTimeoutError(retryErr)) {
              return createAgentFallback('timeout after 40s');
            }
          }
        }

        // If still empty or under 20 words after existing retry, make ONE more attempt with a DIFFERENT model from the pool
        if (countWords(fullText) < 20 && !agentPhaseSignal.aborted) {
          const pool = getModelPool();
          const currentProvId = agent.providerId || 'existing';
          const currentModId = agent.model || '';
          const altEntry =
            pool.find(
              (entry) =>
                entry.providerId !== currentProvId || entry.modelId !== currentModId,
            ) || pool[0];
          const altAgentConfig: ParallaxAgentConfig = {
            ...agent,
            providerId: altEntry.providerId,
            model: altEntry.modelId,
          };
          const { provider: altProvider, model: altModel } = resolveParallaxProviderConfig(
            altAgentConfig,
            1400,
          );
          activeModel = altModel || activeModel;
          activeProviderName = altProvider?.name || activeProviderName;

          const altUserPrompt = `${userPrompt}\n\nAnswer the task using only the search results. Write 80-150 words. If something is unverified, say so. Do not refuse; give a safe, factual summary.`;
          try {
            const altRes = await withHardTimeout(
              (callSignal) =>
                api.jarvisAgentCall({
                  agentId: `genesis_turn_${agent.id}_altmodel`,
                  messages: [
                    { role: 'system', content: agent.systemInstruction },
                    { role: 'user', content: altUserPrompt },
                  ],
                  providerConfig: altProvider,
                  temperature: 0.7,
                  maxTokens: 1400,
                  timeoutMs: 40000,
                  signal: callSignal,
                }),
              40000,
              agentPhaseSignal,
              { step: 'agent_turn_alt_model', agentId: agent.id, model: altModel },
            );
            const altRaw = (altRes.text || altRes.content || '').trim();
            latestRawText = altRaw;
            const altParsed = parseGenesisTag(altRaw, agent.mood || '💡');
            let altClean = altParsed.cleanText.trim();
            if (!endsWithFinishedSentence(altClean)) {
              altClean = trimToLastCompleteSentence(altClean);
            }
            if (countWords(altClean) >= 20) {
              parsed = altParsed;
              fullText = altClean;
              response = altRes;
              activeModel = altRes.model || altModel;
              activeProviderName = altRes.providerName || altProvider?.name || 'Built-in AI';
            } else {
              return createAgentFallback(
                initialErrorReason || 'reply under 20 words after retry',
              );
            }
          } catch (altErr) {
            if (agentPhaseSignal.aborted) throw altErr;
            if (isTimeoutError(altErr)) {
              return createAgentFallback('timeout after 40s');
            }
            return createAgentFallback(
              altErr instanceof Error ? altErr.message : String(altErr),
            );
          }
        }

        if (countWords(fullText) < 20) {
          return createAgentFallback(initialErrorReason || 'reply under 20 words');
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
          model: response?.model || activeModel || model,
          providerName: response?.providerName || activeProviderName || provider?.name || 'Built-in AI',
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
        if (agentPhaseSignal.aborted) throw err;
        if (isTimeoutError(err)) {
          return createAgentFallback('timeout after 40s');
        }
        return createAgentFallback(err instanceof Error ? err.message : String(err));
      }
    };

    const agentMessages: ParallaxMessage[] = [];
    const AGENT_BATCH_SIZE = 4;

    for (let i = 0; i < genesisAgents.length; i += AGENT_BATCH_SIZE) {
      if (signal?.aborted) return;
      if (eightMinLimitReached) break;

      const batchAgents = genesisAgents.slice(i, i + AGENT_BATCH_SIZE);
      const batchPromises = batchAgents.map(async (ag, bIdx) => {
        const idx = i + bIdx;
        try {
          const msg = await executeSingleGenesisAgent(ag, blueprints[idx], agentSearchEntries[idx]);
          if (!signal?.aborted && !eightMinLimitReached) {
            answeredCount++;
            agentMessages.push(msg);
            allMessages.push(msg);
            onMessage(msg);
            onStatusUpdate?.(`Genesis: agents answering (${answeredCount}/${agentCount})...`);
          }
          return msg;
        } catch (batchErr) {
          if (signal?.aborted || eightMinLimitReached) {
            return null;
          }
          throw batchErr;
        }
      });
      await Promise.all(batchPromises);
      if (eightMinLimitReached) break;
    }

    if (signal?.aborted) return;

    // =========================================================================
    // STEP 7: ZENITH Final Synthesis (Slot 1)
    // =========================================================================
    const { provider: zenithProvider, model: zenithModel } = resolveParallaxProviderConfig(
      zenithConfig,
      1500,
    );

    onStatusUpdate?.(`Genesis: ZENITH writing the final answer (${zenithModel})...`);

    // Collect unique sources across all searches and rank by topic keywords
    const rawUniqueSources: Array<{
      title: string;
      url: string;
      domain: string;
      snippet: string;
      origIdx: number;
    }> = [];
    const seenUrls = new Set<string>();
    const addSource = (r: ParallaxToolRawResult) => {
      const key = (r.url || r.title || '').toLowerCase().trim();
      if (!key || seenUrls.has(key)) return;
      seenUrls.add(key);
      rawUniqueSources.push({
        title: r.title || 'Source',
        url: r.url || '',
        domain: r.domain || 'web',
        snippet: r.snippet || '',
        origIdx: rawUniqueSources.length,
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

    const topicKeywords = extractTopicKeywords(cleanTopic);
    const tierRankMap: Record<'high' | 'medium' | 'low', number> = {
      high: 3,
      medium: 2,
      low: 1,
    };

    const scoredSources = rawUniqueSources
      .map((s) => {
        const haystack = `${s.title} ${s.url} ${s.snippet}`.toLowerCase();
        let score = 0;
        for (const kw of topicKeywords) {
          if (haystack.includes(kw)) {
            score++;
          }
        }
        const tier = getGenesisSourceTier(s.domain || s.url);
        return { ...s, score, tier, tierRank: tierRankMap[tier] };
      })
      .sort(
        (a, b) =>
          b.score - a.score || b.tierRank - a.tierRank || a.origIdx - b.origIdx,
      );

    const positiveScoredSources = scoredSources.filter((s) => s.score > 0);
    const baseUniqueSources =
      positiveScoredSources.length >= 3 ? positiveScoredSources : scoredSources;

    // When there are at least 6 sources, put low-tier sources last
    const uniqueSources: RankedGenesisSource[] =
      baseUniqueSources.length >= 6
        ? [
            ...baseUniqueSources.filter((s) => s.tier !== 'low'),
            ...baseUniqueSources.filter((s) => s.tier === 'low'),
          ]
        : baseUniqueSources;

    const sourcesForZenith = uniqueSources
      .map((s, idx) => {
        const shortSnippet = (s.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 110);
        return `[${idx + 1}] ${s.title} - ${s.domain} (${s.tier})${
          shortSnippet ? `: ${shortSnippet}` : ''
        }`;
      })
      .join('\n');

    const agentExcerptsForZenith = agentMessages
      .filter((m) => !m.fallbackReason)
      .map((m) => {
        const agentIdx = genesisAgents.findIndex((ag) => ag.id === m.agentId);
        const localResults =
          agentIdx !== -1 && agentSearchEntries[agentIdx]
            ? agentSearchEntries[agentIdx].results
            : [];
        const remappedText = remapAgentCitationsToGlobal(
          m.text,
          localResults,
          uniqueSources,
        );
        const excerpt = remappedText.slice(0, 450).replace(/\s*\[[^\]]*$/, '').trim();
        return `${m.agentName} (${m.role || 'Specialist'}): ${excerpt}`;
      })
      .join('\n\n');

    const failedAgentsForZenith = agentMessages
      .filter((m) => Boolean(m.fallbackReason))
      .map((m) => `${m.agentName} (${m.role || 'Specialist'})`);
    const agentsWithoutAnswerLine =
      failedAgentsForZenith.length > 0
        ? `AGENTS WITHOUT AN ANSWER: ${failedAgentsForZenith.join(', ')}`
        : 'AGENTS WITHOUT AN ANSWER: none';

    const zenithSystemPrompt = `Today is ${todayDate}. You are ZENITH, the final answer synthesizer of the Genesis Swarm.
Rules:
1. Use ONLY the facts and findings provided by the ${agentCount} agents and the verified sources below. Do NOT invent facts.
2. Cite ONLY the numbers [n] from the UNIQUE SOURCES list. Every fact in Key Facts must have a citation that supports it.
3. Do not write a Sources section; it is added automatically. For prices, dates and numbers prefer high or medium tier sources; do not rely on low-tier sources for key claims.
4. If an agent did not answer, say in the Confidence section which perspective is missing and lower the confidence by one level (High -> Medium).
5. Write MARKDOWN with this exact structure and these exact headings:
## Final Answer
(short intro: 3-6 clear sentences directly answering the topic)
## Key Facts
- bullet points with source citations like [1]
## Comparison Table
(include ONLY when there are numbers, versions, prices, options or pros/cons to compare; use a markdown table with a header row and | --- | separator, 3-6 rows, columns like Item | Detail | Source)
## Where Agents Disagree
- 1-3 bullets
## Confidence
High / Medium / Low + one short reason`;

    const zenithUserPrompt = `Today is ${todayDate}.
Topic: "${cleanTopic}"

AGENT FINDINGS:
${agentExcerptsForZenith || '(No agent findings available)'}

${agentsWithoutAnswerLine}

UNIQUE SOURCES:
${sourcesForZenith || '(No live web sources available)'}

Write the final synthesis in Markdown using the required headings: ## Final Answer, ## Key Facts, ## Comparison Table (only when applicable), ## Where Agents Disagree, ## Confidence. Do not write a Sources section; it is added automatically.`;

    const buildZenithFallbackResult = (): {
      finalText: string;
      orderedSources: RankedGenesisSource[];
    } => {
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
      const missingNote =
        failedAgentsForZenith.length > 0
          ? `Missing perspective from ${failedAgentsForZenith.join(', ')}.`
          : 'Estimated from top agents.';
      const fallbackBody = `## Final Answer\n${combined}\n\n## Key Facts\n- Synthesized from top-conviction Genesis agents.\n\n## Where Agents Disagree\n- Agents emphasized different domain trade-offs across implementation and risk.\n\n## Confidence\nMedium — ${missingNote}`;
      return renumberAndBuildZenithSources(fallbackBody, uniqueSources);
    };

    const zenithStart = Date.now();
    let zenithText = '';
    let finalOrderedSources: RankedGenesisSource[] = uniqueSources.slice(0, 5);
    let zenithFallbackReason: string | undefined;
    let zenithRespModel = zenithModel;
    let zenithRespProvider = zenithProvider?.name || 'Built-in AI';

    try {
      const zRes = await withHardTimeout(
        (callSignal) =>
          api.jarvisAgentCall({
            agentId: 'genesis_zenith_final',
            messages: [
              { role: 'system', content: zenithSystemPrompt },
              { role: 'user', content: zenithUserPrompt },
            ],
            providerConfig: zenithProvider,
            temperature: 0.4,
            maxTokens: 1500,
            timeoutMs: 50000,
            signal: callSignal,
          }),
        50000,
        signal,
        { step: 'zenith_synthesis', agentId: 'zenith', model: zenithModel },
      );
      const rawZ = (zRes.text || zRes.content || '').trim();
      if (countWords(rawZ) >= 15) {
        let bodyZ = parseGenesisTag(rawZ, '🌟').cleanText.trim();
        bodyZ = stripZenithAiSourcesSection(bodyZ);
        bodyZ = trimZenithMarkdown(bodyZ);
        const built = renumberAndBuildZenithSources(bodyZ, uniqueSources);
        zenithText = built.finalText;
        finalOrderedSources = built.orderedSources;
        zenithRespModel = zRes.model || zenithModel;
        zenithRespProvider = zRes.providerName || zenithRespProvider;
      } else {
        const fb = buildZenithFallbackResult();
        zenithText = fb.finalText;
        finalOrderedSources = fb.orderedSources;
        zenithFallbackReason = 'Estimated from top agents';
      }
    } catch (zErr) {
      if (signal?.aborted) return;
      console.warn('[Genesis] ZENITH synthesis failed, using fallback:', zErr);
      const fb = buildZenithFallbackResult();
      zenithText = fb.finalText;
      finalOrderedSources = fb.orderedSources;
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
      .replace(/^[\s\S]*?(?:##\s*Final Answer\s*|FINAL ANSWER:\s*)/i, '')
      .split(/\n\s*(?:##\s+|(?:KEY FACTS|COMPARISON TABLE|WHERE AGENTS DISAGREE|CONFIDENCE|SOURCES):)/i)[0]
      .trim();
    const verdict =
      extractFirstSentence(finalAnswerSegment || zenithText) ||
      `Genesis Swarm completed its ${agentCount}-agent investigation into "${cleanTopic}".`;

    const top4Agents = agentMessages
      .filter((m) => !m.fallbackReason)
      .sort((a, b) => (b.conviction ?? 7) - (a.conviction ?? 7))
      .slice(0, 4);

    const highlights = top4Agents.map(
      (m) => `${m.agentName}: ${extractHighlightSentence(m.text, cleanTopic)}`,
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

    const evidenceSources = finalOrderedSources.slice(0, 10).map((s) => ({
      title: s.title,
      url: s.url,
      domain: s.domain,
      tier: s.tier,
    }));

    const summary: ParallaxSummary = {
      verdict,
      highlights,
      consensusLean: 'Auto-Assembled Swarm',
      totalContributions: allMessages.length,
      groundingLevel,
      evidenceSources,
      debateMode: 'genesis',
      swarmSize: size,
    };

    storage.saveParallaxSession({
      id: `session_${Date.now()}`,
      topic: cleanTopic,
      timestamp: Date.now(),
      roundsCompleted: 1,
      messages: allMessages,
      summary,
      debateMode: 'genesis',
      swarmSize: size,
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
  } finally {
    clearTimeout(eightMinTimer);
    if (signal) {
      signal.removeEventListener('abort', onUserAbort);
    }
  }
}
