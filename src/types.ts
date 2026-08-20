export type Condition = 'clear' | 'partly-cloudy' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog';

export interface SearchResult {
  title: string;
  url: string;
  domain: string;
  description: string;
  date?: string;
  image?: string;
  thumbnail?: string;
  type: 'web' | 'news' | 'images' | 'videos' | 'shopping';
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

export interface Settings {
  theme: ThemeMode;
  temperature: TemperatureUnit;
  wind: WindUnit;
  animations: AnimationLevel;
  wallpaper: WallpaperSetting | null;
  sound: boolean;
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
