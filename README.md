# NEXUS Intelligence

A unified multi-agent intelligence and research platform combining autonomous deep research, web search, real-time weather analytics, space telemetry, media stream extraction, neural voice synthesis, and IoT device management. Built with React 18, TypeScript, Tailwind CSS, Vite, and an Express full-stack architecture with zero client-side secret leakage.

---

## Key Capabilities

### 1. JARVIS Multi-Agent Research Mesh (10 Agents + Custom Extensibility)
- **10 Specialized Agents**:
  - **6 Core Consensus Agents**:
    - **Planner 🧭**: Deconstructs user queries into structured execution plans, search directives, and domain requirements.
    - **Researcher 🔎**: Conducts multi-query web searches, extracts verifiable facts, and preserves full-length article provenance.
    - **Fact Checker 🛡️**: Audits gathered claims against primary source snippets, assigns credibility scores, and detects hallucinations.
    - **Advisor 💡**: Provides conceptual trade-off analysis, comparative perspectives, and strategic recommendations.
    - **Reviewer 🔬**: Evaluates synthesis quality, coherence, and coverage against user specifications.
    - **Final Synthesizer ✨**: Produces authoritative, publication-grade markdown synthesis paired with grounded sources and citations.
  - **4 Specialized Domain Agents**:
    - **Architect 🏗️**: Generates responsive SVG architecture diagrams, flowcharts, and system schematics.
    - **Data Analyst 📊**: Formulates interactive Recharts graphs, telemetry tables, and statistical metric cards.
    - **Image Finder 🖼️**: Discovers and retrieves high-resolution visual imagery and photographic references (Wikimedia Commons / Pexels).
    - **Coder 💻**: Architectures, implements, and reviews software solutions, algorithm implementations, and scripts with full syntax highlighting.
- **Custom Agent Support**: Configure custom user-defined agents with custom system prompts and customizable pipeline hook positions (*Before Final Synthesizer*, *Parallel*, or *Post-Evaluation*).
- **Specialized Execution Pipelines**:
  - **Deep Research Mode**: Multi-iteration investigation with interactive fact-preview expansion, source drawer inspection, and full JSON/Markdown export.
  - **Automated Coding Pipeline**: Auto-routed 4-agent execution mesh (*Planner → Coder → Reviewer → Final Synthesizer*) for programming and scripting requests.
  - **Direct Synthesis Shortcut**: Fast-path response generation for conversational and quick-lookup prompts.
- **Live Pipeline HUD & Telemetry**: Visual node topology matrix, real-time agent execution stream, latency metrics, consensus tracking, and per-agent token budgeting.

### 2. Media Extraction & Streaming Engine (`yt-dlp`)
- **Server-Side Media Extraction**: Integrated `yt-dlp` extraction engine in `server/ytdlp.ts` running direct `--dump-json` queries without downloading bulky files to disk.
- **In-App Media Player (`MediaViewer`)**: Multi-resolution video streaming (1080p, 720p, 480p, 360p, Auto), audio/video format probing, and graceful embed fallback.
- **Security & SSRF Protection**: Strict protocol validation (`https:`) and internal IP blocking (`127.0.0.1`, `10.0.0.0/8`, `192.168.0.0/16`, `172.16.0.0/12`, `169.254.169.254`) preventing server-side request forgery.
- **Diagnostic & Settings Panel**: In-app backend status check, version inspection, and real-time URL extraction testing under Settings → Media.

### 3. Multi-Provider AI Architecture & Key Management
- **Flexible AI Backends**: Seamlessly connect to Google Gemini (Gemini 2.5 Flash, 2.5 Pro, 2.0 Flash), OpenRouter, DeepSeek, Groq, or custom OpenAI-compatible endpoints.
- **Key Strategy Rotation**: Configurable rotation modes including Round-Robin, Failover, Single Key, and Distributed load balancing.
- **Real-Time Connectivity Verification**: In-app test runners with latency measurement and diagnostic status reporting.

### 4. Search & News Intelligence
- **Unified Search Engine**: Server-side proxy routing to real search and knowledge APIs (Wikipedia, DuckDuckGo, web scraping) with zero client-side key exposure.
- **Categorized News Feed**: Real-time global headlines filtered by category (Technology, Science, Business, World, Entertainment, Sports) with publisher verification.
- **Saved Articles & Research Library**: Offline-accessible local persistence for research artifacts, bookmarked queries, code blocks, and notes.

### 5. Weather Intelligence & Interactive Maps
- **Open-Meteo Integration**: Precision geocoding, current weather conditions, hourly projections, and 7-day extended forecasts with no API key requirement.
- **Condition-Aware Atmospheric Effects**: Dynamic canvas animations (rain, thunder, snow, sunshine, starfields) with accessibility reduced-motion controls.
- **Interactive Leaflet Radar**: Layered weather maps with precipitation radar, wind patterns, and temperature heatmaps.

### 6. Space & Astronomy Intelligence
- **Cosmic Telemetry**: Astronomy Picture of the Day (NASA APOD), live International Space Station (ISS) orbital coordinates and telemetry tracker, and planetary ephemeris data.

### 7. Vox Neural Voice & Edge TTS
- **High-Fidelity Neural Speech**: Dual-engine voice synthesis combining Microsoft Edge TTS server-side neural voices with Web Speech API fallback.
- **Voice Studio**: Multi-accent voice selection, pitch and rate controls, real-time waveform visualizers, and audio export.
- **Speech-to-Text Voice Search**: Hands-free voice input for search queries and conversational assistant interactions.

