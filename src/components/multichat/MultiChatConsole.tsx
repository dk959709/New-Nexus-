import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Trash2,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Sparkles,
  User,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Download,
  Share2,
  Sliders,
  Layers,
  Columns,
  ListFilter,
  X,
  Clock,
  Cpu,
  Search,
  Radio,
  CornerDownLeft,
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { copyToClipboard } from '@/lib/clipboard';
import { cleanMarkdownForSpeech } from '@/lib/format';
import { FormattedText } from '@/components/jarvis/FormattedText';
import { executeMultiChatTurn } from '@/services/multiChatOrchestrator';
import type {
  MultiChatMessage,
  MultiChatSystemConfig,
  MultiChatPersonaResponse,
} from '@/types';

interface MultiChatConsoleProps {
  config: MultiChatSystemConfig;
  onNavigateToSettings: () => void;
}

type ViewMode = 'unified' | 'tabs' | 'grid';

const PROMPT_CATEGORIES = [
  {
    category: 'Analytical & Science',
    icon: '🔬',
    prompts: [
      'What is quantum entanglement and how does it challenge classical physics?',
      'How does CRISPR gene editing work, and what are its practical boundaries?',
    ],
  },
  {
    category: 'Strategy & Mindset',
    icon: '💡',
    prompts: [
      'Give me actionable advice for staying motivated when working on long projects.',
      'How do I balance high career ambition with everyday mindfulness?',
    ],
  },
  {
    category: 'Technology & AI',
    icon: '🤖',
    prompts: [
      'Explain how deep learning architectures differ from human cognitive reasoning.',
      'What are the most promising breakthroughs in renewable energy storage?',
    ],
  },
  {
    category: 'Philosophy & Life',
    icon: '🌌',
    prompts: [
      'If technology continues to automate routine work, what becomes the core human purpose?',
      'How can one make high-stakes decisions with calmness and emotional detachment?',
    ],
  },
];

