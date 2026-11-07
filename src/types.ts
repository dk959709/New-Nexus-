export type Condition = 'clear' | 'partly-cloudy' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog';

export interface SearchResult {
  title: string;
  url: string;
  domain: string;
  description: string;
  date?: string;
  image?: string;
  thumbnail?: string;
  type: 'web' | 'news' | 'images' | 'videos' | 'shopping' | 'wikipedia' | 'wikidata';
  videoId?: string;
  channel?: string;
  duration?: string;
}

export interface WikidataEntity {
  id: string;
  label: string;
  description?: string;
  aliases?: string[];
  url: string;
  wikipediaTitle?: string;
  wikipediaUrl?: string;
  claims?: Record<string, string[]>;
}

export interface WikipediaSearchResult {
  pageid: number;
  title: string;
  snippet: string;
  description?: string;
  thumbnail?: string;
  url: string;
}

export interface WikipediaArticle {
  pageid: number;
  title: string;
  extract: string;
  description?: string;
  thumbnail?: string;
  url: string;
}

export interface WeatherCurrent {
  location: string;
  temperature: number;
  feelsLike: number;
  condition: Condition;
  conditionLabel: string;
  humidity: number;
  wind: number;
  pressure: number;
  visibility: number;
  uvIndex: number;
  sunrise: string;
  sunset: string;
  rainProbability: number;
  updatedAt: string;
  latitude: number;
  longitude: number;
  isDay: boolean;
}

export interface HourlyEntry {
  time: string;
  temperature: number;
  condition: Condition;
  rainProbability: number;
  wind: number;
}

export interface DailyEntry {
  day: string;
  high: number;
  low: number;
  condition: Condition;
  conditionLabel: string;
  rainProbability: number;
  wind: number;
}

export interface WeatherAlert {
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'severe';
}

export interface WeatherData {
  current: WeatherCurrent;
  hourly: HourlyEntry[];
  daily: DailyEntry[];
  alerts: WeatherAlert[];
}

