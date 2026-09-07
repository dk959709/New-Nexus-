import { useState, useRef, useCallback } from 'react';
import { Mic, Play, Pause, Download, Sparkles, RefreshCw, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { playTapSound } from '@/lib/audio';
import { storage } from '@/lib/storage';
import { EdgeVoicePicker } from '@/components/voice/EdgeVoicePicker';
import { cleanMarkdownForSpeech } from '@/lib/format';

const MAX_CHAR_LIMIT = 10000;
const CHUNK_SIZE_LIMIT = 2500;

const SAMPLE_TEXTS = [
  "Welcome to NEXUS Intelligence OS. Microsoft Edge TTS neural speech synthesis is online and ready.",
  "Artificial Intelligence and advanced speech generation are transforming how we communicate across digital interfaces.",
  "The quick brown fox jumps over the lazy dog with crystal-clear neural articulation.",
  "In a world driven by data and automation, clear vocal interfaces bridge human intent and machine execution seamlessly.",
];

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
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(() => storage.getEdgeVoice());
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progressStatus, setProgressStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [synthesizedText, setSynthesizedText] = useState<string | null>(null);
  const [synthesizedVoice, setSynthesizedVoice] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /**
   * Synthesizes audio using cleanMarkdownForSpeech and automatic chunking + stitching
   */
  const synthesizeAudio = useCallback(
    async (
      rawText: string,
      voice: string,
      onProgress?: (msg: string) => void
    ): Promise<Blob> => {
      // Clean markdown syntax using the shared formatting function
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

      // Multi-chunk synthesis & stitching
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
      // Concatenate MP3 binary streams into a single seamless audio file
      return new Blob(audioBlobs, { type: 'audio/mpeg' });
    },
    []
  );

  const handleSpeak = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim()) {
      setError('Please enter text to synthesize.');
      return;
    }

    playTapSound();
    setLoading(true);
    setProgressStatus('Preparing Speech Synthesis...');
    setError(null);

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
      const blob = await synthesizeAudio(text, selectedVoice, (msg) => {
        setProgressStatus(msg);
      });

      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setSynthesizedText(text);
      setSynthesizedVoice(selectedVoice);

      // Auto play audio once ready
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play().catch((err) => {
            console.warn('Autoplay prevented:', err);
          });
          setIsPlaying(true);
        }
      }, 100);
    } catch (err: unknown) {
      console.error('[Voice AI] Speech generation error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to generate speech. Please ensure edge-tts is running.');
    } finally {
      setLoading(false);
      setProgressStatus(null);
    }
  };

  const handleDownload = async () => {
    if (!text.trim()) {
      setError('Please enter text to synthesize and download.');
      return;
    }

    playTapSound();
    setError(null);

    // If audio is already synthesized for the current text and voice, download directly
    if (audioUrl && synthesizedText === text && synthesizedVoice === selectedVoice) {
      triggerDownloadUrl(audioUrl);
      return;
    }

    setDownloading(true);
    setProgressStatus('Generating MP3 for Download...');

    try {
      const blob = await synthesizeAudio(text, selectedVoice, (msg) => {
        setProgressStatus(msg);
      });

      const url = URL.createObjectURL(blob);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      setAudioUrl(url);
      setSynthesizedText(text);
      setSynthesizedVoice(selectedVoice);

      triggerDownloadUrl(url);
    } catch (err: unknown) {
      console.error('[Voice AI] Download error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to download audio.');
    } finally {
      setDownloading(false);
      setProgressStatus(null);
    }
  };

  const triggerDownloadUrl = (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `voice_ai_${Date.now()}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSampleSelect = (sample: string) => {
    playTapSound();
    setText(sample);
    setError(null);
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    playTapSound();
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  return (
    <div className="voice-studio-container max-w-4xl mx-auto space-y-8 pb-12">
      {/* Page Header */}
      <div className="page-intro space-y-2">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1.5">
            <Mic size={13} /> MICROSOFT EDGE TTS
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            NEURAL ENGINE
          </span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
          Voice AI Studio
        </h1>
        <p className="text-slate-400 text-sm sm:text-base">
          Convert any text into natural, ultra-realistic neural voice audio using Microsoft Edge Text-to-Speech.
        </p>
      </div>

      {/* Main Studio Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden space-y-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <form onSubmit={handleSpeak} className="space-y-6 relative z-10">
          {/* Voice Selector & Presets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <EdgeVoicePicker
                selectedVoice={selectedVoice}
                onSelectVoice={(v) => {
                  setSelectedVoice(v);
                  storage.saveEdgeVoice(v);
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Quick Prompts
              </label>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_TEXTS.slice(0, 2).map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSampleSelect(s)}
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
                  text.length > MAX_CHAR_LIMIT * 0.9
                    ? 'text-amber-400 font-bold'
                    : 'text-slate-500'
                }`}
              >
                {text.length} / {MAX_CHAR_LIMIT} chars
              </span>
            </div>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Type or paste any text here (markdown formatting will be cleaned automatically for natural neural speech)..."
              rows={6}
              maxLength={MAX_CHAR_LIMIT}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-4 text-slate-100 text-sm focus:outline-none focus:border-cyan-500 transition resize-y shadow-inner leading-relaxed"
            />
          </div>

          {/* Error Banner */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start gap-3 text-rose-300 text-sm animate-fadeIn">
              <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={loading || downloading || !text.trim()}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw size={17} className="animate-spin" />
                    <span>{progressStatus || 'Generating Neural Audio...'}</span>
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
                onClick={handleDownload}
                disabled={loading || downloading || !text.trim()}
                className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 font-semibold text-sm shadow-md hover:text-cyan-200 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 cursor-pointer"
                title="Synthesize and download audio as MP3 file"
              >
                {downloading ? (
                  <>
                    <Loader2 size={17} className="animate-spin text-cyan-400" />
                    <span>{progressStatus || 'Downloading MP3...'}</span>
                  </>
                ) : (
                  <>
                    <Download size={17} />
                    <span>Download MP3</span>
                  </>
                )}
              </button>
            </div>

            {text && !loading && !downloading && (
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setText('');
                  setAudioUrl(null);
                  setSynthesizedText(null);
                  setSynthesizedVoice(null);
                  setError(null);
                }}
                className="text-xs text-slate-400 hover:text-slate-200 transition"
              >
                Clear text
              </button>
            )}
          </div>
        </form>

        {/* Audio Player Card */}
        {audioUrl && (
          <div className="mt-8 pt-6 border-t border-slate-800 animate-fadeIn space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                <CheckCircle2 size={18} />
                <span>Audio Generated Successfully</span>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition cursor-pointer"
              >
                <Download size={14} /> Download MP3
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
              <button
                type="button"
                onClick={togglePlayPause}
                className="w-12 h-12 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/30 transition cursor-pointer shrink-0"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
              </button>

              <div className="flex-1">
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  controls
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  className="w-full accent-cyan-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

