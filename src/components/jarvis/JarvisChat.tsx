import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Send,
  Loader2,
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
  CheckCircle2,
  Bookmark,
  BookmarkCheck,
  Download,
  Code2,
  FileText,
  Paperclip,
  Clipboard,
  FileCode,
  X,
  BookOpen,
  ChevronUp,
  Palette,
} from 'lucide-react';
import { storage, DEFAULT_JARVIS_CONFIG } from '@/lib/storage';
import {
  getSavedParallaxTheme,
  saveParallaxTheme,
  type ParallaxTheme,
} from '@/components/parallax/ParallaxSettings';
import { stripConversationalMetaText, cleanMarkdownForSpeech } from '@/lib/format';
import {
  runJarvisPipeline,
  isImageSlashCommand,
  isImageAiSlashCommand,
  isPromptImageSlashCommand,
  stripPromptImagePrefix,
  extractPromptImageVariations,
  isNewAgentSlashCommand,
} from '@/services/jarvisOrchestrator';
import {
  validateAttachmentFile,
  processAttachedFile,
  formatAttachmentSize,
  formatPromptWithAttachments,
  UNSUPPORTED_FILE_ERROR_MESSAGE,
} from '@/services/jarvisAttachmentService';
import { getLibraryDocuments } from '@/services/documentLibraryService';