export interface GeocodeResult {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface SavedItemSource {
  title: string;
  url: string;
  domain?: string;
}

export interface SavedItem {
  id: string;
  type: 'search' | 'news' | 'location' | 'space' | 'jarvis' | 'diagram' | 'chart' | string;
  title: string;
  query?: string;
  subtitle: string;
  url?: string;
  content?: string;
  sources?: SavedItemSource[];
  savedAt: string;
  diagramSvg?: string;
  chartData?: JarvisChartData | null;
  steps?: JarvisExecutionStep[];
  deepResearch?: boolean;
  images?: JarvisImageResult[];
}

export type TemperatureUnit = 'celsius' | 'fahrenheit';
export type WindUnit = 'kmh' | 'mph';
export type ThemeMode = 'dark' | 'light' | 'midnight' | 'emerald' | 'crimson' | 'violet' | 'system';
export type AnimationLevel = 'full' | 'reduced';

export type KeyHealthStatus = 'healthy' | 'cooldown' | 'invalid' | 'untested';
export type KeyStrategy = 'failover' | 'round_robin' | 'manual';

export interface AIKeyItem {
  id: string;
  key: string;
  label?: string;
  status: KeyHealthStatus;
  lastTested?: number;
  lastError?: string;
  cooldownUntil?: number;
}

export type AIProviderType = 'text' | 'image' | 'voice';

export interface AIProviderCapabilities {
  text: boolean;
  tools: boolean;
  web: boolean;
  wikipedia: boolean;
  memory: boolean;
}

export type ReasoningOverrideMode = 'auto' | 'force_on' | 'force_off';

export interface AIProviderConfig {
  id: string;
  name: string;
  url: string;
  model: string;
  models?: Array<{ id: string; name?: string }>;
  maxTokens?: number;
  keyStrategy: KeyStrategy;
  preferredKeyId?: string;
  keys: AIKeyItem[];
  capabilities: AIProviderCapabilities;
  isDefault?: boolean;
  extraParams?: Record<string, unknown>;
  reasoningParams?: Record<string, unknown>;
  reasoningOverride?: ReasoningOverrideMode;
}

export interface AIProvidersState {
  activeProviderId: string;
  providers: AIProviderConfig[];
}

export type ImageRequestType = 'get' | 'post' | 'sdk';

export interface ImageProviderConfig {
  id: string;
  name: string;
  url: string;
  model?: string;
  requestType?: ImageRequestType;
  customHeaderName?: string;
  requestBodyTemplate?: string;
  keyStrategy: KeyStrategy;
  preferredKeyId?: string;
  keys: AIKeyItem[];
  isDefault?: boolean;
}

export interface ImageProvidersState {
  activeProviderId: string;
  providers: ImageProviderConfig[];
}

export type VoiceRequestType = 'post' | 'get';

export interface VoiceProviderConfig {
  id: string;
  name: string;
  url: string;
  voicesUrl?: string;
  model?: string;
  voiceId?: string;
  requestType?: VoiceRequestType;
  customHeaderName?: string;
  requestBodyTemplate?: string;
  keyStrategy: KeyStrategy;
  preferredKeyId?: string;
  keys: AIKeyItem[];
  isDefault?: boolean;
}

export interface VoiceProvidersState {
  activeProviderId: string;
  providers: VoiceProviderConfig[];
}

export interface WebSearchApiState {
  mode: 'default' | 'custom';
  customUrl: string;
  customKey: string;
}

export interface ScholarApiState {
  mode: 'default' | 'custom';
  customUrl: string;
  customKey: string;
  provider: string;
}

export interface ScholarApiConfigItem {
  provider: 'openalex' | 'semanticscholar' | 'nasaads' | 'arxiv';
  apiKey: string;
  baseUrl: string;
}

export interface CloudVoiceItem {
  id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
  gender?: string;
  accent?: string;
  description?: string;
  previewUrl?: string;
  requiresSubscription?: boolean;
  isFreeTierCompatible?: boolean;
}

export interface StudioVoiceSettings {
  stability: number;
  similarityBoost: number;
  speed: number;
}

export interface GeneratedImageItem {
  id: string;
  url: string;
  imageData?: string;
  referenceImageUrl?: string;
  isEdit?: boolean;
  prompt: string;
  originalPrompt?: string;
  enhancedPrompt?: string;
  providerName: string;
  width: number;
  height: number;
  seed: number;
  model?: string;
  timestamp: number;
  isFavorite?: boolean;
}

export type JarvisAgentId =
  | 'planner'
  | 'researcher'
  | 'advisor'
  | 'factChecker'
  | 'reviewer'
  | 'finalSynthesizer'
  | 'architect'
  | 'dataAnalyst'
  | 'imageFinder'
  | 'coder'
  | string;

export type CustomAgentPipelinePosition =
  | 'before_synthesizer'
  | 'parallel_research'
  | 'extra_step'
  | 'after_synthesizer';

export interface JarvisChartSeries {
  name: string;
  values: number[];
}

export interface JarvisChartData {
  chartType: 'bar' | 'line' | null;
  title?: string;
  series?: JarvisChartSeries[];
  labels?: string[];
}

export interface JarvisImageResult {
  title: string;
  url: string;
  sourceUrl?: string;
  domain?: string;
  author?: string;
  license?: string;
  thumbnailUrl?: string;
  source?: string;
  description?: string;
  imageType?: 'real' | 'ai';
  label?: string;
}

export interface JarvisAgentConfig {
  id: JarvisAgentId;
  name: string;
  role: string;
  description: string;
  icon: string;
  providerId: string;
  modelId: string;
  enabled: boolean;
  maxTokens: number;
  enableFailover: boolean;
  fallbackProviderId?: string;
  fallbackModelId?: string;
  systemPrompt?: string;
  newAgentSystemPrompt?: string;
  responseLanguage?: string;
}

export interface CustomJarvisAgentConfig extends JarvisAgentConfig {
  pipelinePosition: CustomAgentPipelinePosition;
  createdAt?: number;
}

export type JarvisDynamicSpecialistTool = 'search' | 'wikipedia' | 'news' | 'weather' | 'webFetch';

export interface JarvisDynamicSpecialist {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  assignedTools: JarvisDynamicSpecialistTool[];
  searchQuery?: string;
  wikipediaQuery?: string;
  newsQuery?: string;
  weatherLocation?: string;
  targetUrl?: string;
  icon?: string;
  accentColor?: string;
  focus?: string;
}

export interface JarvisPlannerOutput {
  task: string;
  plan: string[];
  needsResearch: boolean;
  needsResearchQuery: string;
  needsNews?: boolean;
  needsNewsQuery?: string;
  newsMode?: 'headlines' | 'topic';
  newsCategory?: 'top' | 'world' | 'business' | 'technology' | 'sports' | 'entertainment' | 'science' | 'health' | 'politics' | string;
  needsKnowledgeAgent?: boolean;
  needsFactCheck: boolean;
  needsReview: boolean;
  needsDiagram: boolean;
  needsChart?: boolean;
  needsImage?: boolean;
  needsCode?: boolean;
  needsWikipedia: boolean;
  wikipediaQuery: string;
  needsWikidata: boolean;
  wikidataQuery: string;
  needsWeather?: boolean;
  weatherLocation?: string;
  specialists?: JarvisDynamicSpecialist[];
  isDynamicAgentsMode?: boolean;
}

export interface JarvisSystemConfig {
  deepResearchDefault: boolean;
  diagramModeDefault?: boolean;
  chartModeDefault?: boolean;
  imageModeDefault?: boolean;
  coderModeDefault?: boolean;
  newAgentModeDefault?: boolean;
  specialistSlots?: JarvisAgentConfig[];
  specialistConfig?: JarvisAgentConfig;
  agents: Record<string, JarvisAgentConfig>;
  customAgents?: CustomJarvisAgentConfig[];
}

export type JarvisStepStatus = 'pending' | 'running' | 'completed' | 'skipped' | 'failed';

export interface JarvisExecutionStep {
  agentId: JarvisAgentId;
  name: string;
  icon: string;
  status: JarvisStepStatus;
  providerName: string;
  model: string;
  durationMs?: number;
  error?: string;
  summary?: string;
  outputPreview?: string;
  rawOutput?: string;
  usedFallback?: boolean;
  searchSource?: string;
  assignedTools?: JarvisDynamicSpecialistTool[];
  assignedToolDetails?: Array<{ tool: string; query?: string; targetUrl?: string }>;
  specialistRole?: string;
}

export interface JarvisAttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  extension: string;
  content: string;
}

export interface JarvisMessage {
  id: string;
  query: string;
  answer: string;
  timestamp: number;
  deepResearch: boolean;
  diagramMode?: boolean;
  diagramSvg?: string;
  chartMode?: boolean;
  chartData?: JarvisChartData | null;
  imageMode?: boolean;
  images?: JarvisImageResult[];
  promptImageVariations?: string[];
  promptImageRoughIdea?: string;
  coderMode?: boolean;
  newAgentMode?: boolean;
  dynamicSpecialists?: JarvisDynamicSpecialist[];
  attachments?: JarvisAttachedFile[];
  searchMyDocs?: boolean;
  docSearchMode?: 'all' | 'specific';
  searchedDocumentId?: string;
  searchedDocumentName?: string;
  retrievedDocChunks?: DocumentRetrievalResult[];
  steps: JarvisExecutionStep[];
  sources?: AISource[];
  error?: string;
}

