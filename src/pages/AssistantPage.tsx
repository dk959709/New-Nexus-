import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Send,
  User,
  Trash2,
  Plus,
  Brain,
  BookOpen,
  Globe,
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
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/services/api';
import { storage } from '@/lib/storage';
import { copyToClipboard } from '@/lib/clipboard';
import { ErrorMessage } from '@/components';
import type { AISource } from '@/types';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  tool?: 'none' | 'search' | 'weather';
  sources?: AISource[];
  weather?: unknown;
  searchedWeb?: boolean;
};

const CHAT_KEY = 'nexus-ai-conversation-v2';
const MEMORY_KEY = 'nexus-ai-smart-memory-v1';
const WEB_SEARCH_PREF_KEY = 'nexus-ai-web-search-toggle';

const RECENT_MESSAGES = 8;
const MAX_MEMORY_LENGTH = 1200;

const QUICK_PROMPTS = [
  'Explain quantum computing simply',
  'Help me optimize my daily productivity',
  'Summarize the latest trends in artificial intelligence',
  'Write a clean TypeScript utility function',
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

    const messages = parsed.filter(
      (item): item is Message =>
        typeof item === 'object' &&
        item !== null &&
        'role' in item &&
        'content' in item &&
        ((item as { role?: unknown }).role === 'user' ||
          (item as { role?: unknown }).role === 'assistant') &&
        typeof (item as { content?: unknown }).content === 'string',
    );

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

export function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [smartMemory, setSmartMemory] = useState(loadSmartMemory);
  const [webSearchEnabled, setWebSearchEnabled] = useState(loadWebSearchToggle);
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

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const edgeTtsAudioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages, loading, scrollToBottom]);

  const toggleWebSearch = () => {
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
            text: cleanText.slice(0, 1500),
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
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
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
      localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
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

    const isWebSearchForced = webSearchEnabled;

    try {
      const response = await api.aiChat(
        message,
        historyForRequest,
        smartMemory,
        undefined,
        isWebSearchForced,
      );

      const usedWebSearch =
        isWebSearchForced ||
        response.tool === 'search' ||
        Boolean(response.sources && response.sources.length > 0);

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.answer,
        tool: response.tool,
        sources: response.sources,
        weather: response.weather,
        searchedWeb: usedWebSearch,
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
    }
  };

  const newChat = () => {
    setMessages([welcomeMessage]);
    setError('');
    setShowClearConfirm(false);
  };

  const handleConfirmClearChat = () => {
    setSmartMemory('');
    setMemoryDraft('');
    setMemoryEditorOpen(false);
    setMessages([welcomeMessage]);
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
    <div className="min-h-screen bg-[#111113] text-[#e3e3e7] flex flex-col font-sans -mx-4 sm:-mx-8 md:-mx-12 -my-8 px-4 sm:px-8 py-4">
      {/* Minimal Top Navigation Header */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-3 pt-1 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-100 text-sm tracking-tight">
              NEXUS AI
            </span>
          </div>

          <div className="h-3 w-px bg-zinc-700/80" />

          <Link
            to="/settings?tab=ai"
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Configure AI Providers in Settings"
          >
            <Cpu size={12} className="text-zinc-400" />
            <span className="truncate max-w-[160px] sm:max-w-[240px]">
              {providerLabel}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* Smart Memory Status & Trigger */}
          <button
            type="button"
            onClick={openMemoryEditor}
            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
              smartMemory
                ? 'bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:bg-zinc-700/70'
                : 'text-zinc-400 border-transparent hover:bg-zinc-800/60'
            }`}
            title="Manage Memory"
          >
            <Brain size={13} className={smartMemory ? 'text-cyan-400' : 'text-zinc-400'} />
            <span className="hidden sm:inline">Memory</span>
          </button>

          {/* New Chat */}
          <button
            type="button"
            onClick={newChat}
            className="text-xs px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all flex items-center gap-1.5"
            title="Start a new chat"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">New chat</span>
          </button>

          {/* Clear Chat */}
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="text-xs p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-zinc-400 hover:text-red-300 hover:bg-red-500/10 transition-all flex items-center gap-1.5"
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
                    className="text-xs px-3.5 py-2 rounded-full border border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-zinc-800 transition-all text-left"
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
                    {/* User Message: Clean tinted rounded box */}
                    {isUser ? (
                      <div className="px-4 py-2.5 rounded-2xl bg-zinc-800 text-zinc-100 text-[14.5px] leading-relaxed border border-zinc-700/50 break-words whitespace-pre-wrap">
                        {message.content}
                      </div>
                    ) : (
                      /* Assistant Message: Claude-style transparent typography */
                      <div className="w-full space-y-2">
                        {/* Web Search Indicator Tag */}
                        {hasSearched && (
                          <div className="flex items-center gap-2 pt-1 pb-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                              <Search size={11} className="text-cyan-400" />
                              <span>Searched the web</span>
                              {hasSources && (
                                <span className="text-zinc-500 font-normal">
                                  ({message.sources?.length} {message.sources?.length === 1 ? 'source' : 'sources'})
                                </span>
                              )}
                            </span>

                            {hasSources && (
                              <button
                                type="button"
                                onClick={() => toggleSourceExpand(index)}
                                className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-0.5 transition-colors"
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

                        {/* Collapsible Verified Sources Panel with 10-item scrollable grid & domain trust badges */}
                        {hasSources && expandedSources[index] && (
                          <div className="my-2.5 p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-950/60 shadow-sm">
                            <div className="flex items-center justify-between px-1 py-1 mb-2 border-b border-zinc-800/60 text-[11px] text-zinc-400">
                              <span className="font-medium text-zinc-300 flex items-center gap-1.5">
                                <Globe size={12} className="text-cyan-400" />
                                <span>Retrieved Sources ({message.sources?.length})</span>
                              </span>
                              <span className="text-[10.5px] text-zinc-500 hidden sm:inline">
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
                                    className="p-2.5 rounded-lg border border-zinc-800/90 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700 transition-all text-xs flex flex-col justify-between group/card"
                                  >
                                    <div>
                                      <div className="flex items-center justify-between gap-1 mb-1.5 flex-wrap">
                                        <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-zinc-400 truncate max-w-[140px]">
                                          {isWiki ? (
                                            <>
                                              <BookOpen size={10} className="text-cyan-400 shrink-0" /> Wikipedia
                                            </>
                                          ) : (
                                            <>
                                              <Globe size={10} className="text-zinc-400 shrink-0" /> {src.domain || 'Web'}
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

                                      <p className="font-medium text-zinc-200 line-clamp-1 mb-1 group-hover/card:text-white transition-colors">
                                        {src.title}
                                      </p>
                                      {src.description && (
                                        <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                                          {src.description}
                                        </p>
                                      )}
                                    </div>

                                    <div className="mt-2 pt-1.5 border-t border-zinc-800/40 flex items-center justify-between text-[10px] text-zinc-500">
                                      <span className="truncate max-w-[170px]">
                                        {src.url.replace(/^https?:\/\//, '')}
                                      </span>
                                      <ExternalLink size={11} className="text-zinc-500 group-hover/card:text-zinc-300 shrink-0 ml-1" />
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
                            <div className="my-2 p-3 rounded-xl border border-zinc-800 bg-zinc-900/80 text-xs flex items-center justify-between gap-4 flex-wrap">
                              <div>
                                <span className="font-medium text-zinc-200">
                                  {curr.location || 'Location'}
                                </span>
                                <span className="text-zinc-400 ml-2">
                                  {curr.conditionLabel || 'Current Weather'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-zinc-300">
                                <span>🌡️ {curr.temperature ?? '—'}°C</span>
                                <span>💧 {curr.humidity ?? '—'}%</span>
                                <span>🌧️ {curr.rainProbability ?? '—'}%</span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Plain Transparent Assistant Message Body */}
                        <div className="text-[15px] leading-relaxed text-zinc-200 break-words whitespace-pre-wrap pt-0.5">
                          {message.content}
                        </div>

                        {/* Message Action Toolbar */}
                        <div className="flex items-center gap-1.5 pt-1 text-zinc-400 opacity-60 group-hover:opacity-100 transition-opacity">
                          {/* Copy */}
                          <button
                            type="button"
                            onClick={() => handleCopyText(message.content, index)}
                            className="p-1 rounded-md hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                            title="Copy response"
                          >
                            {copiedIndex === index ? (
                              <Check size={13} className="text-emerald-400" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>

                          {/* Browser Voice Read Aloud */}
                          <button
                            type="button"
                            onClick={() => toggleBrowserSpeak(message.content, index)}
                            className={`p-1 rounded-md transition-colors ${
                              speakingIndex === index
                                ? 'text-cyan-400 bg-cyan-500/10'
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

                          {/* Neural Edge TTS */}
                          <button
                            type="button"
                            onClick={() => handleEdgeTtsSpeak(message.content, index)}
                            disabled={edgeTtsLoadingIndex === index}
                            className={`p-1 rounded-md transition-colors ${
                              edgeTtsPlayingIndex === index
                                ? 'text-purple-400 bg-purple-500/10'
                                : 'hover:text-zinc-200 hover:bg-zinc-800'
                            }`}
                            title={
                              edgeTtsLoadingIndex === index
                                ? 'Synthesizing Neural voice...'
                                : edgeTtsPlayingIndex === index
                                ? 'Stop Edge TTS'
                                : 'Play Neural voice (Edge TTS)'
                            }
                          >
                            {edgeTtsLoadingIndex === index ? (
                              <Loader2 size={13} className="animate-spin text-purple-400" />
                            ) : edgeTtsPlayingIndex === index ? (
                              <Radio size={13} className="animate-pulse" />
                            ) : (
                              <Radio size={13} />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

          {/* Loading indicator */}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-zinc-400 py-2">
              <Loader2 size={14} className="animate-spin text-zinc-400" />
              <span>NEXUS AI is thinking...</span>
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

        {/* Input Bar: Claude-style centered pinned container */}
        <div className="sticky bottom-0 pt-4 pb-1 bg-gradient-to-t from-[#111113] via-[#111113] to-transparent">
          {/* Quick prompts chips if conversation has few messages and user isn't typing */}
          {!isOnlyWelcome && messages.length <= 3 && !input && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2.5 no-scrollbar">
              {QUICK_PROMPTS.slice(0, 3).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  disabled={loading}
                  className="text-xs px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 whitespace-nowrap transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Claude-style Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="rounded-2xl border border-zinc-700/70 bg-[#1e1e21] shadow-lg focus-within:border-zinc-500 transition-all p-2.5 flex flex-col gap-2"
          >
            {/* Input Textarea */}
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
              placeholder="Ask NEXUS AI anything..."
              aria-label="Message NEXUS AI"
              rows={1}
              disabled={loading}
              className="w-full bg-transparent text-zinc-100 placeholder-zinc-500 text-[14.5px] leading-relaxed resize-none outline-none px-2 pt-1 pb-1 min-h-[44px] max-h-[180px]"
            />

            {/* Bottom Controls inside input box */}
            <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60">
              {/* Web Search Toggle (Claude-like placement) */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleWebSearch}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                    webSearchEnabled
                      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                      : 'text-zinc-400 border-transparent hover:text-zinc-300 hover:bg-zinc-800/60'
                  }`}
                  title={
                    webSearchEnabled
                      ? 'Web Search is ON: forces live search on every request'
                      : 'Web Search is Auto: searches when needed'
                  }
                >
                  <Globe
                    size={13}
                    className={webSearchEnabled ? 'text-cyan-400' : 'text-zinc-400'}
                  />
                  <span>Web Search</span>
                  {webSearchEnabled && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  )}
                </button>
              </div>

              {/* Right: Send Button */}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    input.trim() && !loading
                      ? 'bg-zinc-100 text-zinc-900 hover:bg-white cursor-pointer'
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
          <div className="text-center pt-2 pb-0.5 text-[11px] text-zinc-500">
            NEXUS AI · {webSearchEnabled ? 'Live Web Search Active' : 'Automatic Web Search'} · Local Context
          </div>
        </div>
      </main>

      {/* Memory Management Modal */}
      {memoryEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-700/80 bg-[#19191c] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Brain size={16} className="text-cyan-400" />
                <h3 className="text-sm font-semibold text-zinc-100">
                  Memory Management
                </h3>
              </div>
              <span className="text-[11px] text-zinc-500">
                {memoryDraft.length}/{MAX_MEMORY_LENGTH}
              </span>
            </div>

            <p className="text-xs text-zinc-400">
              Saved locally on this device. Edit notes or context you want NEXUS AI to remember across sessions.
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
    </div>
  );
}
