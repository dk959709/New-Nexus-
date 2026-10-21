import React, { useState, useEffect, useRef } from 'react';
import {
  Square,
  Settings2,
  MessageSquare,
  Archive,
  Trash2,
  UserPlus,
  Menu,
  Volume2,
  VolumeX,
  Plus,
  X,
  ChevronRight,
  ChevronDown,
  GitBranch,
  MessageSquarePlus,
  AudioLines,
  Copy,
  Check,
  Download,
  RefreshCw,
  Globe,
  Shield,
  Scale,
  Landmark,
  Briefcase,
  Bot,
  Play,
  FileText,
  Palette,
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { runParallaxSwarm } from '@/services/parallaxOrchestrator';
import { ParallaxAgentMatrix } from '@/components/parallax/ParallaxAgentMatrix';
import { ParallaxDeliberationStream } from '@/components/parallax/ParallaxDeliberationStream';
import { ParallaxSynthesisReport } from '@/components/parallax/ParallaxSynthesisReport';
import {
  ParallaxSettings,
  getSavedParallaxTheme,
  saveParallaxTheme,
  type ParallaxTheme,
} from '@/components/parallax/ParallaxSettings';
import { ParallaxAudioVisualizer } from '@/components/parallax/ParallaxAudioVisualizer';
import { ParallaxIntelligenceBriefing } from '@/components/parallax/ParallaxIntelligenceBriefing';
import { ParallaxHumanInjectionModal } from '@/components/parallax/ParallaxHumanInjectionModal';
import { getParallaxAgentVoice, formatFullParallaxTranscript } from '@/data/parallaxVoices';
import { cleanMarkdownForSpeech } from '@/lib/format';
import type {
  ParallaxAgentConfig,
  ParallaxMessage,
  ParallaxSpecialistDeliberation,
  ParallaxSummary,
  ParallaxSystemConfig,
  ParallaxSession,
  ParallaxDebateMode,
  ParallaxIntelligenceBriefing as IntelligenceBriefingType,
  ParallaxHumanInjection,
  ParallaxDevilsAdvocateTrigger,
} from '@/types';

const SAMPLE_TOPICS = [
  'Create a comprehensive global solar competitor report.',
  'Will humanoid robots replace household chores by 2035?',
  'Can universal basic income coexist with inflation?',
  'Is open-source AI safer than centralized proprietary models?',
  'Should humanity build permanent cities on Mars before fixing Earth?',
];

interface ShowcasePreset {
  id: string;
  titleLine1: string;
  titleLine2: string;
  prompt: string;
  thumbType: 'blackhole' | 'typewriter' | 'heatmap' | 'solar' | 'mars';
}

const SHOWCASE_PRESETS: ShowcasePreset[] = [
  {
    id: 'blackhole',
    titleLine1: 'Blackhole',
    titleLine2: ': GARG...',
    prompt: 'Analyze relativistic physics, accretion photon rings, and gravitational lensing around supermassive black hole Gargantua.',
    thumbType: 'blackhole',
  },
  {
    id: 'vintage',
    titleLine1: '3D',
    titleLine2: 'Vintage ...',
    prompt: 'Evaluate the industrial design engineering, tactile mechanics, and cultural resurgence of vintage mechanical typewriters vs modern interfaces.',
    thumbType: 'typewriter',
  },
  {
    id: 'solar',
    titleLine1: 'Global Solar',
    titleLine2: 'Report ...',
    prompt: 'Create a comprehensive global solar competitor report.',
    thumbType: 'heatmap',
  },
  {
    id: 'humanoid',
    titleLine1: 'Humanoid',
    titleLine2: 'Robotics ...',
    prompt: 'Will humanoid robots replace household chores by 2035?',
    thumbType: 'solar',
  },
  {
    id: 'mars',
    titleLine1: 'Mars',
    titleLine2: 'Colony ...',
    prompt: 'Should humanity build permanent cities on Mars before fixing Earth?',
    thumbType: 'mars',
  },
];

const DEBATE_MODES: Array<{
  id: ParallaxDebateMode;
  label: string;
  shortLabel: string;
  icon: React.FC<{ className?: string; size?: number }>;
}> = [
  { id: 'default', label: 'Default Swarm', shortLabel: 'Swarm', icon: Bot },
  { id: 'courtroom', label: 'Courtroom Trial', shortLabel: 'Courtroom', icon: Scale },
  { id: 'red_vs_blue', label: 'Red vs Blue Team', shortLabel: 'Red vs Blue', icon: Shield },
  { id: 'senate', label: 'Senate Summit', shortLabel: 'Senate', icon: Landmark },
  { id: 'vc_pitch', label: 'Venture Pitch Committee', shortLabel: 'VC Pitch', icon: Briefcase },
];

export const ParallaxPage: React.FC = () => {
  const [theme, setTheme] = useState<ParallaxTheme>(() => getSavedParallaxTheme());
  const [activeTab, setActiveTab] = useState<'feed' | 'settings' | 'archive'>('feed');
  const [topicInput, setTopicInput] = useState('');
  const [currentTopic, setCurrentTopic] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentRound, setCurrentRound] = useState<1 | 2 | 3 | null>(null);
  const [messages, setMessages] = useState<ParallaxMessage[]>([]);
  const [summary, setSummary] = useState<ParallaxSummary | null>(null);
  const [statusText, setStatusText] = useState<string>('Ready to mobilize 20-agent swarm.');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [wasStoppedEarly, setWasStoppedEarly] = useState<boolean>(false);

  // UI Drawer & Composer Popovers
  const [isMenuDrawerOpen, setIsMenuDrawerOpen] = useState(false);
  const [showSwarmPill, setShowSwarmPill] = useState(true);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [showAllRecruitedAgents, setShowAllRecruitedAgents] = useState(false);
  const [showDetailedTranscript, setShowDetailedTranscript] = useState(false);
  const [activeDeliverableModal, setActiveDeliverableModal] = useState<'chart' | 'table' | 'report' | null>(null);

  // FEATURE 7: Debate Mode Preset state
  const [debateMode, setDebateMode] = useState<ParallaxDebateMode>('default');

  // FEATURE 1: Intelligence Briefing state
  const [intelligenceBriefing, setIntelligenceBriefing] = useState<IntelligenceBriefingType | null>(null);

  // FEATURE 3 & 4: Human Directives and Devil's Advocate triggers
  const [isHumanModalOpen, setIsHumanModalOpen] = useState(false);
  const [humanInjections, setHumanInjections] = useState<ParallaxHumanInjection[]>([]);
  const [, setDevilsAdvocateTrigger] = useState<ParallaxDevilsAdvocateTrigger | null>(null);

  // Graphics & Filter state
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string | null>(null);
  const [roundFilter, setRoundFilter] = useState<'all' | 1 | 2 | 3>('all');
  const [groupFilter, setGroupFilter] = useState<
    'all' | 'optimists' | 'realists' | 'ethicists' | 'visionaries' | 'anchors' | 'facts'
  >('all');

  // Per-round expand states for curated viewing
  const [expandedRounds, setExpandedRounds] = useState<Record<number, boolean>>({
    1: false,
    2: false,
    3: false,
  });

  // Config & Session state
  const [config, setConfig] = useState<ParallaxSystemConfig>(() => storage.getParallaxConfig());
  const [sessions, setSessions] = useState<ParallaxSession[]>(() => storage.getParallaxSessions());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Audio & TTS synthesis state
  const [playingAudioKey, setPlayingAudioKey] = useState<string | null>(null);
  const [loadingAudioKey, setLoadingAudioKey] = useState<string | null>(null);
  const [fullSwarmProgress, setFullSwarmProgress] = useState<{ current: number; total: number } | null>(null);
  const [stitchedSwarmBlob, setStitchedSwarmBlob] = useState<Blob | null>(null);
  const [isDownloadingSwarmMp3, setIsDownloadingSwarmMp3] = useState(false);
  const [copiedSwarmTranscript, setCopiedSwarmTranscript] = useState(false);
  const [rawJsonOpenMap, setRawJsonOpenMap] = useState<Record<string, boolean>>({});
  const [copiedRawJsonId, setCopiedRawJsonId] = useState<string | null>(null);
  const [dynamicPersonas, setDynamicPersonas] = useState<ParallaxAgentConfig[]>([]);
  const [specialistDeliberation, setSpecialistDeliberation] = useState<ParallaxSpecialistDeliberation | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const swarmPlaybackCancelledRef = useRef<boolean>(false);

  const handleThemeChange = (newTheme: ParallaxTheme) => {
    setTheme(newTheme);
    saveParallaxTheme(newTheme);
  };

  const toggleRawJsonView = (msgId: string) => {
    setRawJsonOpenMap((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const handleCopyRawJson = async (jsonString: string, msgId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(jsonString);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = jsonString;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedRawJsonId(msgId);
      setTimeout(() => setCopiedRawJsonId(null), 2000);
    } catch (err) {
      console.warn('Failed to copy raw JSON:', err);
    }
  };

  const abortControllerRef = useRef<AbortController | null>(null);
  const feedEndRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    return () => {
      swarmPlaybackCancelledRef.current = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const stopAllAudio = () => {
    swarmPlaybackCancelledRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingAudioKey(null);
    setLoadingAudioKey(null);
    setFullSwarmProgress(null);
  };

  const handlePlayMessageAudio = async (msg: ParallaxMessage) => {
    if (playingAudioKey === msg.id) {
      stopAllAudio();
      return;
    }

    stopAllAudio();

    const cleanText = cleanMarkdownForSpeech(msg.text);
    if (!cleanText) return;

    setLoadingAudioKey(msg.id);
    try {
      const voice = msg.voice || config.agents[msg.agentId]?.voice || getParallaxAgentVoice(msg.agentId);
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
      audioRef.current = audio;

      audio.onplay = () => {
        setPlayingAudioKey(msg.id);
        setLoadingAudioKey(null);
      };

      audio.onended = () => {
        setPlayingAudioKey(null);
        audioRef.current = null;
        URL.revokeObjectURL(url);
      };

      audio.onerror = () => {
        setPlayingAudioKey(null);
        audioRef.current = null;
        URL.revokeObjectURL(url);
      };

      await audio.play();
    } catch (err) {
      console.warn('[Parallax] Edge TTS error, falling back to local speech synthesis:', err);
      setLoadingAudioKey(null);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.0;
        utterance.onend = () => setPlayingAudioKey(null);
        utterance.onerror = () => setPlayingAudioKey(null);
        setPlayingAudioKey(msg.id);
        window.speechSynthesis.speak(utterance);
      } else {
        setPlayingAudioKey(null);
      }
    }
  };

  const handleListenToFullSwarm = async () => {
    if (playingAudioKey === 'full_swarm') {
      stopAllAudio();
      return;
    }

    if (messages.length === 0) return;
    stopAllAudio();
    swarmPlaybackCancelledRef.current = false;

    if (stitchedSwarmBlob) {
      const url = URL.createObjectURL(stitchedSwarmBlob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => {
        setPlayingAudioKey('full_swarm');
        setLoadingAudioKey(null);
      };
      audio.onended = () => {
        setPlayingAudioKey(null);
        audioRef.current = null;
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setPlayingAudioKey(null);
        audioRef.current = null;
        URL.revokeObjectURL(url);
      };
      try {
        await audio.play();
      } catch (err) {
        console.warn('[Parallax] Playback error on cached stitched blob:', err);
        setPlayingAudioKey(null);
      }
      return;
    }

    setLoadingAudioKey('full_swarm');
    setFullSwarmProgress({ current: 1, total: messages.length + 2 });

    const audioBlobs: Blob[] = [];

    const fetchCustomBlob = async (text: string, voice: string): Promise<Blob | null> => {
      const clean = cleanMarkdownForSpeech(text);
      if (!clean) return null;
      try {
        const res = await fetch('/api/edge-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: clean.slice(0, 3500), voice }),
        });
        if (res.ok) return await res.blob();
      } catch (e) {
        console.warn('[Parallax] Audio fetch error:', e);
      }
      return null;
    };

    try {
      const introText = `Welcome to Parallax Agent Swarm. Today, twenty AI agents investigate: ${currentTopic || topicInput}.`;
      const introBlob = await fetchCustomBlob(introText, 'en-US-ChristopherNeural');
      if (introBlob && !swarmPlaybackCancelledRef.current) {
        audioBlobs.push(introBlob);
        await new Promise<void>((resolve) => {
          const url = URL.createObjectURL(introBlob);
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onplay = () => {
            setLoadingAudioKey(null);
            setPlayingAudioKey('full_swarm');
          };
          const finish = () => {
            URL.revokeObjectURL(url);
            audioRef.current = null;
            resolve();
          };
          audio.onended = finish;
          audio.onerror = finish;
          audio.play().catch(finish);
        });
      }

      for (let i = 0; i < messages.length; i++) {
        if (swarmPlaybackCancelledRef.current) break;

        const msg = messages[i];
        setFullSwarmProgress({ current: i + 1, total: messages.length + 1 });

        const rawClean = cleanMarkdownForSpeech(msg.text);
        if (!rawClean) continue;

        const spokenIntro = `${msg.agentName} in round ${msg.round}. `;
        const fullSpeechText = cleanMarkdownForSpeech(spokenIntro + rawClean);
        const voice = msg.voice || config.agents[msg.agentId]?.voice || getParallaxAgentVoice(msg.agentId);

        const blob = await fetchCustomBlob(fullSpeechText, voice);
        if (swarmPlaybackCancelledRef.current) break;
        if (!blob) continue;

        audioBlobs.push(blob);

        await new Promise<void>((resolve) => {
          if (swarmPlaybackCancelledRef.current) {
            resolve();
            return;
          }

          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;

          audio.onplay = () => {
            setLoadingAudioKey(null);
            setPlayingAudioKey('full_swarm');
          };

          const handleFinish = () => {
            URL.revokeObjectURL(url);
            audioRef.current = null;
            resolve();
          };

          audio.onended = handleFinish;
          audio.onerror = handleFinish;
          audio.play().catch(handleFinish);
        });
      }

      if (!swarmPlaybackCancelledRef.current && summary?.verdict) {
        const outroText = `This concludes the Parallax swarm deliberation. Final consensus: ${summary.consensusLean || 'Balanced'}. Verdict: ${summary.verdict}`;
        const outroBlob = await fetchCustomBlob(outroText, 'en-US-ChristopherNeural');
        if (outroBlob && !swarmPlaybackCancelledRef.current) {
          audioBlobs.push(outroBlob);
          await new Promise<void>((resolve) => {
            const url = URL.createObjectURL(outroBlob);
            const audio = new Audio(url);
            audioRef.current = audio;
            const finish = () => {
              URL.revokeObjectURL(url);
              audioRef.current = null;
              resolve();
            };
            audio.onended = finish;
            audio.onerror = finish;
            audio.play().catch(finish);
          });
        }
      }

      if (!swarmPlaybackCancelledRef.current && audioBlobs.length > 0) {
        const stitched = new Blob(audioBlobs, { type: 'audio/mpeg' });
        setStitchedSwarmBlob(stitched);
      }
    } catch (err) {
      console.error('[Parallax] Full swarm playback error:', err);
    } finally {
      if (!swarmPlaybackCancelledRef.current) {
        setPlayingAudioKey(null);
        setLoadingAudioKey(null);
        setFullSwarmProgress(null);
      }
    }
  };

  const handleDownloadSwarmMp3 = async () => {
    if (messages.length === 0) return;
    setIsDownloadingSwarmMp3(true);
    try {
      let blobToDownload = stitchedSwarmBlob;

      if (!blobToDownload) {
        setFullSwarmProgress({ current: 0, total: messages.length + 2 });

        const items: Array<{ text: string; voice: string }> = [];

        const introSpeech = cleanMarkdownForSpeech(
          `Welcome to Parallax Agent Swarm. Today, twenty AI agents debate: ${currentTopic || topicInput}.`,
        );
        if (introSpeech) {
          items.push({ text: introSpeech.slice(0, 3500), voice: 'en-US-ChristopherNeural' });
        }

        for (const msg of messages) {
          const rawClean = cleanMarkdownForSpeech(msg.text);
          if (!rawClean) continue;
          const spokenIntro = `${msg.agentName} in round ${msg.round}. `;
          const fullSpeechText = cleanMarkdownForSpeech(spokenIntro + rawClean);
          const voice = msg.voice || config.agents[msg.agentId]?.voice || getParallaxAgentVoice(msg.agentId);
          items.push({ text: fullSpeechText.slice(0, 3500), voice });
        }

        if (summary?.verdict) {
          const outroSpeech = cleanMarkdownForSpeech(
            `This concludes the Parallax swarm deliberation. Final consensus: ${summary.consensusLean || 'Balanced'}. Verdict: ${summary.verdict}`,
          );
          if (outroSpeech) {
            items.push({ text: outroSpeech.slice(0, 3500), voice: 'en-US-ChristopherNeural' });
          }
        }

        if (items.length > 0) {
          try {
            const response = await fetch('/api/edge-tts/batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items }),
            });

            if (response.ok) {
              blobToDownload = await response.blob();
              setStitchedSwarmBlob(blobToDownload);
            }
          } catch (batchErr) {
            console.warn('[Parallax] Batch endpoint error, trying fallback:', batchErr);
          }
        }
      }

      if (!blobToDownload) {
        throw new Error('No audio could be compiled for download');
      }

      const url = URL.createObjectURL(blobToDownload);
      const a = document.createElement('a');
      a.href = url;
      const safeTopic = (currentTopic || topicInput || 'debate')
        .slice(0, 35)
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .toLowerCase();
      a.download = `parallax-${safeTopic}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (err) {
      console.error('[Parallax] Download swarm MP3 error:', err);
    } finally {
      setIsDownloadingSwarmMp3(false);
      setFullSwarmProgress(null);
    }
  };

  const handleCopyFullSwarm = () => {
    const transcript = formatFullParallaxTranscript(
      currentTopic || topicInput,
      messages,
      summary,
      specialistDeliberation || undefined,
    );
    navigator.clipboard.writeText(transcript);
    setCopiedSwarmTranscript(true);
    setTimeout(() => setCopiedSwarmTranscript(false), 2500);
  };

  const handleHumanInjection = (injection: ParallaxHumanInjection) => {
    const humanMsg: ParallaxMessage = {
      id: injection.id,
      agentId: 'human',
      agentName: injection.authorName || 'HUMAN OPERATOR',
      initials: 'HU',
      accentColor: '#f59e0b',
      round: (currentRound || 1) as 1 | 2 | 3,
      text: injection.text,
      isHuman: true,
      timestamp: Date.now(),
      role: 'Human Operator Directive',
      model: 'Human Operator',
      providerName: 'Operator Console',
    };

    setMessages((prev) => [...prev, humanMsg]);
    setHumanInjections((prev) => [...prev, injection]);
    setStatusText(`HUMAN OPERATOR INJECTED DIRECTIVE • RE-ROUTING SWARM FOCUS`);
  };

  useEffect(() => {
    const handleStorage = () => {
      setConfig(storage.getParallaxConfig());
      setSessions(storage.getParallaxSessions());
      setTheme(getSavedParallaxTheme());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (autoScroll && feedEndRef.current && isRunning) {
      feedEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, autoScroll, isRunning]);

  const toggleRoundExpand = (roundNum: number) => {
    setExpandedRounds((prev) => ({ ...prev, [roundNum]: !prev[roundNum] }));
  };

  const handleStartSwarm = async (topicToRun?: string) => {
    const targetTopic = (topicToRun || topicInput).trim();
    if (!targetTopic) return;

    stopAllAudio();
    setStitchedSwarmBlob(null);
    setErrorText(null);
    setSummary(null);
    setWasStoppedEarly(false);
    setMessages([]);
    setDynamicPersonas([]);
    setSpecialistDeliberation(null);
    setIntelligenceBriefing(null);
    setHumanInjections([]);
    setDevilsAdvocateTrigger(null);
    setCurrentTopic(targetTopic);
    setTopicInput('');
    setIsRunning(true);
    setCurrentRound(1);
    setActiveTab('feed');
    setIsPlusMenuOpen(false);
    setStatusText('INITIALIZING PARALLAX CORE • CONNECTING AGENTS...');
    setExpandedRounds({ 1: false, 2: false, 3: false });
    setAutoScroll(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    await runParallaxSwarm({
      topic: targetTopic,
      config,
      debateMode,
      humanInjections,
      signal: controller.signal,
      onRoundStart: (r) => {
        setCurrentRound(r);
        if (r === 1) {
          setStatusText('PLANNER ONLINE • RESEARCH SWARM ONLINE • ROUND 01');
        } else if (r === 2) {
          setStatusText('DELIBERATION ACTIVE • CROSS-EXAMINATION • ROUND 02');
        } else if (r === 3) {
          setStatusText('DELIBERATION ACTIVE • CONVERGENCE RESOLUTION • ROUND 03');
        }
      },
      onIntelligenceBriefingReady: (briefing) => {
        setIntelligenceBriefing(briefing);
        setStatusText('ROUND 00 COMPLETE • INTELLIGENCE BRIEFING READY');
      },
      onSpecialistDeliberation: (deliberation) => {
        setSpecialistDeliberation(deliberation);
        setStatusText('CONNECTING AGENTS • SPECIALISTS COMPILED');
      },
      onDynamicPersonasCreated: (personas) => {
        setDynamicPersonas(personas);
      },
      onDevilsAdvocateTriggered: (trigger) => {
        setDevilsAdvocateTrigger(trigger);
        setStatusText(`DEVIL'S ADVOCATE INJECTED • CONTRARIAN STRESS-TEST ACTIVE`);
      },
      onMessage: (msg) => {
        setMessages((prev) => [...prev, msg]);
      },
      onStatusUpdate: (status) => {
        setStatusText(status);
      },
      onComplete: (sum, _allMsgs, deliberation) => {
        setSummary(sum);
        if (deliberation) {
          setSpecialistDeliberation(deliberation);
        }
        setWasStoppedEarly(false);
        setIsRunning(false);
        setStatusText('SYNTHESIS READY • COMPLETE');
        setSessions(storage.getParallaxSessions());
      },
      onError: (err) => {
        setErrorText(err);
        setIsRunning(false);
        setStatusText('Swarm error encountered.');
      },
    });

    setIsRunning(false);
  };

  const handleStopSwarm = () => {
    stopAllAudio();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setWasStoppedEarly(true);
    setIsRunning(false);
    setStatusText('Swarm stopped early by user.');
  };

  const handleResetToNewSwarm = () => {
    if (isRunning) {
      handleStopSwarm();
    }
    stopAllAudio();
    setMessages([]);
    setSummary(null);
    setCurrentTopic('');
    setTopicInput('');
    setIntelligenceBriefing(null);
    setWasStoppedEarly(false);
    setErrorText(null);
    setActiveTab('feed');
  };

  const enabledAgentsList = Object.values(config.agents || {}).filter((a) => a.enabled !== false);
  const enabledAgentsCount = enabledAgentsList.length;

  const activeSpeakingAgent =
    playingAudioKey && playingAudioKey !== 'full_swarm'
      ? messages.find((m) => m.id === playingAudioKey) || null
      : isRunning && messages.length > 0
      ? messages[messages.length - 1]
      : null;

  const hasActiveMission = Boolean(currentTopic || messages.length > 0 || isRunning || summary);

  // Build agent recruitment list combining agents who have spoken + configured active agents
  const recruitedAgents = React.useMemo(() => {
    const byId = new Map<
      string,
      {
        id: string;
        name: string;
        role: string;
        accentColor: string;
        latestRound: number;
        latestText: string;
        conviction: number;
        turns: ParallaxMessage[];
      }
    >();

    for (const msg of messages) {
      const existing = byId.get(msg.agentId);
      const turns = existing ? [...existing.turns, msg] : [msg];
      byId.set(msg.agentId, {
        id: msg.agentId,
        name: msg.agentName.split(' (')[0],
        role: msg.role || config.agents[msg.agentId]?.role || 'Research Specialist',
        accentColor: msg.accentColor || '#10b981',
        latestRound: msg.round,
        latestText: msg.text,
        conviction: msg.convictionScore ?? 78,
        turns,
      });
    }

    if (byId.size < 8) {
      for (const agent of enabledAgentsList) {
        if (byId.size >= 8) break;
        if (!byId.has(agent.id)) {
          byId.set(agent.id, {
            id: agent.id,
            name: agent.name.split(' (')[0],
            role: agent.role || 'Domain Specialist',
            accentColor: agent.accentColor || '#10b981',
            latestRound: currentRound || 1,
            latestText: `${agent.role} analysis & competitive synthesis`,
            conviction: isRunning ? 45 : 75,
            turns: [],
          });
        }
      }
    }

    return Array.from(byId.values());
  }, [messages, enabledAgentsList, config.agents, currentRound, isRunning]);

  const visibleRecruitedAgents = showAllRecruitedAgents ? recruitedAgents : recruitedAgents.slice(0, 5);

  const chartPoints = React.useMemo(() => {
    if (recruitedAgents.length === 0) {
      return [
        { label: 'Jan-24', val: 32 },
        { label: 'Apr-24', val: 45 },
        { label: 'Jul-24', val: 41 },
        { label: 'Oct-24', val: 58 },
        { label: 'Jan-25', val: 92 },
        { label: 'Apr-25', val: 64 },
        { label: 'Jul-25', val: 78 },
        { label: 'Oct-25', val: 85 },
        { label: 'Jan-26', val: 74 },
        { label: 'Apr-26', val: 88 },
      ];
    }
    return recruitedAgents.slice(0, 10).map((ag, idx) => {
      const r1 = ag.turns.find((t) => t.round === 1)?.convictionScore ?? 58 + ((idx * 7) % 25);
      const r3 = ag.turns[ag.turns.length - 1]?.convictionScore ?? ag.conviction ?? r1 + 12;
      return {
        label: ag.name.slice(0, 6),
        val: Math.max(20, Math.min(98, r3)),
      };
    });
  }, [recruitedAgents]);

  const currentModeObj = DEBATE_MODES.find((m) => m.id === debateMode) || DEBATE_MODES[0];

  // ============================================================
  // 3-THEME DESIGN TOKENS (Minimal / Classic / Full Dark)
  // ============================================================
  const wrapperThemeClass =
    theme === 'classic'
      ? 'theme-classic bg-[#060b13] text-[#e2e8f0] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0c223c] via-[#081324] to-[#040810]'
      : theme === 'fulldark'
      ? 'theme-fulldark bg-black text-[#ececec]'
      : 'theme-minimal bg-[#111113] text-[#e3e3e7]';

  const floatingPillClass =
    theme === 'classic'
      ? 'bg-slate-900/80 backdrop-blur-xl border border-cyan-500/30 text-cyan-50 shadow-[0_4px_20px_rgba(6,182,212,0.15)]'
      : theme === 'fulldark'
      ? 'bg-[#171717] border border-[#2e2e2e] text-[#ececec] shadow-[0_2px_12px_rgba(0,0,0,0.6)]'
      : 'bg-[#1c1c1f] border border-zinc-800 text-zinc-100 shadow-[0_2px_12px_rgba(0,0,0,0.4)]';

  const floatingPillHoverClass =
    theme === 'classic'
      ? 'hover:bg-slate-800/90'
      : theme === 'fulldark'
      ? 'hover:bg-[#222222]'
      : 'hover:bg-zinc-800';

  const outerCardClass =
    theme === 'classic'
      ? 'bg-slate-900/65 backdrop-blur-xl border border-cyan-500/25 shadow-[0_8px_30px_rgba(6,182,212,0.12)]'
      : theme === 'fulldark'
      ? 'bg-[#141414] border border-[#2a2a2a] shadow-2xl'
      : 'bg-[#18181b] border border-zinc-800 shadow-xl';

  const innerSubCardClass =
    theme === 'classic'
      ? 'bg-slate-950/65 hover:bg-slate-900/90 border border-cyan-500/15'
      : theme === 'fulldark'
      ? 'bg-[#1f1f1f] hover:bg-[#272727] border border-[#2e2e2e]'
      : 'bg-[#222226] hover:bg-[#29292e] border border-zinc-800/80';

  const composerCardClass =
    theme === 'classic'
      ? 'bg-slate-900/85 backdrop-blur-xl border border-cyan-500/35 shadow-[0_8px_32px_rgba(6,182,212,0.18)]'
      : theme === 'fulldark'
      ? 'bg-[#212121] border border-[#333333] shadow-[0_8px_32px_rgba(0,0,0,0.75)]'
      : 'bg-[#1c1c1f] border border-zinc-800 shadow-[0_8px_32px_rgba(0,0,0,0.5)]';

  const composerPillClass =
    theme === 'classic'
      ? 'bg-cyan-950/50 border border-cyan-500/25 text-cyan-200'
      : theme === 'fulldark'
      ? 'bg-[#2f2f2f] text-[#ececec]'
      : 'bg-[#26262a] text-zinc-200';

  const circleBtnClass =
    theme === 'classic'
      ? 'bg-slate-800/90 hover:bg-cyan-950/80 text-cyan-300 border border-cyan-500/25'
      : theme === 'fulldark'
      ? 'bg-[#2f2f2f] hover:bg-[#3a3a3a] text-[#ececec]'
      : 'bg-[#26262a] hover:bg-zinc-700 text-zinc-200';

  const renderShowcaseThumbnail = (type: ShowcasePreset['thumbType']) => {
    if (type === 'blackhole') {
      return (
        <div className="w-12 h-12 rounded-xl bg-black relative overflow-hidden shrink-0 flex items-center justify-center shadow-inner">
          <div
            className="w-9 h-9 rounded-full"
            style={{
              background:
                'radial-gradient(circle, #000000 38%, #f59e0b 54%, #ea580c 68%, transparent 78%)',
              boxShadow: '0 0 12px #f59e0b',
            }}
          />
          <div className="absolute inset-x-0 top-1/2 h-[2px] bg-gradient-to-r from-transparent via-amber-200 to-transparent -rotate-12" />
        </div>
      );
    }
    if (type === 'typewriter') {
      return (
        <div className="w-12 h-12 rounded-xl bg-stone-900 relative overflow-hidden shrink-0 flex flex-col items-center justify-center p-1.5">
          <div className="w-7 h-3 bg-stone-700 rounded-t-sm border-b border-amber-500/40" />
          <div className="w-9 h-4 bg-stone-800 rounded-sm grid grid-cols-5 gap-0.5 p-0.5 mt-0.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} className="w-1 h-1 rounded-full bg-amber-200/70" />
            ))}
          </div>
        </div>
      );
    }
    if (type === 'heatmap') {
      return (
        <div className="w-12 h-12 rounded-xl bg-slate-950 p-1 grid grid-cols-3 grid-rows-3 gap-0.5 shrink-0 overflow-hidden">
          <div className="bg-rose-600 rounded-[2px] col-span-1 row-span-2" />
          <div className="bg-emerald-600 rounded-[2px] col-span-2 row-span-1" />
          <div className="bg-emerald-500 rounded-[2px]" />
          <div className="bg-rose-500 rounded-[2px]" />
          <div className="bg-emerald-700 rounded-[2px] col-span-2" />
          <div className="bg-amber-500 rounded-[2px]" />
        </div>
      );
    }
    if (type === 'solar') {
      return (
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-900 to-slate-900 relative overflow-hidden shrink-0 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-cyan-400/30 border border-cyan-300 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-300" />
          </div>
        </div>
      );
    }
    return (
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-950 via-red-900 to-black relative overflow-hidden shrink-0 flex items-center justify-center">
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-orange-600 to-amber-400 shadow-[0_0_10px_#ea580c]" />
      </div>
    );
  };

  return (
    <div
      id="parallax-page-wrapper"
      data-theme={theme}
      className={`min-h-screen relative w-full overflow-x-hidden font-sans select-none transition-colors duration-200 ${wrapperThemeClass}`}
    >
      <div
        id="parallax-page"
        className="relative z-10 w-full max-w-[820px] mx-auto min-h-screen flex flex-col justify-between px-4 sm:px-6 pt-3 pb-6"
      >
        {/* ============================================================
            TOP FLOATING PILL HEADER (Kimi K3 / Agent Swarm Style)
           ============================================================ */}
        <header
          id="parallax-command-header"
          className="sticky top-2 z-30 flex items-center justify-between gap-3 py-2"
        >
          {/* Left: Hamburger Button + Brand Pill */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsMenuDrawerOpen(true)}
              aria-label="Open Parallax menu"
              className={`w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-all cursor-pointer ${floatingPillClass} ${floatingPillHoverClass}`}
            >
              <Menu size={20} strokeWidth={2.2} />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'feed' ? 'settings' : 'feed')}
              className={`h-11 px-4 rounded-full flex items-center gap-1.5 text-[15px] transition-all cursor-pointer ${floatingPillClass} ${floatingPillHoverClass}`}
            >
              <span
                className={`font-semibold tracking-tight ${
                  theme === 'classic' ? 'text-cyan-300' : 'text-zinc-100'
                }`}
              >
                Parallax
              </span>
              <span
                className={`font-normal ${
                  theme === 'classic' ? 'text-cyan-200/70' : 'text-zinc-400'
                }`}
              >
                {hasActiveMission ? 'K3 Agent Swarm' : 'K3'}
              </span>
            </button>
          </div>

          {/* Right: New Chat + Settings + Speaker Audio Pill */}
          <div className={`flex items-center gap-1 rounded-full p-1 ${floatingPillClass}`}>
            {hasActiveMission && (
              <button
                type="button"
                onClick={handleResetToNewSwarm}
                title="New Swarm Task"
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${floatingPillHoverClass}`}
              >
                <MessageSquarePlus size={18} strokeWidth={2} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'settings' ? 'feed' : 'settings')}
              title="Parallax Settings & Visual Themes"
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                activeTab === 'settings'
                  ? theme === 'classic'
                    ? 'bg-cyan-500/25 text-cyan-300'
                    : 'bg-zinc-700 text-white'
                  : floatingPillHoverClass
              }`}
            >
              <Settings2 size={18} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (playingAudioKey) {
                  stopAllAudio();
                } else if (messages.length > 0) {
                  handleListenToFullSwarm();
                }
              }}
              title={playingAudioKey ? 'Mute / Stop Audio' : 'Listen to Swarm Deliberation'}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                playingAudioKey
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : floatingPillHoverClass
              }`}
            >
              {playingAudioKey ? <Volume2 size={18} strokeWidth={2} /> : <VolumeX size={18} strokeWidth={2} />}
            </button>
          </div>
        </header>

        {/* Accessible Tab Switcher Bar (when in Settings or Archive view) */}
        {activeTab !== 'feed' && (
          <div
            id="parallax-tabs-nav"
            className={`flex items-center justify-between gap-2 rounded-2xl p-2 my-3 ${outerCardClass}`}
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                id="parallax-tab-feed"
                type="button"
                onClick={() => setActiveTab('feed')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${circleBtnClass}`}
              >
                <MessageSquare size={14} />
                <span>← Back to Swarm</span>
              </button>
              <button
                id="parallax-tab-settings"
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  activeTab === 'settings'
                    ? theme === 'classic'
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-zinc-100 text-zinc-900'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <Settings2 size={14} />
                <span>Settings &amp; Themes ({enabledAgentsCount})</span>
              </button>
              <button
                id="parallax-tab-archive"
                type="button"
                onClick={() => setActiveTab('archive')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  activeTab === 'archive'
                    ? theme === 'classic'
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-zinc-100 text-zinc-900'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <Archive size={14} />
                <span>Past Swarms ({sessions.length})</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================
            SIDE DRAWER MENU (Hamburger Menu: History, Agents, Modes, 3 Themes)
           ============================================================ */}
        {isMenuDrawerOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex"
            onClick={() => setIsMenuDrawerOpen(false)}
          >
            <div
              className={`w-[320px] max-w-[85vw] h-full shadow-2xl p-5 flex flex-col justify-between overflow-y-auto border-r ${
                theme === 'classic'
                  ? 'bg-[#07101d] border-cyan-500/25 text-slate-100'
                  : theme === 'fulldark'
                  ? 'bg-[#121212] border-[#2a2a2a] text-[#ececec]'
                  : 'bg-[#161619] border-zinc-800 text-zinc-100'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-6">
                {/* Drawer Header */}
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-b from-blue-400 to-blue-600 flex items-center justify-center shadow-sm">
                      <div className="flex gap-1 -mt-0.5 ml-1">
                        <span className="w-1 h-2 bg-white rounded-full" />
                        <span className="w-1 h-2 bg-white rounded-full" />
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-zinc-100">Parallax K3</div>
                      <div className="text-[11px] text-zinc-400">{enabledAgentsCount} Agents Online</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMenuDrawerOpen(false)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer ${circleBtnClass}`}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Primary Navigation */}
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      handleResetToNewSwarm();
                      setIsMenuDrawerOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-semibold text-sm flex items-center gap-2.5 hover:bg-cyan-500/25 transition-colors cursor-pointer"
                  >
                    <Plus size={16} />
                    <span>New Agent Swarm Task</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('feed');
                      setIsMenuDrawerOpen(false);
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                      activeTab === 'feed'
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                    }`}
                  >
                    <MessageSquare size={16} />
                    <span>Swarm Workspace</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('settings');
                      setIsMenuDrawerOpen(false);
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                      activeTab === 'settings'
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                    }`}
                  >
                    <Settings2 size={16} />
                    <span>Settings, Themes &amp; Agents (20)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('archive');
                      setIsMenuDrawerOpen(false);
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                      activeTab === 'archive'
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                    }`}
                  >
                    <Archive size={16} />
                    <span>Saved Swarms ({sessions.length})</span>
                  </button>
                </div>

                {/* Quick 3-Theme Selector inside Drawer */}
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2 px-1">
                    <Palette size={12} className="text-purple-400" />
                    <span>Visual Theme</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
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
                        onClick={() => handleThemeChange(t.id)}
                        className={`px-2 py-2 rounded-xl border text-[11px] font-medium text-center transition-all cursor-pointer ${
                          theme === t.id
                            ? t.id === 'classic'
                              ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200 shadow-xs'
                              : 'border-zinc-400 bg-zinc-800 text-white shadow-xs'
                            : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Debate Protocol Selection */}
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2 px-1">
                    Swarm Protocol
                  </div>
                  <div className="space-y-1">
                    {DEBATE_MODES.map((m) => {
                      const Icon = m.icon;
                      const active = debateMode === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          disabled={isRunning}
                          onClick={() => {
                            setDebateMode(m.id);
                            setShowSwarmPill(true);
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                            active
                              ? 'bg-zinc-800 text-white font-semibold'
                              : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Icon size={14} className={active ? 'text-cyan-400' : 'text-zinc-500'} />
                            {m.label}
                          </span>
                          {active && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Recent Swarm Sessions */}
                {sessions.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2 px-1">
                      Recent Tasks
                    </div>
                    <div className="space-y-1">
                      {sessions.slice(0, 6).map((sess) => (
                        <button
                          key={sess.id}
                          type="button"
                          onClick={() => {
                            stopAllAudio();
                            setStitchedSwarmBlob(null);
                            setMessages(sess.messages);
                            setSummary(sess.summary || null);
                            setSpecialistDeliberation(sess.specialistDeliberation || null);
                            setIntelligenceBriefing(sess.intelligenceBriefing || null);
                            setHumanInjections(sess.humanInjections || []);
                            setDevilsAdvocateTrigger(sess.devilsAdvocateTrigger || null);
                            if (sess.debateMode) setDebateMode(sess.debateMode);
                            setWasStoppedEarly(false);
                            setCurrentTopic(sess.topic);
                            setActiveTab('feed');
                            setIsMenuDrawerOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-zinc-800/60 text-xs text-zinc-300 truncate transition-colors cursor-pointer"
                        >
                          {sess.topic}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-white/[0.08] text-[11px] text-zinc-500 flex items-center justify-between">
                <span>Parallax Swarm Engine</span>
                <span className="capitalize">{theme} Theme</span>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB CONTENT: SETTINGS (Includes 3 Visual Themes + 20 Agents)
           ============================================================ */}
        {activeTab === 'settings' && (
          <div className={`flex-1 rounded-3xl p-4 sm:p-6 my-2 space-y-6 ${outerCardClass}`}>
            <ParallaxSettings
              config={config}
              onConfigChange={(newCfg) => setConfig(newCfg)}
              theme={theme}
              onThemeChange={handleThemeChange}
            />
            <ParallaxAgentMatrix
              agents={config.agents}
              messages={messages}
              selectedAgentId={selectedAgentFilter}
              activeSpeakingAgentId={activeSpeakingAgent?.agentId}
              onSelectAgent={(agentId) => setSelectedAgentFilter(agentId)}
              dynamicPersonas={dynamicPersonas}
              onPlayVoice={handlePlayMessageAudio}
            />
          </div>
        )}

        {/* ============================================================
            TAB CONTENT: ARCHIVE
           ============================================================ */}
        {activeTab === 'archive' && (
          <div id="parallax-archive-tab" className="flex-1 py-4 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="m-0 text-base font-bold text-zinc-100">
                Saved Swarm Discussions ({sessions.length})
              </h3>
              {sessions.length > 0 && (
                <button
                  id="parallax-clear-archive-btn"
                  type="button"
                  onClick={() => {
                    storage.clearParallaxSessions();
                    setSessions([]);
                    setConfirmDeleteId(null);
                  }}
                  className="px-3.5 py-1.5 rounded-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 size={14} />
                  <span>Clear Archive</span>
                </button>
              )}
            </div>

            {sessions.length === 0 ? (
              <div className="py-16 text-center text-zinc-500 text-sm">
                No archived sessions yet. Assign a task to your AI team to generate reports.
              </div>
            ) : (
              <div className="space-y-2.5">
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    id={`parallax-saved-swarm-${sess.id}`}
                    className={`p-4 rounded-2xl transition-all flex flex-col gap-2 ${outerCardClass}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-semibold text-zinc-100 leading-snug">
                        {sess.topic}
                      </span>
                      <span className="text-[11px] text-zinc-400 font-mono shrink-0">
                        {new Date(sess.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    {sess.summary && (
                      <div className="text-xs text-zinc-300 leading-relaxed">
                        <strong className="text-cyan-400">Consensus:</strong> {sess.summary.consensusLean}
                      </div>
                    )}
                    <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                      <span className="text-[11px] text-zinc-400 font-mono">
                        {sess.messages.length} agent turns · 3 rounds
                      </span>

                      {confirmDeleteId === sess.id ? (
                        <div
                          id={`confirm-delete-swarm-prompt-${sess.id}`}
                          className="flex items-center gap-2 bg-rose-950/60 border border-rose-500/30 rounded-full px-3 py-1"
                        >
                          <span className="text-[11px] text-rose-300 font-semibold">Delete?</span>
                          <button
                            id={`confirm-delete-yes-${sess.id}`}
                            type="button"
                            onClick={() => {
                              storage.deleteParallaxSession(sess.id);
                              setSessions(storage.getParallaxSessions());
                              setConfirmDeleteId(null);
                            }}
                            className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
                          >
                            Delete
                          </button>
                          <button
                            id={`confirm-delete-cancel-${sess.id}`}
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-[11px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              stopAllAudio();
                              setStitchedSwarmBlob(null);
                              setMessages(sess.messages);
                              setSummary(sess.summary || null);
                              setSpecialistDeliberation(sess.specialistDeliberation || null);
                              setIntelligenceBriefing(sess.intelligenceBriefing || null);
                              setHumanInjections(sess.humanInjections || []);
                              setDevilsAdvocateTrigger(sess.devilsAdvocateTrigger || null);
                              if (sess.debateMode) setDebateMode(sess.debateMode);
                              setWasStoppedEarly(false);
                              setCurrentTopic(sess.topic);
                              setActiveTab('feed');
                            }}
                            className="px-3.5 py-1.5 rounded-full bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-200 text-[11px] font-semibold cursor-pointer transition-colors"
                          >
                            Open Report
                          </button>
                          <button
                            id={`delete-individual-swarm-${sess.id}`}
                            type="button"
                            onClick={() => setConfirmDeleteId(sess.id)}
                            className="p-1.5 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 cursor-pointer flex items-center justify-center transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================
            MAIN FEED VIEW (SCREENSHOT 1 IDLE STATE + SCREENSHOT 2 ACTIVE STATE)
           ============================================================ */}
        {activeTab === 'feed' && (
          <div id="parallax-feed-view" className="flex-1 flex flex-col justify-between">
            {!hasActiveMission ? (
              /* ==========================================================
                 SCREENSHOT 1: IDLE / LANDING VIEW (Blue Orb + Headline)
                 ========================================================== */
              <div className="flex-1 flex flex-col items-center justify-center py-16 sm:py-24 px-4 text-center">
                {/* Glowing 3D Soft Blue Sphere Avatar with White Eyes */}
                <div className="relative mb-6 flex items-center justify-center">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center ${
                      theme === 'classic'
                        ? 'bg-cyan-500/15 shadow-[0_8px_35px_rgba(6,182,212,0.3)]'
                        : 'bg-blue-500/15 shadow-[0_8px_30px_rgba(59,130,246,0.25)]'
                    }`}
                  >
                    <div
                      className="w-13 h-13 rounded-full relative flex items-center justify-center transition-transform duration-500 hover:scale-105"
                      style={{
                        background:
                          'radial-gradient(circle at 35% 30%, #60a5fa 0%, #3b82f6 55%, #2563eb 100%)',
                        boxShadow:
                          'inset 0 -4px 8px rgba(29, 78, 216, 0.5), inset 0 3px 6px rgba(191, 219, 254, 0.7)',
                      }}
                    >
                      {/* Cute vertical oval eyes tilted slightly up-right */}
                      <div className="flex items-center gap-1.5 translate-x-1 -translate-y-1">
                        <span className="w-1.5 h-3 rounded-full bg-white shadow-xs rotate-6" />
                        <span className="w-1.5 h-2.5 rounded-full bg-white shadow-xs rotate-6" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Headline matching Screenshot 1 */}
                <h1
                  className={`text-[22px] sm:text-[26px] font-semibold tracking-tight leading-[1.35] max-w-[340px] sm:max-w-[420px] ${
                    theme === 'classic'
                      ? 'text-slate-100 drop-shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                      : theme === 'fulldark'
                      ? 'text-[#f4f4f5]'
                      : 'text-zinc-100'
                  }`}
                >
                  Agent Mode: One-click websites, slides, Word &amp; Excel.
                </h1>
              </div>
            ) : (
              /* ==========================================================
                 SCREENSHOT 2: ACTIVE / COMPLETED AGENT SWARM VIEW
                 ========================================================== */
              <div className="flex-1 py-4 space-y-5 select-text">
                {/* 1. User Prompt Bubble */}
                <div className="flex justify-end">
                  <div
                    className={`rounded-2xl px-4 py-3.5 text-[15px] sm:text-[16px] leading-relaxed max-w-[88%] sm:max-w-[78%] ${
                      theme === 'classic'
                        ? 'bg-cyan-950/60 text-cyan-50 border border-cyan-500/30 shadow-[0_4px_20px_rgba(6,182,212,0.12)]'
                        : theme === 'fulldark'
                        ? 'bg-[#2f2f2f] text-[#ececec] border border-[#3d3d3d]'
                        : 'bg-[#26262a] text-zinc-100 border border-zinc-700/60'
                    }`}
                  >
                    {currentTopic}
                  </div>
                </div>

                {/* 2. Orchestrator Intro Narrative */}
                <p
                  className={`text-[15.5px] sm:text-[16.5px] leading-[1.6] font-normal ${
                    theme === 'classic'
                      ? 'text-slate-200'
                      : theme === 'fulldark'
                      ? 'text-[#e3e3e3]'
                      : 'text-zinc-200'
                  }`}
                >
                  I&apos;ll orchestrate this large–scale competitive intelligence program. Let me start by writing the execution plan, then deploy the research swarm.
                </p>

                {/* Error Banner if any */}
                {errorText && (
                  <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs sm:text-sm">
                    {errorText}
                  </div>
                )}

                {/* Audio Visualizer if playing */}
                {(playingAudioKey || loadingAudioKey) && (
                  <div className={`rounded-2xl overflow-hidden p-2 ${outerCardClass}`}>
                    <ParallaxAudioVisualizer
                      isPlaying={Boolean(playingAudioKey)}
                      activeKey={playingAudioKey || loadingAudioKey}
                      activeAgentName={
                        playingAudioKey === 'full_swarm' || loadingAudioKey === 'full_swarm'
                          ? 'Full Swarm Deliberation'
                          : activeSpeakingAgent?.agentName || 'Swarm Speaker'
                      }
                      activeAgentId={activeSpeakingAgent?.agentId}
                      accentColor={activeSpeakingAgent?.accentColor || '#3b82f6'}
                      voiceName={
                        activeSpeakingAgent
                          ? config.agents[activeSpeakingAgent.agentId]?.voice ||
                            getParallaxAgentVoice(activeSpeakingAgent.agentId)
                          : undefined
                      }
                      progressText={
                        fullSwarmProgress
                          ? `Turn ${fullSwarmProgress.current} / ${fullSwarmProgress.total}`
                          : loadingAudioKey
                          ? 'Synthesizing voice...'
                          : undefined
                      }
                      onStop={stopAllAudio}
                    />
                  </div>
                )}

                {/* 3. AGENT RECRUITMENT CARD (Matches Screenshot 2) */}
                <div
                  id="parallax-agent-recruitment-card"
                  className={`rounded-3xl p-3.5 sm:p-4 ${outerCardClass}`}
                >
                  {/* Header Row: Branch Icon + "Agent recruitment | N agents recruited" + Chevron */}
                  <button
                    type="button"
                    onClick={() => setShowAllRecruitedAgents((prev) => !prev)}
                    className="w-full flex items-center justify-between px-1 pb-3 text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <GitBranch
                        size={16}
                        className={theme === 'classic' ? 'text-cyan-400 shrink-0' : 'text-zinc-400 shrink-0'}
                      />
                      <span className="text-[14px] font-medium text-zinc-100">
                        Agent recruitment
                      </span>
                      <span className="text-zinc-600">|</span>
                      <span className="text-[14px] text-zinc-400">
                        {recruitedAgents.length} agents recruited
                      </span>
                    </div>
                    <ChevronRight
                      size={18}
                      className={`text-zinc-400 transition-transform duration-200 ${
                        showAllRecruitedAgents ? 'rotate-90' : ''
                      }`}
                    />
                  </button>

                  {/* Stack of Individual Agent Sub-Cards */}
                  <div className="space-y-2.5">
                    {visibleRecruitedAgents.map((agent, index) => {
                      const isExpanded = expandedAgentId === agent.id;
                      const agentNumber = String(index + 1).padStart(2, '0');
                      const roundTag = `R${agent.latestRound || currentRound || 1}`;
                      const taskSummary =
                        agent.turns.length > 0
                          ? `${roundTag} ${agent.role}: ${agent.latestText.replace(/[#*_`]/g, '').slice(0, 48)}...`
                          : `${roundTag} ${agent.role} Research...`;

                      const filledDots =
                        agent.turns.length >= 3 || summary
                          ? 20
                          : agent.turns.length === 2
                          ? 15
                          : agent.turns.length === 1
                          ? 10
                          : isRunning
                          ? 6
                          : 18;

                      return (
                        <div
                          key={agent.id}
                          className={`rounded-2xl transition-colors overflow-hidden ${innerSubCardClass}`}
                        >
                          <div
                            onClick={() =>
                              setExpandedAgentId(isExpanded ? null : agent.id)
                            }
                            className="px-4 py-3.5 cursor-pointer"
                          >
                            {/* Row 1: Sketch Portrait Icon + Agent Name + 01 Index */}
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-600 flex items-center justify-center shrink-0 shadow-2xs">
                                  <svg
                                    viewBox="0 0 24 24"
                                    className="w-4 h-4 text-zinc-200"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                  >
                                    <circle cx="12" cy="8" r="4" />
                                    <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
                                  </svg>
                                </div>
                                <span className="text-[15px] font-medium text-zinc-100 truncate">
                                  {agent.name}
                                </span>
                              </div>

                              <span className="text-xs font-mono font-semibold text-zinc-400 tabular-nums">
                                {agentNumber}
                              </span>
                            </div>

                            {/* Row 2: L-Connector Curve + R1 Task Description + 2x10 Green Dot Matrix */}
                            <div className="flex items-center justify-between gap-3 pl-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <svg
                                  viewBox="0 0 16 16"
                                  className="w-3.5 h-3.5 text-zinc-500 shrink-0"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                >
                                  <path d="M3 2v7a4 4 0 004 4h6" strokeLinecap="round" />
                                </svg>
                                <span className="text-[13.5px] text-zinc-300 truncate">
                                  {taskSummary}
                                </span>
                              </div>

                              {/* 2x10 Green Dot Matrix Progress Indicator */}
                              <div
                                className="grid grid-cols-10 gap-[2.5px] shrink-0 py-1"
                                title={`Conviction & Progress: ${agent.conviction}%`}
                              >
                                {Array.from({ length: 20 }).map((_, dotIdx) => (
                                  <span
                                    key={dotIdx}
                                    className={`w-[3.5px] h-[3.5px] rounded-full transition-colors ${
                                      dotIdx < filledDots
                                        ? 'bg-emerald-400'
                                        : 'bg-zinc-700'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Expanded Agent Deliberation Turns (R1, R2, R3 + Voice Play) */}
                          {isExpanded && (
                            <div className="px-4 pb-3.5 pt-2 border-t border-white/[0.08] bg-black/30 space-y-2.5 text-xs">
                              {agent.turns.length === 0 ? (
                                <div className="text-zinc-400 py-2">
                                  Agent recruited and synthesizing domain telemetry...
                                </div>
                              ) : (
                                agent.turns.map((turn) => (
                                  <div
                                    key={turn.id}
                                    className="p-3 rounded-xl bg-white/[0.04] space-y-1.5"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-zinc-200">
                                        Round 0{turn.round} · {turn.role || agent.role}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        {typeof turn.convictionScore === 'number' && (
                                          <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                                            {turn.convictionScore}% conviction
                                          </span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handlePlayMessageAudio(turn);
                                          }}
                                          className="px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-zinc-200 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                                        >
                                          <Play size={10} />
                                          {playingAudioKey === turn.id ? 'Stop' : 'Listen'}
                                        </button>
                                      </div>
                                    </div>
                                    <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap text-[13px]">
                                      {turn.text}
                                    </p>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {recruitedAgents.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setShowAllRecruitedAgents((prev) => !prev)}
                      className="mt-2.5 w-full py-2 text-xs font-medium text-zinc-400 hover:text-zinc-100 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>
                        {showAllRecruitedAgents
                          ? 'Show fewer agents'
                          : `View all ${recruitedAgents.length} recruited agents`}
                      </span>
                      <ChevronDown
                        size={14}
                        className={`transition-transform ${
                          showAllRecruitedAgents ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  )}
                </div>

                {/* 4. "ALL THREE DELIVERABLES" OVERLAPPING REPORT DECK (Matches Screenshot 2) */}
                <div className="pt-2 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h2 className="text-[16px] font-semibold text-zinc-100 tracking-tight">
                      All Three Deliverables
                    </h2>

                    <div className="flex items-center gap-1.5">
                      {messages.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={handleCopyFullSwarm}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1 cursor-pointer ${floatingPillClass} ${floatingPillHoverClass}`}
                          >
                            {copiedSwarmTranscript ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            <span>{copiedSwarmTranscript ? 'Copied' : 'Copy Report'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleDownloadSwarmMp3}
                            disabled={isDownloadingSwarmMp3}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50 ${floatingPillClass} ${floatingPillHoverClass}`}
                          >
                            <Download size={12} />
                            <span>{isDownloadingSwarmMp3 ? 'Compiling MP3...' : 'Podcast MP3'}</span>
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowDetailedTranscript((prev) => !prev)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                          theme === 'classic'
                            ? 'bg-cyan-500 text-slate-950'
                            : 'bg-zinc-100 text-zinc-900'
                        }`}
                      >
                        <FileText size={12} />
                        <span>{showDetailedTranscript ? 'Hide Full Stream' : 'Full Stream'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Overlapping Executive Visual Cards Container (Screenshot 2 Layout) */}
                  <div className="relative pt-2 pb-4">
                    {/* TOP / RIGHT FLOATING CARD: Section 1 Line Chart & Scenario Breakdown */}
                    <div
                      onClick={() =>
                        setActiveDeliverableModal(
                          activeDeliverableModal === 'chart' ? null : 'chart',
                        )
                      }
                      className="relative z-20 ml-auto w-[92%] sm:w-[88%] rounded-xl bg-white text-slate-900 border border-slate-200/90 shadow-[0_12px_32px_rgba(0,0,0,0.28)] p-3.5 sm:p-4 cursor-pointer hover:shadow-[0_16px_40px_rgba(0,0,0,0.36)] transition-shadow"
                    >
                      <div className="text-[8.5px] font-mono uppercase tracking-widest text-slate-400 mb-0.5">
                        — SECTION 1 · DEMAND &amp; CONVICTION TRAJECTORY
                      </div>
                      <div className="text-[11px] sm:text-xs font-bold text-slate-900 mb-2 truncate">
                        {currentTopic} — Multi-Round Swarm Consensus &amp; Trajectory
                      </div>

                      <div className="grid grid-cols-12 gap-3 items-start">
                        {/* SVG Blue Line Chart with Peak Callout */}
                        <div className="col-span-8">
                          <div className="text-[8px] text-slate-500 font-medium mb-1">
                            Exhibit 1.1 — Swarm conviction index across active specialist nodes (R1–R3):
                          </div>
                          <svg viewBox="0 0 280 115" className="w-full h-auto overflow-visible">
                            <line x1="15" y1="20" x2="270" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                            <line x1="15" y1="50" x2="270" y2="50" stroke="#f1f5f9" strokeWidth="1" />
                            <line x1="15" y1="80" x2="270" y2="80" stroke="#f1f5f9" strokeWidth="1" />
                            <line x1="15" y1="98" x2="270" y2="98" stroke="#cbd5e1" strokeWidth="1" />

                            <text x="88" y="12" fontSize="6" fill="#334155" fontWeight="600">
                              Peak Consensus Spike = {Math.max(...chartPoints.map((p) => p.val))}%
                            </text>
                            <text x="190" y="34" fontSize="5.5" fill="#dc2626">
                              R2 Cross-Exam Stress Test
                            </text>

                            <polyline
                              fill="none"
                              stroke="#2563eb"
                              strokeWidth="1.6"
                              points={chartPoints
                                .map((pt, i) => {
                                  const x = 22 + i * 26;
                                  const y = 96 - (pt.val / 100) * 76;
                                  return `${x},${y}`;
                                })
                                .join(' ')}
                            />

                            {chartPoints.map((pt, i) => {
                              const x = 22 + i * 26;
                              const y = 96 - (pt.val / 100) * 76;
                              return (
                                <g key={i}>
                                  <circle
                                    cx={x}
                                    cy={y}
                                    r="2.4"
                                    fill="#ffffff"
                                    stroke="#2563eb"
                                    strokeWidth="1.5"
                                  />
                                  <text
                                    x={x}
                                    y="108"
                                    fontSize="5.5"
                                    fill="#64748b"
                                    textAnchor="middle"
                                  >
                                    {pt.label}
                                  </text>
                                </g>
                              );
                            })}
                          </svg>
                          <div className="flex items-center justify-center gap-1 mt-0.5 text-[7.5px] text-blue-600 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full border border-blue-600 inline-block" />
                            <span>Swarm Conviction Index (%)</span>
                          </div>
                        </div>

                        {/* Right Mini Scenario Box inside Chart Card */}
                        <div className="col-span-4 bg-slate-50 rounded-lg p-2 border border-slate-200/70 text-[7.5px]">
                          <div className="font-bold text-slate-800 mb-1">
                            2026 Scenario — Swarm Consensus
                          </div>
                          <div className="bg-[#0A2540] text-white px-1.5 py-0.5 font-semibold flex justify-between rounded-t-xs">
                            <span>Round</span>
                            <span>Index</span>
                          </div>
                          <div className="divide-y divide-slate-200/70 font-mono">
                            <div className="py-0.5 px-1 flex justify-between">
                              <span className="text-slate-600">R0 Brief</span>
                              <span className="text-slate-900 font-semibold">100%</span>
                            </div>
                            <div className="py-0.5 px-1 flex justify-between">
                              <span className="text-slate-600">R1 Thesis</span>
                              <span className="text-slate-900 font-semibold">74%</span>
                            </div>
                            <div className="py-0.5 px-1 flex justify-between">
                              <span className="text-slate-600">R2 Rebuttal</span>
                              <span className="text-slate-900 font-semibold">68%</span>
                            </div>
                            <div className="py-0.5 px-1 flex justify-between text-blue-600 font-bold">
                              <span>R3 Verdict</span>
                              <span>{summary?.confidenceScore || 86}%</span>
                            </div>
                          </div>
                          <p className="mt-1.5 text-[7px] text-slate-500 leading-tight">
                            {summary?.consensusLean
                              ? `Consensus Lean: ${summary.consensusLean}`
                              : 'Multi-agent verification across 20 specialized personas.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* BOTTOM / FULL-WIDTH SPREADSHEET DELIVERABLE CARD (Matches Navy Table in Screenshot 2) */}
                    <div
                      onClick={() =>
                        setActiveDeliverableModal(
                          activeDeliverableModal === 'table' ? null : 'table',
                        )
                      }
                      className="relative z-10 -mt-6 rounded-xl bg-white text-slate-900 border border-slate-200/90 shadow-[0_8px_28px_rgba(0,0,0,0.22)] p-3.5 sm:p-4 cursor-pointer hover:shadow-[0_12px_36px_rgba(0,0,0,0.3)] transition-shadow overflow-x-auto"
                    >
                      <div className="text-[10px] font-bold text-slate-900 uppercase tracking-tight">
                        SUPPLY &amp; DEMAND — Capacity, Conviction &amp; Multi-Agent Roll-Forward
                      </div>
                      <div className="text-[8px] text-slate-400 mb-2">
                         Quantitative synthesis matrix across R1 Thesis, R2 Cross-Examination, and R3 Final Convergence
                      </div>

                      {/* Section 0 Header */}
                      <div className="text-[8px] font-bold text-slate-800 uppercase border-b border-slate-300 pb-0.5 mb-1">
                        0. SCENARIO EXIT PARAMETERS
                      </div>
                      <div className="flex items-center gap-6 text-[8px] font-mono mb-2.5">
                        <span className="text-slate-600">
                          Active swarm participation rate:{' '}
                          <strong className="text-blue-600">100% ({enabledAgentsCount} agents)</strong>
                        </span>
                        <span className="text-slate-600">
                          Convergence weight:{' '}
                          <strong className="text-blue-600">
                            {summary?.confidenceScore || 84}%
                          </strong>
                        </span>
                      </div>

                      {/* Section 1 Navy Table Header */}
                      <div className="bg-[#0A2540] text-white text-[8px] font-bold px-2 py-1 flex items-center justify-between">
                        <span>1. AGENT CONSENSUS ROLL-FORWARD (R1 → R2 → R3 CONVICTION)</span>
                        <span>PROTOCOL: {debateMode.toUpperCase()}</span>
                      </div>

                      <table className="w-full text-left border-collapse font-mono text-[8px] sm:text-[9px] tabular-nums">
                        <thead>
                          <tr className="border-b border-slate-300 text-slate-600 font-bold">
                            <th className="py-1 px-1.5">Specialist / Persona</th>
                            <th className="py-1 px-1">Unit</th>
                            <th className="py-1 px-1 text-right">R1 Base</th>
                            <th className="py-1 px-1 text-right">R2 Exam</th>
                            <th className="py-1 px-1 text-right">R3 Final</th>
                            <th className="py-1 px-1 text-right">Target</th>
                            <th className="py-1 px-1.5">Core Finding &amp; Synthesis Note</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {recruitedAgents.slice(0, 8).map((ag, idx) => {
                            const r1 = ag.turns.find((t) => t.round === 1)?.convictionScore ?? 65 + idx * 2;
                            const r2 = ag.turns.find((t) => t.round === 2)?.convictionScore ?? r1 - 4;
                            const r3 = ag.conviction || r1 + 8;
                            const snippet = ag.turns[0]?.text
                              ? ag.turns[0].text.replace(/[#*_`]/g, '').slice(0, 55) + '...'
                              : `${ag.role} baseline validated`;
                            return (
                              <tr key={ag.id} className="hover:bg-slate-50">
                                <td className="py-1 px-1.5 font-sans font-semibold text-slate-800 truncate max-w-[120px]">
                                  {ag.name} — {ag.role.slice(0, 16)}
                                </td>
                                <td className="py-1 px-1 text-slate-500">CONV%</td>
                                <td className="py-1 px-1 text-right text-blue-600 font-semibold">
                                  {r1}%
                                </td>
                                <td className="py-1 px-1 text-right text-blue-600">
                                  {r2}%
                                </td>
                                <td className="py-1 px-1 text-right text-slate-900 font-bold">
                                  {r3}%
                                </td>
                                <td className="py-1 px-1 text-right text-slate-700">
                                  {Math.min(99, r3 + 5)}%
                                </td>
                                <td className="py-1 px-1.5 font-sans text-slate-500 truncate max-w-[180px]">
                                  {snippet}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {/* Section 2 Navy Table Header */}
                      <div className="bg-[#0A2540] text-white text-[8px] font-bold px-2 py-1 mt-2.5 flex items-center justify-between">
                        <span>2. EFFECTIVE EXECUTIVE SYNTHESIS VS ACTIVE RISK DEMAND</span>
                        <span>STATUS: {summary ? 'VERIFIED' : isRunning ? 'LIVE STREAMING' : 'READY'}</span>
                      </div>
                      <div className="p-2 bg-slate-50/70 text-[10px] sm:text-[11px] font-sans text-slate-700 leading-relaxed space-y-1">
                        {summary ? (
                          <>
                            <div>
                              <strong className="text-slate-900">Executive Verdict:</strong>{' '}
                              {summary.verdict}
                            </div>
                            {summary.recommendedPathForward && (
                              <div>
                                <strong className="text-blue-700">Recommended Action:</strong>{' '}
                                {summary.recommendedPathForward}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-slate-500">
                            {statusText} — {messages.length} specialist turns recorded so far. Click to expand full executive report.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expandable Full Synthesis Report & Full Deliberation Stream */}
                  {(activeDeliverableModal || showDetailedTranscript) && (
                    <div className="space-y-6 pt-2">
                      {intelligenceBriefing && (
                        <div className={`rounded-3xl p-4 sm:p-5 ${outerCardClass}`}>
                          <ParallaxIntelligenceBriefing
                            briefing={intelligenceBriefing}
                            defaultExpanded={true}
                          />
                        </div>
                      )}

                      {summary && (
                        <div className={`rounded-3xl p-4 sm:p-6 ${outerCardClass}`}>
                          <ParallaxSynthesisReport
                            summary={summary}
                            topic={currentTopic}
                            allMessages={messages}
                            onNewTopic={handleResetToNewSwarm}
                            onRerun={() => handleStartSwarm(currentTopic)}
                            onExportMp3={handleDownloadSwarmMp3}
                            onSave={() => {
                              setSessions(storage.getParallaxSessions());
                            }}
                          />
                        </div>
                      )}

                      {showDetailedTranscript && (
                        <div className={`rounded-3xl p-4 sm:p-6 ${outerCardClass}`}>
                          <ParallaxDeliberationStream
                            messages={messages}
                            agents={config.agents}
                            isRunning={isRunning}
                            currentRound={currentRound}
                            wasStoppedEarly={wasStoppedEarly}
                            specialistDeliberation={specialistDeliberation}
                            roundFilter={roundFilter}
                            groupFilter={groupFilter}
                            selectedAgentFilter={selectedAgentFilter}
                            expandedRounds={expandedRounds}
                            playingAudioKey={playingAudioKey}
                            loadingAudioKey={loadingAudioKey}
                            fullSwarmProgress={fullSwarmProgress}
                            copiedSwarmTranscript={copiedSwarmTranscript}
                            isDownloadingSwarmMp3={isDownloadingSwarmMp3}
                            rawJsonOpenMap={rawJsonOpenMap}
                            copiedRawJsonId={copiedRawJsonId}
                            onSetRoundFilter={(r) => setRoundFilter(r)}
                            onSetGroupFilter={(g) => setGroupFilter(g)}
                            onSetSelectedAgentFilter={(id) => setSelectedAgentFilter(id)}
                            onToggleRoundExpand={toggleRoundExpand}
                            onPlayMessageAudio={handlePlayMessageAudio}
                            onListenToFullSwarm={handleListenToFullSwarm}
                            onDownloadSwarmMp3={handleDownloadSwarmMp3}
                            onCopyFullSwarm={handleCopyFullSwarm}
                            onStopSwarm={handleStopSwarm}
                            onToggleRawJsonView={toggleRawJsonView}
                            onCopyRawJson={handleCopyRawJson}
                            feedEndRef={feedEndRef}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stopped Early Banner */}
                  {wasStoppedEarly && !summary && (
                    <div
                      id="parallax-stopped-early-card"
                      className="rounded-2xl bg-rose-950/50 border border-rose-500/30 p-4 flex items-center justify-between flex-wrap gap-3"
                    >
                      <div className="text-xs text-rose-200">
                        <strong>Swarm stopped early</strong> · {messages.length} turns recorded.
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          id="parallax-rerun-stopped-swarm-btn"
                          type="button"
                          onClick={() => handleStartSwarm(currentTopic)}
                          className="px-3 py-1.5 rounded-full bg-zinc-100 text-zinc-900 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw size={12} />
                          <span>Rerun</span>
                        </button>
                        <button
                          id="parallax-clear-stopped-swarm-btn"
                          type="button"
                          onClick={handleResetToNewSwarm}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${circleBtnClass}`}
                        >
                          New Task
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==========================================================
               BOTTOM AREA: SHOWCASE PRESET CARDS + FLOATING SWARM COMPOSER
               ========================================================== */}
            <div id="parallax-input-container" className="sticky bottom-3 z-30 pt-2">
              {/* Showcase Preset Cards Carousel (Visible when Idle, just like Screenshot 1) */}
              {!hasActiveMission && (
                <div className="flex items-center gap-2.5 overflow-x-auto pb-3 no-scrollbar">
                  {SHOWCASE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={isRunning}
                      onClick={() => {
                        setTopicInput(preset.prompt);
                        handleStartSwarm(preset.prompt);
                      }}
                      className={`flex items-center gap-3 p-2 pr-3.5 rounded-2xl transition-all shrink-0 w-[186px] text-left cursor-pointer active:scale-[0.98] ${
                        theme === 'classic'
                          ? 'bg-slate-900/70 hover:bg-slate-800/85 backdrop-blur-xl border border-cyan-500/25 shadow-[0_4px_20px_rgba(6,182,212,0.1)]'
                          : theme === 'fulldark'
                          ? 'bg-[#171717] hover:bg-[#222222] border border-[#2a2a2a]'
                          : 'bg-[#1c1c1f] hover:bg-[#252529] border border-zinc-800/80'
                      }`}
                    >
                      {renderShowcaseThumbnail(preset.thumbType)}
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-medium text-zinc-100 leading-tight truncate">
                          {preset.titleLine1}
                        </div>
                        <div
                          className={`text-[13.5px] font-medium leading-tight truncate mt-0.5 ${
                            theme === 'classic' ? 'text-cyan-200/70' : 'text-zinc-400'
                          }`}
                        >
                          {preset.titleLine2}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Quick Plus Menu Popover (Debate Modes, Sample Topics, Human Injection) */}
              {isPlusMenuOpen && (
                <div className={`mb-2.5 p-3.5 rounded-3xl space-y-3 animate-fadeIn ${composerCardClass}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-100">
                      Swarm Protocol &amp; Quick Tasks
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsPlusMenuOpen(false)}
                      className="text-zinc-400 hover:text-zinc-100 cursor-pointer"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {/* Protocol Pills */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {DEBATE_MODES.map((m) => {
                      const Icon = m.icon;
                      const active = debateMode === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setDebateMode(m.id);
                            setShowSwarmPill(true);
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                            active
                              ? theme === 'classic'
                                ? 'bg-cyan-500 text-slate-950 font-semibold'
                                : 'bg-zinc-100 text-zinc-900 font-semibold'
                              : circleBtnClass
                          }`}
                        >
                          <Icon size={13} />
                          <span>{m.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick Sample Prompts */}
                  <div className="space-y-1 pt-1 border-t border-white/[0.08]">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      One-Click Intelligence Tasks
                    </div>
                    {SAMPLE_TOPICS.map((t, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setTopicInput(t);
                          handleStartSwarm(t);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-white/[0.06] text-xs text-zinc-200 truncate flex items-center gap-2 cursor-pointer"
                      >
                        <Globe size={12} className="text-cyan-400 shrink-0" />
                        <span className="truncate">{t}</span>
                      </button>
                    ))}
                  </div>

                  {isRunning && (
                    <div className="pt-2 border-t border-white/[0.08]">
                      <button
                        type="button"
                        onClick={() => {
                          setIsPlusMenuOpen(false);
                          setIsHumanModalOpen(true);
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <UserPlus size={14} />
                        <span>Inject Human Operator Directive (Round 0{currentRound || 1})</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* FLOATING COMPOSER CARD (Matches Screenshot 1 & Screenshot 2, themed) */}
              <div className={`rounded-[28px] p-3 transition-all ${composerCardClass}`}>
                {/* Top Swarm Mode Pill Bar (Visible when Idle, matching Screenshot 1) */}
                {(!hasActiveMission || showSwarmPill) && !hasActiveMission && (
                  <div className={`flex items-center justify-between px-3.5 py-2 rounded-2xl mb-2.5 ${composerPillClass}`}>
                    <button
                      type="button"
                      onClick={() => setIsPlusMenuOpen((prev) => !prev)}
                      className="flex items-center gap-2 text-[14px] font-medium cursor-pointer"
                    >
                      <span className="w-5 h-5 rounded-md border border-current/40 flex items-center justify-center text-[10px] font-mono">
                        ••
                      </span>
                      <span>
                        {debateMode === 'default' ? 'Swarm' : `Swarm · ${currentModeObj.shortLabel}`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSwarmPill(false)}
                      className="opacity-60 hover:opacity-100 cursor-pointer p-0.5"
                      aria-label="Dismiss swarm mode banner"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                {/* Input Row (Matches Screenshot 1 when idle, Screenshot 2 compact pill when active) */}
                {!hasActiveMission ? (
                  <>
                    <div className="px-1.5 py-1.5">
                      <input
                        id="parallax-topic-input"
                        type="text"
                        value={topicInput}
                        onChange={(e) => setTopicInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !isRunning) {
                            e.preventDefault();
                            handleStartSwarm();
                          }
                        }}
                        disabled={isRunning}
                        placeholder="Assign a task to your AI team..."
                        className="w-full bg-transparent text-[16px] text-zinc-100 placeholder-zinc-400 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => setIsPlusMenuOpen((prev) => !prev)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${circleBtnClass}`}
                        title="Swarm Protocols & Presets"
                      >
                        <Plus size={20} strokeWidth={2} />
                      </button>

                      {isRunning ? (
                        <button
                          id="parallax-stop-swarm-btn"
                          type="button"
                          onClick={handleStopSwarm}
                          className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-sm cursor-pointer"
                          title="Stop Swarm"
                        >
                          <Square size={14} fill="currentColor" />
                        </button>
                      ) : (
                        <button
                          id="parallax-start-swarm-btn"
                          type="button"
                          onClick={() =>
                            handleStartSwarm(
                              topicInput.trim() ||
                                'Create a comprehensive global solar competitor report.',
                            )
                          }
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                            topicInput.trim()
                              ? theme === 'classic'
                                ? 'bg-cyan-400 text-slate-950 shadow-sm'
                                : 'bg-zinc-100 text-zinc-900 shadow-sm'
                              : circleBtnClass
                          }`}
                          title="Launch Agent Swarm"
                        >
                          <AudioLines size={18} strokeWidth={2.2} />
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  /* Screenshot 2 Compact Single-Row Input Bar ("+  Ask me. Task me.  •))") */
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsPlusMenuOpen((prev) => !prev)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${circleBtnClass}`}
                      title="Swarm Tools & Human Directive Injection"
                    >
                      <Plus size={20} strokeWidth={2} />
                    </button>

                    <input
                      id="parallax-topic-input"
                      type="text"
                      value={topicInput}
                      onChange={(e) => setTopicInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isRunning && topicInput.trim()) {
                          e.preventDefault();
                          handleStartSwarm();
                        }
                      }}
                      disabled={isRunning}
                      placeholder={isRunning ? statusText : 'Ask me. Task me.'}
                      className="flex-1 bg-transparent text-[15.5px] text-zinc-100 placeholder-zinc-400 focus:outline-none min-w-0"
                    />

                    {isRunning ? (
                      <button
                        id="parallax-stop-swarm-btn"
                        type="button"
                        onClick={handleStopSwarm}
                        className="w-10 h-10 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm cursor-pointer"
                        title="Stop Swarm"
                      >
                        <Square size={14} fill="currentColor" />
                      </button>
                    ) : (
                      <button
                        id="parallax-start-swarm-btn"
                        type="button"
                        onClick={() => {
                          if (topicInput.trim()) {
                            handleStartSwarm();
                          } else {
                            handleListenToFullSwarm();
                          }
                        }}
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                          topicInput.trim()
                            ? theme === 'classic'
                              ? 'bg-cyan-400 text-slate-950'
                              : 'bg-zinc-100 text-zinc-900'
                            : circleBtnClass
                        }`}
                        title={topicInput.trim() ? 'Run New Swarm Task' : 'Play Voice Briefing'}
                      >
                        <AudioLines size={18} strokeWidth={2.2} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Floating Human Operator Injection Button when running */}
        {isRunning && (
          <button
            id="parallax-floating-inject-btn"
            type="button"
            onClick={() => setIsHumanModalOpen(true)}
            className="fixed bottom-24 right-5 z-40 px-3.5 py-2 rounded-full bg-cyan-500 text-slate-950 font-semibold text-xs shadow-lg flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="Inject a direct operator assertion or counter-argument into live deliberation"
          >
            <UserPlus size={14} />
            <span>Inject Directive</span>
          </button>
        )}

        {/* Human Operator Directive Injection Modal */}
        <ParallaxHumanInjectionModal
          isOpen={isHumanModalOpen}
          onClose={() => setIsHumanModalOpen(false)}
          onSubmit={handleHumanInjection}
          currentRound={currentRound || 1}
        />
      </div>
    </div>
  );
};
