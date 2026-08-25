import { api } from '@/services/api';
import { storage } from '@/lib/storage';
import type {
  AIProviderConfig,
  AISource,
  JarvisAgentConfig,
  JarvisAgentId,
  JarvisExecutionStep,
  JarvisSystemConfig,
} from '@/types';

export interface JarvisExecutionResult {
  answer: string;
  steps: JarvisExecutionStep[];
  sources: AISource[];
  error?: string;
}

export interface StepUpdateCallback {
  (step: JarvisExecutionStep): void;
}

function resolveProviderConfig(
  agentConfig: JarvisAgentConfig,
  isFallback = false,
): { provider: AIProviderConfig | null; model: string; error?: string } {
  const providerId = isFallback ? agentConfig.fallbackProviderId : agentConfig.providerId;
  const modelId = isFallback ? agentConfig.fallbackModelId : agentConfig.modelId;

  if (!providerId || providerId === 'existing') {
    return {
      provider: {
        id: 'existing',
        name: 'Built-in AI',
        url: '',
        model: modelId || 'deepseek/deepseek-chat',
        keyStrategy: 'failover',
        keys: [],
        capabilities: { text: true, tools: true, web: true, wikipedia: true, memory: true },
        maxTokens: agentConfig.maxTokens,
      },
      model: modelId || 'deepseek/deepseek-chat',
    };
  }

  const state = storage.getAIProvidersState();
  const matched = state.providers.find((p) => p.id === providerId);

  if (!matched) {
    return {
      provider: null,
      model: modelId || '',
      error: `Configured provider "${providerId}" not found in AI Providers settings.`,
    };
  }

  const customConfig: AIProviderConfig = {
    ...matched,
    model: modelId || matched.model,
    maxTokens: agentConfig.maxTokens,
  };

  return {
    provider: customConfig,
    model: customConfig.model,
  };
}

function safeJsonParse<T>(text: string, fallback: T): T {
  if (!text) return fallback;
  try {
    // Attempt direct parse
    return JSON.parse(text) as T;
  } catch {
    // Attempt to extract JSON from markdown code blocks or text
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1]) as T;
      } catch {
        // Continue
      }
    }
    // Attempt to find first { and last }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        // Continue
      }
    }
    return fallback;
  }
}

