import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Send,
  Trash2,
  Plus,
  Brain,
  BookOpen,
  Globe,
  Image as ImageIcon,
  Sparkles,
  Download,
  Maximize2,
  ExternalLink,
  Cpu,
  AlertTriangle,
  Check,
  Volume2,
  VolumeX,
  Radio,
  Loader2,
  Copy,
  Search,
  ChevronDown,
  ChevronUp,
  Settings as SettingsIcon,
  Edit3,
  X,
  Bookmark,
  Languages,
  RotateCcw,
  Palette,
  MessagesSquare,
  Bot,
  FlaskConical,
  Layers,
  BarChart3,
  Code2,
  Sliders,
  Plug,
  Eye,
  EyeOff,
  AlertCircle,
  Key,
  Square,
  Layers3,
  Shield,
} from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Link } from 'react-router-dom';
import { api } from '@/services/api';
import { storage } from '@/lib/storage';
import { copyToClipboard, formatMarkdownToRichHtml } from '@/lib/clipboard';
import { playTapSound } from '@/lib/audio';
import { ErrorMessage } from '@/components';
import { FormattedText } from '@/components/jarvis/FormattedText';
import { stripTierLabels } from '@/lib/format';
import { generateStudioImage, enhanceImagePromptWithAI } from '@/services/imageGenerationService';
import { executeMultiChatTurn } from '@/services/multiChatOrchestrator';
import { runJarvisPipeline } from '@/services/jarvisOrchestrator';
import { JarvisSvgDiagram } from '@/components/jarvis/JarvisSvgDiagram';
import { JarvisChartCard } from '@/components/jarvis/JarvisChartCard';
import { searchWikimediaCommons } from '@/services/media';
import {
  saveImageToDb,
  loadImageFromDb,
  deleteImageFromDb,
  isIndexedDbAvailable,
} from '@/lib/imageDb';
import { SwarmLiveFeed } from '@/components/assistant/SwarmLiveFeed';
import {
  CommanderLiveFeed,
  type CommanderFeedSavedState,
} from '@/components/assistant/CommanderLiveFeed';
import { getTargetProviderConfig } from '@/services/commanderOrchestrator';
import {
  enhanceCommanderPlan,
  enhanceAlphaDirectives,
  enhanceBetaDirectives,
  enhanceSynthesizerDirectives,
} from '@/services/commanderEnhanceService';
import type {
  AISource,
  MultiChatPersonaResponse,
  MultiChatMessage,
  JarvisExecutionStep,
  JarvisChartData,
  SavedItem,
  MediaItem,
  ParallaxMessage,
  ParallaxSummary,
  ParallaxEvidenceItem,
  CommanderConfig,
  AIProviderConfig,
} from '@/types';

export interface AssistantGeneratedImage {
  url: string;
  imageData?: string;
  imageDataId?: string;
  providerName: string;
  model?: string;
  width: number;
  height: number;
  seed: number;
  prompt: string;
}

type Message = {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  tool?: 'none' | 'search' | 'weather' | 'image' | 'multichat' | 'architect' | 'dataAnalyst' | 'agent' | 'coder' | 'wikimedia' | 'webfetcher' | 'swarmlive' | 'commander';
  sources?: AISource[];
  weather?: unknown;
  searchedWeb?: boolean;
  searchSource?: string;
  searchNotice?: string;
  image?: AssistantGeneratedImage;
  multiChatResponses?: MultiChatPersonaResponse[];
  diagramSvg?: string;
  chartData?: JarvisChartData | null;
  wikimediaItems?: MediaItem[];
  wikimediaTopic?: string;
  swarmLiveTopic?: string;
  swarmLiveMessages?: ParallaxMessage[];
  swarmLiveStatus?: 'running' | 'completed' | 'aborted' | 'error';
  swarmLiveSummary?: ParallaxSummary | null;
  swarmLiveErrorMessage?: string | null;
  swarmLiveEvidenceItems?: ParallaxEvidenceItem[];
  commanderTopic?: string;
  commanderSavedState?: CommanderFeedSavedState;
};

// Helper: Clean user's message into a concise search topic for Wikimedia Commons
function cleanWikimediaQuery(prompt: string): string {
  let q = prompt.trim();
  // Strip command prefixes
  q = q.replace(/^\/(?:wikimedia|images?|photos?|search|web)\s+/i, '');
  // Strip conversational request phrases (e.g. "show me", "can you show me", "find me", "look up")
  q = q.replace(/\b(?:could\s+you\s+|can\s+you\s+|please\s+)?(?:show\s+me|give\s+me|find\s+me|get\s+me|search\s+for|look\s+up|fetch\s+me|display)\b/gi, '');
  // Strip "images of", "photos of", "pictures of", "pics of"
  q = q.replace(/\b(?:images?|photos?|pictures?|pics?|photographs?)\s+(?:of|about|from|for|showing)\b/gi, '');
  // Strip standalone media words
  q = q.replace(/\b(?:images?|photos?|pictures?|pics?|photographs?)\b/gi, '');
  // Strip leading articles
  q = q.replace(/^(?:the|a|an)\s+/i, '');
  // Strip trailing punctuation
  q = q.replace(/[?!.,;:]+$/, '').trim();
  // Normalize whitespace
  q = q.replace(/\s+/g, ' ').trim();

  // If cleaning leaves an empty string, fallback to original cleaned of punctuation
  if (!q) {
    q = prompt.replace(/[?!.,;:]+$/, '').trim();
  }
  return q;
}

// Helper: Verify an item is a real photo/bitmap image (skipping SVG, PDF, audio, video)
function isRealBitmapImage(item: MediaItem): boolean {
  if (item.type !== 'image') return false;
  const url = (item.mediaUrl || '').toLowerCase();
  const thumb = (item.thumbnailUrl || '').toLowerCase();
  const title = (item.title || '').toLowerCase();

  // Skip SVG vectors, PDFs, TIFFs, audio, and video files
  if (url.endsWith('.svg') || thumb.endsWith('.svg') || title.endsWith('.svg') || url.includes('.svg/')) return false;
  if (url.endsWith('.pdf') || thumb.endsWith('.pdf') || title.endsWith('.pdf')) return false;
  if (url.endsWith('.tif') || url.endsWith('.tiff') || thumb.endsWith('.tif') || thumb.endsWith('.tiff')) return false;
  if (/\.(webm|ogv|mp4|ogg|mp3|wav|flac|mkv|avi|mov)($|\?)/i.test(url)) return false;

  return Boolean(item.thumbnailUrl || item.mediaUrl);
}

const NON_OFFICIAL_DOMAINS = [
  'reddit.com', 'techcrunch.com', 'medium.com', 'wikipedia.org', 'theverge.com',
  'bloomberg.com', 'youtube.com', 'twitter.com', 'x.com', 'facebook.com',
  'linkedin.com', 'github.com', 'quora.com', 'news.ycombinator.com', 'yahoo.com',
  'forbes.com', 'businessinsider.com', 'reuters.com', 'cnn.com', 'nytimes.com',
  'substack.com', 'substacks.com', 'wired.com', 'cnet.com', 'zdnet.com',
  'engadget.com', 'arstechnica.com', 'mashable.com', 'venturebeat.com',
  'slashdot.org', 'dev.to', 'hashnode.com', 'producthunt.com', 'g2.com',
  'trustpilot.com', 'glassdoor.com', 'pypi.org', 'npmjs.com', 'stackoverflow.com',
  'w3schools.com', 'geeksforgeeks.org', 'tutorialspoint.com'
];

function isNonOfficialDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return NON_OFFICIAL_DOMAINS.some((d) => host === d || host.endsWith('.' + d));
  } catch {
    return true;
  }
}

function isValidOfficialHttpsUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    if (
      h === 'localhost' ||
      h === '127.0.0.1' ||
      h === '0.0.0.0' ||
      h.startsWith('192.168.') ||
      h.startsWith('10.') ||
      h.endsWith('.local')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function checkIsOfficialDomain(url: string, query: string): boolean {
  try {
    if (isNonOfficialDomain(url)) return false;
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const cleanHost = host.replace(/\.(com|org|net|io|ai|dev|app|co|uk|in|me|info|de|ca|jp|fr|tech|xyz|site|online)$/i, '');
    const noise = new Set([
      'list', 'liste', 'find', 'get', 'give', 'show', 'search', 'check', 'gather', 'information', 'info',
      'official', 'offical', 'officeal', 'offial', 'offfical', 'oficial', 'ofcial', 'officail',
      'website', 'wesite', 'websit', 'site', 'sites', 'page', 'pages', 'webpage', 'web', 'link', 'links', 'url', 'urls',
      'the', 'an', 'a', 'of', 'for', 'about', 'from', 'in', 'on', 'to', 'me', 'please', 'tell', 'read'
    ]);
    const tokens = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 1 && !noise.has(t));
    if (tokens.length === 0) return false;
    return tokens.some(token => cleanHost.includes(token) || token.includes(cleanHost));
  } catch {
    return false;
  }
}

function cleanWebFetcherQuery(rawMessage: string): { name: string; query: string } {
  const fillerRegex = /\b(list|liste|show|find|give|get|me|the|a|an|official|offical|officeal|offial|oficial|offfical|ofcial|officail|website|websites|websit|wesite|web|site|sites|page|pages|link|links|url|urls)\b/gi;
  const cleaned = rawMessage
    .replace(fillerRegex, ' ')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return { name: '', query: rawMessage.trim() };
  }
  return { name: cleaned, query: `${cleaned} official website` };
}

function extractUrlOrDomain(text: string): string | null {
  const match = text.match(/(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.(?:com|org|net|io|dev|app|ai|gov|edu|co|uk|in|me|info|de|ca|jp|fr|tech|xyz|site|online)\b[^\s]*)/i);
  if (!match) return null;
  let raw = match[0].trim().replace(/[.,;:!?)]+$/, '');
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }
  return raw;
}

