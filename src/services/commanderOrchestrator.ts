import { api } from '@/services/api';
import { storage } from '@/lib/storage';
import { stripTierLabels } from '@/lib/format';
import type {
  CommanderConfig,
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
  let alphaRole = 'Lead Technical Investigator';
  let alphaTask = 'Analyze the core mechanics and factual evidence for the query.';
  let alphaSearchEnabled = true;
  let alphaSearchQuery = query;

  let betaRole = 'Counter-Perspective & Risk Analyst';
  let betaTask = 'Challenge assumptions, assess constraints, and provide alternative viewpoints.';
  let betaSearchEnabled = false;
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
    planStep.content = `**Manual Directives Activated**\n- **Plan:** ${plan}\n- **Agent Alpha:** ${alphaRole} (Search: ${alphaSearchEnabled ? `"${alphaSearchQuery}"` : 'Off'})\n- **Agent Beta:** ${betaRole} (Search: ${betaSearchEnabled ? `"${betaSearchQuery}"` : 'Off'})`;
    updateStep({ ...planStep });
  } else {
    // AUTO MODE: Commander AI receives the user query and decides roles, tasks, and search queries at runtime
    const autoPrompt = `You are the COMMANDER AI.
User Query: "${query}"

Analyze this query and decompose it for two elite subordinate agents:
- Agent Alpha: Primary technical/domain investigator.
- Agent Beta: Critical validator, counter-perspective specialist, or edge-case auditor.

Decide:
1. "plan": A 1-2 sentence decisive tactical mission plan for answering this query.
2. "alpha":
   - "role": Specific descriptive persona title (e.g. "Quantum Algorithm Specialist", "Clinical Pharmacologist", "Full-Stack System Architect").
   - "task": Concrete investigation directives (1-2 sentences).
   - "search": Boolean (true if live or up-to-date web data is helpful, false otherwise).
   - "searchQuery": Concise search query string if search is true, or empty string.
3. "beta":
   - "role": Counter-perspective or critical auditing role title (e.g. "Hardware Scalability Critic", "Toxicology & Risk Auditor", "Security Vulnerability Assessor").
   - "task": Specific stress-testing directives (1-2 sentences).
   - "search": Boolean (true if supplementary search is helpful, false otherwise).
   - "searchQuery": Concise search query string if search is true, or empty string.

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

    try {
      const commanderRes = await api.jarvisAgentCall({
        agentId: 'commander_planner',
        messages: [
          { role: 'system', content: config.systemPrompts.commander },
          { role: 'user', content: autoPrompt },
        ],
        providerConfig: commanderProvider,
        temperature: 0.3,
        maxTokens: 500,
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
        plan = parsedJson.plan?.trim() || `Investigate "${query}" with dual specialized perspectives.`;
        if (parsedJson.alpha) {
          alphaRole = parsedJson.alpha.role?.trim() || alphaRole;
          alphaTask = parsedJson.alpha.task?.trim() || alphaTask;
          alphaSearchEnabled = Boolean(parsedJson.alpha.search);
          alphaSearchQuery = parsedJson.alpha.searchQuery?.trim() || query;
        }
        if (parsedJson.beta) {
          betaRole = parsedJson.beta.role?.trim() || betaRole;
          betaTask = parsedJson.beta.task?.trim() || betaTask;
          betaSearchEnabled = Boolean(parsedJson.beta.search);
          betaSearchQuery = parsedJson.beta.searchQuery?.trim() || query;
        }
      } else {
        plan = `Investigate and validate the core aspects of "${query}".`;
      }
    } catch (cmdErr) {
      if (signal?.aborted) throw cmdErr;
      console.warn('[CommanderOrchestrator] Commander planning fallback used:', cmdErr);
      plan = `Investigate "${query}" with rigorous primary analysis and counter-validation.`;
    }

    planStep.status = 'completed';
    planStep.task = `Tactical Plan: ${plan}`;
    planStep.content = `**Tactical Mission Plan:** ${plan}\n\n- **Agent Alpha:** Assigned as **${alphaRole}** ${alphaSearchEnabled ? `(Search: "${alphaSearchQuery}")` : '(Internal Knowledge)'}\n- **Agent Beta:** Assigned as **${betaRole}** ${betaSearchEnabled ? `(Search: "${betaSearchQuery}")` : '(Internal Knowledge)'}`;
    updateStep({ ...planStep });
  }

  if (signal?.aborted) throw new Error('Aborted');

  // --------------------------------------------------------------------------
  // STEP 2: AGENT ALPHA EXECUTION
  // --------------------------------------------------------------------------
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

  let alphaGrounding = '';
  let alphaSources: AISource[] = [];
  if (alphaSearchEnabled) {
    try {
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

  let alphaFindings = '';
  const alphaUserPrompt = `You are deployed as: ${alphaRole}
Your Assigned Mission:
${alphaTask}

User Inquiry: "${query}"
Commander Mission Plan: "${plan}"
${alphaGrounding ? `\n--- VERIFIED SEARCH GROUNDING ---\n${alphaGrounding}\n` : ''}
INSTRUCTIONS:
1. Deliver a concentrated, high-density domain report directly fulfilling your assigned mission.
2. Provide technical clarity, specific data points, and structural insights.
3. Be direct, authoritative, and factual.`;

  try {
    const alphaRes = await api.jarvisAgentCall({
      agentId: 'commander_alpha',
      messages: [
        { role: 'system', content: config.systemPrompts.alpha },
        { role: 'user', content: alphaUserPrompt },
      ],
      providerConfig: alphaProvider,
      temperature: 0.4,
      maxTokens: 900,
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

  // --------------------------------------------------------------------------
  // STEP 3: AGENT BETA EXECUTION
  // --------------------------------------------------------------------------
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

  let betaGrounding = '';
  let betaSources: AISource[] = [];
  if (betaSearchEnabled) {
    try {
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

  let betaFindings = '';
  const betaUserPrompt = `You are deployed as: ${betaRole}
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
3. Be constructive, rigorous, and intellectually honest.`;

  try {
    const betaRes = await api.jarvisAgentCall({
      agentId: 'commander_beta',
      messages: [
        { role: 'system', content: config.systemPrompts.beta },
        { role: 'user', content: betaUserPrompt },
      ],
      providerConfig: betaProvider,
      temperature: 0.4,
      maxTokens: 900,
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

  // --------------------------------------------------------------------------
  // STEP 4: FINAL SYNTHESIS (COMMANDER)
  // --------------------------------------------------------------------------
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

  const synthPrompt = `ORIGINAL USER INQUIRY: "${query}"

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
${manualSynthDirectives}
DIRECTIVES FOR FINAL SYNTHESIS:
1. Harmonize Agent Alpha's core findings with Agent Beta's critical stress-tests into a master answer of the highest quality.
2. Deliver a clear, authoritative, beautifully structured response in clean Markdown.
3. Explicitly balance the technical facts with the real-world trade-offs, constraints, and recommendations.
4. Do not include meta system labels or internal pipeline markers. Deliver the complete, definitive answer directly for the user.`;

  let finalSynthesis = '';
  try {
    const synthRes = await api.jarvisAgentCall({
      agentId: 'commander_synthesizer',
      messages: [
        {
          role: 'system',
          content: config.systemPrompts.synthesizer || config.systemPrompts.commander,
        },
        { role: 'user', content: synthPrompt },
      ],
      providerConfig: synthProvider,
      temperature: 0.35,
      maxTokens: 1800,
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
    finalSynthesis = `### Commander Synthesis\n\n**Agent Alpha (${alphaRole}):**\n${alphaFindings}\n\n**Agent Beta (${betaRole}):**\n${betaFindings}`;
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
