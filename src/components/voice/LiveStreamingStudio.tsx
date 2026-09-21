import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Radio,
  Sparkles,
  Square,
  RefreshCw,
  Download,
  AlertCircle,
  Clock,
  Mic,
  Play,
  Pause,
  Zap,
  Copy,
  Check,
  X,
  Activity,
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
    title: 'Conversational AI Copilot',
    text: 'Hello! I am your real-time neural copilot. I am synthesizing speech dynamically as data packets stream across our low-latency WebSocket pipeline.',
  },
  {
    title: 'Cosmic Documentary Narration',
    text: 'Deep within the Orion Nebula, stellar nurseries ignite in silent majesty. Gravitational waves ripple outward across hundreds of light-years, echoing into eternity.',
  },
  {
    title: 'Customer Concierge',
    text: 'Thank you for reaching out to premier priority concierge. I can immediately expedite your flight reservation and verify your lounge boarding credentials.',
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
  // Script and settings state
  const [text, setText] = useState(
    initialText ||
      'Welcome to ElevenLabs Live Voice Streaming. Audio chunks are decoded and played seamlessly in real-time as text packets arrive.'
  );
  const [streamMode, setStreamMode] = useState<'instant' | 'llm_simulation'>('instant');
  const [settings, setSettings] = useState<StudioVoiceSettings>({
    stability: 0.5,
    similarityBoost: 0.75,
    speed: 1.0,
  });

  // Connection & streaming status
  const [connectionStatus, setConnectionStatus] = useState<LiveConnectionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVoiceTierError, setIsVoiceTierError] = useState(false);

  // Audio & telemetry metrics
  const [chunksCount, setChunksCount] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [timeToFirstChunkMs, setTimeToFirstChunkMs] = useState<number | null>(null);
  const [streamDurationSec, setStreamDurationSec] = useState(0);
  const [wordProgress, setWordProgress] = useState<{ current: number; total: number } | null>(null);

  // Audio playback controls
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Completed audio capture for replay and download
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedDuration, setRecordedDuration] = useState<number>(0);
  const recordedAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isRecordedPlaying, setIsRecordedPlaying] = useState(false);
  const [hasCopiedError, setHasCopiedError] = useState(false);

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
  const isStreamFinalRef = useRef(false);
  const allRecordedChunksRef = useRef<Uint8Array[]>([]);

  // Timers and duration tracking
  const streamStartTimeRef = useRef<number | null>(null);
  const streamDurationSecRef = useRef<number>(0);
  const durationTimerRef = useRef<number | null>(null);
  const idleTimeoutTimerRef = useRef<number | null>(null);
  const connectionTimeoutTimerRef = useRef<number | null>(null);
  const simulationIntervalRef = useRef<number | null>(null);

  // Clean up all resources
  const cleanupLiveStream = useCallback(() => {
    console.log('[LiveVoice] cleanupLiveStream invoked');
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
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }

    // Close WebSocket cleanly
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close(1000, 'Live Stream Stopped');
        }
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    // Stop and disconnect all active AudioBufferSourceNodes
    if (activeSourcesRef.current.length > 0) {
      console.log(`[LiveVoice] Stopping and disconnecting ${activeSourcesRef.current.length} active AudioBufferSourceNodes`);
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
    setIsPlaying(false);
  }, []);

  // Ensure cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupLiveStream();
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [cleanupLiveStream, recordedAudioUrl]);

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
      console.log('[LiveVoice] Synchronized gainNode volume:', gainNodeRef.current.gain.value);
    }
    if (recordedAudioRef.current) {
      recordedAudioRef.current.volume = isMuted ? 0 : volume;
      recordedAudioRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Handle Stop Streaming / Interruption
  const handleStopStream = useCallback(() => {
    playTapSound();
    console.log('[LiveVoice] handleStopStream called');
    const elapsed = streamStartTimeRef.current
      ? (Date.now() - streamStartTimeRef.current) / 1000
      : streamDurationSecRef.current;

    cleanupLiveStream();
    setConnectionStatus('interrupted');

    // Finalize any recorded audio captured before interruption
    if (allRecordedChunksRef.current.length > 0) {
      const wavBlob = pcmToWavBlob(allRecordedChunksRef.current, 44100, 1);
      console.log(`[LiveVoice] Interrupted stream captured ${allRecordedChunksRef.current.length} PCM chunks, WAV blob size: ${wavBlob.size} bytes`);
      const url = URL.createObjectURL(wavBlob);
      setRecordedAudioUrl(url);

      const totalPcmBytes = allRecordedChunksRef.current.reduce((sum, c) => sum + c.byteLength, 0);
      const exactDuration = totalPcmBytes / (44100 * 2);
      setRecordedDuration(exactDuration > 0 ? exactDuration : elapsed);
      console.log(
        `[LiveVoice] Interrupted stream WAV playback ready. Duration: ${exactDuration.toFixed(2)}s, SampleRate: 44100Hz (lossless mono WAV)`
      );
    }
  }, [cleanupLiveStream]);

  // Main Streaming Execution Engine
  const startLiveStreaming = async (customVoiceId?: string) => {
    playTapSound();
    cleanupLiveStream();

    try {
      const targetVoiceId = (customVoiceId || voiceId || 'EXAVITQu4vr4xnSDxMaL').trim();
      const cleanText = text.trim();

      if (!cleanText) {
        setErrorMessage('Please enter dialogue or select a script to stream.');
        setConnectionStatus('error');
        return;
      }

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
      streamDurationSecRef.current = 0;
      allRecordedChunksRef.current = [];
      rawChunkQueueRef.current = [];
      leftoverPcmByteRef.current = null;
      isStreamFinalRef.current = false;
      setRecordedAudioUrl(null);
      setRecordedDuration(0);

      const wordsTotal = cleanText.split(/\s+/).filter(Boolean).length;
      setWordProgress({ current: 0, total: wordsTotal });

      // Connection Timeout (15 seconds): Prevents hanging on "CONNECTING WEBSOCKET..." forever
      if (connectionTimeoutTimerRef.current) {
        clearTimeout(connectionTimeoutTimerRef.current);
        connectionTimeoutTimerRef.current = null;
      }
      connectionTimeoutTimerRef.current = window.setTimeout(() => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          console.warn('[LiveVoice] Connection timeout (15s) triggered before WebSocket open');
          setConnectionStatus('error');
          setErrorMessage(
            'Connection failed: Timed out waiting for ElevenLabs WebSocket to connect (15s). The remote server did not respond in time. Please verify your internet connection and ElevenLabs API key validity, or switch to a premade voice.'
          );
          cleanupLiveStream();
        }
      }, 15000);

      // Initialize or resume Web Audio Context & Graph immediately during user interaction
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new AudioCtx();
          console.log('[LiveVoice] Created fresh AudioContext, state:', audioContextRef.current.state);
        }
        if (audioContextRef.current.state === 'suspended') {
          console.log('[LiveVoice] AudioContext is suspended, calling .resume() with race timeout...');
          try {
            await Promise.race([
              audioContextRef.current.resume(),
              new Promise((resolve) => setTimeout(resolve, 600)),
            ]);
          } catch (resumeErr) {
            console.warn('[LiveVoice] AudioContext resume error (non-fatal):', resumeErr);
          }
          console.log('[LiveVoice] AudioContext resume attempt finished. State:', audioContextRef.current.state);
        } else {
          console.log('[LiveVoice] AudioContext state:', audioContextRef.current.state);
        }

        if (!analyserNodeRef.current || analyserNodeRef.current.context !== audioContextRef.current) {
          const analyser = audioContextRef.current.createAnalyser();
          analyser.fftSize = 128;
          analyser.smoothingTimeConstant = 0.8;
          analyserNodeRef.current = analyser;
        }

        if (!gainNodeRef.current || gainNodeRef.current.context !== audioContextRef.current) {
          const gainNode = audioContextRef.current.createGain();
          gainNodeRef.current = gainNode;
        }

        const initialGain = isMuted ? 0 : (volume > 0 ? volume : 1.0);
        gainNodeRef.current.gain.setValueAtTime(initialGain, audioContextRef.current.currentTime);

        // Wire Web Audio Graph: GainNode -> Destination
        try {
          gainNodeRef.current.disconnect();
        } catch {
          // ignore
        }
        try {
          gainNodeRef.current.connect(audioContextRef.current.destination);
          console.log('[LiveVoice] Web Audio graph wired: GainNode -> Destination (gain:', gainNodeRef.current.gain.value, ')');
        } catch (wireErr) {
          console.warn('[LiveVoice] GainNode connect error:', wireErr);
        }
      } catch (e) {
        console.warn('[LiveVoice] Web Audio API init warning (continuing with connection):', e);
      }

    // Reset playback tracking for live stream
    nextPlayTimeRef.current = 0;
    activeSourcesRef.current = [];
    rawChunkQueueRef.current = [];
    leftoverPcmByteRef.current = null;
    isProcessingQueueRef.current = false;
    isStreamFinalRef.current = false;

    // Schedules a decoded AudioBuffer for seamless, gapless playback
    const scheduleAudioBuffer = async (audioBuffer: AudioBuffer, chunkInfo: string) => {
      const ctx = audioContextRef.current;
      if (!ctx) {
        console.warn('[LiveVoice] Cannot schedule buffer: AudioContext missing');
        return;
      }

      // [CHECK 1] AudioContext State & Await Resume
      if (ctx.state !== 'running') {
        console.log(`[LiveVoice] [Check 1] audioContext.state is "${ctx.state}". Awaiting ctx.resume()...`);
        try {
          await ctx.resume();
        } catch (resumeErr) {
          console.warn('[LiveVoice] [Check 1] ctx.resume() error during scheduling:', resumeErr);
        }
      }
      console.log(
        `[LiveVoice] [Check 1] audioContext.state at scheduling: "${ctx.state}" (ctx.currentTime=${ctx.currentTime.toFixed(4)}s)`
      );

      // [CHECK 2] Gain Node & Volume Initialization
      if (!gainNodeRef.current || gainNodeRef.current.context !== ctx) {
        gainNodeRef.current = ctx.createGain();
      }
      const gainNode = gainNodeRef.current;
      const targetGain = isMuted ? 0 : (volume > 0 ? volume : 1.0);
      gainNode.gain.setValueAtTime(targetGain, ctx.currentTime);
      console.log(
        `[LiveVoice] [Check 2] gainNode.gain.value=${gainNode.gain.value} (targetGain=${targetGain}, volumeState=${volume}, isMuted=${isMuted})`
      );

      // [CHECK 3] Full Connection Chain Verification
      const sourceNode = ctx.createBufferSource();
      sourceNode.buffer = audioBuffer;

      // 1. Direct connection to GainNode (audible playback through speakers)
      sourceNode.connect(gainNode);

      // 2. Direct connection to AnalyserNode (real-time waveform visualizer)
      if (analyserNodeRef.current && analyserNodeRef.current.context === ctx) {
        try {
          sourceNode.connect(analyserNodeRef.current);
        } catch (analyserConnErr) {
          console.warn('[LiveVoice] [Check 3] sourceNode -> analyserNode connection warning:', analyserConnErr);
        }
      }

      // 3. Ensure GainNode is connected to destination
      try {
        gainNode.connect(ctx.destination);
      } catch (destErr) {
        console.warn('[LiveVoice] [Check 3] gainNode -> ctx.destination connection warning:', destErr);
      }

      console.log(
        `[LiveVoice] [Check 3] Connection chain verified: sourceNode -> gainNode(gain=${gainNode.gain.value}) -> ctx.destination [SPEAKER OUTPUT]; sourceNode -> analyserNode [WAVEFORM]`
      );

      // [CHECK 4] Timing & Gapless Scheduling vs audioContext.currentTime
      const now = ctx.currentTime;
      const duration = audioBuffer.duration;
      // Start with small lead time (20ms) if first buffer or queue underrun, else gapless back-to-back
      const startTime = Math.max(now + 0.02, nextPlayTimeRef.current);
      const endTime = startTime + duration;
      nextPlayTimeRef.current = endTime;

      console.log(
        `[LiveVoice] [Check 4] Timing check: scheduled start(time)=${startTime.toFixed(4)}s vs ctx.currentTime=${now.toFixed(4)}s (delta: +${(startTime - now).toFixed(4)}s, lead: ${((startTime - now) * 1000).toFixed(1)}ms), duration=${duration.toFixed(4)}s, nextScheduledEndTime=${endTime.toFixed(4)}s`
      );

      // [CHECK 5] Calling source.start()
      try {
        sourceNode.start(startTime);
        activeSourcesRef.current.push(sourceNode);
        setIsPlaying(true);
        console.log(
          `[LiveVoice] [Check 5] source.start(${startTime.toFixed(4)}) called successfully for buffer [${chunkInfo}] (activeSourcesCount=${activeSourcesRef.current.length})`
        );
      } catch (startErr) {
        console.error(
          `[LiveVoice] [Check 5] source.start(${startTime.toFixed(4)}) FAILED for buffer [${chunkInfo}]:`,
          startErr
        );
      }

      sourceNode.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== sourceNode);
        console.log(
          `[LiveVoice] AudioBufferSourceNode ended. Remaining active: ${activeSourcesRef.current.length}, isFinal: ${isStreamFinalRef.current}`
        );

        if (
          activeSourcesRef.current.length === 0 &&
          isStreamFinalRef.current &&
          rawChunkQueueRef.current.length === 0
        ) {
          console.log('[LiveVoice] All scheduled live stream PCM audio finished playing.');
          setIsPlaying(false);
          setConnectionStatus('completed');
        }
      };
    };

    // Direct PCM audio processor: converts raw 16-bit linear PCM into Float32 AudioBuffers
    // bypassing decodeAudioData() entirely for 100% gapless, reliable live playback!
    const processPcmQueue = async () => {
      if (isProcessingQueueRef.current) {
        return;
      }
      isProcessingQueueRef.current = true;

      const ctx = audioContextRef.current;
      if (!ctx) {
        console.warn('[LiveVoice] processPcmQueue: AudioContext is not available');
        isProcessingQueueRef.current = false;
        return;
      }

      if (ctx.state !== 'running') {
        try {
          await ctx.resume();
          console.log('[LiveVoice] AudioContext resumed in processPcmQueue. State:', ctx.state);
        } catch (resumeErr) {
          console.warn('[LiveVoice] AudioContext resume error in pcm queue:', resumeErr);
        }
      }

      while (rawChunkQueueRef.current.length > 0) {
        let chunkBytes = rawChunkQueueRef.current.shift()!;

        // Handle any unaligned odd byte left over from the previous chunk
        if (leftoverPcmByteRef.current !== null) {
          const stitched = new Uint8Array(chunkBytes.byteLength + 1);
          stitched[0] = leftoverPcmByteRef.current;
          stitched.set(chunkBytes, 1);
          leftoverPcmByteRef.current = null;
          chunkBytes = stitched;
        }

        // If chunk length is odd, hold trailing byte for next chunk to maintain 16-bit sample alignment
        if (chunkBytes.byteLength % 2 !== 0) {
          leftoverPcmByteRef.current = chunkBytes[chunkBytes.byteLength - 1];
          chunkBytes = chunkBytes.subarray(0, chunkBytes.byteLength - 1);
        }

        const sampleCount = chunkBytes.byteLength / 2;
        if (sampleCount <= 0) {
          continue;
        }

        // Convert raw 16-bit signed PCM (little-endian) to normalized Float32 samples [-1.0, 1.0]
        const float32 = new Float32Array(sampleCount);
        const dataView = new DataView(chunkBytes.buffer, chunkBytes.byteOffset, chunkBytes.byteLength);
        for (let i = 0; i < sampleCount; i++) {
          const int16 = dataView.getInt16(i * 2, true); // little-endian
          float32[i] = int16 / 32768.0;
        }

        // Directly construct AudioBuffer without calling decodeAudioData()
        const audioBuffer = ctx.createBuffer(1, sampleCount, 44100);
        audioBuffer.copyToChannel(float32, 0);

        console.log(
          `[LiveVoice] [PCM Direct AudioBuffer] Built AudioBuffer: ${sampleCount} samples (${chunkBytes.byteLength} B), duration: ${audioBuffer.duration.toFixed(4)}s at 44.1kHz. [CONFIRMED: NO decodeAudioData called]`
        );

        // Schedule gapless playback using existing nextPlayTimeRef logic
        await scheduleAudioBuffer(
          audioBuffer,
          `PCM chunk (${sampleCount} samples, ${chunkBytes.byteLength} B)`
        );
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

    // Build ElevenLabs WebSocket URL with output_format=pcm_44100
    const modelId = activeProvider.model || 'eleven_multilingual_v2';
    const outputFormat = 'pcm_44100';
    const wsUrl = buildElevenLabsWebSocketUrl(targetVoiceId, modelId, outputFormat);
    const connectStartTime = Date.now();
    console.log(
      `[LiveVoice] Connecting to ElevenLabs WebSocket with output_format=${outputFormat} (44.1 kHz Studio Master PCM):`,
      wsUrl
    );

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
              'ElevenLabs 20-Second Idle Timeout: The live connection was closed due to 20 seconds of stream inactivity. Click "Reconnect & Resume" to start a fresh stream.'
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
        setConnectionStatus('streaming');

        // Start stream duration counter
        streamStartTimeRef.current = Date.now();
        durationTimerRef.current = window.setInterval(() => {
          if (streamStartTimeRef.current) {
            const elapsed = (Date.now() - streamStartTimeRef.current) / 1000;
            streamDurationSecRef.current = elapsed;
            setStreamDurationSec(elapsed);
          }
        }, 100);

        // Step 1: Send Beginning-Of-Stream (BOS) configuration message with xi_api_key
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

        // Step 2: Stream text dialogue
        if (streamMode === 'instant') {
          // Instant full text streaming
          ws.send(JSON.stringify({ text: cleanText + ' ' }));
          // Send End-Of-Stream (EOS)
          ws.send(JSON.stringify({ text: '' }));
        } else {
          // LLM-style token / chunk streaming simulation (words streamed in intervals)
          const words = cleanText.split(' ');
          let wordIdx = 0;
          const chunkSize = 3; // send 3 words at a time

          simulationIntervalRef.current = window.setInterval(() => {
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
              if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
              return;
            }

            if (wordIdx < words.length) {
              const slice = words.slice(wordIdx, wordIdx + chunkSize).join(' ') + ' ';
              wordIdx += chunkSize;
              ws.send(JSON.stringify({ text: slice }));
              resetIdleTimer();
            } else {
              if (simulationIntervalRef.current) {
                clearInterval(simulationIntervalRef.current);
                simulationIntervalRef.current = null;
              }
              // Send End-Of-Stream (EOS) flush
              ws.send(JSON.stringify({ text: '' }));
            }
          }, 180);
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
          } catch (jsonErr) {
            console.error('[LiveVoice] WebSocket frame is not valid JSON! rawType:', rawType, 'snippet:', rawText.slice(0, 100), jsonErr);
            return;
          }

          const hasAudioField = typeof response.audio === 'string' && response.audio.trim().length > 0;
          const isFinal = Boolean(response.isFinal || response.is_final);

          console.log(
            `[LiveVoice] WS packet received: rawType=${rawType}, hasAudio=${hasAudioField}, isFinal=${isFinal}, keys=[${Object.keys(response).join(', ')}]`
          );

          // Check for API errors in payload
          if (response.error || response.code) {
            const errCode = response.code || 500;
            const errMsg = String(response.message || response.error || 'ElevenLabs streaming error');

            if (errCode === 402 || /paid_plan_required/i.test(errMsg) || /library/i.test(errMsg)) {
              setIsVoiceTierError(true);
              setErrorMessage(
                'ElevenLabs Free-Tier Restriction (402 paid_plan_required): Free accounts are restricted to official premade voices (Sarah, George, Brian, Alice). Community and library voices require a paid plan.'
              );
            } else {
              setErrorMessage(errMsg);
            }
            setConnectionStatus('error');
            cleanupLiveStream();
            return;
          }

          // Handle incoming base64 audio chunk ONLY when audio field is present and non-empty
          if (hasAudioField) {
            const base64Str = (response.audio as string).trim();
            try {
              // Decode base64 into raw 16-bit signed linear PCM bytes (little-endian, 44.1kHz mono)
              const binaryStr = window.atob(base64Str);
              const decodedByteLength = binaryStr.length;
              const bytes = new Uint8Array(decodedByteLength);
              for (let i = 0; i < decodedByteLength; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }

              if (timeToFirstChunkMs === null) {
                const latency = Date.now() - connectStartTime;
                setTimeToFirstChunkMs(latency);
              }

              const sampleCount = Math.floor(decodedByteLength / 2);
              setChunksCount((prev) => prev + 1);
              setTotalBytes((prev) => prev + decodedByteLength);

              console.log(
                `[LiveVoice] [PCM Chunk Received] rawType=${rawType}, hasAudio=true, base64Length=${base64Str.length}, rawPcmBytes=${decodedByteLength} B, pcmSamples=${sampleCount} samples, totalChunks=${allRecordedChunksRef.current.length + 1} (output_format: pcm_44100). [CONFIRMED: NO decodeAudioData called for live chunks]`
              );

              // Enqueue raw PCM bytes for direct Web Audio API buffer generation and playback
              appendChunkToBuffer(bytes);
            } catch (atobErr) {
              console.error(
                '[LiveVoice] Base64 decoding failed for audio packet:',
                atobErr,
                'base64 snippet:',
                base64Str.slice(0, 40)
              );
            }
          } else {
            console.log(
              `[LiveVoice] WS packet has NO AUDIO (audio field is ${response.audio === null ? 'null' : typeof response.audio}). Ignoring audio decode step.`
            );
          }

          // Handle incremental word/character alignment progress
          if (response.alignment || response.normalizedAlignment) {
            const alignment = (response.alignment || response.normalizedAlignment) as { chars?: unknown[] };
            if (alignment.chars && Array.isArray(alignment.chars)) {
              const totalChars = cleanText.length;
              const spokenChars = alignment.chars.length;
              const ratio = Math.min(1.0, spokenChars / Math.max(1, totalChars));
              setWordProgress({
                current: Math.round(wordsTotal * ratio),
                total: wordsTotal,
              });
            }
          }

          // Check if stream is final (support both isFinal and is_final)
          if (isFinal) {
            console.log(
              `[LiveVoice] WebSocket stream isFinal/is_final confirmed! Total PCM chunks captured: ${allRecordedChunksRef.current.length}`
            );
            isStreamFinalRef.current = true;
            if (idleTimeoutTimerRef.current) clearTimeout(idleTimeoutTimerRef.current);

            processPcmQueue();

            // Capture complete audio blob as standard WAV for replay & download
            if (allRecordedChunksRef.current.length > 0) {
              const wavBlob = pcmToWavBlob(allRecordedChunksRef.current, 44100, 1);
              const totalPcmBytes = allRecordedChunksRef.current.reduce((sum, c) => sum + c.byteLength, 0);
              const exactDuration = totalPcmBytes / (44100 * 2);

              console.log(
                `[LiveVoice] Assembled full stream WAV audio blob. Size: ${wavBlob.size} bytes, exact duration: ${exactDuration.toFixed(2)}s, SampleRate: 44100Hz`
              );
              const url = URL.createObjectURL(wavBlob);
              setRecordedAudioUrl(url);
              setRecordedDuration(exactDuration);
            }
          }
        } catch (parseErr) {
          console.error('[LiveVoice] Failed to parse WebSocket packet:', parseErr);
        }
      };

      ws.onerror = (evt) => {
        console.error('[LiveVoice] WebSocket connection error:', evt);
        if (connectionTimeoutTimerRef.current) {
          clearTimeout(connectionTimeoutTimerRef.current);
          connectionTimeoutTimerRef.current = null;
        }
        setConnectionStatus('error');
        setErrorMessage(
          'Connection failed: WebSocket connection error. Please verify network connectivity, CORS/firewall settings, and your ElevenLabs API key.'
        );
        cleanupLiveStream();
      };

      ws.onclose = (evt) => {
        if (connectionTimeoutTimerRef.current) {
          clearTimeout(connectionTimeoutTimerRef.current);
          connectionTimeoutTimerRef.current = null;
        }
        if (idleTimeoutTimerRef.current) clearTimeout(idleTimeoutTimerRef.current);

        // Policy violation or forbidden (often 402 or key issue)
        if (evt.code === 1008 || evt.code === 4001 || evt.reason?.includes('402')) {
          setIsVoiceTierError(true);
          setErrorMessage(
            'Connection failed (402): ElevenLabs Free-Tier Voice Policy Restriction. Community and library voices require a paid plan. Please switch to an official premade voice (Sarah, George, Brian, or Alice).'
          );
          setConnectionStatus('error');
          cleanupLiveStream();
        } else if (evt.code !== 1000) {
          // If closed prematurely during handshake / connection phase
          if (connectionStatus === 'connecting') {
            setConnectionStatus('error');
            const reasonDetail = evt.reason ? ` - ${evt.reason}` : '';
            setErrorMessage(
              `Connection failed: WebSocket closed prematurely during handshake (Code: ${evt.code}${reasonDetail}). Please verify your ElevenLabs API key status and permissions.`
            );
            cleanupLiveStream();
          } else if (connectionStatus === 'streaming') {
            // Abnormal close during streaming
            if (evt.reason?.toLowerCase().includes('timeout') || evt.code === 1006) {
              setConnectionStatus('timeout');
              setErrorMessage('ElevenLabs WebSocket closed (idle timeout or connection interrupted).');
            }
          }
        }
      };
    } catch (wsInitErr) {
      console.error('[LiveVoice] WebSocket initialization error:', wsInitErr);
      if (connectionTimeoutTimerRef.current) {
        clearTimeout(connectionTimeoutTimerRef.current);
        connectionTimeoutTimerRef.current = null;
      }
      setConnectionStatus('error');
      setErrorMessage(
        wsInitErr instanceof Error
          ? `Connection failed: ${wsInitErr.message}`
          : 'Connection failed: Failed to establish ElevenLabs WebSocket.'
      );
      cleanupLiveStream();
    }
  } catch (outerErr) {
    console.error('[LiveVoice] Unhandled exception in startLiveStreaming:', outerErr);
    if (connectionTimeoutTimerRef.current) {
      clearTimeout(connectionTimeoutTimerRef.current);
      connectionTimeoutTimerRef.current = null;
    }
    const msg = outerErr instanceof Error ? outerErr.message : String(outerErr);
    setErrorMessage(`Connection failed: Initialization exception: ${msg}`);
    setConnectionStatus('error');
    cleanupLiveStream();
  }
};

  // Switch voice and retry helper for 402 recovery
  const handleRecoverVoice = (safeVoiceId: string) => {
    playTapSound();
    onSelectVoice(safeVoiceId);
    storage.saveCloudVoice(safeVoiceId);
    setIsVoiceTierError(false);
    setErrorMessage(null);
    startLiveStreaming(safeVoiceId);
  };

  // Download recorded stream as lossless WAV
  const handleDownloadRecorded = () => {
    playTapSound();
    if (!recordedAudioUrl) return;
    const a = document.createElement('a');
    a.href = recordedAudioUrl;
    const cleanName = voiceName.replace(/\s+/g, '-').toLowerCase();
    a.download = `elevenlabs-live-${cleanName}-${Date.now()}.wav`;
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
        .then(() => {
          console.log(
            `[LiveVoice] Recorded audio replay started. CurrentTime: ${el.currentTime}s, Duration: ${el.duration}s`
          );
          setIsRecordedPlaying(true);
        })
        .catch((err) => {
          console.error('[LiveVoice] Recorded audio replay play() failed:', err);
          setIsRecordedPlaying(false);
        });
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Visual Live Waveform & Spectrum Header */}
      <LiveWaveformVisualizer
        analyserNode={analyserNodeRef.current}
        isPlaying={isPlaying}
        isStreaming={connectionStatus === 'streaming'}
        status={connectionStatus}
        chunksCount={chunksCount}
        totalBytes={totalBytes}
        timeToFirstChunkMs={timeToFirstChunkMs}
        streamDurationSec={streamDurationSec}
        wordProgress={wordProgress}
        volume={volume}
        isMuted={isMuted}
        onVolumeChange={setVolume}
        onToggleMute={() => {
          playTapSound();
          setIsMuted(!isMuted);
        }}
        onStop={handleStopStream}
      />

      {/* 20-Second Idle Timeout Warning Banner */}
      {connectionStatus === 'timeout' && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-4 flex items-start justify-between gap-4 text-amber-200 text-xs animate-fadeIn shadow-lg">
          <div className="flex items-start gap-3">
            <Clock size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-amber-300 text-sm">
                WebSocket Stream Paused (20s Idle Timeout)
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px] sm:text-xs">
                ElevenLabs automatically closes inactive streaming WebSocket channels after 20 seconds of silence to conserve API resources. You can resume at any time.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => startLiveStreaming()}
            className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition shadow shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw size={13} />
            Reconnect &amp; Resume
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
                Free-tier API accounts cannot stream community or library voices over WebSockets. Please switch to a verified free-tier premade voice (Sarah, George, Brian, Alice), or seamlessly switch to Microsoft Edge TTS.
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
              Switch to Sarah &amp; Stream
            </button>
            <button
              type="button"
              onClick={() => handleRecoverVoice('JBFqnCBsd6RMkjVDRZzb')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-500/40 font-semibold text-xs transition cursor-pointer"
            >
              Switch to George
            </button>
            <button
              type="button"
              onClick={() => handleRecoverVoice('nPczCjzI2devNBz1zQrb')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-500/40 font-semibold text-xs transition cursor-pointer"
            >
              Switch to Brian
            </button>
            <button
              type="button"
              onClick={() => handleRecoverVoice('Xb7hH8MSUJpSbSDYk0k2')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-500/40 font-semibold text-xs transition cursor-pointer"
            >
              Switch to Alice
            </button>
            <button
              type="button"
              onClick={onFallbackToEdge}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition shadow cursor-pointer flex items-center gap-1.5"
            >
              <Mic size={13} />
              Fall Back to Microsoft Edge TTS
            </button>
          </div>
        </div>
      )}

      {/* Prominent On-Screen Error Banner / Toast */}
      {errorMessage && !isVoiceTierError && (
        <div className="bg-rose-950/80 border-2 border-rose-500/80 rounded-2xl p-4 sm:p-5 text-rose-100 text-xs sm:text-sm space-y-3 animate-fadeIn shadow-2xl shadow-rose-950/60 backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle size={18} className="text-rose-400" />
              </div>
              <div className="space-y-1">
                <div className="font-bold text-sm sm:text-base text-rose-200 flex items-center gap-2">
                  <span>Stream Connection Failed</span>
                  <span className="px-2 py-0.5 text-[10px] font-mono uppercase rounded-full bg-rose-500/30 text-rose-300 border border-rose-500/40">
                    Live WebSocket
                  </span>
                </div>
                <p className="text-xs text-rose-300/90 font-medium">
                  The live streaming connection encountered an issue or timed out.
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

          {/* Plain Text Error Display */}
          <div className="bg-slate-950/80 border border-rose-500/30 rounded-xl p-3 font-mono text-xs text-rose-200 break-words leading-relaxed select-all">
            <div className="text-[10px] uppercase font-bold text-rose-400/80 mb-1 flex items-center gap-1.5">
              <Activity size={12} />
              Error Details (Plain Text)
            </div>
            {errorMessage}
          </div>

          {/* Quick Actions & Recovery */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => {
                playTapSound();
                startLiveStreaming();
              }}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-md shadow-rose-600/30 cursor-pointer flex items-center gap-1.5 active:scale-98"
            >
              <RefreshCw size={13} />
              <span>Retry Connection</span>
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
                  <span>Copy Error Text</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                playTapSound();
                onFallbackToEdge();
              }}
              className="px-3.5 py-2 rounded-xl bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-500/40 font-semibold text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <Mic size={13} />
              <span>Switch to Edge TTS</span>
            </button>
          </div>
        </div>
      )}

      {/* Voice Model Selector */}
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

      {/* Stream Script & Sample Presets */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="block text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider">
            Live Spoken Dialogue
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-500">
              {text.length} chars • {text.trim().split(/\s+/).filter(Boolean).length} words
            </span>
          </div>
        </div>

        {/* Quick Live Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400">Presets:</span>
          {LIVE_SAMPLE_PROMPTS.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                playTapSound();
                setText(sample.text);
                if (errorMessage) setErrorMessage(null);
              }}
              className="text-xs bg-slate-800/80 hover:bg-slate-700 text-purple-200 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-700/60 transition truncate max-w-[190px] cursor-pointer"
              title={sample.text}
            >
              {sample.title}
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (errorMessage) setErrorMessage(null);
          }}
          placeholder="Enter live text dialogue to stream across WebSocket..."
          rows={4}
          className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-4 text-slate-100 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition resize-y shadow-inner leading-relaxed font-normal"
        />
      </div>

      {/* Stream Transmission Mode & Tuning Rack */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stream Transmission Mode Card */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Zap size={13} className="text-purple-400" />
              Stream Transmission Mode
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                playTapSound();
                setStreamMode('instant');
              }}
              className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                streamMode === 'instant'
                  ? 'bg-purple-600/20 border-purple-500/50 text-purple-200'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-300'
              }`}
            >
              <div className="font-semibold text-xs flex items-center gap-1.5">
                <Radio size={12} className={streamMode === 'instant' ? 'text-purple-400' : ''} />
                Instant Flush
              </div>
              <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                Lowest latency (~250ms TTFB). Sends script immediately.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                playTapSound();
                setStreamMode('llm_simulation');
              }}
              className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                streamMode === 'llm_simulation'
                  ? 'bg-cyan-600/20 border-cyan-500/50 text-cyan-200'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-300'
              }`}
            >
              <div className="font-semibold text-xs flex items-center gap-1.5">
                <Mic size={12} className={streamMode === 'llm_simulation' ? 'text-cyan-400' : ''} />
                LLM Simulation
              </div>
              <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                Streams word tokens progressively as an AI agent speaks.
              </p>
            </button>
          </div>
        </div>

        {/* Studio Audio Tuning Rack */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
          <StudioAudioControls settings={settings} onChangeSettings={setSettings} />
        </div>
      </div>

      {/* Main Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div className="flex flex-wrap items-center gap-3">
          {connectionStatus === 'connecting' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled
                className="px-6 py-3.5 rounded-xl bg-amber-600/80 text-white font-semibold text-sm shadow-xl shadow-amber-600/20 transition flex items-center gap-2.5 cursor-wait"
              >
                <RefreshCw size={16} className="animate-spin" />
                <span>Connecting (up to 15s)...</span>
              </button>
              <button
                type="button"
                onClick={handleStopStream}
                className="px-4 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 font-semibold text-sm transition cursor-pointer"
                title="Cancel connection attempt"
              >
                Cancel
              </button>
            </div>
          ) : connectionStatus === 'streaming' ? (
            <button
              type="button"
              onClick={handleStopStream}
              className="px-6 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm shadow-xl shadow-rose-600/30 transition flex items-center gap-2.5 cursor-pointer transform active:scale-98 animate-pulse"
            >
              <Square size={16} className="fill-current" />
              <span>Stop Streaming</span>
            </button>
          ) : connectionStatus === 'error' ? (
            <button
              type="button"
              onClick={() => startLiveStreaming()}
              disabled={!text.trim()}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-rose-600 via-purple-600 to-indigo-600 text-white font-semibold text-sm shadow-xl shadow-rose-500/20 hover:from-rose-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2.5 cursor-pointer transform active:scale-98"
            >
              <RefreshCw size={16} />
              <span>Retry Live Stream</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => startLiveStreaming()}
              disabled={!text.trim()}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-rose-600 via-purple-600 to-indigo-600 text-white font-semibold text-sm shadow-xl shadow-rose-500/20 hover:from-rose-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2.5 cursor-pointer transform active:scale-98"
            >
              <Radio size={18} className="animate-pulse" />
              <span>Start Live Stream</span>
            </button>
          )}

          {recordedAudioUrl && (
            <button
              type="button"
              onClick={handleDownloadRecorded}
              className="px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-purple-300 hover:text-white font-semibold text-sm transition flex items-center gap-2 cursor-pointer shadow-md"
              title="Download full streamed recording as lossless WAV"
            >
              <Download size={16} />
              <span>Download Stream (WAV)</span>
            </button>
          )}
        </div>

        {/* Clear dialogue action */}
        {text && (
          <button
            type="button"
            onClick={() => {
              playTapSound();
              setText('');
              setErrorMessage(null);
            }}
            className="text-xs text-slate-400 hover:text-slate-200 transition px-2 py-1 rounded hover:bg-slate-800 cursor-pointer"
          >
            Clear dialogue
          </button>
        )}
      </div>

      {/* Stream Post-Generation Playback Bar (When recording exists) */}
      {recordedAudioUrl && (
        <div className="bg-slate-950/90 border border-purple-500/30 rounded-xl p-4 flex items-center justify-between flex-wrap gap-4 shadow-lg animate-fadeIn">
          <audio
            ref={recordedAudioRef}
            src={recordedAudioUrl}
            preload="auto"
            onLoadedMetadata={(e) => {
              const dur = e.currentTarget.duration;
              console.log('[LiveVoice] Recorded audio loadedmetadata event. Duration:', dur);
              if (!isNaN(dur) && isFinite(dur) && dur > 0) {
                setRecordedDuration(dur);
              }
            }}
            onPlay={() => setIsRecordedPlaying(true)}
            onPause={() => setIsRecordedPlaying(false)}
            onEnded={() => setIsRecordedPlaying(false)}
            onError={(e) => {
              console.error('[LiveVoice] Recorded audio element error:', e.currentTarget.error);
            }}
            className="hidden"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleToggleRecordedPlayback}
              className="w-10 h-10 rounded-xl bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center transition shadow cursor-pointer"
              title={isRecordedPlaying ? 'Pause Replay' : 'Play Recorded Audio'}
            >
              {isRecordedPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
            </button>
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <span>Recorded Stream Playback</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  {voiceName}
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400">
                {chunksCount} audio chunks captured • Duration: ~{recordedDuration.toFixed(1)}s
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadRecorded}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
            >
              <Download size={13} />
              <span>Save MP3</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
