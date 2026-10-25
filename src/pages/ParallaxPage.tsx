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
  Palette,
  Paperclip,
  Zap,
  Activity,
  Orbit,
} from 'lucide-react';
import { storage } from '@/lib/storage';
import {
  selectSwarmAgents,
  isValidSwarmSize,
  PARALLAX_SWARM_SIZES,
  type ParallaxSwarmSize,
} from '@/lib/parallaxSwarmSize';
import { runParallaxSwarm } from '@/services/parallaxOrchestrator';
import { ParallaxAgentMatrix } from '@/components/parallax/ParallaxAgentMatrix';
import { ParallaxDeliberationStream } from '@/components/parallax/ParallaxDeliberationStream';
import { ParallaxSynthesisReport } from '@/components/parallax/ParallaxSynthesisReport';
import { ParallaxTelemetry } from '@/components/parallax/ParallaxTelemetry';
import { ParallaxConvictionChart } from '@/components/parallax/ParallaxConvictionChart';
import { ParallaxSwarmConstellation } from '@/components/parallax/ParallaxSwarmConstellation';
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
import { getDebateModeConfig } from '@/data/parallaxDebateModes';
import { assignModeSides } from '@/lib/parallaxModeTeams';
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
  category: 'geopolitics' | 'markets' | 'science';
  badge: string;
  title: string;
  subtitle: string;
  metric: string;
  convictionNum: number;
  prompt: string;
  accent: string;
}

