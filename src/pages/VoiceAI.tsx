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
} from 'lucide-react';
import { playTapSound } from '@/lib/audio';
import { storage } from '@/lib/storage';
import { VoiceProviderConfig } from '@/types';
import { EdgeVoicePicker } from '@/components/voice/EdgeVoicePicker';
import { CloudVoicePicker } from '@/components/voice/CloudVoicePicker';
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

const CLOUD_SAMPLE_TEXTS = [
  "Greetings from Cloud Voice AI. High-fidelity neural voice synthesis is now operational.",
  "With multi-provider voice synthesis, you can articulate complex ideas with human-like expressiveness.",
  "The atmosphere was charged with quiet anticipation as the research team initiated the neural speech array.",
  "Experience natural vocal cadence, dynamic tone inflection, and multi-language clarity powered by cloud voice engines.",
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
  const [activeSection, setActiveSection] = useState<VoiceSectionType>('edge');

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
  const [cloudText, setCloudText] = useState('');
  const [selectedCloudVoice, setSelectedCloudVoice] = useState(() => storage.getCloudVoice());
  const [activeVoiceProvider, setActiveVoiceProvider] = useState<VoiceProviderConfig | null>(() =>
    storage.getActiveVoiceProvider()
  );
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudDownloading, setCloudDownloading] = useState(false);
  const [cloudProgressStatus, setCloudProgressStatus] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudAudioUrl, setCloudAudioUrl] = useState<string | null>(null);
  const [cloudSynthesizedText, setCloudSynthesizedText] = useState<string | null>(null);
  const [cloudSynthesizedVoice, setCloudSynthesizedVoice] = useState<string | null>(null);
  const [cloudIsPlaying, setCloudIsPlaying] = useState(false);
  const cloudAudioRef = useRef<HTMLAudioElement | null>(null);

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
  const handleCloudSpeak = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

    if (cloudAudioUrl) {
      URL.revokeObjectURL(cloudAudioUrl);
      setCloudAudioUrl(null);
    }

    try {
      const cleaned = cleanMarkdownForSpeech(cloudText);
      const result = await synthesizeCloudVoiceAudio(
        activeVoiceProvider,
        cleaned,
        selectedCloudVoice,
        (msg) => setCloudProgressStatus(msg)
      );

      const url = URL.createObjectURL(result.blob);
      setCloudAudioUrl(url);
      setCloudSynthesizedText(cloudText);
      setCloudSynthesizedVoice(selectedCloudVoice);

      setTimeout(() => {
        if (cloudAudioRef.current) {
          cloudAudioRef.current.play().catch((err) => {
            console.warn('Autoplay prevented:', err);
          });
          setCloudIsPlaying(true);
        }
      }, 100);
    } catch (err: unknown) {
      console.error('[Cloud Voice AI] Speech generation error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setCloudError(msg || 'Failed to generate cloud voice audio.');
    } finally {
      setCloudLoading(false);
      setCloudProgressStatus(null);
    }
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
        (msg) => setCloudProgressStatus(msg)
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
      {/* SECTION 2: CLOUD VOICE AI */}
      {/* ========================================================================= */}
      {activeSection === 'cloud' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden space-y-6 animate-fadeIn">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Section Header Banner */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 flex-wrap gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
                <h2 className="text-base font-bold text-slate-100">Cloud Voice AI</h2>
                {activeVoiceProvider && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                    Active: {activeVoiceProvider.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Premium multi-provider cloud voice synthesis (e.g. ElevenLabs) with automatic key failover and expressive voice models.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Settings size={13} />
              <span>Voice AI Settings</span>
            </button>
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

          <form onSubmit={handleCloudSpeak} className="space-y-6 relative z-10">
            {/* Voice Selector & Presets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <CloudVoicePicker
                  selectedVoiceId={selectedCloudVoice}
                  onSelectVoice={(vId) => {
                    setSelectedCloudVoice(vId);
                    storage.saveCloudVoice(vId);
                  }}
                  activeProvider={activeVoiceProvider}
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Quick Prompts
                </label>
                <div className="flex flex-wrap gap-2">
                  {CLOUD_SAMPLE_TEXTS.slice(0, 2).map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setCloudText(s);
                        setCloudError(null);
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
                  Input Text for Cloud Voice Synthesis
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
                placeholder="Enter text to synthesize with Cloud Voice AI..."
                rows={6}
                maxLength={MAX_CHAR_LIMIT}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-4 text-slate-100 text-sm focus:outline-none focus:border-purple-500 transition resize-y shadow-inner leading-relaxed"
              />
            </div>

            {/* Error Banner */}
            {cloudError && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start gap-3 text-rose-300 text-sm animate-fadeIn">
                <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">{cloudError}</div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={cloudLoading || cloudDownloading || !cloudText.trim()}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-sm shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 cursor-pointer"
                >
                  {cloudLoading ? (
                    <>
                      <RefreshCw size={17} className="animate-spin" />
                      <span>{cloudProgressStatus || 'Synthesizing Audio...'}</span>
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
                  className="text-xs text-slate-400 hover:text-slate-200 transition"
                >
                  Clear text
                </button>
              )}
            </div>
          </form>

          {/* Audio Player Card */}
          {cloudAudioUrl && (
            <div className="mt-8 pt-6 border-t border-slate-800 animate-fadeIn space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                  <CheckCircle2 size={18} />
                  <span>Audio Generated Successfully (Cloud Voice AI)</span>
                </div>
                <button
                  type="button"
                  onClick={handleCloudDownload}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 transition cursor-pointer"
                >
                  <Download size={14} /> Download MP3
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    if (!cloudAudioRef.current) return;
                    playTapSound();
                    if (cloudIsPlaying) {
                      cloudAudioRef.current.pause();
                      setCloudIsPlaying(false);
                    } else {
                      cloudAudioRef.current.play().catch(() => {});
                      setCloudIsPlaying(true);
                    }
                  }}
                  className="w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/30 transition cursor-pointer shrink-0"
                  aria-label={cloudIsPlaying ? 'Pause' : 'Play'}
                >
                  {cloudIsPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                </button>

                <div className="flex-1">
                  <audio
                    ref={cloudAudioRef}
                    src={cloudAudioUrl}
                    controls
                    onPlay={() => setCloudIsPlaying(true)}
                    onPause={() => setCloudIsPlaying(false)}
                    onEnded={() => setCloudIsPlaying(false)}
                    className="w-full accent-purple-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