export type MultiChatPersonaId = 'nova' | 'orbit' | 'cosmos' | string;

export interface MultiChatPersonaConfig {
  id: MultiChatPersonaId;
  name: string;
  role: string;
  description: string;
  icon: string;
  toneBadge: string;
  accentColor: string;
  providerId: string;
  modelId: string;
  enabled: boolean;
  maxTokens: number;
  enableFailover?: boolean;
  fallbackProviderId?: string;
  fallbackModelId?: string;
  systemPrompt: string;
  pinnedSkillId?: string;
}

export type MultiChatDialogueMode = 'harmony' | 'debate' | 'parallel' | 'relay';

export interface MultiChatWebSource {
  title: string;
  url: string;
  domain: string;
  snippet: string;
}

export interface MultiChatConsensusChecklistItem {
  id: string;
  text: string;
  done?: boolean;
}

export interface MultiChatConsensusData {
  verdict: string;
  agreements: string[];
  actionChecklist: MultiChatConsensusChecklistItem[];
  generatedAt: number;
}

export interface MultiChatSystemConfig {
  personas: Record<string, MultiChatPersonaConfig>;
  responseLanguage?: string;
}

export interface MultiChatBranchTurn {
  id: string;
  query: string;
  timestamp: number;
  response: MultiChatPersonaResponse;
  text?: string;
}

export interface MultiChatCognitiveOverride {
  temperature: number; // 0.1 to 1.0
  depth: 'concise' | 'balanced' | 'deep';
}

export interface MultiChatPersonaResponse {
  personaId: MultiChatPersonaId;
  name: string;
  icon: string;
  accentColor: string;
  toneBadge?: string;
  text: string;
  content?: string;
  reasoning?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  model?: string;
  modelName?: string;
  providerName?: string;
  durationMs?: number;
  branches?: MultiChatBranchTurn[];
  stanceFlip?: MultiChatStanceFlip;
  cognitiveOverride?: MultiChatCognitiveOverride;
}

export type MultiChatCategoryId =
  | 'general'
  | 'research'
  | 'technology'
  | 'science'
  | 'strategy'
  | 'learning'
  | 'creative'
  | 'philosophy';

export interface MultiChatCategoryConfig {
  id: MultiChatCategoryId;
  label: string;
  iconName: string;
  badge: string;
  description: string;
  promptContext: string;
  suggestedQuestions: string[];
}

export type MultiChatScenarioId =
  | 'default'
  | 'standard'
  | 'startup_pitch'
  | 'code_review'
  | 'war_room'
  | 'socratic_trial'
  | 'courtroom';

export interface MultiChatRebuttalItem {
  personaId: MultiChatPersonaId;
  name: string;
  icon: string;
  accentColor: string;
  toneBadge?: string;
  targetNames?: string[];
  targetSummary?: string;
  text: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  timestamp: number;
}

export interface MultiChatPodcastDialogueLine {
  id: string;
  speakerId: MultiChatPersonaId;
  speakerName: string;
  icon: string;
  accentColor: string;
  roleLabel: string;
  cue?: string;
  text: string;
}

export interface MultiChatFollowUpChip {
  id: string;
  label: string;
  prompt: string;
  targetPersonaId?: MultiChatPersonaId | 'all';
  badge: string;
  icon?: string;
  accentColor: string;
}

export interface MultiChatVisualMapNode {
  id: string;
  personaId: MultiChatPersonaId;
  personaName: string;
  icon: string;
  accentColor: string;
  branchLabel: string;
  title: string;
  summary: string;
  followUpPrompt: string;
}

export interface MultiChatVisualMapData {
  centerTitle: string;
  centerSubtitle: string;
  synthesisTakeaway: string;
  nodes: MultiChatVisualMapNode[];
  generatedAt: number;
}

export interface MultiChatMergedSection {
  id: string;
  personaId: MultiChatPersonaId;
  personaName: string;
  icon: string;
  accentColor: string;
  roleContribution: string;
  heading: string;
  content: string;
}

export interface MultiChatMergedAnswerData {
  title: string;
  executiveSummary: string;
  sections: MultiChatMergedSection[];
  unifiedConclusion: string;
  generatedAt: number;
}

export interface MultiChatStressTestPivot {
  personaId: MultiChatPersonaId;
  personaName: string;
  icon: string;
  accentColor: string;
  originalStance: string;
  adaptedStrategy: string;
  keyTradeoff: string;
}

export interface MultiChatStressTestResult {
  constraint: string;
  impactSummary: string;
  pivots: MultiChatStressTestPivot[];
  generatedAt: number;
}

export interface MultiChatAlignmentRadarData {
  consensusScore: number; // 0-100
  confidenceLevel: 'High Confidence' | 'Moderate Consensus' | 'High Contention';
  clashPoint: string;
  sharedGround: string;
  personaMetrics: Array<{
    personaId: MultiChatPersonaId;
    personaName: string;
    icon: string;
    accentColor: string;
    riskFocus: number; // 0-100
    opportunityFocus: number; // 0-100
    stanceTag: string;
  }>;
  generatedAt: number;
}

export interface MultiChatFlashcardItem {
  id: string;
  personaId: MultiChatPersonaId;
  personaName: string;
  icon: string;
  accentColor: string;
  categoryLabel: string;
  frontQuestion: string;
  backAnswer: string;
}

