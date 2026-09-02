import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Send,
  Loader2,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  Cpu,
  AlertCircle,
  Plus,
  AlertTriangle,
  Volume2,
  VolumeX,
  Mic,
  Zap,
  Search,
  CheckCircle2,
  Bookmark,
  BookmarkCheck,
  Radio,
  Download,
  Code2,
  FileText,
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { stripConversationalMetaText, cleanMarkdownForSpeech } from '@/lib/format';
import { runJarvisPipeline } from '@/services/jarvisOrchestrator';

import { JarvisHudHeader } from './JarvisHudHeader';
import { JarvisCoreVisualizer } from './JarvisCoreVisualizer';
import { JarvisTopologyMatrix } from './JarvisTopologyMatrix';
import { JarvisCategoryDeck } from './JarvisCategoryDeck';
import { JarvisQuantumOrb } from './JarvisQuantumOrb';
import { JarvisPipelineHudTracker } from './JarvisPipelineHudTracker';
import { JarvisTerminalDiagnosticLog } from './JarvisTerminalDiagnosticLog';
import { JarvisCornerBrackets } from './JarvisCornerBrackets';
import { FormattedText } from './FormattedText';
import { JarvisDeepResearchMeshAnswers } from './JarvisDeepResearchMeshAnswers';
import { formatFullPipelineExport } from './formatJarvisPipelineExport';
import { copyToClipboard } from '@/lib/clipboard';
import type {
  JarvisExecutionStep,
  JarvisMessage,
  JarvisSystemConfig,
  SavedItem,
} from '@/types';

