# NEXUS Intelligence

A unified multi-agent intelligence platform combining autonomous deep research, web search, real-time weather analytics, space telemetry, neural voice synthesis, and IoT device management. Built with React 18, TypeScript, Tailwind CSS, Vite, and an Express full-stack architecture.

---

## Key Capabilities

### 1. JARVIS Multi-Agent Research Mesh
- **Autonomous Multi-Agent Pipeline**:
  - **Planner**: Deconstructs user intent into structured sub-tasks and strategic search directives.
  - **Researcher**: Gathers multi-source intelligence, extracts verifiable facts, and preserves full-length article provenance.
  - **Fact Checker**: Validates claims against primary search snippets, assigns credibility scores, and detects discrepancies or hallucinations.
  - **Advisor**: Provides conceptual trade-off analysis, comparative perspectives, and actionable recommendations.
  - **Reviewer**: Evaluates synthesis quality, coherence, and coverage against user requirements.
  - **Final Synthesizer**: Produces authoritative, grounded markdown synthesis paired with a dedicated Grounded Sources UI.
- **Deep Research Mode**: Multi-iteration investigation with interactive fact-preview expansion, source drawer inspection, and full JSON/Markdown export.
- **Live Pipeline HUD & Telemetry**: Visual node topology matrix, terminal diagnostic stream, latency tracking, and per-agent token budgeting.

### 2. Search & News Intelligence
- **Unified Search Engine**: Server-side proxy routing to real search and news APIs with zero client-side key leakage.
- **Categorized News Feed**: Real-time global headlines filtered by topic (Technology, Science, Business, World, etc.) with publisher verification.
- **Saved Articles & History**: Offline-accessible local persistence for research artifacts, bookmarked queries, and notes.

### 3. Weather & Atmospheric Maps
- **Open-Meteo Integration**: Geocoding, current weather, hourly projections, and 7-day extended forecasts with no API key required.
- **Condition-Aware Backgrounds**: Dynamic atmospheric visual animations (rain, thunder, snow, sunshine, starfields) with accessibility reduced-motion controls.
- **Interactive Leaflet Radar**: Layered weather maps with precipitation radar, wind patterns, and temperature heatmaps.

### 4. Space & Astronomy Intelligence
- **Cosmic Telemetry**: Astronomy Picture of the day (NASA APOD), live International Space Station (ISS) orbital tracking, and planetary ephemeris.

### 5. Vox Neural Voice & Edge TTS
- **High-Fidelity Speech Synthesis**: Integrated Edge TTS and Web Speech APIs with multi-accent voice selection.
- **Voice Interactions**: Speech-to-text voice search input and audio playback for synthesized answers.

### 6. IoT Device Agent & Telegram Gateway
- **Device Management**: LAN device discovery and smart TV/media controller with Capacitor TCP socket integration.
- **Telegram Bot Integration**: Command menu, live status monitoring, and remote assistant interactivity.

### 7. Cross-Platform Support
- **Responsive Web & PWA**: Offline caching, installable web application shell, and service worker lifecycle management.
- **Native Android**: Capacitor 7 build setup supporting `arm64-v8a`, `armeabi-v7a`, and `x86_64` architectures.

---

## Architecture Overview

```
nexus-intelligence/
├── server/                 # Express backend API & Vite dev middleware
│   ├── index.ts            # Server entry point & API route handlers
│   └── routes/             # Search, weather, AI, speech, and proxy endpoints
├── src/
│   ├── components/         # Reusable UI widgets, HUD trackers, and visualizers
│   │   ├── jarvis/         # JARVIS multi-agent research mesh components
│   │   ├── voice/          # Vox audio & Edge TTS controls
│   │   └── home/           # Terminal HUD and world telemetry
│   ├── pages/              # Primary route views (Jarvis, Search, Weather, etc.)
│   ├── services/           # Orchestrator, multi-agent engine, weather & search clients
│   └── lib/                # Storage migrations, formatters, audio, and device agents
├── android/                # Capacitor Android native project configuration
└── dist/                   # Production build outputs (bundled SPA + server.cjs)
```

---

## Getting Started

### Prerequisites
- Node.js 18+ (Node 20+ recommended)
- npm or yarn

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

Configure your preferred API keys in `.env`:
```env
# AI Providers (At least one recommended for multi-agent synthesis)
GEMINI_API_KEY=
OPENROUTER_API_KEY=
DEEPSEEK_API_KEY=
AI_API_URL=
AI_MODEL=

# Search & News (Optional, Open-Meteo works without keys)
SEARCH_API_KEY=
SEARCH_API_URL=
GNEWS_API_KEY=
PEXELS_API_KEY=

# Space & Maps
NASA_API_KEY=
MAP_API_KEY=
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

Build and run using Docker Compose:
```bash
docker compose up --build
```
The Docker configuration builds a production-ready Node Bookworm container supporting amd64 and arm64 Linux hosts.

---

## Mobile Build (Android)

NEXUS includes full Capacitor 7 Android integration:
```bash
# Sync web build assets with Android project
npm run build
npx cap sync android

# Open in Android Studio
npx cap open android
```
Refer to `ANDROID_BUILD.md` for detailed ABI signing and deployment instructions.
