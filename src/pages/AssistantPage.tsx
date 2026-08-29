import { useEffect, useState, useRef, useCallback } from 'react';
import { Bot, Send, Sparkles, User, Trash2, Plus, Brain, BookOpen, Globe, ExternalLink, Cpu, AlertTriangle, Check, Volume2, VolumeX, Radio, Loader2, Copy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/services/api';
import { storage } from '@/lib/storage';
import { ErrorMessage } from '@/components';
import type { AISource } from '@/types';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  tool?: 'none' | 'search' | 'weather';
  sources?: AISource[];
  weather?: unknown;
};

const CHAT_KEY = 'nexus-ai-conversation-v2';
const MEMORY_KEY = 'nexus-ai-smart-memory-v1';

const RECENT_MESSAGES = 8;
const MAX_MEMORY_LENGTH = 1200;

const QUICK_PROMPTS = [
  'Explain something simply',
  'Help me solve a problem',
  'Give me productivity tips',
  'Summarize a topic',
];

const welcomeMessage: Message = {
  role: 'assistant',
  content:
    "Hi! I'm NEXUS AI. Ask me anything and I'll help with explanations, ideas, problem solving, summaries, and more.",
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
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const edgeTtsAudioRef = useRef<HTMLAudioElement | null>(null);

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

  const handleCopyText = useCallback((text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
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

  const sendMessage = async (value = input) => {
    const message = value.trim();

    if (!message || loading) return;

    setInput('');
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

    try {
      const response = await api.aiChat(
        message,
        historyForRequest,
        smartMemory,
      );

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.answer,
        tool: response.tool,
        sources: response.sources,
        weather: response.weather,
      };

      setMessages((current) => [...current, assistantMessage]);

      // Keep a compact local memory instead of sending the full conversation.
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

  return (
    <div className="assistant-page max-w-5xl mx-auto px-4 py-8 relative">
      <div className="page-intro relative mb-8">
        <div className="absolute -top-12 left-1/3 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
        <div className="absolute top-0 right-10 w-80 h-80 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDuration: '7s' }} />

        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="eyebrow">NEXUS AI</span>
        </div>
        <h1>Ask the intelligence.</h1>
        <p className="text-slate-300 font-medium sm:text-base">
          Chat with NEXUS AI for answers, explanations, ideas,
          summaries, and problem solving.
        </p>
      </div>

      <section
        className="assistant-shell relative overflow-hidden shadow-2xl"
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '68vh',
          border: '1px solid rgba(97,221,210,0.25)',
          borderRadius: 24,
          overflow: 'hidden',
          background: 'rgba(5,18,24,0.85)',
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* Ambient neural grid glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-cyan-500/15 via-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '18px 22px',
            borderBottom: '1px solid rgba(255,255,255,.08)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 14,
                color: '#61ddd2',
                background: 'rgba(97,221,210,.12)',
                border: '1px solid rgba(97,221,210,.3)',
                boxShadow: '0 0 20px rgba(97,221,210,0.2)',
              }}
            >
              <Bot size={22} className="animate-pulse" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <strong className="text-white tracking-wide text-base">NEXUS AI</strong>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-mono text-cyan-300">
                  Neural Active
                </span>
              </div>

              <Link
                to="/settings?tab=ai"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  opacity: 0.85,
                  marginTop: 3,
                  fontSize: 11,
                  color: '#61ddd2',
                  textDecoration: 'none',
                }}
                title="Configure AI Providers & Keys in Settings"
              >
                <Cpu size={12} />
                <span>
                  {(() => {
                    const prov = storage.getActiveAIProvider();
                    if (!prov) return 'Existing AI (Default)';
                    return `${prov.name} (${prov.keys.length} ${prov.keys.length === 1 ? 'key' : 'keys'})`;
                  })()}
                </span>
              </Link>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="hover:border-cyan-500/40 transition-all text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-200 flex items-center gap-1.5"
              onClick={newChat}
              aria-label="New chat"
              title="Start a new chat session"
              type="button"
            >
              <Plus size={15} className="text-cyan-400" />
              <span>New Chat</span>
            </button>

            <button
              className="hover:border-red-500/40 transition-all text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 flex items-center gap-1.5"
              onClick={() => setShowClearConfirm(true)}
              aria-label="Clear chat"
              title="Clear conversation and memory"
              type="button"
            >
              <Trash2 size={15} />
              <span>Clear Chat</span>
            </button>
          </div>
        </header>

        {/* Cleared Toast */}
        {clearedToast && (
          <div className="bg-cyan-500/15 border-b border-cyan-500/30 px-6 py-2.5 flex items-center gap-2 text-cyan-300 text-xs font-medium">
            <Check size={15} />
            <span>Chat history and memory have been cleared successfully.</span>
          </div>
        )}

        {/* Clear Confirmation Prompt */}
        {showClearConfirm && (
          <div className="bg-red-950/90 border-b border-red-500/40 px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={17} className="text-red-400 shrink-0" />
              <div>
                <div className="text-white text-xs font-bold">Clear entire conversation and memory?</div>
                <div className="text-red-200/70 text-[11px]">All chat messages and local AI context will be removed.</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearChat}
                className="px-3 py-1 rounded-md text-xs font-bold bg-red-600 text-white hover:bg-red-500 flex items-center gap-1"
              >
                <Trash2 size={12} />
                Yes, Clear All
              </button>
            </div>
          </div>
        )}

        <div
          style={{
            padding: '12px 22px',
            borderBottom: '1px solid rgba(255,255,255,.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              opacity: 0.8,
            }}
          >
            <Brain size={15} className="text-cyan-400" />
            <span className="text-slate-300">
              {smartMemory
                ? '🧠 Memory saved locally & active'
                : '✨ No saved memories yet'}
            </span>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={openMemoryEditor}
            title="Manage memory"
            aria-label="Manage memory"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              borderRadius: 10,
              background: 'rgba(97,221,210,0.1)',
              borderColor: 'rgba(97,221,210,0.3)',
              color: '#61ddd2',
            }}
          >
            <Brain size={14} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>Manage Memory</span>
          </button>
        </div>

        {memoryEditorOpen && (
          <div
            style={{
              margin: '12px 18px',
              padding: 14,
              borderRadius: 14,
              border: '1px solid rgba(97,221,210,.18)',
              background: 'rgba(97,221,210,.045)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                marginBottom: 8,
              }}
            >
              <strong style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Brain size={16} />
                AI Memory
              </strong>

              <small style={{ opacity: 0.5 }}>
                Stored on this device
              </small>
            </div>

            <p style={{ fontSize: 12, opacity: 0.6, margin: '0 0 10px' }}>
              Edit what NEXUS AI should remember. Keep it short and useful.
            </p>

            <textarea
              value={memoryDraft}
              onChange={(event) => setMemoryDraft(event.target.value)}
              maxLength={MAX_MEMORY_LENGTH}
              placeholder="Example: My name is Alex. I like space photography."
              rows={5}
              style={{
                width: '100%',
                resize: 'vertical',
                boxSizing: 'border-box',
                padding: 12,
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,.1)',
                background: 'rgba(0,0,0,.2)',
                color: '#e8f0f2',
                outline: 'none',
                font: 'inherit',
              }}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                marginTop: 10,
                flexWrap: 'wrap',
              }}
            >
              <small style={{ opacity: 0.45 }}>
                {memoryDraft.length}/{MAX_MEMORY_LENGTH}
              </small>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setMemoryEditorOpen(false)}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="icon-button"
                  onClick={clearMemory}
                  title="Delete all memory"
                >
                  <Trash2 size={14} />
                  Clear
                </button>

                <button
                  type="button"
                  className="icon-button"
                  onClick={saveMemory}
                  title="Save memory"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        <div
          style={{
            padding: '8px 18px',
            borderBottom: '1px solid rgba(255,255,255,.05)',
            fontSize: 12,
            opacity: 0.55,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Brain size={14} />
          {smartMemory
            ? 'Smart memory active · recent context only'
            : 'Smart memory ready'}
        </div>

        <div
          style={{
            flex: 1,
            padding: 18,
            overflowY: 'auto',
          }}
        >
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              style={{
                display: 'flex',
                justifyContent:
                  message.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  maxWidth: '88%',
                  flexDirection:
                    message.role === 'user' ? 'row-reverse' : 'row',
                }}
              >
                <span
                  style={{
                    flex: '0 0 auto',
                    width: 32,
                    height: 32,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 10,
                    color:
                      message.role === 'user'
                        ? '#8fa4ad'
                        : '#61ddd2',
                    background:
                      message.role === 'user'
                        ? 'rgba(255,255,255,.06)'
                        : 'rgba(97,221,210,.1)',
                  }}
                >
                  {message.role === 'user' ? (
                    <User size={16} />
                  ) : (
                    <Sparkles size={16} />
                  )}
                </span>

                <div style={{ width: '100%' }}>
                  {message.role === 'assistant' && message.tool === 'search' && (
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.7,
                        marginBottom: 6,
                        color: '#61ddd2',
                      }}
                    >
                      🔎 NEXUS Search
                    </div>
                  )}

                  {message.role === 'assistant' && message.tool === 'weather' && (
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.7,
                        marginBottom: 6,
                        color: '#61ddd2',
                      }}
                    >
                      🌤️ Weather data
                    </div>
                  )}

                  {message.role === 'assistant' &&
                    message.tool === 'weather' &&
                    message.weather &&
                    typeof message.weather === 'object' ? (() => {
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

                    const current = weather.current;

                    if (!current) return null;

                    return (
                      <div
                        style={{
                          marginTop: 10,
                          marginBottom: 10,
                          padding: '12px 14px',
                          borderRadius: 14,
                          background: 'rgba(97,221,210,.055)',
                          border: '1px solid rgba(97,221,210,.14)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#61ddd2',
                            marginBottom: 8,
                          }}
                        >
                          🌤️ Weather data
                        </div>

                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            marginBottom: 8,
                          }}
                        >
                          📍 {current.location ?? 'Selected location'}
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 7,
                            fontSize: 12,
                            opacity: 0.85,
                          }}
                        >
                          <div>
                            🌡️ {current.temperature ?? '—'}°C
                            {typeof current.feelsLike === 'number'
                              ? ` · Feels like ${current.feelsLike}°C`
                              : ''}
                          </div>

                          <div>
                            ☁️ {current.conditionLabel ?? '—'}
                          </div>

                          <div>
                            💧 Humidity {current.humidity ?? '—'}%
                          </div>

                          <div>
                            🌧️ Rain {current.rainProbability ?? '—'}%
                          </div>
                        </div>
                      </div>
                    );
                  })() : null}

                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 15,
                    lineHeight: 1.55,
                    fontSize: 14,
                    whiteSpace: 'pre-wrap',
                    color: '#e8f0f2',
                    background:
                      message.role === 'user'
                        ? 'rgba(97,221,210,.12)'
                        : 'rgba(255,255,255,.055)',
                    border: '1px solid rgba(255,255,255,.07)',
                  }}
                >
                    {message.content}
                  </div>

                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-1.5 mt-2.5">
                      <button
                        type="button"
                        onClick={() => toggleBrowserSpeak(message.content, index)}
                        className={`p-1.5 rounded-full transition-all duration-200 flex items-center justify-center ${
                          speakingIndex === index
                            ? 'bg-cyan-400 text-slate-950 shadow-[0_0_12px_#61d7c9]'
                            : 'text-slate-300 hover:text-cyan-300 hover:bg-cyan-500/15'
                        }`}
                        title={speakingIndex === index ? 'Stop Voice' : 'Read Aloud (Browser Voice)'}
                      >
                        {speakingIndex === index ? <VolumeX size={14} /> : <Volume2 size={14} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEdgeTtsSpeak(message.content, index)}
                        disabled={edgeTtsLoadingIndex === index}
                        className={`p-1.5 rounded-full transition-all duration-200 flex items-center justify-center ${
                          edgeTtsPlayingIndex === index
                            ? 'bg-purple-400 text-slate-950 shadow-[0_0_12px_#c084fc]'
                            : 'text-slate-300 hover:text-purple-300 hover:bg-purple-500/15'
                        }`}
                        title={
                          edgeTtsLoadingIndex === index
                            ? 'Generating Neural Audio...'
                            : edgeTtsPlayingIndex === index
                            ? 'Stop Edge TTS Audio'
                            : 'Play Edge TTS Neural Voice'
                        }
                      >
                        {edgeTtsLoadingIndex === index ? (
                          <Loader2 size={14} className="animate-spin text-purple-400" />
                        ) : edgeTtsPlayingIndex === index ? (
                          <Radio size={14} className="animate-pulse" />
                        ) : (
                          <Radio size={14} />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyText(message.content, index)}
                        className="p-1.5 rounded-full text-slate-300 hover:text-cyan-300 hover:bg-cyan-500/15 transition-colors flex items-center justify-center"
                        title="Copy message"
                      >
                        {copiedIndex === index ? <Check size={14} className="text-cyan-400" /> : <Copy size={14} />}
                      </button>
                    </div>
                  )}

                  {message.role === 'assistant' &&
                    message.sources?.length ? (
                    <div
                      style={{
                        display: 'grid',
                        gap: 8,
                        marginTop: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: '#61ddd2',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Sparkles size={12} /> Verified Sources
                      </div>
                      {message.sources.slice(0, 5).map((source, sourceIndex) => {
                        const isWiki =
                          source.type === 'wikipedia' ||
                          source.domain?.toLowerCase().includes('wikipedia');
                        return (
                          <a
                            key={`${source.url}-${sourceIndex}`}
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'block',
                              padding: '10px 14px',
                              borderRadius: 12,
                              textDecoration: 'none',
                              color: 'inherit',
                              background: isWiki
                                ? 'rgba(97, 215, 201, 0.08)'
                                : 'rgba(255,255,255,.035)',
                              border: isWiki
                                ? '1px solid rgba(97, 215, 201, 0.28)'
                                : '1px solid rgba(255,255,255,.07)',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                                marginBottom: 4,
                              }}
                            >
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  letterSpacing: '0.06em',
                                  textTransform: 'uppercase',
                                  color: isWiki ? '#61ddd2' : '#81949e',
                                  background: isWiki
                                    ? 'rgba(97, 215, 201, 0.15)'
                                    : 'rgba(255,255,255,0.06)',
                                  padding: '2px 7px',
                                  borderRadius: 4,
                                }}
                              >
                                {isWiki ? (
                                  <>
                                    <BookOpen size={11} /> Wikipedia
                                  </>
                                ) : (
                                  <>
                                    <Globe size={11} /> {source.domain || 'Web'}
                                  </>
                                )}
                              </span>
                              <ExternalLink size={12} style={{ opacity: 0.5 }} />
                            </div>

                            <strong
                              style={{
                                display: 'block',
                                fontSize: 13,
                                marginBottom: 3,
                                color: '#e8f0f2',
                              }}
                            >
                              {source.title}
                            </strong>

                            {source.description && (
                              <span
                                style={{
                                  display: 'block',
                                  fontSize: 12,
                                  lineHeight: 1.4,
                                  opacity: 0.75,
                                  color: '#a5cfd6',
                                }}
                              >
                                {source.description}
                              </span>
                            )}
                          </a>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                opacity: 0.7,
                padding: '8px 0',
              }}
            >
              <Sparkles size={17} />
              <span>NEXUS AI is thinking...</span>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 8 }}>
              <ErrorMessage message={error} />
            </div>
          )}
        </div>

        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(255,255,255,.07)',
          }}
        >
          {!input && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                paddingBottom: 10,
              }}
            >
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="secondary-button"
                  onClick={() => sendMessage(prompt)}
                  disabled={loading}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 10,
            }}
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask NEXUS AI anything..."
              aria-label="Message NEXUS AI"
              rows={1}
              disabled={loading}
              style={{
                flex: 1,
                resize: 'none',
                minHeight: 48,
                maxHeight: 140,
                padding: '13px 14px',
                borderRadius: 13,
                border: '1px solid rgba(97,221,210,.2)',
                background: 'rgba(5,18,23,.8)',
                color: 'inherit',
                font: 'inherit',
                outline: 'none',
              }}
            />

            <button
              className="search-submit"
              type="submit"
              disabled={!input.trim() || loading}
              aria-label="Send message"
              style={{
                minWidth: 50,
                minHeight: 48,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Send size={18} />
            </button>
          </form>

          <small
            style={{
              display: 'block',
              textAlign: 'center',
              opacity: 0.42,
              fontSize: 11,
              marginTop: 8,
            }}
          >
            Recent context + compact memory · saved on this device
          </small>
        </div>
      </section>
    </div>
  );
}