export interface MultiChatQuizQuestionItem {
  id: string;
  personaId: MultiChatPersonaId;
  personaName: string;
  icon: string;
  accentColor: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface MultiChatStudyDeckData {
  topicTitle: string;
  flashcards: MultiChatFlashcardItem[];
  quiz: MultiChatQuizQuestionItem[];
  generatedAt: number;
}

export interface MultiChatDecisionOptionRow {
  id: string;
  optionName: string;
  novaScore: number; // 1-10 Technical / Analytical
  novaNote: string;
  orbitScore: number; // 1-10 Speed / Execution
  orbitNote: string;
  cosmosScore: number; // 1-10 Sustainability / Strategic
  cosmosNote: string;
  bestFor: string;
}

export interface MultiChatDecisionMatrixData {
  matrixTitle: string;
  options: MultiChatDecisionOptionRow[];
  recommendationSummary: string;
  generatedAt: number;
}

export interface MultiChatStanceFlip {
  personaId: MultiChatPersonaId;
  personaName: string;
  icon: string;
  accentColor: string;
  flippedRoleLabel: string;
  text: string;
  flippedText?: string;
  timestamp: number;
}

export type MultiChatGuestSpecialistId = 'cfo' | 'cyber' | 'ux' | 'legal';

export interface MultiChatGuestSpecialistResponse {
  id: string;
  specialistId: MultiChatGuestSpecialistId;
  name: string;
  roleBadge: string;
  icon: string;
  accentColor: string;
  text: string;
  keyVerdict: string;
  status: 'running' | 'completed' | 'failed';
  error?: string;
  timestamp: number;
}

export interface MultiChatAttachedFile {
  id: string;
  name: string;
  size?: number;
  sizeBytes?: number;
  extension: string;
  content: string;
}

export interface MultiChatPromptSplitPlan {
  originalPrompt: string;
  novaMission: string;
  orbitMission: string;
  cosmosMission: string;
}

export interface MultiChatChartMetricRow {
  id: string;
  dimension: string;
  novaValue: number; // 0-100
  orbitValue: number; // 0-100
  cosmosValue: number; // 0-100
  consensusValue: number; // 0-100
  unit: string;
  insight: string;
}

export interface MultiChatChartTelemetryData {
  chartTitle: string;
  subtitle: string;
  metrics: MultiChatChartMetricRow[];
  keyTakeaway: string;
  generatedAt: number;
}

export interface MultiChatRelayStep {
  stepNumber: 1 | 2 | 3;
  stageLabel: string;
  personaId: MultiChatPersonaId;
  personaName: string;
  icon: string;
  accentColor: string;
  handoffSummary: string;
  outputText: string;
}

export interface MultiChatRelayPipelineData {
  pipelineTitle: string;
  steps: MultiChatRelayStep[];
  finalPolishedDeliverable: string;
  generatedAt: number;
}

export interface MultiChatFactClaimItem {
  id: string;
  personaId: MultiChatPersonaId;
  personaName: string;
  icon: string;
  accentColor: string;
  claim: string;
  status: 'verified' | 'nuance' | 'disputed';
  confidenceScore: number; // 0-100
  verificationNote: string;
  sourceDomain?: string;
}

export interface MultiChatFactMatrixData {
  matrixTitle: string;
  overallReliabilityScore: number; // 0-100
  hallucinationRisk: 'Low Risk' | 'Moderate Caution' | 'High Alert';
  claims: MultiChatFactClaimItem[];
  auditSummary: string;
  generatedAt: number;
}

export interface MultiChatCherryPickBlock {
  id: string;
  personaId: MultiChatPersonaId;
  personaName: string;
  icon: string;
  accentColor: string;
  tagLabel: string;
  text: string;
  selected: boolean;
}

export interface MultiChatCherryPickData {
  blocks: MultiChatCherryPickBlock[];
  aiSmoothedText?: string;
  generatedAt: number;
}

export interface MultiChatHotSeatGrillItem {
  questionerId: MultiChatPersonaId;
  questionerName: string;
  questionerIcon: string;
  questionerColor: string;
  challengeQuestion: string;
}

export interface MultiChatHotSeatData {
  targetPersonaId: MultiChatPersonaId;
  targetPersonaName: string;
  targetIcon: string;
  targetColor: string;
  interrogators: MultiChatHotSeatGrillItem[];
  defenseResponse: string;
  verdictBadge: string;
  generatedAt: number;
}

export interface MultiChatVaultItem {
  id: string;
  turnId: string;
  query: string;
  sourceLabel: string;
  personaId?: MultiChatPersonaId | 'consensus' | 'synthesis';
  icon: string;
  accentColor: string;
  content: string;
  savedAt: number;
}

export interface MultiChatMessage {
  id: string;
  query: string;
  timestamp: number;
  responses: MultiChatPersonaResponse[];
  docChunks?: DocumentRetrievalResult[];
  docLensEnabled?: boolean;
  webSources?: MultiChatWebSource[];
  webLensEnabled?: boolean;
  dialogueMode?: MultiChatDialogueMode;
  scenarioId?: MultiChatScenarioId;
  targetPersonaIds?: MultiChatPersonaId[];
  consensus?: MultiChatConsensusData;
  rebuttals?: MultiChatRebuttalItem[];
  votedBestPersonaId?: MultiChatPersonaId;
  podcastScript?: MultiChatPodcastDialogueLine[];
  followUpChips?: MultiChatFollowUpChip[];
  visualMap?: MultiChatVisualMapData;
  mergedAnswer?: MultiChatMergedAnswerData;
  stressTest?: MultiChatStressTestResult;
  alignmentRadar?: MultiChatAlignmentRadarData;
  studyDeck?: MultiChatStudyDeckData;
  decisionMatrix?: MultiChatDecisionMatrixData;
  guestResponses?: MultiChatGuestSpecialistResponse[];
  attachments?: MultiChatAttachedFile[];
  chartTelemetry?: MultiChatChartTelemetryData;
  relayPipeline?: MultiChatRelayPipelineData;
  factMatrix?: MultiChatFactMatrixData;
  cherryPickMixer?: MultiChatCherryPickData;
  hotSeat?: MultiChatHotSeatData;
  blindRevealed?: boolean;
  forkedFromTurnId?: string;
  pinned?: boolean;
  category?: MultiChatCategoryId | string;
}

export interface MultiChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  category?: MultiChatCategoryId | string;
  messages: MultiChatMessage[];
}

