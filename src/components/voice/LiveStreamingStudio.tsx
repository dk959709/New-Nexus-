import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  RefreshCw,
  Download,
  AlertCircle,
  Clock,
  Mic,
  Play,
  Pause,
  Copy,
  Check,
  X,
  Layers,
} from 'lucide-react';
import { VoiceProviderConfig, StudioVoiceSettings } from '@/types';
import { playTapSound } from '@/lib/audio';
import { storage } from '@/lib/storage';
import {
  buildElevenLabsWebSocketUrl,
  isVoiceTierRestricted,
  pcmToWavBlob,
} from '@/lib/voiceProviderUtils';
import {
  LiveWaveformVisualizer,
  LiveConnectionState,
} from './LiveWaveformVisualizer';
import {
  LiveAudioDiagnosticsOverlay,
  DiagnosticEvent,
  DiagnosticSnapshot,
} from './LiveAudioDiagnosticsOverlay';
import { LiveSessionFeed, LiveSessionMessage } from './LiveSessionFeed';
import { StudioAudioControls } from './StudioAudioControls';
import { CloudVoicePicker } from './CloudVoicePicker';

interface LiveStreamingStudioProps {
  voiceId: string;
  voiceName: string;
  activeProvider: VoiceProviderConfig | null;
  onSelectVoice: (voiceId: string) => void;
  onFallbackToEdge: () => void;
  initialText?: string;
}

const LIVE_SAMPLE_PROMPTS = [
  {
    title: 'Breaking Tech Dispatch',
    text: 'Good evening. We are reporting live from the central tech symposium. Quantum computing throughput has achieved a 400% acceleration in sub-atomic algorithmic routing today.',
  },
  {
    title: 'Conversational Copilot',
    text: 'Hello! I am your real-time neural copilot. I am synthesizing speech dynamically as data packets stream across our low-latency WebSocket pipeline.',
  },
  {
    title: 'Cosmic Documentary',
    text: 'Deep within the Orion Nebula, stellar nurseries ignite in silent majesty. Gravitational waves ripple outward across hundreds of light-years, echoing into eternity.',
  },
  {
    title: 'Executive Concierge',
    text: 'Thank you for reaching out to premier priority concierge. I can immediately expedite your flight reservation and verify your lounge boarding credentials.',
  },
  {
    title: 'Rapid Status Update',
    text: 'All operational parameters remain nominal. Audio buffers are executing in sequence with zero inter-chunk latency.',
  },
];