### 8. IoT Device Agent & Telegram Gateway
- **Device Management**: Local network device discovery, ping latency monitoring, and smart TV/media controller with Capacitor TCP socket integration.
- **Telegram Bot Integration**: Webhook and polling modes, custom command menus, automated notifications, and interactive chat assistant gateway.

### 9. Mobile & Cross-Platform Precision
- **Touch-Optimized Responsive Layout**: Dedicated `@media (max-width: 768px)` design with horizontal touch-scrolling tabs, word-breaking technical strings, and edge-to-edge mobile formatting.
- **Progressive Web App (PWA)**: Offline caching, installable web application shell, and service worker lifecycle management.
- **Native Android (Capacitor 7)**: Native Android build setup supporting `arm64-v8a`, `armeabi-v7a`, and `x86_64` architectures.

---

## Architecture Overview

```
nexus-intelligence/
├── server/                 # Express full-stack backend & Vite middleware
│   ├── index.ts            # Server entry point, API route handlers, and proxy endpoints
│   ├── ytdlp.ts            # yt-dlp binary detection, format extraction & SSRF security
│   └── routes/             # Search, weather, AI, speech, and proxy endpoints
├── src/
│   ├── components/         # Reusable UI widgets, HUD trackers, and visualizers
│   │   ├── jarvis/         # JARVIS 10-agent research mesh, topology & HUD components
│   │   ├── voice/          # Vox audio & Edge TTS neural synthesis controls
│   │   ├── home/           # Terminal HUD, system diagnostics & world telemetry
│   │   ├── MediaViewer.tsx # In-app stream player with resolution switcher
│   │   └── WeatherMap.tsx  # Leaflet interactive atmospheric radar map
│   ├── pages/              # Primary route views (Jarvis, Search, Weather, Space, etc.)
│   │   ├── JarvisPage.tsx  # JARVIS multi-agent research dashboard
│   │   ├── SettingsPage.tsx# System settings, AI providers, and media extraction diagnostics
│   │   ├── TelegramPage.tsx# Telegram bot gateway and automation panel
│   │   └── VoiceAI.tsx     # Vox Neural Voice Studio
│   ├── services/           # JARVIS orchestrator, AI callers, weather & search clients
│   │   ├── jarvisOrchestrator.ts # Multi-agent consensus engine & execution loop
│   │   ├── unifiedSearch.ts      # Multi-source web, news, and Wikipedia search
│   │   └── api.ts                # Full-stack API proxy client
│   └── lib/                # Storage migrations, formatters, audio, and device agents
│       └── storage.ts      # Agent definitions, system prompts, and localStorage persistence
├── android/                # Capacitor Android native project configuration
└── dist/                   # Production build outputs (bundled SPA + dist/server.cjs)
```

---

## Getting Started

### Prerequisites
- **Node.js**: 18+ (Node 20+ recommended)
- **npm** or **yarn**
- **Python 3 & yt-dlp** *(optional)*: For local media extraction (a standalone `yt-dlp` binary is pre-bundled in the project root)

### Installation
```bash
git clone <repository-url>
cd nexus-intelligence
npm install
```

### Environment Configuration
Copy the example environment template:
```bash
cp .env.example .env
```

Configure your preferred API keys in `.env` (the app functions gracefully with free and public fallbacks):
```env
# AI Providers (Google Gemini, OpenRouter, DeepSeek, or custom OpenAI-compatible endpoints)
GEMINI_API_KEY=
OPENROUTER_API_KEY=
DEEPSEEK_API_KEY=
AI_API_KEY=
AI_API_URL=
AI_MODEL=

# Search & News APIs (Optional; fallback search providers work automatically)
SEARCH_API_KEY=
SEARCH_API_URL=
GNEWS_API_KEY=
EXA_API_KEY=
PEXELS_API_KEY=

# Space & Astronomy Telemetry
NASA_API_KEY=

# Maps & Weather (Open-Meteo works without keys; optional custom map providers)
MAP_API_KEY=
WEATHER_API_KEY=
WEATHER_API_URL=

# Headless Render Proxy (Optional for deep web page extraction)
ENABLE_HEADLESS_RENDER=
HEADLESS_RENDER_TIMEOUT_MS=
RENDER_PROXY_URL=
RENDER_PROXY_API_KEY=
```

---

## Development

Start the integrated full-stack development server on port `3000`:
```bash
npm run dev
```

The application will be accessible at `http://localhost:3000`.

---

## Production Build & Execution

1. Build both client-side assets and backend bundle:
   ```bash
   npm run build
   ```
   *This compiles the Vite frontend into `dist/` and bundles `server/index.ts` into a self-contained CommonJS executable (`dist/server.cjs`) via `esbuild`.*

2. Start the production server:
   ```bash
   npm start
   ```

---

## Code Quality & Verification

- **Linting**:
  ```bash
  npm run lint
  ```
- **Type Checking**:
  ```bash
  npm run typecheck
  ```

---

## Docker Deployment

Build and run using Docker:
```bash
docker compose up --build
```
The Docker configuration builds a production-ready Node Bookworm container supporting amd64 and arm64 Linux hosts.

---

## Mobile Build (Android)

NEXUS includes full Capacitor 7 Android integration:
```bash
# Sync web build assets with the Android project
npm run build
npx cap sync android

# Open in Android Studio
npx cap open android
```
Refer to `ANDROID_BUILD.md` for detailed ABI signing and deployment instructions.