export type MultiChatTheme = 'minimal' | 'classic' | 'fulldark';

export type ParallaxAgentId =
  | 'veritas'
  | 'aurora'
  | 'chronos'
  | 'axiom'
  | 'echo'
  | 'ledger'
  | 'socrates'
  | 'pixel'
  | 'vanguard'
  | 'harmony'
  | 'cipher'
  | 'nomad'
  | 'sentinel'
  | 'lumen'
  | 'catalyst'
  | 'gravity'
  | 'mosaic'
  | 'oracle'
  | 'ember'
  | 'nexus9'
  | string;

export interface ParallaxAgentConfig {
  id: ParallaxAgentId;
  name: string;
  initials: string;
  role: string;
  accentColor: string;
  hasToolAccess?: boolean; // true ONLY for 'veritas' in Round 1
  providerId: string;
  modelId: string;
  enabled: boolean;
  systemInstruction: string;
  maxTokens: number;
  voice?: string; // Edge TTS neural voice ID
  isDynamic?: boolean;
  isHuman?: boolean;
  isDevilsAdvocate?: boolean;
  mood?: string;
  selectionReason?: string;
}

export interface ParallaxSystemConfig {
  agents: Record<string, ParallaxAgentConfig>;
}

export interface ParallaxToolRawResult {
  title: string;
  url: string;
  snippet?: string;
  content?: string;
  description?: string;
  domain?: string;
  date?: string;
}

export interface ParallaxToolRawPayload {
  query: string;
  searchSource: string;
  committedFact: string;
  resultsCount: number;
  rawResults: ParallaxToolRawResult[];
}

export interface ParallaxMessage {
  id: string;
  agentId: string;
  agentName: string;
  initials: string;
  accentColor: string;
  round: 1 | 2 | 3;
  text: string;
  timestamp: number;
  toolUsed?: {
    tool: 'search' | 'weather' | 'time';
    query?: string;
    fact?: string;
    searchSource?: string;
    sourcesCount?: number;
    failed?: boolean;
    statusLabel?: string;
    committedFact?: string;
    rawResults?: ParallaxToolRawResult[];
    rawPayload?: ParallaxToolRawPayload;
  };
  durationMs?: number;
  model?: string;
  providerName?: string;
  conviction?: number;
  mood?: string;
  isDynamic?: boolean;
  isHuman?: boolean;
  isDevilsAdvocate?: boolean;
  replyToAgentId?: string;
  replyToAgentName?: string;
  replyToMessageId?: string;
  quotedSnippet?: string;
  role?: string;
  voice?: string;
  fallbackReason?: string;
  side?: string;
  sideLabel?: string;
  genesisTeamSource?: 'ai' | 'repaired' | 'fallback';
  genesisBlueprint?: Array<{
    name: string;
    role: string;
    emoji: string;
    color: string;
    task: string;
    systemPrompt: string;
    searchQuery: string;
    model?: string;
  }>;
}

export interface ParallaxIntelligenceBriefing {
  topic: string;
  keyFacts: string[];
  keyEntities: string[];
  sources: Array<{ title: string; url: string; domain: string; tier?: string; reliabilityScore?: number }>;
  liveSearchCount: number;
  timestamp: number;
  summary?: string;
}

export type ParallaxDebateMode =
  | 'default'
  | 'genesis'
  | 'courtroom'
  | 'red_vs_blue'
  | 'senate'
  | 'vc_pitch'
  | 'scifi'
  | 'news';

export interface ParallaxGenesisSlot {
  providerId: string; // 'auto' means automatic
  modelId: string;
}

export interface ParallaxGenesisSettings {
  slots: ParallaxGenesisSlot[]; // exactly 20 slots: index 0 = ARCHITECT, 1 = ZENITH, 2..19 = the 18 agents
  maxSearches: number;
}

export interface ParallaxDebateModeSide {
  id: string;
  label: string;
  color: string;
  instruction: string;
}

export interface ParallaxDebateModeConfig {
  id: ParallaxDebateMode;
  label: string;
  subtitle: string;
  iconName: string;
  accentColor: string;
  promptInstruction: string;
  sides?: ParallaxDebateModeSide[];
  roundInstructions?: {
    1: string;
    2: string;
    3: string;
  };
  refereeId?: string;
  resultTitle?: string;
}

export interface ParallaxModeResult {
  title: string;
  headline: string;
  details: string[];
}

export interface ParallaxHumanInjection {
  id: string;
  text: string;
  timestamp: number;
  authorName: string;
  roundInjected: number;
}

export interface ParallaxDevilsAdvocateTrigger {
  triggered: boolean;
  majorityLean: 'PRO' | 'CON' | 'SPECULATIVE' | 'NEUTRAL';
  consensusStrength: number;
  weakestClaim: string;
  injectedMessageId?: string;
}

