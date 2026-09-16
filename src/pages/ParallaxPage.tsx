import React, { useState, useEffect, useRef } from 'react';
import {
  Network,
  Sparkles,
  Square,
  ChevronDown,
  ChevronUp,
  Settings2,
  MessageSquare,
  Archive,
  Trash2,
  Info,
  Search,
  Volume2,
  Play,
  Download,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { runParallaxSwarm } from '@/services/parallaxOrchestrator';
import { ParallaxSummaryCard } from '@/components/parallax/ParallaxSummaryCard';
import { ParallaxSettings } from '@/components/parallax/ParallaxSettings';
import { ParallaxAgentAvatar } from '@/components/parallax/ParallaxAgentIcon';
import { getParallaxAgentVoice, formatFullParallaxTranscript } from '@/data/parallaxVoices';
import { cleanMarkdownForSpeech } from '@/lib/format';
import type {
  ParallaxMessage,
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const swarmPlaybackCancelledRef = useRef<boolean>(false);

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
      const voice = config.agents[msg.agentId]?.voice || getParallaxAgentVoice(msg.agentId);
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
      const voice = config.agents[msg.agentId]?.voice || getParallaxAgentVoice(msg.agentId);

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
              const voice = config.agents[msg.agentId]?.voice || getParallaxAgentVoice(msg.agentId);
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
            const voice = config.agents[msg.agentId]?.voice || getParallaxAgentVoice(msg.agentId);

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
    const transcript = formatFullParallaxTranscript(currentTopic || topicInput, messages, summary);
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
    setCurrentTopic(targetTopic);
    setIsRunning(true);
    setCurrentRound(1);
    setStatusText('Mobilizing 20-agent cognitive mesh...');
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
      },
      onMessage: (msg) => {
        setMessages((prev) => [...prev, msg]);
      },
      onStatusUpdate: (status) => {
        setStatusText(status);
      },
      onComplete: (sum) => {
        setSummary(sum);
        setWasStoppedEarly(false);
        setIsRunning(false);
        setSessions(storage.getParallaxSessions());
      },
      onError: (err) => {
        setErrorText(err);
        setIsRunning(false);
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

  return (
    <div
      id="parallax-page"
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '24px 20px 80px',
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Top HUD Header */}
      <div
        id="parallax-header"
        style={{
          borderRadius: '16px',
          padding: '20px 24px',
          background: 'linear-gradient(135deg, rgba(8, 22, 34, 0.95) 0%, rgba(4, 12, 18, 0.98) 100%)',
          border: '1.5px solid rgba(97, 215, 201, 0.35)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.25) 0%, rgba(97, 215, 201, 0.25) 100%)',
              border: '1.5px solid rgba(97, 215, 201, 0.5)',
              display: 'grid',
              placeItems: 'center',
              color: '#61d7c9',
              boxShadow: '0 0 20px rgba(6, 182, 212, 0.3)',
            }}
          >
            <Network size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 900, letterSpacing: '-0.02em', color: '#fff' }}>
                PARALLAX
              </h1>
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'DM Mono, monospace',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: 'rgba(97, 215, 201, 0.15)',
                  color: '#61d7c9',
                  border: '1px solid rgba(97, 215, 201, 0.35)',
                }}
              >
                SWARM MATRIX v1.0
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#94a3b8' }}>
              20-Persona High-Velocity Swarm Discussion • 3-Round Hard Cap • VERITAS Tool Grounding
            </p>
          </div>
        </div>

        {/* HUD Badges & Round Tracker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Round Indicator Pill */}
          <div
            id="parallax-round-indicator"
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              background: isRunning
                ? 'rgba(6, 182, 212, 0.2)'
                : summary
                ? 'rgba(34, 197, 94, 0.2)'
                : 'rgba(15, 23, 42, 0.8)',
              border: `1px solid ${
                isRunning
                  ? 'rgba(6, 182, 212, 0.5)'
                  : wasStoppedEarly
                  ? 'rgba(244, 63, 94, 0.5)'
                  : summary
                  ? 'rgba(34, 197, 94, 0.5)'
                  : 'rgba(165, 207, 214, 0.2)'
              }`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              fontWeight: 700,
              fontFamily: 'DM Mono, monospace',
              color: isRunning ? '#38bdf8' : wasStoppedEarly ? '#fb7185' : summary ? '#4ade80' : '#cbd5e1',
            }}
          >
            {isRunning && (
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#38bdf8',
                  boxShadow: '0 0 8px #38bdf8',
                  animation: 'pulse 1.5s infinite',
                }}
              />
            )}
            {isRunning
              ? `ROUND ${currentRound || 1} OF 3`
              : wasStoppedEarly
              ? 'SWARM STOPPED'
              : summary
              ? 'SWARM COMPLETE (3/3)'
              : 'READY (3 ROUNDS)'}
          </div>

          {/* Active Agents Badge */}
          <div
            style={{
              padding: '6px 12px',
              borderRadius: '999px',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(165, 207, 214, 0.2)',
              fontSize: '12px',
              fontFamily: 'DM Mono, monospace',
              color: '#94a3b8',
            }}
          >
            <strong style={{ color: '#61d7c9' }}>{enabledAgentsCount}</strong>/20 Personas
          </div>
        </div>
      </div>

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

      {/* TAB CONTENT: SETTINGS */}
      {activeTab === 'settings' && (
        <ParallaxSettings config={config} onConfigChange={(newCfg) => setConfig(newCfg)} />
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
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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

          {/* Live YouTube-Style Swarm Feed */}
          <div
            id="parallax-live-feed-container"
            style={{
              borderRadius: '16px',
              background: 'rgba(4, 12, 18, 0.95)',
              border: '1px solid rgba(97, 215, 201, 0.25)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              minHeight: '380px',
              maxHeight: '680px',
              overflowY: 'auto',
              position: 'relative',
            }}
          >
            {messages.length === 0 && !isRunning ? (
              <div
                style={{
                  margin: 'auto',
                  textAlign: 'center',
                  padding: '60px 20px',
                  color: '#94a3b8',
                }}
              >
                <Network size={42} color="rgba(97, 215, 201, 0.4)" style={{ margin: '0 auto 16px' }} />
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#e2e8f0' }}>
                  No Active Swarm
                </h3>
                <p style={{ margin: 0, fontSize: '13px', maxWidth: '420px', lineHeight: 1.5 }}>
                  Enter a topic above and tap <strong>Start Parallax</strong>. Exactly 20 small AI personas will react across 3 rounds, then auto-stop and generate a consensus summary.
                </p>
              </div>
            ) : (
              <>
                {/* Compact Sticky Swarm Feed Toolbar */}
                <div
                  id="parallax-feed-toolbar"
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 30,
                    background: 'rgba(4, 12, 18, 0.96)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    borderBottom: '1px solid rgba(97, 215, 201, 0.25)',
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.45)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.01em' }}>
                      Deliberation Feed
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontFamily: 'DM Mono, monospace',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        background: 'rgba(6, 182, 212, 0.15)',
                        color: '#61d7c9',
                        border: '1px solid rgba(6, 182, 212, 0.35)',
                        fontWeight: 700,
                      }}
                    >
                      {messages.length} messages
                    </span>
                    {wasStoppedEarly && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontFamily: 'DM Mono, monospace',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: 'rgba(244, 63, 94, 0.15)',
                          color: '#fb7185',
                          border: '1px solid rgba(244, 63, 94, 0.4)',
                          fontWeight: 700,
                        }}
                      >
                        Swarm stopped early by user
                      </span>
                    )}
                    {fullSwarmProgress && (
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#38bdf8',
                          fontFamily: 'DM Mono, monospace',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <Loader2 size={12} className="animate-spin" />
                        Synthesizing audio: {fullSwarmProgress.current} / {fullSwarmProgress.total}
                      </span>
                    )}
                  </div>

                  {/* Actions: Stop Swarm (if running), Copy Full Swarm, Listen to Full Swarm, Download MP3 */}
                  <div
                    id="parallax-feed-actions-cluster"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}
                    className="w-full sm:w-auto justify-start sm:justify-end"
                  >
                    {/* Live Stop Swarm Button in Feed Toolbar */}
                    {isRunning && (
                      <button
                        id="parallax-feed-stop-swarm-btn"
                        type="button"
                        onClick={handleStopSwarm}
                        title="Immediately halt the running swarm and retain completed messages"
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(185, 28, 28, 0.4) 100%)',
                          border: '1.5px solid rgba(239, 68, 68, 0.7)',
                          color: '#fecdd3',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          transition: 'all 0.15s ease',
                          boxShadow: '0 0 12px rgba(239, 68, 68, 0.25)',
                          whiteSpace: 'nowrap',
                        }}
                        className="hover:bg-red-900/60 hover:text-white active:scale-95"
                      >
                        <Square size={11} fill="currentColor" />
                        <span>Stop Swarm</span>
                      </button>
                    )}

                    {/* Copy Full Swarm Button */}
                    <button
                      id="parallax-copy-full-swarm-btn"
                      type="button"
                      onClick={handleCopyFullSwarm}
                      title="Copy complete transcript including all rounds and summary"
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        background: copiedSwarmTranscript ? 'rgba(16, 185, 129, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                        border: `1px solid ${copiedSwarmTranscript ? '#10b981' : 'rgba(97, 215, 201, 0.3)'}`,
                        color: copiedSwarmTranscript ? '#10b981' : '#cbd5e1',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap',
                      }}
                      className="hover:border-[#61d7c9] hover:text-white active:scale-95"
                    >
                      {copiedSwarmTranscript ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedSwarmTranscript ? 'Copied Full Swarm!' : 'Copy Full Swarm'}</span>
                    </button>

                    {/* Listen to Full Swarm Button */}
                    <button
                      id="parallax-listen-full-swarm-btn"
                      type="button"
                      onClick={handleListenToFullSwarm}
                      disabled={loadingAudioKey === 'full_swarm' && !fullSwarmProgress}
                      title={playingAudioKey === 'full_swarm' ? 'Stop audio' : 'Listen to all 20 agents back-to-back'}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        background: playingAudioKey === 'full_swarm'
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(97, 215, 201, 0.25) 100%)',
                        border: `1px solid ${playingAudioKey === 'full_swarm' ? '#10b981' : 'rgba(97, 215, 201, 0.5)'}`,
                        color: playingAudioKey === 'full_swarm' ? '#4ade80' : '#61d7c9',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap',
                      }}
                      className="hover:border-[#61d7c9] hover:brightness-110 active:scale-95"
                    >
                      {loadingAudioKey === 'full_swarm' ? (
                        <Loader2 size={13} className="animate-spin text-cyan-400" />
                      ) : playingAudioKey === 'full_swarm' ? (
                        <Square size={12} fill="currentColor" />
                      ) : (
                        <Play size={12} fill="currentColor" />
                      )}
                      <span>
                        {loadingAudioKey === 'full_swarm'
                          ? fullSwarmProgress
                            ? `Synthesizing (${fullSwarmProgress.current}/${fullSwarmProgress.total})...`
                            : 'Synthesizing...'
                          : playingAudioKey === 'full_swarm'
                          ? 'Stop Deliberation'
                          : 'Listen to Full Swarm'}
                      </span>
                    </button>

                    {/* Download as MP3 Button */}
                    <button
                      id="parallax-download-swarm-mp3-btn"
                      type="button"
                      onClick={handleDownloadSwarmMp3}
                      disabled={isDownloadingSwarmMp3}
                      title="Stitch and download all 20 agents as a contiguous MP3"
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(165, 207, 214, 0.25)',
                        color: '#cbd5e1',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: isDownloadingSwarmMp3 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap',
                      }}
                      className="hover:border-[#61d7c9] hover:text-white active:scale-95"
                    >
                      {isDownloadingSwarmMp3 ? (
                        <Loader2 size={13} className="animate-spin text-cyan-400" />
                      ) : (
                        <Download size={13} />
                      )}
                      <span>{isDownloadingSwarmMp3 ? 'Exporting MP3...' : 'Download MP3'}</span>
                    </button>
                  </div>
                </div>

                {/* Scrollable Deliberation Content */}
                <div
                  id="parallax-feed-content"
                  style={{
                    padding: '16px 20px 24px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px',
                  }}
                >
                  {/* RENDER BY ROUND WITH INLINE CURATION (first 4-5 inline, rest collapsed) */}
                {[1, 2, 3].map((roundNum) => {
                  const roundMsgs = messages.filter((m) => m.round === roundNum);
                  if (roundMsgs.length === 0) return null;

                  const isExpanded = Boolean(expandedRounds[roundNum]);
                  const CURATED_COUNT = 5;
                  const visibleMsgs = isExpanded ? roundMsgs : roundMsgs.slice(0, CURATED_COUNT);
                  const hiddenCount = Math.max(0, roundMsgs.length - CURATED_COUNT);

                  return (
                    <div key={roundNum} id={`parallax-round-section-${roundNum}`}>
                      {/* Round Header Divider */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          marginBottom: '14px',
                          paddingBottom: '8px',
                          borderBottom: '1px solid rgba(165, 207, 214, 0.15)',
                        }}
                      >
                        <div
                          style={{
                            padding: '3px 10px',
                            borderRadius: '6px',
                            background: 'rgba(6, 182, 212, 0.2)',
                            border: '1px solid rgba(6, 182, 212, 0.4)',
                            fontSize: '11px',
                            fontFamily: 'DM Mono, monospace',
                            fontWeight: 800,
                            color: '#38bdf8',
                          }}
                        >
                          ROUND {roundNum} OF 3
                        </div>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {roundNum === 1
                            ? 'Initial reactions to topic (VERITAS tool grounding)'
                            : roundNum === 2
                            ? 'Reacting to peer statements from Round 1'
                            : 'Final synthesis reactions before hard stop'}
                        </span>
                        <span
                          style={{
                            marginLeft: 'auto',
                            fontSize: '11px',
                            fontFamily: 'DM Mono, monospace',
                            color: '#61d7c9',
                          }}
                        >
                          {roundMsgs.length} replies
                        </span>
                      </div>

                      {/* YouTube Chat Style Message Stream */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {visibleMsgs.map((msg) => (
                          <div
                            key={msg.id}
                            className="transition-all duration-200"
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '10px',
                              padding: '8px 12px',
                              borderRadius: '10px',
                              background: 'rgba(8, 22, 34, 0.65)',
                              borderLeft: `3px solid ${msg.accentColor}`,
                            }}
                          >
                            {/* Agent Icon Avatar */}
                            <ParallaxAgentAvatar
                              agentId={msg.agentId}
                              agentName={msg.agentName}
                              accentColor={msg.accentColor}
                              size="sm"
                              style={{ marginTop: '2px' }}
                            />

                            {/* Message Content */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  flexWrap: 'wrap',
                                  marginBottom: '2px',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: '12px',
                                    fontWeight: 800,
                                    color: msg.accentColor,
                                    fontFamily: 'DM Mono, monospace',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                  }}
                                >
                                  {msg.agentName}
                                  {msg.mood && (
                                    <span
                                      id={`parallax-msg-mood-${msg.id}`}
                                      title={`Tone: ${msg.mood}`}
                                      style={{ fontSize: '13px', lineHeight: 1, userSelect: 'none' }}
                                    >
                                      {msg.mood}
                                    </span>
                                  )}
                                </span>

                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontFamily: 'DM Mono, monospace',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    background: 'rgba(148, 163, 184, 0.1)',
                                    color: '#94a3b8',
                                  }}
                                >
                                  R{msg.round}
                                </span>

                                {msg.conviction !== undefined && (
                                  <span
                                    id={`parallax-conviction-badge-${msg.id}`}
                                    title={`Conviction: ${msg.conviction}/10`}
                                    style={{
                                      fontSize: '10px',
                                      fontFamily: 'DM Mono, monospace',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      background:
                                        msg.conviction >= 8
                                          ? 'rgba(239, 68, 68, 0.15)'
                                          : msg.conviction >= 5
                                          ? 'rgba(234, 179, 8, 0.15)'
                                          : 'rgba(59, 130, 246, 0.15)',
                                      color:
                                        msg.conviction >= 8
                                          ? '#f87171'
                                          : msg.conviction >= 5
                                          ? '#facc15'
                                          : '#60a5fa',
                                      border: `1px solid ${
                                        msg.conviction >= 8
                                          ? 'rgba(239, 68, 68, 0.3)'
                                          : msg.conviction >= 5
                                          ? 'rgba(234, 179, 8, 0.3)'
                                          : 'rgba(59, 130, 246, 0.3)'
                                      }`,
                                      fontWeight: 600,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '2px',
                                    }}
                                  >
                                    Conviction: {msg.conviction}/10
                                  </span>
                                )}

                                {msg.toolUsed && (
                                  <span
                                    title={`Fact: ${msg.toolUsed.fact}`}
                                    style={{
                                      fontSize: '10px',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      background: 'rgba(6, 182, 212, 0.2)',
                                      color: '#38bdf8',
                                      border: '1px solid rgba(6, 182, 212, 0.4)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                    }}
                                  >
                                    <Search size={10} />
                                    Fact Injected
                                  </span>
                                )}

                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {/* Speaker / Voice Playback Button */}
                                  <button
                                    id={`parallax-msg-voice-${msg.id}`}
                                    type="button"
                                    onClick={() => handlePlayMessageAudio(msg)}
                                    title={
                                      playingAudioKey === msg.id
                                        ? 'Stop voice playback'
                                        : `Listen to ${msg.agentName} (${config.agents[msg.agentId]?.voice || getParallaxAgentVoice(msg.agentId)})`
                                    }
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      background: playingAudioKey === msg.id ? 'rgba(16, 185, 129, 0.25)' : 'rgba(15, 23, 42, 0.75)',
                                      border: `1px solid ${playingAudioKey === msg.id ? '#10b981' : 'rgba(165, 207, 214, 0.25)'}`,
                                      borderRadius: '5px',
                                      padding: '2px 7px',
                                      color: playingAudioKey === msg.id ? '#4ade80' : '#94a3b8',
                                      cursor: 'pointer',
                                      fontSize: '10px',
                                      fontFamily: 'DM Mono, monospace',
                                      fontWeight: 600,
                                      transition: 'all 0.15s ease',
                                    }}
                                    className="hover:text-[#61d7c9] hover:border-[#61d7c9]"
                                  >
                                    {loadingAudioKey === msg.id ? (
                                      <Loader2 size={10} className="animate-spin text-cyan-400" />
                                    ) : playingAudioKey === msg.id ? (
                                      <>
                                        <Square size={9} fill="currentColor" />
                                        <span>Stop</span>
                                      </>
                                    ) : (
                                      <>
                                        <Volume2 size={10} />
                                        <span>Voice</span>
                                      </>
                                    )}
                                  </button>

                                  <span
                                    style={{
                                      fontSize: '10px',
                                      color: '#64748b',
                                      fontFamily: 'DM Mono, monospace',
                                    }}
                                  >
                                    {new Date(msg.timestamp).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit',
                                    })}
                                  </span>
                                </div>
                              </div>

                              <p
                                style={{
                                  margin: 0,
                                  fontSize: '13px',
                                  color: '#e2e8f0',
                                  lineHeight: 1.5,
                                  wordBreak: 'break-word',
                                }}
                              >
                                {msg.text}
                              </p>

                              {/* Tool snippet preview if used */}
                              {msg.toolUsed && (
                                <div
                                  style={{
                                    marginTop: '4px',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    background: 'rgba(6, 182, 212, 0.08)',
                                    border: '1px solid rgba(6, 182, 212, 0.2)',
                                    fontSize: '11px',
                                    color: '#94a3b8',
                                    fontStyle: 'italic',
                                  }}
                                >
                                  🔍 <strong style={{ color: '#38bdf8' }}>Verified Tool Data:</strong> &ldquo;
                                  {msg.toolUsed.fact}&rdquo;
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Expand / Collapse Button for this Round */}
                      {hiddenCount > 0 && (
                        <button
                          id={`parallax-toggle-round-${roundNum}-btn`}
                          type="button"
                          onClick={() => toggleRoundExpand(roundNum)}
                          style={{
                            marginTop: '10px',
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: 'rgba(15, 23, 42, 0.7)',
                            border: '1px dashed rgba(97, 215, 201, 0.3)',
                            color: '#61d7c9',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease',
                          }}
                          className="hover:bg-[rgba(97,215,201,0.1)]"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp size={14} />
                              Collapse Round {roundNum} (Showing all {roundMsgs.length} replies)
                            </>
                          ) : (
                            <>
                              <ChevronDown size={14} />+{hiddenCount} more agents replied in Round {roundNum} (Click to expand)
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Parallax Summary Card (Appears after Round 3) */}
                {summary && (
                  <ParallaxSummaryCard
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
                  />
                )}

                {/* Swarm Stopped Early State (Shown instead of summary when user halts) */}
                {wasStoppedEarly && !summary && (
                  <div
                    id="parallax-stopped-early-card"
                    style={{
                      marginTop: '20px',
                      padding: '20px 24px',
                      borderRadius: '16px',
                      background: 'linear-gradient(135deg, rgba(30, 20, 26, 0.9) 0%, rgba(18, 12, 16, 0.95) 100%)',
                      border: '1.5px solid rgba(244, 63, 94, 0.45)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'rgba(244, 63, 94, 0.2)',
                            border: '1px solid rgba(244, 63, 94, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fb7185',
                          }}
                        >
                          <Square size={16} fill="currentColor" />
                        </div>
                        <div>
                          <div style={{ fontSize: '15px', fontWeight: 800, color: '#fecdd3', letterSpacing: '-0.01em' }}>
                            Swarm stopped early by user
                          </div>
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                            Deliberation halted • {messages.length} agent {messages.length === 1 ? 'message' : 'messages'} completed
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: '11px',
                          fontFamily: 'DM Mono, monospace',
                          padding: '4px 10px',
                          borderRadius: '999px',
                          background: 'rgba(244, 63, 94, 0.12)',
                          color: '#fb7185',
                          border: '1px solid rgba(244, 63, 94, 0.35)',
                          fontWeight: 700,
                        }}
                      >
                        SWARM STOPPED
                      </div>
                    </div>

                    <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: 1.6 }}>
                      The swarm progression was stopped before finishing all 3 rounds. Completed agent replies up to the stop point are preserved above. Final Parallax Summary synthesis was omitted because the transcript is incomplete.
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', paddingTop: '4px' }}>
                      <button
                        id="parallax-rerun-stopped-swarm-btn"
                        type="button"
                        onClick={() => handleStartSwarm(currentTopic)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                          border: 'none',
                          color: '#fff',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)',
                        }}
                        className="hover:opacity-90 active:scale-95"
                      >
                        <Sparkles size={14} />
                        Rerun Swarm (3 Rounds)
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
                        style={{
                          padding: '8px 16px',
                          borderRadius: '10px',
                          background: 'rgba(15, 23, 42, 0.8)',
                          border: '1px solid rgba(165, 207, 214, 0.25)',
                          color: '#cbd5e1',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                        className="hover:border-[#61d7c9] hover:text-white"
                      >
                        <Trash2 size={13} />
                        Discard & New Topic
                      </button>
                    </div>
                  </div>
                )}

                <div ref={feedEndRef} />
              </div>
            </>
          )}
        </div>
        </div>
      )}
    </div>
  );
};