const JarvisSvgDiagram = lazy(() =>
  import('./JarvisSvgDiagram').then((m) => ({ default: m.JarvisSvgDiagram }))
);
const JarvisChartCard = lazy(() =>
  import('./JarvisChartCard').then((m) => ({ default: m.JarvisChartCard }))
);
const JarvisImageGallery = lazy(() =>
  import('./JarvisImageGallery').then((m) => ({ default: m.JarvisImageGallery }))
);

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
  architect: {
    bg: 'rgba(245, 158, 11, 0.15)',
    border: 'rgba(245, 158, 11, 0.45)',
    text: '#fbbf24',
    glow: 'rgba(245, 158, 11, 0.35)',
    gradient: 'linear-gradient(135deg, rgba(245,158,11,0.3) 0%, rgba(217,119,6,0.15) 100%)',
  },
  dataAnalyst: {
    bg: 'rgba(56, 189, 248, 0.15)',
    border: 'rgba(56, 189, 248, 0.45)',
    text: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.3)',
    gradient: 'linear-gradient(135deg, rgba(56,189,248,0.3) 0%, rgba(14,165,233,0.15) 100%)',
  },
  imageFinder: {
    bg: 'rgba(236, 72, 153, 0.15)',
    border: 'rgba(236, 72, 153, 0.45)',
    text: '#f472b6',
    glow: 'rgba(236, 72, 153, 0.3)',
    gradient: 'linear-gradient(135deg, rgba(236,72,153,0.3) 0%, rgba(219,39,119,0.15) 100%)',
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
  const [diagramMode, setDiagramMode] = useState(() => {
    const diagParam = searchParams.get('diagram');
    if (diagParam === 'true') return true;
    if (diagParam === 'false') return false;
    return config.diagramModeDefault ?? false;
  });
  const [chartMode, setChartMode] = useState(() => {
    const chartParam = searchParams.get('chart');
    if (chartParam === 'true') return true;
    if (chartParam === 'false') return false;
    return config.chartModeDefault ?? false;
  });
  const [imageMode, setImageMode] = useState(() => {
    const imgParam = searchParams.get('image');
    if (imgParam === 'true') return true;
    if (imgParam === 'false') return false;
    return config.imageModeDefault ?? false;
  });
  const [messages, setMessages] = useState<JarvisMessage[]>(() => {
    const stored = storage.getJarvisMessages();
    return [...stored].sort((a, b) => a.timestamp - b.timestamp);
  });
  const [currentRunningMessageId, setCurrentRunningMessageId] = useState<string | null>(null);
  const [activeSteps, setActiveSteps] = useState<JarvisExecutionStep[]>([]);
  const [expandedStepsMap, setExpandedStepsMap] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => {
    const saved = storage.getSaved();
    return new Set(saved.map((s) => s.id));
  });
  const [recentlySavedId, setRecentlySavedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [edgeTtsLoadingId, setEdgeTtsLoadingId] = useState<string | null>(null);
  const [edgeTtsPlayingId, setEdgeTtsPlayingId] = useState<string | null>(null);
  const [downloadingAudioId, setDownloadingAudioId] = useState<string | null>(null);
  const [downloadSuccessId, setDownloadSuccessId] = useState<string | null>(null);
  const edgeTtsAudioRef = useRef<HTMLAudioElement | null>(null);

  const [synthRawViewMap, setSynthRawViewMap] = useState<Record<string, boolean>>({});
  const [copiedSynthId, setCopiedSynthId] = useState<string | null>(null);


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

  const toggleSynthRawView = (id: string) => {
    setSynthRawViewMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleCopySynth = async (msg: JarvisMessage, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const isShowingRaw = Boolean(synthRawViewMap[msg.id]);
    const synthStep = msg.steps?.find((s) => s.agentId === 'finalSynthesizer');
    const rawContent = synthStep?.rawOutput || msg.answer;
    const rawText = typeof rawContent === 'object' ? JSON.stringify(rawContent, null, 2) : String(rawContent || '');
    const cleaned = stripConversationalMetaText(msg.answer);
    const content = isShowingRaw ? rawText : (cleaned || msg.answer);

    const agentName = synthStep?.name || 'Final Synthesizer';
    const modelId = synthStep?.model || synthStep?.providerName;
    const textWithModel = modelId ? `${content.trim()}\n\n---\nModels Used:\n${agentName}: ${modelId}` : content.trim();

    const success = await copyToClipboard(textWithModel);
    if (success) {
      setCopiedSynthId(msg.id);
      setTimeout(() => setCopiedSynthId(null), 2000);
    }
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
        diagramMode,
        chartMode,
        imageMode,
        steps: [],
      };

      // Append new messages to the bottom (WhatsApp-style chronological order)
      setMessages((prev) => [...prev, initialMessage]);
      setQuery('');
      setCurrentRunningMessageId(messageId);
      setActiveSteps([]);

      try {
        const userTimeZone =
          typeof Intl !== 'undefined' && Intl.DateTimeFormat
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : 'Europe/London';

        const result = await runJarvisPipeline(
          prompt,
          config,
          deepResearch,
          diagramMode,
          chartMode,
          imageMode,
          (updatedStep) => {
            setActiveSteps((prev) => {
              const idx = prev.findIndex((s) => s.agentId === updatedStep.agentId);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = updatedStep;
                return next;
              }
              return [...prev, updatedStep];
            });
          },
          userTimeZone,
        );

        const completedMessage: JarvisMessage = {
          id: messageId,
          query: prompt,
          answer: result.answer,
          timestamp: Date.now(),
          deepResearch,
          diagramMode,
          chartMode,
          imageMode,
          steps: result.steps,
          sources: result.sources,
          diagramSvg: result.diagramSvg,
          chartData: result.chartData,
          images: result.images,
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
          diagramMode,
          chartMode,
          imageMode,
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
    [query, isRunning, deepResearch, diagramMode, chartMode, imageMode, config, activeSteps],
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
      const cleanText = cleanMarkdownForSpeech(text);

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

  const handleEdgeTtsSpeak = useCallback(
    async (text: string, id: string) => {
      if (edgeTtsPlayingId === id) {
        if (edgeTtsAudioRef.current) {
          edgeTtsAudioRef.current.pause();
          edgeTtsAudioRef.current.currentTime = 0;
        }
        setEdgeTtsPlayingId(null);
        return;
      }

      stopSpeak();
      if (edgeTtsAudioRef.current) {
        edgeTtsAudioRef.current.pause();
        edgeTtsAudioRef.current = null;
      }

      const cleanText = cleanMarkdownForSpeech(text);

      if (!cleanText) return;

      setEdgeTtsLoadingId(id);
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
          setEdgeTtsPlayingId(id);
        };

        audio.onended = () => {
          setEdgeTtsPlayingId(null);
          edgeTtsAudioRef.current = null;
          URL.revokeObjectURL(url);
        };

        audio.onerror = () => {
          setEdgeTtsPlayingId(null);
          edgeTtsAudioRef.current = null;
          URL.revokeObjectURL(url);
        };

        await audio.play();
        setEdgeTtsPlayingId(id);
      } catch (err) {
        console.error('[JARVIS] Edge TTS generation error:', err);
        setEdgeTtsPlayingId(null);
      } finally {
        setEdgeTtsLoadingId(null);
      }
    },
    [edgeTtsPlayingId, stopSpeak],
  );

  const handleDownloadAudio = useCallback(
    async (text: string, id: string, query?: string) => {
      const cleanText = cleanMarkdownForSpeech(text);
      if (!cleanText) return;

      setDownloadingAudioId(id);
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

        const a = document.createElement('a');
        a.href = url;
        const safeSlug = query
          ? query
              .slice(0, 30)
              .trim()
              .replace(/[^a-zA-Z0-9_-]+/g, '_')
              .toLowerCase()
          : 'answer';
        a.download = `nexus_jarvis_${safeSlug}_${Date.now()}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => URL.revokeObjectURL(url), 2000);
        setDownloadSuccessId(id);
        setTimeout(() => setDownloadSuccessId((cur) => (cur === id ? null : cur)), 2500);
      } catch (err) {
        console.error('[JARVIS] Audio download error:', err);
      } finally {
        setDownloadingAudioId(null);
      }
    },
    [],
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
      if (edgeTtsAudioRef.current) {
        edgeTtsAudioRef.current.pause();
        edgeTtsAudioRef.current = null;
      }
    };
  }, []);

  // Voice Input (Speech Recognition)
  const toggleVoiceInput = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (voiceListening) {
      setVoiceListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setVoiceListening(true);
      recognition.onend = () => setVoiceListening(false);
      recognition.onerror = () => setVoiceListening(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setQuery((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.start();
    } catch {
      setVoiceListening(false);
    }
  };

  const handleCopy = async (text: string, id: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleSave = (msg: JarvisMessage) => {
    const savedId = `jarvis-${msg.id}`;

    // Resolve chartData if not directly on msg, check steps
    let resolvedChartData = msg.chartData;
    if (!resolvedChartData && msg.steps) {
      const daStep = msg.steps.find((s) => s.agentId === 'dataAnalyst' && (s.status === 'completed' || s.outputPreview || s.rawOutput));
      const raw = daStep?.outputPreview || daStep?.rawOutput;
      if (raw) {
        try {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (parsed && Array.isArray(parsed.series) && Array.isArray(parsed.labels)) {
            resolvedChartData = parsed;
          }
        } catch (err) {
          void err;
        }
      }
    }

    // Resolve diagramSvg if not directly on msg, check steps
    let resolvedDiagramSvg = msg.diagramSvg;
    if (!resolvedDiagramSvg && msg.steps) {
      const archStep = msg.steps.find((s) => s.agentId === 'architect' && (s.status === 'completed' || s.outputPreview || s.rawOutput));
      const raw = archStep?.outputPreview || archStep?.rawOutput;
      if (raw && typeof raw === 'string' && raw.includes('<svg')) {
        const start = raw.indexOf('<svg');
        const end = raw.lastIndexOf('</svg>');
        if (start !== -1 && end !== -1 && end > start) {
          resolvedDiagramSvg = raw.substring(start, end + 6);
        }
      }
    }

    const jarvisSavedItem: SavedItem = {
      id: savedId,
      type: 'jarvis',
      title: msg.query || 'JARVIS Synthesis',
      query: msg.query,
      subtitle: msg.answer.length > 180 ? `${msg.answer.slice(0, 180)}...` : msg.answer,
      content: msg.answer,
      sources: msg.sources?.map((s) => ({
        title: s.title,
        url: s.url,
        domain: s.domain,
      })),
      savedAt: new Date(msg.timestamp || Date.now()).toISOString(),
      diagramSvg: resolvedDiagramSvg,
      chartData: resolvedChartData,
      steps: msg.steps,
      deepResearch: msg.deepResearch,
      images: msg.images,
    };

    const updated = storage.saveItem(jarvisSavedItem);
    setSavedIds(new Set(updated.map((s) => s.id)));
    setRecentlySavedId(msg.id);
    setTimeout(() => {
      setRecentlySavedId((prev) => (prev === msg.id ? null : prev));
    }, 2500);
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
    <div className="jarvis-chat-console-wrapper flex flex-col gap-6 w-full max-w-5xl mx-auto">
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
      {/* JARVIS QUANTUM CORE (ONLINE STANDBY - NO BOX CONTAINER)   */}
      {/* ========================================================= */}
      <div className="relative z-10 flex flex-col items-center justify-center my-2 select-none">
        <JarvisQuantumOrb
          size={isRunning ? 'lg' : 'md'}
          isRunning={isRunning}
          isListening={voiceListening}
          query={query}
          onClick={() => inputRef.current?.focus()}
        />
      </div>

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
          <JarvisCornerBrackets color="cyan" size={14} thickness={1.5} offset={4} />
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

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
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
                          ? '1.5px solid #f43f5e'
                          : '1px solid rgba(255,255,255,0.08)',
                    boxShadow: isRunningStep ? `0 0 16px ${colorInfo.glow}` : isFailed ? '0 0 12px rgba(244,63,94,0.3)' : 'none',
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

          const cleanedAnswer = stripConversationalMetaText(msg.answer);

          return (
            <div key={msg.id} className="flex flex-col gap-3 w-full">
              {/* ---------------------------------------------------- */}
              {/* 1. USER PROMPT BUBBLE (ROUNDED & COLORFUL GRADIENT)  */}
              {/* ---------------------------------------------------- */}
              <div className="flex items-start justify-end gap-3 self-end max-w-3xl w-full">
                <div
                  className="relative p-4 sm:p-5 rounded-3xl rounded-tr-md backdrop-blur-md transition-all shadow-xl overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.6) 0%, rgba(88, 28, 135, 0.5) 100%)',
                    border: '1.5px solid rgba(147, 197, 253, 0.35)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(99, 102, 241, 0.2)',
                  }}
                >
                  <JarvisCornerBrackets color="indigo" size={10} thickness={1.5} offset={3} />
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <span className="text-[10px] font-mono tracking-widest text-indigo-200 uppercase font-bold">
                      INQUIRY
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {msg.deepResearch && (
                        <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-[10px] font-mono font-bold">
                          ⚡ DEEP RESEARCH
                        </span>
                      )}
                      {msg.diagramMode && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-mono font-bold">
                          🏗️ DIAGRAM MODE
                        </span>
                      )}
                      {msg.chartMode && (
                        <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-300 text-[10px] font-mono font-bold">
                          📊 CHART MODE
                        </span>
                      )}
                      {msg.imageMode && (
                        <span className="px-2.5 py-0.5 rounded-full bg-pink-500/20 border border-pink-400/40 text-pink-300 text-[10px] font-mono font-bold">
                          🖼️ IMAGE MODE
                        </span>
                      )}
                    </div>
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
                  className="relative flex-1 min-w-0 p-5 sm:p-7 rounded-3xl rounded-tl-md backdrop-blur-xl shadow-2xl transition-all duration-300 overflow-hidden"
                  style={{
                    background: 'linear-gradient(145deg, rgba(8, 22, 38, 0.92) 0%, rgba(12, 18, 48, 0.96) 100%)',
                    border: '1.5px solid rgba(97, 215, 201, 0.35)',
                    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.55), 0 0 28px rgba(97, 215, 201, 0.12)',
                  }}
                >
                  {/* Subtle Sci-Fi Corner Brackets */}
                  <JarvisCornerBrackets color="cyan" size={16} thickness={2} offset={4} />
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

                    {/* Action Buttons: Native Speak, Vox Neural TTS Speak, Copy, Save, Delete */}
                    <div className="flex items-center gap-1.5">
                      {/* Native Browser Speech Button */}
                      <button
                        type="button"
                        onClick={() => toggleSpeak(cleanedAnswer || msg.answer, msg.id)}
                        className={`p-2 rounded-full transition-all duration-200 flex items-center justify-center ${
                          speakingId === msg.id
                            ? 'bg-cyan-400 text-slate-950 shadow-[0_0_12px_#61d7c9]'
                            : 'text-slate-300 hover:text-cyan-300 hover:bg-cyan-500/15'
                        }`}
                        title={speakingId === msg.id ? 'Stop Voice' : 'Read Aloud (Browser Voice)'}
                      >
                        {speakingId === msg.id ? <VolumeX size={15} /> : <Volume2 size={15} />}
                      </button>

                      {/* Edge TTS Neural Audio Button */}
                      <button
                        type="button"
                        onClick={() => handleEdgeTtsSpeak(cleanedAnswer || msg.answer, msg.id)}
                        disabled={edgeTtsLoadingId === msg.id}
                        className={`p-2 rounded-full transition-all duration-200 flex items-center justify-center ${
                          edgeTtsPlayingId === msg.id
                            ? 'bg-purple-400 text-slate-950 shadow-[0_0_12px_#c084fc]'
                            : 'text-slate-300 hover:text-purple-300 hover:bg-purple-500/15'
                        }`}
                        title={
                          edgeTtsLoadingId === msg.id
                            ? 'Generating Neural Audio...'
                            : edgeTtsPlayingId === msg.id
                            ? 'Stop Edge TTS Audio'
                            : 'Play Edge TTS Neural Voice'
                        }
                      >
                        {edgeTtsLoadingId === msg.id ? (
                          <Loader2 size={15} className="animate-spin text-purple-400" />
                        ) : edgeTtsPlayingId === msg.id ? (
                          <Radio size={15} className="animate-pulse" />
                        ) : (
                          <Radio size={15} />
                        )}
                      </button>

                      {/* Download Audio (Edge TTS MP3) Button */}
                      <button
                        type="button"
                        onClick={() => handleDownloadAudio(cleanedAnswer || msg.answer, msg.id, msg.query)}
                        disabled={downloadingAudioId === msg.id}
                        className={`p-2 rounded-full transition-all duration-200 flex items-center justify-center ${
                          downloadSuccessId === msg.id
                            ? 'bg-emerald-500/25 border border-emerald-400/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                            : downloadingAudioId === msg.id
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : 'text-slate-300 hover:text-cyan-300 hover:bg-cyan-500/15'
                        }`}
                        title={
                          downloadingAudioId === msg.id
                            ? 'Synthesizing & Downloading MP3...'
                            : downloadSuccessId === msg.id
                            ? 'Audio Downloaded Successfully'
                            : 'Download Answer Audio as MP3 (Edge TTS Neural Voice)'
                        }
                      >
                        {downloadingAudioId === msg.id ? (
                          <Loader2 size={15} className="animate-spin text-cyan-400" />
                        ) : downloadSuccessId === msg.id ? (
                          <Check size={15} className="text-emerald-400" />
                        ) : (
                          <Download size={15} />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopy(formatFullPipelineExport(msg), msg.id)}
                        className="p-2 rounded-full text-slate-300 hover:text-cyan-300 hover:bg-cyan-500/15 transition-colors flex items-center justify-center"
                        title="Copy complete pipeline report"
                      >
                        {copiedId === msg.id ? <Check size={15} className="text-cyan-400" /> : <Copy size={15} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSave(msg)}
                        className={`px-2.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 ${
                          recentlySavedId === msg.id
                            ? 'bg-emerald-500/25 border border-emerald-400/50 text-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.4)]'
                            : savedIds.has(`jarvis-${msg.id}`)
                            ? 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/30'
                            : 'text-slate-300 hover:text-cyan-300 hover:bg-cyan-500/15'
                        }`}
                        title={savedIds.has(`jarvis-${msg.id}`) ? 'Saved in NEXUS Library' : 'Save to NEXUS Library'}
                      >
                        {recentlySavedId === msg.id ? (
                          <>
                            <Check size={14} className="text-emerald-400" />
                            <span className="text-[11px] font-bold text-emerald-300">Saved ✓</span>
                          </>
                        ) : savedIds.has(`jarvis-${msg.id}`) ? (
                          <>
                            <BookmarkCheck size={14} className="text-cyan-300" />
                            <span className="text-[11px] text-cyan-300 hidden sm:inline">Saved</span>
                          </>
                        ) : (
                          <>
                            <Bookmark size={14} />
                            <span className="text-[11px] hidden sm:inline">Save</span>
                          </>
                        )}
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

                  {/* ---------------------------------------------------- */}
                  {/* TACTICAL PIPELINE HUD TRACKER & UNIFIED LOG CARDS    */}
                  {/* ---------------------------------------------------- */}
                  {msg.steps && msg.steps.length > 0 && (
                    <div className="mb-5 flex flex-col gap-2">
                      {/* Horizontal Visual HUD Tracker */}
                      <JarvisPipelineHudTracker
                        message={msg}
                        isExpanded={Boolean(expandedStepsMap[msg.id])}
                        onToggleExpand={() => toggleStepDetails(msg.id)}
                      />

                      {/* Unified Terminal Diagnostic Read-out Log */}
                      {expandedStepsMap[msg.id] && (
                        <JarvisTerminalDiagnosticLog message={msg} />
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

                  {/* Multi-Agent Breakdown (Full individual agent answers in chat) */}
                  {msg.steps && msg.steps.length > 0 && (
                    <JarvisDeepResearchMeshAnswers
                      steps={msg.steps}
                      query={msg.query}
                      isDeepResearch={msg.deepResearch}
                    />
                  )}

                  {/* Synthesized Output Body */}
                  {(() => {
                    const isShowingSynthRaw = Boolean(synthRawViewMap[msg.id]);
                    const synthStep = msg.steps?.find((s) => s.agentId === 'finalSynthesizer');
                    const rawContent = synthStep?.rawOutput || msg.answer;
                    const rawText = typeof rawContent === 'object' ? JSON.stringify(rawContent, null, 2) : String(rawContent || '');

                    return (
                      <div className="prose prose-invert max-w-none text-slate-100 leading-relaxed text-sm sm:text-base">
                        {(msg.deepResearch || (msg.steps && msg.steps.some((s) => s.status === 'completed' && s.agentId !== 'finalSynthesizer'))) && (
                          <div className="flex items-center justify-between flex-wrap gap-2 mb-3 pt-3 border-t border-purple-500/30">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/40 text-xs font-mono font-bold text-purple-300 shadow-[0_0_10px_rgba(192,132,252,0.2)]">
                              <Zap size={13} className="text-purple-400" />
                              <span>JARVIS // UNIFIED FINAL SYNTHESIS</span>
                            </div>

                            {/* Action Buttons: Raw JSON Toggle & Copy (matching agent button style) */}
                            <div className="flex items-center gap-1.5 shrink-0 not-prose">
                              <button
                                type="button"
                                onClick={() => toggleSynthRawView(msg.id)}
                                className="px-2 py-1 rounded text-xs font-mono flex items-center gap-1 bg-black/50 border border-white/15 text-slate-300 hover:text-white hover:border-white/30 transition-all"
                                title={isShowingSynthRaw ? 'Switch to Formatted View' : 'Switch to Raw JSON View'}
                              >
                                {isShowingSynthRaw ? (
                                  <>
                                    <FileText size={12} className="text-cyan-300" />
                                    <span>Formatted</span>
                                  </>
                                ) : (
                                  <>
                                    <Code2 size={12} className="text-cyan-300" />
                                    <span>Raw JSON</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={(e) => handleCopySynth(msg, e)}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all flex items-center gap-1 text-xs font-mono bg-black/40 border border-white/10"
                                title="Copy final synthesis"
                              >
                                {copiedSynthId === msg.id ? (
                                  <>
                                    <Check size={13} className="text-emerald-400" />
                                    <span className="text-emerald-300 text-[10px]">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={13} />
                                    <span className="text-[10px] hidden sm:inline">Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                        {isShowingSynthRaw ? (
                          <div className="rounded-xl bg-black/70 border border-white/10 p-3.5 overflow-x-auto max-h-[500px] overflow-y-auto not-prose my-2">
                            <pre className="font-mono text-xs text-cyan-200 leading-relaxed whitespace-pre-wrap break-words m-0">
                              {rawText}
                            </pre>
                          </div>
                        ) : (
                          <FormattedText content={cleanedAnswer || msg.answer} />
                        )}
                      </div>
                    );
                  })()}

                  {/* Interactive Quantitative Chart Card */}
                  {msg.chartData && (
                    <Suspense
                      fallback={
                        <div className="my-4 p-4 rounded-xl bg-slate-950/60 border border-sky-500/20 flex items-center justify-center gap-2.5 text-xs text-sky-400 font-mono">
                          <Loader2 size={15} className="animate-spin text-sky-400" />
                          <span>Rendering quantitative chart...</span>
                        </div>
                      }
                    >
                      <JarvisChartCard
                        id={`chart-${msg.id}`}
                        chartData={msg.chartData}
                        title={msg.query}
                        onSaveChange={(isSaved) => {
                          const sId = `chart-${msg.id}`;
                          setSavedIds((prev) => {
                            const next = new Set(prev);
                            if (isSaved) next.add(sId);
                            else next.delete(sId);
                            return next;
                          });
                        }}
                      />
                    </Suspense>
                  )}

                  {/* Retrieved Real Photographic Media */}
                  {msg.images && msg.images.length > 0 && (
                    <Suspense
                      fallback={
                        <div className="my-4 p-4 rounded-xl bg-slate-950/60 border border-emerald-500/20 flex items-center justify-center gap-2.5 text-xs text-emerald-400 font-mono">
                          <Loader2 size={15} className="animate-spin text-emerald-400" />
                          <span>Loading image gallery...</span>
                        </div>
                      }
                    >
                      <JarvisImageGallery
                        images={msg.images}
                        title={msg.query}
                      />
                    </Suspense>
                  )}

                  {/* SVG Architectural Blueprint Diagram */}
                  {msg.diagramSvg && (
                    <Suspense
                      fallback={
                        <div className="my-4 p-4 rounded-xl bg-slate-950/60 border border-amber-500/20 flex items-center justify-center gap-2.5 text-xs text-amber-400 font-mono">
                          <Loader2 size={15} className="animate-spin text-amber-400" />
                          <span>Rendering architectural blueprint...</span>
                        </div>
                      }
                    >
                      <JarvisSvgDiagram
                        id={`diagram-${msg.id}`}
                        svgMarkup={msg.diagramSvg}
                        title={msg.query}
                        onSaveChange={(isSaved) => {
                          const sId = `diagram-${msg.id}`;
                          setSavedIds((prev) => {
                            const next = new Set(prev);
                            if (isSaved) next.add(sId);
                            else next.delete(sId);
                            return next;
                          });
                        }}
                      />
                    </Suspense>
                  )}

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
        {/* Auto-scroll bottom target anchor */}
        <div ref={messagesEndRef} className="h-2 w-full pointer-events-none" />
      </div>

      {/* ========================================================= */}
      {/* BOTTOM "ASK JARVIS" CONSOLE INPUT BAR (NORMAL PAGE FLOW) */}
      {/* ========================================================= */}
      <div
        className="relative overflow-hidden rounded-3xl p-5 sm:p-6 backdrop-blur-xl transition-all duration-300"
        style={{
          background: 'linear-gradient(145deg, rgba(8, 20, 36, 0.92) 0%, rgba(14, 18, 48, 0.94) 50%, rgba(6, 26, 38, 0.92) 100%)',
          border: '1px solid rgba(97, 215, 201, 0.38)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 32px rgba(97,215,201,0.15), inset 0 1px 0 rgba(255,255,255,0.15)',
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
          className="relative z-10 flex flex-col gap-4"
        >
          {/* Main Round Pill Search Input Bar */}
          <div
            className="group relative flex items-center gap-2 p-2 sm:p-2.5 rounded-full backdrop-blur-md transition-all duration-300"
            style={{
              background: 'rgba(5, 15, 28, 0.85)',
              border: isRunning
                ? '1.5px solid #38bdf8'
                : '1.5px solid rgba(97, 215, 201, 0.45)',
              boxShadow: isRunning
                ? '0 0 24px rgba(56,189,248,0.4), inset 0 0 12px rgba(56,189,248,0.15)'
                : '0 8px 28px rgba(0,0,0,0.4), 0 0 16px rgba(97,215,201,0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          >
            {/* Glowing Leading Node - JARVIS Round Ball Orb attached seamlessly merged */}
            <div className="pl-2 sm:pl-3 flex items-center justify-center shrink-0">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 relative cursor-pointer group-hover:scale-105"
                onClick={() => inputRef.current?.focus()}
                title="JARVIS Quantum Neural Core Active"
                style={{
                  background: 'transparent',
                  border: 'none',
                  boxShadow: 'none',
                }}
              >
                <JarvisQuantumOrb
                  size="xs"
                  showBadge={false}
                  isRunning={isRunning}
                  isListening={voiceListening}
                  query={query}
                  status={isRunning ? 'thinking' : voiceListening ? 'listening' : query ? 'synthesizing' : 'idle'}
                />
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
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-white text-sm sm:text-base placeholder:text-slate-400 font-medium px-2 py-2"
            />

            {/* Mic / Voice Button */}
            <button
              type="button"
              onClick={toggleVoiceInput}
              aria-label="Voice input"
              title={voiceListening ? 'Stop Listening' : 'Speak Prompt'}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                voiceListening
                  ? 'bg-rose-500 text-white shadow-[0_0_16px_#f43f5e] animate-pulse'
                  : 'bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 hover:border-cyan-400/40'
              }`}
            >
              <Mic size={17} className={voiceListening ? 'animate-bounce' : ''} />
            </button>



            {/* Submit Pill Button */}
            <button
              type="submit"
              disabled={!query.trim() || isRunning}
              className="px-5 sm:px-6 py-2.5 sm:py-3 rounded-full font-bold text-xs sm:text-sm tracking-wide transition-all duration-300 flex items-center gap-2 shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
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
                <Loader2 size={16} className="animate-spin text-slate-950" />
              ) : (
                <Send size={15} className="text-slate-950" />
              )}
              <span className="font-extrabold">{isRunning ? 'Orchestrating...' : 'Ask JARVIS'}</span>
            </button>
          </div>

          {/* Controls Hub: Deep Research & Diagram Mode Switches + Action Chips */}
          <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Deep Research Colorful Pill Switch */}
              <label
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer transition-all duration-200 border"
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
                  className={`text-[11px] font-bold font-mono tracking-wide ${
                    deepResearch ? 'text-cyan-300' : 'text-slate-400'
                  }`}
                >
                  ⚡ DEEP RESEARCH (5-AGENT MESH)
                </span>
              </label>

              {/* Diagram Mode Colorful Pill Switch */}
              <label
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer transition-all duration-200 border"
                style={{
                  background: diagramMode
                    ? 'linear-gradient(135deg, rgba(245,158,11,0.22) 0%, rgba(217,119,6,0.18) 100%)'
                    : 'rgba(255,255,255,0.03)',
                  borderColor: diagramMode ? 'rgba(245,158,11,0.55)' : 'rgba(255,255,255,0.1)',
                  boxShadow: diagramMode ? '0 0 14px rgba(245,158,11,0.3)' : 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={diagramMode}
                  onChange={(e) => setDiagramMode(e.target.checked)}
                  className="hidden"
                />
                <div
                  className={`w-7 h-3.5 rounded-full transition-colors relative flex items-center p-0.5 ${
                    diagramMode ? 'bg-amber-400' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-full bg-slate-950 transition-transform duration-200 ${
                      diagramMode ? 'translate-x-3.5' : 'translate-x-0'
                    }`}
                  />
                </div>
                <span
                  className={`text-[11px] font-bold font-mono tracking-wide flex items-center gap-1.5 ${
                    diagramMode ? 'text-amber-300' : 'text-slate-400'
                  }`}
                >
                  <span>🏗️</span>
                  <span>DIAGRAM MODE</span>
                </span>
              </label>

              {/* Chart Mode Colorful Pill Switch */}
              <label
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer transition-all duration-200 border"
                style={{
                  background: chartMode
                    ? 'linear-gradient(135deg, rgba(56,189,248,0.22) 0%, rgba(14,165,233,0.18) 100%)'
                    : 'rgba(255,255,255,0.03)',
                  borderColor: chartMode ? 'rgba(56,189,248,0.55)' : 'rgba(255,255,255,0.1)',
                  boxShadow: chartMode ? '0 0 14px rgba(56,189,248,0.3)' : 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={chartMode}
                  onChange={(e) => setChartMode(e.target.checked)}
                  className="hidden"
                />
                <div
                  className={`w-7 h-3.5 rounded-full transition-colors relative flex items-center p-0.5 ${
                    chartMode ? 'bg-sky-400' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-full bg-slate-950 transition-transform duration-200 ${
                      chartMode ? 'translate-x-3.5' : 'translate-x-0'
                    }`}
                  />
                </div>
                <span
                  className={`text-[11px] font-bold font-mono tracking-wide flex items-center gap-1.5 ${
                    chartMode ? 'text-sky-300' : 'text-slate-400'
                  }`}
                >
                  <span>📊</span>
                  <span>CHART MODE</span>
                </span>
              </label>

              {/* Image Mode Colorful Pill Switch */}
              <label
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer transition-all duration-200 border"
                style={{
                  background: imageMode
                    ? 'linear-gradient(135deg, rgba(236,72,153,0.22) 0%, rgba(219,39,119,0.18) 100%)'
                    : 'rgba(255,255,255,0.03)',
                  borderColor: imageMode ? 'rgba(236,72,153,0.55)' : 'rgba(255,255,255,0.1)',
                  boxShadow: imageMode ? '0 0 14px rgba(236,72,153,0.3)' : 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={imageMode}
                  onChange={(e) => setImageMode(e.target.checked)}
                  className="hidden"
                />
                <div
                  className={`w-7 h-3.5 rounded-full transition-colors relative flex items-center p-0.5 ${
                    imageMode ? 'bg-pink-400' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-full bg-slate-950 transition-transform duration-200 ${
                      imageMode ? 'translate-x-3.5' : 'translate-x-0'
                    }`}
                  />
                </div>
                <span
                  className={`text-[11px] font-bold font-mono tracking-wide flex items-center gap-1.5 ${
                    imageMode ? 'text-pink-300' : 'text-slate-400'
                  }`}
                >
                  <span>🖼️</span>
                  <span>IMAGE MODE</span>
                </span>
              </label>
            </div>

            {/* Round Auxiliary Action Chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={onOpenSettings}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-400/60 shadow-sm transition-all duration-200"
                title="Configure Agent parameters, providers and models"
              >
                <Cpu size={13} className="text-cyan-400" />
                <span>Configure Agents</span>
              </button>

              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleNewChat}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-sky-200 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/30 hover:border-sky-300/60 shadow-sm transition-all duration-200"
                  title="Start a fresh chat"
                >
                  <Plus size={13} className="text-sky-300" />
                  <span>New Inquiry</span>
                </button>
              )}

              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-400/60 shadow-sm transition-all duration-200"
                  title="Clear conversation history"
                >
                  <Trash2 size={13} className="text-rose-400" />
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
            <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
              <span className="text-[11px] font-mono tracking-wider text-slate-400 uppercase font-semibold flex items-center gap-1.5">
                <Sparkles size={12} className="text-cyan-400" />
                Suggested Research Tracks:
              </span>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPT_PILLS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(p.label)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r ${p.color} border ${p.border} ${p.text} hover:scale-105 hover:shadow-[0_0_14px_rgba(97,215,201,0.25)] transition-all duration-200`}
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
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 text-xs font-bold shadow-md">
              <CheckCircle2 size={16} className="text-cyan-400" />
              <span>Conversation history cleared. Ready for your next deep inquiry!</span>
            </div>
          )}

          {/* Clear Confirmation Rounded Modal */}
          {showClearConfirm && (
            <div
              className="p-4 rounded-2xl backdrop-blur-xl flex items-center justify-between flex-wrap gap-3 mt-1"
              style={{
                background: 'linear-gradient(135deg, rgba(40, 15, 20, 0.95) 0%, rgba(30, 10, 15, 0.95) 100%)',
                border: '1px solid rgba(244, 63, 94, 0.45)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.5), 0 0 16px rgba(244,63,94,0.2)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle size={18} className="text-rose-400 shrink-0" />
                <div>
                  <div className="text-white text-xs font-bold">
                    Clear all {messages.length} {messages.length === 1 ? 'message' : 'messages'} from JARVIS history?
                  </div>
                  <div className="text-rose-200/70 text-[11px]">
                    This will reset the current multi-agent session.
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClearChat}
                  className="px-4 py-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg transition-colors"
                >
                  <Trash2 size={12} />
                  Yes, Clear All
                </button>
              </div>
            </div>
          )}
        </form>
      </div>


    </div>
  );
}


