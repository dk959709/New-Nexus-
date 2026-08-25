import type {
  SavedItem,
  Settings,
  AIProvidersState,
  AIProviderConfig,
  KeyHealthStatus,
  JarvisSystemConfig,
  JarvisMessage,
} from '@/types';

const KEYS = {
  searches: 'nexus-searches',
  saved: 'nexus-saved',
  settings: 'nexus-settings',
  locations: 'nexus-locations',
  aiProviders: 'nexus-ai-providers',
  jarvisConfig: 'nexus-jarvis-config-v1',
  jarvisMessages: 'nexus-jarvis-messages-v1',
} as const;

export const DEFAULT_AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  planner: `You are the PLANNER agent of JARVIS, a multi-AI intelligence system.

Analyze the user's inquiry: "{query}".

Decide execution strategy:
- needsResearch: true if the query requires external factual data, current events, technical documentation, citations, or domain facts. False for simple casual greetings or trivial one-liners.
- needsFactCheck: true if claims, statistics, historical dates, or verifiable technical details need validation.
- needsReview: true for complex, multi-part, analytical, coding, architecture, design, policy, comparative, or reasoning-heavy questions that benefit from quality evaluation, nuance verification, or structural critique. Set false only for trivial greetings (e.g. "hi", "how are you") or simple single-fact lookups.
- task: a concise goal statement, under 15 words.
- plan: 2-4 short steps describing your approach, not a full essay.
- If the query is ambiguous or unclear, still produce a best-effort plan and lean toward needsResearch: true to gather clarifying context.

Output ONLY a JSON object with this exact structure:
{
  "task": "concise goal statement",
  "plan": ["step 1", "step 2"],
  "needsResearch": true,
  "needsFactCheck": true,
  "needsReview": true
}`,

  researcher: `You are the RESEARCHER agent of JARVIS.

Task: "{task}"

Live Context / Search Data:
{searchSnippets}

Instructions:
- Extract 3-7 concise, verified facts directly relevant to the task.
- Each fact must be specific (include numbers, dates, names when available) - avoid vague statements.
- Only use facts supported by the provided search data. Do not add outside knowledge or assumptions.
- If search data is empty or insufficient, return an empty facts array and note this in a "notes" field.
- List only sources actually used to support the facts above.
- Keep total output concise - this is a research summary, not a full article.

Output ONLY a valid JSON object in this exact format, no extra text:
{
  "facts": ["Concise fact 1", "Concise fact 2"],
  "sources": [{"title": "Source name", "url": "https://...", "domain": "domain.com"}],
  "notes": ""
}`,

  factChecker: `You are the FACT CHECKER agent of JARVIS.

Original Task: "{task}"

Collected Claims & Facts:
{claims}

Instructions:
- Review each claim against general knowledge and internal consistency.
- verified: list claims that are accurate and well-supported (max 5, keep each short).
- issues: list any claim that is incorrect, outdated, unsupported, exaggerated, or contradicts another claim - explain briefly why (max 5, keep each short).
- If a claim's accuracy is uncertain (not clearly true or false), note it in issues as "needs verification" rather than guessing.
- If all claims check out, return an empty issues array - do not invent problems.
- If no claims were provided, return both arrays empty.

Output ONLY a valid JSON object in this exact format, no extra text:
{
  "verified": ["Confirmed claim 1"],
  "issues": ["Identified contradiction or note 1"]
}`,

  reviewer: `You are the REVIEWER agent of JARVIS.

Task: "{task}"
Facts: {facts}
Fact Check Issues: {issues}

Instructions:
- Evaluate the collected facts for completeness, logical structure, and whether they truly answer the task.
- missing: gaps, missing context, or perspectives that would strengthen the answer (max 3, keep each short).
- issues: logical weak points, unsupported jumps, or structural problems in how the facts fit together (max 3, keep each short).
- recommendation: one clear, actionable sentence guiding how the Final Synthesizer should structure or emphasize the answer.
- If the facts already fully and clearly answer the task, return empty missing/issues arrays and a brief recommendation confirming it's ready to synthesize.
- Do not repeat facts or issues already listed - only add new observations.

Output ONLY a valid JSON object in this exact format, no extra text:
{
  "missing": ["Missing nuance or perspective"],
  "issues": ["Logical weak point"],
  "recommendation": "Key advice for final response"
}`,

  finalSynthesizer: `You are the FINAL SYNTHESIZER agent of JARVIS, a multi-agent intelligence platform.

Your task is to combine the provided research, verified claims, custom agent insights, and review notes into a clean, accurate, and definitive response for the user.

Guidelines:
- Deliver a direct, elegant, and informative answer in clean Markdown, using headers or bullet points only where they genuinely improve readability - not for every response.
- Keep the tone professional, objective, and clear. Aim for a complete but focused answer (roughly 400-550 words).
- Do NOT mention intermediate agent names, JSON formats, or internal reasoning steps.
- If Fact Checker flagged an issue with a claim, do not present that claim as settled fact - either omit it, caveat it, or note the uncertainty briefly.
- If Reviewer identified missing context or perspectives, incorporate them where relevant instead of ignoring them.
- If sources are present, cite them clearly and only cite sources actually used.
- If the available information is incomplete or uncertain, say so honestly rather than filling gaps with confident-sounding guesses.
- End with a natural conclusion - do not pad the response just to reach a target length.`,
};

