import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Send,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  Cpu,
  Layers,
  AlertCircle,
  Plus,
  AlertTriangle,
  Volume2,
  VolumeX,
  Mic,
  Zap,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { runJarvisPipeline } from '@/services/jarvisOrchestrator';
import { JarvisHudHeader } from './JarvisHudHeader';
import { JarvisCoreVisualizer } from './JarvisCoreVisualizer';
import { JarvisTopologyMatrix } from './JarvisTopologyMatrix';
import { JarvisCategoryDeck } from './JarvisCategoryDeck';
import { JarvisQuantumOrb } from './JarvisQuantumOrb';
import type {
  JarvisExecutionStep,
  JarvisMessage,
  JarvisSystemConfig,
} from '@/types';

interface JarvisChatProps {
  config: JarvisSystemConfig;
  onOpenSettings?: () => void;
}

// Agent Color Mapping for colorful badges and glowing nodes
const AGENT_COLORS: Record<string, { bg: string; border: string; text: string; glow: string; gradient: string }> = {
  planner: {
    bg: 'rgba(52, 211, 153, 0.15)',
    border: 'rgba(52, 211, 153, 0.45)',
    text: '#34d399',
    glow: 'rgba(52, 211, 153, 0.3)',
    gradient: 'linear-gradient(135deg, rgba(52,211,153,0.3) 0%, rgba(16,185,129,0.15) 100%)',
  },
  researcher: {
    bg: 'rgba(56, 189, 248, 0.15)',
    border: 'rgba(56, 189, 248, 0.45)',
    text: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.3)',
    gradient: 'linear-gradient(135deg, rgba(56,189,248,0.3) 0%, rgba(14,165,233,0.15) 100%)',
  },
  factChecker: {
    bg: 'rgba(168, 85, 247, 0.15)',
    border: 'rgba(168, 85, 247, 0.45)',
    text: '#c084fc',
    glow: 'rgba(168, 85, 247, 0.3)',
    gradient: 'linear-gradient(135deg, rgba(168,85,247,0.3) 0%, rgba(147,51,234,0.15) 100%)',
  },
  reviewer: {
    bg: 'rgba(251, 191, 36, 0.15)',
    border: 'rgba(251, 191, 36, 0.45)',
    text: '#fbbf24',
    glow: 'rgba(251, 191, 36, 0.3)',
    gradient: 'linear-gradient(135deg, rgba(251,191,36,0.3) 0%, rgba(245,158,11,0.15) 100%)',
  },
  synthesizer: {
    bg: 'rgba(244, 63, 94, 0.15)',
    border: 'rgba(244, 63, 94, 0.45)',
    text: '#fb7185',
    glow: 'rgba(244, 63, 94, 0.3)',
    gradient: 'linear-gradient(135deg, rgba(244,63,94,0.3) 0%, rgba(225,29,72,0.15) 100%)',
  },
};

