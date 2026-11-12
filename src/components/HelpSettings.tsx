import { useState } from 'react';
import {
  BookOpen,
  Copy,
  Check,
  Cpu,
  Search,
  Terminal,
  Server,
  Palette,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  Globe,
  Radio,
  Volume2,
  FileText,
  MessageSquare,
  Bot,
  Smartphone,
  Send,
  Sliders,
  Tv,
  Brain,
  Key,
  Clock,
  Database,
  Mic,
  Image as ImageIcon,
  Wand2,
  Orbit,
  Zap,
  Users,
  Workflow,
  GraduationCap,
  Swords,
  Code2,
} from 'lucide-react';
import { copyToClipboard } from '@/lib/clipboard';
import { playTapSound } from '@/lib/audio';

interface DocSection {
  id: string;
  title: string;
  badge: string;
  icon: typeof BookOpen;
  text: string;
}

export function HelpSettings() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Section 1: Overview
  const overviewText = `### 1. Overview — What NEXUS Is & Main Features

**NEXUS Intelligence** is an enterprise-grade multi-agent autonomous AI workstation, neural research lab, visual workflow automation studio, and real-time telemetry matrix. At its core, NEXUS coordinates specialized artificial intelligence agents through the **JARVIS Autonomous Multi-Agent Cognitive Matrix**, **Parallax 20-Agent Swarm Arena**, and **AI Assistant Tactical Units**, bridging high-level reasoning with live web groundings, academic scholar engines, encyclopedic knowledge graphs, on-device vector document vaults (RAG), hardware controls, and multi-provider language models.

#### Key Platform Capabilities:
- **JARVIS Multi-Agent Matrix (\`/\`)**: Sequential and parallel cognitive pipelines uniting 10+ specialized agents (Planning, Research, Fact-Checking, Strategic Advisory, Audit Review, Final Synthesis, System Architecture, Data Analysis, Media Discovery, and Fast/Online Coding) plus the 5-node Dynamic Specialist Pipeline ("New Agent") with full source attribution.
- **Parallax 20-Agent Swarm & Genesis Arena (\`/parallax\`)**: Up to 20 autonomous AI agents deliberating across 3 rounds with configurable Swarm Size, Genesis Dynamic Architect Mode, 8 Debate Formats (Default, Genesis, Courtroom, Red vs Blue, Senate, VC Pitch, Sci-Fi, News), Devil's Advocate injection, human-in-the-loop turn injection, and neural voice synthesis.
- **AI Assistant, Tutor Mode, Commander Unit & Live Artifact Canvas (\`/assistant\`)**: Direct conversational companion featuring an interactive Socratic **Tutor Mode** (Beginner/Intermediate/Advanced, Explain → Example → Practice → Quiz), a 4-stage **Commander Tactical Unit** (Commander + Agent Alpha + Agent Beta + Master Synthesizer), inline **Swarm Live**, **Scholar Search** (OpenAlex, Semantic Scholar, NASA ADS, arXiv), and a side-by-side **Live Artifact Canvas** sandbox for HTML/CSS/JS/React/SVG execution.
- **Multi Chat & Advanced Deliberation Lab (\`/multichat\`)**: 3-persona sequential deliberation (NOVA, ORBIT, COSMOS) upgraded with Dialogue Modes (Harmony, Debate, Parallel, Relay), 5 Roleplay Scenarios, 4 Guest Specialists (CFO, Cyber, UX, Legal), Alignment Radar, Decision Matrix, Fact Matrix, Stress Test Pivot, Study Deck (Flashcards & Quiz), Cherry-Pick Mixer, Hot Seat, and Podcast Script generator.
- **Visual Workflows Studio (\`/workflows\`)**: Node-based visual automation canvas connecting Input, Web Search, Web Fetch, Scholar Search, AI Prompt, Image Generation, Weather, NASA Space, and Conditional IF/ELSE branching nodes with node freezing, mock outputs, and execution history.
- **Custom AI Skills System (\`Settings > Skills\`)**: Import from GitHub or author up to 5 custom Markdown/instruction skills (up to 3 active simultaneously, 24,000 chars per skill) injected into Assistant, JARVIS, and Multi Chat personas.
- **Multi-Provider Neural Backbone**: Native configuration support for 10+ major AI providers including OpenAI, Anthropic Claude, Google Gemini, Groq (Llama 3), Mistral, Perplexity, OpenRouter, Cloudflare Workers AI, and custom OpenAI-compatible endpoints with automated runtime failover.
- **On-Device Document Library & Semantic Vector RAG**: Privacy-first local IndexedDB vector vault supporting PDF, DOCX, TXT, CSV, MD, JSON, and pasted text with semantic chunking, cosine similarity search, custom renaming, in-place text editing with instant re-indexing, and automated synthesis grounding.
- **Hybrid Credential Architecture**: Seamless two-tier credential resolution combining container-level host environment variables (Render) with an encrypted AES-256 local vault (\`data/api_catalog.json\`).
- **Telemetry & Peripheral Hardware Bridges**: Real-time atmospheric weather tracking (OpenWeatherMap), NASA deep space intelligence (APOD & Near-Earth Object Asteroid radar), ADB-over-Network Smart TV remote controller, and autonomous Telegram Bot synchronization.`;

  // Section 2: JARVIS Agent Pipeline
  const pipelineText = `### 2. JARVIS Agent Pipeline — Roles & Autonomous Workflows

The JARVIS architecture rejects single-prompt hallucination in favor of a rigorous, multi-stage cognitive pipeline. Each agent possesses a tailored system prompt, dedicated schema boundaries, and surgical task assignments:

1. **Planner (Agent 1 - Cognitive Orchestrator)**:
   - **Role**: Dissects the user's prompt, classifies intent, and compiles an atomic execution plan.
   - **Mechanism**: Dynamically flags pipeline requirements (\`needsResearch\`, \`needsWikipedia\`, \`needsWikidata\`, \`needsFactCheck\`, \`needsKnowledgeAgent\`, \`needsReview\`, \`needsDiagram\`, \`needsChart\`, \`needsImage\`), and separately detects coding requests via the isCodingQuery() function or explicit /code and /codeonline slash commands (not a Planner JSON flag). It sanitizes raw search queries, extracts target entities, and detects explicit command overrides.

2. **Researcher (Agent 2 - Information Retrieval Engine)**:
   - **Role**: Executes multi-source web, news, and knowledge-base data gathering.
   - **Mechanism**: Queries Tavily for semantic web results, triggers the 3-tier news fallback stack for timely coverage, and queries Wikipedia/Wikidata for foundational definitions and structured properties. For \`/codeonline\` pipelines, strictly prioritizes official developer documentation, official source repositories, and framework release notes over personal blogs. Deduplicates results and compiles verified source citations.

3. **Fact Checker (Agent 3 - Autonomous Truth & Consistency Auditor)**:
   - **Role**: Rigorously evaluates research claims against authoritative sources to prevent hallucinations.
   - **Mechanism**: Audits temporal anchors (dates, years), quantitative figures, statistical percentages, and named entities. Assigns an overall factual confidence score (High/Medium/Low) and outputs explicit validation notes or contradiction alerts.

4. **Advisor (Agent 3.5 / Knowledge Agent - Strategic & Domain Specialist)**:
   - **Role**: Provides contextual depth, strategic foresight, and domain-specific analysis.
   - **Mechanism**: Evaluates the broader implications of the findings, assessing practical risks, market dynamics, architectural tradeoffs, second-order consequences, and actionable recommendations.

5. **Reviewer (Agent 4 - Pre-Synthesis Quality Control)**:
   - **Role**: Performs an executive structural and logical critique prior to final publication.
   - **Mechanism**: Ingests all upstream outputs (Planner, Researcher, Fact Checker, Advisor). Identifies residual ambiguities, flags unsupported statements, evaluates argumentative coherence, and issues direct structural guidance to the Final Synthesizer.

6. **Final Synthesizer (Agent 5 - Unified Intelligence Voice)**:
   - **Role**: Transforms raw analytical outputs into a cohesive, publication-grade intelligence briefing.
   - **Mechanism**: Crafts clean Markdown reports structured with executive summaries, analytical deep dives, formatted comparison tables, structured bullet points, and inline superscript citations linking back to original sources. Seamlessly incorporates retrieved semantic chunks from the on-device Document Library when "Search My Docs" is active.

7. **Architect (Agent 8 - Specialized System Designer)**:
   - **Role**: Generates software architectures, infrastructure blueprints, and visual diagrams.
   - **Mechanism**: Activated automatically for software, cloud, or algorithmic prompts. Produces structured ASCII schematics and interactive, dark-mode vector SVG diagrams with animated connection nodes.

8. **Data Analyst (Agent 9 - Quantitative Specialist)**:
   - **Role**: Structures numerical data, statistical trends, and metric comparisons.
   - **Mechanism**: Triggered by financial, numerical, or metric queries. Extracts numerical series, generates structured Markdown tables, and outputs interactive Recharts visual components (line charts, bar charts, scorecards).

9. **Image Finder (Agent 11 - Visual Asset Curator)**:
   - **Role**: Gathers high-resolution contextual photography and technical graphics.
   - **Mechanism**: Queries Pixabay and Wikimedia Commons for royalty-free visual assets matching researched entities, presenting them in an interactive lightbox gallery.

10. **Coder (Agent 10 - Software Engineering Specialist)**:
    - **Role**: Writes, debugs, and optimizes production-ready code, scripts, and algorithms across modern tech stacks.
    - **Mechanism**:
      - **Standard Mode (\`/code\`)**: Fast 2-agent pipeline (Planner → Coder) bypassing research overhead for immediate code output.
      - **Live Research Mode (\`/codeonline\`)**: Specialized 3-agent pipeline (Planner → Researcher → Coder) that executes real-time web research and injects fresh official documentation directly into the Coder's prompt. Enforces strict live research prioritization over model training biases, package name consistency (matching \`npm install\` packages with exact runtime \`import\` specifiers), scope relevance isolation, and on-device Document Library RAG context injection.`;

  // Section 3: How Researcher Fetches Data
  const researcherText = `### 3. How Researcher Fetches Data — Multi-Tier Retrieval & Fallback Stacks

The Researcher agent operates on a layered, fail-safe data pipeline designed for high availability and zero-downtime information retrieval:

#### A. Intelligent Search vs. News Routing
- **Analytical & Live Inquiries**: Queries mentioning *"latest updates"*, *"recent developments"*, or specific technical updates automatically route to live semantic search engines (Tavily / DuckDuckGo) with \`needsResearch: true\` and \`needsNews: false\` to retrieve comprehensive technical context rather than transient news headlines.
- **Explicit Breaking News**: Queries explicitly requesting news headlines or breaking stories activate the 3-tier news fallback chain.

#### B. The Resilient 3-Tier News Fallback Chain
To guarantee real-time news retrieval even during third-party service outages or quota exhaustion:
1. **Tier 1 — GNews API**: The system first attempts to query \`https://gnews.io/api/v4/search\` using \`GNEWS_API_KEY\`. GNews provides high-quality, international, categorized headlines with publication timestamps and publisher metadata.
2. **Tier 2 — NewsData.io Fallback**: If GNews is unconfigured, rate-limited (HTTP 429), or encounters an error, the pipeline immediately cascades to \`https://newsdata.io/api/1/news\` via \`NEWSDATA_API_KEY\`, ensuring multi-lingual redundancy.
3. **Tier 3 — Google News RSS Scraper**: If both commercial API keys are unavailable, depleted, or fail, the system automatically falls back to parsing the Google News RSS feed (\`https://news.google.com/rss/search?q={query}\`) on the fly. This guarantees that news queries ALWAYS return real-time headlines with zero API key dependencies.

#### C. Tavily Semantic Web Search & Official Docs Prioritization
- Serves as the primary engine for deep web intelligence and extraction via \`TAVILY_API_KEY\`.
- Executes semantic queries, crawls relevant web pages, extracts raw text passages, summarizes findings, and provides canonical source domain citations.
- When Tavily is not configured, the engine seamlessly falls back to DuckDuckGo HTML parsing and encyclopedic synthesis.

#### D. Wikipedia & Wikidata Knowledge Graph Lookups
- **Wikipedia REST API**: Targets canonical summaries from \`https://en.wikipedia.org/api/rest_v1/page/summary/{title}\` with automated fallback to the MediaWiki Action API (\`action=query&prop=extracts\`) for authoritative definitions, entity summaries, and official titles.
- **Wikidata Semantic Entities**: Queries \`https://www.wikidata.org/wiki/Special:EntityData/{QID}.json\` to extract structured properties (founding dates, coordinates, parent organizations, headquarters, identifiers).
- **Intelligent Suppression**: The Planner automatically sets \`needsWikipedia: false\` and \`needsWikidata: false\` during explicit \`/search\`, \`/web\`, and \`/customapi\` commands to eliminate redundant overhead and maximize response speed.`;

  // Section 4: Slash Commands
  const slashCommandsText = `### 4. Slash Commands — Syntax, Pipeline Routing & Examples

NEXUS includes dedicated slash commands that allow users to override normal planning and directly steer the JARVIS pipeline:

#### 1. \`/search [query]\` — Live Web Search Override
- **What it does**: Forces the JARVIS pipeline to perform immediate live web research using search engines, completely bypassing Wikipedia and Wikidata entity lookups.
- **Pipeline Behavior**: Sets \`needsResearch: true\` on the cleaned query string, strips command prefixes, and instructs the Researcher to collect live web results. Synthesizer presents verified real-time sources.
- **Example**:
  \`/search latest James Webb space telescope exoplanet discoveries 2025\`
  \`/search Apple M4 Max chip benchmark comparison vs RTX 4090\`

#### 2. \`/web [URL]\` — Direct Webpage Extraction & Analysis
- **What it does**: Ingests and inspects the exact contents of any specific public web page without intermediate search engine filtering.
- **Pipeline Behavior**: Automatically bypasses standard web search, Wikipedia, and fact-checking routines. Fetches clean markdown text from the target URL via a high-speed reader proxy (\`r.jina.ai\`), feeding the raw web document directly into the Planner and Final Synthesizer for summarization, deep Q&A, or extraction.
- **Example**:
  \`/web https://en.wikipedia.org/wiki/Quantum_supremacy\`
  \`/web https://news.ycombinator.com\`

#### 3. \`/customapi [api_name] [query]\` — Direct Custom API Execution
- **What it does**: Directly invokes any custom REST API registered in your Settings > API Catalog, returning real-time upstream data grounded by the Final Synthesizer.
- **Pipeline Behavior**: Bypasses general web search, Wikipedia, Advisor, and Reviewer. Runs **Step 1.55: Custom API Runner**, querying your configured Base URL using the resolved API credentials (from Render or the encrypted vault). Sends the raw JSON payload straight into the Final Synthesizer to produce clear markdown summaries, tables, and citations.
- **Example**:
  \`/customapi weatherstack Tokyo\`
  \`/customapi coingecko bitcoin\`
  \`/customapi news-hub artificial intelligence\`

#### 4. \`/code [prompt]\` — High-Speed Code Architecture Pipeline
- **What it does**: Activates a specialized 2-agent pipeline (Planner -> Coder) designed specifically for fast programming, debugging, and software architecture.
- **Pipeline Behavior**: Bypasses research, fact-checking, and synthesis overhead to produce production-ready code, unit tests, and structural notes with minimal latency.
- **Example**:
  \`/code implement a distributed rate limiter in TypeScript with Redis\`
  \`/code write a Python script to monitor SSL certificate expirations\`

#### 5. \`/codeonline [prompt]\` — Live Research-Grounded Code Pipeline
- **What it does**: Activates a specialized 3-agent pipeline (Planner -> Researcher -> Coder) that executes real-time web research for the latest APIs, documentation, SDKs, and libraries before generating production code.
- **Pipeline Rules & Behaviors**:
  - **Live Research Prioritization**: The Coder agent strictly prioritizes the Researcher's live findings over its own internal training knowledge whenever there is a syntax or version conflict (e.g. Tailwind v4 @import syntax over v3 @tailwind directives).
  - **Package Name Consistency Rule**: Strictly ensures that package names in installation commands match the exact runtime import specifiers used in code (e.g., \`npm install react-router\` with \`import { ... } from 'react-router'\`, never importing from legacy \`react-router-dom\`).
  - **Scope Relevance Rule**: Strips unrelated third-party platform code found in sample repositories that the user never asked for.
  - **Document Library RAG Support**: When "Search My Docs" is enabled, retrieved local document chunks from your on-device library are injected directly into the Coder's prompt alongside live web findings.
- **Example**:
  \`/codeonline build a Next.js 15 app using Server Actions and Auth.js v5\`
  \`/codeonline implement OpenAI Assistants API with streaming in Python 3.12\`
  \`/codeonline create a Tailwind v4 custom theme with color variables\`

#### 6. \`/image [description]\` (or \`/images\`) — Direct Image Finder (Dual Photo & AI Visual)
- **What it does**: Directly invokes the Image Finder agent's dual visual sourcing behavior, discovering real-world Wikipedia/Wikimedia photos alongside high-fidelity AI-generated visuals side by side.
- **Pipeline Behavior**: Bypasses the Final Synthesizer agent, Deep Research Mesh, and QA steps entirely for maximum speed. Directly outputs high-resolution image cards with a concise caption like \`Here's your image for: "<prompt>"\` without redundant paragraphs, comparison tables, or bracketed text.
- **Example**:
  \`/image Tokyo skyline at dusk\`
  \`/image James Webb Space Telescope deep field galaxy\`
  \`/image Cyberpunk hovercar in neon rain\`

#### 7. \`/imageai [description]\` (or \`/imagesai\`) — Direct AI Image Synthesis
- **What it does**: Directly triggers AI image generation using the active Image AI Provider (Pollinations, Hugging Face, Puter.js, or Cloudflare Workers AI), skipping Wikipedia photo search entirely.
- **Pipeline Behavior**: Bypasses the Final Synthesizer and external research steps to instantly generate and render high-fidelity AI visual cards with a simple direct caption and inspectable metadata.
- **Example**:
  \`/imageai isometric futuristic laboratory with glowing blue crystals\`
  \`/imagesai photorealistic portrait of an astronaut on Mars\`

#### 8. \`/promptimage [rough idea]\` — Instant AI Image Prompt Synthesizer
- **What it does**: Bypasses the full research pipeline and makes a single call to your active text AI model to generate exactly 5 distinct, highly detailed, vivid image generation prompt variations exploring different angles, styles, and mood focuses.
- **Interactive Actions**: Displays an interactive card for each prompt with one-click "Use This Prompt" (clipboard copy), "Image Studio" jump with preloaded prompt, "/imagesai" instant AI generation, and a "🔄 Generate 5 More" button to produce fresh variations.
- **Example**:
  \`/promptimage a dragon made of stained glass\`
  \`/promptimage futuristic coffee shop in Tokyo at night\`

#### 9. \`/newagent [task]\` (or \`/new_agent\`) — Dynamic Specialist Pipeline Override
- **What it does**: Forces the 5-node Dynamic Specialist Pipeline (Planner → 3 Dynamic Domain Specialists → Final Synthesizer) for a single query, regardless of whether the "New Agent" toggle is currently ON or OFF in the UI.
- **Pipeline Behavior**: Bypasses the UI toggle state for this one query without mutating the persistent toggle setting. The user's exact task text after the command is passed to the Planner, which dynamically creates 3 custom specialists tailored to the task with specific roles, system prompts, and assigned tools (Search, Wikipedia, News, Weather, Web Fetcher). Each specialist executes using its assigned Specialist Slot model configuration (Slot 1, Slot 2, Slot 3), and the Final Synthesizer produces a cohesive intelligence briefing labeled "Mode: Dynamic Specialist Pipeline (New Agent)".
- **Example**:
  \`/newagent What is the environmental and economic impact of switching to electric vehicles?\`
  \`/newagent Compare RISC-V vs ARM architectures for embedded IoT edge devices\``;

  // Section 5: API Catalog
  const apiCatalogText = `### 5. API Catalog — Credential Architecture & Custom API Registration

The NEXUS Backend API Catalog provides a secure, production-grade management layer for third-party keys and custom REST endpoints.

#### A. Two-Tier Credential Resolution Hierarchy
NEXUS uses a strict security hierarchy to resolve API credentials at runtime:
1. **Tier 1: System Environment (Render / Container Host)**:
   - The server first inspects \`process.env[KEY]\`.
   - Any credentials declared in your hosting environment (Render Environment Variables, Docker container env, or local \`.env\`) take absolute precedence.
   - For security, these are marked with a green **Render System** badge and cannot be modified or exposed by browser clients.
2. **Tier 2: Encrypted Local Vault (\`data/api_catalog.json\`)**:
   - If an environment variable is not defined in the host system, the server falls back to an encrypted local file vault.
   - Keys added or updated through the UI are encrypted at rest using server-side AES storage.
   - This allows users to configure services on the fly without restarting production cloud servers.

#### B. How to Register a Custom API
1. Navigate to **Settings > ⚡ API Catalog**.
2. Click **+ Add Custom API** to open the Render-style configuration modal.
3. **Environment Variable / Key Name**: Enter the identifier (e.g. \`WEATHERSTACK_API_KEY\`).
4. **Value**: Enter the API key (masked with eye-toggle, quick copy, and delete controls).
5. **Base URL**: Enter the REST endpoint URL (e.g. \`https://api.weatherstack.com/current\`).
6. **Query Parameter Name**: Enter the search parameter expected by the API (e.g. \`q\`, \`query\`, \`city\`, \`symbol\`). Defaults to \`q\` if left blank.
7. *(Optional)* Expand **Advanced Options** to specify a custom Display Name, Documentation URL, and description.
8. Click **Save & Register Custom API**.
9. Test the endpoint immediately using the **Test** button in the catalog table, or invoke it anywhere in JARVIS via \`/customapi [api_name] [query]\`.`;

  // Section 6: Theme & Customization
  const themeCustomizationText = `### 6. Theme, Customization & Audio Engine

NEXUS is designed for immersive, tactile research with visual, auditory, and archival customization across the entire platform:

#### A. 3 Global Visual Themes (Minimal, Classic, Full Dark)
- Switchable in **Settings > Appearance** and unified across JARVIS, Multi Chat, Parallax Swarm, and AI Assistant:
  1. **Minimal (Obsidian Studio)**: Clean, precision dark-slate geometry with subtle 1px borders and zero visual clutter.
  2. **Classic (Tactical Cyan / Stitch Cyber)**: Signature NEXUS tactical HUD aesthetic with vibrant cyan accents, holographic status badges, and ambient depth.
  3. **Full Dark (OLED Pitch Black)**: Pure #000000 zero-glare aesthetic engineered for OLED displays, maximum contrast, and extended night research sessions.

#### B. JARVIS Synthesis Card Theme Toggle
- Located on JARVIS chat synthesis headers and saved report cards (sparkle icon), allowing instant per-report toggling between **Tactical Cyan** and **OLED Deep Black**.

#### C. Saved Intelligence Repository (\`/saved\`)
- Accessible from the main navigation bar to bookmark, tag, and organize full JARVIS synthesis reports, system architecture diagrams, and analytical charts.
- Features:
  - **Category Filtering**: Filter across All, JARVIS Syntheses, Architecture Diagrams, and Data Charts.
  - **Raw Markdown Toggle**: Switch between rendered rich HTML typography and raw Markdown code.
  - **Single-Click Exports**: Copy rich formatted HTML for Google Docs/Word, raw Markdown for GitHub/Obsidian, or print/save to PDF.

#### D. Edge Neural Text-to-Speech (TTS) & Tactical Audio
- Integrated voice synthesis engine powered by Microsoft Edge neural models (\`/api/edge-tts\`) with natural intonation, cadence, and browser Web Speech API fallback.
- Subtle acoustic clicks and mechanical audio feedback when executing commands, switching tabs, and navigating the interface (toggleable in **Settings > Appearance**).`;

  // Section 7: Multi Chat
  const multiChatText = `### 7. Multi Chat — 3-Persona Deliberation Matrix & Advanced Lab Tools

**Multi Chat** (/multichat) is a collaborative multi-persona conversational lab where three core AI agents—plus optional Guest Specialists—deliberate across customizable dialogue topologies and analytical views.

#### A. The 3 Core Personas & 4 Guest Specialists:
1. **NOVA (Professional & Factual — The Researcher)**: Analytical, rigorous, structured, and empirical. Establishes the factual baseline and data breakdown.
2. **ORBIT (Casual & Friendly — The Buddy)**: Approachable, witty, and practical. Translates complex jargon into everyday metaphors and real-world trade-offs.
3. **COSMOS (Calm & Wise — The Mentor)**: Philosophical, reflective, and strategic. Synthesizes NOVA and ORBIT into a high-altitude holistic takeaway.
4. **On-Demand Guest Specialists**: Summon domain experts into any round: **CFO** (Financial & ROI Modeling), **Cyber** (Security & Threat Modeling), **UX** (Human-Centered Design), and **Legal** (Compliance & Risk).

#### B. Dialogue Topologies & Roleplay Scenarios
- **4 Dialogue Modes**:
  - **Harmony**: Collaborative sequential synthesis where each persona builds on prior points.
  - **Debate**: Adversarial cross-examination exposing flaws and counterarguments.
  - **Parallel**: Independent simultaneous responses without upstream bias.
  - **Relay**: Fast baton-passing chain where each persona completes a distinct phase of the task.
- **5 Built-In Scenarios**: *Startup Pitch*, *Code Review*, *War Room*, *Socratic Trial*, and *Courtroom*.

#### C. Advanced Analytical Views & Interactive Lab Tools
- **Alignment Radar & Consensus Meter**: Visualizes agreement vs. divergence across personas.
- **Decision Matrix & Fact Matrix**: Structured multi-criteria scoring tables and cross-verified factual claim matrices.
- **Stress Test Pivot & Hot Seat**: Inject surprise crisis variables or place a single persona under direct interrogation.
- **Study Deck (Flashcards & Quiz)**: Automatically transforms any multi-persona deliberation into interactive flip flashcards and self-grading quizzes.
- **Cherry-Pick Mixer**: Select the best paragraphs from NOVA, ORBIT, and COSMOS to synthesize a custom master response.
- **Podcast Script & Neural Audio**: Converts the 3-persona conversation into a natural radio-style podcast script with Edge Neural TTS playback and MP3 download.
- **20-Message Rolling Memory & Permanent Memories**: Retains conversational context across 20 turns alongside persistent user facts.`;

  // Section 8: AI Assistant
  const assistantText = `### 8. AI Assistant — Direct Companion, Specialist Modes & Smart Memory

The **AI Assistant** (/assistant) is a high-speed, multi-session conversational workstation combining low-latency chat with modular specialist pipelines, academic paper discovery, Socratic tutoring, tactical multi-agent command, and live interactive code previewing.

#### A. How AI Assistant Differs from JARVIS, Multi Chat & Parallax:
- **JARVIS Matrix (\`/\`)**: 10-agent deep research engine for comprehensive intelligence reports, fact-checking, Wikidata graphs, and full telemetry.
- **Multi Chat (\`/multichat\`)**: 3-persona deliberation panel (NOVA, ORBIT, COSMOS) with structured debate tools and decision matrices.
- **Parallax (\`/parallax\`)**: 20-agent multi-round swarm arena for massive parallel perspective exploration.
- **AI Assistant (\`/assistant\`)**: Fast, versatile daily companion with multi-chat session history, on-demand Specialist Modes, Tutor Mode, Commander Unit, and Live Artifact Canvas.

#### B. Core Capabilities & Specialist Modes:
- **Modular Specialist Modes**:
  - **Commander Mode**: 4-stage tactical unit (Strategic Commander + Agent Alpha + Agent Beta + Master Synthesizer) with Auto/Manual orchestration, Effort Levels (Small/Medium/High), and per-agent model selection.
  - **Swarm Live**: Inline multi-agent swarm deliberation streamed directly inside the Assistant chat feed.
  - **Tutor Mode**: Interactive Socratic learning engine with Learner Level (Beginner, Intermediate, Advanced), Goal (Learn, Exam prep, Refresher), 4-stage stepper (Explain → Example → Practice → Quiz), and one-tap learning actions.
  - **Scholar Search**: Queries academic repositories (OpenAlex, Semantic Scholar, NASA ADS, arXiv) with citation counts, abstracts, and DOI/PDF links.
  - **Architect, Data Analysis, Coder (\`/codeonline\`), Web Fetcher (\`/web\`), Multi Chat & Wikimedia**: Instant access to SVG blueprints, Recharts analytics, live-researched code, webpage extraction, and Wikimedia Commons photography.
- **Live Artifact Canvas**: Side-by-side interactive sandbox that renders HTML, CSS, JavaScript, React/TSX, and SVG code blocks into a live preview with desktop/tablet/mobile viewport toggles, console logs, and fullscreen inspection.
- **Multi-Session Chat History & Smart Memory**: Manage multiple archived chat sessions with automatic prefix deduplication and a persistent 2,200-character Smart Memory scratchpad editable via the Brain icon.`;

  // Section 9: Devices
  const devicesText = `### 9. Devices Dashboard — Fleet Monitoring & Hardware Bridges

The **Devices Dashboard** (/devices) is NEXUS's central hardware control plane for monitoring device health, network connectivity, battery telemetry, and peripheral bridges.

#### A. Telemetry & Fleet Status Counts
- Real-time counters at the top of the dashboard track:
  - **Online**: Devices actively reporting heartbeats and communicating with the server.
  - **Warning**: Devices experiencing degraded connections, elevated latencies, or battery levels under 20%.
  - **Offline**: Registered devices that have timed out or disconnected.
  - **Total**: Full count of paired hardware in your fleet.

#### B. The Add Device Pairing Workflow
1. Click **+ Add Device** on the dashboard to open the multi-device connection wizard.
2. Select the target device platform:
   - **Android Agent (Real / Supported)**: Pair smartphones running the NEXUS Agent APK by generating and entering a secure pairing code (e.g., NX-4892).
   - **Smart TV (Real / Supported)**: Connect Android TV, Google TV, or LG webOS displays over the local network. Supports automatic TLS port 6466/6467 PIN pairing and ADB port 5555.
   - **Computer / Cloud (Coming Soon)**: Dedicated daemons for Linux servers, macOS, and Windows workstations.
   - **Smart Home (Coming Soon)**: IoT integrations for smart lights, thermostats, and Zigbee/Matter hubs.

#### C. Android Agent Live Telemetry Self-Reporting
- When running within the native Android APK (or Capacitor native bridge), the Android Agent runs a lightweight background telemetry reporter:
  - **Battery Telemetry**: Real-time battery percentage (%) and charging state (Charging vs Not Charging).
  - **Network Diagnostics**: Detects connection interface (Wi-Fi, Mobile Data, or Offline).
  - **System Metadata**: Reports hardware model, Android OS version, and uptime heartbeats every 60 seconds directly to /api/devices/telemetry.
  - **Granular Permissions**: Toggle individual monitoring permissions (Battery Info, Storage, Network Info, Remote Control) per device.`;

  // Section 10: Telegram Bot
  const telegramBotText = `### 10. Telegram Bot — Autonomous Remote Gateway & Automations

The **Telegram Bot** bridge (/telegram or Settings > Telegram) transforms NEXUS into a 24/7 personal autonomous AI assistant accessible directly from any Telegram client worldwide.

#### A. Connecting Your Bot (Bot Token & Chat ID)
1. Message **@BotFather** on Telegram and create a new bot using /newbot.
2. Copy the generated API Token (e.g. 789123456:AAFlk...).
3. Paste the Token into **Settings > Telegram** and provide an optional default **Chat ID** (obtainable by messaging your bot or using @userinfobot).
4. Click **Connect Bot**: The backend verifies the token via Telegram getMe, automatically registers commands via setMyCommands, and launches a resilient single-instance long-polling loop.

#### B. Security & Allowed Users Whitelist
- To prevent unauthorized users from consuming your API quotas or querying your server, NEXUS includes an **Allowed Users / Chat IDs** whitelist.
- Enter allowed usernames (e.g. @myusername) or numeric Telegram Chat IDs.
- When configured, all unauthorized messages and inline button callbacks are blocked immediately, and logged with sender details in the real-time **Telegram Activity Log**.

#### C. Available Bot Commands
- **/weather [city]** — Live atmospheric conditions, temperature, humidity, wind speed, precipitation probability, and sunrise/sunset times (e.g. /weather Tokyo).
- **/search <query>** — Full web and knowledge search with synthesized AI summaries and citations (e.g. /search James Webb Space Telescope).
- **/news** — Real-time top global news headlines and breaking updates via the 3-tier news fallback chain.
- **/space** — Real-time International Space Station (ISS) orbital coordinates, speed, and current Moon phase.
- **/help** — Interactive help guide and quick-action reference.
- **/start** — Welcome introduction and interactive quick-reply keyboard.

#### D. Smart Scheduled Automations & Alerts
- **Scheduled Daily Weather**: Automatically compiles and sends a complete morning weather forecast at your configured time (e.g., 07:00) for your specified city.
- **Rain & Storm Alerts**: Automatically monitors live meteorological radar and sends proactive rain warnings when precipitation chance reaches >= 60%.
- **ISS Overhead Radar Alert**: Calculates Great Circle orbital distance and alerts you when the International Space Station passes within 500 km of your latitude/longitude.
- **Interactive Quick-Reply Keyboard**: Attaches inline action buttons (Weather, Search, Space, News) beneath bot responses for instant one-tap navigation.`;

  // Section 11: Document Library
  const documentLibraryText = `### 11. Document Library & On-Device Vector Vault (RAG)

The **Document Library** (Settings > 📚 Document Library) is NEXUS's local, privacy-first vector knowledge vault and Retrieval-Augmented Generation (RAG) engine running entirely within your browser's IndexedDB database.

#### A. Architecture & Storage Guarantees
- **100% Client-Side Privacy**: Documents, parsed text, and vector chunks are saved strictly inside your local browser's IndexedDB (\`nexus_document_library\`). No document files are ever uploaded or stored on external backend servers.
- **Capacity & Quotas**: Supports up to 50 MB total library storage and 50 MB per document, backed by live capacity meters.
- **Supported Formats**: Ingests PDF documents (\`.pdf\`), Microsoft Word files (\`.docx\`), Plain Text (\`.txt\`), CSV datasets (\`.csv\`), Markdown (\`.md\`), JSON (\`.json\`), Log files (\`.log\`), and direct raw clipboard text.

#### B. Semantic Chunking & Vector Search Engine
- **Text Extraction & Segmentation**: Automatically parses incoming documents into semantic chunks (~750 characters with overlapping boundaries) to preserve context.
- **Vector Embeddings**: Calculates high-dimensional vector embeddings stored alongside chunks in IndexedDB.
- **Cosine Similarity Retrieval**: Executes client-side cosine similarity vector scoring to find the top most relevant chunks for any natural language query in milliseconds.

#### C. RAG Integration in JARVIS & /codeonline
- **"Search My Docs" Toggle**: When enabled during JARVIS inquiries, relevant document chunks are automatically retrieved and injected into the Final Synthesizer's prompt with explicit document citations (\`[Document: '...']\`).
- **/codeonline Integration**: When coding with live research, retrieved chunks from your local technical docs are seamlessly combined with live web research findings to guide the Coder agent.

#### D. Document Management Features
- **Inclusion Toggle**: Selectively toggle individual documents on/off to control which files participate in JARVIS searches.
- **Quick Preview**: View extracted text snippets directly in the document list without opening external viewers.
- **Rename**: Click the pencil icon to assign custom display names to any document (updates citations while preserving internal IDs and upload timestamps).
- **In-Place Edit & Re-Index**: For text documents and pasted notes, click **Edit** to modify full text in-browser. Saving automatically re-segments, re-indexes vectors, and atomically replaces old chunks in IndexedDB.
- **Interactive Search Sandbox**: Test your library retrieval with live search queries and similarity score diagnostics directly inside the settings panel.`;

  // Section 12: Voice AI Studio & Real-Time Live Streaming
  const voiceAiStudioText = `### 12. Voice AI Studio & Real-Time Live Streaming (24kHz Studio PCM & Ask AI Pipeline)

The **Voice AI Studio** (/voice-ai) is NEXUS's high-fidelity audio engineering workstation, integrating local neural voice synthesis with studio-grade bidirectional WebSocket live streaming and real-time conversational AI integration.

#### A. Dual Voice Engine Architecture
1. **Edge Neural Voice TTS (40+ International Voices)**:
   - High-speed neural speech synthesis powered by Edge TTS models (\`/api/edge-tts\`).
   - Features 40+ multilingual expressive voices across English, Spanish, French, German, Japanese, Chinese, Hindi, and more.
   - Zero-configuration, free tier with instant audio preview, MP3 export, and real-time speech rate and pitch adjustments.
2. **Cloud Voice AI (ElevenLabs WebSocket Streaming)**:
   - Studio-grade cloud voice synthesis utilizing ElevenLabs high-speed models (\`eleven_turbo_v2_5\`, \`eleven_multilingual_v2\`).
   - Delivers uncompressed **24 kHz linear PCM** audio streams over binary WebSockets with immediate time-to-first-chunk (< 350ms).

#### B. Persistent Live Session & Gapless Audio Queue
- **Persistent WebSocket Session**: Clicking "Start Live Session" opens a persistent, bidirectional WebSocket connection that remains active across multiple dialogue turns, eliminating per-sentence reconnect delays.
- **Gapless Timeline Scheduling**: Ingested 24kHz linear PCM chunks are converted to Float32 audio buffers and scheduled seamlessly on the Web Audio API \`AudioContext.currentTime\` timeline without micro-stutters or inter-chunk clicks.
- **Continuous Turn Queueing**: Users can transmit new dialogue while the voice is actively speaking previous sentences; subsequent audio streams queue smoothly on the timeline.
- **Session Lifecycle Controls**:
  - **End Session**: Transmits an End-of-Stream (EOS) packet and gracefully waits for all queued speech to finish playing before closing the audio context.
  - **Stop Audio (Hard Stop)**: Instantly halts and disconnects active audio buffers, cancels pending speech queues, and resets playback immediately.

#### C. Dual Input Modes: Type to Speak vs. Ask AI
- **Type to Speak**: Manual transmission mode. Type custom dialogue, news excerpts, or scripts and click Send to stream the spoken voice immediately.
- **Ask AI Mode**: Query NEXUS AI directly inside the live voice stream. Submitting a question calls the conversational intelligence backend, renders a real-time "AI is thinking..." pulse state, cleans markdown formatting for natural speech cadence, and automatically routes the AI's generated reply into the live voice streaming pipeline.

#### D. Telemetry, Keep-Alive & Full Session WAV Export
- **Anti-Silence Keep-Alive Buffer**: Automatically runs an imperceptible background keep-alive node, preventing mobile Chrome/Safari and background tabs from auto-suspending the Web Audio context between speech chunks.
- **4Hz Diagnostics Overlay**: Real-time diagnostic telemetry tracking buffer count, jitter, playback drift, Web Audio context state, and dropped frame metrics.
- **Download Session Audio (WAV)**: Packages the accumulated 24kHz PCM stream from all messages in the session into a single studio-quality 16-bit PCM WAV audio file with one click.`;

  // Section 13: Image Studio
  const imageStudioText = `### 13. Image Studio & AI Visual Synthesis Matrix

The **Image Studio** (/image-studio) is NEXUS's multimodal visual generation environment for synthesizing photorealistic imagery, concept art, technical schematics, and UI mockups.

#### A. Multi-Provider AI Diffusion Architecture
NEXUS incorporates a redundant matrix of leading open and commercial visual diffusion engines:
1. **Pollinations.ai**: Ultra-fast, zero-auth generation with cutting-edge Flux, Turbo, and SDXL models.
2. **Hugging Face Inference API**: High-precision diffusion pipelines using \`HUGGINGFACE_API_KEY\` (Flux.1-Dev, Stable Diffusion XL Base).
3. **Puter.js & Cloudflare Workers AI**: Resilient secondary and tertiary fallback generators providing serverless visual redundancy.

#### B. Intelligent Prompt Synthesizer (/promptimage)
- Converts rough concepts into 5 vivid, highly detailed prompt variations across distinct stylistic axes: Photorealistic Cinematic, Concept Art / Matte Painting, Cyberpunk / Sci-Fi, Vintage / Retro, and Minimalist Vector.
- Features one-click clipboard copying, direct jump to Image Studio with prefilled prompts, or instant generation via \`/imageai\`.

#### C. Direct Visual Slash Commands
- **/image [prompt]** — Dual visual sourcing: Discovers real-world Wikipedia / Wikimedia photographic assets side-by-side with AI-generated visuals.
- **/imageai [prompt]** — Direct AI generation: Instantly triggers your active Image AI provider, rendering high-resolution visual cards with downloadable PNG assets and metadata.

#### D. Studio Controls & Canvas Tools
- **Prompt Enhancer**: Automatically enriches lighting, camera lens specifications (e.g. 85mm f/1.4), texture details, and composition tags.
- **Aspect Ratio Selector**: Instant switching between 1:1 Square, 16:9 Landscape, 9:16 Mobile Portrait, 4:3 Standard, and 3:2 Classic photography.
- **Interactive Lightbox & Metadata Inspector**: Fullscreen image inspection with zoom, seed inspection, generation model tagging, and direct PNG export.`;

  // Section 14: Dynamic Specialist Matrix ("New Agent" Pipeline)
  const dynamicSpecialistText = `### 14. Dynamic Specialist Matrix — "New Agent" 5-Node Pipeline

The **Dynamic Specialist Matrix** ("New Agent" mode / \`/newagent\`) is an advanced multi-agent architecture where the system dynamically generates custom, domain-tailored AI specialists on the fly for any complex, multi-faceted task.

#### A. 5-Node Cognitive Architecture
Unlike static pipelines with fixed roles, the Dynamic Specialist Matrix synthesizes a custom cognitive team for each specific prompt:
1. **Node 1: Dynamic Planner**: Analyzes the problem statement and dynamically defines 3 custom specialist personas with tailored expertise, distinct analytical angles, detailed system instructions, and assigned toolkits.
2. **Nodes 2–4: Specialized Domain Agents (Slot 1, Slot 2, Slot 3)**:
   - **Specialist 1**: Tackles foundational theory, technical mechanics, or architectural considerations.
   - **Specialist 2**: Evaluates empirical data, market benchmarks, or operational practicalities.
   - **Specialist 3**: Investigates risks, edge cases, strategic counterpoints, or future trajectories.
   - **Runtime Tool Dispatch**: Each specialist is granted access to live tools (Live Web Search, Wikipedia REST, 3-Tier News Fallbacks, OpenWeatherMap, and Web Page Fetching) as designated by the Planner.
3. **Node 5: Final Matrix Synthesizer**: Ingests all 3 specialized findings, resolves conflicting perspectives, structures comparative tables, and produces an executive intelligence briefing labeled \`Mode: Dynamic Specialist Pipeline (New Agent)\`.

#### B. Specialist Slots & Multi-Model Mapping
- Navigate to **Settings > 🤖 New Agent** to configure the 3 Specialist Slots.
- Each slot can be independently assigned to any AI provider and model in your portfolio (e.g. Slot 1 = Claude 3.5 Sonnet for reasoning, Slot 2 = GPT-4o for broad knowledge, Slot 3 = Llama 3 70B for fast verification).
- Enables heterogeneous multi-model deliberation where different AI architectures cross-audit and refine each other's outputs.

#### C. Command Steering & Global Override
- **UI Toggle**: Enable the "New Agent" switch on the JARVIS query bar to route all inquiries through the 5-node specialist pipeline.
- **Slash Command (\`/newagent [task]\` or \`/new_agent [task]\`)**: Triggers the Dynamic Specialist Pipeline for a single query without changing your persistent UI toggle state.`;

  // Section 15: Space & Planetary Intelligence Radar
  const spaceIntelligenceText = `### 15. Space & Planetary Intelligence Radar (/space & /weather)

NEXUS integrates real-time astrophysical telemetry, deep space observations, and atmospheric radar to provide comprehensive terrestrial and cosmic situational awareness.

#### A. NASA Astronomy Picture of the Day (APOD)
- Direct integration with NASA's APOD API via \`NASA_API_KEY\` (with automatic public demo key fallback).
- Daily high-resolution cosmic imagery, planetary captures, and astrophysical descriptions authored by professional astronomers.
- Fullscreen HD asset inspection, media type handling (interactive YouTube/Vimeo space video player embeds), and direct NASA archive linking.

#### B. Real-Time ISS Orbital Radar & Live Pass Tracker
- **Live Orbital Telemetry**: Real-time tracking of the International Space Station (ISS) fetching live orbital coordinates from \`http://api.open-notify.org/iss-now.json\`.
- **Cosmic Metrics**: Displays current latitude, longitude, altitude (~420 km), and hypersonic orbital velocity (~27,600 km/h).
- **Overhead Pass Detection**: Calculates the spherical Great Circle distance between the ISS and your location, triggering proximity alerts when the station passes within 500 km.

#### C. Near-Earth Object (NEO) Asteroid Radar
- Real-time scanning of close-approach asteroids and comets via NASA NeoWs (Near Earth Object Web Service).
- Tracks asteroid name, estimated diameter (meters/feet), relative velocity (km/s), close-approach timestamp, and miss distance (astronomical units / lunar distances).
- Automatically flags potentially hazardous asteroids (PHA) with visual danger badges.

#### D. Global Atmospheric & Meteorological Map Radar (/weather & /weather/map)
- Real-time meteorological data via OpenWeatherMap (\`OPENWEATHERMAP_API_KEY\`) covering temperature, humidity, barometric pressure, UV index, wind speed/direction, and multi-day hourly forecasts.
- Interactive weather radar map layer with precipitation heatmaps, wind streamline particle animations, and city search coordinates.`;

  // Section 16: Parallax 20-Agent Swarm & Genesis Arena
  const parallaxSwarmText = `### 16. Parallax — 20-Agent Autonomous Swarm & Genesis Arena (/parallax)

**Parallax** (/parallax) is NEXUS's massive multi-agent deliberation arena where up to **20 specialized AI personas** debate, cross-examine, and synthesize complex topics across 3 iterative rounds.

#### A. The 20 Specialized Swarm Personas
- Includes **VERITAS** (Empirical Scientist), **AURORA** (Creative Visionary), **CHRONOS** (Historian & Futurist), **AXIOM** (First-Principles Logician), **ECHO** (Cultural Analyst), **LEDGER** (Economist & Strategist), **SOCRATES** (Philosophical Questioner), **PIXEL** (Design & Systems Thinker), **VANGUARD** (Security & Risk Auditor), **HARMONY** (Ethics & Consensus Builder), **CIPHER** (Cryptography & Software Architect), **NOMAD** (Global Geopolitics), **SENTINEL** (Policy & Governance), **LUMEN** (Physics & Cosmology), **CATALYST** (Biotech & Medicine), **GRAVITY** (Infrastructure & Energy), **MOSAIC** (Behavioral Psychology), **ORACLE** (Forecasting & Probability), **EMBER** (Disruptive Innovation), and **NEXUS-9** (Master Swarm Synthesizer).

#### B. 3-Round Deliberation & Genesis Dynamic Mode
- **Configurable Swarm Scale**: Scale active agent count dynamically (e.g., 5, 10, 15, or all 20 agents) across 3 deliberation stages: *Round 1: Initial Positions*, *Round 2: Cross-Examination & Rebuttal*, and *Round 3: Final Master Synthesis*.
- **Genesis Mode (Dynamic Swarm Architect)**: Generates bespoke agent personas on the fly tailored to your specific prompt (Slot 0: Swarm Architect, Slot 19: Zenith Synthesizer, and up to 18 custom domain specialists).
- **8 Debate Formats**: *Default Swarm*, *Genesis Dynamic*, *Courtroom Trial*, *Red Team vs. Blue Team*, *Senate Hearing*, *VC Pitch Tank*, *Sci-Fi Council*, and *Newsroom Desk*.
- **Interactive Controls**: Inject a **Devil's Advocate** challenge mid-flight, jump in with human-in-the-loop turn steering, inspect individual agent reasoning cards, and listen via Edge Neural TTS.`;

  // Section 17: Visual Workflows Studio
  const workflowsStudioText = `### 17. Visual Workflows Studio — Node-Based Automation Canvas (/workflows)

The **Visual Workflows Studio** (/workflows) is a drag-and-drop node graph editor for building repeatable, multi-step AI and data pipelines without writing boilerplate code.

#### A. Modular Node Types
- **Input Node**: Defines pipeline parameters, user text inputs, or runtime variables.
- **Web Search & Web Fetch Nodes**: Executes live Tavily/DuckDuckGo searches or extracts clean Markdown from any URL via \`r.jina.ai\`.
- **Scholar Search Node**: Queries OpenAlex, Semantic Scholar, NASA ADS, and arXiv for peer-reviewed literature.
- **AI Prompt Node**: Routes upstream node outputs into any configured LLM with custom system instructions and template variables (\`{{input}}\`).
- **Image Generation Node**: Synthesizes visual assets from upstream text descriptions.
- **Weather & NASA Space Nodes**: Pulls live OpenWeatherMap telemetry or NASA APOD/Asteroid feeds into the workflow.
- **Conditional Branching (\`IF / ELSE\`) Node**: Evaluates conditions on upstream outputs to dynamically route execution paths.

#### B. Execution Engine & Debugging Features
- **Node Freezing & Mock Outputs**: Freeze any node to reuse cached output or inject mock test payloads without re-running expensive upstream API calls.
- **Live Step Telemetry & Run History**: Inspect per-node execution status, latency, raw outputs, and saved workflow templates.`;

  // Section 18: Custom AI Skills System
  const customSkillsText = `### 18. Custom AI Skills & Modular Instruction Vault (Settings > Skills)

The **Custom Skills System** allows users to extend NEXUS with reusable domain expertise, coding conventions, and specialized output templates.

#### A. Skill Architecture & Quotas
- **Up to 5 Custom Skills**: Store up to 5 modular skills (\`MAX_SKILLS = 5\`, up to 24,000 characters per skill) in local storage with up to **3 skills active simultaneously**.
- **GitHub & Raw URL Import**: Import \`SKILL.md\` or markdown instruction files directly from GitHub URLs or paste custom prompt modules.
- **Cross-Platform Injection**: Active skills are automatically injected into the system instructions of **AI Assistant**, **JARVIS**, and **Multi Chat** personas, accompanied by a quick-toggle Skills drawer in the workspace.`;

  // Section 19: Tutor Mode, Commander Unit & Live Artifact Canvas
  const assistantAdvancedText = `### 19. Tutor Mode, Commander Tactical Unit & Live Artifact Canvas (/assistant)

The **AI Assistant** includes three specialized interactive engines for guided education, deep multi-agent tactical investigation, and live software prototyping:

#### A. Tutor Mode — Socratic Learning Engine
- **Adaptive Configuration**: Choose your **Learner Level** (*Beginner*, *Intermediate*, *Advanced*) and **Learning Goal** (*Learn*, *Exam prep*, *Refresher*).
- **4-Stage Pedagogical Stepper**: Tracks progression through **1. Explain** (core concepts & intuition) → **2. Example** (concrete analogies & walkthroughs) → **3. Practice** (guided exercises & hints) → **4. Quiz** (active recall & comprehension check).
- **One-Tap Study Actions**: Instant buttons inside the \`TutorSessionCard\` for *Explain simpler*, *Real-world example*, *Practice problem*, *Quiz me*, and *Summarize* with per-chat session persistence.

#### B. Commander Specialist Mode — 4-Stage Tactical Unit
- **Chain of Command**:
  1. **Commander (Strategic Orchestrator)**: Deconstructs the mission and assigns specialized directives.
  2. **Agent Alpha (Lead Technical Investigator)**: Builds the primary architecture, empirical evidence, and core solution.
  3. **Agent Beta (Counter-Perspective & Risk Analyst)**: Audits Agent Alpha's work, uncovering edge cases, bottlenecks, and alternative strategies.
  4. **Master Synthesizer**: Unifies Commander, Alpha, and Beta outputs into a battle-tested executive deliverable.
- **Tactical Controls**: Supports **Auto** vs. **Manual** directive mode, **Effort Levels** (*Small*, *Medium*, *High*), per-agent model overrides, and an AI Prompt Enhancer.

#### C. Live Artifact Canvas — Interactive Code & Preview Sandbox
- Automatically detects or opens HTML, CSS, JavaScript, React/TSX, and SVG code artifacts in a split-screen interactive sandbox.
- Includes live preview execution, responsive viewport switcher (Desktop / Tablet / Mobile), integrated console log inspector, raw code editor, and one-click download/copy.`;

  const sections: DocSection[] = [
    {
      id: 'overview',
      title: 'Overview & Main Features',
      badge: 'Core Architecture',
      icon: Cpu,
      text: overviewText,
    },
    {
      id: 'pipeline',
      title: 'JARVIS Agent Pipeline',
      badge: 'Cognitive Matrix',
      icon: Layers,
      text: pipelineText,
    },
    {
      id: 'researcher',
      title: 'How Researcher Fetches Data',
      badge: 'Multi-Source Fallbacks',
      icon: Search,
      text: researcherText,
    },
    {
      id: 'commands',
      title: 'Slash Commands (/search, /web, /customapi, /code, /codeonline, /image, /promptimage, /newagent)',
      badge: 'Pipeline Steering',
      icon: Terminal,
      text: slashCommandsText,
    },
    {
      id: 'catalog',
      title: 'API Catalog & Credential Vault',
      badge: 'Security & APIs',
      icon: Server,
      text: apiCatalogText,
    },
    {
      id: 'theme',
      title: 'Global Themes (Minimal, Classic, Full Dark) & TTS',
      badge: 'Customization',
      icon: Palette,
      text: themeCustomizationText,
    },
    {
      id: 'multichat',
      title: 'Multi Chat & Deliberation Lab Tools',
      badge: 'Sequential Deliberation',
      icon: MessageSquare,
      text: multiChatText,
    },
    {
      id: 'assistant',
      title: 'AI Assistant, Specialist Modes & Smart Memory',
      badge: 'Direct Companion',
      icon: Bot,
      text: assistantText,
    },
    {
      id: 'devices',
      title: 'Devices & Telemetry Dashboard',
      badge: 'Fleet Hardware',
      icon: Smartphone,
      text: devicesText,
    },
    {
      id: 'telegram',
      title: 'Telegram Bot & Automations',
      badge: 'Remote AI Gateway',
      icon: Send,
      text: telegramBotText,
    },
    {
      id: 'document-library',
      title: 'Document Library & Vector Vault (RAG)',
      badge: 'On-Device RAG',
      icon: Database,
      text: documentLibraryText,
    },
    {
      id: 'voice-ai',
      title: 'Voice AI Studio & 24kHz Live Streaming',
      badge: 'Studio Audio & Ask AI',
      icon: Mic,
      text: voiceAiStudioText,
    },
    {
      id: 'image-studio',
      title: 'Image Studio & Visual Diffusion Matrix',
      badge: 'Multimodal Art',
      icon: ImageIcon,
      text: imageStudioText,
    },
    {
      id: 'dynamic-specialist',
      title: 'Dynamic Specialist Matrix (New Agent)',
      badge: '5-Node Dynamic RAG',
      icon: Zap,
      text: dynamicSpecialistText,
    },
    {
      id: 'space-weather',
      title: 'Space & Planetary Intelligence Radar',
      badge: 'Cosmic & Weather',
      icon: Orbit,
      text: spaceIntelligenceText,
    },
    {
      id: 'parallax-swarm',
      title: 'Parallax 20-Agent Swarm & Genesis Arena',
      badge: '20-Agent Swarm',
      icon: Users,
      text: parallaxSwarmText,
    },
    {
      id: 'workflows-studio',
      title: 'Visual Workflows Studio (/workflows)',
      badge: 'Node Automation',
      icon: Workflow,
      text: workflowsStudioText,
    },
    {
      id: 'custom-skills',
      title: 'Custom AI Skills & Instruction Vault',
      badge: 'Modular Skills',
      icon: BookOpen,
      text: customSkillsText,
    },
    {
      id: 'assistant-advanced',
      title: 'Tutor Mode, Commander Unit & Artifact Canvas',
      badge: 'Socratic & Tactical',
      icon: GraduationCap,
      text: assistantAdvancedText,
    },
  ];

  const fullDocumentationText = `# NEXUS INTELLIGENCE & JARVIS SYSTEM DOCUMENTATION
================================================================================
Generated: ${new Date().toISOString().split('T')[0]} | Engine: JARVIS Autonomous Matrix
================================================================================

${overviewText}

--------------------------------------------------------------------------------

${pipelineText}

--------------------------------------------------------------------------------

${researcherText}

--------------------------------------------------------------------------------

${slashCommandsText}

--------------------------------------------------------------------------------

${apiCatalogText}

--------------------------------------------------------------------------------

${themeCustomizationText}

--------------------------------------------------------------------------------

${multiChatText}

--------------------------------------------------------------------------------

${assistantText}

--------------------------------------------------------------------------------

${devicesText}

--------------------------------------------------------------------------------

${telegramBotText}

--------------------------------------------------------------------------------

${documentLibraryText}

--------------------------------------------------------------------------------

${voiceAiStudioText}

--------------------------------------------------------------------------------

${imageStudioText}

--------------------------------------------------------------------------------

${dynamicSpecialistText}

--------------------------------------------------------------------------------

${spaceIntelligenceText}

--------------------------------------------------------------------------------

${parallaxSwarmText}

--------------------------------------------------------------------------------

${workflowsStudioText}

--------------------------------------------------------------------------------

${customSkillsText}

--------------------------------------------------------------------------------

${assistantAdvancedText}

================================================================================
End of NEXUS Documentation
`;

  const handleCopySection = async (id: string, text: string) => {
    playTapSound();
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedSection(id);
      setTimeout(() => setCopiedSection(null), 2000);
    }
  };

  const handleCopyAll = async () => {
    playTapSound();
    const success = await copyToClipboard(fullDocumentationText);
    if (success) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    }
  };

  const scrollToSection = (id: string) => {
    playTapSound();
    const el = document.getElementById(`doc-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Top Banner & Copy All Action */}
      <div className="relative overflow-hidden rounded-xl border border-cyan-500/30 bg-gradient-to-r from-slate-900/95 via-slate-900/90 to-cyan-950/40 p-6 shadow-xl backdrop-blur-md">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-medium">
              <Sparkles size={13} className="text-cyan-400" />
              <span>NEXUS Knowledge Base & Operation Manual</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-100 tracking-tight m-0">
              System Architecture & Documentation
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl m-0 leading-relaxed">
              Comprehensive technical guide to the JARVIS multi-agent cognitive matrix, data retrieval fallback chains, slash command steering, and credential vault resolution.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyAll}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs tracking-wide shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-all active:scale-95"
            >
              {copiedAll ? (
                <>
                  <Check size={15} className="text-slate-950" />
                  <span>Copied Entire Manual!</span>
                </>
              ) : (
                <>
                  <Copy size={15} />
                  <span>Copy All Documentation</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Jump Navigation Bar */}
        <div className="relative z-10 mt-6 pt-4 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-medium whitespace-nowrap mr-1">Quick Jump:</span>
          {sections.map((sec) => (
            <button
              key={sec.id}
              onClick={() => scrollToSection(sec.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/70 text-slate-300 hover:text-cyan-300 whitespace-nowrap transition-colors"
            >
              <span>{sec.title.split('—')[0].split('(')[0]}</span>
              <ArrowRight size={11} className="text-slate-400" />
            </button>
          ))}
        </div>
      </div>

      {/* Detailed Documentation Sections */}
      <div className="space-y-6">
        {/* Section 1: Overview */}
        <div
          id="doc-overview"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-md backdrop-blur-sm transition-colors hover:border-slate-700/80"
        >
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Cpu size={20} />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-cyan-400 tracking-wider uppercase">
                  Architecture Core
                </span>
                <h3 className="text-lg font-bold text-slate-100 m-0">
                  Overview — What NEXUS Is & Main Features
                </h3>
              </div>
            </div>
            <button
              onClick={() => handleCopySection('overview', overviewText)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-cyan-300 text-xs font-medium transition-colors"
            >
              {copiedSection === 'overview' ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Section</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-5 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              <strong className="text-slate-100 font-semibold">NEXUS Intelligence</strong> is an autonomous multi-agent cognitive workstation designed for comprehensive research, factual cross-examination, real-time web intelligence, and system telemetry. It coordinates specialized autonomous agents through the <strong>JARVIS Autonomous Multi-Agent Cognitive Matrix</strong>.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                <div className="text-cyan-300 font-semibold text-xs flex items-center gap-1.5">
                  <Layers size={14} /> JARVIS Multi-Agent Matrix
                </div>
                <p className="text-[12px] text-slate-400 m-0">
                  Sequential and parallel orchestration of 9+ specialized agents ensuring complete factual validation and rich markdown synthesis.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                <div className="text-cyan-300 font-semibold text-xs flex items-center gap-1.5">
                  <Cpu size={14} /> Multi-Provider Neural Backbone
                </div>
                <p className="text-[12px] text-slate-400 m-0">
                  Direct support for OpenAI, Anthropic Claude, Google Gemini, Groq, Mistral, Perplexity, OpenRouter, and Workers AI with automatic failover.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                <div className="text-cyan-300 font-semibold text-xs flex items-center gap-1.5">
                  <Globe size={14} /> Real-Time Live Intelligence
                </div>
                <p className="text-[12px] text-slate-400 m-0">
                  Live semantic search, 3-tier news fallback chain, Wikipedia REST summaries, and Wikidata semantic knowledge graphs.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                <div className="text-cyan-300 font-semibold text-xs flex items-center gap-1.5">
                  <ShieldCheck size={14} /> Hybrid Credential Vault
                </div>
                <p className="text-[12px] text-slate-400 m-0">
                  Dual-layer security combining immutable Render host environment variables with an encrypted AES-256 local vault.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: JARVIS Agent Pipeline */}
        <div
          id="doc-pipeline"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-md backdrop-blur-sm transition-colors hover:border-slate-700/80"
        >
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Layers size={20} />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-cyan-400 tracking-wider uppercase">
                  Cognitive Matrix
                </span>
                <h3 className="text-lg font-bold text-slate-100 m-0">
                  JARVIS Agent Pipeline — Roles & Autonomous Workflows
                </h3>
              </div>
            </div>
            <button
              onClick={() => handleCopySection('pipeline', pipelineText)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-cyan-300 text-xs font-medium transition-colors"
            >
              {copiedSection === 'pipeline' ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Section</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-5 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              JARVIS replaces monolithic single-prompt generation with a modular multi-agent pipeline. Each agent executes discrete analytical responsibilities with isolated schemas:
            </p>

            <div className="space-y-3 pt-1">
              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-cyan-300 text-xs sm:text-sm">
                    1. Planner (Agent 1) — Cognitive Architect
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono">
                    Mandatory Step 1
                  </span>
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Deconstructs query intent, builds atomic execution tasks, detects slash command bypasses, and toggles downstream agent flags (<code className="text-slate-300">needsResearch</code>, <code className="text-slate-300">needsWikipedia</code>, <code className="text-slate-300">needsFactCheck</code>, <code className="text-slate-300">needsReview</code>, <code className="text-slate-300">needsDiagram</code>, <code className="text-slate-300">needsChart</code>, <code className="text-slate-300">needsImage</code>).
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-amber-300 text-xs sm:text-sm">
                    2. Researcher (Agent 2) — Information Retrieval Engine
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                    Step 2
                  </span>
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Connects to live search engines (Tavily), the 3-tier news fallback chain (GNews &rarr; NewsData.io &rarr; Google News RSS), and encyclopedic APIs (Wikipedia REST, Wikidata entity data). Aggregates and structures live citations.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-purple-300 text-xs sm:text-sm">
                    3. Fact Checker (Agent 3) — Autonomous Truth Auditor
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/30 font-mono">
                    Step 3
                  </span>
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Cross-examines claims from the Researcher against trusted knowledge bases. Evaluates dates, numbers, statistics, and entities, assigning a confidence rating and explicitly flagging contradictions.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-blue-300 text-xs sm:text-sm">
                    4. Advisor (Agent 3.5 / Knowledge Agent) — Tactical Specialist
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-300 border border-blue-500/30 font-mono">
                    Step 3.5
                  </span>
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Enriches findings with domain expertise, strategic context, historical precedent, risk assessments, second-order implications, and actionable recommendations.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-emerald-300 text-xs sm:text-sm">
                    5. Reviewer (Agent 4) — Pre-Synthesis Auditor
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                    Step 4
                  </span>
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Ingests the plan, findings, fact-checking notes, and advisor inputs. Evaluates completeness, flags ambiguities, and produces a structured critique with concrete guidance for the final synthesizer.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-cyan-300 text-xs sm:text-sm">
                    6. Final Synthesizer (Agent 5) — Master Intelligence Voice
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono">
                    Final Step
                  </span>
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Compiles the unified intelligence report featuring hierarchical Markdown, formatted quantitative comparison tables, bulleted takeaways, and inline source citation badges linking directly to referenced URLs.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-indigo-300 text-xs sm:text-sm">
                    7. Architect (Agent 8 - Specialized) — Systems & Visual Designer
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-mono">
                    Conditional
                  </span>
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Architects software solutions, system topologies, and interactive, dark-mode vector SVG architecture diagrams with animated connection nodes.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-rose-300 text-xs sm:text-sm">
                    8. Data Analyst (Agent 9 - Specialized) — Quantitative Modeler
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/15 text-rose-300 border border-rose-500/30 font-mono">
                    Conditional
                  </span>
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Extracts numerical data points, normalizes financial metrics, computes statistical trends, and renders interactive Recharts visual components.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-teal-300 text-xs sm:text-sm">
                    9. Image Finder (Agent 11 - Specialized) — Visual Curator
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-teal-500/15 text-teal-300 border border-teal-500/30 font-mono">
                    Conditional
                  </span>
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Queries high-resolution photography and graphics from Pixabay and Wikimedia Commons, presenting them in an interactive lightbox gallery.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-emerald-400 text-xs sm:text-sm">
                    10. Coder (Agent 10 - Specialized) — Software Engineering Specialist
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                    Conditional / /code
                  </span>
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Writes, debugs, and optimizes production-ready code, scripts, and algorithms across multiple programming languages. Triggered automatically for programming-related queries or explicitly via the <code className="text-slate-300">/code</code> command. Bypasses the standard research/fact-check/review pipeline for minimal latency, running a lightweight Planner &rarr; Coder pipeline that outputs clean code blocks, unit tests where relevant, and brief structural notes.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: How Researcher Fetches Data */}
        <div
          id="doc-researcher"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-md backdrop-blur-sm transition-colors hover:border-slate-700/80"
        >
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Search size={20} />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-cyan-400 tracking-wider uppercase">
                  Data Retrieval
                </span>
                <h3 className="text-lg font-bold text-slate-100 m-0">
                  How Researcher Fetches Data — Multi-Source Fallbacks
                </h3>
              </div>
            </div>
            <button
              onClick={() => handleCopySection('researcher', researcherText)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-cyan-300 text-xs font-medium transition-colors"
            >
              {copiedSection === 'researcher' ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Section</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-5 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              The Researcher combines search engines, structured knowledge graphs, and a 3-tier news fallback chain to ensure high reliability:
            </p>

            {/* News Fallback Pipeline Visual */}
            <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Radio size={14} className="text-amber-400" />
                <span>The Resilient 3-Tier News Fallback Chain</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 rounded bg-slate-900 border border-slate-800 space-y-1">
                  <div className="text-cyan-300 font-semibold flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] flex items-center justify-center font-mono">1</span>
                    GNews API
                  </div>
                  <p className="text-[11px] text-slate-400 m-0">
                    Direct query to <code className="text-slate-300">gnews.io/api/v4</code> using <code className="text-slate-300">GNEWS_API_KEY</code>. Returns categorized headlines with publisher timestamps.
                  </p>
                </div>

                <div className="p-3 rounded bg-slate-900 border border-slate-800 space-y-1">
                  <div className="text-amber-300 font-semibold flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 text-[10px] flex items-center justify-center font-mono">2</span>
                    NewsData.io Fallback
                  </div>
                  <p className="text-[11px] text-slate-400 m-0">
                    If GNews fails or quota is depleted, cascades to <code className="text-slate-300">newsdata.io/api/1</code> via <code className="text-slate-300">NEWSDATA_API_KEY</code>.
                  </p>
                </div>

                <div className="p-3 rounded bg-slate-900 border border-slate-800 space-y-1">
                  <div className="text-emerald-300 font-semibold flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] flex items-center justify-center font-mono">3</span>
                    Google News RSS Scraper
                  </div>
                  <p className="text-[11px] text-slate-400 m-0">
                    Zero-key fallback parsing <code className="text-slate-300">news.google.com/rss</code> feeds on the fly. Guarantees live news even with no paid API keys.
                  </p>
                </div>
              </div>
            </div>

            {/* Tavily Web Search & Wikipedia */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="text-cyan-300 font-semibold text-xs flex items-center gap-1.5">
                  <Globe size={14} /> Tavily Web Search Integration
                </div>
                <p className="text-[12px] text-slate-400 m-0 leading-relaxed">
                  Primary deep web intelligence engine using <code className="text-slate-300">TAVILY_API_KEY</code>. Executes AI-optimized semantic searches, crawls target web pages, extracts raw text snippets, and compiles canonical citations.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="text-cyan-300 font-semibold text-xs flex items-center gap-1.5">
                  <BookOpen size={14} /> Wikipedia & Wikidata Lookups
                </div>
                <p className="text-[12px] text-slate-400 m-0 leading-relaxed">
                  Queries Wikipedia REST API (<code className="text-slate-300">/api/rest_v1/page/summary</code>) for entity abstracts, and queries Wikidata (<code className="text-slate-300">Special:EntityData</code>) for semantic facts, coordinates, and founding dates.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Slash Commands */}
        <div
          id="doc-commands"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-md backdrop-blur-sm transition-colors hover:border-slate-700/80"
        >
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Terminal size={20} />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-cyan-400 tracking-wider uppercase">
                  Execution Control
                </span>
                <h3 className="text-lg font-bold text-slate-100 m-0">
                  Slash Commands — Fast Pipeline Steering
                </h3>
              </div>
            </div>
            <button
              onClick={() => handleCopySection('commands', slashCommandsText)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-cyan-300 text-xs font-medium transition-colors"
            >
              {copiedSection === 'commands' ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Section</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-5 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              Slash commands bypass general multi-step inference to execute dedicated, high-speed cognitive paths:
            </p>

            <div className="space-y-3">
              {/* Command 1 */}
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="font-mono text-cyan-300 font-semibold text-xs sm:text-sm bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                    /search [query]
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">Live Web Search Override</span>
                </div>
                <p className="text-xs text-slate-400 m-0 mb-2">
                  Forces immediate live web research, stripping command prefixes and bypassing encyclopedic Wikipedia/Wikidata lookups for maximum speed.
                </p>
                <div className="text-[11px] text-slate-300 font-mono bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800">
                  <span className="text-slate-500">Example:</span> /search latest James Webb exoplanet discoveries 2025
                </div>
              </div>

              {/* Command 2 */}
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="font-mono text-cyan-300 font-semibold text-xs sm:text-sm bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                    /web [URL]
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">Direct Webpage Scrape & Synthesis</span>
                </div>
                <p className="text-xs text-slate-400 m-0 mb-2">
                  Extracts clean markdown from any target public webpage using a high-speed proxy reader, passing the full web document directly to the Final Synthesizer.
                </p>
                <div className="text-[11px] text-slate-300 font-mono bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800">
                  <span className="text-slate-500">Example:</span> /web https://en.wikipedia.org/wiki/Quantum_computing
                </div>
              </div>

              {/* Command 3 */}
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="font-mono text-cyan-300 font-semibold text-xs sm:text-sm bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                    /customapi [api_name] [query]
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">Direct Custom API Invocation</span>
                </div>
                <p className="text-xs text-slate-400 m-0 mb-2">
                  Invokes any custom REST API registered in your Settings &gt; API Catalog via <code className="text-slate-300">Step 1.55: Custom API Runner</code>, feeding the raw JSON output to the Synthesizer for rich tabular presentation.
                </p>
                <div className="text-[11px] text-slate-300 font-mono bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800">
                  <span className="text-slate-500">Example:</span> /customapi weatherstack Tokyo
                </div>
              </div>

              {/* Command 4 */}
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="font-mono text-cyan-300 font-semibold text-xs sm:text-sm bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                    /code [prompt]
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">2-Agent Fast Coding Pipeline</span>
                </div>
                <p className="text-xs text-slate-400 m-0 mb-2">
                  Routes directly through Planner &rarr; Coder, bypassing research and review to deliver production-ready code in seconds.
                </p>
                <div className="text-[11px] text-slate-300 font-mono bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800">
                  <span className="text-slate-500">Example:</span> /code write a TypeScript debounce function with cancellation
                </div>
              </div>

              {/* Command 5 */}
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="font-mono text-cyan-300 font-semibold text-xs sm:text-sm bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                    /codeonline [prompt]
                  </div>
                  <span className="text-[11px] text-emerald-400 font-medium">3-Agent Live Research Coding Pipeline</span>
                </div>
                <p className="text-xs text-slate-400 m-0 mb-2">
                  Executes real-time research for up-to-date APIs/libraries before writing code (Planner &rarr; Researcher &rarr; Coder). Strictly prioritizes live research over training data, enforces exact package name matching, isolates scope, and integrates with Document Library RAG.
                </p>
                <div className="text-[11px] text-slate-300 font-mono bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800">
                  <span className="text-slate-500">Example:</span> /codeonline build a Next.js 15 app with Server Actions and Auth.js v5
                </div>
              </div>

              {/* Command 6 */}
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="font-mono text-cyan-300 font-semibold text-xs sm:text-sm bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                    /image [prompt]
                  </div>
                  <span className="text-[11px] text-pink-400 font-medium">Dual Real Photo + AI Visual</span>
                </div>
                <p className="text-xs text-slate-400 m-0 mb-2">
                  Instantly shows a real photo + AI-generated image for the topic, bypassing the full research pipeline for speed.
                </p>
                <div className="text-[11px] text-slate-300 font-mono bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800">
                  <span className="text-slate-500">Example:</span> /image northern lights
                </div>
              </div>

              {/* Command 7 */}
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="font-mono text-cyan-300 font-semibold text-xs sm:text-sm bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                    /imagesai [prompt]
                  </div>
                  <span className="text-[11px] text-fuchsia-400 font-medium">Direct AI Image Only</span>
                </div>
                <p className="text-xs text-slate-400 m-0 mb-2">
                  Generates an AI image only (skips the real-photo search), for fastest results.
                </p>
                <div className="text-[11px] text-slate-300 font-mono bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800">
                  <span className="text-slate-500">Example:</span> /imagesai a dragon made of glass
                </div>
              </div>

              {/* Command 8 */}
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="font-mono text-cyan-300 font-semibold text-xs sm:text-sm bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                    /promptimage [rough idea]
                  </div>
                  <span className="text-[11px] text-pink-400 font-medium">5 Prompt Variations Generator</span>
                </div>
                <p className="text-xs text-slate-400 m-0 mb-2">
                  Generates 5 distinct, highly detailed image generation prompt variations with interactive copy and one-click Image Studio actions.
                </p>
                <div className="text-[11px] text-slate-300 font-mono bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800">
                  <span className="text-slate-500">Example:</span> /promptimage a dragon made of stained glass
                </div>
              </div>

              {/* Command 9 */}
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-purple-500/30">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="font-mono text-purple-300 font-semibold text-xs sm:text-sm bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
                    /newagent [task] <span className="text-[10px] text-purple-400/80">(or /new_agent)</span>
                  </div>
                  <span className="text-[11px] text-purple-300 font-medium">5-Node Dynamic Specialist Matrix Override</span>
                </div>
                <p className="text-xs text-slate-400 m-0 mb-2">
                  Forces the 5-node Dynamic Specialist Pipeline (Planner &rarr; 3 Dynamic Domain Specialists &rarr; Final Synthesizer) for a single query, regardless of the UI toggle state. The Planner dynamically defines 3 custom domain specialists with bespoke instructions and live toolkits (Search, Wikipedia, News, Weather, Web Fetcher), executing through your configured Specialist Slots (1–3).
                </p>
                <div className="text-[11px] text-slate-300 font-mono bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800">
                  <span className="text-slate-500">Example:</span> /newagent Compare RISC-V vs ARM architectures for embedded edge devices
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: API Catalog */}
        <div
          id="doc-catalog"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-md backdrop-blur-sm transition-colors hover:border-slate-700/80"
        >
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Server size={20} />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-cyan-400 tracking-wider uppercase">
                  Vault Architecture
                </span>
                <h3 className="text-lg font-bold text-slate-100 m-0">
                  API Catalog — Environment Variables vs. Encrypted Local Vault
                </h3>
              </div>
            </div>
            <button
              onClick={() => handleCopySection('catalog', apiCatalogText)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-cyan-300 text-xs font-medium transition-colors"
            >
              {copiedSection === 'catalog' ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Section</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-5 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              The API Catalog ensures secure, seamless credential handling without exposing raw secrets to the browser or risking accidental overwrites:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                  <ShieldCheck size={15} />
                  <span>1. Render System Environment (Host)</span>
                </div>
                <p className="text-[12px] text-slate-400 m-0 leading-relaxed">
                  System environment variables (<code className="text-slate-300">process.env</code>) take absolute top priority. When an environment variable is detected in the cloud host or Docker container, it is flagged as <span className="text-emerald-300 font-semibold">Render System</span>. These values are read-only from the UI to protect deployment integrity.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
                  <Server size={15} />
                  <span>2. Encrypted Local Vault (JSON File)</span>
                </div>
                <p className="text-[12px] text-slate-400 m-0 leading-relaxed">
                  Keys added or updated through the UI table are securely saved to <code className="text-slate-300">data/api_catalog.json</code> using AES-256 encrypted storage. The server resolves credentials by checking the System Environment first, falling back to the Local Vault if absent.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-200">
                How to Register Custom APIs in the Render-Style Form:
              </div>
              <ol className="text-xs text-slate-400 list-decimal pl-4 space-y-1 m-0">
                <li>Open <strong>Settings &gt; ⚡ API Catalog</strong> and click <strong>+ Add Custom API</strong>.</li>
                <li>Enter the <strong>Environment Variable / Key Name</strong> (e.g. <code className="text-slate-300">WEATHERSTACK_API_KEY</code>).</li>
                <li>Paste the <strong>API Key Value</strong> (masked, with instant copy and delete controls).</li>
                <li>Provide the <strong>Base URL</strong> (e.g. <code className="text-slate-300">https://api.weatherstack.com/current</code>).</li>
                <li>Provide the <strong>Query Parameter Name</strong> (e.g. <code className="text-slate-300">q</code>, <code className="text-slate-300">query</code>, or <code className="text-slate-300">city</code>).</li>
                <li>Click <strong>Save & Register Custom API</strong> and invoke it via <code className="text-cyan-300 font-mono">/customapi [api_name] [query]</code>.</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Section 6: Theme & Customization */}
        <div
          id="doc-theme"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-md backdrop-blur-sm transition-colors hover:border-slate-700/80"
        >
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Palette size={20} />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-cyan-400 tracking-wider uppercase">
                  User Experience
                </span>
                <h3 className="text-lg font-bold text-slate-100 m-0">
                  Theme, Saved Reports & Neural TTS Voice
                </h3>
              </div>
            </div>
            <button
              onClick={() => handleCopySection('theme', themeCustomizationText)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-cyan-300 text-xs font-medium transition-colors"
            >
              {copiedSection === 'theme' ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Section</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-5 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="text-cyan-300 font-semibold text-xs flex items-center gap-1.5">
                  <Sparkles size={14} /> 3 Global Visual Themes
                </div>
                <p className="text-[12px] text-slate-400 m-0 leading-relaxed">
                  Switch globally between <strong>Minimal</strong> (clean dark slate), <strong>Classic</strong> (Tactical Cyan HUD), and <strong>Full Dark</strong> (pure #000000 OLED pitch black), plus per-card JARVIS synthesis theme toggles.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="text-cyan-300 font-semibold text-xs flex items-center gap-1.5">
                  <FileText size={14} /> Saved Page (/saved)
                </div>
                <p className="text-[12px] text-slate-400 m-0 leading-relaxed">
                  Persistent bookmark repository for intelligence reports, SVG diagrams, and analytical charts. Supports rich HTML copy for Google Docs, raw Markdown copy, and PDF export.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="text-cyan-300 font-semibold text-xs flex items-center gap-1.5">
                  <Volume2 size={14} /> Edge Neural TTS Voice
                </div>
                <p className="text-[12px] text-slate-400 m-0 leading-relaxed">
                  Natural neural voice narration powered by Microsoft Edge TTS (<code className="text-slate-300">/api/edge-tts</code>) with lifelike pacing and Web Speech API fallbacks for hands-free listening.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 7: Multi Chat */}
        <div
          id="doc-multichat"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-md backdrop-blur-sm transition-colors hover:border-slate-700/80"
        >
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <MessageSquare size={20} />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-cyan-400 tracking-wider uppercase">
                  Sequential Deliberation &amp; Lab
                </span>
                <h3 className="text-lg font-bold text-slate-100 m-0">
                  Multi Chat — 3-Persona Deliberation Matrix, Scenarios &amp; Lab Tools
                </h3>
              </div>
            </div>
            <button
              onClick={() => handleCopySection('multichat', multiChatText)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-cyan-300 text-xs font-medium transition-colors"
            >
              {copiedSection === 'multichat' ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Section</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-5 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              <strong className="text-slate-100 font-semibold">Multi Chat</strong> (<code className="text-cyan-300">/multichat</code>) coordinates three distinct AI personas—plus on-demand Guest Specialists—across selectable dialogue modes, roleplay scenarios, and interactive synthesis utilities.
            </p>

            {/* 3 Personas Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-cyan-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-300 text-xs flex items-center gap-1.5">
                    🔬 NOVA
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                    Step 1: Researcher
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-slate-200">Professional &amp; Factual</div>
                <p className="text-[12px] text-slate-400 m-0 leading-relaxed">
                  Focuses on empirical accuracy, logical consistency, cited facts, and objective data breakdowns. Establishes the foundational baseline of truth for the deliberation.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                    💡 ORBIT
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                    Step 2: Buddy
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-slate-200">Casual &amp; Friendly</div>
                <p className="text-[12px] text-slate-400 m-0 leading-relaxed">
                  Translates complex technical jargon into practical, everyday analogies. Ingests NOVA&apos;s factual data, simplifying nuances, discussing trade-offs, and adding relatable humor.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-purple-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-300 text-xs flex items-center gap-1.5">
                    🌌 COSMOS
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
                    Step 3: Mentor
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-slate-200">Calm &amp; Wise</div>
                <p className="text-[12px] text-slate-400 m-0 leading-relaxed">
                  Takes a high-altitude holistic viewpoint, considering ethical principles, long-term implications, and mental clarity. Synthesizes NOVA and ORBIT into a mature consensus.
                </p>
              </div>
            </div>

            {/* Pipeline & Controls Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Brain size={14} className="text-cyan-400" />
                  <span>Dialogue Modes, Scenarios &amp; Guest Specialists</span>
                </div>
                <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4 m-0 leading-relaxed">
                  <li><strong>4 Dialogue Modes:</strong> Switch between <em>Harmony</em>, <em>Debate</em>, <em>Parallel</em>, and <em>Relay</em> execution chains.</li>
                  <li><strong>5 Roleplay Scenarios:</strong> <em>Startup Pitch</em>, <em>Code Review</em>, <em>War Room</em>, <em>Socratic Trial</em>, and <em>Courtroom</em>.</li>
                  <li><strong>4 Guest Specialists:</strong> Invite <strong>CFO</strong>, <strong>Cyber</strong>, <strong>UX</strong>, or <strong>Legal</strong> specialists into any conversation round.</li>
                  <li><strong>20-Message Rolling &amp; Permanent Memory:</strong> Retains 20 turns of sliding context plus permanent user memory facts.</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Volume2 size={14} className="text-cyan-400" />
                  <span>Lab Tools, Study Deck &amp; Podcast Generator</span>
                </div>
                <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4 m-0 leading-relaxed">
                  <li><strong>Analytical Matrices:</strong> Inspect <em>Alignment Radar</em>, <em>Decision Matrix</em>, <em>Fact Matrix</em>, and <em>Visual Map</em>.</li>
                  <li><strong>Stress Test &amp; Hot Seat:</strong> Inject unexpected crisis pivots or interrogate a single persona directly.</li>
                  <li><strong>Study Deck &amp; Cherry-Pick Mixer:</strong> Generate interactive flashcards/quizzes or mix best paragraphs into a custom synthesis.</li>
                  <li><strong>Podcast Script &amp; MP3 Download:</strong> Generate multi-host audio scripts with Edge Neural TTS playback and <code className="text-slate-300">.mp3</code> export.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Section 8: AI Assistant */}
        <div
          id="doc-assistant"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-md backdrop-blur-sm transition-colors hover:border-slate-700/80"
        >
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Bot size={20} />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-cyan-400 tracking-wider uppercase">
                  Direct Companion &amp; Specialist Hub
                </span>
                <h3 className="text-lg font-bold text-slate-100 m-0">
                  AI Assistant — Specialist Modes, Tutor, Commander &amp; Live Canvas
                </h3>
              </div>
            </div>
            <button
              onClick={() => handleCopySection('assistant', assistantText)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-cyan-300 text-xs font-medium transition-colors"
            >
              {copiedSection === 'assistant' ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Section</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-5 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              The <strong className="text-slate-100 font-semibold">AI Assistant</strong> (<code className="text-cyan-300">/assistant</code>) is a multi-session conversational workstation combining rapid chat with modular specialist pipelines, Socratic tutoring, 4-stage Commander orchestration, academic Scholar search, and a live code preview canvas.
            </p>

            {/* Architecture Differences Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="text-cyan-300 font-semibold text-xs flex items-center gap-1.5">
                  <Layers size={14} /> JARVIS Matrix
                </div>
                <p className="text-[12px] text-slate-400 m-0 leading-relaxed">
                  Deep, heavy 10-agent cognitive engine executing multi-source web crawling, fact checking, Wikidata graphs, SVG architecture blueprints, and chart generation.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="text-cyan-300 font-semibold text-xs flex items-center gap-1.5">
                  <MessageSquare size={14} /> Multi Chat &amp; Parallax
                </div>
                <p className="text-[12px] text-slate-400 m-0 leading-relaxed">
                  Sequential 3-persona deliberation mesh (NOVA &rarr; ORBIT &rarr; COSMOS) and 20-agent Parallax swarm arena for multi-angle critical debates.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="text-cyan-300 font-semibold text-xs flex items-center gap-1.5">
                  <Bot size={14} /> AI Assistant
                </div>
                <p className="text-[12px] text-slate-400 m-0 leading-relaxed">
                  Fast, versatile daily companion with archived chat sessions, Tutor Mode, Commander Mode, Swarm Live, Scholar Search, Live Artifact Canvas, and Smart Memory.
                </p>
              </div>
            </div>

            {/* Key Capabilities */}
            <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="text-xs font-semibold text-slate-200">
                Core Capabilities &amp; Built-in Features:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-400">
                <div className="space-y-1">
                  <strong className="text-slate-200 block">⚡ 10+ Specialist Modes:</strong>
                  <span>Toggle Commander (4-stage unit), Swarm Live, Tutor Mode, Scholar Search (OpenAlex/Semantic Scholar/NASA ADS/arXiv), Architect (SVG), Data Analysis (Recharts), Multi Chat, Coder (/codeonline), Web Fetcher (/web), and Wikimedia.</span>
                </div>
                <div className="space-y-1">
                  <strong className="text-slate-200 block">🎓 Socratic Tutor &amp; Commander Unit:</strong>
                  <span>Interactive 4-stage Tutor stepper (Explain &rarr; Example &rarr; Practice &rarr; Quiz) and tactical Commander orchestration (Commander + Agent Alpha + Agent Beta + Master Synthesizer).</span>
                </div>
                <div className="space-y-1">
                  <strong className="text-slate-200 block">🖥️ Live Artifact Canvas:</strong>
                  <span>Side-by-side interactive sandbox rendering HTML, CSS, JS, React/TSX, and SVG code blocks with responsive viewport toggles and live console telemetry.</span>
                </div>
                <div className="space-y-1">
                  <strong className="text-slate-200 block">🧠 Multi-Session History &amp; Smart Memory:</strong>
                  <span>Switch between saved chat threads with automatic deduplication, plus a persistent 2,200-character Smart Memory scratchpad editable via the Brain icon.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 9: Devices Dashboard */}
        <div
          id="doc-devices"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-md backdrop-blur-sm transition-colors hover:border-slate-700/80"
        >
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Smartphone size={20} />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-cyan-400 tracking-wider uppercase">
                  Fleet Hardware
                </span>
                <h3 className="text-lg font-bold text-slate-100 m-0">
                  Devices Dashboard — Fleet Monitoring & Hardware Bridges
                </h3>
              </div>
            </div>
            <button
              onClick={() => handleCopySection('devices', devicesText)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-cyan-300 text-xs font-medium transition-colors"
            >
              {copiedSection === 'devices' ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Section</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-5 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              The <strong className="text-slate-100 font-semibold">Devices Dashboard</strong> (<code className="text-cyan-300">/devices</code>) serves as the unified hardware bridge and telemetry control center for managing connected smartphones, Smart TVs, network hosts, and edge agents.
            </p>

            {/* Status Counts Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-slate-950/80 border border-emerald-500/30 text-center">
                <div className="text-lg font-bold text-emerald-400">Online</div>
                <div className="text-[11px] text-slate-400">Active telemetry & heartbeats</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/80 border border-amber-500/30 text-center">
                <div className="text-lg font-bold text-amber-400">Warning</div>
                <div className="text-[11px] text-slate-400">Battery &lt; 20% or latency lag</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/80 border border-rose-500/30 text-center">
                <div className="text-lg font-bold text-rose-400">Offline</div>
                <div className="text-[11px] text-slate-400">Unreachable or timed out</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/80 border border-cyan-500/30 text-center">
                <div className="text-lg font-bold text-cyan-400">Total Fleet</div>
                <div className="text-[11px] text-slate-400">All registered devices</div>
              </div>
            </div>

            {/* Device Types Grid */}
            <div className="space-y-2 pt-1">
              <div className="text-xs font-semibold text-slate-200">
                Device Platforms — Real Integrations vs. Coming Soon:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="p-3.5 rounded-lg bg-slate-950/60 border border-cyan-500/30 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                      <Smartphone size={14} /> Android Agent
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                      Real / Live
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-400 m-0 leading-relaxed">
                    Pairs Android devices running the NEXUS Agent APK via secure pairing codes. Runs background telemetry self-reporting every 60s for battery %, charging state, network type, model, and OS version.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950/60 border border-purple-500/30 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-purple-300 text-xs flex items-center gap-1.5">
                      <Tv size={14} /> Smart TV Controller
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                      Real / Live
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-400 m-0 leading-relaxed">
                    Discovers and controls Google TV, Android TV, and LG webOS over the local network with automatic TLS port 6466/6467 PIN pairing and ADB port 5555 remote key commands.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950/40 border border-slate-800 space-y-1.5 opacity-85">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300 text-xs flex items-center gap-1.5">
                      <Cpu size={14} /> Computer / Cloud
                    </span>
                    <span className="text-[10px] text-slate-400 px-2 py-0.5 rounded bg-slate-800">
                      Coming soon
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-400 m-0 leading-relaxed">
                    Dedicated daemon agents for Linux servers, macOS, and Windows workstations for CPU, GPU, and RAM telemetry tracking.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950/40 border border-slate-800 space-y-1.5 opacity-85">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300 text-xs flex items-center gap-1.5">
                      <Sliders size={14} /> Smart Home & Automations
                    </span>
                    <span className="text-[10px] text-slate-400 px-2 py-0.5 rounded bg-slate-800">
                      Coming soon
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-400 m-0 leading-relaxed">
                    Hub integrations for Matter/Zigbee IoT smart lights, thermostats, and automated threshold routines (e.g. alert when battery &lt; 20%).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 10: Telegram Bot */}
        <div
          id="doc-telegram"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-md backdrop-blur-sm transition-colors hover:border-slate-700/80"
        >
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Send size={20} />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-cyan-400 tracking-wider uppercase">
                  Remote AI Gateway
                </span>
                <h3 className="text-lg font-bold text-slate-100 m-0">
                  Telegram Bot — Remote Access, Whitelists & Automations
                </h3>
              </div>
            </div>
            <button
              onClick={() => handleCopySection('telegram', telegramBotText)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-cyan-300 text-xs font-medium transition-colors"
            >
              {copiedSection === 'telegram' ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Section</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-5 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              The <strong className="text-slate-100 font-semibold">Telegram Bot</strong> gateway (<code className="text-cyan-300">/telegram</code> or <strong>Settings &gt; Telegram</strong>) allows you to interact with NEXUS from any Telegram client worldwide, receiving real-time AI answers, scheduled forecasts, and satellite alerts.
            </p>

            {/* Setup & Whitelist Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                  <Key size={14} />
                  <span>1. Bot Token & Chat ID Connection</span>
                </div>
                <ol className="text-xs text-slate-400 list-decimal pl-4 space-y-1 m-0 leading-relaxed">
                  <li>Create a bot with <code className="text-slate-300">@BotFather</code> on Telegram via <code className="text-cyan-300">/newbot</code>.</li>
                  <li>Paste the generated <strong>Bot Token</strong> into Telegram Settings.</li>
                  <li>Provide an optional default <strong>Chat ID</strong> for scheduled broadcasts.</li>
                  <li>Click <strong>Connect Bot</strong>: Automatically registers commands via Telegram <code className="text-slate-300">setMyCommands</code> and starts the polling loop.</li>
                </ol>
              </div>

              <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck size={14} />
                  <span>2. Allowed Users / Chat IDs Security List</span>
                </div>
                <p className="text-[12px] text-slate-400 m-0 leading-relaxed">
                  Protect your bot from unauthorized public usage. When you populate the <strong>Allowed Users</strong> list with specific usernames (e.g. <code className="text-slate-300">@username</code>) or numeric Chat IDs, all unlisted users are blocked immediately and logged in the <strong>Activity Log</strong>.
                </p>
              </div>
            </div>

            {/* Available Commands */}
            <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-200">
                Registered Bot Commands:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                  <div className="font-mono text-cyan-300 font-semibold">/weather [city]</div>
                  <div className="text-[11px] text-slate-400">Live temps, humidity, wind & forecast</div>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                  <div className="font-mono text-cyan-300 font-semibold">/search &lt;query&gt;</div>
                  <div className="text-[11px] text-slate-400">Web search with synthesized AI answers</div>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                  <div className="font-mono text-cyan-300 font-semibold">/news</div>
                  <div className="text-[11px] text-slate-400">Top breaking global headlines</div>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                  <div className="font-mono text-cyan-300 font-semibold">/space</div>
                  <div className="text-[11px] text-slate-400">ISS live orbit telemetry & Moon phase</div>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                  <div className="font-mono text-cyan-300 font-semibold">/help</div>
                  <div className="text-[11px] text-slate-400">Command manual & shortcut guide</div>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                  <div className="font-mono text-cyan-300 font-semibold">/start</div>
                  <div className="text-[11px] text-slate-400">Welcome menu & quick action buttons</div>
                </div>
              </div>
            </div>

            {/* Smart Automations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="text-cyan-300 font-semibold text-xs flex items-center gap-1.5">
                  <Clock size={14} /> Scheduled Daily Weather & Rain Alerts
                </div>
                <p className="text-[12px] text-slate-400 m-0 leading-relaxed">
                  Automatically delivers a comprehensive morning forecast at your specified time (e.g. 07:00) and triggers proactive warning messages whenever local precipitation chance reaches &ge; 60%.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="text-cyan-300 font-semibold text-xs flex items-center gap-1.5">
                  <Radio size={14} /> ISS Overhead Alert & Quick-Reply Buttons
                </div>
                <p className="text-[12px] text-slate-400 m-0 leading-relaxed">
                  Monitors real-time ISS orbital tracks and notifies you when the space station is within 500 km. Automatically attaches inline keyboard buttons (Weather, Search, Space, News) to bot responses for 1-tap navigation.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 11: Document Library & On-Device Vector Vault (RAG) */}
        <div
          id="doc-document-library"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-md backdrop-blur-sm transition-colors hover:border-slate-700/80"
        >
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Database size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <span>11. Document Library &amp; On-Device Vector Vault (RAG)</span>
                  <span className="text-[11px] font-mono font-normal text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60">
                    On-Device RAG
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Privacy-first local IndexedDB vector storage, semantic search, in-place text editing, and JARVIS RAG synthesis
                </p>
              </div>
            </div>
            <button
              onClick={() => handleCopySection('document-library', documentLibraryText)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shrink-0"
              title="Copy this section's markdown"
            >
              {copiedSection === 'document-library' ? (
                <>
                  <Check size={13} className="text-emerald-400" />
                  <span className="text-emerald-400 font-mono text-[11px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-5 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              The <strong className="text-slate-100">Document Library</strong> (Settings &gt; 📚 Document Library) allows users to build a personal, local vector knowledge vault. All files, embeddings, and chunks are saved strictly in your browser&apos;s IndexedDB (<code className="text-cyan-300">nexus_document_library</code>) with 100% privacy and zero server-side file uploads.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <ShieldCheck size={14} /> 100% Local Browser Vector Vault
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Ingests PDF, DOCX, TXT, CSV, MD, JSON, LOG, and pasted clipboard notes up to 50 MB total. Automatically splits documents into ~750 character overlapping semantic chunks and computes embeddings for fast cosine similarity lookup.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Sliders size={14} /> Document Management (Rename &amp; In-Place Edit)
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Includes full inclusion toggles, quick text previews, custom display renaming (updates citations while preserving internal IDs/timestamps), and in-place full text editing with automated re-chunking and vector re-indexing.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Layers size={14} /> JARVIS &amp; /codeonline RAG Grounding
                </div>
                <p className="text-xs text-slate-400 m-0">
                  When &quot;Search My Docs&quot; is active, matching semantic chunks are injected directly into the Final Synthesizer and the /codeonline Coder agent with verified <code className="text-slate-300">[Document: &apos;...&apos;]</code> citations.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Search size={14} /> Interactive Vector Search Sandbox
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Test library vector retrieval directly inside Settings &gt; Document Library with real-time similarity score match meters and instant chunk inspections.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 12: Voice AI Studio & 24kHz Live Streaming */}
        <div
          id="doc-voice-ai"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-md backdrop-blur-sm transition-colors hover:border-slate-700/80"
        >
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Mic size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <span>12. Voice AI Studio &amp; 24kHz Live Streaming</span>
                  <span className="text-[11px] font-mono font-normal text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60">
                    Studio Audio &amp; Ask AI
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Edge Neural TTS (40+ voices), 24kHz ElevenLabs WebSocket PCM streaming, and live Ask AI speech synthesis
                </p>
              </div>
            </div>
            <button
              onClick={() => handleCopySection('voice-ai', voiceAiStudioText)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shrink-0"
              title="Copy this section's markdown"
            >
              {copiedSection === 'voice-ai' ? (
                <>
                  <Check size={13} className="text-emerald-400" />
                  <span className="text-emerald-400 font-mono text-[11px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-5 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              The <strong className="text-slate-100">Voice AI Studio</strong> (<code className="text-cyan-300">/voice-ai</code>) pairs an Edge Neural Voice engine with high-performance, studio-grade 24kHz uncompressed linear PCM WebSocket streaming.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-cyan-500/30 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Radio size={14} /> Persistent WebSocket &amp; Gapless Scheduling
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Live sessions maintain an open WebSocket connection across multiple sentences. Incoming 24kHz PCM chunks are scheduled gaplessly on the Web Audio API timeline, letting you type and send new dialogue anytime without waiting or stuttering.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-purple-500/30 space-y-1.5">
                <div className="font-semibold text-purple-300 text-xs flex items-center gap-1.5">
                  <Bot size={14} /> &quot;Ask AI&quot; Live Voice Pipeline
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Switch between <strong>Type to Speak</strong> (manual input) and <strong>Ask AI</strong> mode. Submitting a question invokes NEXUS AI, renders a thinking pulse state, and automatically streams the generated answer into the live voice synthesis engine.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Volume2 size={14} /> 40+ Edge Neural Voices &amp; MP3 Export
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Zero-auth neural TTS with pitch and rate controls across 40+ languages (English, Spanish, French, German, Japanese, Chinese, Hindi), complete with instant audio playback and direct MP3 export.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Sliders size={14} /> Telemetry &amp; Full Session WAV Download
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Includes an anti-silence audio keep-alive buffer to prevent mobile browser suspension, a 4Hz diagnostics jitter/drift overlay, and 1-click export of the entire session&apos;s speech as an uncompressed 16-bit WAV file.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 13: Image Studio & AI Visual Synthesis Matrix */}
        <div
          id="doc-image-studio"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-md backdrop-blur-sm transition-colors hover:border-slate-700/80"
        >
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <ImageIcon size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <span>13. Image Studio &amp; AI Visual Synthesis Matrix</span>
                  <span className="text-[11px] font-mono font-normal text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60">
                    Multimodal Art
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Multi-provider diffusion engines (Pollinations, Hugging Face, Puter, Workers AI), /promptimage synthesizer, and /imageai commands
                </p>
              </div>
            </div>
            <button
              onClick={() => handleCopySection('image-studio', imageStudioText)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shrink-0"
              title="Copy this section's markdown"
            >
              {copiedSection === 'image-studio' ? (
                <>
                  <Check size={13} className="text-emerald-400" />
                  <span className="text-emerald-400 font-mono text-[11px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-5 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              The <strong className="text-slate-100">Image Studio</strong> (<code className="text-cyan-300">/image-studio</code>) generates photorealistic renders, concept art, and UI diagrams with multi-model redundancy and automated failover.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Layers size={14} /> Multi-Provider AI Diffusion Matrix
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Connects seamlessly to Pollinations.ai (Flux, SDXL), Hugging Face Inference API, Puter.js, and Cloudflare Workers AI with automatic fallback on rate limits or service outages.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Wand2 size={14} /> /promptimage AI Prompt Synthesizer
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Transforms brief 3-word concepts into 5 distinct, high-detail prompt variations (Cinematic, Concept Art, Cyberpunk, Retro, Vector) with one-click clipboard copying, Image Studio preloading, or instant generation.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Terminal size={14} /> /image &amp; /imageai Slash Commands
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Execute visual generation directly from the JARVIS prompt. <code className="text-cyan-300">/image</code> provides dual photo and AI discovery, while <code className="text-cyan-300">/imageai</code> executes direct diffusion rendering.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Palette size={14} /> Aspect Ratio &amp; Canvas Controls
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Supports 1:1 Square, 16:9 Landscape, 9:16 Mobile Story, 4:3 Standard, and 3:2 Classic ratios, with custom prompt enhancers and full-resolution lightbox inspection.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 14: Dynamic Specialist Matrix ("New Agent" Pipeline) */}
        <div
          id="doc-dynamic-specialist"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-md backdrop-blur-sm transition-colors hover:border-slate-700/80"
        >
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Zap size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <span>14. Dynamic Specialist Matrix (&quot;New Agent&quot; Pipeline)</span>
                  <span className="text-[11px] font-mono font-normal text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60">
                    5-Node Dynamic RAG
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  On-the-fly specialist role creation, configurable Specialist Slots (Slot 1-3), and /newagent command overrides
                </p>
              </div>
            </div>
            <button
              onClick={() => handleCopySection('dynamic-specialist', dynamicSpecialistText)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shrink-0"
              title="Copy this section's markdown"
            >
              {copiedSection === 'dynamic-specialist' ? (
                <>
                  <Check size={13} className="text-emerald-400" />
                  <span className="text-emerald-400 font-mono text-[11px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-5 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              The <strong className="text-slate-100">Dynamic Specialist Matrix</strong> generates tailored cognitive specialists on the fly for any multi-faceted task, enabling heterogeneous model deliberation.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-cyan-500/30 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Brain size={14} /> 5-Node Cognitive Matrix Workflow
                </div>
                <p className="text-xs text-slate-400 m-0">
                  <strong>Node 1: Planner</strong> dynamically authors 3 custom specialist personas with specialized system prompts and assigned toolkits. <strong>Nodes 2–4: Specialists 1, 2, 3</strong> execute research in parallel. <strong>Node 5: Synthesizer</strong> unifies their findings into a cohesive report.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Sliders size={14} /> Configurable Specialist Slots (1–3)
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Settings &gt; 🤖 New Agent lets you map each specialist slot to distinct models (e.g. Claude 3.5 Sonnet, GPT-4o, Llama 3 70B) for multi-architecture cross-auditing and varied analytical viewpoints.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Terminal size={14} /> /newagent Slash Command Override
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Prefix any query with <code className="text-cyan-300">/newagent [task]</code> to force the 5-node Dynamic Specialist Matrix for that single query without mutating your global UI toggle settings.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Globe size={14} /> Runtime Dynamic Tool Dispatch
                </div>
                <p className="text-xs text-slate-400 m-0">
                  The Planner grants each specialist tailored access to real-time tools including Live Web Search, Wikipedia REST summaries, 3-Tier News fallbacks, OpenWeatherMap atmospheric queries, and Web Page scrapers.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 15: Space & Planetary Intelligence Radar */}
        <div
          id="doc-space-weather"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-md backdrop-blur-sm transition-colors hover:border-slate-700/80"
        >
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Orbit size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <span>15. Space &amp; Planetary Intelligence Radar</span>
                  <span className="text-[11px] font-mono font-normal text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60">
                    Cosmic &amp; Weather
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  NASA APOD, real-time ISS orbital tracking, Near-Earth Asteroid (NEO) radar, and OpenWeatherMap radar
                </p>
              </div>
            </div>
            <button
              onClick={() => handleCopySection('space-weather', spaceIntelligenceText)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shrink-0"
              title="Copy this section's markdown"
            >
              {copiedSection === 'space-weather' ? (
                <>
                  <Check size={13} className="text-emerald-400" />
                  <span className="text-emerald-400 font-mono text-[11px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-5 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              NEXUS provides real-time situational telemetry across terrestrial atmosphere and deep space (<code className="text-cyan-300">/space</code> and <code className="text-cyan-300">/weather</code>).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Sparkles size={14} /> NASA APOD &amp; Deep Space Imagery
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Daily high-resolution astronomical captures from NASA APOD API with professional scientific descriptions, HD full-view inspection, and video player support.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Radio size={14} /> ISS Live Orbital Tracker &amp; Pass Radar
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Tracks the International Space Station in real time (~27,600 km/h velocity, ~420 km altitude) with spherical Great Circle distance calculations for proximity alerts.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <ShieldCheck size={14} /> Near-Earth Object (NEO) Asteroid Radar
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Monitors close-approach asteroids and comets via NASA NeoWs telemetry, tracking velocity, diameter, miss distance in AU/LD, and hazardous classification badges.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Globe size={14} /> Global Atmospheric Radar &amp; Weather Maps
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Real-time OpenWeatherMap atmospheric radar with temperature, humidity, UV index, wind streamline particle visualizations, and multi-day hourly forecasts.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 16: Parallax 20-Agent Swarm & Genesis Arena */}
        <div
          id="doc-parallax-swarm"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-md backdrop-blur-sm transition-colors hover:border-slate-700/80"
        >
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Users size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <span>16. Parallax — 20-Agent Autonomous Swarm &amp; Genesis Arena</span>
                  <span className="text-[11px] font-mono font-normal text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60">
                    20-Agent Swarm
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  3-round multi-agent swarm deliberation (/parallax), Genesis Dynamic Architect mode, and 8 debate formats
                </p>
              </div>
            </div>
            <button
              onClick={() => handleCopySection('parallax-swarm', parallaxSwarmText)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shrink-0"
              title="Copy this section's markdown"
            >
              {copiedSection === 'parallax-swarm' ? (
                <>
                  <Check size={13} className="text-emerald-400" />
                  <span className="text-emerald-400 font-mono text-[11px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-5 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              <strong className="text-slate-100">Parallax</strong> (<code className="text-cyan-300">/parallax</code>) orchestrates up to <strong>20 specialized autonomous agents</strong> (VERITAS, AURORA, CHRONOS, AXIOM, ECHO, LEDGER, SOCRATES, PIXEL, VANGUARD, HARMONY, CIPHER, NOMAD, SENTINEL, LUMEN, CATALYST, GRAVITY, MOSAIC, ORACLE, EMBER, and NEXUS-9) across 3 iterative rounds of debate and synthesis.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-cyan-500/30 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Layers size={14} /> 3-Round Swarm Deliberation &amp; Scaling
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Configure active swarm scale (up to 20 agents) executing through <strong>Round 1 (Initial Thesis)</strong>, <strong>Round 2 (Cross-Examination &amp; Rebuttal)</strong>, and <strong>Round 3 (Master Synthesis)</strong>.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-purple-500/30 space-y-1.5">
                <div className="font-semibold text-purple-300 text-xs flex items-center gap-1.5">
                  <Sparkles size={14} /> Genesis Mode &amp; 8 Debate Arenas
                </div>
                <p className="text-xs text-slate-400 m-0">
                  <strong>Genesis Mode</strong> dynamically spawns custom specialists per prompt. Switch between <em>Default</em>, <em>Genesis</em>, <em>Courtroom</em>, <em>Red vs Blue</em>, <em>Senate</em>, <em>VC Pitch</em>, <em>Sci-Fi</em>, and <em>Newsroom</em> arenas.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Swords size={14} /> Devil&apos;s Advocate &amp; Human-in-the-Loop
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Inject a live <strong>Devil&apos;s Advocate</strong> disruption or interject your own steering prompts between swarm rounds to redirect the collective intelligence.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Volume2 size={14} /> Neural Voice Readout &amp; Transcript Export
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Listen to individual swarm agents via Edge Neural TTS and export complete multi-agent transcripts in clean Markdown.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 17: Visual Workflows Studio */}
        <div
          id="doc-workflows-studio"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-md backdrop-blur-sm transition-colors hover:border-slate-700/80"
        >
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Workflow size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <span>17. Visual Workflows Studio — Node Automation Canvas</span>
                  <span className="text-[11px] font-mono font-normal text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60">
                    Node Automation
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Drag-and-drop visual DAG pipeline builder (/workflows) with conditional branching, node freezing, and live telemetry
                </p>
              </div>
            </div>
            <button
              onClick={() => handleCopySection('workflows-studio', workflowsStudioText)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shrink-0"
              title="Copy this section's markdown"
            >
              {copiedSection === 'workflows-studio' ? (
                <>
                  <Check size={13} className="text-emerald-400" />
                  <span className="text-emerald-400 font-mono text-[11px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-5 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              The <strong className="text-slate-100">Visual Workflows Studio</strong> (<code className="text-cyan-300">/workflows</code>) lets you chain data sources, academic searches, AI models, and conditional logic on an interactive node canvas.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Cpu size={14} /> 9 Specialized Node Types
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Chain <strong>Input</strong>, <strong>Web Search</strong>, <strong>Web Fetch</strong>, <strong>Scholar Search</strong>, <strong>AI Prompt</strong>, <strong>Image Gen</strong>, <strong>Weather</strong>, <strong>NASA Space</strong>, and <strong>IF/ELSE Branching</strong> nodes.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Sliders size={14} /> Node Freezing, Mock Payloads &amp; Run History
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Freeze upstream nodes to lock cached outputs, inject custom mock test data, and inspect step-by-step execution timing and saved workflow runs.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 18: Custom AI Skills & Modular Instruction Vault */}
        <div
          id="doc-custom-skills"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-md backdrop-blur-sm transition-colors hover:border-slate-700/80"
        >
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <BookOpen size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <span>18. Custom AI Skills &amp; Modular Instruction Vault</span>
                  <span className="text-[11px] font-mono font-normal text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60">
                    Modular Skills
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Import SKILL.md files from GitHub or author custom instruction modules in Settings &gt; Skills
                </p>
              </div>
            </div>
            <button
              onClick={() => handleCopySection('custom-skills', customSkillsText)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shrink-0"
              title="Copy this section's markdown"
            >
              {copiedSection === 'custom-skills' ? (
                <>
                  <Check size={13} className="text-emerald-400" />
                  <span className="text-emerald-400 font-mono text-[11px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-5 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              The <strong className="text-slate-100">Custom AI Skills</strong> vault (<strong>Settings &gt; Skills</strong> and the quick Skills drawer) lets you attach domain-specific rules, coding standards, and persona instructions across NEXUS.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Globe size={14} /> GitHub Import &amp; Manual Authoring
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Import <code className="text-cyan-300">SKILL.md</code> files directly from GitHub repositories or write custom markdown instructions (up to 5 stored skills, 24,000 characters each).
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Zap size={14} /> Simultaneous Multi-Skill Injection
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Activate up to 3 skills concurrently to dynamically augment AI Assistant, JARVIS, and Multi Chat system prompts without repeating context.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 19: Tutor Mode, Commander Unit & Live Artifact Canvas */}
        <div
          id="doc-assistant-advanced"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-md backdrop-blur-sm transition-colors hover:border-slate-700/80"
        >
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <GraduationCap size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <span>19. Tutor Mode, Commander Unit &amp; Live Artifact Canvas</span>
                  <span className="text-[11px] font-mono font-normal text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60">
                    Socratic &amp; Tactical
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Guided 4-stage Socratic Tutor, 4-agent Commander tactical hierarchy, and real-time HTML/React/SVG sandbox in /assistant
                </p>
              </div>
            </div>
            <button
              onClick={() => handleCopySection('assistant-advanced', assistantAdvancedText)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shrink-0"
              title="Copy this section's markdown"
            >
              {copiedSection === 'assistant-advanced' ? (
                <>
                  <Check size={13} className="text-emerald-400" />
                  <span className="text-emerald-400 font-mono text-[11px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-5 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              Inside <strong className="text-slate-100">AI Assistant</strong> (<code className="text-cyan-300">/assistant</code>), specialized interactive engines power structured learning, multi-agent tactical execution, and live code rendering:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-amber-500/30 space-y-1.5">
                <div className="font-semibold text-amber-300 text-xs flex items-center gap-1.5">
                  <GraduationCap size={14} /> Socratic Tutor Mode
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Select <strong>Beginner / Intermediate / Advanced</strong> level and <strong>Learn / Exam prep / Refresher</strong> goal. Progress through <em>Explain &rarr; Example &rarr; Practice &rarr; Quiz</em> with 1-click study actions.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-rose-500/30 space-y-1.5">
                <div className="font-semibold text-rose-300 text-xs flex items-center gap-1.5">
                  <Swords size={14} /> Commander Tactical Unit
                </div>
                <p className="text-xs text-slate-400 m-0">
                  4-stage tactical pipeline: <strong>Commander</strong> sets strategy, <strong>Agent Alpha</strong> builds the primary solution, <strong>Agent Beta</strong> stress-tests risks, and <strong>Master Synthesizer</strong> delivers the final report.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-cyan-500/30 space-y-1.5">
                <div className="font-semibold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Code2 size={14} /> Live Artifact Canvas
                </div>
                <p className="text-xs text-slate-400 m-0">
                  Interactive split-pane sandbox that renders HTML, CSS, JS, React/TSX, and SVG code live with Desktop/Tablet/Mobile viewport toggles and console diagnostics.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
