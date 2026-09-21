import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic,
  Play,
  Pause,
  Download,
  Sparkles,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Cloud,
  Settings,
  Volume2,
  Info,
  Radio,
} from 'lucide-react';
import { playTapSound } from '@/lib/audio';
import { storage } from '@/lib/storage';
import { VoiceProviderConfig, StudioVoiceSettings } from '@/types';
import { EdgeVoicePicker } from '@/components/voice/EdgeVoicePicker';
import { CloudVoicePicker } from '@/components/voice/CloudVoicePicker';
import { StudioWaveformVisualizer } from '@/components/voice/StudioWaveformVisualizer';
import { StudioHeroGraphic } from '@/components/voice/StudioHeroGraphic';
import { StudioAudioControls } from '@/components/voice/StudioAudioControls';
import { StudioScriptPalettes } from '@/components/voice/StudioScriptPalettes';
import { LiveStreamingStudio } from '@/components/voice/LiveStreamingStudio';
import { DEFAULT_ELEVENLABS_VOICES } from '@/data/elevenLabsVoices';
import { cleanMarkdownForSpeech } from '@/lib/format';
import { synthesizeCloudVoiceAudio } from '@/lib/voiceProviderUtils';

const MAX_CHAR_LIMIT = 10000;
const CHUNK_SIZE_LIMIT = 2500;

const EDGE_SAMPLE_TEXTS = [
  "Welcome to NEXUS Intelligence OS. Microsoft Edge TTS neural speech synthesis is online and ready.",
  "Artificial Intelligence and advanced speech generation are transforming how we communicate across digital interfaces.",
  "The quick brown fox jumps over the lazy dog with crystal-clear neural articulation.",
  "In a world driven by data and automation, clear vocal interfaces bridge human intent and machine execution seamlessly.",
];

type VoiceSectionType = 'edge' | 'cloud';

/**
 * Splits long text into natural sentence/clause chunks under maxChunkLen characters
 * so Edge TTS can process each chunk reliably without timeout or buffer limits.
 */
function splitTextIntoSpeechChunks(text: string, maxChunkLen = CHUNK_SIZE_LIMIT): string[] {
  if (text.length <= maxChunkLen) return [text];

  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > 0) {
    if (remaining.length <= maxChunkLen) {
      chunks.push(remaining);
      break;
    }

    let sliceEnd = -1;
    const windowText = remaining.slice(0, maxChunkLen);

    // 1. Try to find the last sentence-ending punctuation followed by space or newline
    const sentenceMatches = Array.from(windowText.matchAll(/[.!?;\n]\s+/g));
    if (sentenceMatches.length > 0) {
      const lastMatch = sentenceMatches[sentenceMatches.length - 1];
      if (lastMatch.index !== undefined && lastMatch.index > maxChunkLen * 0.3) {
        sliceEnd = lastMatch.index + lastMatch[0].length;
      }
    }

    // 2. Try comma or colon clause separators if no sentence boundary found
    if (sliceEnd === -1) {
      const clauseMatches = Array.from(windowText.matchAll(/[,:]\s+/g));
      if (clauseMatches.length > 0) {
        const lastClause = clauseMatches[clauseMatches.length - 1];
        if (lastClause.index !== undefined && lastClause.index > maxChunkLen * 0.3) {
          sliceEnd = lastClause.index + lastClause[0].length;
        }
      }
    }

    // 3. Fall back to word boundary (space)
    if (sliceEnd === -1) {
      const lastSpace = windowText.lastIndexOf(' ');
      if (lastSpace > maxChunkLen * 0.3) {
        sliceEnd = lastSpace + 1;
      } else {
        sliceEnd = maxChunkLen;
      }
    }

    const chunk = remaining.slice(0, sliceEnd).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    remaining = remaining.slice(sliceEnd).trim();
  }

  return chunks.filter(Boolean);
}

