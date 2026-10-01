import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Square,
  Settings2,
  MessageSquare,
  Archive,
  Trash2,
  Info,
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
import { getParallaxAgentVoice, formatFullParallaxTranscript } from '@/data/parallaxVoices';
import { cleanMarkdownForSpeech } from '@/lib/format';
import type {
  ParallaxAgentConfig,
  ParallaxMessage,
  ParallaxSpecialistDeliberation,
  ParallaxSummary,
  ParallaxSystemConfig,
  ParallaxSession,
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

  // Listen to entire 20-agent swarm deliberation back-to-back
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

    // Otherwise, stream message-by-message sequentially so audio begins playing in < 1 second!
    setLoadingAudioKey('full_swarm');
    setFullSwarmProgress({ current: 1, total: messages.length });

    const audioBlobs: Blob[] = [];

    // Helper to fetch audio blob for a single message
    const fetchBlobForMessage = async (msg: ParallaxMessage): Promise<Blob | null> => {
      const rawClean = cleanMarkdownForSpeech(msg.text);
      if (!rawClean) return null;
      const spokenIntro = `${msg.agentName} in round ${msg.round}. `;
      const fullSpeechText = cleanMarkdownForSpeech(spokenIntro + rawClean);
      const voice = msg.voice || config.agents[msg.agentId]?.voice || getParallaxAgentVoice(msg.agentId);

      try {
        const response = await fetch('/api/edge-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: fullSpeechText.slice(0, 3500),
            voice,
          }),
        });
        if (response.ok) {
          return await response.blob();
        }
      } catch (e) {
        console.warn(`[Parallax] Speech fetch failed for ${msg.agentName}:`, e);
      }
      return null;
    };

    try {
      // Pre-fetch cache: stores promises for upcoming audio chunks
      const prefetchPromises = new Map<number, Promise<Blob | null>>();

      // Kick off prefetch for message 0 and message 1
      if (messages[0]) prefetchPromises.set(0, fetchBlobForMessage(messages[0]));
      if (messages[1]) prefetchPromises.set(1, fetchBlobForMessage(messages[1]));

      for (let i = 0; i < messages.length; i++) {
        if (swarmPlaybackCancelledRef.current) break;

        const msg = messages[i];
        setFullSwarmProgress({ current: i + 1, total: messages.length });

        // Trigger pre-fetch for i + 2 while i is preparing / playing
        if (i + 2 < messages.length && !prefetchPromises.has(i + 2)) {
          prefetchPromises.set(i + 2, fetchBlobForMessage(messages[i + 2]));
        }

        // Await blob for current message
        const currentPromise = prefetchPromises.get(i) || fetchBlobForMessage(msg);
        const blob = await currentPromise;

        if (swarmPlaybackCancelledRef.current) break;

        if (!blob) {
          // If fetch failed, skip gracefully to next agent so listening continues
          continue;
        }

        audioBlobs.push(blob);

        // Play current agent's audio
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

          audio.play().catch((playErr) => {
            console.warn('[Parallax] Play error for chunk:', playErr);
            handleFinish();
          });
        });

        if (swarmPlaybackCancelledRef.current) break;
      }

      // If deliberation finished naturally and collected blobs, cache stitched blob
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

  // Download entire deliberation as a single high-quality contiguous MP3 file
  const handleDownloadSwarmMp3 = async () => {
    if (messages.length === 0) return;
    setIsDownloadingSwarmMp3(true);
    try {
      let blobToDownload = stitchedSwarmBlob;

      if (!blobToDownload) {
        setFullSwarmProgress({ current: 0, total: messages.length });

        // 1. Fast server-side batch synthesis
        try {
          const items = messages
            .map((msg) => {
              const rawClean = cleanMarkdownForSpeech(msg.text);
              if (!rawClean) return null;
              const spokenIntro = `${msg.agentName} in round ${msg.round}. `;
              const fullSpeechText = cleanMarkdownForSpeech(spokenIntro + rawClean);
              const voice = msg.voice || config.agents[msg.agentId]?.voice || getParallaxAgentVoice(msg.agentId);
              return {
                text: fullSpeechText.slice(0, 3500),
                voice,
              };
            })
            .filter((item): item is { text: string; voice: string } => item !== null && item.text.trim().length > 0);

          if (items.length > 0) {
            const response = await fetch('/api/edge-tts/batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items }),
            });

            if (response.ok) {
              blobToDownload = await response.blob();
              setStitchedSwarmBlob(blobToDownload);
            }
          }
        } catch (batchErr) {
          console.warn('[Parallax] Batch endpoint error, trying fallback:', batchErr);
        }

        // 2. Sequential fallback if batch did not produce blob
        if (!blobToDownload) {
          const audioBlobs: Blob[] = [];
          const total = messages.length;

          for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            setFullSwarmProgress({ current: i + 1, total });

            const rawClean = cleanMarkdownForSpeech(msg.text);
            if (!rawClean) continue;

            const spokenIntro = `${msg.agentName} in round ${msg.round}. `;
            const fullSpeechText = cleanMarkdownForSpeech(spokenIntro + rawClean);
            const voice = msg.voice || config.agents[msg.agentId]?.voice || getParallaxAgentVoice(msg.agentId);

            try {
              const response = await fetch('/api/edge-tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text: fullSpeechText.slice(0, 3500),
                  voice,
                }),
              });

              if (response.ok) {
                const b = await response.blob();
                audioBlobs.push(b);
              }
            } catch (chunkErr) {
              console.warn(`[Parallax] Chunk download failed for ${msg.agentName}:`, chunkErr);
            }
          }

          if (audioBlobs.length > 0) {
            blobToDownload = new Blob(audioBlobs, { type: 'audio/mpeg' });
            setStitchedSwarmBlob(blobToDownload);
          }
        }
      }

      if (!blobToDownload) {
        throw new Error('No audio could be compiled for download');
      }

      const url = URL.createObjectURL(blobToDownload);
      const a = document.createElement('a');
      a.href = url;
      const safeTopic = (currentTopic || topicInput || 'swarm')
        .slice(0, 30)
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .toLowerCase();
      a.download = `nexus_parallax_swarm_${safeTopic}_${Date.now()}.mp3`;
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
      onSpecialistDeliberation: (deliberation) => {
        setSpecialistDeliberation(deliberation);
        setStatusText('CONNECTING AGENTS • SPECIALISTS COMPILED');
      },
      onDynamicPersonasCreated: (personas) => {
        setDynamicPersonas(personas);
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
      className="min-h-screen relative w-full overflow-x-hidden"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(3, 14, 26, 0.8) 0%, rgba(2, 6, 12, 1) 100%)',
      }}
    >
      {/* Ambient background tactical grid & atmospheric glow */}
      <div
        className="fixed inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(rgba(0, 240, 255, 0.12) 1px, transparent 1px), radial-gradient(rgba(37, 99, 235, 0.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          backgroundPosition: '0 0, 16px 16px',
        }}
      />

      <div
        id="parallax-page"
        className="relative z-10 w-full"
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '24px 16px 80px',
          color: '#f8fafc',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* NEXUS COMMAND CENTER: Top Futuristic Header */}
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
      />

      {/* Tabs Navigation */}
      <div
        id="parallax-tabs-nav"
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid rgba(165, 207, 214, 0.15)',
          paddingBottom: '12px',
          marginBottom: '20px',
        }}
      >
        <button
          id="parallax-tab-feed"
          type="button"
          onClick={() => setActiveTab('feed')}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            background: activeTab === 'feed' ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
            border: `1px solid ${activeTab === 'feed' ? 'rgba(6, 182, 212, 0.4)' : 'transparent'}`,
            color: activeTab === 'feed' ? '#61d7c9' : '#94a3b8',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <MessageSquare size={16} />
          Swarm Live Feed
          {messages.length > 0 && (
            <span
              style={{
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '999px',
                background: '#0891b2',
                color: '#fff',
              }}
            >
              {messages.length}
            </span>
          )}
        </button>

        <button
          id="parallax-tab-settings"
          type="button"
          onClick={() => setActiveTab('settings')}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            background: activeTab === 'settings' ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
            border: `1px solid ${activeTab === 'settings' ? 'rgba(6, 182, 212, 0.4)' : 'transparent'}`,
            color: activeTab === 'settings' ? '#61d7c9' : '#94a3b8',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <Settings2 size={16} />
          Agent Configurations (20)
        </button>

        <button
          id="parallax-tab-archive"
          type="button"
          onClick={() => setActiveTab('archive')}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            background: activeTab === 'archive' ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
            border: `1px solid ${activeTab === 'archive' ? 'rgba(6, 182, 212, 0.4)' : 'transparent'}`,
            color: activeTab === 'archive' ? '#61d7c9' : '#94a3b8',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <Archive size={16} />
          Past Swarms ({sessions.length})
        </button>
      </div>

      {/* TAB CONTENT: SETTINGS & AGENT MATRIX (Requirement 6) */}
      {activeTab === 'settings' && (
        <div className="space-y-6 flex flex-col gap-6">
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
        <div id="parallax-archive-tab" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' }}>
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
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Trash2 size={14} />
                Clear Archive
              </button>
            )}
          </div>

          {sessions.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#94a3b8',
                borderRadius: '12px',
                background: 'rgba(8, 22, 34, 0.5)',
                border: '1px dashed rgba(165, 207, 214, 0.2)',
              }}
            >
              No archived sessions yet. Run a swarm from the Live Feed tab to see past synthesis reports here.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {sessions.map((sess) => (
                <div
                  key={sess.id}
                  id={`parallax-saved-swarm-${sess.id}`}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'rgba(8, 22, 34, 0.8)',
                    border: '1px solid rgba(97, 215, 201, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#fff', lineHeight: 1.4 }}>
                      &ldquo;{sess.topic}&rdquo;
                    </span>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'DM Mono, monospace' }}>
                      {new Date(sess.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  {sess.summary && (
                    <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.4 }}>
                      <strong style={{ color: '#61d7c9' }}>Lean:</strong> {sess.summary.consensusLean}
                    </div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '4px',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'DM Mono, monospace' }}>
                      {sess.messages.length} messages (3 rounds)
                    </span>

                    {confirmDeleteId === sess.id ? (
                      <div
                        id={`confirm-delete-swarm-prompt-${sess.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          borderRadius: '6px',
                          padding: '3px 8px',
                        }}
                      >
                        <span style={{ fontSize: '11px', color: '#fca5a5', fontWeight: 600 }}>
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
                          style={{
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: '#ef4444',
                            border: 'none',
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Delete
                        </button>
                        <button
                          id={`confirm-delete-cancel-${sess.id}`}
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            color: '#cbd5e1',
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            stopAllAudio();
                            setStitchedSwarmBlob(null);
                            setMessages(sess.messages);
                            setSummary(sess.summary || null);
                            setSpecialistDeliberation(sess.specialistDeliberation || null);
                            setWasStoppedEarly(false);
                            setCurrentTopic(sess.topic);
                            setActiveTab('feed');
                          }}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '6px',
                            background: 'rgba(6, 182, 212, 0.2)',
                            border: '1px solid rgba(6, 182, 212, 0.4)',
                            color: '#61d7c9',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Load in Feed
                        </button>
                        <button
                          id={`delete-individual-swarm-${sess.id}`}
                          type="button"
                          title="Delete this swarm discussion"
                          aria-label="Delete this swarm discussion"
                          onClick={() => setConfirmDeleteId(sess.id)}
                          style={{
                            padding: '5px 8px',
                            borderRadius: '6px',
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease',
                          }}
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
        <div id="parallax-feed-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Topic Input Bar & Presets */}
          <div
            id="parallax-input-container"
            style={{
              padding: '16px 20px',
              borderRadius: '16px',
              background: 'linear-gradient(145deg, rgba(8, 22, 34, 0.9) 0%, rgba(4, 12, 18, 0.95) 100%)',
              border: '1px solid rgba(97, 215, 201, 0.3)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            }}
          >
            {/* Input Row */}
            <div className="parallax-input-row" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1.5px solid rgba(165, 207, 214, 0.25)',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none',
                }}
                className="focus:border-[#61d7c9] transition-colors"
              />

              {isRunning ? (
                <button
                  id="parallax-stop-swarm-btn"
                  type="button"
                  onClick={handleStopSwarm}
                  title="Immediately halt the running swarm and keep completed messages"
                  style={{
                    padding: '12px 24px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(185, 28, 28, 0.4) 100%)',
                    border: '1.5px solid rgba(239, 68, 68, 0.7)',
                    color: '#fecdd3',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 0 16px rgba(239, 68, 68, 0.25)',
                    transition: 'all 0.15s ease',
                  }}
                  className="hover:bg-red-900/60 hover:text-white active:scale-95"
                >
                  <Square size={15} fill="currentColor" />
                  Stop Swarm
                </button>
              ) : (
                <button
                  id="parallax-start-swarm-btn"
                  type="button"
                  onClick={() => handleStartSwarm()}
                  disabled={!topicInput.trim()}
                  style={{
                    padding: '12px 26px',
                    borderRadius: '12px',
                    background: topicInput.trim()
                      ? 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'
                      : 'rgba(15, 23, 42, 0.6)',
                    border: 'none',
                    color: topicInput.trim() ? '#fff' : '#64748b',
                    fontSize: '14px',
                    fontWeight: 800,
                    cursor: topicInput.trim() ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    whiteSpace: 'nowrap',
                    boxShadow: topicInput.trim() ? '0 0 20px rgba(6, 182, 212, 0.4)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                  className={topicInput.trim() ? 'hover:opacity-90 active:scale-95' : ''}
                >
                  <Sparkles size={16} />
                  Start Parallax
                </button>
              )}
            </div>

            {/* Starter Presets */}
            <div className="parallax-popular-topics" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#94a3b8', fontWeight: 600 }}>
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
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid rgba(165, 207, 214, 0.2)',
                    color: '#cbd5e1',
                    fontSize: '11px',
                    cursor: isRunning ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  className="hover:border-[#61d7c9] hover:text-[#61d7c9]"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          {/* Current Swarm Status Bar */}
          <div
            id="parallax-status-bar"
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              background: 'rgba(6, 16, 24, 0.75)',
              border: '1px solid rgba(97, 215, 201, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              fontSize: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={14} color="#61d7c9" />
              <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{statusText}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#94a3b8' }}>
              <span style={{ fontFamily: 'DM Mono, monospace' }}>
                <strong style={{ color: '#61d7c9' }}>{enabledAgentsCount}</strong> agents active
              </span>
              <span>•</span>
              <span style={{ fontFamily: 'DM Mono, monospace', color: '#38bdf8' }}>
                Auto-stops after round 3
              </span>
            </div>
          </div>

          {/* Error Banner */}
          {errorText && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                fontSize: '13px',
              }}
            >
              {errorText}
            </div>
          )}

          {/* MISSION CHRONOLOGY TIMELINE (Stage / Timeline) */}
          <ParallaxTimeline
            currentRound={currentRound}
            isRunning={isRunning}
            isComplete={Boolean(summary)}
            wasStoppedEarly={wasStoppedEarly}
            messages={messages}
          />

          {/* MAIN HERO — SWARM ORBITAL CORE & LIVE SWARM ACTIVITY (Active Agents) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-2 items-start">
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
          )}

          {/* DELIBERATION STREAM: Terminal-style live stream */}
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
            currentTopic={currentTopic}
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

          {/* FINAL SYNTHESIS: Polished Intelligence Report (Requirement 9) */}
          {summary && (
            <ParallaxSynthesisReport
              summary={summary}
              topic={currentTopic}
              allMessages={messages}
              onNewTopic={() => {
                setTopicInput('');
                setMessages([]);
                setSummary(null);
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
              className="nexus-corner-bracket relative rounded-2xl overflow-hidden my-6 p-6"
              style={{
                background: 'linear-gradient(135deg, rgba(30, 20, 26, 0.95) 0%, rgba(18, 12, 16, 0.98) 100%)',
                border: '1.5px solid rgba(244, 63, 94, 0.45)',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 24px rgba(244, 63, 94, 0.15)',
              }}
            >
              <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-rose-400"
                    style={{
                      background: 'rgba(244, 63, 94, 0.2)',
                      border: '1px solid rgba(244, 63, 94, 0.5)',
                    }}
                  >
                    <Square size={16} fill="currentColor" />
                  </div>
                  <div>
                    <div className="text-base font-black text-rose-200 tracking-tight font-sans">
                      SWARM DELIBERATION HALTED EARLY
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      User intervention executed • {messages.length} agent {messages.length === 1 ? 'turn' : 'turns'} recorded
                    </div>
                  </div>
                </div>

                <div className="text-xs font-mono px-3 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/40 font-bold">
                  ● HALTED
                </div>
              </div>

              <p className="m-0 text-xs sm:text-sm text-slate-300 leading-relaxed font-sans mb-4">
                The swarm execution was stopped prior to completing all 3 deliberation rounds. Completed turns up to the stop point have been preserved in the deliberation stream.
              </p>

              <div className="flex items-center gap-3 flex-wrap font-mono text-xs">
                <button
                  id="parallax-rerun-stopped-swarm-btn"
                  type="button"
                  onClick={() => handleStartSwarm(currentTopic)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold cursor-pointer hover:opacity-90 active:scale-95 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] flex items-center gap-2"
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
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-400/40 text-slate-300 hover:text-white font-bold cursor-pointer transition-all flex items-center gap-2"
                >
                  <Trash2 size={13} />
                  <span>Discard & New Topic</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
};
