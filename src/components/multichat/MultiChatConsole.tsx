import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Send,
  Trash2,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Sparkles,
  User,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Download,
  Share2,
  Sliders,
  Layers,
  Columns,
  ListFilter,
  X,
  Clock,
  Cpu,
  Radio,
  CornerDownRight,
  MessageSquareQuote,
  Play,
  Pause,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Globe,
  Star,
  AtSign,
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { copyToClipboard } from '@/lib/clipboard';
import { cleanMarkdownForSpeech } from '@/lib/format';
import { FormattedText } from '@/components/jarvis/FormattedText';
import { MultiChatCategorySelector } from '@/components/multichat/MultiChatCategorySelector';
import { MultiChatSessionBar } from '@/components/multichat/MultiChatSessionBar';
import { MultiChatConsensusCard } from '@/components/multichat/MultiChatConsensusCard';
import {
  executeMultiChatTurn,
  executePersonaBranch,
  getPersonaCleanText,
  generateMultiChatConsensus,
  parseMultiChatMentions,
} from '@/services/multiChatOrchestrator';
import type {
  MultiChatMessage,
  MultiChatSystemConfig,
  MultiChatPersonaResponse,
  MultiChatPersonaId,
  MultiChatCategoryId,
  MultiChatDialogueMode,
  MultiChatSession,
  MultiChatTheme,
  Skill,
} from '@/types';

interface MultiChatConsoleProps {
  config: MultiChatSystemConfig;
  onNavigateToSettings: () => void;
  theme?: MultiChatTheme;
  onChangeTheme?: (theme: MultiChatTheme) => void;
}

type ViewMode = 'unified' | 'tabs' | 'grid';

interface PodcastTrack {
  msgId: string;
  personaId: MultiChatPersonaId;
  name: string;
  icon: string;
  accentColor: string;
  toneBadge?: string;
  text: string;
  query: string;
}

const PROMPT_CATEGORIES = [
  {
    category: 'Analytical & Science',
    icon: '🔬',
    prompts: [
      'What is quantum entanglement and how does it challenge classical physics?',
      'How does CRISPR gene editing work, and what are its practical boundaries?',
    ],
  },
  {
    category: 'Strategy & Mindset',
    icon: '💡',
    prompts: [
      'Give me actionable advice for staying motivated when working on long projects.',
      'How do I balance high career ambition with everyday mindfulness?',
    ],
  },
  {
    category: 'Technology & AI',
    icon: '🤖',
    prompts: [
      'Explain how deep learning architectures differ from human cognitive reasoning.',
      'What are the most promising breakthroughs in renewable energy storage?',
    ],
  },
  {
    category: 'Philosophy & Life',
    icon: '🌌',
    prompts: [
      'If technology continues to automate routine work, what becomes the core human purpose?',
      'How can one make high-stakes decisions with calmness and emotional detachment?',
    ],
  },
];