export function MultiChatConsole({ config, onNavigateToSettings }: MultiChatConsoleProps) {
  const [messages, setMessages] = useState<MultiChatMessage[]>(() => storage.getMultiChatMessages());
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedCombinedId, setCopiedCombinedId] = useState<string | null>(null);
  const [copiedQueryId, setCopiedQueryId] = useState<string | null>(null);
  const [playingAudioKey, setPlayingAudioKey] = useState<string | null>(null);
  const [edgeTtsLoadingId, setEdgeTtsLoadingId] = useState<string | null>(null);
  const [downloadingAudioId, setDownloadingAudioId] = useState<string | null>(null);
  const [downloadSuccessId, setDownloadSuccessId] = useState<string | null>(null);
  const [clearedBanner, setClearedBanner] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('unified');
  const [selectedPersonaTab, setSelectedPersonaTab] = useState<Record<string, string>>({});
  const [showQuickPrompts, setShowQuickPrompts] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const edgeTtsAudioRef = useRef<HTMLAudioElement | null>(null);

  // Stop active speech or audio
  const stopAudio = () => {
    if (edgeTtsAudioRef.current) {
      edgeTtsAudioRef.current.pause();
      edgeTtsAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingAudioKey(null);
    setEdgeTtsLoadingId(null);
  };

  // Sync with storage on mount and window focus
  useEffect(() => {
    setMessages(storage.getMultiChatMessages());
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Clean up any speech on unmount
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  const enabledPersonas = Object.values(config.personas).filter((p) => p.enabled);

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || inputText).trim();
    if (!textToSend || isGenerating) return;

    if (enabledPersonas.length === 0) {
      alert('All personas are currently disabled. Please enable at least one persona in Agent Configurations.');
      onNavigateToSettings();
      return;
    }

    setInputText('');
    setShowQuickPrompts(false);
    setIsGenerating(true);

    const messageId = `mc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const initialResponses: MultiChatPersonaResponse[] = enabledPersonas.map((p) => ({
      personaId: p.id,
      name: p.name,
      icon: p.icon,
      accentColor: p.accentColor,
      toneBadge: p.toneBadge,
      text: '',
      status: 'running',
    }));

    const newMessage: MultiChatMessage = {
      id: messageId,
      query: textToSend,
      timestamp: Date.now(),
      responses: initialResponses,
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    storage.saveMultiChatMessages(updatedMessages);

    try {
      await executeMultiChatTurn({
        query: textToSend,
        conversationHistory: messages,
        config,
        onPersonaUpdate: (updatedResp) => {
          setMessages((prev) => {
            const next = prev.map((msg) => {
              if (msg.id !== messageId) return msg;
              const nextResponses = msg.responses.map((r) =>
                r.personaId === updatedResp.personaId ? { ...r, ...updatedResp } : r,
              );
              return { ...msg, responses: nextResponses };
            });
            storage.saveMultiChatMessages(next);
            return next;
          });
        },
      });
    } catch (err: unknown) {
      console.error('[MultiChatConsole] Execution error:', err);
    } finally {
      setIsGenerating(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopyText = async (text: string, idKey: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedId(idKey);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleCopyQuery = async (text: string, idKey: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedQueryId(idKey);
      setTimeout(() => setCopiedQueryId(null), 2000);
    }
  };

  // Helper to map persona to matched Edge TTS neural voice
  const getPersonaVoice = (personaId?: string): string => {
    const globalVoice = storage.getEdgeVoice();
    if (personaId === 'nova') return 'en-US-JennyNeural';
    if (personaId === 'orbit') return 'en-US-GuyNeural';
    if (personaId === 'cosmos') return 'en-US-EricNeural';
    return globalVoice || 'en-US-AriaNeural';
  };

  // 1. UNIVERSAL COPY BUTTON:
  // Copies all persona responses together as one formatted text block:
  // === NOVA ===
  // [nova's answer]
  // === ORBIT ===
  // [orbit's answer]
  // === COSMOS ===
  // [cosmos's answer]
  const handleCopyCombined = async (msg: MultiChatMessage) => {
    const completedResponses = msg.responses.filter(
      (r) => r.status === 'completed' && (r.text || (r as { reasoning?: string }).reasoning)
    );
    if (completedResponses.length === 0) return;

    const formattedBlock = completedResponses
      .map((r) => {
        const answer = (r.text || (r as { reasoning?: string }).reasoning || '').trim();
        return `=== ${r.name.toUpperCase()} ===\n${answer}`;
      })
      .join('\n\n');

    const success = await copyToClipboard(formattedBlock);
    if (success) {
      setCopiedCombinedId(msg.id);
      setTimeout(() => setCopiedCombinedId(null), 2000);
    }
  };

  // 2. INDIVIDUAL EDGE TTS LISTEN (Play / Stop)
  const handleToggleAudio = async (text: string, idKey: string, personaId?: string) => {
    if (playingAudioKey === idKey) {
      stopAudio();
      return;
    }

    stopAudio();

    const cleanText = cleanMarkdownForSpeech(text);
    if (!cleanText) return;

    setEdgeTtsLoadingId(idKey);
    try {
      const voice = getPersonaVoice(personaId);
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
      edgeTtsAudioRef.current = audio;

      audio.onplay = () => {
        setPlayingAudioKey(idKey);
        setEdgeTtsLoadingId(null);
      };

      audio.onended = () => {
        setPlayingAudioKey(null);
        edgeTtsAudioRef.current = null;
        URL.revokeObjectURL(url);
      };

      audio.onerror = () => {
        setPlayingAudioKey(null);
        edgeTtsAudioRef.current = null;
        URL.revokeObjectURL(url);
      };

      await audio.play();
    } catch (err) {
      console.warn('[MultiChat] Edge TTS error, falling back to local speech synthesis:', err);
      setEdgeTtsLoadingId(null);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.0;
        utterance.pitch = idKey.includes('orbit') ? 1.1 : idKey.includes('cosmos') ? 0.9 : 1.0;
        utterance.onend = () => setPlayingAudioKey(null);
        utterance.onerror = () => setPlayingAudioKey(null);
        setPlayingAudioKey(idKey);
        window.speechSynthesis.speak(utterance);
      } else {
        setPlayingAudioKey(null);
      }
    }
  };

  // 2. UNIVERSAL LISTEN TO ALL:
  // Plays all 3 persona responses back-to-back using the Edge TTS system
  const handleListenToAll = async (msg: MultiChatMessage) => {
    const combinedKey = `all_${msg.id}`;
    if (playingAudioKey === combinedKey) {
      stopAudio();
      return;
    }

    stopAudio();

    const completedResponses = msg.responses.filter(
      (r) => r.status === 'completed' && (r.text || (r as { reasoning?: string }).reasoning)
    );
    if (completedResponses.length === 0) return;

    setEdgeTtsLoadingId(combinedKey);
    try {
      const audioBlobs: Blob[] = [];

      for (const resp of completedResponses) {
        const rawText = (resp.text || (resp as { reasoning?: string }).reasoning || '').trim();
        const cleanText = cleanMarkdownForSpeech(rawText);
        if (!cleanText) continue;

        const spokenIntro = `${resp.name}. `;
        const voice = getPersonaVoice(resp.personaId);

        const response = await fetch('/api/edge-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: cleanMarkdownForSpeech(spokenIntro + cleanText).slice(0, 3500),
            voice,
          }),
        });

        if (!response.ok) {
          throw new Error(`Edge TTS synthesis failed for ${resp.name}: ${response.status}`);
        }

        const blob = await response.blob();
        audioBlobs.push(blob);
      }

      if (audioBlobs.length === 0) {
        throw new Error('No audio was generated');
      }

      // Concatenate all persona MP3 binary streams into a single seamless audio file
      const stitchedBlob = new Blob(audioBlobs, { type: 'audio/mpeg' });
      const url = URL.createObjectURL(stitchedBlob);
      const audio = new Audio(url);
      edgeTtsAudioRef.current = audio;

      audio.onplay = () => {
        setPlayingAudioKey(combinedKey);
        setEdgeTtsLoadingId(null);
      };

      audio.onended = () => {
        setPlayingAudioKey(null);
        edgeTtsAudioRef.current = null;
        URL.revokeObjectURL(url);
      };

      audio.onerror = () => {
        setPlayingAudioKey(null);
        edgeTtsAudioRef.current = null;
        URL.revokeObjectURL(url);
      };

      await audio.play();
    } catch (err) {
      console.error('[MultiChat] Listen to All error:', err);
      setPlayingAudioKey(null);
      setEdgeTtsLoadingId(null);
    }
  };

  // 3. INDIVIDUAL MP3 DOWNLOAD:
  // Edge TTS download for a single persona's response
  const handleDownloadPersonaAudio = async (
    text: string,
    idKey: string,
    personaName: string,
    personaId: string,
    query?: string
  ) => {
    const cleanText = cleanMarkdownForSpeech(text);
    if (!cleanText) return;

    setDownloadingAudioId(idKey);
    try {
      const voice = getPersonaVoice(personaId);
      const response = await fetch('/api/edge-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText.slice(0, 4000),
          voice,
        }),
      });

      if (!response.ok) {
        throw new Error(`Edge TTS download failed: ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      const safeSlug = query
        ? query
            .slice(0, 25)
            .trim()
            .replace(/[^a-zA-Z0-9_-]+/g, '_')
            .toLowerCase()
        : 'response';
      a.download = `nexus_multichat_${personaName.toLowerCase()}_${safeSlug}_${Date.now()}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setDownloadSuccessId(idKey);
      setTimeout(() => setDownloadSuccessId((cur) => (cur === idKey ? null : cur)), 2500);
    } catch (err) {
      console.error('[MultiChat] Individual audio download error:', err);
    } finally {
      setDownloadingAudioId(null);
    }
  };

  // 3. UNIVERSAL MP3 DOWNLOAD:
  // Stitches all 3 persona audios into one contiguous MP3 file
  const handleDownloadAllAudio = async (msg: MultiChatMessage) => {
    const completedResponses = msg.responses.filter(
      (r) => r.status === 'completed' && (r.text || (r as { reasoning?: string }).reasoning)
    );
    if (completedResponses.length === 0) return;

    const downloadKey = `all_dl_${msg.id}`;
    setDownloadingAudioId(downloadKey);

    try {
      const audioBlobs: Blob[] = [];

      for (const resp of completedResponses) {
        const rawText = (resp.text || (resp as { reasoning?: string }).reasoning || '').trim();
        const cleanText = cleanMarkdownForSpeech(rawText);
        if (!cleanText) continue;

        const spokenIntro = `${resp.name}. `;
        const voice = getPersonaVoice(resp.personaId);

        const response = await fetch('/api/edge-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: cleanMarkdownForSpeech(spokenIntro + cleanText).slice(0, 4000),
            voice,
          }),
        });

        if (!response.ok) {
          throw new Error(`Edge TTS download failed for ${resp.name}: ${response.status}`);
        }

        const blob = await response.blob();
        audioBlobs.push(blob);
      }

      if (audioBlobs.length === 0) return;

      const stitchedBlob = new Blob(audioBlobs, { type: 'audio/mpeg' });
      const url = URL.createObjectURL(stitchedBlob);

      const a = document.createElement('a');
      a.href = url;
      const safeSlug = msg.query
        ? msg.query
            .slice(0, 25)
            .trim()
            .replace(/[^a-zA-Z0-9_-]+/g, '_')
            .toLowerCase()
        : 'multi_all';
      a.download = `nexus_multichat_all_personas_${safeSlug}_${Date.now()}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setDownloadSuccessId(downloadKey);
      setTimeout(() => setDownloadSuccessId((cur) => (cur === downloadKey ? null : cur)), 2500);
    } catch (err) {
      console.error('[MultiChat] Stitched MP3 download error:', err);
    } finally {
      setDownloadingAudioId(null);
    }
  };

  // 4. CLEAR CHAT:
  // Clears Multi Chat history, resets the 10-message conversational memory, and stops any playback
  const handleClearHistory = () => {
    stopAudio();
    storage.clearMultiChatMessages();
    setMessages([]);
    setSelectedPersonaTab({});
    setShowClearModal(false);
    setClearedBanner(true);
    setTimeout(() => setClearedBanner(false), 3500);
  };

  const handleExportTranscript = async () => {
    if (messages.length === 0) return;

    const transcriptLines: string[] = [
      '# NEXUS // MULTI CHAT TRANSCRIPT',
      `Exported on: ${new Date().toLocaleString()}`,
      '',
    ];

    for (const msg of messages) {
      transcriptLines.push(`### 👤 USER INQUIRY (${new Date(msg.timestamp).toLocaleTimeString()})`);
      transcriptLines.push(msg.query);
      transcriptLines.push('');
      for (const resp of msg.responses) {
        transcriptLines.push(`#### ${resp.icon} ${resp.name} [${resp.toneBadge || 'Persona'}]`);
        const text = resp.text || (resp as { reasoning?: string }).reasoning || '';
        if (resp.status === 'completed') {
          transcriptLines.push(text);
        } else if (resp.status === 'failed') {
          transcriptLines.push(`*[Error: ${resp.error || 'Failed to generate'}]*`);
        } else {
          transcriptLines.push('*[Processing...]*');
        }
        transcriptLines.push('');
      }
      transcriptLines.push('---');
      transcriptLines.push('');
    }

    const fullContent = transcriptLines.join('\n');
    const success = await copyToClipboard(fullContent);
    if (success) {
      alert('Complete Multi Chat transcript copied to clipboard!');
    }
  };

  const applyQueryModifier = (modifier: string) => {
    setInputText((prev) => {
      const trimmed = prev.trim();
      if (trimmed.startsWith(modifier)) return prev;
      return `${modifier} ${trimmed}`.trim();
    });
    inputRef.current?.focus();
  };

  const charCount = inputText.length;
  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="flex flex-col gap-5 w-full max-w-5xl mx-auto min-h-[calc(100vh-220px)]">
      {/* Sleek Chat Room Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-slate-950/80 backdrop-blur-xl border border-white/10 shadow-lg shadow-black/40">
        {/* Left: Chat room status & active personas */}
        <div className="flex items-center flex-wrap gap-2.5">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
            </span>
            <span className="text-[11px] font-mono font-bold tracking-wide text-cyan-300">
              MULTI-AGENT CHANNEL
            </span>
          </div>

          <div className="h-4 w-px bg-white/10 hidden sm:block" />

          {/* Persona quick chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {Object.values(config.personas).map((persona) => (
              <div
                key={persona.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-all"
                style={{
                  background: persona.enabled ? `${persona.accentColor}15` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${persona.enabled ? persona.accentColor + '40' : 'rgba(255,255,255,0.08)'}`,
                  color: persona.enabled ? persona.accentColor : '#64748b',
                  opacity: persona.enabled ? 1 : 0.5,
                }}
                title={`${persona.name} (${persona.toneBadge})`}
              >
                <span>{persona.icon}</span>
                <span className="font-bold text-[12px]">{persona.name}</span>
                <span className="text-[10px] font-mono opacity-70 hidden md:inline">
                  {persona.toneBadge}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: View Mode Toggle & Utility Controls */}
        <div className="flex items-center gap-2 ml-auto">
          {/* View Mode Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-black/40 border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('unified')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
                viewMode === 'unified'
                  ? 'bg-cyan-500/20 text-cyan-300 shadow-sm border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Streamlined conversational card feed"
            >
              <Layers size={13} />
              <span className="hidden sm:inline">Stream</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('tabs')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
                viewMode === 'tabs'
                  ? 'bg-cyan-500/20 text-cyan-300 shadow-sm border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Filter by persona tabs"
            >
              <ListFilter size={13} />
              <span className="hidden sm:inline">Persona Tabs</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
                viewMode === 'grid'
                  ? 'bg-cyan-500/20 text-cyan-300 shadow-sm border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Compare side-by-side in multi-column grid"
            >
              <Columns size={13} />
              <span className="hidden sm:inline">Split</span>
            </button>
          </div>

          {/* Export & Clear */}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleExportTranscript}
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white transition-all text-xs font-medium flex items-center gap-1.5"
              title="Export complete conversation transcript"
            >
              <Share2 size={13} />
              <span className="hidden md:inline">Export</span>
            </button>
          )}

          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 hover:border-rose-400/60 text-rose-300 transition-all text-xs font-bold flex items-center gap-1.5 shadow-sm"
              title="Clear Multi Chat conversation history and reset memory"
            >
              <Trash2 size={13} className="text-rose-400" />
              <span className="hidden sm:inline">Clear Chat</span>
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500/30 text-[10px] font-mono">
                {messages.length}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onNavigateToSettings}
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-cyan-500/15 border border-cyan-500/30 hover:bg-cyan-500/25 text-cyan-300 transition-all text-xs font-semibold flex items-center gap-1.5"
            title="Configure persona prompts, models & temperatures"
          >
            <Sliders size={13} />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>

      {/* Main Chat Conversation Thread */}
      <div className="flex flex-col gap-6 flex-1 pb-4">
        {messages.length === 0 ? (
          /* Modern Empty Chat Welcome Screen */
          <div className="flex flex-col items-center justify-center text-center py-10 px-4 sm:px-8 rounded-3xl bg-gradient-to-b from-slate-900/60 via-slate-950/80 to-slate-950 border border-white/10 shadow-2xl backdrop-blur-xl">
            {/* Header Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-semibold mb-6">
              <Sparkles size={13} />
              PARALLEL INTELLIGENCE MESH
            </div>

            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-3">
              One Query. Three Distinct Minds.
            </h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto leading-relaxed mb-8">
              Experience the power of simultaneous multi-perspective reasoning. Every inquiry is answered in parallel by your personalized AI team.
            </p>

            {/* Persona Cards Showcase */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl mb-2">
              {Object.values(config.personas).map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl text-left transition-all border group hover:scale-[1.02]"
                  style={{
                    background: `linear-gradient(145deg, ${p.accentColor}08 0%, rgba(15, 23, 42, 0.7) 100%)`,
                    borderColor: `${p.accentColor}30`,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className="w-10 h-10 rounded-xl grid place-items-center text-xl shadow-md"
                      style={{
                        background: `${p.accentColor}20`,
                        border: `1px solid ${p.accentColor}40`,
                      }}
                    >
                      {p.icon}
                    </div>
                    <span
                      className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: `${p.accentColor}20`,
                        color: p.accentColor,
                      }}
                    >
                      {p.toneBadge}
                    </span>
                  </div>
                  <h3 className="font-bold text-white text-base mb-1">{p.name}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                    {p.id === 'nova'
                      ? 'Rigorous, factual, and analytical breakdowns with zero fluff.'
                      : p.id === 'orbit'
                      ? 'Engaging, witty, and casual explanations with great analogies.'
                      : 'Philosophical, calm, and balanced mentorship with holistic depth.'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const activeTab = selectedPersonaTab[msg.id] || 'all';

            return (
              <div key={msg.id} className="flex flex-col gap-4">
                {/* User Inquiry Chat Bubble (Right-aligned modern chat theme) */}
                <div className="flex items-start justify-end gap-3 pl-8">
                  <div className="flex flex-col items-end max-w-2xl">
                    <div className="flex items-center gap-2 mb-1.5 px-1">
                      <span className="text-[11px] font-mono text-slate-400">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-xs font-bold text-cyan-300 font-mono">YOU</span>
                    </div>

                    <div className="relative group p-4 rounded-3xl rounded-tr-md bg-gradient-to-br from-cyan-950/60 via-slate-900/90 to-slate-950 border border-cyan-500/35 text-white shadow-lg shadow-cyan-950/20">
                      <p className="text-sm sm:text-[15px] leading-relaxed font-normal whitespace-pre-wrap">
                        {msg.query}
                      </p>

                      {/* Quick copy user prompt */}
                      <button
                        type="button"
                        onClick={() => handleCopyQuery(msg.query, `q_${msg.id}`)}
                        className="absolute -left-8 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-black/50 border border-white/10 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all text-xs"
                        title="Copy prompt"
                      >
                        {copiedQueryId === `q_${msg.id}` ? (
                          <Check size={12} className="text-emerald-400" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* User Avatar */}
                  <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-teal-500/20 border border-cyan-400/40 grid place-items-center text-cyan-300 shadow-md shrink-0 mt-6">
                    <User size={18} />
                  </div>
                </div>

                {/* Assistant Multi-Persona Responses Container */}
                <div className="flex items-start gap-3 pr-2 sm:pr-8">
                  {/* Assistant Multi-Chat Cluster Avatar */}
                  <div className="w-9 h-9 rounded-2xl bg-slate-900 border border-white/15 grid place-items-center shadow-lg shrink-0 mt-2 text-base">
                    🤖
                  </div>

                  <div className="flex-1 flex flex-col gap-3 min-w-0">
                    {/* Persona Selector Tabs (Active when viewMode === 'tabs') */}
                    {viewMode === 'tabs' && (
                      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-white/10 w-fit">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedPersonaTab((prev) => ({ ...prev, [msg.id]: 'all' }))
                          }
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                            activeTab === 'all'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          All ({msg.responses.length})
                        </button>
                        {msg.responses.map((resp) => (
                          <button
                            key={resp.personaId}
                            type="button"
                            onClick={() =>
                              setSelectedPersonaTab((prev) => ({ ...prev, [msg.id]: resp.personaId }))
                            }
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                              activeTab === resp.personaId
                                ? 'bg-white/15 text-white border border-white/20'
                                : 'text-slate-400 hover:text-white'
                            }`}
                            style={{
                              color: activeTab === resp.personaId ? resp.accentColor : undefined,
                            }}
                          >
                            <span>{resp.icon}</span>
                            <span>{resp.name}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* View Layout 1: UNIFIED & TABS STREAM */}
                    {viewMode !== 'grid' && (
                      <div className="rounded-3xl rounded-tl-md bg-gradient-to-b from-slate-900/90 via-slate-950/95 to-slate-950 border border-white/12 shadow-2xl shadow-black/50 overflow-hidden flex flex-col divide-y divide-white/8">
                        {/* Master Universal Toolbar for Combined Card */}
                        <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-gradient-to-r from-slate-950 via-slate-900/90 to-slate-950 border-b border-white/10 flex-wrap gap-2.5">
                          {/* Left: Combined Label */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold shadow-sm">
                              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                              <span>COMBINED INTELLIGENCE</span>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                              NOVA • ORBIT • COSMOS
                            </span>
                          </div>

                          {/* Right: Universal Action Buttons */}
                          <div className="flex items-center gap-2 flex-wrap ml-auto">
                            {/* Universal Listen to All Button */}
                            <button
                              type="button"
                              onClick={() => handleListenToAll(msg)}
                              disabled={
                                isGenerating ||
                                msg.responses.filter(
                                  (r) => r.status === 'completed' && (r.text || (r as { reasoning?: string }).reasoning)
                                ).length === 0
                              }
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border shadow-sm ${
                                playingAudioKey === `all_${msg.id}`
                                  ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/60 shadow-cyan-500/25'
                                  : edgeTtsLoadingId === `all_${msg.id}`
                                  ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500/30 cursor-wait'
                                  : 'bg-slate-900/90 hover:bg-cyan-950/40 text-slate-200 hover:text-cyan-300 border-white/10 hover:border-cyan-500/40'
                              }`}
                              title={
                                playingAudioKey === `all_${msg.id}`
                                  ? 'Stop playback'
                                  : 'Play all 3 persona responses back-to-back using Edge TTS'
                              }
                            >
                              {edgeTtsLoadingId === `all_${msg.id}` ? (
                                <>
                                  <Loader2 size={13} className="animate-spin text-cyan-400" />
                                  <span className="text-[11px] font-mono">Synthesizing...</span>
                                </>
                              ) : playingAudioKey === `all_${msg.id}` ? (
                                <>
                                  <VolumeX size={13} className="text-cyan-400 animate-pulse" />
                                  <span className="flex items-end gap-0.5 h-3">
                                    <span className="w-0.5 h-3 bg-cyan-400 animate-pulse rounded-full" />
                                    <span className="w-0.5 h-2 bg-cyan-400 animate-pulse rounded-full" style={{ animationDelay: '100ms' }} />
                                    <span className="w-0.5 h-3 bg-cyan-400 animate-pulse rounded-full" style={{ animationDelay: '200ms' }} />
                                  </span>
                                  <span className="text-[11px] font-mono">Stop All</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 size={13} className="text-cyan-400" />
                                  <span>Listen to All</span>
                                </>
                              )}
                            </button>

                            {/* Universal Download All as MP3 */}
                            <button
                              type="button"
                              onClick={() => handleDownloadAllAudio(msg)}
                              disabled={
                                downloadingAudioId === `all_dl_${msg.id}` ||
                                msg.responses.filter(
                                  (r) => r.status === 'completed' && (r.text || (r as { reasoning?: string }).reasoning)
                                ).length === 0
                              }
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border shadow-sm ${
                                downloadSuccessId === `all_dl_${msg.id}`
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : downloadingAudioId === `all_dl_${msg.id}`
                                  ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500/30 cursor-wait'
                                  : 'bg-slate-900/90 hover:bg-emerald-950/40 text-slate-200 hover:text-emerald-300 border-white/10 hover:border-emerald-500/40'
                              }`}
                              title="Download all 3 persona responses stitched into one complete MP3 file (Edge TTS)"
                            >
                              {downloadingAudioId === `all_dl_${msg.id}` ? (
                                <>
                                  <Loader2 size={13} className="animate-spin text-cyan-400" />
                                  <span className="text-[11px] font-mono">Stitching MP3...</span>
                                </>
                              ) : downloadSuccessId === `all_dl_${msg.id}` ? (
                                <>
                                  <Check size={13} className="text-emerald-400" />
                                  <span className="text-[11px] font-mono text-emerald-300">Downloaded</span>
                                </>
                              ) : (
                                <>
                                  <Download size={13} className="text-emerald-400" />
                                  <span>Download All as MP3</span>
                                </>
                              )}
                            </button>

                            {/* Universal Copy Button */}
                            <button
                              type="button"
                              onClick={() => handleCopyCombined(msg)}
                              disabled={
                                msg.responses.filter(
                                  (r) => r.status === 'completed' && (r.text || (r as { reasoning?: string }).reasoning)
                                ).length === 0
                              }
                              className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-slate-900/90 hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 hover:border-white/25 transition-all shadow-sm"
                              title="Copy all 3 persona responses as one formatted text block (=== NOVA ===, etc.)"
                            >
                              {copiedCombinedId === msg.id ? (
                                <>
                                  <Check size={13} className="text-emerald-400" />
                                  <span className="text-[11px] font-mono text-emerald-300">Copied All</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={13} className="text-slate-300" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {msg.responses
                          .filter((resp) => activeTab === 'all' || activeTab === resp.personaId)
                          .map((resp) => {
                            const personaKey = `${msg.id}_${resp.personaId}`;
                            const isPlayingThis = playingAudioKey === personaKey;
                            const isCopied = copiedId === personaKey;
                            const displayText = resp.text || (resp as { reasoning?: string }).reasoning || '';

                            return (
                              <div
                                key={resp.personaId}
                                className="flex flex-col transition-colors hover:bg-white/[0.01]"
                              >
                                {/* Persona Chat Header Bar */}
                                <div
                                  className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/5"
                                  style={{ background: `${resp.accentColor}08` }}
                                >
                                  {/* Left: Avatar + Identity */}
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                      className="w-8 h-8 rounded-xl grid place-items-center text-lg shrink-0 shadow-sm"
                                      style={{
                                        background: `${resp.accentColor}20`,
                                        border: `1px solid ${resp.accentColor}45`,
                                      }}
                                    >
                                      {resp.icon}
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                                      <span
                                        className="font-bold text-sm tracking-tight"
                                        style={{ color: resp.accentColor }}
                                      >
                                        {resp.name}
                                      </span>

                                      {resp.toneBadge && (
                                        <span
                                          className="text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold"
                                          style={{
                                            background: `${resp.accentColor}18`,
                                            color: resp.accentColor,
                                            border: `1px solid ${resp.accentColor}35`,
                                          }}
                                        >
                                          {resp.toneBadge}
                                        </span>
                                      )}

                                      {resp.durationMs && resp.status === 'completed' && (
                                        <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                                          <Clock size={10} />
                                          {(resp.durationMs / 1000).toFixed(1)}s
                                        </span>
                                      )}

                                      {resp.modelName && (
                                        <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1 hidden sm:flex">
                                          <Cpu size={10} />
                                          {resp.modelName.split('/').pop()}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Right: Audio TTS & Copy Controls */}
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {resp.status === 'completed' && displayText && (
                                      <>
                                        {/* Individual Listen Button */}
                                        <button
                                          type="button"
                                          onClick={() => handleToggleAudio(displayText, personaKey, resp.personaId)}
                                          className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border ${
                                            isPlayingThis
                                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                                              : edgeTtsLoadingId === personaKey
                                              ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500/30 cursor-wait'
                                              : 'bg-black/30 text-slate-400 hover:text-white border-white/10 hover:border-white/20'
                                          }`}
                                          title={isPlayingThis ? 'Stop voice readout' : 'Listen with Edge TTS voice'}
                                        >
                                          {edgeTtsLoadingId === personaKey ? (
                                            <Loader2 size={13} className="animate-spin text-cyan-400" />
                                          ) : isPlayingThis ? (
                                            <>
                                              <VolumeX size={13} className="text-cyan-400 animate-pulse" />
                                              <span className="flex items-end gap-0.5 h-3">
                                                <span className="w-0.5 h-3 bg-cyan-400 animate-pulse rounded-full" />
                                                <span className="w-0.5 h-2 bg-cyan-400 animate-pulse rounded-full" style={{ animationDelay: '100ms' }} />
                                                <span className="w-0.5 h-3 bg-cyan-400 animate-pulse rounded-full" style={{ animationDelay: '200ms' }} />
                                              </span>
                                              <span className="text-[11px] font-mono hidden sm:inline">Playing</span>
                                            </>
                                          ) : (
                                            <>
                                              <Volume2 size={13} />
                                              <span className="text-[11px] font-mono hidden sm:inline">Listen</span>
                                            </>
                                          )}
                                        </button>

                                        {/* Individual MP3 Download Button */}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleDownloadPersonaAudio(
                                              displayText,
                                              personaKey,
                                              resp.name,
                                              resp.personaId,
                                              msg.query
                                            )
                                          }
                                          disabled={downloadingAudioId === personaKey}
                                          className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all border ${
                                            downloadSuccessId === personaKey
                                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                              : downloadingAudioId === personaKey
                                              ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500/30 cursor-wait'
                                              : 'bg-black/30 text-slate-400 hover:text-emerald-300 border-white/10 hover:border-emerald-500/30'
                                          }`}
                                          title="Download persona response as MP3 (Edge TTS)"
                                        >
                                          {downloadingAudioId === personaKey ? (
                                            <Loader2 size={13} className="animate-spin text-cyan-400" />
                                          ) : downloadSuccessId === personaKey ? (
                                            <>
                                              <Check size={13} className="text-emerald-400" />
                                              <span className="text-[11px] font-mono text-emerald-300 hidden sm:inline">Saved</span>
                                            </>
                                          ) : (
                                            <>
                                              <Download size={13} />
                                              <span className="text-[11px] font-mono hidden sm:inline">MP3</span>
                                            </>
                                          )}
                                        </button>

                                        {/* Individual Copy Button */}
                                        <button
                                          type="button"
                                          onClick={() => handleCopyText(displayText, personaKey)}
                                          className="px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 bg-black/30 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 hover:border-white/20 transition-all"
                                          title="Copy response"
                                        >
                                          {isCopied ? (
                                            <>
                                              <Check size={13} className="text-emerald-400" />
                                              <span className="text-[11px] font-mono text-emerald-400">Copied</span>
                                            </>
                                          ) : (
                                            <>
                                              <Copy size={13} />
                                              <span className="text-[11px] font-mono hidden sm:inline">Copy</span>
                                            </>
                                          )}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Persona Answer Body */}
                                <div className="p-4 sm:p-6 flex flex-col">
                                  {resp.status === 'running' && (
                                    <div className="flex items-center gap-3 py-3" style={{ color: resp.accentColor }}>
                                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                                        <span
                                          className="w-2 h-2 rounded-full animate-bounce"
                                          style={{ backgroundColor: resp.accentColor, animationDelay: '0ms' }}
                                        />
                                        <span
                                          className="w-2 h-2 rounded-full animate-bounce"
                                          style={{ backgroundColor: resp.accentColor, animationDelay: '150ms' }}
                                        />
                                        <span
                                          className="w-2 h-2 rounded-full animate-bounce"
                                          style={{ backgroundColor: resp.accentColor, animationDelay: '300ms' }}
                                        />
                                        <span className="ml-2 text-xs font-mono font-medium">
                                          {resp.name} is thinking...
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  {resp.status === 'failed' && (
                                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-mono">
                                      <AlertCircle size={15} className="shrink-0" />
                                      <span>{resp.error || 'Failed to generate response'}</span>
                                    </div>
                                  )}

                                  {resp.status === 'completed' && displayText && (
                                    <div className="prose prose-invert max-w-none text-slate-100 text-[14.5px] leading-relaxed">
                                      <FormattedText content={displayText} />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {/* View Layout 2: SPLIT GRID COMPARISON */}
                    {viewMode === 'grid' && (
                      <div className="flex flex-col gap-3 w-full">
                        {/* Master Universal Toolbar for Grid View */}
                        <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900/90 to-slate-950 border border-white/10 flex-wrap gap-2.5 shadow-lg">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold">
                              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                              <span>COMBINED INTELLIGENCE</span>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                              NOVA • ORBIT • COSMOS
                            </span>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap ml-auto">
                            {/* Universal Listen to All */}
                            <button
                              type="button"
                              onClick={() => handleListenToAll(msg)}
                              disabled={
                                isGenerating ||
                                msg.responses.filter(
                                  (r) => r.status === 'completed' && (r.text || (r as { reasoning?: string }).reasoning)
                                ).length === 0
                              }
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border shadow-sm ${
                                playingAudioKey === `all_${msg.id}`
                                  ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/60 shadow-cyan-500/25'
                                  : edgeTtsLoadingId === `all_${msg.id}`
                                  ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500/30 cursor-wait'
                                  : 'bg-slate-900/90 hover:bg-cyan-950/40 text-slate-200 hover:text-cyan-300 border-white/10 hover:border-cyan-500/40'
                              }`}
                              title="Play all 3 persona responses back-to-back using Edge TTS"
                            >
                              {edgeTtsLoadingId === `all_${msg.id}` ? (
                                <>
                                  <Loader2 size={13} className="animate-spin text-cyan-400" />
                                  <span className="text-[11px] font-mono">Synthesizing...</span>
                                </>
                              ) : playingAudioKey === `all_${msg.id}` ? (
                                <>
                                  <VolumeX size={13} className="text-cyan-400 animate-pulse" />
                                  <span className="text-[11px] font-mono">Stop All</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 size={13} className="text-cyan-400" />
                                  <span>Listen to All</span>
                                </>
                              )}
                            </button>

                            {/* Universal Download All as MP3 */}
                            <button
                              type="button"
                              onClick={() => handleDownloadAllAudio(msg)}
                              disabled={
                                downloadingAudioId === `all_dl_${msg.id}` ||
                                msg.responses.filter(
                                  (r) => r.status === 'completed' && (r.text || (r as { reasoning?: string }).reasoning)
                                ).length === 0
                              }
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border shadow-sm ${
                                downloadSuccessId === `all_dl_${msg.id}`
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : downloadingAudioId === `all_dl_${msg.id}`
                                  ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500/30 cursor-wait'
                                  : 'bg-slate-900/90 hover:bg-emerald-950/40 text-slate-200 hover:text-emerald-300 border-white/10 hover:border-emerald-500/40'
                              }`}
                              title="Download all 3 persona responses stitched into one complete MP3 file (Edge TTS)"
                            >
                              {downloadingAudioId === `all_dl_${msg.id}` ? (
                                <>
                                  <Loader2 size={13} className="animate-spin text-cyan-400" />
                                  <span className="text-[11px] font-mono">Stitching...</span>
                                </>
                              ) : downloadSuccessId === `all_dl_${msg.id}` ? (
                                <>
                                  <Check size={13} className="text-emerald-400" />
                                  <span className="text-[11px] font-mono text-emerald-300">Downloaded</span>
                                </>
                              ) : (
                                <>
                                  <Download size={13} className="text-emerald-400" />
                                  <span>Download All as MP3</span>
                                </>
                              )}
                            </button>

                            {/* Universal Copy Button */}
                            <button
                              type="button"
                              onClick={() => handleCopyCombined(msg)}
                              disabled={
                                msg.responses.filter(
                                  (r) => r.status === 'completed' && (r.text || (r as { reasoning?: string }).reasoning)
                                ).length === 0
                              }
                              className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-slate-900/90 hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 hover:border-white/25 transition-all shadow-sm"
                              title="Copy all 3 persona responses as formatted text block (=== NOVA ===, etc.)"
                            >
                              {copiedCombinedId === msg.id ? (
                                <>
                                  <Check size={13} className="text-emerald-400" />
                                  <span className="text-[11px] font-mono text-emerald-300">Copied All</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={13} className="text-slate-300" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                          {msg.responses.map((resp) => {
                            const personaKey = `${msg.id}_${resp.personaId}`;
                            const isPlayingThis = playingAudioKey === personaKey;
                            const isCopied = copiedId === personaKey;
                            const displayText = resp.text || (resp as { reasoning?: string }).reasoning || '';

                            return (
                              <div
                                key={resp.personaId}
                                className="flex flex-col rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950 border overflow-hidden shadow-lg"
                                style={{ borderColor: `${resp.accentColor}35` }}
                              >
                                {/* Persona Mini Header */}
                                <div
                                  className="p-3 border-b border-white/5 flex items-center justify-between"
                                  style={{ background: `${resp.accentColor}10` }}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-base">{resp.icon}</span>
                                    <div>
                                      <h4 className="text-xs font-bold leading-tight" style={{ color: resp.accentColor }}>
                                        {resp.name}
                                      </h4>
                                      <span className="text-[10px] font-mono text-slate-400">
                                        {resp.toneBadge}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    {resp.status === 'completed' && displayText && (
                                      <>
                                        {/* Individual Listen Button */}
                                        <button
                                          type="button"
                                          onClick={() => handleToggleAudio(displayText, personaKey, resp.personaId)}
                                          className={`p-1.5 rounded transition-colors ${
                                            isPlayingThis
                                              ? 'bg-cyan-500/20 text-cyan-300'
                                              : edgeTtsLoadingId === personaKey
                                              ? 'bg-cyan-950/40 text-cyan-300 cursor-wait'
                                              : 'bg-black/40 text-slate-400 hover:text-white'
                                          }`}
                                          title={isPlayingThis ? 'Stop voice readout' : 'Listen with Edge TTS'}
                                        >
                                          {edgeTtsLoadingId === personaKey ? (
                                            <Loader2 size={12} className="animate-spin text-cyan-400" />
                                          ) : isPlayingThis ? (
                                            <VolumeX size={12} className="animate-pulse text-cyan-400" />
                                          ) : (
                                            <Volume2 size={12} />
                                          )}
                                        </button>

                                        {/* Individual MP3 Download Button */}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleDownloadPersonaAudio(
                                              displayText,
                                              personaKey,
                                              resp.name,
                                              resp.personaId,
                                              msg.query
                                            )
                                          }
                                          disabled={downloadingAudioId === personaKey}
                                          className={`p-1.5 rounded transition-colors ${
                                            downloadSuccessId === personaKey
                                              ? 'bg-emerald-500/20 text-emerald-300'
                                              : downloadingAudioId === personaKey
                                              ? 'bg-cyan-950/40 text-cyan-300 cursor-wait'
                                              : 'bg-black/40 text-slate-400 hover:text-emerald-300'
                                          }`}
                                          title="Download persona MP3 audio (Edge TTS)"
                                        >
                                          {downloadingAudioId === personaKey ? (
                                            <Loader2 size={12} className="animate-spin text-cyan-400" />
                                          ) : downloadSuccessId === personaKey ? (
                                            <Check size={12} className="text-emerald-400" />
                                          ) : (
                                            <Download size={12} />
                                          )}
                                        </button>

                                        {/* Individual Copy Button */}
                                        <button
                                          type="button"
                                          onClick={() => handleCopyText(displayText, personaKey)}
                                          className="p-1.5 rounded bg-black/40 text-slate-400 hover:text-white"
                                          title="Copy"
                                        >
                                          {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>

                              {/* Persona Mini Body */}
                              <div className="p-3.5 flex-1 flex flex-col text-xs">
                                {resp.status === 'running' && (
                                  <div className="py-6 flex flex-col items-center justify-center gap-2" style={{ color: resp.accentColor }}>
                                    <Loader2 size={18} className="animate-spin" />
                                    <span className="font-mono text-[11px]">{resp.name} is computing...</span>
                                  </div>
                                )}

                                {resp.status === 'failed' && (
                                  <div className="p-2 rounded bg-rose-500/10 text-rose-300 text-[11px] font-mono">
                                    {resp.error || 'Failed'}
                                  </div>
                                )}

                                {resp.status === 'completed' && displayText && (
                                  <div className="prose prose-invert prose-xs max-w-none text-slate-200 text-xs leading-relaxed">
                                    <FormattedText content={displayText} />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Interactive Chat Theme Input Dock */}
      <div className="sticky bottom-4 z-30 flex flex-col gap-2">
        {/* Quick Prompts Floating Drawer */}
        {showQuickPrompts && (
          <div className="p-3 rounded-2xl bg-slate-950/95 backdrop-blur-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-950/40 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2.5">
              <span className="text-xs font-mono font-bold text-cyan-300 flex items-center gap-1.5">
                <Sparkles size={13} /> CONVERSATION CATALYSTS
              </span>
              <button
                type="button"
                onClick={() => setShowQuickPrompts(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PROMPT_CATEGORIES.flatMap((c) => c.prompts).map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setInputText(prompt);
                    setShowQuickPrompts(false);
                    inputRef.current?.focus();
                  }}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-cyan-500/15 border border-white/8 hover:border-cyan-500/30 text-slate-300 text-xs text-left transition-all leading-snug font-normal truncate"
                >
                  "{prompt}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cleared Success Notification Banner */}
        {clearedBanner && (
          <div className="mb-3 px-4 py-2.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
              <span>Multi Chat history cleared and memory reset successfully.</span>
            </div>
            <button
              type="button"
              onClick={() => setClearedBanner(false)}
              className="text-emerald-400 hover:text-emerald-200 p-1"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Upgraded Cybernetic Search Input Dock */}
        <div className="relative p-[1.5px] rounded-3xl bg-gradient-to-r from-cyan-500/50 via-teal-400/40 to-indigo-500/50 shadow-[0_16px_50px_rgba(0,0,0,0.85),0_0_30px_rgba(6,182,212,0.15)] focus-within:shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_45px_rgba(6,182,212,0.3)] transition-all duration-300">
          {/* Inner Card */}
          <div className="rounded-[22px] bg-gradient-to-b from-slate-950/95 via-slate-950/98 to-black/95 backdrop-blur-3xl p-3 sm:p-4 flex flex-col gap-2.5 relative overflow-hidden">
            {/* Cyber Reticle Markers in 4 Corners */}
            <div className="absolute top-2 left-2.5 w-2 h-2 border-t-2 border-l-2 border-cyan-400/50 pointer-events-none rounded-tl-sm" />
            <div className="absolute top-2 right-2.5 w-2 h-2 border-t-2 border-r-2 border-cyan-400/50 pointer-events-none rounded-tr-sm" />
            <div className="absolute bottom-2 left-2.5 w-2 h-2 border-b-2 border-l-2 border-cyan-400/50 pointer-events-none rounded-bl-sm" />
            <div className="absolute bottom-2 right-2.5 w-2 h-2 border-b-2 border-r-2 border-cyan-400/50 pointer-events-none rounded-br-sm" />

            {/* Ambient Background Aura */}
            <div className="absolute -top-10 -right-10 w-44 h-44 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Top Row: Search Mode Badge + Active Persona Targets + Telemetry */}
            <div className="relative z-10 flex items-center justify-between gap-2 px-1 flex-wrap">
              {/* Left: Search Mode Badge */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 shadow-sm shadow-cyan-950/30">
                  <Search size={12} className="text-cyan-400 animate-pulse" />
                  <span className="text-[11px] font-mono font-bold tracking-wider uppercase">
                    MULTI SEARCH
                  </span>
                  <span className="inline-flex items-center gap-1 text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    LIVE MESH
                  </span>
                </div>

                {/* Target Persona Indicators */}
                <div className="flex items-center gap-1.5 flex-wrap hidden md:flex">
                  <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">
                    Targets:
                  </span>
                  {enabledPersonas.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all shadow-sm"
                      style={{
                        background: `${p.accentColor}18`,
                        color: p.accentColor,
                        border: `1px solid ${p.accentColor}35`,
                      }}
                    >
                      <span className="text-xs">{p.icon}</span>
                      <span>{p.name}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Right: Telemetry & Prompts Trigger */}
              <div className="flex items-center gap-2">
                {charCount > 0 && (
                  <span className="text-[10.5px] font-mono text-cyan-300/90 px-2.5 py-0.5 rounded-lg bg-cyan-950/40 border border-cyan-500/25 shadow-sm">
                    {charCount} chars • {wordCount} words
                  </span>
                )}

                {/* Clear Chat Button in Dock */}
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowClearModal(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:border-rose-400/50 transition-all shadow-sm"
                    title="Clear Multi Chat conversation history and reset memory"
                  >
                    <Trash2 size={12} className="text-rose-400" />
                    <span className="hidden sm:inline">Clear</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-500/30 text-[10px] font-mono">
                      {messages.length}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowQuickPrompts(!showQuickPrompts)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all shadow-sm ${
                    showQuickPrompts
                      ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50 shadow-cyan-500/20'
                      : 'bg-white/5 text-slate-300 hover:text-cyan-300 hover:bg-cyan-950/30 border border-white/10 hover:border-cyan-500/30'
                  }`}
                >
                  <Sparkles size={12} className="text-cyan-400" />
                  <span>Prompts</span>
                </button>
              </div>
            </div>

            {/* Core Search Textarea Recessed Box */}
            <div className="relative z-10 flex items-start bg-slate-900/80 hover:bg-slate-900/95 border border-white/10 focus-within:border-cyan-400/60 focus-within:bg-slate-900 focus-within:ring-2 focus-within:ring-cyan-500/20 rounded-2xl p-2.5 sm:p-3 gap-3 transition-all duration-200 shadow-inner group">
              {/* Futuristic Search Lens Icon */}
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/25 grid place-items-center text-cyan-400 shrink-0 mt-0.5 group-focus-within:bg-cyan-500/20 group-focus-within:border-cyan-400/50 group-focus-within:shadow-[0_0_12px_rgba(6,182,212,0.35)] transition-all">
                <Search size={15} />
              </div>

              {/* Textarea */}
              <div className="relative flex-1 min-w-0">
                <textarea
                  ref={inputRef}
                  rows={2}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search or broadcast query to NOVA, ORBIT & COSMOS... (Shift + Enter for newline)"
                  disabled={isGenerating}
                  className="w-full bg-transparent text-white placeholder-slate-500 text-sm sm:text-[14.5px] focus:outline-none resize-none leading-relaxed transition-all min-h-[50px] pr-8 font-sans"
                />
                {inputText && (
                  <button
                    type="button"
                    onClick={() => setInputText('')}
                    className="absolute right-0 top-1 p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                    title="Clear input"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Send / Broadcast Button */}
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={isGenerating || !inputText.trim()}
                className={`h-[48px] px-4 sm:px-5 rounded-xl flex items-center justify-center gap-2 font-black text-xs sm:text-sm tracking-wider uppercase transition-all shrink-0 ${
                  isGenerating || !inputText.trim()
                    ? 'bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 hover:from-cyan-300 hover:to-teal-200 text-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.45)] hover:shadow-[0_0_32px_rgba(6,182,212,0.65)] active:scale-95 cursor-pointer font-extrabold'
                }`}
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-cyan-400" />
                    <span className="hidden sm:inline font-mono text-xs">Scanning...</span>
                  </>
                ) : (
                  <>
                    <Radio size={14} className="text-slate-950 hidden sm:inline animate-pulse" />
                    <span>Broadcast</span>
                    <Send size={14} className="text-slate-950" />
                  </>
                )}
              </button>
            </div>

            {/* Quick Query Modifiers Toolbar & Command Help */}
            <div className="relative z-10 flex items-center justify-between gap-2 pt-0.5 px-1 flex-wrap text-xs">
              {/* Query Modifier Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">
                  Filters:
                </span>
                <button
                  type="button"
                  onClick={() => applyQueryModifier('[Deep Analysis]:')}
                  className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-cyan-500/15 border border-white/10 hover:border-cyan-500/35 text-[11px] font-medium text-slate-300 hover:text-cyan-300 transition-all flex items-center gap-1"
                  title="Prefix query with deep analysis request"
                >
                  <span>🔬</span>
                  <span>Deep Analysis</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyQueryModifier('[Fast Summary]:')}
                  className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-teal-500/15 border border-white/10 hover:border-teal-500/35 text-[11px] font-medium text-slate-300 hover:text-teal-300 transition-all flex items-center gap-1"
                  title="Prefix query with fast summary request"
                >
                  <span>⚡</span>
                  <span>Fast Summary</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyQueryModifier('[Compare & Contrast]:')}
                  className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-indigo-500/15 border border-white/10 hover:border-indigo-500/35 text-[11px] font-medium text-slate-300 hover:text-indigo-300 transition-all flex items-center gap-1 hidden sm:flex"
                  title="Prefix query with compare & contrast request"
                >
                  <span>⚖️</span>
                  <span>Compare</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyQueryModifier('[Brainstorm]:')}
                  className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-amber-500/15 border border-white/10 hover:border-amber-500/35 text-[11px] font-medium text-slate-300 hover:text-amber-300 transition-all flex items-center gap-1 hidden md:flex"
                  title="Prefix query with brainstorm request"
                >
                  <span>💡</span>
                  <span>Brainstorm</span>
                </button>
              </div>

              {/* Shortcut Command Hints */}
              <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-slate-500 ml-auto">
                <span className="hidden sm:inline flex items-center gap-1">
                  <CornerDownLeft size={11} className="text-cyan-400" />
                  <span>Enter to broadcast</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Clear Chat Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="max-w-md w-full bg-slate-950 rounded-2xl border border-rose-500/30 p-6 shadow-2xl shadow-rose-950/40">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 grid place-items-center shrink-0">
                <AlertTriangle size={20} className="text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white m-0">Clear Multi Chat History?</h3>
                <span className="text-xs text-rose-400/80 font-mono">
                  {messages.length} message {messages.length === 1 ? 'turn' : 'turns'} will be deleted
                </span>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
              This will permanently remove all multi-persona conversation turns, inquiries, active audio sessions, and generated responses. Active agent memory context will be completely refreshed.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearHistory}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-lg shadow-rose-500/25 transition-all flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                <span>Yes, Clear Chat</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