export interface ParallaxConfidenceVerdict {
  proPercent: number;
  conPercent: number;
  undecidedPercent: number;
  weightedScore: number; // -100 to +100
  dominantLean: 'PRO' | 'CON' | 'UNDECIDED';
  totalClaimsChecked: number;
  verifiedSupportCount: number;
  refutedCount: number;
}

export interface ParallaxEntityResolution {
  input: string;
  canonicalEntity: string;
  entityType: 'model' | 'company' | 'product' | 'technology' | 'person' | 'concept' | 'policy' | 'general';
  confidence: number;
  aliases: string[];
  ambiguous: boolean;
  notes?: string;
}

export type ParallaxEvidenceType =
  | 'official_release'
  | 'news'
  | 'benchmark'
  | 'academic'
  | 'speculation'
  | 'rumor'
  | 'general';

export interface ParallaxEvidenceItem {
  id: string;
  snippet: string;
  title: string;
  url: string;
  domain: string;
  date?: string;
  reliabilityScore: number;
  reliabilityTier: 'high' | 'medium' | 'low';
  evidenceType: ParallaxEvidenceType;
}

export type ParallaxClaimType =
  | 'existence'
  | 'release'
  | 'benchmark'
  | 'attribution'
  | 'capability'
  | 'policy'
  | 'speculation';

export type ParallaxVerificationStatus =
  | 'VERIFIED'
  | 'PLAUSIBLE'
  | 'DISPUTED'
  | 'REFUTED'
  | 'UNVERIFIED';

export interface ParallaxClaim {
  id: string;
  claimText: string;
  claimType: ParallaxClaimType;
  status: ParallaxVerificationStatus;
  confidence: number;
  supportingEvidenceIds: string[];
  refutingEvidenceIds: string[];
  reasoning: string;
}

export interface ParallaxEvidencePool {
  topic: string;
  entityResolution?: ParallaxEntityResolution;
  evidenceItems: ParallaxEvidenceItem[];
  claims: ParallaxClaim[];
  searchSource: string;
  timestamp: number;
  intelligenceBriefing?: ParallaxIntelligenceBriefing;
}

export interface ParallaxSummary {
  verdict: string;
  highlights: string[];
  consensusLean: string;
  totalContributions: number;
  entityResolution?: ParallaxEntityResolution;
  verifiedClaims?: ParallaxClaim[];
  factualConflicts?: string[];
  valueConflicts?: string[];
  groundingLevel?: 'HIGH' | 'MODERATE' | 'SPECULATIVE' | 'REFUTED';
  evidenceSources?: Array<{ title: string; url: string; domain: string; tier: string; evidenceType?: string }>;
  confidenceVerdict?: ParallaxConfidenceVerdict;
  intelligenceBriefing?: ParallaxIntelligenceBriefing;
  humanInjections?: ParallaxHumanInjection[];
  devilsAdvocateTrigger?: ParallaxDevilsAdvocateTrigger;
  debateMode?: ParallaxDebateMode;
  swarmSize?: number;
  modeResult?: ParallaxModeResult;
}

export interface ParallaxSpecialistOpinion {
  agentId: string;
  agentName: string;
  emoji: string;
  role: string;
  accentColor: string;
  suggestedSpecialist: string;
  reason: string;
}

export interface ParallaxSpecialistDeliberation {
  opinions: ParallaxSpecialistOpinion[];
  selectedMandatory: ParallaxAgentConfig[]; // up to 3
  additionalSpecialists: ParallaxAgentConfig[]; // 0 to 2
  allSpecialists: ParallaxAgentConfig[]; // 1 to 5
  compilerReasoning?: string;
  selectionReasons?: Record<string, string>;
}

export interface ParallaxSession {
  id: string;
  topic: string;
  timestamp: number;
  roundsCompleted: number;
  messages: ParallaxMessage[];
  summary?: ParallaxSummary;
  specialistDeliberation?: ParallaxSpecialistDeliberation;
  intelligenceBriefing?: ParallaxIntelligenceBriefing;
  humanInjections?: ParallaxHumanInjection[];
  devilsAdvocateTrigger?: ParallaxDevilsAdvocateTrigger;
  debateMode?: ParallaxDebateMode;
  swarmSize?: number;
  genesisAgents?: ParallaxAgentConfig[];
}

export interface Settings {
  theme: ThemeMode;
  temperature: TemperatureUnit;
  wind: WindUnit;
  animations: AnimationLevel;
  wallpaper: WallpaperSetting | null;
  sound: boolean;
  aiProviders?: AIProvidersState;
}

export interface ConfigStatus {
  search: boolean;
  weather: boolean;
  map: boolean;
  ai: boolean;
  wallpapers: boolean;
}

export interface WallpaperPhoto {
  id: number;
  photographer: string;
  photographerUrl: string;
  url: string;
  landscape: string;
  large2x: string;
  original: string;
}

export interface WallpaperSetting {
  url: string;
  photographer: string;
  photographerUrl: string;
}

export type SourceCategory = 'web' | 'wikipedia' | 'news' | 'nasa' | 'weather';
export type ConfidenceLevel = 'verified' | 'limited' | 'unverified';

export type DomainTrustTier = 1 | 2 | 3;

export interface AISource {
  title: string;
  url: string;
  domain?: string;
  description?: string;
  date?: string;
  thumbnail?: string;
  image?: string;
  type?: SourceCategory;
  trustTier?: DomainTrustTier;
  trustTierLabel?: 'Official / Primary' | 'Secondary' | 'Unverified';
  trustTierReason?: string;
}