export async function runJarvisPipeline(
  query: string,
  config: JarvisSystemConfig,
  deepResearch = false,
  onStepUpdate?: StepUpdateCallback,
): Promise<JarvisExecutionResult> {
  const steps: JarvisExecutionStep[] = [];
  const sourcesCollected: AISource[] = [];

  const updateStep = (step: JarvisExecutionStep) => {
    const existingIdx = steps.findIndex((s) => s.agentId === step.agentId);
    if (existingIdx >= 0) {
      steps[existingIdx] = step;
    } else {
      steps.push(step);
    }
    onStepUpdate?.(step);
  };

  const agentConfigs = config.agents;

  // Initialize step statuses
  const agentOrder: JarvisAgentId[] = [
    'planner',
    'researcher',
    'factChecker',
    'reviewer',
    'finalSynthesizer',
  ];

  agentOrder.forEach((agentId) => {
    const cfg = agentConfigs[agentId];
    const provInfo = resolveProviderConfig(cfg);
    steps.push({
      agentId,
      name: cfg.name,
      icon: cfg.icon,
      status: cfg.enabled ? 'pending' : 'skipped',
      providerName: provInfo.provider?.name || 'Unconfigured',
      model: provInfo.model || cfg.modelId,
    });
  });

  // Helper to execute single agent
  const callAgent = async (
    agentId: JarvisAgentId,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  ): Promise<{
    ok: boolean;
    text: string;
    error?: string;
    providerName: string;
    model: string;
    usedFallback?: boolean;
  }> => {
    const cfg = agentConfigs[agentId];
    if (!cfg.enabled) {
      return { ok: false, text: '', error: 'Agent disabled in configuration', providerName: '', model: '' };
    }

    const primary = resolveProviderConfig(cfg, false);
    if (primary.error) {
      return {
        ok: false,
        text: '',
        error: `❌ ${cfg.name} provider unavailable: ${primary.error}`,
        providerName: cfg.providerId,
        model: cfg.modelId,
      };
    }

    let fallbackConfig: AIProviderConfig | null = null;
    if (cfg.enableFailover && cfg.fallbackProviderId) {
      const fb = resolveProviderConfig(cfg, true);
      if (!fb.error && fb.provider) {
        fallbackConfig = fb.provider;
      }
    }

    const res = await api.jarvisAgentCall({
      agentId,
      messages,
      providerConfig: primary.provider,
      fallbackConfig,
      enableFailover: cfg.enableFailover,
      temperature: 0.2,
      maxTokens: cfg.maxTokens,
    });

    return {
      ok: res.ok,
      text: res.text || '',
      error: res.error,
      providerName: res.providerName || primary.provider?.name || 'Configured AI',
      model: res.model || primary.model,
      usedFallback: res.usedFallback,
    };
  };

  // ==========================================
  // STEP 1: 🧭 PLANNER
  // ==========================================
  let plannerOutput = {
    task: query,
    plan: ['Synthesize accurate response directly.'],
    needsResearch: false,
    needsFactCheck: false,
    needsReview: false,
  };

  if (agentConfigs.planner.enabled) {
    const pCfg = agentConfigs.planner;
    const provInfo = resolveProviderConfig(pCfg);
    const start = Date.now();

    updateStep({
      agentId: 'planner',
      name: pCfg.name,
      icon: pCfg.icon,
      status: 'running',
      providerName: provInfo.provider?.name || 'Primary',
      model: provInfo.model,
    });

    const plannerPrompt = `You are the PLANNER agent of JARVIS, a 5-agent multi-AI intelligence system.
Analyze the user's inquiry: "${query}".
Decide execution strategy:
- needsResearch: true if the query requires external factual data, news, historical background, documentation, or entity info. False for basic greetings, logical puzzles, code snippets, or generic queries.
- needsFactCheck: true if claims, statistics, or dates require validation.
- needsReview: true if complex reasoning, critique, or multi-faceted analysis is needed.

Output ONLY a JSON object with this exact structure:
{
  "task": "concise goal statement",
  "plan": ["step 1", "step 2"],
  "needsResearch": true,
  "needsFactCheck": true,
  "needsReview": false
}`;

    const planRes = await callAgent('planner', [
      { role: 'system', content: 'You are the JARVIS Planner. Output only valid JSON.' },
      { role: 'user', content: plannerPrompt },
    ]);

    const duration = Date.now() - start;

    if (planRes.ok) {
      plannerOutput = safeJsonParse(planRes.text, plannerOutput);
      updateStep({
        agentId: 'planner',
        name: pCfg.name,
        icon: pCfg.icon,
        status: 'completed',
        providerName: planRes.providerName,
        model: planRes.model,
        durationMs: duration,
        summary: plannerOutput.plan?.slice(0, 2).join(' • ') || 'Task analyzed and routed.',
        outputPreview: JSON.stringify(plannerOutput, null, 2),
        usedFallback: planRes.usedFallback,
      });
    } else {
      updateStep({
        agentId: 'planner',
        name: pCfg.name,
        icon: pCfg.icon,
        status: 'failed',
        providerName: planRes.providerName,
        model: planRes.model,
        durationMs: duration,
        error: planRes.error || 'Planner execution failed.',
      });
    }
  }

  // Determine which downstream agents are required
  const shouldResearch =
    agentConfigs.researcher.enabled &&
    (deepResearch || plannerOutput.needsResearch || query.length > 30);

  const shouldFactCheck =
    agentConfigs.factChecker.enabled &&
    (deepResearch || (shouldResearch && plannerOutput.needsFactCheck));

  const shouldReview =
    agentConfigs.reviewer.enabled &&
    (deepResearch || plannerOutput.needsReview);

  // ==========================================
  // STEP 2: 🔎 RESEARCHER
  // ==========================================
  let researcherOutput = {
    facts: [] as string[],
    sources: [] as Array<{ title: string; url: string; domain?: string }>,
  };

  if (shouldResearch) {
    const rCfg = agentConfigs.researcher;
    const provInfo = resolveProviderConfig(rCfg);
    const start = Date.now();

    updateStep({
      agentId: 'researcher',
      name: rCfg.name,
      icon: rCfg.icon,
      status: 'running',
      providerName: provInfo.provider?.name || 'Primary',
      model: provInfo.model,
    });

    // Reuse existing NEXUS search tools (Wikipedia + Web Search)
    let searchSnippets = '';
    try {
      const [wikiResults, searchResults] = await Promise.all([
        api.searchWikipedia(query, 3).catch(() => []),
        api.search(query).catch(() => []),
      ]);

      const gatheredSnippets: string[] = [];

      wikiResults.slice(0, 2).forEach((w) => {
        gatheredSnippets.push(`[Wikipedia: ${w.title}] ${w.snippet.replace(/<[^>]+>/g, '')}`);
        sourcesCollected.push({
          title: w.title,
          url: w.url,
          domain: 'wikipedia.org',
          description: w.snippet.replace(/<[^>]+>/g, ''),
          type: 'wikipedia',
        });
      });

      searchResults.slice(0, 4).forEach((s) => {
        gatheredSnippets.push(`[${s.domain || 'Web'}: ${s.title}] ${s.description}`);
        sourcesCollected.push({
          title: s.title,
          url: s.url,
          domain: s.domain,
          description: s.description,
          type: 'web',
        });
      });

      searchSnippets = gatheredSnippets.slice(0, 5).join('\n\n');
    } catch {
      // Search failed gracefully
    }

    const researchPrompt = `You are the RESEARCHER agent of JARVIS.
Task: "${plannerOutput.task || query}"
Live Context / Search Data:
${searchSnippets || 'No external snippets available. Rely on internal high-confidence knowledge.'}

Extract verified facts and source references.
Output ONLY a JSON object:
{
  "facts": ["Concise fact 1", "Concise fact 2"],
  "sources": [{"title": "Source name", "url": "https://...", "domain": "domain.com"}]
}`;

    const researchRes = await callAgent('researcher', [
      { role: 'system', content: 'You are the JARVIS Researcher. Output strictly valid JSON with facts and sources.' },
      { role: 'user', content: researchPrompt },
    ]);

    const duration = Date.now() - start;

    if (researchRes.ok) {
      researcherOutput = safeJsonParse(researchRes.text, researcherOutput);
      // Merge any new sources
      if (Array.isArray(researcherOutput.sources)) {
        researcherOutput.sources.forEach((s) => {
          if (s.title && s.url && !sourcesCollected.some((existing) => existing.url === s.url)) {
            sourcesCollected.push({
              title: s.title,
              url: s.url,
              domain: s.domain,
              type: 'web',
            });
          }
        });
      }

      updateStep({
        agentId: 'researcher',
        name: rCfg.name,
        icon: rCfg.icon,
        status: 'completed',
        providerName: researchRes.providerName,
        model: researchRes.model,
        durationMs: duration,
        summary: `Gathered ${researcherOutput.facts?.length || 0} core facts and ${sourcesCollected.length} references.`,
        outputPreview: JSON.stringify(researcherOutput, null, 2),
        usedFallback: researchRes.usedFallback,
      });
    } else {
      updateStep({
        agentId: 'researcher',
        name: rCfg.name,
        icon: rCfg.icon,
        status: 'failed',
        providerName: researchRes.providerName,
        model: researchRes.model,
        durationMs: duration,
        error: researchRes.error || 'Researcher failed.',
      });
    }
  } else {
    updateStep({
      agentId: 'researcher',
      name: agentConfigs.researcher.name,
      icon: agentConfigs.researcher.icon,
      status: 'skipped',
      providerName: agentConfigs.researcher.providerId,
      model: agentConfigs.researcher.modelId,
      summary: 'Research skipped based on task profile.',
    });
  }

  // ==========================================
  // STEP 3: 🛡️ FACT CHECKER
  // ==========================================
  let factCheckOutput = {
    verified: [] as string[],
    issues: [] as string[],
  };

  if (shouldFactCheck) {
    const fCfg = agentConfigs.factChecker;
    const provInfo = resolveProviderConfig(fCfg);
    const start = Date.now();

    updateStep({
      agentId: 'factChecker',
      name: fCfg.name,
      icon: fCfg.icon,
      status: 'running',
      providerName: provInfo.provider?.name || 'Primary',
      model: provInfo.model,
    });

    const factCheckPrompt = `You are the FACT CHECKER agent of JARVIS.
Original Task: "${plannerOutput.task || query}"
Collected Claims & Facts:
${researcherOutput.facts.length > 0 ? researcherOutput.facts.map((f, i) => `${i + 1}. ${f}`).join('\n') : 'Evaluate general knowledge truthfulness for: ' + query}

Verify claims, identify discrepancies, and isolate corrections.
Output ONLY a JSON object:
{
  "verified": ["Confirmed claim 1"],
  "issues": ["Identified contradiction or note 1"]
}`;

    const factRes = await callAgent('factChecker', [
      { role: 'system', content: 'You are the JARVIS Fact Checker. Output strictly valid JSON.' },
      { role: 'user', content: factCheckPrompt },
    ]);

    const duration = Date.now() - start;

    if (factRes.ok) {
      factCheckOutput = safeJsonParse(factRes.text, factCheckOutput);
      updateStep({
        agentId: 'factChecker',
        name: fCfg.name,
        icon: fCfg.icon,
        status: 'completed',
        providerName: factRes.providerName,
        model: factRes.model,
        durationMs: duration,
        summary: `Validated ${factCheckOutput.verified?.length || 0} claims (${factCheckOutput.issues?.length || 0} corrections).`,
        outputPreview: JSON.stringify(factCheckOutput, null, 2),
        usedFallback: factRes.usedFallback,
      });
    } else {
      updateStep({
        agentId: 'factChecker',
        name: fCfg.name,
        icon: fCfg.icon,
        status: 'failed',
        providerName: factRes.providerName,
        model: factRes.model,
        durationMs: duration,
        error: factRes.error || 'Fact Checker failed.',
      });
    }
  } else {
    updateStep({
      agentId: 'factChecker',
      name: agentConfigs.factChecker.name,
      icon: agentConfigs.factChecker.icon,
      status: 'skipped',
      providerName: agentConfigs.factChecker.providerId,
      model: agentConfigs.factChecker.modelId,
      summary: 'Fact checking not required for this query.',
    });
  }

  // ==========================================
  // STEP 4: 🔬 REVIEWER
  // ==========================================
  let reviewerOutput = {
    missing: [] as string[],
    issues: [] as string[],
    recommendation: 'Present concise, well-structured synthesis.',
  };

  if (shouldReview) {
    const revCfg = agentConfigs.reviewer;
    const provInfo = resolveProviderConfig(revCfg);
    const start = Date.now();

    updateStep({
      agentId: 'reviewer',
      name: revCfg.name,
      icon: revCfg.icon,
      status: 'running',
      providerName: provInfo.provider?.name || 'Primary',
      model: provInfo.model,
    });

    const reviewerPrompt = `You are the REVIEWER agent of JARVIS.
Task: "${plannerOutput.task || query}"
Facts: ${JSON.stringify(researcherOutput.facts.slice(0, 5))}
Fact Check Issues: ${JSON.stringify(factCheckOutput.issues)}

Evaluate completeness and logical structure.
Output ONLY a JSON object:
{
  "missing": ["Missing nuance or perspective"],
  "issues": ["Logical weak point"],
  "recommendation": "Key advice for final response"
}`;

    const reviewRes = await callAgent('reviewer', [
      { role: 'system', content: 'You are the JARVIS Reviewer. Output strictly valid JSON.' },
      { role: 'user', content: reviewerPrompt },
    ]);

    const duration = Date.now() - start;

    if (reviewRes.ok) {
      reviewerOutput = safeJsonParse(reviewRes.text, reviewerOutput);
      updateStep({
        agentId: 'reviewer',
        name: revCfg.name,
        icon: revCfg.icon,
        status: 'completed',
        providerName: reviewRes.providerName,
        model: reviewRes.model,
        durationMs: duration,
        summary: reviewerOutput.recommendation || 'Quality review complete.',
        outputPreview: JSON.stringify(reviewerOutput, null, 2),
        usedFallback: reviewRes.usedFallback,
      });
    } else {
      updateStep({
        agentId: 'reviewer',
        name: revCfg.name,
        icon: revCfg.icon,
        status: 'failed',
        providerName: reviewRes.providerName,
        model: reviewRes.model,
        durationMs: duration,
        error: reviewRes.error || 'Reviewer failed.',
      });
    }
  } else {
    updateStep({
      agentId: 'reviewer',
      name: agentConfigs.reviewer.name,
      icon: agentConfigs.reviewer.icon,
      status: 'skipped',
      providerName: agentConfigs.reviewer.providerId,
      model: agentConfigs.reviewer.modelId,
      summary: 'Deep critique review bypassed for speed.',
    });
  }

  // ==========================================
  // STEP 5: ✨ FINAL SYNTHESIZER
  // ==========================================
  let finalAnswer = '';

  if (agentConfigs.finalSynthesizer.enabled) {
    const sCfg = agentConfigs.finalSynthesizer;
    const provInfo = resolveProviderConfig(sCfg);
    const start = Date.now();

    updateStep({
      agentId: 'finalSynthesizer',
      name: sCfg.name,
      icon: sCfg.icon,
      status: 'running',
      providerName: provInfo.provider?.name || 'Primary',
      model: provInfo.model,
    });

    const synthesizerContext = `User Query: "${query}"

Planner Guidance: ${plannerOutput.plan.join(' ')}
${researcherOutput.facts.length > 0 ? `Key Verified Facts:\n${researcherOutput.facts.map((f) => `- ${f}`).join('\n')}` : ''}
${factCheckOutput.verified.length > 0 ? `Verified Claims:\n${factCheckOutput.verified.map((c) => `- ${c}`).join('\n')}` : ''}
${factCheckOutput.issues.length > 0 ? `Important Caveats/Corrections:\n${factCheckOutput.issues.map((i) => `- ${i}`).join('\n')}` : ''}
${reviewerOutput.recommendation ? `Reviewer Advice: ${reviewerOutput.recommendation}` : ''}`;

    const synthRes = await callAgent('finalSynthesizer', [
      {
        role: 'system',
        content: `You are the FINAL SYNTHESIZER agent of JARVIS, a multi-agent intelligence platform.
Your task is to combine the provided research, verified claims, and review notes into a clean, accurate, and definitive response for the user.
Guidelines:
- Deliver a direct, elegant, and informative answer in clean Markdown.
- Keep the tone professional, objective, and clear.
- Do NOT mention intermediate agent names, JSON formats, or internal reasoning steps.
- If relevant sources are present, cite them clearly.`,
      },
      {
        role: 'user',
        content: `Please synthesize the definitive answer based on the following verified intelligence:\n\n${synthesizerContext}`,
      },
    ]);

    const duration = Date.now() - start;

    if (synthRes.ok && synthRes.text) {
      finalAnswer = synthRes.text;
      updateStep({
        agentId: 'finalSynthesizer',
        name: sCfg.name,
        icon: sCfg.icon,
        status: 'completed',
        providerName: synthRes.providerName,
        model: synthRes.model,
        durationMs: duration,
        summary: 'Final synthesis compiled and formatted.',
        outputPreview: finalAnswer.slice(0, 150) + (finalAnswer.length > 150 ? '...' : ''),
        usedFallback: synthRes.usedFallback,
      });
    } else {
      updateStep({
        agentId: 'finalSynthesizer',
        name: sCfg.name,
        icon: sCfg.icon,
        status: 'failed',
        providerName: synthRes.providerName,
        model: synthRes.model,
        durationMs: duration,
        error: synthRes.error || 'Final Synthesizer failed.',
      });
      finalAnswer =
        researcherOutput.facts.length > 0
          ? `### Summary Findings\n\n${researcherOutput.facts.map((f) => `- ${f}`).join('\n')}`
          : "Sorry, I couldn't generate a complete response right now.";
    }
  }

  return {
    answer: finalAnswer,
    steps,
    sources: sourcesCollected,
  };
}