import { JarvisHudHeader } from './JarvisHudHeader';
import { JarvisCoreVisualizer } from './JarvisCoreVisualizer';
import { JarvisTopologyMatrix } from './JarvisTopologyMatrix';
import { JarvisCategoryDeck } from './JarvisCategoryDeck';
import { JarvisQuantumOrb } from './JarvisQuantumOrb';
import { JarvisPipelineHudTracker } from './JarvisPipelineHudTracker';
import { JarvisTerminalDiagnosticLog } from './JarvisTerminalDiagnosticLog';
import { JarvisSynthesisThemeToggle } from './JarvisSynthesisThemeToggle';
import { JarvisEdgeTtsButton } from './JarvisEdgeTtsButton';
import { JarvisPromptImageCard } from './JarvisPromptImageCard';
import { useJarvisSynthesisTheme } from '@/hooks/useJarvisSynthesisTheme';
import { useEdgeTts } from '@/hooks/useEdgeTts';
import { FormattedText } from './FormattedText';
import { JarvisDeepResearchMeshAnswers } from './JarvisDeepResearchMeshAnswers';
import { JarvisFactCheckNotes } from './JarvisFactCheckNotes';
import { formatFullPipelineExport } from './formatJarvisPipelineExport';
import { copyToClipboard, formatMarkdownToRichHtml } from '@/lib/clipboard';
import type {
  JarvisAttachedFile,
  JarvisExecutionStep,
  JarvisMessage,
  JarvisSystemConfig,
  SavedItem,
  LibraryDocument,
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
  theme?: ParallaxTheme;
  onThemeChange?: (t: ParallaxTheme) => void;
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
    bg: 'rgba(180, 115, 60, 0.15)',
    border: 'rgba(180, 115, 60, 0.45)',
    text: '#d99b64',
    glow: 'rgba(180, 115, 60, 0.3)',
    gradient: 'linear-gradient(135deg, rgba(180,115,60,0.3) 0%, rgba(138,80,30,0.15) 100%)',
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

export function JarvisChat({
  config,
  onOpenSettings,
  theme: propTheme,
  onThemeChange,
}: JarvisChatProps) {
  const [localTheme, setLocalTheme] = useState<ParallaxTheme>(() => getSavedParallaxTheme());
  const activeTheme: ParallaxTheme = propTheme || localTheme;

  const handleThemeSelect = (newTheme: ParallaxTheme) => {
    setLocalTheme(newTheme);
    saveParallaxTheme(newTheme);
    onThemeChange?.(newTheme);
  };

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
  const [coderMode, setCoderMode] = useState(() => {
    const codeParam = searchParams.get('code') || searchParams.get('coder');
    if (codeParam === 'true') return true;
    if (codeParam === 'false') return false;
    return config.coderModeDefault ?? (config.agents?.coder?.enabled !== false);
  });
  const [newAgentMode, setNewAgentMode] = useState(() => {
    const dynamicParam = searchParams.get('newAgent') || searchParams.get('dynamic');
    if (dynamicParam === 'true') return true;
    if (dynamicParam === 'false') return false;
    return config.newAgentModeDefault ?? false;
  });

  const handleToggleCoderMode = (enabled: boolean) => {
    setCoderMode(enabled);
    try {
      const current = storage.getJarvisConfig();
      const updated: JarvisSystemConfig = {
        ...current,
        coderModeDefault: enabled,
        agents: {
          ...current.agents,
          coder: {
            ...(current.agents?.coder || DEFAULT_JARVIS_CONFIG.agents.coder),
            enabled,
          },
        },
      };
      storage.saveJarvisConfig(updated);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (config.agents?.coder?.enabled !== undefined) {
      setCoderMode(config.agents.coder.enabled);
    } else if (config.coderModeDefault !== undefined) {
      setCoderMode(config.coderModeDefault);
    }
  }, [config.agents?.coder?.enabled, config.coderModeDefault]);

  const [searchMyDocs, setSearchMyDocs] = useState<boolean>(() => {
    try {
      const rag = storage.getRagSettings();
      return rag.enabledByDefault ?? false;
    } catch {
      return false;
    }
  });
  const [docSearchMode, setDocSearchMode] = useState<'all' | 'specific'>(() => {
    try {
      const rag = storage.getRagSettings();
      return rag.defaultSearchMode ?? 'all';
    } catch {
      return 'all';
    }
  });
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [availableDocs, setAvailableDocs] = useState<LibraryDocument[]>(() => {
    try {
      return storage.getDocumentLibrary();
    } catch {
      return [];
    }
  });

  const refreshAvailableDocs = useCallback(() => {
    try {
      getLibraryDocuments().then((res) => {
        setAvailableDocs(res.documents);
      }).catch(() => {
        setAvailableDocs(storage.getDocumentLibrary());
      });
    } catch {
      setAvailableDocs(storage.getDocumentLibrary());
    }
  }, []);

  useEffect(() => {
    refreshAvailableDocs();
    const handleStorageChange = () => refreshAvailableDocs();
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshAvailableDocs]);
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

  // Shared Edge TTS Neural Voice & Download Hook
  const {
    edgeTtsLoadingId,
    edgeTtsPlayingId,
    downloadingAudioId,
    downloadSuccessId,
    handleEdgeTtsSpeak,
    handleDownloadAudio,
    stopEdgeTts,
  } = useEdgeTts({ onStopBrowserSpeech: stopSpeak });

  // Shared JARVIS Synthesis box background theme: 'cyan' (default glow) vs 'black' (flat plain black)
  const { synthesisTheme, toggleSynthesisTheme } = useJarvisSynthesisTheme();

  const [synthRawViewMap, setSynthRawViewMap] = useState<Record<string, boolean>>({});
  const [copiedSynthId, setCopiedSynthId] = useState<string | null>(null);

  // Attachment & Clipboard states
  const [attachedFiles, setAttachedFiles] = useState<JarvisAttachedFile[]>([]);
  const [isExtractingAttachment, setIsExtractingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const attachMenuRef = useRef<HTMLDivElement | null>(null);
  const [showModesMenu, setShowModesMenu] = useState(false);
  const modesMenuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearedBanner, setClearedBanner] = useState(false);
  const [activeView, setActiveView] = useState<'chat' | 'topology' | 'categories' | 'reactor'>('chat');
  const [voiceListening, setVoiceListening] = useState(false);
  const initialHandledRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Close attachment or modes dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target as Node)) {
        setShowAttachMenu(false);
      }
      if (modesMenuRef.current && !modesMenuRef.current.contains(event.target as Node)) {
        setShowModesMenu(false);
      }
    }
    if (showAttachMenu || showModesMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAttachMenu, showModesMenu]);

  const handleAttachFileClick = () => {
    setShowAttachMenu(false);
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setAttachmentError(null);
    setIsExtractingAttachment(true);

    try {
      const newAttachments: JarvisAttachedFile[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const validation = validateAttachmentFile(file);
        if (!validation.valid) {
          setAttachmentError(validation.error || UNSUPPORTED_FILE_ERROR_MESSAGE);
          continue;
        }

        try {
          const processed = await processAttachedFile(file);
          newAttachments.push(processed);
        } catch (procErr: unknown) {
          const msg = procErr instanceof Error ? procErr.message : UNSUPPORTED_FILE_ERROR_MESSAGE;
          setAttachmentError(msg);
        }
      }

      if (newAttachments.length > 0) {
        setAttachedFiles((prev) => [...prev, ...newAttachments]);
      }
    } finally {
      setIsExtractingAttachment(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handlePasteFromClipboard = async () => {
    setShowAttachMenu(false);
    setAttachmentError(null);

    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const clipboardText = await navigator.clipboard.readText();
        if (clipboardText && clipboardText.trim()) {
          setQuery((prev) => (prev ? `${prev}\n${clipboardText}` : clipboardText));
          setTimeout(() => {
            inputRef.current?.focus();
          }, 50);
        } else {
          setAttachmentError('Clipboard is empty or does not contain text.');
          setTimeout(() => setAttachmentError(null), 4000);
        }
      } else {
        setAttachmentError('Clipboard API is not accessible in this context. Please use standard paste (Ctrl+V or long-press).');
        setTimeout(() => setAttachmentError(null), 4000);
      }
    } catch {
      setAttachmentError('Clipboard access permission denied. Please paste directly into the input box using Ctrl+V or long-press.');
      setTimeout(() => setAttachmentError(null), 4000);
    }
  };

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

    const richHtml = formatMarkdownToRichHtml(textWithModel, '#c084fc');
    const success = await copyToClipboard(textWithModel, richHtml);
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
      const userText = (textToSend || query).trim();
      const currentAttachments = [...attachedFiles];
      if ((!userText && currentAttachments.length === 0) || isRunning) return;

      setActiveView('chat');
      const messageId = `jarvis-${Date.now()}`;

      // Formatted prompt passed to the multi-agent pipeline
      const fullPipelinePrompt = formatPromptWithAttachments(userText, currentAttachments);

      // Display query in UI
      const displayQuery =
        userText ||
        (currentAttachments.length === 1
          ? `Analyze attached file: ${currentAttachments[0].name}`
          : `Analyze ${currentAttachments.length} attached files`);

      // Check for /newagent one-time override command
      const isNewAgentSlash = isNewAgentSlashCommand(userText);
      const effectiveNewAgentModeForThisQuery = Boolean(newAgentMode || isNewAgentSlash);

      const initialMessage: JarvisMessage = {
        id: messageId,
        query: displayQuery,
        answer: '',
        timestamp: Date.now(),
        deepResearch,
        diagramMode,
        chartMode,
        imageMode,
        coderMode,
        newAgentMode: effectiveNewAgentModeForThisQuery,
        attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
        steps: [],
      };

      // Append new messages to the bottom (WhatsApp-style chronological order)
      setMessages((prev) => [...prev, initialMessage]);
      setQuery('');
      setAttachedFiles([]);
      setAttachmentError(null);
      setCurrentRunningMessageId(messageId);
      setActiveSteps([]);

      try {
        const userTimeZone =
          typeof Intl !== 'undefined' && Intl.DateTimeFormat
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : 'Europe/London';

        const effectiveConfig: JarvisSystemConfig = {
          ...config,
          coderModeDefault: coderMode,
          agents: {
            ...config.agents,
            coder: {
              ...(config.agents?.coder || DEFAULT_JARVIS_CONFIG.agents.coder),
              enabled: coderMode,
            },
          },
        };

        const selectedDocObj = availableDocs.find((d) => d.id === selectedDocId);
        const result = await runJarvisPipeline(
          fullPipelinePrompt,
          effectiveConfig,
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
          coderMode,
          {
            enabled: searchMyDocs,
            mode: docSearchMode,
            selectedDocId: docSearchMode === 'specific' ? selectedDocId : undefined,
            selectedDocName: docSearchMode === 'specific' ? selectedDocObj?.name : undefined,
          },
          effectiveNewAgentModeForThisQuery,
        );

        const completedMessage: JarvisMessage = {
          id: messageId,
          query: displayQuery,
          answer: result.answer,
          timestamp: Date.now(),
          deepResearch,
          diagramMode,
          chartMode,
          imageMode,
          coderMode,
          newAgentMode: effectiveNewAgentModeForThisQuery,
          dynamicSpecialists: result.dynamicSpecialists,
          attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
          searchMyDocs: searchMyDocs,
          docSearchMode: searchMyDocs ? docSearchMode : undefined,
          searchedDocumentId: searchMyDocs && docSearchMode === 'specific' ? selectedDocId : undefined,
          searchedDocumentName: searchMyDocs && docSearchMode === 'specific' ? selectedDocObj?.name : undefined,
          retrievedDocChunks: result.retrievedDocChunks,
          steps: result.steps,
          sources: result.sources,
          diagramSvg: result.diagramSvg,
          chartData: result.chartData,
          images: result.images,
          promptImageVariations: result.promptImageVariations,
          promptImageRoughIdea: result.promptImageRoughIdea,
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
          query: displayQuery,
          answer: 'Sorry, I encountered an issue during multi-agent execution.',
          timestamp: Date.now(),
          deepResearch,
          diagramMode,
          chartMode,
          imageMode,
          coderMode,
          newAgentMode: effectiveNewAgentModeForThisQuery,
          attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
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
    [
      query,
      isRunning,
      deepResearch,
      diagramMode,
      chartMode,
      imageMode,
      coderMode,
      newAgentMode,
      searchMyDocs,
      docSearchMode,
      selectedDocId,
      availableDocs,
      attachedFiles,
      config,
      activeSteps,
    ],
  );

  useEffect(() => {
    if (initialHandledRef.current) return;
    initialHandledRef.current = true;

    const urlQuery = searchParams.get('q');
    if (urlQuery && urlQuery.trim()) {
      handleSend(urlQuery.trim());
    }
  }, [searchParams, handleSend]);

  // Text-To-Speech Synthesis with persistent ref and replay fix
  const toggleSpeak = useCallback(
    (text: string, id: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

      // If user taps the active message, stop playback
      if (speakingId === id) {
        stopSpeak();
        return;
      }

      // Stop any existing Edge TTS playback before starting browser speech
      stopEdgeTts();

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
    [speakingId, stopSpeak, stopEdgeTts],
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
    const richHtml = formatMarkdownToRichHtml(text);
    const success = await copyToClipboard(text, richHtml);
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

  // ============================================================
  // 3-THEME DESIGN TOKENS (Deep Obsidian Classic / Minimal / Full Dark)
  // ============================================================
  const hairlineTableCardClass = 'rounded-xl bg-[var(--j-low)]';
  const subSurfaceCardClass = 'bg-[var(--j-card)]';
  const composerBoxClass = 'bg-[var(--j-low)] shadow-2xl backdrop-blur-xl';

  const activeAgentsCount = config?.agents
    ? Object.values(config.agents).filter((a) => a?.enabled).length
    : 10;

  const [topHudLogExpanded, setTopHudLogExpanded] = useState<boolean>(true);

  // Build real target message for the top Pipeline HUD section (active running message, or latest completed message, or standby state)
  const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const hudTargetMessage: JarvisMessage = isRunning
    ? {
        id: currentRunningMessageId || 'live-pipeline',
        query: latestMessage?.query || query || 'Active Directive',
        answer: '',
        timestamp: latestMessage?.timestamp || Date.now(),
        deepResearch,
        diagramMode,
        chartMode,
        imageMode,
        coderMode,
        newAgentMode,
        steps: activeSteps,
      }
    : latestMessage || {
        id: 'standby-pipeline',
        query: 'Standby',
        answer: '',
        timestamp: Date.now(),
        deepResearch,
        diagramMode,
        chartMode,
        imageMode,
        coderMode,
        newAgentMode,
        steps: [],
      };

  return (
    <div className="jarvis-chat-console-wrapper flex flex-col gap-4 w-full max-w-[960px] mx-auto">
      {/* Top Slim HUD Header (Telemetry + 4 View Switcher Pills) */}
      <JarvisHudHeader
        config={config}
        isRunning={isRunning}
        activeView={activeView}
        onSelectView={setActiveView}
        messageCount={messages.length}
        theme={activeTheme}
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
      {/* 1. ORCHESTRATION PIPELINE HUD (STITCH SECTION 1)          */}
      {/* ========================================================= */}
      <section className="flex flex-col gap-2 w-full bg-[var(--j-lowest)] p-3 sm:p-3.5 rounded-xl shadow-xl">
        <JarvisPipelineHudTracker
          message={hudTargetMessage}
          isExpanded={topHudLogExpanded}
          onToggleExpand={() => setTopHudLogExpanded((prev) => !prev)}
          isRunning={isRunning}
          theme={activeTheme}
        />
        {topHudLogExpanded && (
          <JarvisTerminalDiagnosticLog
            message={hudTargetMessage}
            isRunning={isRunning}
            defaultOpen={true}
            theme={activeTheme}
          />
        )}
      </section>

      {/* ========================================================= */}
      {/* 2. GLOWING ORBITAL AI CORE & STITCH STATUS CAPTION        */}
      {/* ========================================================= */}
      <section className="relative z-10 flex flex-col items-center justify-center py-2 w-full select-none">
        <JarvisQuantumOrb
          size={isRunning ? 'lg' : messages.length > 0 ? 'sm' : 'md'}
          showBadge={false}
          isRunning={isRunning}
          isListening={voiceListening}
          query={query}
          onClick={() => inputRef.current?.focus()}
        />

        {/* Stitch Status Monospace Caption (from real state) */}
        <div className="flex flex-col items-center gap-1 mt-1 text-center">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--j-accent)] animate-ping" />
            <span className="font-mono text-[10px] font-semibold tracking-[0.2em] text-[var(--j-text)] uppercase">
              {isRunning
                ? 'PROCESSING'
                : voiceListening
                ? 'VOICE LISTENING'
                : 'COGNITIVE MESH ONLINE'}
            </span>
          </div>
          <span className="font-mono text-[9px] text-[var(--j-muted)] uppercase tracking-widest">
            ORCHESTRATING {activeAgentsCount} RESEARCH AGENTS //{' '}
            {isRunning ? 'PIPELINE ACTIVE' : 'SYNTHESIS READY'}
          </span>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 3. SUGGESTED RESEARCH PROMPTS (STITCH TACTICAL CHIPS)     */}
      {/* ========================================================= */}
      {!isRunning && (
        <section className="flex flex-col gap-1.5 w-full">
          <div className="flex items-center justify-between px-1">
            <span className="font-mono text-[10px] font-semibold uppercase text-[var(--j-muted)] tracking-[0.12em]">
              DEPLOY SYNTHESIS DIRECTIVE
            </span>
            <span className="font-mono text-[9px] font-medium uppercase text-[var(--j-accent2)] tracking-wider">
              SWARM READY
            </span>
          </div>
          <div className="jarvis-prompt-pills-row flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {QUICK_PROMPT_PILLS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(p.label)}
                className="jarvis-quick-prompt-pill shrink-0 bg-[var(--j-card)] hover:bg-[var(--j-high)] px-3.5 py-2 rounded-lg active:scale-95 transition-all text-left flex items-center gap-2 group cursor-pointer"
              >
                <Zap
                  size={13}
                  className="text-[var(--j-accent)] group-hover:rotate-12 transition-transform shrink-0"
                />
                <span className="font-mono text-[11.5px] font-semibold text-[var(--j-text)] whitespace-nowrap">
                  {p.label}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* ACTIVE PIPELINE RUNNING VISUALIZER (STITCH TONAL CARD)    */}
      {/* ========================================================= */}
      {isRunning && (
        <div className="jarvis-running-pipeline-card relative overflow-hidden p-3 sm:p-4 rounded-xl bg-[var(--j-low)] transition-all duration-200 ring-1 ring-[var(--j-accent)]/40">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2.5 pb-2 border-b border-white/[0.04]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--j-accent)] animate-ping shrink-0" />
              <span className="text-xs sm:text-[13px] font-semibold text-[var(--j-text)] truncate">
                JARVIS Multi-Agent Pipeline In Progress
              </span>
              <span className="text-[var(--j-faint)] hidden sm:inline">·</span>
              <span className="text-[10px] text-[var(--j-muted)] font-mono hidden sm:inline truncate">
                Live Neural Orchestration &amp; Cross-Verification
              </span>
            </div>
            <span className="text-[10px] font-mono text-[var(--j-accent)] font-semibold uppercase tracking-wider">
              ENGAGED
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5">
            {activeSteps.map((step) => {
              const colorInfo = getAgentColor(step.agentId);
              const isRunningStep = step.status === 'running';
              const isCompleted = step.status === 'completed';
              const isFailed = step.status === 'failed';

              return (
                <div
                  key={step.agentId}
                  className="px-2.5 py-2 rounded-lg bg-[var(--j-card)] transition-all duration-200 flex items-center gap-2"
                  style={{
                    borderLeft: isRunningStep
                      ? `2px solid ${colorInfo.text}`
                      : isFailed
                      ? '2px solid var(--j-danger)'
                      : '2px solid transparent',
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: colorInfo.text }}
                  />
                  <span className="text-xs shrink-0">{step.icon}</span>

                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-[var(--j-text)] truncate">
                      {step.name}
                    </div>
                    <div className="text-[9.5px] text-[var(--j-faint)] font-mono truncate">
                      {step.model}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isRunningStep && (
                      <Loader2 size={12} className="animate-spin text-[var(--j-accent)]" />
                    )}
                    {isCompleted && (
                      <span
                        className="text-[10px] font-mono font-bold"
                        style={{ color: colorInfo.text }}
                      >
                        ✓
                      </span>
                    )}
                    {isFailed && (
                      <span className="text-[var(--j-danger)] text-[10px] font-bold">✕</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. MESSAGE STREAM (STITCH SECTION 4: OLDEST -> NEWEST)    */}
      {/* ========================================================= */}
      <div className="jarvis-messages-container flex flex-col gap-4 w-full pb-32">
        {messages.map((msg) => {
          const isMsgRunning = msg.id === currentRunningMessageId;
          if (isMsgRunning) return null; // Handled above in live visualizer

          const cleanedAnswer = stripConversationalMetaText(msg.answer);
          const executedAgentsCount =
            msg.steps?.filter((s) => s?.status === 'completed').length || 0;
          const totalDurationMs =
            msg.steps?.reduce((sum, s) => sum + (s?.durationMs || 0), 0) || 0;
          const msgTimeStr = new Date(msg.timestamp).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          return (
            <div key={msg.id} className="jarvis-message-item flex flex-col gap-3 w-full">
              {/* ---------------------------------------------------- */}
              {/* 1. USER MESSAGE (RIGHT ALIGNED BUBBLE --j-high)      */}
              {/* ---------------------------------------------------- */}
              <div className="jarvis-user-bubble-row flex flex-col items-end gap-1 w-full pl-6 sm:pl-12">
                {/* Tiny Mono Meta Line Above (DIRECTIVE · time) */}
                <div className="flex items-center gap-1.5 pr-1 flex-wrap justify-end font-mono text-[9px] text-[var(--j-muted)] uppercase tracking-wider">
                  <span>DIRECTIVE</span>
                  <span className="w-1 h-1 rounded-full bg-[var(--j-muted)]" />
                  <span>{msgTimeStr}</span>
                  {msg.deepResearch && (
                    <span className="text-[var(--j-accent)]">· DEEP SWARM</span>
                  )}
                  {msg.newAgentMode && <span className="text-purple-300">· NEW AGENT</span>}
                  {msg.diagramMode && <span className="text-amber-300">· DIAGRAM</span>}
                  {msg.chartMode && <span className="text-sky-300">· CHART</span>}
                  {msg.imageMode && <span className="text-pink-300">· IMAGE</span>}
                  {msg.coderMode && <span className="text-emerald-300">· CODER</span>}
                </div>

                {/* User Bubble */}
                <div className="jarvis-user-card bg-[var(--j-high)] text-[var(--j-text)] px-3.5 py-2.5 rounded-xl rounded-tr-xs shadow-md max-w-[92%] sm:max-w-[82%]">
                  <p className="text-[13.5px] sm:text-[14px] font-normal text-[var(--j-text)] m-0 leading-relaxed">
                    {msg.query}
                  </p>

                  {/* Attached File Chips on User Message Card */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-2 pt-1.5 border-t border-white/[0.06]">
                      {msg.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--j-card)] text-[10.5px] font-mono text-[var(--j-text)]"
                        >
                          {att.extension === 'pdf' ? (
                            <FileText size={11} className="text-amber-400 shrink-0" />
                          ) : (
                            <FileCode size={11} className="text-emerald-400 shrink-0" />
                          )}
                          <span className="font-medium max-w-[180px] truncate">{att.name}</span>
                          <span className="text-[9.5px] text-[var(--j-muted)] shrink-0">
                            ({formatAttachmentSize(att.size)})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ---------------------------------------------------- */}
              {/* 2. JARVIS MULTI-AGENT SYNTHESIS CARD (--j-low)       */}
              {/* ---------------------------------------------------- */}
              <div className="jarvis-response-row flex flex-col gap-1.5 w-full">
                {/* Agent Metadata Line Above Card */}
                <div className="flex items-center gap-2 pl-1 flex-wrap">
                  <div className="w-2 h-2 rounded-full bg-[var(--j-accent)] animate-pulse shrink-0" />
                  <span className="font-mono text-[10px] uppercase text-[var(--j-accent)] font-semibold tracking-[0.12em]">
                    JARVIS MESH
                    {executedAgentsCount > 0
                      ? ` • ${executedAgentsCount} ${
                          executedAgentsCount === 1 ? 'AGENT' : 'AGENTS'
                        } VERIFIED`
                      : ''}
                  </span>
                  {totalDurationMs > 0 && (
                    <span className="font-mono text-[10px] text-[var(--j-muted)]">
                      • {(totalDurationMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>

                {/* Synthesis Card Body */}
                <div
                  className={`jarvis-response-card relative w-full rounded-xl p-3 sm:p-4 flex flex-col gap-3 shadow-xl overflow-hidden transition-all duration-200 ${
                    synthesisTheme === 'black'
                      ? 'jarvis-synthesis-black-card bg-black'
                      : 'jarvis-synthesis-glow-card bg-[var(--j-low)]'
                  }`}
                >
                  {/* Structural corner accent decoration (Stitch style) */}
                  <div className="absolute top-0 right-0 w-8 h-8 pointer-events-none">
                    <div className="w-full h-full bg-gradient-to-bl from-[var(--j-accent)]/15 to-transparent" />
                  </div>

                  {/* Per-Message Pipeline HUD Tracker & Collapsible Diagnostic Log */}
                  {msg.steps && msg.steps.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <JarvisPipelineHudTracker
                        message={msg}
                        isExpanded={Boolean(expandedStepsMap[msg.id])}
                        onToggleExpand={() => toggleStepDetails(msg.id)}
                        theme={activeTheme}
                      />

                      {expandedStepsMap[msg.id] && (
                        <JarvisTerminalDiagnosticLog message={msg} theme={activeTheme} />
                      )}
                    </div>
                  )}

                  {/* Error Notification */}
                  {msg.error && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[var(--j-card)] text-[var(--j-danger)] text-xs font-semibold">
                      <AlertCircle size={14} className="shrink-0" />
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
                    const rawText =
                      typeof rawContent === 'object'
                        ? JSON.stringify(rawContent, null, 2)
                        : String(rawContent || '');

                    const isImageCmd =
                      isImageSlashCommand(msg.query) || isImageAiSlashCommand(msg.query);

                    return (
                      <div className="jarvis-synthesis-body prose prose-invert max-w-none text-[var(--j-text)] leading-relaxed text-sm sm:text-[14px]">
                        {!isImageCmd &&
                          (msg.deepResearch ||
                            (msg.steps &&
                              msg.steps.some(
                                (s) =>
                                  s.status === 'completed' && s.agentId !== 'finalSynthesizer',
                              ))) && (
                            <div className="jarvis-synthesis-header flex items-center justify-between flex-wrap gap-2 mb-2.5 pt-2 border-t border-white/[0.05]">
                              <div className="jarvis-synthesis-badge inline-flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-full bg-[var(--j-high)] font-mono text-[10px] font-semibold text-[var(--j-accent2)] uppercase tracking-wider">
                                  UNIFIED SYNTHESIS
                                </span>
                              </div>

                              {/* Action Buttons: Raw JSON Toggle & Copy */}
                              <div className="flex items-center gap-1 shrink-0 not-prose">
                                <button
                                  type="button"
                                  onClick={() => toggleSynthRawView(msg.id)}
                                  className="px-2 py-1 rounded-md text-[10.5px] font-mono flex items-center gap-1 bg-[var(--j-card)] hover:bg-[var(--j-high)] text-[var(--j-muted)] hover:text-[var(--j-text)] transition-colors cursor-pointer"
                                  title={
                                    isShowingSynthRaw
                                      ? 'Switch to Formatted View'
                                      : 'Switch to Raw JSON View'
                                  }
                                >
                                  {isShowingSynthRaw ? (
                                    <>
                                      <FileText size={11} className="text-[var(--j-accent)]" />
                                      <span>Formatted</span>
                                    </>
                                  ) : (
                                    <>
                                      <Code2 size={11} className="text-[var(--j-accent)]" />
                                      <span>Raw JSON</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => handleCopySynth(msg, e)}
                                  className="px-2 py-1 rounded-md text-[var(--j-muted)] hover:text-[var(--j-text)] bg-[var(--j-card)] hover:bg-[var(--j-high)] transition-colors flex items-center gap-1 text-[10.5px] font-mono cursor-pointer"
                                  title="Copy final synthesis"
                                >
                                  {copiedSynthId === msg.id ? (
                                    <>
                                      <Check size={11} className="text-emerald-400" />
                                      <span className="text-emerald-300 text-[10px]">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={11} />
                                      <span className="text-[10px] hidden sm:inline">Copy</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        {isShowingSynthRaw ? (
                          <div className="rounded-lg p-3 overflow-x-auto max-h-[500px] overflow-y-auto not-prose my-2 bg-[var(--j-lowest)]">
                            <pre className="font-mono text-xs text-[var(--j-accent2)] leading-relaxed whitespace-pre-wrap break-words m-0">
                              {rawText}
                            </pre>
                          </div>
                        ) : (
                          <>
                            <FormattedText content={cleanedAnswer || msg.answer} />
                            <JarvisFactCheckNotes steps={msg.steps} />
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* Interactive Quantitative Chart Card */}
                  {msg.chartData && (
                    <Suspense
                      fallback={
                        <div className="my-3 p-3 rounded-lg bg-[var(--j-card)] flex items-center justify-center gap-2 text-xs text-[var(--j-accent2)] font-mono">
                          <Loader2 size={14} className="animate-spin text-[var(--j-accent)]" />
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
                        <div className="my-3 p-3 rounded-lg bg-[var(--j-card)] flex items-center justify-center gap-2 text-xs text-[var(--j-accent2)] font-mono">
                          <Loader2 size={14} className="animate-spin text-[var(--j-accent)]" />
                          <span>Loading image gallery...</span>
                        </div>
                      }
                    >
                      <JarvisImageGallery images={msg.images} title={msg.query} />
                    </Suspense>
                  )}

                  {/* 🎨 Interactive 5-Prompt Image Variations Card */}
                  {(() => {
                    const isPromptImg =
                      isPromptImageSlashCommand(msg.query) ||
                      (msg.promptImageVariations && msg.promptImageVariations.length > 0);
                    if (!isPromptImg) return null;

                    const roughIdea =
                      msg.promptImageRoughIdea ||
                      stripPromptImagePrefix(msg.query) ||
                      'creative visual';
                    const variations =
                      msg.promptImageVariations && msg.promptImageVariations.length > 0
                        ? msg.promptImageVariations
                        : extractPromptImageVariations(msg.answer, roughIdea);

                    return (
                      <JarvisPromptImageCard
                        id={`prompt-image-card-${msg.id}`}
                        roughIdea={roughIdea}
                        variations={variations}
                        onUseInChat={(promptText, mode) => {
                          if (mode === 'imagesai') {
                            handleSend(`/imagesai ${promptText}`);
                          } else {
                            handleSend(`/image ${promptText}`);
                          }
                        }}
                        onOpenImageStudio={(promptText) => {
                          navigate(`/image-studio?prompt=${encodeURIComponent(promptText)}`);
                        }}
                        onGenerateMore={(idea) => {
                          handleSend(`/promptimage ${idea}`);
                        }}
                      />
                    );
                  })()}

                  {/* SVG Architectural Blueprint Diagram */}
                  {msg.diagramSvg && (
                    <Suspense
                      fallback={
                        <div className="my-3 p-3 rounded-lg bg-[var(--j-card)] flex items-center justify-center gap-2 text-xs text-amber-400 font-mono">
                          <Loader2 size={14} className="animate-spin text-amber-400" />
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

                  {/* Retrieved Vector Memory Documents (RAG) */}
                  {msg.retrievedDocChunks && msg.retrievedDocChunks.length > 0 && (
                    <div className="pt-2 border-t border-white/[0.04] flex flex-col gap-2">
                      <div className="text-[10px] font-mono tracking-wider text-[var(--j-muted)] uppercase font-semibold flex items-center gap-1.5">
                        <BookOpen size={11} className="text-[var(--j-accent2)]" />
                        <span>
                          Retrieved Vector Memory Chunks ({msg.retrievedDocChunks.length})
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {msg.retrievedDocChunks.map((chunk, i) => (
                          <div
                            key={i}
                            className="p-2.5 rounded-lg bg-[var(--j-card)] text-xs font-mono text-[var(--j-text)] flex flex-col gap-1"
                          >
                            <div className="flex items-center justify-between text-[11px] font-semibold">
                              <span className="truncate">
                                📄 {chunk.docName} (Chunk #{chunk.chunkIndex + 1})
                              </span>
                              <span className="text-[10px] text-[var(--j-accent2)] shrink-0">
                                {Math.round(chunk.score * 100)}%
                              </span>
                            </div>
                            <p className="text-[11px] font-sans text-[var(--j-muted)] line-clamp-3 leading-relaxed m-0">
                              "{chunk.text}"
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Citation Badges (Stitch Style Small Chips in --j-card) */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-1.5">
                      {msg.sources.map((src, i) => (
                        <a
                          key={i}
                          href={src.url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 rounded bg-[var(--j-card)] hover:bg-[var(--j-high)] font-mono text-[9.5px] text-[var(--j-muted)] hover:text-[var(--j-text)] flex items-center gap-1 max-w-[260px] truncate transition-colors"
                        >
                          <ExternalLink size={10} className="text-[var(--j-accent)] shrink-0" />
                          <span className="truncate">
                            {src.title || src.domain || 'Source Reference'}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Utility Action Bar Footer (Stitch Style: Left 6 Actions, Far Right Delete) */}
                  <div className="jarvis-response-actions pt-2 mt-1 border-t border-white/[0.05] flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1 flex-wrap">
                      {/* 1. Native Browser Speech Button */}
                      <button
                        type="button"
                        onClick={() => toggleSpeak(cleanedAnswer || msg.answer, msg.id)}
                        className={`p-1.5 rounded-lg transition-colors flex items-center justify-center cursor-pointer active:scale-95 ${
                          speakingId === msg.id
                            ? 'bg-[var(--j-high)] text-[var(--j-accent)]'
                            : 'text-[var(--j-muted)] hover:text-[var(--j-text)] hover:bg-[var(--j-high)]'
                        }`}
                        title={speakingId === msg.id ? 'Stop Voice' : 'Read Aloud (Browser Voice)'}
                      >
                        {speakingId === msg.id ? <VolumeX size={15} /> : <Volume2 size={15} />}
                      </button>

                      {/* 2. Edge TTS Neural Audio Button */}
                      <JarvisEdgeTtsButton
                        isPlaying={edgeTtsPlayingId === msg.id}
                        isLoading={edgeTtsLoadingId === msg.id}
                        onClick={() => handleEdgeTtsSpeak(cleanedAnswer || msg.answer, msg.id)}
                      />

                      {/* 3. Download Audio (Edge TTS MP3) Button */}
                      <button
                        type="button"
                        onClick={() =>
                          handleDownloadAudio(cleanedAnswer || msg.answer, msg.id, msg.query)
                        }
                        disabled={downloadingAudioId === msg.id}
                        className={`p-1.5 rounded-lg transition-colors flex items-center justify-center cursor-pointer active:scale-95 ${
                          downloadSuccessId === msg.id
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : downloadingAudioId === msg.id
                            ? 'bg-[var(--j-high)] text-[var(--j-accent)]'
                            : 'text-[var(--j-muted)] hover:text-[var(--j-text)] hover:bg-[var(--j-high)]'
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
                          <Loader2 size={15} className="animate-spin text-[var(--j-accent)]" />
                        ) : downloadSuccessId === msg.id ? (
                          <Check size={15} className="text-emerald-400" />
                        ) : (
                          <Download size={15} />
                        )}
                      </button>

                      {/* 4. Synthesis Theme Toggle Button */}
                      <JarvisSynthesisThemeToggle
                        theme={synthesisTheme}
                        onToggle={toggleSynthesisTheme}
                      />

                      {/* 5. Copy Synthesis Output Button */}
                      <button
                        type="button"
                        onClick={() => handleCopy(formatFullPipelineExport(msg), msg.id)}
                        className="p-1.5 rounded-lg text-[var(--j-muted)] hover:text-[var(--j-text)] hover:bg-[var(--j-high)] transition-colors flex items-center justify-center cursor-pointer active:scale-95"
                        title="Copy complete pipeline report"
                      >
                        {copiedId === msg.id ? (
                          <Check size={15} className="text-emerald-400" />
                        ) : (
                          <Copy size={15} />
                        )}
                      </button>

                      {/* 6. Save / Saved (Bookmark) Button */}
                      <button
                        type="button"
                        onClick={() => handleSave(msg)}
                        className={`px-2 py-1.5 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer active:scale-95 ${
                          recentlySavedId === msg.id
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : savedIds.has(`jarvis-${msg.id}`)
                            ? 'bg-[var(--j-high)] text-[var(--j-accent)]'
                            : 'text-[var(--j-muted)] hover:text-[var(--j-text)] hover:bg-[var(--j-high)]'
                        }`}
                        title={
                          savedIds.has(`jarvis-${msg.id}`)
                            ? 'Saved in NEXUS Library'
                            : 'Save to NEXUS Library'
                        }
                      >
                        {recentlySavedId === msg.id ? (
                          <>
                            <Check size={14} className="text-emerald-400" />
                            <span className="text-[10.5px] font-semibold text-emerald-300">
                              Saved ✓
                            </span>
                          </>
                        ) : savedIds.has(`jarvis-${msg.id}`) ? (
                          <>
                            <BookmarkCheck size={14} className="text-[var(--j-accent)]" />
                            <span className="text-[10.5px] hidden sm:inline">Saved</span>
                          </>
                        ) : (
                          <>
                            <Bookmark size={14} />
                            <span className="text-[10.5px] hidden sm:inline">Save</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* 7. Delete on the Far Right (danger color on hover) */}
                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="p-1.5 rounded-lg text-[var(--j-muted)] hover:text-[var(--j-danger)] hover:bg-[var(--j-high)] transition-colors flex items-center justify-center cursor-pointer active:scale-95"
                      title="Delete inquiry"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {/* Auto-scroll bottom target anchor */}
        <div ref={messagesEndRef} className="h-4 w-full pointer-events-none" />
      </div>

      {/* Cleared Success Feedback Banner */}
      {clearedBanner && (
        <div className={`w-full max-w-4xl mx-auto flex items-center gap-2 px-3.5 py-2.5 text-[var(--j-accent)] text-xs font-mono uppercase tracking-wider font-semibold ${hairlineTableCardClass}`}>
          <CheckCircle2 size={15} className="text-[var(--j-accent)] shrink-0" />
          <span>Conversation history cleared. Ready for your next deep inquiry.</span>
        </div>
      )}

      {/* Clear Confirmation Rounded Modal */}
      {showClearConfirm && (
        <div className={`w-full max-w-4xl mx-auto p-3.5 sm:p-4 flex items-center justify-between flex-wrap gap-3 ${hairlineTableCardClass} ring-1 ring-rose-500/40`}>
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={16} className="text-[var(--j-danger)] shrink-0" />
            <div>
              <div className="text-[var(--j-text)] text-xs font-bold">
                Clear all {messages.length} {messages.length === 1 ? 'message' : 'messages'} from JARVIS history?
              </div>
              <div className="text-[var(--j-faint)] text-[11px] font-mono">
                This will reset the current multi-agent session.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              className="px-3.5 py-1.5 rounded-lg bg-[var(--j-card)] hover:bg-[var(--j-high)] text-[var(--j-text)] text-xs font-mono uppercase tracking-wider font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmClearChat}
              className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono uppercase tracking-wider font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 size={12} />
              <span>Yes, Clear All</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. STICKY BOTTOM COMPOSER (STITCH + PARALLAX REPLICA)      */}
      {/* ========================================================= */}
      <div
        id="jarvis-input-container"
        className="jarvis-bottom-console-card sticky bottom-1.5 z-30 w-full bg-gradient-to-t from-[var(--j-bg)] via-[var(--j-bg)]/95 to-transparent pt-3 pb-1"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="relative z-10 max-w-xl mx-auto w-full flex flex-col gap-2"
        >
          {/* Hidden File Input for Attachments */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.pdf,.py,.html,.htm,.js,.jsx,.mjs,.cjs,.ts,.tsx,.json,.css,.scss,.sass,.less,.md,.markdown,.yaml,.yml,.xml,.csv,.sql,.sh,.bash,.zsh,.env,.toml,.ini,.log,.c,.cpp,.h,.hpp,.java,.go,.rs,.php,.rb,text/*,application/pdf"
            onChange={handleFileInputChange}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
          />

          {/* Error Banner for Rejected/Unsupported Files */}
          {attachmentError && (
            <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-rose-950/90 border border-rose-500/40 text-rose-200 text-xs font-mono shadow-lg">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle size={14} className="text-rose-400 shrink-0" />
                <span className="leading-snug">{attachmentError}</span>
              </div>
              <button
                type="button"
                onClick={() => setAttachmentError(null)}
                className="p-1 hover:bg-white/10 rounded-md text-rose-300 hover:text-white transition-colors shrink-0 cursor-pointer"
                title="Dismiss error"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Loading Extraction Indicator */}
          {isExtractingAttachment && (
            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[var(--j-accent)] text-xs font-mono ${subSurfaceCardClass}`}>
              <Loader2 size={13} className="animate-spin text-[var(--j-accent)]" />
              <span>Extracting text content from attachment...</span>
            </div>
          )}

          {/* Attached Files Chips Row */}
          {attachedFiles.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap px-1">
              <span className="text-[10px] font-mono text-[var(--j-accent)] font-bold uppercase tracking-wider flex items-center gap-1">
                <Paperclip size={11} />
                <span>Attached ({attachedFiles.length}):</span>
              </span>
              {attachedFiles.map((file) => (
                <div
                  key={file.id}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono text-[var(--j-text)] transition-all ${subSurfaceCardClass}`}
                >
                  {file.extension === 'pdf' ? (
                    <FileText size={12} className="text-amber-400 shrink-0" />
                  ) : (
                    <FileCode size={12} className="text-emerald-400 shrink-0" />
                  )}
                  <span className="font-medium text-[var(--j-text)] max-w-[160px] sm:max-w-[220px] truncate" title={file.name}>
                    {file.name}
                  </span>
                  <span className="text-[10px] text-[var(--j-faint)] shrink-0">
                    ({formatAttachmentSize(file.size)})
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(file.id)}
                    className="p-0.5 rounded-full hover:bg-rose-500/20 text-[var(--j-faint)] hover:text-[var(--j-danger)] transition-colors cursor-pointer"
                    title={`Remove ${file.name}`}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Stitch 2-Row Sticky Composer Box */}
          {(() => {
            const activePopoverModesCount = [
              newAgentMode,
              diagramMode,
              chartMode,
              imageMode,
              coderMode,
              searchMyDocs,
            ].filter(Boolean).length;

            const currentActiveStep = activeSteps.find((s) => s.status === 'running');
            const completedStepsCount = activeSteps.filter((s) => s.status === 'completed').length;
            const liveStatusLabel = currentActiveStep
              ? `${currentActiveStep.name} (${currentActiveStep.model})`
              : activeSteps.length > 0
              ? `${completedStepsCount}/${activeSteps.length} agents verified`
              : `Orchestrating ${activeAgentsCount}-agent cognitive mesh...`;

            return (
              <div
                className={`jarvis-composer-box rounded-2xl p-2.5 sm:p-3 flex flex-col gap-2 transition-all ${composerBoxClass} ${
                  isRunning ? 'ring-1 ring-cyan-400/40' : ''
                }`}
              >
                {/* Live Running Status Micro-Strip inside Composer */}
                {isRunning && (
                  <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/[0.06] text-[10.5px] font-mono">
                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--j-accent)] animate-ping shrink-0" />
                      <span className="text-[var(--j-accent)] font-semibold truncate">
                        ● Pipeline Active · {liveStatusLabel}
                      </span>
                    </div>
                  </div>
                )}

                {/* Row 1: Leading Quantum Orb (xs) + Text Input */}
                <div className="flex items-center gap-2.5 px-1">
                  <div
                    className="jarvis-input-orb-wrapper w-6 h-6 rounded-full flex items-center justify-center shrink-0 cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => inputRef.current?.focus()}
                    title="JARVIS Quantum Neural Core Active"
                  >
                    <JarvisQuantumOrb
                      size="xs"
                      showBadge={false}
                      isRunning={isRunning}
                      isListening={voiceListening}
                      query={query}
                      status={
                        isRunning
                          ? 'thinking'
                          : voiceListening
                          ? 'listening'
                          : query
                          ? 'synthesizing'
                          : 'idle'
                      }
                    />
                  </div>

                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={
                      attachedFiles.length > 0
                        ? `Instruct JARVIS about ${
                            attachedFiles.length === 1
                              ? attachedFiles[0].name
                              : `${attachedFiles.length} attached files`
                          }...`
                        : 'Instruct 10-Agent Cognitive Mesh...'
                    }
                    disabled={isRunning}
                    className="jarvis-search-input flex-1 min-w-0 w-full bg-transparent border-none outline-none text-[13px] sm:text-[14px] text-[var(--j-text)] placeholder:text-[var(--j-faint)] focus:outline-none focus:ring-0 disabled:opacity-50 py-0.5"
                  />
                </div>

                {/* Row 2: Left (Paperclip + Deep Swarm/Research Pill + MODES ^) | Right (Mic + Round White Send) */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  {/* Left Controls: Paperclip + Deep Research + Modes ^ */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Attach Paperclip Button + Popover */}
                    <div className="relative" ref={attachMenuRef}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAttachMenu((prev) => !prev);
                          setShowModesMenu(false);
                          setAttachmentError(null);
                        }}
                        className={`jarvis-attach-btn relative p-1.5 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                          showAttachMenu || attachedFiles.length > 0
                            ? 'bg-[var(--j-high)] text-[var(--j-text)]'
                            : 'bg-[var(--j-card)] text-[var(--j-muted)] hover:text-[var(--j-text)] hover:bg-[var(--j-high)]'
                        }`}
                        title="Attach text/code/PDF file or paste from clipboard"
                        aria-label="Add attachment or paste from clipboard"
                      >
                        <Paperclip size={15} strokeWidth={1.9} />
                        {attachedFiles.length > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--j-accent)] text-[#07080a] text-[9px] font-black flex items-center justify-center">
                            {attachedFiles.length}
                          </span>
                        )}
                      </button>

                      {/* Attach Popover Menu */}
                      {showAttachMenu && (
                        <div className="jarvis-attach-menu absolute bottom-full mb-2 left-0 w-64 rounded-2xl p-2 z-50 flex flex-col gap-1 bg-[var(--j-card)] shadow-2xl border border-white/[0.06]">
                          <div className="px-2.5 py-1.5 border-b border-white/[0.06] text-[10px] font-mono text-[var(--j-faint)] uppercase tracking-wider font-semibold flex items-center justify-between">
                            <span>Attachment Options</span>
                            <span className="text-[var(--j-accent)] font-bold">TEXT / PDF</span>
                          </div>

                          <button
                            type="button"
                            onClick={handleAttachFileClick}
                            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs text-[var(--j-text)] hover:bg-[var(--j-high)] transition-all cursor-pointer"
                          >
                            <div className="w-7 h-7 rounded-lg bg-[var(--j-low)] flex items-center justify-center shrink-0 text-[var(--j-accent)]">
                              <Paperclip size={13} />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-[var(--j-text)]">Attach File</span>
                              <span className="text-[10px] text-[var(--j-faint)] truncate">
                                .txt, .pdf, .py, .html, .js, .ts, .json, .md
                              </span>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={handlePasteFromClipboard}
                            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs text-[var(--j-text)] hover:bg-[var(--j-high)] transition-all cursor-pointer"
                          >
                            <div className="w-7 h-7 rounded-lg bg-[var(--j-low)] flex items-center justify-center shrink-0 text-[var(--j-accent2)]">
                              <Clipboard size={13} />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-[var(--j-text)]">Paste from Clipboard</span>
                              <span className="text-[10px] text-[var(--j-faint)]">
                                Insert copied text or code into input
                              </span>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Deep Swarm / Deep Research Pill Button */}
                    <button
                      type="button"
                      onClick={() => setDeepResearch((prev) => !prev)}
                      className={`px-2.5 py-1 rounded-lg bg-[var(--j-card)] hover:bg-[var(--j-high)] inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider font-semibold transition-colors cursor-pointer select-none ${
                        deepResearch
                          ? 'text-[var(--j-accent)] ring-1 ring-cyan-400/30'
                          : 'text-[var(--j-muted)] hover:text-[var(--j-text)]'
                      }`}
                      title="Toggle Deep Swarm / Deep Research (5-Agent Mesh)"
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          deepResearch
                            ? 'bg-[var(--j-accent)] shadow-[0_0_6px_#00f0ff]'
                            : 'bg-[var(--j-faint)]'
                        }`}
                      />
                      <span>Deep Swarm</span>
                    </button>

                    {/* '^' Modes Popover Trigger + Menu */}
                    <div className="relative" ref={modesMenuRef}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowModesMenu((prev) => !prev);
                          setShowAttachMenu(false);
                        }}
                        className={`px-2.5 py-1 rounded-lg bg-[var(--j-card)] hover:bg-[var(--j-high)] inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider font-semibold transition-colors cursor-pointer select-none ${
                          showModesMenu || activePopoverModesCount > 0
                            ? 'text-[var(--j-accent)] ring-1 ring-cyan-400/30'
                            : 'text-[var(--j-muted)] hover:text-[var(--j-text)]'
                        }`}
                        title="Open Jarvis Modes & Visual Theme"
                      >
                        <span>
                          {activePopoverModesCount > 0
                            ? `Modes · ${activePopoverModesCount}`
                            : 'Modes'}
                        </span>
                        <ChevronUp
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            showModesMenu ? 'rotate-180 text-[var(--j-accent)]' : 'text-[var(--j-muted)]'
                          }`}
                        />
                      </button>

                      {/* '^' Modes Popover Panel */}
                      {showModesMenu && (
                        <div className="jarvis-modes-popover absolute bottom-full left-0 sm:left-auto sm:right-0 mb-2 w-[285px] sm:w-[320px] rounded-2xl p-2.5 z-50 bg-[var(--j-card)] shadow-2xl border border-white/[0.06]">
                          <div className="flex items-center justify-between px-2 py-1 mb-2 border-b border-white/[0.06]">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--j-muted)]">
                              Jarvis Modes &amp; Theme
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowModesMenu(false)}
                              className="text-[var(--j-faint)] hover:text-[var(--j-text)] p-0.5 rounded cursor-pointer"
                              aria-label="Close modes menu"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* 1. Visual Theme 3-Button Selector */}
                          <div className="px-1 pb-2.5 mb-2 border-b border-white/[0.06]">
                            <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--j-muted)] mb-1.5 px-1">
                              <Palette size={11} className="text-[var(--j-accent)]" />
                              <span>Visual Theme</span>
                            </div>
                            <div className="grid grid-cols-3 gap-1">
                              {(
                                [
                                  { id: 'minimal', label: 'Minimal' },
                                  { id: 'classic', label: 'Classic' },
                                  { id: 'fulldark', label: 'Full Dark' },
                                ] as const
                              ).map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => handleThemeSelect(t.id)}
                                  className={`px-1.5 py-1.5 rounded-lg border text-[10px] font-mono uppercase tracking-wider font-medium text-center transition-all cursor-pointer ${
                                    activeTheme === t.id
                                      ? 'border-white bg-white text-black font-semibold'
                                      : 'border-white/[0.08] bg-[var(--j-low)] text-[var(--j-muted)] hover:text-[var(--j-text)]'
                                  }`}
                                >
                                  {t.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* 2. Modes Toggles (All 6 Modes) */}
                          <div className="flex flex-col gap-1 pb-2 mb-2 border-b border-white/[0.06]">
                            <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--j-muted)] mb-0.5 px-2">
                              <Zap size={11} className="text-[var(--j-accent)]" />
                              <span>Modes</span>
                            </div>

                            {/* 1. New Agent Mode */}
                            <label
                              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl cursor-pointer transition-colors ${
                                newAgentMode
                                  ? 'bg-[var(--j-high)] text-[var(--j-text)]'
                                  : 'hover:bg-[var(--j-low)] text-[var(--j-text)]'
                              }`}
                              title={
                                newAgentMode
                                  ? 'New Agent Mode active: 5-node dynamic pipeline (Planner → 3 Query-Tailored Specialists → Synthesizer)'
                                  : 'Enable New Agent Mode (dynamic 5-node specialist pipeline)'
                              }
                            >
                              <input
                                type="checkbox"
                                checked={newAgentMode}
                                onChange={(e) => setNewAgentMode(e.target.checked)}
                                className="hidden"
                              />
                              <div className="flex items-center gap-2 min-w-0">
                                <span>✨</span>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[11px] font-semibold leading-tight">
                                    New Agent
                                  </span>
                                  <span className="text-[9.5px] text-[var(--j-faint)] truncate">
                                    Dynamic 5-node specialist pipeline
                                  </span>
                                </div>
                              </div>
                              <div
                                className={`w-7 h-3.5 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                                  newAgentMode ? 'bg-[var(--j-accent)]' : 'bg-zinc-700'
                                }`}
                              >
                                <div
                                  className={`w-2.5 h-2.5 rounded-full bg-black transition-transform duration-200 ${
                                    newAgentMode ? 'translate-x-3.5' : 'translate-x-0'
                                  }`}
                                />
                              </div>
                            </label>

                            {/* 2. Diagram Mode */}
                            <label
                              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl cursor-pointer transition-colors ${
                                diagramMode
                                  ? 'bg-[var(--j-high)] text-[var(--j-text)]'
                                  : 'hover:bg-[var(--j-low)] text-[var(--j-text)]'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={diagramMode}
                                onChange={(e) => setDiagramMode(e.target.checked)}
                                className="hidden"
                              />
                              <div className="flex items-center gap-2 min-w-0">
                                <span>🏗️</span>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[11px] font-semibold leading-tight">
                                    Diagram Mode
                                  </span>
                                  <span className="text-[9.5px] text-[var(--j-faint)] truncate">
                                    SVG architectural blueprint
                                  </span>
                                </div>
                              </div>
                              <div
                                className={`w-7 h-3.5 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                                  diagramMode ? 'bg-[var(--j-accent)]' : 'bg-zinc-700'
                                }`}
                              >
                                <div
                                  className={`w-2.5 h-2.5 rounded-full bg-black transition-transform duration-200 ${
                                    diagramMode ? 'translate-x-3.5' : 'translate-x-0'
                                  }`}
                                />
                              </div>
                            </label>

                            {/* 3. Chart Mode */}
                            <label
                              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl cursor-pointer transition-colors ${
                                chartMode
                                  ? 'bg-[var(--j-high)] text-[var(--j-text)]'
                                  : 'hover:bg-[var(--j-low)] text-[var(--j-text)]'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={chartMode}
                                onChange={(e) => setChartMode(e.target.checked)}
                                className="hidden"
                              />
                              <div className="flex items-center gap-2 min-w-0">
                                <span>📊</span>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[11px] font-semibold leading-tight">
                                    Chart Mode
                                  </span>
                                  <span className="text-[9.5px] text-[var(--j-faint)] truncate">
                                    Interactive quantitative chart
                                  </span>
                                </div>
                              </div>
                              <div
                                className={`w-7 h-3.5 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                                  chartMode ? 'bg-[var(--j-accent)]' : 'bg-zinc-700'
                                }`}
                              >
                                <div
                                  className={`w-2.5 h-2.5 rounded-full bg-black transition-transform duration-200 ${
                                    chartMode ? 'translate-x-3.5' : 'translate-x-0'
                                  }`}
                                />
                              </div>
                            </label>

                            {/* 4. Image Mode */}
                            <label
                              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl cursor-pointer transition-colors ${
                                imageMode
                                  ? 'bg-[var(--j-high)] text-[var(--j-text)]'
                                  : 'hover:bg-[var(--j-low)] text-[var(--j-text)]'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={imageMode}
                                onChange={(e) => setImageMode(e.target.checked)}
                                className="hidden"
                              />
                              <div className="flex items-center gap-2 min-w-0">
                                <span>🖼️</span>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[11px] font-semibold leading-tight">
                                    Image Mode
                                  </span>
                                  <span className="text-[9.5px] text-[var(--j-faint)] truncate">
                                    Retrieve visual media gallery
                                  </span>
                                </div>
                              </div>
                              <div
                                className={`w-7 h-3.5 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                                  imageMode ? 'bg-[var(--j-accent)]' : 'bg-zinc-700'
                                }`}
                              >
                                <div
                                  className={`w-2.5 h-2.5 rounded-full bg-black transition-transform duration-200 ${
                                    imageMode ? 'translate-x-3.5' : 'translate-x-0'
                                  }`}
                                />
                              </div>
                            </label>

                            {/* 5. Coder Mode */}
                            <label
                              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl cursor-pointer transition-colors ${
                                coderMode
                                  ? 'bg-[var(--j-high)] text-[var(--j-text)]'
                                  : 'hover:bg-[var(--j-low)] text-[var(--j-text)]'
                              }`}
                              title={
                                coderMode
                                  ? 'Coder Agent enabled (auto-detection active)'
                                  : 'Coder Agent disabled (auto-detection disabled)'
                              }
                            >
                              <input
                                type="checkbox"
                                checked={coderMode}
                                onChange={(e) => handleToggleCoderMode(e.target.checked)}
                                className="hidden"
                              />
                              <div className="flex items-center gap-2 min-w-0">
                                <span>💻</span>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[11px] font-semibold leading-tight">
                                    Coder
                                  </span>
                                  <span className="text-[9.5px] text-[var(--j-faint)] truncate">
                                    Specialized software engineer agent
                                  </span>
                                </div>
                              </div>
                              <div
                                className={`w-7 h-3.5 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                                  coderMode ? 'bg-[var(--j-accent)]' : 'bg-zinc-700'
                                }`}
                              >
                                <div
                                  className={`w-2.5 h-2.5 rounded-full bg-black transition-transform duration-200 ${
                                    coderMode ? 'translate-x-3.5' : 'translate-x-0'
                                  }`}
                                />
                              </div>
                            </label>

                            {/* 6. Search My Docs (RAG) + Document Selector */}
                            <div
                              className={`flex flex-col gap-1.5 px-2.5 py-1.5 rounded-xl transition-colors ${
                                searchMyDocs
                                  ? 'bg-[var(--j-high)] text-[var(--j-text)]'
                                  : 'hover:bg-[var(--j-low)] text-[var(--j-text)]'
                              }`}
                            >
                              <label
                                className="flex items-center justify-between gap-2 cursor-pointer"
                                title={
                                  availableDocs.length === 0
                                    ? 'Upload documents in Settings > Document Library to search vector memory'
                                    : searchMyDocs
                                    ? `Searching ${
                                        docSearchMode === 'specific' && selectedDocId
                                          ? availableDocs.find((d) => d.id === selectedDocId)?.name ||
                                            'selected document'
                                          : 'all indexed library documents'
                                      }`
                                    : 'Enable Document Library (Vector Memory / RAG) search'
                                }
                              >
                                <input
                                  type="checkbox"
                                  checked={searchMyDocs}
                                  onChange={(e) => setSearchMyDocs(e.target.checked)}
                                  className="hidden"
                                />
                                <div className="flex items-center gap-2 min-w-0">
                                  <span>📚</span>
                                  <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] font-semibold leading-tight">
                                        Search My Docs
                                      </span>
                                      {availableDocs.length > 0 && (
                                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[var(--j-low)] text-[var(--j-accent)] font-mono">
                                          {availableDocs.filter((d) => d.enabledForJarvis).length}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[9.5px] text-[var(--j-faint)] truncate">
                                      Vector memory / RAG search
                                    </span>
                                  </div>
                                </div>
                                <div
                                  className={`w-7 h-3.5 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                                    searchMyDocs ? 'bg-[var(--j-accent)]' : 'bg-zinc-700'
                                  }`}
                                >
                                  <div
                                    className={`w-2.5 h-2.5 rounded-full bg-black transition-transform duration-200 ${
                                      searchMyDocs ? 'translate-x-3.5' : 'translate-x-0'
                                    }`}
                                  />
                                </div>
                              </label>

                              {searchMyDocs && availableDocs.length > 0 && (
                                <select
                                  value={docSearchMode === 'specific' ? selectedDocId : 'all'}
                                  onChange={(e) => {
                                    if (e.target.value === 'all') {
                                      setDocSearchMode('all');
                                      setSelectedDocId('');
                                    } else {
                                      setDocSearchMode('specific');
                                      setSelectedDocId(e.target.value);
                                    }
                                  }}
                                  className="w-full bg-[var(--j-lowest)] text-[var(--j-text)] text-[11px] font-mono border border-white/[0.08] rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                                >
                                  <option value="all">
                                    All Docs ({availableDocs.filter((d) => d.enabledForJarvis).length})
                                  </option>
                                  {availableDocs.map((doc) => (
                                    <option key={doc.id} value={doc.id}>
                                      📄 {doc.name.length > 26 ? doc.name.slice(0, 24) + '...' : doc.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>

                          {/* 3. Footer Row inside Popover: Configure Agents, New Inquiry, Clear */}
                          <div className="flex items-center justify-between gap-1.5 pt-0.5 px-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                setShowModesMenu(false);
                                onOpenSettings();
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--j-low)] hover:bg-[var(--j-high)] text-[10px] font-mono uppercase tracking-wider text-[var(--j-muted)] hover:text-[var(--j-text)] transition-colors cursor-pointer"
                              title="Configure Agent parameters, providers and models"
                            >
                              <Cpu size={11} className="text-[var(--j-accent)]" />
                              <span>Configure Agents</span>
                            </button>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowModesMenu(false);
                                  handleNewChat();
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[var(--j-low)] hover:bg-[var(--j-high)] text-[10px] font-mono uppercase tracking-wider text-[var(--j-muted)] hover:text-[var(--j-text)] transition-colors cursor-pointer"
                                title="Start a fresh inquiry"
                              >
                                <Plus size={11} className="text-[var(--j-accent)]" />
                                <span>New Inquiry</span>
                              </button>

                              {messages.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowModesMenu(false);
                                    setShowClearConfirm(true);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[var(--j-low)] hover:bg-[var(--j-high)] text-[10px] font-mono uppercase tracking-wider text-[var(--j-danger)] transition-colors cursor-pointer"
                                  title="Clear conversation history"
                                >
                                  <Trash2 size={11} />
                                  <span>Clear ({messages.length})</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Controls: Mic + Round White Send */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Mic / Voice Button */}
                    <button
                      type="button"
                      onClick={toggleVoiceInput}
                      aria-label="Voice input"
                      title={voiceListening ? 'Stop Listening' : 'Speak Prompt'}
                      className={`jarvis-mic-btn p-2 rounded-full flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                        voiceListening
                          ? 'bg-rose-500 text-white animate-pulse'
                          : 'text-[var(--j-muted)] hover:text-[var(--j-text)] hover:bg-[var(--j-card)]'
                      }`}
                    >
                      <Mic size={16} className={voiceListening ? 'animate-bounce' : ''} />
                    </button>

                    {/* Round White Send Button (Stitch + Parallax Replica) */}
                    <button
                      type="submit"
                      disabled={
                        (!query.trim() && attachedFiles.length === 0) ||
                        isRunning ||
                        isExtractingAttachment
                      }
                      title={
                        isRunning
                          ? 'Orchestrating...'
                          : isExtractingAttachment
                          ? 'Extracting...'
                          : 'Ask JARVIS'
                      }
                      aria-label="Ask JARVIS"
                      className="jarvis-submit-btn w-9 h-9 rounded-full bg-[#e4e1e7] hover:bg-white text-[#07080a] flex items-center justify-center transition-transform active:scale-95 shrink-0 shadow-[0_0_12px_rgba(255,255,255,0.25)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isRunning ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#07080a]" />
                      ) : (
                        <Send className="w-4 h-4 text-[#07080a]" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </form>
      </div>
    </div>
  );
}


