import { api } from '@/services/api';
import { storage } from '@/lib/storage';
import { stripTierLabels } from '@/lib/format';
import type {
  CommanderConfig,
  CommanderEffortLevel,
  CommanderExecutionStep,
  CommanderResult,
  AISource,
  AIProviderConfig,
} from '@/types';

export function getTargetProviderConfig(providerOrModelOverride?: string): AIProviderConfig | null {
  if (!providerOrModelOverride || !providerOrModelOverride.trim()) {
    return storage.getActiveAIProvider();
  }
  const override = providerOrModelOverride.trim();
  if (override === 'existing') {
    return null; // Signals built-in default provider
  }

  // Check if override matches a configured provider ID
  const allProviders = storage.getAIProvidersState().providers;
  const matchedProvider = allProviders.find((p) => p.id === override);
  if (matchedProvider) {
    return matchedProvider;
  }

  // Otherwise treat as a model name/id override on active provider or built-in
  const activeCustom = storage.getActiveAIProvider();
  if (activeCustom) {
    return {
      ...activeCustom,
      model: override,
    };
  }
  return {
    id: 'existing',
    name: 'Built-in AI',
    url: '',
    model: override,
    keyStrategy: 'failover',
    keys: [],
  };
}

/**
 * Safety net: strips 4-digit years from a search query that are NOT the current year
 * and ARE more than 1 year in the past (e.g., "2024" or "2023" when the actual year is 2026),
 * unless the user's query specifically asked about that past year.
 */
export function stripStaleYearsFromQuery(generatedQuery: string, userQuery?: string): string {
  if (!generatedQuery) return '';
  const currentYear = new Date().getFullYear();

  const cleaned = generatedQuery.replace(/\b(19\d{2}|20\d{2})\b/g, (match) => {
    const year = parseInt(match, 10);
    // If year is NOT the current year and IS more than 1 year in the past:
    if (year < currentYear - 1) {
      if (userQuery && userQuery.includes(match)) {
        return match;
      }
      return '';
    }
    return match;
  });

  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Reuses existing search pipeline (api.search with Wikipedia fallback)
 */
async function executeCommanderSearch(
  query: string,
  signal?: AbortSignal,
): Promise<{ grounding: string; sources: AISource[] }> {
  if (!query || !query.trim()) return { grounding: '', sources: [] };
  const trimmed = query.trim();
  let rawResults: Array<{
    title?: string;
    url?: string;
    description?: string;
    snippet?: string;
    content?: string;
    domain?: string;
  }> = [];

  try {
    if (signal?.aborted) throw new Error('Search aborted');
    const searchRes = await api.search(trimmed, 'ALL', 1, 8);
    if (Array.isArray(searchRes) && searchRes.length > 0) {
      rawResults = searchRes.slice(0, 8);
    } else {
      const wiki = await api.searchWikipedia(trimmed, 4);
      if (wiki && wiki.length > 0) {
        rawResults = wiki.map((w) => ({
          title: w.title,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(w.title)}`,
          description: (w.snippet || '').replace(/<[^>]*>?/gm, '').trim(),
          domain: 'wikipedia.org',
        }));
      }
    }
  } catch (err) {
    if (signal?.aborted) throw err;
    try {
      const wiki = await api.searchWikipedia(trimmed, 4);
      if (wiki && wiki.length > 0) {
        rawResults = wiki.map((w) => ({
          title: w.title,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(w.title)}`,
          description: (w.snippet || '').replace(/<[^>]*>?/gm, '').trim(),
          domain: 'wikipedia.org',
        }));
      }
    } catch {
      // Fallback empty
    }
  }

  const sources: AISource[] = rawResults.map((r) => {
    let domain = r.domain;
    if (!domain && r.url) {
      try {
        domain = new URL(r.url).hostname.replace(/^www\./, '');
      } catch {
        domain = 'web';
      }
    }
    return {
      title: r.title || 'Source',
      url: r.url || '',
      domain: domain || 'web',
      snippet: r.description || r.snippet || r.content || '',
    };
  });

  const grounding = sources
    .map((s, idx) => `[${idx + 1}] "${s.title}" (${s.domain})\n${(s.snippet || '').slice(0, 250)}`)
    .join('\n\n');

  return { grounding, sources };
}

/**
 * Formats raw retrieved search citations (title, URL, domain, snippet) into explicit grounding context
 * so the Final Synthesizer can evaluate the verified empirical evidence directly.
 */
function formatSearchEvidence(agentLabel: string, sources: AISource[]): string {
  if (!sources || sources.length === 0) return '';
  const formatted = sources
    .map(
      (s, idx) =>
        `[${agentLabel} Citation ${idx + 1}]
Source Title: ${s.title}
Domain: ${s.domain}
Source URL: ${s.url}
Evidence / Snippet:
${s.snippet}`
    )
    .join('\n\n');
  return `=== VERIFIED REAL-TIME SEARCH GROUNDING & CITATIONS FOR ${agentLabel.toUpperCase()} ===\n${formatted}`;
}

interface RunCommanderParams {
  query: string;
  config?: CommanderConfig;
  onStepUpdate?: (step: CommanderExecutionStep) => void;
  signal?: AbortSignal;
}

