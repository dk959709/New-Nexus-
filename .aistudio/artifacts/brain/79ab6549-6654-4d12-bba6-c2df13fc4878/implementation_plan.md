# NEXUS Parallax — Multi-Agent AI Command Center Transformation

Transform the NEXUS Parallax workspace into a cohesive, high-density, mobile-first AI research and deliberation command center. The redesign pairs a deep obsidian and graphite aesthetic (with controlled cyan, teal, violet, and crisp white accents) with an adaptive layout anchored by a sticky bottom mission composer and unified collapsible drawers for real-time telemetry, the 20-agent matrix, and conviction analytics.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and visual decisions incorporate your confirmed preferences and govern the redesign while preserving 100% of existing swarm orchestration, audio synthesis, and session persistence.

- **Confirmed Decision 1 — Adaptive Workspace with Sticky Bottom Composer**: The workspace adapts seamlessly from narrow Android viewports (`320px–430px`) up to widescreen desktop (`1440px+`), keeping the Mission Composer anchored in the natural thumb zone at the bottom with keyboard-safe sticky positioning and clear idle, running, completed, and halted states.
- **Confirmed Decision 2 — Unified View with Collapsible Telemetry & Matrix Drawers**: Rather than fragmenting live activity across separate full-screen tabs or forcing endless vertical scrolling, the primary workspace presents a unified command stream with instant-toggle collapsible drawers for **Live Telemetry**, **20-Persona Agent Matrix & Topology**, **Round 00 Intelligence Briefing**, and **Conviction Shift Analytics**.
- **Confirmed Decision 3 — Deep Obsidian & Graphite Aesthetic with 3 Theme Modes**: The visual system is anchored by deep obsidian/graphite surfaces (`#06080d` / `#0c1017`), hairline borders (`rgba(255,255,255,0.07)`), tabular monospace telemetry, and restrained cyan-violet accents, while fully supporting the 3 user-selectable themes (**Minimal**, **Classic**, and **Full Dark**).

---

## 1. Overview & Core Concept

- **What It Does**: NEXUS Parallax orchestrates 20 core ideological AI personas—plus dynamically recruited domain specialists and the live-search-enabled VERITAS grounding node—across a 3-round dialectical protocol (Round 1: Thesis & Grounding, Round 2: Cross-Examination, Round 3: Deliberation & Convergence) culminating in an evidence-weighted Executive Synthesis Report and multi-voice audio briefing.
- **Target Audience / Persona**: Intelligence analysts, researchers, and power users operating on both Android mobile devices (`320px–430px`) and desktop workstations who need high information density without visual clutter or horizontal overflow.
- **Key Value**: Eliminates visual fragmentation and legacy mobile CSS conflicts by unifying live swarm telemetry, persona inspection, round-by-round deliberation transcripts, conviction trajectory charts, and final synthesis into an ergonomic, high-contrast command interface.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Zero-State & Mission Initialization**:
   - Users land on a clean, high-authority command canvas featuring the compact Top Command Bar, the Protocol & Mode Selector bar (`Default Swarm`, `Courtroom`, `Senate Summit`, `Sci-Fi Council`, `Newsroom`), a quick-access Telemetry & Roster summary strip, curated starter inquiries, and the sticky bottom Mission Composer.
   - Tapping the preset/directive trigger in the composer reveals curated domain inquiries or allows custom prompt entry with one-tap launch.
2. **Live Swarm Deliberation & Collapsible Intelligence Drawers**:
   - As Round 00 (VERITAS Grounding) and Rounds 01–03 execute, a real-time **Telemetry & Chronology Strip** tracks active speaking personas, logged replies (`N / 60`), grounded sources, and average conviction.
   - Users can expand or collapse dedicated drawers right inline without losing their place in the live stream:
     - **Telemetry & Conviction Analytics Drawer**: Compact metric cards + Conviction Shift Trajectory chart + Swarm Constellation topology.
     - **20-Agent Matrix & Specialist Inspector Drawer**: Filterable by ideological cluster (`Optimists`, `Realists`, `Ethicists`, `Visionaries`, `Core Anchors`, `Dynamic Specialists`) and searchable by name/role, with instant voice preview and turn history.
     - **Round 00 Intelligence Briefing Drawer**: Empirical facts (`F1..Fn`), canonical entities, and verified external source links.