export function VoiceAI() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<VoiceSectionType>('cloud');

  // Edge TTS State
  const [edgeText, setEdgeText] = useState('');
  const [selectedEdgeVoice, setSelectedEdgeVoice] = useState(() => storage.getEdgeVoice());
  const [edgeLoading, setEdgeLoading] = useState(false);
  const [edgeDownloading, setEdgeDownloading] = useState(false);
  const [edgeProgressStatus, setEdgeProgressStatus] = useState<string | null>(null);
  const [edgeError, setEdgeError] = useState<string | null>(null);
  const [edgeAudioUrl, setEdgeAudioUrl] = useState<string | null>(null);
  const [edgeSynthesizedText, setEdgeSynthesizedText] = useState<string | null>(null);
  const [edgeSynthesizedVoice, setEdgeSynthesizedVoice] = useState<string | null>(null);
  const [edgeIsPlaying, setEdgeIsPlaying] = useState(false);
  const edgeAudioRef = useRef<HTMLAudioElement | null>(null);

  // Cloud Voice AI State
  const [cloudSubMode, setCloudSubMode] = useState<'standard' | 'live'>('standard');
  const [cloudText, setCloudText] = useState('');
  const [selectedCloudVoice, setSelectedCloudVoice] = useState(() => storage.getCloudVoice());
  const [activeVoiceProvider, setActiveVoiceProvider] = useState<VoiceProviderConfig | null>(() =>
    storage.getActiveVoiceProvider()
  );
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudDownloading, setCloudDownloading] = useState(false);
  const [cloudProgressStatus, setCloudProgressStatus] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [isVoiceTierError, setIsVoiceTierError] = useState(false);
  const [cloudAudioUrl, setCloudAudioUrl] = useState<string | null>(null);
  const [cloudSynthesizedText, setCloudSynthesizedText] = useState<string | null>(null);
  const [cloudSynthesizedVoice, setCloudSynthesizedVoice] = useState<string | null>(null);
  const [studioSettings, setStudioSettings] = useState<StudioVoiceSettings>({
    stability: 0.5,
    similarityBoost: 0.75,
    speed: 1.0,
  });

  const selectedVoiceItem = DEFAULT_ELEVENLABS_VOICES.find((v) => v.id === selectedCloudVoice);
  const selectedVoiceName = selectedVoiceItem?.name || selectedCloudVoice;
  const isFreeTierOk = selectedVoiceItem?.isFreeTierCompatible ?? true;

  // Keep active voice provider in sync with storage
  const syncVoiceProvider = useCallback(() => {
    setActiveVoiceProvider(storage.getActiveVoiceProvider());
  }, []);

  useEffect(() => {
    window.addEventListener('nexus-voice-providers-updated', syncVoiceProvider);
    window.addEventListener('storage', syncVoiceProvider);
    return () => {
      window.removeEventListener('nexus-voice-providers-updated', syncVoiceProvider);
      window.removeEventListener('storage', syncVoiceProvider);
    };
  }, [syncVoiceProvider]);

  /**
   * Synthesizes audio for Edge TTS using cleanMarkdownForSpeech and automatic chunking + stitching
   */
  const synthesizeEdgeAudio = useCallback(
    async (
      rawText: string,
      voice: string,
      onProgress?: (msg: string) => void
    ): Promise<Blob> => {
      const cleaned = cleanMarkdownForSpeech(rawText);
      if (!cleaned) {
        throw new Error('Please enter text to synthesize.');
      }

      const chunks = splitTextIntoSpeechChunks(cleaned, CHUNK_SIZE_LIMIT);

      if (chunks.length === 1) {
        if (onProgress) onProgress('Generating Neural Audio...');
        const response = await fetch('/api/edge-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: chunks[0],
            voice,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `Server responded with status ${response.status}`);
        }

        return await response.blob();
      }

      const audioBlobs: Blob[] = [];
      for (let i = 0; i < chunks.length; i++) {
        if (onProgress) {
          onProgress(`Synthesizing Part ${i + 1} of ${chunks.length}...`);
        }

        const response = await fetch('/api/edge-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: chunks[i],
            voice,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(
            data.error || `Chunk ${i + 1}/${chunks.length} failed with status ${response.status}`
          );
        }

        const blob = await response.blob();
        audioBlobs.push(blob);
      }

      if (onProgress) onProgress('Stitching Audio Streams...');
      return new Blob(audioBlobs, { type: 'audio/mpeg' });
    },
    []
  );

  // Edge TTS Handlers
  const handleEdgeSpeak = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!edgeText.trim()) {
      setEdgeError('Please enter text to synthesize.');
      return;
    }

    playTapSound();
    setEdgeLoading(true);
    setEdgeProgressStatus('Preparing Neural Speech Synthesis...');
    setEdgeError(null);

    if (edgeAudioUrl) {
      URL.revokeObjectURL(edgeAudioUrl);
      setEdgeAudioUrl(null);
    }

    try {
      const blob = await synthesizeEdgeAudio(edgeText, selectedEdgeVoice, (msg) => {
        setEdgeProgressStatus(msg);
      });

      const url = URL.createObjectURL(blob);
      setEdgeAudioUrl(url);
      setEdgeSynthesizedText(edgeText);
      setEdgeSynthesizedVoice(selectedEdgeVoice);

      setTimeout(() => {
        if (edgeAudioRef.current) {
          edgeAudioRef.current.play().catch((err) => {
            console.warn('Autoplay prevented:', err);
          });
          setEdgeIsPlaying(true);
        }
      }, 100);
    } catch (err: unknown) {
      console.error('[Voice AI] Speech generation error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setEdgeError(msg || 'Failed to generate speech. Please ensure edge-tts is running.');
    } finally {
      setEdgeLoading(false);
      setEdgeProgressStatus(null);
    }
  };

  const handleEdgeDownload = async () => {
    if (!edgeText.trim()) {
      setEdgeError('Please enter text to synthesize and download.');
      return;
    }

    playTapSound();
    setEdgeError(null);

    if (edgeAudioUrl && edgeSynthesizedText === edgeText && edgeSynthesizedVoice === selectedEdgeVoice) {
      triggerDownloadUrl(edgeAudioUrl, `edge_tts_${Date.now()}.mp3`);
      return;
    }

    setEdgeDownloading(true);
    setEdgeProgressStatus('Generating MP3 for Download...');

    try {
      const blob = await synthesizeEdgeAudio(edgeText, selectedEdgeVoice, (msg) => {
        setEdgeProgressStatus(msg);
      });

      const url = URL.createObjectURL(blob);
      if (edgeAudioUrl) {
        URL.revokeObjectURL(edgeAudioUrl);
      }
      setEdgeAudioUrl(url);
      setEdgeSynthesizedText(edgeText);
      setEdgeSynthesizedVoice(selectedEdgeVoice);

      triggerDownloadUrl(url, `edge_tts_${Date.now()}.mp3`);
    } catch (err: unknown) {
      console.error('[Voice AI] Download error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setEdgeError(msg || 'Failed to download audio.');
    } finally {
      setEdgeDownloading(false);
      setEdgeProgressStatus(null);
    }
  };

  // Cloud Voice Handlers
  const executeCloudSynthesis = async (overrideVoiceId?: string) => {
    if (!cloudText.trim()) {
      setCloudError('Please enter text to synthesize.');
      return;
    }

    if (!activeVoiceProvider) {
      setCloudError('No active Cloud Voice AI Provider configured. Please check AI Providers Settings.');
      return;
    }

    playTapSound();
    setCloudLoading(true);
    setCloudProgressStatus(`Connecting to ${activeVoiceProvider.name}...`);
    setCloudError(null);
    setIsVoiceTierError(false);

    const voiceToUse = overrideVoiceId || selectedCloudVoice;
    if (overrideVoiceId) {
      setSelectedCloudVoice(overrideVoiceId);
      storage.saveCloudVoice(overrideVoiceId);
    }

    if (cloudAudioUrl) {
      URL.revokeObjectURL(cloudAudioUrl);
      setCloudAudioUrl(null);
    }

    try {
      const cleaned = cleanMarkdownForSpeech(cloudText);
      const result = await synthesizeCloudVoiceAudio(
        activeVoiceProvider,
        cleaned,
        voiceToUse,
        (msg) => setCloudProgressStatus(msg),
        studioSettings
      );

      const url = URL.createObjectURL(result.blob);
      setCloudAudioUrl(url);
      setCloudSynthesizedText(cloudText);
      setCloudSynthesizedVoice(voiceToUse);
    } catch (err: unknown) {
      console.error('[Cloud Voice AI] Speech generation error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      const isTierIssue =
        (err as Record<string, unknown>)?.isVoiceTierRestricted ||
        /library voices/i.test(msg) ||
        /needs_to_be_subscribed/i.test(msg) ||
        /paid_plan_required/i.test(msg) ||
        /upgrade your subscription/i.test(msg) ||
        /free users cannot use/i.test(msg) ||
        /402/i.test(msg);

      if (isTierIssue) {
        setIsVoiceTierError(true);
      }
      setCloudError(msg || 'Failed to generate cloud voice audio.');
    } finally {
      setCloudLoading(false);
      setCloudProgressStatus(null);
    }
  };

  const handleCloudSpeak = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await executeCloudSynthesis();
  };

  const handleCloudDownload = async () => {
    if (!cloudText.trim()) {
      setCloudError('Please enter text to synthesize and download.');
      return;
    }

    if (!activeVoiceProvider) {
      setCloudError('No active Cloud Voice AI Provider configured.');
      return;
    }

    playTapSound();
    setCloudError(null);

    if (cloudAudioUrl && cloudSynthesizedText === cloudText && cloudSynthesizedVoice === selectedCloudVoice) {
      triggerDownloadUrl(cloudAudioUrl, `cloud_voice_${Date.now()}.mp3`);
      return;
    }

    setCloudDownloading(true);
    setCloudProgressStatus('Generating MP3 for Download...');

    try {
      const cleaned = cleanMarkdownForSpeech(cloudText);
      const result = await synthesizeCloudVoiceAudio(
        activeVoiceProvider,
        cleaned,
        selectedCloudVoice,
        (msg) => setCloudProgressStatus(msg),
        studioSettings
      );

      const url = URL.createObjectURL(result.blob);
      if (cloudAudioUrl) {
        URL.revokeObjectURL(cloudAudioUrl);
      }
      setCloudAudioUrl(url);
      setCloudSynthesizedText(cloudText);
      setCloudSynthesizedVoice(selectedCloudVoice);

      triggerDownloadUrl(url, `cloud_voice_${Date.now()}.mp3`);
    } catch (err: unknown) {
      console.error('[Cloud Voice AI] Download error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      const isTierIssue =
        (err as Record<string, unknown>)?.isVoiceTierRestricted ||
        /library voices/i.test(msg) ||
        /needs_to_be_subscribed/i.test(msg) ||
        /paid_plan_required/i.test(msg) ||
        /upgrade your subscription/i.test(msg) ||
        /free users cannot use/i.test(msg) ||
        /402/i.test(msg);

      if (isTierIssue) {
        setIsVoiceTierError(true);
      }
      setCloudError(msg || 'Failed to download cloud audio.');
    } finally {
      setCloudDownloading(false);
      setCloudProgressStatus(null);
    }
  };

  const triggerDownloadUrl = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Graceful fallback from Cloud Voice 402 restriction to Microsoft Edge TTS
  const handleFallbackToEdgeTTS = () => {
    playTapSound();
    if (cloudText.trim()) {
      setEdgeText(cloudText);
    }
    setActiveSection('edge');
    setCloudError(null);
    setIsVoiceTierError(false);
  };

  // Check if active cloud provider has at least one configured key
  const hasCloudKeyConfigured = Boolean(
    activeVoiceProvider &&
      activeVoiceProvider.keys &&
      activeVoiceProvider.keys.some((k) => k.key && k.key.trim().length > 0)
  );

  return (
    <div className="voice-studio-container max-w-4xl mx-auto space-y-8 pb-12">
      {/* Page Header */}
      <div className="page-intro space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1.5">
            <Volume2 size={13} /> VOICE AI STUDIO
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            NEURAL ENGINE
          </span>
          {activeVoiceProvider && (
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1">
              <Sparkles size={12} /> CLOUD READY
            </span>
          )}
        </div>
        <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
          Voice AI Studio
        </h1>
        <p className="text-slate-400 text-sm sm:text-base">
          Convert any text into natural, ultra-realistic neural speech with built-in Microsoft Edge TTS or configure external Cloud Voice AI providers.
        </p>

        {/* Section Navigation Tabs */}
        <div className="pt-2">
          <div className="inline-flex p-1.5 bg-slate-950 border border-slate-800 rounded-2xl shadow-inner gap-1">
            <button
              type="button"
              onClick={() => {
                playTapSound();
                setActiveSection('cloud');
              }}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 transition cursor-pointer ${
                activeSection === 'cloud'
                  ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-200 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Cloud size={15} className={activeSection === 'cloud' ? 'text-purple-400' : 'text-slate-400'} />
              <span>Cloud Voice AI</span>
              {activeVoiceProvider && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 hidden sm:inline-block">
                  {activeVoiceProvider.name}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                playTapSound();
                setActiveSection('edge');
              }}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 transition cursor-pointer ${
                activeSection === 'edge'
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Mic size={15} className={activeSection === 'edge' ? 'text-cyan-400' : 'text-slate-400'} />
              <span>Microsoft Edge TTS</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hidden sm:inline-block">
                Built-in
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: MICROSOFT EDGE TTS (Default) */}
      {/* ========================================================================= */}
      {activeSection === 'edge' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden space-y-6 animate-fadeIn">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Section Header Banner */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <h2 className="text-base font-bold text-slate-100">Microsoft Edge TTS</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Ready • Free Unlimited
                </span>
              </div>
              <p className="text-xs text-slate-400">
                High-quality neural speech synthesis with 300+ multilingual voices. No external API key required.
              </p>
            </div>
          </div>

          <form onSubmit={handleEdgeSpeak} className="space-y-6 relative z-10">
            {/* Voice Selector & Presets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <EdgeVoicePicker
                  selectedVoice={selectedEdgeVoice}
                  onSelectVoice={(v) => {
                    setSelectedEdgeVoice(v);
                    storage.saveEdgeVoice(v);
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Quick Prompts
                </label>
                <div className="flex flex-wrap gap-2">
                  {EDGE_SAMPLE_TEXTS.slice(0, 2).map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setEdgeText(s);
                        setEdgeError(null);
                      }}
                      className="text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-slate-100 px-3 py-2 rounded-lg border border-slate-700/50 transition truncate max-w-[200px]"
                      title={s}
                    >
                      Sample {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Textarea Input */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider">
                  Input Text for Speech Synthesis
                </label>
                <span
                  className={`text-xs font-mono transition-colors ${
                    edgeText.length > MAX_CHAR_LIMIT * 0.9
                      ? 'text-amber-400 font-bold'
                      : 'text-slate-500'
                  }`}
                >
                  {edgeText.length} / {MAX_CHAR_LIMIT} chars
                </span>
              </div>
              <textarea
                value={edgeText}
                onChange={(e) => {
                  setEdgeText(e.target.value);
                  if (edgeError) setEdgeError(null);
                }}
                placeholder="Type or paste any text here (markdown formatting will be cleaned automatically for natural neural speech)..."
                rows={6}
                maxLength={MAX_CHAR_LIMIT}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-4 text-slate-100 text-sm focus:outline-none focus:border-cyan-500 transition resize-y shadow-inner leading-relaxed"
              />
            </div>

            {/* Error Banner */}
            {edgeError && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start gap-3 text-rose-300 text-sm animate-fadeIn">
                <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">{edgeError}</div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={edgeLoading || edgeDownloading || !edgeText.trim()}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 cursor-pointer"
                >
                  {edgeLoading ? (
                    <>
                      <RefreshCw size={17} className="animate-spin" />
                      <span>{edgeProgressStatus || 'Generating Neural Audio...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={17} />
                      <span>Speak It</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleEdgeDownload}
                  disabled={edgeLoading || edgeDownloading || !edgeText.trim()}
                  className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 font-semibold text-sm shadow-md hover:text-cyan-200 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 cursor-pointer"
                  title="Synthesize and download audio as MP3 file"
                >
                  {edgeDownloading ? (
                    <>
                      <Loader2 size={17} className="animate-spin text-cyan-400" />
                      <span>{edgeProgressStatus || 'Downloading MP3...'}</span>
                    </>
                  ) : (
                    <>
                      <Download size={17} />
                      <span>Download MP3</span>
                    </>
                  )}
                </button>
              </div>

              {edgeText && !edgeLoading && !edgeDownloading && (
                <button
                  type="button"
                  onClick={() => {
                    playTapSound();
                    setEdgeText('');
                    setEdgeAudioUrl(null);
                    setEdgeSynthesizedText(null);
                    setEdgeSynthesizedVoice(null);
                    setEdgeError(null);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 transition"
                >
                  Clear text
                </button>
              )}
            </div>
          </form>

          {/* Audio Player Card */}
          {edgeAudioUrl && (
            <div className="mt-8 pt-6 border-t border-slate-800 animate-fadeIn space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                  <CheckCircle2 size={18} />
                  <span>Audio Generated Successfully (Edge TTS)</span>
                </div>
                <button
                  type="button"
                  onClick={handleEdgeDownload}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition cursor-pointer"
                >
                  <Download size={14} /> Download MP3
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    if (!edgeAudioRef.current) return;
                    playTapSound();
                    if (edgeIsPlaying) {
                      edgeAudioRef.current.pause();
                      setEdgeIsPlaying(false);
                    } else {
                      edgeAudioRef.current.play().catch(() => {});
                      setEdgeIsPlaying(true);
                    }
                  }}
                  className="w-12 h-12 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/30 transition cursor-pointer shrink-0"
                  aria-label={edgeIsPlaying ? 'Pause' : 'Play'}
                >
                  {edgeIsPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                </button>

                <div className="flex-1">
                  <audio
                    ref={edgeAudioRef}
                    src={edgeAudioUrl}
                    controls
                    onPlay={() => setEdgeIsPlaying(true)}
                    onPause={() => setEdgeIsPlaying(false)}
                    onEnded={() => setEdgeIsPlaying(false)}
                    className="w-full accent-cyan-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: CLOUD VOICE AI (PRO STUDIO) */}
      {/* ========================================================================= */}
      {activeSection === 'cloud' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden space-y-6 animate-fadeIn">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Top Actions Bar */}
          <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-800/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} className="text-purple-400" />
                Production Studio
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {activeVoiceProvider ? activeVoiceProvider.name : 'ElevenLabs Engine'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Settings size={13} />
              <span>Voice AI Settings</span>
            </button>
          </div>

          {/* Studio Hero Graphic Banner */}
          <StudioHeroGraphic
            providerName={activeVoiceProvider ? activeVoiceProvider.name : 'Cloud Voice AI'}
            selectedVoiceName={selectedVoiceName}
            selectedVoiceId={selectedCloudVoice}
            isFreeTierOk={isFreeTierOk}
            onQuickSelectVoice={(vId) => {
              setSelectedCloudVoice(vId);
              storage.saveCloudVoice(vId);
            }}
          />

          {/* ElevenLabs Free Tier Monthly Limit & Voice Rules Note */}
          <div className="bg-slate-950/80 border border-purple-500/25 rounded-xl p-3.5 sm:p-4 flex items-start gap-3 text-xs shadow-sm">
            <Info size={17} className="text-purple-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-200">ElevenLabs Free-Tier Quota &amp; Policy Note:</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-semibold">
                  ~10,000 credits/mo (~10 min audio)
                </span>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px] sm:text-xs">
                ElevenLabs accounts on the free tier include ~10,000 credits per month (roughly 10 minutes of synthesized audio) that resets monthly. In addition, free-tier API accounts are restricted exclusively to official premade system voices (e.g. Sarah, George, Brian, Alice). Community and library voices require a paid ElevenLabs plan. You can switch to the built-in Microsoft Edge TTS tab at any time for 100% free and unlimited speech synthesis.
              </p>
            </div>
          </div>

          {/* Warning if no key configured */}
          {!hasCloudKeyConfigured && (
            <div className="bg-purple-950/40 border border-purple-500/30 rounded-xl p-4 flex items-start justify-between gap-4 text-purple-200 text-xs animate-fadeIn">
              <div className="space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-purple-300">
                  <Sparkles size={14} /> Cloud Voice AI Setup Required
                </div>
                <p className="text-slate-300">
                  Configure your API key (e.g., ElevenLabs) in AI Providers Settings to synthesize speech with Cloud Voice AI.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold text-xs transition cursor-pointer shrink-0 shadow"
              >
                Configure Now
              </button>
            </div>
          )}

          {/* Cloud Voice AI Sub-Mode Switcher: Standard Generation vs Live Streaming */}
          <div className="flex items-center justify-between flex-wrap gap-3 p-1.5 bg-slate-950/80 rounded-2xl border border-slate-800/80 relative z-10">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setCloudSubMode('standard');
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                  cloudSubMode === 'standard'
                    ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Sparkles size={14} className={cloudSubMode === 'standard' ? 'text-purple-400' : 'text-slate-400'} />
                <span>Standard Generation</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 hidden sm:inline-block">
                  HTTP REST
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setCloudSubMode('live');
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                  cloudSubMode === 'live'
                    ? 'bg-rose-500/20 text-rose-200 border border-rose-500/50 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Radio size={14} className={cloudSubMode === 'live' ? 'text-rose-400 animate-pulse' : 'text-slate-400'} />
                <span>Live Streaming</span>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-rose-500/25 text-rose-300 border border-rose-500/40 animate-pulse">
                  LIVE
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 hidden md:inline-block">
                  WebSocket
                </span>
              </button>
            </div>

            <div className="text-[11px] font-mono text-slate-400 px-2 hidden sm:block">
              {cloudSubMode === 'standard'
                ? 'Standard HTTP synthesis with downloadable MP3 waveform'
                : 'Real-time WebSocket streaming with gapless live audio decoding'}
            </div>
          </div>

          {/* SUB-MODE 1: STANDARD CLOUD SYNTHESIS (Unchanged) */}
          {cloudSubMode === 'standard' && (
            <>
              <form onSubmit={handleCloudSpeak} className="space-y-6 relative z-10">
                {/* Voice Model Selector */}
                <div className="space-y-2">
                  <CloudVoicePicker
                    selectedVoiceId={selectedCloudVoice}
                    onSelectVoice={(vId) => {
                      setSelectedCloudVoice(vId);
                      storage.saveCloudVoice(vId);
                    }}
                    activeProvider={activeVoiceProvider}
                  />
                </div>

                {/* Production Script Presets & Duration Telemetry */}
                <StudioScriptPalettes
                  currentText={cloudText}
                  onSelectScript={(text) => {
                    setCloudText(text);
                    if (cloudError) setCloudError(null);
                  }}
                />

                {/* Studio Script Textarea Input */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider">
                      Script & Spoken Dialogue
                    </label>
                    <span
                      className={`text-xs font-mono transition-colors ${
                        cloudText.length > MAX_CHAR_LIMIT * 0.9
                          ? 'text-amber-400 font-bold'
                          : 'text-slate-500'
                      }`}
                    >
                      {cloudText.length} / {MAX_CHAR_LIMIT} chars
                    </span>
                  </div>
                  <textarea
                    value={cloudText}
                    onChange={(e) => {
                      setCloudText(e.target.value);
                      if (cloudError) setCloudError(null);
                    }}
                    placeholder="Type or paste dialogue here to synthesize in studio quality..."
                    rows={5}
                    maxLength={MAX_CHAR_LIMIT}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-4 text-slate-100 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition resize-y shadow-inner leading-relaxed"
                  />
                </div>

                {/* Studio Audio Tuning Rack (Stability, Clarity, Pace) */}
                <StudioAudioControls
                  settings={studioSettings}
                  onChangeSettings={setStudioSettings}
                />

                {/* Error Banner with 1-click tier recovery & Edge TTS graceful fallback */}
                {cloudError && (
                  <div
                    className={`rounded-xl p-4 border animate-fadeIn ${
                      isVoiceTierError
                        ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {isVoiceTierError ? (
                        <Sparkles size={18} className="text-amber-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 space-y-2.5">
                        {isVoiceTierError ? (
                          <div className="space-y-1">
                            <div className="font-semibold text-amber-300 text-sm flex items-center gap-1.5">
                              ElevenLabs Free-Tier Voice Restriction (402 Paid Plan Required)
                            </div>
                            <p className="text-xs text-amber-200/90 leading-relaxed">
                              Free users cannot use community or library voices via the API. Please switch to a confirmed free-tier premade voice (such as Sarah, George, or Brian), or seamlessly fall back to Microsoft Edge TTS (built-in, free &amp; unlimited).
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs sm:text-sm leading-relaxed">{cloudError}</p>
                        )}

                        {isVoiceTierError && (
                          <div className="pt-2 space-y-2.5">
                            {/* Graceful Fallback Option: Microsoft Edge TTS */}
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={handleFallbackToEdgeTTS}
                                className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition shadow-md cursor-pointer flex items-center gap-1.5"
                              >
                                <Mic size={14} />
                                Fall Back to Microsoft Edge TTS (Always Free &amp; Unlimited)
                              </button>
                            </div>

                            {/* Fallback Option: Confirmed Free-Tier Premade Voices */}
                            <div className="flex flex-wrap items-center gap-2 pt-0.5">
                              <span className="text-[11px] font-mono text-amber-300/80 mr-1">
                                Or try free premade voices:
                              </span>
                              <button
                                type="button"
                                onClick={() => executeCloudSynthesis('EXAVITQu4vr4xnSDxMaL')}
                                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition shadow cursor-pointer flex items-center gap-1"
                              >
                                <Sparkles size={12} />
                                Switch to Sarah &amp; Retry
                              </button>
                              <button
                                type="button"
                                onClick={() => executeCloudSynthesis('JBFqnCBsd6RMkjVDRZzb')}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-500/40 font-semibold text-xs transition cursor-pointer"
                              >
                                Switch to George
                              </button>
                              <button
                                type="button"
                                onClick={() => executeCloudSynthesis('nPczCjzI2devNBz1zQrb')}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-500/40 font-semibold text-xs transition cursor-pointer"
                              >
                                Switch to Brian
                              </button>
                              <button
                                type="button"
                                onClick={() => executeCloudSynthesis('Xb7hH8MSUJpSbSDYk0k2')}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-500/40 font-semibold text-xs transition cursor-pointer"
                              >
                                Switch to Alice
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={cloudLoading || cloudDownloading || !cloudText.trim()}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-sm shadow-lg shadow-purple-500/25 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 cursor-pointer transform active:scale-98"
                    >
                      {cloudLoading ? (
                        <>
                          <RefreshCw size={17} className="animate-spin" />
                          <span>{cloudProgressStatus || 'Synthesizing Studio Audio...'}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={17} />
                          <span>Synthesize Speech</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleCloudDownload}
                      disabled={cloudLoading || cloudDownloading || !cloudText.trim()}
                      className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-purple-300 font-semibold text-sm shadow-md hover:text-purple-200 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 cursor-pointer"
                      title="Synthesize and download audio as MP3 file"
                    >
                      {cloudDownloading ? (
                        <>
                          <Loader2 size={17} className="animate-spin text-purple-400" />
                          <span>{cloudProgressStatus || 'Downloading MP3...'}</span>
                        </>
                      ) : (
                        <>
                          <Download size={17} />
                          <span>Download MP3</span>
                        </>
                      )}
                    </button>
                  </div>

                  {cloudText && !cloudLoading && !cloudDownloading && (
                    <button
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setCloudText('');
                        setCloudAudioUrl(null);
                        setCloudSynthesizedText(null);
                        setCloudSynthesizedVoice(null);
                        setCloudError(null);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-200 transition px-2 py-1 rounded hover:bg-slate-800 cursor-pointer"
                    >
                      Clear text
                    </button>
                  )}
                </div>
              </form>

              {/* Interactive Studio Waveform Visualizer & Audio Player */}
              {cloudAudioUrl && (
                <div className="mt-8 pt-6 border-t border-slate-800 animate-fadeIn space-y-4">
                  <StudioWaveformVisualizer
                    audioUrl={cloudAudioUrl}
                    voiceName={selectedVoiceName}
                    providerName={activeVoiceProvider ? activeVoiceProvider.name : 'Cloud Voice AI'}
                    onDownload={handleCloudDownload}
                    isDownloading={cloudDownloading}
                  />
                </div>
              )}
            </>
          )}

          {/* SUB-MODE 2: LIVE STREAMING (WebSocket wss://api.elevenlabs.io/.../stream-input) */}
          {cloudSubMode === 'live' && (
            <LiveStreamingStudio
              voiceId={selectedCloudVoice}
              voiceName={selectedVoiceName}
              activeProvider={activeVoiceProvider}
              onSelectVoice={(vId) => {
                setSelectedCloudVoice(vId);
                storage.saveCloudVoice(vId);
              }}
              onFallbackToEdge={handleFallbackToEdgeTTS}
              initialText={cloudText || ''}
            />
          )}
        </div>
      )}
    </div>
  );
}