export async function runCommanderPipeline({
  query,
  config: incomingConfig,
  onStepUpdate,
  signal,
}: RunCommanderParams): Promise<CommanderResult> {
  const config = incomingConfig || storage.getCommanderConfig();
  const isAlphaEnabled = config.alphaEnabled !== false;
  const isBetaEnabled = config.betaEnabled !== false;
  // If BOTH Agent Alpha and Agent Beta are disabled, Final Synthesizer is automatically skipped too (Requirement 2d)
  const isSynthEnabled = (config.synthesizerEnabled !== false) && (isAlphaEnabled || isBetaEnabled);
  const bothSubAgentsDisabled = !isAlphaEnabled && !isBetaEnabled;
  const effortLevel: CommanderEffortLevel = config.effortLevel || 'medium';

  const effortInstruction =
    effortLevel === 'small'
      ? '\n\nEFFORT LEVEL DIRECTIVE (CONCISE):\nKeep your response brief and concise — short paragraphs or bullet points only, no filler, cover only the most essential points.'
      : effortLevel === 'high'
      ? '\n\nEFFORT LEVEL DIRECTIVE (DETAILED):\nProvide a thorough, detailed response covering nuances, context, and supporting detail.'
      : '';

  const commanderModel = config.modelId;
  const alphaModel = config.alphaModelId || config.manualConfig.alphaModelId;
  const betaModel = config.betaModelId || config.manualConfig.betaModelId;
  const synthModel = config.synthesizerModelId || config.manualConfig.synthesizerModelId || commanderModel;

  const commanderProvider = getTargetProviderConfig(commanderModel);
  const alphaProvider = getTargetProviderConfig(alphaModel);
  const betaProvider = getTargetProviderConfig(betaModel);
  const synthProvider = getTargetProviderConfig(synthModel);

  const steps: CommanderExecutionStep[] = [];
  const allSources: AISource[] = [];

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const updateStep = (step: CommanderExecutionStep) => {
    const existingIdx = steps.findIndex((s) => s.id === step.id);
    if (existingIdx >= 0) {
      steps[existingIdx] = step;
    } else {
      steps.push(step);
    }
    onStepUpdate?.(step);
  };

  // --------------------------------------------------------------------------
  // STEP 1: COMMANDER PLANNING & ALLOCATION (AUTO or MANUAL)
  // --------------------------------------------------------------------------
  let plan = '';
  let alphaRole =
    isAlphaEnabled && !isBetaEnabled && config.mode !== 'manual'
      ? 'Lead Domain Specialist'
      : 'Primary Domain Specialist';
  let alphaTask =
    isAlphaEnabled && !isBetaEnabled && config.mode !== 'manual'
      ? 'Conduct a comprehensive investigation of core factual evidence and practical trade-offs for this topic.'
      : 'Analyze the core mechanics and factual evidence for the query.';
  let alphaSearchEnabled = true;
  let alphaSearchQuery = query;

  let betaRole =
    !isAlphaEnabled && isBetaEnabled && config.mode !== 'manual'
      ? 'Lead Domain Specialist'
      : 'Complementary Specialist';
  let betaTask =
    !isAlphaEnabled && isBetaEnabled && config.mode !== 'manual'
      ? 'Conduct a comprehensive investigation of core factual evidence and practical trade-offs for this topic.'
      : 'Analyze the complementary perspective, practical implications, and trade-offs.';
  let betaSearchEnabled = !isAlphaEnabled && isBetaEnabled ? true : false;
  let betaSearchQuery = query;

  const planStep: CommanderExecutionStep = {
    id: 'step_commander_plan',
    agentId: 'commander',
    name: 'Commander Strategic Plan',
    role: 'Supreme Strategic Director',
    status: 'running',
    timestamp: Date.now(),
  };
  updateStep(planStep);

  if (signal?.aborted) throw new Error('Aborted');

  if (config.mode === 'manual') {
    // MANUAL MODE: Use user's exact configuration
    const m = config.manualConfig;
    plan = m.commanderPlan.trim() || 'Execute user-defined manual operational plan.';
    alphaRole = m.alphaRole.trim() || 'Lead Specialist';
    alphaTask = m.alphaTask.trim() || 'Investigate primary domain questions.';
    alphaSearchEnabled = Boolean(m.alphaSearchEnabled);
    alphaSearchQuery = m.alphaSearchQuery.trim() || query;

    betaRole = m.betaRole.trim() || 'Secondary Specialist';
    betaTask = m.betaTask.trim() || 'Evaluate counter-perspectives and risk factors.';
    betaSearchEnabled = Boolean(m.betaSearchEnabled);
    betaSearchQuery = m.betaSearchQuery.trim() || query;

    // Small delay for clean progressive feed UI
    await new Promise((r) => setTimeout(r, 450));

    planStep.status = 'completed';
    planStep.task = `Manual Plan: ${plan}`;
    if (bothSubAgentsDisabled) {
      planStep.content = plan;
    } else if (isAlphaEnabled && !isBetaEnabled) {
      planStep.content = `**Manual Directives Activated**\n- **Plan:** ${plan}\n- **Agent Alpha:** ${alphaRole} (Search: ${alphaSearchEnabled ? `"${alphaSearchQuery}"` : 'Off'})`;
    } else if (!isAlphaEnabled && isBetaEnabled) {
      planStep.content = `**Manual Directives Activated**\n- **Plan:** ${plan}\n- **Agent Beta:** ${betaRole} (Search: ${betaSearchEnabled ? `"${betaSearchQuery}"` : 'Off'})`;
    } else {
      planStep.content = `**Manual Directives Activated**\n- **Plan:** ${plan}\n- **Agent Alpha:** ${alphaRole} (Search: ${alphaSearchEnabled ? `"${alphaSearchQuery}"` : 'Off'})\n- **Agent Beta:** ${betaRole} (Search: ${betaSearchEnabled ? `"${betaSearchQuery}"` : 'Off'})`;
    }
    updateStep({ ...planStep });
  } else {
    // AUTO MODE: Commander AI receives the user query and decides roles, tasks, and search queries at runtime
    // Adjust prompt dynamically based on which subordinate agents are enabled
    const SEARCH_QUERY_DATE_RULE = `CRITICAL SEARCH QUERY RULE:
When constructing search queries for Agent Alpha or Agent Beta, always use the ACTUAL current year and month (already provided to you as today's date) — never hardcode or reuse past years like 2024 or 2025 in a query unless the user's question is specifically about that past year. For 'latest/current/recent' type queries, bias toward the current year only.`;

    const ROLE_DIVERSITY_RULE = `CRITICAL ROLE & VECTOR ALLOCATION RULE:
You must decide BOTH agents' roles fresh, specifically tailored to what this particular question actually needs — do not default to a generic 'auditor' or 'fact-checker' role for Agent Beta unless the question is genuinely about verifying a specific claim. Instead, choose whatever second distinct, complementary angle would most usefully round out the investigation for THIS topic — examples of the kind of variety to draw from (not a fixed list, just illustrating the range): a technical/implementation angle, a business/market angle, a user-experience angle, a historical/comparative angle, a regulatory/legal angle, a creative/design angle, a competitive-landscape angle, a practical/how-to angle, a risk-auditing angle (when genuinely warranted), etc. The two agents' roles should feel meaningfully different from each other AND different from what you'd assign for a completely different topic.`;

    let autoPrompt = '';
    if (bothSubAgentsDisabled) {
      autoPrompt = `Today's current date is ${currentDate}.

You are the COMMANDER AI.
User Query: "${query}"

Both subordinate agents (Agent Alpha and Agent Beta) are DISABLED for this mission. You operate as a solo strategic commander.
Directly resolve the user inquiry with a comprehensive, decisive strategic mission plan and direct answer.

Respond ONLY with valid JSON in this exact structure:
{
  "plan": "Decisive, comprehensive strategic answer and tactical plan addressing the inquiry directly."
}`;
    } else if (isAlphaEnabled && !isBetaEnabled) {
      autoPrompt = `Today's current date is ${currentDate}.

You are the COMMANDER AI.
User Query: "${query}"

${SEARCH_QUERY_DATE_RULE}

${ROLE_DIVERSITY_RULE}

Only one specialist agent is available this run. Assign it a COMBINED task covering both the primary investigation angle AND a complementary perspective or practical trade-offs that would normally be split across two agents — do not narrow its scope to just one half.

You have ONLY ONE subordinate agent available:
- Agent Alpha: Combined Specialist (handling both primary domain investigation and complementary analysis).

Decide:
1. "plan": A 1-2 sentence decisive tactical mission plan for answering this query with Agent Alpha handling both angles.
2. "alpha":
   - "role": Descriptive combined persona title tailored to this topic reflecting both primary and complementary analysis.
   - "task": Concrete combined directives covering both the primary investigation and complementary considerations (2-3 sentences).
   - "search": Boolean (true if live or up-to-date web data is helpful, false otherwise).
   - "searchQuery": Concise search query string if search is true, or empty string. <use the actual current year, not an example>

Respond ONLY with valid JSON in this exact structure:
{
  "plan": "...",
  "alpha": {
    "role": "...",
    "task": "...",
    "search": true,
    "searchQuery": "..."
  }
}`;
    } else if (!isAlphaEnabled && isBetaEnabled) {
      autoPrompt = `Today's current date is ${currentDate}.

You are the COMMANDER AI.
User Query: "${query}"

${SEARCH_QUERY_DATE_RULE}

${ROLE_DIVERSITY_RULE}

Only one specialist agent is available this run. Assign it a COMBINED task covering both the primary investigation angle AND a complementary perspective or practical trade-offs that would normally be split across two agents — do not narrow its scope to just one half.

You have ONLY ONE subordinate agent available:
- Agent Beta: Combined Specialist (handling both primary domain investigation and complementary analysis).

Decide:
1. "plan": A 1-2 sentence decisive tactical mission plan for answering this query with Agent Beta handling both angles.
2. "beta":
   - "role": Descriptive combined persona title tailored to this topic reflecting both primary and complementary analysis.
   - "task": Concrete combined directives covering both the primary investigation and complementary considerations (2-3 sentences).
   - "search": Boolean (true if live or up-to-date web data is helpful, false otherwise).
   - "searchQuery": Concise search query string if search is true, or empty string. <use the actual current year, not an example>

Respond ONLY with valid JSON in this exact structure:
{
  "plan": "...",
  "beta": {
    "role": "...",
    "task": "...",
    "search": true,
    "searchQuery": "..."
  }
}`;
    } else {
      autoPrompt = `Today's current date is ${currentDate}.

You are the COMMANDER AI.
User Query: "${query}"

${SEARCH_QUERY_DATE_RULE}

${ROLE_DIVERSITY_RULE}

Analyze this query and decompose it into two distinct, high-impact specialist vectors:
- Agent Alpha: First specialized investigation angle addressing the core dimensions of the inquiry.
- Agent Beta: Second distinct, complementary specialist angle chosen specifically to round out this topic.

Decide:
1. "plan": A 1-2 sentence decisive tactical mission plan for answering this query.
2. "alpha":
   - "role": Descriptive persona title tailored specifically to this inquiry's first vector (avoid generic templates).
   - "task": Concrete investigation directives for this first angle (1-2 sentences).
   - "search": Boolean (true if live or up-to-date web data is helpful, false otherwise).
   - "searchQuery": Concise search query string if search is true, or empty string. <use the actual current year, not an example>
3. "beta":
   - "role": Descriptive persona title tailored specifically to this inquiry's second complementary vector (distinct from Alpha, avoiding generic auditor defaults).
   - "task": Concrete investigation directives for this second angle (1-2 sentences).
   - "search": Boolean (true if supplementary search is helpful, false otherwise).
   - "searchQuery": Concise search query string if search is true, or empty string. <use the actual current year, not an example>

Respond ONLY with valid JSON in this exact structure:
{
  "plan": "...",
  "alpha": {
    "role": "...",
    "task": "...",
    "search": true,
    "searchQuery": "..."
  },
  "beta": {
    "role": "...",
    "task": "...",
    "search": false,
    "searchQuery": ""
  }
}`;
    }

    try {
      const commanderSystemPrompt = `Today's current date is ${currentDate}.

${config.systemPrompts.commander}${effortInstruction}

${SEARCH_QUERY_DATE_RULE}

${ROLE_DIVERSITY_RULE}`;

      const plannerMaxTokens = bothSubAgentsDisabled
        ? effortLevel === 'small'
          ? 400
          : effortLevel === 'high'
          ? 1800
          : 900
        : effortLevel === 'small'
        ? 300
        : effortLevel === 'high'
        ? 800
        : 500;

      const commanderRes = await api.jarvisAgentCall({
        agentId: 'commander_planner',
        messages: [
          { role: 'system', content: commanderSystemPrompt },
          { role: 'user', content: autoPrompt },
        ],
        providerConfig: commanderProvider,
        temperature: 0.3,
        maxTokens: plannerMaxTokens,
        timeoutMs: 25000,
        signal,
      });

      const raw = (commanderRes.text || commanderRes.content || '').trim();
      let parsedJson: {
        plan?: string;
        alpha?: { role?: string; task?: string; search?: boolean; searchQuery?: string };
        beta?: { role?: string; task?: string; search?: boolean; searchQuery?: string };
      } | null = null;

      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedJson = JSON.parse(jsonMatch[0]);
        }
      } catch (parseErr) {
        console.warn('[CommanderOrchestrator] Failed to parse Commander JSON response:', parseErr);
      }

      if (parsedJson) {
        plan = parsedJson.plan?.trim() || `Investigate "${query}" strategically.`;
        if (parsedJson.alpha && isAlphaEnabled) {
          alphaRole = parsedJson.alpha.role?.trim() || alphaRole;
          alphaTask = parsedJson.alpha.task?.trim() || alphaTask;
          alphaSearchEnabled = Boolean(parsedJson.alpha.search);
          const rawAlphaQuery = parsedJson.alpha.searchQuery?.trim() || query;
          const cleanedAlpha = stripStaleYearsFromQuery(rawAlphaQuery, query);
          alphaSearchQuery = cleanedAlpha.length > 0 ? cleanedAlpha : query;
        }
        if (parsedJson.beta && isBetaEnabled) {
          betaRole = parsedJson.beta.role?.trim() || betaRole;
          betaTask = parsedJson.beta.task?.trim() || betaTask;
          betaSearchEnabled = Boolean(parsedJson.beta.search);
          const rawBetaQuery = parsedJson.beta.searchQuery?.trim() || query;
          const cleanedBeta = stripStaleYearsFromQuery(rawBetaQuery, query);
          betaSearchQuery = cleanedBeta.length > 0 ? cleanedBeta : query;
        }
      } else {
        plan = `Investigate and resolve "${query}".`;
      }
    } catch (cmdErr) {
      if (signal?.aborted) throw cmdErr;
      console.warn('[CommanderOrchestrator] Commander planning fallback used:', cmdErr);
      plan = `Investigate "${query}" with strategic mission analysis.`;
    }

    planStep.status = 'completed';
    planStep.task = `Tactical Plan: ${plan}`;
    if (bothSubAgentsDisabled) {
      planStep.content = plan;
    } else if (isAlphaEnabled && !isBetaEnabled) {
      planStep.content = `**Tactical Mission Plan:** ${plan}\n\n- **Agent Alpha:** Assigned as **${alphaRole}** ${alphaSearchEnabled ? `(Search: "${alphaSearchQuery}")` : '(Internal Knowledge)'}`;
    } else if (!isAlphaEnabled && isBetaEnabled) {
      planStep.content = `**Tactical Mission Plan:** ${plan}\n\n- **Agent Beta:** Assigned as **${betaRole}** ${betaSearchEnabled ? `(Search: "${betaSearchQuery}")` : '(Internal Knowledge)'}`;
    } else {
      planStep.content = `**Tactical Mission Plan:** ${plan}\n\n- **Agent Alpha:** Assigned as **${alphaRole}** ${alphaSearchEnabled ? `(Search: "${alphaSearchQuery}")` : '(Internal Knowledge)'}\n- **Agent Beta:** Assigned as **${betaRole}** ${betaSearchEnabled ? `(Search: "${betaSearchQuery}")` : '(Internal Knowledge)'}`;
    }
    updateStep({ ...planStep });
  }

  if (signal?.aborted) throw new Error('Aborted');

  // --------------------------------------------------------------------------
  // STEP 2: AGENT ALPHA EXECUTION (Skipped if disabled)
  // --------------------------------------------------------------------------
  let alphaFindings = '';
  let alphaGrounding = '';
  let alphaSources: AISource[] = [];
  if (isAlphaEnabled) {
    const alphaStep: CommanderExecutionStep = {
      id: 'step_agent_alpha',
      agentId: 'alpha',
      name: `Agent Alpha: ${alphaRole}`,
      role: alphaRole,
      task: alphaTask,
      searchEnabled: alphaSearchEnabled,
      searchQuery: alphaSearchEnabled ? alphaSearchQuery : undefined,
      status: 'running',
      timestamp: Date.now(),
    };
    updateStep(alphaStep);

    if (alphaSearchEnabled) {
      try {
        const cleanedAlpha = stripStaleYearsFromQuery(alphaSearchQuery, query);
        if (cleanedAlpha.length > 0) {
          alphaSearchQuery = cleanedAlpha;
          alphaStep.searchQuery = cleanedAlpha;
        }
        const searchRes = await executeCommanderSearch(alphaSearchQuery, signal);
        alphaGrounding = searchRes.grounding;
        alphaSources = searchRes.sources;
        allSources.push(...alphaSources);
        alphaStep.sources = alphaSources;
        updateStep({ ...alphaStep });
      } catch (searchErr) {
        if (signal?.aborted) throw searchErr;
        console.warn('[CommanderOrchestrator] Alpha search warning:', searchErr);
      }
    }

    let alphaSystemPrompt = config.systemPrompts.alpha;
    if (config.mode !== 'manual' && isAlphaEnabled && !isBetaEnabled) {
      alphaSystemPrompt = `${config.systemPrompts.alpha}

SPECIAL COMBINED OPERATIONAL MANDATE:
Only one specialist agent is available this run. Assign it a COMBINED task covering both the primary investigation angle AND the counter-perspective/risk-auditing angle that would normally be split across two agents — do not narrow its scope to just one half.
You are operating as both the primary technical investigator and the critical counter-perspective auditor. Deliver deep technical rigor and empirical evidence while actively stress-testing assumptions, highlighting risks, caveats, counter-arguments, and trade-offs.`;
    }
    if (effortInstruction) {
      alphaSystemPrompt = `${alphaSystemPrompt}${effortInstruction}`;
    }

    const alphaUserPrompt = !isBetaEnabled && config.mode !== 'manual'
      ? `You are deployed as: ${alphaRole}
Your Assigned Combined Mission:
${alphaTask}

User Inquiry: "${query}"
Commander Mission Plan: "${plan}"
${alphaGrounding ? `\n--- VERIFIED SEARCH GROUNDING ---\n${alphaGrounding}\n` : ''}
INSTRUCTIONS:
1. Deliver a concentrated, high-density domain report directly fulfilling your combined mission.
2. Address BOTH the primary empirical investigation AND the critical counter-perspectives, trade-offs, caveats, and risk factors.
3. Provide technical clarity, specific data points, structural insights, and honest critical evaluation.
4. Be direct, authoritative, and factual.`
      : `You are deployed as: ${alphaRole}
Your Assigned Mission:
${alphaTask}

User Inquiry: "${query}"
Commander Mission Plan: "${plan}"
${alphaGrounding ? `\n--- VERIFIED SEARCH GROUNDING ---\n${alphaGrounding}\n` : ''}
INSTRUCTIONS:
1. Deliver a concentrated, high-density domain report directly fulfilling your assigned mission.
2. Provide technical clarity, specific data points, and structural insights.
3. Be direct, authoritative, and factual.`;

    const alphaMaxTokens =
      effortLevel === 'small' ? 450 : effortLevel === 'high' ? 1800 : 900;

    try {
      const alphaRes = await api.jarvisAgentCall({
        agentId: 'commander_alpha',
        messages: [
          { role: 'system', content: alphaSystemPrompt },
          { role: 'user', content: alphaUserPrompt },
        ],
        providerConfig: alphaProvider,
        temperature: 0.4,
        maxTokens: alphaMaxTokens,
        timeoutMs: 30000,
        signal,
      });

      alphaFindings = stripTierLabels(alphaRes.text || alphaRes.content || '').trim();
      alphaStep.status = 'completed';
      alphaStep.content = alphaFindings;
      updateStep({ ...alphaStep });
    } catch (alphaErr) {
      if (signal?.aborted) throw alphaErr;
      alphaStep.status = 'error';
      alphaStep.content = `Agent Alpha encountered an error: ${alphaErr instanceof Error ? alphaErr.message : 'Execution failed'}`;
      updateStep({ ...alphaStep });
      alphaFindings = 'Agent Alpha was unable to complete the investigation.';
    }

    if (signal?.aborted) throw new Error('Aborted');
  }

  // --------------------------------------------------------------------------
  // STEP 3: AGENT BETA EXECUTION (Skipped if disabled)
  // --------------------------------------------------------------------------
  let betaFindings = '';
  let betaGrounding = '';
  let betaSources: AISource[] = [];
  if (isBetaEnabled) {
    const betaStep: CommanderExecutionStep = {
      id: 'step_agent_beta',
      agentId: 'beta',
      name: `Agent Beta: ${betaRole}`,
      role: betaRole,
      task: betaTask,
      searchEnabled: betaSearchEnabled,
      searchQuery: betaSearchEnabled ? betaSearchQuery : undefined,
      status: 'running',
      timestamp: Date.now(),
    };
    updateStep(betaStep);

    if (betaSearchEnabled) {
      try {
        const cleanedBeta = stripStaleYearsFromQuery(betaSearchQuery, query);
        if (cleanedBeta.length > 0) {
          betaSearchQuery = cleanedBeta;
          betaStep.searchQuery = cleanedBeta;
        }
        const searchRes = await executeCommanderSearch(betaSearchQuery, signal);
        betaGrounding = searchRes.grounding;
        betaSources = searchRes.sources;
        allSources.push(...betaSources);
        betaStep.sources = betaSources;
        updateStep({ ...betaStep });
      } catch (searchErr) {
        if (signal?.aborted) throw searchErr;
        console.warn('[CommanderOrchestrator] Beta search warning:', searchErr);
      }
    }

    let betaSystemPrompt = config.systemPrompts.beta;
    if (config.mode !== 'manual' && !isAlphaEnabled && isBetaEnabled) {
      betaSystemPrompt = `${config.systemPrompts.beta}

SPECIAL COMBINED OPERATIONAL MANDATE:
Only one specialist agent is available this run. Assign it a COMBINED task covering both the primary investigation angle AND the counter-perspective/risk-auditing angle that would normally be split across two agents — do not narrow its scope to just one half.
You are operating as both the primary technical investigator and the critical counter-perspective auditor. Deliver deep technical rigor and empirical evidence while actively stress-testing assumptions, highlighting risks, caveats, counter-arguments, and trade-offs.`;
    }
    if (effortInstruction) {
      betaSystemPrompt = `${betaSystemPrompt}${effortInstruction}`;
    }

    const betaUserPrompt = isAlphaEnabled && alphaFindings
      ? `You are deployed as: ${betaRole}
Your Assigned Mission:
${betaTask}

User Inquiry: "${query}"
Commander Mission Plan: "${plan}"

Agent Alpha (${alphaRole}) Findings:
"""
${alphaFindings}
"""
${betaGrounding ? `\n--- VERIFIED SEARCH GROUNDING ---\n${betaGrounding}\n` : ''}
INSTRUCTIONS:
1. Stress-test Agent Alpha's findings from your specialist angle.
2. Identify overlooked caveats, edge cases, risks, counter-arguments, and practical constraints.
3. Be constructive, rigorous, and intellectually honest.`
      : !isAlphaEnabled && config.mode !== 'manual'
      ? `You are deployed as: ${betaRole}
Your Assigned Combined Mission:
${betaTask}

User Inquiry: "${query}"
Commander Mission Plan: "${plan}"
${betaGrounding ? `\n--- VERIFIED SEARCH GROUNDING ---\n${betaGrounding}\n` : ''}
INSTRUCTIONS:
1. Deliver a concentrated, high-density domain report directly fulfilling your combined mission.
2. Address BOTH the primary empirical investigation AND the critical counter-perspectives, trade-offs, risks, and constraints.
3. Provide technical clarity, specific data points, structural insights, and honest critical evaluation.
4. Be direct, authoritative, and factual.`
      : `You are deployed as: ${betaRole}
Your Assigned Mission:
${betaTask}

User Inquiry: "${query}"
Commander Mission Plan: "${plan}"
${betaGrounding ? `\n--- VERIFIED SEARCH GROUNDING ---\n${betaGrounding}\n` : ''}
INSTRUCTIONS:
1. Conduct an in-depth critical analysis and evaluation of the user inquiry from your assigned specialist perspective.
2. Identify caveats, edge cases, risks, counter-perspectives, and practical constraints.
3. Be direct, authoritative, and factual.`;

    const betaMaxTokens =
      effortLevel === 'small' ? 450 : effortLevel === 'high' ? 1800 : 900;

    try {
      const betaRes = await api.jarvisAgentCall({
        agentId: 'commander_beta',
        messages: [
          { role: 'system', content: betaSystemPrompt },
          { role: 'user', content: betaUserPrompt },
        ],
        providerConfig: betaProvider,
        temperature: 0.4,
        maxTokens: betaMaxTokens,
        timeoutMs: 30000,
        signal,
      });

      betaFindings = stripTierLabels(betaRes.text || betaRes.content || '').trim();
      betaStep.status = 'completed';
      betaStep.content = betaFindings;
      updateStep({ ...betaStep });
    } catch (betaErr) {
      if (signal?.aborted) throw betaErr;
      betaStep.status = 'error';
      betaStep.content = `Agent Beta encountered an error: ${betaErr instanceof Error ? betaErr.message : 'Execution failed'}`;
      updateStep({ ...betaStep });
      betaFindings = 'Agent Beta was unable to complete the counter-analysis.';
    }

    if (signal?.aborted) throw new Error('Aborted');
  }

  // --------------------------------------------------------------------------
  // STEP 4: FINAL SYNTHESIS (COMMANDER) (Skipped if disabled or both sub-agents disabled)
  // --------------------------------------------------------------------------
  let finalSynthesis = '';
  if (isSynthEnabled) {
    const synthStep: CommanderExecutionStep = {
      id: 'step_commander_synthesis',
      agentId: 'synthesizer',
      name: 'Commander Final Synthesis',
      role: 'Supreme Commander & Synthesizer',
      status: 'running',
      timestamp: Date.now(),
    };
    updateStep(synthStep);

    const manualSynthDirectives =
      config.mode === 'manual' && config.manualConfig.synthesizerDirectives?.trim()
        ? `\nSPECIAL USER DIRECTIVES FOR SYNTHESIS:\n${config.manualConfig.synthesizerDirectives.trim()}\n`
        : '';

    // Include the raw search results/citations Agent Alpha and Agent Beta actually retrieved
    // (URLs, source domains, snippets) as explicit grounding context
    const alphaEvidence = formatSearchEvidence(`Agent Alpha (${alphaRole})`, alphaSources);
    const betaEvidence = formatSearchEvidence(`Agent Beta (${betaRole})`, betaSources);
    const combinedLiveEvidence = [alphaEvidence, betaEvidence].filter(Boolean).join('\n\n');

    let synthPrompt = '';
    if (isAlphaEnabled && isBetaEnabled) {
      synthPrompt = `ORIGINAL USER INQUIRY: "${query}"

COMMANDER MISSION PLAN:
${plan}

AGENT ALPHA (${alphaRole}) INVESTIGATION:
"""
${alphaFindings}
"""

AGENT BETA (${betaRole}) COUNTER-ANALYSIS & VALIDATION:
"""
${betaFindings}
"""
${combinedLiveEvidence ? `\n--- VERIFIED LIVE WEB SEARCH EVIDENCE & CITATIONS ---\n${combinedLiveEvidence}\n` : ''}
${manualSynthDirectives}
DIRECTIVES FOR FINAL SYNTHESIS:
1. Harmonize Agent Alpha's core findings with Agent Beta's critical stress-tests into a master answer of the highest quality.
2. If live web search citations and empirical evidence snippets are provided above, treat them as authoritative and factual ground truth. Incorporate the empirical facts and preserve relevant source URLs/citations where valuable.
3. Deliver a clear, authoritative, beautifully structured response in clean Markdown.
4. Explicitly balance the technical facts with the real-world trade-offs, constraints, and recommendations.
5. Do not include meta system labels or internal pipeline markers. Deliver the complete, definitive answer directly for the user.`;
    } else if (isAlphaEnabled) {
      synthPrompt = `ORIGINAL USER INQUIRY: "${query}"

COMMANDER MISSION PLAN:
${plan}

AGENT ALPHA (${alphaRole}) INVESTIGATION:
"""
${alphaFindings}
"""
${alphaEvidence ? `\n--- VERIFIED LIVE WEB SEARCH EVIDENCE & CITATIONS ---\n${alphaEvidence}\n` : ''}
${manualSynthDirectives}
DIRECTIVES FOR FINAL SYNTHESIS:
1. Synthesize and elevate Agent Alpha's empirical findings into a comprehensive, authoritative master response.
2. If live web search citations and empirical evidence snippets are provided above, treat them as authoritative and factual ground truth. Incorporate the empirical facts and preserve relevant source URLs/citations where valuable.
3. Deliver a clear, beautifully structured response in clean Markdown.
4. Ensure the answer thoroughly resolves the user inquiry with actionable conclusions.
5. Do not include meta system labels or internal pipeline markers. Deliver the complete, definitive answer directly for the user.`;
    } else {
      synthPrompt = `ORIGINAL USER INQUIRY: "${query}"

COMMANDER MISSION PLAN:
${plan}

AGENT BETA (${betaRole}) INVESTIGATION & COUNTER-ANALYSIS:
"""
${betaFindings}
"""
${betaEvidence ? `\n--- VERIFIED LIVE WEB SEARCH EVIDENCE & CITATIONS ---\n${betaEvidence}\n` : ''}
${manualSynthDirectives}
DIRECTIVES FOR FINAL SYNTHESIS:
1. Synthesize and elevate Agent Beta's critical findings into a comprehensive, authoritative master response.
2. If live web search citations and empirical evidence snippets are provided above, treat them as authoritative and factual ground truth. Incorporate the empirical facts and preserve relevant source URLs/citations where valuable.
3. Deliver a clear, beautifully structured response in clean Markdown.
4. Ensure the answer thoroughly resolves the user inquiry with balanced considerations and actionable conclusions.
5. Do not include meta system labels or internal pipeline markers. Deliver the complete, definitive answer directly for the user.`;
    }

    // Add today's actual current date and the hard grounding rule to the Final Synthesizer's system prompt
    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const HARD_SYNTH_GROUNDING_RULE = `You have a training knowledge cutoff that may be outdated. If an agent's findings are backed by live web search citations (real URLs/sources shown to you), you MUST treat those citations as more current and more trustworthy than your own internal/training knowledge — especially for questions about recent releases, current events, or anything time-sensitive. Never declare something 'does not exist' or 'is unverified' solely because it contradicts your own training knowledge, when real search citations say otherwise. If you are uncertain, say so neutrally — do not confidently override cited, sourced evidence with your own memory.`;

    const baseSynthPrompt = config.systemPrompts.synthesizer || config.systemPrompts.commander;
    let finalSynthSystemPrompt = `Today's current date is ${currentDate}.

${baseSynthPrompt}

CRITICAL GROUNDING & KNOWLEDGE CUTOFF RULE:
${HARD_SYNTH_GROUNDING_RULE}`;
    if (effortInstruction) {
      finalSynthSystemPrompt = `${finalSynthSystemPrompt}${effortInstruction}`;
    }

    const synthMaxTokens =
      effortLevel === 'small' ? 900 : effortLevel === 'high' ? 3600 : 1800;

    try {
      const synthRes = await api.jarvisAgentCall({
        agentId: 'commander_synthesizer',
        messages: [
          {
            role: 'system',
            content: finalSynthSystemPrompt,
          },
          { role: 'user', content: synthPrompt },
        ],
        providerConfig: synthProvider,
        temperature: 0.35,
        maxTokens: synthMaxTokens,
        timeoutMs: 40000,
        signal,
      });

      finalSynthesis = stripTierLabels(synthRes.text || synthRes.content || '').trim();
      synthStep.status = 'completed';
      synthStep.content = finalSynthesis;
      updateStep({ ...synthStep });
    } catch (synthErr) {
      if (signal?.aborted) throw synthErr;
      synthStep.status = 'error';
      synthStep.content = `Synthesis encountered an error: ${synthErr instanceof Error ? synthErr.message : 'Synthesis failed'}`;
      updateStep({ ...synthStep });
      // Fallback: concatenate findings cleanly
      finalSynthesis = isAlphaEnabled && isBetaEnabled
        ? `### Commander Synthesis\n\n**Agent Alpha (${alphaRole}):**\n${alphaFindings}\n\n**Agent Beta (${betaRole}):**\n${betaFindings}`
        : isAlphaEnabled
        ? `### Commander Synthesis\n\n**Agent Alpha (${alphaRole}):**\n${alphaFindings}`
        : `### Commander Synthesis\n\n**Agent Beta (${betaRole}):**\n${betaFindings}`;
    }
  } else {
    // If Synthesizer is OFF:
    // - If exactly one sub-agent is enabled, its combined-scope output is shown directly as the final answer
    // - If both sub-agents are disabled, Commander's own plan is the final answer
    // - If both sub-agents are enabled, concatenate both findings cleanly
    if (bothSubAgentsDisabled) {
      finalSynthesis = plan;
    } else if (isAlphaEnabled && !isBetaEnabled) {
      finalSynthesis = alphaFindings;
    } else if (!isAlphaEnabled && isBetaEnabled) {
      finalSynthesis = betaFindings;
    } else if (isAlphaEnabled && isBetaEnabled) {
      finalSynthesis = `**Agent Alpha (${alphaRole}):**\n${alphaFindings}\n\n**Agent Beta (${betaRole}):**\n${betaFindings}`;
    }
  }

  // Deduplicate sources by URL
  const uniqueSources: AISource[] = [];
  const seenUrls = new Set<string>();
  for (const s of allSources) {
    if (s.url && !seenUrls.has(s.url)) {
      seenUrls.add(s.url);
      uniqueSources.push(s);
    }
  }

  return {
    synthesis: finalSynthesis,
    plan,
    alphaFindings,
    betaFindings,
    steps,
    sources: uniqueSources.length > 0 ? uniqueSources : undefined,
  };
}