3. **Human Operator Intervention & Audio Playback**:
   - While a swarm is deliberating, operators can inject a live directive into the active round or halt execution cleanly.
   - Any individual agent turn or the full multi-voice swarm transcript can be played via the integrated audio synthesizer and waveform HUD, exported as MP3, or downloaded as a Markdown report.
4. **Settings, 3-Theme Switcher & Session Archive**:
   - Accessible from the header or slide-over navigation drawer, allowing users to switch between **Minimal**, **Classic**, and **Full Dark** themes, customize individual agent models/instructions/token limits across all 20 personas, or restore saved swarm sessions.

### Visual Identity & Theme

- **Aesthetic Direction**: Advanced AI research laboratory and tactical intelligence workspace—combining precision typography, restrained glassmorphism, and single-elevation surface hierarchy.
- **Color Palette & Mood**:
  - **Obsidian / Classic Mode**: Deep obsidian canvas (`#060911`), elevated graphite panels (`#0c121e`), subtle hairline dividers (`rgba(148, 163, 184, 0.12)`), electric cyan primary accent (`#22d3ee`), violet secondary accent (`#a855f7`), emerald nominal/grounded state (`#10b981`), and amber/rose semantic alerts.
  - **Minimal Mode**: Matte zinc-graphite (`#0f0f12` / `#18181c`) with crisp neutral hairlines and monochrome-cyan highlights.
  - **Full Dark Mode**: Pure carbon black (`#000000` / `#0d0d0f`) for maximum OLED contrast on Android screens.
- **Typography & Hierarchy**:
  - **Display & UI Structure**: `Manrope` (600–800 weight) with balanced headline wrapping and tight tracking for mission titles and section headers.
  - **Telemetry, Scores & Timestamps**: `DM Mono` with strict `tabular-nums` alignment for conviction percentages, round counters (`R01–R03`), deltas (`+4%` / `-3%`), and token/model metadata.
