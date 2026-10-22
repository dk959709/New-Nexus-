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
  Paperclip,
  Zap,
  Sparkles,
  Activity,
  ArrowUpDown,
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
  'Global favorable vs unfavorable ratings and geopolitical sentiment analysis 2026.',
  'Create a comprehensive global solar competitor report.',
  'Will humanoid robots replace household chores by 2035?',
  'Can universal basic income coexist with inflation?',
  'Is open-source AI safer than centralized proprietary models?',
  'Should humanity build permanent cities on Mars before fixing Earth?',
];

interface ShowcasePreset {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  metric: string;
  prompt: string;
  accent: string;
}

const SHOWCASE_PRESETS: ShowcasePreset[] = [
  {
    id: 'geopolitics',
    badge: 'GLOBAL SURVEY',
    title: 'Global Sentiment & Favorability',
    subtitle: '25-nation comparative attitude index',
    metric: '88% conv',
    prompt: 'Global favorable vs unfavorable ratings and geopolitical sentiment analysis 2026.',
    accent: '#10b981',
  },
  {
    id: 'solar',
    badge: 'MARKET INTEL',
    title: 'Global Solar Competitor Report',
    subtitle: 'Supply, demand & margin roll-forward',
    metric: '92% conv',
    prompt: 'Create a comprehensive global solar competitor report.',
    accent: '#06b6d4',
  },
  {
    id: 'blackhole',
    badge: 'ASTROPHYSICS',
    title: 'Blackhole: Gargantua Lensing',
    subtitle: 'Relativistic accretion & photon rings',
    metric: '95% conv',
    prompt: 'Analyze relativistic physics, accretion photon rings, and gravitational lensing around supermassive black hole Gargantua.',
    accent: '#f59e0b',
  },
  {
    id: 'humanoid',
    badge: 'ROBOTICS 2035',
    title: 'Humanoid Domestic Automation',
    subtitle: 'Unit economics & household adoption',
    metric: '81% conv',
    prompt: 'Will humanoid robots replace household chores by 2035?',
    accent: '#8b5cf6',
  },
  {
    id: 'mars',
    badge: 'DEEP SPACE',
    title: 'Mars Colony vs Earth Biospheres',
    subtitle: 'Civilizational risk & resource allocation',
    metric: '76% conv',
    prompt: 'Should humanity build permanent cities on Mars before fixing Earth?',
    accent: '#f43f5e',
  },
];

