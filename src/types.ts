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
export type ThemeMode = 'dark' | 'light' | 'system';
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

export interface AIProviderConfig {
  id: string;
  name: string;
  url: string;
  model: string;
  maxTokens?: number;
  keyStrategy: KeyStrategy;
  preferredKeyId?: string;
  keys: AIKeyItem[];
  capabilities: AIProviderCapabilities;
  isDefault?: boolean;
  extraParams?: Record<string, unknown>;
  reasoningParams?: Record<string, unknown>;
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
  providerName?: string;
  durationMs?: number;
  branches?: MultiChatBranchTurn[];
}

export interface MultiChatMessage {
  id: string;
  query: string;
  timestamp: number;
  responses: MultiChatPersonaResponse[];
  docChunks?: DocumentRetrievalResult[];
  docLensEnabled?: boolean;
}

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
  role?: string;
  voice?: string;
}

export interface ParallaxSummary {
  verdict: string;
  highlights: string[];
  consensusLean: string;
  totalContributions: number;
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
  selectedMandatory: ParallaxAgentConfig[]; // exactly 3
  additionalSpecialists: ParallaxAgentConfig[]; // 0 to 2
  allSpecialists: ParallaxAgentConfig[]; // 3 to 5
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

export interface AISource {
  title: string;
  url: string;
  domain?: string;
  description?: string;
  date?: string;
  thumbnail?: string;
  image?: string;
  type?: SourceCategory;
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
  category: string;
  status: 'connected' | 'not_configured';
  source: 'env' | 'catalog' | 'none';
  maskedKey?: string;
  updatedAt?: string;
  isCustom: boolean;
  noAuth?: boolean;
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




