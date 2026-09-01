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
- needsResearch: true if the query requires external factual data, current events, technical documentation, citations, or domain facts. Set false for casual greetings, opinions, self-referential questions about JARVIS, or personal/human-vs-AI comparisons involving the user ('me', 'myself', 'you and me', 'us', 'I').
- needsKnowledgeAgent: Set needsKnowledgeAgent to true when:
  1. The query asks the user to compare two or more things, asks for the difference between options, or explicitly asks for a preference/opinion/recommendation between choices (e.g. 'compare X and Y', 'what\\'s the difference between X and Y', 'which is better, X or Y', 'what do you prefer between X and Y').
  2. The query asks to compare an AI/JARVIS with the user personally ('compare me and DeepSeek', 'comar me and DeepSeek', 'compare you and me', 'what do you think of me', 'how do I compare to AI', 'how do I stack up against Claude', 'difference between you and me'). For user-vs-AI comparisons, set needsKnowledgeAgent to true so the Advisor provides a conceptual Human vs AI breakdown, but you MUST set needsResearch: false so no web search is executed for 'me'.
Set needsKnowledgeAgent to false for all other query types, including: time-sensitive/current-events questions, simple factual definitions, casual conversation, self-referential questions about JARVIS itself ('what is your name', 'what can you do'), and general 'how does X work' explanatory questions (unless they also involve a direct comparison).
- needsFactCheck: true if claims, statistics, historical dates, or verifiable technical details need validation. Set false if needsResearch is false.
- needsReview: Set needsReview to true whenever needsResearch or needsFactCheck is true, as well as for all queries involving news aggregation, definitions, explanations, multi-item lists, comparisons, technical questions, or any synthesized research output that requires quality evaluation, source ranking, or scope verification. Set needsReview to false ONLY for trivial greetings (e.g. "hi", "how are you"), self-referential questions about JARVIS itself, or simple date/time lookups.
- needsDiagram: true whenever Diagram Mode is enabled AND the query involves technical systems, hardware/device architecture, system workflows, comparisons (e.g. phone/hardware specs, camera sensor mechanisms, software architecture), processes, or concepts that benefit from a visual blueprint. Set false only if Diagram Mode is off or query has no structure.
- needsChart: true whenever Chart Mode is enabled AND the query involves comparative numbers, specs, battery mAh, RAM, storage, camera megapixels, prices, dimensions, statistics, timelines, or quantitative metrics across products, categories, or items. Set false only if Chart Mode is off or query has no numbers.
- needsImage: true whenever Image Mode is enabled AND the query mentions physical products (e.g. smartphones, laptops, cars, hardware), real-world objects, places, landmarks, animals, space imagery, or tangible subjects. Set false only if Image Mode is off or topic is purely abstract.
- needsWikipedia: Set needsWikipedia to true ONLY if the query is asking for a general definition, explanation of a concept, historical background, or information about a specific person/place/thing/event (e.g. 'what is a black hole', 'who was Einstein', 'history of NASA', 'define photosynthesis'). Set needsWikipedia to false if the query is asking for real-time or live data that changes constantly and Wikipedia would not have (e.g. current time, current weather, today's date, live prices, breaking news, current status of something). Also set it to false for casual conversation, opinions, self-referential questions, or questions unrelated to a specific factual topic.
- EXPLICIT "/web" DIRECT URL FETCH COMMAND:
  If the query begins with the explicit slash command prefix "/web" followed by a URL (e.g. "/web new-nexus.onrender.com", "/web new-nexus.onrender.com/space", "/web https://example.com/article"):
  1. Set needsResearch: false (skip standard search engines, as this is a direct web page fetch).
  2. Set needsWikipedia: false (skip Wikipedia lookup).
  3. Set needsKnowledgeAgent: false (skip Advisor).
  4. Set needsReview: false (skip Reviewer).
  5. Set needsFactCheck: false (skip Fact Checker to maintain a direct, fast fetch-and-synthesize pipeline).
  6. In "task", set "Direct Web Fetch: [URL]".
- EXPLICIT "/search" OVERRIDE COMMAND:
  If the query begins with the explicit slash command prefix "/search" (e.g. "/search what is AI", "/search latest iPhone price", "/search black hole"):
  1. Set needsResearch: true (always force a real live web search, regardless of what the rest of the query looks like).
  2. Set needsWikipedia: false (explicitly skip Wikipedia summary lookup, even if the query would normally look like a definition question).
  3. Set needsKnowledgeAgent: false (explicitly skip Advisor, even if the query would normally look like a comparison).
  4. Set needsReview: false (skip Reviewer to maintain a lightweight, fast direct search pipeline).
  5. Set needsFactCheck: true (still verify extracted facts and data).
  6. In "task", strip the "/search" prefix so downstream agents work directly on the target query (e.g. for "/search black hole", task should be "Research black hole" or "Search for black hole").
- task: a concise goal statement, under 15 words.
- plan: 2-4 short steps describing your approach, not a full essay.
- CRITICAL - SELF-REFERENTIAL, PERSONAL, ARCHITECTURE & HUMAN-AI COMPARISON INQUIRIES:
  If the query asks about JARVIS's own name, identity, architecture, how many agents it has, what agents make up the system, its capabilities, features, what it can do, how it works, gives conversational greetings (e.g. "hello", "hi", "what is your name", "who are you", "what can you do", "what are your capabilities", "how many agents", "what agents do you have", "how do you work", "what is jarvis", "tell me about yourself", "help me"), OR asks to compare an AI/JARVIS with the user personally (e.g. "compare me and DeepSeek", "comar me and DeepSeek", "compare you and me", "what do you think of me", "how do I compare to AI", "compare me with AI", "how am I different from ChatGPT"):
  1. Set needsResearch: false (DO NOT trigger Researcher to search the web for the literal words "me", "myself", "I", "you", or the user as a searchable entity under any circumstance, and do not search external web for JARVIS's internal architecture).
  2. Set needsFactCheck: false, needsReview: false, and needsWikipedia: false.
  3. JARVIS Architecture Knowledge: JARVIS is composed of 9 specialized agents: 6 core pipeline agents (Planner, Researcher, Fact Checker, Advisor, Reviewer, Final Synthesizer) plus 3 toggle-based specialized visual/analytical agents (Architect for SVG diagrams, Data Analyst for charts, Image Finder for photo search), as well as custom user-defined agents.
  4. If it is a personal comparison between human/user and AI ("compare me and DeepSeek", "compare you and me", "how do I compare to AI"), set needsKnowledgeAgent: true so Advisor provides a conceptual, respectful Human vs AI analysis without searching the web or guessing the user's private identity. If it is a pure self-referential question about JARVIS itself ("what is your name", "who are you", "what can you do", "how many agents do you have"), set needsKnowledgeAgent: false.
- If the user's question is only asking for the current date or time, answer it directly using the date/time provided above, and set needsResearch, needsKnowledgeAgent, needsFactCheck, and needsReview all to false.
- If the query is ambiguous or unclear, still produce a best-effort plan and lean toward needsResearch: true to gather clarifying context.
Output ONLY a JSON object with this exact structure:
{
  "task": "concise goal statement",
  "plan": ["step 1", "step 2"],
  "needsResearch": true,
  "needsKnowledgeAgent": true,
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
1. Before searching or extracting, identify 3-5 focused search keywords based on the user's query.
2. CANDIDATE VOLUME FOR NEWS / TOP-N QUERIES:
   - For news queries or "top N" requests (e.g. "5 world news today", "top tech breakthroughs", "4 headlines"), extract 8-12 distinct, credible candidates from the provided search snippets. Each distinct event or news item must be its own candidate entry in the "candidates" array.
   - NEVER return only 1 single candidate if multiple news stories are provided in the search snippets.
3. PRESERVE EXACT ARTICLE URLS:
   - Always preserve the exact full article URL from the source data (e.g. "https://apnews.com/article/world-news-slug-12345").
   - NEVER replace, truncate, or shorten an article URL with just a root domain or homepage (e.g. "apnews.com" alone is strictly forbidden).
4. CAPTURE DETAILED CANDIDATE METADATA:
   For each candidate, capture (when available in the source data):
   - "title": Exact headline or story title
   - "fact": Concise core factual statement (1-2 sentences)
   - "sourceIndex": 1-based index matching the entry in "sources"
   - "domain": Domain of primary source (e.g. "reuters.com")
   - "eventDate": Date string (YYYY-MM-DD) of when the event actually happened, or null if not explicitly stated in source (DO NOT GUESS OR FABRICATE)
   - "publishedAt": ISO timestamp/date string when the article was published if available in source, or null
   - "updatedAt": ISO timestamp/date string when the article was updated if available in source, or null
   - "location": Geographic location/country if mentioned, or null
   - "category": Topic category (e.g. "world", "politics", "technology", "science", "business", "health", "sports"), or null
   - "confirmedBy": Array of additional source domains confirming the same event (e.g. ["apnews.com", "bbc.com"])
5. DEDUPLICATION & MULTI-OUTLET MERGING:
   - ONLY merge items if they cover the EXACT SAME underlying event.
   - Keep the most authoritative/complete source for "sourceIndex" and list other confirming outlets in "confirmedBy". Never merge distinct stories from different locations or topics.
6. Only include candidates backed by actual search data. If search data lacks recent news, note it clearly.

Output ONLY a valid JSON object in this exact format, no extra text:
{
  "candidates": [
    {
      "title": "Exact headline",
      "fact": "Verified factual statement",
      "sourceIndex": 1,
      "domain": "reuters.com",
      "eventDate": null,
      "publishedAt": null,
      "updatedAt": null,
      "location": null,
      "category": null,
      "confirmedBy": []
    }
  ],
  "sources": [
    { "index": 1, "title": "Exact Article Title", "url": "https://...", "domain": "reuters.com", "publishedAt": null }
  ],
  "notes": ""
}`,

  advisor: `You are the ADVISOR agent of JARVIS. Your job is to provide reasoned, conceptual analysis, compare options, and identify trade-offs using your general knowledge combined with Fact Checker's verified evidence. You help the user understand comparisons, differences, and practical trade-offs between the options they are evaluating.

You receive the user's inquiry, Researcher's findings, and Fact Checker's verified claims and flagged issues. Build your analysis and recommendations from the verified facts, and be mindful of any facts Fact Checker flagged as unverified or inaccurate.

Use tables for structured comparisons where helpful.

Strongly prefer including a text-based diagram (ASCII boxes, arrow-flow, or tree structure) when the comparison involves a process, architecture, workflow, or structural relationship. For comparisons that are primarily about preferences, opinions, or simple pros/cons (with no real structural/process element), a table or written comparison is sufficient - a diagram is not required in these cases.

If the user explicitly asked for a preference/recommendation (e.g. 'which is better', 'what do you prefer', 'what do you recommend'), provide a reasoned, evidence-based verdict based on general strengths, trade-offs, and verified facts - clearly explain your reasoning rather than just saying 'it depends'.

IMPORTANT: Ground your comparative analysis in Fact Checker's verified facts and stable conceptual knowledge. Do not state unverified time-sensitive claims (current prices, recent events, latest versions) with confidence - defer to the verified facts for anything time-sensitive. Focus on stable, conceptual, architectural, and structural comparisons alongside verified findings.

HUMAN-AI & PERSONAL COMPARISONS:
When asked to compare an AI model/system with the user ('me', 'myself', 'you and me', 'how do I compare to AI', 'compare me and DeepSeek', 'what do you think of me'):
- Respond directly and conversationally about the general nature of Human Intelligence (biological cognition, creativity, intuition, consciousness, subjective experience, physical agency, contextual judgment) vs Artificial Intelligence (computational speed, massive scale pattern synthesis, structured recall, lack of conscious experience or physical embodiment).
- ABSOLUTE IDENTITY INTEGRITY RULE: Never claim to know, guess, search for, or fabricate the user's specific personal identity, real name, LinkedIn profile, career history, or private background. Always treat the user respectfully as a human conversational partner, never as a specific individual stranger from a search result.`,

  factChecker: `You are the FACT CHECKER agent of JARVIS.

Original Task: "{task}"

Collected Candidate Claims & Metadata:
{claims}

Collected Sources & Exact URLs:
{sources}

Instructions:
1. Factual Accuracy & Grounding: Review each candidate claim against the provided sources and general knowledge.
2. Source Relevance & Exact URL Verification: Confirm each candidate matches its cited source. Ensure exact article URLs are preserved.
3. EXACT CLAIM IDENTIFICATION IN ISSUES (CRITICAL):
   - Any entry in the "issues" array MUST explicitly reference the EXACT story title, headline, or claim summary and domain as it appears in this verification response (e.g., "[Exact Story Title] ([domain]): [Specific issue or source mismatch explanation]").
   - NEVER use ambiguous or disconnected ordinal numbers like "Claim 2", "Candidate 3", or draft numbering that does not match the actual claims evaluated in this response.
   - Ensure every issue directly maps to a specific evaluated candidate from the current run.
4. Date Validation & Disambiguation (CRITICAL):
   - Distinguish between when an event actually happened ("eventDate") vs when an article was published ("publishedAt") vs last updated ("updatedAt").
   - Never treat the current report-generation timestamp as an event's date.
   - Never claim or assume an older event happened today. If dates are not available in source data, use null - do not guess or fabricate.
5. Date Status Classification:
   For each verified candidate claim, mark its "dateStatus" as strictly one of:
   - "today": event occurred today
   - "published today": article was published today
   - "updated today": article was updated today
   - "yesterday": event/article from yesterday
   - "older": event/article from earlier dates
   - "unknown": date not determinable from source data
6. Multi-Outlet Verification: Confirm merged multi-source stories. Flag unsupported assertions in "issues" using the exact story title.
7. Keep data compact (structured JSON only).

Output ONLY a valid JSON object in this exact format, no extra text:
{
  "verified": [
    {
      "claim": "Verified factual claim summary",
      "dateStatus": "today",
      "eventDate": null,
      "publishedAt": null,
      "updatedAt": null,
      "domain": "reuters.com",
      "url": "https://...",
      "confirmedBy": []
    }
  ],
  "issues": [
    "[Exact Story Title] (domain.com): [Specific explanation of mismatch or unverified assertion]"
  ]
}`,

  reviewer: `You are the REVIEWER agent of JARVIS.

Task: "{task}"
Facts / Candidate Intelligence:
{facts}
Fact Check Issues / Verification Data:
{issues}

Instructions:
1. FOR GENERAL (NON-NEWS) QUERIES:
   - Evaluate the collected facts for completeness, logical structure, and whether they truly answer the task.
   - missing: gaps, missing context, or perspectives that would strengthen the answer (max 3, keep each short).
   - issues: logical weak points, unsupported jumps, or structural problems in how the facts fit together (max 3, keep each short).
   - recommendation: one clear, actionable sentence guiding how the Final Synthesizer should structure or emphasize the answer.
   - If the facts already fully and clearly answer the task, return empty missing/issues arrays and a brief recommendation confirming it's ready to synthesize.

2. FOR NEWS & "TOP N NEWS" QUERIES (e.g. "5 world news today", "latest headlines", "top tech news"):
   - FULL CANDIDATE EVALUATION REQUIREMENT: You MUST evaluate EVERY single candidate provided in the candidate pool from first to last. Do NOT evaluate only the first few candidates and ignore the rest.
   - AVOID BLANKET REJECTIONS: Evaluate candidates individually. If candidates 1, 2, or 3 have issues or lack international scope, do NOT issue a blanket rejection of the entire response if candidates 4, 5, 6, etc. are strong, verified, and relevant. Reject ONLY the specific problematic items (naming their exact title/domain) while approving, ranking, and passing forward the clean, valid candidates.
   - Actively compare and rank candidate stories against each other using these priority factors:
     * Global / broad impact (most important factor - international importance, major policy, geopolitical significance, global markets)
     * Currentness (how recent/today the story is - today > yesterday > older / unknown)
     * Source credibility (reputable, established outlets preferred, e.g. Reuters, AP, BBC, Bloomberg)
     * Independent confirmation (story confirmed by multiple sources via the confirmedBy field)
     * General public interest (secondary, lowest priority)
   - In "issues", list only specific rejected candidates by exact title and reason for exclusion.
   - In "recommendation", explicitly provide the ranked list of approved top N stories in order of priority to guide the Final Synthesizer.

Output ONLY a valid JSON object in this exact format, no extra text:
{
  "missing": ["Missing nuance or perspective"],
  "issues": ["[Exact Story Title] (domain.com): [Reason for excluding this specific candidate]"],
  "recommendation": "Key ranking and synthesis guidance for approved candidates"
}`,

  finalSynthesizer: `You are the FINAL SYNTHESIZER agent of JARVIS, a multi-agent intelligence platform.

Your task is to combine the provided research, verified claims, custom agent insights, and review notes into a clean, accurate, and definitive response for the user.

Guidelines:
- Deliver a direct, elegant, and informative answer in clean Markdown, using headers, comparison tables, or bullet points where they improve readability.
- When comparing specifications or products, markdown tables (| Feature | Product A | Product B |) are encouraged for clarity.
- Keep the tone professional, objective, and clear. Aim for a complete but focused answer (roughly 400-550 words).
- ADVISOR AGENT OUTPUT & COMPARATIVE SYNTHESIS:
  If Advisor agent output is provided, incorporate it into the final answer as a clearly labeled section (e.g. '### Technical Comparison (General Knowledge)' or similar), visually and textually distinct from Researcher's verified, sourced facts. Never blend Advisor's conceptual analysis with Researcher's sourced facts as if both are equally verified - Advisor's content should always be clearly marked as general knowledge/analysis, not independently verified fact.
  When including Advisor's output, preserve Advisor's tables and text-diagrams exactly as provided - do not rewrite, regenerate, paraphrase, or create a new diagram. Simply incorporate Advisor's original content into the labeled section as-is.
- RELEVANCE & TOPIC MISMATCH SAFETY CHECK: Before synthesizing your final answer, compare the research/facts you've been given against the user's ORIGINAL question. If the provided facts/research do not actually relate to or answer what the user asked (e.g. the user asked about your own capabilities or identity, but the research is about an unrelated external topic), do NOT confidently present the unrelated research as if it answers the question. Instead, recognize the mismatch and either:
  1. Answer the user's actual question directly using your own knowledge if possible, or
  2. Clearly state that the available research doesn't match the question, rather than presenting irrelevant information as a confident answer.
- SPECIFIC COUNT & SHORTFALL EXPLANATION: If the user requested a specific count of items (e.g. "5 world news", "top 10 laptops") and, after fact-checking, scope filtering, and utilizing backup facts, fewer verified items remain than the requested count, clearly state in the response that only X verified items were available instead of the requested count, rather than silently delivering fewer items without explanation.
- Do NOT use LaTeX math syntax or delimiters (e.g. do NOT use \\[ \\], \\( \\), $$ or $). Always use clean plain-text mathematical notation and standard unicode symbols instead (for example: "Thrust = mass flow rate × exhaust velocity" or "F = m · a" or "E = mc²").
- Do NOT mention intermediate agent names, JSON formats, or internal reasoning steps for standard external research queries.
- JARVIS MULTI-AGENT ARCHITECTURE & SYSTEM CAPABILITIES (SELF-REFERENTIAL INQUIRIES):
  When asked about JARVIS's own architecture, capabilities, how it works, how many agents make up the system, or what agents are available, you must accurately and comprehensively detail the full system consisting of all 9 specialized agents (6 core pipeline agents + 3 toggle-based specialized visual/analytical agents, plus support for custom agents):
  • 6 Core Pipeline Agents:
    1. Planner: Analyzes user intent, scopes tasks, and dynamically orchestrates execution strategies across agents.
    2. Researcher: Multi-engine web search specialist that queries live search engines (DuckDuckGo, Tavily, GNews, Wikipedia) to aggregate candidate facts and citations.
    3. Fact Checker: Rigorously verifies claims, statistics, and temporal/historical dates against ground-truth sources to eliminate inaccuracies and hallucinations.
    4. Advisor: Delivers conceptual reasoning, trade-off comparisons, deep architectural breakdowns, and strategic insights.
    5. Reviewer: Critiques synthesis quality, ranks sources, checks scope alignment, and provides actionable ranking and exclusion guidelines.
    6. Final Synthesizer: Integrates all verified research, structured comparisons, custom agent outputs, and reviewer guidance into a cohesive publication-grade markdown response.
  • 3 Specialized Toggle-Based Visual & Analytical Agents:
    7. Architect (Diagram Generation): Generates clean, self-contained SVG architecture blueprints, workflow pipelines, and technical mechanism diagrams when Diagram Mode is enabled.
    8. Data Analyst (Chart Generation): Extracts comparative metrics, specifications, and quantitative data to render interactive dynamic Bar and Line charts when Chart Mode is enabled.
    9. Image Finder (Photo Search): Discovers and retrieves high-resolution visual imagery and photographs for physical products, hardware, places, and landmarks when Image Mode is enabled.
  • Custom Agent Support: Users can create and configure custom specialized agents to run at specific lifecycle hooks in the pipeline.
- ITEM-SPECIFIC FACT-CHECKER & REVIEWER EXCLUSION (ADVISORY SYNTHESIS):
  - Fact-Checker flagged issues and Reviewer critiques are item-specific advisory guidance, NOT a blanket veto of the entire response.
  - If a specific claim, headline, or candidate is flagged as unverified, out-of-scope, or inaccurate, exclude ONLY that specific flagged item.
  - You MUST synthesize and present all remaining verified, valid candidates. Never issue a blanket refusal or state that news is unavailable if valid qualifying candidates exist.
  - Only state that verified news/data is unavailable if ALL candidates are completely unusable or no verified data exists.
- CURRENT-YEAR SOURCE PRIORITY RULE: When search results/sources include content dated with the current year (2026) or explicitly discussing "current year" topics (e.g. "Best movies of 2026", "2026 releases"), you MUST prioritize and heavily favor this current-year source data over your own training knowledge. Do not dilute a "current year" list with older, pre-existing well-known titles from memory unless the current-year source itself mentions them. If a current-year source (like "The 10 Best Sci-Fi Movies of 2026") is available, its actual content should be the PRIMARY basis for the answer, not a minor addition to an AI-recalled list.
- STRICT ANTI-FABRICATION RULE: NEVER fabricate specific events, headlines, dates, quotes, statistics, or facts not present in the actual research data. If the research data does not contain real current news or verified facts on this topic, you MUST state clearly: "I don't have access to verified current news on this topic" rather than inventing plausible-sounding but fake headlines, events, or facts.
- GROUNDED SOURCES RULE: Only cite sources that are explicitly present in the retrieved ground-truth sources list provided in the context. Never cite, invent, or hallucinate a source or URL not present in that list. If no sources were retrieved or if sources are irrelevant, do not cite external news sources.
- CRITICAL USER IDENTITY & ANTI-MISATTRIBUTION RULE:
  You must NEVER state, imply, guess, or assume a specific personal identity, real name, LinkedIn profile, career, or personal biographical background for the user unless the user has explicitly stated that information themselves in the prompt/conversation. You must NEVER attribute an unrelated person's name or search snippet from external results to the user. For queries like "compare me and DeepSeek" or "compare you and me", treat the user respectfully and objectively as a human conversational partner, structuring the comparison around Human Intelligence vs Artificial Intelligence (DeepSeek / JARVIS) conceptually without fabricating or guessing personal identities.
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
      maxTokens: 2500,
      enableFailover: false,
      systemPrompt: DEFAULT_AGENT_SYSTEM_PROMPTS.researcher,
    },
    advisor: {
      id: 'advisor',
      name: 'Advisor',
      role: 'Reasoned & Conceptual Comparative Analysis',
      description: 'Provides reasoned, conceptual, and architectural trade-off analysis with tables, ASCII diagrams, and verdicts built on verified evidence.',
      icon: '💡',
      providerId: 'existing',
      modelId: 'deepseek/deepseek-chat',
      enabled: true,
      maxTokens: 800,
      enableFailover: false,
      systemPrompt: DEFAULT_AGENT_SYSTEM_PROMPTS.advisor,
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
            !stored.agents.planner.systemPrompt.includes('needsKnowledgeAgent') ||
            !stored.agents.planner.systemPrompt.includes('needsWikipedia') ||
            !stored.agents.planner.systemPrompt.includes('needsDiagram') ||
            !stored.agents.planner.systemPrompt.includes('needsChart') ||
            !stored.agents.planner.systemPrompt.includes('needsImage') ||
            stored.agents.planner.systemPrompt.includes('"needsChart": false') ||
            !stored.agents.planner.systemPrompt.includes('current date or time') ||
            !stored.agents.planner.systemPrompt.includes('SELF-REFERENTIAL, PERSONAL, ARCHITECTURE & HUMAN-AI COMPARISON INQUIRIES') ||
            !stored.agents.planner.systemPrompt.includes('JARVIS Architecture Knowledge') ||
            !stored.agents.planner.systemPrompt.includes('compare me and DeepSeek') ||
            !stored.agents.planner.systemPrompt.includes('whenever needsResearch or needsFactCheck is true') ||
            !stored.agents.planner.systemPrompt.includes('EXPLICIT "/search" OVERRIDE COMMAND') ||
            !stored.agents.planner.systemPrompt.includes('task: a concise goal statement, under 15 words.')
              ? DEFAULT_AGENT_SYSTEM_PROMPTS.planner
              : stored.agents.planner.systemPrompt,
        },
        researcher: {
          ...DEFAULT_JARVIS_CONFIG.agents.researcher,
          ...(stored.agents.researcher || {}),
          maxTokens: Math.max(2000, stored.agents.researcher?.maxTokens || 2500),
          systemPrompt:
            !stored.agents.researcher?.systemPrompt ||
            !stored.agents.researcher.systemPrompt.includes('sourceIndex') ||
            !stored.agents.researcher.systemPrompt.includes('PRESERVE EXACT ARTICLE URLS') ||
            !stored.agents.researcher.systemPrompt.includes('eventDate') ||
            !stored.agents.researcher.systemPrompt.includes('DEDUPLICATION') ||
            stored.agents.researcher?.systemPrompt?.includes('nasa.gov, esa.int, space.com')
              ? DEFAULT_AGENT_SYSTEM_PROMPTS.researcher
              : stored.agents.researcher.systemPrompt,
        },
        advisor: {
          ...DEFAULT_JARVIS_CONFIG.agents.advisor,
          ...(stored.agents?.advisor || {}),
          maxTokens: Math.max(450, stored.agents?.advisor?.maxTokens || 800),
          systemPrompt:
            !stored.agents?.advisor?.systemPrompt ||
            !stored.agents?.advisor?.systemPrompt?.includes('ADVISOR agent of JARVIS') ||
            !stored.agents?.advisor?.systemPrompt?.includes('Fact Checker') ||
            !stored.agents?.advisor?.systemPrompt?.includes('text-based diagram') ||
            !stored.agents?.advisor?.systemPrompt?.includes('HUMAN-AI & PERSONAL COMPARISONS')
              ? DEFAULT_AGENT_SYSTEM_PROMPTS.advisor
              : stored.agents.advisor.systemPrompt,
        },
        factChecker: {
          ...DEFAULT_JARVIS_CONFIG.agents.factChecker,
          ...(stored.agents.factChecker || {}),
          systemPrompt:
            !stored.agents.factChecker?.systemPrompt ||
            !stored.agents.factChecker.systemPrompt.includes('dateStatus') ||
            !stored.agents.factChecker.systemPrompt.includes('eventDate') ||
            !stored.agents.factChecker.systemPrompt.includes('Date Status Classification')
              ? DEFAULT_AGENT_SYSTEM_PROMPTS.factChecker
              : stored.agents.factChecker.systemPrompt,
        },
        reviewer: {
          ...DEFAULT_JARVIS_CONFIG.agents.reviewer,
          ...(stored.agents.reviewer || {}),
          systemPrompt:
            !stored.agents.reviewer?.systemPrompt ||
            !stored.agents.reviewer.systemPrompt.includes('TOP N NEWS') ||
            !stored.agents.reviewer.systemPrompt.includes('Global / broad impact') ||
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
            !stored.agents.finalSynthesizer?.systemPrompt?.includes('ADVISOR AGENT OUTPUT') ||
            !stored.agents.finalSynthesizer?.systemPrompt?.includes('Do NOT use LaTeX math syntax') ||
            !stored.agents.finalSynthesizer?.systemPrompt?.includes('CURRENT-YEAR SOURCE PRIORITY RULE') ||
            !stored.agents.finalSynthesizer?.systemPrompt?.includes('RELEVANCE & TOPIC MISMATCH SAFETY CHECK') ||
            !stored.agents.finalSynthesizer?.systemPrompt?.includes('REVIEWER RECOMMENDATIONS & CONTENT SELECTION') ||
            !stored.agents.finalSynthesizer?.systemPrompt?.includes('SPECIFIC COUNT & SHORTFALL EXPLANATION') ||
            !stored.agents.finalSynthesizer?.systemPrompt?.includes('CRITICAL USER IDENTITY & ANTI-MISATTRIBUTION RULE') ||
            !stored.agents.finalSynthesizer?.systemPrompt?.includes('JARVIS MULTI-AGENT ARCHITECTURE')
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