export const DEFAULT_JARVIS_CONFIG: JarvisSystemConfig = {
  deepResearchDefault: false,
  customAgents: [],
  agents: {
    planner: {
      id: 'planner',
      name: 'Planner',
      role: 'Task Planning & Routing',
      description: 'Understands the task, generates a concise plan, and determines necessary agent execution steps.',
      icon: '🧭',
      providerId: 'existing',
      modelId: 'deepseek/deepseek-chat',
      enabled: true,
      maxTokens: 200,
      enableFailover: false,
      systemPrompt: DEFAULT_AGENT_SYSTEM_PROMPTS.planner,
    },
    researcher: {
      id: 'researcher',
      name: 'Researcher',
      role: 'Live Web & Wikipedia Investigation',
      description: 'Gathers verified facts, sources, and data using NEXUS search capabilities.',
      icon: '🔎',
      providerId: 'existing',
      modelId: 'deepseek/deepseek-chat',
      enabled: true,
      maxTokens: 500,
      enableFailover: false,
      systemPrompt: DEFAULT_AGENT_SYSTEM_PROMPTS.researcher,
    },
    factChecker: {
      id: 'factChecker',
      name: 'Fact Checker',
      role: 'Claims & Contradiction Verification',
      description: 'Evaluates critical claims, detects unsupported data or conflicts, and isolates corrections.',
      icon: '🛡️',
      providerId: 'existing',
      modelId: 'deepseek/deepseek-chat',
      enabled: true,
      maxTokens: 300,
      enableFailover: false,
      systemPrompt: DEFAULT_AGENT_SYSTEM_PROMPTS.factChecker,
    },
    reviewer: {
      id: 'reviewer',
      name: 'Reviewer',
      role: 'Critique & Quality Assurance',
      description: 'Analyzes logical coherence, finds missing details or weak arguments before synthesis.',
      icon: '🔬',
      providerId: 'existing',
      modelId: 'deepseek/deepseek-chat',
      enabled: true,
      maxTokens: 300,
      enableFailover: false,
      systemPrompt: DEFAULT_AGENT_SYSTEM_PROMPTS.reviewer,
    },
    finalSynthesizer: {
      id: 'finalSynthesizer',
      name: 'Final Synthesizer',
      role: 'Definitive Response Synthesis',
      description: 'Blends all findings into a clear, accurate, polished response with sources.',
      icon: '✨',
      providerId: 'existing',
      modelId: 'deepseek/deepseek-chat',
      enabled: true,
      maxTokens: 650,
      enableFailover: false,
      systemPrompt: DEFAULT_AGENT_SYSTEM_PROMPTS.finalSynthesizer,
    },
  },
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage may be full or unavailable
  }
}

