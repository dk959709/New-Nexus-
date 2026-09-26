import { api } from '@/services/api';
import type { AIProviderConfig } from '@/types';

export interface EnhanceCommanderOptions {
  idea: string;
  providerConfig?: AIProviderConfig | null;
  signal?: AbortSignal;
}

export interface EnhanceSpecialistOptions {
  idea: string;
  searchEnabled: boolean;
  providerConfig?: AIProviderConfig | null;
  signal?: AbortSignal;
}

export interface SpecialistEnhanceResult {
  role?: string;
  task?: string;
  searchQuery?: string;
}

function cleanText(raw?: string): string {
  if (!raw) return '';
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^["'“”]+|["'“”]+$/g, '').trim();
  cleaned = cleaned.replace(/^(?:Commander(?:'s)? Plan|Tactical Plan|Plan|Synthesis Directives|Directives|Focus):\s*/i, '').trim();
  return cleaned;
}

function parseSpecialistJson(raw?: string): SpecialistEnhanceResult {
  if (!raw) return {};
  const text = raw.trim();

  // Try JSON block parsing
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        role: parsed.role ? String(parsed.role).trim() : undefined,
        task: parsed.task ? String(parsed.task).trim() : undefined,
        searchQuery: parsed.searchQuery !== undefined ? String(parsed.searchQuery).trim() : undefined,
      };
    }
  } catch {
    // Continue to regex fallback
  }

  // Regex fallback
  const roleMatch = text.match(/role(?: name)?["']?\s*:\s*["']?([^"\n\r]+)/i);
  const taskMatch = text.match(/task(?: instructions)?["']?\s*:\s*["']?([^"\n\r]+)/i);
  const qMatch = text.match(/search(?:Query)?["']?\s*:\s*["']?([^"\n\r]+)/i);

  return {
    role: roleMatch ? roleMatch[1].trim().replace(/^["']|["']$/g, '') : undefined,
    task: taskMatch ? taskMatch[1].trim().replace(/^["']|["']$/g, '') : undefined,
    searchQuery: qMatch ? qMatch[1].trim().replace(/^["']|["']$/g, '') : undefined,
  };
}

/**
 * AI Enhance Call A: Commander (Strategic Plan)
 */
export async function enhanceCommanderPlan({
  idea,
  providerConfig,
  signal,
}: EnhanceCommanderOptions): Promise<string> {
  const res = await api.jarvisAgentCall({
    agentId: 'commander_plan_enhancer',
    messages: [
      {
        role: 'system',
        content:
          'You are configuring the Commander (Supreme Strategic Director) for a multi-agent investigation pipeline.\nGiven the raw idea, write a decisive, high-level tactical mission plan (1-2 clear sentences) defining the overarching goal and operational directives.\nOutput ONLY the plan text itself, with no greetings, preamble, quotes, or markdown bullets.',
      },
      {
        role: 'user',
        content: `Raw idea: "${idea}"`,
      },
    ],
    providerConfig,
    temperature: 0.3,
    maxTokens: 180,
    timeoutMs: 10000,
    signal,
  });

  if (!res.ok) {
    throw new Error(res.error || 'Failed to generate Commander plan');
  }

  const cleaned = cleanText(res.text || res.content);
  if (!cleaned) {
    throw new Error('Received empty plan from model');
  }
  return cleaned;
}

/**
 * AI Enhance Call B: Agent Alpha (Specialist 1 / Lead Investigator)
 */
export async function enhanceAlphaDirectives({
  idea,
  searchEnabled,
  providerConfig,
  signal,
}: EnhanceSpecialistOptions): Promise<SpecialistEnhanceResult> {
  const searchGuidance = searchEnabled
    ? 'Web search is ENABLED for this agent: provide a concise, factual 3-8 word search query for recent or empirical technical data.'
    : 'Web search is DISABLED for this agent: leave searchQuery empty ("").';

  const res = await api.jarvisAgentCall({
    agentId: 'alpha_specialist_enhancer',
    messages: [
      {
        role: 'system',
        content: `Given this raw idea, write a specific role name, task instructions, and ${searchEnabled ? 'a focused web search query' : 'no search query'} for Agent Alpha (Specialist 1 / Lead Investigator) who investigates and analyzes the idea from a primary/technical domain angle. ${searchGuidance}

Respond ONLY with valid JSON in this exact structure:
{
  "role": "Specific Persona Title (e.g. Lead Technical Architect)",
  "task": "Concrete primary investigation instructions (1-2 sentences).",
  "searchQuery": "${searchEnabled ? 'targeted search query' : ''}"
}`,
      },
      {
        role: 'user',
        content: `Raw idea: "${idea}"`,
      },
    ],
    providerConfig,
    temperature: 0.3,
    maxTokens: 250,
    timeoutMs: 10000,
    signal,
  });

  if (!res.ok) {
    throw new Error(res.error || 'Failed to generate Agent Alpha directives');
  }

  const parsed = parseSpecialistJson(res.text || res.content);
  if (!parsed.role && !parsed.task) {
    const raw = cleanText(res.text || res.content);
    if (raw) {
      return { task: raw };
    }
    throw new Error('Could not parse Agent Alpha response');
  }

  return parsed;
}

/**
 * AI Enhance Call C: Agent Beta (Counter-Perspective / Specialist 2)
 */
export async function enhanceBetaDirectives({
  idea,
  searchEnabled,
  providerConfig,
  signal,
}: EnhanceSpecialistOptions): Promise<SpecialistEnhanceResult> {
  const searchGuidance = searchEnabled
    ? 'Web search is ENABLED for this agent: provide a concise 3-8 word search query targeting criticisms, constraints, risks, drawbacks, or edge cases.'
    : 'Web search is DISABLED for this agent: leave searchQuery empty ("").';

  const res = await api.jarvisAgentCall({
    agentId: 'beta_specialist_enhancer',
    messages: [
      {
        role: 'system',
        content: `Given this raw idea, write a specific role name, task instructions, and ${searchEnabled ? 'a focused counter-angle web search query' : 'no search query'} for Agent Beta (Specialist 2 / Counter-Perspective & Risk Analyst) who acts as the critical counter-perspective, stress-tester, and risk auditor. This agent must take a distinct, rigorous critical angle complementing Agent Alpha's primary investigation (not a duplicate). ${searchGuidance}

Respond ONLY with valid JSON in this exact structure:
{
  "role": "Specific Counter-Perspective Role Title (e.g. Critical Failure & Risk Auditor)",
  "task": "Concrete stress-testing and constraint evaluation directives (1-2 sentences).",
  "searchQuery": "${searchEnabled ? 'targeted risk query' : ''}"
}`,
      },
      {
        role: 'user',
        content: `Raw idea: "${idea}"`,
      },
    ],
    providerConfig,
    temperature: 0.3,
    maxTokens: 250,
    timeoutMs: 10000,
    signal,
  });

  if (!res.ok) {
    throw new Error(res.error || 'Failed to generate Agent Beta directives');
  }

  const parsed = parseSpecialistJson(res.text || res.content);
  if (!parsed.role && !parsed.task) {
    const raw = cleanText(res.text || res.content);
    if (raw) {
      return { task: raw };
    }
    throw new Error('Could not parse Agent Beta response');
  }

  return parsed;
}

/**
 * AI Enhance Call D: Final Synthesizer (Synthesis Directives)
 */
export async function enhanceSynthesizerDirectives({
  idea,
  providerConfig,
  signal,
}: EnhanceCommanderOptions): Promise<string> {
  const res = await api.jarvisAgentCall({
    agentId: 'synthesizer_directives_enhancer',
    messages: [
      {
        role: 'system',
        content:
          'You are configuring the Final Synthesizer in a multi-agent system.\nGiven the raw idea, write synthesis directives / focus instructions (1-2 sentences) detailing how Agent Alpha\'s primary technical findings and Agent Beta\'s critical counter-perspectives should be reconciled, balanced, and harmonized to deliver a definitive master resolution.\nOutput ONLY the directives text itself, with no greetings, preamble, quotes, or markdown bullets.',
      },
      {
        role: 'user',
        content: `Raw idea: "${idea}"`,
      },
    ],
    providerConfig,
    temperature: 0.3,
    maxTokens: 200,
    timeoutMs: 10000,
    signal,
  });

  if (!res.ok) {
    throw new Error(res.error || 'Failed to generate synthesis directives');
  }

  const cleaned = cleanText(res.text || res.content);
  if (!cleaned) {
    throw new Error('Received empty synthesis directives from model');
  }
  return cleaned;
}
