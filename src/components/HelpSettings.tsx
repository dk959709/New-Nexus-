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

**NEXUS Intelligence** is an enterprise-grade multi-agent autonomous AI workstation, neural research lab, and real-time telemetry matrix. At its core, NEXUS coordinates specialized artificial intelligence agents through the **JARVIS Autonomous Multi-Agent Cognitive Matrix**, bridging high-level reasoning with live web groundings, encyclopedic knowledge graphs, on-device vector document vaults (RAG), hardware controls, and multi-provider language models.

#### Key Platform Capabilities:
- **JARVIS Multi-Agent Matrix**: Sequential and parallel cognitive pipelines uniting 10+ specialized agents (Planning, Research, Fact-Checking, Strategic Advisory, Audit Review, Final Synthesis, System Architecture, Data Analysis, Media Discovery, and Fast/Online Coding) with full source attribution.
- **Multi-Provider Neural Backbone**: Native configuration support for 10+ major AI providers including OpenAI, Anthropic Claude, Google Gemini, Groq (Llama 3), Mistral, Perplexity, OpenRouter, Cloudflare Workers AI, and custom OpenAI-compatible endpoints with automated runtime failover.
- **Real-Time Multimodal Web Retrieval**: High-speed live search over Tavily, resilient 3-tier news fallback chains, Wikipedia REST extracts, Wikidata knowledge graphs, and Pixabay visual assets.
- **On-Device Document Library & Semantic Vector RAG**: Secure, privacy-first local IndexedDB vector vault supporting PDF, DOCX, TXT, CSV, MD, JSON, and pasted text with semantic chunking, cosine similarity search, custom renaming, in-place text editing with instant re-indexing, and automated JARVIS synthesis grounding.
- **Hybrid Credential Architecture**: Seamless two-tier credential resolution combining container-level host environment variables (Render) with an encrypted AES-256 local vault (\`data/api_catalog.json\`).
- **Telemetry & Peripheral Hardware Bridges**: Real-time atmospheric weather tracking (OpenWeatherMap), NASA deep space intelligence (APOD & Near-Earth Object Asteroid radar), ADB-over-Network Smart TV remote controller, and autonomous Telegram Bot synchronization.
- **Diagnostic Transparency & Export Engine**: Real-time streaming diagnostic logs, interactive SVG system diagrams, tabular Recharts analytics, and single-click Markdown / rich HTML clipboard exports.`;

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
  \`/imagesai photorealistic portrait of an astronaut on Mars\``;

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

NEXUS is designed for immersive, tactile research with visual, auditory, and archival customization:

#### A. JARVIS Synthesis Theme Toggle
- Located on JARVIS chat synthesis headers and saved report cards (sparkle icon).
- **Tactical Cyan Theme**: Dark obsidian background with vibrant cyan borders, holographic status lights, and neon accents designed for tactical research and telemetry.
- **OLED Deep Black Theme**: High-contrast, pure black minimal aesthetic (#000000) engineered for OLED screens, battery conservation, and reduced eye strain during extended night sessions.

#### B. Saved Intelligence Repository (\`/saved\`)
- Accessible from the main navigation bar.
- Allows users to bookmark, tag, and organize full JARVIS synthesis reports, system architecture diagrams, and analytical charts.
- Features:
  - **Category Filtering**: Filter across All, JARVIS Syntheses, Architecture Diagrams, and Data Charts.
  - **Raw Markdown Toggle**: Switch between rendered rich HTML typography and raw Markdown code.
  - **Single-Click Exports**: Copy rich formatted HTML for Google Docs/Word, raw Markdown for GitHub/Obsidian, or print/save to PDF.

#### C. Edge Neural Text-to-Speech (TTS)
- Integrated voice synthesis engine powered by Microsoft Edge neural models (\`/api/edge-tts\`) with natural intonation, cadence, and phrasing.
- Features automatic reading mode for JARVIS synthesis answers, live play/pause controls, and fallback to the browser Web Speech API when offline.

#### D. Tactical Audio Feedback
- Subtle acoustic clicks and mechanical audio feedback when executing commands, switching tabs, and navigating the interface (can be toggled on/off in **Settings > Appearance**).`;

  // Section 7: Multi Chat
  const multiChatText = `### 7. Multi Chat — 3-Persona Sequential Deliberation Matrix

**Multi Chat** (/multichat) is a collaborative multi-persona conversational system where three distinct AI agents deliberate in a sequential chain, reading upstream thoughts and providing diverse perspectives on any inquiry.

#### A. The 3 Specialized Personas:
1. **NOVA (Professional & Factual — The Researcher)**:
   - **Role & Tone**: Analytical, rigorous, structured, and factual. Focuses on empirical accuracy, logical consistency, cited facts, and objective data breakdowns.
   - **Position in Chain**: Executes first in the sequence, establishing the factual baseline and framing the core problem.
2. **ORBIT (Casual & Friendly — The Buddy)**:
   - **Role & Tone**: Approachable, witty, empathetic, and relatable. Translates complex technical jargon into practical, everyday language and metaphors.
   - **Position in Chain**: Executes second. Ingests NOVA's factual breakdown, reacting to it, simplifying nuances, pointing out practical trade-offs, or adding a lighthearted conversational perspective.
3. **COSMOS (Calm & Wise — The Mentor)**:
   - **Role & Tone**: Philosophical, reflective, strategic, and balanced. Takes a high-altitude holistic view, considering long-term implications, ethical principles, and mental clarity.
   - **Position in Chain**: Executes third. Ingests both NOVA's data and ORBIT's practical buddy insights, synthesizing a mature final consensus or philosophical takeaway.

#### B. Sequential Pipeline Dynamics & Memory
- **Context Chaining**: Each persona does not speak in a vacuum. ORBIT sees NOVA's output in real time; COSMOS receives both NOVA's and ORBIT's answers. Personas can actively agree, respectfully challenge assumptions, or expand on each other's points.
- **20-Message Memory Window**: Every persona maintains a rolling sliding memory window of the last 20 conversational turns, allowing rich back-and-forth discussions without losing conversational thread.
- **Permanent Memories**: Key facts, user preferences, and custom context entries added via Multi Chat Settings are permanently injected into every persona prompt across all sessions.
- **Response Language**: Global setting allowing the entire 3-persona panel to respond in English, Spanish, French, German, Japanese, Chinese, or any configured language.

#### C. Audio, Export & Granular Message Controls
- **Neural Voice Synthesis (Listen)**: Powered by Edge Neural TTS with natural speech cadence and Web Speech API fallback.
- **Direct MP3 Download**: Instant single-click export of synthesized neural voice audio to .mp3 for offline listening or study.
- **Markdown & HTML Copy**: Copy individual persona answers or the entire combined 3-persona turn in clean Markdown or rich formatted HTML.
- **Surgical Card Deletion**: Delete individual question-and-answer cards from the conversation without wiping the entire session history.`;

  // Section 8: AI Assistant
  const assistantText = `### 8. AI Assistant — Direct Conversational Companion

The **AI Assistant** (/assistant) provides a rapid, streamlined single-turn and multi-turn conversational interface for everyday questions, quick brainstorming, text transformations, problem solving, and productivity workflows.

#### A. How AI Assistant Differs from JARVIS & Multi Chat:
- **JARVIS Matrix**: A heavy 10-agent autonomous research engine executing multi-step search querying, fact-checking, knowledge-graph entity extraction, SVG blueprint rendering, and data chart generation.
- **Multi Chat**: A 3-persona sequential deliberation panel (NOVA -> ORBIT -> COSMOS) for multi-angle debate and diverse viewpoints.
- **AI Assistant**: A high-speed, direct conversational companion designed for low latency, zero multi-agent orchestration overhead, and immediate answers.

#### B. Core Capabilities & Tool Integrations:
- **Smart Memory (Persistent Scratchpad)**: Automatically compresses and remembers context across messages (up to 1,200 characters). You can view, edit, or wipe this persistent memory scratchpad at any time using the Brain icon editor.
- **Dynamic Tool Dispatch**: Seamlessly executes live web searches or fetches real-time meteorological weather data when the query demands up-to-the-minute information.
- **Quick Prompts**: Instant starter prompts across explanation, problem solving, productivity advice, and topic summaries.
- **Voice Narration & Audio**: Full support for Edge Neural TTS and browser Web Speech read-aloud with instant pause/play controls.
- **Clipboard & Export**: Single-click markdown copying for all generated responses.`;

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
      title: 'Slash Commands (/search, /web, /customapi, /code, /codeonline)',
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
      title: 'Theme, Saved Reports & Neural TTS',
      badge: 'Customization',
      icon: Palette,
      text: themeCustomizationText,
    },
    {
      id: 'multichat',
      title: 'Multi Chat (NOVA, ORBIT, COSMOS)',
      badge: 'Sequential Deliberation',
      icon: MessageSquare,
      text: multiChatText,
    },
    {
      id: 'assistant',
      title: 'AI Assistant & Smart Memory',
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
                  <Sparkles size={14} /> JARVIS Synthesis Theme
                </div>
                <p className="text-[12px] text-slate-400 m-0 leading-relaxed">
                  Toggle between <strong>Tactical Cyan</strong> (dark obsidian background with cyan ambient glow and borders) and <strong>OLED Deep Black</strong> (pitch-black minimalist background for OLED contrast and zero glare).
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
                  Sequential Deliberation
                </span>
                <h3 className="text-lg font-bold text-slate-100 m-0">
                  Multi Chat — 3-Persona Deliberation Matrix & Memory
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
              <strong className="text-slate-100 font-semibold">Multi Chat</strong> (<code className="text-cyan-300">/multichat</code>) coordinates three distinct AI personas in a sequential deliberative pipeline. Rather than generating a single perspective, each persona executes in order, reviews the prior persona&apos;s output, and actively builds upon or debates previous points.
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
                <div className="text-[11px] font-semibold text-slate-200">Professional & Factual</div>
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
                <div className="text-[11px] font-semibold text-slate-200">Casual & Friendly</div>
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
                <div className="text-[11px] font-semibold text-slate-200">Calm & Wise</div>
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
                  <span>Sequential Pipeline & Sliding Memory</span>
                </div>
                <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4 m-0 leading-relaxed">
                  <li><strong>Context Chaining:</strong> ORBIT sees NOVA&apos;s response in real time; COSMOS reviews both NOVA and ORBIT.</li>
                  <li><strong>20-Message Memory Window:</strong> Every persona retains the last 20 conversational turns in rolling local context.</li>
                  <li><strong>Permanent Memories:</strong> Custom facts and user preferences configured in Multi Chat Settings are permanently appended to every persona&apos;s prompt.</li>
                  <li><strong>Response Language:</strong> Global setting allowing all 3 personas to communicate in English, Spanish, French, German, Japanese, Chinese, etc.</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Volume2 size={14} className="text-cyan-400" />
                  <span>Audio Synthesis & Message Controls</span>
                </div>
                <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4 m-0 leading-relaxed">
                  <li><strong>Listen (Neural TTS):</strong> Microsoft Edge neural voice playback with lifelike cadence and Web Speech API fallback.</li>
                  <li><strong>Download MP3:</strong> Single-click export of synthesized neural speech directly to standalone <code className="text-slate-300">.mp3</code> files.</li>
                  <li><strong>Markdown & HTML Copy:</strong> One-tap clipboard copy of individual persona answers or the complete 3-persona turn.</li>
                  <li><strong>Surgical Card Deletion:</strong> Delete specific message cards and audio instances without clearing your entire conversation history.</li>
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
                  Direct Companion
                </span>
                <h3 className="text-lg font-bold text-slate-100 m-0">
                  AI Assistant — Direct Conversational Companion & Smart Memory
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
              The <strong className="text-slate-100 font-semibold">AI Assistant</strong> (<code className="text-cyan-300">/assistant</code>) is a streamlined single-turn and multi-turn conversational interface for everyday questions, quick brainstorming, coding snippets, explanations, and productivity workflows.
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
                  <MessageSquare size={14} /> Multi Chat
                </div>
                <p className="text-[12px] text-slate-400 m-0 leading-relaxed">
                  Sequential 3-persona deliberation mesh (NOVA &rarr; ORBIT &rarr; COSMOS) offering multi-angle critical debates and philosophical consensus.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="text-cyan-300 font-semibold text-xs flex items-center gap-1.5">
                  <Bot size={14} /> AI Assistant
                </div>
                <p className="text-[12px] text-slate-400 m-0 leading-relaxed">
                  Fast, lightweight conversational companion optimized for near-instant responses, zero multi-agent pipeline overhead, and persistent Smart Memory context.
                </p>
              </div>
            </div>

            {/* Key Capabilities */}
            <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="text-xs font-semibold text-slate-200">
                Core Capabilities & Built-in Features:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-400">
                <div className="space-y-1">
                  <strong className="text-slate-200 block">🧠 Smart Memory (Persistent Scratchpad):</strong>
                  <span>Automatically retains and compresses key conversational points (up to 1,200 characters). You can view, edit, or wipe this memory at any time via the Brain icon.</span>
                </div>
                <div className="space-y-1">
                  <strong className="text-slate-200 block">⚡ Dynamic Tool Execution:</strong>
                  <span>Automatically triggers live web search and real-time OpenWeatherMap atmospheric queries when timely, external groundings are required.</span>
                </div>
                <div className="space-y-1">
                  <strong className="text-slate-200 block">💬 Quick Starter Prompts:</strong>
                  <span>One-click category prompts for instant explanations, troubleshooting, productivity tips, and structured topic summaries.</span>
                </div>
                <div className="space-y-1">
                  <strong className="text-slate-200 block">🔊 Voice Narration & Copy:</strong>
                  <span>Full Edge Neural TTS audio readout with play/pause toggles, Web Speech fallback, and single-click Markdown clipboard copy.</span>
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
      </div>
    </div>
  );
}
