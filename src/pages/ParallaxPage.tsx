import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Square,
  Settings2,
  MessageSquare,
  Archive,
  Trash2,
  Info,
  UserPlus,
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { runParallaxSwarm } from '@/services/parallaxOrchestrator';
import { ParallaxHeader } from '@/components/parallax/ParallaxHeader';
import { ParallaxOrbitalCore } from '@/components/parallax/ParallaxOrbitalCore';
import { ParallaxLiveActivity } from '@/components/parallax/ParallaxLiveActivity';
import { ParallaxTimeline } from '@/components/parallax/ParallaxTimeline';
import { ParallaxAgentMatrix } from '@/components/parallax/ParallaxAgentMatrix';
import { ParallaxDeliberationStream } from '@/components/parallax/ParallaxDeliberationStream';
import { ParallaxTelemetry } from '@/components/parallax/ParallaxTelemetry';
import { ParallaxSynthesisReport } from '@/components/parallax/ParallaxSynthesisReport';
import { ParallaxSettings } from '@/components/parallax/ParallaxSettings';
import { ParallaxAudioVisualizer } from '@/components/parallax/ParallaxAudioVisualizer';
import { ParallaxIntelligenceBriefing } from '@/components/parallax/ParallaxIntelligenceBriefing';
import { ParallaxConvictionChart } from '@/components/parallax/ParallaxConvictionChart';
import { ParallaxDebateModeSelector } from '@/components/parallax/ParallaxDebateModeSelector';
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
  'Will humanoid robots replace household chores by 2035?',
  'Can universal basic income coexist with inflation?',
  'Is open-source AI safer than centralized proprietary models?',
  'Should humanity build permanent cities on Mars before fixing Earth?',
  'Is social media rewiring human memory and attention spans?',
];