- **Mobile Ergonomics & Touch Compliance (`320px–430px`)**:
  - Primary interactive controls (composer launch/stop, header actions, drawer toggles, filter buttons) provide comfortable touch hitboxes ($\ge 40\text{px}–44\text{px}$) while keeping visual chrome compact so sticky bars never exceed 15% of the mobile viewport height.
  - Responsive CSS grid reflow: `1 column` on `320px`, `2 columns` on `360px–430px` for compact telemetry cards, expanding to `4–7 columns` on desktop (`1024px–1440px`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Unified Stream with Collapsible Intelligence Drawers vs. Multi-Page Tabs**
  - *Chosen Approach*: Keep the primary deliberation feed, synthesis report, and composer in a single unified view, with collapsible drawers for **Telemetry & Analytics**, **20-Agent Matrix**, and **Intelligence Briefing**.
  - *Why*: On mobile screens, stacking all 20 agent cards, radar charts, and 7 telemetry boxes above the transcript pushes the actual AI responses several screens down. Collapsible drawers surface live KPIs in a compact summary bar while giving one-tap access to full depth on demand.
  - *Alternatives Considered*: Separate tabs hide live context during active runs; an always-expanded vertical stack causes severe scroll fatigue on phones.
- **Decision 2: Scoped High-Specificity Mobile Rules Over Global CSS Edits**
  - *Chosen Approach*: Encapsulate Parallax layout and responsive rules within the Parallax workspace scope rather than modifying global rules that other NEXUS pages depend on.
  - *Why*: Protects Home, JARVIS, Search, AI Assistant, Weather, and Workflows from any unintended visual side effects while neutralizing legacy `@media (max-width: 640px)` overrides that previously distorted Parallax inputs and buttons.
- **Decision 3: Multi-State Sticky Bottom Mission Composer**
  - *Chosen Approach*: Anchor the Mission Composer at the bottom of the viewport with dedicated visual states for **Idle**, **Running (Round 01–03 Live Progress + Stop + Inject Directive)**, **Completed (Quick Follow-up / Re-run / Audio Briefing)**, and **Halted/Error**.
  - *Why*: Keeps the primary action in the natural thumb reach zone on Android phones and provides immediate operational feedback without covering the deliberation stream.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     NEXUS PARALLAX WORKSPACE CONTAINER                      │
│               (Theme Context: Minimal | Classic | Full Dark)                │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. COMPACT STICKY COMMAND HEADER                                           │
│     ├─ Navigation Drawer Trigger & Mission Status Indicator                 │
│     ├─ Active Protocol Selector (Default, Courtroom, Senate, Sci-Fi, News)  │
│     └─ Quick Actions: New Mission · Theme Cycle · Saved Archive · Settings  │
├─────────────────────────────────────────────────────────────────────────────┤
│  2. UNIFIED INTELLIGENCE & TELEMETRY CONTROL STRIP                          │
│     ├─ Live KPI Bar (Active Nodes, Replies N/60, Grounded Sources, Conv %)  │
│     ├─ [Toggle] Telemetry, Constellation & Conviction Trajectory Drawer     │
│     ├─ [Toggle] 20-Persona Agent Matrix & Specialist Dossier Drawer         │
│     └─ [Toggle] Round 00 VERITAS Intelligence Briefing Drawer               │
├─────────────────────────────────────────────────────────────────────────────┤
│  3. CORE DELIBERATION & SYNTHESIS CANVAS                                    │
│     ├─ 3-Round Chronology Stepper (R01 Thesis → R02 Cross-Exam → R03 Conv)  │
│     ├─ Consensus Polarity Meter & Faction Filter (High / Balanced / Skeptic)│
│     ├─ Interactive Persona Benchmark Table & Expandable Turn Inspector      │
│     ├─ Round-by-Round Deliberation Stream (Audio TTS, Raw JSON, Citations)  │
│     └─ Final Executive Synthesis Report (Verdict, Findings, Export MD/MP3)  │
├─────────────────────────────────────────────────────────────────────────────┤
│  4. STICKY BOTTOM MISSION COMPOSER & OPERATOR BAR                           │
│     ├─ Popover: Preset Research Inquiries & Live Human Directive Injection  │
│     ├─ Popover: Swarm Protocol & Speed Mode Selector                        │
│     └─ Adaptive Prompt Input + Multi-State Launch / Stop / Audio Trigger    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State Preservation

- **Swarm Orchestration State**: Preserves `config` (`ParallaxConfig` with 20 agents), `messages` (`ParallaxMessage[]`), `currentRound` (`1 | 2 | 3 | null`), `summary` (`ParallaxSummary | null`), `intelligenceBriefing` (`ParallaxIntelligenceBriefing | null`), `specialistDeliberation`, `humanInjections`, and `devilsAdvocateTrigger`.
- **UI & Drawer State**:
  - `activeView`: `'feed' | 'settings' | 'archive'`
  - Collapsible workspace drawers inside the unified feed: `isTelemetryDrawerOpen`, `isMatrixDrawerOpen`, `isBriefingDrawerOpen`, and `isTranscriptStreamExpanded`.
  - Filtering & inspection state: `convictionBandFilter` (`'all' | 'high' | 'moderate' | 'skeptic'`), `clusterFilter`, `selectedAgentFilter`, `roundFilter`, `tableSearchQuery`, and `tableSortBy`.

### Interactive Component & State Mapping

- **Command Header & Protocol Bar**: Switching `debateMode` updates the active protocol configuration (`default`, `courtroom`, `senate`, `scifi`, `news`); tapping the theme button cycles `minimal` ↔ `classic` ↔ `fulldark` and persists to `localStorage`.
- **Collapsible Telemetry & Analytics Drawer**: Renders live metric cards (`ParallaxTelemetry`), ideological trajectory lines (`ParallaxConvictionChart`), and interactive node topology (`ParallaxSwarmConstellation`) using real state derived from `messages` and `config.agents`.
- **Collapsible 20-Agent Matrix Drawer**: Connects `ParallaxAgentMatrix` directly to `selectedAgentFilter` and `handlePlayMessageAudio` so selecting any persona filters their turns or plays their synthesized voice sample.
- **Deliberation Stream & Executive Synthesis**: Connects `ParallaxDeliberationStream` and `ParallaxSynthesisReport` to clipboard copy, `.md` report download, stitched multi-voice `.mp3` export, session archive persistence, and human directive injection (`ParallaxHumanInjectionModal`).
