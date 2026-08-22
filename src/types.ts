export type Condition = 'clear' | 'partly-cloudy' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog';

export interface SearchResult {
  title: string;
  url: string;
  domain: string;
  description: string;
  date?: string;
  image?: string;
  thumbnail?: string;
  type: 'web' | 'news' | 'images' | 'videos' | 'shopping' | 'wikipedia';
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

export interface SavedItem {
  id: string;
  type: 'search' | 'news' | 'location';
  title: string;
  subtitle: string;
  url?: string;
  savedAt: string;
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

export interface SmartTVInfo {
  model?: string;
  powerState?: 'ON' | 'STANDBY' | 'OFF';
  volume?: number;
  isMuted?: boolean;
}

export interface NexusDevice {
  id: string;
  type: DeviceType;
  name: string;
  status: DeviceStatus;
  pairedAt: string;
  lastSeen: string;
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