export const ParallaxPage: React.FC = () => {
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
  const [groupFilter, setGroupFilter] = useState<'all' | 'optimists' | 'realists' | 'ethicists' | 'visionaries' | 'anchors' | 'facts'>('all');

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
  const [playingAudioKey, setPlayingAudioKey] = useState<string | null>(null); // message.id or 'full_swarm'
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

  // Cleanup audio & network abort on unmount
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

  // Play individual message using agent's Edge TTS voice
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

  // FEATURE 8: Upgraded Podcast Mode Deliberation Audio Player with Narrator Intro & Outro
  const handleListenToFullSwarm = async () => {
    if (playingAudioKey === 'full_swarm') {
      stopAllAudio();
      return;
    }

    if (messages.length === 0) return;
    stopAllAudio();
    swarmPlaybackCancelledRef.current = false;

    // If already pre-rendered stitched blob, play immediately
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

    // Otherwise, stream with narrator intro + message turns + outro sequentially
    setLoadingAudioKey('full_swarm');
    setFullSwarmProgress({ current: 1, total: messages.length + 2 });

    const audioBlobs: Blob[] = [];

    // Helper to fetch audio blob
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
      // 1. Play Narrator Intro
      const introText = `Welcome to NEXUS Parallax. Today, twenty AI agents debate: ${currentTopic || topicInput}.`;
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

      // 2. Play Message Turns
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

      // 3. Play Narrator Outro
      if (!swarmPlaybackCancelledRef.current && summary?.verdict) {
        const outroText = `This concludes the NEXUS Parallax swarm deliberation. Final consensus: ${summary.consensusLean || 'Balanced'}. Verdict: ${summary.verdict}`;
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

  // FEATURE 8: Download upgraded contiguous podcast MP3 with intro + outro narration
  const handleDownloadSwarmMp3 = async () => {
    if (messages.length === 0) return;
    setIsDownloadingSwarmMp3(true);
    try {
      let blobToDownload = stitchedSwarmBlob;

      if (!blobToDownload) {
        setFullSwarmProgress({ current: 0, total: messages.length + 2 });

        const items: Array<{ text: string; voice: string }> = [];

        // Intro item
        const introSpeech = cleanMarkdownForSpeech(`Welcome to NEXUS Parallax. Today, twenty AI agents debate: ${currentTopic || topicInput}.`);
        if (introSpeech) {
          items.push({ text: introSpeech.slice(0, 3500), voice: 'en-US-ChristopherNeural' });
        }

        // Swarm turns
        for (const msg of messages) {
          const rawClean = cleanMarkdownForSpeech(msg.text);
          if (!rawClean) continue;
          const spokenIntro = `${msg.agentName} in round ${msg.round}. `;
          const fullSpeechText = cleanMarkdownForSpeech(spokenIntro + rawClean);
          const voice = msg.voice || config.agents[msg.agentId]?.voice || getParallaxAgentVoice(msg.agentId);
          items.push({ text: fullSpeechText.slice(0, 3500), voice });
        }

        // Outro item
        if (summary?.verdict) {
          const outroSpeech = cleanMarkdownForSpeech(
            `This concludes the NEXUS Parallax swarm deliberation. Final consensus: ${summary.consensusLean || 'Balanced'}. Verdict: ${summary.verdict}`,
          );
          if (outroSpeech) {
            items.push({ text: outroSpeech.slice(0, 3500), voice: 'en-US-ChristopherNeural' });
          }
        }

        // Batch synthesis call
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

  // Universal Copy: copies full transcript in exact requested format
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

  // FEATURE 4: Handle Human Operator Directive Injection
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

  // Sync config from storage
  useEffect(() => {
    const handleStorage = () => {
      setConfig(storage.getParallaxConfig());
      setSessions(storage.getParallaxSessions());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Auto-scroll feed on new messages
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

    // Reset swarm state & audio
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
    setIsRunning(true);
    setCurrentRound(1);
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

  const enabledAgentsCount = Object.values(config.agents || {}).filter((a) => a.enabled !== false).length;
  const dynamicPersonasCount = dynamicPersonas.length || new Set(messages.filter((m) => m.isDynamic).map((m) => m.agentId)).size;

  const activeSpeakingAgent =
    playingAudioKey && playingAudioKey !== 'full_swarm'
      ? messages.find((m) => m.id === playingAudioKey) || null
      : isRunning && messages.length > 0
      ? messages[messages.length - 1]
      : null;

  return (
    <div
      id="parallax-page-wrapper"
      className="min-h-screen relative w-full overflow-x-hidden p-2 sm:p-0"
    >
      {/* Ambient, non-intrusive background glows behind the main swarm feed */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute top-12 left-1/4 w-[520px] h-[520px] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-16 right-1/4 w-[520px] h-[520px] rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <div
        id="parallax-page"
        className="relative z-10 w-full max-w-[1320px] mx-auto px-3 sm:px-6 pt-4 pb-24 text-slate-100 font-sans bg-slate-950/60 backdrop-blur-2xl rounded-3xl"
      >
        {/* Top Translucent Glass Header with Debate Mode Theme */}
        <ParallaxHeader
          isRunning={isRunning}
          currentRound={currentRound}
          isComplete={Boolean(summary)}
          wasStoppedEarly={wasStoppedEarly}
          totalAgentsCount={enabledAgentsCount}
          dynamicSpecialistsCount={dynamicPersonasCount}
          factsCount={messages.filter((m) => Boolean(m.toolUsed)).length}
          activeProviderName="OpenRouter / Swarm Matrix"
          activeModelName={config.specialistModel || 'Llama 3.3 70B'}
          debateMode={debateMode}
        />

        {/* Tabs Navigation */}
        <div
          id="parallax-tabs-nav"
          className="flex items-center gap-2 border-b border-white/[0.06] pb-3.5 mb-5 flex-wrap"
        >
          <button
            id="parallax-tab-feed"
            type="button"
            onClick={() => setActiveTab('feed')}
            className={`px-4 py-2 rounded-full text-xs sm:text-[13px] font-bold cursor-pointer flex items-center gap-2 transition-all ${
              activeTab === 'feed'
                ? 'bg-cyan-500/20 text-cyan-300 backdrop-blur-xl'
                : 'bg-slate-900/40 backdrop-blur-xl text-slate-300 hover:text-slate-100 hover:bg-slate-800/50'
            }`}
          >
            <MessageSquare size={15} />
            <span>Swarm Live Feed</span>
            {messages.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500 text-slate-950 font-black">
                {messages.length}
              </span>
            )}
          </button>

          <button
            id="parallax-tab-settings"
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-full text-xs sm:text-[13px] font-bold cursor-pointer flex items-center gap-2 transition-all ${
              activeTab === 'settings'
                ? 'bg-cyan-500/20 text-cyan-300 backdrop-blur-xl'
                : 'bg-slate-900/40 backdrop-blur-xl text-slate-300 hover:text-slate-100 hover:bg-slate-800/50'
            }`}
          >
            <Settings2 size={15} />
            <span>Agent Configurations (20)</span>
          </button>

          <button
            id="parallax-tab-archive"
            type="button"
            onClick={() => setActiveTab('archive')}
            className={`px-4 py-2 rounded-full text-xs sm:text-[13px] font-bold cursor-pointer flex items-center gap-2 transition-all ${
              activeTab === 'archive'
                ? 'bg-cyan-500/20 text-cyan-300 backdrop-blur-xl'
                : 'bg-slate-900/40 backdrop-blur-xl text-slate-300 hover:text-slate-100 hover:bg-slate-800/50'
            }`}
          >
            <Archive size={15} />
            <span>Past Swarms ({sessions.length})</span>
          </button>
        </div>

        {/* TAB CONTENT: SETTINGS & AGENT MATRIX */}
        {activeTab === 'settings' && (
          <div className="divide-y divide-white/[0.06] space-y-6">
            <ParallaxAgentMatrix
              agents={config.agents}
              messages={messages}
              selectedAgentId={selectedAgentFilter}
              activeSpeakingAgentId={activeSpeakingAgent?.agentId}
              onSelectAgent={(agentId) => setSelectedAgentFilter(agentId)}
              dynamicPersonas={dynamicPersonas}
              onPlayVoice={handlePlayMessageAudio}
            />
            <ParallaxSettings config={config} onConfigChange={(newCfg) => setConfig(newCfg)} />
          </div>
        )}

        {/* TAB CONTENT: ARCHIVE */}
        {activeTab === 'archive' && (
          <div id="parallax-archive-tab" className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h3 className="m-0 text-base font-bold text-slate-100">
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
                  className="px-3.5 py-1.5 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 size={14} />
                  <span>Clear Archive</span>
                </button>
              )}
            </div>

            {sessions.length === 0 ? (
              <div className="py-12 text-center text-slate-300 text-sm">
                No archived sessions yet. Run a swarm from the Live Feed tab to see past synthesis reports here.
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    id={`parallax-saved-swarm-${sess.id}`}
                    className="py-4 px-3 rounded-xl hover:bg-slate-900/40 transition-colors flex flex-col gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-extrabold text-slate-100 leading-snug">
                        &ldquo;{sess.topic}&rdquo;
                      </span>
                      <span className="text-[11px] text-slate-300 font-mono shrink-0">
                        {new Date(sess.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    {sess.summary && (
                      <div className="text-xs text-slate-300 leading-relaxed">
                        <strong className="text-cyan-300">Lean:</strong> {sess.summary.consensusLean}
                      </div>
                    )}
                    <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                      <span className="text-[11px] text-slate-300 font-mono">
                        {sess.messages.length} messages (3 rounds)
                      </span>

                      {confirmDeleteId === sess.id ? (
                        <div
                          id={`confirm-delete-swarm-prompt-${sess.id}`}
                          className="flex items-center gap-2 bg-rose-500/15 rounded-full px-3 py-1"
                        >
                          <span className="text-[11px] text-rose-200 font-semibold">
                            Delete this swarm discussion?
                          </span>
                          <button
                            id={`confirm-delete-yes-${sess.id}`}
                            type="button"
                            onClick={() => {
                              storage.deleteParallaxSession(sess.id);
                              setSessions(storage.getParallaxSessions());
                              setConfirmDeleteId(null);
                            }}
                            className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
                          >
                            Delete
                          </button>
                          <button
                            id={`confirm-delete-cancel-${sess.id}`}
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-0.5 rounded-full bg-white/10 text-slate-200 text-[11px] cursor-pointer"
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
                            className="px-3.5 py-1.5 rounded-full bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[11px] font-bold cursor-pointer transition-colors"
                          >
                            Load in Feed
                          </button>
                          <button
                            id={`delete-individual-swarm-${sess.id}`}
                            type="button"
                            title="Delete this swarm discussion"
                            aria-label="Delete this swarm discussion"
                            onClick={() => setConfirmDeleteId(sess.id)}
                            className="p-1.5 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 cursor-pointer flex items-center justify-center transition-colors"
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

        {/* TAB CONTENT: FEED */}
        {activeTab === 'feed' && (
          <div id="parallax-feed-view" className="divide-y divide-white/[0.06]">
            {/* FEATURE 7: Debate Mode Preset Selector */}
            <ParallaxDebateModeSelector
              selectedMode={debateMode}
              onSelectMode={setDebateMode}
              disabled={isRunning}
            />

            {/* Unboxed Topic Input Bar & Presets */}
            <div
              id="parallax-input-container"
              className="py-5 border-b border-white/[0.06]"
            >
              {/* Input Row */}
              <div className="parallax-input-row flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
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
                  placeholder="Enter topic for 20-agent swarm discussion (e.g. Will humanoid robots replace household chores?)..."
                  className="flex-1 px-4 py-3.5 rounded-2xl bg-slate-900/40 backdrop-blur-xl text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400/50 transition-all"
                />

                {isRunning ? (
                  <button
                    id="parallax-stop-swarm-btn"
                    type="button"
                    onClick={handleStopSwarm}
                    title="Immediately halt the running swarm and keep completed messages"
                    className="px-6 py-3.5 rounded-2xl bg-rose-500/25 backdrop-blur-xl text-rose-200 hover:bg-rose-500/35 hover:text-white text-sm font-bold cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap active:scale-95 transition-all"
                  >
                    <Square size={15} fill="currentColor" />
                    <span>Stop Swarm</span>
                  </button>
                ) : (
                  <button
                    id="parallax-start-swarm-btn"
                    type="button"
                    onClick={() => handleStartSwarm()}
                    disabled={!topicInput.trim()}
                    className={`px-6 py-3.5 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 whitespace-nowrap transition-all ${
                      topicInput.trim()
                        ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white cursor-pointer hover:opacity-90 active:scale-95 shadow-[0_0_24px_rgba(6,182,212,0.3)]'
                        : 'bg-slate-900/40 backdrop-blur-xl text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Sparkles size={16} />
                    <span>Start Parallax</span>
                  </button>
                )}
              </div>

              {/* Starter Presets */}
              <div className="parallax-popular-topics mt-3.5 flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-mono text-slate-300 font-semibold">
                  POPULAR TOPICS:
                </span>
                {SAMPLE_TOPICS.map((topic, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={isRunning}
                    onClick={() => {
                      setTopicInput(topic);
                      handleStartSwarm(topic);
                    }}
                    className={`px-3 py-1 rounded-full bg-slate-900/40 backdrop-blur-xl text-slate-300 hover:text-cyan-300 hover:bg-slate-800/60 text-[11px] transition-all ${
                      isRunning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>

            {/* Current Swarm Status Bar */}
            <div
              id="parallax-status-bar"
              className="py-3.5 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-3 text-xs"
            >
              <div className="flex items-center gap-2">
                <Info size={14} className="text-cyan-400" />
                <span className="text-slate-100 font-semibold">{statusText}</span>
              </div>

              <div className="flex items-center gap-3 text-slate-300">
                <span className="font-mono">
                  <strong className="text-cyan-300">{enabledAgentsCount}</strong> agents active
                </span>
                <span className="text-white/20">•</span>
                <span className="font-mono text-sky-300">
                  Auto-stops after round 3
                </span>
              </div>
            </div>

            {/* Error Banner */}
            {errorText && (
              <div className="py-3 px-4 my-2 rounded-xl bg-rose-500/15 text-rose-300 text-xs sm:text-sm">
                {errorText}
              </div>
            )}

            {/* FEATURE 1: Round 0 Intelligence Briefing Collapsible Card */}
            {intelligenceBriefing && (
              <ParallaxIntelligenceBriefing briefing={intelligenceBriefing} defaultExpanded={true} />
            )}

            {/* MISSION CHRONOLOGY TIMELINE */}
            <ParallaxTimeline
              currentRound={currentRound}
              isRunning={isRunning}
              isComplete={Boolean(summary)}
              wasStoppedEarly={wasStoppedEarly}
              messages={messages}
            />

            {/* MAIN HERO — SWARM ORBITAL CORE & LIVE SWARM ACTIVITY */}
            <div className="py-4 border-b border-white/[0.06] grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7">
                <ParallaxOrbitalCore
                  agents={config.agents}
                  messages={messages}
                  currentRound={currentRound}
                  isRunning={isRunning}
                  activeSpeakingAgentId={activeSpeakingAgent?.agentId}
                  selectedAgentId={selectedAgentFilter}
                  onSelectAgent={(agentId) => setSelectedAgentFilter(agentId)}
                  topic={currentTopic || topicInput}
                  dynamicPersonas={dynamicPersonas}
                />
              </div>
              <div className="lg:col-span-5">
                <ParallaxLiveActivity
                  messages={messages}
                  activeSpeakingAgentId={activeSpeakingAgent?.agentId}
                  isRunning={isRunning}
                  currentRound={currentRound}
                  agents={config.agents}
                  onPlayVoice={handlePlayMessageAudio}
                  playingAudioKey={playingAudioKey}
                />
              </div>
            </div>

            {/* Real-time Audio Waveform Visualizer HUD */}
            {(playingAudioKey || loadingAudioKey) && (
              <div className="py-3">
                <ParallaxAudioVisualizer
                  isPlaying={Boolean(playingAudioKey)}
                  activeKey={playingAudioKey || loadingAudioKey}
                  activeAgentName={
                    playingAudioKey === 'full_swarm' || loadingAudioKey === 'full_swarm'
                      ? 'Full Swarm Deliberation'
                      : activeSpeakingAgent?.agentName || 'Swarm Speaker'
                  }
                  activeAgentId={activeSpeakingAgent?.agentId}
                  accentColor={activeSpeakingAgent?.accentColor || '#00f0ff'}
                  voiceName={
                    activeSpeakingAgent
                      ? config.agents[activeSpeakingAgent.agentId]?.voice || getParallaxAgentVoice(activeSpeakingAgent.agentId)
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

            {/* DELIBERATION STREAM: Open timeline thread */}
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

            {/* FEATURE 6: Conviction Shift Chart across Rounds */}
            {messages.length > 0 && (
              <ParallaxConvictionChart messages={messages} />
            )}

            {/* LIVE TELEMETRY STRIP */}
            <ParallaxTelemetry
              totalAgentsCount={enabledAgentsCount}
              activeCount={isRunning ? 1 : 0}
              completedRepliesCount={messages.length}
              currentRound={currentRound}
              sourcesCount={messages.reduce((acc, m) => acc + (m.toolUsed?.sourcesCount || (m.toolUsed ? 1 : 0)), 0)}
              isRunning={isRunning}
              isComplete={Boolean(summary)}
              activeModel={config.specialistModel || 'Llama 3.3 70B'}
            />

            {/* FINAL SYNTHESIS: Polished Intelligence Report with Confidence Verdict Meter */}
            {summary && (
              <ParallaxSynthesisReport
                summary={summary}
                topic={currentTopic}
                allMessages={messages}
                onNewTopic={() => {
                  setTopicInput('');
                  setMessages([]);
                  setSummary(null);
                  setIntelligenceBriefing(null);
                  setWasStoppedEarly(false);
                }}
                onRerun={() => handleStartSwarm(currentTopic)}
                onExportMp3={handleDownloadSwarmMp3}
                onSave={() => {
                  setSessions(storage.getParallaxSessions());
                }}
              />
            )}

            {/* Swarm Stopped Early State (Shown instead of summary when user halts) */}
            {wasStoppedEarly && !summary && (
              <div
                id="parallax-stopped-early-card"
                className="relative pl-5 py-5 my-4 border-l-2 border-rose-500 bg-slate-900/40 backdrop-blur-xl rounded-r-2xl"
              >
                <div className="flex items-center justify-between flex-wrap gap-3 mb-3 pr-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-300">
                      <Square size={16} fill="currentColor" />
                    </div>
                    <div>
                      <div className="text-base font-black text-rose-200 tracking-tight font-sans">
                        SWARM DELIBERATION HALTED EARLY
                      </div>
                      <div className="text-xs text-slate-300 font-mono">
                        User intervention executed • {messages.length} agent {messages.length === 1 ? 'turn' : 'turns'} recorded
                      </div>
                    </div>
                  </div>

                  <div className="text-xs font-mono px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 font-bold">
                    ● HALTED
                  </div>
                </div>

                <p className="m-0 text-xs sm:text-sm text-slate-200 leading-relaxed font-sans mb-4 pr-4">
                  The swarm execution was stopped prior to completing all 3 deliberation rounds. Completed turns up to the stop point have been preserved in the deliberation stream.
                </p>

                <div className="flex items-center gap-3 flex-wrap font-mono text-xs">
                  <button
                    id="parallax-rerun-stopped-swarm-btn"
                    type="button"
                    onClick={() => handleStartSwarm(currentTopic)}
                    className="px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold cursor-pointer hover:opacity-90 active:scale-95 transition-all flex items-center gap-2"
                  >
                    <Sparkles size={14} />
                    <span>Rerun Swarm (3 Rounds)</span>
                  </button>

                  <button
                    id="parallax-clear-stopped-swarm-btn"
                    type="button"
                    onClick={() => {
                      setMessages([]);
                      setWasStoppedEarly(false);
                      setTopicInput('');
                      setCurrentTopic('');
                      setStatusText('Ready to mobilize 20-agent swarm.');
                    }}
                    className="px-4 py-2 rounded-full bg-slate-900/40 backdrop-blur-xl hover:bg-slate-800/60 text-slate-200 hover:text-white font-bold cursor-pointer transition-all flex items-center gap-2"
                  >
                    <Trash2 size={13} />
                    <span>Discard & New Topic</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FEATURE 4: Floating Human Operator Injection Button */}
        {isRunning && (
          <button
            id="parallax-floating-inject-btn"
            type="button"
            onClick={() => setIsHumanModalOpen(true)}
            className="fixed bottom-6 right-6 z-40 px-4 py-2.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-mono font-black text-xs shadow-[0_0_24px_rgba(245,158,11,0.5)] flex items-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer animate-pulse"
            title="Inject a direct operator assertion or counter-argument into live deliberation"
          >
            <UserPlus size={15} />
            <span>INJECT OPINION</span>
          </button>
        )}

        {/* FEATURE 4: Human Operator Directive Injection Modal */}
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