export function LiveStreamingStudio({
  voiceId,
  voiceName,
  activeProvider,
  onSelectVoice,
  onFallbackToEdge,
  initialText = '',
}: LiveStreamingStudioProps) {
  // Live conversation messages feed
  const [messages, setMessages] = useState<LiveSessionMessage[]>([]);
  const messagesRef = useRef<LiveSessionMessage[]>([]);
  messagesRef.current = messages;

  // Active dialogue input state
  const [sessionInputText, setSessionInputText] = useState(
    initialText ||
      'Welcome to ElevenLabs Live Voice Streaming. Audio chunks are decoded and played seamlessly in real-time as text packets arrive.'
  );

  // Studio voice tuning parameters
  const [settings, setSettings] = useState<StudioVoiceSettings>({
    stability: 0.5,
    similarityBoost: 0.75,
    speed: 1.0,
  });

  // Connection & streaming status
  const [connectionStatus, setConnectionStatus] = useState<LiveConnectionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVoiceTierError, setIsVoiceTierError] = useState(false);
  const [hasCopiedError, setHasCopiedError] = useState(false);

  // Audio & telemetry metrics
  const [chunksCount, setChunksCount] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [timeToFirstChunkMs, setTimeToFirstChunkMs] = useState<number | null>(null);
  const [streamDurationSec, setStreamDurationSec] = useState(0);

  // Audio playback controls
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Completed session audio capture for replay and download
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const recordedAudioUrlRef = useRef<string | null>(null);
  const [recordedDuration, setRecordedDuration] = useState<number>(0);
  const recordedAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isRecordedPlaying, setIsRecordedPlaying] = useState(false);

  // Refs for audio pipeline and WebSocket
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlayTimeRef = useRef<number>(0);
  const rawChunkQueueRef = useRef<Uint8Array[]>([]);
  const leftoverPcmByteRef = useRef<number | null>(null);
  const isProcessingQueueRef = useRef<boolean>(false);
  const allRecordedChunksRef = useRef<Uint8Array[]>([]);

  // Persistent session tracking
  const isEndingSessionRef = useRef<boolean>(false);
  const pendingAudioMessageIdsRef = useRef<string[]>([]);
  const pendingTextToSendOnOpenRef = useRef<string | null>(null);

  // Timers and duration tracking
  const sessionStartTimeRef = useRef<number | null>(null);
  const sessionDurationSecRef = useRef<number>(0);
  const durationTimerRef = useRef<number | null>(null);
  const idleTimeoutTimerRef = useRef<number | null>(null);
  const connectionTimeoutTimerRef = useRef<number | null>(null);
  const completionCheckTimerRef = useRef<number | null>(null);

  // Anti-silence keep-alive and heartbeat refs (prevent mobile Chrome auto-suspending on inter-chunk gaps)
  const keepAliveSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioHeartbeatTimerRef = useRef<number | null>(null);

  // Diagnostics tracking refs (monitored at 4Hz by LiveAudioDiagnosticsOverlay)
  const heartbeatResumeCountRef = useRef<number>(0);
  const diagnosticsEventsRef = useRef<DiagnosticEvent[]>([]);
  const bufferSeqRef = useRef<number>(0);

  // Append real-time diagnostic event (capped to last 10 entries)
  const addDiagnosticEvent = useCallback(
    (type: DiagnosticEvent['type'], text: string) => {
      const timeMs = sessionStartTimeRef.current
        ? Math.max(0, Date.now() - sessionStartTimeRef.current)
        : 0;
      const event: DiagnosticEvent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timeMs,
        type,
        text,
      };
      diagnosticsEventsRef.current = [...diagnosticsEventsRef.current.slice(-9), event];
    },
    []
  );

  // Snapshot getter for the live monospace diagnostics panel
  const getDiagnosticsSnapshot = useCallback((): DiagnosticSnapshot => {
    const ctx = audioContextRef.current;
    const audioContextState = ctx ? ctx.state : 'uninitialized';
    const currentTime = ctx ? ctx.currentTime : 0;
    const nextPlayTime = nextPlayTimeRef.current;
    const gapSeconds = nextPlayTime > 0 ? nextPlayTime - currentTime : 0;
    return {
      audioContextState,
      heartbeatResumeCount: heartbeatResumeCountRef.current,
      nextPlayTime,
      currentTime,
      gapSeconds,
      isKeepAliveActive: !!keepAliveSourceRef.current,
      activeSourcesCount: activeSourcesRef.current.length,
      streamDurationSec: sessionDurationSecRef.current,
      connectionStatus,
      events: diagnosticsEventsRef.current,
    };
  }, [connectionStatus]);

  // Clean up and stop keep-alive audio source and heartbeat timer
  const stopKeepAliveSource = useCallback(() => {
    if (audioHeartbeatTimerRef.current) {
      clearInterval(audioHeartbeatTimerRef.current);
      audioHeartbeatTimerRef.current = null;
    }
    if (keepAliveSourceRef.current) {
      try {
        keepAliveSourceRef.current.stop();
        keepAliveSourceRef.current.disconnect();
      } catch {
        // ignore
      }
      keepAliveSourceRef.current = null;
    }
  }, []);

  // Clean up all session resources
  const cleanupLiveStream = useCallback(() => {
    console.log('[LiveVoice] cleanupLiveStream invoked');
    stopKeepAliveSource();

    // Clear timers
    if (connectionTimeoutTimerRef.current) {
      clearTimeout(connectionTimeoutTimerRef.current);
      connectionTimeoutTimerRef.current = null;
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (idleTimeoutTimerRef.current) {
      clearTimeout(idleTimeoutTimerRef.current);
      idleTimeoutTimerRef.current = null;
    }
    if (completionCheckTimerRef.current) {
      clearTimeout(completionCheckTimerRef.current);
      completionCheckTimerRef.current = null;
    }

    // Close WebSocket cleanly
    if (wsRef.current) {
      try {
        if (
          wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING
        ) {
          wsRef.current.close(1000, 'Session Ended');
        }
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    // Stop and disconnect all active AudioBufferSourceNodes
    if (activeSourcesRef.current.length > 0) {
      console.log(
        `[LiveVoice] Stopping and disconnecting ${activeSourcesRef.current.length} active AudioBufferSourceNodes`
      );
      for (const source of activeSourcesRef.current) {
        try {
          source.stop();
          source.disconnect();
        } catch {
          // ignore
        }
      }
      activeSourcesRef.current = [];
    }

    nextPlayTimeRef.current = 0;
    rawChunkQueueRef.current = [];
    leftoverPcmByteRef.current = null;
    isProcessingQueueRef.current = false;
    pendingAudioMessageIdsRef.current = [];
    isEndingSessionRef.current = false;
    setIsPlaying(false);
  }, [stopKeepAliveSource]);

  // Natural playback completion checker: triggers once all scheduled audio finishes playing
  const checkAndTriggerCompletion = useCallback(() => {
    const ctx = audioContextRef.current;
    const now = ctx ? ctx.currentTime : 0;
    const isPastNextPlayTime = !ctx || nextPlayTimeRef.current <= now + 0.05;
    const noActiveSources = activeSourcesRef.current.length === 0;
    const noQueuedChunks = rawChunkQueueRef.current.length === 0;

    if (noQueuedChunks && (noActiveSources || isPastNextPlayTime)) {
      if (isEndingSessionRef.current) {
        console.log(
          `[LiveVoice] [Cleanup Executed] Session end requested and all audio finished. nextPlayTimeRef=${nextPlayTimeRef.current.toFixed(
            4
          )}s, currentTime=${now.toFixed(4)}s.`
        );
        setIsPlaying(false);
        setConnectionStatus('completed');
        stopKeepAliveSource();
        if (durationTimerRef.current) {
          clearInterval(durationTimerRef.current);
          durationTimerRef.current = null;
        }
        if (idleTimeoutTimerRef.current) {
          clearTimeout(idleTimeoutTimerRef.current);
          idleTimeoutTimerRef.current = null;
        }
        if (completionCheckTimerRef.current) {
          clearTimeout(completionCheckTimerRef.current);
          completionCheckTimerRef.current = null;
        }
        addDiagnosticEvent('info', 'Live session ended cleanly after audio completed');
      } else {
        // Natural silence in an ongoing session: audio finished for current queue, session stays ready!
        setIsPlaying(false);
        setConnectionStatus((prev) => (prev === 'streaming' ? 'session_ready' : prev));
        console.log(
          `[LiveVoice] Audio finished speaking. Persistent live session remains READY for new messages.`
        );
      }
    }
  }, [stopKeepAliveSource, addDiagnosticEvent]);

  // Ensure cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupLiveStream();
      if (recordedAudioUrlRef.current) {
        URL.revokeObjectURL(recordedAudioUrlRef.current);
        recordedAudioUrlRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [cleanupLiveStream]);

  // Volume & Mute synchronizer
  useEffect(() => {
    if (gainNodeRef.current) {
      const val = isMuted ? 0 : volume;
      if (audioContextRef.current && audioContextRef.current.state === 'running') {
        try {
          gainNodeRef.current.gain.setValueAtTime(val, audioContextRef.current.currentTime);
        } catch {
          gainNodeRef.current.gain.value = val;
        }
      } else {
        gainNodeRef.current.gain.value = val;
      }
    }
    if (recordedAudioRef.current) {
      recordedAudioRef.current.volume = isMuted ? 0 : volume;
      recordedAudioRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Start Live Session (Opens persistent WebSocket & Web Audio pipeline)
  const startLiveSession = async (initialMessageText?: string) => {
    playTapSound();
    cleanupLiveStream();

    if (recordedAudioUrlRef.current) {
      URL.revokeObjectURL(recordedAudioUrlRef.current);
      recordedAudioUrlRef.current = null;
    }
    setRecordedAudioUrl(null);
    setRecordedDuration(0);

    const targetVoiceId = (voiceId || 'EXAVITQu4vr4xnSDxMaL').trim();

    // Free-tier voice restriction pre-check
    if (isVoiceTierRestricted(targetVoiceId)) {
      setIsVoiceTierError(true);
      setConnectionStatus('error');
      setErrorMessage(
        'ElevenLabs Free-Tier Restriction: Community and library voices are not permitted via the API. Please switch to an official premade voice (such as Sarah or George).'
      );
      return;
    }

    // Retrieve active API key
    if (!activeProvider || !activeProvider.keys || activeProvider.keys.length === 0) {
      setErrorMessage('No ElevenLabs API key found. Please configure your key in AI Providers Settings.');
      setConnectionStatus('error');
      return;
    }

    const healthyKey =
      activeProvider.keys.find((k) => k.health === 'healthy')?.key ||
      activeProvider.keys[0]?.key ||
      activeProvider.apiKey;

    if (!healthyKey) {
      setErrorMessage('No valid API key available for Cloud Voice AI.');
      setConnectionStatus('error');
      return;
    }

    // Reset state & telemetry
    setErrorMessage(null);
    setIsVoiceTierError(false);
    setConnectionStatus('connecting');
    setChunksCount(0);
    setTotalBytes(0);
    setTimeToFirstChunkMs(null);
    setStreamDurationSec(0);
    sessionDurationSecRef.current = 0;
    allRecordedChunksRef.current = [];
    rawChunkQueueRef.current = [];
    leftoverPcmByteRef.current = null;
    isEndingSessionRef.current = false;
    pendingAudioMessageIdsRef.current = [];

    // Reset diagnostics
    heartbeatResumeCountRef.current = 0;
    diagnosticsEventsRef.current = [];
    bufferSeqRef.current = 0;
    addDiagnosticEvent('info', 'Live session starting (24kHz linear PCM)...');

    // If initial text is passed or entered, queue it to send on open
    const promptToSend = (initialMessageText || sessionInputText || '').trim();
    if (promptToSend) {
      pendingTextToSendOnOpenRef.current = promptToSend;
    } else {
      pendingTextToSendOnOpenRef.current = null;
    }

    // 15-second connection timeout guard
    if (connectionTimeoutTimerRef.current) {
      clearTimeout(connectionTimeoutTimerRef.current);
      connectionTimeoutTimerRef.current = null;
    }
    connectionTimeoutTimerRef.current = window.setTimeout(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.warn('[LiveVoice] Connection timeout (15s) triggered before WebSocket open');
        setConnectionStatus('error');
        setErrorMessage(
          'Connection failed: Timed out waiting for ElevenLabs WebSocket to connect (15s). Please verify your internet connection and API key.'
        );
        cleanupLiveStream();
      }
    }, 15000);

    // Initialize or resume Web Audio Context
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioCtx();
        console.log('[LiveVoice] Created fresh AudioContext, state:', audioContextRef.current.state);
      }
      if (audioContextRef.current.state === 'suspended') {
        try {
          await Promise.race([
            audioContextRef.current.resume(),
            new Promise((resolve) => setTimeout(resolve, 600)),
          ]);
        } catch (resumeErr) {
          console.warn('[LiveVoice] AudioContext resume error (non-fatal):', resumeErr);
        }
      }

      // Initialize AnalyserNode & GainNode
      if (!analyserNodeRef.current || analyserNodeRef.current.context !== audioContextRef.current) {
        analyserNodeRef.current = audioContextRef.current.createAnalyser();
        analyserNodeRef.current.fftSize = 256;
        analyserNodeRef.current.smoothingTimeConstant = 0.8;
      }
      if (!gainNodeRef.current || gainNodeRef.current.context !== audioContextRef.current) {
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.gain.setValueAtTime(isMuted ? 0 : volume, audioContextRef.current.currentTime);
        gainNodeRef.current.connect(audioContextRef.current.destination);
      }

      // Initialize Anti-Silence Keep-Alive Source (loops continuous 0.0001 amplitude buffer)
      stopKeepAliveSource();
      const ctx = audioContextRef.current;
      const keepAliveRate = ctx.sampleRate || 24000;
      const keepAliveBuffer = ctx.createBuffer(1, keepAliveRate, keepAliveRate);
      const channelData = keepAliveBuffer.getChannelData(0);
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = (i % 2 === 0 ? 1 : -1) * 0.0001;
      }
      const keepAliveSource = ctx.createBufferSource();
      keepAliveSource.buffer = keepAliveBuffer;
      keepAliveSource.loop = true;
      try {
        keepAliveSource.connect(ctx.destination);
        keepAliveSource.start(0);
        keepAliveSourceRef.current = keepAliveSource;
        addDiagnosticEvent('info', 'Keep-alive silent source (0.0001 amp) started & looping');
      } catch (err) {
        console.warn('[LiveVoice] Keep-alive source connect warning:', err);
      }

      // Heartbeat timer (250ms) to auto-resume if mobile browser suspends AudioContext
      audioHeartbeatTimerRef.current = window.setInterval(async () => {
        const activeCtx = audioContextRef.current;
        if (!activeCtx) return;
        if (activeCtx.state === 'suspended') {
          heartbeatResumeCountRef.current += 1;
          const count = heartbeatResumeCountRef.current;
          addDiagnosticEvent('resumed', `Heartbeat #${count}: AudioContext was SUSPENDED! Auto-resuming...`);
          try {
            await activeCtx.resume();
            addDiagnosticEvent('resumed', `Heartbeat #${count}: AudioContext resumed (state: ${activeCtx.state})`);
          } catch (heartbeatErr) {
            console.error('[LiveVoice] AudioContext resume failed:', heartbeatErr);
          }
        }
      }, 250);
    } catch (e) {
      console.warn('[LiveVoice] Web Audio API init warning:', e);
    }

    // Reset playback tracking
    nextPlayTimeRef.current = 0;
    activeSourcesRef.current = [];
    rawChunkQueueRef.current = [];
    leftoverPcmByteRef.current = null;
    isProcessingQueueRef.current = false;

    // Schedules a decoded 24kHz AudioBuffer for gapless playback
    const scheduleAudioBuffer = async (audioBuffer: AudioBuffer) => {
      const ctx = audioContextRef.current;
      if (!ctx) return;

      if (ctx.state !== 'running') {
        try {
          await ctx.resume();
        } catch {
          // ignore
        }
      }

      if (!gainNodeRef.current || gainNodeRef.current.context !== ctx) {
        gainNodeRef.current = ctx.createGain();
      }
      const gainNode = gainNodeRef.current;
      const targetGain = isMuted ? 0 : volume > 0 ? volume : 1.0;
      gainNode.gain.setValueAtTime(targetGain, ctx.currentTime);

      const sourceNode = ctx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(gainNode);

      if (analyserNodeRef.current && analyserNodeRef.current.context === ctx) {
        try {
          sourceNode.connect(analyserNodeRef.current);
        } catch {
          // ignore
        }
      }

      try {
        gainNode.connect(ctx.destination);
      } catch {
        // ignore
      }

      // Timing & Gapless Scheduling
      const now = ctx.currentTime;
      const duration = audioBuffer.duration;
      const startTime = Math.max(now + 0.05, nextPlayTimeRef.current);
      const endTime = startTime + duration;
      nextPlayTimeRef.current = endTime;

      // Correlate buffer with earliest pending message in feed
      if (pendingAudioMessageIdsRef.current.length > 0) {
        const currentMsgId = pendingAudioMessageIdsRef.current[0];
        setMessages((prevMsgs) =>
          prevMsgs.map((m) => {
            if (m.id === currentMsgId) {
              const firstStart = m.firstScheduledStartTime ?? startTime;
              const curDur = (m.audioDurationSec || 0) + duration;
              return {
                ...m,
                firstScheduledStartTime: firstStart,
                lastScheduledEndTime: endTime,
                audioDurationSec: curDur,
              };
            }
            return m;
          })
        );
      }

      bufferSeqRef.current += 1;
      const bufferNum = bufferSeqRef.current;
      addDiagnosticEvent(
        'scheduled',
        `Buffer #${bufferNum} scheduled: start=${startTime.toFixed(3)}s, dur=${duration.toFixed(3)}s`
      );

      try {
        sourceNode.start(startTime);
        activeSourcesRef.current.push(sourceNode);
        setIsPlaying(true);
      } catch (startErr) {
        const errMsg = startErr instanceof Error ? startErr.message : String(startErr);
        addDiagnosticEvent('error', `Buffer #${bufferNum} start() failed: ${errMsg}`);
      }

      sourceNode.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== sourceNode);
        addDiagnosticEvent(
          'ended',
          `Buffer #${bufferNum} ended (active remaining: ${activeSourcesRef.current.length})`
        );
        checkAndTriggerCompletion();
      };
    };

    // Direct PCM audio processor: converts raw 16-bit linear PCM into Float32 AudioBuffers
    const processPcmQueue = async () => {
      if (isProcessingQueueRef.current) return;
      isProcessingQueueRef.current = true;

      const ctx = audioContextRef.current;
      if (!ctx) {
        isProcessingQueueRef.current = false;
        return;
      }

      if (ctx.state !== 'running') {
        try {
          await ctx.resume();
        } catch {
          // ignore
        }
      }

      while (rawChunkQueueRef.current.length > 0) {
        let chunkBytes = rawChunkQueueRef.current.shift()!;

        if (leftoverPcmByteRef.current !== null) {
          const stitched = new Uint8Array(chunkBytes.byteLength + 1);
          stitched[0] = leftoverPcmByteRef.current;
          stitched.set(chunkBytes, 1);
          leftoverPcmByteRef.current = null;
          chunkBytes = stitched;
        }

        if (chunkBytes.byteLength % 2 !== 0) {
          leftoverPcmByteRef.current = chunkBytes[chunkBytes.byteLength - 1];
          chunkBytes = chunkBytes.subarray(0, chunkBytes.byteLength - 1);
        }

        const sampleCount = chunkBytes.byteLength / 2;
        if (sampleCount <= 0) continue;

        // Convert 16-bit linear PCM (little-endian) to Float32 [-1.0, 1.0]
        const float32 = new Float32Array(sampleCount);
        const dataView = new DataView(chunkBytes.buffer, chunkBytes.byteOffset, chunkBytes.byteLength);
        for (let i = 0; i < sampleCount; i++) {
          const int16 = dataView.getInt16(i * 2, true);
          float32[i] = int16 / 32768.0;
        }

        const audioBuffer = ctx.createBuffer(1, sampleCount, 24000);
        audioBuffer.copyToChannel(float32, 0);

        await scheduleAudioBuffer(audioBuffer);
      }

      isProcessingQueueRef.current = false;
      if (rawChunkQueueRef.current.length > 0) {
        processPcmQueue();
      }
    };

    const appendChunkToBuffer = (chunk: Uint8Array) => {
      allRecordedChunksRef.current.push(chunk);
      rawChunkQueueRef.current.push(chunk);
      processPcmQueue();
    };

    // Build ElevenLabs WebSocket URL with output_format=pcm_24000
    const modelId = activeProvider.model || 'eleven_turbo_v2_5';
    const outputFormat = 'pcm_24000';
    const wsUrl = buildElevenLabsWebSocketUrl(targetVoiceId, modelId, outputFormat);
    const connectStartTime = Date.now();
    console.log(`[LiveVoice] Connecting to ElevenLabs WebSocket (output_format=${outputFormat}):`, wsUrl);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Handle 20-second idle timeout detection
      const resetIdleTimer = () => {
        if (idleTimeoutTimerRef.current) clearTimeout(idleTimeoutTimerRef.current);
        idleTimeoutTimerRef.current = window.setTimeout(() => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            setConnectionStatus('timeout');
            setErrorMessage(
              'ElevenLabs 20-Second Idle Timeout: Connection paused due to 20 seconds of stream inactivity. Type a message or click "Reconnect" to resume anytime.'
            );
            cleanupLiveStream();
          }
        }, 21000);
      };

      ws.onopen = () => {
        if (connectionTimeoutTimerRef.current) {
          clearTimeout(connectionTimeoutTimerRef.current);
          connectionTimeoutTimerRef.current = null;
        }
        resetIdleTimer();
        setConnectionStatus('session_ready');

        // Start session duration counter & message playback status synchronizer
        sessionStartTimeRef.current = Date.now();
        durationTimerRef.current = window.setInterval(() => {
          if (sessionStartTimeRef.current) {
            const elapsed = (Date.now() - sessionStartTimeRef.current) / 1000;
            sessionDurationSecRef.current = elapsed;
            setStreamDurationSec(elapsed);
          }

          // Dynamically synchronize message status: queued -> speaking -> spoken
          const curTime = audioContextRef.current ? audioContextRef.current.currentTime : 0;
          setMessages((prevMsgs) => {
            let changed = false;
            const updated = prevMsgs.map((msg) => {
              let newStatus: LiveSessionMessage['status'] = msg.status;
              if (
                msg.firstScheduledStartTime !== undefined &&
                msg.lastScheduledEndTime !== undefined
              ) {
                if (curTime >= msg.lastScheduledEndTime) {
                  newStatus = 'spoken';
                } else if (curTime >= msg.firstScheduledStartTime) {
                  newStatus = 'speaking';
                } else {
                  newStatus = 'queued';
                }
              }
              if (newStatus !== msg.status) {
                changed = true;
                return { ...msg, status: newStatus };
              }
              return msg;
            });
            return changed ? updated : prevMsgs;
          });
        }, 100);

        // Send Beginning-Of-Stream (BOS) configuration message with xi_api_key
        const bosPayload = {
          text: ' ',
          voice_settings: {
            stability: settings.stability,
            similarity_boost: settings.similarityBoost,
            speed: settings.speed,
          },
          generation_config: {
            chunk_length_schedule: [120, 160, 250, 290],
          },
          xi_api_key: healthyKey,
        };
        ws.send(JSON.stringify(bosPayload));
        console.log('[LiveVoice] BOS sent to ElevenLabs. Persistent session is READY.');

        // If there was initial prompt text queued, send it immediately!
        if (pendingTextToSendOnOpenRef.current) {
          const textToSend = pendingTextToSendOnOpenRef.current;
          pendingTextToSendOnOpenRef.current = null;
          sendSessionMessage(textToSend);
        }
      };

      ws.onmessage = async (event) => {
        resetIdleTimer();
        try {
          const rawType = typeof event.data;
          let rawText: string;
          if (rawType === 'string') {
            rawText = event.data;
          } else if (event.data instanceof Blob) {
            rawText = await event.data.text();
          } else if (event.data instanceof ArrayBuffer) {
            rawText = new TextDecoder('utf-8').decode(event.data);
          } else {
            rawText = String(event.data);
          }

          let response: Record<string, unknown>;
          try {
            response = JSON.parse(rawText);
          } catch {
            return;
          }

          const hasAudioField = typeof response.audio === 'string' && response.audio.trim().length > 0;
          const isFinal = Boolean(response.isFinal || response.is_final);

          // Check for API errors in payload
          if (response.error || response.code) {
            const errCode = response.code || 500;
            const errMsg = String(response.message || response.error || 'ElevenLabs streaming error');

            if (errCode === 402 || /paid_plan_required/i.test(errMsg) || /library/i.test(errMsg)) {
              setIsVoiceTierError(true);
              setErrorMessage(
                'ElevenLabs Free-Tier Restriction (402 paid_plan_required): Free accounts are restricted to official premade voices (Sarah, George, Brian, Alice).'
              );
            } else {
              setErrorMessage(errMsg);
            }
            setConnectionStatus('error');
            cleanupLiveStream();
            return;
          }

          // Handle incoming base64 audio chunk
          if (hasAudioField) {
            const base64Str = (response.audio as string).trim();
            try {
              const binaryStr = window.atob(base64Str);
              const decodedByteLength = binaryStr.length;
              const bytes = new Uint8Array(decodedByteLength);
              for (let i = 0; i < decodedByteLength; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }

              if (timeToFirstChunkMs === null) {
                setTimeToFirstChunkMs(Date.now() - connectStartTime);
              }

              const sampleCount = Math.floor(decodedByteLength / 2);
              setChunksCount((prev) => prev + 1);
              setTotalBytes((prev) => prev + decodedByteLength);

              const chunkNum = allRecordedChunksRef.current.length + 1;
              addDiagnosticEvent(
                'chunk',
                `Chunk #${chunkNum} received (${decodedByteLength}B, ${sampleCount} samples)`
              );

              appendChunkToBuffer(bytes);
            } catch (atobErr) {
              console.error('[LiveVoice] Base64 decoding failed:', atobErr);
            }
          }

          // Handle isFinal flag for current flushed segment
          if (isFinal) {
            console.log(
              `[LiveVoice] Message segment isFinal confirmed. Total session PCM chunks: ${allRecordedChunksRef.current.length}`
            );
            addDiagnosticEvent(
              'info',
              `Segment audio completed on network (${allRecordedChunksRef.current.length} total PCM chunks)`
            );

            // Shift completed message from audio generation queue
            if (pendingAudioMessageIdsRef.current.length > 0) {
              pendingAudioMessageIdsRef.current.shift();
            }

            processPcmQueue();

            // Assemble continuous full-session WAV recording for download & replay
            if (allRecordedChunksRef.current.length > 0) {
              const wavBlob = pcmToWavBlob(allRecordedChunksRef.current, 24000, 1);
              const totalPcmBytes = allRecordedChunksRef.current.reduce(
                (sum, c) => sum + c.byteLength,
                0
              );
              const exactDuration = totalPcmBytes / (24000 * 2);

              if (recordedAudioUrlRef.current) {
                URL.revokeObjectURL(recordedAudioUrlRef.current);
              }
              const url = URL.createObjectURL(wavBlob);
              recordedAudioUrlRef.current = url;
              setRecordedAudioUrl(url);
              setRecordedDuration(exactDuration);
            }

            // If user explicitly initiated "End Session", check if audio is still playing
            if (isEndingSessionRef.current) {
              const ctx = audioContextRef.current;
              const now = ctx ? ctx.currentTime : 0;
              const isAudioStillPlaying =
                activeSourcesRef.current.length > 0 ||
                nextPlayTimeRef.current > now ||
                rawChunkQueueRef.current.length > 0;

              if (isAudioStillPlaying) {
                const remainingSec = ctx ? Math.max(0, nextPlayTimeRef.current - now) : 0;
                setConnectionStatus('finishing');
                addDiagnosticEvent(
                  'info',
                  `Ending session: finishing playback (~${remainingSec.toFixed(2)}s remaining).`
                );

                if (completionCheckTimerRef.current) clearTimeout(completionCheckTimerRef.current);
                const fallbackDelayMs = Math.max(600, Math.ceil(remainingSec * 1000) + 400);
                completionCheckTimerRef.current = window.setTimeout(() => {
                  checkAndTriggerCompletion();
                }, fallbackDelayMs);
              } else {
                checkAndTriggerCompletion();
              }
            }
          }
        } catch (parseErr) {
          console.error('[LiveVoice] WebSocket packet parse error:', parseErr);
        }
      };

      ws.onerror = (evt) => {
        console.error('[LiveVoice] WebSocket connection error:', evt);
        addDiagnosticEvent('error', 'WebSocket connection error event triggered');
        if (connectionTimeoutTimerRef.current) {
          clearTimeout(connectionTimeoutTimerRef.current);
          connectionTimeoutTimerRef.current = null;
        }
        setConnectionStatus('error');
        setErrorMessage(
          'Connection failed: WebSocket connection error. Please verify network connectivity and your ElevenLabs API key.'
        );
        cleanupLiveStream();
      };

      ws.onclose = (evt) => {
        addDiagnosticEvent('info', `WebSocket closed (code: ${evt.code}, reason: ${evt.reason || 'clean'})`);
        if (connectionTimeoutTimerRef.current) {
          clearTimeout(connectionTimeoutTimerRef.current);
          connectionTimeoutTimerRef.current = null;
        }
        if (idleTimeoutTimerRef.current) clearTimeout(idleTimeoutTimerRef.current);

        if (evt.code === 1008 || evt.code === 4001 || evt.reason?.includes('402')) {
          setIsVoiceTierError(true);
          setErrorMessage(
            'Connection failed (402): ElevenLabs Free-Tier Voice Policy Restriction. Community and library voices require a paid plan. Please switch to an official premade voice (Sarah, George, Brian, or Alice).'
          );
          setConnectionStatus('error');
          cleanupLiveStream();
        } else if (connectionStatus === 'connecting') {
          setConnectionStatus('error');
          setErrorMessage(
            `Connection failed: WebSocket closed prematurely during handshake (Code: ${evt.code}).`
          );
          cleanupLiveStream();
        } else {
          // If session was closed while audio still playing, defer finalization
          const ctx = audioContextRef.current;
          const now = ctx ? ctx.currentTime : 0;
          const isAudioStillPlaying =
            activeSourcesRef.current.length > 0 ||
            nextPlayTimeRef.current > now ||
            rawChunkQueueRef.current.length > 0;

          if (isAudioStillPlaying) {
            const remainingSec = ctx ? Math.max(0, nextPlayTimeRef.current - now) : 0;
            setConnectionStatus('finishing');
            if (completionCheckTimerRef.current) clearTimeout(completionCheckTimerRef.current);
            const fallbackDelayMs = Math.max(600, Math.ceil(remainingSec * 1000) + 400);
            completionCheckTimerRef.current = window.setTimeout(() => {
              checkAndTriggerCompletion();
            }, fallbackDelayMs);
          } else {
            setConnectionStatus((prev) => (prev === 'finishing' ? 'completed' : prev));
            cleanupLiveStream();
          }
        }
      };
    } catch (outerErr) {
      console.error('[LiveVoice] Exception in startLiveSession:', outerErr);
      const msg = outerErr instanceof Error ? outerErr.message : String(outerErr);
      setErrorMessage(`Connection failed: Initialization exception: ${msg}`);
      setConnectionStatus('error');
      cleanupLiveStream();
    }
  };

  // Send New Text Message Anytime (even while speaking a previous message!)
  const sendSessionMessage = (customText?: string) => {
    const textToSend = (customText !== undefined ? customText : sessionInputText).trim();
    if (!textToSend) return;

    // If session is currently inactive or in timeout, start fresh session with this text
    if (
      connectionStatus === 'idle' ||
      connectionStatus === 'completed' ||
      connectionStatus === 'interrupted' ||
      connectionStatus === 'error' ||
      connectionStatus === 'timeout'
    ) {
      startLiveSession(textToSend);
      setSessionInputText('');
      return;
    }

    // Cancel any pending end-session request since the user is sending more dialogue
    if (isEndingSessionRef.current) {
      isEndingSessionRef.current = false;
      if (completionCheckTimerRef.current) {
        clearTimeout(completionCheckTimerRef.current);
        completionCheckTimerRef.current = null;
      }
    }

    // Create conversation feed entry
    const newMsg: LiveSessionMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: textToSend,
      sentAt: Date.now(),
      status: 'queued',
    };

    setMessages((prev) => [...prev, newMsg]);
    pendingAudioMessageIdsRef.current.push(newMsg.id);
    setSessionInputText('');

    // Transmit over open WebSocket with flush: true (synthesizes immediately without closing stream)
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Reset 20-second idle timer
      if (idleTimeoutTimerRef.current) clearTimeout(idleTimeoutTimerRef.current);
      idleTimeoutTimerRef.current = window.setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          setConnectionStatus('timeout');
          setErrorMessage(
            'ElevenLabs 20-Second Idle Timeout: The live connection paused after 20s of inactivity. Click "Reconnect" or send a message to resume.'
          );
          cleanupLiveStream();
        }
      }, 21000);

      wsRef.current.send(JSON.stringify({ text: textToSend + ' ', flush: true }));
      setConnectionStatus('streaming');
      addDiagnosticEvent('info', `Sent text: "${textToSend.slice(0, 35)}..." (flush: true)`);
      console.log(`[LiveVoice] Transmitted message to open live session: "${textToSend}"`);
    } else {
      console.warn('[LiveVoice] WebSocket not yet open when message sent; message queued in pipeline.');
    }
  };

  // End Session (Gracefully closes after current and queued audio finishes playing)
  const handleEndSession = useCallback(() => {
    playTapSound();
    console.log('[LiveVoice] handleEndSession requested');
    isEndingSessionRef.current = true;

    const ctx = audioContextRef.current;
    const now = ctx ? ctx.currentTime : 0;
    const isAudioPlaying =
      activeSourcesRef.current.length > 0 ||
      nextPlayTimeRef.current > now ||
      rawChunkQueueRef.current.length > 0;

    // Send EOS to ElevenLabs
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ text: '' }));
      } catch {
        // ignore
      }
    }

    if (isAudioPlaying) {
      setConnectionStatus('finishing');
      const remainingSec = ctx ? Math.max(0, nextPlayTimeRef.current - now) : 0;
      addDiagnosticEvent(
        'info',
        `End Session initiated. Playing out remaining queued audio (~${remainingSec.toFixed(2)}s)...`
      );

      if (completionCheckTimerRef.current) clearTimeout(completionCheckTimerRef.current);
      const fallbackDelayMs = Math.max(600, Math.ceil(remainingSec * 1000) + 400);
      completionCheckTimerRef.current = window.setTimeout(() => {
        checkAndTriggerCompletion();
      }, fallbackDelayMs);
    } else {
      cleanupLiveStream();
      setConnectionStatus('completed');
    }
  }, [cleanupLiveStream, checkAndTriggerCompletion, addDiagnosticEvent]);

  // Stop All Audio Now (Immediate Hard-Stop)
  const handleHardStop = useCallback(() => {
    playTapSound();
    console.log('[LiveVoice] handleHardStop invoked');
    cleanupLiveStream();
    setConnectionStatus('interrupted');

    // Finalize any recorded audio captured up to this point
    if (allRecordedChunksRef.current.length > 0) {
      const wavBlob = pcmToWavBlob(allRecordedChunksRef.current, 24000, 1);
      if (recordedAudioUrlRef.current) {
        URL.revokeObjectURL(recordedAudioUrlRef.current);
      }
      const url = URL.createObjectURL(wavBlob);
      recordedAudioUrlRef.current = url;
      setRecordedAudioUrl(url);

      const totalPcmBytes = allRecordedChunksRef.current.reduce((sum, c) => sum + c.byteLength, 0);
      const exactDuration = totalPcmBytes / (24000 * 2);
      setRecordedDuration(exactDuration);
    }
  }, [cleanupLiveStream]);

  // Switch voice and retry helper for 402 recovery
  const handleRecoverVoice = (safeVoiceId: string) => {
    playTapSound();
    onSelectVoice(safeVoiceId);
    storage.saveCloudVoice(safeVoiceId);
    setIsVoiceTierError(false);
    setErrorMessage(null);
    startLiveSession();
  };

  // Download recorded stream as lossless WAV
  const handleDownloadRecorded = () => {
    playTapSound();
    if (!recordedAudioUrl) return;
    const a = document.createElement('a');
    a.href = recordedAudioUrl;
    const cleanName = voiceName.replace(/\s+/g, '-').toLowerCase();
    a.download = `elevenlabs-live-session-${cleanName}-${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Toggle recorded audio preview playback
  const handleToggleRecordedPlayback = () => {
    playTapSound();
    const el = recordedAudioRef.current;
    if (!el) return;
    if (isRecordedPlaying) {
      el.pause();
      setIsRecordedPlaying(false);
    } else {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
      el.volume = isMuted ? 0 : volume;
      el.muted = isMuted;
      if (el.currentTime >= el.duration && el.duration > 0) {
        el.currentTime = 0;
      }
      el.play()
        .then(() => setIsRecordedPlaying(true))
        .catch(() => setIsRecordedPlaying(false));
    }
  };

  const isSessionActive =
    connectionStatus === 'session_ready' ||
    connectionStatus === 'streaming' ||
    connectionStatus === 'finishing' ||
    connectionStatus === 'connecting';

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Visual Live Waveform & Spectrum Header */}
      <LiveWaveformVisualizer
        analyserNode={analyserNodeRef.current}
        isPlaying={isPlaying}
        isStreaming={connectionStatus === 'streaming' || connectionStatus === 'finishing'}
        status={connectionStatus}
        chunksCount={chunksCount}
        totalBytes={totalBytes}
        timeToFirstChunkMs={timeToFirstChunkMs}
        streamDurationSec={streamDurationSec}
        wordProgress={null}
        volume={volume}
        isMuted={isMuted}
        onVolumeChange={setVolume}
        onToggleMute={() => {
          playTapSound();
          setIsMuted(!isMuted);
        }}
        onStop={handleEndSession}
        onHardStop={handleHardStop}
      />

      {/* Real-Time Live Audio Diagnostics HUD & Monospace Console Overlay */}
      <LiveAudioDiagnosticsOverlay getSnapshot={getDiagnosticsSnapshot} defaultExpanded={false} />

      {/* 20-Second Idle Timeout Warning Banner */}
      {connectionStatus === 'timeout' && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-4 flex items-start justify-between gap-4 text-amber-200 text-xs animate-fadeIn shadow-lg">
          <div className="flex items-start gap-3">
            <Clock size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-amber-300 text-sm">
                Live Session Paused (20s Inactivity Timeout)
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px] sm:text-xs">
                ElevenLabs automatically pauses idle WebSockets after 20 seconds of silence to conserve resources. You can resume anytime without losing your narration history.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => startLiveSession()}
            className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition shadow shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw size={13} />
            <span>Reconnect Session</span>
          </button>
        </div>
      )}

      {/* 402 Free-Tier Voice Restriction Banner */}
      {errorMessage && isVoiceTierError && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-4 animate-fadeIn space-y-3 shadow-lg">
          <div className="flex items-start gap-3">
            <Sparkles size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <div className="font-semibold text-amber-300 text-sm">
                ElevenLabs Free-Tier Streaming Restriction (402 Paid Plan Required)
              </div>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                Free-tier API accounts cannot stream community or library voices over WebSockets. Please switch to a verified free-tier premade voice (Sarah, George, Brian, Alice).
              </p>
            </div>
          </div>

          <div className="pt-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleRecoverVoice('EXAVITQu4vr4xnSDxMaL')}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition shadow cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles size={12} />
              Switch to Sarah
            </button>
            <button
              type="button"
              onClick={() => handleRecoverVoice('JBFqnCBsd6RMkjVDRZzb')}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-500/40 font-semibold text-xs transition cursor-pointer"
            >
              Switch to George
            </button>
            <button
              type="button"
              onClick={() => handleRecoverVoice('nPczCjzI2devNBz1zQrb')}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-500/40 font-semibold text-xs transition cursor-pointer"
            >
              Switch to Brian
            </button>
            <button
              type="button"
              onClick={() => handleRecoverVoice('Xb7hH8MSUJpSbSDYk0k2')}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-500/40 font-semibold text-xs transition cursor-pointer"
            >
              Switch to Alice
            </button>
            <button
              type="button"
              onClick={onFallbackToEdge}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition shadow cursor-pointer flex items-center gap-1.5"
            >
              <Mic size={13} />
              Fall Back to Edge TTS
            </button>
          </div>
        </div>
      )}

      {/* Connection Error Banner */}
      {errorMessage && !isVoiceTierError && (
        <div className="bg-rose-950/80 border-2 border-rose-500/80 rounded-2xl p-4 sm:p-5 text-rose-100 text-xs sm:text-sm space-y-3 animate-fadeIn shadow-2xl backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle size={18} className="text-rose-400" />
              </div>
              <div className="space-y-1">
                <div className="font-bold text-sm sm:text-base text-rose-200 flex items-center gap-2">
                  <span>Session Error</span>
                  <span className="px-2 py-0.5 text-[10px] font-mono uppercase rounded-full bg-rose-500/30 text-rose-300 border border-rose-500/40">
                    Live WebSocket
                  </span>
                </div>
                <p className="text-xs text-rose-300/90 font-medium">
                  {errorMessage}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                playTapSound();
                setErrorMessage(null);
                setConnectionStatus('idle');
              }}
              className="p-1 rounded-lg text-rose-400 hover:text-white hover:bg-rose-900/60 transition cursor-pointer"
              title="Dismiss error message"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => {
                playTapSound();
                startLiveSession();
              }}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw size={13} />
              <span>Retry Session</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playTapSound();
                if (errorMessage) {
                  navigator.clipboard.writeText(errorMessage).then(() => {
                    setHasCopiedError(true);
                    setTimeout(() => setHasCopiedError(false), 2000);
                  });
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              {hasCopiedError ? (
                <>
                  <Check size={13} className="text-emerald-400" />
                  <span className="text-emerald-300">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy Error</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Voice Model Selector & Config */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider">
            Streaming Voice Model
          </label>
          <span className="text-[11px] font-mono text-purple-400">
            Selected: <span className="text-white font-semibold">{voiceName}</span> ({voiceId.slice(0, 8)}...)
          </span>
        </div>
        <CloudVoicePicker
          selectedVoiceId={voiceId}
          onSelectVoice={(vId) => {
            onSelectVoice(vId);
            storage.saveCloudVoice(vId);
          }}
          activeProvider={activeProvider}
        />
      </div>

      {/* Persistent Conversation-Style Feed & Instant Input Bar */}
      <LiveSessionFeed
        messages={messages}
        currentInput={sessionInputText}
        onInputChange={setSessionInputText}
        onSendMessage={(custom) => sendSessionMessage(custom)}
        isSessionActive={isSessionActive}
        isConnecting={connectionStatus === 'connecting'}
        connectionStatus={connectionStatus}
        onStartSession={() => startLiveSession()}
        onEndSession={handleEndSession}
        onHardStop={handleHardStop}
        samplePrompts={LIVE_SAMPLE_PROMPTS}
      />

      {/* Voice Tuning Rack & Session Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Session Details Card */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={13} className="text-purple-400" />
              Live Pipeline Architecture
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              24 kHz Studio PCM
            </span>
          </div>
          <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
            <p>
              • <strong className="text-slate-100">Persistent WebSocket:</strong> Stays open across multiple messages.
            </p>
            <p>
              • <strong className="text-slate-100">Gapless Audio Queue:</strong> Messages sent while speech is playing queue automatically in the AudioContext timeline without cutoffs.
            </p>
            <p>
              • <strong className="text-slate-100">Graceful End:</strong> Ending the session lets queued audio finish speaking naturally before teardown.
            </p>
          </div>
        </div>

        {/* Studio Audio Tuning Controls */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
          <StudioAudioControls settings={settings} onChangeSettings={setSettings} />
        </div>
      </div>

      {/* Session Recording Audio Player & WAV Download Bar */}
      {recordedAudioUrl && (
        <div className="bg-slate-950/90 border border-purple-500/30 rounded-xl p-4 flex items-center justify-between flex-wrap gap-4 shadow-lg animate-fadeIn">
          <audio
            ref={recordedAudioRef}
            src={recordedAudioUrl}
            preload="auto"
            onLoadedMetadata={(e) => {
              const dur = e.currentTarget.duration;
              if (!isNaN(dur) && isFinite(dur) && dur > 0) {
                setRecordedDuration(dur);
              }
            }}
            onPlay={() => setIsRecordedPlaying(true)}
            onPause={() => setIsRecordedPlaying(false)}
            onEnded={() => setIsRecordedPlaying(false)}
            className="hidden"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleToggleRecordedPlayback}
              className="w-10 h-10 rounded-xl bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center transition shadow cursor-pointer"
              title={isRecordedPlaying ? 'Pause Replay' : 'Play Full Session Audio'}
            >
              {isRecordedPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
            </button>
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <span>Session Recording (Complete WAV)</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  {voiceName}
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400">
                {chunksCount} audio chunks • 24 kHz Lossless WAV • Duration: ~{recordedDuration.toFixed(1)}s
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadRecorded}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-700 shadow-sm"
              title="Download entire session audio as 24kHz lossless WAV"
            >
              <Download size={13} />
              <span>Download Session WAV</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
