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
  edgeVoice: 'nexus-edge-voice-v1',
} as const;

export const DEFAULT_AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  planner: `You are the PLANNER agent of JARVIS, a multi-AI intelligence system.
Analyze the user's inquiry: "{query}".
Decide execution strategy:
- needsResearch: true if the query requires external factual data, current events, technical documentation, citations, or domain facts. Set false for casual greetings, opinions, or self-referential questions about JARVIS itself.
- needsFactCheck: true if claims, statistics, historical dates, or verifiable technical details need validation. Set false if needsResearch is false.
- needsReview: true for complex, multi-part, analytical, coding, architecture, design, policy, comparative, or reasoning-heavy questions that benefit from quality evaluation, nuance verification, or structural critique. Set false only for trivial greetings (e.g. "hi", "how are you"), self-referential questions, or simple single-fact lookups.
- needsDiagram: true whenever Diagram Mode is enabled AND the query involves technical systems, hardware/device architecture, system workflows, comparisons (e.g. phone/hardware specs, camera sensor mechanisms, software architecture), processes, or concepts that benefit from a visual blueprint. Set false only if Diagram Mode is off or query has no structure.
- needsChart: true whenever Chart Mode is enabled AND the query involves comparative numbers, specs, battery mAh, RAM, storage, camera megapixels, prices, dimensions, statistics, timelines, or quantitative metrics across products, categories, or items. Set false only if Chart Mode is off or query has no numbers.
- needsImage: true whenever Image Mode is enabled AND the query mentions physical products (e.g. smartphones, laptops, cars, hardware), real-world objects, places, landmarks, animals, space imagery, or tangible subjects. Set false only if Image Mode is off or topic is purely abstract.
- needsWikipedia: Set needsWikipedia to true ONLY if the query is asking for a general definition, explanation of a concept, historical background, or information about a specific person/place/thing/event (e.g. 'what is a black hole', 'who was Einstein', 'history of NASA', 'define photosynthesis'). Set needsWikipedia to false if the query is asking for real-time or live data that changes constantly and Wikipedia would not have (e.g. current time, current weather, today's date, live prices, breaking news, current status of something). Also set it to false for casual conversation, opinions, self-referential questions, or questions unrelated to a specific factual topic.
- task: a concise goal statement, under 15 words.
- plan: 2-4 short steps describing your approach, not a full essay.
- CRITICAL - SELF-REFERENTIAL & IDENTITY INQUIRIES: If the query asks about JARVIS's own name, identity, capabilities, features, what it can do, how it works, or gives conversational greetings (e.g. "hello", "hi", "what is your name", "who are you", "what can you do", "what are your capabilities", "how do you work", "what is jarvis", "tell me about yourself", "help me"), you MUST set needsResearch: false, needsFactCheck: false, needsReview: false, and needsWikipedia: false. These questions must NEVER trigger external web search, live news, or research because they are about JARVIS itself and must be answered directly from internal platform knowledge.
- If the user's question is only asking for the current date or time, answer it directly using the date/time provided above, and set needsResearch, needsFactCheck, and needsReview all to false.
- If the query is ambiguous or unclear, still produce a best-effort plan and lean toward needsResearch: true to gather clarifying context.
Output ONLY a JSON object with this exact structure:
{
  "task": "concise goal statement",
  "plan": ["step 1", "step 2"],
  "needsResearch": true,
  "needsFactCheck": true,
  "needsReview": true,
  "needsDiagram": true,
  "needsChart": true,
  "needsImage": true,
  "needsWikipedia": true
}`,

  researcher: `You are the RESEARCHER agent of JARVIS.
Task: "{task}"
Live Context / Search Data:
{searchSnippets}

Instructions:
1. Before searching, first think of 3-5 focused, specific search keywords based on the user's query (not the raw question) - use these keywords for the search instead of the full question.
2. When searching for information, prioritize these trusted domains when available:
- nasa.gov, esa.int, space.com, wikipedia.org, nature.com, sciencedirect.com, .edu and .gov domains
3. For each fact you extract, link it to the specific source number that supports it, using this format:
{ "fact": "...", "sourceIndex": 2 }
4. Only include a fact if at least one search result directly supports it. Do NOT include facts that are not backed by any of the provided search snippets.
5. If multiple sources confirm the same fact, note that too (higher confidence).
6. If the search results are mostly irrelevant to the query topic, say so clearly in your output instead of forcing weak facts from unrelated sources.
7. For news or current event inquiries, prioritize searching for recent news headlines and current events. If retrieved search results are encyclopedia pages or lack actual current news data, explicitly note that current news data is unavailable rather than assuming past facts apply.
8. Only include a source in "sources" if its snippet is directly and specifically relevant to the task topic. If a search result's snippet doesn't clearly support the task topic, leave it out rather than including it as a weak or tangential match.
9. Never include two sources that point to the same page. Keep only one, choosing the cleaner/canonical URL.

Output ONLY a valid JSON object in this exact format, no extra text:
{
  "facts": [
    { "fact": "Concise verified fact 1", "sourceIndex": 1 },
    { "fact": "Concise verified fact 2", "sourceIndex": 2 }
  ],
  "sources": [{"title": "Source name", "url": "https://...", "domain": "domain.com"}],
  "notes": ""
}`,

  factChecker: `You are the FACT CHECKER agent of JARVIS.

Original Task: "{task}"

Collected Claims & Facts:
{claims}

Collected Sources & Snippets:
{sources}

Instructions:
1. Factual Accuracy: Review each claim against general knowledge and internal consistency.
2. Source Relevance Verification (CRITICAL): For each claim, inspect the associated sources and snippets. Does the cited source's title, domain, or snippet actually relate to the claim's topic and the task topic? If a source is clearly irrelevant or unrelated to the claim it's attached to (e.g. a country's Wikipedia page cited for a movie fact, or an unrelated news topic), you MUST flag it explicitly as a "Source Mismatch: [Explanation of why the source is unrelated]" in the "issues" array.
3. Issues Reporting: List any claim that is incorrect, outdated, unsupported, exaggerated, contradicts another claim, OR suffers from a "Source Mismatch" in the "issues" array with a brief explanation (max 5, keep each short).
4. If any claims look like fabricated current news headlines, unsupported assertions, or unbacked speculative facts without backing research data, flag them immediately in issues as unverified or fabricated.
5. If a claim's accuracy is uncertain, note it in issues as "needs verification".
6. If all claims check out and have relevant sources, return an empty issues array - do not invent problems.
7. If no claims were provided, return both arrays empty.

Output ONLY a valid JSON object in this exact format, no extra text:
{
  "verified": ["Confirmed claim 1"],
  "issues": ["Source Mismatch: [Explanation]", "Identified factual error or note 1"]
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
- Deliver a direct, elegant, and informative answer in clean Markdown, using headers, comparison tables, or bullet points where they improve readability.
- When comparing specifications or products, markdown tables (| Feature | Product A | Product B |) are encouraged for clarity.
- Keep the tone professional, objective, and clear. Aim for a complete but focused answer (roughly 400-550 words).
- RELEVANCE & TOPIC MISMATCH SAFETY CHECK: Before synthesizing your final answer, compare the research/facts you've been given against the user's ORIGINAL question. If the provided facts/research do not actually relate to or answer what the user asked (e.g. the user asked about your own capabilities or identity, but the research is about an unrelated external topic), do NOT confidently present the unrelated research as if it answers the question. Instead, recognize the mismatch and either:
  1. Answer the user's actual question directly using your own knowledge if possible, or
  2. Clearly state that the available research doesn't match the question, rather than presenting irrelevant information as a confident answer.
- Do NOT use LaTeX math syntax or delimiters (e.g. do NOT use \\[ \\], \\( \\), $$ or $). Always use clean plain-text mathematical notation and standard unicode symbols instead (for example: "Thrust = mass flow rate × exhaust velocity" or "F = m · a" or "E = mc²").
- Do NOT mention intermediate agent names, JSON formats, or internal reasoning steps.
- ABSOLUTE FACT-CHECKER EXCLUSION RULE: If the Fact Checker or Issues list has explicitly flagged any claim, event, or headline as incorrect, unverified, inaccurate, or unsupported, you MUST completely omit and exclude it from the final synthesis. Never present a flagged-false or unverified claim as a real fact or headline.
- CURRENT-YEAR SOURCE PRIORITY RULE: When search results/sources include content dated with the current year (2026) or explicitly discussing "current year" topics (e.g. "Best movies of 2026", "2026 releases"), you MUST prioritize and heavily favor this current-year source data over your own training knowledge. Do not dilute a "current year" list with older, pre-existing well-known titles from memory unless the current-year source itself mentions them. If a current-year source (like "The 10 Best Sci-Fi Movies of 2026") is available, its actual content should be the PRIMARY basis for the answer, not a minor addition to an AI-recalled list.
- REVIEWER RECOMMENDATIONS & CONTENT SELECTION / SCOPE ENFORCEMENT: Actively incorporate and honor the Reviewer's specific critique, missing context observations, and actionable recommendations.
  - If the Reviewer explicitly recommends removing, excluding, or replacing a specific story, fact, claim, or item because it does not fit the query's scope, geographic level, category, or criteria (for example, a domestic or state-level story flagged as not belonging in a "world news" list), you MUST honor that critique by excluding or replacing that item.
  - Never blindly include every raw fact from the Researcher if the Reviewer has flagged an item as out of scope, irrelevant, or inappropriate for the request. Filter, select, and structure your final content strictly according to the Reviewer's guidance.
- STRICT ANTI-FABRICATION RULE: NEVER fabricate specific events, headlines, dates, quotes, statistics, or facts not present in the actual research data. If the research data does not contain real current news or verified facts on this topic, you MUST state clearly: "I don't have access to verified current news on this topic" rather than inventing plausible-sounding but fake headlines, events, or facts.
- GROUNDED SOURCES RULE: Only cite sources that are explicitly present in the retrieved ground-truth sources list provided in the context. Never cite, invent, or hallucinate a source or URL not present in that list. If no sources were retrieved or if sources are irrelevant, do not cite external news sources.
- If the available information is incomplete or uncertain, say so honestly rather than filling gaps with confident-sounding guesses.
- End with a natural conclusion - do not pad the response just to reach a target length.`,

  architect: `You are the ARCHITECT agent of JARVIS, specialized in vector diagram visualization and concept architecture blueprints.

Task: "{task}"
Core Context / Synthesized Intelligence:
{answer}

Instructions:
1. Generate a self-contained, beautifully styled SVG diagram (viewBox="0 0 800 480" width="100%" height="100%").
2. Focus on visual process flows, technical mechanisms (e.g., optical camera sensor pipelines, hardware architecture, photon-to-ISP stages), comparative blocks, or system hierarchies.
3. Styling Guidelines (Dark JARVIS Cyber Theme):
   - Background: <rect width="100%" height="100%" rx="16" fill="#070d19"/>
   - Cards/Nodes: Rectangles (<rect rx="10" ...>) with dark fill (#0f172a or #111e38), subtle stroke (#38bdf8, #00f0ff, #a855f7, or #34d399) and stroke-width="1.5".
   - Headers/Titles: <text font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="bold" fill="#f8fafc" text-anchor="middle">
   - Labels/Descriptions: <text font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">
   - Connectors/Flow: <path d="..." stroke="#38bdf8" stroke-width="2" marker-end="url(#arrow)"/>
   - Defs: Include <defs><marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8"/></marker></defs>
4. Structure:
   - Provide 3 to 6 key stages, components, or conceptual blocks arranged logically with clear flow arrows.
   - Keep all element coordinates strictly within 0-800 x and 0-480 y.
5. Output Requirement:
   - You MUST finish the diagram completely, including a proper closing </svg> tag, within your token budget. If running low on space, immediately simplify remaining elements rather than leaving any section cut off.
   - Output ONLY the raw <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480">...</svg> markup.
   - Do NOT wrap in conversational text or markdown.`,

  dataAnalyst: `You are the DATA ANALYST agent of JARVIS, specialized in extracting and structuring quantitative data points for visual chart generation.

Task: "{task}"
Synthesized Intelligence Content / Facts:
{content}

Instructions:
- Carefully inspect all markdown tables (| Feature | Item 1 | Item 2 |), bullet points, and comparative specifications in the content.
- For metrics with units (e.g. "3,349 mAh", "4,000 mAh", "6 GB", "8 GB", "48 MP", "50 MP", "$799", "120 Hz", "25 W"), strip the units to extract pure numeric numbers (e.g. 3349, 4000, 6, 8, 48, 50, 799, 120, 25) and place the unit in the series or label name.
- Structure the chart:
  - For product/entity comparisons across features (e.g. iPhone 15 vs Galaxy S24 vs Pixel 8):
    - Option 1 (Preferred): "labels" are the products/entities (e.g. ["iPhone 15", "Galaxy S24", "Pixel 8"]), and each metric is an item in "series":
      {
        "chartType": "bar",
        "title": "Smartphone Specifications Comparison",
        "labels": ["iPhone 15", "Galaxy S24", "Pixel 8"],
        "series": [
          {"name": "Battery (mAh)", "values": [3349, 4000, 4575]},
          {"name": "RAM (GB)", "values": [6, 8, 8]},
          {"name": "Main Camera (MP)", "values": [48, 50, 50]},
          {"name": "Charging Speed (W)", "values": [20, 25, 27]}
        ]
      }
    - Option 2: "labels" are the features (e.g. ["Battery (mAh)", "RAM (GB)", "Main Camera (MP)"]), and each product is in "series":
      {
        "chartType": "bar",
        "title": "Comparative Hardware Specifications",
        "labels": ["Battery (mAh)", "RAM (GB)", "Main Camera (MP)"],
        "series": [
          {"name": "iPhone 15", "values": [3349, 6, 48]},
          {"name": "Galaxy S24", "values": [4000, 8, 50]}
        ]
      }
- Output ONLY a valid JSON object in this exact format, with no markdown fences, no conversational prose, and no extra text:
{
  "chartType": "bar" or "line",
  "title": "Short descriptive chart title",
  "series": [{"name": "Series name", "values": [num1, num2, ...]}],
  "labels": ["Label1", "Label2", ...]
}
- Use "line" for sequential / time-series data (e.g. years, dates, timelines) and "bar" for categorical or entity comparisons.
- If truly no chartable numeric comparisons exist, return: {"chartType": null}`,

  imageFinder: `You are the JARVIS IMAGE FINDER agent.
Your mission is to formulate ONE concise, highly targeted search query (5-10 words) that will retrieve genuine, high-quality, relevant real photos for the user's inquiry.

User Task / Topic:
{task}

Instructions:
- Write ONE short, specific image search query (5-10 words) optimized for finding real photos of the physical subject (e.g. "iPhone 15 and Samsung Galaxy S24 comparison photo", "Sony IMX optical camera sensor macro photo", "James Webb telescope southern ring nebula photo").
- Focus strictly on tangible, visual subjects.
- Output ONLY a valid JSON object with NO markdown fences, no conversational prose, and no explanation in this exact format:
{
  "searchQuery": "short specific search query"
}`,
};