const SHOWCASE_PRESETS: ShowcasePreset[] = [
  {
    id: 'geopolitics',
    category: 'geopolitics',
    badge: 'Global Survey',
    title: 'Global Sentiment & Favorability',
    subtitle: '25-nation comparative attitude & alliance index',
    metric: '88% conv',
    convictionNum: 88,
    prompt: 'Global favorable vs unfavorable ratings and geopolitical sentiment analysis 2026.',
    accent: '#10b981',
  },
  {
    id: 'solar',
    category: 'markets',
    badge: 'Market Intel',
    title: 'Global Solar Competitor Report',
    subtitle: 'Supply, demand & margin roll-forward through 2030',
    metric: '92% conv',
    convictionNum: 92,
    prompt: 'Create a comprehensive global solar competitor report.',
    accent: '#06b6d4',
  },
  {
    id: 'blackhole',
    category: 'science',
    badge: 'Astrophysics',
    title: 'Blackhole: Gargantua Lensing',
    subtitle: 'Relativistic accretion & photon ring interferometry',
    metric: '95% conv',
    convictionNum: 95,
    prompt: 'Analyze relativistic physics, accretion photon rings, and gravitational lensing around supermassive black hole Gargantua.',
    accent: '#f59e0b',
  },
  {
    id: 'humanoid',
    category: 'markets',
    badge: 'Robotics 2035',
    title: 'Humanoid Domestic Automation',
    subtitle: 'Unit economics, actuator bottlenecks & adoption curve',
    metric: '81% conv',
    convictionNum: 81,
    prompt: 'Will humanoid robots replace household chores by 2035?',
    accent: '#8b5cf6',
  },
  {
    id: 'opensource_ai',
    category: 'markets',
    badge: 'AI Governance',
    title: 'Open-Weight vs Frontier AI Safety',
    subtitle: 'Decentralized verification vs compute concentration',
    metric: '84% conv',
    convictionNum: 84,
    prompt: 'Is open-source AI safer than centralized proprietary models?',
    accent: '#38bdf8',
  },
  {
    id: 'mars',
    category: 'science',
    badge: 'Deep Space',
    title: 'Mars Colony vs Earth Biospheres',
    subtitle: 'Civilizational risk & resource allocation trade-offs',
    metric: '76% conv',
    convictionNum: 76,
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
  { id: 'default', label: getDebateModeConfig('default').label, shortLabel: 'Fast', speedTag: getDebateModeConfig('default').subtitle, icon: Zap },
  { id: 'courtroom', label: getDebateModeConfig('courtroom').label, shortLabel: 'Courtroom', speedTag: getDebateModeConfig('courtroom').subtitle, icon: Scale },
  { id: 'red_vs_blue', label: getDebateModeConfig('red_vs_blue').label, shortLabel: 'Red vs Blue', speedTag: getDebateModeConfig('red_vs_blue').subtitle, icon: Shield },
  { id: 'senate', label: getDebateModeConfig('senate').label, shortLabel: 'Senate', speedTag: getDebateModeConfig('senate').subtitle, icon: Landmark },
  { id: 'vc_pitch', label: getDebateModeConfig('vc_pitch').label, shortLabel: 'VC Pitch', speedTag: getDebateModeConfig('vc_pitch').subtitle, icon: Briefcase },
  { id: 'genesis', label: getDebateModeConfig('genesis').label, shortLabel: 'Genesis', speedTag: getDebateModeConfig('genesis').subtitle, icon: Orbit },
];

function getSwarmSizeDescription(size: ParallaxSwarmSize): string {
  switch (size) {
    case 5:
      return '5 core agents + 1 specialist · faster';
    case 10:
      return '10 agents + 2 specialists';
    case 15:
      return '15 agents + 3 specialists';
    case 20:
    default:
      return 'All 20 agents + up to 5 specialists';
  }
}

export const ParallaxPage: React.FC = () => {
  const [theme, setTheme] = useState<ParallaxTheme>(() => getSavedParallaxTheme());
  const [activeTab, setActiveTab] = useState<'feed' | 'settings' | 'archive'>('feed');
  const [topicInput, setTopicInput] = useState('');
  const [currentTopic, setCurrentTopic] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentRound, setCurrentRound] = useState<1 | 2 | 3 | null>(null);
  const [messages, setMessages] = useState<ParallaxMessage[]>([]);
  const [summary, setSummary] = useState<ParallaxSummary | null>(null);
  const [swarmSize, setSwarmSize] = useState<ParallaxSwarmSize>(() => storage.getParallaxSwarmSize());
  const [statusText, setStatusText] = useState<string>(
    () => `Ready to mobilize ${storage.getParallaxSwarmSize()}-agent swarm.`,
  );
  const [errorText, setErrorText] = useState<string | null>(null);
  const [wasStoppedEarly, setWasStoppedEarly] = useState<boolean>(false);

  // UI Drawer, Filters & Composer Popovers
  const [isMenuDrawerOpen, setIsMenuDrawerOpen] = useState(false);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isModeSelectorOpen, setIsModeSelectorOpen] = useState(false);
  const [isTelemetryDrawerOpen, setIsTelemetryDrawerOpen] = useState(false);
  const [isMatrixDrawerOpen, setIsMatrixDrawerOpen] = useState(false);
  const [isBriefingDrawerOpen, setIsBriefingDrawerOpen] = useState(false);
  const [inspectedRosterAgentId, setInspectedRosterAgentId] = useState<string | null>(null);
  const [benchmarkCategory, setBenchmarkCategory] = useState<'all' | 'geopolitics' | 'markets' | 'science'>('all');

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

  const handleSwarmSizeChange = (newSize: ParallaxSwarmSize) => {
    setSwarmSize(newSize);
    storage.saveParallaxSwarmSize(newSize);
  };

  const handleCycleTheme = () => {
    const order: ParallaxTheme[] = ['fulldark', 'minimal', 'classic'];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    handleThemeChange(next);
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
      const introText = `Welcome to Parallax Agent Swarm. Today, ${selectedSwarmCount} AI agents investigate: ${currentTopic || topicInput}.`;
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
          `Welcome to Parallax Agent Swarm. Today, ${selectedSwarmCount} AI agents debate: ${currentTopic || topicInput}.`,
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
      debateMode,
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
      setSwarmSize(storage.getParallaxSwarmSize());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (autoScroll && feedEndRef.current && isRunning) {
      const rect = feedEndRef.current.getBoundingClientRect();
      const isNearBottom = rect.top - window.innerHeight < 220;
      if (isNearBottom) {
        feedEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }
  }, [messages, autoScroll, isRunning]);

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
    setInspectedRosterAgentId(null);
    setStatusText('INITIALIZING PARALLAX CORE • CONNECTING AGENTS...');
    setAutoScroll(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    await runParallaxSwarm({
      topic: targetTopic,
      config,
      debateMode,
      swarmSize,
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
    setInspectedRosterAgentId(null);
    setActiveTab('feed');
  };

  const handleRandomDeepDive = () => {
    const pool = [...SAMPLE_TOPICS, ...SHOWCASE_PRESETS.map((p) => p.prompt)];
    const available = pool.filter((p) => p !== currentTopic && p !== topicInput);
    const pick = available[Math.floor(Math.random() * available.length)] || SAMPLE_TOPICS[0];
    setTopicInput(pick);
    handleStartSwarm(pick);
  };

  const configuredAgentsCount = Object.keys(config.agents || {}).length;
  const enabledAgentsList = React.useMemo(
    () => Object.values(config.agents || {}).filter((a) => a.enabled !== false),
    [config.agents],
  );
  const enabledAgentsCount = enabledAgentsList.length;
  const selectedSwarmAgents = React.useMemo(
    () => selectSwarmAgents(enabledAgentsList, swarmSize),
    [enabledAgentsList, swarmSize],
  );
  const selectedSwarmCount = selectedSwarmAgents.length;
  const isGenesisMode = debateMode === 'genesis';
  const genesisAgentCount = swarmSize - 2;
  const genesisMaxSearches = storage.getParallaxGenesisSettings().maxSearches;
  const genesisSearchCap = Math.min(genesisMaxSearches, genesisAgentCount);
  const genesisUsageNote = `Uses about ${swarmSize} AI calls and up to ${genesisSearchCap} searches per run`;
  const isFewerEnabledThanSelected = !isGenesisMode && enabledAgentsCount < swarmSize;
  const swarmSizeHintText = isGenesisMode
    ? `Genesis builds its own ${genesisAgentCount} agents (2 + ${genesisAgentCount})`
    : isFewerEnabledThanSelected
    ? `Only ${selectedSwarmCount} agents are enabled in Settings, so ${selectedSwarmCount} will run`
    : getSwarmSizeDescription(swarmSize);
  const selectedSwarmAgentIds = React.useMemo(
    () => new Set(selectedSwarmAgents.map((a) => a.id)),
    [selectedSwarmAgents],
  );
  const modeSideAssignments = React.useMemo(
    () =>
      debateMode !== 'default' && debateMode !== 'genesis'
        ? assignModeSides(debateMode, [...selectedSwarmAgents, ...dynamicPersonas])
        : new Map(),
    [debateMode, selectedSwarmAgents, dynamicPersonas],
  );
  const dynamicSpecialistsCount = dynamicPersonas.length;
  const totalActivePoolCount = isGenesisMode
    ? dynamicPersonas.length > 0
      ? 2 + dynamicPersonas.length
      : swarmSize
    : selectedSwarmCount + dynamicSpecialistsCount;
  const expectedMaxReplies = isGenesisMode ? swarmSize : totalActivePoolCount * 3;
  const rosterAgentsToRender = React.useMemo(() => {
    if (isGenesisMode && dynamicPersonas.length > 0) {
      return dynamicPersonas;
    }
    if (dynamicPersonas.length > 0) {
      const existingIds = new Set(enabledAgentsList.map((a) => a.id));
      return [...enabledAgentsList, ...dynamicPersonas.filter((d) => !existingIds.has(d.id))];
    }
    return enabledAgentsList;
  }, [isGenesisMode, dynamicPersonas, enabledAgentsList]);

  const agentTurns = React.useMemo(
    () => messages.filter((m) => !m.isHuman),
    [messages],
  );
  const agentTurnsCount = agentTurns.length;

  const respondedAgentsCount = React.useMemo(
    () => new Set(agentTurns.map((m) => m.agentId)).size,
    [agentTurns],
  );

  const currentRoundRespondedCount = React.useMemo(() => {
    if (!currentRound) return 0;
    return new Set(agentTurns.filter((m) => m.round === currentRound).map((m) => m.agentId)).size;
  }, [agentTurns, currentRound]);

  // Normalize a turn's conviction score (stored on 1-10 scale in orchestrator, or 0-100 in legacy sessions) to 0-100%
  const getTurnConvictionPct = React.useCallback((msg?: ParallaxMessage | null): number | null => {
    if (!msg || msg.isHuman) return null;
    const raw =
      typeof msg.conviction === 'number'
        ? msg.conviction
        : typeof (msg as { convictionScore?: number }).convictionScore === 'number'
        ? (msg as { convictionScore?: number }).convictionScore!
        : null;
    if (raw === null || Number.isNaN(raw)) return null;
    return raw <= 10 ? Math.round(raw * 10) : Math.round(raw);
  }, []);

  // Voice playback active state vs latest deliberation speaker
  const voiceSpeakingMessage =
    playingAudioKey && playingAudioKey !== 'full_swarm'
      ? messages.find((m) => m.id === playingAudioKey) || null
      : null;

  const speakingAgentsCount = playingAudioKey ? 1 : 0;

  const activeSpeakingAgent =
    voiceSpeakingMessage ||
    (isRunning && agentTurns.length > 0 ? agentTurns[agentTurns.length - 1] : null);

  const hasActiveMission = Boolean(currentTopic || messages.length > 0 || isRunning || summary);

  // Grounded sources calculation matching actual source data
  const groundingTelemetry = React.useMemo(() => {
    const toolGroundedTurns = agentTurns.filter((m) => Boolean(m.toolUsed && !m.toolUsed.failed)).length;
    if (intelligenceBriefing) {
      const count = intelligenceBriefing.sources?.length ?? intelligenceBriefing.liveSearchCount ?? 0;
      return {
        count,
        subtext: `Round 00 web sources (${toolGroundedTurns} turn${toolGroundedTurns === 1 ? '' : 's'} cited)`,
      };
    }
    if (summary?.evidenceSources) {
      return {
        count: summary.evidenceSources.length,
        subtext: 'Summary evidence sources',
      };
    }
    if (agentTurns.length > 0) {
      return {
        count: toolGroundedTurns,
        subtext: 'Search-grounded agent turns',
      };
    }
    return {
      count: null as number | null,
      subtext: isRunning ? 'Scanning live web sources...' : 'Awaiting Round 00 search',
    };
  }, [intelligenceBriefing, summary, agentTurns, isRunning]);

  // Build agent telemetry list from genuine turns + enabled standby agents without fabricating scores
  const recruitedAgents = React.useMemo(() => {
    const byId = new Map<
      string,
      {
        id: string;
        name: string;
        role: string;
        accentColor: string;
        latestRound: number | null;
        latestText: string;
        conviction: number | null;
        r1Conviction: number | null;
        delta: number | null;
        turns: ParallaxMessage[];
      }
    >();

    for (const msg of agentTurns) {
      const existing = byId.get(msg.agentId);
      const turns = existing ? [...existing.turns, msg] : [msg];
      const scoredTurns = turns
        .map((t) => getTurnConvictionPct(t))
        .filter((v): v is number => v !== null);
      const r1Score = scoredTurns.length > 0 ? scoredTurns[0] : null;
      const latestScore = scoredTurns.length > 0 ? scoredTurns[scoredTurns.length - 1] : null;
      byId.set(msg.agentId, {
        id: msg.agentId,
        name: msg.agentName.split(' (')[0],
        role: msg.role || config.agents[msg.agentId]?.role || 'Research Specialist',
        accentColor: msg.accentColor || '#10b981',
        latestRound: msg.round,
        latestText: msg.text,
        conviction: latestScore,
        r1Conviction: r1Score,
        delta:
          turns.length > 1 && latestScore !== null && r1Score !== null
            ? latestScore - r1Score
            : null,
        turns,
      });
    }

    // Append selected swarm agents and dynamic specialists that are in standby (0 turns, conviction: null)
    const activePool = [...selectedSwarmAgents, ...dynamicPersonas];
    activePool.forEach((agent) => {
      if (!byId.has(agent.id)) {
        byId.set(agent.id, {
          id: agent.id,
          name: agent.name.split(' (')[0],
          role: agent.role || 'Domain Specialist',
          accentColor: agent.accentColor || '#10b981',
          latestRound: null,
          latestText: agent.systemInstruction || `${agent.role} awaiting turn`,
          conviction: null,
          r1Conviction: null,
          delta: null,
          turns: [],
        });
      }
    });

    return Array.from(byId.values());
  }, [agentTurns, selectedSwarmAgents, dynamicPersonas, config.agents, getTurnConvictionPct]);

  const polarityStats = React.useMemo(() => {
    const scoredAgents = recruitedAgents.filter(
      (a): a is typeof a & { conviction: number } => a.conviction !== null,
    );
    const scoredCount = scoredAgents.length;
    if (scoredCount === 0) {
      return {
        scoredCount: 0,
        high: 0,
        mod: 0,
        low: 0,
        highPct: 0,
        modPct: 0,
        lowPct: 0,
        avg: null as number | null,
      };
    }
    const high = scoredAgents.filter((a) => a.conviction >= 75).length;
    const mod = scoredAgents.filter((a) => a.conviction >= 55 && a.conviction < 75).length;
    const low = scoredAgents.filter((a) => a.conviction < 55).length;
    const avg = Math.round(
      scoredAgents.reduce((acc, a) => acc + a.conviction, 0) / scoredCount,
    );
    const highPct = Math.round((high / scoredCount) * 100);
    const modPct = Math.round((mod / scoredCount) * 100);
    return {
      scoredCount,
      high,
      mod,
      low,
      highPct,
      modPct,
      lowPct: Math.max(0, 100 - highPct - modPct),
      avg,
    };
  }, [recruitedAgents]);

  const filteredShowcasePresets = React.useMemo(() => {
    if (benchmarkCategory === 'all') return SHOWCASE_PRESETS;
    return SHOWCASE_PRESETS.filter((p) => p.category === benchmarkCategory);
  }, [benchmarkCategory]);

  const inspectedRosterAgent = React.useMemo(() => {
    if (!inspectedRosterAgentId) return null;
    return (
      dynamicPersonas.find((a) => a.id === inspectedRosterAgentId) ||
      config.agents[inspectedRosterAgentId] ||
      enabledAgentsList.find((a) => a.id === inspectedRosterAgentId) ||
      null
    );
  }, [inspectedRosterAgentId, dynamicPersonas, config.agents, enabledAgentsList]);

  const currentModeObj = DEBATE_MODES.find((m) => m.id === debateMode) || DEBATE_MODES[0];

  // ============================================================
  // 3-THEME DESIGN TOKENS (Deep Obsidian Classic / Minimal / Full Dark)
  // ============================================================
  const wrapperThemeClass =
    theme === 'classic'
      ? 'theme-classic bg-[#060911] text-[#f1f5f9] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0b192e] via-[#060911] to-[#04060b]'
      : theme === 'minimal'
      ? 'theme-minimal bg-[#0c0d10] text-[#e7e9ea]'
      : 'theme-fulldark bg-black text-[#e7e9ea]';

  const hairlineTableCardClass =
    theme === 'classic'
      ? 'rounded-2xl border border-cyan-500/20 bg-[#0a101d]/90 backdrop-blur-xl divide-y divide-white/[0.06]'
      : theme === 'minimal'
      ? 'rounded-2xl border border-zinc-800/90 bg-[#121318] divide-y divide-zinc-800/80'
      : 'rounded-2xl border border-[#22252a] bg-[#07080a] divide-y divide-[#1a1d21]';

  const floatingPillClass =
    theme === 'classic'
      ? 'bg-[#0b1220]/90 backdrop-blur-xl border border-cyan-500/25 text-slate-100 shadow-[0_4px_20px_rgba(6,182,212,0.12)]'
      : theme === 'minimal'
      ? 'bg-[#16171d] border border-zinc-800 text-zinc-100 shadow-[0_2px_12px_rgba(0,0,0,0.45)]'
      : 'bg-[#101216] border border-[#24272c] text-[#e7e9ea] shadow-[0_2px_14px_rgba(0,0,0,0.75)]';

  const floatingPillHoverClass =
    theme === 'classic'
      ? 'hover:bg-slate-800/90 hover:border-cyan-400/40'
      : theme === 'minimal'
      ? 'hover:bg-zinc-800'
      : 'hover:bg-[#1a1c20]';

  const composerBoxClass =
    theme === 'classic'
      ? 'bg-[#0a111f]/95 backdrop-blur-2xl border border-cyan-500/30 shadow-[0_12px_42px_rgba(0,0,0,0.72)]'
      : theme === 'minimal'
      ? 'bg-[#16171c] border border-zinc-800/90 shadow-[0_10px_36px_rgba(0,0,0,0.65)]'
      : 'bg-[#121418] border border-[#26292e] shadow-[0_10px_40px_rgba(0,0,0,0.85)]';

  return (
    <div
      id="parallax-page-wrapper"
      data-theme={theme}
      className={`min-h-screen relative -mx-4 sm:-mx-8 md:-mx-12 -my-8 px-3 sm:px-6 lg:px-8 py-2 overflow-x-hidden font-sans select-none transition-colors duration-200 ${wrapperThemeClass}`}
    >
      {/* Scoped overrides to neutralize legacy global @media (max-width: 640px) !important rules on #parallax-input-container & #parallax-topic-input */}
      <style>{`
        #parallax-page-wrapper #parallax-page #parallax-input-container {
          padding: 4px 0 0 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        #parallax-page-wrapper #parallax-page #parallax-topic-input {
          padding: 2px 0 !important;
          margin: 0 !important;
          height: 22px !important;
          min-height: 0 !important;
          font-size: 13px !important;
          line-height: 1.35 !important;
          border-radius: 0 !important;
          border: none !important;
          background: transparent !important;
          box-shadow: none !important;
        }
        #parallax-page-wrapper #parallax-page #parallax-start-swarm-btn,
        #parallax-page-wrapper #parallax-page #parallax-stop-swarm-btn {
          width: 32px !important;
          height: 32px !important;
          min-width: 32px !important;
          min-height: 32px !important;
          max-width: 32px !important;
          padding: 0 !important;
          border-radius: 9999px !important;
          flex: 0 0 32px !important;
        }
        @media (min-width: 640px) {
          #parallax-page-wrapper #parallax-page #parallax-topic-input {
            font-size: 14px !important;
            height: 24px !important;
          }
          #parallax-page-wrapper #parallax-page #parallax-start-swarm-btn,
          #parallax-page-wrapper #parallax-page #parallax-stop-swarm-btn {
            width: 34px !important;
            height: 34px !important;
            min-width: 34px !important;
            min-height: 34px !important;
            max-width: 34px !important;
            flex: 0 0 34px !important;
          }
        }
      `}</style>
      <style>{`
        @keyframes parallaxOrbitSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes parallaxOrbitReverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes parallaxPulseCore {
          0%, 100% { transform: scale(0.96); opacity: 0.78; }
          50% { transform: scale(1.06); opacity: 1; }
        }
        @keyframes parallaxSynapseFlow {
          0% { stroke-dashoffset: 180; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes parallaxSwarmSizeShift {
          0% {
            opacity: 0.55;
            transform: translateY(2px) scale(0.985);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes parallaxStarSpeakingPulse {
          0%, 100% {
            transform: scale(1);
            filter: drop-shadow(0 0 9px var(--star-glow, rgba(97, 215, 201, 0.55)));
          }
          50% {
            transform: scale(1.08);
            filter: drop-shadow(0 0 14px var(--star-glow, rgba(97, 215, 201, 0.9)));
          }
        }
        .parallax-gfx-spin {
          animation: parallaxOrbitSlow 48s linear infinite;
          transform-origin: center center;
        }
        .parallax-gfx-spin-reverse {
          animation: parallaxOrbitReverse 64s linear infinite;
          transform-origin: center center;
        }
        .parallax-gfx-core-pulse {
          animation: parallaxPulseCore 4.2s ease-in-out infinite;
          transform-origin: center center;
        }
        .parallax-gfx-synapse {
          stroke-dasharray: 6 12;
          animation: parallaxSynapseFlow 8s linear infinite;
        }
        .parallax-swarm-size-shift {
          animation: parallaxSwarmSizeShift 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .parallax-agent-star-pulse {
          animation: parallaxStarSpeakingPulse 1.6s ease-in-out infinite;
          transform-origin: center center;
        }
        @media (prefers-reduced-motion: reduce) {
          .parallax-gfx-spin,
          .parallax-gfx-spin-reverse,
          .parallax-gfx-core-pulse,
          .parallax-gfx-synapse,
          .parallax-swarm-size-shift,
          .parallax-agent-star-pulse {
            animation: none !important;
          }
        }
      `}</style>

      {/* ============================================================
          AMBIENT HOLOGRAPHIC ASTROMETRY & QUANTUM LENSING BACKDROP
          (Purely graphical layer — pointer-events-none, zero UI shift)
         ============================================================ */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
      >
        <svg
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          className="w-full h-full opacity-55"
        >
          <defs>
            <radialGradient id="pxAmbientNebulaCyan" cx="50%" cy="22%" r="52%">
              <stop offset="0%" stopColor={isRunning ? '#00f0ff' : '#06b6d4'} stopOpacity={theme === 'classic' ? '0.18' : '0.1'} />
              <stop offset="50%" stopColor="#6366f1" stopOpacity={theme === 'classic' ? '0.08' : '0.04'} />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="pxAmbientNebulaBottom" cx="50%" cy="88%" r="45%">
              <stop offset="0%" stopColor={summary ? '#10b981' : '#a855f7'} stopOpacity={theme === 'classic' ? '0.14' : '0.07'} />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="pxHorizonGridGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
              <stop offset="45%" stopColor="#61d7c9" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.03" />
            </linearGradient>
          </defs>

          {/* Soft Atmospheric Quantum Light Fields */}
          <rect width="1440" height="900" fill="url(#pxAmbientNebulaCyan)" />
          <rect width="1440" height="900" fill="url(#pxAmbientNebulaBottom)" />

          {/* Perspective Horizon Interferometer Grid */}
          <g stroke="url(#pxHorizonGridGrad)" strokeWidth="0.7" opacity="0.65">
            <line x1="0" y1="220" x2="1440" y2="220" strokeDasharray="3 9" />
            <line x1="0" y1="450" x2="1440" y2="450" strokeDasharray="2 8" />
            <line x1="0" y1="680" x2="1440" y2="680" strokeDasharray="3 9" />
            <line x1="720" y1="0" x2="120" y2="900" />
            <line x1="720" y1="0" x2="420" y2="900" />
            <line x1="720" y1="0" x2="720" y2="900" strokeDasharray="4 6" />
            <line x1="720" y1="0" x2="1020" y2="900" />
            <line x1="720" y1="0" x2="1320" y2="900" />
          </g>

          {/* Counter-Rotating Astrometric Celestial Rings */}
          <g style={{ transformOrigin: '720px 340px' }} className="parallax-gfx-spin">
            <circle
              cx="720"
              cy="340"
              r="390"
              fill="none"
              stroke="rgba(97, 215, 201, 0.09)"
              strokeWidth="1"
              strokeDasharray="12 8 2 8"
            />
            <circle
              cx="720"
              cy="340"
              r="412"
              fill="none"
              stroke="rgba(56, 189, 248, 0.07)"
              strokeWidth="3"
              strokeDasharray="1 11"
            />
          </g>
          <g style={{ transformOrigin: '720px 340px' }} className="parallax-gfx-spin-reverse">
            <circle
              cx="720"
              cy="340"
              r="285"
              fill="none"
              stroke="rgba(168, 85, 247, 0.09)"
              strokeWidth="1"
              strokeDasharray="4 10"
            />
          </g>

          {/* Flowing Synaptic Photon Arcs */}
          <path
            d="M 90 640 Q 420 260 720 340 T 1350 220"
            fill="none"
            stroke="rgba(97, 215, 201, 0.16)"
            strokeWidth="1.2"
            className="parallax-gfx-synapse"
          />
          <path
            d="M 120 200 Q 480 460 720 340 T 1320 620"
            fill="none"
            stroke="rgba(168, 85, 247, 0.14)"
            strokeWidth="1.1"
            className="parallax-gfx-synapse"
          />
        </svg>
      </div>

      <div
        id="parallax-page"
        className="relative z-10 w-full max-w-[1060px] mx-auto min-h-[calc(100vh-1.5rem)] flex flex-col justify-between pt-1 pb-2"
      >
        {/* ============================================================
            TOP FLOATING COMMAND BAR (COMPACT MOBILE-FRIENDLY)
           ============================================================ */}
        <header
          id="parallax-command-header"
          className="sticky top-1.5 z-30 flex items-center justify-between gap-2 py-1.5 backdrop-blur-md"
        >
          {/* Left: Hamburger Drawer Button + Brand & Live Status Pill */}
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => setIsMenuDrawerOpen(true)}
              aria-label="Open Parallax menu"
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all cursor-pointer ${floatingPillClass} ${floatingPillHoverClass}`}
            >
              <Menu size={15} strokeWidth={2.2} />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'feed' ? 'settings' : 'feed')}
              className={`h-8 sm:h-9 px-3 sm:px-3.5 rounded-full flex items-center gap-1.5 text-xs sm:text-[13px] transition-all cursor-pointer truncate ${floatingPillClass} ${floatingPillHoverClass}`}
            >
              {isRunning && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
              )}
              <span className="font-semibold tracking-tight text-white">Parallax</span>
              <span className="text-[#71767b]" aria-hidden="true">·</span>
              <span className="text-[10.5px] sm:text-[11px] text-[#8b9097] font-mono tabular-nums truncate">
                {isRunning
                  ? isGenesisMode
                    ? 'Round 1 of 1 Live'
                    : `R0${currentRound || 1} Live`
                  : isGenesisMode
                  ? `2 + ${genesisAgentCount} Auto Agents`
                  : selectedSwarmCount === enabledAgentsCount
                  ? `${selectedSwarmCount} Personas`
                  : `${selectedSwarmCount}/${enabledAgentsCount} Personas`}
              </span>
            </button>
          </div>

          {/* Right: New Swarm + Quick Theme Cycle + Settings + Archive + Audio Briefing */}
          <div className={`flex items-center gap-0.5 rounded-full p-0.5 shrink-0 ${floatingPillClass}`}>
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
              onClick={handleCycleTheme}
              title={`Current Theme: ${theme} (Tap to switch)`}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${floatingPillHoverClass}`}
            >
              <Palette size={14} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'archive' ? 'feed' : 'archive')}
              title={`Saved Swarms (${sessions.length})`}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                activeTab === 'archive'
                  ? 'bg-white text-black'
                  : floatingPillHoverClass
              }`}
            >
              <Archive size={14} strokeWidth={2} />
            </button>
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
                <span>Settings &amp; Themes ({selectedSwarmCount}/{enabledAgentsCount})</span>
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
                      <div className="text-[10px] text-[#71767b]">
                        {selectedSwarmCount} of {enabledAgentsCount} Specialists Armed
                      </div>
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
                        <div key={m.id}>
                          <button
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
                            {active && <Check size={12} className="text-emerald-400" />}
                          </button>
                          {m.id === 'genesis' && (
                            <div className="px-2.5 pb-1 text-[9.5px] text-violet-300/80 leading-snug">
                              {genesisUsageNote}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Agents in swarm selector inside Drawer */}
                  <div className="mt-2.5 pt-2.5 border-t border-white/[0.06] px-1 space-y-1.5 transition-all duration-300 ease-out">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#71767b]">
                        Agents in swarm
                      </span>
                      <span
                        key={`${swarmSize}-${isGenesisMode}`}
                        className="text-[10px] font-mono text-cyan-300 tabular-nums parallax-swarm-size-shift"
                      >
                        {isGenesisMode
                          ? `2 + ${genesisAgentCount}`
                          : `${selectedSwarmCount}/${enabledAgentsCount}`}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {PARALLAX_SWARM_SIZES.map((sz) => {
                        const active = swarmSize === sz;
                        return (
                          <button
                            key={sz}
                            type="button"
                            disabled={isRunning}
                            onClick={() => handleSwarmSizeChange(sz)}
                            className={`py-1 rounded-lg border text-[11px] font-mono font-semibold text-center transition-all duration-200 ease-out active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                              active
                                ? 'border-white bg-white text-black scale-[1.02] shadow-xs'
                                : 'border-[#26292e] bg-white/[0.03] text-[#8b9097] hover:text-white'
                            }`}
                          >
                            {sz}
                          </button>
                        );
                      })}
                    </div>
                    <div
                      key={`drawer-hint-${swarmSize}-${isFewerEnabledThanSelected}-${isGenesisMode}`}
                      className={`text-[10px] leading-snug transition-colors duration-300 parallax-swarm-size-shift ${
                        isFewerEnabledThanSelected
                          ? 'text-amber-300/90'
                          : isGenesisMode
                          ? 'text-violet-300/90'
                          : 'text-[#8b9097]'
                      }`}
                    >
                      {swarmSizeHintText}
                    </div>
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
                            setDebateMode(sess.debateMode || 'default');
                            setDynamicPersonas(sess.genesisAgents || []);
                            if (sess.swarmSize && isValidSwarmSize(sess.swarmSize)) {
                              handleSwarmSizeChange(sess.swarmSize);
                            } else if (sess.debateMode === 'genesis') {
                              const fallbackGenesisSize =
                                sess.genesisAgents && isValidSwarmSize(sess.genesisAgents.length + 2)
                                  ? ((sess.genesisAgents.length + 2) as ParallaxSwarmSize)
                                  : 20;
                              handleSwarmSizeChange(fallbackGenesisSize);
                            }
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
              activeSpeakingAgentId={voiceSpeakingMessage?.agentId}
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
                      <span className="text-[10px] text-[#71767b] font-mono tabular-nums">
                        {(() => {
                          const sessScored = sess.messages
                            .map((m) => getTurnConvictionPct(m))
                            .filter((v): v is number => v !== null);
                          const sessAvg =
                            sessScored.length > 0
                              ? Math.round(
                                  sessScored.reduce((a, b) => a + b, 0) / sessScored.length,
                                )
                              : null;
                          const sessMaxRounds =
                            sess.debateMode === 'genesis' || sess.roundsCompleted === 1 ? 1 : 3;
                          return `${sess.messages.length} turns · ${
                            sess.roundsCompleted || sessMaxRounds
                          }/${sessMaxRounds} round${sessMaxRounds === 1 ? '' : 's'}${
                            sessAvg !== null ? ` · ${sessAvg}% avg conviction` : ''
                          }`;
                        })()}
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
                              setDebateMode(sess.debateMode || 'default');
                              setDynamicPersonas(sess.genesisAgents || []);
                              if (sess.swarmSize && isValidSwarmSize(sess.swarmSize)) {
                                handleSwarmSizeChange(sess.swarmSize);
                              } else if (sess.debateMode === 'genesis') {
                                const fallbackGenesisSize =
                                  sess.genesisAgents && isValidSwarmSize(sess.genesisAgents.length + 2)
                                    ? ((sess.genesisAgents.length + 2) as ParallaxSwarmSize)
                                    : 20;
                                handleSwarmSizeChange(fallbackGenesisSize);
                              }
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
            {/* ==========================================================
                ALWAYS-ACCESSIBLE PROTOCOL BAR + 20-PERSONA LIVE ROSTER STRIP
               ========================================================== */}
            <div className="pt-1 pb-2 space-y-2 border-b border-white/[0.06]">
              {/* Row A: Horizontal Scrollable Swarm Protocol Selector + Swarm Size Chips + Surprise Deep-Dive */}
              <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-0.5">
                <div className="flex items-center gap-1 shrink-0">
                  {DEBATE_MODES.map((m) => {
                    const Icon = m.icon;
                    const active = debateMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        disabled={isRunning}
                        onClick={() => setDebateMode(m.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                          active
                            ? 'bg-white text-black font-semibold shadow-xs'
                            : 'text-[#8b9097] hover:text-white hover:bg-white/[0.05]'
                        }`}
                      >
                        <Icon size={12} />
                        <span>{m.shortLabel === 'Fast' ? 'Default Swarm' : m.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div
                    id="parallax-swarm-size-bar"
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-white/[0.03] border border-white/[0.07] transition-all duration-300 ease-out"
                    title={swarmSizeHintText}
                  >
                    <span className="text-[10px] font-mono text-[#8b9097] pl-0.5 pr-1">
                      Agents in swarm:
                    </span>
                    <div className="flex items-center gap-1">
                      {PARALLAX_SWARM_SIZES.map((sz) => {
                        const active = swarmSize === sz;
                        return (
                          <button
                            key={sz}
                            type="button"
                            disabled={isRunning}
                            onClick={() => handleSwarmSizeChange(sz)}
                            className={`min-w-[24px] px-1.5 py-0.5 rounded-md text-[10.5px] font-mono font-semibold transition-all duration-200 ease-out active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                              active
                                ? 'bg-white text-black scale-[1.03] shadow-2xs'
                                : 'text-[#8b9097] hover:text-white hover:bg-white/[0.06]'
                            }`}
                          >
                            {sz}
                          </button>
                        );
                      })}
                    </div>
                    <span
                      key={`bar-hint-${swarmSize}-${isFewerEnabledThanSelected}-${isGenesisMode}`}
                      className={`${
                        isFewerEnabledThanSelected
                          ? 'inline text-amber-300/90'
                          : isGenesisMode
                          ? 'inline text-violet-300/90'
                          : 'hidden lg:inline text-[#71767b]'
                      } text-[10px] pl-1 pr-0.5 transition-colors duration-300 parallax-swarm-size-shift`}
                    >
                      · {swarmSizeHintText}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={handleRandomDeepDive}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/10 flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                    title="Launch a random high-stakes multi-agent investigation"
                  >
                    <RefreshCw size={11} />
                    <span>Surprise Inquiry</span>
                  </button>
                </div>
              </div>

              {isGenesisMode && (
                <div className="text-[10px] font-mono text-violet-300/85 px-1">
                  {genesisUsageNote}
                </div>
              )}

              {/* Row B: Interactive Persona Live Roster Strip */}
              <div
                id="parallax-persona-roster-strip"
                className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 transition-all duration-300 ease-out"
              >
                <span
                  key={`roster-count-${swarmSize}-${isGenesisMode}-${dynamicPersonas.length}`}
                  className="text-[10px] font-mono text-[#71767b] shrink-0 pr-1 tabular-nums parallax-swarm-size-shift"
                >
                  {isGenesisMode
                    ? dynamicPersonas.length > 0
                      ? `${dynamicPersonas.length} Auto Agents:`
                      : `${genesisAgentCount} Auto Agents (Genesis):`
                    : `${selectedSwarmCount} of ${enabledAgentsCount} Active:`}
                </span>
                {rosterAgentsToRender.map((ag) => {
                  const recruited = recruitedAgents.find((r) => r.id === ag.id);
                  const score = recruited?.conviction ?? null;
                  const hasSpoken = (recruited?.turns.length || 0) > 0;
                  const isVoiceSpeaking = voiceSpeakingMessage?.agentId === ag.id;
                  const isActiveSpeaker = activeSpeakingAgent?.agentId === ag.id;
                  const isInspected = inspectedRosterAgentId === ag.id;
                  const isSelectedForSwarm =
                    Boolean(ag.isDynamic) || isGenesisMode || selectedSwarmAgentIds.has(ag.id);
                  const isBenched = !isSelectedForSwarm && !hasSpoken && !isInspected;
                  const isIdle = isSelectedForSwarm && !hasSpoken && !isActiveSpeaker && !isInspected;
                  const cleanName = ag.name.split(' (')[0];
                  const accentHex = ag.accentColor || '#61d7c9';

                  const SIDE_HEX_MAP: Record<string, string> = {
                    prosecution: '#f43f5e',
                    defense: '#38bdf8',
                    judge: '#f59e0b',
                    red: '#f43f5e',
                    blue: '#38bdf8',
                    referee: '#a855f7',
                    security: '#f43f5e',
                    innovation: '#38bdf8',
                    economy: '#f59e0b',
                    ethics: '#10b981',
                    market: '#38bdf8',
                    tech: '#a855f7',
                    finance: '#f59e0b',
                    risk: '#f43f5e',
                  };
                  const lastTurnSide =
                    recruited && recruited.turns.length > 0
                      ? recruited.turns[recruited.turns.length - 1]?.side
                      : undefined;
                  const assignedSide =
                    debateMode !== 'default' && debateMode !== 'genesis'
                      ? lastTurnSide || (isSelectedForSwarm ? modeSideAssignments.get(ag.id)?.side : undefined)
                      : undefined;
                  const sideRingColor = assignedSide
                    ? SIDE_HEX_MAP[assignedSide] || modeSideAssignments.get(ag.id)?.color || accentHex
                    : null;

                  return (
                    <button
                      key={ag.id}
                      type="button"
                      onClick={() =>
                        setInspectedRosterAgentId((prev) => (prev === ag.id ? null : ag.id))
                      }
                      style={
                        isBenched
                          ? { boxShadow: 'none', filter: 'none' }
                          : {
                              boxShadow: isActiveSpeaker
                                ? `0 0 14px ${accentHex}45`
                                : isIdle
                                ? `0 0 8px ${accentHex}18`
                                : `0 0 11px ${accentHex}30`,
                            }
                      }
                      className={`px-2 py-1 rounded-lg text-[10.5px] font-mono flex items-center gap-1.5 shrink-0 transition-all duration-300 ease-out cursor-pointer border ${
                        isBenched
                          ? 'opacity-35 scale-[0.97]'
                          : isIdle
                          ? 'opacity-80 scale-100'
                          : 'opacity-100 scale-100'
                      } ${
                        isInspected
                          ? 'bg-white/15 border-white/40 text-white font-semibold'
                          : isVoiceSpeaking || isActiveSpeaker
                          ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200 font-semibold'
                          : hasSpoken
                          ? 'bg-emerald-500/10 border-emerald-500/25 text-white'
                          : 'bg-white/[0.02] border-white/[0.06] text-[#a1a1aa] hover:text-white hover:border-white/20'
                      }`}
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 12 12"
                        style={
                          isBenched
                            ? undefined
                            : ({
                                '--star-glow': `${accentHex}cc`,
                                filter: `drop-shadow(0 0 ${isActiveSpeaker ? '12px' : '9px'} ${accentHex}${
                                  isActiveSpeaker ? 'aa' : '66'
                                })`,
                              } as React.CSSProperties)
                        }
                        className={`shrink-0 overflow-visible ${
                          isActiveSpeaker && !isBenched ? 'parallax-agent-star-pulse' : ''
                        }`}
                        aria-hidden="true"
                      >
                        {sideRingColor && (
                          <circle
                            cx="6"
                            cy="6"
                            r="5.6"
                            fill="none"
                            stroke={sideRingColor}
                            strokeWidth="0.95"
                            strokeOpacity={isBenched ? 0.3 : 0.9}
                          />
                        )}
                        <circle
                          cx="6"
                          cy="6"
                          r={sideRingColor ? '4.2' : '4.8'}
                          fill="none"
                          stroke={accentHex}
                          strokeWidth="1.1"
                          strokeDasharray={isVoiceSpeaking || isActiveSpeaker || hasSpoken ? 'none' : '2.5 2'}
                          strokeOpacity={
                            isBenched ? 0.25 : isVoiceSpeaking || isActiveSpeaker ? 1 : hasSpoken ? 0.85 : 0.5
                          }
                        />
                        <circle
                          cx="6"
                          cy="6"
                          r={isVoiceSpeaking || isActiveSpeaker ? '2.5' : '2'}
                          fill={accentHex}
                          opacity={isBenched ? 0.35 : isVoiceSpeaking || isActiveSpeaker || hasSpoken ? 1 : 0.65}
                        />
                      </svg>
                      <span className="truncate max-w-[80px]">{cleanName}</span>
                      <span
                        className={`tabular-nums ${
                          isVoiceSpeaking
                            ? 'text-cyan-300'
                            : score !== null
                            ? 'text-emerald-300'
                            : 'text-[#71767b]'
                        }`}
                      >
                        {isVoiceSpeaking
                          ? 'Speaking'
                          : score !== null
                          ? `${score}%`
                          : hasSpoken
                          ? `${recruited?.turns.length}R`
                          : isSelectedForSwarm
                          ? 'Standby'
                          : 'Benched'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Inline Specialist Dossier Inspector when a Persona in the Roster is tapped */}
              {inspectedRosterAgent && (
                <div className={`p-3 text-xs space-y-2 ${hairlineTableCardClass} divide-y-0`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs sm:text-sm">
                          {inspectedRosterAgent.name}
                        </span>
                        <span className="text-[10.5px] text-[#8b9097]">
                          · {inspectedRosterAgent.role}
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-[#a1a1aa] leading-relaxed mt-1 m-0">
                        {inspectedRosterAgent.systemInstruction}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInspectedRosterAgentId(null)}
                      className="text-[#71767b] hover:text-white p-1 cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-2 pt-1.5 border-t border-white/[0.06]">
                    <span className="text-[10px] font-mono text-[#71767b]">
                      Model: {inspectedRosterAgent.modelId || 'Built-in Default'} ·{' '}
                      {inspectedRosterAgent.id === 'veritas' ? 'Live Web Search (R1)' : 'Reasoning Node'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handlePlayMessageAudio({
                            id: `preview-${inspectedRosterAgent.id}`,
                            agentId: inspectedRosterAgent.id,
                            agentName: inspectedRosterAgent.name,
                            initials: inspectedRosterAgent.name.slice(0, 2),
                            accentColor: inspectedRosterAgent.accentColor,
                            round: 1,
                            text: `I am ${inspectedRosterAgent.name}, focusing on ${inspectedRosterAgent.role}. ${inspectedRosterAgent.systemInstruction}`,
                            timestamp: Date.now(),
                            voice: inspectedRosterAgent.voice,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[10.5px] font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <Play size={10} />
                        <span>
                          {playingAudioKey === `preview-${inspectedRosterAgent.id}`
                            ? 'Stop Voice'
                            : 'Preview Voice'}
                        </span>
                      </button>
                      {!isRunning && (
                        <button
                          type="button"
                          onClick={() => {
                            const customPrompt = `From a ${inspectedRosterAgent.role.toLowerCase()} perspective, evaluate the highest-impact global risks and breakthroughs for 2026–2030.`;
                            setInspectedRosterAgentId(null);
                            handleStartSwarm(customPrompt);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white text-black text-[10.5px] font-semibold cursor-pointer hover:bg-zinc-200"
                        >
                          Launch Domain Inquiry
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {/* Row C: Unified Intelligence & Collapsible Telemetry / Matrix / Briefing Drawer Bar */}
              <div
                id="parallax-unified-drawers-bar"
                className="flex items-center justify-between gap-2 flex-wrap pt-1"
              >
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
                  <button
                    id="parallax-toggle-telemetry-drawer-btn"
                    type="button"
                    onClick={() => setIsTelemetryDrawerOpen((prev) => !prev)}
                    className={`min-h-[34px] px-2.5 sm:px-3 py-1 rounded-xl text-[11px] sm:text-xs font-medium flex items-center gap-1.5 shrink-0 transition-all cursor-pointer border ${
                      isTelemetryDrawerOpen
                        ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200 font-semibold'
                        : 'bg-white/[0.03] border-white/[0.07] text-slate-300 hover:text-white hover:border-white/20'
                    }`}
                  >
                    <Activity size={13} className="text-cyan-400 shrink-0" />
                    <span>Telemetry</span>
                    <span className="font-mono text-[10.5px] text-slate-400 tabular-nums">
                      ({agentTurnsCount}/{expectedMaxReplies})
                    </span>
                    <ChevronDown
                      size={12}
                      className={`transition-transform ${isTelemetryDrawerOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  <button
                    id="parallax-toggle-matrix-drawer-btn"
                    type="button"
                    onClick={() => setIsMatrixDrawerOpen((prev) => !prev)}
                    className={`min-h-[34px] px-2.5 sm:px-3 py-1 rounded-xl text-[11px] sm:text-xs font-medium flex items-center gap-1.5 shrink-0 transition-all cursor-pointer border ${
                      isMatrixDrawerOpen
                        ? 'bg-violet-500/20 border-violet-400/50 text-violet-200 font-semibold'
                        : 'bg-white/[0.03] border-white/[0.07] text-slate-300 hover:text-white hover:border-white/20'
                    }`}
                  >
                    <Bot size={13} className="text-violet-400 shrink-0" />
                    <span>Agent Matrix</span>
                    <span className="font-mono text-[10.5px] text-slate-400 tabular-nums">
                      ({respondedAgentsCount}/{totalActivePoolCount} responded)
                    </span>
                    <ChevronDown
                      size={12}
                      className={`transition-transform ${isMatrixDrawerOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  <button
                    id="parallax-toggle-briefing-drawer-btn"
                    type="button"
                    onClick={() => setIsBriefingDrawerOpen((prev) => !prev)}
                    className={`min-h-[34px] px-2.5 sm:px-3 py-1 rounded-xl text-[11px] sm:text-xs font-medium flex items-center gap-1.5 shrink-0 transition-all cursor-pointer border ${
                      isBriefingDrawerOpen
                        ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200 font-semibold'
                        : 'bg-white/[0.03] border-white/[0.07] text-slate-300 hover:text-white hover:border-white/20'
                    }`}
                  >
                    <Globe size={13} className="text-emerald-400 shrink-0" />
                    <span>VERITAS Grounding</span>
                    <span className="font-mono text-[10.5px] text-slate-400 tabular-nums">
                      ({groundingTelemetry.count !== null ? groundingTelemetry.count : '—'})
                    </span>
                    <ChevronDown
                      size={12}
                      className={`transition-transform ${isBriefingDrawerOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>

                {/* Live KPI Summary Readout */}
                <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-400 tabular-nums">
                  <span>
                    Avg Conviction:{' '}
                    <strong className="text-cyan-300">
                      {polarityStats.avg !== null ? `${polarityStats.avg}%` : '—'}
                    </strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Speaking: <strong className="text-white">{speakingAgentsCount}</strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Mode: <strong className="text-white">{currentModeObj.shortLabel}</strong>
                  </span>
                </div>
              </div>

              {/* Collapsible Drawer 1: Live Telemetry, Conviction Shift Chart & Swarm Constellation */}
              {isTelemetryDrawerOpen && (
                <div className={`p-2.5 sm:p-4 space-y-4 animate-fadeIn min-w-0 overflow-hidden ${hairlineTableCardClass} divide-y-0`}>
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-white min-w-0">
                      <Activity size={14} className="text-cyan-400 shrink-0" />
                      <span className="truncate">Swarm Telemetry, Conviction Trajectory &amp; Constellation</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsTelemetryDrawerOpen(false)}
                      className="text-slate-400 hover:text-white p-1 cursor-pointer shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <ParallaxTelemetry
                    configuredAgentsCount={configuredAgentsCount}
                    enabledAgentsCount={selectedSwarmCount}
                    dynamicSpecialistsCount={dynamicSpecialistsCount}
                    respondedAgentsCount={respondedAgentsCount}
                    currentRoundRespondedCount={currentRoundRespondedCount}
                    speakingAgentsCount={speakingAgentsCount}
                    completedRepliesCount={agentTurnsCount}
                    expectedMaxReplies={expectedMaxReplies}
                    currentRound={currentRound}
                    sourcesCount={groundingTelemetry.count}
                    sourcesSubtext={groundingTelemetry.subtext}
                    avgConviction={
                      polarityStats.avg !== null
                        ? `${polarityStats.avg}% (${(polarityStats.avg / 10).toFixed(1)}/10)`
                        : null
                    }
                    avgConvictionSubtext={
                      polarityStats.scoredCount > 0
                        ? `Across ${polarityStats.scoredCount} scored agent${polarityStats.scoredCount === 1 ? '' : 's'}`
                        : isRunning
                        ? 'Awaiting scored turns...'
                        : 'No scored turns yet'
                    }
                    isRunning={isRunning}
                    isComplete={Boolean(summary)}
                    wasStoppedEarly={wasStoppedEarly}
                    activeModel={config.agents.veritas?.modelId || 'Built-in Default'}
                  />

                  <ParallaxConvictionChart messages={messages} />

                  <ParallaxSwarmConstellation
                    agents={config.agents}
                    messages={messages}
                    currentRound={currentRound}
                    isRunning={isRunning}
                    activeSpeakingAgentId={activeSpeakingAgent?.agentId}
                    selectedAgentId={selectedAgentFilter}
                    onSelectAgent={(id) => setSelectedAgentFilter(id)}
                    topic={currentTopic || 'Swarm Standby'}
                    selectedSwarmAgentIds={selectedSwarmAgentIds}
                    sideAssignments={
                      debateMode !== 'default' && debateMode !== 'genesis'
                        ? modeSideAssignments
                        : undefined
                    }
                    dynamicPersonas={dynamicPersonas}
                    debateMode={debateMode}
                  />
                </div>
              )}

              {/* Collapsible Drawer 2: 20-Persona Agent Matrix */}
              {isMatrixDrawerOpen && (
                <div className={`p-2.5 sm:p-4 animate-fadeIn min-w-0 overflow-hidden ${hairlineTableCardClass} divide-y-0`}>
                  <ParallaxAgentMatrix
                    agents={config.agents}
                    messages={messages}
                    selectedAgentId={selectedAgentFilter}
                    activeSpeakingAgentId={voiceSpeakingMessage?.agentId}
                    onSelectAgent={(agentId) => setSelectedAgentFilter(agentId)}
                    dynamicPersonas={dynamicPersonas}
                    onPlayVoice={handlePlayMessageAudio}
                  />
                </div>
              )}

              {/* Collapsible Drawer 3: Round 00 VERITAS Intelligence Briefing */}
              {isBriefingDrawerOpen && (
                <div className={`p-2.5 sm:p-4 animate-fadeIn min-w-0 overflow-hidden ${hairlineTableCardClass} divide-y-0`}>
                  {intelligenceBriefing ? (
                    <ParallaxIntelligenceBriefing
                      briefing={intelligenceBriefing}
                      defaultExpanded={true}
                    />
                  ) : (
                    <div className="flex items-start sm:items-center justify-between gap-2.5 py-2 text-xs text-slate-300">
                      <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                        <Globe size={15} className="text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                        <span className="leading-relaxed">
                          <strong>VERITAS Live Web Grounding (Round 00):</strong> No grounding briefing generated yet. Launch a swarm mission below to verify live web sources.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsBriefingDrawerOpen(false)}
                        className="text-slate-400 hover:text-white p-1 cursor-pointer shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!hasActiveMission ? (
              /* ==========================================================
                 CREATIVE IDLE STATE: COMPACT MOBILE-FRIENDLY BENCHMARK TABLE + NOTES
                 ========================================================== */
              <div className="flex-1 flex flex-col justify-center py-3 sm:py-4 space-y-4 sm:space-y-5 select-text">
                {/* Editorial Headline & Concise Lead + Live 20-Node Holographic Singularity Emblem */}
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[11px] font-mono text-[#8b9097]">
                      <span>Parallax Multi-Agent Synthesis</span>
                      <span aria-hidden="true">·</span>
                      <span>{currentModeObj.label}</span>
                      <span aria-hidden="true">·</span>
                      <span>{isGenesisMode ? 'Round 1 of 1' : '3 Rounds'}</span>
                    </div>

                    <h1 className="text-[18px] sm:text-[24px] font-semibold text-white tracking-tight leading-snug text-balance m-0">
                      {isGenesisMode
                        ? `${genesisAgentCount} auto-created minds. One ZENITH synthesis.`
                        : `${selectedSwarmCount} specialized minds. One empirical synthesis.`}
                    </h1>
                    <p className="text-xs sm:text-[13.5px] text-[#8b9097] leading-relaxed max-w-[640px] m-0">
                      {isGenesisMode
                        ? `Assign any research question. ARCHITECT designs ${genesisAgentCount} custom specialists for your topic, runs targeted web searches in 1 round, and ZENITH synthesizes the complete answer.`
                        : `Assign any research question or global dataset. Parallax mobilizes ${selectedSwarmCount} independent personas across Thesis (Round 1), Cross-Examination (Round 2), and Ranked Conviction Convergence (Round 3).`}
                    </p>
                  </div>

                  {/* Bespoke Holographic Neural Interferometer Graphic */}
                  <div
                    aria-hidden="true"
                    className="relative shrink-0 w-[92px] h-[92px] sm:w-[126px] sm:h-[126px] pointer-events-none select-none flex items-center justify-center"
                  >
                    <svg viewBox="0 0 140 140" className="w-full h-full overflow-visible">
                      <defs>
                        <radialGradient id="pxHeroSingularityGlow" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.45" />
                          <stop offset="45%" stopColor="#38bdf8" stopOpacity="0.18" />
                          <stop offset="78%" stopColor="#a855f7" stopOpacity="0.08" />
                          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                        </radialGradient>
                      </defs>

                      {/* Core Aura */}
                      <circle cx="70" cy="70" r="64" fill="url(#pxHeroSingularityGlow)" />

                      {/* Outer Astrometric Degree Ring */}
                      <g style={{ transformOrigin: '70px 70px' }} className="parallax-gfx-spin">
                        <circle
                          cx="70"
                          cy="70"
                          r="60"
                          fill="none"
                          stroke="rgba(97, 215, 201, 0.28)"
                          strokeWidth="1.5"
                          strokeDasharray="1.5 4.5"
                        />
                        <circle
                          cx="70"
                          cy="70"
                          r="52"
                          fill="none"
                          stroke="rgba(56, 189, 248, 0.22)"
                          strokeWidth="0.9"
                          strokeDasharray="10 5 2 5"
                        />
                        {(dynamicPersonas.length > 0 ? dynamicPersonas : selectedSwarmAgents)
                          .slice(0, 12)
                          .map((ag, idx, arr) => {
                            const angle = (idx / Math.max(1, arr.length)) * Math.PI * 2;
                            const nx = 70 + Math.cos(angle) * 52;
                            const ny = 70 + Math.sin(angle) * 52;
                            const accentHex = ag.accentColor || '#61d7c9';
                            const sideColor =
                              debateMode !== 'default' && debateMode !== 'genesis'
                                ? modeSideAssignments.get(ag.id)?.color || accentHex
                                : null;
                            return (
                              <g key={ag.id}>
                                <line
                                  x1="70"
                                  y1="70"
                                  x2={nx}
                                  y2={ny}
                                  stroke={accentHex}
                                  strokeWidth="0.55"
                                  strokeOpacity="0.24"
                                />
                                {sideColor && (
                                  <circle
                                    cx={nx}
                                    cy={ny}
                                    r="4.2"
                                    fill="none"
                                    stroke={sideColor}
                                    strokeWidth="0.9"
                                    strokeOpacity="0.85"
                                  />
                                )}
                                <circle
                                  cx={nx}
                                  cy={ny}
                                  r="2.6"
                                  fill={accentHex}
                                  style={{ filter: `drop-shadow(0 0 8px ${accentHex})` }}
                                />
                              </g>
                            );
                          })}
                      </g>

                      {/* Inner Counter-Spinning Specialist Ring */}
                      <g style={{ transformOrigin: '70px 70px' }} className="parallax-gfx-spin-reverse">
                        <circle
                          cx="70"
                          cy="70"
                          r="34"
                          fill="none"
                          stroke="rgba(192, 132, 252, 0.32)"
                          strokeWidth="1"
                          strokeDasharray="5 4"
                        />
                        {(dynamicPersonas.length > 0 ? dynamicPersonas : selectedSwarmAgents)
                          .slice(12, 20)
                          .map((ag, idx, arr) => {
                            const angle = (idx / Math.max(1, arr.length)) * Math.PI * 2;
                            const nx = 70 + Math.cos(angle) * 34;
                            const ny = 70 + Math.sin(angle) * 34;
                            const accentHex = ag.accentColor || '#c084fc';
                            const sideColor =
                              debateMode !== 'default' && debateMode !== 'genesis'
                                ? modeSideAssignments.get(ag.id)?.color || accentHex
                                : null;
                            return (
                              <g key={ag.id}>
                                {sideColor && (
                                  <circle
                                    cx={nx}
                                    cy={ny}
                                    r="3.9"
                                    fill="none"
                                    stroke={sideColor}
                                    strokeWidth="0.9"
                                    strokeOpacity="0.85"
                                  />
                                )}
                                <circle
                                  cx={nx}
                                  cy={ny}
                                  r="2.4"
                                  fill={accentHex}
                                  style={{ filter: `drop-shadow(0 0 8px ${accentHex})` }}
                                />
                              </g>
                            );
                          })}
                      </g>

                      {/* Central Relativistic Singularity Core */}
                      <g style={{ transformOrigin: '70px 70px' }} className="parallax-gfx-core-pulse">
                        <circle
                          cx="70"
                          cy="70"
                          r="15"
                          fill="#05131d"
                          stroke="#61d7c9"
                          strokeWidth="1.5"
                        />
                        <circle cx="70" cy="70" r="6" fill="#61d7c9" opacity="0.9" />
                        <circle cx="70" cy="70" r="2.5" fill="#ffffff" />
                      </g>
                    </svg>
                  </div>
                </div>

                {/* Interactive Hairline Preview Table with Category Filter Tabs */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2 px-0.5">
                    <div className="flex items-center gap-1">
                      {(
                        [
                          { id: 'all', label: 'All Benchmarks' },
                          { id: 'geopolitics', label: 'Geopolitics' },
                          { id: 'markets', label: 'Markets & AI' },
                          { id: 'science', label: 'Science & Space' },
                        ] as const
                      ).map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setBenchmarkCategory(cat.id)}
                          className={`px-2 py-1 rounded-lg text-[10.5px] sm:text-[11px] font-medium transition-colors cursor-pointer ${
                            benchmarkCategory === cat.id
                              ? 'bg-white/12 text-white font-semibold'
                              : 'text-[#71767b] hover:text-white'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                    <span className="text-[10.5px] sm:text-[11px] font-mono text-[#71767b]">
                      Conviction
                    </span>
                  </div>

                  <div className={hairlineTableCardClass}>
                    {filteredShowcasePresets.map((preset, idx) => {
                      const ringCircumference = 2 * Math.PI * 7.5;
                      const ringDashOffset =
                        ringCircumference - (preset.convictionNum / 100) * ringCircumference;
                      return (
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
                            <span className="text-xs sm:text-[13.5px] font-mono text-[#8b9097] tabular-nums w-5 shrink-0">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs sm:text-[13.5px] font-medium text-white group-hover:text-emerald-300 transition-colors truncate">
                                  {preset.title}
                                </span>
                                <span className="hidden sm:inline text-[10.5px] text-[#71767b] shrink-0">
                                  · {preset.badge}
                                </span>
                              </div>
                              <div className="text-[10.5px] sm:text-xs text-[#71767b] truncate mt-0.5">
                                {preset.subtitle}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            {/* Harmonic Telemetry Waveform Sparkline (Desktop/Tablet) */}
                            <svg
                              width="38"
                              height="16"
                              viewBox="0 0 38 16"
                              className="hidden md:block shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
                              aria-hidden="true"
                            >
                              <path
                                d={
                                  idx % 3 === 0
                                    ? 'M 1 12 Q 7 4, 13 9 T 25 5 T 37 3'
                                    : idx % 3 === 1
                                    ? 'M 1 13 Q 8 10, 14 6 T 26 7 T 37 2'
                                    : 'M 1 11 Q 9 3, 16 8 T 28 4 T 37 2'
                                }
                                fill="none"
                                stroke={preset.accent}
                                strokeWidth="1.5"
                                strokeLinecap="round"
                              />
                              <circle cx="37" cy={idx % 3 === 0 ? 3 : 2} r="2" fill={preset.accent} />
                            </svg>

                            <div className="hidden sm:flex w-14 h-1 rounded-full bg-white/[0.07] overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${preset.convictionNum}%`,
                                  backgroundColor: preset.accent,
                                  boxShadow: `0 0 8px ${preset.accent}`,
                                }}
                              />
                            </div>

                            {/* Radial Conviction Ring Gauge */}
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 20 20"
                              className="shrink-0 -rotate-90"
                              aria-hidden="true"
                            >
                              <circle
                                cx="10"
                                cy="10"
                                r="7.5"
                                fill="none"
                                stroke="rgba(255,255,255,0.08)"
                                strokeWidth="2"
                              />
                              <circle
                                cx="10"
                                cy="10"
                                r="7.5"
                                fill="none"
                                stroke={preset.accent}
                                strokeWidth="2"
                                strokeDasharray={ringCircumference}
                                strokeDashoffset={ringDashOffset}
                                strokeLinecap="round"
                              />
                            </svg>

                            <span className="text-xs sm:text-[13.5px] font-mono text-[#e7e9ea] tabular-nums w-9 text-right">
                              {preset.convictionNum}%
                            </span>
                            <ChevronRight size={14} className="text-[#71767b] group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Editorial "Notes:" Preview Section on Idle (Mobile-friendly text size) */}
                <div className="space-y-2 pt-0.5">
                  <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight m-0">
                    Notes:
                  </h2>
                  <ul className="list-disc pl-4 sm:pl-5 space-y-1.5 text-xs sm:text-[13px] text-[#e7e9ea] leading-relaxed m-0">
                    <li>
                      Data and conviction scores are synthesized directly from {selectedSwarmCount} autonomous domain personas (including VERITAS live web verification, AXIOM logic, and LEDGER economics).
                    </li>
                    <li>
                      Cross-examination in Round 2 automatically challenges unverified assumptions and adjusts initial confidence ratings before Round 3 convergence.
                    </li>
                  </ul>
                  <p className="text-[11px] sm:text-xs text-[#a1a1aa] pt-0.5 m-0">
                    Source: Parallax {selectedSwarmCount}-Agent Multi-Round Deliberation Pipeline ({currentModeObj.label}).
                  </p>
                </div>
              </div>
            ) : (
              /* ==========================================================
                 ACTIVE / COMPLETED SWARM VIEW (MOBILE-FRIENDLY SIZING + FULL TELEMETRY)
                 ========================================================== */
              <div className="flex-1 py-2.5 sm:py-3.5 space-y-4 select-text">
                {/* 1. User Prompt Pill (Right-aligned subtle dark bubble) */}
                <div className="flex justify-end">
                  <div className="rounded-2xl bg-[#16181c] border border-[#26292e] text-white px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-[13.5px] leading-relaxed max-w-[92%] sm:max-w-[80%]">
                    {currentTopic}
                  </div>
                </div>

                {/* 2. Live 3-Round Stepper & Action Controls Bar */}
                <div className={`p-2.5 sm:p-3 ${hairlineTableCardClass} divide-y-0 space-y-2.5`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {isRunning && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                      )}
                      <span className="text-[10.5px] sm:text-xs font-mono text-[#e7e9ea] truncate">
                        {isRunning
                          ? statusText
                          : wasStoppedEarly
                          ? `Swarm Stopped Early · ${agentTurnsCount}/${expectedMaxReplies} Turns · ${
                              polarityStats.avg !== null ? `${polarityStats.avg}% Avg Conviction` : 'No Scores'
                            }`
                          : `Deliberation Complete · ${agentTurnsCount}/${expectedMaxReplies} Turns · ${
                              polarityStats.avg !== null ? `${polarityStats.avg}% Avg Conviction` : 'No Scores'
                            }`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap">
                      {messages.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={handleCopyFullSwarm}
                            className="px-2 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-[10.5px] sm:text-[11px] text-[#e7e9ea] flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            {copiedSwarmTranscript ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                            <span>{copiedSwarmTranscript ? 'Copied' : 'Copy'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleDownloadSwarmMp3}
                            disabled={isDownloadingSwarmMp3}
                            className="px-2 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-[10.5px] sm:text-[11px] text-[#e7e9ea] flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                          >
                            <Download size={11} />
                            <span>{isDownloadingSwarmMp3 ? 'MP3...' : 'MP3'}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Round Pipeline Progress Stepper with Synaptic Node Graphics */}
                  <div
                    className={`grid ${
                      isGenesisMode ? 'grid-cols-1' : 'grid-cols-3'
                    } gap-1.5 pt-1 border-t border-white/[0.06]`}
                  >
                    {(isGenesisMode
                      ? [
                          {
                            r: 1,
                            title: `Round 1 of 1 · Genesis Swarm (ARCHITECT + ${genesisAgentCount} Auto Agents + ZENITH)`,
                            count: messages.filter((m) => m.round === 1).length,
                            color: '#a78bfa',
                          },
                        ]
                      : [
                          {
                            r: 1,
                            title: '01. Thesis & Grounding',
                            count: messages.filter((m) => m.round === 1).length,
                            color: '#06b6d4',
                          },
                          {
                            r: 2,
                            title: '02. Cross-Examination',
                            count: messages.filter((m) => m.round === 2).length,
                            color: '#a855f7',
                          },
                          {
                            r: 3,
                            title: '03. Final Convergence',
                            count: messages.filter((m) => m.round === 3).length,
                            color: '#10b981',
                          },
                        ]
                    ).map((step) => {
                      const isCurrent = isRunning && currentRound === step.r;
                      const isDone =
                        Boolean(summary) ||
                        (currentRound !== null && currentRound > step.r) ||
                        step.count > 0;
                      return (
                        <div
                          key={step.r}
                          className={`px-2 py-1.5 rounded-lg border text-[10px] sm:text-[11px] flex items-center justify-between gap-1.5 ${
                            isCurrent
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-white font-semibold'
                              : isDone
                              ? 'border-white/[0.08] bg-white/[0.03] text-[#e7e9ea]'
                              : 'border-white/[0.04] bg-transparent text-[#71767b]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 16 16"
                              className="shrink-0"
                              aria-hidden="true"
                            >
                              <circle
                                cx="8"
                                cy="8"
                                r="6.2"
                                fill="none"
                                stroke={isCurrent ? '#34d399' : isDone ? step.color : '#52525b'}
                                strokeWidth="1.3"
                                strokeDasharray={isCurrent ? '4 2' : 'none'}
                                className={isCurrent ? 'parallax-gfx-spin' : ''}
                              />
                              <circle
                                cx="8"
                                cy="8"
                                r="2.6"
                                fill={isCurrent ? '#34d399' : isDone ? step.color : '#3f3f46'}
                              />
                            </svg>
                            <span className="truncate">{step.title}</span>
                          </div>
                          <span className="font-mono tabular-nums text-[10px] text-[#8b9097] shrink-0">
                            {step.count}t
                          </span>
                        </div>
                      );
                    })}
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

                {/* CONTINUOUS LIVE CHAT DELIBERATION STREAM + BRIEFING & SYNTHESIS */}
                <div className="space-y-3.5">
                  {intelligenceBriefing && (
                    <div className={`p-3 sm:p-4 ${hairlineTableCardClass} divide-y-0`}>
                      <ParallaxIntelligenceBriefing
                        briefing={intelligenceBriefing}
                        defaultExpanded={false}
                      />
                    </div>
                  )}

                  <div className={`p-2.5 sm:p-4 ${hairlineTableCardClass} divide-y-0`}>
                    <ParallaxDeliberationStream
                      messages={messages}
                      agents={config.agents}
                      isRunning={isRunning}
                      currentRound={currentRound}
                      wasStoppedEarly={wasStoppedEarly}
                      specialistDeliberation={specialistDeliberation}
                      debateMode={debateMode}
                      roundFilter={roundFilter}
                      groupFilter={groupFilter}
                      selectedAgentFilter={selectedAgentFilter}
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
                </div>

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
            <div id="parallax-input-container" className="sticky bottom-1.5 z-30">
              {/* Popover 1: Paperclip / Quick Tasks & Human Directive Menu */}
              {isPlusMenuOpen && (
                <div className={`mb-1.5 p-2.5 rounded-2xl space-y-1.5 animate-fadeIn ${composerBoxClass}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white">
                      Quick Swarm Tasks &amp; Directives
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsPlusMenuOpen(false)}
                      className="text-[#71767b] hover:text-white cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  <div className="space-y-0.5 max-h-44 overflow-y-auto no-scrollbar">
                    {SAMPLE_TOPICS.map((t, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setTopicInput(t);
                          handleStartSwarm(t);
                        }}
                        className="w-full text-left px-2 py-1 rounded-xl hover:bg-white/[0.06] text-[11px] text-[#e7e9ea] truncate flex items-center gap-1.5 cursor-pointer"
                      >
                        <Globe size={11} className="text-emerald-400 shrink-0" />
                        <span className="truncate">{t}</span>
                      </button>
                    ))}
                  </div>

                  {isRunning && (
                    <div className="pt-1 border-t border-white/[0.08]">
                      <button
                        type="button"
                        onClick={() => {
                          setIsPlusMenuOpen(false);
                          setIsHumanModalOpen(true);
                        }}
                        className="w-full py-1 px-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-200 text-[10.5px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <UserPlus size={11} />
                        <span>Inject Operator Directive (Round 0{currentRound || 1})</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Popover 2: "⚡ Fast ∨" Swarm Mode / Protocol & Swarm Size Selector */}
              {isModeSelectorOpen && (
                <div className={`mb-1.5 p-2 rounded-2xl space-y-1 animate-fadeIn ${composerBoxClass}`}>
                  <div className="flex items-center justify-between px-2 pb-0.5">
                    <span className="text-[9.5px] font-mono uppercase tracking-wider text-[#71767b]">
                      Select Swarm Execution Mode
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsModeSelectorOpen(false)}
                      className="text-[#71767b] hover:text-white cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  {DEBATE_MODES.map((m) => {
                    const Icon = m.icon;
                    const active = debateMode === m.id;
                    const displaySpeedTag =
                      m.id === 'default'
                        ? `${selectedSwarmCount} Agents · 3 Rounds`
                        : m.id === 'genesis'
                        ? `Self-Building Swarm · ${genesisAgentCount} Auto Agents · 1 Round`
                        : m.speedTag;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        disabled={isRunning}
                        onClick={() => {
                          setDebateMode(m.id);
                          setIsModeSelectorOpen(false);
                        }}
                        className={`w-full px-2 py-1.5 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer disabled:opacity-50 ${
                          active
                            ? 'bg-white/[0.1] text-white'
                            : 'hover:bg-white/[0.05] text-[#a1a1aa]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon size={12} className={active ? 'text-white' : 'text-[#71767b]'} />
                          <div>
                            <div className="text-[11px] font-semibold text-white">{m.label}</div>
                            <div className="text-[9.5px] text-[#71767b]">{displaySpeedTag}</div>
                            {m.id === 'genesis' && (
                              <div className="text-[9px] text-violet-300/85 mt-0.5">
                                {genesisUsageNote}
                              </div>
                            )}
                          </div>
                        </div>
                        {active && <Check size={12} className="text-emerald-400" />}
                      </button>
                    );
                  })}

                  {/* Agents in swarm selector inside Composer Mode Popover */}
                  <div className="pt-1.5 mt-1 border-t border-white/[0.08] px-2 space-y-1.5 transition-all duration-300 ease-out">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9.5px] font-mono uppercase tracking-wider text-[#71767b]">
                        Agents in swarm
                      </span>
                      <span
                        key={`${swarmSize}-${isGenesisMode}`}
                        className="text-[10px] font-mono text-cyan-300 tabular-nums parallax-swarm-size-shift"
                      >
                        {isGenesisMode
                          ? `2 + ${genesisAgentCount}`
                          : `${selectedSwarmCount} of ${enabledAgentsCount} active`}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {PARALLAX_SWARM_SIZES.map((sz) => {
                        const active = swarmSize === sz;
                        return (
                          <button
                            key={sz}
                            type="button"
                            disabled={isRunning}
                            onClick={() => handleSwarmSizeChange(sz)}
                            className={`py-1 rounded-lg border text-[11px] font-mono font-semibold text-center transition-all duration-200 ease-out active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                              active
                                ? 'border-white bg-white text-black scale-[1.02] shadow-xs'
                                : 'border-[#26292e] bg-white/[0.03] text-[#8b9097] hover:text-white'
                            }`}
                          >
                            {sz}
                          </button>
                        );
                      })}
                    </div>
                    <div
                      key={`composer-hint-${swarmSize}-${isFewerEnabledThanSelected}-${isGenesisMode}`}
                      className={`text-[10px] pb-0.5 transition-colors duration-300 parallax-swarm-size-shift ${
                        isFewerEnabledThanSelected
                          ? 'text-amber-300/90'
                          : isGenesisMode
                          ? 'text-violet-300/90'
                          : 'text-[#8b9097]'
                      }`}
                    >
                      {swarmSizeHintText}
                    </div>
                  </div>
                </div>
              )}

              {/* MULTI-STATE STICKY BOTTOM MISSION COMPOSER:
                  Visually distinct states for Running, Completed, Halted, and Idle */}
              <div
                className={`rounded-[20px] sm:rounded-[24px] px-3.5 py-2 sm:px-4 sm:py-2.5 transition-all ${composerBoxClass} ${
                  isRunning
                    ? 'ring-1 ring-cyan-400/50'
                    : summary
                    ? 'ring-1 ring-emerald-500/30'
                    : wasStoppedEarly
                    ? 'ring-1 ring-amber-500/30'
                    : ''
                }`}
              >
                {/* Live Running / Completed Status Micro-Strip inside Composer */}
                {(isRunning || summary || wasStoppedEarly) && (
                  <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-white/[0.06] text-[10.5px] font-mono">
                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                      {isRunning ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
                          <span className="text-cyan-300 font-semibold truncate">
                            {isGenesisMode
                              ? 'Round 1 of 1 Active'
                              : `Round 0${currentRound || 1} Active`}{' '}
                            · {statusText}
                          </span>
                        </>
                      ) : summary ? (
                        <>
                          <Check size={11} className="text-emerald-400 shrink-0" />
                          <span className="text-emerald-300 font-semibold truncate">
                            Synthesis Complete · {messages.length} turns · Ask a follow-up below
                          </span>
                        </>
                      ) : (
                        <span className="text-amber-300 font-semibold truncate">
                          Swarm Halted ({messages.length} turns logged) · Ready to resume or start new
                        </span>
                      )}
                    </div>

                    {isRunning && (
                      <button
                        type="button"
                        onClick={() => setIsHumanModalOpen(true)}
                        className="px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[10px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                      >
                        <UserPlus size={10} />
                        <span>Inject Directive</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Row 1: Mission Prompt Input */}
                <div className="pb-1">
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
                    placeholder={
                      isRunning
                        ? statusText
                        : summary
                        ? 'Ask a follow-up question or launch a new 20-agent mission...'
                        : 'Ask anything or assign a research mission...'
                    }
                    className="w-full bg-transparent text-[13px] sm:text-[14px] text-white placeholder-[#71767b] focus:outline-none"
                  />
                </div>

                {/* Row 2: Left Paperclip / Presets | Right Protocol Selector + Launch/Stop Button */}
                <div className="flex items-center justify-between gap-2">
                  {/* Left: Paperclip / Quick Presets & Directives */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsModeSelectorOpen(false);
                        setIsPlusMenuOpen((prev) => !prev);
                      }}
                      className="w-7 h-7 sm:w-8 sm:h-8 -ml-1 rounded-full flex items-center justify-center text-[#8b9097] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
                      title="Attach Preset Topic or Inject Directive"
                    >
                      <Paperclip size={15} strokeWidth={1.9} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsModeSelectorOpen(false);
                        setIsPlusMenuOpen((prev) => !prev);
                      }}
                      className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-[#8b9097] hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                    >
                      <span>Presets</span>
                    </button>
                  </div>

                  {/* Right: "⚡ Fast ∨" Mode Dropdown + Solid Action Circle Button */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusMenuOpen(false);
                        setIsModeSelectorOpen((prev) => !prev);
                      }}
                      className="h-7 sm:h-8 px-2.5 rounded-full flex items-center gap-1 text-[#e7e9ea] hover:bg-white/[0.08] text-xs font-medium transition-colors cursor-pointer shrink-0"
                      title="Switch Swarm Speed, Size & Protocol"
                    >
                      <Zap size={12} className="text-cyan-400 shrink-0" />
                      <span>
                        {currentModeObj.shortLabel} ·{' '}
                        {isGenesisMode ? `2+${genesisAgentCount}A` : `${selectedSwarmCount}A`}
                      </span>
                      <ChevronDown size={12} className="text-[#71767b] shrink-0" />
                    </button>

                    {isRunning ? (
                      <button
                        id="parallax-stop-swarm-btn"
                        type="button"
                        onClick={handleStopSwarm}
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm cursor-pointer transition-transform active:scale-95"
                        title="Stop Swarm"
                      >
                        <Square size={11} fill="currentColor" />
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
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center justify-center shrink-0 shadow-sm cursor-pointer transition-transform active:scale-95"
                        title={
                          topicInput.trim()
                            ? `Launch ${selectedSwarmCount}-Agent Swarm`
                            : messages.length > 0
                            ? 'Listen to Swarm Audio Briefing'
                            : 'Launch Featured Swarm Task'
                        }
                      >
                        <AudioLines size={15} strokeWidth={2.3} />
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
