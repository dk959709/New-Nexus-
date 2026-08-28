import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  VolumeX,
  AlertCircle,
  Settings,
  RefreshCw,
  AudioWaveform,
} from 'lucide-react';
import { api } from '@/services/api';
import { vox } from '@/services/vox';
import { playTapSound } from '@/lib/audio';

interface VoiceCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

type CallStatus = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

interface TurnMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

// Browser SpeechRecognition interface stub
interface IWindowSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
}

export function VoiceCallModal({
  isOpen,
  onClose,
  onOpenSettings,
}: VoiceCallModalProps) {
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [turns, setTurns] = useState<TurnMessage[]>([]);
  const [activeVoiceText, setActiveVoiceText] = useState<string>('');
  const [callDuration, setCallDuration] = useState(0);

  const recognitionRef = useRef<IWindowSpeechRecognition | null>(null);
  const isCallActiveRef = useRef(false);
  const startListeningRef = useRef<(() => void) | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentAudioStopperRef = useRef<(() => void) | null>(null);
  const chatHistoryRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  // Format call duration (MM:SS)
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // User input handler: fast AI response then Vox TTS playback
  const handleUserSpoken = useCallback(async (userText: string) => {
    if (!userText.trim() || !isCallActiveRef.current) return;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const userTurn: TurnMessage = {
      id: `turn-u-${Date.now()}`,
      role: 'user',
      text: userText,
      timestamp: timeStr,
    };

    setTurns((prev) => [...prev, userTurn]);
    setCallStatus('thinking');
    setTranscript('');
    setInterimTranscript('');

    try {
      // Rapid conversational response from fast model
      const aiResponse = await api.aiChat(
        `[VOICE CALL MODE] Please give a concise, natural, spoken response (1 to 3 short sentences, no bullet points, no markdown symbols or asterisks, plain conversational speech): ${userText}`,
        chatHistoryRef.current.slice(-4),
        { model: 'gemini-2.5-flash', tone: 'concise' },
      );

      if (!isCallActiveRef.current) return;

      const replyText =
        aiResponse?.reply?.trim() ||
        "I'm online and hearing you clearly. How can I assist you further?";

      const cleanSpoken = replyText
        .replace(/[*#`_~>[\]()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const assistantTurn: TurnMessage = {
        id: `turn-a-${Date.now()}`,
        role: 'assistant',
        text: cleanSpoken,
        timestamp: `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}:${pad(new Date().getSeconds())}`,
      };

      setTurns((prev) => [...prev, assistantTurn]);
      chatHistoryRef.current = [
        ...chatHistoryRef.current.slice(-4),
        { role: 'user', content: userText },
        { role: 'assistant', content: cleanSpoken },
      ];

      setActiveVoiceText(cleanSpoken);
      setCallStatus('speaking');

      if (!vox.isConfigured()) {
        setErrorMessage(
          'Add a Hugging Face API key in Settings > AI Providers to enable Vox voice responses.',
        );
        setTimeout(() => {
          if (isCallActiveRef.current) {
            setCallStatus('listening');
            startListeningRef.current?.();
          }
        }, 3000);
        return;
      }

      try {
        const speechInstance = await vox.speak(cleanSpoken, {
          onEnd: () => {
            if (isCallActiveRef.current) {
              setActiveVoiceText('');
              setCallStatus('listening');
              startListeningRef.current?.();
            }
          },
          onError: (ttsErr) => {
            console.error('Vox TTS playback failed during voice call:', ttsErr);
            setErrorMessage(
              `Vox TTS Error: ${ttsErr.message || 'Speech generation failed'}. Check Settings > AI Providers.`,
            );
            setTimeout(() => {
              if (isCallActiveRef.current) {
                setCallStatus('listening');
                startListeningRef.current?.();
              }
            }, 2500);
          },
        });

        currentAudioStopperRef.current = speechInstance.stop;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Vox TTS synthesis failed';
        setErrorMessage(`Vox Error: ${msg}. Add a valid Hugging Face key in Settings.`);
        setTimeout(() => {
          if (isCallActiveRef.current) {
            setCallStatus('listening');
            startListeningRef.current?.();
          }
        }, 2500);
      }
    } catch (err: unknown) {
      console.error('Voice call AI error:', err);
      const msg = err instanceof Error ? err.message : 'AI Assistant failed to respond.';
      setErrorMessage(msg);
      setTimeout(() => {
        if (isCallActiveRef.current) {
          setCallStatus('listening');
          startListeningRef.current?.();
        }
      }, 2000);
    }
  }, []);

  // Internal listener helper
  const startListeningInternal = useCallback(() => {
    if (!isCallActiveRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage(
        'Web Speech API is not supported in this browser. Please use Google Chrome, Edge, or Safari for voice recognition.',
      );
      setCallStatus('error');
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      const recognition: IWindowSpeechRecognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        if (isCallActiveRef.current) {
          setCallStatus('listening');
          setErrorMessage(null);
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        setInterimTranscript(interim);
        if (final.trim()) {
          setTranscript(final.trim());
          setInterimTranscript('');
          handleUserSpoken(final.trim());
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        if (event?.error === 'no-speech') {
          if (isCallActiveRef.current) {
            setTimeout(() => {
              if (isCallActiveRef.current) startListeningInternal();
            }, 300);
          }
          return;
        }

        if (event?.error === 'not-allowed') {
          setErrorMessage(
            'Microphone access denied. Please enable microphone permissions in your browser to use Voice Call.',
          );
          setCallStatus('error');
          return;
        }

        if (isCallActiveRef.current) {
          setTimeout(() => {
            if (isCallActiveRef.current) startListeningInternal();
          }, 500);
        }
      };

      recognition.onend = () => {
        if (isCallActiveRef.current) {
          setTimeout(() => {
            if (isCallActiveRef.current) {
              startListeningInternal();
            }
          }, 300);
        }
      };

      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
    }
  }, [handleUserSpoken]);

  useEffect(() => {
    startListeningRef.current = startListeningInternal;
  }, [startListeningInternal]);

  // Start Call
  const handleStartCall = useCallback(() => {
    playTapSound();
    isCallActiveRef.current = true;
    setCallStatus('listening');
    setErrorMessage(null);
    setTranscript('');
    setInterimTranscript('');
    setCallDuration(0);

    durationTimerRef.current = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);

    startListeningInternal();
  }, [startListeningInternal]);

  // End Call
  const handleEndCall = useCallback(() => {
    playTapSound();
    isCallActiveRef.current = false;
    setCallStatus('idle');

    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    if (currentAudioStopperRef.current) {
      currentAudioStopperRef.current();
      currentAudioStopperRef.current = null;
    }

    vox.stop();
  }, []);

  const handleModalClose = () => {
    handleEndCall();
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      handleStartCall();
    } else {
      handleEndCall();
    }

    return () => {
      handleEndCall();
    };
  }, [isOpen, handleStartCall, handleEndCall]);

  if (!isOpen) return null;

  const isConfigured = vox.isConfigured();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleModalClose();
      }}
    >
      <div
        className="relative w-full max-w-xl rounded-3xl border border-cyan-500/30 overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_40px_rgba(97,215,201,0.15)] flex flex-col max-h-[90vh]"
        style={{
          background: 'linear-gradient(160deg, #05131e 0%, #081a29 50%, #030a10 100%)',
        }}
      >
        {/* Glow Header */}
        <div className="relative px-6 py-4 border-b border-cyan-500/20 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <AudioWaveform size={22} className="animate-pulse" />
              {callStatus !== 'idle' && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white tracking-wide text-base">JARVIS VOICE CALL</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  VOX LIVE
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono flex items-center gap-2">
                <span>Hands-free duplex dialogue</span>
                <span>•</span>
                <span className="text-cyan-400">{formatDuration(callDuration)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  handleModalClose();
                  onOpenSettings();
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors cursor-pointer"
                title="Open Settings"
              >
                <Settings size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Missing API Key Warning Inline */}
        {!isConfigured && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
            <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-300">Hugging Face API Key Needed</p>
              <p className="text-[11px] text-amber-200/80 mt-0.5">
                Spoken responses require a Hugging Face API key. Add your key in{' '}
                <button
                  type="button"
                  onClick={() => {
                    handleModalClose();
                    onOpenSettings?.();
                  }}
                  className="text-cyan-300 underline font-mono hover:text-cyan-200 cursor-pointer"
                >
                  Settings &gt; AI Providers
                </button>{' '}
                to enable full neural voice synthesis.
              </p>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="mx-6 mt-3 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-300">
            <AlertCircle size={15} className="text-rose-400 shrink-0" />
            <span className="flex-1 font-mono text-[11px]">{errorMessage}</span>
          </div>
        )}

        {/* Central Visualizer & State Display */}
        <div className="p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
          {/* Pulsing Visualizer Rings */}
          <div className="relative my-4 flex items-center justify-center">
            <div
              className={`w-32 h-32 rounded-full border-2 transition-all duration-700 flex items-center justify-center ${
                callStatus === 'listening'
                  ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_40px_rgba(34,211,238,0.3)] scale-105'
                  : callStatus === 'speaking'
                  ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_50px_rgba(16,185,129,0.4)] scale-110'
                  : callStatus === 'thinking'
                  ? 'border-indigo-400 bg-indigo-500/10 shadow-[0_0_30px_rgba(99,102,241,0.3)] animate-pulse'
                  : 'border-slate-700 bg-slate-900/60'
              }`}
            >
              {callStatus === 'listening' ? (
                <div className="relative flex items-center justify-center">
                  <Mic size={42} className="text-cyan-300 animate-bounce" />
                  <div className="absolute inset-0 rounded-full border-2 border-cyan-400/40 animate-ping" />
                </div>
              ) : callStatus === 'speaking' ? (
                <div className="relative flex items-center justify-center">
                  <Volume2 size={42} className="text-emerald-300 animate-pulse" />
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-400/40 animate-ping" />
                </div>
              ) : callStatus === 'thinking' ? (
                <RefreshCw size={38} className="text-indigo-300 animate-spin" />
              ) : (
                <MicOff size={36} className="text-slate-500" />
              )}
            </div>

            {/* Audio Waveform Bars Simulation */}
            {(callStatus === 'listening' || callStatus === 'speaking') && (
              <div className="absolute -bottom-2 flex items-center gap-1">
                {[12, 24, 18, 32, 14, 28, 20, 16].map((h, idx) => (
                  <span
                    key={idx}
                    className={`w-1 rounded-full transition-all duration-150 ${
                      callStatus === 'speaking' ? 'bg-emerald-400' : 'bg-cyan-400'
                    }`}
                    style={{
                      height: `${h * 0.8}px`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Status Label */}
          <div className="mt-3">
            <h4
              className={`text-sm font-bold tracking-wider uppercase font-mono ${
                callStatus === 'listening'
                  ? 'text-cyan-300'
                  : callStatus === 'speaking'
                  ? 'text-emerald-300'
                  : callStatus === 'thinking'
                  ? 'text-indigo-300'
                  : 'text-slate-400'
              }`}
            >
              {callStatus === 'listening' && 'Listening to your voice... (Speak anytime)'}
              {callStatus === 'thinking' && 'JARVIS Neural Core Reasoning...'}
              {callStatus === 'speaking' && 'JARVIS Vox Responding...'}
              {callStatus === 'idle' && 'Call Paused'}
              {callStatus === 'error' && 'Audio Line Error'}
            </h4>

            {/* Live User Transcript */}
            {(transcript || interimTranscript) && callStatus === 'listening' && (
              <p className="mt-2 text-xs font-mono text-cyan-200/90 bg-cyan-950/40 border border-cyan-500/20 px-3 py-1.5 rounded-xl max-w-md mx-auto">
                &ldquo;{transcript || interimTranscript}&rdquo;
              </p>
            )}

            {/* Currently spoken assistant text */}
            {activeVoiceText && callStatus === 'speaking' && (
              <p className="mt-2 text-xs font-mono text-emerald-200/95 bg-emerald-950/40 border border-emerald-500/25 px-3 py-1.5 rounded-xl max-w-md mx-auto line-clamp-3">
                {activeVoiceText}
              </p>
            )}
          </div>
        </div>

        {/* Live Conversation Stream (Scrollable) */}
        <div className="flex-1 px-6 py-3 overflow-y-auto max-h-48 space-y-2.5 border-t border-b border-cyan-500/15 bg-slate-950/30">
          {turns.length === 0 ? (
            <p className="text-center text-xs text-slate-500 font-mono py-4">
              Start speaking — your voice dialogue with JARVIS will stream here continuously.
            </p>
          ) : (
            turns.map((t) => (
              <div
                key={t.id}
                className={`p-2.5 rounded-2xl text-xs font-mono flex items-start gap-2 ${
                  t.role === 'user'
                    ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-200 ml-4'
                    : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 mr-4'
                }`}
              >
                <span className="font-bold shrink-0">
                  {t.role === 'user' ? '👤 YOU:' : '🤖 JARVIS:'}
                </span>
                <span className="flex-1 leading-relaxed">{t.text}</span>
                <span className="text-[10px] text-slate-400 opacity-60 shrink-0">
                  {t.timestamp}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="p-6 bg-slate-950/70 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (callStatus === 'speaking') {
                  vox.stop();
                  setCallStatus('listening');
                  startListeningInternal();
                } else if (callStatus === 'listening') {
                  if (recognitionRef.current) {
                    try {
                      recognitionRef.current.abort();
                    } catch {
                      // ignore
                    }
                  }
                  setCallStatus('idle');
                } else {
                  setCallStatus('listening');
                  startListeningInternal();
                }
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-white text-xs font-mono transition-all cursor-pointer"
            >
              {callStatus === 'listening' ? (
                <>
                  <MicOff size={14} className="text-amber-400" />
                  <span>Pause Mic</span>
                </>
              ) : callStatus === 'speaking' ? (
                <>
                  <VolumeX size={14} className="text-emerald-400" />
                  <span>Skip Audio</span>
                </>
              ) : (
                <>
                  <Mic size={14} className="text-cyan-400" />
                  <span>Resume Mic</span>
                </>
              )}
            </button>
          </div>

          {/* Big End Call Button */}
          <button
            type="button"
            onClick={handleModalClose}
            className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider font-mono shadow-[0_0_20px_rgba(225,29,72,0.4)] active:scale-95 transition-all cursor-pointer"
          >
            <PhoneOff size={16} />
            <span>End Voice Call</span>
          </button>
        </div>
      </div>
    </div>
  );
}
