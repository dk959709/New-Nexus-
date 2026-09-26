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
  systemPrompt?: string;
}

export interface CommanderUniversalResult {
  plan: string;
  systemPrompt?: string;
}

export interface SynthesizerUniversalResult {
  directives: string;
  systemPrompt?: string;
}

function cleanText(raw?: string): string {
  if (!raw) return '';
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^["'“”]+|["'“”]+$/g, '').trim();
  cleaned = cleaned.replace(/^(?:Commander(?:'s)? Plan|Tactical Plan|Plan|Synthesis Directives|Directives|Focus):\s*/i, '').trim();
  return cleaned;
}

function parseCommanderUniversalJson(raw?: string): CommanderUniversalResult {
  if (!raw) return { plan: '' };
  const text = raw.trim();
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        plan: cleanText(parsed.plan ? String(parsed.plan) : ''),
        systemPrompt: parsed.systemPrompt ? cleanText(String(parsed.systemPrompt)) : undefined,
      };
    }
  } catch {
    // regex fallback
  }
  const planMatch = text.match(/plan["']?\s*:\s*["']?([^"\n\r]+)/i);
  const sysMatch = text.match(/systemPrompt["']?\s*:\s*["']?([^"]+)["']?/i);
  return {
    plan: cleanText(planMatch ? planMatch[1] : text),
    systemPrompt: sysMatch ? cleanText(sysMatch[1]) : undefined,
  };
}

function parseSynthesizerUniversalJson(raw?: string): SynthesizerUniversalResult {
  if (!raw) return { directives: '' };
  const text = raw.trim();
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        directives: cleanText(parsed.directives ? String(parsed.directives) : ''),
        systemPrompt: parsed.systemPrompt ? cleanText(String(parsed.systemPrompt)) : undefined,
      };
    }
  } catch {
    // regex fallback
  }
  const dirMatch = text.match(/directives["']?\s*:\s*["']?([^"\n\r]+)/i);
  const sysMatch = text.match(/systemPrompt["']?\s*:\s*["']?([^"]+)["']?/i);
  return {
    directives: cleanText(dirMatch ? dirMatch[1] : text),
    systemPrompt: sysMatch ? cleanText(sysMatch[1]) : undefined,
  };
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
        systemPrompt: parsed.systemPrompt ? String(parsed.systemPrompt).trim() : undefined,
      };
    }
  } catch {
    // Continue to regex fallback
  }

  // Regex fallback
  const roleMatch = text.match(/role(?: name)?["']?\s*:\s*["']?([^"\n\r]+)/i);
  const taskMatch = text.match(/task(?: instructions)?["']?\s*:\s*["']?([^"\n\r]+)/i);
  const qMatch = text.match(/search(?:Query)?["']?\s*:\s*["']?([^"\n\r]+)/i);
  const sysMatch = text.match(/systemPrompt["']?\s*:\s*["']?([^"]+)["']?/i);

  return {
    role: roleMatch ? roleMatch[1].trim().replace(/^["']|["']$/g, '') : undefined,
    task: taskMatch ? taskMatch[1].trim().replace(/^["']|["']$/g, '') : undefined,
    searchQuery: qMatch ? qMatch[1].trim().replace(/^["']|["']$/g, '') : undefined,
    systemPrompt: sysMatch ? sysMatch[1].trim().replace(/^["']|["']$/g, '') : undefined,
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

/**
 * AI Enhance System Prompt: Commander (Strategic Planner)
 */
export async function enhanceCommanderSystemPrompt({
  idea,
  providerConfig,
  signal,
}: EnhanceCommanderOptions): Promise<string> {
  const res = await api.jarvisAgentCall({
    agentId: 'commander_system_prompt_enhancer',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert AI prompt engineer configuring the COMMANDER (the supreme strategic director of an elite multi-agent intelligence unit).\nGiven the user\'s idea or desired focus, generate an authoritative, rigorous system prompt (1 cohesive paragraph, ~50-80 words) for the Commander.\nThe prompt must establish the Commander\'s mandate: analyze the objective, formulate a decisive tactical mission plan, delegate complementary research vectors to Agent Alpha (lead investigator) and Agent Beta (critical validator), and enforce factual accuracy.\nOutput ONLY the enhanced system prompt text itself, with no greetings, preamble, quotes, or markdown bullets.',
      },
      {
        role: 'user',
        content: `Desired focus/idea: "${idea}"`,
      },
    ],
    providerConfig,
    temperature: 0.4,
    maxTokens: 280,
    timeoutMs: 10000,
    signal,
  });

  if (!res.ok) {
    throw new Error(res.error || 'Failed to generate Commander system prompt');
  }

  const cleaned = cleanText(res.text || res.content);
  if (!cleaned) {
    throw new Error('Received empty system prompt from model');
  }
  return cleaned;
}

/**
 * AI Enhance System Prompt: Agent Alpha (Lead Investigator)
 */
export async function enhanceAlphaSystemPrompt({
  idea,
  providerConfig,
  signal,
}: EnhanceCommanderOptions): Promise<string> {
  const res = await api.jarvisAgentCall({
    agentId: 'alpha_system_prompt_enhancer',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert AI prompt engineer configuring AGENT ALPHA (the lead investigative operative and primary domain specialist of a Commander unit).\nGiven the user\'s idea or desired focus, generate a sharp, analytical system prompt (1 cohesive paragraph, ~50-80 words) for Agent Alpha.\nThe prompt must establish Alpha\'s mandate: tackle the core empirical, technical, or factual vectors of the mission, conduct thorough analysis, extract critical data, verify claims with precision, and deliver direct unvarnished intelligence.\nOutput ONLY the enhanced system prompt text itself, with no greetings, preamble, quotes, or markdown bullets.',
      },
      {
        role: 'user',
        content: `Desired focus/idea: "${idea}"`,
      },
    ],
    providerConfig,
    temperature: 0.4,
    maxTokens: 280,
    timeoutMs: 10000,
    signal,
  });

  if (!res.ok) {
    throw new Error(res.error || 'Failed to generate Agent Alpha system prompt');
  }

  const cleaned = cleanText(res.text || res.content);
  if (!cleaned) {
    throw new Error('Received empty system prompt from model');
  }
  return cleaned;
}

/**
 * AI Enhance System Prompt: Agent Beta (Counter-Perspective / Validator)
 */
export async function enhanceBetaSystemPrompt({
  idea,
  providerConfig,
  signal,
}: EnhanceCommanderOptions): Promise<string> {
  const res = await api.jarvisAgentCall({
    agentId: 'beta_system_prompt_enhancer',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert AI prompt engineer configuring AGENT BETA (the critical validator, counter-perspective specialist, and risk analyst of a Commander unit).\nGiven the user\'s idea or desired focus, generate a sharp, rigorous system prompt (1 cohesive paragraph, ~50-80 words) for Agent Beta.\nThe prompt must establish Beta\'s mandate: stress-test hypotheses, identify edge cases, uncover alternative viewpoints or hidden trade-offs, scrutinize assumptions, and supply essential balance to Agent Alpha\'s findings.\nOutput ONLY the enhanced system prompt text itself, with no greetings, preamble, quotes, or markdown bullets.',
      },
      {
        role: 'user',
        content: `Desired focus/idea: "${idea}"`,
      },
    ],
    providerConfig,
    temperature: 0.4,
    maxTokens: 280,
    timeoutMs: 10000,
    signal,
  });

  if (!res.ok) {
    throw new Error(res.error || 'Failed to generate Agent Beta system prompt');
  }

  const cleaned = cleanText(res.text || res.content);
  if (!cleaned) {
    throw new Error('Received empty system prompt from model');
  }
  return cleaned;
}

/**
 * AI Enhance System Prompt: Final Synthesizer (Master Synthesis)
 */
export async function enhanceSynthesizerSystemPrompt({
  idea,
  providerConfig,
  signal,
}: EnhanceCommanderOptions): Promise<string> {
  const res = await api.jarvisAgentCall({
    agentId: 'synthesizer_system_prompt_enhancer',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert AI prompt engineer configuring the FINAL SYNTHESIZER presiding over the definitive intelligence resolution in a multi-agent unit.\nGiven the user\'s idea or desired focus, generate an authoritative, master-level system prompt (1 cohesive paragraph, ~50-80 words) for the Final Synthesizer.\nThe prompt must establish the Synthesizer\'s mandate: synthesize raw intelligence from Agent Alpha and critical stress-tests from Agent Beta, harmonize competing perspectives, resolve trade-offs, and deliver a comprehensive, authoritative, beautifully structured master verdict.\nOutput ONLY the enhanced system prompt text itself, with no greetings, preamble, quotes, or markdown bullets.',
      },
      {
        role: 'user',
        content: `Desired focus/idea: "${idea}"`,
      },
    ],
    providerConfig,
    temperature: 0.4,
    maxTokens: 280,
    timeoutMs: 10000,
    signal,
  });

  if (!res.ok) {
    throw new Error(res.error || 'Failed to generate Final Synthesizer system prompt');
  }

  const cleaned = cleanText(res.text || res.content);
  if (!cleaned) {
    throw new Error('Received empty system prompt from model');
  }
  return cleaned;
}

/**
 * Universal AI Enhance Call A: Commander (Plan + System Prompt)
 */
export async function enhanceUniversalCommanderPlan({
  idea,
  providerConfig,
  signal,
}: EnhanceCommanderOptions): Promise<CommanderUniversalResult> {
  const res = await api.jarvisAgentCall({
    agentId: 'commander_plan_enhancer',
    messages: [
      {
        role: 'system',
        content: `You are configuring the COMMANDER (Supreme Strategic Director) for a multi-agent investigation pipeline.
Given the raw idea, you must generate TWO fields:
1. "plan": A decisive, high-level tactical mission plan (1-2 clear sentences) defining the overarching goal and operational directives.
2. "systemPrompt": An authoritative, comprehensive system prompt (1 cohesive paragraph, ~50-80 words) establishing the Commander's persona, strategic decomposition mandate, operational delegation to Agent Alpha & Agent Beta, and high factual rigor.

Respond ONLY with valid JSON in this exact structure:
{
  "plan": "Tactical mission plan (1-2 sentences)",
  "systemPrompt": "Commander authoritative system prompt (~50-80 words)"
}`,
      },
      {
        role: 'user',
        content: `Raw idea: "${idea}"`,
      },
    ],
    providerConfig,
    temperature: 0.3,
    maxTokens: 350,
    timeoutMs: 10000,
    signal,
  });

  if (!res.ok) {
    throw new Error(res.error || 'Failed to generate Commander plan and system prompt');
  }

  const parsed = parseCommanderUniversalJson(res.text || res.content);
  if (!parsed.plan) {
    const raw = cleanText(res.text || res.content);
    if (raw) return { plan: raw };
    throw new Error('Received empty plan from model');
  }
  return parsed;
}

/**
 * Universal AI Enhance Call B: Agent Alpha (Role + Task + Query + System Prompt)
 */
export async function enhanceUniversalAlphaDirectives({
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
        content: `Given this raw idea, write a specific role name, task instructions, ${searchEnabled ? 'a focused web search query' : 'no search query'}, and a dedicated system prompt for Agent Alpha (Specialist 1 / Lead Investigator) who investigates and analyzes the idea from a primary/technical domain angle. ${searchGuidance}

Respond ONLY with valid JSON in this exact structure:
{
  "role": "Specific Persona Title (e.g. Lead Technical Architect)",
  "task": "Concrete primary investigation instructions (1-2 sentences).",
  "searchQuery": "${searchEnabled ? 'targeted search query' : ''}",
  "systemPrompt": "Specialist system prompt (1 cohesive paragraph, ~50-80 words) instructing Agent Alpha to investigate core empirical/technical vectors, extract critical data, verify claims, and provide unvarnished intelligence."
}`,
      },
      {
        role: 'user',
        content: `Raw idea: "${idea}"`,
      },
    ],
    providerConfig,
    temperature: 0.3,
    maxTokens: 400,
    timeoutMs: 10000,
    signal,
  });

  if (!res.ok) {
    throw new Error(res.error || 'Failed to generate Agent Alpha directives and system prompt');
  }

  const parsed = parseSpecialistJson(res.text || res.content);
  if (!parsed.role && !parsed.task) {
    const raw = cleanText(res.text || res.content);
    if (raw) return { task: raw };
    throw new Error('Could not parse Agent Alpha response');
  }
  return parsed;
}

/**
 * Universal AI Enhance Call C: Agent Beta (Role + Task + Query + System Prompt)
 */
export async function enhanceUniversalBetaDirectives({
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
        content: `Given this raw idea, write a specific role name, task instructions, ${searchEnabled ? 'a focused counter-angle web search query' : 'no search query'}, and a dedicated system prompt for Agent Beta (Specialist 2 / Counter-Perspective & Risk Analyst) who acts as the critical counter-perspective, stress-tester, and risk auditor. This agent must take a distinct, rigorous critical angle complementing Agent Alpha's primary investigation (not a duplicate). ${searchGuidance}

Respond ONLY with valid JSON in this exact structure:
{
  "role": "Specific Counter-Perspective Role Title (e.g. Critical Failure & Risk Auditor)",
  "task": "Concrete stress-testing and constraint evaluation directives (1-2 sentences).",
  "searchQuery": "${searchEnabled ? 'targeted risk query' : ''}",
  "systemPrompt": "Validator system prompt (1 cohesive paragraph, ~50-80 words) instructing Agent Beta to stress-test hypotheses, identify edge cases, uncover alternative viewpoints or hidden trade-offs, scrutinize assumptions, and supply essential balance."
}`,
      },
      {
        role: 'user',
        content: `Raw idea: "${idea}"`,
      },
    ],
    providerConfig,
    temperature: 0.3,
    maxTokens: 400,
    timeoutMs: 10000,
    signal,
  });

  if (!res.ok) {
    throw new Error(res.error || 'Failed to generate Agent Beta directives and system prompt');
  }

  const parsed = parseSpecialistJson(res.text || res.content);
  if (!parsed.role && !parsed.task) {
    const raw = cleanText(res.text || res.content);
    if (raw) return { task: raw };
    throw new Error('Could not parse Agent Beta response');
  }
  return parsed;
}

/**
 * Universal AI Enhance Call D: Final Synthesizer (Directives + System Prompt)
 */
export async function enhanceUniversalSynthesizerDirectives({
  idea,
  providerConfig,
  signal,
}: EnhanceCommanderOptions): Promise<SynthesizerUniversalResult> {
  const res = await api.jarvisAgentCall({
    agentId: 'synthesizer_directives_enhancer',
    messages: [
      {
        role: 'system',
        content: `You are configuring the Final Synthesizer in a multi-agent system.
Given the raw idea, you must generate TWO fields:
1. "directives": Synthesis directives / focus instructions (1-2 sentences) detailing how Agent Alpha's primary technical findings and Agent Beta's critical counter-perspectives should be reconciled, balanced, and harmonized to deliver a definitive master resolution.
2. "systemPrompt": A master-level system prompt (1 cohesive paragraph, ~50-80 words) instructing the Synthesizer presiding over the final intelligence synthesis to harmonize both perspectives into a single master resolution with trade-offs and conclusive verdicts.

Respond ONLY with valid JSON in this exact structure:
{
  "directives": "Concrete synthesis focus directives (1-2 sentences)",
  "systemPrompt": "Synthesizer master system prompt (~50-80 words)"
}`,
      },
      {
        role: 'user',
        content: `Raw idea: "${idea}"`,
      },
    ],
    providerConfig,
    temperature: 0.3,
    maxTokens: 350,
    timeoutMs: 10000,
    signal,
  });

  if (!res.ok) {
    throw new Error(res.error || 'Failed to generate synthesis directives and system prompt');
  }

  const parsed = parseSynthesizerUniversalJson(res.text || res.content);
  if (!parsed.directives) {
    const raw = cleanText(res.text || res.content);
    if (raw) return { directives: raw };
    throw new Error('Received empty synthesis directives from model');
  }
  return parsed;
}


