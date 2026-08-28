import { useState, useEffect, useMemo } from 'react';
import {
  AudioWaveform,
  Play,
  Square,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Settings as SettingsIcon,
  RefreshCw,
  PhoneCall,
  Sliders,
  Download,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { vox, POPULAR_VOX_MODELS, EDGE_TTS_VOICES } from '@/services/vox';
import { VoiceCallModal } from '@/components/vox/VoiceCallModal';
import { playTapSound } from '@/lib/audio';
import { storage } from '@/lib/storage';
import type { VoxSettings, AIProviderConfig } from '@/types';

const SAMPLE_PRESETS = [
  'NEXUS Intelligence OS online. All telemetry and cognitive reasoning subsystems are nominal.',
  'JARVIS autonomous multi-agent deep research pipeline calibrated and standing by.',
  'Quantum satellite telemetry array synchronized across 128 global data mesh nodes.',
  'Good morning Commander. Atmospheric conditions in your sector indicate clear skies with 22 degrees Celsius.',
];

export function VoxPage() {
  const navigate = useNavigate();

  const [settings, setSettings] = useState<VoxSettings>(() => vox.getSettings());
  const [inputText, setInputText] = useState<string>(SAMPLE_PRESETS[0]);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastAudioUrl, setLastAudioUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false);

  // Load AI Providers from storage
  const [aiProvidersState] = useState(() => storage.getAIProvidersState());

  // Comprehensive list of available providers (from configured list + built-in standard options)
  const availableProviders = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      hasKey: boolean;
      keyCount: number;
      defaultModel?: string;
      isCustom?: boolean;
    }> = [];

    // Add Hugging Face first (primary Vox TTS provider)
    const hfKey = storage.getHuggingFaceKey();
    const hfInState = aiProvidersState.providers.find((p) => p.id === 'huggingface');
    list.push({
      id: 'huggingface',
      name: hfInState?.name || 'Hugging Face (Vox TTS)',
      hasKey: Boolean(hfKey && hfKey.trim().length > 0),
      keyCount: hfInState?.keys.filter((k) => k.key.trim().length > 0).length || (hfKey ? 1 : 0),
      defaultModel: 'facebook/mms-tts-eng',
    });

    // Add all other providers configured in AI Providers settings
    aiProvidersState.providers.forEach((p: AIProviderConfig) => {
      if (p.id === 'huggingface') return; // already added above
      const validKeys = p.keys.filter((k) => k.key && k.key.trim().length > 0);
      list.push({
        id: p.id,
        name: p.name || p.id,
        hasKey: validKeys.length > 0,
        keyCount: validKeys.length,
        defaultModel: p.model,
        isCustom: true,
      });
    });

    return list;
  }, [aiProvidersState]);

  // Determine active selected provider details
  const activeProvider = useMemo(() => {
    const selectedId = settings.providerId || 'huggingface';
    return (
      availableProviders.find((p) => p.id === selectedId) ||
      availableProviders[0] || {
        id: 'huggingface',
        name: 'Hugging Face (Vox TTS)',
        hasKey: false,
        keyCount: 0,
        defaultModel: 'facebook/mms-tts-eng',
      }
    );
  }, [availableProviders, settings.providerId]);

  const isConfigured = vox.isConfigured(settings.providerId);

  // Subscribe to playback state
  useEffect(() => {
    const unsub = vox.subscribePlayback((playing) => {
      setIsPlaying(playing);
    });
    return unsub;
  }, []);

  const handleSynthesizeAndPlay = async () => {
    if (!inputText.trim()) return;
    playTapSound();
    setIsSynthesizing(true);
    setStatusMessage(null);

    try {
      if (!isConfigured) {
        setStatusMessage({
          type: 'error',
          text: `API key is required for ${activeProvider.name}. Please configure your API key in Settings > AI Providers.`,
        });
        setIsSynthesizing(false);
        return;
      }

      const instance = await vox.speak(inputText.trim(), {
        model: settings.model,
        speed: settings.speed,
        onStart: () => {
          setIsPlaying(true);
          setStatusMessage({
            type: 'success',
            text: `Synthesizing neural voice with ${activeProvider.name} using ${settings.model}...`,
          });
        },
        onEnd: () => {
          setIsPlaying(false);
        },
        onError: (err) => {
          setIsPlaying(false);
          setStatusMessage({
            type: 'error',
            text: `Synthesis error: ${err.message}. Verify model ID & API key in Settings > AI Providers.`,
          });
        },
      });

      if (instance?.audioElement?.src) {
        setLastAudioUrl(instance.audioElement.src);
      }
    } catch (err: unknown) {
      console.error('TTS execution error:', err);
      const msg = err instanceof Error ? err.message : 'Speech synthesis failed.';
      setStatusMessage({
        type: 'error',
        text: msg.includes('401') || msg.includes('token')
          ? `Invalid API token for ${activeProvider.name}. Please verify your key in Settings > AI Providers.`
          : msg,
      });
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleStopPlayback = () => {
    playTapSound();
    vox.stop();
    setIsPlaying(false);
  };

  const handleModelChange = (modelId: string) => {
    playTapSound();
    const updated = { ...settings, model: modelId };
    setSettings(updated);
    vox.saveSettings(updated);
  };

  const handleSpeedChange = (speed: number) => {
    const updated = { ...settings, speed };
    setSettings(updated);
    vox.saveSettings(updated);
  };

  return (
    <div className="min-h-full pb-16 space-y-8 animate-in fade-in duration-300">
      {/* Page Hero Header */}
      <div
        className="relative p-6 sm:p-8 rounded-3xl border border-cyan-500/30 overflow-hidden shadow-[0_16px_40px_rgba(0,0,0,0.6)]"
        style={{
          background: 'linear-gradient(135deg, rgba(8, 26, 44, 0.95) 0%, rgba(4, 14, 24, 0.98) 100%)',
        }}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 shadow-[0_0_20px_rgba(97,215,201,0.25)]">
                <AudioWaveform size={26} className="animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    VOX NEURAL SPEECH
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    VOICE STUDIO
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 font-mono">
                  Synthesize real-time voice audio using your configured AI providers in Settings.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions & Status Badge */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Configure in Settings shortcut */}
            <button
              type="button"
              onClick={() => {
                playTapSound();
                navigate('/settings?tab=ai');
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-400 text-xs font-mono text-slate-300 hover:text-cyan-300 transition-all cursor-pointer"
            >
              <SettingsIcon size={14} />
              <span>AI Providers Settings</span>
            </button>

            {/* Launch Voice Call Button */}
            <button
              type="button"
              onClick={() => {
                playTapSound();
                setIsVoiceCallOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider shadow-[0_0_20px_rgba(97,215,201,0.4)] active:scale-95 transition-all cursor-pointer"
            >
              <PhoneCall size={15} />
              <span>Voice Call JARVIS</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Left Column (Choose Models) + Right Column (Synthesis Studio) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Choose Models */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* Active Provider Indicator Banner */}
          <div className="p-4 rounded-2xl border border-cyan-500/30 bg-slate-950/80 flex items-center justify-between gap-4 text-xs font-mono">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-slate-300">Active Vox Provider: <span className="text-cyan-300 font-bold">{activeProvider.name}</span></span>
            </div>
            <button
              type="button"
              onClick={() => {
                playTapSound();
                navigate('/settings?tab=ai');
              }}
              className="text-cyan-400 hover:underline cursor-pointer"
            >
              Change in Settings →
            </button>
          </div>

          {/* Section: Choose Models */}
          <div
            className="p-6 sm:p-7 rounded-3xl border border-cyan-500/20 shadow-xl space-y-5"
            style={{
              background: 'linear-gradient(150deg, rgba(8, 20, 32, 0.9) 0%, rgba(4, 12, 20, 0.95) 100%)',
            }}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Sliders size={18} className="text-cyan-400" />
                <h2 className="text-lg font-bold text-white tracking-wide">Choose Models</h2>
              </div>
              <span className="text-xs font-mono text-cyan-300/70">
                Provider: <span className="text-white font-semibold">{activeProvider.name}</span>
              </span>
            </div>

            {/* Popular Model Selection List */}
            <div className="space-y-2.5">
              <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                Select Active Speech Engine:
              </label>
              <div className="space-y-2.5">
                {POPULAR_VOX_MODELS.map((m) => {
                  const isSelected = settings.model === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleModelChange(m.id)}
                      className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500/15 border-cyan-400/70 shadow-[0_0_16px_rgba(97,215,201,0.18)]'
                          : 'bg-slate-950/70 border-slate-800/90 hover:border-slate-700 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold ${isSelected ? 'text-cyan-300' : 'text-slate-200'}`}>
                            {m.name}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800/90 text-cyan-300 border border-slate-700">
                            {m.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-sans leading-relaxed">{m.desc}</p>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ml-3 ${
                          isSelected ? 'border-cyan-400 bg-cyan-400' : 'border-slate-600'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Edge TTS Voice Selector (shown when Edge TTS is active) */}
            {settings.model === 'edge-tts' && (
              <div className="space-y-2 pt-2 border-t border-cyan-500/20">
                <label className="text-xs font-mono text-cyan-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Microsoft Neural Voice:</span>
                  <span className="text-[10px] text-slate-400">Zero-Key Edge Stream</span>
                </label>
                <select
                  value={settings.voice || 'en-US-AriaNeural'}
                  onChange={(e) => {
                    playTapSound();
                    const updated = { ...settings, voice: e.target.value };
                    setSettings(updated);
                    vox.saveSettings(updated);
                  }}
                  className="w-full p-3 rounded-xl bg-slate-950/90 border border-cyan-500/45 focus:border-cyan-400 text-cyan-200 text-xs font-mono focus:outline-none transition-all cursor-pointer"
                >
                  {EDGE_TTS_VOICES.map((v) => (
                    <option key={v.id} value={v.id} className="bg-slate-950 text-white">
                      {v.name} ({v.gender})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Custom Model ID Input */}
            <div className="space-y-1.5 pt-2 border-t border-white/5">
              <label className="text-xs font-mono text-slate-400">
                CUSTOM MODEL ID ({activeProvider.name.toUpperCase()})
              </label>
              <input
                type="text"
                value={settings.model}
                onChange={(e) => handleModelChange(e.target.value)}
                placeholder="e.g. facebook/mms-tts-eng"
                className="w-full p-3 rounded-xl bg-slate-950/90 border border-slate-700/80 focus:border-cyan-400 text-slate-200 text-xs font-mono focus:outline-none transition-all"
              />
            </div>

            {/* Playback Speed Slider */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                <span>SPEECH SPEED RATE</span>
                <span className="text-cyan-400 font-bold">{settings.speed}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={settings.speed}
                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Speech Synthesis Studio */}
        <div className="lg:col-span-6 space-y-6">
          <div
            className="p-6 sm:p-7 rounded-3xl border border-cyan-500/20 shadow-xl space-y-5"
            style={{
              background: 'linear-gradient(150deg, rgba(8, 20, 32, 0.9) 0%, rgba(4, 12, 20, 0.95) 100%)',
            }}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-cyan-400" />
                <h2 className="text-lg font-bold text-white tracking-wide">Speech Studio</h2>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Active: <span className="text-cyan-300">{settings.model.split('/').pop()}</span>
              </span>
            </div>

            {/* Status Alert Banner */}
            {statusMessage && (
              <div
                className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs font-mono ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                    : statusMessage.type === 'error'
                    ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                    : 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                )}
                <span className="flex-1">{statusMessage.text}</span>
              </div>
            )}

            {/* Input Textarea */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>INPUT PROMPT FOR NEURAL VOICE</span>
                <span>{inputText.length} / 1500 chars</span>
              </div>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type or paste text for Vox to synthesize..."
                rows={4}
                className="w-full p-4 rounded-2xl bg-slate-950/80 border border-slate-700/80 focus:border-cyan-400 text-slate-100 text-sm font-sans focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-all placeholder:text-slate-600 resize-y"
              />
            </div>

            {/* Quick Sample Presets */}
            <div className="space-y-2">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Quick Test Samples:
              </span>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_PRESETS.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      playTapSound();
                      setInputText(sample);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/60 hover:border-cyan-500/50 text-[11px] text-slate-300 hover:text-cyan-300 font-mono transition-all text-left truncate max-w-xs cursor-pointer"
                  >
                    Sample {idx + 1}: &quot;{sample.slice(0, 28)}...&quot;
                  </button>
                ))}
              </div>
            </div>

            {/* Playback Controls & Waveform Bar */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                {!isPlaying ? (
                  <button
                    type="button"
                    onClick={handleSynthesizeAndPlay}
                    disabled={isSynthesizing || !inputText.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider shadow-[0_0_20px_rgba(97,215,201,0.3)] active:scale-95 transition-all cursor-pointer"
                  >
                    {isSynthesizing ? (
                      <>
                        <RefreshCw size={15} className="animate-spin text-slate-950" />
                        <span>Synthesizing Voice...</span>
                      </>
                    ) : (
                      <>
                        <Play size={15} fill="currentColor" />
                        <span>Generate &amp; Play Speech</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStopPlayback}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs font-mono uppercase tracking-wider shadow-[0_0_20px_rgba(244,63,94,0.4)] active:scale-95 transition-all cursor-pointer"
                  >
                    <Square size={15} fill="currentColor" />
                    <span>Stop Speech</span>
                  </button>
                )}
              </div>

              {/* Audio visualizer indicator */}
              {isPlaying && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/60 border border-cyan-500/30">
                  <AudioWaveform size={14} className="text-cyan-400 animate-pulse" />
                  <span className="text-[11px] font-mono text-cyan-300 font-bold">STREAMING VOX</span>
                </div>
              )}
            </div>

            {/* Last Generated Audio Player (if exists) */}
            {lastAudioUrl && (
              <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-cyan-500/25 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
                  <span>Synthesized Audio Stream</span>
                  <a
                    href={lastAudioUrl}
                    download="vox-synthesis.wav"
                    className="flex items-center gap-1 text-[11px] text-cyan-400 hover:underline"
                  >
                    <Download size={12} />
                    <span>Download Audio</span>
                  </a>
                </div>
                <audio controls src={lastAudioUrl} className="w-full h-8" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Voice Call Modal */}
      <VoiceCallModal
        isOpen={isVoiceCallOpen}
        onClose={() => setIsVoiceCallOpen(false)}
        onOpenSettings={() => navigate('/settings?tab=ai')}
      />
    </div>
  );
}