export interface AnswerEngineResult {
  query: string;
  answer: string;
  text?: string;
  provider?: string;
  keyPoints?: string[];
  confidence: ConfidenceLevel;
  confidenceReason?: string;
  sources: AISource[];
  followUps?: string[];
  selectedCategories: SourceCategory[];
  model?: string;
  tool?: string;
  fromCache?: boolean;
}

export interface TelegramAutomations {
  dailyWeatherEnabled: boolean;
  dailyWeatherTime: string;
  dailyWeatherCity: string;
  rainAlertEnabled: boolean;
  rainAlertCity: string;
  issAlertEnabled: boolean;
  issAlertLocationName: string;
  issAlertLatitude: number;
  issAlertLongitude: number;
  quickRepliesEnabled: boolean;
}

export interface TelegramBotCommand {
  command: string;
  description: string;
}

export interface TelegramActivityItem {
  id: string;
  timestamp: number;
  direction: 'incoming' | 'outgoing';
  type: 'message' | 'command' | 'callback' | 'automation' | 'alert' | 'system';
  sender: string;
  chatId?: string | number;
  text: string;
  status: 'delivered' | 'processed' | 'blocked' | 'error';
  command?: string;
}

export type DeviceType = 'android' | 'tv' | 'computer' | 'smarthome';
export type DeviceStatus = 'online' | 'warning' | 'offline' | 'unknown';

export interface DevicePermissions {
  batteryInfo: boolean;
  storageInfo: boolean;
  networkInfo: boolean;
  deviceControl: boolean;
  backgroundMonitoring: boolean;
}

export interface AndroidDeviceInfo {
  model?: string;
  brand?: string;
  androidVersion?: string;
  sdkVersion?: number;
  batteryLevel?: number;
  isCharging?: boolean;
  networkType?: string;
  storageUsedGb?: number;
  storageTotalGb?: number;
  ramUsedGb?: number;
  ramTotalGb?: number;
}

export type TVConnectionMethod = 'android_tv' | 'google_tv' | 'webos';

export interface SmartTVInfo {
  model?: string;
  powerState?: 'ON' | 'STANDBY' | 'OFF';
  volume?: number;
  isMuted?: boolean;
  method?: TVConnectionMethod;
  port?: number;
  ipAddress?: string;
  lastAction?: string;
  connectionError?: string;
  reachable?: boolean;
}

export type TVControlAction =
  | 'power'
  | 'volume_up'
  | 'volume_down'
  | 'mute'
  | 'home'
  | 'back'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'ok'
  | 'play_pause';

export interface NexusDevice {
  id: string;
  type: DeviceType;
  name: string;
  status: DeviceStatus;
  pairedAt: string;
  lastSeen?: string;
  lastSuccessfulConnection?: string | null;
  connectionError?: string;
  ipAddress?: string;
  permissions: DevicePermissions;
  android?: AndroidDeviceInfo;
  tv?: SmartTVInfo;
}

export interface DevicesOverview {
  online: number;
  warning: number;
  offline: number;
  total: number;
  devices: NexusDevice[];
}

export type NetworkDeviceType = 'tv' | 'android' | 'computer' | 'server' | 'router' | 'printer' | 'gaming' | 'unknown';
export type NetworkDeviceStatus = 'reachable' | 'paired' | 'unreachable' | 'unknown';

export interface DetectedService {
  port: number;
  service: string;
  name?: string;
}

export interface DiscoveredNetworkDevice {
  id: string;
  ip: string;
  name: string;
  macAddress: string | null;
  type: NetworkDeviceType;
  subType?: string;
  manufacturer?: string;
  status: NetworkDeviceStatus;
  detectedServices?: DetectedService[];
  latencyMs?: number;
  lastDiscovered: string | number;
  isPaired?: boolean;
  pairedDeviceId?: string;
  error?: string;
}

export interface NetworkInfo {
  connected: boolean;
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown';
  ssid?: string | null;
  localIp?: string | null;
  subnet?: string | null;
  gateway?: string | null;
  scanningSupported: boolean;
  scanMode: 'native_android' | 'agent_gateway' | 'local_server' | 'browser_agent_needed';
  notice?: string;
}

export interface NetworkScanResult {
  devices: DiscoveredNetworkDevice[];
  count: number;
  scannedSubnet?: string;
  timestamp: number;
  cancelled?: boolean;
  durationMs?: number;
  message?: string;
  networkInfo?: NetworkInfo;
}

export type MediaType = 'image' | 'video' | 'audio';

export type UnifiedSearchSource = 'web' | 'wikipedia' | 'wikimedia' | 'youtube';
export type UnifiedResultType = 'web' | 'article' | 'image' | 'video';

export interface UnifiedSearchResult {
  id: string;
  title: string;
  source: UnifiedSearchSource;
  type: UnifiedResultType;
  url: string;
  thumbnail?: string;
  description?: string;
  duration?: string;
  playableUrl?: string;
  creator?: string;
  author?: string;
  license?: string;
  publishedAt?: string;
  domain?: string;
  videoId?: string;
  channel?: string;
  embedUrl?: string;
  width?: number;
  height?: number;
}

export interface MediaItem {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
  mediaUrl: string;
  sourceUrl: string;
  domain: string;
  type: MediaType;
  duration?: string;
  author?: string;
  license?: string;
  width?: number;
  height?: number;
  videoId?: string;
  channel?: string;
  embedUrl?: string;
  source?: 'YouTube' | 'Wikimedia' | 'Web' | 'Wikipedia';
  thumbnail?: string;
  url?: string;
  playableUrl?: string;
}

