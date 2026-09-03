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
}

export interface AIProvidersState {
  activeProviderId: string;
  providers: AIProviderConfig[];
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
  responseLanguage?: string;
}

export interface CustomJarvisAgentConfig extends JarvisAgentConfig {
  pipelinePosition: CustomAgentPipelinePosition;
  createdAt?: number;
}

export interface JarvisPlannerOutput {
  task: string;
  plan: string[];
  needsResearch: boolean;
  needsKnowledgeAgent?: boolean;
  needsFactCheck: boolean;
  needsReview: boolean;
  needsDiagram: boolean;
  needsChart?: boolean;
  needsImage?: boolean;
  needsWikipedia: boolean;
  wikipediaQuery: string;
  needsWikidata: boolean;
  wikidataQuery: string;
}

export interface JarvisSystemConfig {
  deepResearchDefault: boolean;
  diagramModeDefault?: boolean;
  chartModeDefault?: boolean;
  imageModeDefault?: boolean;
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
  steps: JarvisExecutionStep[];
  sources?: AISource[];
  error?: string;
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