function parseSelectionNumber(text: string): number | null {
  const trimmed = text.trim();
  const match = trimmed.match(/^(?:number|open|pick|select|choice|#)?\s*(\d+)(?:st|nd|rd|th|\.)?$/i);
  if (match && match[1]) {
    const n = parseInt(match[1], 10);
    return isNaN(n) ? null : n;
  }
  return null;
}

function isWebsiteRequest(text: string): boolean {
  const q = text.toLowerCase();
  const siteKeywords = [
    'official', 'offical', 'officeal', 'offial', 'offfical', 'oficial', 'ofcial', 'officail',
    'website', 'wesite', 'websit', 'site', 'sites', 'webpage', 'page', 'pages', 'web', 'link', 'links', 'web address', 'url', 'domain',
    'homepage', 'newsroom', 'blog', 'docs', 'documentation', 'changelog', 'liste', 'list'
  ];
  return siteKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(q));
}

interface WebFetcherResultItem {
  number: number;
  title: string;
  domain: string;
  url: string;
  snippet: string;
  isOfficial?: boolean;
}

const POPULAR_COMMANDER_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet' },
  { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku' },
  { id: 'deepseek-chat', name: 'DeepSeek Chat (V3)' },
  { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)' },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
];

interface CommanderModelSelectorProps {
  agentKey: 'commander' | 'alpha' | 'beta' | 'synthesizer';
  title: string;
  roleSubtitle?: string;
  themeColor: 'indigo' | 'cyan' | 'purple' | 'emerald';
  value: string;
  configuredProviders: AIProviderConfig[];
  onChange: (modelId: string) => void;
  compact?: boolean;
}

const CommanderModelSelector: React.FC<CommanderModelSelectorProps> = ({
  title,
  roleSubtitle,
  themeColor,
  value,
  configuredProviders,
  onChange,
  compact = false,
}) => {
  const [manualInputOpen, setManualInputOpen] = useState(false);

  const colors = {
    indigo: {
      border: 'border-indigo-500/30',
      borderFocus: 'focus:border-indigo-500',
      badge: 'bg-indigo-950/60 text-indigo-300 border-indigo-500/40',
      chip: 'hover:border-indigo-400 hover:text-indigo-300',
      dot: 'bg-indigo-400',
    },
    cyan: {
      border: 'border-cyan-500/30',
      borderFocus: 'focus:border-cyan-500',
      badge: 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40',
      chip: 'hover:border-cyan-400 hover:text-cyan-300',
      dot: 'bg-cyan-400',
    },
    purple: {
      border: 'border-purple-500/30',
      borderFocus: 'focus:border-purple-500',
      badge: 'bg-purple-950/60 text-purple-300 border-purple-500/40',
      chip: 'hover:border-purple-400 hover:text-purple-300',
      dot: 'bg-purple-400',
    },
    emerald: {
      border: 'border-emerald-500/30',
      borderFocus: 'focus:border-emerald-500',
      badge: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40',
      chip: 'hover:border-emerald-400 hover:text-emerald-300',
      dot: 'bg-emerald-400',
    },
  }[themeColor];

  const matchedProvider = configuredProviders.find((p) => p.id === value);
  const matchedPreset = POPULAR_COMMANDER_MODELS.find((m) => m.id === value);
  const isCustom = Boolean(value) && !matchedProvider && !matchedPreset;

  const currentDisplayName = matchedProvider
    ? `${matchedProvider.name}${matchedProvider.model ? ` (${matchedProvider.model})` : ''}`
    : matchedPreset
    ? matchedPreset.name
    : value
    ? `${value} (Manual Model)`
    : 'Default Active Provider';

  return (
    <div className={`p-2.5 sm:p-3 rounded-xl border ${colors.border} bg-black/40 space-y-2`}>
      <div className="flex items-center justify-between gap-1.5 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${colors.dot} shrink-0`} />
          <span className="text-xs font-semibold text-zinc-200">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded border font-mono truncate max-w-[150px] ${colors.badge}`}
            title={currentDisplayName}
          >
            {value ? (matchedProvider ? matchedProvider.name : value) : 'Active Default'}
          </span>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              title="Reset to default active provider"
              className="p-0.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <RotateCcw size={10} />
            </button>
          )}
        </div>
      </div>

      {!compact && roleSubtitle && (
        <p className="text-[10px] text-zinc-400 leading-tight">
          {roleSubtitle}
        </p>
      )}

      {/* Selector controls: Dropdown + Manual Toggle */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <select
            value={matchedProvider ? matchedProvider.id : matchedPreset ? matchedPreset.id : value ? '__custom__' : ''}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '__custom__') {
                setManualInputOpen(true);
              } else {
                onChange(val);
              }
            }}
            className={`flex-1 min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 outline-none ${colors.borderFocus} cursor-pointer`}
          >
            <option value="">⚡ Default Active Provider</option>
            {configuredProviders.length > 0 && (
              <optgroup label="Configured AI Providers">
                {configuredProviders.map((p) => {
                  const label = p.name ? (p.model ? `${p.name} (${p.model})` : p.name) : (p.model || p.id);
                  return (
                    <option key={p.id} value={p.id}>
                      {label}
                    </option>
                  );
                })}
              </optgroup>
            )}
            <optgroup label="Popular Model Presets">
              {POPULAR_COMMANDER_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.id})
                </option>
              ))}
            </optgroup>
            <option value="__custom__">
              {isCustom ? `✏️ Manual Model: "${value}"` : '✏️ Manual / Custom Model Input...'}
            </option>
          </select>

          <button
            type="button"
            onClick={() => setManualInputOpen((prev) => !prev)}
            title={manualInputOpen ? 'Hide manual text input' : 'Enter model ID manually'}
            className={`px-2 py-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors shrink-0 ${
              manualInputOpen || isCustom
                ? 'bg-zinc-800 border-zinc-600 text-zinc-100'
                : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Edit3 size={11} />
            <span className="hidden sm:inline text-[10.5px]">Manual</span>
          </button>
        </div>

        {/* Manual Text Input Field (Visible on toggle or if custom string is active) */}
        {(manualInputOpen || isCustom) && (
          <div className="relative">
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Type model manually (e.g. gpt-4o, gemini-2.5-pro, claude-3-7-sonnet)..."
              className={`w-full rounded-lg border border-zinc-700 bg-zinc-900/90 pl-7 pr-7 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 font-mono outline-none ${colors.borderFocus}`}
              autoFocus={manualInputOpen && !value}
            />
            <Edit3 size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                title="Clear to default active provider"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* Quick Click Preset Chips */}
        <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar text-[10px]">
          <span className="text-zinc-500 shrink-0 text-[9.5px]">Quick:</span>
          {['gemini-2.5-flash', 'gemini-2.5-pro', 'gpt-4o', 'claude-3-7-sonnet', 'deepseek-chat'].map((mid) => (
            <button
              key={mid}
              type="button"
              onClick={() => onChange(mid)}
              className={`px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900/80 text-zinc-400 shrink-0 transition-colors ${colors.chip} ${
                value === mid ? 'border-zinc-500 text-zinc-100 bg-zinc-800 font-medium' : ''
              }`}
            >
              {mid.replace('-sonnet', '')}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const CHAT_KEY = 'nexus-ai-conversation-v2';
const MEMORY_KEY = 'nexus-ai-smart-memory-v1';
const WEB_SEARCH_PREF_KEY = 'nexus-ai-web-search-toggle';
const IMAGE_GEN_PREF_KEY = 'nexus-ai-image-gen-toggle';
const DEEP_RESEARCH_PREF_KEY = 'nexus-ai-deep-research-toggle';

const RECENT_MESSAGES = 8;
const MAX_MEMORY_LENGTH = 2200;

const QUICK_PROMPTS = [
  'Explain quantum computing simply',
  'Help me optimize my daily productivity',
  'Summarize the latest trends in artificial intelligence',
  'Write a clean TypeScript utility function',
];

const QUICK_IMAGE_PROMPTS = [
  'Cyberpunk city in neon rain, 8k octane render',
  'Futuristic glass greenhouse on Mars at twilight',
  'Astronaut floating above a prismatic cosmic nebula',
  'Minimalist architectural villa on a misty Nordic fjord',
];

const QUICK_DEEP_RESEARCH_PROMPTS = [
  'Commercial viability and timeline of solid-state EV batteries',
  'Breakthroughs in quantum error correction and topological qubits',
  'Global semiconductor supply chain risks and geopolitical landscape',
  'Long-term ecological impact of deep-sea mineral mining',
];

const welcomeMessage: Message = {
  role: 'assistant',
  content:
    "Hello. I'm NEXUS AI. How can I assist you today?",
};

function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    if (!raw) return [welcomeMessage];

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) return [welcomeMessage];

    const messages = parsed
      .filter(
        (item): item is Message =>
          typeof item === 'object' &&
          item !== null &&
          'role' in item &&
          'content' in item &&
          ((item as { role?: unknown }).role === 'user' ||
            (item as { role?: unknown }).role === 'assistant') &&
          typeof (item as { content?: unknown }).content === 'string',
      )
      .map((item) => ({
        ...item,
        content: item.role === 'assistant' ? stripTierLabels(item.content) : item.content,
      }));

    return messages.length ? messages : [welcomeMessage];
  } catch {
    return [welcomeMessage];
  }
}

function loadSmartMemory(): string {
  try {
    return localStorage.getItem(MEMORY_KEY) ?? '';
  } catch {
    return '';
  }
}

function loadWebSearchToggle(): boolean {
  try {
    return localStorage.getItem(WEB_SEARCH_PREF_KEY) === 'true';
  } catch {
    return false;
  }
}

function loadImageGenToggle(): boolean {
  try {
    return localStorage.getItem(IMAGE_GEN_PREF_KEY) === 'true';
  } catch {
    return false;
  }
}

function loadDeepResearchToggle(): boolean {
  try {
    return localStorage.getItem(DEEP_RESEARCH_PREF_KEY) === 'true';
  } catch {
    return false;
  }
}

function buildLocalMemory(messages: Message[]): string {
  const useful = messages
    .filter((message) => message.content.trim())
    .slice(-12);

  if (!useful.length) return '';

  const text = useful
    .map((message) => {
      const speaker = message.role === 'user' ? 'User' : 'NEXUS';
      return `${speaker}: ${message.content}`;
    })
    .join('\n');

  return text.slice(-MAX_MEMORY_LENGTH);
}

function AssistantImageCard({
  image,
  theme,
  onFullscreen,
  onDownload,
}: {
  image: AssistantGeneratedImage;
  theme: 'minimal' | 'classic' | 'fulldark';
  onFullscreen: (src: string) => void;
  onDownload: (img: AssistantGeneratedImage) => void;
}) {
  const [loadedData, setLoadedData] = useState<string | null>(image.imageData || null);

  useEffect(() => {
    if (image.imageData) {
      setLoadedData(image.imageData);
      return;
    }
    if (image.imageDataId) {
      let cancelled = false;
      loadImageFromDb(image.imageDataId)
        .then((data) => {
          if (!cancelled && data) {
            setLoadedData(data);
          }
        })
        .catch((err) => {
          console.warn('[AssistantImageCard] Failed to load image from IndexedDB:', err);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [image.imageData, image.imageDataId]);

  const activeSrc = loadedData || image.url;

  return (
    <div
      className={`my-3 p-3 rounded-2xl border transition-all ${
        theme === 'classic'
          ? 'border-cyan-500/30 bg-slate-900/80 shadow-[0_4px_25px_rgba(6,182,212,0.15)]'
          : theme === 'fulldark'
          ? 'border-[#2a2a2a] bg-[#171717]'
          : 'border-zinc-800 bg-zinc-900/90'
      }`}
    >
      {/* Image preview with hover actions */}
      <div className="relative group/img overflow-hidden rounded-xl bg-black/40 flex items-center justify-center">
        <img
          src={activeSrc}
          alt={image.prompt}
          className="w-full max-h-[440px] object-contain rounded-xl transition-transform duration-300 group-hover/img:scale-[1.01]"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex flex-col justify-between p-3 pointer-events-none">
          <div className="flex justify-end gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={() => onFullscreen(activeSrc)}
              className="p-1.5 rounded-lg bg-black/70 text-white hover:bg-black/90 backdrop-blur-md transition-all shadow-md"
              title="View Fullscreen"
            >
              <Maximize2 size={14} />
            </button>
          </div>
          <div className="flex items-center justify-between text-xs text-white/90 pointer-events-auto">
            <span className="truncate max-w-[240px] font-medium drop-shadow-sm">
              {image.prompt}
            </span>
            <button
              type="button"
              onClick={() => onDownload(image)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs font-medium transition-all"
            >
              <Download size={12} />
              <span>Download</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metadata and Controls */}
      <div className="mt-3 pt-2.5 border-t flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
              theme === 'classic'
                ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40'
                : theme === 'fulldark'
                ? 'bg-[#222] text-[#e0e0e0] border-[#333]'
                : 'bg-zinc-800 text-zinc-300 border-zinc-700/60'
            }`}
          >
            <Sparkles size={11} className={theme === 'classic' ? 'text-cyan-400' : 'text-purple-400'} />
            <span>{image.providerName}</span>
          </span>

          {image.model && (
            <span
              className={`hidden sm:inline-flex items-center text-[10.5px] px-2 py-0.5 rounded-md border ${
                theme === 'classic'
                  ? 'bg-slate-900/60 text-slate-300 border-cyan-500/20'
                  : theme === 'fulldark'
                  ? 'bg-[#1a1a1a] text-[#aaa] border-[#292929]'
                  : 'bg-zinc-950/60 text-zinc-400 border-zinc-800'
              }`}
            >
              {image.model}
            </span>
          )}

          <span
            className={`text-[10.5px] opacity-75 ${
              theme === 'classic' ? 'text-cyan-200/70' : 'text-zinc-400'
            }`}
          >
            {image.width} × {image.height}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onDownload(image)}
            className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-all ${
              theme === 'classic'
                ? 'border-cyan-500/30 bg-cyan-950/40 text-cyan-200 hover:bg-cyan-900/50 hover:text-white'
                : theme === 'fulldark'
                ? 'border-[#333] bg-[#222] text-[#eee] hover:bg-[#2c2c2c] hover:text-white'
                : 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white'
            }`}
            title="Download Image"
          >
            <Download size={12} />
            <span className="hidden sm:inline">Download</span>
          </button>

          <Link
            to={`/image-studio?prompt=${encodeURIComponent(image.prompt)}`}
            className={`p-1.5 rounded-lg border transition-all ${
              theme === 'classic'
                ? 'border-cyan-500/20 text-cyan-300/80 hover:bg-cyan-950/40 hover:text-cyan-100'
                : theme === 'fulldark'
                ? 'border-[#2e2e2e] text-[#aaa] hover:bg-[#222] hover:text-white'
                : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
            title="Open in Image Studio"
          >
            <ExternalLink size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [smartMemory, setSmartMemory] = useState(loadSmartMemory);
  const [webSearchEnabled, setWebSearchEnabled] = useState(loadWebSearchToggle);
  const [imageGenEnabled, setImageGenEnabled] = useState(loadImageGenToggle);
  const [imageEnhanceEnabled, setImageEnhanceEnabled] = useState<boolean>(() => storage.getAssistantImageEnhanceEnabled());
  const [showImageEnhanceTip, setShowImageEnhanceTip] = useState<boolean>(() => !storage.getAssistantImageEnhanceTipDismissed());
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef<boolean>(false);
  const pendingSavesRef = useRef<Set<Promise<unknown>>>(new Set());

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pendingSavesRef.current.size > 0) {
        console.warn('[AssistantPage] Reload while an image was still saving');
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
  const [deepResearchEnabled, setDeepResearchEnabled] = useState(loadDeepResearchToggle);
  const [deepResearchProgress, setDeepResearchProgress] = useState<number>(0);
  const [deepResearchPhase, setDeepResearchPhase] = useState<string>('');
  const [specialistProgress, setSpecialistProgress] = useState<number>(0);
  const [specialistPhase, setSpecialistPhase] = useState<string>('');
  const [imageLoadingPhase, setImageLoadingPhase] = useState<string>('');
  const [fullscreenModalImage, setFullscreenModalImage] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [memoryEditorOpen, setMemoryEditorOpen] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState(smartMemory);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearedToast, setClearedToast] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [edgeTtsLoadingIndex, setEdgeTtsLoadingIndex] = useState<number | null>(null);
  const [edgeTtsPlayingIndex, setEdgeTtsPlayingIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [expandedSources, setExpandedSources] = useState<Record<number, boolean>>({});
  const [savedItemIds, setSavedItemIds] = useState<Set<string>>(() => {
    try {
      const items = storage.getSaved();
      return new Set(items.map((i) => i.id));
    } catch {
      return new Set();
    }
  });
  const [universalCopied, setUniversalCopied] = useState(false);
  const [universalSaved, setUniversalSaved] = useState(false);
  const [universalEdgeTtsPlaying, setUniversalEdgeTtsPlaying] = useState(false);
  const [universalEdgeTtsLoading, setUniversalEdgeTtsLoading] = useState(false);

  // Assistant Settings Panel state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [responseLanguage, setResponseLanguage] = useState<string>(() => storage.getAssistantLanguage());
  const [theme, setTheme] = useState<'minimal' | 'classic' | 'fulldark'>(() => storage.getAssistantTheme());
  const [permanentMemories, setPermanentMemories] = useState<string[]>(() => storage.getPermanentMemories());

  // Ensure mutual exclusivity on initial load if multiple were saved in localStorage
  const initialSpecialists = (() => {
    const raw = {
      architect: storage.getAssistantArchitectEnabled(),
      dataAnalysis: storage.getAssistantDataAnalysisEnabled(),
      multiChat: storage.getAssistantMultiChatEnabled(),
      coder: storage.getAssistantCoderEnabled(),
      webFetcher: storage.getAssistantWebFetcherEnabled(),
      wikimedia: storage.getAssistantWikimediaEnabled(),
      newAgent: storage.getAssistantNewAgentEnabled(),
      swarmLive: storage.getAssistantSwarmLiveEnabled(),
      commander: storage.getAssistantCommanderEnabled(),
    };
    let foundActive = false;
    const clean = { ...raw };
    const order: Array<keyof typeof raw> = [
      'architect',
      'dataAnalysis',
      'multiChat',
      'coder',
      'webFetcher',
      'wikimedia',
      'newAgent',
      'swarmLive',
      'commander',
    ];
    for (const key of order) {
      if (clean[key]) {
        if (foundActive) {
          clean[key] = false;
          if (key === 'architect') storage.setAssistantArchitectEnabled(false);
          else if (key === 'dataAnalysis') storage.setAssistantDataAnalysisEnabled(false);
          else if (key === 'multiChat') storage.setAssistantMultiChatEnabled(false);
          else if (key === 'coder') storage.setAssistantCoderEnabled(false);
          else if (key === 'webFetcher') storage.setAssistantWebFetcherEnabled(false);
          else if (key === 'wikimedia') storage.setAssistantWikimediaEnabled(false);
          else if (key === 'newAgent') storage.setAssistantNewAgentEnabled(false);
          else if (key === 'swarmLive') storage.setAssistantSwarmLiveEnabled(false);
          else if (key === 'commander') storage.setAssistantCommanderEnabled(false);
        } else {
          foundActive = true;
        }
      }
    }
    return clean;
  })();

  const [multiChatEnabled, setMultiChatEnabled] = useState<boolean>(initialSpecialists.multiChat);
  const [architectEnabled, setArchitectEnabled] = useState<boolean>(initialSpecialists.architect);
  const [dataAnalysisEnabled, setDataAnalysisEnabled] = useState<boolean>(initialSpecialists.dataAnalysis);
  const [coderEnabled, setCoderEnabled] = useState<boolean>(initialSpecialists.coder);
  const [webFetcherEnabled, setWebFetcherEnabled] = useState<boolean>(initialSpecialists.webFetcher);
  const [wikimediaEnabled, setWikimediaEnabled] = useState<boolean>(initialSpecialists.wikimedia);
  const [newAgentEnabled, setNewAgentEnabled] = useState<boolean>(initialSpecialists.newAgent);
  const [swarmLiveEnabled, setSwarmLiveEnabled] = useState<boolean>(initialSpecialists.swarmLive);
  const [commanderEnabled, setCommanderEnabled] = useState<boolean>(initialSpecialists.commander);
  const [commanderConfig, setCommanderConfig] = useState<CommanderConfig>(() => storage.getCommanderConfig());
  const [commanderPromptsExpanded, setCommanderPromptsExpanded] = useState<boolean>(false);
  const [configuredAIProviders, setConfiguredAIProviders] = useState<AIProviderConfig[]>(
    () => storage.getAIProvidersState().providers || []
  );

  // Commander Manual Directives AI Enhance state
  const [commanderEnhanceIdea, setCommanderEnhanceIdea] = useState<string>('');
  const [enhancingCommanderPlan, setEnhancingCommanderPlan] = useState<boolean>(false);
  const [enhancingAlphaDirectives, setEnhancingAlphaDirectives] = useState<boolean>(false);
  const [enhancingBetaDirectives, setEnhancingBetaDirectives] = useState<boolean>(false);
  const [enhancingSynthDirectives, setEnhancingSynthDirectives] = useState<boolean>(false);
  const [commanderEnhanceError, setCommanderEnhanceError] = useState<string | null>(null);
  const [alphaEnhanceError, setAlphaEnhanceError] = useState<string | null>(null);
  const [betaEnhanceError, setBetaEnhanceError] = useState<string | null>(null);
  const [synthEnhanceError, setSynthEnhanceError] = useState<string | null>(null);

  const isEnhancingCommanderAny =
    enhancingCommanderPlan ||
    enhancingAlphaDirectives ||
    enhancingBetaDirectives ||
    enhancingSynthDirectives;

  const handleEnhanceCommanderDirectives = () => {
    const rawIdea = commanderEnhanceIdea.trim();
    if (!rawIdea || isEnhancingCommanderAny) return;

    // Reset error states
    setCommanderEnhanceError(null);
    setAlphaEnhanceError(null);
    setBetaEnhanceError(null);
    setSynthEnhanceError(null);

    // Set individual progress spinners
    setEnhancingCommanderPlan(true);
    setEnhancingAlphaDirectives(true);
    setEnhancingBetaDirectives(true);
    setEnhancingSynthDirectives(true);

    const commanderModel = commanderConfig.modelId || storage.getCommanderAgentModel('commander');
    const alphaModel =
      commanderConfig.alphaModelId ||
      commanderConfig.manualConfig.alphaModelId ||
      storage.getCommanderAgentModel('alpha');
    const betaModel =
      commanderConfig.betaModelId ||
      commanderConfig.manualConfig.betaModelId ||
      storage.getCommanderAgentModel('beta');
    const synthModel =
      commanderConfig.synthesizerModelId ||
      commanderConfig.manualConfig.synthesizerModelId ||
      storage.getCommanderAgentModel('synthesizer');

    const commanderProvider = getTargetProviderConfig(commanderModel);
    const alphaProvider = getTargetProviderConfig(alphaModel);
    const betaProvider = getTargetProviderConfig(betaModel);
    const synthProvider = getTargetProviderConfig(synthModel);

    const isAlphaSearchOn = Boolean(commanderConfig.manualConfig.alphaSearchEnabled);
    const isBetaSearchOn = Boolean(commanderConfig.manualConfig.betaSearchEnabled);

    // Call A: Commander Strategic Plan
    enhanceCommanderPlan({
      idea: rawIdea,
      providerConfig: commanderProvider,
    })
      .then((newPlan) => {
        if (newPlan) {
          setCommanderConfig((prev) => {
            const updated: CommanderConfig = {
              ...prev,
              manualConfig: {
                ...prev.manualConfig,
                commanderPlan: newPlan,
              },
            };
            storage.saveCommanderConfig(updated);
            return updated;
          });
        }
      })
      .catch((err: unknown) => {
        console.warn('[Commander Enhance] Commander plan failed:', err);
        setCommanderEnhanceError(err instanceof Error ? err.message : 'Plan enhancement failed');
      })
      .finally(() => {
        setEnhancingCommanderPlan(false);
      });

    // Call B: Agent Alpha (Specialist 1)
    enhanceAlphaDirectives({
      idea: rawIdea,
      searchEnabled: isAlphaSearchOn,
      providerConfig: alphaProvider,
    })
      .then((alphaData) => {
        setCommanderConfig((prev) => {
          const updated: CommanderConfig = {
            ...prev,
            manualConfig: {
              ...prev.manualConfig,
              ...(alphaData.role ? { alphaRole: alphaData.role } : {}),
              ...(alphaData.task ? { alphaTask: alphaData.task } : {}),
              ...(isAlphaSearchOn && alphaData.searchQuery
                ? { alphaSearchQuery: alphaData.searchQuery }
                : {}),
            },
          };
          storage.saveCommanderConfig(updated);
          return updated;
        });
      })
      .catch((err: unknown) => {
        console.warn('[Commander Enhance] Agent Alpha failed:', err);
        setAlphaEnhanceError(err instanceof Error ? err.message : 'Alpha enhancement failed');
      })
      .finally(() => {
        setEnhancingAlphaDirectives(false);
      });

    // Call C: Agent Beta (Counter-Perspective / Specialist 2)
    enhanceBetaDirectives({
      idea: rawIdea,
      searchEnabled: isBetaSearchOn,
      providerConfig: betaProvider,
    })
      .then((betaData) => {
        setCommanderConfig((prev) => {
          const updated: CommanderConfig = {
            ...prev,
            manualConfig: {
              ...prev.manualConfig,
              ...(betaData.role ? { betaRole: betaData.role } : {}),
              ...(betaData.task ? { betaTask: betaData.task } : {}),
              ...(isBetaSearchOn && betaData.searchQuery
                ? { betaSearchQuery: betaData.searchQuery }
                : {}),
            },
          };
          storage.saveCommanderConfig(updated);
          return updated;
        });
      })
      .catch((err: unknown) => {
        console.warn('[Commander Enhance] Agent Beta failed:', err);
        setBetaEnhanceError(err instanceof Error ? err.message : 'Beta enhancement failed');
      })
      .finally(() => {
        setEnhancingBetaDirectives(false);
      });

    // Call D: Final Synthesizer (Synthesis Directives)
    enhanceSynthesizerDirectives({
      idea: rawIdea,
      providerConfig: synthProvider,
    })
      .then((newDirectives) => {
        if (newDirectives) {
          setCommanderConfig((prev) => {
            const updated: CommanderConfig = {
              ...prev,
              manualConfig: {
                ...prev.manualConfig,
                synthesizerDirectives: newDirectives,
              },
            };
            storage.saveCommanderConfig(updated);
            return updated;
          });
        }
      })
      .catch((err: unknown) => {
        console.warn('[Commander Enhance] Final Synthesizer failed:', err);
        setSynthEnhanceError(err instanceof Error ? err.message : 'Synthesis enhancement failed');
      })
      .finally(() => {
        setEnhancingSynthDirectives(false);
      });
  };

  const [copiedCommanderDirectives, setCopiedCommanderDirectives] = useState<boolean>(false);

  const handleCopyCommanderManualSettings = async () => {
    const commanderModel =
      commanderConfig.modelId || storage.getCommanderAgentModel('commander') || 'Active Default Provider';
    const alphaModel =
      commanderConfig.alphaModelId ||
      commanderConfig.manualConfig.alphaModelId ||
      storage.getCommanderAgentModel('alpha') ||
      'Active Default Provider';
    const betaModel =
      commanderConfig.betaModelId ||
      commanderConfig.manualConfig.betaModelId ||
      storage.getCommanderAgentModel('beta') ||
      'Active Default Provider';
    const synthModel =
      commanderConfig.synthesizerModelId ||
      commanderConfig.manualConfig.synthesizerModelId ||
      storage.getCommanderAgentModel('synthesizer') ||
      'Active Default Provider';

    const textToCopy = `=== COMMANDER MODE: 4-AGENT MANUAL CONFIGURATION & DIRECTIVES ===

[1. COMMANDER — Strategic Director]
• Role: Strategic Mission Director
• Model: ${commanderModel}
• Tactical Plan / Task:
${commanderConfig.manualConfig.commanderPlan?.trim() || '(No plan specified)'}

• System Prompt:
${commanderConfig.systemPrompts.commander?.trim() || '(Default system prompt)'}

==================================================

[2. AGENT ALPHA — Specialist 1 / Lead Investigator]
• Role: ${commanderConfig.manualConfig.alphaRole?.trim() || 'Lead Technical Investigator'}
• Model: ${alphaModel}
• Web Search: ${commanderConfig.manualConfig.alphaSearchEnabled ? 'Enabled' : 'Disabled'}
• Search Query: ${commanderConfig.manualConfig.alphaSearchQuery?.trim() || '(Blank = inherits user query)'}
• Task Instructions:
${commanderConfig.manualConfig.alphaTask?.trim() || '(No task instructions specified)'}

• System Prompt:
${commanderConfig.systemPrompts.alpha?.trim() || '(Default system prompt)'}

==================================================

[3. AGENT BETA — Specialist 2 / Counter-Perspective & Risk Analyst]
• Role: ${commanderConfig.manualConfig.betaRole?.trim() || 'Counter-Perspective & Risk Analyst'}
• Model: ${betaModel}
• Web Search: ${commanderConfig.manualConfig.betaSearchEnabled ? 'Enabled' : 'Disabled'}
• Search Query: ${commanderConfig.manualConfig.betaSearchQuery?.trim() || '(Blank = inherits user query)'}
• Task Instructions:
${commanderConfig.manualConfig.betaTask?.trim() || '(No task instructions specified)'}

• System Prompt:
${commanderConfig.systemPrompts.beta?.trim() || '(Default system prompt)'}

==================================================

[4. FINAL SYNTHESIZER — Supreme Master Resolution]
• Role: Final Synthesizer (Harmonization & Supreme Resolution)
• Model: ${synthModel}
• Task / Synthesis Directives:
${commanderConfig.manualConfig.synthesizerDirectives?.trim() || '(Default harmonization focus)'}

• System Prompt:
${commanderConfig.systemPrompts.synthesizer?.trim() || '(Default system prompt)'}
`;

    const success = await copyToClipboard(textToCopy);
    if (success) {
      setCopiedCommanderDirectives(true);
      triggerSettingsToast('Copied all 4 agent system prompts, roles, tasks & search queries to clipboard!');
      setTimeout(() => {
        setCopiedCommanderDirectives(false);
      }, 2500);
    }
  };

  useEffect(() => {
    const handleSyncAIProviders = () => {
      setConfiguredAIProviders(storage.getAIProvidersState().providers || []);
    };
    window.addEventListener('storage', handleSyncAIProviders);
    window.addEventListener('nexus-ai-providers-updated', handleSyncAIProviders);
    return () => {
      window.removeEventListener('storage', handleSyncAIProviders);
      window.removeEventListener('nexus-ai-providers-updated', handleSyncAIProviders);
    };
  }, []);
  const [webFetcherList, setWebFetcherList] = useState<WebFetcherResultItem[]>([]);
  const [webFetcherOriginalRequest, setWebFetcherOriginalRequest] = useState<string>('');
  const [newMemoryInput, setNewMemoryInput] = useState('');
  const [editingMemoryIndex, setEditingMemoryIndex] = useState<number | null>(null);
  const [editingMemoryDraft, setEditingMemoryDraft] = useState('');
  const [settingsSavedToast, setSettingsSavedToast] = useState<string | null>(null);
  const [personaAudioPlayingKey, setPersonaAudioPlayingKey] = useState<string | null>(null);
  const [personaAudioLoadingKey, setPersonaAudioLoadingKey] = useState<string | null>(null);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [modesSectionOpen, setModesSectionOpen] = useState(false);

  const [webApiMode, setWebApiMode] = useState<'default' | 'custom'>(() => storage.getAssistantWebApiMode());
  const [customSearchKey, setCustomSearchKey] = useState<string>(() => storage.getAssistantCustomSearchKey());
  const [customSearchUrl, setCustomSearchUrl] = useState<string>(() => storage.getAssistantCustomSearchUrl());
  const [webApiCustomOpen, setWebApiCustomOpen] = useState<boolean>(() => {
    const mode = storage.getAssistantWebApiMode();
    const key = storage.getAssistantCustomSearchKey();
    const url = storage.getAssistantCustomSearchUrl();
    return mode === 'custom' && (!key.trim() || !url.trim());
  });
  const [showSearchKey, setShowSearchKey] = useState<boolean>(false);
  const [testSearchLoading, setTestSearchLoading] = useState<boolean>(false);
  const [testSearchResult, setTestSearchResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (settingsOpen) {
      if (webApiMode === 'custom' && (!customSearchKey.trim() || !customSearchUrl.trim())) {
        setWebApiCustomOpen(true);
      }
    }
  }, [settingsOpen, webApiMode, customSearchKey, customSearchUrl]);

  const handleSelectWebApiMode = (mode: 'default' | 'custom') => {
    setWebApiMode(mode);
    storage.setAssistantWebApiMode(mode);
    if (mode === 'custom') {
      setWebApiCustomOpen(true);
    } else {
      setTestSearchResult(null);
    }
  };

  const handleCustomSearchKeyChange = (val: string) => {
    setCustomSearchKey(val);
    storage.setAssistantCustomSearchKey(val);
    setTestSearchResult(null);
  };

  const handleCustomSearchUrlChange = (val: string) => {
    setCustomSearchUrl(val);
    storage.setAssistantCustomSearchUrl(val);
    setTestSearchResult(null);
  };

  const handleResetSearchToDefault = () => {
    setWebApiMode('default');
    storage.setAssistantWebApiMode('default');
    setCustomSearchKey('');
    storage.setAssistantCustomSearchKey('');
    setCustomSearchUrl('');
    storage.setAssistantCustomSearchUrl('');
    setTestSearchResult(null);
  };

  const handleTestSearchConnection = async () => {
    if (!customSearchKey.trim() || !customSearchUrl.trim() || testSearchLoading) return;
    setTestSearchLoading(true);
    setTestSearchResult(null);
    try {
      const res = await api.testCustomSearch({
        url: customSearchUrl.trim(),
        key: customSearchKey.trim(),
      });
      if (res.ok) {
        const count = res.count ?? 0;
        const time = res.timeMs ?? 0;
        setTestSearchResult({
          ok: true,
          message: `Works: ${count} ${count === 1 ? 'result' : 'results'} in ${time} ms`,
        });
      } else {
        setTestSearchResult({
          ok: false,
          message: res.error || 'Server returned an error',
        });
      }
    } catch {
      setTestSearchResult({
        ok: false,
        message: 'Server returned an error',
      });
    } finally {
      setTestSearchLoading(false);
    }
  };

  // Chat Appearance Colors (Answer title, inner box bg, link color)
  const [answerTitleColor, setAnswerTitleColor] = useState<string | null>(() => storage.getAssistantAnswerTitleColor());
  const [answerBoxColor, setAnswerBoxColor] = useState<string | null>(() => storage.getAssistantAnswerBoxColor());
  const [answerLinkColor, setAnswerLinkColor] = useState<string | null>(() => storage.getAssistantAnswerLinkColor());

  const [titleColorInput, setTitleColorInput] = useState<string>(() => storage.getAssistantAnswerTitleColor() || '');
  const [boxColorInput, setBoxColorInput] = useState<string>(() => storage.getAssistantAnswerBoxColor() || '');
  const [linkColorInput, setLinkColorInput] = useState<string>(() => storage.getAssistantAnswerLinkColor() || '');

  const [titleColorError, setTitleColorError] = useState<string>('');
  const [boxColorError, setBoxColorError] = useState<string>('');
  const [linkColorError, setLinkColorError] = useState<string>('');

  const isValidHexColor = (hex: string) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim());

  const getThemeDefaultTitleColor = () => (theme === 'classic' ? '#67e8f9' : theme === 'fulldark' ? '#ececec' : '#ffffff');
  const getThemeDefaultBoxColor = () => (theme === 'classic' ? '#020617' : theme === 'fulldark' ? '#141414' : '#18181b');
  const getThemeDefaultLinkColor = () => (theme === 'classic' ? '#67e8f9' : '#38bdf8');

  const handleTitleColorChange = (val: string) => {
    setTitleColorInput(val);
    const trimmed = val.trim();
    if (!trimmed) {
      setTitleColorError('');
      setAnswerTitleColor(null);
      storage.setAssistantAnswerTitleColor(null);
      return;
    }
    if (isValidHexColor(trimmed)) {
      setTitleColorError('');
      setAnswerTitleColor(trimmed);
      storage.setAssistantAnswerTitleColor(trimmed);
    } else {
      setTitleColorError('Please enter a valid hex color (e.g. #38bdf8 or #fff)');
    }
  };

  const handleBoxColorChange = (val: string) => {
    setBoxColorInput(val);
    const trimmed = val.trim();
    if (!trimmed) {
      setBoxColorError('');
      setAnswerBoxColor(null);
      storage.setAssistantAnswerBoxColor(null);
      return;
    }
    if (isValidHexColor(trimmed)) {
      setBoxColorError('');
      setAnswerBoxColor(trimmed);
      storage.setAssistantAnswerBoxColor(trimmed);
    } else {
      setBoxColorError('Please enter a valid hex color (e.g. #020617 or #18181b)');
    }
  };

  const handleLinkColorChange = (val: string) => {
    setLinkColorInput(val);
    const trimmed = val.trim();
    if (!trimmed) {
      setLinkColorError('');
      setAnswerLinkColor(null);
      storage.setAssistantAnswerLinkColor(null);
      return;
    }
    if (isValidHexColor(trimmed)) {
      setLinkColorError('');
      setAnswerLinkColor(trimmed);
      storage.setAssistantAnswerLinkColor(trimmed);
    } else {
      setLinkColorError('Please enter a valid hex color (e.g. #67e8f9 or #60a5fa)');
    }
  };

  const handleResetAppearance = () => {
    setAnswerTitleColor(null);
    setAnswerBoxColor(null);
    setAnswerLinkColor(null);
    setTitleColorInput('');
    setBoxColorInput('');
    setLinkColorInput('');
    setTitleColorError('');
    setBoxColorError('');
    setLinkColorError('');
    storage.setAssistantAnswerTitleColor(null);
    storage.setAssistantAnswerBoxColor(null);
    storage.setAssistantAnswerLinkColor(null);
    triggerSettingsToast('Appearance reset to theme defaults');
  };

  const assistantCustomStyles: React.CSSProperties = {
    ...(answerTitleColor ? ({ '--assistant-answer-title-color': answerTitleColor } as React.CSSProperties) : {}),
    ...(answerBoxColor ? ({ '--assistant-answer-box-bg': answerBoxColor } as React.CSSProperties) : {}),
    ...(answerLinkColor ? ({ '--assistant-answer-link-color': answerLinkColor } as React.CSSProperties) : {}),
  };

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const edgeTtsAudioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const moreOptionsRef = useRef<HTMLDivElement | null>(null);
  const webFetcherCancelledRef = useRef<boolean>(false);

  const handleStopWebFetcher = () => {
    webFetcherCancelledRef.current = true;
    setLoading(false);
    setSpecialistProgress(0);
    setSpecialistPhase('');
  };

  useEffect(() => {
    if (!moreOptionsOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (moreOptionsRef.current && !moreOptionsRef.current.contains(event.target as Node)) {
        setMoreOptionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [moreOptionsOpen]);

  const triggerSettingsToast = (msg: string) => {
    setSettingsSavedToast(msg);
    setTimeout(() => setSettingsSavedToast(null), 3000);
  };

  // Helper to ensure mutual exclusivity among the Specialist Modes
  const disableOtherSpecialistModes = (
    except: 'architect' | 'dataAnalysis' | 'multiChat' | 'coder' | 'webFetcher' | 'wikimedia' | 'newAgent' | 'swarmLive' | 'commander',
  ) => {
    if (except !== 'multiChat') {
      setMultiChatEnabled(false);
      storage.setAssistantMultiChatEnabled(false);
    }
    if (except !== 'architect') {
      setArchitectEnabled(false);
      storage.setAssistantArchitectEnabled(false);
    }
    if (except !== 'dataAnalysis') {
      setDataAnalysisEnabled(false);
      storage.setAssistantDataAnalysisEnabled(false);
    }
    if (except !== 'coder') {
      setCoderEnabled(false);
      storage.setAssistantCoderEnabled(false);
    }
    if (except !== 'webFetcher') {
      setWebFetcherEnabled(false);
      storage.setAssistantWebFetcherEnabled(false);
      setWebFetcherList([]);
      setWebFetcherOriginalRequest('');
    }
    if (except !== 'wikimedia') {
      setWikimediaEnabled(false);
      storage.setAssistantWikimediaEnabled(false);
    }
    if (except !== 'newAgent') {
      setNewAgentEnabled(false);
      storage.setAssistantNewAgentEnabled(false);
    }
    if (except !== 'swarmLive') {
      setSwarmLiveEnabled(false);
      storage.setAssistantSwarmLiveEnabled(false);
    }
    if (except !== 'commander') {
      setCommanderEnabled(false);
      storage.setAssistantCommanderEnabled(false);
    }
  };

  const toggleMultiChat = () => {
    const next = !multiChatEnabled;
    if (next) {
      disableOtherSpecialistModes('multiChat');
    }
    setMultiChatEnabled(next);
    storage.setAssistantMultiChatEnabled(next);
    triggerSettingsToast(
      next
        ? 'Multi Chat enabled: 3-Persona panel will process all messages'
        : 'Multi Chat disabled: standard single assistant active',
    );
  };

  const toggleArchitect = () => {
    const next = !architectEnabled;
    if (next) {
      disableOtherSpecialistModes('architect');
      setWebSearchEnabled(false);
      try {
        localStorage.setItem(WEB_SEARCH_PREF_KEY, 'false');
      } catch {
        // Ignore
      }
    }
    setArchitectEnabled(next);
    storage.setAssistantArchitectEnabled(next);
    triggerSettingsToast(
      next
        ? 'Architect Mode enabled (automatic web search disabled)'
        : 'Architect Mode disabled',
    );
  };

  const toggleDataAnalysis = () => {
    const next = !dataAnalysisEnabled;
    if (next) {
      disableOtherSpecialistModes('dataAnalysis');
      setWebSearchEnabled(false);
      try {
        localStorage.setItem(WEB_SEARCH_PREF_KEY, 'false');
      } catch {
        // Ignore
      }
    }
    setDataAnalysisEnabled(next);
    storage.setAssistantDataAnalysisEnabled(next);
    triggerSettingsToast(
      next
        ? 'Data Analysis Mode enabled (automatic web search disabled)'
        : 'Data Analysis Mode disabled',
    );
  };

  const toggleCoder = () => {
    const next = !coderEnabled;
    if (next) {
      disableOtherSpecialistModes('coder');
      setWebSearchEnabled(false);
      try {
        localStorage.setItem(WEB_SEARCH_PREF_KEY, 'false');
      } catch {
        // Ignore
      }
    }
    setCoderEnabled(next);
    storage.setAssistantCoderEnabled(next);
    triggerSettingsToast(
      next
        ? 'Coder Mode enabled: research-grounded code pipeline active'
        : 'Coder Mode disabled',
    );
  };

  const toggleWebFetcher = () => {
    const next = !webFetcherEnabled;
    if (next) {
      disableOtherSpecialistModes('webFetcher');
    } else {
      setWebFetcherList([]);
      setWebFetcherOriginalRequest('');
    }
    setWebFetcherEnabled(next);
    storage.setAssistantWebFetcherEnabled(next);
    triggerSettingsToast(
      next
        ? 'Web Fetcher enabled: live URL content extraction active'
        : 'Web Fetcher disabled',
    );
  };

  const toggleWikimedia = () => {
    const next = !wikimediaEnabled;
    if (next) {
      disableOtherSpecialistModes('wikimedia');
    }
    setWikimediaEnabled(next);
    storage.setAssistantWikimediaEnabled(next);
    triggerSettingsToast(
      next
        ? 'Wikimedia Mode enabled: 5 real images from Wikimedia'
        : 'Wikimedia Mode disabled',
    );
  };

  const toggleNewAgent = () => {
    const next = !newAgentEnabled;
    if (next) {
      disableOtherSpecialistModes('newAgent');
      setWebSearchEnabled(false);
      try {
        localStorage.setItem(WEB_SEARCH_PREF_KEY, 'false');
      } catch {
        // Ignore
      }
    }
    setNewAgentEnabled(next);
    storage.setAssistantNewAgentEnabled(next);
    triggerSettingsToast(
      next
        ? 'New Agent Mode enabled: dynamic 3-specialist pipeline active'
        : 'New Agent Mode disabled',
    );
  };

  const toggleSwarmLive = () => {
    const next = !swarmLiveEnabled;
    if (next) {
      disableOtherSpecialistModes('swarmLive');
      setWebSearchEnabled(false);
      try {
        localStorage.setItem(WEB_SEARCH_PREF_KEY, 'false');
      } catch {
        // Ignore
      }
    }
    setSwarmLiveEnabled(next);
    storage.setAssistantSwarmLiveEnabled(next);
    triggerSettingsToast(
      next
        ? 'Swarm Live enabled: 20+ Agent Live Debate Feed active'
        : 'Swarm Live disabled',
    );
  };

  const toggleCommander = () => {
    const next = !commanderEnabled;
    if (next) {
      disableOtherSpecialistModes('commander');
      setWebSearchEnabled(false);
      try {
        localStorage.setItem(WEB_SEARCH_PREF_KEY, 'false');
      } catch {
        // Ignore
      }
    }
    setCommanderEnabled(next);
    storage.setAssistantCommanderEnabled(next);
    triggerSettingsToast(
      next
        ? 'Commander Mode enabled: 3-agent tactical intelligence pipeline active'
        : 'Commander Mode disabled',
    );
  };

  const activeSpecialistMode = architectEnabled
    ? {
        name: 'Architect',
        toggle: toggleArchitect,
        color:
          theme === 'classic'
            ? 'text-amber-300 border-amber-500/50 bg-amber-950/60 hover:bg-amber-900/70 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
            : theme === 'fulldark'
            ? 'text-amber-300 border-amber-500/40 bg-[#251e12] hover:bg-[#342a18]'
            : 'text-amber-300 border-amber-500/40 bg-amber-950/50 hover:bg-amber-900/60',
      }
    : dataAnalysisEnabled
    ? {
        name: 'Data Analysis',
        toggle: toggleDataAnalysis,
        color:
          theme === 'classic'
            ? 'text-sky-300 border-sky-500/50 bg-sky-950/60 hover:bg-sky-900/70 shadow-[0_0_8px_rgba(56,189,248,0.25)]'
            : theme === 'fulldark'
            ? 'text-sky-300 border-sky-500/40 bg-[#12232f] hover:bg-[#1a3243]'
            : 'text-sky-300 border-sky-500/40 bg-sky-950/50 hover:bg-sky-900/60',
      }
    : multiChatEnabled
    ? {
        name: 'Multi Chat',
        toggle: toggleMultiChat,
        color:
          theme === 'classic'
            ? 'text-cyan-300 border-cyan-500/50 bg-cyan-950/60 hover:bg-cyan-900/70 shadow-[0_0_8px_rgba(6,182,212,0.25)]'
            : theme === 'fulldark'
            ? 'text-cyan-300 border-cyan-500/40 bg-[#102428] hover:bg-[#163339]'
            : 'text-cyan-300 border-cyan-500/40 bg-cyan-950/50 hover:bg-cyan-900/60',
      }
    : coderEnabled
    ? {
        name: 'Coder',
        toggle: toggleCoder,
        color:
          theme === 'classic'
            ? 'text-emerald-300 border-emerald-500/50 bg-emerald-950/60 hover:bg-emerald-900/70 shadow-[0_0_8px_rgba(16,185,129,0.25)]'
            : theme === 'fulldark'
            ? 'text-emerald-300 border-emerald-500/40 bg-[#12251a] hover:bg-[#193525]'
            : 'text-emerald-300 border-emerald-500/40 bg-emerald-950/50 hover:bg-emerald-900/60',
      }
    : webFetcherEnabled
    ? {
        name: 'Web Fetcher',
        toggle: toggleWebFetcher,
        color:
          theme === 'classic'
            ? 'text-teal-300 border-teal-500/50 bg-teal-950/60 hover:bg-teal-900/70 shadow-[0_0_8px_rgba(20,184,166,0.25)]'
            : theme === 'fulldark'
            ? 'text-teal-300 border-teal-500/40 bg-[#112423] hover:bg-[#183432]'
            : 'text-teal-300 border-teal-500/40 bg-teal-950/50 hover:bg-teal-900/60',
      }
    : wikimediaEnabled
    ? {
        name: 'Wikimedia',
        toggle: toggleWikimedia,
        color:
          theme === 'classic'
            ? 'text-violet-300 border-violet-500/50 bg-violet-950/60 hover:bg-violet-900/70 shadow-[0_0_8px_rgba(139,92,246,0.25)]'
            : theme === 'fulldark'
            ? 'text-violet-300 border-violet-500/40 bg-[#21152d] hover:bg-[#2e1d3e]'
            : 'text-violet-300 border-violet-500/40 bg-violet-950/50 hover:bg-violet-900/60',
      }
    : newAgentEnabled
    ? {
        name: 'New Agent',
        toggle: toggleNewAgent,
        color:
          theme === 'classic'
            ? 'text-rose-300 border-rose-500/50 bg-rose-950/60 hover:bg-rose-900/70 shadow-[0_0_8px_rgba(244,63,94,0.25)]'
            : theme === 'fulldark'
            ? 'text-rose-300 border-rose-500/40 bg-[#281318] hover:bg-[#381a22]'
            : 'text-rose-300 border-rose-500/40 bg-rose-950/50 hover:bg-rose-900/60',
      }
    : swarmLiveEnabled
    ? {
        name: 'Swarm Live',
        toggle: toggleSwarmLive,
        color:
          theme === 'classic'
            ? 'text-red-300 border-red-500/50 bg-red-950/60 hover:bg-red-900/70 shadow-[0_0_8px_rgba(239,68,68,0.25)]'
            : theme === 'fulldark'
            ? 'text-red-300 border-red-500/40 bg-[#281313] hover:bg-[#381a1a]'
            : 'text-red-300 border-red-500/40 bg-red-950/50 hover:bg-red-900/60',
      }
    : commanderEnabled
    ? {
        name: 'Commander',
        toggle: toggleCommander,
        color:
          theme === 'classic'
            ? 'text-indigo-300 border-indigo-500/50 bg-indigo-950/60 hover:bg-indigo-900/70 shadow-[0_0_8px_rgba(99,102,241,0.25)]'
            : theme === 'fulldark'
            ? 'text-indigo-300 border-indigo-500/40 bg-[#16172e] hover:bg-[#1f2040]'
            : 'text-indigo-300 border-indigo-500/40 bg-indigo-950/50 hover:bg-indigo-900/60',
      }
    : null;

  const activeSpecialistModeName = activeSpecialistMode?.name ?? null;

  const getPersonaVoice = (personaId?: string): string => {
    const globalVoice = storage.getEdgeVoice();
    if (personaId === 'nova') return 'en-US-JennyNeural';
    if (personaId === 'orbit') return 'en-US-GuyNeural';
    if (personaId === 'cosmos') return 'en-US-EricNeural';
    return globalVoice || 'en-US-AriaNeural';
  };

  const handlePlayPersonaAudio = async (text: string, idKey: string, personaId: string) => {
    if (personaAudioPlayingKey === idKey) {
      if (edgeTtsAudioRef.current) {
        edgeTtsAudioRef.current.pause();
        edgeTtsAudioRef.current = null;
      }
      setPersonaAudioPlayingKey(null);
      return;
    }

    if (edgeTtsAudioRef.current) {
      edgeTtsAudioRef.current.pause();
      edgeTtsAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingIndex(null);
    setEdgeTtsPlayingIndex(null);

    setPersonaAudioLoadingKey(idKey);
    try {
      const voice = getPersonaVoice(personaId);
      const cleanText = text.replace(/[*_#`~[\]()]/g, '').trim();
      const response = await fetch('/api/edge-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText.slice(0, 4000),
          voice,
        }),
      });

      if (!response.ok) {
        throw new Error(`Edge TTS failed: ${response.status}`);
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      edgeTtsAudioRef.current = audio;

      audio.onended = () => {
        setPersonaAudioPlayingKey(null);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setPersonaAudioPlayingKey(null);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
      setPersonaAudioPlayingKey(idKey);
    } catch (err) {
      console.error('Persona TTS failed:', err);
      setPersonaAudioPlayingKey(null);
    } finally {
      setPersonaAudioLoadingKey(null);
    }
  };

  const handleLanguageChange = (val: string) => {
    setResponseLanguage(val);
    storage.setAssistantLanguage(val);
  };

  const handleResetToEnglish = () => {
    setResponseLanguage('');
    storage.setAssistantLanguage('');
    triggerSettingsToast('Response language reset to English (Default)');
  };

  const handleThemeChange = (newTheme: 'minimal' | 'classic' | 'fulldark') => {
    setTheme(newTheme);
    storage.setAssistantTheme(newTheme);
    console.log(`[AI Assistant Theme Switch] Switched to "${newTheme}"`, {
      newTheme,
      persistedKey: 'nexus-ai-theme-preference',
      timestamp: new Date().toISOString(),
    });
    triggerSettingsToast(
      `Theme set to ${
        newTheme === 'classic'
          ? 'NEXUS Classic'
          : newTheme === 'fulldark'
          ? 'Full Dark'
          : 'NEXUS Minimal'
      }`,
    );
  };

  const dismissEnhanceTip = () => {
    if (showImageEnhanceTip) {
      setShowImageEnhanceTip(false);
      storage.setAssistantImageEnhanceTipDismissed(true);
    }
  };

  const handleImagePointerDown = () => {
    if (deepResearchEnabled) return;
    longPressTriggeredRef.current = false;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      dismissEnhanceTip();

      try {
        Haptics.impact({ style: ImpactStyle.Light });
      } catch {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(40);
        }
      }

      setImageEnhanceEnabled((prevEnhance) => {
        const nextEnhance = !prevEnhance;
        storage.setAssistantImageEnhanceEnabled(nextEnhance);
        triggerSettingsToast(`AI Prompt Enhancement ${nextEnhance ? 'enabled' : 'disabled'}`);
        return nextEnhance;
      });

      setImageGenEnabled((prevGen) => {
        if (!prevGen) {
          try {
            localStorage.setItem(IMAGE_GEN_PREF_KEY, 'true');
          } catch {
            // Ignore
          }
          return true;
        }
        return prevGen;
      });
    }, 500);
  };

  const cancelImagePointer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleImageClick = (e: React.MouseEvent) => {
    if (deepResearchEnabled) return;

    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    dismissEnhanceTip();

    setImageGenEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(IMAGE_GEN_PREF_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      if (!next) {
        setImageEnhanceEnabled(false);
        storage.setAssistantImageEnhanceEnabled(false);
      }
      return next;
    });
  };

  const toggleDeepResearch = () => {
    setDeepResearchEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(DEEP_RESEARCH_PREF_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const handleDownloadImage = async (imgItem: AssistantGeneratedImage) => {
    try {
      const sanitized =
        imgItem.prompt.slice(0, 32).replace(/[^a-zA-Z0-9_-]/g, '_') || 'generated_image';
      const fileName = `nexus_${sanitized}_${imgItem.seed}.jpg`;

      let targetUrl = imgItem.imageData || imgItem.url;
      if (!imgItem.imageData && imgItem.imageDataId) {
        const dbData = await loadImageFromDb(imgItem.imageDataId);
        if (dbData) {
          targetUrl = dbData;
        }
      }

      if (targetUrl.startsWith('blob:') || targetUrl.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = targetUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const response = await fetch(targetUrl, { mode: 'cors' });
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }
    } catch {
      const a = document.createElement('a');
      a.href = imgItem.url;
      a.target = '_blank';
      a.download = `nexus_image_${imgItem.seed}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  useEffect(() => {
    console.log(`[AI Assistant Theme Applied to DOM] Active Theme: "${theme}"`, {
      theme,
      appliedClass:
        theme === 'classic'
          ? 'theme-classic'
          : theme === 'fulldark'
          ? 'theme-fulldark'
          : 'theme-minimal',
      rootElementClass:
        theme === 'classic'
          ? 'bg-[#060b13]'
          : theme === 'fulldark'
          ? 'bg-black text-[#ececec]'
          : 'bg-[#18181b] text-[#e3e3e7]',
      timestamp: new Date().toISOString(),
    });
  }, [theme]);

  const handleAddPermanentMemory = () => {
    const trimmed = newMemoryInput.trim();
    if (!trimmed) return;
    const updated = storage.addPermanentMemory(trimmed);
    setPermanentMemories(updated);
    setNewMemoryInput('');
    triggerSettingsToast('Memory added to permanent context');
  };

  const handleDeletePermanentMemory = (index: number) => {
    const updated = storage.deletePermanentMemory(index);
    setPermanentMemories(updated);
    if (editingMemoryIndex === index) {
      setEditingMemoryIndex(null);
      setEditingMemoryDraft('');
    }
  };

  const handleStartEditPermanentMemory = (index: number) => {
    setEditingMemoryIndex(index);
    setEditingMemoryDraft(permanentMemories[index] || '');
  };

  const handleSaveEditPermanentMemory = (index: number) => {
    const trimmed = editingMemoryDraft.trim();
    if (!trimmed) {
      handleDeletePermanentMemory(index);
      return;
    }
    const updated = storage.updatePermanentMemory(index, trimmed);
    setPermanentMemories(updated);
    setEditingMemoryIndex(null);
    setEditingMemoryDraft('');
  };

  const handleCancelEditPermanentMemory = () => {
    setEditingMemoryIndex(null);
    setEditingMemoryDraft('');
  };

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages, loading, scrollToBottom]);

  const toggleWebSearch = () => {
    if (deepResearchEnabled || architectEnabled || dataAnalysisEnabled) return;
    setWebSearchEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(WEB_SEARCH_PREF_KEY, String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const toggleSourceExpand = (index: number) => {
    setExpandedSources((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const stopSpeak = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Safe fallback
      }
    }
    utteranceRef.current = null;
    setSpeakingIndex(null);
  }, []);

  const toggleBrowserSpeak = useCallback(
    (text: string, index: number) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      if (speakingIndex === index) {
        stopSpeak();
        return;
      }
      try {
        window.speechSynthesis.cancel();
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch {
        // Safe fallback
      }
      const cleanText = text
        .replace(/```[\s\S]*?```/g, ' Code snippet omitted. ')
        .replace(/[*#`_~>[\]()]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utteranceRef.current = utterance;
      utterance.onend = () => {
        setSpeakingIndex(null);
        utteranceRef.current = null;
      };
      utterance.onerror = () => {
        setSpeakingIndex(null);
        utteranceRef.current = null;
      };
      setSpeakingIndex(index);
      window.speechSynthesis.speak(utterance);
    },
    [speakingIndex, stopSpeak],
  );

  const handleEdgeTtsSpeak = useCallback(
    async (text: string, index: number) => {
      playTapSound();
      if (edgeTtsPlayingIndex === index) {
        if (edgeTtsAudioRef.current) {
          edgeTtsAudioRef.current.pause();
          edgeTtsAudioRef.current.currentTime = 0;
        }
        setEdgeTtsPlayingIndex(null);
        return;
      }

      stopSpeak();
      if (edgeTtsAudioRef.current) {
        edgeTtsAudioRef.current.pause();
        edgeTtsAudioRef.current = null;
      }

      const cleanText = text
        .replace(/```[\s\S]*?```/g, ' Code snippet omitted. ')
        .replace(/[*#`_~>[\]()]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanText) return;

      setEdgeTtsLoadingIndex(index);
      try {
        const response = await fetch('/api/edge-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: cleanText.slice(0, 4000),
            voice: storage.getEdgeVoice(),
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `Server responded with status ${response.status}`);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const audio = new Audio(url);
        edgeTtsAudioRef.current = audio;

        audio.onplay = () => {
          setEdgeTtsPlayingIndex(index);
        };

        audio.onended = () => {
          setEdgeTtsPlayingIndex(null);
          edgeTtsAudioRef.current = null;
          URL.revokeObjectURL(url);
        };

        audio.onerror = () => {
          setEdgeTtsPlayingIndex(null);
          edgeTtsAudioRef.current = null;
          URL.revokeObjectURL(url);
        };

        await audio.play();
        setEdgeTtsPlayingIndex(index);
      } catch (err) {
        console.error('[Assistant] Edge TTS error:', err);
        setEdgeTtsPlayingIndex(null);
      } finally {
        setEdgeTtsLoadingIndex(null);
      }
    },
    [edgeTtsPlayingIndex, stopSpeak],
  );

  const handleCopyText = useCallback(async (text: string, index: number) => {
    playTapSound();
    const clean = stripTierLabels(text);
    const richHtml = formatMarkdownToRichHtml(clean);
    const success = await copyToClipboard(clean, richHtml);
    if (success) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  }, []);



  const handleDeleteMessage = useCallback(
    (indexToDelete: number) => {
      playTapSound();
      if (speakingIndex === indexToDelete) {
        stopSpeak();
      }
      if (edgeTtsPlayingIndex === indexToDelete) {
        if (edgeTtsAudioRef.current) {
          edgeTtsAudioRef.current.pause();
          edgeTtsAudioRef.current = null;
        }
        setEdgeTtsPlayingIndex(null);
      }
      setMessages((prev) => {
        const targetMsg = prev[indexToDelete];
        if (targetMsg?.image?.imageDataId) {
          deleteImageFromDb(targetMsg.image.imageDataId).catch(() => {});
        }
        const updated = prev.filter((_, i) => i !== indexToDelete);
        if (updated.length === 0 || updated.every((m) => m.isWelcome)) {
          return [
            {
              id: 'welcome-0',
              role: 'assistant',
              content: '',
              isWelcome: true,
            },
          ];
        }
        return updated;
      });
      triggerSettingsToast('Message deleted from conversation');
    },
    [speakingIndex, edgeTtsPlayingIndex, stopSpeak],
  );

  const handleDeletePersonaResponse = useCallback(
    (msgIndex: number, personaIndex: number) => {
      playTapSound();
      setMessages((prev) => {
        const targetMsg = prev[msgIndex];
        if (!targetMsg || !targetMsg.multiChatResponses) return prev;
        const newResponses = targetMsg.multiChatResponses.filter((_, idx) => idx !== personaIndex);
        if (newResponses.length === 0) {
          const updated = prev.filter((_, i) => i !== msgIndex);
          if (updated.length === 0 || updated.every((m) => m.isWelcome)) {
            return [
              {
                id: 'welcome-0',
                role: 'assistant',
                content: '',
                isWelcome: true,
              },
            ];
          }
          return updated;
        }
        const updated = [...prev];
        updated[msgIndex] = {
          ...targetMsg,
          multiChatResponses: newResponses,
        };
        return updated;
      });
      triggerSettingsToast('Persona answer deleted');
    },
    [],
  );

  const handleUniversalCopyAll = useCallback(async () => {
    playTapSound();
    const meaningfulMessages = messages.filter((m) => !m.isWelcome);
    if (meaningfulMessages.length === 0) {
      triggerSettingsToast('No conversation text to copy yet.');
      return;
    }

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const formattedTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const transcriptLines: string[] = [];

    // Header Meta Block
    transcriptLines.push('════════════════════════════════════════════════════════════════');
    transcriptLines.push('🤖 NEXUS AI ASSISTANT — CONVERSATION EXPORT');
    transcriptLines.push('════════════════════════════════════════════════════════════════');
    transcriptLines.push(`📅 Date: ${formattedDate}`);
    transcriptLines.push(`⏰ Time: ${formattedTime}`);
    transcriptLines.push(`📊 Total Messages: ${meaningfulMessages.length}`);
    transcriptLines.push('────────────────────────────────────────────────────────────────\n');

    let turnNumber = 1;
    meaningfulMessages.forEach((m) => {
      if (m.role === 'user') {
        transcriptLines.push(`### 👤 USER PROMPT [Turn ${turnNumber}]`);
        transcriptLines.push(`${m.content.trim()}\n`);
      } else if (m.role === 'assistant') {
        transcriptLines.push(`### 🤖 AI ASSISTANT RESPONSE [Turn ${turnNumber}]`);

        // Multi Chat Personas
        if (m.multiChatResponses && m.multiChatResponses.length > 0) {
          m.multiChatResponses.forEach((resp) => {
            const personaText = stripTierLabels(resp.content || resp.text || '').trim();
            if (personaText) {
              transcriptLines.push(`\n#### ▸ ${resp.name} (${resp.personaId.toUpperCase()}):`);
              transcriptLines.push(`${personaText}\n`);
            }
          });
        } else if (m.content) {
          transcriptLines.push(`${stripTierLabels(m.content).trim()}\n`);
        }

        // Architectural SVG Diagram
        if (m.diagramSvg) {
          transcriptLines.push('📐 [Architectural Blueprint SVG Diagram Generated]\n');
        }

        // Data Analysis Chart
        if (m.chartData) {
          transcriptLines.push(`📊 [Data Analysis Chart: ${m.chartData.title || 'Interactive Visual Metrics'}]\n`);
        }

        // Generated Image
        if (m.image) {
          transcriptLines.push(`🖼️ [Generated Image: "${m.image.prompt}" (${m.image.providerName} · ${m.image.width}×${m.image.height})]\n`);
        }

        // Wikimedia Commons Images
        if (m.wikimediaItems && m.wikimediaItems.length > 0) {
          transcriptLines.push(`📷 [Wikimedia Commons: ${m.wikimediaItems.length} Real Photographic Assets for "${m.wikimediaTopic || 'Topic'}"]`);
          m.wikimediaItems.forEach((w, wIdx) => {
            transcriptLines.push(`  ${wIdx + 1}. ${w.title} — ${w.sourceUrl || w.mediaUrl}`);
          });
          transcriptLines.push('  Credit: Images from Wikimedia Commons\n');
        }

        // Sources & Citations
        if (m.sources && m.sources.length > 0) {
          transcriptLines.push('🔗 Sources & References:');
          m.sources.forEach((src, sIdx) => {
            transcriptLines.push(`  ${sIdx + 1}. ${src.title} — ${src.url}`);
          });
          transcriptLines.push('');
        }

        transcriptLines.push('────────────────────────────────────────────────────────────────\n');
        turnNumber++;
      }
    });

    // Footer Block
    transcriptLines.push('════════════════════════════════════════════════════════════════');
    transcriptLines.push('Exported securely from NEXUS AI Assistant | End of Transcript');
    transcriptLines.push('════════════════════════════════════════════════════════════════');

    const fullText = transcriptLines.join('\n').trim();
    const richHtml = formatMarkdownToRichHtml(fullText);
    const success = await copyToClipboard(fullText, richHtml);
    if (success) {
      setUniversalCopied(true);
      setTimeout(() => setUniversalCopied(false), 2500);
      triggerSettingsToast('Universal Copy: Exported structured transcript with timestamps!');
    }
  }, [messages]);

  const handleUniversalSaveAll = useCallback(() => {
    playTapSound();
    const assistantMessages = messages.filter(
      (m) =>
        m.role === 'assistant' &&
        !m.isWelcome &&
        (m.content || m.diagramSvg || m.chartData || (m.multiChatResponses && m.multiChatResponses.length > 0)),
    );

    if (assistantMessages.length === 0) {
      triggerSettingsToast('No AI Assistant answers to save yet.');
      return;
    }

    const updatedIds = new Set(savedItemIds);
    let savedCount = 0;

    messages.forEach((msg, idx) => {
      if (msg.role !== 'assistant' || msg.isWelcome) return;
      const stableId = msg.id || `assistant-msg-${idx}`;
      const prevUserMsg = idx > 0 && messages[idx - 1]?.role === 'user' ? messages[idx - 1].content : '';
      const title =
        prevUserMsg.trim() ||
        (msg.diagramSvg
          ? 'Architectural Blueprint'
          : msg.chartData
          ? 'Data Analysis Chart'
          : 'AI Assistant Response');

      const itemType: 'diagram' | 'chart' | 'jarvis' = msg.diagramSvg
        ? 'diagram'
        : msg.chartData
        ? 'chart'
        : 'jarvis';

      const itemToSave: SavedItem = {
        id: stableId,
        type: itemType,
        title: title.slice(0, 120),
        query: prevUserMsg.trim() || title,
        subtitle: stripTierLabels(msg.content).slice(0, 200).trim() || title,
        content: msg.content,
        diagramSvg: msg.diagramSvg,
        chartData: msg.chartData,
        deepResearch: msg.deepResearch,
        sources: msg.sources?.map((s) => ({
          title: s.title,
          url: s.url,
          domain: s.domain,
        })),
        images: msg.image
          ? [
              {
                url: msg.image.url || msg.image.imageData || '',
                thumbUrl: msg.image.url || msg.image.imageData || '',
                title: msg.image.prompt || 'Generated Image',
                description: msg.image.prompt || '',
                source: msg.image.providerName || 'AI Studio',
                domain: 'nexus',
              },
            ]
          : undefined,
        savedAt: new Date().toISOString(),
      };

      storage.saveItem(itemToSave);
      updatedIds.add(stableId);
      savedCount++;
    });

    const firstQuery = messages.find((m) => m.role === 'user')?.content?.slice(0, 80) || 'AI Assistant Session';
    const masterSessionId = `assistant-session-${Date.now()}`;
    const transcriptText = messages
      .filter((m) => !m.isWelcome)
      .map((m) => `${m.role === 'user' ? '👤 User:' : '🤖 AI Assistant:'}\n${stripTierLabels(m.content)}`)
      .join('\n\n---\n\n');

    const sessionItem: SavedItem = {
      id: masterSessionId,
      type: 'jarvis',
      title: `Session: ${firstQuery}`,
      query: firstQuery,
      subtitle: `Complete conversation archive (${savedCount} answers saved)`,
      content: transcriptText,
      savedAt: new Date().toISOString(),
    };
    storage.saveItem(sessionItem);
    updatedIds.add(masterSessionId);

    setSavedItemIds(updatedIds);
    setUniversalSaved(true);
    setTimeout(() => setUniversalSaved(false), 3000);
    triggerSettingsToast(`Universal Save: Stored all ${savedCount} answers in your Saved Page!`);
  }, [messages, savedItemIds]);

  const handleUniversalEdgeTtsSpeakAll = useCallback(async () => {
    playTapSound();
    if (universalEdgeTtsPlaying) {
      if (edgeTtsAudioRef.current) {
        edgeTtsAudioRef.current.pause();
        edgeTtsAudioRef.current.currentTime = 0;
        edgeTtsAudioRef.current = null;
      }
      setUniversalEdgeTtsPlaying(false);
      setEdgeTtsPlayingIndex(null);
      return;
    }

    const assistantTextList = messages
      .filter((m) => m.role === 'assistant' && !m.isWelcome && m.content)
      .map((m) => stripTierLabels(m.content));

    if (assistantTextList.length === 0) {
      triggerSettingsToast('No AI Assistant answers to read aloud yet.');
      return;
    }

    const combinedAssistantSpeech = assistantTextList.join('. Next response: ');

    stopSpeak();
    if (edgeTtsAudioRef.current) {
      edgeTtsAudioRef.current.pause();
      edgeTtsAudioRef.current = null;
    }

    const cleanText = combinedAssistantSpeech
      .replace(/```[\s\S]*?```/g, ' Code snippet omitted. ')
      .replace(/[*#`_~>[\]()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    setUniversalEdgeTtsLoading(true);
    try {
      const response = await fetch('/api/edge-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText.slice(0, 4000),
          voice: storage.getEdgeVoice(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Edge TTS error: ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      edgeTtsAudioRef.current = audio;

      audio.onplay = () => {
        setUniversalEdgeTtsPlaying(true);
      };

      audio.onended = () => {
        setUniversalEdgeTtsPlaying(false);
        edgeTtsAudioRef.current = null;
        URL.revokeObjectURL(url);
      };

      audio.onerror = () => {
        setUniversalEdgeTtsPlaying(false);
        edgeTtsAudioRef.current = null;
        URL.revokeObjectURL(url);
      };

      await audio.play();
      setUniversalEdgeTtsPlaying(true);
      triggerSettingsToast('Universal Edge TTS: Reading all AI Assistant answers aloud...');
    } catch (err) {
      console.error('[Universal Edge TTS] Error:', err);
      setUniversalEdgeTtsPlaying(false);
    } finally {
      setUniversalEdgeTtsLoading(false);
    }
  }, [messages, universalEdgeTtsPlaying, stopSpeak]);

  useEffect(() => {
    const syncSaved = () => {
      try {
        const items = storage.getSaved();
        setSavedItemIds(new Set(items.map((i) => i.id)));
      } catch {
        // ignore
      }
    };
    window.addEventListener('storage', syncSaved);
    return () => {
      window.removeEventListener('storage', syncSaved);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Safe fallback
        }
      }
      if (edgeTtsAudioRef.current) {
        edgeTtsAudioRef.current.pause();
        edgeTtsAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    try {
      const sanitizedMessages = messages.map((m) => {
        if (m.image && m.image.imageData) {
          return {
            ...m,
            image: {
              ...m.image,
              imageData: undefined,
            },
          };
        }
        return m;
      });
      localStorage.setItem(CHAT_KEY, JSON.stringify(sanitizedMessages));
    } catch {
      // Storage may be unavailable.
    }
  }, [messages]);

  useEffect(() => {
    try {
      if (smartMemory) {
        localStorage.setItem(MEMORY_KEY, smartMemory);
      } else {
        localStorage.removeItem(MEMORY_KEY);
      }
    } catch {
      // Ignore storage errors.
    }
  }, [smartMemory]);

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    adjustTextareaHeight();
  };

  const sendMessage = async (value = input) => {
    const message = value.trim();

    if (!message || loading) return;

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setError('');

    const userMessage: Message = {
      role: 'user',
      content: message,
    };

    const historyForRequest = messages
      .slice(-RECENT_MESSAGES)
      .filter((item) => item.content.trim());

    setMessages((current) => [...current, userMessage]);
    setLoading(true);
    webFetcherCancelledRef.current = false;

    // Swarm Live Specialist Mode (20+ Agent Live Debate Feed)
    if (swarmLiveEnabled) {
      const assistantMessage: Message = {
        role: 'assistant',
        content: message,
        tool: 'swarmlive',
        swarmLiveTopic: message,
      };
      setMessages((current) => [...current, assistantMessage]);
      setLoading(false);
      return;
    }

    // Commander Specialist Mode (3-Agent Tactical Intelligence Pipeline)
    if (commanderEnabled) {
      const assistantMessage: Message = {
        role: 'assistant',
        content: message,
        tool: 'commander',
        commanderTopic: message,
      };
      setMessages((current) => [...current, assistantMessage]);
      setLoading(false);
      return;
    }

    // If Deep Research mode is ON, route directly through JARVIS multi-agent research pipeline (takes top priority)
    if (deepResearchEnabled) {
      console.log('[AI Assistant] Automatic search skipped: Deep Research mode is active (handled by JARVIS pipeline internally)');
      setDeepResearchProgress(10);
      setDeepResearchPhase('Initializing JARVIS research pipeline (Planner formulating strategy)...');
      try {
        const jarvisConfig = storage.getJarvisConfig();
        let userTz = '';
        try {
          userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        } catch {
          userTz = 'Europe/London';
        }

        const result = await runJarvisPipeline(
          message,
          jarvisConfig,
          true, // deepResearch = true
          architectEnabled, // diagramMode (pass architectEnabled if user enabled it)
          dataAnalysisEnabled, // chartMode (pass dataAnalysisEnabled if user enabled it)
          false, // imageMode
          (step: JarvisExecutionStep) => {
            let pct = 10;
            let label = `${step.name || 'Agent'}: ${step.status === 'running' ? 'Processing...' : 'Completed'}`;

            if (step.agentId === 'planner') {
              pct = step.status === 'completed' ? 25 : 15;
              label = step.status === 'completed' ? 'Planner finalized research strategy' : 'Planner analyzing inquiry & formulating strategy...';
            } else if (step.agentId === 'researcher') {
              pct = step.status === 'completed' ? 55 : 35;
              label = step.status === 'completed' ? 'Researcher compiled sources & data' : 'Researcher gathering verified intelligence & sources...';
            } else if (step.agentId === 'factChecker') {
              pct = step.status === 'completed' ? 70 : 58;
              label = step.status === 'completed' ? 'Fact Checker validated claims' : 'Fact Checker auditing claims & evidence...';
            } else if (step.agentId === 'advisor' || step.agentId === 'coder' || step.agentId === 'architect') {
              pct = step.status === 'completed' ? 80 : 72;
              label = `${step.name} analyzing domain context...`;
            } else if (step.agentId === 'reviewer') {
              pct = step.status === 'completed' ? 88 : 82;
              label = step.status === 'completed' ? 'Reviewer audit finished' : 'Reviewer evaluating depth & edge cases...';
            } else if (step.agentId === 'finalSynthesizer') {
              pct = step.status === 'completed' ? 100 : 93;
              label = step.status === 'completed' ? 'Synthesis complete' : 'Final Synthesizer generating comprehensive report...';
            } else if (step.agentId === 'dataAnalyst' || step.agentId === 'imageFinder') {
              pct = step.status === 'completed' ? 95 : 90;
              label = `${step.name} processing assets...`;
            }

            setDeepResearchProgress((prev) => Math.max(prev, pct));
            setDeepResearchPhase(label);
          },
          userTz,
        );

        const assistantMessage: Message = {
          role: 'assistant',
          content: stripTierLabels(result.answer),
          tool: result.sources && result.sources.length > 0 ? 'search' : 'none',
          sources: result.sources && result.sources.length > 0 ? result.sources : undefined,
          searchedWeb: Boolean(result.sources && result.sources.length > 0),
          diagramSvg: result.diagramSvg,
          chartData: result.chartData,
        };

        setMessages((current) => [...current, assistantMessage]);

        const updatedConversation = [
          ...messages,
          userMessage,
          assistantMessage,
        ];
        const newMemory = buildLocalMemory(updatedConversation);
        if (newMemory) {
          setSmartMemory(newMemory);
        }
      } catch (drErr) {
        const errDetail =
          drErr instanceof Error
            ? drErr.message
            : 'JARVIS Deep Research pipeline encountered an issue.';
        const assistantMessage: Message = {
          role: 'assistant',
          content: `Deep Research execution failed: ${errDetail}\n\nPlease try again or check your configured AI providers in Settings.`,
          tool: 'none',
        };
        setMessages((current) => [...current, assistantMessage]);
        setError(errDetail);
      } finally {
        setLoading(false);
        setDeepResearchProgress(0);
        setDeepResearchPhase('');
      }
      return;
    }

    // If Image Generation mode is ON, route directly to Image Studio generation infrastructure
    if (imageGenEnabled) {
      console.log('[Official Page] skipped: Image mode is active');
      console.log('[AI Assistant] Automatic search skipped: Image mode is active');

      let promptToUse = message;
      let enhancedPromptText: string | null = null;

      if (imageEnhanceEnabled) {
        setImageLoadingPhase('Enhancing prompt with AI...');
        try {
          const enhanced = await enhanceImagePromptWithAI(message);
          if (enhanced && enhanced !== message) {
            promptToUse = enhanced;
            enhancedPromptText = enhanced;
          }
        } catch (enhanceErr) {
          console.warn('[AssistantPage] AI Prompt Enhancement failed, falling back to original prompt', enhanceErr);
        }
      }

      setImageLoadingPhase('Initiating image synthesis...');
      try {
        const imageResult = await generateStudioImage(promptToUse, {
          onProgress: (phase) => setImageLoadingPhase(phase),
        });

        const imagePayload: AssistantGeneratedImage = {
          url: imageResult.url,
          providerName: imageResult.providerName,
          model: imageResult.model,
          width: imageResult.width,
          height: imageResult.height,
          seed: imageResult.seed,
          prompt: imageResult.prompt,
        };

        if (imageResult.imageData) {
          if (isIndexedDbAvailable()) {
            const shortId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const savePromise = saveImageToDb(shortId, imageResult.imageData);
            pendingSavesRef.current.add(savePromise);
            try {
              const saved = await savePromise;
              if (saved) {
                imagePayload.imageDataId = shortId;
              } else {
                console.warn('[AssistantPage] Image save to IndexedDB failed for id ' + shortId + ', reason: saveImageToDb returned false');
                imagePayload.imageData = imageResult.imageData;
              }
            } catch (dbErr) {
              const reason = dbErr instanceof Error ? dbErr.message : String(dbErr);
              console.warn('[AssistantPage] Image save to IndexedDB failed for id ' + shortId + ', reason: ' + reason);
              imagePayload.imageData = imageResult.imageData;
            } finally {
              pendingSavesRef.current.delete(savePromise);
            }
          } else {
            imagePayload.imageData = imageResult.imageData;
          }
        }

        const assistantMessage: Message = {
          role: 'assistant',
          content: enhancedPromptText
            ? `Here is your generated image for: "${message}"\n\n*(Prompt enhanced with AI: "${enhancedPromptText}")*`
            : `Here is your generated image for: "${message}"`,
          tool: 'image',
          image: imagePayload,
        };

        setMessages((current) => [...current, assistantMessage]);

        const updatedConversation = [
          ...messages,
          userMessage,
          assistantMessage,
        ];
        const newMemory = buildLocalMemory(updatedConversation);
        if (newMemory) {
          setSmartMemory(newMemory);
        }
      } catch (imgErr) {
        const errDetail =
          imgErr instanceof Error
            ? imgErr.message
            : 'All image providers failed to generate image.';
        const assistantMessage: Message = {
          role: 'assistant',
          content: `Image generation failed: ${errDetail}\n\nYou can review or adjust your active provider in Settings or Image Studio.`,
          tool: 'image',
        };
        setMessages((current) => [...current, assistantMessage]);
        setError(errDetail);
      } finally {
        setLoading(false);
        setImageLoadingPhase('');
      }
      return;
    }

    // PRIORITY 1: Multi Chat (3-Persona Panel) Mode
    // When Multi Chat is ON, Multi Chat keeps its current behavior, and Coder / Web Fetcher are ignored while it is on.
    if (multiChatEnabled) {
      console.log('[Official Page] skipped: Multi Chat is active');
      try {
        const multiChatConfig = storage.getMultiChatConfig();
        const currentLanguage = storage.getAssistantLanguage() || storage.getMultiChatResponseLanguage();
        
        // Unify all memories (AI Assistant Permanent Memories, Smart Short-term Memory, and Multi-Chat Memories)
        const combinedMemories = [
          ...storage.getPermanentMemories(),
          ...storage.getMultiChatMemories(),
          ...(smartMemory ? [`Short-term context: ${smartMemory}`] : []),
        ].filter((m, idx, arr) => m && m.trim().length > 0 && arr.indexOf(m) === idx);

        // Convert prior messages to MultiChatMessage history
        const multiChatHistory: MultiChatMessage[] = messages
          .slice(-10)
          .filter((m) => m.role === 'assistant' && m.multiChatResponses && m.multiChatResponses.length > 0)
          .map((m, idx) => ({
            id: `mc_turn_${idx}`,
            query: 'Prior user context',
            timestamp: Date.now(),
            responses: m.multiChatResponses || [],
          }));

        // Build initial persona list in sequential order (NOVA -> ORBIT -> COSMOS)
        const enabledPersonas = Object.values(multiChatConfig.personas).filter((p) => p.enabled);
        const orderedIds = ['nova', 'orbit', 'cosmos'];
        const sortedPersonas = [...enabledPersonas].sort((a, b) => {
          const idxA = orderedIds.indexOf(a.id);
          const idxB = orderedIds.indexOf(b.id);
          return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
        });

        const initialResponses: MultiChatPersonaResponse[] = sortedPersonas.map((p, idx) => ({
          personaId: p.id,
          name: p.name,
          icon: p.icon,
          accentColor: p.accentColor,
          toneBadge: p.toneBadge,
          text: '',
          status: idx === 0 ? 'running' : 'pending',
        }));

        const placeholderAssistantMessage: Message = {
          role: 'assistant',
          content: '',
          tool: 'multichat',
          multiChatResponses: initialResponses,
        };

        setMessages((current) => [...current, placeholderAssistantMessage]);

        const { responses } = await executeMultiChatTurn({
          query: message,
          conversationHistory: multiChatHistory,
          config: multiChatConfig,
          permanentMemories: combinedMemories,
          responseLanguage: currentLanguage,
          onPersonaUpdate: (updatedResp) => {
            setMessages((current) => {
              const next = [...current];
              const lastIdx = next.length - 1;
              if (lastIdx >= 0 && next[lastIdx].role === 'assistant' && next[lastIdx].tool === 'multichat') {
                const existing = next[lastIdx].multiChatResponses || [];
                const hasExisting = existing.some((r) => r.personaId === updatedResp.personaId);
                const updatedList = hasExisting
                  ? existing.map((r) => (r.personaId === updatedResp.personaId ? updatedResp : r))
                  : [...existing, updatedResp];
                next[lastIdx] = {
                  ...next[lastIdx],
                  multiChatResponses: updatedList,
                  content: updatedList.map((r) => `${r.name}: ${r.content || r.text}`).join('\n\n'),
                };
              }
              return next;
            });
          },
        });

        const finalContent = responses
          .map((r) => `${r.name}: ${r.content || r.text}`)
          .join('\n\n');

        const finalAssistantMessage: Message = {
          role: 'assistant',
          content: finalContent,
          tool: 'multichat',
          multiChatResponses: responses,
        };

        setMessages((current) => {
          const next = [...current];
          const lastIdx = next.length - 1;
          if (lastIdx >= 0 && next[lastIdx].tool === 'multichat') {
            next[lastIdx] = finalAssistantMessage;
            return next;
          }
          return [...next, finalAssistantMessage];
        });

        const updatedConversation = [
          ...messages,
          userMessage,
          finalAssistantMessage,
        ];
        const newMemory = buildLocalMemory(updatedConversation);
        if (newMemory) {
          setSmartMemory(newMemory);
        }
      } catch (mcErr) {
        const errDetail =
          mcErr instanceof Error
            ? mcErr.message
            : 'Multi Chat pipeline encountered an issue.';
        setError(errDetail);
      } finally {
        setLoading(false);
      }
      return;
    }

    // PRIORITY: Swarm Live (20+ Agent YouTube-Style Live Debate Feed)
    if (swarmLiveEnabled) {
      try {
        const assistantMessage: Message = {
          role: 'assistant',
          content: message,
          tool: 'swarmlive',
          swarmLiveTopic: message,
        };
        setMessages((current) => [...current, assistantMessage]);
      } finally {
        setLoading(false);
      }
      return;
    }

    // PRIORITY: Commander Mode (3-Agent Tactical Intelligence Pipeline)
    if (commanderEnabled) {
      try {
        const assistantMessage: Message = {
          role: 'assistant',
          content: message,
          tool: 'commander',
          commanderTopic: message,
        };
        setMessages((current) => [...current, assistantMessage]);
      } finally {
        setLoading(false);
      }
      return;
    }

    // =========================================================================
    // SPECIALIST MODES PRIORITY & ROUTING
    // Priority Order:
    // 1. Deep Research (top priority if enabled)
    // 2. Image Generation (image studio generation pipeline)
    // 3. Multi Chat (3-Persona panel mode, ignores single-specialists)
    // 4. Web Fetcher (direct URL / site query / number selection)
    // 5. Wikimedia (5 photo Commons retrieval, wins over New Agent / Coder)
    // 6. New Agent (dynamic 3-specialist pipeline via /newagent, wins over Coder)
    // 7. Coder (/codeonline research-grounded coding)
    // 8. Architect / Data Analysis (vector SVG software blueprints / Recharts metrics)
    // =========================================================================

    // 1. Check Web Fetcher mode if enabled
    if (webFetcherEnabled) {
      const directUrl = extractUrlOrDomain(message);
      const pickedNumber = parseSelectionNumber(message);
      const asksForWebsite = isWebsiteRequest(message);

      // If Coder is also ON, Web Fetcher handles:
      // - messages with a URL
      // - number selection when a list exists
      // - messages that ask for a website, site, page, link or web address
      // Everything else goes to Coder.
      const shouldWebFetcherHandle =
        Boolean(directUrl) ||
        (pickedNumber !== null && (webFetcherList.length > 0 || !coderEnabled)) ||
        asksForWebsite ||
        !coderEnabled;

      if (shouldWebFetcherHandle) {
        if (directUrl) {
          // Case a: URL or bare domain
          setWebFetcherList([]);
          setWebFetcherOriginalRequest('');
          console.log(`[Web Fetcher] direct URL: ${directUrl}`);
          setSpecialistProgress(30);
          setSpecialistPhase(`Fetching webpage content directly from ${directUrl}...`);

          let pageContent = '';
          const fetchStart = Date.now();
          try {
            const webRes = await Promise.race([
              api.webFetch(directUrl),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('webFetch timeout')), 60000)
              ),
            ]);
            if (webFetcherCancelledRef.current) return;
            if (webRes && webRes.ok && webRes.data && webRes.data.textContent) {
              pageContent = webRes.data.textContent.slice(0, 4500);
              const fetchTime = Date.now() - fetchStart;
              console.log(`[Web Fetcher] fetch ok: ${directUrl} (${fetchTime} ms, ${pageContent.length} chars)`);
            }
          } catch (err: unknown) {
            if (webFetcherCancelledRef.current) return;
            const errObj = err as Error;
            const isTimeout = errObj?.message?.includes('timeout');
            if (isTimeout) {
              console.log('[Web Fetcher] timeout: fetch');
            } else {
              console.log(`[Web Fetcher] fetch error: ${errObj?.message || 'unknown'}`);
            }
          }

          if (webFetcherCancelledRef.current) return;

          if (pageContent) {
            setSpecialistProgress(70);
            setSpecialistPhase('Synthesizing answer from webpage content...');
            const currentLanguage = storage.getAssistantLanguage();
            const currentPermanentMemories = storage.getPermanentMemories();

            const aiPrompt = `You are the FINAL SYNTHESIZER agent.
Your task is to analyze the extracted webpage content and deliver a direct, comprehensive, and well-structured final agent answer for the user.

Webpage URL: ${directUrl}

Webpage Content (truncated to 4,500 characters):
${pageContent}

User Question/Message: "${message}"

DIRECTIVES:
1. Deliver a clear, authoritative, and informative analysis of this webpage in clean Markdown.
2. Outline the purpose of the website or platform, its key features, primary sections, services, or documentation.
3. Structure your response logically using concise headers, bullet points, and clean paragraphs. Put newest items first and include exact dates when available on the page.
4. Ground your answer strictly in the provided webpage content.
5. Provide ONLY the definitive final agent answer. Do NOT output internal agent labels, system steps, JSON schemas, or tool logs.`;

            let finalAnswerText = '';
            console.log('[Web Fetcher] synthesis start');
            const synthStart = Date.now();

            try {
              const aiRes = await Promise.race([
                api.aiChat(
                  aiPrompt,
                  [],
                  '',
                  undefined,
                  false,
                  { language: currentLanguage, permanentMemories: currentPermanentMemories }
                ),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error('aiChat timeout')), 40000)
                ),
              ]);
              if (webFetcherCancelledRef.current) return;
              const synthTime = Date.now() - synthStart;
              console.log(`[Web Fetcher] synthesis done (${synthTime} ms)`);
              finalAnswerText = stripTierLabels(aiRes.answer);
            } catch (synthErr: unknown) {
              if (webFetcherCancelledRef.current) return;
              const sErr = synthErr as Error;
              const isTimeout = sErr?.message?.includes('timeout');
              if (isTimeout) {
                console.log('[Web Fetcher] timeout: synthesis');
              } else {
                console.log(`[Web Fetcher] synthesis error: ${sErr?.message || 'Synthesis failed'}`);
              }
              const rawMsg = sErr?.message || 'Synthesis failed';
              const safeMsg = rawMsg
                .replace(/(?:key|secret|token|password|bearer|auth|apikey)[=:\s]+[A-Za-z0-9_.-]{8,}/gi, '[redacted]')
                .replace(/AIza[0-9A-Za-z-_]{35}/g, '[redacted]')
                .replace(/sk-[a-zA-Z0-9]{20,}/g, '[redacted]');
              const reason = isTimeout ? 'AI took more than 40 seconds' : safeMsg.slice(0, 150);
              finalAnswerText = `Read page: ${directUrl}\n\n${pageContent.slice(0, 1500)}\n\nThe AI was too slow or failed, so this is the raw page text. Try again or pick another number.\nReason: ${reason}`;
            }

            if (webFetcherCancelledRef.current) return;

            const assistantMessage: Message = {
              role: 'assistant',
              content: finalAnswerText,
              tool: 'webfetcher',
            };

            setMessages((current) => [...current, assistantMessage]);
            const updatedConversation = [...messages, userMessage, assistantMessage];
            const newMemory = buildLocalMemory(updatedConversation);
            if (newMemory) setSmartMemory(newMemory);
            setLoading(false);
            setSpecialistProgress(0);
            setSpecialistPhase('');
            return;
          } else {
            if (webFetcherCancelledRef.current) return;
            const assistantMessage: Message = {
              role: 'assistant',
              content: 'Could not read this page. Try another number.',
              tool: 'webfetcher',
            };
            setMessages((current) => [...current, assistantMessage]);
            setLoading(false);
            setSpecialistProgress(0);
            setSpecialistPhase('');
            return;
          }
        } else if (pickedNumber !== null) {
          // Case c: Number selection
          if (webFetcherList.length === 0) {
            const assistantMessage: Message = {
              role: 'assistant',
              content: 'There is no list yet. Ask for a website first, for example: list claude official web.',
              tool: 'webfetcher',
            };
            setMessages((current) => [...current, assistantMessage]);
            setLoading(false);
            return;
          }

          if (pickedNumber < 1 || pickedNumber > webFetcherList.length) {
            const assistantMessage: Message = {
              role: 'assistant',
              content: `Please send a number from 1 to ${webFetcherList.length}.`,
              tool: 'webfetcher',
            };
            setMessages((current) => [...current, assistantMessage]);
            setLoading(false);
            return;
          }

          const pickedItem = webFetcherList[pickedNumber - 1];
          console.log(`[Web Fetcher] picked #${pickedNumber}: ${pickedItem.url}`);

          setSpecialistProgress(30);
          setSpecialistPhase(`Fetching content from #${pickedNumber} (${pickedItem.url})...`);

          let pageContent = '';
          const fetchStart = Date.now();
          try {
            const webRes = await Promise.race([
              api.webFetch(pickedItem.url),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('webFetch timeout')), 60000)
              ),
            ]);
            if (webFetcherCancelledRef.current) return;
            if (webRes && webRes.ok && webRes.data && webRes.data.textContent) {
              pageContent = webRes.data.textContent.slice(0, 4500);
              const fetchTime = Date.now() - fetchStart;
              console.log(`[Web Fetcher] fetch ok: ${pickedItem.url} (${fetchTime} ms, ${pageContent.length} chars)`);
            }
          } catch (err: unknown) {
            if (webFetcherCancelledRef.current) return;
            const errObj = err as Error;
            const isTimeout = errObj?.message?.includes('timeout');
            if (isTimeout) {
              console.log('[Web Fetcher] timeout: fetch');
            } else {
              console.log(`[Web Fetcher] fetch error: ${errObj?.message || 'unknown'}`);
            }
          }

          if (webFetcherCancelledRef.current) return;

          if (pageContent) {
            setSpecialistProgress(70);
            setSpecialistPhase('Synthesizing answer from webpage content...');
            const currentLanguage = storage.getAssistantLanguage();
            const currentPermanentMemories = storage.getPermanentMemories();

            const userRequestText = webFetcherOriginalRequest.trim()
              ? `The user asked for a list of websites with this request: "${webFetcherOriginalRequest}". They picked this page from the list.`
              : `The user picked this page from a list. Summarize what this page is and its main information.`;

            const aiPrompt = `You are the FINAL SYNTHESIZER agent.
Your task is to analyze the extracted webpage content and deliver a direct, comprehensive, and well-structured final agent answer for the user.

Webpage URL: ${pickedItem.url}

Webpage Content (truncated to 4,500 characters):
${pageContent}

${userRequestText}

DIRECTIVES:
1. Deliver a clear, authoritative, and informative analysis of this webpage in clean Markdown.
2. Outline the purpose of the website or platform, its key features, primary sections, services, or documentation.
3. Structure your response logically using concise headers, bullet points, and clean paragraphs. Put the newest items first and include exact dates when available on the page. Never mention the list number.
4. Ground your answer strictly in the provided webpage content.
5. Provide ONLY the definitive final agent answer. Do NOT output internal agent labels, system steps, JSON schemas, or tool logs.`;

            let finalAnswerText = '';
            console.log('[Web Fetcher] synthesis start');
            const synthStart = Date.now();

            try {
              const aiRes = await Promise.race([
                api.aiChat(
                  aiPrompt,
                  [],
                  '',
                  undefined,
                  false,
                  { language: currentLanguage, permanentMemories: currentPermanentMemories }
                ),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error('aiChat timeout')), 40000)
                ),
              ]);
              if (webFetcherCancelledRef.current) return;
              const synthTime = Date.now() - synthStart;
              console.log(`[Web Fetcher] synthesis done (${synthTime} ms)`);
              finalAnswerText = stripTierLabels(aiRes.answer);
            } catch (synthErr: unknown) {
              if (webFetcherCancelledRef.current) return;
              const sErr = synthErr as Error;
              const isTimeout = sErr?.message?.includes('timeout');
              if (isTimeout) {
                console.log('[Web Fetcher] timeout: synthesis');
              } else {
                console.log(`[Web Fetcher] synthesis error: ${sErr?.message || 'Synthesis failed'}`);
              }
              const rawMsg = sErr?.message || 'Synthesis failed';
              const safeMsg = rawMsg
                .replace(/(?:key|secret|token|password|bearer|auth|apikey)[=:\s]+[A-Za-z0-9_.-]{8,}/gi, '[redacted]')
                .replace(/AIza[0-9A-Za-z-_]{35}/g, '[redacted]')
                .replace(/sk-[a-zA-Z0-9]{20,}/g, '[redacted]');
              const reason = isTimeout ? 'AI took more than 40 seconds' : safeMsg.slice(0, 150);
              finalAnswerText = `Read page: ${pickedItem.url}\n\n${pageContent.slice(0, 1500)}\n\nThe AI was too slow or failed, so this is the raw page text. Try again or pick another number.\nReason: ${reason}`;
            }

            if (webFetcherCancelledRef.current) return;

            const assistantMessage: Message = {
              role: 'assistant',
              content: finalAnswerText,
              tool: 'webfetcher',
            };

            setMessages((current) => [...current, assistantMessage]);
            const updatedConversation = [...messages, userMessage, assistantMessage];
            const newMemory = buildLocalMemory(updatedConversation);
            if (newMemory) setSmartMemory(newMemory);
            setLoading(false);
            setSpecialistProgress(0);
            setSpecialistPhase('');
            return;
          } else {
            if (webFetcherCancelledRef.current) return;
            const assistantMessage: Message = {
              role: 'assistant',
              content: 'Could not read this page. Try another number.',
              tool: 'webfetcher',
            };
            setMessages((current) => [...current, assistantMessage]);
            setLoading(false);
            setSpecialistProgress(0);
            setSpecialistPhase('');
            return;
          }
        } else if (asksForWebsite) {
          // Case b: Website request (search and build numbered list)
          const { name: cleanedName, query: cleanedQuery } = cleanWebFetcherQuery(message);
          console.log(`[Web Fetcher] cleaned query: ${cleanedQuery}`);

          setSpecialistProgress(30);
          setSpecialistPhase(`Searching web for websites matching "${cleanedQuery}"...`);

          const isCustomSearchActive = webApiMode === 'custom' && Boolean(customSearchKey.trim() && customSearchUrl.trim());
          const customKeyPayload = isCustomSearchActive ? customSearchKey.trim() : undefined;
          const customUrlPayload = isCustomSearchActive ? customSearchUrl.trim() : undefined;

          let rawResults: SearchResult[] = [];
          let sourceLabel = 'default';

          // Attempt 1: primary search (custom API if configured, else default)
          try {
            const opts = isCustomSearchActive
              ? { customSearchApiKey: customKeyPayload, customSearchApiUrl: customUrlPayload }
              : undefined;
            const res = await api.search(cleanedQuery, 'ALL', undefined, 8, opts);
            if (res && res.length > 0) {
              rawResults = res;
              sourceLabel = res.searchSource || (isCustomSearchActive ? 'custom-api' : 'default');
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            const safeMsg = customKeyPayload ? errMsg.replace(customKeyPayload, '***') : errMsg;
            console.log(`[Web Fetcher] search error: ${safeMsg}`);
          }

          // Attempt 2: if custom API returned 0 results or errored, retry once with default search
          if (rawResults.length === 0 && isCustomSearchActive) {
            try {
              const res = await api.search(cleanedQuery, 'ALL', undefined, 8);
              if (res && res.length > 0) {
                rawResults = res;
                sourceLabel = res.searchSource || 'default';
              }
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : String(err);
              console.log(`[Web Fetcher] search error: ${errMsg}`);
            }
          }

          // Attempt 3: if still 0 results or errored, retry once more with just "<name>" using default search
          if (rawResults.length === 0 && cleanedName && cleanedName !== cleanedQuery) {
            try {
              const res = await api.search(cleanedName, 'ALL', undefined, 8);
              if (res && res.length > 0) {
                rawResults = res;
                sourceLabel = res.searchSource || 'default';
              }
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : String(err);
              console.log(`[Web Fetcher] search error: ${errMsg}`);
            }
          }

          console.log(`[Web Fetcher] search results: ${rawResults.length} (source: ${sourceLabel})`);

          // Filter: Remove duplicate URLs and results without a valid https URL.
          const seenUrls = new Set<string>();
          const validResults: SearchResult[] = [];

          for (const r of rawResults) {
            if (r && r.url && isValidOfficialHttpsUrl(r.url)) {
              const normalized = r.url.trim().toLowerCase().replace(/\/+$/, '');
              if (!seenUrls.has(normalized)) {
                seenUrls.add(normalized);
                validResults.push(r);
              }
            }
          }

          const targetForMatch = cleanedName || message;
          const officialResults: SearchResult[] = [];
          const standardResults: SearchResult[] = [];

          validResults.forEach((r) => {
            if (checkIsOfficialDomain(r.url, targetForMatch)) {
              officialResults.push(r);
            } else {
              standardResults.push(r);
            }
          });

          // Sort official first, non-official second. Keep up to 8.
          const combinedResults = [...officialResults, ...standardResults].slice(0, 8);
          console.log(`[Web Fetcher] after filtering: ${combinedResults.length}`);

          if (combinedResults.length === 0) {
            const assistantMessage: Message = {
              role: 'assistant',
              content: 'No websites found. Try different words.',
              tool: 'webfetcher',
            };
            setMessages((current) => [...current, assistantMessage]);
            setLoading(false);
            setSpecialistProgress(0);
            setSpecialistPhase('');
            return;
          }

          const items: WebFetcherResultItem[] = combinedResults.map((r, idx) => {
            let host = '';
            try {
              host = new URL(r.url).hostname;
            } catch {
              host = r.domain || 'web';
            }
            const isOff = checkIsOfficialDomain(r.url, targetForMatch);
            const snippet = (r.description || r.title || '').replace(/\s+/g, ' ').trim().slice(0, 140);
            return {
              number: idx + 1,
              title: r.title || host,
              domain: host,
              url: r.url,
              snippet,
              isOfficial: isOff,
            };
          });

          setWebFetcherList(items);
          setWebFetcherOriginalRequest(message);
          console.log(`[Web Fetcher] list built: ${items.length} items`);

          const lines: string[] = [];
          lines.push(`Found ${items.length} website${items.length === 1 ? '' : 's'}:\n`);
          items.forEach((item) => {
            const badge = item.isOfficial ? ' **[Official]**' : '';
            lines.push(`${item.number}.${badge} [${item.title}](${item.url}) — \`${item.domain}\``);
            if (item.snippet) {
              lines.push(`   ${item.snippet}`);
            }
            lines.push('');
          });
          lines.push(`Send a number (1-${items.length}) to read that page.`);

          const listContent = lines.join('\n').trim();

          const assistantMessage: Message = {
            role: 'assistant',
            content: listContent,
            tool: 'webfetcher',
            sources: items.map((i) => ({ title: i.title, url: i.url, domain: i.domain })),
            searchedWeb: true,
          };

          setMessages((current) => [...current, assistantMessage]);
          const updatedConversation = [...messages, userMessage, assistantMessage];
          const newMemory = buildLocalMemory(updatedConversation);
          if (newMemory) setSmartMemory(newMemory);
          setLoading(false);
          setSpecialistProgress(0);
          setSpecialistPhase('');
          return;
        } else {
          // Case d: Unrecognized message when Web Fetcher is ON
          const assistantMessage: Message = {
            role: 'assistant',
            content: 'Web Fetcher is ON. Send a URL, ask for a website (for example: list claude official web), or send a number from the list.',
            tool: 'webfetcher',
          };
          setMessages((current) => [...current, assistantMessage]);
          setLoading(false);
          return;
        }
      }
    }

    // 2. Check Wikimedia mode
    if (wikimediaEnabled) {
      const cleanTopic = cleanWikimediaQuery(message);
      setSpecialistProgress(20);
      setSpecialistPhase(`Fetching Wikimedia Commons images for "${cleanTopic}"...`);

      try {
        setSpecialistProgress(50);
        const rawResults = await searchWikimediaCommons(cleanTopic, 5);
        setSpecialistProgress(85);

        // Filter for real photo/bitmap images only (skip SVG, PDF, audio, video)
        const photoImages = (rawResults || []).filter(isRealBitmapImage).slice(0, 5);

        if (photoImages.length === 0) {
          const assistantMessage: Message = {
            role: 'assistant',
            content: `No Wikimedia images found for '${cleanTopic}'. Try a different word.`,
            tool: 'none',
          };
          setMessages((current) => [...current, assistantMessage]);
        } else {
          const assistantMessage: Message = {
            role: 'assistant',
            content: `Retrieved ${photoImages.length} real photo${photoImages.length === 1 ? '' : 's'} from Wikimedia Commons for **${cleanTopic}**:`,
            tool: 'wikimedia',
            wikimediaItems: photoImages,
            wikimediaTopic: cleanTopic,
          };
          setMessages((current) => [...current, assistantMessage]);

          const updatedConversation = [
            ...messages,
            userMessage,
            assistantMessage,
          ];
          const newMemory = buildLocalMemory(updatedConversation);
          if (newMemory) {
            setSmartMemory(newMemory);
          }
        }
      } catch (wErr) {
        console.error('[AI Assistant] Wikimedia search failed:', wErr);
        const assistantMessage: Message = {
          role: 'assistant',
          content: `Unable to retrieve Wikimedia images for '${cleanTopic}' right now. Please verify your connection and try again.`,
          tool: 'none',
        };
        setMessages((current) => [...current, assistantMessage]);
      } finally {
        setLoading(false);
        setSpecialistProgress(0);
        setSpecialistPhase('');
      }
      return;
    }

    // 3. Check New Agent, Coder, Architect, Data Analysis modes
    const isNewAgentSlash = /^\/(?:newagent|new_agent)(?:\s+|$)/i.test(message.trim());
    const isOtherSpecialistActive = newAgentEnabled || isNewAgentSlash || coderEnabled || architectEnabled || dataAnalysisEnabled;

    if (isOtherSpecialistActive) {
      let effectiveMessage = message;
      let effectiveTool: Message['tool'] = 'agent';

      if (newAgentEnabled || isNewAgentSlash) {
        effectiveMessage = isNewAgentSlash ? message : `/newagent ${message}`;
        effectiveTool = 'agent';
      } else if (coderEnabled) {
        effectiveMessage = /^\/codeonline(?:\s+|$)/i.test(message.trim()) ? message : `/codeonline ${message}`;
        effectiveTool = 'coder';
      } else {
        effectiveTool = architectEnabled ? 'architect' : 'dataAnalyst';
      }

      setSpecialistProgress(10);
      setSpecialistPhase(
        newAgentEnabled || isNewAgentSlash
          ? 'Initializing Dynamic Agent pipeline (Planner analyzing domain & formulating 3 specialists)...'
          : effectiveMessage.startsWith('/codeonline')
          ? 'Initializing Coder agent (Planner & Researcher formulating technical blueprint)...'
          : architectEnabled && dataAnalysisEnabled
          ? 'Initializing Architect & Data Analysis pipeline...'
          : architectEnabled
          ? 'Initializing Architect agent (Planner formulating blueprint strategy)...'
          : 'Initializing Data Analysis agent (Planner formulating metrics strategy)...'
      );

      try {
        const jarvisConfig = storage.getJarvisConfig();
        let userTz = '';
        try {
          userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        } catch {
          userTz = 'Europe/London';
        }

        const result = await runJarvisPipeline(
          effectiveMessage,
          jarvisConfig,
          false, // deepResearch = false
          architectEnabled,
          dataAnalysisEnabled,
          false, // imageMode
          (step: JarvisExecutionStep) => {
            let pct = 15;
            let label = `${step.name || 'Agent'}: ${step.status === 'running' ? 'Processing...' : 'Completed'}`;

            if (step.agentId === 'planner') {
              pct = step.status === 'completed' ? 30 : 20;
              label = step.status === 'completed' ? 'Planner finalized system strategy' : 'Planner analyzing system architecture & parameters...';
            } else if (step.agentId === 'researcher') {
              pct = step.status === 'completed' ? 55 : 35;
              label = step.status === 'completed' ? 'Researcher compiled technical docs' : 'Researcher gathering live documentation...';
            } else if (step.agentId === 'coder') {
              pct = step.status === 'completed' ? 85 : 55;
              label = step.status === 'completed' ? 'Coder synthesized technical structures' : 'Coder formulating technical specifications...';
            } else if (step.agentId === 'architect') {
              pct = step.status === 'completed' ? 85 : 55;
              label = step.status === 'completed' ? 'Architect rendered SVG blueprint' : 'Architect generating interactive vector system blueprint...';
            } else if (step.agentId === 'dataAnalyst') {
              pct = step.status === 'completed' ? 85 : 55;
              label = step.status === 'completed' ? 'Data Analyst extracted metrics' : 'Data Analyst structuring data points & chart series...';
            } else if (step.agentId?.startsWith('specialist_') || step.agentId === 'dynamicSpecialist') {
              pct = step.status === 'completed' ? 85 : 60;
              label = `${step.name || 'Specialist'}: ${step.status === 'completed' ? 'Analysis complete' : 'Deliberating & analyzing domain context...'}`;
            } else if (step.agentId === 'finalSynthesizer') {
              pct = step.status === 'completed' ? 100 : 92;
              label = step.status === 'completed' ? 'Synthesis complete' : 'Final Synthesizer assembling complete response...';
            }

            setSpecialistProgress((prev) => Math.max(prev, pct));
            setSpecialistPhase(label);
          },
          userTz,
        );

        const assistantMessage: Message = {
          role: 'assistant',
          content: stripTierLabels(result.answer),
          tool: effectiveTool,
          sources: result.sources && result.sources.length > 0 ? result.sources : undefined,
          searchedWeb: Boolean(result.sources && result.sources.length > 0),
          diagramSvg: result.diagramSvg,
          chartData: result.chartData,
        };

        setMessages((current) => [...current, assistantMessage]);

        const updatedConversation = [
          ...messages,
          userMessage,
          assistantMessage,
        ];
        const newMemory = buildLocalMemory(updatedConversation);
        if (newMemory) {
          setSmartMemory(newMemory);
        }
      } catch (agentErr) {
        const errDetail =
          agentErr instanceof Error
            ? agentErr.message
            : 'Specialist agent execution encountered an issue.';
        const assistantMessage: Message = {
          role: 'assistant',
          content: `Specialist agent execution failed: ${errDetail}\n\nPlease check your configured AI providers in Settings.`,
          tool: 'none',
        };
        setMessages((current) => [...current, assistantMessage]);
        setError(errDetail);
      } finally {
        setLoading(false);
        setSpecialistProgress(0);
        setSpecialistPhase('');
      }
      return;
    }

    const isWebSearchForced = webSearchEnabled;

    try {
      const currentLanguage = storage.getAssistantLanguage();
      const currentPermanentMemories = storage.getPermanentMemories();

      const isCustomSearchActive = webApiMode === 'custom' && Boolean(customSearchKey.trim() && customSearchUrl.trim());
      const customKeyPayload = isCustomSearchActive ? customSearchKey.trim() : undefined;
      const customUrlPayload = isCustomSearchActive ? customSearchUrl.trim() : undefined;

      const response = await api.aiChat(
        message,
        historyForRequest,
        smartMemory,
        undefined,
        isWebSearchForced,
        {
          language: currentLanguage,
          permanentMemories: currentPermanentMemories,
          customSearchApiKey: customKeyPayload,
          customSearchApiUrl: customUrlPayload,
        },
      );

      const usedWebSearch =
        isWebSearchForced ||
        response.tool === 'search' ||
        Boolean(response.sources && response.sources.length > 0);

      const assistantMessage: Message = {
        role: 'assistant',
        content: stripTierLabels(response.answer),
        tool: response.tool,
        sources: response.sources,
        weather: response.weather,
        searchedWeb: usedWebSearch,
        searchSource: response.searchSource,
        searchNotice: response.searchNotice,
      };

      setMessages((current) => [...current, assistantMessage]);

      const updatedConversation = [
        ...messages,
        userMessage,
        assistantMessage,
      ];

      const newMemory = buildLocalMemory(updatedConversation);

      if (newMemory) {
        setSmartMemory(newMemory);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'NEXUS AI is temporarily unavailable.',
      );
    } finally {
      setLoading(false);
      setSpecialistProgress(0);
      setSpecialistPhase('');
    }
  };

  const newChat = () => {
    setMessages([welcomeMessage]);
    setWebFetcherList([]);
    setWebFetcherOriginalRequest('');
    setError('');
    setShowClearConfirm(false);
  };

  const handleConfirmClearChat = () => {
    // Delete persisted image blobs from IndexedDB
    for (const msg of messages) {
      if (msg.image?.imageDataId) {
        deleteImageFromDb(msg.image.imageDataId).catch(() => {});
      }
    }

    setSmartMemory('');
    setMemoryDraft('');
    setMemoryEditorOpen(false);
    setMessages([welcomeMessage]);
    setWebFetcherList([]);
    setWebFetcherOriginalRequest('');
    setError('');
    setShowClearConfirm(false);
    setClearedToast(true);
    setTimeout(() => setClearedToast(false), 3000);

    try {
      localStorage.removeItem(CHAT_KEY);
      localStorage.removeItem(MEMORY_KEY);
    } catch {
      // Ignore storage errors.
    }
  };

  const openMemoryEditor = () => {
    setMemoryDraft(smartMemory);
    setMemoryEditorOpen(true);
  };

  const clearMemory = () => {
    setSmartMemory('');
    setMemoryDraft('');
    setMemoryEditorOpen(false);
    try {
      localStorage.removeItem(MEMORY_KEY);
    } catch {
      // Ignore
    }
  };

  const saveMemory = () => {
    const cleaned = memoryDraft.trim().slice(-MAX_MEMORY_LENGTH);
    setSmartMemory(cleaned);
    setMemoryDraft(cleaned);
    setMemoryEditorOpen(false);
  };

  const activeProvider = storage.getActiveAIProvider();
  const providerLabel = activeProvider ? activeProvider.name : 'NEXUS Standard';

  const isOnlyWelcome =
    messages.length === 1 &&
    messages[0].role === 'assistant' &&
    messages[0].content === welcomeMessage.content;

  return (
    <div
      data-theme={theme}
      className={`min-h-screen flex flex-col font-sans -mx-4 sm:-mx-8 md:-mx-12 -my-8 px-4 sm:px-8 py-4 transition-colors duration-200 ${
        theme === 'classic'
          ? 'theme-classic bg-[#060b13] text-[#e2e8f0] relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0c223c] via-[#081324] to-[#040810]'
          : theme === 'fulldark'
          ? 'theme-fulldark bg-black text-[#ececec]'
          : 'theme-minimal bg-[#111113] text-[#e3e3e7]'
      }`}
    >
      {/* Top Navigation Header */}
      <header
        className={`max-w-4xl w-full mx-auto flex items-center justify-between pb-3 pt-1 transition-colors ${
          theme === 'classic'
            ? 'border-b border-cyan-500/25 bg-slate-900/40 backdrop-blur-md px-3 rounded-xl'
            : theme === 'fulldark'
            ? 'border-b border-[#212121] bg-black'
            : 'border-b border-zinc-800/80 bg-[#111113]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm tracking-tight ${
                theme === 'classic'
                  ? 'font-bold text-cyan-300 drop-shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                  : theme === 'fulldark'
                  ? 'font-medium text-[#f9f9f9]'
                  : 'font-semibold text-zinc-100'
              }`}
            >
              NEXUS AI
            </span>
            {responseLanguage && (
              <span className="hidden md:inline-flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded-full bg-zinc-800/90 text-zinc-300 border border-zinc-700/60">
                <Languages size={10} className="text-cyan-400" />
                <span className="truncate max-w-[90px]">{responseLanguage}</span>
              </span>
            )}
          </div>

          <div
            className={`h-3 w-px ${
              theme === 'classic'
                ? 'bg-cyan-500/30'
                : theme === 'fulldark'
                ? 'bg-[#333]'
                : 'bg-zinc-700/80'
            }`}
          />

          <Link
            to="/settings?tab=ai"
            className={`flex items-center gap-1.5 text-xs transition-colors ${
              theme === 'classic'
                ? 'text-cyan-300/80 hover:text-cyan-100'
                : theme === 'fulldark'
                ? 'text-[#a1a1aa] hover:text-[#f4f4f5]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Configure AI Providers in Settings"
          >
            <Cpu size={12} className={theme === 'classic' ? 'text-cyan-400' : 'text-zinc-400'} />
            <span className="truncate max-w-[140px] sm:max-w-[220px]">
              {providerLabel}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
          {/* Universal Icon-Only Controls (Copy, Save, Edge TTS) for all AI Assistant answers */}
          {!isOnlyWelcome && messages.some((m) => m.role === 'assistant' && !m.isWelcome) && (
            <div className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-700/70 p-0.5 sm:p-1 rounded-xl shadow-sm mr-0.5 sm:mr-1">
              {/* Universal Copy Icon Only */}
              <button
                type="button"
                onClick={handleUniversalCopyAll}
                className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${
                  universalCopied
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : theme === 'classic'
                    ? 'border-transparent text-cyan-200 hover:bg-cyan-950/50 hover:text-white'
                    : theme === 'fulldark'
                    ? 'border-transparent text-[#d4d4d8] hover:bg-[#282828] hover:text-white'
                    : 'border-transparent text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }`}
                title="Universal Copy: Copy all AI Assistant answers and text"
                aria-label="Universal Copy"
              >
                {universalCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>

              {/* Universal Edge TTS Speaker Icon Only */}
              <button
                type="button"
                onClick={handleUniversalEdgeTtsSpeakAll}
                disabled={universalEdgeTtsLoading}
                className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${
                  universalEdgeTtsPlaying
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : theme === 'classic'
                    ? 'border-transparent text-cyan-200 hover:bg-cyan-950/50 hover:text-white'
                    : theme === 'fulldark'
                    ? 'border-transparent text-[#d4d4d8] hover:bg-[#282828] hover:text-white'
                    : 'border-transparent text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }`}
                title={
                  universalEdgeTtsLoading
                    ? 'Synthesizing Edge TTS Neural voice...'
                    : universalEdgeTtsPlaying
                    ? 'Stop Universal Edge TTS'
                    : 'Universal Edge TTS: Play all AI Assistant answers read aloud'
                }
                aria-label="Universal Edge TTS Speaker"
              >
                {universalEdgeTtsLoading ? (
                  <Loader2 size={14} className="animate-spin text-purple-400" />
                ) : universalEdgeTtsPlaying ? (
                  <Radio size={14} className="animate-pulse text-purple-400" />
                ) : (
                  <Radio size={14} />
                )}
              </button>

              {/* Universal Save Icon Only */}
              <button
                type="button"
                onClick={handleUniversalSaveAll}
                className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${
                  universalSaved
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : theme === 'classic'
                    ? 'border-transparent text-cyan-200 hover:bg-cyan-950/50 hover:text-white'
                    : theme === 'fulldark'
                    ? 'border-transparent text-[#d4d4d8] hover:bg-[#282828] hover:text-white'
                    : 'border-transparent text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }`}
                title="Universal Save: Save all AI Assistant answers to Saved Page"
                aria-label="Universal Save"
              >
                <Bookmark
                  size={14}
                  className={universalSaved ? 'fill-amber-400 text-amber-400' : ''}
                />
              </button>
            </div>
          )}

          {/* Settings Modal Trigger */}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
              responseLanguage || permanentMemories.length > 0
                ? theme === 'classic'
                  ? 'bg-cyan-950/60 text-cyan-200 border-cyan-500/40 hover:bg-cyan-900/60'
                  : theme === 'fulldark'
                  ? 'bg-[#212121] text-[#ececec] border-[#383838] hover:bg-[#2a2a2a]'
                  : 'bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:bg-zinc-700/70'
                : theme === 'classic'
                ? 'text-cyan-300/70 border-transparent hover:bg-cyan-950/40'
                : theme === 'fulldark'
                ? 'text-[#a1a1aa] border-transparent hover:bg-[#212121] hover:text-[#ececec]'
                : 'text-zinc-400 border-transparent hover:bg-zinc-800/60'
            }`}
            title="Assistant Settings (Language, Permanent Memories, Theme)"
          >
            <SettingsIcon size={13} className="text-zinc-300" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* Smart Memory Status & Trigger */}
          <button
            type="button"
            onClick={openMemoryEditor}
            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
              smartMemory
                ? theme === 'classic'
                  ? 'bg-cyan-950/50 text-cyan-200 border-cyan-500/30 hover:bg-cyan-900/50'
                  : theme === 'fulldark'
                  ? 'bg-[#212121] text-[#ececec] border-[#383838] hover:bg-[#2a2a2a]'
                  : 'bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:bg-zinc-700/70'
                : theme === 'classic'
                ? 'text-cyan-300/70 border-transparent hover:bg-cyan-950/40'
                : theme === 'fulldark'
                ? 'text-[#a1a1aa] border-transparent hover:bg-[#212121] hover:text-[#ececec]'
                : 'text-zinc-400 border-transparent hover:bg-zinc-800/60'
            }`}
            title="Manage Short-term Memory"
          >
            <Brain size={13} className={smartMemory ? 'text-cyan-400' : 'text-zinc-400'} />
            <span className="hidden sm:inline">Memory</span>
          </button>

          {/* New Chat */}
          <button
            type="button"
            onClick={newChat}
            className={`text-xs px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              theme === 'classic'
                ? 'text-cyan-200 hover:text-white hover:bg-cyan-950/50'
                : theme === 'fulldark'
                ? 'text-[#ececec] hover:bg-[#212121]'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
            }`}
            title="Start a new chat"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">New chat</span>
          </button>

          {/* Clear Chat */}
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className={`text-xs p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              theme === 'classic'
                ? 'text-cyan-300/70 hover:text-red-300 hover:bg-red-500/15'
                : 'text-zinc-400 hover:text-red-300 hover:bg-red-500/10'
            }`}
            title="Clear conversation"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </header>

      {/* Confirmation & Toast Banners */}
      {clearedToast && (
        <div className="max-w-4xl w-full mx-auto mt-2 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 flex items-center gap-2">
          <Check size={14} className="text-emerald-400" />
          <span>Conversation and local context cleared.</span>
        </div>
      )}

      {showClearConfirm && (
        <div className="max-w-4xl w-full mx-auto mt-2 px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-700/80 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={15} className="text-amber-400 shrink-0" />
            <span className="text-xs text-zinc-300">
              Clear conversation history and stored memory?
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              className="px-2.5 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmClearChat}
              className="px-3 py-1 rounded text-xs font-medium bg-red-600/90 hover:bg-red-600 text-white"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Main Chat Stream (Claude-style transparent and clean message bubbles) */}
      <main className="flex-1 max-w-4xl w-full mx-auto flex flex-col justify-between py-6 px-1 sm:px-2">
        <div className="flex-1 space-y-6">
          {/* Multi Chat Mode Active Indicator Banner */}
          {multiChatEnabled && (
            <div
              className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                theme === 'classic'
                  ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                  : theme === 'fulldark'
                  ? 'bg-[#181818] border-[#2e2e2e] text-[#e0e0e0]'
                  : 'bg-zinc-900/90 border-zinc-800 text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-6 h-6 rounded-lg grid place-items-center text-xs shrink-0 ${
                    theme === 'classic'
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : theme === 'fulldark'
                      ? 'bg-zinc-800 text-cyan-400'
                      : 'bg-zinc-800 text-cyan-400'
                  }`}
                >
                  <MessagesSquare size={13} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-zinc-100">Multi Chat Active:</span>
                  <span className="text-[11px] opacity-90">
                    3-Persona Sequential Panel (<strong>NOVA 🧠</strong> → <strong>ORBIT 😎</strong> → <strong>COSMOS 🧘</strong>)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-zinc-700/60 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition-colors flex items-center gap-1"
                  title="Configure in Settings"
                >
                  <SettingsIcon size={11} />
                  <span className="hidden sm:inline">Settings</span>
                </button>
                <button
                  type="button"
                  onClick={toggleMultiChat}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                    theme === 'classic'
                      ? 'border-cyan-500/40 bg-cyan-950/70 text-cyan-200 hover:border-red-500/50 hover:bg-red-950/40 hover:text-red-300'
                      : theme === 'fulldark'
                      ? 'border-[#333] bg-[#222] text-[#ccc] hover:border-red-500/40 hover:bg-red-950/30 hover:text-red-300'
                      : 'border-zinc-700/60 bg-zinc-800/80 text-zinc-300 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300'
                  }`}
                  title="Disable Multi Chat mode"
                  aria-label="Disable Multi Chat"
                >
                  <X size={12} />
                  <span>Disable</span>
                </button>
              </div>
            </div>
          )}

          {/* Architect Mode Active Indicator Banner */}
          {architectEnabled && (
            <div
              className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                theme === 'classic'
                  ? 'bg-amber-950/40 border-amber-500/30 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                  : theme === 'fulldark'
                  ? 'bg-[#181818] border-[#2e2e2e] text-[#e0e0e0]'
                  : 'bg-zinc-900/90 border-zinc-800 text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-6 h-6 rounded-lg grid place-items-center text-xs shrink-0 ${
                    theme === 'classic'
                      ? 'bg-amber-500/20 text-amber-300'
                      : theme === 'fulldark'
                      ? 'bg-zinc-800 text-amber-400'
                      : 'bg-zinc-800 text-amber-400'
                  }`}
                >
                  <Layers size={13} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-zinc-100">Architect Active:</span>
                  <span className="text-[11px] opacity-90">
                    Diagram &amp; System Design Agent (Interactive SVG Blueprints)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-zinc-700/60 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition-colors flex items-center gap-1"
                  title="Configure in Settings"
                >
                  <SettingsIcon size={11} />
                  <span className="hidden sm:inline">Settings</span>
                </button>
                <button
                  type="button"
                  onClick={toggleArchitect}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                    theme === 'classic'
                      ? 'border-amber-500/40 bg-amber-950/70 text-amber-200 hover:border-red-500/50 hover:bg-red-950/40 hover:text-red-300'
                      : theme === 'fulldark'
                      ? 'border-[#333] bg-[#222] text-[#ccc] hover:border-red-500/40 hover:bg-red-950/30 hover:text-red-300'
                      : 'border-zinc-700/60 bg-zinc-800/80 text-zinc-300 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300'
                  }`}
                  title="Disable Architect mode"
                  aria-label="Disable Architect"
                >
                  <X size={12} />
                  <span>Disable</span>
                </button>
              </div>
            </div>
          )}

          {/* Data Analysis Mode Active Indicator Banner */}
          {dataAnalysisEnabled && (
            <div
              className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                theme === 'classic'
                  ? 'bg-sky-950/40 border-sky-500/30 text-sky-200 shadow-[0_0_15px_rgba(56,189,248,0.15)]'
                  : theme === 'fulldark'
                  ? 'bg-[#181818] border-[#2e2e2e] text-[#e0e0e0]'
                  : 'bg-zinc-900/90 border-zinc-800 text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-6 h-6 rounded-lg grid place-items-center text-xs shrink-0 ${
                    theme === 'classic'
                      ? 'bg-sky-500/20 text-sky-300'
                      : theme === 'fulldark'
                      ? 'bg-zinc-800 text-sky-400'
                      : 'bg-zinc-800 text-sky-400'
                  }`}
                >
                  <BarChart3 size={13} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-zinc-100">Data Analysis Active:</span>
                  <span className="text-[11px] opacity-90">
                    Charts &amp; Quantitative Insights Agent (Interactive Recharts &amp; Metrics)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-zinc-700/60 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition-colors flex items-center gap-1"
                  title="Configure in Settings"
                >
                  <SettingsIcon size={11} />
                  <span className="hidden sm:inline">Settings</span>
                </button>
                <button
                  type="button"
                  onClick={toggleDataAnalysis}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                    theme === 'classic'
                      ? 'border-sky-500/40 bg-sky-950/70 text-sky-200 hover:border-red-500/50 hover:bg-red-950/40 hover:text-red-300'
                      : theme === 'fulldark'
                      ? 'border-[#333] bg-[#222] text-[#ccc] hover:border-red-500/40 hover:bg-red-950/30 hover:text-red-300'
                      : 'border-zinc-700/60 bg-zinc-800/80 text-zinc-300 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300'
                  }`}
                  title="Disable Data Analysis mode"
                  aria-label="Disable Data Analysis"
                >
                  <X size={12} />
                  <span>Disable</span>
                </button>
              </div>
            </div>
          )}

          {/* Coder Mode Active Indicator Banner */}
          {coderEnabled && (
            <div
              className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                theme === 'classic'
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                  : theme === 'fulldark'
                  ? 'bg-[#181818] border-[#2e2e2e] text-[#e0e0e0]'
                  : 'bg-zinc-900/90 border-zinc-800 text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-6 h-6 rounded-lg grid place-items-center text-xs shrink-0 ${
                    theme === 'classic'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-zinc-800 text-emerald-400'
                  }`}
                >
                  <Code2 size={13} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-zinc-100">Coder Active:</span>
                  <span className="text-[11px] opacity-90">
                    Research-grounded code pipeline (/codeonline)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-zinc-700/60 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition-colors flex items-center gap-1"
                  title="Configure in Settings"
                >
                  <SettingsIcon size={11} />
                  <span className="hidden sm:inline">Settings</span>
                </button>
                <button
                  type="button"
                  onClick={toggleCoder}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                    theme === 'classic'
                      ? 'border-emerald-500/40 bg-emerald-950/70 text-emerald-200 hover:border-red-500/50 hover:bg-red-950/40 hover:text-red-300'
                      : theme === 'fulldark'
                      ? 'border-[#333] bg-[#222] text-[#ccc] hover:border-red-500/40 hover:bg-red-950/30 hover:text-red-300'
                      : 'border-zinc-700/60 bg-zinc-800/80 text-zinc-300 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300'
                  }`}
                  title="Disable Coder mode"
                  aria-label="Disable Coder"
                >
                  <X size={12} />
                  <span>Disable</span>
                </button>
              </div>
            </div>
          )}

          {/* Web Fetcher Mode Active Indicator Banner */}
          {webFetcherEnabled && (
            <div
              className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                theme === 'classic'
                  ? 'bg-teal-950/40 border-teal-500/30 text-teal-200 shadow-[0_0_15px_rgba(20,184,166,0.15)]'
                  : theme === 'fulldark'
                  ? 'bg-[#181818] border-[#2e2e2e] text-[#e0e0e0]'
                  : 'bg-zinc-900/90 border-zinc-800 text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-6 h-6 rounded-lg grid place-items-center text-xs shrink-0 ${
                    theme === 'classic'
                      ? 'bg-teal-500/20 text-teal-300'
                      : 'bg-zinc-800 text-teal-400'
                  }`}
                >
                  <Globe size={13} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-zinc-100">Web Fetcher Active:</span>
                  <span className="text-[11px] opacity-90">
                    Read any webpage URL (/web)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-zinc-700/60 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition-colors flex items-center gap-1"
                  title="Configure in Settings"
                >
                  <SettingsIcon size={11} />
                  <span className="hidden sm:inline">Settings</span>
                </button>
                <button
                  type="button"
                  onClick={toggleWebFetcher}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                    theme === 'classic'
                      ? 'border-teal-500/40 bg-teal-950/70 text-teal-200 hover:border-red-500/50 hover:bg-red-950/40 hover:text-red-300'
                      : theme === 'fulldark'
                      ? 'border-[#333] bg-[#222] text-[#ccc] hover:border-red-500/40 hover:bg-red-950/30 hover:text-red-300'
                      : 'border-zinc-700/60 bg-zinc-800/80 text-zinc-300 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300'
                  }`}
                  title="Disable Web Fetcher mode"
                  aria-label="Disable Web Fetcher"
                >
                  <X size={12} />
                  <span>Disable</span>
                </button>
              </div>
            </div>
          )}

          {/* Wikimedia Mode Active Indicator Banner */}
          {wikimediaEnabled && (
            <div
              className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                theme === 'classic'
                  ? 'bg-violet-950/40 border-violet-500/30 text-violet-200 shadow-[0_0_15px_rgba(139,92,246,0.15)]'
                  : theme === 'fulldark'
                  ? 'bg-[#181818] border-[#2e2e2e] text-[#e0e0e0]'
                  : 'bg-zinc-900/90 border-zinc-800 text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-6 h-6 rounded-lg grid place-items-center text-xs shrink-0 ${
                    theme === 'classic'
                      ? 'bg-violet-500/20 text-violet-300'
                      : 'bg-zinc-800 text-violet-400'
                  }`}
                >
                  <ImageIcon size={13} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-zinc-100">Wikimedia Active:</span>
                  <span className="text-[11px] opacity-90">
                    5 real images from Wikimedia Commons
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-zinc-700/60 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition-colors flex items-center gap-1"
                  title="Configure in Settings"
                >
                  <SettingsIcon size={11} />
                  <span className="hidden sm:inline">Settings</span>
                </button>
                <button
                  type="button"
                  onClick={toggleWikimedia}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                    theme === 'classic'
                      ? 'border-violet-500/40 bg-violet-950/70 text-violet-200 hover:border-red-500/50 hover:bg-red-950/40 hover:text-red-300'
                      : theme === 'fulldark'
                      ? 'border-[#333] bg-[#222] text-[#ccc] hover:border-red-500/40 hover:bg-red-950/30 hover:text-red-300'
                      : 'border-zinc-700/60 bg-zinc-800/80 text-zinc-300 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300'
                  }`}
                  title="Disable Wikimedia mode"
                  aria-label="Disable Wikimedia"
                >
                  <X size={12} />
                  <span>Disable</span>
                </button>
              </div>
            </div>
          )}

          {/* New Agent Mode Active Indicator Banner */}
          {newAgentEnabled && (
            <div
              className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                theme === 'classic'
                  ? 'bg-rose-950/40 border-rose-500/30 text-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                  : theme === 'fulldark'
                  ? 'bg-[#181818] border-[#2e2e2e] text-[#e0e0e0]'
                  : 'bg-zinc-900/90 border-zinc-800 text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-6 h-6 rounded-lg grid place-items-center text-xs shrink-0 ${
                    theme === 'classic'
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-zinc-800 text-rose-400'
                  }`}
                >
                  <Layers3 size={13} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-zinc-100">New Agent Active:</span>
                  <span className="text-[11px] opacity-90">
                    Dynamic 3-specialist pipeline (/newagent)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-zinc-700/60 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition-colors flex items-center gap-1"
                  title="Configure in Settings"
                >
                  <SettingsIcon size={11} />
                  <span className="hidden sm:inline">Settings</span>
                </button>
                <button
                  type="button"
                  onClick={toggleNewAgent}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                    theme === 'classic'
                      ? 'border-rose-500/40 bg-rose-950/70 text-rose-200 hover:border-red-500/50 hover:bg-red-950/40 hover:text-red-300'
                      : theme === 'fulldark'
                      ? 'border-[#333] bg-[#222] text-[#ccc] hover:border-red-500/40 hover:bg-red-950/30 hover:text-red-300'
                      : 'border-zinc-700/60 bg-zinc-800/80 text-zinc-300 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300'
                  }`}
                  title="Disable New Agent mode"
                  aria-label="Disable New Agent"
                >
                  <X size={12} />
                  <span>Disable</span>
                </button>
              </div>
            </div>
          )}

          {/* Swarm Live Mode Active Indicator Banner */}
          {swarmLiveEnabled && (
            <div
              className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                theme === 'classic'
                  ? 'bg-red-950/40 border-red-500/30 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
                  : theme === 'fulldark'
                  ? 'bg-[#181818] border-[#2e2e2e] text-[#e0e0e0]'
                  : 'bg-zinc-900/90 border-zinc-800 text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-6 h-6 rounded-lg grid place-items-center text-xs shrink-0 ${
                    theme === 'classic'
                      ? 'bg-red-500/20 text-red-300'
                      : theme === 'fulldark'
                      ? 'bg-zinc-800 text-red-400'
                      : 'bg-zinc-800 text-red-400'
                  }`}
                >
                  <Radio size={13} className="text-red-400 animate-pulse" />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-zinc-100">Swarm Live Active:</span>
                  <span className="text-[11px] opacity-90">
                    20+ Agent Live Debate Feed (YouTube Chat style)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-zinc-700/60 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition-colors flex items-center gap-1"
                  title="Configure in Settings"
                >
                  <SettingsIcon size={11} />
                  <span className="hidden sm:inline">Settings</span>
                </button>
                <button
                  type="button"
                  onClick={toggleSwarmLive}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                    theme === 'classic'
                      ? 'border-red-500/40 bg-red-950/70 text-red-200 hover:border-red-500/50 hover:bg-red-950/40 hover:text-red-300'
                      : theme === 'fulldark'
                      ? 'border-[#333] bg-[#222] text-[#ccc] hover:border-red-500/40 hover:bg-red-950/30 hover:text-red-300'
                      : 'border-zinc-700/60 bg-zinc-800/80 text-zinc-300 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300'
                  }`}
                  title="Disable Swarm Live mode"
                  aria-label="Disable Swarm Live"
                >
                  <X size={12} />
                  <span>Disable</span>
                </button>
              </div>
            </div>
          )}

          {/* Empty / Welcome state hero */}
          {isOnlyWelcome && (
            <div className="py-12 sm:py-20 text-center flex flex-col items-center justify-center">
              <h2 className="text-2xl sm:text-3xl font-normal text-zinc-200 tracking-tight mb-3">
                How can I help you today?
              </h2>
              <p className="text-sm text-zinc-400 max-w-md mb-8">
                Ask questions, synthesize documents, solve technical problems, or explore live web data.
              </p>

              {/* Quick suggestion prompt pills */}
              <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendMessage(prompt)}
                    disabled={loading}
                    className={`text-xs px-3.5 py-2 transition-all text-left ${
                      theme === 'classic'
                        ? 'rounded-full border border-cyan-500/30 bg-slate-900/80 text-cyan-200 hover:text-white hover:border-cyan-400 hover:bg-cyan-950/60 shadow-sm'
                        : theme === 'fulldark'
                        ? 'rounded-2xl border border-[#2e2e2e] bg-[#1a1a1a] text-[#cfcfcf] hover:text-white hover:border-[#454545] hover:bg-[#262626]'
                        : 'rounded-full border border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-zinc-800'
                    }`}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message List */}
          {!isOnlyWelcome &&
            messages.map((message, index) => {
              const isUser = message.role === 'user';
              const hasSources = message.sources && message.sources.length > 0;
              const hasSearched = message.searchedWeb || message.tool === 'search' || hasSources;

              return (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex w-full ${
                    isUser ? 'justify-end' : 'justify-start'
                  } group`}
                >
                  <div
                    className={`flex flex-col ${
                      isUser
                        ? 'items-end max-w-[85%] sm:max-w-[75%]'
                        : 'items-start w-full max-w-full'
                    }`}
                  >
                    {/* User Message Bubble */}
                    {isUser ? (
                      <div className="flex flex-col items-end gap-1 group/user">
                        <div
                          className={`leading-relaxed break-words whitespace-pre-wrap transition-all ${
                            theme === 'classic'
                              ? 'px-4 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-950/90 to-blue-950/90 text-cyan-50 text-[14.5px] border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                              : theme === 'fulldark'
                              ? 'px-5 py-3 rounded-[24px] bg-[#212121] text-[#f4f4f5] text-[15px] border border-[#2f2f2f] shadow-none'
                              : 'px-4 py-2.5 rounded-2xl bg-[#27272a] text-zinc-100 text-[14.5px] border border-zinc-700/60'
                          }`}
                        >
                          {message.content}
                        </div>

                        {/* User Message Action Toolbar (Copy & Delete) */}
                        <div
                          className={`flex items-center gap-1.5 opacity-70 group-hover/user:opacity-100 transition-opacity text-xs ${
                            theme === 'fulldark' ? 'text-[#888]' : 'text-zinc-400'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleCopyText(message.content, index)}
                            className={`p-1 rounded-md transition-colors ${
                              theme === 'fulldark'
                                ? 'hover:text-white hover:bg-[#282828]'
                                : 'hover:text-zinc-200 hover:bg-zinc-800'
                            }`}
                            title="Copy prompt"
                            aria-label="Copy prompt"
                          >
                            {copiedIndex === index ? (
                              <Check size={12} className="text-emerald-400" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(index)}
                            className={`p-1 rounded-md transition-colors ${
                              theme === 'fulldark'
                                ? 'hover:text-red-400 hover:bg-red-500/10'
                                : 'hover:text-red-400 hover:bg-red-500/10'
                            }`}
                            title="Delete this prompt"
                            aria-label="Delete prompt"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Assistant Message */
                      <div
                        style={assistantCustomStyles}
                        className={`w-full space-y-2 transition-all ${
                          theme === 'classic'
                            ? 'bg-slate-900/50 border border-cyan-500/20 backdrop-blur-md rounded-2xl p-4 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.35)]'
                            : theme === 'fulldark'
                            ? 'py-1 text-[#ececec]'
                            : 'py-1 text-zinc-200'
                        }`}
                      >
                        {/* Web Search Indicator Tag */}
                        {hasSearched && (
                          <div className="flex items-center gap-2 pt-1 pb-0.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                theme === 'classic'
                                  ? 'bg-cyan-950/70 text-cyan-300 border-cyan-500/40'
                                  : theme === 'fulldark'
                                  ? 'bg-[#1e1e1e] text-[#cfcfcf] border-[#2e2e2e]'
                                  : 'bg-zinc-800 text-zinc-300 border-zinc-700/60'
                              }`}
                            >
                              <Search size={11} className={theme === 'classic' ? 'text-cyan-400' : theme === 'fulldark' ? 'text-neutral-400' : 'text-cyan-400'} />
                              <span>
                                {message.searchSource === 'Custom API' ? 'Searched via Custom API' : 'Searched the web'}
                              </span>
                              {hasSources && (
                                <span className={theme === 'fulldark' ? 'text-[#888] font-normal' : 'text-zinc-500 font-normal'}>
                                  ({message.sources?.length} {message.sources?.length === 1 ? 'source' : 'sources'})
                                </span>
                              )}
                              {message.searchNotice && (
                                <span className="text-[10.5px] text-amber-400 font-normal ml-0.5">
                                  ({message.searchNotice})
                                </span>
                              )}
                            </span>

                            {hasSources && (
                              <button
                                type="button"
                                onClick={() => toggleSourceExpand(index)}
                                className={`text-[11px] flex items-center gap-0.5 transition-colors ${
                                  theme === 'fulldark'
                                    ? 'text-[#8e8e8e] hover:text-[#e0e0e0]'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                              >
                                <span>{expandedSources[index] ? 'Hide sources' : 'Show sources'}</span>
                                {expandedSources[index] ? (
                                  <ChevronUp size={12} />
                                ) : (
                                  <ChevronDown size={12} />
                                )}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Architect Indicator Tag */}
                        {Boolean(message.diagramSvg || message.tool === 'architect') && (
                          <div className="flex items-center gap-2 pt-1 pb-0.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                theme === 'classic'
                                  ? 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                                  : theme === 'fulldark'
                                  ? 'bg-[#1e1e1e] text-amber-300 border-[#2e2e2e]'
                                  : 'bg-zinc-800 text-amber-300 border-zinc-700/60'
                              }`}
                            >
                              <Layers size={11} className="text-amber-400" />
                              <span>Architect Blueprint</span>
                            </span>
                          </div>
                        )}

                        {/* Data Analysis Indicator Tag */}
                        {Boolean(message.chartData || message.tool === 'dataAnalyst') && (
                          <div className="flex items-center gap-2 pt-1 pb-0.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                theme === 'classic'
                                  ? 'bg-sky-950/70 text-sky-300 border-sky-500/40'
                                  : theme === 'fulldark'
                                  ? 'bg-[#1e1e1e] text-sky-300 border-[#2e2e2e]'
                                  : 'bg-zinc-800 text-sky-300 border-zinc-700/60'
                              }`}
                            >
                              <BarChart3 size={11} className="text-sky-400" />
                              <span>Data Analysis</span>
                            </span>
                          </div>
                        )}

                        {/* Coder Indicator Tag */}
                        {message.tool === 'coder' && (
                          <div className="flex items-center gap-2 pt-1 pb-0.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                theme === 'classic'
                                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                                  : theme === 'fulldark'
                                  ? 'bg-[#1e1e1e] text-emerald-300 border-[#2e2e2e]'
                                  : 'bg-zinc-800 text-emerald-300 border-zinc-700/60'
                              }`}
                            >
                              <Code2 size={11} className="text-emerald-400" />
                              <span>Coder Online</span>
                            </span>
                          </div>
                        )}

                        {/* Wikimedia Indicator Tag */}
                        {Boolean((message.wikimediaItems && message.wikimediaItems.length > 0) || message.tool === 'wikimedia') && (
                          <div className="flex items-center gap-2 pt-1 pb-0.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                theme === 'classic'
                                  ? 'bg-violet-950/70 text-violet-300 border-violet-500/40'
                                  : theme === 'fulldark'
                                  ? 'bg-[#1e1e1e] text-violet-300 border-[#2e2e2e]'
                                  : 'bg-zinc-800 text-violet-300 border-zinc-700/60'
                              }`}
                            >
                              <ImageIcon size={11} className="text-violet-400" />
                              <span>Wikimedia Commons</span>
                            </span>
                          </div>
                        )}

                        {/* New Agent Indicator Tag */}
                        {message.tool === 'agent' && (
                          <div className="flex items-center gap-2 pt-1 pb-0.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                theme === 'classic'
                                  ? 'bg-rose-950/70 text-rose-300 border-rose-500/40'
                                  : theme === 'fulldark'
                                  ? 'bg-[#1e1e1e] text-rose-300 border-[#2e2e2e]'
                                  : 'bg-zinc-800 text-rose-300 border-zinc-700/60'
                              }`}
                            >
                              <Layers3 size={11} className="text-rose-400" />
                              <span>New Agent</span>
                            </span>
                          </div>
                        )}

                        {/* Web Fetcher Indicator Tag */}
                        {message.tool === 'webfetcher' && (
                          <div className="flex items-center gap-2 pt-1 pb-0.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                theme === 'classic'
                                  ? 'bg-teal-950/70 text-teal-300 border-teal-500/40'
                                  : theme === 'fulldark'
                                  ? 'bg-[#1e1e1e] text-teal-300 border-[#2e2e2e]'
                                  : 'bg-zinc-800 text-teal-300 border-zinc-700/60'
                              }`}
                            >
                              <Globe size={11} className="text-teal-400" />
                              <span>Web Fetcher</span>
                            </span>
                          </div>
                        )}

                        {/* Collapsible Verified Sources Panel with 10-item scrollable grid & domain trust badges */}
                        {hasSources && expandedSources[index] && (
                          <div
                            className={`my-2.5 p-2.5 rounded-xl border shadow-sm ${
                              theme === 'classic'
                                ? 'border-cyan-500/30 bg-slate-950/80'
                                : theme === 'fulldark'
                                ? 'border-[#282828] bg-[#141414]'
                                : 'border-zinc-800/80 bg-zinc-950/60'
                            }`}
                          >
                            <div
                              className={`flex items-center justify-between px-1 py-1 mb-2 border-b text-[11px] ${
                                theme === 'classic'
                                  ? 'border-cyan-500/20 text-cyan-300'
                                  : theme === 'fulldark'
                                  ? 'border-[#262626] text-[#a0a0a0]'
                                  : 'border-zinc-800/60 text-zinc-400'
                              }`}
                            >
                              <span className="font-medium flex items-center gap-1.5">
                                <Globe size={12} className={theme === 'classic' ? 'text-cyan-400' : 'text-zinc-400'} />
                                <span>Retrieved Sources ({message.sources?.length})</span>
                              </span>
                              <span className="text-[10.5px] opacity-75 hidden sm:inline">
                                Ranked by Domain Authority & Trust
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1">
                              {message.sources?.map((src, sIdx) => {
                                const isWiki =
                                  src.type === 'wikipedia' ||
                                  src.domain?.toLowerCase().includes('wikipedia');
                                const tier = src.trustTier ?? (isWiki ? 1 : 2);
                                const tierLabel =
                                  src.trustTierLabel ||
                                  (tier === 1 ? 'Official / Primary' : tier === 2 ? 'Secondary' : 'Unverified');

                                return (
                                  <a
                                    key={`${src.url}-${sIdx}`}
                                    href={src.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`p-2.5 rounded-lg border transition-all text-xs flex flex-col justify-between group/card ${
                                      theme === 'classic'
                                        ? 'border-cyan-500/20 bg-slate-900/70 hover:bg-slate-900 hover:border-cyan-500/40 text-cyan-100'
                                        : theme === 'fulldark'
                                        ? 'border-[#262626] bg-[#1c1c1c] hover:bg-[#242424] hover:border-[#383838] text-[#e0e0e0]'
                                        : 'border-zinc-800/90 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700 text-zinc-200'
                                    }`}
                                  >
                                    <div>
                                      <div className="flex items-center justify-between gap-1 mb-1.5 flex-wrap">
                                        <span className="inline-flex items-center gap-1 text-[10.5px] font-medium opacity-80 truncate max-w-[140px]">
                                          {isWiki ? (
                                            <>
                                              <BookOpen size={10} className="text-cyan-400 shrink-0" /> Wikipedia
                                            </>
                                          ) : (
                                            <>
                                              <Globe size={10} className="shrink-0" /> {src.domain || 'Web'}
                                            </>
                                          )}
                                        </span>

                                        {/* Trust Tier Badge */}
                                        <span
                                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-medium border ${
                                            tier === 1
                                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                                              : tier === 2
                                              ? 'bg-sky-950/60 text-sky-300 border-sky-700/60'
                                              : 'bg-amber-950/40 text-amber-300/90 border-amber-800/50'
                                          }`}
                                          title={src.trustTierReason || `Tier ${tier}: ${tierLabel}`}
                                        >
                                          <span
                                            className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${
                                              tier === 1
                                                ? 'bg-emerald-400'
                                                : tier === 2
                                                ? 'bg-sky-400'
                                                : 'bg-amber-400'
                                            }`}
                                          />
                                          Tier {tier} • {tierLabel}
                                        </span>
                                      </div>

                                      <p className="font-medium line-clamp-1 mb-1 group-hover/card:text-white transition-colors">
                                        {src.title}
                                      </p>
                                      {src.description && (
                                        <p className="text-[11px] opacity-75 line-clamp-2 leading-relaxed">
                                          {src.description}
                                        </p>
                                      )}
                                    </div>

                                    <div
                                      className={`mt-2 pt-1.5 border-t flex items-center justify-between text-[10px] ${
                                        theme === 'classic'
                                          ? 'border-cyan-500/20 text-cyan-300/60'
                                          : theme === 'fulldark'
                                          ? 'border-[#262626] text-[#707070]'
                                          : 'border-zinc-800/40 text-zinc-500'
                                      }`}
                                    >
                                      <span className="truncate max-w-[170px]">
                                        {src.url.replace(/^https?:\/\//, '')}
                                      </span>
                                      <ExternalLink size={11} className="shrink-0 ml-1 opacity-60 group-hover/card:opacity-100" />
                                    </div>
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Weather Data Widget (if returned) */}
                        {message.tool === 'weather' && message.weather && typeof message.weather === 'object' && (() => {
                          const weather = message.weather as {
                            current?: {
                              location?: string;
                              temperature?: number;
                              feelsLike?: number;
                              conditionLabel?: string;
                              humidity?: number;
                              rainProbability?: number;
                            };
                          };
                          const curr = weather.current;
                          if (!curr) return null;
                          return (
                            <div
                              className={`my-2 p-3 rounded-xl border text-xs flex items-center justify-between gap-4 flex-wrap ${
                                theme === 'classic'
                                  ? 'border-cyan-500/30 bg-slate-900/80 text-cyan-100'
                                  : theme === 'fulldark'
                                  ? 'border-[#262626] bg-[#1a1a1a] text-[#e0e0e0]'
                                  : 'border-zinc-800 bg-zinc-900/80 text-zinc-300'
                              }`}
                            >
                              <div>
                                <span className="font-medium text-white">
                                  {curr.location || 'Location'}
                                </span>
                                <span className="opacity-75 ml-2">
                                  {curr.conditionLabel || 'Current Weather'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span>🌡️ {curr.temperature ?? '—'}°C</span>
                                <span>💧 {curr.humidity ?? '—'}%</span>
                                <span>🌧️ {curr.rainProbability ?? '—'}%</span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Swarm Live (Parallax 20+ Agent YouTube-style Debate Feed) */}
                        {message.tool === 'swarmlive' ? (
                          message.swarmLiveStatus === 'completed' ||
                          message.swarmLiveStatus === 'aborted' ||
                          message.swarmLiveStatus === 'error' ? (
                            <SwarmLiveFeed
                              topic={message.swarmLiveTopic || message.content}
                              evidenceItems={message.swarmLiveEvidenceItems}
                              savedState={{
                                messages: message.swarmLiveMessages || [],
                                status: message.swarmLiveStatus,
                                summary: message.swarmLiveSummary,
                                errorMessage: message.swarmLiveErrorMessage,
                                evidenceItems: message.swarmLiveEvidenceItems,
                              }}
                              onClose={() => handleDeleteMessage(index)}
                            />
                          ) : (
                            <SwarmLiveFeed
                              topic={message.swarmLiveTopic || message.content}
                              evidenceItems={message.swarmLiveEvidenceItems}
                              onStateChange={(state) => {
                                setMessages((prev) =>
                                  prev.map((msg, idx) => {
                                    if (idx === index) {
                                      return {
                                        ...msg,
                                        swarmLiveMessages: state.messages,
                                        swarmLiveStatus: state.status,
                                        swarmLiveSummary: state.summary,
                                        swarmLiveErrorMessage: state.errorMessage,
                                        swarmLiveEvidenceItems: state.evidenceItems,
                                      };
                                    }
                                    return msg;
                                  }),
                                );
                              }}
                              onClose={() => handleDeleteMessage(index)}
                            />
                          )
                        ) : message.tool === 'commander' ? (
                          <CommanderLiveFeed
                            topic={message.commanderTopic || message.content}
                            config={commanderConfig}
                            savedState={message.commanderSavedState}
                            onStateChange={(state) => {
                              setMessages((prev) =>
                                prev.map((msg, idx) => {
                                  if (idx === index) {
                                    return {
                                      ...msg,
                                      commanderSavedState: state,
                                      content: state.result?.synthesis || msg.content,
                                    };
                                  }
                                  return msg;
                                }),
                              );
                            }}
                            onClose={() => handleDeleteMessage(index)}
                          />
                        ) : message.multiChatResponses && message.multiChatResponses.length > 0 ? (
                          <div className="space-y-4 pt-1">
                            {/* Simplified plain Multi-Chat Sequential Pipeline Indicator */}
                            <div className="flex items-center gap-2 text-xs text-zinc-400 pb-1 flex-wrap">
                              <span className="font-semibold text-[11px] tracking-wide uppercase text-zinc-300">
                                3-Persona Dialogue
                              </span>
                              <span className="text-zinc-600">·</span>
                              <div className="flex items-center gap-1.5 text-[11px] font-mono">
                                <span className="text-cyan-400 font-medium">NOVA 🧠</span>
                                <span className="text-zinc-600">→</span>
                                <span className="text-pink-400 font-medium">ORBIT 😎</span>
                                <span className="text-zinc-600">→</span>
                                <span className="text-purple-400 font-medium">COSMOS 🧘</span>
                              </div>
                            </div>

                            {/* Minimal Flowing Persona Responses (no boxes or borders) */}
                            {message.multiChatResponses.map((resp, pIdx) => {
                              const isRunning = resp.status === 'running';
                              const isPending = resp.status === 'pending';
                              const isFailed = resp.status === 'failed';
                              const cleanPersonaText = resp.content || resp.text || '';
                              const personaKey = `${index}_${resp.personaId}`;
                              const isAudioPlaying = personaAudioPlayingKey === personaKey;
                              const isAudioLoading = personaAudioLoadingKey === personaKey;

                              return (
                                <div
                                  key={resp.personaId || pIdx}
                                  className="space-y-1.5 pt-2 first:pt-0"
                                >
                                  {/* Simple Minimal Label: Emoji + Name */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm">{resp.icon || '🤖'}</span>
                                    <span
                                      className="text-xs font-semibold font-mono tracking-tight"
                                      style={{ color: resp.accentColor || '#06b6d4' }}
                                    >
                                      {resp.name}
                                    </span>
                                    {isRunning && (
                                      <span className="inline-flex items-center gap-1 text-[11px] text-cyan-400 font-normal">
                                        <Loader2 size={11} className="animate-spin" />
                                        <span>Synthesizing...</span>
                                      </span>
                                    )}
                                    {isPending && (
                                      <span className="text-[11px] text-zinc-500 italic font-normal">
                                        Waiting in sequence...
                                      </span>
                                    )}
                                    {isFailed && (
                                      <span className="inline-flex items-center gap-1 text-[11px] text-red-400 font-normal">
                                        <AlertTriangle size={11} />
                                        <span>Failed</span>
                                      </span>
                                    )}
                                  </div>

                                  {/* Markdown-Rendered Body matching regular messages */}
                                  {cleanPersonaText ? (
                                    <div
                                      className={`text-[15px] leading-relaxed break-words ${
                                        theme === 'classic'
                                          ? 'text-slate-100'
                                          : theme === 'fulldark'
                                          ? 'text-[#ececec] font-normal tracking-normal'
                                          : 'text-zinc-200'
                                      }`}
                                    >
                                      <FormattedText content={stripTierLabels(cleanPersonaText)} />
                                    </div>
                                  ) : isRunning ? (
                                    <div className="text-xs text-zinc-400 py-0.5 flex items-center gap-2">
                                      <Loader2 size={12} className="animate-spin text-cyan-400" />
                                      <span>Thinking...</span>
                                    </div>
                                  ) : isPending ? (
                                    <div className="text-xs text-zinc-500 italic py-0.5">
                                      Waiting for previous persona...
                                    </div>
                                  ) : isFailed ? (
                                    <div className="text-xs text-red-400 py-0.5">
                                      {resp.error || 'Failed to generate response for this persona.'}
                                    </div>
                                  ) : null}

                                  {/* Minimal Action Toolbar below response */}
                                  {resp.status === 'completed' && cleanPersonaText && (
                                    <div
                                      className={`flex items-center gap-1.5 pt-1 opacity-70 group-hover:opacity-100 transition-opacity ${
                                        theme === 'fulldark' ? 'text-[#888]' : 'text-zinc-400'
                                      }`}
                                    >
                                      {/* Universal Copy */}
                                      <button
                                        type="button"
                                        onClick={() => handleCopyText(cleanPersonaText, index * 100 + pIdx)}
                                        className={`p-1.5 rounded-md transition-colors flex items-center gap-1 text-xs ${
                                          theme === 'fulldark'
                                            ? 'hover:text-white hover:bg-[#282828]'
                                            : 'hover:text-zinc-200 hover:bg-zinc-800'
                                        }`}
                                        title={`Universal Copy ${resp.name}'s response`}
                                      >
                                        {copiedIndex === index * 100 + pIdx ? (
                                          <>
                                            <Check size={13} className="text-emerald-400" />
                                            <span className="text-[11px] text-emerald-400 font-medium">Copied</span>
                                          </>
                                        ) : (
                                          <Copy size={13} />
                                        )}
                                      </button>

                                      {/* Universal Edge TTS Voice */}
                                      <button
                                        type="button"
                                        onClick={() => handlePlayPersonaAudio(cleanPersonaText, personaKey, resp.personaId)}
                                        disabled={isAudioLoading}
                                        className={`p-1.5 rounded-md transition-colors flex items-center gap-1 text-xs ${
                                          isAudioPlaying
                                            ? 'text-cyan-400 bg-cyan-500/15'
                                            : theme === 'fulldark'
                                            ? 'hover:text-white hover:bg-[#282828]'
                                            : 'hover:text-zinc-200 hover:bg-zinc-800'
                                        }`}
                                        title={
                                          isAudioLoading
                                            ? `Synthesizing ${resp.name}'s Neural Edge TTS voice...`
                                            : isAudioPlaying
                                            ? `Stop ${resp.name}'s voice`
                                            : `Play ${resp.name}'s Neural Voice (Edge TTS)`
                                        }
                                      >
                                        {isAudioLoading ? (
                                          <Loader2 size={13} className="animate-spin text-cyan-400" />
                                        ) : isAudioPlaying ? (
                                          <Radio size={13} className="animate-pulse text-cyan-400" />
                                        ) : (
                                          <Radio size={13} />
                                        )}
                                      </button>

                                      {/* Delete Persona Response */}
                                      <button
                                        type="button"
                                        onClick={() => handleDeletePersonaResponse(index, pIdx)}
                                        className={`p-1.5 rounded-md transition-colors flex items-center gap-1 text-xs ${
                                          theme === 'fulldark'
                                            ? 'hover:text-red-400 hover:bg-red-500/10'
                                            : 'hover:text-red-400 hover:bg-red-500/10'
                                        }`}
                                        title={`Delete ${resp.name}'s answer`}
                                        aria-label="Delete answer"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          /* Markdown-Rendered Transparent Assistant Message Body */
                          <div
                            className={`text-[15px] leading-relaxed break-words pt-0.5 ${
                              theme === 'classic'
                                ? 'text-slate-100'
                                : theme === 'fulldark'
                                ? 'text-[#ececec] font-normal tracking-normal'
                                : 'text-zinc-200'
                            }`}
                          >
                            <FormattedText content={stripTierLabels(message.content.replace(/^Read page:\s+[^\n]+\n\n?/, ''))} />
                          </div>
                        )}

                        {/* Generated Image Bubble (if present) */}
                        {message.image && (
                          <AssistantImageCard
                            image={message.image}
                            theme={theme}
                            onFullscreen={(src) => setFullscreenModalImage(src)}
                            onDownload={handleDownloadImage}
                          />
                        )}

                        {/* Interactive Quantitative Chart Card */}
                        {message.chartData && (
                          <div className="my-3">
                            <JarvisChartCard
                              id={`assistant-chart-${index}`}
                              chartData={message.chartData}
                              title={messages[index - 1]?.content || 'Comparative Data Analysis'}
                            />
                          </div>
                        )}

                        {/* SVG Architectural Blueprint Diagram */}
                        {message.diagramSvg && (
                          <div className="my-3">
                            <JarvisSvgDiagram
                              id={`assistant-diagram-${index}`}
                              svgMarkup={message.diagramSvg}
                              title={messages[index - 1]?.content || 'Architectural Blueprint'}
                            />
                          </div>
                        )}

                        {/* Wikimedia Commons Real Image Gallery */}
                        {message.wikimediaItems && message.wikimediaItems.length > 0 && (
                          <div
                            className={`my-4 p-4 rounded-2xl border transition-all ${
                              theme === 'classic'
                                ? 'bg-gradient-to-b from-slate-950/90 to-violet-950/30 border-violet-500/35 shadow-[0_8px_30px_rgba(139,92,246,0.15)]'
                                : theme === 'fulldark'
                                ? 'bg-[#141414] border-[#2e2e2e]'
                                : 'bg-zinc-950/90 border-zinc-800 shadow-xl'
                            }`}
                          >
                            {/* Gallery Header */}
                            <div className="flex items-center justify-between gap-3 pb-3 mb-3.5 border-b border-white/10 flex-wrap">
                              <div className="flex items-center gap-2.5">
                                <div className="w-6 h-6 rounded-lg bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-300 shrink-0">
                                  <ImageIcon size={13} />
                                </div>
                                <div>
                                  <span className="text-xs font-bold text-zinc-100 uppercase tracking-wide">
                                    Wikimedia Commons Gallery
                                  </span>
                                  {message.wikimediaTopic && (
                                    <span className="text-[11px] text-violet-300/80 font-mono ml-2">
                                      Topic: {message.wikimediaTopic}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/40">
                                {message.wikimediaItems.length} {message.wikimediaItems.length === 1 ? 'REAL IMAGE' : 'REAL IMAGES'}
                              </span>
                            </div>

                            {/* Responsive Image Grid */}
                            <div
                              className={`grid gap-3.5 ${
                                message.wikimediaItems.length === 1
                                  ? 'grid-cols-1 max-w-lg mx-auto'
                                  : message.wikimediaItems.length === 2
                                  ? 'grid-cols-1 sm:grid-cols-2'
                                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                              }`}
                            >
                              {message.wikimediaItems.map((item, idx) => (
                                <div
                                  key={item.id || idx}
                                  className={`group rounded-xl overflow-hidden border flex flex-col transition-all duration-200 hover:scale-[1.015] ${
                                    theme === 'classic'
                                      ? 'bg-slate-900/90 border-violet-500/25 hover:border-violet-400/50'
                                      : theme === 'fulldark'
                                      ? 'bg-[#1c1c1c] border-[#2c2c2c] hover:border-[#444]'
                                      : 'bg-zinc-900/90 border-zinc-800 hover:border-zinc-700'
                                  }`}
                                >
                                  {/* Image Container with hover zoom & modal opener */}
                                  <div
                                    className="relative aspect-[4/3] w-full overflow-hidden bg-black/60 cursor-pointer"
                                    onClick={() => setFullscreenModalImage(item.mediaUrl || item.thumbnailUrl)}
                                  >
                                    <img
                                      src={item.thumbnailUrl || item.mediaUrl}
                                      alt={item.title || 'Wikimedia Commons Image'}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                                      loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-between p-2.5">
                                      <span className="text-[11px] text-white font-medium drop-shadow-md">
                                        Click to expand
                                      </span>
                                      <div className="w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center shadow-md">
                                        <Maximize2 size={12} />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Details */}
                                  <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                                    <div>
                                      <h5
                                        className="text-xs font-semibold text-zinc-200 group-hover:text-violet-200 line-clamp-2 m-0 transition-colors"
                                        title={item.title}
                                      >
                                        {item.title}
                                      </h5>
                                      {(item.author || item.license) && (
                                        <div className="flex items-center gap-1.5 flex-wrap text-[10.5px] text-zinc-400 mt-1.5 font-mono">
                                          {item.author && (
                                            <span className="truncate max-w-[140px]" title={item.author}>
                                              By {item.author.replace(/<[^>]+>/g, '').trim()}
                                            </span>
                                          )}
                                          {item.author && item.license && <span>•</span>}
                                          {item.license && (
                                            <span className="px-1.5 py-0.2 rounded bg-violet-950/70 text-violet-300 border border-violet-500/30 text-[10px]">
                                              {item.license}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {/* Direct Commons Link */}
                                    <div className="pt-2 border-t border-white/5 flex items-center justify-end">
                                      <a
                                        href={item.sourceUrl || item.mediaUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-400 hover:text-violet-300 hover:underline transition-colors shrink-0"
                                        title="Open on Wikimedia Commons"
                                      >
                                        <span>Open on Wikimedia Commons</span>
                                        <ExternalLink size={11} />
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Clear credit line under the gallery */}
                            <div className="mt-3.5 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-400">
                              <div className="flex items-center gap-1.5">
                                <ImageIcon size={13} className="text-violet-400" />
                                <span className="font-semibold text-zinc-300">Images from Wikimedia Commons</span>
                              </div>
                              <a
                                href={`https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(message.wikimediaTopic || '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1 text-[10.5px]"
                              >
                                <span>Explore more</span>
                                <ExternalLink size={10} />
                              </a>
                            </div>
                          </div>
                        )}

                        {/* Message Action Toolbar (Only for standard non-MultiChat messages; MultiChat personas have individual toolbars) */}
                        {(!message.multiChatResponses || message.multiChatResponses.length === 0) && (
                          <div
                            className={`flex items-center gap-1.5 pt-1 opacity-70 group-hover:opacity-100 transition-opacity flex-wrap ${
                              theme === 'fulldark' ? 'text-[#888]' : 'text-zinc-400'
                            }`}
                          >
                            {/* Universal Copy Button */}
                            <button
                              type="button"
                              onClick={() => handleCopyText(message.content, index)}
                              className={`p-1.5 rounded-md transition-colors flex items-center gap-1 text-xs ${
                                theme === 'fulldark'
                                  ? 'hover:text-white hover:bg-[#282828]'
                                  : 'hover:text-zinc-200 hover:bg-zinc-800'
                              }`}
                              title="Universal Copy response"
                            >
                              {copiedIndex === index ? (
                                <>
                                  <Check size={13} className="text-emerald-400" />
                                  <span className="text-[11px] text-emerald-400 font-medium">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={13} />
                                </>
                              )}
                            </button>

                            {/* Universal Edge TTS Speaker Button */}
                            <button
                              type="button"
                              onClick={() => handleEdgeTtsSpeak(message.content, index)}
                              disabled={edgeTtsLoadingIndex === index}
                              className={`p-1.5 rounded-md transition-colors flex items-center gap-1 text-xs ${
                                edgeTtsPlayingIndex === index
                                  ? 'text-purple-400 bg-purple-500/15'
                                  : theme === 'fulldark'
                                  ? 'hover:text-white hover:bg-[#282828]'
                                  : 'hover:text-zinc-200 hover:bg-zinc-800'
                              }`}
                              title={
                                edgeTtsLoadingIndex === index
                                  ? 'Synthesizing Edge TTS Neural voice...'
                                  : edgeTtsPlayingIndex === index
                                  ? 'Stop Edge TTS playback'
                                  : 'Play Neural Voice (Edge TTS)'
                              }
                            >
                              {edgeTtsLoadingIndex === index ? (
                                <Loader2 size={13} className="animate-spin text-purple-400" />
                              ) : edgeTtsPlayingIndex === index ? (
                                <Radio size={13} className="animate-pulse text-purple-400" />
                              ) : (
                                <Radio size={13} />
                              )}
                            </button>

                            {/* Browser Voice Speaker Fallback */}
                            <button
                              type="button"
                              onClick={() => toggleBrowserSpeak(message.content, index)}
                              className={`p-1.5 rounded-md transition-colors ${
                                speakingIndex === index
                                  ? 'text-cyan-400 bg-cyan-500/10'
                                  : theme === 'fulldark'
                                  ? 'hover:text-white hover:bg-[#282828]'
                                  : 'hover:text-zinc-200 hover:bg-zinc-800'
                              }`}
                              title={speakingIndex === index ? 'Stop voice' : 'Read aloud (Browser)'}
                            >
                              {speakingIndex === index ? (
                                <VolumeX size={13} />
                              ) : (
                                <Volume2 size={13} />
                              )}
                            </button>

                            {/* Delete Answer Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(index)}
                              className={`p-1.5 rounded-md transition-colors flex items-center gap-1 text-xs ${
                                theme === 'fulldark'
                                  ? 'hover:text-red-400 hover:bg-red-500/10'
                                  : 'hover:text-red-400 hover:bg-red-500/10'
                              }`}
                              title="Delete this answer"
                              aria-label="Delete answer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

          {/* Loading indicator */}
          {loading && (
            <div className="py-2.5 space-y-2">
              <div
                className={`flex items-center justify-between text-xs ${
                  deepResearchEnabled
                    ? 'text-emerald-300'
                    : newAgentEnabled
                    ? 'text-rose-300'
                    : wikimediaEnabled
                    ? 'text-violet-300'
                    : architectEnabled && dataAnalysisEnabled
                    ? 'text-amber-300'
                    : architectEnabled
                    ? 'text-amber-300'
                    : dataAnalysisEnabled
                    ? 'text-sky-300'
                    : coderEnabled
                    ? 'text-emerald-300'
                    : webFetcherEnabled
                    ? 'text-teal-300'
                    : imageGenEnabled
                    ? 'text-purple-300'
                    : theme === 'classic'
                    ? 'text-cyan-300'
                    : theme === 'fulldark'
                    ? 'text-[#a1a1a1]'
                    : 'text-zinc-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Loader2
                    size={14}
                    className={`animate-spin shrink-0 ${
                      deepResearchEnabled
                        ? 'text-emerald-400'
                        : newAgentEnabled
                        ? 'text-rose-400'
                        : wikimediaEnabled
                        ? 'text-violet-400'
                        : architectEnabled && dataAnalysisEnabled
                        ? 'text-amber-400'
                        : architectEnabled
                        ? 'text-amber-400'
                        : dataAnalysisEnabled
                        ? 'text-sky-400'
                        : coderEnabled
                        ? 'text-emerald-400'
                        : webFetcherEnabled
                        ? 'text-teal-400'
                        : imageGenEnabled
                        ? 'text-purple-400'
                        : theme === 'classic'
                        ? 'text-cyan-400'
                        : 'text-zinc-400'
                    }`}
                  />
                  <span className="font-medium">
                    {deepResearchEnabled
                      ? deepResearchPhase || 'JARVIS Deep Research in progress...'
                      : newAgentEnabled
                      ? specialistPhase || 'Dynamic Agent pipeline in progress...'
                      : wikimediaEnabled
                      ? specialistPhase || 'Fetching real images from Wikimedia Commons...'
                      : (architectEnabled || dataAnalysisEnabled || coderEnabled || webFetcherEnabled)
                      ? specialistPhase ||
                        (architectEnabled && dataAnalysisEnabled
                          ? 'Architect & Data Analysis in progress...'
                          : architectEnabled
                          ? 'Architect generating system blueprint...'
                          : coderEnabled
                          ? 'Coder generating research-grounded code...'
                          : webFetcherEnabled
                          ? 'Web Fetcher extracting webpage...'
                          : 'Data Analysis processing metrics & charts...')
                      : imageGenEnabled
                      ? imageLoadingPhase || 'Synthesizing AI image across providers...'
                      : 'NEXUS AI is thinking...'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {deepResearchEnabled && deepResearchProgress > 0 && (
                    <span className="text-[11px] font-mono font-semibold text-emerald-400 shrink-0">
                      {deepResearchProgress}%
                    </span>
                  )}
                  {(architectEnabled || dataAnalysisEnabled || coderEnabled || webFetcherEnabled || wikimediaEnabled || newAgentEnabled) && specialistProgress > 0 && (
                    <span
                      className={`text-[11px] font-mono font-semibold shrink-0 ${
                        newAgentEnabled
                          ? 'text-rose-400'
                          : wikimediaEnabled
                          ? 'text-violet-400'
                          : coderEnabled
                          ? 'text-emerald-400'
                          : webFetcherEnabled
                          ? 'text-teal-400'
                          : architectEnabled && dataAnalysisEnabled
                          ? 'text-amber-400'
                          : architectEnabled
                          ? 'text-amber-400'
                          : 'text-sky-400'
                      }`}
                    >
                      {specialistProgress}%
                    </span>
                  )}
                  {webFetcherEnabled && (
                    <button
                      type="button"
                      onClick={handleStopWebFetcher}
                      className="px-2 py-0.5 rounded border border-red-500/40 bg-red-950/40 text-red-300 hover:bg-red-900/60 hover:text-white transition-colors flex items-center gap-1 text-[11px] font-medium shrink-0"
                      title="Stop Web Fetcher"
                    >
                      <Square size={9} className="fill-current" />
                      <span>Stop</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Deep Research Progress Bar */}
              {deepResearchEnabled && (
                <div className="w-full max-w-md h-1.5 rounded-full bg-zinc-800/80 overflow-hidden border border-zinc-700/50">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 transition-all duration-300 ease-out rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    style={{ width: `${Math.max(8, Math.min(100, deepResearchProgress))}%` }}
                  />
                </div>
              )}

              {/* Specialist Modes Progress Bar */}
              {(architectEnabled || dataAnalysisEnabled || coderEnabled || webFetcherEnabled || wikimediaEnabled || newAgentEnabled) && specialistProgress > 0 && (
                <div className="w-full max-w-md h-1.5 rounded-full bg-zinc-800/80 overflow-hidden border border-zinc-700/50">
                  <div
                    className={`h-full transition-all duration-300 ease-out rounded-full ${
                      newAgentEnabled
                        ? 'bg-gradient-to-r from-rose-500 via-pink-400 to-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                        : wikimediaEnabled
                        ? 'bg-gradient-to-r from-violet-500 via-purple-400 to-fuchsia-300 shadow-[0_0_8px_rgba(139,92,246,0.5)]'
                        : coderEnabled
                        ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-green-300 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                        : webFetcherEnabled
                        ? 'bg-gradient-to-r from-teal-500 via-cyan-400 to-emerald-300 shadow-[0_0_8px_rgba(20,184,166,0.5)]'
                        : architectEnabled && dataAnalysisEnabled
                        ? 'bg-gradient-to-r from-amber-500 via-orange-400 to-sky-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                        : architectEnabled
                        ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                        : 'bg-gradient-to-r from-sky-500 via-cyan-400 to-sky-300 shadow-[0_0_8px_rgba(56,189,248,0.5)]'
                    }`}
                    style={{ width: `${Math.max(8, Math.min(100, specialistProgress))}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="my-2">
              <ErrorMessage message={error} />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar: Clean pinned container */}
        <div
          className={`sticky bottom-0 pt-4 pb-1 transition-colors ${
            theme === 'classic'
              ? 'bg-gradient-to-t from-[#060b13] via-[#060b13] to-transparent'
              : theme === 'fulldark'
              ? 'bg-gradient-to-t from-black via-black to-transparent'
              : 'bg-gradient-to-t from-[#111113] via-[#111113] to-transparent'
          }`}
        >
          {/* Quick prompts chips if conversation has few messages and user isn't typing */}
          {!isOnlyWelcome && messages.length <= 3 && !input && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2.5 no-scrollbar">
              {(deepResearchEnabled
                ? QUICK_DEEP_RESEARCH_PROMPTS
                : imageGenEnabled
                ? QUICK_IMAGE_PROMPTS
                : QUICK_PROMPTS
              ).slice(0, 3).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  disabled={loading}
                  className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                    theme === 'classic'
                      ? 'border-cyan-500/30 bg-slate-900/80 text-cyan-200 hover:text-white hover:border-cyan-400'
                      : theme === 'fulldark'
                      ? 'border-[#2e2e2e] bg-[#1a1a1a] text-[#d4d4d4] hover:text-white hover:border-[#404040]'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                  }`}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className={`transition-all ${
              theme === 'classic'
                ? 'rounded-2xl border border-cyan-500/40 bg-slate-900/85 backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.15)] focus-within:border-cyan-400 p-2.5 flex flex-col gap-2'
                : theme === 'fulldark'
                ? 'rounded-[28px] border border-[#303030] bg-[#212121] shadow-none focus-within:border-[#525252] p-3 flex flex-col gap-2'
                : 'rounded-2xl border border-zinc-700/70 bg-[#1e1e21] shadow-lg focus-within:border-zinc-500 p-2.5 flex flex-col gap-2'
            }`}
          >
            {/* Input Textarea & Top-Right More Options Button */}
            <div className="relative flex items-start">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={
                  deepResearchEnabled
                    ? 'Ask a deep research question (JARVIS Multi-Agent will investigate)...'
                    : imageGenEnabled
                    ? 'Describe the image you want to generate...'
                    : 'Ask NEXUS AI anything...'
                }
                aria-label={
                  deepResearchEnabled
                    ? 'Ask a deep research question'
                    : imageGenEnabled
                    ? 'Describe image prompt'
                    : 'Message NEXUS AI'
                }
                rows={1}
                disabled={loading}
                className={`w-full bg-transparent text-[14.5px] leading-relaxed resize-none outline-none px-2 pt-1 pb-1 ${
                  activeSpecialistMode ? 'pr-36 sm:pr-40' : 'pr-11'
                } min-h-[44px] max-h-[180px] ${
                  theme === 'classic'
                    ? 'text-white placeholder-cyan-300/40'
                    : theme === 'fulldark'
                    ? 'text-[#ececec] placeholder-[#737373]'
                    : 'text-zinc-100 placeholder-zinc-500'
                }`}
              />

              {/* Expandable More Options (▲) Button & Popup in Top-Right with Active Mode Chip */}
              <div ref={moreOptionsRef} className="absolute right-1 top-1 z-20 flex items-center gap-1.5">
                {/* Active Mode Indicator Chip (shows currently active mode; one-tap to dismiss) */}
                {activeSpecialistMode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      activeSpecialistMode.toggle();
                    }}
                    title={`Turn off ${activeSpecialistMode.name} (click to disable)`}
                    aria-label={`Turn off ${activeSpecialistMode.name}`}
                    className={`group inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium border transition-all cursor-pointer active:scale-95 animate-in fade-in zoom-in-95 duration-150 ${activeSpecialistMode.color}`}
                  >
                    <span className="leading-none whitespace-nowrap select-none">{activeSpecialistMode.name}</span>
                    <X
                      size={11}
                      className="opacity-65 group-hover:opacity-100 group-hover:scale-110 transition-all shrink-0 ml-0.5"
                    />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setMoreOptionsOpen((prev) => !prev)}
                  className={`text-xs p-1.5 rounded-lg border transition-all flex items-center justify-center gap-1 ${
                    moreOptionsOpen || architectEnabled || dataAnalysisEnabled || multiChatEnabled || coderEnabled || webFetcherEnabled || wikimediaEnabled || newAgentEnabled || swarmLiveEnabled || commanderEnabled
                      ? theme === 'classic'
                        ? 'bg-cyan-500/15 text-cyan-200 border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                        : theme === 'fulldark'
                        ? 'bg-[#2a2a2a] text-[#ececec] border-[#444]'
                        : 'bg-zinc-800 text-zinc-200 border-zinc-700 shadow-sm'
                      : theme === 'classic'
                      ? 'text-cyan-300/70 border-transparent hover:text-cyan-200 hover:bg-cyan-950/40'
                      : theme === 'fulldark'
                      ? 'text-[#a1a1aa] border-transparent hover:text-[#ececec] hover:bg-[#2a2a2a]'
                      : 'text-zinc-400 border-transparent hover:text-zinc-300 hover:bg-zinc-800/60'
                  }`}
                  title={
                    moreOptionsOpen
                      ? 'Close quick modes menu'
                      : 'Specialist Modes (mutually exclusive): Architect, Data Analysis, Multi Chat, Coder, Web Fetcher, Wikimedia, New Agent, Swarm Live, Commander'
                  }
                  aria-label="More options"
                  aria-expanded={moreOptionsOpen}
                >
                  <ChevronUp
                    size={14}
                    className={`transition-transform duration-200 ${
                      moreOptionsOpen ? 'rotate-180 text-cyan-400' : ''
                    }`}
                  />
                  {(architectEnabled || dataAnalysisEnabled || multiChatEnabled || coderEnabled || webFetcherEnabled || wikimediaEnabled || newAgentEnabled || swarmLiveEnabled || commanderEnabled) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
                  )}
                </button>

                {/* Popup Menu */}
                {moreOptionsOpen && (
                  <div
                    className={`absolute bottom-full mb-3 right-0 w-64 sm:w-[268px] p-2 rounded-2xl border shadow-2xl backdrop-blur-xl z-50 flex flex-col max-h-[220px] overflow-hidden ${
                      theme === 'classic'
                        ? 'bg-slate-900/95 border-cyan-500/40 shadow-[0_8px_30px_rgba(6,182,212,0.25)]'
                        : theme === 'fulldark'
                        ? 'bg-[#1a1a1a] border-[#333] shadow-2xl'
                        : 'bg-zinc-900/95 border-zinc-700/80 shadow-2xl'
                    }`}
                  >
                    {/* Fixed Header */}
                    <div className="shrink-0 px-2 py-1 flex items-center justify-between border-b border-zinc-800/80 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                          Specialist Modes
                        </span>
                        <span className="text-[9.5px] text-zinc-500 font-mono">
                          (1 active)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMoreOptionsOpen(false);
                          setSettingsOpen(true);
                        }}
                        className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1"
                      >
                        <SettingsIcon size={10} />
                        <span>Settings</span>
                      </button>
                    </div>

                    {/* Internal Scrollable Specialist Items List */}
                    <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1 specialist-popup-scroll">
                      {/* 1. Architect Toggle */}
                    <button
                      type="button"
                      onClick={toggleArchitect}
                      className={`w-full p-2 rounded-xl border text-left flex items-center justify-between transition-all ${
                        architectEnabled
                          ? 'border-amber-500/40 bg-amber-950/30 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                          : 'border-transparent hover:bg-zinc-800/60 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${
                            architectEnabled
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          <Layers size={13} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                            <span>Architect</span>
                            {architectEnabled && (
                              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-amber-950 text-amber-400 border border-amber-500/40">
                                ON
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-zinc-400 truncate">
                            SVG Diagrams &amp; Blueprints
                          </div>
                        </div>
                      </div>
                      <div
                        className={`w-8 h-4 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                          architectEnabled ? 'bg-amber-500' : 'bg-zinc-700'
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                            architectEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </button>

                    {/* 2. Data Analysis Toggle */}
                    <button
                      type="button"
                      onClick={toggleDataAnalysis}
                      className={`w-full p-2 rounded-xl border text-left flex items-center justify-between transition-all ${
                        dataAnalysisEnabled
                          ? 'border-sky-500/40 bg-sky-950/30 text-sky-200 shadow-[0_0_10px_rgba(56,189,248,0.1)]'
                          : 'border-transparent hover:bg-zinc-800/60 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${
                            dataAnalysisEnabled
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          <BarChart3 size={13} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                            <span>Data Analysis</span>
                            {dataAnalysisEnabled && (
                              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-sky-950 text-sky-400 border border-sky-500/40">
                                ON
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-zinc-400 truncate">
                            Charts &amp; Visual Metrics
                          </div>
                        </div>
                      </div>
                      <div
                        className={`w-8 h-4 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                          dataAnalysisEnabled ? 'bg-sky-500' : 'bg-zinc-700'
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                            dataAnalysisEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </button>

                    {/* 3. Multi Chat Toggle */}
                    <button
                      type="button"
                      onClick={toggleMultiChat}
                      className={`w-full p-2 rounded-xl border text-left flex items-center justify-between transition-all ${
                        multiChatEnabled
                          ? 'border-cyan-500/40 bg-cyan-950/30 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.1)]'
                          : 'border-transparent hover:bg-zinc-800/60 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${
                            multiChatEnabled
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          <MessagesSquare size={13} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                            <span>Multi Chat</span>
                            {multiChatEnabled && (
                              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/40">
                                ON
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-zinc-400 truncate">
                            3-Persona Sequential Panel
                          </div>
                        </div>
                      </div>
                      <div
                        className={`w-8 h-4 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                          multiChatEnabled ? 'bg-cyan-500' : 'bg-zinc-700'
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                            multiChatEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </button>

                    {/* 4. Coder Toggle */}
                    <button
                      type="button"
                      onClick={toggleCoder}
                      className={`w-full p-2 rounded-xl border text-left flex items-center justify-between transition-all ${
                        coderEnabled
                          ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                          : 'border-transparent hover:bg-zinc-800/60 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${
                            coderEnabled
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          <Code2 size={13} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                            <span>Coder</span>
                            {coderEnabled && (
                              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                                ON
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-zinc-400 truncate">
                            Research-grounded code
                          </div>
                        </div>
                      </div>
                      <div
                        className={`w-8 h-4 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                          coderEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                            coderEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </button>

                    {/* 5. Web Fetcher Toggle */}
                    <button
                      type="button"
                      onClick={toggleWebFetcher}
                      className={`w-full p-2 rounded-xl border text-left flex items-center justify-between transition-all ${
                        webFetcherEnabled
                          ? 'border-teal-500/40 bg-teal-950/30 text-teal-200 shadow-[0_0_10px_rgba(20,184,166,0.1)]'
                          : 'border-transparent hover:bg-zinc-800/60 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${
                            webFetcherEnabled
                              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          <Globe size={13} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                            <span>Web Fetcher</span>
                            {webFetcherEnabled && (
                              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-teal-950 text-teal-400 border border-teal-500/40">
                                ON
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-zinc-400 truncate">
                            Read any webpage URL
                          </div>
                        </div>
                      </div>
                      <div
                        className={`w-8 h-4 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                          webFetcherEnabled ? 'bg-teal-500' : 'bg-zinc-700'
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                            webFetcherEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </button>

                    {/* 6. Wikimedia Toggle */}
                    <button
                      type="button"
                      onClick={toggleWikimedia}
                      className={`w-full p-2 rounded-xl border text-left flex items-center justify-between transition-all ${
                        wikimediaEnabled
                          ? 'border-violet-500/40 bg-violet-950/30 text-violet-200 shadow-[0_0_10px_rgba(139,92,246,0.15)]'
                          : 'border-transparent hover:bg-zinc-800/60 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${
                            wikimediaEnabled
                              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          <ImageIcon size={13} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                            <span>Wikimedia</span>
                            {wikimediaEnabled && (
                              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-violet-950 text-violet-400 border border-violet-500/40">
                                ON
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-zinc-400 truncate">
                            5 real images from Wikimedia
                          </div>
                        </div>
                      </div>
                      <div
                        className={`w-8 h-4 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                          wikimediaEnabled ? 'bg-violet-500' : 'bg-zinc-700'
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                            wikimediaEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </button>

                    {/* 7. New Agent Toggle */}
                    <button
                      type="button"
                      onClick={toggleNewAgent}
                      className={`w-full p-2 rounded-xl border text-left flex items-center justify-between transition-all ${
                        newAgentEnabled
                          ? 'border-rose-500/40 bg-rose-950/30 text-rose-200 shadow-[0_0_10px_rgba(244,63,94,0.15)]'
                          : 'border-transparent hover:bg-zinc-800/60 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${
                            newAgentEnabled
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          <Layers3 size={13} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                            <span>New Agent</span>
                            {newAgentEnabled && (
                              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-rose-950 text-rose-400 border border-rose-500/40">
                                ON
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-zinc-400 truncate">
                            Dynamic 3-specialist pipeline
                          </div>
                        </div>
                      </div>
                      <div
                        className={`w-8 h-4 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                          newAgentEnabled ? 'bg-rose-500' : 'bg-zinc-700'
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                            newAgentEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </button>

                    {/* 8. Swarm Live Toggle */}
                    <button
                      type="button"
                      onClick={toggleSwarmLive}
                      className={`w-full p-2 rounded-xl border text-left flex items-center justify-between transition-all ${
                        swarmLiveEnabled
                          ? 'border-red-500/40 bg-red-950/30 text-red-200 shadow-[0_0_10px_rgba(239,68,68,0.15)]'
                          : 'border-transparent hover:bg-zinc-800/60 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${
                            swarmLiveEnabled
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          <Radio size={13} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                            <span>Swarm Live</span>
                            {swarmLiveEnabled && (
                              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-red-950 text-red-400 border border-red-500/40">
                                ON
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-zinc-400 truncate">
                            20+ Agent Live Debate Feed
                          </div>
                        </div>
                      </div>
                      <div
                        className={`w-8 h-4 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                          swarmLiveEnabled ? 'bg-red-500' : 'bg-zinc-700'
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                            swarmLiveEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </button>

                    {/* 9. Commander Toggle */}
                    <button
                      type="button"
                      onClick={toggleCommander}
                      className={`w-full p-2 rounded-xl border text-left flex items-center justify-between transition-all ${
                        commanderEnabled
                          ? 'border-indigo-500/40 bg-indigo-950/30 text-indigo-200 shadow-[0_0_10px_rgba(99,102,241,0.15)]'
                          : 'border-transparent hover:bg-zinc-800/60 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${
                            commanderEnabled
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          <Shield size={13} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                            <span>Commander</span>
                            {commanderEnabled && (
                              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                                ON
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-zinc-400 truncate">
                            3-Agent Tactical Pipeline
                          </div>
                        </div>
                      </div>
                      <div
                        className={`w-8 h-4 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                          commanderEnabled ? 'bg-indigo-500' : 'bg-zinc-700'
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                            commanderEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* One-time Hint Banner for AI Image Enhance */}
            {showImageEnhanceTip && (
              <div className="flex items-center justify-between gap-2 px-2.5 py-1 text-[11px] rounded-xl bg-purple-950/80 text-purple-200 border border-purple-500/30 mb-1 shadow-sm animate-in fade-in slide-in-from-bottom-1">
                <div className="flex items-center gap-1.5 truncate">
                  <Sparkles size={12} className="text-amber-400 shrink-0 animate-pulse" />
                  <span className="truncate">Tip: hold the Image button to enhance your prompt with AI</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowImageEnhanceTip(false);
                    storage.setAssistantImageEnhanceTipDismissed(true);
                  }}
                  className="text-purple-300/70 hover:text-purple-100 p-0.5 rounded shrink-0 transition-colors"
                  title="Dismiss tip"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Bottom Controls inside input box */}
            <div
              className={`flex items-center justify-between pt-1 border-t gap-1.5 min-w-0 ${
                theme === 'classic'
                  ? 'border-cyan-500/20'
                  : theme === 'fulldark'
                  ? 'border-[#2e2e2e]'
                  : 'border-zinc-800/60'
              }`}
            >
              {/* Deep Research Toggle, Web Search Toggle, Image Toggle & Language tag */}
              <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar min-w-0 flex-1 py-0.5">
                {/* Deep Research Toggle */}
                <button
                  type="button"
                  onClick={toggleDeepResearch}
                  className={`text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border transition-all flex items-center gap-1 sm:gap-1.5 shrink-0 ${
                    deepResearchEnabled
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 font-medium shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                      : theme === 'classic'
                      ? 'text-cyan-300/70 border-transparent hover:text-cyan-200 hover:bg-cyan-950/40'
                      : theme === 'fulldark'
                      ? 'text-[#a1a1aa] border-transparent hover:text-[#ececec] hover:bg-[#2a2a2a]'
                      : 'text-zinc-400 border-transparent hover:text-zinc-300 hover:bg-zinc-800/60'
                  }`}
                  title={
                    deepResearchEnabled
                      ? 'Deep Research is ON: routes queries through JARVIS multi-agent research pipeline (Planner → Researcher → Fact Checker → Advisor → Reviewer → Synthesizer)'
                      : 'Deep Research is OFF: standard assistant responses'
                  }
                >
                  <FlaskConical
                    size={12}
                    className={deepResearchEnabled ? 'text-emerald-400' : 'text-zinc-400'}
                  />
                  <span>Deep Research</span>
                  {deepResearchEnabled && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                  )}
                </button>

                {/* Web Search Toggle */}
                <button
                  type="button"
                  onClick={toggleWebSearch}
                  disabled={deepResearchEnabled || architectEnabled || dataAnalysisEnabled}
                  className={`text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border transition-all flex items-center gap-1 sm:gap-1.5 shrink-0 ${
                    deepResearchEnabled || architectEnabled || dataAnalysisEnabled
                      ? 'opacity-35 cursor-not-allowed border-transparent text-zinc-500 pointer-events-none'
                      : webSearchEnabled
                      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                      : theme === 'classic'
                      ? 'text-cyan-300/70 border-transparent hover:text-cyan-200 hover:bg-cyan-950/40'
                      : theme === 'fulldark'
                      ? 'text-[#a1a1aa] border-transparent hover:text-[#ececec] hover:bg-[#2a2a2a]'
                      : 'text-zinc-400 border-transparent hover:text-zinc-300 hover:bg-zinc-800/60'
                  }`}
                  title={
                    deepResearchEnabled
                      ? 'Disabled while Deep Research is ON (JARVIS pipeline includes multi-agent search internally)'
                      : architectEnabled
                      ? 'Disabled while Architect is ON (Specialist diagram agent active without automatic search)'
                      : dataAnalysisEnabled
                      ? 'Disabled while Data Analysis is ON (Specialist data agent active without automatic search)'
                      : webSearchEnabled
                      ? 'Web Search is ON: forces live search on every request'
                      : 'Web Search is Auto: searches when needed'
                  }
                >
                  <Globe
                    size={12}
                    className={
                      !deepResearchEnabled && !architectEnabled && !dataAnalysisEnabled && webSearchEnabled
                        ? 'text-cyan-400'
                        : 'text-zinc-400'
                    }
                  />
                  <span>Web Search</span>
                  {!deepResearchEnabled && !architectEnabled && !dataAnalysisEnabled && webSearchEnabled && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  )}
                </button>

                {/* Image Generation Toggle (Tap to toggle / Hold to AI Enhance) */}
                <button
                  type="button"
                  onClick={handleImageClick}
                  onPointerDown={handleImagePointerDown}
                  onPointerUp={cancelImagePointer}
                  onPointerLeave={cancelImagePointer}
                  onPointerCancel={cancelImagePointer}
                  onContextMenu={(e) => e.preventDefault()}
                  disabled={deepResearchEnabled}
                  style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
                  className={`text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border transition-all flex items-center gap-1 sm:gap-1.5 shrink-0 select-none ${
                    deepResearchEnabled
                      ? 'opacity-35 cursor-not-allowed border-transparent text-zinc-500 pointer-events-none'
                      : imageGenEnabled
                      ? 'bg-purple-500/15 text-purple-300 border-purple-500/40 font-medium shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                      : theme === 'classic'
                      ? 'text-cyan-300/70 border-transparent hover:text-cyan-200 hover:bg-cyan-950/40'
                      : theme === 'fulldark'
                      ? 'text-[#a1a1aa] border-transparent hover:text-[#ececec] hover:bg-[#2a2a2a]'
                      : 'text-zinc-400 border-transparent hover:text-zinc-300 hover:bg-zinc-800/60'
                  }`}
                  title="Tap: use my exact prompt. Hold: Smart AI Enhance."
                >
                  <ImageIcon
                    size={12}
                    className={!deepResearchEnabled && imageGenEnabled ? 'text-purple-400' : 'text-zinc-400'}
                  />
                  <span>Image</span>
                  {!deepResearchEnabled && imageGenEnabled && imageEnhanceEnabled && (
                    <Sparkles size={11} className="text-amber-400 animate-pulse shrink-0" />
                  )}
                  {!deepResearchEnabled && imageGenEnabled && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        imageEnhanceEnabled
                          ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]'
                          : 'bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.8)]'
                      }`}
                    />
                  )}
                </button>

                {responseLanguage && (
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-zinc-800/80 text-zinc-300 border border-zinc-700/60 hover:border-zinc-600 transition-colors flex items-center gap-1 shrink-0"
                    title={`Response language set to ${responseLanguage}. Click to change in Settings.`}
                  >
                    <Languages size={11} className="text-cyan-400" />
                    <span>{responseLanguage}</span>
                  </button>
                )}
              </div>

              {/* Right: Send Button */}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    input.trim() && !loading
                      ? theme === 'classic'
                        ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)] cursor-pointer'
                        : theme === 'fulldark'
                        ? 'bg-white text-black hover:bg-neutral-200 cursor-pointer'
                        : deepResearchEnabled
                        ? 'bg-emerald-500 text-white hover:bg-emerald-400 cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                        : imageGenEnabled
                        ? 'bg-purple-500 text-white hover:bg-purple-400 cursor-pointer'
                        : 'bg-zinc-100 text-zinc-900 hover:bg-white cursor-pointer'
                      : theme === 'classic'
                      ? 'bg-cyan-950/40 text-cyan-700 cursor-not-allowed opacity-50 border border-cyan-500/10'
                      : theme === 'fulldark'
                      ? 'bg-[#333333] text-[#737373] cursor-not-allowed opacity-50'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
                  }`}
                  aria-label="Send message"
                >
                  <Send size={14} className="translate-x-px" />
                </button>
              </div>
            </div>
          </form>

          {/* Subtext info */}
          <div className="text-center pt-2 pb-0.5 text-[11px] text-zinc-500 flex items-center justify-center gap-2 flex-wrap">
            <span>NEXUS AI</span>
            <span>·</span>
            <span>{multiChatEnabled ? 'Multi Chat (3-Persona Pipeline)' : deepResearchEnabled ? 'Deep Research (JARVIS Multi-Agent)' : imageGenEnabled ? 'Image Generation Mode Active' : webSearchEnabled ? 'Live Web Search Active' : 'Automatic Web Search'}</span>
            <span>·</span>
            <span>Theme: {theme === 'classic' ? 'NEXUS Classic' : theme === 'fulldark' ? 'Full Dark' : 'NEXUS Minimal'}</span>
            {responseLanguage && (
              <>
                <span>·</span>
                <span className="text-cyan-400/90">Language: {responseLanguage}</span>
              </>
            )}
            {permanentMemories.length > 0 && (
              <>
                <span>·</span>
                <span>{permanentMemories.length} Permanent {permanentMemories.length === 1 ? 'Memory' : 'Memories'}</span>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Settings Modal (Language, Permanent Memories, Theme, Modes) */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-700/80 bg-[#161618] text-zinc-200 shadow-2xl flex flex-col max-h-[90vh] my-auto overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-start justify-between p-4 sm:p-6 pb-3 sm:pb-4 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-zinc-200">
                  <SettingsIcon size={18} className="text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-100">
                    AI Assistant Settings
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Customize visual theme, language, permanent memories, and specialist modes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                title="Close settings"
              >
                <X size={18} />
              </button>
            </div>

            {/* Toast feedback inside modal if active */}
            {settingsSavedToast && (
              <div className="mx-4 sm:mx-6 mt-3 px-3.5 py-2 rounded-lg bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-xs flex items-center gap-2 shrink-0">
                <Check size={14} className="text-emerald-400 shrink-0" />
                <span>{settingsSavedToast}</span>
              </div>
            )}

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 specialist-popup-scroll">
              {/* Section 1: Visual Theme Selector */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Palette size={15} className="text-purple-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  Visual Theme
                </h4>
              </div>
              <p className="text-xs text-zinc-400">
                Select your preferred visual aesthetic for the NEXUS AI Assistant.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {/* Theme 1: NEXUS Minimal (Claude style) */}
                <button
                  type="button"
                  onClick={() => handleThemeChange('minimal')}
                  className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between group ${
                    theme === 'minimal'
                      ? 'border-zinc-400 bg-zinc-800/90 shadow-md ring-1 ring-zinc-400/40'
                      : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-xs text-zinc-100">
                        NEXUS Minimal
                      </span>
                      {theme === 'minimal' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-700/50">
                          <Check size={10} /> Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
                      Claude-inspired neutral dark aesthetic with refined spacing and clean sans-serif typography.
                    </p>
                  </div>
                  {/* Visual preview swatch */}
                  <div className="h-6 w-full rounded-md bg-[#111113] border border-zinc-700/60 p-1 flex items-center gap-1">
                    <div className="h-full w-1/3 rounded bg-[#26262a]" />
                    <div className="h-full w-2/3 rounded bg-[#1e1e21]" />
                  </div>
                </button>

                {/* Theme 2: NEXUS Classic (Glassmorphic Space) */}
                <button
                  type="button"
                  onClick={() => handleThemeChange('classic')}
                  className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between group ${
                    theme === 'classic'
                      ? 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_15px_rgba(6,182,212,0.2)] ring-1 ring-cyan-400/40'
                      : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-xs text-cyan-200">
                        NEXUS Classic
                      </span>
                      {theme === 'classic' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-300 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-500/50">
                          <Check size={10} /> Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
                      Glassmorphic cosmic dark space theme with glowing cyan accents and deep stellar background.
                    </p>
                  </div>
                  {/* Visual preview swatch */}
                  <div className="h-6 w-full rounded-md bg-[#060b13] border border-cyan-500/30 p-1 flex items-center gap-1">
                    <div className="h-full w-1/3 rounded bg-cyan-900/60 border border-cyan-500/30" />
                    <div className="h-full w-2/3 rounded bg-slate-900/80 border border-cyan-500/20" />
                  </div>
                </button>

                {/* Theme 3: Full Dark (ChatGPT style) */}
                <button
                  type="button"
                  onClick={() => handleThemeChange('fulldark')}
                  className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between group ${
                    theme === 'fulldark'
                      ? 'border-zinc-400 bg-[#212121] shadow-md ring-1 ring-zinc-400/40'
                      : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-xs text-[#ececec]">
                        Full Dark
                      </span>
                      {theme === 'fulldark' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-700/50">
                          <Check size={10} /> Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
                      ChatGPT-style high-contrast pure dark mode with deep black backdrop and flat clean stream.
                    </p>
                  </div>
                  {/* Visual preview swatch */}
                  <div className="h-6 w-full rounded-md bg-[#0d0d0d] border border-[#2f2f2f] p-1 flex items-center gap-1">
                    <div className="h-full w-1/3 rounded bg-[#212121]" />
                    <div className="h-full w-2/3 rounded bg-[#2f2f2f]" />
                  </div>
                </button>
              </div>
            </div>

            <div className="h-px bg-zinc-800" />

            {/* Section 1.5: Chat Appearance (Answers Only) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Palette size={15} className="text-cyan-400" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    Chat Appearance
                  </h4>
                </div>
                {(answerTitleColor || answerBoxColor || answerLinkColor) ? (
                  <button
                    type="button"
                    onClick={handleResetAppearance}
                    className="text-[11px] px-2 py-0.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={11} /> Reset to theme default
                  </button>
                ) : (
                  <span className="text-[11px] text-zinc-500">
                    Theme Defaults
                  </span>
                )}
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">
                Fine-tune colors strictly for AI Assistant answer titles, inner code/info boxes, and clickable links. Chat message backgrounds and the main theme remain unchanged.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Answer title color */}
                <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200">Answer title color</label>
                    {answerTitleColor && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/50">Custom</span>
                    )}
                  </div>
                  <p className="text-[10.5px] text-zinc-400 leading-normal">
                    Headings/titles inside AI answers (e.g. ### Overview).
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-zinc-700 shrink-0 shadow-inner flex items-center justify-center">
                      <input
                        type="color"
                        value={isValidHexColor(titleColorInput) ? (titleColorInput.length === 4 ? `#${titleColorInput[1]}${titleColorInput[1]}${titleColorInput[2]}${titleColorInput[2]}${titleColorInput[3]}${titleColorInput[3]}` : titleColorInput) : getThemeDefaultTitleColor()}
                        onChange={(e) => handleTitleColorChange(e.target.value)}
                        className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 cursor-pointer opacity-100 border-0 p-0 m-0"
                        title="Pick answer title color"
                      />
                    </div>
                    <input
                      type="text"
                      value={titleColorInput}
                      onChange={(e) => handleTitleColorChange(e.target.value)}
                      placeholder={getThemeDefaultTitleColor()}
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-zinc-700/70 bg-zinc-950 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  {titleColorError && (
                    <p className="text-[10px] text-rose-400 mt-1">{titleColorError}</p>
                  )}
                </div>

                {/* 2. Answer box color */}
                <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200">Answer box color</label>
                    {answerBoxColor && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/50">Custom</span>
                    )}
                  </div>
                  <p className="text-[10.5px] text-zinc-400 leading-normal">
                    Inner background of code blocks and blueprint cards.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-zinc-700 shrink-0 shadow-inner flex items-center justify-center">
                      <input
                        type="color"
                        value={isValidHexColor(boxColorInput) ? (boxColorInput.length === 4 ? `#${boxColorInput[1]}${boxColorInput[1]}${boxColorInput[2]}${boxColorInput[2]}${boxColorInput[3]}${boxColorInput[3]}` : boxColorInput) : getThemeDefaultBoxColor()}
                        onChange={(e) => handleBoxColorChange(e.target.value)}
                        className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 cursor-pointer opacity-100 border-0 p-0 m-0"
                        title="Pick answer box color"
                      />
                    </div>
                    <input
                      type="text"
                      value={boxColorInput}
                      onChange={(e) => handleBoxColorChange(e.target.value)}
                      placeholder={getThemeDefaultBoxColor()}
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-zinc-700/70 bg-zinc-950 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  {boxColorError && (
                    <p className="text-[10px] text-rose-400 mt-1">{boxColorError}</p>
                  )}
                </div>

                {/* 3. Link/URL color */}
                <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200">Link/URL color</label>
                    {answerLinkColor && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/50">Custom</span>
                    )}
                  </div>
                  <p className="text-[10.5px] text-zinc-400 leading-normal">
                    Clickable links and citation URLs inside AI answers.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-zinc-700 shrink-0 shadow-inner flex items-center justify-center">
                      <input
                        type="color"
                        value={isValidHexColor(linkColorInput) ? (linkColorInput.length === 4 ? `#${linkColorInput[1]}${linkColorInput[1]}${linkColorInput[2]}${linkColorInput[2]}${linkColorInput[3]}${linkColorInput[3]}` : linkColorInput) : getThemeDefaultLinkColor()}
                        onChange={(e) => handleLinkColorChange(e.target.value)}
                        className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 cursor-pointer opacity-100 border-0 p-0 m-0"
                        title="Pick link color"
                      />
                    </div>
                    <input
                      type="text"
                      value={linkColorInput}
                      onChange={(e) => handleLinkColorChange(e.target.value)}
                      placeholder={getThemeDefaultLinkColor()}
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-zinc-700/70 bg-zinc-950 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  {linkColorError && (
                    <p className="text-[10px] text-rose-400 mt-1">{linkColorError}</p>
                  )}
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="p-3.5 rounded-xl border border-zinc-800/90 bg-zinc-950/70 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <span className="font-semibold uppercase tracking-wider text-zinc-400">Live Preview</span>
                  <span className="text-zinc-500">Inside AI Answer</span>
                </div>

                <div className="p-3 rounded-lg border border-zinc-800 space-y-2">
                  {/* Sample heading */}
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <h4
                      className="text-xs sm:text-sm font-bold m-0 tracking-wide transition-colors"
                      style={{ color: answerTitleColor || getThemeDefaultTitleColor() }}
                    >
                      ### Overview of Quantum Computing Breakthroughs
                    </h4>
                  </div>

                  {/* Sample inner code / info box */}
                  <div
                    className="p-2.5 rounded-lg border border-cyan-500/20 text-xs font-mono transition-colors"
                    style={{ backgroundColor: answerBoxColor || getThemeDefaultBoxColor() }}
                  >
                    <div className="text-[11px] text-cyan-300 font-semibold mb-1">
                      // Quantum State Teleportation Algorithm
                    </div>
                    <span className="text-zinc-300">const qubit = new QuantumRegister(2);</span>
                  </div>

                  {/* Sample clickable link */}
                  <div className="text-xs pt-0.5">
                    <span className="text-zinc-400">Documentation &amp; source citations: </span>
                    <a
                      href="#preview"
                      onClick={(e) => e.preventDefault()}
                      className="font-medium underline transition-colors"
                      style={{ color: answerLinkColor || getThemeDefaultLinkColor() }}
                    >
                      https://quantum-research.org/v2/docs
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-px bg-zinc-800" />

            {/* Section 2: Language Setting */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Languages size={15} className="text-cyan-400" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    Response Language
                  </h4>
                </div>
                {responseLanguage ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-700/50 flex items-center gap-1">
                    <Check size={11} /> {responseLanguage}
                  </span>
                ) : (
                  <span className="text-[11px] text-zinc-500">
                    English (Default)
                  </span>
                )}
              </div>

              <p className="text-xs text-zinc-400">
                Type any language name in plain words (e.g. <span className="text-zinc-200">Russian</span>, <span className="text-zinc-200">Russia</span>, <span className="text-zinc-200">Japanese</span>, <span className="text-zinc-200">Hindi</span>, <span className="text-zinc-200">Tamil</span>, <span className="text-zinc-200">Spanish</span>, <span className="text-zinc-200">German</span>). NEXUS AI interprets flexibly and will answer in your specified language.
              </p>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={responseLanguage}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    placeholder="e.g. Russian, Japanese, Hindi, Tamil, Spanish, German, French..."
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-900/90 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-500"
                  />
                  {responseLanguage && (
                    <button
                      type="button"
                      onClick={() => handleLanguageChange('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-0.5"
                      title="Clear field"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleResetToEnglish}
                  disabled={!responseLanguage}
                  className={`text-xs px-3 py-2 rounded-xl border flex items-center gap-1.5 transition-all shrink-0 ${
                    responseLanguage
                      ? 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                      : 'border-zinc-800 bg-zinc-900/40 text-zinc-600 cursor-not-allowed opacity-60'
                  }`}
                  title="Reset language back to English (Default)"
                >
                  <RotateCcw size={12} />
                  <span>Reset to English</span>
                </button>
              </div>

              <p className="text-[11px] text-zinc-500 italic">
                Tip: Country names like &quot;Russia&quot; or &quot;Japan&quot; will be automatically inferred as Russian and Japanese.
              </p>
            </div>

            <div className="h-px bg-zinc-800" />

            {/* Section 3: Permanent Memories */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bookmark size={15} className="text-amber-400" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    Permanent Memories
                  </h4>
                </div>
                <span className="text-[11px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-700/60">
                  {permanentMemories.length} {permanentMemories.length === 1 ? 'standing memory' : 'standing memories'}
                </span>
              </div>

              <p className="text-xs text-zinc-400">
                Standing facts, preferences, and personal context that are permanently injected into every AI Assistant turn (shared with Multi Chat).
              </p>

              {/* Add New Memory Input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newMemoryInput}
                  onChange={(e) => setNewMemoryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddPermanentMemory();
                    }
                  }}
                  placeholder="Add a standing fact (e.g. My preferred tech stack is TypeScript and React)..."
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900/90 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-500"
                />
                <button
                  type="button"
                  onClick={handleAddPermanentMemory}
                  disabled={!newMemoryInput.trim()}
                  className={`text-xs px-3 py-2 rounded-xl font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                    newMemoryInput.trim()
                      ? 'bg-zinc-100 text-zinc-900 hover:bg-white cursor-pointer'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
                  }`}
                >
                  <Plus size={13} />
                  <span>Add</span>
                </button>
              </div>

              {/* Permanent Memories List */}
              <div className="space-y-2 pt-1 max-h-[220px] overflow-y-auto pr-1">
                {permanentMemories.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 text-center text-xs text-zinc-500">
                    No permanent memories saved yet. Add facts above to have NEXUS AI always remember them across every conversation.
                  </div>
                ) : (
                  permanentMemories.map((mem, idx) => {
                    const isEditing = editingMemoryIndex === idx;

                    return (
                      <div
                        key={`perm-mem-${idx}`}
                        className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900/90 transition-colors flex items-center justify-between gap-3 text-xs"
                      >
                        {isEditing ? (
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              type="text"
                              value={editingMemoryDraft}
                              onChange={(e) => setEditingMemoryDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveEditPermanentMemory(idx);
                                } else if (e.key === 'Escape') {
                                  handleCancelEditPermanentMemory();
                                }
                              }}
                              className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-100 outline-none focus:border-zinc-400"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditPermanentMemory(idx)}
                              className="p-1 rounded bg-emerald-600/80 hover:bg-emerald-600 text-white"
                              title="Save changes"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEditPermanentMemory}
                              className="p-1 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
                              title="Cancel"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start gap-2 flex-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                              <span className="text-zinc-200 leading-relaxed break-words">
                                {mem}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEditPermanentMemory(idx)}
                                className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                                title="Edit memory"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePermanentMemory(idx)}
                                className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Delete memory"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="h-px bg-zinc-800" />

            {/* Section 4: Web API */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe size={15} className="text-cyan-400" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    Web API
                  </h4>
                </div>
                {webApiMode === 'default' ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 font-medium">
                    <Check size={11} /> Default
                  </span>
                ) : (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-500/40 flex items-center gap-1 font-medium">
                    <Plug size={11} /> Custom API
                  </span>
                )}
              </div>

              <p className="text-xs text-zinc-400">
                Choose search provider for AI Assistant web search.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                {/* Option 1: Default Card */}
                <button
                  type="button"
                  onClick={() => handleSelectWebApiMode('default')}
                  className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                    webApiMode === 'default'
                      ? 'border-cyan-500/60 bg-cyan-950/30 text-white shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                      : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/50 text-zinc-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Globe size={15} className={webApiMode === 'default' ? 'text-cyan-400' : 'text-zinc-400'} />
                        <span className="text-xs font-semibold text-zinc-100">Default</span>
                      </div>
                      {webApiMode === 'default' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 font-medium flex items-center gap-0.5">
                          <Check size={10} /> Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Uses the search API already configured on the server.
                    </p>
                  </div>
                </button>

                {/* Option 2: Custom Collapsible Sub-folder Card */}
                <div
                  className={`rounded-2xl border transition-all ${
                    webApiMode === 'custom'
                      ? 'border-purple-500/60 bg-purple-950/20 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                      : 'border-zinc-800 bg-zinc-900/50'
                  }`}
                >
                  {/* Collapsible Sub-folder Header */}
                  <div
                    onClick={() => {
                      handleSelectWebApiMode('custom');
                      setWebApiCustomOpen(true);
                    }}
                    className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-zinc-800/40 transition-colors rounded-2xl"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Plug size={15} className={webApiMode === 'custom' ? 'text-purple-400' : 'text-zinc-400'} />
                      <span className="text-xs font-semibold text-zinc-100">Custom</span>
                      {webApiMode === 'custom' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 font-medium flex items-center gap-0.5 ml-1">
                          <Check size={10} /> Active
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setWebApiCustomOpen((prev) => !prev);
                      }}
                      className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
                      title={webApiCustomOpen ? 'Collapse fields' : 'Expand fields'}
                    >
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 ${
                          webApiCustomOpen ? 'rotate-180 text-zinc-200' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Collapsible Content */}
                  {webApiCustomOpen && (
                    <div className="p-3.5 pt-0 space-y-3 border-t border-zinc-800/60 mt-1">
                      {/* Warning if fields are empty while Custom is selected */}
                      {webApiMode === 'custom' && (!customSearchKey.trim() || !customSearchUrl.trim()) && (
                        <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-950/40 text-amber-300 text-xs flex items-center gap-2">
                          <AlertCircle size={14} className="shrink-0 text-amber-400" />
                          <span>Fill both fields, or the Default search will be used</span>
                        </div>
                      )}

                      {/* Field a: Search API Key */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-zinc-300 flex items-center gap-1.5">
                          <Key size={12} className="text-purple-400" />
                          <span>Search API Key</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showSearchKey ? 'text' : 'password'}
                            value={customSearchKey}
                            onChange={(e) => handleCustomSearchKeyChange(e.target.value)}
                            placeholder="Enter custom API key..."
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-900/90 pl-3 pr-9 py-2 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-purple-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSearchKey((prev) => !prev)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-0.5"
                            title={showSearchKey ? 'Hide key' : 'Show key'}
                          >
                            {showSearchKey ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                      </div>

                      {/* Field b: Search API URL */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-zinc-300 flex items-center gap-1.5">
                          <Globe size={12} className="text-purple-400" />
                          <span>Search API URL</span>
                        </label>
                        <input
                          type="text"
                          value={customSearchUrl}
                          onChange={(e) => handleCustomSearchUrlChange(e.target.value)}
                          placeholder="https://api.example.com/search"
                          className="w-full rounded-xl border border-zinc-700 bg-zinc-900/90 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-purple-500"
                        />
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleTestSearchConnection}
                          disabled={!customSearchKey.trim() || !customSearchUrl.trim() || testSearchLoading}
                          className={`text-xs px-3 py-1.5 rounded-xl font-medium border flex items-center gap-1.5 transition-all ${
                            !customSearchKey.trim() || !customSearchUrl.trim() || testSearchLoading
                              ? 'border-zinc-800 bg-zinc-900/40 text-zinc-600 cursor-not-allowed opacity-60'
                              : 'border-purple-500/50 bg-purple-950/70 text-purple-300 hover:bg-purple-900/70 hover:text-white cursor-pointer'
                          }`}
                        >
                          {testSearchLoading ? (
                            <>
                              <Loader2 size={12} className="animate-spin text-purple-400" />
                              <span>Testing...</span>
                            </>
                          ) : (
                            <>
                              <Plug size={12} />
                              <span>Test connection</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleResetSearchToDefault}
                          className="text-xs px-2.5 py-1.5 rounded-xl border border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-all flex items-center gap-1"
                        >
                          <RotateCcw size={11} />
                          <span>Reset to Default</span>
                        </button>
                      </div>

                      {/* Test connection result display */}
                      {testSearchResult && (
                        <div
                          className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                            testSearchResult.ok
                              ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-300'
                              : 'border-red-500/40 bg-red-950/60 text-red-300'
                          }`}
                        >
                          {testSearchResult.ok ? (
                            <Check size={14} className="shrink-0 text-emerald-400" />
                          ) : (
                            <AlertCircle size={14} className="shrink-0 text-red-400" />
                          )}
                          <span>{testSearchResult.message}</span>
                        </div>
                      )}

                      {/* Help line */}
                      <p className="text-[11px] text-zinc-500 leading-relaxed">
                        Used for AI Assistant web search. Your key is saved only on this device.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="h-px bg-zinc-800" />

            {/* Section 5: Modes (Collapsible Folder Grouping Specialist Toggles) */}
            <div className="space-y-3">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden transition-all shadow-sm">
                {/* Collapsible Header */}
                <button
                  type="button"
                  onClick={() => setModesSectionOpen((prev) => !prev)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-800/40 transition-colors"
                  aria-expanded={modesSectionOpen}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-zinc-800/90 border border-zinc-700/70 grid place-items-center text-amber-400 shrink-0">
                      <Sliders size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                          Modes
                        </h4>
                        {activeSpecialistModeName ? (
                          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border bg-cyan-950/80 text-cyan-300 border-cyan-500/50 shadow-[0_0_8px_rgba(6,182,212,0.2)]">
                            {activeSpecialistModeName} Active
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800/80 px-2 py-0.5 rounded-full border border-zinc-700/60">
                            Standard
                          </span>
                        )}
                      </div>
                      <p className="text-[11.5px] text-zinc-400 mt-0.5 truncate">
                        Multi Chat, Architect, Data Analysis, Coder, Web Fetcher, Wikimedia
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-[11px] text-zinc-500 hidden sm:inline">
                      {modesSectionOpen ? 'Hide' : 'Expand'}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`text-zinc-400 transition-transform duration-200 ${
                        modesSectionOpen ? 'rotate-180 text-zinc-200' : ''
                      }`}
                    />
                  </div>
                </button>

                {/* Collapsible Content */}
                {modesSectionOpen && (
                  <div className="p-4 pt-2 border-t border-zinc-800/80 space-y-4 animate-in fade-in duration-150">
                    {/* Specialist Modes Mutually Exclusive Header Banner */}
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 flex items-start gap-2.5">
                      <span className="text-sm leading-none mt-0.5">⚡</span>
                      <div className="text-xs text-zinc-400 leading-relaxed">
                        <span className="font-semibold text-zinc-200 block mb-0.5">
                          Specialist Modes (Mutually Exclusive)
                        </span>
                        Only 1 specialist mode can be active at a time (like radio buttons). Turning on any one mode automatically turns off whichever mode was previously active.
                      </div>
                    </div>

                    {/* 1. Multi Chat Mode Toggle */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessagesSquare size={15} className="text-cyan-400" />
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                            Multi Chat (3-Persona Pipeline)
                          </h4>
                        </div>
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                            multiChatEnabled
                              ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                              : 'bg-zinc-800 text-zinc-500 border-zinc-700/60'
                          }`}
                        >
                          {multiChatEnabled ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed">
                        When enabled, every message sent in AI Assistant routes through the 3-persona sequential pipeline (NOVA 🧠 → ORBIT 😎 → COSMOS 🧘). Each persona builds upon prior reasoning and displays distinct response cards. (Mutually exclusive: turns off other specialist modes).
                      </p>

                      {/* Interactive Toggle Card */}
                      <div
                        onClick={toggleMultiChat}
                        className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          multiChatEnabled
                            ? 'border-cyan-500/40 bg-cyan-950/20 shadow-[0_0_15px_rgba(6,182,212,0.12)]'
                            : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl grid place-items-center transition-colors ${
                              multiChatEnabled
                                ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300'
                                : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
                            }`}
                          >
                            <Bot size={18} />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-zinc-100 flex items-center gap-2">
                              <span>Enable Multi Chat</span>
                              {multiChatEnabled && (
                                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-1.5 py-0.2 rounded border border-cyan-500/40">
                                  NOVA → ORBIT → COSMOS
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              {multiChatEnabled
                                ? 'Connected 3-Persona sequential reasoning pipeline is active'
                                : 'Standard single NEXUS AI Assistant responses'}
                            </p>
                          </div>
                        </div>

                        {/* Toggle Switch */}
                        <div
                          className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                            multiChatEnabled ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]' : 'bg-zinc-700'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                              multiChatEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-zinc-800/80" />

                    {/* 2. Architect Toggle */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Layers size={15} className="text-amber-400" />
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                            Architect
                          </h4>
                        </div>
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                            architectEnabled
                              ? 'bg-amber-950/80 text-amber-300 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                              : 'bg-zinc-800 text-zinc-500 border-zinc-700/60'
                          }`}
                        >
                          {architectEnabled ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed">
                        When enabled, AI Assistant routes messages directly through the JARVIS Architect agent to generate interactive SVG architectural blueprints, workflow flowcharts, and system designs inline in chat. (Mutually exclusive: turns off other specialist modes).
                      </p>

                      {/* Interactive Toggle Card */}
                      <div
                        onClick={toggleArchitect}
                        className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          architectEnabled
                            ? 'border-amber-500/40 bg-amber-950/20 shadow-[0_0_15px_rgba(245,158,11,0.12)]'
                            : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl grid place-items-center transition-colors ${
                              architectEnabled
                                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                                : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
                            }`}
                          >
                            <Layers size={18} />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-zinc-100 flex items-center gap-2">
                              <span>Enable Architect</span>
                              {architectEnabled && (
                                <span className="text-[10px] font-mono text-amber-400 bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-500/40">
                                  SVG Blueprints
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              {architectEnabled
                                ? 'JARVIS Architect agent generates vector system diagrams'
                                : 'Standard textual technical responses'}
                            </p>
                          </div>
                        </div>

                        {/* Toggle Switch */}
                        <div
                          className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                            architectEnabled ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'bg-zinc-700'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                              architectEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-zinc-800/80" />

                    {/* 3. Data Analysis Toggle */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BarChart3 size={15} className="text-sky-400" />
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                            Data Analysis
                          </h4>
                        </div>
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                            dataAnalysisEnabled
                              ? 'bg-sky-950/80 text-sky-300 border-sky-500/50 shadow-[0_0_8px_rgba(56,189,248,0.2)]'
                              : 'bg-zinc-800 text-zinc-500 border-zinc-700/60'
                          }`}
                        >
                          {dataAnalysisEnabled ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed">
                        When enabled, AI Assistant routes messages directly through the JARVIS Data Analyst agent to parse comparative metrics and render interactive Recharts visualizations (Bar &amp; Line charts) inline in chat. (Mutually exclusive: turns off other specialist modes).
                      </p>

                      {/* Interactive Toggle Card */}
                      <div
                        onClick={toggleDataAnalysis}
                        className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          dataAnalysisEnabled
                            ? 'border-sky-500/40 bg-sky-950/20 shadow-[0_0_15px_rgba(56,189,248,0.12)]'
                            : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl grid place-items-center transition-colors ${
                              dataAnalysisEnabled
                                ? 'bg-sky-500/20 border border-sky-500/40 text-sky-300'
                                : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
                            }`}
                          >
                            <BarChart3 size={18} />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-zinc-100 flex items-center gap-2">
                              <span>Enable Data Analysis</span>
                              {dataAnalysisEnabled && (
                                <span className="text-[10px] font-mono text-sky-400 bg-sky-950/80 px-1.5 py-0.2 rounded border border-sky-500/40">
                                  Interactive Charts
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              {dataAnalysisEnabled
                                ? 'JARVIS Data Analyst agent extracts quantitative data charts'
                                : 'Standard textual analysis'}
                            </p>
                          </div>
                        </div>

                        {/* Toggle Switch */}
                        <div
                          className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                            dataAnalysisEnabled ? 'bg-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.4)]' : 'bg-zinc-700'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                              dataAnalysisEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-zinc-800/80" />

                    {/* 4. Coder Toggle */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Code2 size={15} className="text-emerald-400" />
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                            Coder
                          </h4>
                        </div>
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                            coderEnabled
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                              : 'bg-zinc-800 text-zinc-500 border-zinc-700/60'
                          }`}
                        >
                          {coderEnabled ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed">
                        When enabled, AI Assistant routes messages through the research-grounded code pipeline (Planner → Researcher → Coder) using the /codeonline workflow to generate production-ready implementations. (Mutually exclusive: turns off other specialist modes).
                      </p>

                      {/* Interactive Toggle Card */}
                      <div
                        onClick={toggleCoder}
                        className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          coderEnabled
                            ? 'border-emerald-500/40 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.12)]'
                            : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl grid place-items-center transition-colors ${
                              coderEnabled
                                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                                : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
                            }`}
                          >
                            <Code2 size={18} />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-zinc-100 flex items-center gap-2">
                              <span>Enable Coder</span>
                              {coderEnabled && (
                                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-500/40">
                                  Research Code
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              {coderEnabled
                                ? 'Planner → Researcher → Coder pipeline is active'
                                : 'Standard coding responses'}
                            </p>
                          </div>
                        </div>

                        {/* Toggle Switch */}
                        <div
                          className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                            coderEnabled ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-zinc-700'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                              coderEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-zinc-800/80" />

                    {/* 5. Web Fetcher Toggle */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Globe size={15} className="text-teal-400" />
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                            Web Fetcher
                          </h4>
                        </div>
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                            webFetcherEnabled
                              ? 'bg-teal-950/80 text-teal-300 border-teal-500/50 shadow-[0_0_8px_rgba(20,184,166,0.2)]'
                              : 'bg-zinc-800 text-zinc-500 border-zinc-700/60'
                          }`}
                        >
                          {webFetcherEnabled ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed">
                        When enabled, AI Assistant reads and extracts full webpage content from any provided URL using the /web live extraction pipeline. (Mutually exclusive: turns off other specialist modes).
                      </p>

                      {/* Interactive Toggle Card */}
                      <div
                        onClick={toggleWebFetcher}
                        className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          webFetcherEnabled
                            ? 'border-teal-500/40 bg-teal-950/20 shadow-[0_0_15px_rgba(20,184,166,0.12)]'
                            : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl grid place-items-center transition-colors ${
                              webFetcherEnabled
                                ? 'bg-teal-500/20 border border-teal-500/40 text-teal-300'
                                : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
                            }`}
                          >
                            <Globe size={18} />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-zinc-100 flex items-center gap-2">
                              <span>Enable Web Fetcher</span>
                              {webFetcherEnabled && (
                                <span className="text-[10px] font-mono text-teal-400 bg-teal-950/80 px-1.5 py-0.2 rounded border border-teal-500/40">
                                  URL Reader
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              {webFetcherEnabled
                                ? 'Live webpage reader and content extraction'
                                : 'Standard web search browsing'}
                            </p>
                          </div>
                        </div>

                        {/* Toggle Switch */}
                        <div
                          className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                            webFetcherEnabled ? 'bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.4)]' : 'bg-zinc-700'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                              webFetcherEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-zinc-800/80" />

                    {/* 6. Wikimedia Toggle */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ImageIcon size={15} className="text-violet-400" />
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                            Wikimedia
                          </h4>
                        </div>
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                            wikimediaEnabled
                              ? 'bg-violet-950/80 text-violet-300 border-violet-500/50 shadow-[0_0_8px_rgba(139,92,246,0.2)]'
                              : 'bg-zinc-800 text-zinc-500 border-zinc-700/60'
                          }`}
                        >
                          {wikimediaEnabled ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed">
                        When enabled, AI Assistant extracts the topic from your message and retrieves 5 real photographic images directly from Wikimedia Commons without invoking an AI model. (Mutually exclusive: turns off other specialist modes).
                      </p>

                      {/* Interactive Toggle Card */}
                      <div
                        onClick={toggleWikimedia}
                        className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          wikimediaEnabled
                            ? 'border-violet-500/40 bg-violet-950/20 shadow-[0_0_15px_rgba(139,92,246,0.12)]'
                            : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl grid place-items-center transition-colors ${
                              wikimediaEnabled
                                ? 'bg-violet-500/20 border border-violet-500/40 text-violet-300'
                                : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
                            }`}
                          >
                            <ImageIcon size={18} />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-zinc-100 flex items-center gap-2">
                              <span>Enable Wikimedia</span>
                              {wikimediaEnabled && (
                                <span className="text-[10px] font-mono text-violet-400 bg-violet-950/80 px-1.5 py-0.2 rounded border border-violet-500/40">
                                  Real Images
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              {wikimediaEnabled
                                ? '5 real images retrieved from Wikimedia Commons'
                                : 'Standard conversational responses'}
                            </p>
                          </div>
                        </div>

                        {/* Toggle Switch */}
                        <div
                          className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                            wikimediaEnabled ? 'bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.4)]' : 'bg-zinc-700'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                              wikimediaEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-zinc-800/80" />

                    {/* 7. New Agent Toggle */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Layers3 size={15} className="text-rose-400" />
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                            New Agent
                          </h4>
                        </div>
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                            newAgentEnabled
                              ? 'bg-rose-950/80 text-rose-300 border-rose-500/50 shadow-[0_0_8px_rgba(244,63,94,0.2)]'
                              : 'bg-zinc-800 text-zinc-500 border-zinc-700/60'
                          }`}
                        >
                          {newAgentEnabled ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed">
                        When enabled, AI Assistant routes all messages through the dynamic 3-specialist pipeline (/newagent). The Planner analyzes your domain and dynamically creates 3 specialized sub-agents that collaborate to synthesize your response. (Mutually exclusive: turns off other specialist modes).
                      </p>

                      {/* Interactive Toggle Card */}
                      <div
                        onClick={toggleNewAgent}
                        className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          newAgentEnabled
                            ? 'border-rose-500/40 bg-rose-950/20 shadow-[0_0_15px_rgba(244,63,94,0.12)]'
                            : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl grid place-items-center transition-colors ${
                              newAgentEnabled
                                ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                                : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
                            }`}
                          >
                            <Layers3 size={18} />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-zinc-100 flex items-center gap-2">
                              <span>Enable New Agent</span>
                              {newAgentEnabled && (
                                <span className="text-[10px] font-mono text-rose-400 bg-rose-950/80 px-1.5 py-0.2 rounded border border-rose-500/40">
                                  Dynamic 3-Specialist
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              {newAgentEnabled
                                ? 'Dynamic 3-specialist pipeline active'
                                : 'Standard single assistant responses'}
                            </p>
                          </div>
                        </div>

                        {/* Toggle Switch */}
                        <div
                          className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                            newAgentEnabled ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-zinc-700'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                              newAgentEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-zinc-800/80" />

                    {/* 8. Swarm Live Toggle */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Radio size={15} className="text-red-400" />
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                            Swarm Live
                          </h4>
                        </div>
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                            swarmLiveEnabled
                              ? 'bg-red-950/80 text-red-300 border-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.2)]'
                              : 'bg-zinc-800 text-zinc-500 border-zinc-700/60'
                          }`}
                        >
                          {swarmLiveEnabled ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed">
                        When enabled, AI Assistant runs the 20+ agent Parallax debate engine and streams incoming agent perspectives in real time as a live feed styled like YouTube Live Chat. (Mutually exclusive: turns off other specialist modes).
                      </p>

                      {/* Interactive Toggle Card */}
                      <div
                        onClick={toggleSwarmLive}
                        className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          swarmLiveEnabled
                            ? 'border-red-500/40 bg-red-950/20 shadow-[0_0_15px_rgba(239,68,68,0.12)]'
                            : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl grid place-items-center transition-colors ${
                              swarmLiveEnabled
                                ? 'bg-red-500/20 border border-red-500/40 text-red-300'
                                : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
                            }`}
                          >
                            <Radio size={18} />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-zinc-100 flex items-center gap-2">
                              <span>Enable Swarm Live</span>
                              {swarmLiveEnabled && (
                                <span className="text-[10px] font-mono text-red-400 bg-red-950/80 px-1.5 py-0.2 rounded border border-red-500/40">
                                  20+ Agent Live Feed
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              {swarmLiveEnabled
                                ? '20+ Agent live debate feed active'
                                : 'Standard single assistant responses'}
                            </p>
                          </div>
                        </div>

                        {/* Toggle Switch */}
                        <div
                          className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                            swarmLiveEnabled ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' : 'bg-zinc-700'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                              swarmLiveEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-zinc-800/80" />

                    {/* 9. Commander Mode (Specialist Mode & Pipeline Configuration) */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Shield size={15} className="text-indigo-400" />
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                            Commander Mode
                          </h4>
                        </div>
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                            commanderEnabled
                              ? 'bg-indigo-950/80 text-indigo-300 border-indigo-500/50 shadow-[0_0_8px_rgba(99,102,241,0.2)]'
                              : 'bg-zinc-800 text-zinc-500 border-zinc-700/60'
                          }`}
                        >
                          {commanderEnabled ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Dedicated 3-agent tactical intelligence unit (Commander, Agent Alpha, Agent Beta). Auto mode empowers Commander AI to dynamically allocate roles, tasks, and live search queries at runtime. Manual mode executes your fixed plan, roles, and search queries.
                      </p>

                      {/* Interactive Toggle Card */}
                      <div
                        onClick={toggleCommander}
                        className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          commanderEnabled
                            ? 'border-indigo-500/40 bg-indigo-950/20 shadow-[0_0_15px_rgba(99,102,241,0.12)]'
                            : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl grid place-items-center transition-colors ${
                              commanderEnabled
                                ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-300'
                                : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
                            }`}
                          >
                            <Shield size={18} />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-zinc-100 flex items-center gap-2">
                              <span>Enable Commander Mode</span>
                              {commanderEnabled && (
                                <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/80 px-1.5 py-0.2 rounded border border-indigo-500/40">
                                  3-Agent Unit Active
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              {commanderEnabled
                                ? `Active (${commanderConfig.mode.toUpperCase()} mode)`
                                : 'Standard single assistant responses'}
                            </p>
                          </div>
                        </div>

                        {/* Toggle Switch */}
                        <div
                          className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                            commanderEnabled ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]' : 'bg-zinc-700'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                              commanderEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Operational Mode Toggle: Auto vs Manual */}
                      <div className="p-3 rounded-xl border border-zinc-800 bg-black/40 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-zinc-200">
                            Operational Mode
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            {commanderConfig.mode === 'auto'
                              ? 'Commander AI determines roles & tasks at runtime'
                              : 'Fixed user directives & roles from Settings'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const updated: CommanderConfig = { ...commanderConfig, mode: 'auto' };
                              setCommanderConfig(updated);
                              storage.saveCommanderConfig(updated);
                              triggerSettingsToast('Commander set to AUTO mode (AI decides)');
                            }}
                            className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                              commanderConfig.mode === 'auto'
                                ? 'bg-indigo-950/70 border-indigo-500/60 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            <span className="font-semibold text-sm">✦ AUTO</span>
                            <span className="text-[10.5px] opacity-80 text-center">
                              Commander AI Decides
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const updated: CommanderConfig = { ...commanderConfig, mode: 'manual' };
                              setCommanderConfig(updated);
                              storage.saveCommanderConfig(updated);
                              triggerSettingsToast('Commander set to MANUAL mode (User controls all)');
                            }}
                            className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                              commanderConfig.mode === 'manual'
                                ? 'bg-indigo-950/70 border-indigo-500/60 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            <span className="font-semibold text-sm">⚙ MANUAL</span>
                            <span className="text-[10.5px] opacity-80 text-center">
                              User Decides Everything
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* AI Model Allocation (4-Agent Specialist Pipeline) */}
                      <div className="p-3 rounded-xl border border-zinc-800 bg-black/40 space-y-3">
                        <div className="flex items-center justify-between pb-1 border-b border-zinc-800/80">
                          <div className="flex items-center gap-1.5">
                            <Sliders size={13} className="text-indigo-400" />
                            <span className="text-xs font-semibold text-zinc-200">
                              AI Model Allocation (4-Agent Pipeline)
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-400">
                            Select provider or type custom model manually
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {/* 1. Commander */}
                          <CommanderModelSelector
                            agentKey="commander"
                            title="Commander (Director)"
                            roleSubtitle="Strategic decomposition, mission allocation & orchestration"
                            themeColor="indigo"
                            value={storage.getCommanderAgentModel('commander')}
                            configuredProviders={configuredAIProviders}
                            onChange={(val) => {
                              const updated = storage.setCommanderAgentModel('commander', val);
                              setCommanderConfig(updated);
                            }}
                          />

                          {/* 2. Agent Alpha */}
                          <CommanderModelSelector
                            agentKey="alpha"
                            title="Agent Alpha (Specialist 1)"
                            roleSubtitle="Lead empirical investigation, technical deep-dive"
                            themeColor="cyan"
                            value={storage.getCommanderAgentModel('alpha')}
                            configuredProviders={configuredAIProviders}
                            onChange={(val) => {
                              const updated = storage.setCommanderAgentModel('alpha', val);
                              setCommanderConfig(updated);
                            }}
                          />

                          {/* 3. Agent Beta */}
                          <CommanderModelSelector
                            agentKey="beta"
                            title="Agent Beta (Specialist 2)"
                            roleSubtitle="Counter-perspective, stress-testing, caveats & risk audit"
                            themeColor="purple"
                            value={storage.getCommanderAgentModel('beta')}
                            configuredProviders={configuredAIProviders}
                            onChange={(val) => {
                              const updated = storage.setCommanderAgentModel('beta', val);
                              setCommanderConfig(updated);
                            }}
                          />

                          {/* 4. Final Synthesizer */}
                          <CommanderModelSelector
                            agentKey="synthesizer"
                            title="Final Synthesizer"
                            roleSubtitle="Harmonizes Alpha & Beta findings into master resolution"
                            themeColor="emerald"
                            value={storage.getCommanderAgentModel('synthesizer')}
                            configuredProviders={configuredAIProviders}
                            onChange={(val) => {
                              const updated = storage.setCommanderAgentModel('synthesizer', val);
                              setCommanderConfig(updated);
                            }}
                          />
                        </div>
                      </div>

                      {/* Manual Configuration Fields (Active / Pre-fillable) */}
                      <div className="p-3 rounded-xl border border-zinc-800 bg-black/40 space-y-3">
                        <div className="flex items-center justify-between pb-1 border-b border-zinc-800/80">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-zinc-200">
                              Manual Pipeline Directives
                            </span>
                            {commanderConfig.mode === 'manual' && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleCopyCommanderManualSettings}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-all shadow-sm active:scale-95 ${
                                copiedCommanderDirectives
                                  ? 'border-emerald-500/50 bg-emerald-950/60 text-emerald-300'
                                  : 'border-zinc-700 hover:border-zinc-500 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white'
                              }`}
                              title="Copy all 4 agent system prompts, roles, task instructions, and search queries to clipboard"
                            >
                              {copiedCommanderDirectives ? (
                                <>
                                  <Check size={12} className="text-emerald-400" />
                                  <span className="text-emerald-300 font-medium">Copied All!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} className="text-indigo-400" />
                                  <span>Copy All Prompts & Directives</span>
                                </>
                              )}
                            </button>
                            <span className="text-[10.5px] text-zinc-400 hidden sm:inline">
                              Executed when in Manual mode
                            </span>
                          </div>
                        </div>

                        {/* AI Enhance Manual Directives */}
                        <div className="p-2.5 rounded-lg border border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-black/40 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold text-indigo-300 flex items-center gap-1.5">
                              <Sparkles size={12} className="text-amber-400" />
                              <span>Describe your idea</span>
                            </label>
                            {isEnhancingCommanderAny && (
                              <span className="text-[10px] text-indigo-300 flex items-center gap-1 font-mono">
                                <Loader2 size={10} className="animate-spin text-indigo-400" />
                                <span>Enhancing 4 agents...</span>
                              </span>
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <textarea
                              value={commanderEnhanceIdea}
                              onChange={(e) => {
                                setCommanderEnhanceIdea(e.target.value);
                                if (commanderEnhanceError) setCommanderEnhanceError(null);
                                if (alphaEnhanceError) setAlphaEnhanceError(null);
                                if (betaEnhanceError) setBetaEnhanceError(null);
                                if (synthEnhanceError) setSynthEnhanceError(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                  e.preventDefault();
                                  handleEnhanceCommanderDirectives();
                                }
                              }}
                              rows={2}
                              placeholder="Describe your idea to automatically tailor directives for Commander, Alpha, Beta, and Synthesizer..."
                              className="w-full sm:flex-1 rounded-lg border border-zinc-700 bg-zinc-900/90 p-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-indigo-500 resize-none font-sans"
                            />
                            <button
                              type="button"
                              onClick={handleEnhanceCommanderDirectives}
                              disabled={!commanderEnhanceIdea.trim() || isEnhancingCommanderAny}
                              className={`px-3.5 py-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all shrink-0 self-stretch sm:self-auto ${
                                isEnhancingCommanderAny
                                  ? 'border-indigo-500/30 bg-indigo-950/40 text-indigo-300/60 cursor-not-allowed'
                                  : !commanderEnhanceIdea.trim()
                                  ? 'border-zinc-800 bg-zinc-900/50 text-zinc-500 cursor-not-allowed'
                                  : 'border-indigo-500/50 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 hover:text-white shadow-[0_0_12px_rgba(99,102,241,0.25)] active:scale-95'
                              }`}
                              title={
                                !commanderEnhanceIdea.trim()
                                  ? 'Type your raw idea first'
                                  : 'AI Enhance: independently generate Commander plan, Alpha directives, Beta directives, and Synthesizer directives'
                              }
                            >
                              {isEnhancingCommanderAny ? (
                                <Loader2 size={13} className="animate-spin text-indigo-300" />
                              ) : (
                                <Sparkles size={13} className="text-amber-400" />
                              )}
                              <span>{isEnhancingCommanderAny ? 'Enhancing...' : 'AI Enhance'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Commander Fixed Plan */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-medium text-indigo-300">
                              Commander's Fixed Plan / Task:
                            </label>
                            {enhancingCommanderPlan && (
                              <span className="text-[10px] text-indigo-400 flex items-center gap-1 font-mono">
                                <Loader2 size={10} className="animate-spin" />
                                <span>Enhancing plan...</span>
                              </span>
                            )}
                          </div>
                          <textarea
                            value={commanderConfig.manualConfig.commanderPlan}
                            onChange={(e) => {
                              const updated: CommanderConfig = {
                                ...commanderConfig,
                                manualConfig: {
                                  ...commanderConfig.manualConfig,
                                  commanderPlan: e.target.value,
                                },
                              };
                              setCommanderConfig(updated);
                              storage.saveCommanderConfig(updated);
                            }}
                            rows={2}
                            placeholder="Commander tactical directive..."
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-900/90 p-2.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-indigo-500 resize-none font-sans"
                          />
                          {commanderEnhanceError && (
                            <p className="text-[10.5px] text-red-400 flex items-center gap-1 pt-0.5">
                              <AlertCircle size={10} />
                              <span>{commanderEnhanceError}</span>
                            </p>
                          )}
                        </div>

                        {/* Agent Alpha Configuration */}
                        <div className="p-2.5 rounded-lg border border-cyan-500/20 bg-cyan-950/10 space-y-2">
                          <div className="text-[11px] font-semibold text-cyan-300 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span>Agent Alpha (Specialist 1)</span>
                              {enhancingAlphaDirectives && (
                                <span className="text-[10px] text-cyan-400 flex items-center gap-1 font-mono font-normal">
                                  <Loader2 size={10} className="animate-spin" />
                                  <span>Enhancing...</span>
                                </span>
                              )}
                            </div>
                            <label className="flex items-center gap-1.5 cursor-pointer text-[10.5px] text-zinc-300">
                              <input
                                type="checkbox"
                                checked={commanderConfig.manualConfig.alphaSearchEnabled}
                                onChange={(e) => {
                                  const updated: CommanderConfig = {
                                    ...commanderConfig,
                                    manualConfig: {
                                      ...commanderConfig.manualConfig,
                                      alphaSearchEnabled: e.target.checked,
                                    },
                                  };
                                  setCommanderConfig(updated);
                                  storage.saveCommanderConfig(updated);
                                }}
                                className="rounded border-zinc-700 text-cyan-500 focus:ring-0"
                              />
                              <span>Web Search</span>
                            </label>
                          </div>

                          <div className="space-y-1.5">
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-0.5">
                                Role Name
                              </label>
                              <input
                                type="text"
                                value={commanderConfig.manualConfig.alphaRole}
                                onChange={(e) => {
                                  const updated: CommanderConfig = {
                                    ...commanderConfig,
                                    manualConfig: {
                                      ...commanderConfig.manualConfig,
                                      alphaRole: e.target.value,
                                    },
                                  };
                                  setCommanderConfig(updated);
                                  storage.saveCommanderConfig(updated);
                                }}
                                placeholder="e.g. Lead Technical Investigator"
                                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-cyan-500"
                              />
                            </div>

                            <CommanderModelSelector
                              agentKey="alpha"
                              title="Agent Alpha Model"
                              roleSubtitle="Specialist 1 Investigation Model"
                              themeColor="cyan"
                              compact
                              value={storage.getCommanderAgentModel('alpha')}
                              configuredProviders={configuredAIProviders}
                              onChange={(val) => {
                                const updated = storage.setCommanderAgentModel('alpha', val);
                                setCommanderConfig(updated);
                              }}
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">
                              Search Query (optional)
                            </label>
                            <input
                              type="text"
                              value={commanderConfig.manualConfig.alphaSearchQuery}
                              onChange={(e) => {
                                const updated: CommanderConfig = {
                                  ...commanderConfig,
                                  manualConfig: {
                                    ...commanderConfig.manualConfig,
                                    alphaSearchQuery: e.target.value,
                                  },
                                };
                                setCommanderConfig(updated);
                                storage.saveCommanderConfig(updated);
                              }}
                              placeholder="Blank = inherits user query"
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-cyan-500"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">
                              Task Instructions
                            </label>
                            <textarea
                              value={commanderConfig.manualConfig.alphaTask}
                              onChange={(e) => {
                                const updated: CommanderConfig = {
                                  ...commanderConfig,
                                  manualConfig: {
                                    ...commanderConfig.manualConfig,
                                    alphaTask: e.target.value,
                                  },
                                };
                                setCommanderConfig(updated);
                                storage.saveCommanderConfig(updated);
                              }}
                              rows={2}
                              placeholder="Alpha task directives..."
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-cyan-500 resize-none font-sans"
                            />
                          </div>
                          {alphaEnhanceError && (
                            <p className="text-[10.5px] text-red-400 flex items-center gap-1 pt-0.5">
                              <AlertCircle size={10} />
                              <span>{alphaEnhanceError}</span>
                            </p>
                          )}
                        </div>

                        {/* Agent Beta Configuration */}
                        <div className="p-2.5 rounded-lg border border-purple-500/20 bg-purple-950/10 space-y-2">
                          <div className="text-[11px] font-semibold text-purple-300 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span>Agent Beta (Counter-Perspective / Specialist 2)</span>
                              {enhancingBetaDirectives && (
                                <span className="text-[10px] text-purple-400 flex items-center gap-1 font-mono font-normal">
                                  <Loader2 size={10} className="animate-spin" />
                                  <span>Enhancing...</span>
                                </span>
                              )}
                            </div>
                            <label className="flex items-center gap-1.5 cursor-pointer text-[10.5px] text-zinc-300">
                              <input
                                type="checkbox"
                                checked={commanderConfig.manualConfig.betaSearchEnabled}
                                onChange={(e) => {
                                  const updated: CommanderConfig = {
                                    ...commanderConfig,
                                    manualConfig: {
                                      ...commanderConfig.manualConfig,
                                      betaSearchEnabled: e.target.checked,
                                    },
                                  };
                                  setCommanderConfig(updated);
                                  storage.saveCommanderConfig(updated);
                                }}
                                className="rounded border-zinc-700 text-purple-500 focus:ring-0"
                              />
                              <span>Web Search</span>
                            </label>
                          </div>

                          <div className="space-y-1.5">
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-0.5">
                                Role Name
                              </label>
                              <input
                                type="text"
                                value={commanderConfig.manualConfig.betaRole}
                                onChange={(e) => {
                                  const updated: CommanderConfig = {
                                    ...commanderConfig,
                                    manualConfig: {
                                      ...commanderConfig.manualConfig,
                                      betaRole: e.target.value,
                                    },
                                  };
                                  setCommanderConfig(updated);
                                  storage.saveCommanderConfig(updated);
                                }}
                                placeholder="e.g. Counter-Perspective & Risk Analyst"
                                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-purple-500"
                              />
                            </div>

                            <CommanderModelSelector
                              agentKey="beta"
                              title="Agent Beta Model"
                              roleSubtitle="Specialist 2 Counter-Analysis Model"
                              themeColor="purple"
                              compact
                              value={storage.getCommanderAgentModel('beta')}
                              configuredProviders={configuredAIProviders}
                              onChange={(val) => {
                                const updated = storage.setCommanderAgentModel('beta', val);
                                setCommanderConfig(updated);
                              }}
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">
                              Search Query (optional)
                            </label>
                            <input
                              type="text"
                              value={commanderConfig.manualConfig.betaSearchQuery}
                              onChange={(e) => {
                                const updated: CommanderConfig = {
                                  ...commanderConfig,
                                  manualConfig: {
                                    ...commanderConfig.manualConfig,
                                    betaSearchQuery: e.target.value,
                                  },
                                };
                                setCommanderConfig(updated);
                                storage.saveCommanderConfig(updated);
                              }}
                              placeholder="Blank = inherits user query"
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-purple-500"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">
                              Task Instructions
                            </label>
                            <textarea
                              value={commanderConfig.manualConfig.betaTask}
                              onChange={(e) => {
                                const updated: CommanderConfig = {
                                  ...commanderConfig,
                                  manualConfig: {
                                    ...commanderConfig.manualConfig,
                                    betaTask: e.target.value,
                                  },
                                };
                                setCommanderConfig(updated);
                                storage.saveCommanderConfig(updated);
                              }}
                              rows={2}
                              placeholder="Beta task directives..."
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-purple-500 resize-none font-sans"
                            />
                          </div>
                          {betaEnhanceError && (
                            <p className="text-[10.5px] text-red-400 flex items-center gap-1 pt-0.5">
                              <AlertCircle size={10} />
                              <span>{betaEnhanceError}</span>
                            </p>
                          )}
                        </div>

                        {/* Final Synthesizer Configuration */}
                        <div className="p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-950/10 space-y-2">
                          <div className="text-[11px] font-semibold text-emerald-300 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span>Final Synthesizer (Supreme Master Synthesis)</span>
                              {enhancingSynthDirectives && (
                                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono font-normal">
                                  <Loader2 size={10} className="animate-spin" />
                                  <span>Enhancing...</span>
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-zinc-400 font-mono">STEP 4</span>
                          </div>

                          <CommanderModelSelector
                            agentKey="synthesizer"
                            title="Final Synthesizer Model"
                            roleSubtitle="Harmonizes Alpha & Beta findings into definitive intelligence"
                            themeColor="emerald"
                            compact
                            value={storage.getCommanderAgentModel('synthesizer')}
                            configuredProviders={configuredAIProviders}
                            onChange={(val) => {
                              const updated = storage.setCommanderAgentModel('synthesizer', val);
                              setCommanderConfig(updated);
                            }}
                          />

                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">
                              Synthesis Directives / Focus (optional)
                            </label>
                            <textarea
                              value={commanderConfig.manualConfig.synthesizerDirectives || ''}
                              onChange={(e) => {
                                const updated: CommanderConfig = {
                                  ...commanderConfig,
                                  manualConfig: {
                                    ...commanderConfig.manualConfig,
                                    synthesizerDirectives: e.target.value,
                                  },
                                };
                                setCommanderConfig(updated);
                                storage.saveCommanderConfig(updated);
                              }}
                              rows={2}
                              placeholder="e.g. Harmonize empirical findings with stress-tests to provide balanced, definitive intelligence..."
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-emerald-500 resize-none font-sans"
                            />
                          </div>
                          {synthEnhanceError && (
                            <p className="text-[10.5px] text-red-400 flex items-center gap-1 pt-0.5">
                              <AlertCircle size={10} />
                              <span>{synthEnhanceError}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Editable System Prompts Accordion */}
                      <div className="rounded-xl border border-zinc-800 bg-black/40 overflow-hidden">
                        <div className="w-full p-3 text-xs font-semibold text-zinc-200 flex items-center justify-between transition-colors bg-zinc-900/60 hover:bg-zinc-850">
                          <button
                            type="button"
                            onClick={() => setCommanderPromptsExpanded((prev) => !prev)}
                            className="flex items-center gap-2 hover:text-white flex-1 text-left"
                          >
                            <Shield size={13} className="text-indigo-400 shrink-0" />
                            <span>System Prompts (Commander, Alpha, Beta, Synthesizer)</span>
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyCommanderManualSettings();
                              }}
                              className={`px-2 py-0.5 rounded border text-[10.5px] font-medium flex items-center gap-1 transition-all ${
                                copiedCommanderDirectives
                                  ? 'border-emerald-500/50 bg-emerald-950/60 text-emerald-300'
                                  : 'border-zinc-700 hover:border-zinc-500 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white'
                              }`}
                              title="Copy all 4 agent system prompts and manual directives"
                            >
                              {copiedCommanderDirectives ? (
                                <>
                                  <Check size={11} className="text-emerald-400" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={11} className="text-indigo-400" />
                                  <span>Copy All</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setCommanderPromptsExpanded((prev) => !prev)}
                              className="text-zinc-400 hover:text-white pl-1"
                              aria-label="Toggle prompts accordion"
                            >
                              {commanderPromptsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </div>

                        {commanderPromptsExpanded && (
                          <div className="p-3 space-y-3 border-t border-zinc-800/80 text-xs">
                            {/* Commander Prompt */}
                            <div className="space-y-1">
                              <label className="text-[11px] font-medium text-indigo-300">
                                Commander System Prompt (Strategic Planner):
                              </label>
                              <textarea
                                value={commanderConfig.systemPrompts.commander}
                                onChange={(e) => {
                                  const updated: CommanderConfig = {
                                    ...commanderConfig,
                                    systemPrompts: {
                                      ...commanderConfig.systemPrompts,
                                      commander: e.target.value,
                                    },
                                  };
                                  setCommanderConfig(updated);
                                  storage.saveCommanderConfig(updated);
                                }}
                                rows={3}
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-900/90 p-2.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-indigo-500 resize-none font-sans"
                              />
                            </div>

                            {/* Alpha Prompt */}
                            <div className="space-y-1">
                              <label className="text-[11px] font-medium text-cyan-300">
                                Agent Alpha System Prompt (Lead Investigator):
                              </label>
                              <textarea
                                value={commanderConfig.systemPrompts.alpha}
                                onChange={(e) => {
                                  const updated: CommanderConfig = {
                                    ...commanderConfig,
                                    systemPrompts: {
                                      ...commanderConfig.systemPrompts,
                                      alpha: e.target.value,
                                    },
                                  };
                                  setCommanderConfig(updated);
                                  storage.saveCommanderConfig(updated);
                                }}
                                rows={3}
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-900/90 p-2.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-cyan-500 resize-none font-sans"
                              />
                            </div>

                            {/* Beta Prompt */}
                            <div className="space-y-1">
                              <label className="text-[11px] font-medium text-purple-300">
                                Agent Beta System Prompt (Counter-Perspective / Validator):
                              </label>
                              <textarea
                                value={commanderConfig.systemPrompts.beta}
                                onChange={(e) => {
                                  const updated: CommanderConfig = {
                                    ...commanderConfig,
                                    systemPrompts: {
                                      ...commanderConfig.systemPrompts,
                                      beta: e.target.value,
                                    },
                                  };
                                  setCommanderConfig(updated);
                                  storage.saveCommanderConfig(updated);
                                }}
                                rows={3}
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-900/90 p-2.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-purple-500 resize-none font-sans"
                              />
                            </div>

                            {/* Synthesizer Prompt */}
                            <div className="space-y-1">
                              <label className="text-[11px] font-medium text-emerald-300">
                                Commander Final Synthesizer System Prompt:
                              </label>
                              <textarea
                                value={commanderConfig.systemPrompts.synthesizer}
                                onChange={(e) => {
                                  const updated: CommanderConfig = {
                                    ...commanderConfig,
                                    systemPrompts: {
                                      ...commanderConfig.systemPrompts,
                                      synthesizer: e.target.value,
                                    },
                                  };
                                  setCommanderConfig(updated);
                                  storage.saveCommanderConfig(updated);
                                }}
                                rows={3}
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-900/90 p-2.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-emerald-500 resize-none font-sans"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Reset to Defaults button */}
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            const def = storage.resetCommanderConfig();
                            setCommanderConfig(def);
                            triggerSettingsToast('Commander Mode settings and all 4 agent models reset to default.');
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white rounded-lg bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/60 flex items-center gap-1.5 transition-colors"
                        >
                          <RotateCcw size={12} />
                          <span>Reset Commander to Defaults</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* End of Scrollable Body */}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 sm:p-6 py-3.5 sm:py-3.5 border-t border-zinc-800 shrink-0 bg-[#161618]">
              <span className="text-[11px] text-zinc-500">
                All changes are saved automatically to your device.
              </span>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="text-xs font-medium px-4 py-2 rounded-xl bg-zinc-100 text-zinc-900 hover:bg-white transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Memory Management Modal (Short-term scratchpad) */}
      {memoryEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-700/80 bg-[#19191c] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Brain size={16} className="text-cyan-400" />
                <h3 className="text-sm font-semibold text-zinc-100">
                  Short-Term Memory Scratchpad
                </h3>
              </div>
              <span className="text-[11px] text-zinc-500">
                {memoryDraft.length}/{MAX_MEMORY_LENGTH}
              </span>
            </div>

            <p className="text-xs text-zinc-400">
              Short-term scratchpad context derived from recent messages. (For standing facts across all sessions, use Settings &gt; Permanent Memories).
            </p>

            <textarea
              value={memoryDraft}
              onChange={(e) => setMemoryDraft(e.target.value)}
              maxLength={MAX_MEMORY_LENGTH}
              placeholder="e.g. My preferred tech stack is TypeScript and React. Always explain complex concepts concisely."
              rows={6}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 p-3 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500 resize-none font-sans"
            />

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={clearMemory}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 flex items-center gap-1 transition-colors"
              >
                <Trash2 size={13} />
                Clear
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMemoryEditorOpen(false)}
                  className="text-xs px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveMemory}
                  className="text-xs font-medium px-4 py-1.5 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Fullscreen Image Preview Modal */}
      {fullscreenModalImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setFullscreenModalImage(null)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setFullscreenModalImage(null)}
              className="absolute -top-10 right-0 p-2 text-zinc-400 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-all"
              title="Close Fullscreen"
            >
              <X size={18} />
            </button>
            <img
              src={fullscreenModalImage}
              alt="Fullscreen Preview"
              className="max-h-[85vh] w-auto max-w-full rounded-xl shadow-2xl object-contain border border-zinc-800"
            />
          </div>
        </div>
      )}
    </div>
  );
}