export const DEFAULT_JARVIS_CONFIG: JarvisSystemConfig = {
  deepResearchDefault: false,
  diagramModeDefault: false,
  chartModeDefault: false,
  imageModeDefault: false,
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
      maxTokens: 500,
      enableFailover: false,
      systemPrompt: DEFAULT_AGENT_SYSTEM_PROMPTS.planner,
      responseLanguage: 'English',
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
      maxTokens: 1200,
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
    architect: {
      id: 'architect',
      name: 'Architect',
      role: 'SVG Architecture & Diagram Generation',
      description: 'Generates precision, dark-themed SVG diagrams illustrating structural concepts, workflows, and hierarchies.',
      icon: '🏗️',
      providerId: 'existing',
      modelId: 'deepseek/deepseek-chat',
      enabled: true,
      maxTokens: 4500,
      enableFailover: false,
      systemPrompt: DEFAULT_AGENT_SYSTEM_PROMPTS.architect,
    },
    dataAnalyst: {
      id: 'dataAnalyst',
      name: 'Data Analyst',
      role: 'Numeric Data & Chart Analytics',
      description: 'Extracts structured comparative metrics and time-series statistics into visual bar or line charts.',
      icon: '📊',
      providerId: 'existing',
      modelId: 'deepseek/deepseek-chat',
      enabled: true,
      maxTokens: 800,
      enableFailover: false,
      systemPrompt: DEFAULT_AGENT_SYSTEM_PROMPTS.dataAnalyst,
    },
    imageFinder: {
      id: 'imageFinder',
      name: 'Image Finder',
      role: 'Visual Photo Sourcing & Image Querying',
      description: 'Identifies visual photo requirements and generates targeted photographic search queries to retrieve real images.',
      icon: '🖼️',
      providerId: 'existing',
      modelId: 'deepseek/deepseek-chat',
      enabled: true,
      maxTokens: 150,
      enableFailover: false,
      systemPrompt: DEFAULT_AGENT_SYSTEM_PROMPTS.imageFinder,
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

  getJarvisQueryLog(): Array<{ id: string; query: string; timestamp: string; type: 'query' | 'ai' | 'system' | 'weather' | 'news' | 'warning' }> {
    return read<Array<{ id: string; query: string; timestamp: string; type: 'query' | 'ai' | 'system' | 'weather' | 'news' | 'warning' }>>('nexus-jarvis-query-log-v1', []);
  },
  addJarvisQueryLog(query: string, type: 'query' | 'ai' | 'system' | 'weather' | 'news' | 'warning' = 'query') {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const newItem = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      query,
      timestamp,
      type,
    };
    const current = this.getJarvisQueryLog();
    const filtered = current.filter((item) => item.query.toLowerCase() !== query.toLowerCase());
    const updated = [...filtered, newItem].slice(-15);
    write('nexus-jarvis-query-log-v1', updated);
    return updated;
  },

  getSaved(): SavedItem[] {
    return read<SavedItem[]>(KEYS.saved, []);
  },
  isSaved(id: string): boolean {
    return this.getSaved().some((s) => s.id === id);
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
      return null; // Signals to use server's existing default AI configuration (Existing AI / DeepSeek)
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
      diagramModeDefault: stored.diagramModeDefault ?? DEFAULT_JARVIS_CONFIG.diagramModeDefault,
      chartModeDefault: stored.chartModeDefault ?? DEFAULT_JARVIS_CONFIG.chartModeDefault,
      imageModeDefault: stored.imageModeDefault ?? DEFAULT_JARVIS_CONFIG.imageModeDefault,
      customAgents: Array.isArray(stored.customAgents) ? stored.customAgents : [],
      agents: {
        planner: {
          ...DEFAULT_JARVIS_CONFIG.agents.planner,
          ...(stored.agents.planner || {}),
          maxTokens: Math.max(400, stored.agents.planner?.maxTokens || 500),
          systemPrompt:
            !stored.agents.planner?.systemPrompt ||
            !stored.agents.planner.systemPrompt.includes('needsWikipedia') ||
            !stored.agents.planner.systemPrompt.includes('needsDiagram') ||
            !stored.agents.planner.systemPrompt.includes('needsChart') ||
            !stored.agents.planner.systemPrompt.includes('needsImage') ||
            stored.agents.planner.systemPrompt.includes('"needsChart": false') ||
            !stored.agents.planner.systemPrompt.includes('current date or time') ||
            !stored.agents.planner.systemPrompt.includes('SELF-REFERENTIAL & IDENTITY INQUIRIES') ||
            !stored.agents.planner.systemPrompt.includes('what can you do') ||
            !stored.agents.planner.systemPrompt.includes('task: a concise goal statement, under 15 words.')
              ? DEFAULT_AGENT_SYSTEM_PROMPTS.planner
              : stored.agents.planner.systemPrompt,
        },
        researcher: {
          ...DEFAULT_JARVIS_CONFIG.agents.researcher,
          ...(stored.agents.researcher || {}),
          maxTokens: Math.max(800, stored.agents.researcher?.maxTokens || 1200),
          systemPrompt:
            !stored.agents.researcher?.systemPrompt ||
            !stored.agents.researcher.systemPrompt.includes('sourceIndex') ||
            !stored.agents.researcher.systemPrompt.includes('nasa.gov, esa.int, space.com') ||
            stored.agents.researcher?.systemPrompt?.includes('Extract verified facts and source references.\nOutput ONLY a JSON object:') ||
            stored.agents.researcher?.systemPrompt?.includes('If search data is empty or insufficient, return an empty facts array') ||
            !stored.agents.researcher?.systemPrompt?.includes('Never include two sources that point to the same page')
              ? DEFAULT_AGENT_SYSTEM_PROMPTS.researcher
              : stored.agents.researcher.systemPrompt,
        },
        factChecker: {
          ...DEFAULT_JARVIS_CONFIG.agents.factChecker,
          ...(stored.agents.factChecker || {}),
          systemPrompt:
            !stored.agents.factChecker?.systemPrompt ||
            stored.agents.factChecker?.systemPrompt?.includes('Verify claims, identify discrepancies, and isolate corrections.') ||
            !stored.agents.factChecker?.systemPrompt?.includes('{sources}') ||
            !stored.agents.factChecker?.systemPrompt?.includes('Source Relevance Verification')
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
            !stored.agents.finalSynthesizer?.systemPrompt?.includes('Do NOT use LaTeX math syntax') ||
            !stored.agents.finalSynthesizer?.systemPrompt?.includes('CURRENT-YEAR SOURCE PRIORITY RULE') ||
            !stored.agents.finalSynthesizer?.systemPrompt?.includes('RELEVANCE & TOPIC MISMATCH SAFETY CHECK') ||
            !stored.agents.finalSynthesizer?.systemPrompt?.includes('REVIEWER RECOMMENDATIONS & CONTENT SELECTION')
              ? DEFAULT_AGENT_SYSTEM_PROMPTS.finalSynthesizer
              : stored.agents.finalSynthesizer.systemPrompt,
        },
        architect: {
          ...DEFAULT_JARVIS_CONFIG.agents.architect,
          ...(stored.agents.architect || {}),
          maxTokens: Math.max(4500, stored.agents.architect?.maxTokens || 4500),
          systemPrompt:
            !stored.agents.architect?.systemPrompt ||
            stored.agents.architect.systemPrompt.includes('viewBox="0 0 800 450"') ||
            !stored.agents.architect.systemPrompt.includes('An unfinished diagram is a failure')
              ? DEFAULT_AGENT_SYSTEM_PROMPTS.architect
              : stored.agents.architect.systemPrompt,
        },
        dataAnalyst: {
          ...DEFAULT_JARVIS_CONFIG.agents.dataAnalyst,
          ...(stored.agents?.dataAnalyst || {}),
          maxTokens: Math.max(600, stored.agents?.dataAnalyst?.maxTokens || 800),
          systemPrompt:
            !stored.agents?.dataAnalyst?.systemPrompt ||
            !stored.agents?.dataAnalyst?.systemPrompt?.includes('DATA ANALYST') ||
            !stored.agents?.dataAnalyst?.systemPrompt?.includes('strip the units')
              ? DEFAULT_AGENT_SYSTEM_PROMPTS.dataAnalyst
              : stored.agents.dataAnalyst.systemPrompt,
        },
        imageFinder: {
          ...DEFAULT_JARVIS_CONFIG.agents.imageFinder,
          ...(stored.agents?.imageFinder || {}),
          maxTokens: Math.max(120, stored.agents?.imageFinder?.maxTokens || 150),
          systemPrompt:
            !stored.agents?.imageFinder?.systemPrompt ||
            !stored.agents?.imageFinder?.systemPrompt?.includes('IMAGE FINDER') ||
            !stored.agents?.imageFinder?.systemPrompt?.includes('physical subject')
              ? DEFAULT_AGENT_SYSTEM_PROMPTS.imageFinder
              : stored.agents.imageFinder.systemPrompt,
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

  getEdgeVoice(): string {
    try {
      const raw = localStorage.getItem(KEYS.edgeVoice);
      if (!raw) return 'en-US-AriaNeural';
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'string' && parsed.trim()) return parsed.trim();
      } catch {
        if (raw.trim()) return raw.trim();
      }
      return 'en-US-AriaNeural';
    } catch {
      return 'en-US-AriaNeural';
    }
  },

  saveEdgeVoice(voice: string): void {
    try {
      localStorage.setItem(KEYS.edgeVoice, voice);
    } catch {
      // ignore
    }
  },
};