function getAgentColor(agentId: string) {
  return (
    AGENT_COLORS[agentId] || {
      bg: 'rgba(97, 215, 201, 0.15)',
      border: 'rgba(97, 215, 201, 0.4)',
      text: '#61d7c9',
      glow: 'rgba(97, 215, 201, 0.25)',
      gradient: 'linear-gradient(135deg, rgba(97,215,201,0.25) 0%, rgba(56,189,248,0.15) 100%)',
    }
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="text-white font-bold tracking-tight">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="px-2 py-0.5 mx-0.5 rounded-lg font-mono text-xs font-semibold"
          style={{
            background: 'rgba(97,215,201,0.15)',
            color: '#61d7c9',
            border: '1px solid rgba(97,215,201,0.3)',
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function FormattedText({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  lines.forEach((line, idx) => {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <div key={`code-box-${idx}`} className="my-3 rounded-2xl overflow-hidden border border-cyan-500/30 shadow-lg">
            <div className="bg-slate-950 px-4 py-1.5 border-b border-cyan-500/20 flex items-center justify-between text-[11px] font-mono text-cyan-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                <span className="ml-2">CODE / SYNTAX</span>
              </span>
            </div>
            <pre
              className="p-4 bg-slate-950/90 text-cyan-200 font-mono text-xs overflow-x-auto m-0 leading-relaxed"
            >
              <code>{codeBuffer.join('\n')}</code>
            </pre>
          </div>,
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      elements.push(<div key={`space-${idx}`} className="h-2" />);
      return;
    }

    if (trimmed.startsWith('### ')) {
      elements.push(
        <div key={idx} className="flex items-center gap-2 mt-4 mb-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#61d7c9]" />
          <h4 className="text-base font-bold text-cyan-300 m-0 tracking-wide">
            {trimmed.slice(4)}
          </h4>
        </div>,
      );
      return;
    }

    if (trimmed.startsWith('## ')) {
      elements.push(
        <div key={idx} className="flex items-center gap-2.5 mt-5 mb-2.5 pt-2 border-t border-white/10">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_10px_#38bdf8]" />
          <h3 className="text-lg font-black text-white m-0 tracking-tight">
            {trimmed.slice(3)}
          </h3>
        </div>,
      );
      return;
    }

    if (trimmed.startsWith('# ')) {
      elements.push(
        <div key={idx} className="flex items-center gap-3 mt-6 mb-3">
          <span className="w-3 h-3 rounded-full bg-purple-400 shadow-[0_0_12px_#a855f7]" />
          <h2 className="text-xl font-black text-white m-0 tracking-tight">
            {trimmed.slice(2)}
          </h2>
        </div>,
      );
      return;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      const itemText = trimmed.slice(2);
      return (
        <div key={idx} className="flex items-start gap-2.5 my-1.5 pl-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 shrink-0 shadow-[0_0_6px_#61d7c9]" />
          <span className="flex-1 leading-relaxed text-slate-200 text-sm sm:text-[15px]">
            {renderInline(itemText)}
          </span>
        </div>
      );
    }

    elements.push(
      <p key={idx} className="my-2 leading-relaxed text-slate-200 text-sm sm:text-[15px]">
        {renderInline(line)}
      </p>,
    );
  });

  return <div className="formatted-text-content">{elements}</div>;
}

const QUICK_PROMPT_PILLS = [
  { label: 'Nuclear Fusion Breakthroughs', emoji: '⚛️', color: 'from-cyan-500/20 to-teal-500/20', border: 'border-cyan-400/40', text: 'text-cyan-300' },
  { label: 'Quantum Computing Qubits', emoji: '🔬', color: 'from-purple-500/20 to-indigo-500/20', border: 'border-purple-400/40', text: 'text-purple-300' },
  { label: 'Fact-Check 10% Brain Myth', emoji: '🛡️', color: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-400/40', text: 'text-amber-300' },
  { label: 'AI Silicon: Blackwell vs TPU', emoji: '⚡', color: 'from-emerald-500/20 to-green-500/20', border: 'border-emerald-400/40', text: 'text-emerald-300' },
  { label: 'CRISPR & Prime Gene Editing', emoji: '🧬', color: 'from-rose-500/20 to-pink-500/20', border: 'border-rose-400/40', text: 'text-rose-300' },
];

export function JarvisChat({ config, onOpenSettings }: JarvisChatProps) {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [deepResearch, setDeepResearch] = useState(() => {
    const deepParam = searchParams.get('deep');
    if (deepParam === 'true') return true;
    if (deepParam === 'false') return false;
    return config.deepResearchDefault;
  });
  const [messages, setMessages] = useState<JarvisMessage[]>(() => {
    const stored = storage.getJarvisMessages();
    return [...stored].sort((a, b) => a.timestamp - b.timestamp);
  });
  const [currentRunningMessageId, setCurrentRunningMessageId] = useState<string | null>(null);
  const [activeSteps, setActiveSteps] = useState<JarvisExecutionStep[]>([]);
  const [expandedStepsMap, setExpandedStepsMap] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearedBanner, setClearedBanner] = useState(false);
  const [activeView, setActiveView] = useState<'chat' | 'topology' | 'categories' | 'reactor'>('chat');
  const [voiceListening, setVoiceListening] = useState(false);
  const initialHandledRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isRunning = Boolean(currentRunningMessageId);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages, activeSteps, isRunning, scrollToBottom]);

  const toggleStepDetails = (id: string) => {
    setExpandedStepsMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleSelectPromptFromDeck = (prompt: string) => {
    setActiveView('chat');
    handleSend(prompt);
  };

  const handleSend = useCallback(
    async (textToSend?: string) => {
      const prompt = (textToSend || query).trim();
      if (!prompt || isRunning) return;

      setActiveView('chat');
      const messageId = `jarvis-${Date.now()}`;
      const initialMessage: JarvisMessage = {
        id: messageId,
        query: prompt,
        answer: '',
        timestamp: Date.now(),
        deepResearch,
        steps: [],
      };

      // Append new messages to the bottom (WhatsApp-style chronological order)
      setMessages((prev) => [...prev, initialMessage]);
      setQuery('');
      setCurrentRunningMessageId(messageId);
      setActiveSteps([]);

      try {
        const result = await runJarvisPipeline(prompt, config, deepResearch, (updatedStep) => {
          setActiveSteps((prev) => {
            const idx = prev.findIndex((s) => s.agentId === updatedStep.agentId);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = updatedStep;
              return next;
            }
            return [...prev, updatedStep];
          });
        });

        const completedMessage: JarvisMessage = {
          id: messageId,
          query: prompt,
          answer: result.answer,
          timestamp: Date.now(),
          deepResearch,
          steps: result.steps,
          sources: result.sources,
          error: result.error,
        };

        setMessages((prev) => {
          const next = prev.map((m) => (m.id === messageId ? completedMessage : m));
          storage.saveJarvisMessages(next);
          return next;
        });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Execution failed';
        const failedMessage: JarvisMessage = {
          id: messageId,
          query: prompt,
          answer: 'Sorry, I encountered an issue during multi-agent execution.',
          timestamp: Date.now(),
          deepResearch,
          steps: activeSteps,
          error: errMsg,
        };

        setMessages((prev) => {
          const next = prev.map((m) => (m.id === messageId ? failedMessage : m));
          storage.saveJarvisMessages(next);
          return next;
        });
      } finally {
        setCurrentRunningMessageId(null);
      }
    },
    [query, isRunning, deepResearch, config, activeSteps],
  );

  useEffect(() => {
    if (initialHandledRef.current) return;
    initialHandledRef.current = true;

    const urlQuery = searchParams.get('q');
    if (urlQuery && urlQuery.trim()) {
      handleSend(urlQuery.trim());
    }
  }, [searchParams, handleSend]);

  // Clean stop for text-to-speech
  const stopSpeak = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Safe fallback
      }
    }
    utteranceRef.current = null;
    setSpeakingId(null);
  }, []);

  // Text-To-Speech Synthesis with persistent ref and replay fix
  const toggleSpeak = useCallback(
    (text: string, id: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

      // If user taps the active message, stop playback
      if (speakingId === id) {
        stopSpeak();
        return;
      }

      // Stop any existing speech and wake engine up from idle/paused state
      try {
        window.speechSynthesis.cancel();
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch {
        // Safe fallback
      }

      // Clean markdown tags for natural speech
      const cleanText = text
        .replace(/```[\s\S]*?```/g, ' Code snippet omitted. ')
        .replace(/[*#`_~>[\]()]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText.slice(0, 1000));
      utteranceRef.current = utterance; // Prevent garbage-collection bug

      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';

      utterance.onstart = () => {
        setSpeakingId(id);
      };

      utterance.onend = () => {
        utteranceRef.current = null;
        setSpeakingId((cur) => (cur === id ? null : cur));
      };

      utterance.onerror = () => {
        utteranceRef.current = null;
        setSpeakingId((cur) => (cur === id ? null : cur));
      };

      setSpeakingId(id);

      // Timeout allows engine state to settle cleanly before initiating speak
      setTimeout(() => {
        try {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
          window.speechSynthesis.speak(utterance);
        } catch {
          utteranceRef.current = null;
          setSpeakingId(null);
        }
      }, 40);
    },
    [speakingId, stopSpeak],
  );

  // Clean up speech synthesis on component unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Safe fallback
        }
      }
    };
  }, []);

  // Voice Input (Speech Recognition)
  const toggleVoiceInput = () => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: typeof window.webkitSpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: typeof window.webkitSpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (voiceListening) {
      setVoiceListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setVoiceListening(true);
      recognition.onend = () => setVoiceListening(false);
      recognition.onerror = () => setVoiceListening(false);
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setQuery((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.start();
    } catch {
      setVoiceListening(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleConfirmClearChat = () => {
    stopSpeak();
    storage.clearJarvisMessages();
    setMessages([]);
    setShowClearConfirm(false);
    setClearedBanner(true);
    setTimeout(() => setClearedBanner(false), 3000);
  };

  const handleDeleteMessage = (messageId: string) => {
    if (speakingId === messageId) {
      stopSpeak();
    }
    setMessages((prev) => {
      const filtered = prev.filter((m) => m.id !== messageId);
      storage.saveJarvisMessages(filtered);
      return filtered;
    });
  };

  const handleNewChat = () => {
    setQuery('');
    setShowClearConfirm(false);
    inputRef.current?.focus();
  };

  return (
    <div className="jarvis-chat-console-wrapper flex flex-col gap-6 w-full max-w-5xl mx-auto pb-64 sm:pb-60">
      {/* Top Futuristic HUD Header */}
      <JarvisHudHeader
        config={config}
        isRunning={isRunning}
        activeView={activeView}
        onSelectView={setActiveView}
        messageCount={messages.length}
      />

      {/* Render Dedicated Sub-View when switched */}
      {activeView === 'topology' && (
        <JarvisTopologyMatrix
          config={config}
          activeSteps={activeSteps}
          onOpenSettings={onOpenSettings}
          onSelectPrompt={handleSelectPromptFromDeck}
        />
      )}

      {activeView === 'categories' && (
        <JarvisCategoryDeck onSelectPrompt={handleSelectPromptFromDeck} />
      )}

      {activeView === 'reactor' && (
        <JarvisCoreVisualizer
          config={config}
          isRunning={isRunning}
          onLaunchPrompt={handleSelectPromptFromDeck}
        />
      )}

      {/* ========================================================= */}
      {/* TOP JARVIS HEADER & QUANTUM CORE (ONLINE STANDBY)          */}
      {/* ========================================================= */}
      <div
        className="relative overflow-hidden rounded-3xl p-5 sm:p-7 backdrop-blur-xl transition-all duration-300"
        style={{
          background: 'linear-gradient(145deg, rgba(8, 20, 36, 0.88) 0%, rgba(14, 18, 48, 0.92) 50%, rgba(6, 26, 38, 0.88) 100%)',
          border: '1px solid rgba(97, 215, 201, 0.35)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 32px rgba(97,215,201,0.12), inset 0 1px 0 rgba(255,255,255,0.15)',
        }}
      >
        {/* Ambient Top Glow Orbs */}
        <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 left-1/3 w-64 h-32 rounded-full bg-sky-500/15 blur-3xl pointer-events-none" />

        {/* Central JARVIS Animated 3D Quantum Orb Ball with Color Graphics */}
        <div className="relative z-10 flex flex-col items-center justify-center">
          <JarvisQuantumOrb
            size={isRunning ? 'lg' : 'md'}
            isRunning={isRunning}
            isListening={voiceListening}
            query={query}
            onClick={() => inputRef.current?.focus()}
          />
        </div>
      </div>

      {/* When in chat mode and no messages yet, display the full Category Matrix Deck */}
      {messages.length === 0 && !isRunning && activeView === 'chat' && (
        <JarvisCategoryDeck onSelectPrompt={handleSelectPromptFromDeck} />
      )}

      {/* ========================================================= */}
      {/* ACTIVE 5-AGENT PIPELINE RUNNING VISUALIZER (ROUNDED/COLOR)*/}
      {/* ========================================================= */}
      {isRunning && (
        <div
          className="relative overflow-hidden rounded-3xl p-6 backdrop-blur-xl transition-all duration-300 animate-pulse"
          style={{
            background: 'linear-gradient(135deg, rgba(8, 26, 42, 0.9) 0%, rgba(18, 16, 52, 0.92) 100%)',
            border: '1.5px solid rgba(97, 215, 201, 0.5)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 28px rgba(97,215,201,0.25)',
          }}
        >
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-cyan-400/20 border border-cyan-400/50 flex items-center justify-center shadow-[0_0_12px_#61d7c9]">
                <Sparkles size={16} className="text-cyan-300" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-white m-0 tracking-wide">
                  JARVIS Multi-Agent Pipeline In Progress
                </h4>
                <p className="text-[11px] text-cyan-300/80 font-mono m-0">
                  Live Neural Orchestration & Cross-Verification
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-mono font-bold">
              ENGAGED
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
            {activeSteps.map((step) => {
              const colorInfo = getAgentColor(step.agentId);
              const isRunningStep = step.status === 'running';
              const isCompleted = step.status === 'completed';
              const isFailed = step.status === 'failed';

              return (
                <div
                  key={step.agentId}
                  className="p-3 rounded-2xl transition-all duration-300 flex items-center gap-2.5"
                  style={{
                    background: isRunningStep
                      ? colorInfo.gradient
                      : isCompleted
                        ? colorInfo.bg
                        : 'rgba(5, 15, 25, 0.65)',
                    border: isRunningStep
                      ? `1.5px solid ${colorInfo.text}`
                      : isCompleted
                        ? `1px solid ${colorInfo.border}`
                        : isFailed
                          ? '1px solid #f43f5e'
                          : '1px solid rgba(255,255,255,0.08)',
                    boxShadow: isRunningStep ? `0 0 16px ${colorInfo.glow}` : 'none',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: colorInfo.bg,
                      border: `1px solid ${colorInfo.border}`,
                    }}
                  >
                    <span className="text-base">{step.icon}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {step.name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      {step.model}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isRunningStep && <Loader2 size={15} className="animate-spin text-cyan-300" />}
                    {isCompleted && (
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: colorInfo.bg, color: colorInfo.text }}
                      >
                        ✓
                      </span>
                    )}
                    {isFailed && <span className="text-rose-400 text-xs font-bold">✕</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MESSAGES LIST (CHRONOLOGICAL: OLDEST TOP -> NEWEST BOTTOM) */}
      {/* ========================================================= */}
      <div className="flex flex-col gap-6 w-full">
        {messages.map((msg) => {
          const isMsgRunning = msg.id === currentRunningMessageId;
          if (isMsgRunning) return null; // Handled above in live visualizer

          return (
            <div key={msg.id} className="flex flex-col gap-3 w-full">
              {/* ---------------------------------------------------- */}
              {/* 1. USER PROMPT BUBBLE (ROUNDED & COLORFUL GRADIENT)  */}
              {/* ---------------------------------------------------- */}
              <div className="flex items-start justify-end gap-3 self-end max-w-3xl w-full">
                <div
                  className="relative p-4 sm:p-5 rounded-3xl rounded-tr-md backdrop-blur-md transition-all shadow-xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.6) 0%, rgba(88, 28, 135, 0.5) 100%)',
                    border: '1.5px solid rgba(147, 197, 253, 0.35)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(99, 102, 241, 0.2)',
                  }}
                >
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <span className="text-[10px] font-mono tracking-widest text-indigo-200 uppercase font-bold">
                      INQUIRY
                    </span>
                    {msg.deepResearch && (
                      <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-[10px] font-mono font-bold">
                        ⚡ DEEP RESEARCH
                      </span>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white m-0 leading-relaxed">
                    {msg.query}
                  </h3>
                </div>

                {/* User Avatar Circle */}
                <div
                  className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center mt-1 shadow-lg"
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    boxShadow: '0 0 14px rgba(59, 130, 246, 0.5)',
                  }}
                >
                  <span className="text-white text-xs font-black">YOU</span>
                </div>
              </div>

              {/* ---------------------------------------------------- */}
              {/* 2. JARVIS AI RESPONSE CARD (ROUNDED & HOLOGRAPHIC)   */}
              {/* ---------------------------------------------------- */}
              <div className="flex items-start gap-3 w-full">
                {/* JARVIS Avatar Node */}
                <div
                  className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center mt-1 shadow-lg"
                  style={{
                    background: 'linear-gradient(135deg, #061826 0%, #0d223a 100%)',
                    border: '1.5px solid rgba(97, 215, 201, 0.6)',
                    boxShadow: '0 0 16px rgba(97, 215, 201, 0.4)',
                  }}
                >
                  <Zap size={18} className="text-cyan-300 animate-pulse" />
                </div>

                {/* Response Container */}
                <div
                  className="flex-1 min-w-0 p-5 sm:p-7 rounded-3xl rounded-tl-md backdrop-blur-xl shadow-2xl transition-all duration-300"
                  style={{
                    background: 'linear-gradient(145deg, rgba(8, 22, 38, 0.9) 0%, rgba(12, 18, 48, 0.94) 100%)',
                    border: '1.5px solid rgba(97, 215, 201, 0.35)',
                    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.55), 0 0 28px rgba(97, 215, 201, 0.12)',
                  }}
                >
                  {/* Response Header & Utilities Bar */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-3 mb-4 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/35 text-[10px] font-mono tracking-widest text-cyan-300 font-bold uppercase">
                        <Sparkles size={12} className="text-cyan-400" />
                        <span>JARVIS SYNTHESIS</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Action Buttons: Speak, Copy, Delete */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleSpeak(msg.answer, msg.id)}
                        className={`p-2 rounded-full transition-all duration-200 flex items-center justify-center ${
                          speakingId === msg.id
                            ? 'bg-cyan-400 text-slate-950 shadow-[0_0_12px_#61d7c9]'
                            : 'text-slate-300 hover:text-cyan-300 hover:bg-cyan-500/15'
                        }`}
                        title={speakingId === msg.id ? 'Stop Voice' : 'Read Aloud'}
                      >
                        {speakingId === msg.id ? <VolumeX size={15} /> : <Volume2 size={15} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopy(msg.answer, msg.id)}
                        className="p-2 rounded-full text-slate-300 hover:text-cyan-300 hover:bg-cyan-500/15 transition-colors flex items-center justify-center"
                        title="Copy synthesis"
                      >
                        {copiedId === msg.id ? <Check size={15} className="text-cyan-400" /> : <Copy size={15} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="p-2 rounded-full text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 transition-colors flex items-center justify-center"
                        title="Delete inquiry"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Multi-Agent Execution Breakdown Accordion (Rounded & Colorful) */}
                  {msg.steps && msg.steps.length > 0 && (
                    <div className="mb-5 rounded-2xl overflow-hidden border border-cyan-500/25 bg-black/40 shadow-md">
                      <button
                        type="button"
                        onClick={() => toggleStepDetails(msg.id)}
                        className="w-full px-4 py-2.5 bg-cyan-950/40 hover:bg-cyan-900/40 flex items-center justify-between text-xs font-bold text-cyan-200 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Layers size={14} className="text-cyan-400" />
                          <span>
                            5-Agent Pipeline: {msg.steps.filter((s) => s.status === 'completed').length} executed,{' '}
                            {msg.steps.filter((s) => s.status === 'skipped').length} skipped
                          </span>
                        </div>
                        {expandedStepsMap[msg.id] ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>

                      {expandedStepsMap[msg.id] && (
                        <div className="p-3 flex flex-col gap-2 border-t border-cyan-500/20">
                          {msg.steps.map((s) => {
                            const colorInfo = getAgentColor(s.agentId);
                            return (
                              <div
                                key={s.agentId}
                                className="p-2.5 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs"
                                style={{
                                  background: colorInfo.bg,
                                  border: `1px solid ${colorInfo.border}`,
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <span>{s.icon}</span>
                                  <strong style={{ color: colorInfo.text }}>{s.name}</strong>
                                  <span className="text-[11px] font-mono text-slate-300">
                                    [{s.providerName} / {s.model}]
                                  </span>
                                  {s.usedFallback && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px]">
                                      Failover
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {s.durationMs && (
                                    <span className="text-[10px] font-mono text-slate-400">
                                      {s.durationMs}ms
                                    </span>
                                  )}
                                  <span
                                    className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase"
                                    style={{
                                      background: s.status === 'completed' ? 'rgba(52,211,153,0.2)' : 'rgba(244,63,94,0.2)',
                                      color: s.status === 'completed' ? '#34d399' : '#fb7185',
                                    }}
                                  >
                                    {s.status}
                                  </span>
                                </div>

                                {s.summary && (
                                  <div className="w-full text-slate-300 text-[11px] pl-6">
                                    {s.summary}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error Notification */}
                  {msg.error && (
                    <div className="flex items-center gap-2 p-3 mb-4 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs font-semibold">
                      <AlertCircle size={15} className="text-rose-400 shrink-0" />
                      <span>{msg.error}</span>
                    </div>
                  )}

                  {/* Synthesized Output Body */}
                  <div className="prose prose-invert max-w-none text-slate-100 leading-relaxed text-sm sm:text-base">
                    <FormattedText content={msg.answer} />
                  </div>

                  {/* Cited Sources (Rounded Colorful Tags) */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-white/10 flex flex-col gap-2">
                      <div className="text-[11px] font-mono tracking-wider text-cyan-300/80 uppercase font-bold flex items-center gap-1.5">
                        <Search size={12} className="text-cyan-400" />
                        <span>GROUNDED SOURCES ({msg.sources.length}):</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.map((src, i) => (
                          <a
                            key={i}
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-400/30 hover:border-cyan-300 text-cyan-200 hover:text-white transition-all shadow-sm max-w-[280px] truncate"
                          >
                            <ExternalLink size={11} className="text-cyan-400 shrink-0" />
                            <span className="truncate">{src.title || src.domain || 'Source Reference'}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {/* Auto-scroll bottom target anchor with ample spacing */}
        <div ref={messagesEndRef} className="h-10 w-full pointer-events-none" />
      </div>

      {/* ========================================================= */}
      {/* FIXED POSITIONED BOTTOM "ASK JARVIS" CONSOLE INPUT BAR    */}
      {/* ========================================================= */}
      <div className="jarvis-fixed-bottom-container">
        <div className="jarvis-fixed-bottom-inner">
          <div
            className="relative overflow-hidden rounded-3xl p-3 sm:p-4 backdrop-blur-xl transition-all duration-300"
            style={{
              background: 'linear-gradient(145deg, rgba(8, 20, 36, 0.94) 0%, rgba(14, 18, 48, 0.96) 50%, rgba(6, 26, 38, 0.94) 100%)',
              border: '1px solid rgba(97, 215, 201, 0.4)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.65), 0 0 32px rgba(97,215,201,0.18), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            {/* Ambient Bottom Glow Orbs */}
            <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="relative z-10 flex flex-col gap-2.5 sm:gap-3"
            >
              {/* Main Round Pill Search Input Bar */}
              <div
                className="group relative flex items-center gap-2 p-1.5 sm:p-2.5 rounded-full backdrop-blur-md transition-all duration-300"
                style={{
                  background: 'rgba(5, 15, 28, 0.88)',
                  border: isRunning
                    ? '1.5px solid #38bdf8'
                    : '1.5px solid rgba(97, 215, 201, 0.45)',
                  boxShadow: isRunning
                    ? '0 0 24px rgba(56,189,248,0.4), inset 0 0 12px rgba(56,189,248,0.15)'
                    : '0 8px 28px rgba(0,0,0,0.4), 0 0 16px rgba(97,215,201,0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
                }}
              >
                {/* Glowing Leading Node */}
                <div className="pl-2 sm:pl-3 flex items-center justify-center">
                  <div
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-300"
                    style={{
                      background: 'linear-gradient(135deg, rgba(97,215,201,0.3) 0%, rgba(56,189,248,0.3) 100%)',
                      border: '1px solid rgba(97,215,201,0.5)',
                      boxShadow: '0 0 12px rgba(97,215,201,0.35)',
                    }}
                  >
                    <Zap size={15} className="text-cyan-300 animate-pulse" />
                  </div>
                </div>

                {/* Input Element */}
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask JARVIS anything (multi-agent research, fact check, scientific audit)..."
                  disabled={isRunning}
                  className="flex-1 min-w-0 bg-transparent border-0 outline-none text-white text-xs sm:text-base placeholder:text-slate-400 font-medium px-2 py-1.5"
                />

                {/* Mic / Voice Button */}
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  aria-label="Voice input"
                  title={voiceListening ? 'Stop Listening' : 'Speak Prompt'}
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                    voiceListening
                      ? 'bg-rose-500 text-white shadow-[0_0_16px_#f43f5e] animate-pulse'
                      : 'bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 hover:border-cyan-400/40'
                  }`}
                >
                  <Mic size={16} className={voiceListening ? 'animate-bounce' : ''} />
                </button>

                {/* Submit Pill Button */}
                <button
                  type="submit"
                  disabled={!query.trim() || isRunning}
                  className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-full font-bold text-xs sm:text-sm tracking-wide transition-all duration-300 flex items-center gap-1.5 sm:gap-2 shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  style={{
                    background: isRunning
                      ? 'linear-gradient(135deg, #38bdf8 0%, #a855f7 100%)'
                      : 'linear-gradient(135deg, #61d7c9 0%, #38bdf8 100%)',
                    color: '#051218',
                    boxShadow: isRunning
                      ? '0 0 20px rgba(56,189,248,0.5)'
                      : '0 0 16px rgba(97,215,201,0.4)',
                  }}
                >
                  {isRunning ? (
                    <Loader2 size={15} className="animate-spin text-slate-950" />
                  ) : (
                    <Send size={14} className="text-slate-950" />
                  )}
                  <span className="font-extrabold hidden xs:inline sm:inline">{isRunning ? 'Orchestrating...' : 'Ask JARVIS'}</span>
                </button>
              </div>

              {/* Controls Hub: Deep Research Switch & Round Action Chips */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-0.5">
                {/* Deep Research Colorful Pill Switch */}
                <label
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full cursor-pointer transition-all duration-200 border"
                  style={{
                    background: deepResearch
                      ? 'linear-gradient(135deg, rgba(97,215,201,0.2) 0%, rgba(56,189,248,0.15) 100%)'
                      : 'rgba(255,255,255,0.03)',
                    borderColor: deepResearch ? 'rgba(97,215,201,0.5)' : 'rgba(255,255,255,0.1)',
                    boxShadow: deepResearch ? '0 0 14px rgba(97,215,201,0.25)' : 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={deepResearch}
                    onChange={(e) => setDeepResearch(e.target.checked)}
                    className="hidden"
                  />
                  <div
                    className={`w-7 h-3.5 rounded-full transition-colors relative flex items-center p-0.5 ${
                      deepResearch ? 'bg-cyan-400' : 'bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-2.5 h-2.5 rounded-full bg-slate-950 transition-transform duration-200 ${
                        deepResearch ? 'translate-x-3.5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                  <span
                    className={`text-[11px] sm:text-xs font-bold font-mono tracking-wide ${
                      deepResearch ? 'text-cyan-300' : 'text-slate-400'
                    }`}
                  >
                    ⚡ DEEP RESEARCH (5-AGENT MESH)
                  </span>
                </label>

                {/* Round Auxiliary Action Chips */}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-400/60 shadow-sm transition-all duration-200"
                    title="Configure Agent parameters, providers and models"
                  >
                    <Cpu size={12} className="text-cyan-400" />
                    <span>Configure Agents</span>
                  </button>

                  {messages.length > 0 && (
                    <button
                      type="button"
                      onClick={handleNewChat}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold text-sky-200 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/30 hover:border-sky-300/60 shadow-sm transition-all duration-200"
                      title="Start a fresh chat"
                    >
                      <Plus size={12} className="text-sky-300" />
                      <span>New Inquiry</span>
                    </button>
                  )}

                  {messages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowClearConfirm(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-400/60 shadow-sm transition-all duration-200"
                      title="Clear conversation history"
                    >
                      <Trash2 size={12} className="text-rose-400" />
                      <span>Clear</span>
                      <span className="px-1.5 py-0.2 rounded-full bg-rose-500/30 text-[10px] font-mono">
                        {messages.length}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Colorful Prompt Pills Carousel */}
              {messages.length === 0 && !isRunning && (
                <div className="pt-1.5 border-t border-white/10 flex flex-col gap-1.5">
                  <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase font-semibold flex items-center gap-1">
                    <Sparkles size={11} className="text-cyan-400" />
                    Suggested Research Tracks:
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                    {QUICK_PROMPT_PILLS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSend(p.label)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gradient-to-r ${p.color} border ${p.border} ${p.text} hover:scale-105 hover:shadow-[0_0_14px_rgba(97,215,201,0.25)] transition-all duration-200`}
                      >
                        <span>{p.emoji}</span>
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cleared Success Feedback Banner */}
              {clearedBanner && (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 text-xs font-bold shadow-md">
                  <CheckCircle2 size={15} className="text-cyan-400" />
                  <span>Conversation history cleared. Ready for your next deep inquiry!</span>
                </div>
              )}

              {/* Clear Confirmation Rounded Modal */}
              {showClearConfirm && (
                <div
                  className="p-3.5 rounded-2xl backdrop-blur-xl flex items-center justify-between flex-wrap gap-2.5 mt-1"
                  style={{
                    background: 'linear-gradient(135deg, rgba(40, 15, 20, 0.95) 0%, rgba(30, 10, 15, 0.95) 100%)',
                    border: '1px solid rgba(244, 63, 94, 0.45)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.5), 0 0 16px rgba(244,63,94,0.2)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-rose-400 shrink-0" />
                    <div>
                      <div className="text-white text-xs font-bold">
                        Clear all {messages.length} {messages.length === 1 ? 'message' : 'messages'} from JARVIS history?
                      </div>
                      <div className="text-rose-200/70 text-[10px]">
                        This will reset the current multi-agent session.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowClearConfirm(false)}
                      className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmClearChat}
                      className="px-3.5 py-1 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1 shadow-lg transition-colors"
                    >
                      <Trash2 size={11} />
                      Yes, Clear All
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}