export function MultiChatConsole({
  config,
  onNavigateToSettings,
  theme: propTheme,
  onChangeTheme,
}: MultiChatConsoleProps) {
  const [localTheme, setLocalTheme] = useState<MultiChatTheme>(() => storage.getMultiChatTheme());
  const activeTheme: MultiChatTheme = propTheme || localTheme;
  const isClassic = activeTheme === 'classic';
  const isFullDark = activeTheme === 'fulldark';
  const isMinimal = activeTheme === 'minimal';

  const handleCycleTheme = () => {
    const order: MultiChatTheme[] = ['minimal', 'classic', 'fulldark'];
    const next = order[(order.indexOf(activeTheme) + 1) % order.length];
    setLocalTheme(next);
    storage.setMultiChatTheme(next);
    onChangeTheme?.(next);
  };

  const [messages, setMessages] = useState<MultiChatMessage[]>(() => storage.getMultiChatMessages());
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedCombinedId, setCopiedCombinedId] = useState<string | null>(null);
  const [copiedQueryId, setCopiedQueryId] = useState<string | null>(null);
  const [playingAudioKey, setPlayingAudioKey] = useState<string | null>(null);
  const [edgeTtsLoadingId, setEdgeTtsLoadingId] = useState<string | null>(null);
  const [downloadingAudioId, setDownloadingAudioId] = useState<string | null>(null);
  const [downloadSuccessId, setDownloadSuccessId] = useState<string | null>(null);
  const [clearedBanner, setClearedBanner] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('unified');
  const [selectedPersonaTab, setSelectedPersonaTab] = useState<Record<string, string>>({});
  const [showQuickPrompts, setShowQuickPrompts] = useState(false);
  const [showCategoryStrip, setShowCategoryStrip] = useState(false);

  // CATEGORY PRESET STATE
  const [selectedCategory, setSelectedCategory] = useState<MultiChatCategoryId>(() => {
    try {
      const saved = localStorage.getItem('nexus_multichat_category');
      if (
        saved &&
        ['general', 'research', 'technology', 'science', 'strategy', 'learning', 'creative', 'philosophy'].includes(saved)
      ) {
        return saved as MultiChatCategoryId;
      }
    } catch {
      // ignore
    }
    return 'general';
  });

  const handleSelectCategory = (cat: MultiChatCategoryId) => {
    setSelectedCategory(cat);
    try {
      localStorage.setItem('nexus_multichat_category', cat);
    } catch (err) {
      console.warn('Could not persist category preference:', err);
    }
  };

  // FEATURE 1: 1-ON-1 PERSONA BRANCHING STATES
  const [activeBranchCardKey, setActiveBranchCardKey] = useState<string | null>(null);
  const [branchDraftInputs, setBranchDraftInputs] = useState<Record<string, string>>({});
  const [branchLoadingKey, setBranchLoadingKey] = useState<string | null>(null);

  // FEATURE 2: DOCUMENT LENS & WEB LENS STATES
  const [docLensEnabled, setDocLensEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nexus_multichat_doclens') === 'true';
    } catch {
      return false;
    }
  });
  const [expandedDocMsgId, setExpandedDocMsgId] = useState<string | null>(null);

  const [webLensEnabled, setWebLensEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nexus_multichat_weblens') === 'true';
    } catch {
      return false;
    }
  });
  const [expandedWebMsgId, setExpandedWebMsgId] = useState<string | null>(null);

  // DIALOGUE MODE STATE (Harmony / Debate / Parallel)
  const [dialogueMode, setDialogueMode] = useState<MultiChatDialogueMode>(() => {
    try {
      const saved = localStorage.getItem('nexus_multichat_dialogue_mode');
      if (saved === 'harmony' || saved === 'debate' || saved === 'parallel') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'harmony';
  });

  // SKILLS INTEGRATION STATE
  const [skillsEnabled, setSkillsEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nexus_multichat_skills_enabled') !== 'false';
    } catch {
      return true;
    }
  });
  const [skills, setSkills] = useState<Skill[]>(() => storage.getSkills());

  // MULTI-SESSION & PINNED FILTER STATES
  const [sessions, setSessions] = useState<MultiChatSession[]>(() =>
    storage.getMultiChatSessions(),
  );
  const [activeSessionId, setActiveSessionId] = useState<string>(() =>
    storage.getActiveMultiChatSessionId(),
  );
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);

  // @PERSONA DIRECT TARGETING & CONSENSUS STATES
  const [directTargetIds, setDirectTargetIds] = useState<MultiChatPersonaId[]>([]);
  const [consensusLoadingMsgId, setConsensusLoadingMsgId] = useState<string | null>(null);

  // FEATURE 3: PODCAST MODE STATES
  const [isPodcastActive, setIsPodcastActive] = useState(false);
  const [podcastPlaying, setPodcastPlaying] = useState(false);
  const [podcastTrackIndex, setPodcastTrackIndex] = useState(0);
  const [podcastPlaybackRate, setPodcastPlaybackRate] = useState<number>(1.0);
  const podcastAudioRef = useRef<HTMLAudioElement | null>(null);

  const toggleDocLens = () => {
    setDocLensEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('nexus_multichat_doclens', String(next));
      } catch (err) {
        console.warn('Could not persist Doc Lens preference:', err);
      }
      return next;
    });
  };

  const toggleWebLens = () => {
    setWebLensEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('nexus_multichat_weblens', String(next));
      } catch (err) {
        console.warn('Could not persist Web Lens preference:', err);
      }
      return next;
    });
  };

  const handleSelectDialogueMode = (mode: MultiChatDialogueMode) => {
    setDialogueMode(mode);
    try {
      localStorage.setItem('nexus_multichat_dialogue_mode', mode);
    } catch {
      // ignore
    }
  };

  const handleToggleSkillsEnabled = () => {
    setSkillsEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('nexus_multichat_skills_enabled', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleSelectSession = (sessionId: string) => {
    stopAudio();
    const nextMsgs = storage.setActiveMultiChatSessionId(sessionId);
    setActiveSessionId(sessionId);
    setMessages(nextMsgs);
    setSessions(storage.getMultiChatSessions());
    setShowPinnedOnly(false);
  };

  const handleCreateSession = () => {
    stopAudio();
    const { session, sessions: nextSessions } = storage.createMultiChatSession();
    setActiveSessionId(session.id);
    setSessions(nextSessions);
    setMessages([]);
    setShowPinnedOnly(false);
  };

  const handleRenameSession = (sessionId: string, title: string) => {
    const nextSessions = storage.renameMultiChatSession(sessionId, title);
    setSessions(nextSessions);
  };

  const handleDeleteSession = (sessionId: string) => {
    stopAudio();
    const res = storage.deleteMultiChatSession(sessionId);
    setSessions(res.sessions);
    setActiveSessionId(res.activeId);
    setMessages(res.messages);
  };

  const handleTogglePinMessage = (messageId: string) => {
    setMessages((prev) => {
      const next = prev.map((m) =>
        m.id === messageId ? { ...m, pinned: !m.pinned } : m,
      );
      storage.saveMultiChatMessages(next);
      setSessions(storage.getMultiChatSessions());
      return next;
    });
  };

  const handleGenerateConsensus = async (msg: MultiChatMessage) => {
    if (consensusLoadingMsgId) return;
    setConsensusLoadingMsgId(msg.id);
    try {
      const consensusData = await generateMultiChatConsensus(msg, config);
      setMessages((prev) => {
        const next = prev.map((m) =>
          m.id === msg.id ? { ...m, consensus: consensusData } : m,
        );
        storage.saveMultiChatMessages(next);
        setSessions(storage.getMultiChatSessions());
        return next;
      });
    } finally {
      setConsensusLoadingMsgId(null);
    }
  };

  const handleToggleChecklistItem = (msgId: string, itemId: string) => {
    setMessages((prev) => {
      const next = prev.map((m) => {
        if (m.id !== msgId || !m.consensus) return m;
        return {
          ...m,
          consensus: {
            ...m.consensus,
            actionChecklist: m.consensus.actionChecklist.map((item) =>
              item.id === itemId ? { ...item, done: !item.done } : item,
            ),
          },
        };
      });
      storage.saveMultiChatMessages(next);
      setSessions(storage.getMultiChatSessions());
      return next;
    });
  };

  const handleToggleDirectPersona = (personaId: MultiChatPersonaId) => {
    setDirectTargetIds((prev) =>
      prev.includes(personaId)
        ? prev.filter((id) => id !== personaId)
        : [...prev, personaId],
    );
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatTopRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const edgeTtsAudioRef = useRef<HTMLAudioElement | null>(null);

  // Auto-resize textarea height like AI Assistant page
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, [inputText]);

  // Stop active speech or audio
  const stopAudio = () => {
    if (edgeTtsAudioRef.current) {
      edgeTtsAudioRef.current.pause();
      edgeTtsAudioRef.current = null;
    }
    if (podcastAudioRef.current) {
      podcastAudioRef.current.pause();
      podcastAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingAudioKey(null);
    setEdgeTtsLoadingId(null);
    setPodcastPlaying(false);
  };

  // Delete message box (reused by both manual Delete button and auto-cleanup):
  // Deletes only that specific message card (user question + that card's persona answers)
  // from the current conversation view, cleans up audio/tabs, and removes from persistent storage.
  const handleDeleteMessage = (messageId: string) => {
    // If audio is currently playing for this message, stop it immediately
    if (
      playingAudioKey === `all_${messageId}` ||
      (playingAudioKey && playingAudioKey.startsWith(`${messageId}_`))
    ) {
      stopAudio();
    }

    // Clean up persona tab selection state for this message
    setSelectedPersonaTab((prev) => {
      const next = { ...prev };
      delete next[messageId];
      return next;
    });

    // Remove from persistent storage
    storage.deleteMultiChatMessage(messageId);
    setSessions(storage.getMultiChatSessions());

    // Remove from active React state
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  // Sync with storage on mount and window focus
  useEffect(() => {
    const syncAll = () => {
      setMessages(storage.getMultiChatMessages());
      setSessions(storage.getMultiChatSessions());
      setActiveSessionId(storage.getActiveMultiChatSessionId());
      setSkills(storage.getSkills());
    };
    syncAll();
    window.addEventListener('nexus-skills-changed', syncAll);
    return () => {
      window.removeEventListener('nexus-skills-changed', syncAll);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Clean up any speech on unmount
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  const enabledPersonas = Object.values(config.personas).filter((p) => p.enabled);

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || inputText).trim();
    if (!textToSend || isGenerating) return;

    const { mentionedIds } = parseMultiChatMentions(textToSend);
    const combinedTargetIds = Array.from(new Set([...directTargetIds, ...mentionedIds]));

    const allPersonas = Object.values(config.personas);
    let activeTurnPersonas = enabledPersonas;
    if (combinedTargetIds.length > 0) {
      const matched = allPersonas.filter((p) => combinedTargetIds.includes(p.id));
      if (matched.length > 0) {
        activeTurnPersonas = matched;
      }
    }

    if (activeTurnPersonas.length === 0) {
      alert('All personas are currently disabled. Please enable at least one persona in Agent Configurations.');
      onNavigateToSettings();
      return;
    }

    setInputText('');
    setShowQuickPrompts(false);
    setIsGenerating(true);

    const messageId = `mc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const orderedIds = ['nova', 'orbit', 'cosmos'];
    const sortedEnabledPersonas = [...activeTurnPersonas].sort((a, b) => {
      const idxA = orderedIds.indexOf(a.id);
      const idxB = orderedIds.indexOf(b.id);
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });

    const initialResponses: MultiChatPersonaResponse[] = sortedEnabledPersonas.map((p, idx) => ({
      personaId: p.id,
      name: p.name,
      icon: p.icon,
      accentColor: p.accentColor,
      toneBadge: p.toneBadge,
      text: '',
      status: dialogueMode === 'parallel' || idx === 0 ? 'running' : 'pending',
    }));

    const newMessage: MultiChatMessage = {
      id: messageId,
      query: textToSend,
      timestamp: Date.now(),
      responses: initialResponses,
      docLensEnabled: docLensEnabled,
      webLensEnabled: webLensEnabled,
      dialogueMode,
      targetPersonaIds: combinedTargetIds.length > 0 ? combinedTargetIds : undefined,
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    storage.saveMultiChatMessages(updatedMessages);
    setSessions(storage.getMultiChatSessions());

    try {
      const turnResult = await executeMultiChatTurn({
        query: textToSend,
        conversationHistory: messages,
        config,
        category: selectedCategory,
        permanentMemories: storage.getMultiChatMemories(),
        responseLanguage: config.responseLanguage ?? storage.getMultiChatResponseLanguage(),
        enableDocLens: docLensEnabled,
        enableWebLens: webLensEnabled,
        dialogueMode,
        targetPersonaIds: combinedTargetIds.length > 0 ? combinedTargetIds : undefined,
        enableSkills: skillsEnabled,
        onPersonaUpdate: (updatedResp) => {
          setMessages((prev) => {
            const next = prev.map((msg) => {
              if (msg.id !== messageId) return msg;
              const nextResponses = msg.responses.map((r) =>
                r.personaId === updatedResp.personaId ? { ...r, ...updatedResp } : r,
              );
              return { ...msg, responses: nextResponses };
            });
            storage.saveMultiChatMessages(next);
            setSessions(storage.getMultiChatSessions());
            return next;
          });
        },
      });

      if (
        (turnResult?.docChunks && turnResult.docChunks.length > 0) ||
        (turnResult?.webSources && turnResult.webSources.length > 0)
      ) {
        setMessages((prev) => {
          const next = prev.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  docChunks: turnResult.docChunks || msg.docChunks,
                  docLensEnabled: Boolean(turnResult.docChunks && turnResult.docChunks.length > 0),
                  webSources: turnResult.webSources || msg.webSources,
                  webLensEnabled: Boolean(turnResult.webSources && turnResult.webSources.length > 0),
                }
              : msg,
          );
          storage.saveMultiChatMessages(next);
          setSessions(storage.getMultiChatSessions());
          return next;
        });
      }

      // Auto-cleanup: ONLY AFTER all persona responses are fully received and saved,
      // check if total message count > 20, and automatically delete the oldest message(s)
      // to settle back to 20. Reuses the exact same handleDeleteMessage function as manual delete.
      const currentStored = storage.getMultiChatMessages();
      if (currentStored.length > 20) {
        const excessCount = currentStored.length - 20;
        for (let i = 0; i < excessCount; i++) {
          const oldest = currentStored[i];
          if (oldest) {
            handleDeleteMessage(oldest.id);
          }
        }
      }
    } catch (err: unknown) {
      console.error('[MultiChatConsole] Execution error:', err);
    } finally {
      setIsGenerating(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  // FEATURE 1: 1-ON-1 PERSONA BRANCHING HANDLERS
  const handleSendBranch = async (msg: MultiChatMessage, personaId: MultiChatPersonaId) => {
    const cardKey = `${msg.id}_${personaId}`;
    const draftText = (branchDraftInputs[cardKey] || '').trim();
    if (!draftText || branchLoadingKey) return;

    const persona = config.personas?.[personaId] || storage.getMultiChatConfig().personas?.[personaId];
    const parentResponse = msg.responses.find((r) => r.personaId === personaId);

    setBranchLoadingKey(cardKey);
    try {
      const branchTurn = await executePersonaBranch({
        persona,
        targetPersonaId: personaId,
        message: msg,
        branchQuery: draftText,
        parentMessageQuery: msg.query,
        parentPersonaResponse: parentResponse,
        priorBranchTurns: parentResponse?.branches || [],
        conversationHistory: messages,
        config,
        permanentMemories: storage.getMultiChatMemories(),
        responseLanguage: config.responseLanguage ?? storage.getMultiChatResponseLanguage(),
        documentChunks: msg.docChunks,
        enableSkills: skillsEnabled,
      });

      setMessages((prev) => {
        const next = prev.map((m) => {
          if (m.id !== msg.id) return m;
          const nextResponses = m.responses.map((r) => {
            if (r.personaId !== personaId) return r;
            const currentBranches = r.branches || [];
            return {
              ...r,
              branches: [...currentBranches, branchTurn],
            };
          });
          return { ...m, responses: nextResponses };
        });
        storage.saveMultiChatMessages(next);
        setSessions(storage.getMultiChatSessions());
        return next;
      });

      // Clear input
      setBranchDraftInputs((prev) => {
        const next = { ...prev };
        delete next[cardKey];
        return next;
      });
    } catch (err) {
      console.error('[MultiChat] Branch execution failed:', err);
    } finally {
      setBranchLoadingKey(null);
    }
  };

  const handleDeleteBranch = (
    msgId: string,
    personaId: MultiChatPersonaId,
    branchTurnId: string,
  ) => {
    setMessages((prev) => {
      const next = prev.map((m) => {
        if (m.id !== msgId) return m;
        const nextResponses = m.responses.map((r) => {
          if (r.personaId !== personaId) return r;
          return {
            ...r,
            branches: (r.branches || []).filter((b) => b.id !== branchTurnId),
          };
        });
        return { ...m, responses: nextResponses };
      });
      storage.saveMultiChatMessages(next);
      return next;
    });
  };

  // FEATURE 3: PODCAST MODE PLAYLIST & ENGINE
  const podcastTracks: PodcastTrack[] = useMemo(() => {
    const tracks: PodcastTrack[] = [];
    for (const msg of messages) {
      for (const resp of msg.responses) {
        if (resp.status === 'completed' && getPersonaCleanText(resp).trim().length > 0) {
          tracks.push({
            msgId: msg.id,
            personaId: resp.personaId,
            name: resp.name,
            icon: resp.icon,
            accentColor: resp.accentColor,
            toneBadge: resp.toneBadge,
            text: getPersonaCleanText(resp),
            query: msg.query,
          });
        }
      }
    }
    return tracks;
  }, [messages]);

  const currentPodcastTrack = podcastTracks[podcastTrackIndex] || null;

  const playPodcastTrackAtIndex = async (index: number) => {
    if (index < 0 || index >= podcastTracks.length) {
      stopAudio();
      setIsPodcastActive(false);
      return;
    }

    stopAudio();
    setPodcastTrackIndex(index);
    setIsPodcastActive(true);
    setPodcastPlaying(true);

    const track = podcastTracks[index];
    const cleanText = cleanMarkdownForSpeech(track.text);
    if (!cleanText) {
      playPodcastTrackAtIndex(index + 1);
      return;
    }

    const voice = getPersonaVoice(track.personaId);
    const spokenIntro = `${track.name}. `;
    const fullTextToSpeak = `${spokenIntro}${cleanText}`.slice(0, 3500);

    try {
      const response = await fetch('/api/edge-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: fullTextToSpeak,
          voice,
        }),
      });

      if (!response.ok) {
        throw new Error(`Podcast TTS error: ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      podcastAudioRef.current = audio;
      audio.playbackRate = podcastPlaybackRate;

      audio.onplay = () => {
        setPodcastPlaying(true);
      };

      audio.onended = () => {
        URL.revokeObjectURL(url);
        podcastAudioRef.current = null;
        if (index + 1 < podcastTracks.length) {
          playPodcastTrackAtIndex(index + 1);
        } else {
          setPodcastPlaying(false);
        }
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        podcastAudioRef.current = null;
        setPodcastPlaying(false);
      };

      await audio.play();
    } catch (err) {
      console.warn('[MultiChat] Podcast Edge TTS fallback to local speech:', err);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(fullTextToSpeak);
        utterance.rate = podcastPlaybackRate;
        utterance.pitch =
          track.personaId === 'orbit' ? 1.1 : track.personaId === 'cosmos' ? 0.9 : 1.0;
        utterance.onend = () => {
          if (index + 1 < podcastTracks.length) {
            playPodcastTrackAtIndex(index + 1);
          } else {
            setPodcastPlaying(false);
          }
        };
        utterance.onerror = () => setPodcastPlaying(false);
        setPodcastPlaying(true);
        window.speechSynthesis.speak(utterance);
      } else {
        setPodcastPlaying(false);
      }
    }
  };

  const handleStartPodcast = (startMsgId?: string) => {
    if (podcastTracks.length === 0) {
      alert('No completed persona responses available yet. Broadcast a query to start podcast playback!');
      return;
    }
    let startIdx = 0;
    if (startMsgId) {
      const foundIdx = podcastTracks.findIndex((t) => t.msgId === startMsgId);
      if (foundIdx !== -1) startIdx = foundIdx;
    }
    setIsPodcastActive(true);
    playPodcastTrackAtIndex(startIdx);
  };

  const handleTogglePodcastPlayPause = () => {
    if (podcastPlaying) {
      if (podcastAudioRef.current) {
        podcastAudioRef.current.pause();
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.pause();
      }
      setPodcastPlaying(false);
    } else {
      if (podcastAudioRef.current) {
        podcastAudioRef.current.play();
        setPodcastPlaying(true);
      } else if (
        typeof window !== 'undefined' &&
        'speechSynthesis' in window &&
        window.speechSynthesis.paused
      ) {
        window.speechSynthesis.resume();
        setPodcastPlaying(true);
      } else {
        playPodcastTrackAtIndex(podcastTrackIndex);
      }
    }
  };

  const handleNextPodcastTrack = () => {
    if (podcastTrackIndex + 1 < podcastTracks.length) {
      playPodcastTrackAtIndex(podcastTrackIndex + 1);
    }
  };

  const handlePrevPodcastTrack = () => {
    if (podcastTrackIndex > 0) {
      playPodcastTrackAtIndex(podcastTrackIndex - 1);
    }
  };

  const handleExitPodcast = () => {
    stopAudio();
    setIsPodcastActive(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopyText = async (text: string, idKey: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedId(idKey);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleCopyQuery = async (text: string, idKey: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedQueryId(idKey);
      setTimeout(() => setCopiedQueryId(null), 2000);
    }
  };

  // Helper to map persona to matched Edge TTS neural voice
  const getPersonaVoice = (personaId?: string): string => {
    const globalVoice = storage.getEdgeVoice();
    if (personaId === 'nova') return 'en-US-JennyNeural';
    if (personaId === 'orbit') return 'en-US-GuyNeural';
    if (personaId === 'cosmos') return 'en-US-EricNeural';
    return globalVoice || 'en-US-AriaNeural';
  };

  // 1. UNIVERSAL COPY BUTTON:
  // Copies all persona responses together as one formatted text block:
  // === NOVA ===
  // [nova's answer]
  //
  //   ↳ 1-on-1 Branch with NOVA (1)
  //   YOU → NOVA: [user's follow-up]
  //   NOVA: [persona's reply]
  //
  // === ORBIT ===
  // [orbit's answer]
  //
  // === COSMOS ===
  // [cosmos's answer]
  const handleCopyCombined = async (msg: MultiChatMessage) => {
    const completedResponses = msg.responses.filter(
      (r) => r.status === 'completed' && getPersonaCleanText(r).length > 0
    );
    if (completedResponses.length === 0) return;

    const formattedBlock = completedResponses
      .map((r) => {
        const answer = getPersonaCleanText(r);
        let block = `=== ${r.name.toUpperCase()} ===\n${answer}`;

        if (r.branches && r.branches.length > 0) {
          const branchBlocks = r.branches
            .map((b, bIdx) => {
              const branchText = b.response ? getPersonaCleanText(b.response) : b.text || '';
              const cleanBranchText =
                branchText ||
                (b.response?.status === 'failed' ? `*[Error: ${b.response?.error || 'Failed to generate'}]*` : '');
              return `  ↳ 1-on-1 Branch with ${r.name} (${bIdx + 1})\n  YOU → ${r.name}: ${b.query}\n  ${r.name}: ${cleanBranchText}`;
            })
            .join('\n\n');
          block += `\n\n${branchBlocks}`;
        }

        return block;
      })
      .join('\n\n');

    const success = await copyToClipboard(formattedBlock);
    if (success) {
      setCopiedCombinedId(msg.id);
      setTimeout(() => setCopiedCombinedId(null), 2000);
    }
  };

  // 2. INDIVIDUAL EDGE TTS LISTEN (Play / Stop)
  const handleToggleAudio = async (text: string, idKey: string, personaId?: string) => {
    if (playingAudioKey === idKey) {
      stopAudio();
      return;
    }

    stopAudio();

    const cleanText = cleanMarkdownForSpeech(text);
    if (!cleanText) return;

    setEdgeTtsLoadingId(idKey);
    try {
      const voice = getPersonaVoice(personaId);
      const response = await fetch('/api/edge-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText.slice(0, 3500),
          voice,
        }),
      });

      if (!response.ok) {
        throw new Error(`Edge TTS synthesis error: ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      edgeTtsAudioRef.current = audio;

      audio.onplay = () => {
        setPlayingAudioKey(idKey);
        setEdgeTtsLoadingId(null);
      };

      audio.onended = () => {
        setPlayingAudioKey(null);
        edgeTtsAudioRef.current = null;
        URL.revokeObjectURL(url);
      };

      audio.onerror = () => {
        setPlayingAudioKey(null);
        edgeTtsAudioRef.current = null;
        URL.revokeObjectURL(url);
      };

      await audio.play();
    } catch (err) {
      console.warn('[MultiChat] Edge TTS error, falling back to local speech synthesis:', err);
      setEdgeTtsLoadingId(null);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.0;
        utterance.pitch = idKey.includes('orbit') ? 1.1 : idKey.includes('cosmos') ? 0.9 : 1.0;
        utterance.onend = () => setPlayingAudioKey(null);
        utterance.onerror = () => setPlayingAudioKey(null);
        setPlayingAudioKey(idKey);
        window.speechSynthesis.speak(utterance);
      } else {
        setPlayingAudioKey(null);
      }
    }
  };

  // 2. UNIVERSAL LISTEN TO ALL:
  // Plays all 3 persona responses back-to-back using the Edge TTS system
  const handleListenToAll = async (msg: MultiChatMessage) => {
    const combinedKey = `all_${msg.id}`;
    if (playingAudioKey === combinedKey) {
      stopAudio();
      return;
    }

    stopAudio();

    const completedResponses = msg.responses.filter(
      (r) => r.status === 'completed' && getPersonaCleanText(r).length > 0
    );
    if (completedResponses.length === 0) return;

    setEdgeTtsLoadingId(combinedKey);
    try {
      const audioBlobs: Blob[] = [];

      for (const resp of completedResponses) {
        const rawText = getPersonaCleanText(resp);
        const cleanText = cleanMarkdownForSpeech(rawText);
        if (!cleanText) continue;

        const spokenIntro = `${resp.name}. `;
        const voice = getPersonaVoice(resp.personaId);

        const response = await fetch('/api/edge-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: cleanMarkdownForSpeech(spokenIntro + cleanText).slice(0, 3500),
            voice,
          }),
        });

        if (!response.ok) {
          throw new Error(`Edge TTS synthesis failed for ${resp.name}: ${response.status}`);
        }

        const blob = await response.blob();
        audioBlobs.push(blob);
      }

      if (audioBlobs.length === 0) {
        throw new Error('No audio was generated');
      }

      // Concatenate all persona MP3 binary streams into a single seamless audio file
      const stitchedBlob = new Blob(audioBlobs, { type: 'audio/mpeg' });
      const url = URL.createObjectURL(stitchedBlob);
      const audio = new Audio(url);
      edgeTtsAudioRef.current = audio;

      audio.onplay = () => {
        setPlayingAudioKey(combinedKey);
        setEdgeTtsLoadingId(null);
      };

      audio.onended = () => {
        setPlayingAudioKey(null);
        edgeTtsAudioRef.current = null;
        URL.revokeObjectURL(url);
      };

      audio.onerror = () => {
        setPlayingAudioKey(null);
        edgeTtsAudioRef.current = null;
        URL.revokeObjectURL(url);
      };

      await audio.play();
    } catch (err) {
      console.error('[MultiChat] Listen to All error:', err);
      setPlayingAudioKey(null);
      setEdgeTtsLoadingId(null);
    }
  };

  // 3. INDIVIDUAL MP3 DOWNLOAD:
  // Edge TTS download for a single persona's response
  const handleDownloadPersonaAudio = async (
    text: string,
    idKey: string,
    personaName: string,
    personaId: string,
    query?: string
  ) => {
    const cleanText = cleanMarkdownForSpeech(text);
    if (!cleanText) return;

    setDownloadingAudioId(idKey);
    try {
      const voice = getPersonaVoice(personaId);
      const response = await fetch('/api/edge-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText.slice(0, 4000),
          voice,
        }),
      });

      if (!response.ok) {
        throw new Error(`Edge TTS download failed: ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      const safeSlug = query
        ? query
            .slice(0, 25)
            .trim()
            .replace(/[^a-zA-Z0-9_-]+/g, '_')
            .toLowerCase()
        : 'response';
      a.download = `nexus_multichat_${personaName.toLowerCase()}_${safeSlug}_${Date.now()}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setDownloadSuccessId(idKey);
      setTimeout(() => setDownloadSuccessId((cur) => (cur === idKey ? null : cur)), 2500);
    } catch (err) {
      console.error('[MultiChat] Individual audio download error:', err);
    } finally {
      setDownloadingAudioId(null);
    }
  };

  // 3. UNIVERSAL MP3 DOWNLOAD:
  // Stitches all 3 persona audios into one contiguous MP3 file
  const handleDownloadAllAudio = async (msg: MultiChatMessage) => {
    const completedResponses = msg.responses.filter(
      (r) => r.status === 'completed' && getPersonaCleanText(r).length > 0
    );
    if (completedResponses.length === 0) return;

    const downloadKey = `all_dl_${msg.id}`;
    setDownloadingAudioId(downloadKey);

    try {
      const audioBlobs: Blob[] = [];

      for (const resp of completedResponses) {
        const rawText = getPersonaCleanText(resp);
        const cleanText = cleanMarkdownForSpeech(rawText);
        if (!cleanText) continue;

        const spokenIntro = `${resp.name}. `;
        const voice = getPersonaVoice(resp.personaId);

        const response = await fetch('/api/edge-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: cleanMarkdownForSpeech(spokenIntro + cleanText).slice(0, 4000),
            voice,
          }),
        });

        if (!response.ok) {
          throw new Error(`Edge TTS download failed for ${resp.name}: ${response.status}`);
        }

        const blob = await response.blob();
        audioBlobs.push(blob);
      }

      if (audioBlobs.length === 0) return;

      const stitchedBlob = new Blob(audioBlobs, { type: 'audio/mpeg' });
      const url = URL.createObjectURL(stitchedBlob);

      const a = document.createElement('a');
      a.href = url;
      const safeSlug = msg.query
        ? msg.query
            .slice(0, 25)
            .trim()
            .replace(/[^a-zA-Z0-9_-]+/g, '_')
            .toLowerCase()
        : 'multi_all';
      a.download = `nexus_multichat_all_personas_${safeSlug}_${Date.now()}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setDownloadSuccessId(downloadKey);
      setTimeout(() => setDownloadSuccessId((cur) => (cur === downloadKey ? null : cur)), 2500);
    } catch (err) {
      console.error('[MultiChat] Stitched MP3 download error:', err);
    } finally {
      setDownloadingAudioId(null);
    }
  };

  // 4. CLEAR CHAT:
  // Clears Multi Chat history, resets the 20-message conversational memory, and stops any playback
  const handleClearHistory = () => {
    stopAudio();
    storage.clearMultiChatMessages();
    setMessages([]);
    setSessions(storage.getMultiChatSessions());
    setSelectedPersonaTab({});
    setShowClearModal(false);
    setClearedBanner(true);
    setTimeout(() => setClearedBanner(false), 3500);
  };

  const handleExportTranscript = async () => {
    if (messages.length === 0) return;

    const transcriptLines: string[] = [
      '# NEXUS // MULTI CHAT TRANSCRIPT',
      `Exported on: ${new Date().toLocaleString()}`,
      '',
    ];

    for (const msg of messages) {
      transcriptLines.push(`### 👤 USER INQUIRY (${new Date(msg.timestamp).toLocaleTimeString()})`);
      transcriptLines.push(msg.query);
      transcriptLines.push('');

      // WHAT'S MISSING #1: Document Lens indicator
      if (msg.docChunks && msg.docChunks.length > 0) {
        transcriptLines.push(`📖 Doc Lens: ${msg.docChunks.length} excerpts retrieved from Document Library`);
        transcriptLines.push('');
      }

      for (const resp of msg.responses) {
        transcriptLines.push(`#### ${resp.icon} ${resp.name} [${resp.toneBadge || 'Persona'}]`);
        const text = getPersonaCleanText(resp);
        if (resp.status === 'completed') {
          transcriptLines.push(text);
        } else if (resp.status === 'failed') {
          transcriptLines.push(`*[Error: ${resp.error || 'Failed to generate'}]*`);
        } else {
          transcriptLines.push('*[Processing...]*');
        }
        transcriptLines.push('');

        // WHAT'S MISSING #2: 1-on-1 Persona Branch threads
        if (resp.branches && resp.branches.length > 0) {
          resp.branches.forEach((b, bIdx) => {
            transcriptLines.push(`    ↳ 1-on-1 Branch with ${resp.name} (${bIdx + 1})`);
            transcriptLines.push(`    YOU → ${resp.name}: ${b.query}`);
            const branchText = b.response ? getPersonaCleanText(b.response) : b.text || '';
            const cleanBranchText =
              branchText ||
              (b.response?.status === 'failed' ? `*[Error: ${b.response?.error || 'Failed to generate'}]*` : '');
            transcriptLines.push(`    ${resp.name}: ${cleanBranchText}`);
            transcriptLines.push('');
          });
        }
      }
      transcriptLines.push('---');
      transcriptLines.push('');
    }

    const fullContent = transcriptLines.join('\n');
    const success = await copyToClipboard(fullContent);
    if (success) {
      alert('Complete Multi Chat transcript copied to clipboard!');
    }
  };

  const applyQueryModifier = (modifier: string) => {
    setInputText((prev) => {
      const trimmed = prev.trim();
      if (trimmed.startsWith(modifier)) return prev;
      return `${modifier} ${trimmed}`.trim();
    });
    inputRef.current?.focus();
  };

  const charCount = inputText.length;
  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div
      ref={chatTopRef}
      className="flex flex-col gap-2.5 sm:gap-4 w-full max-w-5xl mx-auto min-h-[calc(100vh-180px)]"
    >
      {/* Sleek Compact Chat Room Top Header Bar (Mobile-Friendly 360px+) */}
      <div
        className={`flex items-center justify-between gap-1.5 sm:gap-2.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 rounded-2xl transition-all ${
          isFullDark
            ? 'bg-[#09090b] border border-white/[0.08] shadow-md shadow-black'
            : isClassic
            ? 'bg-slate-950/90 backdrop-blur-xl border border-cyan-500/25 shadow-lg shadow-cyan-950/20'
            : 'bg-zinc-900/90 backdrop-blur-xl border border-white/10 shadow-md shadow-black/40'
        }`}
      >
        {/* Left: Active Personas Horizontal Strip */}
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar min-w-0">
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full shrink-0 border ${
              isClassic
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                : isFullDark
                ? 'bg-white/[0.04] border-white/10 text-zinc-300'
                : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
            }`}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isClassic ? 'bg-cyan-400' : 'bg-indigo-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                  isClassic ? 'bg-cyan-500' : 'bg-indigo-500'
                }`}
              />
            </span>
            <span className="text-[10px] font-mono font-bold tracking-wide">MESH</span>
          </div>

          {/* Persona quick chips */}
          <div className="flex items-center gap-1 shrink-0">
            {Object.values(config.personas).map((persona) => (
              <div
                key={persona.id}
                className="inline-flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-xl text-[10px] sm:text-xs font-medium transition-all shrink-0"
                style={{
                  background: persona.enabled ? `${persona.accentColor}15` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${persona.enabled ? persona.accentColor + '40' : 'rgba(255,255,255,0.08)'}`,
                  color: persona.enabled ? persona.accentColor : '#64748b',
                  opacity: persona.enabled ? 1 : 0.45,
                }}
                title={`${persona.name} (${persona.toneBadge})`}
              >
                <span className="text-xs">{persona.icon}</span>
                <span className="font-bold text-[10px] sm:text-[11px]">{persona.name}</span>
                <span className="text-[9.5px] font-mono opacity-70 hidden lg:inline">
                  {persona.toneBadge}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: View Mode Toggle & Utility Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 ml-auto shrink-0">
          {/* Podcast Mode Button */}
          {podcastTracks.length > 0 && (
            <button
              type="button"
              onClick={isPodcastActive ? handleTogglePodcastPlayPause : () => handleStartPodcast()}
              className={`px-2 py-1 rounded-xl border text-[11px] font-semibold flex items-center gap-1 transition-all shrink-0 ${
                isPodcastActive
                  ? 'bg-indigo-500/30 text-indigo-200 border-indigo-500/50 shadow-sm'
                  : 'bg-indigo-950/40 border-indigo-500/30 hover:bg-indigo-900/50 text-indigo-300 hover:text-white'
              }`}
              title="Play entire multi-persona conversation as an audio podcast"
            >
              {isPodcastActive ? (
                <Radio size={12} className={podcastPlaying ? 'text-indigo-400 animate-pulse' : 'text-indigo-400'} />
              ) : (
                <Play size={12} className="text-indigo-400 fill-indigo-400" />
              )}
              <span className="hidden md:inline">{isPodcastActive && podcastPlaying ? 'Playing' : 'Podcast'}</span>
              <span className="px-1 py-0.2 rounded-full bg-indigo-500/30 text-[9.5px] font-mono text-indigo-200">
                {podcastTracks.length}
              </span>
            </button>
          )}

          {/* View Mode Switcher */}
          <div
            className={`flex items-center p-0.5 rounded-xl border text-[11px] ${
              isFullDark
                ? 'bg-[#121215] border-white/[0.08]'
                : isClassic
                ? 'bg-black/40 border-cyan-500/20'
                : 'bg-zinc-950/80 border-white/10'
            }`}
          >
            <button
              type="button"
              onClick={() => setViewMode('unified')}
              className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg font-medium transition-all ${
                viewMode === 'unified'
                  ? isClassic
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : isFullDark
                    ? 'bg-white/12 text-white border border-white/15'
                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Streamlined conversational card feed"
            >
              <Layers size={12} />
              <span className="hidden sm:inline">Stream</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('tabs')}
              className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg font-medium transition-all ${
                viewMode === 'tabs'
                  ? isClassic
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : isFullDark
                    ? 'bg-white/12 text-white border border-white/15'
                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Filter by persona tabs"
            >
              <ListFilter size={12} />
              <span className="hidden sm:inline">Tabs</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg font-medium transition-all ${
                viewMode === 'grid'
                  ? isClassic
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : isFullDark
                    ? 'bg-white/12 text-white border border-white/15'
                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Compare side-by-side in multi-column grid"
            >
              <Columns size={12} />
              <span className="hidden sm:inline">Split</span>
            </button>
          </div>

          {/* Export & Clear */}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleExportTranscript}
              className="p-1.5 sm:px-2 sm:py-1 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white transition-all text-[11px] font-medium flex items-center gap-1"
              title="Export complete conversation transcript"
            >
              <Share2 size={12} />
              <span className="hidden md:inline">Export</span>
            </button>
          )}

          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-300 transition-all text-[11px] font-bold flex items-center gap-1"
              title="Clear Multi Chat conversation history and reset memory"
            >
              <Trash2 size={12} className="text-rose-400" />
              <span className="hidden md:inline">Clear</span>
              <span className="px-1 py-0.2 rounded-full bg-rose-500/30 text-[9.5px] font-mono">
                {messages.length}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onNavigateToSettings}
            className={`p-1.5 sm:px-2.5 sm:py-1 rounded-xl border transition-all text-[11px] font-semibold flex items-center gap-1 ${
              isClassic
                ? 'bg-cyan-500/15 border-cyan-500/30 hover:bg-cyan-500/25 text-cyan-300'
                : isFullDark
                ? 'bg-white/[0.06] border-white/15 hover:bg-white/10 text-zinc-200'
                : 'bg-indigo-500/15 border-indigo-500/30 hover:bg-indigo-500/25 text-indigo-300'
            }`}
            title="Configure themes, persona prompts, models & temperatures"
          >
            <Sliders size={12} />
            <span className="hidden sm:inline">Agents</span>
          </button>
        </div>
      </div>

      {/* Multi-Session Thread Bar + Pinned Filter + Skills Popover + Dialogue Mode Switcher */}
      <MultiChatSessionBar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onCreateSession={handleCreateSession}
        onRenameSession={handleRenameSession}
        onDeleteSession={handleDeleteSession}
        showPinnedOnly={showPinnedOnly}
        onTogglePinnedOnly={() => setShowPinnedOnly((prev) => !prev)}
        pinnedCount={messages.filter((m) => m.pinned).length}
        dialogueMode={dialogueMode}
        onSelectDialogueMode={handleSelectDialogueMode}
        skillsEnabled={skillsEnabled}
        onToggleSkillsEnabled={handleToggleSkillsEnabled}
        skills={skills}
        onRefreshSkills={() => setSkills(storage.getSkills())}
        personas={config.personas}
        theme={activeTheme}
      />

      {/* FEATURE 3: PODCAST MODE FLOATING STUDIO PLAYER */}
      {isPodcastActive && currentPodcastTrack && (
        <div className="sticky top-2 z-40 p-2.5 sm:p-3.5 rounded-2xl bg-gradient-to-r from-slate-950 via-indigo-950/90 to-slate-950 border border-indigo-500/40 shadow-2xl shadow-indigo-950/50 backdrop-blur-2xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
            {/* Track Info */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl grid place-items-center text-lg sm:text-xl shrink-0 shadow-md"
                style={{
                  background: `${currentPodcastTrack.accentColor}25`,
                  border: `1px solid ${currentPodcastTrack.accentColor}50`,
                }}
              >
                {currentPodcastTrack.icon}
              </div>

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span
                    className="font-bold text-xs sm:text-sm tracking-tight"
                    style={{ color: currentPodcastTrack.accentColor }}
                  >
                    {currentPodcastTrack.name}
                  </span>
                  <span className="text-[9.5px] sm:text-[10px] font-mono px-1.5 sm:px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {podcastTrackIndex + 1}/{podcastTracks.length}
                  </span>
                  {podcastPlaying && (
                    <span className="flex items-end gap-0.5 h-3">
                      <span className="w-0.5 h-3 bg-indigo-400 animate-pulse rounded-full" />
                      <span className="w-0.5 h-2 bg-indigo-400 animate-pulse rounded-full" style={{ animationDelay: '100ms' }} />
                      <span className="w-0.5 h-3 bg-indigo-400 animate-pulse rounded-full" style={{ animationDelay: '200ms' }} />
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-300 truncate max-w-[200px] sm:max-w-md">
                  "{currentPodcastTrack.query}"
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
              {/* Playback speed selector */}
              <div className="flex items-center p-0.5 rounded-lg bg-black/40 border border-white/10 text-[10px] sm:text-[11px] font-mono">
                {[1, 1.25, 1.5].map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => {
                      setPodcastPlaybackRate(speed);
                      if (podcastAudioRef.current) {
                        podcastAudioRef.current.playbackRate = speed;
                      }
                    }}
                    className={`px-1.5 sm:px-2 py-0.5 rounded transition-colors ${
                      podcastPlaybackRate === speed
                        ? 'bg-indigo-500/30 text-indigo-200 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handlePrevPodcastTrack}
                disabled={podcastTrackIndex === 0}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-slate-300 hover:text-white transition-all border border-white/10"
                title="Previous response"
              >
                <ChevronLeft size={14} />
              </button>

              <button
                type="button"
                onClick={handleTogglePodcastPlayPause}
                className="p-1.5 sm:p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all font-bold"
                title={podcastPlaying ? 'Pause podcast' : 'Play podcast'}
              >
                {podcastPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
              </button>

              <button
                type="button"
                onClick={handleNextPodcastTrack}
                disabled={podcastTrackIndex >= podcastTracks.length - 1}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-slate-300 hover:text-white transition-all border border-white/10"
                title="Next response"
              >
                <ChevronRight size={14} />
              </button>

              <button
                type="button"
                onClick={handleExitPodcast}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-all border border-white/10 hover:border-rose-500/30"
                title="Close podcast player"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Conversation Thread */}
      <div className="flex flex-col gap-4 sm:gap-5 flex-1 pb-2">
        {messages.length === 0 ? (
          /* Powerful Animated Welcome Screen with Tri-Mind Neural Reactor Graphic */
          <div
            className={`relative overflow-hidden flex flex-col items-center justify-center text-center py-6 sm:py-9 px-3.5 sm:px-8 rounded-2xl sm:rounded-3xl border shadow-2xl transition-all mc-card-enter ${
              isFullDark
                ? 'bg-[#09090b] border-white/[0.1] shadow-[0_20px_60px_rgba(0,0,0,0.95)]'
                : isClassic
                ? 'bg-gradient-to-b from-slate-900/80 via-slate-950/95 to-slate-950 border-cyan-500/30 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.7),0_0_40px_rgba(6,182,212,0.12)]'
                : 'bg-zinc-900/80 border-indigo-500/25 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.65),0_0_35px_rgba(99,102,241,0.12)]'
            }`}
          >
            {/* Top Animated Laser Sweep */}
            <div className="mc-laser-line" />

            {/* Ambient Radial Glow Behind Reactor */}
            <div
              className={`pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full blur-3xl opacity-40 ${
                isClassic
                  ? 'bg-gradient-to-tr from-cyan-500/40 via-violet-500/30 to-amber-500/30'
                  : isFullDark
                  ? 'bg-gradient-to-tr from-cyan-500/20 via-purple-500/20 to-emerald-500/20'
                  : 'bg-gradient-to-tr from-indigo-500/40 via-purple-500/30 to-sky-500/30'
              }`}
            />

            {/* Centerpiece Animated Tri-Mind Neural Reactor SVG Graphic */}
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-3 sm:mb-4 grid place-items-center">
              <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible">
                <defs>
                  <radialGradient id="mcCoreGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.9" />
                    <stop offset="55%" stopColor="#6366f1" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                  </radialGradient>
                  <linearGradient id="mcTriStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="50%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#c084fc" />
                  </linearGradient>
                </defs>

                {/* Outer Counter-Rotating Ring */}
                <g className="mc-orbit-ccw">
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke="url(#mcTriStroke)"
                    strokeWidth="1.2"
                    strokeDasharray="8 6 2 6"
                    opacity="0.55"
                  />
                </g>

                {/* Inner Clockwise Orbital Ring with 3 Persona Satellite Nodes */}
                <g className="mc-orbit-cw">
                  <circle
                    cx="60"
                    cy="60"
                    r="40"
                    fill="none"
                    stroke="rgba(148, 163, 184, 0.25)"
                    strokeWidth="1.2"
                    strokeDasharray="4 4"
                  />
                  {/* NOVA Cyan Node */}
                  <circle cx="60" cy="20" r="5" fill="#38bdf8" />
                  <circle cx="60" cy="20" r="9" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.5" />
                  {/* ORBIT Amber Node */}
                  <circle cx="94.6" cy="80" r="5" fill="#f59e0b" />
                  <circle cx="94.6" cy="80" r="9" fill="none" stroke="#f59e0b" strokeWidth="1" opacity="0.5" />
                  {/* COSMOS Violet Node */}
                  <circle cx="25.4" cy="80" r="5" fill="#c084fc" />
                  <circle cx="25.4" cy="80" r="9" fill="none" stroke="#c084fc" strokeWidth="1" opacity="0.5" />
                </g>

                {/* Animated Synaptic Triangle Mesh */}
                <polygon
                  points="60,26 89,77 31,77"
                  fill="none"
                  stroke="url(#mcTriStroke)"
                  strokeWidth="1.5"
                  className="mc-synapse-line"
                  opacity="0.8"
                />

                {/* Central Pulsing Quantum Core */}
                <circle cx="60" cy="60" r="22" fill="url(#mcCoreGlow)" className="animate-pulse" />
                <circle
                  cx="60"
                  cy="60"
                  r="8"
                  fill="#ffffff"
                  style={{ filter: 'drop-shadow(0 0 10px #38bdf8)' }}
                />
              </svg>
            </div>

            {/* Header Badge */}
            <div
              className={`relative z-10 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] sm:text-xs font-mono font-bold mb-2.5 border shadow-sm ${
                isClassic
                  ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200 shadow-cyan-500/20'
                  : isFullDark
                  ? 'bg-white/[0.06] border-white/15 text-zinc-200'
                  : 'bg-indigo-500/15 border-indigo-400/40 text-indigo-200 shadow-indigo-500/20'
              }`}
            >
              <Sparkles size={12} className="animate-spin" style={{ animationDuration: '6s' }} />
              SYNCHRONIZED TRI-CORE MESH
            </div>

            <h2 className="relative z-10 text-xl sm:text-3xl font-black tracking-tight mb-1.5 sm:mb-2 bg-gradient-to-r from-white via-cyan-200 to-purple-200 bg-clip-text text-transparent">
              One Query. Three Connected Minds.
            </h2>
            <p className="relative z-10 text-slate-400 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed mb-5 sm:mb-6">
              NOVA, ORBIT, and COSMOS collaborate in sequence or debate—building upon each other's insights in real time. Tap any mind below to target it directly.
            </p>

            {/* Interactive Glowing Persona Cards Showcase */}
            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3.5 w-full max-w-2xl">
              {Object.values(config.personas).map((p, idx) => {
                const isTargeted = directTargetIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      handleToggleDirectPersona(p.id);
                      inputRef.current?.focus();
                    }}
                    className="relative overflow-hidden p-3.5 sm:p-4 rounded-2xl text-left transition-all duration-300 border group hover:-translate-y-1 cursor-pointer"
                    style={{
                      background: isFullDark
                        ? `linear-gradient(155deg, ${p.accentColor}12 0%, #0d0d10 75%)`
                        : `linear-gradient(155deg, ${p.accentColor}16 0%, rgba(15, 23, 42, 0.85) 80%)`,
                      borderColor: isTargeted ? p.accentColor : `${p.accentColor}40`,
                      boxShadow: isTargeted
                        ? `0 0 24px ${p.accentColor}35`
                        : `0 8px 24px rgba(0,0,0,0.4)`,
                    }}
                  >
                    {/* Glowing Top Accent Bar */}
                    <div
                      className="absolute top-0 left-0 right-0 h-[2px] opacity-75 group-hover:opacity-100 transition-opacity"
                      style={{
                        background: `linear-gradient(90deg, transparent, ${p.accentColor}, transparent)`,
                      }}
                    />

                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-9 h-9 rounded-xl grid place-items-center text-lg shadow-md mc-float-slow"
                          style={{
                            background: `${p.accentColor}22`,
                            border: `1px solid ${p.accentColor}55`,
                            boxShadow: `0 0 14px ${p.accentColor}25`,
                            animationDelay: `${idx * 0.6}s`,
                          }}
                        >
                          {p.icon}
                        </div>
                        <div>
                          <h3 className="font-extrabold text-white text-sm leading-tight flex items-center gap-1">
                            <span>{p.name}</span>
                            {isTargeted && (
                              <span
                                className="w-1.5 h-1.5 rounded-full animate-ping"
                                style={{ backgroundColor: p.accentColor }}
                              />
                            )}
                          </h3>
                          <span className="text-[10px] font-mono text-slate-400">@{p.id}</span>
                        </div>
                      </div>
                      <span
                        className="text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: `${p.accentColor}20`,
                          color: p.accentColor,
                          border: `1px solid ${p.accentColor}35`,
                        }}
                      >
                        {p.toneBadge}
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-300/90 leading-relaxed line-clamp-2 m-0">
                      {p.id === 'nova'
                        ? 'Rigorous, factual, and analytical breakdowns with zero fluff.'
                        : p.id === 'orbit'
                        ? 'Engaging, witty, and casual explanations with vivid analogies.'
                        : 'Philosophical, calm, and balanced mentorship with holistic depth.'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          messages
            .filter((m) => (!showPinnedOnly ? true : Boolean(m.pinned)))
            .map((msg) => {
              const activeTab = selectedPersonaTab[msg.id] || 'all';

              return (
                <div key={msg.id} className="flex flex-col gap-2.5 sm:gap-3.5">
                  {/* User Inquiry Chat Bubble (Theme-styled like AssistantPage) */}
                  <div className="flex items-start justify-end gap-2 sm:gap-3 pl-4 sm:pl-10">
                    <div className="flex flex-col items-end max-w-full sm:max-w-2xl min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[10px] font-mono text-slate-500">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span
                          className={`text-[10px] font-bold font-mono ${
                            isClassic ? 'text-cyan-300' : isFullDark ? 'text-zinc-300' : 'text-indigo-300'
                          }`}
                        >
                          YOU
                        </span>
                      </div>

                      <div
                        className={`relative group px-3.5 py-2.5 sm:p-4 text-white transition-all max-w-full ${
                          isFullDark
                            ? 'rounded-2xl rounded-tr-sm bg-[#27272a] border border-white/[0.08] shadow-sm'
                            : isClassic
                            ? 'rounded-2xl rounded-tr-sm bg-gradient-to-br from-cyan-950/70 via-slate-900/95 to-slate-950 border border-cyan-500/35 shadow-md shadow-cyan-950/20'
                            : 'rounded-2xl rounded-tr-sm bg-indigo-600/90 border border-indigo-400/30 shadow-md shadow-indigo-950/20'
                        }`}
                      >
                        <p className="text-[13.5px] sm:text-[15px] leading-relaxed font-normal whitespace-pre-wrap break-words">
                          {msg.query}
                        </p>

                        {/* Quick copy user prompt */}
                        <button
                          type="button"
                          onClick={() => handleCopyQuery(msg.query, `q_${msg.id}`)}
                          className="absolute -left-7 top-1/2 -translate-y-1/2 p-1 rounded-lg bg-black/60 border border-white/10 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all text-xs hidden sm:flex"
                          title="Copy prompt"
                        >
                          {copiedQueryId === `q_${msg.id}` ? (
                            <Check size={11} className="text-emerald-400" />
                          ) : (
                            <Copy size={11} />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* User Avatar (Hidden on small mobile screens to save horizontal space) */}
                    <div
                      className={`hidden sm:grid w-8 h-8 rounded-xl place-items-center shrink-0 mt-5 border ${
                        isClassic
                          ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300'
                          : isFullDark
                          ? 'bg-[#18181b] border-white/15 text-zinc-300'
                          : 'bg-indigo-500/15 border-indigo-400/40 text-indigo-300'
                      }`}
                    >
                      <User size={15} />
                    </div>
                  </div>

                  {/* Assistant Multi-Persona Responses Container (Full-width on mobile) */}
                  <div className="flex items-start gap-2.5 w-full">
                    {/* Assistant Cluster Avatar (Desktop only) */}
                    <div
                      className={`hidden sm:grid w-8 h-8 rounded-xl place-items-center shadow-md shrink-0 mt-1 text-sm border ${
                        isFullDark
                          ? 'bg-[#121215] border-white/10'
                          : isClassic
                          ? 'bg-slate-900 border-cyan-500/25'
                          : 'bg-zinc-900 border-white/10'
                      }`}
                    >
                      🤖
                    </div>

                    <div className="flex-1 flex flex-col gap-2.5 min-w-0 w-full">
                      {/* Persona Selector Tabs (Active when viewMode === 'tabs') */}
                      {viewMode === 'tabs' && (
                        <div
                          className={`flex items-center gap-1 p-1 rounded-xl border w-full sm:w-fit overflow-x-auto no-scrollbar ${
                            isFullDark
                              ? 'bg-[#09090b] border-white/10'
                              : isClassic
                              ? 'bg-slate-950/85 border-cyan-500/20'
                              : 'bg-zinc-900/90 border-white/10'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedPersonaTab((prev) => ({ ...prev, [msg.id]: 'all' }))
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                              activeTab === 'all'
                                ? isClassic
                                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                  : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            All ({msg.responses.length})
                          </button>
                          {msg.responses.map((resp) => (
                            <button
                              key={resp.personaId}
                              type="button"
                              onClick={() =>
                                setSelectedPersonaTab((prev) => ({ ...prev, [msg.id]: resp.personaId }))
                              }
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                                activeTab === resp.personaId
                                  ? 'bg-white/15 text-white border border-white/20'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                              style={{
                                color: activeTab === resp.personaId ? resp.accentColor : undefined,
                              }}
                            >
                              <span>{resp.icon}</span>
                              <span>{resp.name}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* View Layout 1: UNIFIED & TABS STREAM */}
                      {viewMode !== 'grid' && (
                        <div
                          className={`relative rounded-2xl sm:rounded-3xl sm:rounded-tl-md overflow-hidden flex flex-col divide-y transition-all mc-card-enter ${
                            isFullDark
                              ? 'bg-[#09090b] border border-white/[0.1] divide-white/[0.06] shadow-xl shadow-black'
                              : isClassic
                              ? 'bg-gradient-to-b from-slate-900/90 via-slate-950/95 to-slate-950 border border-cyan-500/25 divide-white/10 shadow-[0_16px_45px_rgba(0,0,0,0.6),0_0_24px_rgba(6,182,212,0.08)]'
                              : 'bg-zinc-900/85 border border-indigo-500/20 divide-white/[0.07] shadow-xl shadow-black/40'
                          }`}
                        >
                          <div className="mc-laser-line" />
                          {/* Master Universal Toolbar for Combined Card */}
                          <div
                            className={`flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 border-b gap-2 flex-wrap ${
                              isFullDark
                                ? 'bg-[#0d0d10] border-white/[0.07]'
                                : isClassic
                                ? 'bg-gradient-to-r from-slate-950 via-slate-900/90 to-slate-950 border-white/10'
                                : 'bg-zinc-900/95 border-white/[0.08]'
                            }`}
                          >
                            {/* Left: Combined Label */}
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-mono text-[10px] sm:text-xs font-bold border ${
                                  isClassic
                                    ? 'bg-cyan-950/60 border-cyan-500/30 text-cyan-300'
                                    : isFullDark
                                    ? 'bg-white/[0.05] border-white/10 text-zinc-200'
                                    : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                                    isClassic ? 'bg-cyan-400' : 'bg-indigo-400'
                                  }`}
                                />
                                <span>TRIO SYNTHESIS</span>
                              </div>
                              <span className="text-[10px] font-mono text-slate-400 hidden md:inline">
                                NOVA • ORBIT • COSMOS
                              </span>
                            </div>

                            {/* Right: Universal Action Buttons (Compact on mobile) */}
                            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap ml-auto">
                              {/* Universal Listen to All Button */}
                              <button
                                type="button"
                                onClick={() => handleListenToAll(msg)}
                                disabled={
                                  isGenerating ||
                                  msg.responses.filter(
                                    (r) => r.status === 'completed' && (r.text || (r as { reasoning?: string }).reasoning)
                                  ).length === 0
                                }
                                className={`px-2 sm:px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all border ${
                                  playingAudioKey === `all_${msg.id}`
                                    ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/60'
                                    : edgeTtsLoadingId === `all_${msg.id}`
                                    ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500/30 cursor-wait'
                                    : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 border-white/10'
                                }`}
                                title={
                                  playingAudioKey === `all_${msg.id}`
                                    ? 'Stop playback'
                                    : 'Play all 3 persona responses back-to-back using Edge TTS'
                                }
                              >
                                {edgeTtsLoadingId === `all_${msg.id}` ? (
                                  <>
                                    <Loader2 size={12} className="animate-spin text-cyan-400" />
                                    <span className="text-[10px] font-mono hidden sm:inline">Audio...</span>
                                  </>
                                ) : playingAudioKey === `all_${msg.id}` ? (
                                  <>
                                    <VolumeX size={12} className="text-cyan-400 animate-pulse" />
                                    <span className="text-[10px] font-mono">Stop</span>
                                  </>
                                ) : (
                                  <>
                                    <Volume2 size={12} className="text-cyan-400" />
                                    <span className="hidden sm:inline">Listen All</span>
                                  </>
                                )}
                              </button>

                              {/* Universal Download All as MP3 */}
                              <button
                                type="button"
                                onClick={() => handleDownloadAllAudio(msg)}
                                disabled={
                                  downloadingAudioId === `all_dl_${msg.id}` ||
                                  msg.responses.filter(
                                    (r) => r.status === 'completed' && (r.text || (r as { reasoning?: string }).reasoning)
                                  ).length === 0
                                }
                                className={`px-2 sm:px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all border ${
                                  downloadSuccessId === `all_dl_${msg.id}`
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : downloadingAudioId === `all_dl_${msg.id}`
                                    ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500/30 cursor-wait'
                                    : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 border-white/10'
                                }`}
                                title="Download all 3 persona responses stitched into one complete MP3 file"
                              >
                                {downloadingAudioId === `all_dl_${msg.id}` ? (
                                  <Loader2 size={12} className="animate-spin text-cyan-400" />
                                ) : downloadSuccessId === `all_dl_${msg.id}` ? (
                                  <Check size={12} className="text-emerald-400" />
                                ) : (
                                  <Download size={12} className="text-emerald-400" />
                                )}
                                <span className="hidden md:inline">MP3</span>
                              </button>

                              {/* Universal Copy Button */}
                              <button
                                type="button"
                                onClick={() => handleCopyCombined(msg)}
                                disabled={
                                  msg.responses.filter(
                                    (r) => r.status === 'completed' && (r.text || (r as { reasoning?: string }).reasoning)
                                  ).length === 0
                                }
                                className="px-2 sm:px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 border border-white/10 transition-all"
                                title="Copy all 3 persona responses"
                              >
                                {copiedCombinedId === msg.id ? (
                                  <>
                                    <Check size={12} className="text-emerald-400" />
                                    <span className="text-[10px] font-mono text-emerald-300 hidden sm:inline">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={12} className="text-slate-300" />
                                    <span className="hidden sm:inline">Copy</span>
                                  </>
                                )}
                              </button>

                              {/* Pin / Star Turn Button */}
                              <button
                                type="button"
                                onClick={() => handleTogglePinMessage(msg.id)}
                                className={`px-2 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all border ${
                                  msg.pinned
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                                    : 'bg-white/[0.04] hover:bg-amber-950/30 text-slate-300 hover:text-amber-300 border-white/10'
                                }`}
                                title={msg.pinned ? 'Unpin this turn' : 'Pin/Star this turn'}
                              >
                                <Star
                                  size={12}
                                  className={msg.pinned ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}
                                />
                                <span className="hidden sm:inline">{msg.pinned ? 'Pinned' : 'Pin'}</span>
                              </button>

                              {/* Delete Message Box Button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="px-2 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 bg-white/[0.04] hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 border border-white/10 hover:border-rose-500/40 transition-all"
                                title="Delete this message and its persona responses"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>

                          {/* Document Lens Excerpts Section (if active for this turn) */}
                          {msg.docChunks && msg.docChunks.length > 0 && (
                            <div className="px-3 sm:px-4 py-2 bg-amber-950/20 border-b border-amber-500/20 flex flex-col gap-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 text-[11px] text-amber-300 font-medium truncate">
                                  <BookOpen size={12} className="text-amber-400 shrink-0" />
                                  <span className="truncate">Doc Lens: {msg.docChunks.length} excerpts</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedDocMsgId(expandedDocMsgId === msg.id ? null : msg.id)
                                  }
                                  className="text-[10px] font-mono text-amber-400 hover:text-amber-200 underline shrink-0"
                                >
                                  {expandedDocMsgId === msg.id ? 'Hide' : 'View'}
                                </button>
                              </div>
                              {expandedDocMsgId === msg.id && (
                                <div className="flex flex-col gap-1.5 mt-1 max-h-48 overflow-y-auto pr-1">
                                  {msg.docChunks.map((chunk, cIdx) => (
                                    <div
                                      key={cIdx}
                                      className="p-2 rounded-lg bg-black/40 border border-amber-500/20 text-xs"
                                    >
                                      <div className="flex items-center justify-between text-[11px] font-mono text-amber-400/90 mb-1">
                                        <span className="font-bold truncate">{chunk.documentName}</span>
                                        <span className="text-[10px] text-slate-400">
                                          {Math.round(chunk.similarityScore * 100)}% match
                                        </span>
                                      </div>
                                      <p className="text-slate-300 text-[11px] line-clamp-3 leading-relaxed font-mono">
                                        {chunk.chunkText}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Web Lens Sources Section (if active for this turn) */}
                          {msg.webSources && msg.webSources.length > 0 && (
                            <div className="px-3 sm:px-4 py-2 bg-cyan-950/25 border-b border-cyan-500/20 flex flex-col gap-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 text-[11px] text-cyan-300 font-medium truncate">
                                  <Globe size={12} className="text-cyan-400 shrink-0" />
                                  <span className="truncate">Web Lens: {msg.webSources.length} live sources</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedWebMsgId(expandedWebMsgId === msg.id ? null : msg.id)
                                  }
                                  className="text-[10px] font-mono text-cyan-400 hover:text-cyan-200 underline shrink-0"
                                >
                                  {expandedWebMsgId === msg.id ? 'Hide' : 'View'}
                                </button>
                              </div>
                              {expandedWebMsgId === msg.id && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1">
                                  {msg.webSources.map((src, sIdx) => (
                                    <a
                                      key={sIdx}
                                      href={src.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-2 rounded-lg bg-black/40 hover:bg-black/60 border border-cyan-500/20 text-xs transition-colors block no-underline"
                                    >
                                      <div className="flex items-center justify-between text-[11px] font-mono text-cyan-300 mb-0.5">
                                        <span className="font-bold truncate">{src.title}</span>
                                        <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                                          {src.domain}
                                        </span>
                                      </div>
                                      <p className="text-slate-400 text-[11px] line-clamp-2 m-0">
                                        {src.snippet}
                                      </p>
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {msg.responses
                            .filter((resp) => activeTab === 'all' || activeTab === resp.personaId)
                            .map((resp) => {
                              const personaKey = `${msg.id}_${resp.personaId}`;
                              const isPlayingThis = playingAudioKey === personaKey;
                              const isCopied = copiedId === personaKey;
                              const displayText = getPersonaCleanText(resp);
                              const isBranchOpen = activeBranchCardKey === personaKey;
                              const branches = resp.branches || [];

                              return (
                                <div
                                  key={resp.personaId}
                                  className="flex flex-col transition-colors hover:bg-white/[0.01]"
                                >
                                  {/* Persona Chat Header Bar */}
                                  <div
                                    className="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-2.5 border-b border-white/5 gap-1.5"
                                    style={{ background: `${resp.accentColor}08` }}
                                  >
                                    {/* Left: Avatar + Identity */}
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <div
                                        className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl grid place-items-center text-sm sm:text-lg shrink-0 shadow-sm"
                                        style={{
                                          background: `${resp.accentColor}20`,
                                          border: `1px solid ${resp.accentColor}45`,
                                        }}
                                      >
                                        {resp.icon}
                                      </div>

                                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                        <span
                                          className="font-bold text-xs sm:text-sm tracking-tight shrink-0"
                                          style={{ color: resp.accentColor }}
                                        >
                                          {resp.name}
                                        </span>

                                        {resp.toneBadge && (
                                          <span
                                            className="text-[9px] sm:text-[10px] font-mono px-1.5 py-0.2 sm:py-0.5 rounded-full font-semibold whitespace-nowrap shrink-0"
                                            style={{
                                              background: `${resp.accentColor}18`,
                                              color: resp.accentColor,
                                              border: `1px solid ${resp.accentColor}35`,
                                            }}
                                          >
                                            {resp.toneBadge}
                                          </span>
                                        )}

                                        {resp.durationMs && resp.status === 'completed' && (
                                          <span className="text-[9px] sm:text-[10px] font-mono text-slate-500 flex items-center gap-0.5 whitespace-nowrap shrink-0">
                                            <Clock size={9} />
                                            {(resp.durationMs / 1000).toFixed(1)}s
                                          </span>
                                        )}

                                        {resp.modelName && (
                                          <span className="text-[10px] font-mono text-slate-500 items-center gap-1 hidden md:flex">
                                            <Cpu size={10} />
                                            {resp.modelName.split('/').pop()}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Right: Audio TTS, Branch Reply & Copy Controls */}
                                    <div className="flex items-center gap-1 shrink-0">
                                      {resp.status === 'completed' && displayText && (
                                        <>
                                          {/* 1-on-1 Reply Button */}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setActiveBranchCardKey(isBranchOpen ? null : personaKey)
                                            }
                                            className={`p-1.5 sm:px-2 sm:py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all border ${
                                              isBranchOpen
                                                ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50'
                                                : 'bg-black/30 text-slate-300 hover:text-white border-white/10 hover:border-white/20'
                                            }`}
                                            title={`Reply directly to ${resp.name} (1-on-1 thread)`}
                                          >
                                            <MessageSquareQuote size={12} style={{ color: resp.accentColor }} />
                                            <span className="text-[10.5px] font-mono hidden sm:inline">Reply</span>
                                          </button>

                                          {/* Individual Listen Button */}
                                          <button
                                            type="button"
                                            onClick={() => handleToggleAudio(displayText, personaKey, resp.personaId)}
                                            className={`p-1.5 sm:px-2 sm:py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all border ${
                                              isPlayingThis
                                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                                : edgeTtsLoadingId === personaKey
                                                ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500/30 cursor-wait'
                                                : 'bg-black/30 text-slate-400 hover:text-white border-white/10 hover:border-white/20'
                                            }`}
                                            title={isPlayingThis ? 'Stop voice readout' : 'Listen with Edge TTS voice'}
                                          >
                                            {edgeTtsLoadingId === personaKey ? (
                                              <Loader2 size={12} className="animate-spin text-cyan-400" />
                                            ) : isPlayingThis ? (
                                              <VolumeX size={12} className="text-cyan-400 animate-pulse" />
                                            ) : (
                                              <Volume2 size={12} />
                                            )}
                                            <span className="text-[10.5px] font-mono hidden sm:inline">
                                              {isPlayingThis ? 'Stop' : 'Listen'}
                                            </span>
                                          </button>

                                          {/* Individual MP3 Download Button */}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleDownloadPersonaAudio(
                                                displayText,
                                                personaKey,
                                                resp.name,
                                                resp.personaId,
                                                msg.query
                                              )
                                            }
                                            disabled={downloadingAudioId === personaKey}
                                            className={`p-1.5 sm:px-2 sm:py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all border ${
                                              downloadSuccessId === personaKey
                                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                                : downloadingAudioId === personaKey
                                                ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500/30 cursor-wait'
                                                : 'bg-black/30 text-slate-400 hover:text-emerald-300 border-white/10 hover:border-emerald-500/30'
                                            }`}
                                            title="Download persona response as MP3"
                                          >
                                            {downloadingAudioId === personaKey ? (
                                              <Loader2 size={12} className="animate-spin text-cyan-400" />
                                            ) : downloadSuccessId === personaKey ? (
                                              <Check size={12} className="text-emerald-400" />
                                            ) : (
                                              <Download size={12} />
                                            )}
                                            <span className="text-[10.5px] font-mono hidden md:inline">MP3</span>
                                          </button>

                                          {/* Individual Copy Button */}
                                          <button
                                            type="button"
                                            onClick={() => handleCopyText(displayText, personaKey)}
                                            className="p-1.5 sm:px-2 sm:py-1 rounded-lg text-xs font-medium flex items-center gap-1 bg-black/30 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-all"
                                            title="Copy response"
                                          >
                                            {isCopied ? (
                                              <Check size={12} className="text-emerald-400" />
                                            ) : (
                                              <Copy size={12} />
                                            )}
                                            <span className="text-[10.5px] font-mono hidden sm:inline">
                                              {isCopied ? 'Copied' : 'Copy'}
                                            </span>
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Persona Answer Body */}
                                  <div className="p-3 sm:p-5 flex flex-col gap-3">
                                    {resp.status === 'running' && (
                                      <div className="flex items-center gap-3 py-2.5" style={{ color: resp.accentColor }}>
                                        <div
                                          className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl bg-white/[0.04] border shadow-sm"
                                          style={{
                                            borderColor: `${resp.accentColor}40`,
                                            boxShadow: `0 0 18px ${resp.accentColor}20`,
                                          }}
                                        >
                                          {/* Spinning Orbital Ring Graphic */}
                                          <svg viewBox="0 0 24 24" className="w-4 h-4 mc-orbit-fast shrink-0">
                                            <circle
                                              cx="12"
                                              cy="12"
                                              r="9"
                                              fill="none"
                                              stroke={resp.accentColor}
                                              strokeWidth="2"
                                              strokeDasharray="14 10"
                                            />
                                            <circle cx="12" cy="3" r="2" fill={resp.accentColor} />
                                          </svg>

                                          {/* Animated 5-Bar Neural Waveform */}
                                          <div className="flex items-center gap-0.5 h-3.5">
                                            {[0, 120, 240, 360, 480].map((delay, i) => (
                                              <span
                                                key={i}
                                                className="w-1 h-3.5 rounded-full mc-wave-bar"
                                                style={{
                                                  backgroundColor: resp.accentColor,
                                                  animationDelay: `${delay}ms`,
                                                }}
                                              />
                                            ))}
                                          </div>

                                          <span className="text-xs font-mono font-semibold tracking-wide">
                                            {resp.name} synthesizing neural response...
                                          </span>
                                        </div>
                                      </div>
                                    )}

                                    {resp.status === 'pending' && (
                                      <div className="flex items-center gap-2 py-2 text-slate-400">
                                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10">
                                          <Clock size={11} className="text-slate-400 animate-pulse" />
                                          <span className="text-[11px] font-mono text-slate-400">
                                            Waiting in sequence...
                                          </span>
                                        </div>
                                      </div>
                                    )}

                                    {resp.status === 'failed' && (
                                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-mono">
                                        <AlertCircle size={14} className="shrink-0" />
                                        <span>{resp.error || 'Failed to generate response'}</span>
                                      </div>
                                    )}

                                    {resp.status === 'completed' && displayText && (
                                      <div className="prose prose-invert max-w-none text-slate-100 text-[13.5px] sm:text-[14.5px] leading-relaxed break-words">
                                        <FormattedText content={displayText} />
                                      </div>
                                    )}

                                    {/* FEATURE 1: 1-ON-1 PERSONA NESTED BRANCH THREAD */}
                                    {branches.length > 0 && (
                                      <div
                                        className="mt-1 flex flex-col gap-2.5 pl-2.5 sm:pl-4 border-l-2 border-dashed"
                                        style={{ borderColor: `${resp.accentColor}40` }}
                                      >
                                        <div
                                          className="text-[10.5px] font-mono font-bold flex items-center gap-1"
                                          style={{ color: resp.accentColor }}
                                        >
                                          <CornerDownRight size={11} />
                                          <span>1-on-1 Branch with {resp.name} ({branches.length})</span>
                                        </div>

                                        {branches.map((b) => {
                                          const branchText =
                                            b.response?.text ||
                                            b.text ||
                                            (b.response?.status === 'failed'
                                              ? b.response?.error || 'Failed to generate response'
                                              : '');
                                          const isBranchFailed = b.response?.status === 'failed';
                                          return (
                                            <div
                                              key={b.id}
                                              className="flex flex-col gap-1.5 rounded-xl bg-black/40 border border-white/10 p-3 shadow-md"
                                            >
                                              <div className="flex items-center justify-between text-xs text-slate-300">
                                                <span className="font-semibold text-cyan-300 font-mono text-[10.5px]">
                                                  YOU ➔ {resp.name}:
                                                </span>
                                                <div className="flex items-center gap-1">
                                                  <span className="text-[9.5px] font-mono text-slate-400">
                                                    {new Date(b.timestamp).toLocaleTimeString([], {
                                                      hour: '2-digit',
                                                      minute: '2-digit',
                                                    })}
                                                  </span>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleDeleteBranch(msg.id, resp.personaId, b.id)}
                                                    className="p-1 rounded text-slate-400 hover:text-rose-400 transition-colors"
                                                    title="Delete this branch turn"
                                                  >
                                                    <Trash2 size={10} />
                                                  </button>
                                                </div>
                                              </div>
                                              <p className="text-xs text-slate-200 font-medium pl-2 border-l border-cyan-500/30">
                                                {b.query}
                                              </p>

                                              <div className="mt-1 pt-1.5 border-t border-white/5 flex flex-col gap-1">
                                                <div className="flex items-center justify-between">
                                                  <span
                                                    className="text-[10.5px] font-bold font-mono"
                                                    style={{ color: resp.accentColor }}
                                                  >
                                                    {resp.icon} {resp.name}:
                                                  </span>
                                                  {!isBranchFailed && branchText && (
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        handleToggleAudio(branchText, `b_${b.id}`, resp.personaId)
                                                      }
                                                      className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-mono flex items-center gap-1"
                                                      title="Listen to branch response"
                                                    >
                                                      <Volume2 size={10} />
                                                      <span>Listen</span>
                                                    </button>
                                                  )}
                                                </div>
                                                {isBranchFailed ? (
                                                  <div className="flex items-center gap-1.5 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono">
                                                    <AlertCircle size={12} className="shrink-0" />
                                                    <span>{b.response?.error || 'Branch request failed'}</span>
                                                  </div>
                                                ) : (
                                                  <div className="prose prose-invert prose-xs text-slate-200 text-xs leading-relaxed">
                                                    <FormattedText content={branchText} />
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {/* Inline 1-on-1 Reply Box */}
                                    {isBranchOpen && (
                                      <div className="mt-1.5 p-2.5 sm:p-3 rounded-xl bg-black/60 border border-cyan-500/30 flex flex-col gap-2 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
                                        <div className="flex items-center justify-between text-xs">
                                          <span
                                            className="font-mono font-bold flex items-center gap-1"
                                            style={{ color: resp.accentColor }}
                                          >
                                            <MessageSquareQuote size={11} />
                                            Direct Reply to {resp.name}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => setActiveBranchCardKey(null)}
                                            className="text-slate-400 hover:text-white text-xs"
                                          >
                                            <X size={12} />
                                          </button>
                                        </div>

                                        <textarea
                                          rows={2}
                                          value={branchDraftInputs[personaKey] || ''}
                                          onChange={(e) =>
                                            setBranchDraftInputs((prev) => ({
                                              ...prev,
                                              [personaKey]: e.target.value,
                                            }))
                                          }
                                          placeholder={`Ask ${resp.name} a direct follow-up question...`}
                                          className="w-full rounded-xl bg-slate-950/80 border border-white/10 p-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 resize-none font-normal"
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                              e.preventDefault();
                                              handleSendBranch(msg, resp.personaId);
                                            }
                                          }}
                                        />

                                        <div className="flex items-center justify-end gap-2">
                                          <button
                                            type="button"
                                            onClick={() => setActiveBranchCardKey(null)}
                                            className="px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-white"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleSendBranch(msg, resp.personaId)}
                                            disabled={
                                              !(branchDraftInputs[personaKey] || '').trim() ||
                                              branchLoadingKey === personaKey
                                            }
                                            className="px-3 py-1 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white flex items-center gap-1.5 shadow-sm"
                                          >
                                            {branchLoadingKey === personaKey ? (
                                              <>
                                                <Loader2 size={11} className="animate-spin" />
                                                <span>Sending...</span>
                                              </>
                                            ) : (
                                              <>
                                                <Send size={10} />
                                                <span>Send 1-on-1</span>
                                              </>
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                          {/* Consensus Action Card (Verdict, Agreements, Checklist, Save & .MD) */}
                          <MultiChatConsensusCard
                            message={msg}
                            isGeneratingConsensus={consensusLoadingMsgId === msg.id}
                            onGenerateConsensus={handleGenerateConsensus}
                            onToggleChecklistItem={handleToggleChecklistItem}
                            theme={activeTheme}
                          />
                        </div>
                      )}

                      {/* View Layout 2: SPLIT GRID COMPARISON */}
                      {viewMode === 'grid' && (
                        <div className="flex flex-col gap-2.5 w-full">
                          {/* Master Universal Toolbar for Grid View */}
                          <div
                            className={`flex items-center justify-between px-3 sm:px-4 py-2 rounded-2xl border flex-wrap gap-2 shadow-lg ${
                              isFullDark
                                ? 'bg-[#09090b] border-white/[0.08]'
                                : isClassic
                                ? 'bg-gradient-to-r from-slate-950 via-slate-900/90 to-slate-950 border-cyan-500/20'
                                : 'bg-zinc-900/90 border-white/10'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-mono text-[10px] sm:text-xs font-bold border ${
                                  isClassic
                                    ? 'bg-cyan-950/60 border-cyan-500/30 text-cyan-300'
                                    : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                <span>SPLIT COMPARISON</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap ml-auto">
                              <button
                                type="button"
                                onClick={() => handleListenToAll(msg)}
                                disabled={
                                  isGenerating ||
                                  msg.responses.filter(
                                    (r) => r.status === 'completed' && getPersonaCleanText(r).length > 0
                                  ).length === 0
                                }
                                className="px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all border bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 border-white/10"
                              >
                                <Volume2 size={12} className="text-cyan-400" />
                                <span className="hidden sm:inline">Listen All</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCopyCombined(msg)}
                                className="px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 border border-white/10 transition-all"
                              >
                                {copiedCombinedId === msg.id ? (
                                  <Check size={12} className="text-emerald-400" />
                                ) : (
                                  <Copy size={12} className="text-slate-300" />
                                )}
                                <span className="hidden sm:inline">Copy</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="px-2 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 bg-white/[0.04] hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 border border-white/10 transition-all"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3 w-full">
                            {msg.responses.map((resp) => {
                              const personaKey = `${msg.id}_${resp.personaId}`;
                              const isPlayingThis = playingAudioKey === personaKey;
                              const isCopied = copiedId === personaKey;
                              const displayText = getPersonaCleanText(resp);

                              return (
                                <div
                                  key={resp.personaId}
                                  className={`flex flex-col rounded-2xl border overflow-hidden shadow-lg ${
                                    isFullDark
                                      ? 'bg-[#09090b]'
                                      : 'bg-gradient-to-b from-slate-900/90 to-slate-950'
                                  }`}
                                  style={{ borderColor: `${resp.accentColor}35` }}
                                >
                                  <div
                                    className="p-2.5 sm:p-3 border-b border-white/5 flex items-center justify-between"
                                    style={{ background: `${resp.accentColor}10` }}
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <span className="text-base shrink-0">{resp.icon}</span>
                                      <div className="min-w-0 flex-1">
                                        <h4
                                          className="text-xs font-bold leading-tight truncate"
                                          style={{ color: resp.accentColor }}
                                        >
                                          {resp.name}
                                        </h4>
                                        <span className="text-[10px] font-mono text-slate-400 block truncate">
                                          {resp.toneBadge}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                      {resp.status === 'completed' && displayText && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setActiveBranchCardKey(
                                                activeBranchCardKey === personaKey ? null : personaKey
                                              )
                                            }
                                            className={`p-1.5 rounded transition-colors ${
                                              activeBranchCardKey === personaKey
                                                ? 'bg-cyan-500/30 text-cyan-200'
                                                : 'bg-black/40 text-slate-400 hover:text-white'
                                            }`}
                                            title={`Reply directly to ${resp.name}`}
                                          >
                                            <MessageSquareQuote size={12} style={{ color: resp.accentColor }} />
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleToggleAudio(displayText, personaKey, resp.personaId)
                                            }
                                            className={`p-1.5 rounded transition-colors ${
                                              isPlayingThis
                                                ? 'bg-cyan-500/20 text-cyan-300'
                                                : 'bg-black/40 text-slate-400 hover:text-white'
                                            }`}
                                          >
                                            {isPlayingThis ? (
                                              <VolumeX size={12} className="animate-pulse text-cyan-400" />
                                            ) : (
                                              <Volume2 size={12} />
                                            )}
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handleCopyText(displayText, personaKey)}
                                            className="p-1.5 rounded bg-black/40 text-slate-400 hover:text-white"
                                          >
                                            {isCopied ? (
                                              <Check size={12} className="text-emerald-400" />
                                            ) : (
                                              <Copy size={12} />
                                            )}
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  <div className="p-3 sm:p-3.5 flex-1 flex flex-col gap-2 text-xs">
                                    {resp.status === 'running' && (
                                      <div
                                        className="py-6 flex flex-col items-center justify-center gap-2"
                                        style={{ color: resp.accentColor }}
                                      >
                                        <Loader2 size={18} className="animate-spin" />
                                        <span className="font-mono text-[11px]">{resp.name} is computing...</span>
                                      </div>
                                    )}

                                    {resp.status === 'pending' && (
                                      <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-500">
                                        <Clock size={16} className="text-slate-500 animate-pulse" />
                                        <span className="font-mono text-[11px]">Waiting in sequence...</span>
                                      </div>
                                    )}

                                    {resp.status === 'failed' && (
                                      <div className="p-2 rounded bg-rose-500/10 text-rose-300 text-[11px] font-mono">
                                        {resp.error || 'Failed'}
                                      </div>
                                    )}

                                    {resp.status === 'completed' && displayText && (
                                      <div className="prose prose-invert prose-xs max-w-none text-slate-200 text-xs leading-relaxed">
                                        <FormattedText content={displayText} />
                                      </div>
                                    )}

                                    {resp.branches && resp.branches.length > 0 && (
                                      <div
                                        className="mt-2 flex flex-col gap-2 pl-2 border-l-2 border-dashed"
                                        style={{ borderColor: `${resp.accentColor}40` }}
                                      >
                                        {resp.branches.map((b) => {
                                          const branchText =
                                            b.response?.text ||
                                            b.text ||
                                            (b.response?.status === 'failed'
                                              ? b.response?.error || 'Failed'
                                              : '');
                                          const isBranchFailed = b.response?.status === 'failed';
                                          return (
                                            <div
                                              key={b.id}
                                              className="p-2 rounded-xl bg-black/50 border border-white/10 flex flex-col gap-1 text-[11px]"
                                            >
                                              <div className="flex items-center justify-between text-cyan-300 font-mono text-[10px]">
                                                <span>YOU ➔ {resp.name}:</span>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleDeleteBranch(msg.id, resp.personaId, b.id)
                                                  }
                                                  className="text-slate-400 hover:text-rose-400"
                                                >
                                                  <Trash2 size={10} />
                                                </button>
                                              </div>
                                              <p className="text-slate-200 font-medium">{b.query}</p>
                                              <div className="mt-1 pt-1 border-t border-white/5 text-slate-300">
                                                {isBranchFailed ? (
                                                  <div className="text-rose-400 text-[10px] font-mono flex items-center gap-1">
                                                    <AlertCircle size={10} />
                                                    <span>{b.response?.error || 'Failed'}</span>
                                                  </div>
                                                ) : (
                                                  <FormattedText content={branchText} />
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {activeBranchCardKey === personaKey && (
                                      <div className="mt-2 p-2 rounded-xl bg-black/70 border border-cyan-500/30 flex flex-col gap-1.5">
                                        <textarea
                                          rows={2}
                                          value={branchDraftInputs[personaKey] || ''}
                                          onChange={(e) =>
                                            setBranchDraftInputs((prev) => ({
                                              ...prev,
                                              [personaKey]: e.target.value,
                                            }))
                                          }
                                          placeholder={`Follow up with ${resp.name}...`}
                                          className="w-full rounded-lg bg-slate-950 border border-white/10 p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                                        />
                                        <div className="flex items-center justify-end gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => setActiveBranchCardKey(null)}
                                            className="px-2 py-0.5 text-[10px] text-slate-400"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleSendBranch(msg, resp.personaId)}
                                            disabled={
                                              !(branchDraftInputs[personaKey] || '').trim() ||
                                              branchLoadingKey === personaKey
                                            }
                                            className="px-2.5 py-1 text-[10px] font-bold bg-cyan-600 hover:bg-cyan-500 rounded text-white"
                                          >
                                            Send
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="rounded-2xl overflow-hidden border border-white/10">
                            <MultiChatConsensusCard
                              message={msg}
                              isGeneratingConsensus={consensusLoadingMsgId === msg.id}
                              onGenerateConsensus={handleGenerateConsensus}
                              onToggleChecklistItem={handleToggleChecklistItem}
                              theme={activeTheme}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* REDESIGNED AI ASSISTANT-STYLE MULTI CHAT INPUT DOCK */}
      <div className="sticky bottom-2 sm:bottom-3 z-30 flex flex-col gap-1.5 pt-1">
        {/* Quick Prompts Floating Drawer */}
        {showQuickPrompts && (
          <div
            className={`p-3 rounded-2xl border shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 ${
              isFullDark
                ? 'bg-[#09090b] border-white/15 shadow-black'
                : isClassic
                ? 'bg-slate-950/95 backdrop-blur-2xl border-cyan-500/35 shadow-cyan-950/40'
                : 'bg-zinc-900/95 backdrop-blur-2xl border-white/15 shadow-black/60'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
              <span
                className={`text-xs font-mono font-bold flex items-center gap-1.5 ${
                  isClassic ? 'text-cyan-300' : 'text-indigo-300'
                }`}
              >
                <Sparkles size={13} /> CONVERSATION CATALYSTS
              </span>
              <button
                type="button"
                onClick={() => setShowQuickPrompts(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {PROMPT_CATEGORIES.flatMap((c) => c.prompts).map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setInputText(prompt);
                    setShowQuickPrompts(false);
                    inputRef.current?.focus();
                  }}
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 text-slate-200 text-xs text-left transition-all leading-snug font-normal truncate"
                >
                  "{prompt}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cleared Success Notification Banner */}
        {clearedBanner && (
          <div className="px-3.5 py-2 rounded-2xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              <span>Multi Chat history cleared and memory reset.</span>
            </div>
            <button
              type="button"
              onClick={() => setClearedBanner(false)}
              className="text-emerald-400 hover:text-emerald-200 p-1"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Optional Collapsible Domain Category Selector */}
        {showCategoryStrip && (
          <MultiChatCategorySelector
            selectedCategory={selectedCategory}
            onSelectCategory={handleSelectCategory}
            onSelectPrompt={(p) => {
              setInputText(p);
              inputRef.current?.focus();
            }}
            disabled={isGenerating}
            theme={activeTheme}
          />
        )}

        {/* POWERFUL ANIMATED GLOWING BORDER INPUT BOX (Minimal / Classic / Full Dark) */}
        <div
          data-generating={isGenerating ? 'true' : 'false'}
          className={`mc-glow-input-wrap ${
            isFullDark
              ? 'theme-fulldark-glow'
              : isMinimal
              ? 'theme-minimal-glow'
              : ''
          }`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className={`relative overflow-hidden flex flex-col transition-all duration-200 px-3 sm:px-4 pt-2.5 pb-2 ${
              isFullDark
                ? 'bg-[#0b0b0e]/95 rounded-[24.5px]'
                : isClassic
                ? 'bg-slate-950/95 backdrop-blur-2xl rounded-[20.5px]'
                : 'bg-zinc-950/95 backdrop-blur-2xl rounded-[20.5px]'
            }`}
          >
            {/* Animated Top Laser Sweep Beam inside Input */}
            <div className="mc-laser-line" />

            {/* Subtle Cybernetic Corner Reticles */}
            <div className="pointer-events-none absolute top-1.5 left-2 w-2 h-2 border-t border-l border-cyan-400/50 rounded-tl-sm" />
            <div className="pointer-events-none absolute top-1.5 right-2 w-2 h-2 border-t border-r border-purple-400/50 rounded-tr-sm" />
            <div className="pointer-events-none absolute bottom-1.5 left-2 w-2 h-2 border-b border-l border-cyan-400/40 rounded-bl-sm" />
            <div className="pointer-events-none absolute bottom-1.5 right-2 w-2 h-2 border-b border-r border-purple-400/40 rounded-br-sm" />

            {/* Ambient Interior Glow Orbs */}
            <div className="pointer-events-none absolute -top-12 -left-10 w-36 h-36 rounded-full bg-cyan-500/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-12 -right-10 w-36 h-36 rounded-full bg-purple-500/10 blur-2xl" />

            {/* Row 1: Compact Single-Line Scrollable @Persona Target + Quick Modifier Strip */}
            <div className="relative z-10 flex items-center justify-between gap-2 pb-2 mb-1.5 border-b border-white/[0.07] overflow-x-auto no-scrollbar">
              {/* Direct @Persona Target Pills */}
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-0.5 mr-0.5">
                  <AtSign size={10} className={isClassic ? 'text-cyan-400' : 'text-indigo-400'} />
                </span>
                {enabledPersonas.map((p) => {
                  const isDirectlyTargeted = directTargetIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleToggleDirectPersona(p.id)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold transition-all shrink-0 cursor-pointer hover:scale-105"
                      style={{
                        background: isDirectlyTargeted
                          ? `${p.accentColor}30`
                          : 'rgba(255,255,255,0.04)',
                        color: isDirectlyTargeted ? p.accentColor : '#cbd5e1',
                        border: `1px solid ${
                          isDirectlyTargeted ? p.accentColor : 'rgba(255,255,255,0.1)'
                        }`,
                        boxShadow: isDirectlyTargeted ? `0 0 12px ${p.accentColor}40` : 'none',
                        opacity: directTargetIds.length === 0 || isDirectlyTargeted ? 1 : 0.45,
                      }}
                      title={`Target @${p.name} directly`}
                    >
                      <span className="text-[11px]">{p.icon}</span>
                      <span>@{p.name}</span>
                    </button>
                  );
                })}
                {directTargetIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDirectTargetIds([])}
                    className="text-[10px] font-mono text-zinc-400 hover:text-white underline px-1 shrink-0"
                  >
                    All
                  </button>
                )}
              </div>

              {/* Quick Modifiers + Prompts Trigger */}
              <div className="flex items-center gap-1 shrink-0 ml-auto">
                <button
                  type="button"
                  onClick={() => applyQueryModifier('[Deep Analysis]:')}
                  className="px-2 py-0.5 rounded-full bg-white/[0.04] hover:bg-cyan-500/15 border border-white/[0.08] hover:border-cyan-400/40 text-[10px] text-zinc-300 hover:text-cyan-200 transition-all whitespace-nowrap shrink-0"
                  title="Prefix query with Deep Analysis"
                >
                  🔬 Deep
                </button>
                <button
                  type="button"
                  onClick={() => applyQueryModifier('[Fast Summary]:')}
                  className="px-2 py-0.5 rounded-full bg-white/[0.04] hover:bg-amber-500/15 border border-white/[0.08] hover:border-amber-400/40 text-[10px] text-zinc-300 hover:text-amber-200 transition-all whitespace-nowrap shrink-0"
                  title="Prefix query with Fast Summary"
                >
                  ⚡ Fast
                </button>
                <button
                  type="button"
                  onClick={() => applyQueryModifier('[Compare & Contrast]:')}
                  className="px-2 py-0.5 rounded-full bg-white/[0.04] hover:bg-purple-500/15 border border-white/[0.08] hover:border-purple-400/40 text-[10px] text-zinc-300 hover:text-purple-200 transition-all whitespace-nowrap shrink-0 hidden sm:inline-flex"
                  title="Prefix query with Compare & Contrast"
                >
                  ⚖️ Compare
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickPrompts(!showQuickPrompts)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 transition-all border shrink-0 ${
                    showQuickPrompts
                      ? isClassic
                        ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                        : 'bg-indigo-500/25 text-indigo-200 border-indigo-400/50 shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                      : 'bg-white/[0.04] text-zinc-300 hover:text-white border-white/[0.08]'
                  }`}
                >
                  <Sparkles size={10} className={isClassic ? 'text-cyan-400' : 'text-indigo-400'} />
                  <span>Prompts</span>
                </button>
              </div>
            </div>

            {/* Row 2: Animated Tri-Orb Graphic + Auto-Resizing Textarea */}
            <div className="relative z-10 flex items-center gap-2.5 w-full">
              {/* Interactive Animated Tri-Orb Neural Indicator */}
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl shrink-0 grid place-items-center border transition-all ${
                  isGenerating || inputText.trim().length > 0
                    ? 'bg-cyan-500/15 border-cyan-400/50 shadow-[0_0_14px_rgba(6,182,212,0.35)]'
                    : 'bg-white/[0.03] border-white/10'
                }`}
                title="Tri-Mind Neural Input Core"
              >
                <svg
                  viewBox="0 0 28 28"
                  className={`w-5 h-5 ${
                    isGenerating
                      ? 'mc-orbit-fast'
                      : inputText.trim().length > 0
                      ? 'mc-orbit-cw'
                      : ''
                  }`}
                >
                  <circle
                    cx="14"
                    cy="14"
                    r="10"
                    fill="none"
                    stroke="rgba(56,189,248,0.4)"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                  />
                  <circle cx="14" cy="4" r="2.2" fill="#38bdf8" />
                  <circle cx="22.6" cy="19" r="2.2" fill="#f59e0b" />
                  <circle cx="5.4" cy="19" r="2.2" fill="#c084fc" />
                  <circle cx="14" cy="14" r="2.5" fill="#ffffff" className="animate-pulse" />
                </svg>
              </div>

              <div className="relative flex-1 min-w-0 flex items-center">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    directTargetIds.length > 0
                      ? `Message ${directTargetIds.map((id) => '@' + id.toUpperCase()).join(', ')}...`
                      : 'Ask NOVA, ORBIT & COSMOS anything... (type @nova, @orbit, or @cosmos)'
                  }
                  disabled={isGenerating}
                  className="w-full bg-transparent border-0 text-white placeholder-zinc-500 text-sm sm:text-[15px] focus:outline-none resize-none leading-relaxed min-h-[38px] max-h-[150px] py-1 pr-7 font-sans"
                />
                {inputText && (
                  <button
                    type="button"
                    onClick={() => setInputText('')}
                    className="absolute right-0 top-1.5 p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                    title="Clear input"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Row 3: Bottom Controls Bar (Doc Lens, Web Lens, Mode, Domain, Glowing Send Reactor Button) */}
            <div className="relative z-10 flex items-center justify-between gap-1.5 pt-1.5 mt-1 border-t border-white/[0.07]">
              {/* Left Quick Tools */}
              <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar min-w-0">
                {/* Doc Lens Toggle */}
                <button
                  type="button"
                  onClick={toggleDocLens}
                  className={`px-2 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 transition-all shrink-0 ${
                    docLensEnabled
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/45 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                      : 'bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Toggle Document Lens RAG"
                >
                  <BookOpen size={12} className={docLensEnabled ? 'text-amber-400' : 'text-zinc-400'} />
                  <span>Docs</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      docLensEnabled ? 'bg-amber-400 animate-ping' : 'bg-zinc-600'
                    }`}
                  />
                </button>

                {/* Web Lens Toggle */}
                <button
                  type="button"
                  onClick={toggleWebLens}
                  className={`px-2 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 transition-all shrink-0 ${
                    webLensEnabled
                      ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/45 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                      : 'bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Toggle Live Web Search Grounding"
                >
                  <Globe size={12} className={webLensEnabled ? 'text-cyan-400' : 'text-zinc-400'} />
                  <span>Web</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      webLensEnabled ? 'bg-cyan-400 animate-ping' : 'bg-zinc-600'
                    }`}
                  />
                </button>

                {/* Quick Dialogue Mode Cycle Button */}
                <button
                  type="button"
                  onClick={() => {
                    const modes: MultiChatDialogueMode[] = ['harmony', 'debate', 'parallel'];
                    const next = modes[(modes.indexOf(dialogueMode) + 1) % modes.length];
                    handleSelectDialogueMode(next);
                  }}
                  className="px-2 py-1 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-[11px] font-medium text-zinc-300 flex items-center gap-1 transition-all shrink-0"
                  title="Click to cycle Dialogue Mode (Harmony / Debate / Parallel)"
                >
                  <span>
                    {dialogueMode === 'harmony' ? '🤝' : dialogueMode === 'debate' ? '⚔️' : '⚡'}
                  </span>
                  <span className="capitalize">{dialogueMode}</span>
                </button>

                {/* Domain Presets Bar Toggle */}
                <button
                  type="button"
                  onClick={() => setShowCategoryStrip((prev) => !prev)}
                  className={`px-2 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 transition-all shrink-0 ${
                    showCategoryStrip || selectedCategory !== 'general'
                      ? isClassic
                        ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35'
                        : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/35'
                      : 'bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Toggle Domain Focus Bar"
                >
                  <span>🎯</span>
                  <span className="capitalize hidden xs:inline">{selectedCategory}</span>
                </button>

                {charCount > 0 && (
                  <span className="text-[10px] font-mono text-cyan-300/80 px-1.5 hidden sm:inline shrink-0">
                    {charCount}c · {wordCount}w
                  </span>
                )}
              </div>

              {/* Right: High-Energy Glowing Send Reactor Button */}
              <button
                type="submit"
                disabled={isGenerating || !inputText.trim()}
                className={`relative h-8 sm:h-9 px-3 sm:px-4 rounded-full flex items-center justify-center gap-1.5 font-extrabold text-xs tracking-wide transition-all shrink-0 ${
                  isGenerating || !inputText.trim()
                    ? isFullDark
                      ? 'bg-[#222226] text-zinc-600 cursor-not-allowed'
                      : 'bg-white/5 text-zinc-600 cursor-not-allowed'
                    : isFullDark
                    ? 'bg-white text-black hover:bg-zinc-100 shadow-[0_0_20px_rgba(255,255,255,0.45)] active:scale-95 cursor-pointer'
                    : isClassic
                    ? 'bg-gradient-to-r from-cyan-400 via-sky-400 to-teal-300 text-slate-950 shadow-[0_0_22px_rgba(6,182,212,0.6)] hover:shadow-[0_0_30px_rgba(6,182,212,0.85)] active:scale-95 cursor-pointer'
                    : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 text-white shadow-[0_0_22px_rgba(99,102,241,0.55)] hover:shadow-[0_0_30px_rgba(139,92,246,0.8)] active:scale-95 cursor-pointer'
                }`}
                title="Broadcast to Multi Chat (Enter)"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span className="hidden sm:inline font-mono text-[11px]">Syncing...</span>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">Send</span>
                    <Send size={13} className="translate-x-[0.5px]" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Bottom Subtext Bar (Matches AI Assistant Page Footer) */}
        <div className="flex items-center justify-between px-2 text-[10px] text-zinc-500 font-mono">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => chatTopRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="hover:text-zinc-300 transition-colors cursor-pointer"
              title="Scroll to top"
            >
              NEXUS Multi Chat ↑
            </button>
            <span>·</span>
            <span className="hidden sm:inline">3-Persona Mesh</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCycleTheme}
              className="hover:text-zinc-300 transition-colors cursor-pointer flex items-center gap-1"
              title="Click to switch Multi Chat theme (Minimal / Classic / Full Dark)"
            >
              <span>
                Theme:{' '}
                {isMinimal ? 'NEXUS Minimal' : isClassic ? 'NEXUS Classic' : 'Full Dark'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Clear Chat Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="max-w-md w-full bg-slate-950 rounded-2xl border border-rose-500/30 p-5 sm:p-6 shadow-2xl shadow-rose-950/40">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 grid place-items-center shrink-0">
                <AlertTriangle size={20} className="text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white m-0">Clear Multi Chat History?</h3>
                <span className="text-xs text-rose-400/80 font-mono">
                  {messages.length} message {messages.length === 1 ? 'turn' : 'turns'} will be deleted
                </span>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-5">
              This will permanently remove all multi-persona conversation turns, inquiries, active audio sessions, and generated responses. Active agent memory context will be completely refreshed.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearHistory}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-lg shadow-rose-500/25 transition-all flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                <span>Yes, Clear Chat</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