export interface ApiCatalogItem {
  id: string;
  name: string;
  envVar: string;
  fallbackEnvVars?: string[];
  description: string;
  docsUrl: string;
  baseUrl?: string;
  queryParamName?: string;
  provider?: string;
  category: string;
  status: 'connected' | 'not_configured';
  source: 'env' | 'catalog' | 'none';
  maskedKey?: string;
  updatedAt?: string;
  isCustom: boolean;
  noAuth?: boolean;
}

export interface ScholarPaper {
  title: string;
  authors: string[];
  year?: number;
  journal?: string;
  cited_by_count: number;
  link: string;
  abstract?: string;
  provider?: string;
}

export interface CustomApiCallResult {
  ok: boolean;
  apiName: string;
  envVar: string;
  urlCalled: string;
  statusCode?: number;
  data?: unknown;
  error?: string;
}

// ==========================================
// DOCUMENT LIBRARY & RAG VECTOR MEMORY TYPES
// ==========================================

export type DocumentType = 'pdf' | 'txt' | 'csv' | 'docx' | string;

export interface DocumentChunk {
  id: string;
  docId: string;
  docName: string;
  chunkIndex: number;
  text: string;
  embedding?: number[];
  charCount: number;
}

export interface LibraryDocument {
  id: string;
  name: string;
  size: number; // in bytes
  type: DocumentType;
  uploadedAt: number; // timestamp ms
  enabledForJarvis: boolean; // toggle 'Include in JARVIS searches'
  chunkCount: number;
  charCount: number;
  status: 'indexed' | 'indexing' | 'error';
  errorMessage?: string;
  previewSnippet?: string;
  fullText?: string;
  chunks?: DocumentChunk[];
}

export interface DocumentLibraryState {
  documents: LibraryDocument[];
  chunks?: DocumentChunk[];
}

export interface DocumentRagSettings {
  enabled: boolean;
  mode: 'all' | 'specific';
  selectedDocId?: string;
}

export interface DocumentRetrievalResult {
  docId: string;
  docName: string;
  chunkId: string;
  chunkIndex: number;
  text: string;
  score: number;
}

export interface DocumentLibraryStats {
  totalDocuments: number;
  totalChunks: number;
  totalSizeBytes: number;
  activeDocuments: number;
}

// ==========================================
// COMMANDER SPECIALIST MODE TYPES
// ==========================================

export type CommanderMode = 'auto' | 'manual';
export type CommanderEffortLevel = 'small' | 'medium' | 'high';

export interface CommanderSystemPrompts {
  commander: string;
  alpha: string;
  beta: string;
  synthesizer: string;
}

export interface CommanderManualConfig {
  commanderPlan: string;
  alphaRole: string;
  alphaTask: string;
  alphaSearchEnabled: boolean;
  alphaSearchQuery: string;
  alphaModelId?: string;
  betaRole: string;
  betaTask: string;
  betaSearchEnabled: boolean;
  betaSearchQuery: string;
  betaModelId?: string;
  synthesizerModelId?: string;
  synthesizerDirectives?: string;
}

export interface CommanderConfig {
  mode: CommanderMode;
  effortLevel?: CommanderEffortLevel;
  modelId?: string;
  alphaModelId?: string;
  betaModelId?: string;
  synthesizerModelId?: string;
  alphaEnabled?: boolean;
  betaEnabled?: boolean;
  synthesizerEnabled?: boolean;
  systemPrompts: CommanderSystemPrompts;
  manualConfig: CommanderManualConfig;
}

export interface CommanderExecutionStep {
  id: string;
  agentId: 'commander' | 'alpha' | 'beta' | 'synthesizer';
  name: string;
  role?: string;
  task?: string;
  searchEnabled?: boolean;
  searchQuery?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  content?: string;
  sources?: AISource[];
  timestamp: number;
}

export interface CommanderResult {
  synthesis: string;
  plan: string;
  alphaFindings: string;
  betaFindings: string;
  steps: CommanderExecutionStep[];
  sources?: AISource[];
}

export interface CommanderFeedSavedState {
  steps: CommanderExecutionStep[];
  status: 'running' | 'completed' | 'aborted' | 'error';
  result?: CommanderResult | null;
  errorMessage?: string | null;
  sources?: AISource[];
  mode?: CommanderMode;
  effortLevel?: CommanderEffortLevel;
  deletedStageIds?: string[];
}

export type WorkflowNodeType = 'input' | 'webSearch' | 'webFetch' | 'scholar' | 'ai' | 'image' | 'weather' | 'nasa' | 'if';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  label: string;
  x: number;
  y: number;
  settings: Record<string, string>;
  frozen?: boolean;
  mockOutput?: WorkflowOutput;
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  branch?: 'yes' | 'no';
}

export interface Workflow {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  updatedAt: number;
}

export interface WorkflowOutput {
  type: 'text' | 'json' | 'image';
  value: string;
}

export interface WorkflowAISettings {
  role?: string;
  prompt?: string;
  maxTokens?: string;
  providerId?: string;
  modelId?: string;
}

export type WorkflowStepStatus = 'idle' | 'running' | 'done' | 'error' | 'skipped';

export interface WorkflowRunOptions {
  startFromNodeId?: string;
  previousOutputs?: Record<string, WorkflowOutput>;
}

export interface Skill {
  id: string;
  name: string;
  sourceUrl: string;
  repo: string;
  text: string;
  chars: number;
  truncated: boolean;
  license: string | null;
  enabled: boolean;
  addedAt: number;
  kind?: 'github' | 'pasted';
}