const DEBATE_MODES: Array<{
  id: ParallaxDebateMode;
  label: string;
  shortLabel: string;
  speedTag: string;
  icon: React.FC<{ className?: string; size?: number }>;
}> = [
  { id: 'default', label: 'Default Swarm', shortLabel: 'Fast', speedTag: '20 Agents · 3 Rounds', icon: Zap },
  { id: 'courtroom', label: 'Courtroom Trial', shortLabel: 'Courtroom', speedTag: 'Prosecution vs Defense', icon: Scale },
  { id: 'red_vs_blue', label: 'Red vs Blue Team', shortLabel: 'Red vs Blue', speedTag: 'Adversarial Stress-Test', icon: Shield },
  { id: 'senate', label: 'Senate Summit', shortLabel: 'Senate', speedTag: 'Policy & Governance', icon: Landmark },
  { id: 'vc_pitch', label: 'Venture Pitch Committee', shortLabel: 'VC Pitch', speedTag: 'Capital & ROI Diligence', icon: Briefcase },
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
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isModeSelectorOpen, setIsModeSelectorOpen] = useState(false);
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [showAllRecruitedAgents, setShowAllRecruitedAgents] = useState(false);
  const [showAllTableRows, setShowAllTableRows] = useState(false);
  const [tableSortBy, setTableSortBy] = useState<'conviction' | 'order'>('conviction');
  const [showDetailedTranscript, setShowDetailedTranscript] = useState(false);
  const [showTrajectoryChart, setShowTrajectoryChart] = useState(true);

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
    setIsModeSelectorOpen(false);
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

    if (byId.size < 10) {
      enabledAgentsList.forEach((agent, idx) => {
        if (byId.size >= 12) return;
        if (!byId.has(agent.id)) {
          byId.set(agent.id, {
            id: agent.id,
            name: agent.name.split(' (')[0],
            role: agent.role || 'Domain Specialist',
            accentColor: agent.accentColor || '#10b981',
            latestRound: currentRound || 1,
            latestText: `${agent.role} baseline & cross-examination telemetry`,
            conviction: isRunning ? Math.max(34, 88 - idx * 4) : Math.max(30, 91 - idx * 4),
            turns: [],
          });
        }
      });
    }

    return Array.from(byId.values());
  }, [messages, enabledAgentsList, config.agents, currentRound, isRunning]);

  const sortedTableAgents = React.useMemo(() => {
    const copy = [...recruitedAgents];
    if (tableSortBy === 'conviction') {
      copy.sort((a, b) => b.conviction - a.conviction);
    }
    return copy;
  }, [recruitedAgents, tableSortBy]);

  const visibleTableAgents = showAllTableRows ? sortedTableAgents : sortedTableAgents.slice(0, 8);
  const visibleRecruitedAgents = showAllRecruitedAgents ? recruitedAgents : recruitedAgents.slice(0, 4);

  const chartPoints = React.useMemo(() => {
    if (recruitedAgents.length === 0) {
      return [
        { label: 'VERITAS', val: 88 },
        { label: 'AXIOM', val: 84 },
        { label: 'LEDGER', val: 79 },
        { label: 'CIPHER', val: 76 },
        { label: 'ORACLE', val: 72 },
        { label: 'CHRONOS', val: 68 },
        { label: 'SENTINEL', val: 64 },
        { label: 'AURORA', val: 59 },
        { label: 'GRAVITY', val: 52 },
        { label: 'VANGUARD', val: 44 },
      ];
    }
    return sortedTableAgents.slice(0, 10).map((ag, idx) => {
      const r1 = ag.turns.find((t) => t.round === 1)?.convictionScore ?? 58 + ((idx * 7) % 25);
      const r3 = ag.turns[ag.turns.length - 1]?.convictionScore ?? ag.conviction ?? r1 + 12;
      return {
        label: ag.name.slice(0, 7),
        val: Math.max(18, Math.min(98, r3)),
        accent: ag.accentColor,
      };
    });
  }, [recruitedAgents, sortedTableAgents]);

  // Synthesize editorial "Notes:" bullet points (matching Screenshot's exact "Notes:" + bullet list + "Source:" structure)
  const editorialNotes = React.useMemo(() => {
    const bullets: string[] = [];

    if (summary) {
      if (summary.verdict) {
        bullets.push(summary.verdict);
      }
      if (summary.agreements && summary.agreements.length > 0) {
        bullets.push(
          `Core consensus across participating personas: ${summary.agreements.slice(0, 2).join(' ')}`,
        );
      }
      if (summary.disagreements && summary.disagreements.length > 0) {
        bullets.push(
          `Key divergence & cross-examination pushback (especially from contrarian & risk nodes): ${summary.disagreements
            .slice(0, 2)
            .join(' ')}`,
        );
      }
      if (summary.recommendedPathForward) {
        bullets.push(`Strategic recommendation: ${summary.recommendedPathForward}`);
      }
    }

    if (bullets.length < 4 && messages.length > 0) {
      const veritasTurn = messages.find((m) => m.agentId === 'veritas');
      const highTurn = [...messages].sort((a, b) => (b.convictionScore || 75) - (a.convictionScore || 75))[0];
      const lowTurn = [...messages].sort((a, b) => (a.convictionScore || 75) - (b.convictionScore || 75))[0];

      if (veritasTurn && bullets.length < 4) {
        bullets.push(
          `Empirical baseline from ${veritasTurn.agentName}: ${veritasTurn.text
            .replace(/[#*_`]/g, '')
            .slice(0, 185)
            .trim()}...`,
        );
      }
      if (highTurn && bullets.length < 4) {
        bullets.push(
          `Highest conviction ratings remain concentrated in ${highTurn.agentName} (${
            highTurn.convictionScore || 88
          }%), emphasizing ${highTurn.role?.toLowerCase() || 'primary domain thesis'}.`,
        );
      }
      if (lowTurn && lowTurn.id !== highTurn?.id && bullets.length < 4) {
        bullets.push(
          `Lowest / most skeptical ratings in the full swarm include ${lowTurn.agentName} (${
            lowTurn.convictionScore || 34
          }%), highlighting tail risks and structural friction.`,
        );
      }
    }

    if (bullets.length === 0) {
      bullets.push(
        `Data comes directly from Parallax's 20-persona multi-round deliberation pipeline for the assigned intelligence task.`,
        `Conviction ratings adjust dynamically across Round 1 (Thesis), Round 2 (Cross-Examination), and Round 3 (Final Convergence).`,
        `Highest conviction ratings remain concentrated in empirical & first-principles specialists (VERITAS, AXIOM, LEDGER, and CIPHER).`,
        `Lowest conviction ratings in the full swarm reflect contrarian stress-testing from VANGUARD (31%) and SENTINEL (30%) risk audits.`,
      );
    }

    return bullets.slice(0, 5);
  }, [summary, messages]);

  const currentModeObj = DEBATE_MODES.find((m) => m.id === debateMode) || DEBATE_MODES[0];

  // ============================================================
  // 3-THEME DESIGN TOKENS (Full Dark OLED / Minimal / Classic)
  // ============================================================
  const wrapperThemeClass =
    theme === 'classic'
      ? 'theme-classic bg-[#050a12] text-[#f1f5f9] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0b1f38] via-[#06101e] to-[#03060c]'
      : theme === 'minimal'
      ? 'theme-minimal bg-[#0f0f12] text-[#e7e9ea]'
      : 'theme-fulldark bg-black text-[#e7e9ea]';

  const hairlineTableCardClass =
    theme === 'classic'
      ? 'rounded-2xl border border-cyan-500/25 bg-[#07111f]/90 backdrop-blur-xl divide-y divide-cyan-500/15'
      : theme === 'minimal'
      ? 'rounded-2xl border border-zinc-800/90 bg-[#141417] divide-y divide-zinc-800/80'
      : 'rounded-2xl border border-[#26292e] bg-[#050506] divide-y divide-[#1f2226]';

  const floatingPillClass =
    theme === 'classic'
      ? 'bg-slate-900/80 backdrop-blur-xl border border-cyan-500/30 text-cyan-50 shadow-[0_4px_20px_rgba(6,182,212,0.15)]'
      : theme === 'minimal'
      ? 'bg-[#18181b] border border-zinc-800 text-zinc-100 shadow-[0_2px_12px_rgba(0,0,0,0.45)]'
      : 'bg-[#121316] border border-[#26292e] text-[#e7e9ea] shadow-[0_2px_14px_rgba(0,0,0,0.75)]';

  const floatingPillHoverClass =
    theme === 'classic'
      ? 'hover:bg-slate-800/90'
      : theme === 'minimal'
      ? 'hover:bg-zinc-800'
      : 'hover:bg-[#1c1e22]';

  const composerBoxClass =
    theme === 'classic'
      ? 'bg-[#0b1626]/95 backdrop-blur-2xl border border-cyan-500/30 shadow-[0_10px_40px_rgba(0,0,0,0.65)]'
      : theme === 'minimal'
      ? 'bg-[#1c1c20] border border-zinc-800/90 shadow-[0_10px_36px_rgba(0,0,0,0.65)]'
      : 'bg-[#16181c] border border-[#26292e] shadow-[0_10px_40px_rgba(0,0,0,0.85)]';

  return (
    <div
      id="parallax-page-wrapper"
      data-theme={theme}
      className={`min-h-screen relative -mx-4 sm:-mx-8 md:-mx-12 -my-8 px-3 sm:px-6 py-2.5 overflow-x-hidden font-sans select-none transition-colors duration-200 ${wrapperThemeClass}`}
    >
      <div
        id="parallax-page"
        className="relative z-10 w-full max-w-[680px] mx-auto min-h-[calc(100vh-1.5rem)] flex flex-col justify-between pt-1 pb-3"
      >
        {/* ============================================================
            TOP FLOATING COMMAND BAR (COMPACT MOBILE-FRIENDLY)
           ============================================================ */}
        <header
          id="parallax-command-header"
          className="sticky top-1.5 z-30 flex items-center justify-between gap-2 py-1.5 backdrop-blur-md"
        >
          {/* Left: Hamburger Drawer Button + Brand & Live Status Pill */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsMenuDrawerOpen(true)}
              aria-label="Open Parallax menu"
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center active:scale-95 transition-all cursor-pointer ${floatingPillClass} ${floatingPillHoverClass}`}
            >
              <Menu size={15} strokeWidth={2.2} />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'feed' ? 'settings' : 'feed')}
              className={`h-8 sm:h-9 px-3 sm:px-3.5 rounded-full flex items-center gap-1.5 text-xs sm:text-[13px] transition-all cursor-pointer ${floatingPillClass} ${floatingPillHoverClass}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              <span className="font-semibold tracking-tight text-white">Parallax</span>
              <span className="text-[10px] sm:text-[11px] text-[#71767b] font-mono">
                {isRunning
                  ? `R${currentRound || 1} LIVE`
                  : `${enabledAgentsCount} AGENTS`}
              </span>
            </button>
          </div>

          {/* Right: New Swarm + Settings/Themes + Audio Briefing */}
          <div className={`flex items-center gap-0.5 rounded-full p-0.5 ${floatingPillClass}`}>
            {hasActiveMission && (
              <button
                type="button"
                onClick={handleResetToNewSwarm}
                title="New Swarm Task"
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${floatingPillHoverClass}`}
              >
                <MessageSquarePlus size={14} strokeWidth={2} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'settings' ? 'feed' : 'settings')}
              title="Parallax Settings & 3 Visual Themes"
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-white text-black'
                  : floatingPillHoverClass
              }`}
            >
              <Settings2 size={14} strokeWidth={2} />
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
              title={playingAudioKey ? 'Stop Audio' : 'Listen to Swarm Deliberation'}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                playingAudioKey
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : floatingPillHoverClass
              }`}
            >
              {playingAudioKey ? <Volume2 size={14} strokeWidth={2} /> : <VolumeX size={14} strokeWidth={2} />}
            </button>
          </div>
        </header>

        {/* Sub-Navigation Bar when viewing Settings or Archive */}
        {activeTab !== 'feed' && (
          <div
            id="parallax-tabs-nav"
            className={`flex items-center justify-between gap-1.5 p-1.5 my-2 ${hairlineTableCardClass}`}
          >
            <div className="flex items-center gap-1 flex-wrap">
              <button
                id="parallax-tab-feed"
                type="button"
                onClick={() => setActiveTab('feed')}
                className="px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1 bg-white/10 text-white hover:bg-white/15 cursor-pointer transition-colors"
              >
                <MessageSquare size={12} />
                <span>← Swarm</span>
              </button>
              <button
                id="parallax-tab-settings"
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-white text-black'
                    : 'text-[#71767b] hover:text-white'
                }`}
              >
                <Settings2 size={12} />
                <span>Settings &amp; Themes ({enabledAgentsCount})</span>
              </button>
              <button
                id="parallax-tab-archive"
                type="button"
                onClick={() => setActiveTab('archive')}
                className={`px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                  activeTab === 'archive'
                    ? 'bg-white text-black'
                    : 'text-[#71767b] hover:text-white'
                }`}
              >
                <Archive size={12} />
                <span>Saved ({sessions.length})</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================
            SIDE DRAWER MENU (Hamburger Menu: History, Agents, Modes, 3 Themes)
           ============================================================ */}
        {isMenuDrawerOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex"
            onClick={() => setIsMenuDrawerOpen(false)}
          >
            <div
              className={`w-[270px] sm:w-[300px] max-w-[82vw] h-full shadow-2xl p-3.5 sm:p-4 flex flex-col justify-between overflow-y-auto border-r ${
                theme === 'classic'
                  ? 'bg-[#060e1a] border-cyan-500/25 text-slate-100'
                  : theme === 'minimal'
                  ? 'bg-[#141417] border-zinc-800 text-zinc-100'
                  : 'bg-[#08080a] border-[#26292e] text-[#e7e9ea]'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-4">
                {/* Drawer Header */}
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center font-bold text-xs shadow-sm">
                      P
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Parallax Swarm</div>
                      <div className="text-[10px] text-[#71767b]">{enabledAgentsCount} Specialists Armed</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMenuDrawerOpen(false)}
                    className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white cursor-pointer"
                  >
                    <X size={14} />
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
                    className="w-full px-3 py-2 rounded-xl bg-white text-black font-semibold text-xs flex items-center gap-2 hover:bg-zinc-200 transition-colors cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>New Agent Swarm Task</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('feed');
                      setIsMenuDrawerOpen(false);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                      activeTab === 'feed'
                        ? 'bg-white/10 text-white'
                        : 'text-[#71767b] hover:bg-white/[0.05] hover:text-white'
                    }`}
                  >
                    <MessageSquare size={14} />
                    <span>Swarm Workspace</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('settings');
                      setIsMenuDrawerOpen(false);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                      activeTab === 'settings'
                        ? 'bg-white/10 text-white'
                        : 'text-[#71767b] hover:bg-white/[0.05] hover:text-white'
                    }`}
                  >
                    <Settings2 size={14} />
                    <span>Settings, 3 Themes &amp; Agents</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('archive');
                      setIsMenuDrawerOpen(false);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                      activeTab === 'archive'
                        ? 'bg-white/10 text-white'
                        : 'text-[#71767b] hover:bg-white/[0.05] hover:text-white'
                    }`}
                  >
                    <Archive size={14} />
                    <span>Saved Swarms ({sessions.length})</span>
                  </button>
                </div>

                {/* Quick 3-Theme Selector inside Drawer */}
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#71767b] mb-1.5 px-1">
                    <Palette size={11} className="text-purple-400" />
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
                        onClick={() => handleThemeChange(t.id)}
                        className={`px-1.5 py-1.5 rounded-lg border text-[10px] font-medium text-center transition-all cursor-pointer ${
                          theme === t.id
                            ? 'border-white bg-white text-black font-semibold'
                            : 'border-[#26292e] bg-white/[0.03] text-[#71767b] hover:text-white'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Debate Protocol Selection */}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#71767b] mb-1.5 px-1">
                    Swarm Protocol
                  </div>
                  <div className="space-y-0.5">
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
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-[11px] font-medium flex items-center justify-between transition-colors cursor-pointer ${
                            active
                              ? 'bg-white/10 text-white font-semibold'
                              : 'text-[#71767b] hover:bg-white/[0.04] hover:text-white'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Icon size={13} className={active ? 'text-white' : 'text-[#71767b]'} />
                            {m.label}
                          </span>
                          {active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Recent Swarm Sessions */}
                {sessions.length > 0 && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#71767b] mb-1.5 px-1">
                      Recent Tasks
                    </div>
                    <div className="space-y-0.5">
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
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/[0.06] text-[11px] text-[#e7e9ea] truncate transition-colors cursor-pointer"
                        >
                          {sess.topic}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-white/[0.08] text-[10px] text-[#71767b] flex items-center justify-between">
                <span>Parallax Swarm Engine</span>
                <span className="capitalize">{theme} Theme</span>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB CONTENT: SETTINGS (3 Visual Themes + 20 Agents)
           ============================================================ */}
        {activeTab === 'settings' && (
          <div className="flex-1 py-1.5 space-y-4">
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
          <div id="parallax-archive-tab" className="flex-1 py-2 space-y-3">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
              <h3 className="m-0 text-xs sm:text-sm font-bold text-white">
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
                  className="px-2.5 py-1 rounded-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[11px] font-semibold cursor-pointer flex items-center gap-1 transition-colors"
                >
                  <Trash2 size={12} />
                  <span>Clear Archive</span>
                </button>
              )}
            </div>

            {sessions.length === 0 ? (
              <div className="py-12 text-center text-[#71767b] text-xs">
                No archived sessions yet. Ask anything below to mobilize your 20-agent swarm.
              </div>
            ) : (
              <div className={hairlineTableCardClass}>
                {sessions.map((sess, idx) => (
                  <div
                    key={sess.id}
                    id={`parallax-saved-swarm-${sess.id}`}
                    className="p-3 flex flex-col gap-1.5 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-mono text-[#71767b] tabular-nums">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className="text-xs sm:text-[13px] font-medium text-white truncate">
                          {sess.topic}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#71767b] font-mono shrink-0">
                        {new Date(sess.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    {sess.summary && (
                      <div className="text-[11px] text-[#a1a1aa] pl-6 leading-relaxed">
                        <strong className="text-white">Consensus:</strong> {sess.summary.consensusLean}
                      </div>
                    )}
                    <div className="flex items-center justify-between flex-wrap gap-2 pl-6 pt-0.5">
                      <span className="text-[10px] text-[#71767b] font-mono">
                        {sess.messages.length} turns · {sess.summary?.confidenceScore || 86}% conviction
                      </span>

                      {confirmDeleteId === sess.id ? (
                        <div
                          id={`confirm-delete-swarm-prompt-${sess.id}`}
                          className="flex items-center gap-1.5 bg-rose-950/60 border border-rose-500/30 rounded-full px-2.5 py-0.5"
                        >
                          <span className="text-[10px] text-rose-300 font-semibold">Delete?</span>
                          <button
                            id={`confirm-delete-yes-${sess.id}`}
                            type="button"
                            onClick={() => {
                              storage.deleteParallaxSession(sess.id);
                              setSessions(storage.getParallaxSessions());
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold cursor-pointer"
                          >
                            Delete
                          </button>
                          <button
                            id={`confirm-delete-cancel-${sess.id}`}
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-[10px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
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
                            className="px-2.5 py-0.5 rounded-full bg-white text-black text-[10px] font-semibold cursor-pointer hover:bg-zinc-200 transition-colors"
                          >
                            Open
                          </button>
                          <button
                            id={`delete-individual-swarm-${sess.id}`}
                            type="button"
                            onClick={() => setConfirmDeleteId(sess.id)}
                            className="p-1 rounded-full hover:bg-rose-500/20 text-[#71767b] hover:text-rose-400 cursor-pointer flex items-center justify-center transition-colors"
                          >
                            <Trash2 size={12} />
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
            MAIN FEED VIEW (IDLE + ACTIVE MOBILE-PROPORTIONAL EDITORIAL STREAM)
           ============================================================ */}
        {activeTab === 'feed' && (
          <div id="parallax-feed-view" className="flex-1 flex flex-col justify-between">
            {!hasActiveMission ? (
              /* ==========================================================
                 CREATIVE IDLE STATE: COMPACT MOBILE-FRIENDLY BENCHMARK TABLE + NOTES
                 ========================================================== */
              <div className="flex-1 flex flex-col justify-center py-3 sm:py-5 space-y-4 sm:space-y-5 select-text">
                {/* Creative Constellation Badge & Editorial Headline */}
                <div className="space-y-1.5 sm:space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-[#26292e] bg-white/[0.03] text-[10px] sm:text-[11px] font-mono text-[#a1a1aa]">
                    <Sparkles size={11} className="text-emerald-400" />
                    <span>PARALLAX SWARM · {currentModeObj.label.toUpperCase()}</span>
                  </div>

                  <h1 className="text-base sm:text-xl font-semibold text-white tracking-tight leading-snug">
                    20 specialized minds. One empirical synthesis.
                  </h1>
                  <p className="text-xs sm:text-[13.5px] text-[#8b9097] leading-relaxed max-w-[600px]">
                    Assign any research question or global dataset. Parallax mobilizes 20 independent personas across 3 rounds of thesis, cross-examination, and ranked conviction scoring.
                  </p>
                </div>

                {/* Interactive Hairline Preview Table (Mobile-sized rows & crisp text) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-[#71767b]">
                      Featured Benchmarks — Tap to launch
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-mono text-[#71767b]">Conviction</span>
                  </div>

                  <div className={hairlineTableCardClass}>
                    {SHOWCASE_PRESETS.map((preset, idx) => (
                      <button
                        key={preset.id}
                        type="button"
                        disabled={isRunning}
                        onClick={() => {
                          setTopicInput(preset.prompt);
                          handleStartSwarm(preset.prompt);
                        }}
                        className="w-full py-2.5 px-3 sm:py-3 sm:px-4 flex items-center justify-between gap-2.5 text-left hover:bg-white/[0.04] active:bg-white/[0.07] transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 sm:gap-5 min-w-0 flex-1">
                          <span className="text-xs sm:text-[13.5px] font-normal text-[#e7e9ea] tabular-nums w-5 shrink-0">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs sm:text-[13.5px] font-normal text-white group-hover:text-emerald-300 transition-colors truncate">
                              {preset.title}
                            </div>
                            <div className="text-[10.5px] sm:text-xs text-[#71767b] truncate mt-0.5">
                              {preset.subtitle}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs sm:text-[13.5px] font-normal text-[#e7e9ea] tabular-nums">
                            {preset.metric.replace(' conv', '')}
                          </span>
                          <ChevronRight size={14} className="text-[#71767b] group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Editorial "Notes:" Preview Section on Idle (Mobile-friendly text size) */}
                <div className="space-y-2 pt-0.5">
                  <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight m-0">
                    Notes:
                  </h2>
                  <ul className="list-disc pl-4 sm:pl-5 space-y-1.5 sm:space-y-2 text-xs sm:text-[13.5px] text-[#e7e9ea] leading-relaxed m-0">
                    <li>
                      Data and conviction scores are synthesized directly from 20 autonomous domain personas (including VERITAS live web verification, AXIOM logic, and LEDGER economics).
                    </li>
                    <li>
                      Cross-examination in Round 2 automatically challenges unverified assumptions and drops inflated confidence ratings before Round 3 convergence.
                    </li>
                  </ul>
                  <p className="text-[11px] sm:text-xs text-[#a1a1aa] pt-0.5 m-0">
                    Source: Parallax 20-Agent Multi-Round Deliberation Pipeline ({currentModeObj.label}).
                  </p>
                </div>
              </div>
            ) : (
              /* ==========================================================
                 ACTIVE / COMPLETED SWARM VIEW (MOBILE-FRIENDLY SIZING)
                 ========================================================== */
              <div className="flex-1 py-2.5 sm:py-3.5 space-y-4 sm:space-y-5 select-text">
                {/* 1. User Prompt Pill (Right-aligned subtle dark bubble) */}
                <div className="flex justify-end">
                  <div className="rounded-2xl bg-[#16181c] border border-[#26292e] text-white px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-[13.5px] leading-relaxed max-w-[90%] sm:max-w-[78%]">
                    {currentTopic}
                  </div>
                </div>

                {/* 2. Live Swarm Telemetry Pulse Bar */}
                <div className="flex items-center justify-between flex-wrap gap-1.5 pb-1 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isRunning
                          ? 'bg-emerald-400 animate-ping'
                          : 'bg-emerald-400'
                      }`}
                    />
                    <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-[#a1a1aa] truncate">
                      {isRunning
                        ? `${statusText}`
                        : `SWARM COMPLETE · ${messages.length} TURNS · 3 ROUNDS`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setShowTrajectoryChart((prev) => !prev)}
                      className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[10px] sm:text-[11px] text-[#e7e9ea] flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Activity size={11} className="text-emerald-400" />
                      <span>{showTrajectoryChart ? 'Hide Curve' : 'Curve'}</span>
                    </button>
                    {messages.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={handleCopyFullSwarm}
                          className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[10px] sm:text-[11px] text-[#e7e9ea] flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          {copiedSwarmTranscript ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                          <span>{copiedSwarmTranscript ? 'Copied' : 'Copy'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadSwarmMp3}
                          disabled={isDownloadingSwarmMp3}
                          className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[10px] sm:text-[11px] text-[#e7e9ea] flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                        >
                          <Download size={11} />
                          <span>{isDownloadingSwarmMp3 ? 'MP3...' : 'MP3'}</span>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowDetailedTranscript((prev) => !prev)}
                      className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-white text-black text-[10px] sm:text-[11px] font-semibold flex items-center gap-1 cursor-pointer hover:bg-zinc-200 transition-colors"
                    >
                      <FileText size={11} />
                      <span>{showDetailedTranscript ? 'Hide Stream' : 'Stream'}</span>
                    </button>
                  </div>
                </div>

                {/* Error Banner if any */}
                {errorText && (
                  <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs">
                    {errorText}
                  </div>
                )}

                {/* Audio Visualizer if playing */}
                {(playingAudioKey || loadingAudioKey) && (
                  <div className={`p-2 ${hairlineTableCardClass}`}>
                    <ParallaxAudioVisualizer
                      isPlaying={Boolean(playingAudioKey)}
                      activeKey={playingAudioKey || loadingAudioKey}
                      activeAgentName={
                        playingAudioKey === 'full_swarm' || loadingAudioKey === 'full_swarm'
                          ? 'Full Swarm Deliberation'
                          : activeSpeakingAgent?.agentName || 'Swarm Speaker'
                      }
                      activeAgentId={activeSpeakingAgent?.agentId}
                      accentColor={activeSpeakingAgent?.accentColor || '#10b981'}
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

                {/* 3. SCREENSHOT-ACCURATE DARK HAIRLINE RANKING TABLE (MOBILE-SIZED) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-[#71767b]">
                        Swarm Conviction Index ({sortedTableAgents.length} Personas)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setTableSortBy((prev) => (prev === 'conviction' ? 'order' : 'conviction'))
                      }
                      className="text-[10px] sm:text-[11px] font-mono text-[#a1a1aa] hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowUpDown size={11} />
                      <span>
                        {tableSortBy === 'conviction' ? 'Sorted by %' : 'Sorted by Order'}
                      </span>
                    </button>
                  </div>

                  {/* Rounded-2xl Dark Container with Hairline Dividers */}
                  <div id="parallax-conviction-table" className={hairlineTableCardClass}>
                    {visibleTableAgents.map((agent, index) => {
                      const isExpanded = expandedAgentId === agent.id;
                      const rankNumber = String(index + 1).padStart(2, '0');
                      const cleanRole = agent.role.replace(/\s+perspective|\s+analysis/i, '');

                      return (
                        <div key={agent.id} className="transition-colors">
                          <div
                            onClick={() => setExpandedAgentId(isExpanded ? null : agent.id)}
                            className="py-2.5 px-3 sm:py-3 sm:px-4 flex items-center justify-between gap-2.5 cursor-pointer hover:bg-white/[0.03]"
                          >
                            {/* Left Index + Middle Persona/Entity Name */}
                            <div className="flex items-center gap-3 sm:gap-6 min-w-0 flex-1">
                              <span className="text-xs sm:text-[13.5px] font-normal text-[#e7e9ea] tabular-nums w-5 shrink-0">
                                {rankNumber}
                              </span>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs sm:text-[14px] font-normal text-white truncate">
                                    {agent.name}
                                  </span>
                                  <span className="hidden sm:inline-block text-[11px] text-[#71767b] truncate">
                                    · {cleanRole}
                                  </span>
                                </div>
                                {agent.turns.length > 0 && (
                                  <p className="text-[10.5px] sm:text-xs text-[#71767b] truncate mt-0.5 m-0">
                                    {agent.latestText.replace(/[#*_`]/g, '').slice(0, 68)}...
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Right Percentage Column + Subtle Conviction Bar */}
                            <div className="flex items-center gap-2.5 shrink-0">
                              <div className="hidden sm:flex w-14 h-1 rounded-full bg-white/[0.07] overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.min(100, Math.max(10, agent.conviction))}%`,
                                    backgroundColor: agent.accentColor || '#10b981',
                                  }}
                                />
                              </div>
                              <span className="text-xs sm:text-[14px] font-normal text-white tabular-nums w-9 sm:w-11 text-right">
                                {agent.conviction}%
                              </span>
                            </div>
                          </div>

                          {/* Expandable Agent Deliberation Detail on Row Tap */}
                          {isExpanded && (
                            <div className="px-3 sm:px-4 pb-3 pt-2 bg-white/[0.02] border-t border-white/[0.06] space-y-2 text-[11px] sm:text-xs">
                              <div className="flex items-center justify-between text-[#a1a1aa]">
                                <span className="truncate pr-2">Role: {agent.role}</span>
                                <span className="font-mono shrink-0">
                                  {agent.turns.length} round{agent.turns.length === 1 ? '' : 's'}
                                </span>
                              </div>
                              {agent.turns.length === 0 ? (
                                <div className="text-[#71767b] py-1">
                                  Specialist queued in active deliberation pipeline...
                                </div>
                              ) : (
                                agent.turns.map((turn) => (
                                  <div
                                    key={turn.id}
                                    className="p-2.5 rounded-xl bg-black/50 border border-white/[0.06] space-y-1"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-white text-[11px]">
                                        Round 0{turn.round}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        {typeof turn.convictionScore === 'number' && (
                                          <span className="text-[10px] font-mono text-emerald-400">
                                            {turn.convictionScore}%
                                          </span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handlePlayMessageAudio(turn);
                                          }}
                                          className="px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                                        >
                                          <Play size={8} />
                                          {playingAudioKey === turn.id ? 'Stop' : 'Speak'}
                                        </button>
                                      </div>
                                    </div>
                                    <p className="text-[#e7e9ea] leading-relaxed whitespace-pre-wrap text-xs sm:text-[13px] m-0">
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

                    {sortedTableAgents.length > 8 && (
                      <button
                        type="button"
                        onClick={() => setShowAllTableRows((prev) => !prev)}
                        className="w-full py-2.5 text-[11px] sm:text-xs font-medium text-[#8b9097] hover:text-white flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <span>
                          {showAllTableRows
                            ? 'Show top 8 personas'
                            : `Show all ${sortedTableAgents.length} ranked personas`}
                        </span>
                        <ChevronDown
                          size={13}
                          className={`transition-transform ${showAllTableRows ? 'rotate-180' : ''}`}
                        />
                      </button>
                    )}
                  </div>
                </div>

                {/* 4. CREATIVE DARK-MODE CONVICTION TRAJECTORY CURVE & AGENT RECRUITMENT MATRIX */}
                {showTrajectoryChart && (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    {/* Left 7 cols: Dark OLED SVG Conviction Curve */}
                    <div className={`sm:col-span-7 p-3 sm:p-3.5 ${hairlineTableCardClass} divide-y-0`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div>
                          <div className="text-[9.5px] font-mono uppercase tracking-wider text-[#71767b]">
                            CONVICTION SPECTRUM · R1 → R3
                          </div>
                          <div className="text-[11px] sm:text-xs font-semibold text-white mt-0.5">
                            Multi-Agent Consensus Curve
                          </div>
                        </div>
                        <span className="text-[11px] font-mono font-bold text-emerald-400">
                          {summary?.confidenceScore || Math.max(...chartPoints.map((p) => p.val))}% Peak
                        </span>
                      </div>

                      <svg viewBox="0 0 280 100" className="w-full h-auto overflow-visible">
                        <defs>
                          <linearGradient id="parallaxCurveGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <line x1="12" y1="18" x2="268" y2="18" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                        <line x1="12" y1="50" x2="268" y2="50" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                        <line x1="12" y1="82" x2="268" y2="82" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />

                        {/* Area fill under curve */}
                        <polygon
                          fill="url(#parallaxCurveGrad)"
                          points={`18,82 ${chartPoints
                            .map((pt, i) => {
                              const x = 18 + i * 27;
                              const y = 80 - (pt.val / 100) * 60;
                              return `${x},${y}`;
                            })
                            .join(' ')} ${18 + (chartPoints.length - 1) * 27},82`}
                        />

                        {/* Emerald Trajectory Line */}
                        <polyline
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="1.8"
                          points={chartPoints
                            .map((pt, i) => {
                              const x = 18 + i * 27;
                              const y = 80 - (pt.val / 100) * 60;
                              return `${x},${y}`;
                            })
                            .join(' ')}
                        />

                        {chartPoints.map((pt, i) => {
                          const x = 18 + i * 27;
                          const y = 80 - (pt.val / 100) * 60;
                          return (
                            <g key={i}>
                              <circle
                                cx={x}
                                cy={y}
                                r="2.5"
                                fill="#050506"
                                stroke="#34d399"
                                strokeWidth="1.6"
                              />
                              <text
                                x={x}
                                y="94"
                                fontSize="5.5"
                                fill="#71767b"
                                textAnchor="middle"
                              >
                                {pt.label}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>

                    {/* Right 5 cols: Compact Agent Recruitment Dot-Matrix Telemetry */}
                    <div className={`sm:col-span-5 p-3 sm:p-3.5 ${hairlineTableCardClass} divide-y-0 flex flex-col justify-between`}>
                      <div>
                        <button
                          type="button"
                          onClick={() => setShowAllRecruitedAgents((prev) => !prev)}
                          className="w-full flex items-center justify-between text-left cursor-pointer mb-2"
                        >
                          <div className="flex items-center gap-1.5">
                            <GitBranch size={13} className="text-emerald-400" />
                            <span className="text-[11px] sm:text-xs font-semibold text-white">
                              Agent Telemetry ({recruitedAgents.length})
                            </span>
                          </div>
                          <ChevronRight
                            size={13}
                            className={`text-[#71767b] transition-transform ${
                              showAllRecruitedAgents ? 'rotate-90' : ''
                            }`}
                          />
                        </button>

                        <div className="space-y-1.5">
                          {visibleRecruitedAgents.map((ag, idx) => {
                            const filledDots =
                              ag.turns.length >= 3 || summary
                                ? 20
                                : ag.turns.length === 2
                                ? 15
                                : ag.turns.length === 1
                                ? 10
                                : 7;
                            return (
                              <div
                                key={ag.id}
                                className="flex items-center justify-between gap-2 text-[11px] py-0.5 border-b border-white/[0.05] last:border-0"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-[10px] font-mono text-[#71767b] tabular-nums">
                                    {String(idx + 1).padStart(2, '0')}
                                  </span>
                                  <span className="text-white font-medium truncate">
                                    {ag.name}
                                  </span>
                                </div>
                                <div className="grid grid-cols-10 gap-[2px] shrink-0">
                                  {Array.from({ length: 20 }).map((_, dIdx) => (
                                    <span
                                      key={dIdx}
                                      className={`w-[3px] h-[3px] rounded-full ${
                                        dIdx < filledDots ? 'bg-emerald-400' : 'bg-white/15'
                                      }`}
                                    />
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-1.5 mt-1.5 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-[#71767b] font-mono">
                        <span>Protocol: {currentModeObj.shortLabel}</span>
                        <span className="text-emerald-400 truncate max-w-[120px]">
                          {summary?.consensusLean || 'Active Synthesis'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. SCREENSHOT-ACCURATE UNBOXED "Notes:" & "Source:" EDITORIAL SECTION (MOBILE-PROPORTIONAL) */}
                <div id="parallax-editorial-notes" className="space-y-2 sm:space-y-2.5 pt-0.5">
                  <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight m-0">
                    Notes:
                  </h2>

                  <ul className="list-disc pl-4 sm:pl-5 space-y-2 text-xs sm:text-[13.5px] text-[#e7e9ea] leading-[1.58] m-0">
                    {editorialNotes.map((note, idx) => (
                      <li key={idx} className="pl-0.5">
                        {note}
                      </li>
                    ))}
                  </ul>

                  <p className="text-[11px] sm:text-xs text-[#a1a1aa] leading-relaxed pt-1 m-0">
                    Source: Parallax 20-Agent Swarm Deliberation &amp;{' '}
                    {intelligenceBriefing
                      ? 'VERITAS Live Empirical Grounding Survey.'
                      : 'Multi-Round Consensus Index (2026).'}
                  </p>
                </div>

                {/* 6. EXPANDABLE FULL SYNTHESIS & 3-ROUND DELIBERATION STREAM */}
                {showDetailedTranscript && (
                  <div className="space-y-4 pt-2 border-t border-white/[0.08]">
                    {intelligenceBriefing && (
                      <div className={`p-3 sm:p-4 ${hairlineTableCardClass} divide-y-0`}>
                        <ParallaxIntelligenceBriefing
                          briefing={intelligenceBriefing}
                          defaultExpanded={true}
                        />
                      </div>
                    )}

                    {summary && (
                      <div className={`p-3 sm:p-5 ${hairlineTableCardClass} divide-y-0`}>
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

                    <div className={`p-3 sm:p-5 ${hairlineTableCardClass} divide-y-0`}>
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
                  </div>
                )}

                {/* Stopped Early Banner */}
                {wasStoppedEarly && !summary && (
                  <div
                    id="parallax-stopped-early-card"
                    className="rounded-2xl bg-rose-950/40 border border-rose-500/30 p-3 flex items-center justify-between flex-wrap gap-2"
                  >
                    <div className="text-[11px] sm:text-xs text-rose-200">
                      <strong>Swarm stopped early</strong> · {messages.length} turns recorded.
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        id="parallax-rerun-stopped-swarm-btn"
                        type="button"
                        onClick={() => handleStartSwarm(currentTopic)}
                        className="px-2.5 py-1 rounded-full bg-white text-black text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw size={11} />
                        <span>Rerun</span>
                      </button>
                      <button
                        id="parallax-clear-stopped-swarm-btn"
                        type="button"
                        onClick={handleResetToNewSwarm}
                        className="px-2.5 py-1 rounded-full bg-white/10 text-white text-[11px] font-semibold cursor-pointer"
                      >
                        New Task
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==========================================================
               BOTTOM FLOATING COMPOSER (COMPACT MOBILE-FRIENDLY REPLICA:
               "Ask anything", Paperclip left, "⚡ Fast ∨" + White Waveform Circle right)
               ========================================================== */}
            <div id="parallax-input-container" className="sticky bottom-2 z-30 pt-2">
              {/* Popover 1: Paperclip / Quick Tasks & Human Directive Menu */}
              {isPlusMenuOpen && (
                <div className={`mb-2 p-3 rounded-2xl space-y-2 animate-fadeIn ${composerBoxClass}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] sm:text-xs font-bold text-white">
                      Quick Swarm Tasks &amp; Directives
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsPlusMenuOpen(false)}
                      className="text-[#71767b] hover:text-white cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="space-y-0.5">
                    {SAMPLE_TOPICS.map((t, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setTopicInput(t);
                          handleStartSwarm(t);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded-xl hover:bg-white/[0.06] text-[11px] sm:text-xs text-[#e7e9ea] truncate flex items-center gap-2 cursor-pointer"
                      >
                        <Globe size={11} className="text-emerald-400 shrink-0" />
                        <span className="truncate">{t}</span>
                      </button>
                    ))}
                  </div>

                  {isRunning && (
                    <div className="pt-1.5 border-t border-white/[0.08]">
                      <button
                        type="button"
                        onClick={() => {
                          setIsPlusMenuOpen(false);
                          setIsHumanModalOpen(true);
                        }}
                        className="w-full py-1.5 px-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-200 text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <UserPlus size={12} />
                        <span>Inject Human Operator Directive (Round 0{currentRound || 1})</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Popover 2: "⚡ Fast ∨" Swarm Mode / Protocol Selector */}
              {isModeSelectorOpen && (
                <div className={`mb-2 p-2.5 rounded-2xl space-y-1 animate-fadeIn ${composerBoxClass}`}>
                  <div className="flex items-center justify-between px-2 pb-0.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#71767b]">
                      Select Swarm Execution Mode
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsModeSelectorOpen(false)}
                      className="text-[#71767b] hover:text-white cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  {DEBATE_MODES.map((m) => {
                    const Icon = m.icon;
                    const active = debateMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setDebateMode(m.id);
                          setIsModeSelectorOpen(false);
                        }}
                        className={`w-full px-2.5 py-2 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer ${
                          active
                            ? 'bg-white/[0.1] text-white'
                            : 'hover:bg-white/[0.05] text-[#a1a1aa]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon size={13} className={active ? 'text-white' : 'text-[#71767b]'} />
                          <div>
                            <div className="text-[11px] sm:text-xs font-semibold text-white">{m.label}</div>
                            <div className="text-[10px] text-[#71767b]">{m.speedTag}</div>
                          </div>
                        </div>
                        {active && <Check size={13} className="text-emerald-400" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* SCREENSHOT COMPOSER BOX: Compact mobile-friendly dark container */}
              <div className={`rounded-2xl sm:rounded-[24px] px-3 sm:px-4 pt-2.5 pb-2 transition-all ${composerBoxClass}`}>
                {/* Row 1: "Ask anything" Input */}
                <div className="pb-1.5">
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
                    placeholder={isRunning ? statusText : 'Ask anything'}
                    className="w-full bg-transparent text-[13px] sm:text-[14.5px] text-white placeholder-[#71767b] focus:outline-none"
                  />
                </div>

                {/* Row 2: Left Paperclip Icon | Right "⚡ Fast ∨" + Solid White Waveform Circle Button */}
                <div className="flex items-center justify-between">
                  {/* Left: Paperclip / Quick Presets & Directives */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsModeSelectorOpen(false);
                      setIsPlusMenuOpen((prev) => !prev);
                    }}
                    className="p-1 -ml-0.5 rounded-full text-[#8b9097] hover:text-white transition-colors cursor-pointer"
                    title="Attach Preset Topic or Inject Directive"
                  >
                    <Paperclip size={17} strokeWidth={1.9} />
                  </button>

                  {/* Right: "⚡ Fast ∨" Mode Dropdown + Solid White Circle Waveform Button */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusMenuOpen(false);
                        setIsModeSelectorOpen((prev) => !prev);
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-[#e7e9ea] hover:bg-white/[0.06] text-xs sm:text-[13px] font-medium transition-colors cursor-pointer"
                      title="Switch Swarm Speed & Protocol"
                    >
                      <Zap size={13} className="text-[#e7e9ea]" />
                      <span>{currentModeObj.shortLabel}</span>
                      <ChevronDown size={13} className="text-[#71767b]" />
                    </button>

                    {isRunning ? (
                      <button
                        id="parallax-stop-swarm-btn"
                        type="button"
                        onClick={handleStopSwarm}
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md cursor-pointer transition-transform active:scale-95"
                        title="Stop Swarm"
                      >
                        <Square size={12} fill="currentColor" />
                      </button>
                    ) : (
                      <button
                        id="parallax-start-swarm-btn"
                        type="button"
                        onClick={() => {
                          if (topicInput.trim()) {
                            handleStartSwarm();
                          } else if (messages.length > 0) {
                            handleListenToFullSwarm();
                          } else {
                            handleStartSwarm(SAMPLE_TOPICS[0]);
                          }
                        }}
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center justify-center shrink-0 shadow-md cursor-pointer transition-transform active:scale-95"
                        title={
                          topicInput.trim()
                            ? 'Launch 20-Agent Swarm'
                            : messages.length > 0
                            ? 'Listen to Swarm Audio Briefing'
                            : 'Launch Featured Swarm Task'
                        }
                      >
                        <AudioLines size={16} strokeWidth={2.3} />
                      </button>
                    )}
                  </div>
                </div>
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
            className="fixed bottom-20 right-4 z-40 px-3 py-1.5 rounded-full bg-white text-black font-semibold text-[11px] shadow-lg flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="Inject a direct operator assertion or counter-argument into live deliberation"
          >
            <UserPlus size={12} />
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