export const storage = {
  getSearches(): string[] {
    return read<string[]>(KEYS.searches, []);
  },
  saveSearch(query: string): string[] {
    const existing = this.getSearches().filter((s) => s !== query);
    const updated = [query, ...existing].slice(0, 20);
    write(KEYS.searches, updated);
    return updated;
  },
  clearSearches(): void {
    write(KEYS.searches, []);
  },

  getSaved(): SavedItem[] {
    return read<SavedItem[]>(KEYS.saved, []);
  },
  saveItem(item: SavedItem): SavedItem[] {
    const existing = this.getSaved().filter((s) => s.id !== item.id);
    const updated = [item, ...existing];
    write(KEYS.saved, updated);
    return updated;
  },
  toggleSaved(item: SavedItem): SavedItem[] {
    const existing = this.getSaved();
    const found = existing.some((s) => s.id === item.id);
    const updated = found
      ? existing.filter((s) => s.id !== item.id)
      : [item, ...existing];
    write(KEYS.saved, updated);
    return updated;
  },
  removeSaved(id: string): SavedItem[] {
    const updated = this.getSaved().filter((s) => s.id !== id);
    write(KEYS.saved, updated);
    return updated;
  },
  clearSaved(): void {
    write(KEYS.saved, []);
  },

  getSettings(): Settings {
    return read<Settings>(KEYS.settings, {
      theme: 'dark',
      temperature: 'celsius',
      wind: 'kmh',
      animations: 'full',
      wallpaper: null,
      sound: true,
    });
  },
  saveSettings(settings: Settings): void {
    write(KEYS.settings, settings);
  },

  getAIProvidersState(): AIProvidersState {
    const defaultState: AIProvidersState = {
      activeProviderId: 'existing',
      providers: [],
    };
    return read<AIProvidersState>(KEYS.aiProviders, defaultState);
  },

  saveAIProvidersState(state: AIProvidersState): void {
    write(KEYS.aiProviders, state);
  },

  getActiveAIProvider(): AIProviderConfig | null {
    const state = this.getAIProvidersState();
    if (!state.activeProviderId || state.activeProviderId === 'existing') {
      return null; // Signals to use server's existing default AI configuration
    }
    return state.providers.find((p) => p.id === state.activeProviderId) || null;
  },

  updateKeyHealth(providerId: string, keyId: string, status: KeyHealthStatus, errorMsg?: string): void {
    const state = this.getAIProvidersState();
    const providerIndex = state.providers.findIndex((p) => p.id === providerId);
    if (providerIndex === -1) return;

    const provider = state.providers[providerIndex];
    const updatedKeys = provider.keys.map((k) => {
      if (k.id === keyId) {
        return {
          ...k,
          status,
          lastTested: Date.now(),
          lastError: errorMsg,
          cooldownUntil: status === 'cooldown' ? Date.now() + 60000 : undefined,
        };
      }
      return k;
    });

    state.providers[providerIndex] = { ...provider, keys: updatedKeys };
    this.saveAIProvidersState(state);
  },

  getLocations(): SavedItem[] {
    return read<SavedItem[]>(KEYS.locations, []);
  },
  saveLocation(item: SavedItem): SavedItem[] {
    const existing = this.getLocations().filter((s) => s.id !== item.id);
    const updated = [item, ...existing].slice(0, 10);
    write(KEYS.locations, updated);
    return updated;
  },
  removeLocation(id: string): SavedItem[] {
    const updated = this.getLocations().filter((s) => s.id !== id);
    write(KEYS.locations, updated);
    return updated;
  },

  getJarvisConfig(): JarvisSystemConfig {
    const stored = read<Partial<JarvisSystemConfig> | null>(KEYS.jarvisConfig, null);
    if (!stored || !stored.agents) {
      return DEFAULT_JARVIS_CONFIG;
    }
    return {
      deepResearchDefault: stored.deepResearchDefault ?? DEFAULT_JARVIS_CONFIG.deepResearchDefault,
      customAgents: Array.isArray(stored.customAgents) ? stored.customAgents : [],
      agents: {
        planner: {
          ...DEFAULT_JARVIS_CONFIG.agents.planner,
          ...(stored.agents.planner || {}),
          systemPrompt:
            !stored.agents.planner?.systemPrompt ||
            !stored.agents.planner.systemPrompt.includes('task: a concise goal statement, under 15 words.')
              ? DEFAULT_AGENT_SYSTEM_PROMPTS.planner
              : stored.agents.planner.systemPrompt,
        },
        researcher: {
          ...DEFAULT_JARVIS_CONFIG.agents.researcher,
          ...(stored.agents.researcher || {}),
          systemPrompt:
            !stored.agents.researcher?.systemPrompt ||
            stored.agents.researcher?.systemPrompt?.includes('Extract verified facts and source references.\nOutput ONLY a JSON object:')
              ? DEFAULT_AGENT_SYSTEM_PROMPTS.researcher
              : stored.agents.researcher.systemPrompt,
        },
        factChecker: {
          ...DEFAULT_JARVIS_CONFIG.agents.factChecker,
          ...(stored.agents.factChecker || {}),
          systemPrompt:
            !stored.agents.factChecker?.systemPrompt ||
            stored.agents.factChecker?.systemPrompt?.includes('Verify claims, identify discrepancies, and isolate corrections.')
              ? DEFAULT_AGENT_SYSTEM_PROMPTS.factChecker
              : stored.agents.factChecker.systemPrompt,
        },
        reviewer: {
          ...DEFAULT_JARVIS_CONFIG.agents.reviewer,
          ...(stored.agents.reviewer || {}),
          systemPrompt:
            !stored.agents.reviewer?.systemPrompt ||
            stored.agents.reviewer?.systemPrompt?.includes('Evaluate completeness and logical structure.')
              ? DEFAULT_AGENT_SYSTEM_PROMPTS.reviewer
              : stored.agents.reviewer.systemPrompt,
        },
        finalSynthesizer: {
          ...DEFAULT_JARVIS_CONFIG.agents.finalSynthesizer,
          ...(stored.agents.finalSynthesizer || {}),
          systemPrompt:
            !stored.agents.finalSynthesizer?.systemPrompt ||
            stored.agents.finalSynthesizer?.systemPrompt?.includes('Deliver a direct, elegant, and informative answer in clean Markdown.') ||
            !stored.agents.finalSynthesizer?.systemPrompt?.includes('Aim for a complete but focused answer (roughly 400-550 words).')
              ? DEFAULT_AGENT_SYSTEM_PROMPTS.finalSynthesizer
              : stored.agents.finalSynthesizer.systemPrompt,
        },
      },
    };
  },

  saveJarvisConfig(config: JarvisSystemConfig): void {
    write(KEYS.jarvisConfig, config);
  },

  getJarvisMessages(): JarvisMessage[] {
    return read<JarvisMessage[]>(KEYS.jarvisMessages, []);
  },

  saveJarvisMessages(messages: JarvisMessage[]): void {
    write(KEYS.jarvisMessages, messages.slice(-30));
  },

  clearJarvisMessages(): void {
    write(KEYS.jarvisMessages, []);
  },

  clearAll(): void {
    localStorage.removeItem(KEYS.searches);
    localStorage.removeItem(KEYS.saved);
    localStorage.removeItem(KEYS.locations);
  },
};
