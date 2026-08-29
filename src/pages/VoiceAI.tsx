import { useState, useRef } from 'react';
import { Mic, Play, Pause, Download, Sparkles, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { playTapSound } from '@/lib/audio';

const VOICES = [
  { id: 'en-US-AriaNeural', label: 'Aria (US Female)', accent: 'US' },
  { id: 'en-US-ChristopherNeural', label: 'Christopher (US Male)', accent: 'US' },
  { id: 'en-GB-SoniaNeural', label: 'Sonia (UK Female)', accent: 'UK' },
  { id: 'en-GB-RyanNeural', label: 'Ryan (UK Male)', accent: 'UK' },
];

const SAMPLE_TEXTS = [
  "Welcome to NEXUS Intelligence OS. Microsoft Edge TTS neural speech synthesis is online and ready.",
  "Artificial Intelligence and advanced speech generation are transforming how we communicate across digital interfaces.",
  "The quick brown fox jumps over the lazy dog with crystal-clear neural articulation.",
  "In a world driven by data and automation, clear vocal interfaces bridge human intent and machine execution seamlessly.",
];

export function VoiceAI() {
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('en-US-AriaNeural');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleSpeak = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setError('Please enter text to synthesize.');
      return;
    }

    playTapSound();
    setLoading(true);
    setError(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
      const response = await fetch('/api/edge-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          voice: selectedVoice,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Server responded with status ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

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
    }
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
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
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
              <label className="block text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Neural Voice Model
              </label>
              <select
                value={selectedVoice}
                onChange={(e) => {
                  playTapSound();
                  setSelectedVoice(e.target.value);
                }}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-cyan-500 transition shadow-inner"
              >
                {VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} ({v.accent})
                  </option>
                ))}
              </select>
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
              <span className="text-xs font-mono text-slate-500">
                {text.length} / 3000 chars
              </span>
            </div>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Type or paste any text here to synthesize with Microsoft Edge TTS..."
              rows={5}
              maxLength={3000}
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
            <button
              type="submit"
              disabled={loading || !text.trim()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw size={17} className="animate-spin" />
                  Generating Neural Audio...
                </>
              ) : (
                <>
                  <Sparkles size={17} />
                  Speak It
                </>
              )}
            </button>

            {text && !loading && (
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setText('');
                  setAudioUrl(null);
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
              <a
                href={audioUrl}
                download={`voice_ai_${Date.now()}.mp3`}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition"
              >
                <Download size={14} /> Download MP3
              </a>
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
