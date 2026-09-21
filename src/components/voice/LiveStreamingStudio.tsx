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
} from 'lucide-react';
import { VoiceProviderConfig, StudioVoiceSettings } from '@/types';
import { playTapSound } from '@/lib/audio';
import { storage } from '@/lib/storage';
import {
  buildElevenLabsWebSocketUrl,
  isVoiceTierRestricted,
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

  // Refs for audio pipeline and WebSocket
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const mediaUrlRef = useRef<string | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const liveAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const chunkQueueRef = useRef<Uint8Array[]>([]);
  const isStreamFinalRef = useRef(false);
  const allRecordedChunksRef = useRef<Uint8Array[]>([]);

  // Timers and duration tracking
  const streamStartTimeRef = useRef<number | null>(null);
  const streamDurationSecRef = useRef<number>(0);
  const durationTimerRef = useRef<number | null>(null);
  const idleTimeoutTimerRef = useRef<number | null>(null);
  const simulationIntervalRef = useRef<number | null>(null);

  // Clean up all resources
  const cleanupLiveStream = useCallback(() => {
    console.log('[LiveVoice] cleanupLiveStream invoked');
    // Clear timers
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

    // Stop live audio
    if (liveAudioElementRef.current) {
      try {
        liveAudioElementRef.current.pause();
        liveAudioElementRef.current.src = '';
      } catch {
        // ignore
      }
      liveAudioElementRef.current = null;
    }

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      sourceNodeRef.current = null;
    }

    if (sourceBufferRef.current) {
      try {
        if (sourceBufferRef.current.updating) {
          sourceBufferRef.current.abort();
        }
      } catch {
        // ignore
      }
      sourceBufferRef.current = null;
    }

    if (mediaUrlRef.current) {
      URL.revokeObjectURL(mediaUrlRef.current);
      mediaUrlRef.current = null;
    }

    mediaSourceRef.current = null;
    chunkQueueRef.current = [];
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
      gainNodeRef.current.gain.value = isMuted ? 0 : volume;
      console.log('[LiveVoice] Synchronized gainNode volume:', gainNodeRef.current.gain.value);
    }
    if (liveAudioElementRef.current) {
      liveAudioElementRef.current.volume = isMuted ? 0 : volume;
      liveAudioElementRef.current.muted = isMuted;
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
      const blob = new Blob(allRecordedChunksRef.current, { type: 'audio/mpeg' });
      console.log(`[LiveVoice] Interrupted stream captured ${allRecordedChunksRef.current.length} chunks, blob size: ${blob.size} bytes`);
      const url = URL.createObjectURL(blob);
      setRecordedAudioUrl(url);

      if (elapsed > 0) {
        setRecordedDuration(elapsed);
      }

      // Decode audio in Web Audio API to get exact duration and verify audio data integrity
      if (audioContextRef.current) {
        blob.arrayBuffer().then((buf) => {
          audioContextRef.current?.decodeAudioData(
            buf.slice(0),
            (decoded) => {
              console.log(`[LiveVoice] Stopped stream decoded successfully! Duration: ${decoded.duration.toFixed(2)}s, SampleRate: ${decoded.sampleRate}Hz`);
              if (decoded.duration > 0) {
                setRecordedDuration(decoded.duration);
              }
            },
            (decErr) => {
              console.warn('[LiveVoice] decodeAudioData warning on stopped stream blob:', decErr);
            }
          );
        }).catch((err) => {
          console.warn('[LiveVoice] ArrayBuffer conversion error:', err);
        });
      }
    }
  }, [cleanupLiveStream]);

  // Main Streaming Execution Engine
  const startLiveStreaming = async (customVoiceId?: string) => {
    playTapSound();
    cleanupLiveStream();

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
    chunkQueueRef.current = [];
    isStreamFinalRef.current = false;
    setRecordedAudioUrl(null);
    setRecordedDuration(0);

    const wordsTotal = cleanText.split(/\s+/).filter(Boolean).length;
    setWordProgress({ current: 0, total: wordsTotal });

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
        console.log('[LiveVoice] AudioContext is suspended, calling .resume() immediately...');
        await audioContextRef.current.resume();
        console.log('[LiveVoice] AudioContext .resume() resolved. State:', audioContextRef.current.state);
      } else {
        console.log('[LiveVoice] AudioContext state:', audioContextRef.current.state);
      }

      if (!analyserNodeRef.current && audioContextRef.current) {
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.8;
        analyserNodeRef.current = analyser;
      }

      if (!gainNodeRef.current && audioContextRef.current) {
        const gainNode = audioContextRef.current.createGain();
        gainNode.gain.value = isMuted ? 0 : volume;
        gainNodeRef.current = gainNode;
      }
    } catch (e) {
      console.warn('[LiveVoice] Web Audio API init warning:', e);
    }

    // Setup MediaSource and Audio Element for low-latency streaming
    if (mediaUrlRef.current) {
      URL.revokeObjectURL(mediaUrlRef.current);
      mediaUrlRef.current = null;
    }

    const mediaSource = new MediaSource();
    mediaSourceRef.current = mediaSource;
    const mediaUrl = URL.createObjectURL(mediaSource);
    mediaUrlRef.current = mediaUrl;

    const audio = new Audio();
    audio.src = mediaUrl;
    audio.autoplay = true;
    audio.volume = isMuted ? 0 : volume;
    audio.muted = false;
    liveAudioElementRef.current = audio;

    // Connect Audio element to Web Audio graph (Source -> Analyser -> Gain -> Destination)
    try {
      if (audioContextRef.current && analyserNodeRef.current && gainNodeRef.current) {
        if (sourceNodeRef.current) {
          try {
            sourceNodeRef.current.disconnect();
          } catch {
            // ignore
          }
        }
        const sourceNode = audioContextRef.current.createMediaElementSource(audio);
        // CRITICAL: Retain in sourceNodeRef to prevent JavaScript Garbage Collector from disconnecting audio
        sourceNodeRef.current = sourceNode;
        sourceNode.connect(analyserNodeRef.current);
        analyserNodeRef.current.connect(gainNodeRef.current);
        gainNodeRef.current.connect(audioContextRef.current.destination);
        console.log('[LiveVoice] Web Audio graph successfully connected to audioContext.destination');
      }
    } catch (routeErr) {
      console.warn(
        '[LiveVoice] createMediaElementSource connection notice (will fallback to direct speaker output):',
        routeErr
      );
    }

    audio.onplay = () => {
      console.log(`[LiveVoice] audio onplay event fired. currentTime=${audio.currentTime.toFixed(2)}s`);
      setIsPlaying(true);
    };
    audio.onplaying = () => {
      console.log(
        `[LiveVoice] audio onplaying event fired (sound is actively playing). currentTime=${audio.currentTime.toFixed(2)}s`
      );
      setIsPlaying(true);
    };
    audio.onwaiting = () => {
      console.log(
        `[LiveVoice] audio onwaiting event fired (buffering chunks). currentTime=${audio.currentTime.toFixed(2)}s, readyState=${audio.readyState}`
      );
    };
    audio.onstalled = () => {
      console.warn(
        `[LiveVoice] audio onstalled event fired. currentTime=${audio.currentTime.toFixed(2)}s, readyState=${audio.readyState}, networkState=${audio.networkState}`
      );
      const sb = sourceBufferRef.current;
      if (sb && sb.buffered.length > 0) {
        for (let i = 0; i < sb.buffered.length; i++) {
          if (audio.currentTime < sb.buffered.start(i)) {
            console.log(`[LiveVoice] onstalled: jumping gap to ${sb.buffered.start(i)}s`);
            audio.currentTime = sb.buffered.start(i) + 0.005;
            break;
          }
        }
        audio.play().catch(() => {});
      }
    };
    audio.onpause = () => {
      console.log(
        `[LiveVoice] audio onpause event fired. currentTime=${audio.currentTime.toFixed(2)}s, paused=${audio.paused}`
      );
      if (connectionStatus !== 'streaming' && chunkQueueRef.current.length === 0) {
        setIsPlaying(false);
      }
    };
    audio.onended = () => {
      console.log(`[LiveVoice] audio onended event fired. currentTime=${audio.currentTime.toFixed(2)}s`);
      setIsPlaying(false);
      setConnectionStatus('completed');
    };
    audio.onerror = (e) => {
      console.error('[LiveVoice] audio element error:', audio.error, e);
    };

    // Prime audio during user gesture to grant autoplay permission
    audio.play().catch(() => {
      // Expected to wait until initial buffer is appended
    });

    // Queue drainer for SourceBuffer
    const drainQueue = () => {
      const sb = sourceBufferRef.current;
      const ms = mediaSourceRef.current;
      if (!sb || !ms) {
        return;
      }
      if (ms.readyState !== 'open') {
        console.warn(`[LiveVoice] drainQueue: MediaSource is not open (readyState="${ms.readyState}")`);
        return;
      }
      if (sb.updating) {
        // SourceBuffer is busy appending; updateend will continue draining
        return;
      }
      if (chunkQueueRef.current.length > 0) {
        const nextChunk = chunkQueueRef.current.shift();
        if (nextChunk) {
          try {
            sb.appendBuffer(nextChunk);
            console.log(
              `[LiveVoice] SourceBuffer appended chunk (${nextChunk.byteLength} B). Remaining in queue: ${chunkQueueRef.current.length}`
            );
          } catch (appendErr) {
            console.error('[LiveVoice] SourceBuffer appendBuffer error:', appendErr);
            // If appendBuffer throws synchronously, updateend will NOT fire.
            // Schedule drainQueue after 50ms so subsequent chunks are not stuck in queue.
            setTimeout(() => {
              drainQueue();
            }, 50);
          }
        }
      } else if (isStreamFinalRef.current) {
        if (ms.readyState === 'open' && !sb.updating) {
          try {
            console.log('[LiveVoice] All stream chunks appended and queue empty, calling mediaSource.endOfStream()');
            ms.endOfStream();
          } catch (eosErr) {
            console.warn('[LiveVoice] mediaSource.endOfStream error:', eosErr);
          }
        }
      }
    };

    // Prepare SourceBuffer
    mediaSource.addEventListener('sourceopen', () => {
      console.log('[LiveVoice] MediaSource sourceopen event fired. readyState:', mediaSource.readyState);
      try {
        const mimeType = 'audio/mpeg';
        const isSupported = MediaSource.isTypeSupported(mimeType);
        console.log(`[LiveVoice] MediaSource.isTypeSupported("${mimeType}"):`, isSupported);

        const sb = mediaSource.addSourceBuffer(mimeType);
        sourceBufferRef.current = sb;
        console.log('[LiveVoice] SourceBuffer created successfully with audio/mpeg');

        try {
          sb.mode = 'sequence';
          console.log('[LiveVoice] SourceBuffer mode set to "sequence" (seamless sequential timeline)');
        } catch (modeErr) {
          console.warn('[LiveVoice] Could not set SourceBuffer mode to sequence:', modeErr);
        }

        sb.addEventListener('updateend', () => {
          // 1. Drain pending chunks from queue
          drainQueue();

          // 2. Monitor and recover audio element playback
          const currentAudio = liveAudioElementRef.current;
          if (currentAudio) {
            let rangesStr = '';
            for (let i = 0; i < sb.buffered.length; i++) {
              rangesStr += `[${sb.buffered.start(i).toFixed(2)}s - ${sb.buffered.end(i).toFixed(2)}s] `;
            }
            console.log(
              `[LiveVoice] SourceBuffer updateend: currentTime=${currentAudio.currentTime.toFixed(2)}s, paused=${currentAudio.paused}, readyState=${currentAudio.readyState}, ranges=${rangesStr}`
            );

            // If audio is paused and we have buffered data ahead, resume playback immediately
            if (currentAudio.paused && (sb.buffered.length > 0 || chunkQueueRef.current.length > 0)) {
              console.log('[LiveVoice] Audio is paused with buffer available, calling audio.play()...');
              currentAudio.play().catch((playErr) => {
                console.warn('[LiveVoice] audio.play() recovery in updateend notice:', playErr);
              });
            } else if (!currentAudio.paused && sb.buffered.length > 0) {
              // If currentTime is stuck before the buffered start (gap):
              for (let i = 0; i < sb.buffered.length; i++) {
                if (currentAudio.currentTime < sb.buffered.start(i) && sb.buffered.end(i) > currentAudio.currentTime) {
                  console.log(
                    `[LiveVoice] Nudging currentTime over gap from ${currentAudio.currentTime.toFixed(3)}s to ${sb.buffered.start(i).toFixed(3)}s`
                  );
                  currentAudio.currentTime = sb.buffered.start(i) + 0.005;
                  break;
                }
              }
            }
          }

          // Ensure Web Audio context is not suspended
          if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume().catch(() => {});
          }
        });

        sb.addEventListener('error', (errEvt) => {
          console.error('[LiveVoice] SourceBuffer error event:', errEvt);
        });

        // Drain any chunks that arrived before sourceopen fired
        drainQueue();
      } catch (sbErr) {
        console.error('[LiveVoice] Failed to create audio/mpeg SourceBuffer:', sbErr);
      }
    });

    mediaSource.addEventListener('sourceended', () => {
      console.log('[LiveVoice] MediaSource sourceended event fired. readyState:', mediaSource.readyState);
    });

    mediaSource.addEventListener('sourceclose', () => {
      console.log('[LiveVoice] MediaSource sourceclose event fired. readyState:', mediaSource.readyState);
    });

    const appendChunkToBuffer = (chunk: Uint8Array) => {
      allRecordedChunksRef.current.push(chunk);
      chunkQueueRef.current.push(chunk);
      drainQueue();

      // Ensure AudioContext is active
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch((resErr) => {
          console.warn('[LiveVoice] AudioContext resume inside appendChunk warning:', resErr);
        });
      }

      // Trigger audio playback if paused
      if (audio.paused) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('[LiveVoice] audio.play() started successfully. CurrentTime:', audio.currentTime);
              setIsPlaying(true);
            })
            .catch((playErr) => {
              console.warn('[LiveVoice] audio.play() returned catch (buffering or waiting):', playErr);
            });
        }
      }
    };

    // Build ElevenLabs WebSocket URL
    const modelId = activeProvider.model || 'eleven_multilingual_v2';
    const wsUrl = buildElevenLabsWebSocketUrl(targetVoiceId, modelId);
    const connectStartTime = Date.now();

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

      ws.onmessage = (event) => {
        resetIdleTimer();
        try {
          const response = JSON.parse(event.data);
          const hasAudio = Boolean(response.audio);
          const isFinal = Boolean(response.isFinal || response.is_final);
          console.log(
            `[LiveVoice] WS message received: hasAudio=${hasAudio}, isFinal=${isFinal}, keys=${Object.keys(response).join(',')}`
          );

          // Check for API errors in payload
          if (response.error || response.code) {
            const errCode = response.code || 500;
            const errMsg = response.message || response.error || 'ElevenLabs streaming error';

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

          // Handle incoming base64 audio chunk
          if (response.audio) {
            if (timeToFirstChunkMs === null) {
              const latency = Date.now() - connectStartTime;
              setTimeToFirstChunkMs(latency);
            }

            const binaryStr = window.atob(response.audio);
            const len = binaryStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }

            setChunksCount((prev) => prev + 1);
            setTotalBytes((prev) => prev + bytes.byteLength);
            console.log(
              `[LiveVoice] Enqueuing chunk #${allRecordedChunksRef.current.length + 1} (${bytes.byteLength} B)`
            );
            appendChunkToBuffer(bytes);
          }

          // Handle incremental word/character alignment progress
          if (response.alignment || response.normalizedAlignment) {
            const alignment = response.alignment || response.normalizedAlignment;
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
              `[LiveVoice] WebSocket stream isFinal/is_final confirmed! Total chunks captured: ${allRecordedChunksRef.current.length}`
            );
            isStreamFinalRef.current = true;
            if (idleTimeoutTimerRef.current) clearTimeout(idleTimeoutTimerRef.current);

            drainQueue();

            // Capture complete audio blob for replay & download
            if (allRecordedChunksRef.current.length > 0) {
              const fullBlob = new Blob(allRecordedChunksRef.current, { type: 'audio/mpeg' });
              console.log(`[LiveVoice] Assembled full stream audio blob. Size: ${fullBlob.size} bytes`);
              const url = URL.createObjectURL(fullBlob);
              setRecordedAudioUrl(url);

              const elapsed = streamStartTimeRef.current
                ? (Date.now() - streamStartTimeRef.current) / 1000
                : streamDurationSecRef.current;
              if (elapsed > 0) {
                setRecordedDuration(elapsed);
              }

              // Accurately decode with AudioContext to determine exact duration and verify MP3 integrity
              if (audioContextRef.current) {
                fullBlob
                  .arrayBuffer()
                  .then((buf) => {
                    audioContextRef.current?.decodeAudioData(
                      buf.slice(0),
                      (decoded) => {
                        console.log(
                          `[LiveVoice] Full stream decoded successfully! Duration: ${decoded.duration.toFixed(
                            2
                          )}s, SampleRate: ${decoded.sampleRate}Hz, Channels: ${decoded.numberOfChannels}`
                        );
                        if (decoded.duration > 0) {
                          setRecordedDuration(decoded.duration);
                        }
                      },
                      (decodeErr) => {
                        console.error('[LiveVoice] decodeAudioData error on assembled stream blob:', decodeErr);
                      }
                    );
                  })
                  .catch((arrErr) => {
                    console.warn('[LiveVoice] ArrayBuffer extraction error:', arrErr);
                  });
              }
            }
          }
        } catch (parseErr) {
          console.error('[LiveVoice] Failed to parse WebSocket packet:', parseErr);
        }
      };

      ws.onerror = (evt) => {
        console.error('[LiveVoice] WebSocket connection error:', evt);
        setConnectionStatus('error');
        setErrorMessage('WebSocket connection error. Please verify network connectivity and your ElevenLabs API key.');
        cleanupLiveStream();
      };

      ws.onclose = (evt) => {
        if (idleTimeoutTimerRef.current) clearTimeout(idleTimeoutTimerRef.current);

        // Policy violation or forbidden (often 402 or key issue)
        if (evt.code === 1008 || evt.code === 4001 || evt.reason?.includes('402')) {
          setIsVoiceTierError(true);
          setErrorMessage(
            'ElevenLabs Free-Tier Voice Policy Restriction: Community/library voices require a paid plan. Please switch to an official premade voice (Sarah, George, Brian, or Alice).'
          );
          setConnectionStatus('error');
        } else if (evt.code !== 1000 && connectionStatus === 'streaming') {
          // Abnormal close
          if (evt.reason?.toLowerCase().includes('timeout') || evt.code === 1006) {
            setConnectionStatus('timeout');
            setErrorMessage('ElevenLabs WebSocket closed (idle timeout or connection interrupted).');
          }
        }
      };
    } catch (wsInitErr) {
      console.error('[LiveVoice] WebSocket initialization error:', wsInitErr);
      setConnectionStatus('error');
      setErrorMessage(
        wsInitErr instanceof Error ? wsInitErr.message : 'Failed to establish ElevenLabs WebSocket.'
      );
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

  // Download recorded stream as MP3
  const handleDownloadRecorded = () => {
    playTapSound();
    if (!recordedAudioUrl) return;
    const a = document.createElement('a');
    a.href = recordedAudioUrl;
    const cleanName = voiceName.replace(/\s+/g, '-').toLowerCase();
    a.download = `elevenlabs-live-${cleanName}-${Date.now()}.mp3`;
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

      {/* General Error Banner */}
      {errorMessage && !isVoiceTierError && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-rose-300 text-xs flex items-start gap-3 animate-fadeIn">
          <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-sm">Streaming Stream Error</div>
            <p className="leading-relaxed">{errorMessage}</p>
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
          {connectionStatus !== 'streaming' && connectionStatus !== 'connecting' ? (
            <button
              type="button"
              onClick={() => startLiveStreaming()}
              disabled={!text.trim()}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-rose-600 via-purple-600 to-indigo-600 text-white font-semibold text-sm shadow-xl shadow-rose-500/20 hover:from-rose-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2.5 cursor-pointer transform active:scale-98"
            >
              <Radio size={18} className="animate-pulse" />
              <span>Start Live Stream</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStopStream}
              className="px-6 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm shadow-xl shadow-rose-600/30 transition flex items-center gap-2.5 cursor-pointer transform active:scale-98 animate-pulse"
            >
              <Square size={16} className="fill-current" />
              <span>Stop Streaming</span>
            </button>
          )}

          {recordedAudioUrl && (
            <button
              type="button"
              onClick={handleDownloadRecorded}
              className="px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-purple-300 hover:text-white font-semibold text-sm transition flex items-center gap-2 cursor-pointer shadow-md"
              title="Download full streamed recording as MP3"
            >
              <Download size={16} />
              <span>Download Stream (MP3)</span>
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
