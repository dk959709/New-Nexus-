import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Send,
  Trash2,
  Plus,
  Brain,
  BookOpen,
  Globe,
  Image as ImageIcon,
  Sparkles,
  Download,
  Maximize2,
  ExternalLink,
  Cpu,
  AlertTriangle,
  Check,
  Volume2,
  VolumeX,
  Radio,
  Loader2,
  Copy,
  Search,
  ChevronDown,
  ChevronUp,
  Settings as SettingsIcon,
  Edit3,
  X,
  Bookmark,
  Languages,
  RotateCcw,
  Palette,
  MessagesSquare,
  Bot,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/services/api';
import { storage } from '@/lib/storage';
import { copyToClipboard } from '@/lib/clipboard';
import { ErrorMessage } from '@/components';
import { generateStudioImage } from '@/services/imageGenerationService';
import { executeMultiChatTurn } from '@/services/multiChatOrchestrator';
import type { AISource, MultiChatPersonaResponse, MultiChatMessage } from '@/types';

export interface AssistantGeneratedImage {
  url: string;
  imageData?: string;
  providerName: string;
  model?: string;
  width: number;
  height: number;
  seed: number;
  prompt: string;
}

type Message = {
  role: 'user' | 'assistant';
  content: string;
  tool?: 'none' | 'search' | 'weather' | 'image' | 'multichat';
  sources?: AISource[];
  weather?: unknown;
  searchedWeb?: boolean;
  image?: AssistantGeneratedImage;
  multiChatResponses?: MultiChatPersonaResponse[];
};

const CHAT_KEY = 'nexus-ai-conversation-v2';
const MEMORY_KEY = 'nexus-ai-smart-memory-v1';
const WEB_SEARCH_PREF_KEY = 'nexus-ai-web-search-toggle';
const IMAGE_GEN_PREF_KEY = 'nexus-ai-image-gen-toggle';

const RECENT_MESSAGES = 8;
const MAX_MEMORY_LENGTH = 1200;

const QUICK_PROMPTS = [
  'Explain quantum computing simply',
  'Help me optimize my daily productivity',
  'Summarize the latest trends in artificial intelligence',
  'Write a clean TypeScript utility function',
];

const QUICK_IMAGE_PROMPTS = [
  'Cyberpunk city in neon rain, 8k octane render',
  'Futuristic glass greenhouse on Mars at twilight',
  'Astronaut floating above a prismatic cosmic nebula',
  'Minimalist architectural villa on a misty Nordic fjord',
];

const welcomeMessage: Message = {
  role: 'assistant',
  content:
    "Hello. I'm NEXUS AI. How can I assist you today?",
};

function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    if (!raw) return [welcomeMessage];

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) return [welcomeMessage];

    const messages = parsed.filter(
      (item): item is Message =>
        typeof item === 'object' &&
        item !== null &&
        'role' in item &&
        'content' in item &&
        ((item as { role?: unknown }).role === 'user' ||
          (item as { role?: unknown }).role === 'assistant') &&
        typeof (item as { content?: unknown }).content === 'string',
    );

    return messages.length ? messages : [welcomeMessage];
  } catch {
    return [welcomeMessage];
  }
}

function loadSmartMemory(): string {
  try {
    return localStorage.getItem(MEMORY_KEY) ?? '';
  } catch {
    return '';
  }
}

function loadWebSearchToggle(): boolean {
  try {
    return localStorage.getItem(WEB_SEARCH_PREF_KEY) === 'true';
  } catch {
    return false;
  }
}

function loadImageGenToggle(): boolean {
  try {
    return localStorage.getItem(IMAGE_GEN_PREF_KEY) === 'true';
  } catch {
    return false;
  }
}

function buildLocalMemory(messages: Message[]): string {
  const useful = messages
    .filter((message) => message.content.trim())
    .slice(-12);

  if (!useful.length) return '';

  const text = useful
    .map((message) => {
      const speaker = message.role === 'user' ? 'User' : 'NEXUS';
      return `${speaker}: ${message.content}`;
    })
    .join('\n');

  return text.slice(-MAX_MEMORY_LENGTH);
}

export function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [smartMemory, setSmartMemory] = useState(loadSmartMemory);
  const [webSearchEnabled, setWebSearchEnabled] = useState(loadWebSearchToggle);
  const [imageGenEnabled, setImageGenEnabled] = useState(loadImageGenToggle);
  const [imageLoadingPhase, setImageLoadingPhase] = useState<string>('');
  const [fullscreenModalImage, setFullscreenModalImage] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [memoryEditorOpen, setMemoryEditorOpen] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState(smartMemory);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearedToast, setClearedToast] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [edgeTtsLoadingIndex, setEdgeTtsLoadingIndex] = useState<number | null>(null);
  const [edgeTtsPlayingIndex, setEdgeTtsPlayingIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [expandedSources, setExpandedSources] = useState<Record<number, boolean>>({});

  // Assistant Settings Panel state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [responseLanguage, setResponseLanguage] = useState<string>(() => storage.getAssistantLanguage());
  const [theme, setTheme] = useState<'minimal' | 'classic' | 'fulldark'>(() => storage.getAssistantTheme());
  const [permanentMemories, setPermanentMemories] = useState<string[]>(() => storage.getPermanentMemories());
  const [multiChatEnabled, setMultiChatEnabled] = useState<boolean>(() => storage.getAssistantMultiChatEnabled());
  const [newMemoryInput, setNewMemoryInput] = useState('');
  const [editingMemoryIndex, setEditingMemoryIndex] = useState<number | null>(null);
  const [editingMemoryDraft, setEditingMemoryDraft] = useState('');
  const [settingsSavedToast, setSettingsSavedToast] = useState<string | null>(null);
  const [personaAudioPlayingKey, setPersonaAudioPlayingKey] = useState<string | null>(null);
  const [personaAudioLoadingKey, setPersonaAudioLoadingKey] = useState<string | null>(null);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const edgeTtsAudioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const triggerSettingsToast = (msg: string) => {
    setSettingsSavedToast(msg);
    setTimeout(() => setSettingsSavedToast(null), 3000);
  };

  const toggleMultiChat = () => {
    setMultiChatEnabled((prev) => {
      const next = !prev;
      storage.setAssistantMultiChatEnabled(next);
      triggerSettingsToast(
        next
          ? 'Multi Chat enabled: 3-Persona panel will process all messages'
          : 'Multi Chat disabled: standard single assistant active',
      );
      return next;
    });
  };

  const getPersonaVoice = (personaId?: string): string => {
    const globalVoice = storage.getEdgeVoice();
    if (personaId === 'nova') return 'en-US-JennyNeural';
    if (personaId === 'orbit') return 'en-US-GuyNeural';
    if (personaId === 'cosmos') return 'en-US-EricNeural';
    return globalVoice || 'en-US-AriaNeural';
  };

  const handlePlayPersonaAudio = async (text: string, idKey: string, personaId: string) => {
    if (personaAudioPlayingKey === idKey) {
      if (edgeTtsAudioRef.current) {
        edgeTtsAudioRef.current.pause();
        edgeTtsAudioRef.current = null;
      }
      setPersonaAudioPlayingKey(null);
      return;
    }

    if (edgeTtsAudioRef.current) {
      edgeTtsAudioRef.current.pause();
      edgeTtsAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingIndex(null);
    setEdgeTtsPlayingIndex(null);

    setPersonaAudioLoadingKey(idKey);
    try {
      const voice = getPersonaVoice(personaId);
      const cleanText = text.replace(/[*_#`~[\]()]/g, '').trim();
      const response = await fetch('/api/edge-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText.slice(0, 4000),
          voice,
        }),
      });

      if (!response.ok) {
        throw new Error(`Edge TTS failed: ${response.status}`);
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      edgeTtsAudioRef.current = audio;

      audio.onended = () => {
        setPersonaAudioPlayingKey(null);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setPersonaAudioPlayingKey(null);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
      setPersonaAudioPlayingKey(idKey);
    } catch (err) {
      console.error('Persona TTS failed:', err);
      setPersonaAudioPlayingKey(null);
    } finally {
      setPersonaAudioLoadingKey(null);
    }
  };

  const handleLanguageChange = (val: string) => {
    setResponseLanguage(val);
    storage.setAssistantLanguage(val);
  };

  const handleResetToEnglish = () => {
    setResponseLanguage('');
    storage.setAssistantLanguage('');
    triggerSettingsToast('Response language reset to English (Default)');
  };

  const handleThemeChange = (newTheme: 'minimal' | 'classic' | 'fulldark') => {
    setTheme(newTheme);
    storage.setAssistantTheme(newTheme);
    console.log(`[AI Assistant Theme Switch] Switched to "${newTheme}"`, {
      newTheme,
      persistedKey: 'nexus-ai-theme-preference',
      timestamp: new Date().toISOString(),
    });
    triggerSettingsToast(
      `Theme set to ${
        newTheme === 'classic'
          ? 'NEXUS Classic'
          : newTheme === 'fulldark'
          ? 'Full Dark'
          : 'NEXUS Minimal'
      }`,
    );
  };

  const toggleImageGen = () => {
    setImageGenEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(IMAGE_GEN_PREF_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const handleDownloadImage = async (imgItem: AssistantGeneratedImage) => {
    try {
      const sanitized =
        imgItem.prompt.slice(0, 32).replace(/[^a-zA-Z0-9_-]/g, '_') || 'generated_image';
      const fileName = `nexus_${sanitized}_${imgItem.seed}.jpg`;

      if (imgItem.url.startsWith('blob:') || imgItem.url.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = imgItem.url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const response = await fetch(imgItem.url, { mode: 'cors' });
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }
    } catch {
      const a = document.createElement('a');
      a.href = imgItem.url;
      a.target = '_blank';
      a.download = `nexus_image_${imgItem.seed}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  useEffect(() => {
    console.log(`[AI Assistant Theme Applied to DOM] Active Theme: "${theme}"`, {
      theme,
      appliedClass:
        theme === 'classic'
          ? 'theme-classic'
          : theme === 'fulldark'
          ? 'theme-fulldark'
          : 'theme-minimal',
      rootElementClass:
        theme === 'classic'
          ? 'bg-[#060b13]'
          : theme === 'fulldark'
          ? 'bg-black text-[#ececec]'
          : 'bg-[#18181b] text-[#e3e3e7]',
      timestamp: new Date().toISOString(),
    });
  }, [theme]);

  const handleAddPermanentMemory = () => {
    const trimmed = newMemoryInput.trim();
    if (!trimmed) return;
    const updated = storage.addPermanentMemory(trimmed);
    setPermanentMemories(updated);
    setNewMemoryInput('');
    triggerSettingsToast('Memory added to permanent context');
  };

  const handleDeletePermanentMemory = (index: number) => {
    const updated = storage.deletePermanentMemory(index);
    setPermanentMemories(updated);
    if (editingMemoryIndex === index) {
      setEditingMemoryIndex(null);
      setEditingMemoryDraft('');
    }
  };

  const handleStartEditPermanentMemory = (index: number) => {
    setEditingMemoryIndex(index);
    setEditingMemoryDraft(permanentMemories[index] || '');
  };

  const handleSaveEditPermanentMemory = (index: number) => {
    const trimmed = editingMemoryDraft.trim();
    if (!trimmed) {
      handleDeletePermanentMemory(index);
      return;
    }
    const updated = storage.updatePermanentMemory(index, trimmed);
    setPermanentMemories(updated);
    setEditingMemoryIndex(null);
    setEditingMemoryDraft('');
  };

  const handleCancelEditPermanentMemory = () => {
    setEditingMemoryIndex(null);
    setEditingMemoryDraft('');
  };

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages, loading, scrollToBottom]);

  const toggleWebSearch = () => {
    setWebSearchEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(WEB_SEARCH_PREF_KEY, String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const toggleSourceExpand = (index: number) => {
    setExpandedSources((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const stopSpeak = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Safe fallback
      }
    }
    utteranceRef.current = null;
    setSpeakingIndex(null);
  }, []);

  const toggleBrowserSpeak = useCallback(
    (text: string, index: number) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      if (speakingIndex === index) {
        stopSpeak();
        return;
      }
      try {
        window.speechSynthesis.cancel();
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch {
        // Safe fallback
      }
      const cleanText = text
        .replace(/```[\s\S]*?```/g, ' Code snippet omitted. ')
        .replace(/[*#`_~>[\]()]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utteranceRef.current = utterance;
      utterance.onend = () => {
        setSpeakingIndex(null);
        utteranceRef.current = null;
      };
      utterance.onerror = () => {
        setSpeakingIndex(null);
        utteranceRef.current = null;
      };
      setSpeakingIndex(index);
      window.speechSynthesis.speak(utterance);
    },
    [speakingIndex, stopSpeak],
  );

  const handleEdgeTtsSpeak = useCallback(
    async (text: string, index: number) => {
      if (edgeTtsPlayingIndex === index) {
        if (edgeTtsAudioRef.current) {
          edgeTtsAudioRef.current.pause();
          edgeTtsAudioRef.current.currentTime = 0;
        }
        setEdgeTtsPlayingIndex(null);
        return;
      }

      stopSpeak();
      if (edgeTtsAudioRef.current) {
        edgeTtsAudioRef.current.pause();
        edgeTtsAudioRef.current = null;
      }

      const cleanText = text
        .replace(/```[\s\S]*?```/g, ' Code snippet omitted. ')
        .replace(/[*#`_~>[\]()]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanText) return;

      setEdgeTtsLoadingIndex(index);
      try {
        const response = await fetch('/api/edge-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: cleanText.slice(0, 1500),
            voice: storage.getEdgeVoice(),
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `Server responded with status ${response.status}`);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const audio = new Audio(url);
        edgeTtsAudioRef.current = audio;

        audio.onplay = () => {
          setEdgeTtsPlayingIndex(index);
        };

        audio.onended = () => {
          setEdgeTtsPlayingIndex(null);
          edgeTtsAudioRef.current = null;
          URL.revokeObjectURL(url);
        };

        audio.onerror = () => {
          setEdgeTtsPlayingIndex(null);
          edgeTtsAudioRef.current = null;
          URL.revokeObjectURL(url);
        };

        await audio.play();
        setEdgeTtsPlayingIndex(index);
      } catch (err) {
        console.error('[Assistant] Edge TTS error:', err);
        setEdgeTtsPlayingIndex(null);
      } finally {
        setEdgeTtsLoadingIndex(null);
      }
    },
    [edgeTtsPlayingIndex, stopSpeak],
  );

  const handleCopyText = useCallback(async (text: string, index: number) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Safe fallback
        }
      }
      if (edgeTtsAudioRef.current) {
        edgeTtsAudioRef.current.pause();
        edgeTtsAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
    } catch {
      // Storage may be unavailable.
    }
  }, [messages]);

  useEffect(() => {
    try {
      if (smartMemory) {
        localStorage.setItem(MEMORY_KEY, smartMemory);
      } else {
        localStorage.removeItem(MEMORY_KEY);
      }
    } catch {
      // Ignore storage errors.
    }
  }, [smartMemory]);

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    adjustTextareaHeight();
  };

  const sendMessage = async (value = input) => {
    const message = value.trim();

    if (!message || loading) return;

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setError('');

    const userMessage: Message = {
      role: 'user',
      content: message,
    };

    const historyForRequest = messages
      .slice(-RECENT_MESSAGES)
      .filter((item) => item.content.trim());

    setMessages((current) => [...current, userMessage]);
    setLoading(true);

    // If Image Generation mode is ON, route directly to Image Studio generation infrastructure
    if (imageGenEnabled) {
      setImageLoadingPhase('Initiating image synthesis...');
      try {
        const imageResult = await generateStudioImage(message, {
          onProgress: (phase) => setImageLoadingPhase(phase),
        });

        const assistantMessage: Message = {
          role: 'assistant',
          content: `Here is your generated image for: "${message}"`,
          tool: 'image',
          image: {
            url: imageResult.url,
            imageData: imageResult.imageData,
            providerName: imageResult.providerName,
            model: imageResult.model,
            width: imageResult.width,
            height: imageResult.height,
            seed: imageResult.seed,
            prompt: imageResult.prompt,
          },
        };

        setMessages((current) => [...current, assistantMessage]);

        const updatedConversation = [
          ...messages,
          userMessage,
          assistantMessage,
        ];
        const newMemory = buildLocalMemory(updatedConversation);
        if (newMemory) {
          setSmartMemory(newMemory);
        }
      } catch (imgErr) {
        const errDetail =
          imgErr instanceof Error
            ? imgErr.message
            : 'All image providers failed to generate image.';
        const assistantMessage: Message = {
          role: 'assistant',
          content: `Image generation failed: ${errDetail}\n\nYou can review or adjust your active provider in Settings or Image Studio.`,
          tool: 'image',
        };
        setMessages((current) => [...current, assistantMessage]);
        setError(errDetail);
      } finally {
        setLoading(false);
        setImageLoadingPhase('');
      }
      return;
    }

    // If Multi Chat (3-Persona Panel) mode is enabled in Settings, route through sequential multiChatOrchestrator pipeline
    if (multiChatEnabled) {
      try {
        const multiChatConfig = storage.getMultiChatConfig();
        const currentLanguage = storage.getAssistantLanguage() || storage.getMultiChatResponseLanguage();
        const currentPermanentMemories = storage.getPermanentMemories();

        // Convert prior messages to MultiChatMessage history
        const multiChatHistory: MultiChatMessage[] = messages
          .slice(-10)
          .filter((m) => m.role === 'assistant' && m.multiChatResponses && m.multiChatResponses.length > 0)
          .map((m, idx) => ({
            id: `mc_turn_${idx}`,
            query: 'Prior user context',
            timestamp: Date.now(),
            responses: m.multiChatResponses || [],
          }));

        // Build initial persona list in sequential order (NOVA -> ORBIT -> COSMOS)
        const enabledPersonas = Object.values(multiChatConfig.personas).filter((p) => p.enabled);
        const orderedIds = ['nova', 'orbit', 'cosmos'];
        const sortedPersonas = [...enabledPersonas].sort((a, b) => {
          const idxA = orderedIds.indexOf(a.id);
          const idxB = orderedIds.indexOf(b.id);
          return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
        });

        const initialResponses: MultiChatPersonaResponse[] = sortedPersonas.map((p, idx) => ({
          personaId: p.id,
          name: p.name,
          icon: p.icon,
          accentColor: p.accentColor,
          toneBadge: p.toneBadge,
          text: '',
          status: idx === 0 ? 'running' : 'pending',
        }));

        const placeholderAssistantMessage: Message = {
          role: 'assistant',
          content: '',
          tool: 'multichat',
          multiChatResponses: initialResponses,
        };

        setMessages((current) => [...current, placeholderAssistantMessage]);

        const { responses } = await executeMultiChatTurn({
          query: message,
          conversationHistory: multiChatHistory,
          config: multiChatConfig,
          permanentMemories: currentPermanentMemories,
          responseLanguage: currentLanguage,
          onPersonaUpdate: (updatedResp) => {
            setMessages((current) => {
              const next = [...current];
              const lastIdx = next.length - 1;
              if (lastIdx >= 0 && next[lastIdx].role === 'assistant' && next[lastIdx].tool === 'multichat') {
                const existing = next[lastIdx].multiChatResponses || [];
                const hasExisting = existing.some((r) => r.personaId === updatedResp.personaId);
                const updatedList = hasExisting
                  ? existing.map((r) => (r.personaId === updatedResp.personaId ? updatedResp : r))
                  : [...existing, updatedResp];
                next[lastIdx] = {
                  ...next[lastIdx],
                  multiChatResponses: updatedList,
                  content: updatedList.map((r) => `${r.name}: ${r.content || r.text}`).join('\n\n'),
                };
              }
              return next;
            });
          },
        });

        const finalContent = responses
          .map((r) => `${r.name}: ${r.content || r.text}`)
          .join('\n\n');

        const finalAssistantMessage: Message = {
          role: 'assistant',
          content: finalContent,
          tool: 'multichat',
          multiChatResponses: responses,
        };

        setMessages((current) => {
          const next = [...current];
          const lastIdx = next.length - 1;
          if (lastIdx >= 0 && next[lastIdx].tool === 'multichat') {
            next[lastIdx] = finalAssistantMessage;
            return next;
          }
          return [...next, finalAssistantMessage];
        });

        const updatedConversation = [
          ...messages,
          userMessage,
          finalAssistantMessage,
        ];
        const newMemory = buildLocalMemory(updatedConversation);
        if (newMemory) {
          setSmartMemory(newMemory);
        }
      } catch (mcErr) {
        const errDetail =
          mcErr instanceof Error
            ? mcErr.message
            : 'Multi Chat pipeline encountered an issue.';
        setError(errDetail);
      } finally {
        setLoading(false);
      }
      return;
    }

    const isWebSearchForced = webSearchEnabled;

    try {
      const currentLanguage = storage.getAssistantLanguage();
      const currentPermanentMemories = storage.getPermanentMemories();

      const response = await api.aiChat(
        message,
        historyForRequest,
        smartMemory,
        undefined,
        isWebSearchForced,
        {
          language: currentLanguage,
          permanentMemories: currentPermanentMemories,
        },
      );

      const usedWebSearch =
        isWebSearchForced ||
        response.tool === 'search' ||
        Boolean(response.sources && response.sources.length > 0);

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.answer,
        tool: response.tool,
        sources: response.sources,
        weather: response.weather,
        searchedWeb: usedWebSearch,
      };

      setMessages((current) => [...current, assistantMessage]);

      const updatedConversation = [
        ...messages,
        userMessage,
        assistantMessage,
      ];

      const newMemory = buildLocalMemory(updatedConversation);

      if (newMemory) {
        setSmartMemory(newMemory);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'NEXUS AI is temporarily unavailable.',
      );
    } finally {
      setLoading(false);
    }
  };

  const newChat = () => {
    setMessages([welcomeMessage]);
    setError('');
    setShowClearConfirm(false);
  };

  const handleConfirmClearChat = () => {
    setSmartMemory('');
    setMemoryDraft('');
    setMemoryEditorOpen(false);
    setMessages([welcomeMessage]);
    setError('');
    setShowClearConfirm(false);
    setClearedToast(true);
    setTimeout(() => setClearedToast(false), 3000);

    try {
      localStorage.removeItem(CHAT_KEY);
      localStorage.removeItem(MEMORY_KEY);
    } catch {
      // Ignore storage errors.
    }
  };

  const openMemoryEditor = () => {
    setMemoryDraft(smartMemory);
    setMemoryEditorOpen(true);
  };

  const clearMemory = () => {
    setSmartMemory('');
    setMemoryDraft('');
    setMemoryEditorOpen(false);
    try {
      localStorage.removeItem(MEMORY_KEY);
    } catch {
      // Ignore
    }
  };

  const saveMemory = () => {
    const cleaned = memoryDraft.trim().slice(-MAX_MEMORY_LENGTH);
    setSmartMemory(cleaned);
    setMemoryDraft(cleaned);
    setMemoryEditorOpen(false);
  };

  const activeProvider = storage.getActiveAIProvider();
  const providerLabel = activeProvider ? activeProvider.name : 'NEXUS Standard';

  const isOnlyWelcome =
    messages.length === 1 &&
    messages[0].role === 'assistant' &&
    messages[0].content === welcomeMessage.content;

  return (
    <div
      data-theme={theme}
      className={`min-h-screen flex flex-col font-sans -mx-4 sm:-mx-8 md:-mx-12 -my-8 px-4 sm:px-8 py-4 transition-colors duration-200 ${
        theme === 'classic'
          ? 'theme-classic bg-[#060b13] text-[#e2e8f0] relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0c223c] via-[#081324] to-[#040810]'
          : theme === 'fulldark'
          ? 'theme-fulldark bg-black text-[#ececec]'
          : 'theme-minimal bg-[#111113] text-[#e3e3e7]'
      }`}
    >
      {/* Top Navigation Header */}
      <header
        className={`max-w-4xl w-full mx-auto flex items-center justify-between pb-3 pt-1 transition-colors ${
          theme === 'classic'
            ? 'border-b border-cyan-500/25 bg-slate-900/40 backdrop-blur-md px-3 rounded-xl'
            : theme === 'fulldark'
            ? 'border-b border-[#212121] bg-black'
            : 'border-b border-zinc-800/80 bg-[#111113]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm tracking-tight ${
                theme === 'classic'
                  ? 'font-bold text-cyan-300 drop-shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                  : theme === 'fulldark'
                  ? 'font-medium text-[#f9f9f9]'
                  : 'font-semibold text-zinc-100'
              }`}
            >
              NEXUS AI
            </span>
            {responseLanguage && (
              <span className="hidden md:inline-flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded-full bg-zinc-800/90 text-zinc-300 border border-zinc-700/60">
                <Languages size={10} className="text-cyan-400" />
                <span className="truncate max-w-[90px]">{responseLanguage}</span>
              </span>
            )}
          </div>

          <div
            className={`h-3 w-px ${
              theme === 'classic'
                ? 'bg-cyan-500/30'
                : theme === 'fulldark'
                ? 'bg-[#333]'
                : 'bg-zinc-700/80'
            }`}
          />

          <Link
            to="/settings?tab=ai"
            className={`flex items-center gap-1.5 text-xs transition-colors ${
              theme === 'classic'
                ? 'text-cyan-300/80 hover:text-cyan-100'
                : theme === 'fulldark'
                ? 'text-[#a1a1aa] hover:text-[#f4f4f5]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Configure AI Providers in Settings"
          >
            <Cpu size={12} className={theme === 'classic' ? 'text-cyan-400' : 'text-zinc-400'} />
            <span className="truncate max-w-[140px] sm:max-w-[220px]">
              {providerLabel}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* Settings Modal Trigger */}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
              responseLanguage || permanentMemories.length > 0
                ? theme === 'classic'
                  ? 'bg-cyan-950/60 text-cyan-200 border-cyan-500/40 hover:bg-cyan-900/60'
                  : theme === 'fulldark'
                  ? 'bg-[#212121] text-[#ececec] border-[#383838] hover:bg-[#2a2a2a]'
                  : 'bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:bg-zinc-700/70'
                : theme === 'classic'
                ? 'text-cyan-300/70 border-transparent hover:bg-cyan-950/40'
                : theme === 'fulldark'
                ? 'text-[#a1a1aa] border-transparent hover:bg-[#212121] hover:text-[#ececec]'
                : 'text-zinc-400 border-transparent hover:bg-zinc-800/60'
            }`}
            title="Assistant Settings (Language, Permanent Memories, Theme)"
          >
            <SettingsIcon size={13} className="text-zinc-300" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* Smart Memory Status & Trigger */}
          <button
            type="button"
            onClick={openMemoryEditor}
            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
              smartMemory
                ? theme === 'classic'
                  ? 'bg-cyan-950/50 text-cyan-200 border-cyan-500/30 hover:bg-cyan-900/50'
                  : theme === 'fulldark'
                  ? 'bg-[#212121] text-[#ececec] border-[#383838] hover:bg-[#2a2a2a]'
                  : 'bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:bg-zinc-700/70'
                : theme === 'classic'
                ? 'text-cyan-300/70 border-transparent hover:bg-cyan-950/40'
                : theme === 'fulldark'
                ? 'text-[#a1a1aa] border-transparent hover:bg-[#212121] hover:text-[#ececec]'
                : 'text-zinc-400 border-transparent hover:bg-zinc-800/60'
            }`}
            title="Manage Short-term Memory"
          >
            <Brain size={13} className={smartMemory ? 'text-cyan-400' : 'text-zinc-400'} />
            <span className="hidden sm:inline">Memory</span>
          </button>

          {/* New Chat */}
          <button
            type="button"
            onClick={newChat}
            className={`text-xs px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              theme === 'classic'
                ? 'text-cyan-200 hover:text-white hover:bg-cyan-950/50'
                : theme === 'fulldark'
                ? 'text-[#ececec] hover:bg-[#212121]'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
            }`}
            title="Start a new chat"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">New chat</span>
          </button>

          {/* Clear Chat */}
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className={`text-xs p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              theme === 'classic'
                ? 'text-cyan-300/70 hover:text-red-300 hover:bg-red-500/15'
                : 'text-zinc-400 hover:text-red-300 hover:bg-red-500/10'
            }`}
            title="Clear conversation"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </header>

      {/* Confirmation & Toast Banners */}
      {clearedToast && (
        <div className="max-w-4xl w-full mx-auto mt-2 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 flex items-center gap-2">
          <Check size={14} className="text-emerald-400" />
          <span>Conversation and local context cleared.</span>
        </div>
      )}

      {showClearConfirm && (
        <div className="max-w-4xl w-full mx-auto mt-2 px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-700/80 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={15} className="text-amber-400 shrink-0" />
            <span className="text-xs text-zinc-300">
              Clear conversation history and stored memory?
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              className="px-2.5 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmClearChat}
              className="px-3 py-1 rounded text-xs font-medium bg-red-600/90 hover:bg-red-600 text-white"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Main Chat Stream (Claude-style transparent and clean message bubbles) */}
      <main className="flex-1 max-w-4xl w-full mx-auto flex flex-col justify-between py-6 px-1 sm:px-2">
        <div className="flex-1 space-y-6">
          {/* Multi Chat Mode Active Indicator Banner */}
          {multiChatEnabled && (
            <div
              className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                theme === 'classic'
                  ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                  : theme === 'fulldark'
                  ? 'bg-[#181818] border-[#2e2e2e] text-[#e0e0e0]'
                  : 'bg-zinc-900/90 border-zinc-800 text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-6 h-6 rounded-lg grid place-items-center text-xs shrink-0 ${
                    theme === 'classic'
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : theme === 'fulldark'
                      ? 'bg-zinc-800 text-cyan-400'
                      : 'bg-zinc-800 text-cyan-400'
                  }`}
                >
                  <MessagesSquare size={13} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-zinc-100">Multi Chat Active:</span>
                  <span className="text-[11px] opacity-90">
                    3-Persona Sequential Panel (<strong>NOVA 🧠</strong> → <strong>ORBIT 😎</strong> → <strong>COSMOS 🧘</strong>)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="text-[11px] px-2.5 py-1 rounded-lg border border-zinc-700/60 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition-colors shrink-0 flex items-center gap-1"
                title="Configure in Settings"
              >
                <SettingsIcon size={11} />
                <span>Settings</span>
              </button>
            </div>
          )}

          {/* Empty / Welcome state hero */}
          {isOnlyWelcome && (
            <div className="py-12 sm:py-20 text-center flex flex-col items-center justify-center">
              <h2 className="text-2xl sm:text-3xl font-normal text-zinc-200 tracking-tight mb-3">
                How can I help you today?
              </h2>
              <p className="text-sm text-zinc-400 max-w-md mb-8">
                Ask questions, synthesize documents, solve technical problems, or explore live web data.
              </p>

              {/* Quick suggestion prompt pills */}
              <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendMessage(prompt)}
                    disabled={loading}
                    className={`text-xs px-3.5 py-2 transition-all text-left ${
                      theme === 'classic'
                        ? 'rounded-full border border-cyan-500/30 bg-slate-900/80 text-cyan-200 hover:text-white hover:border-cyan-400 hover:bg-cyan-950/60 shadow-sm'
                        : theme === 'fulldark'
                        ? 'rounded-2xl border border-[#2e2e2e] bg-[#1a1a1a] text-[#cfcfcf] hover:text-white hover:border-[#454545] hover:bg-[#262626]'
                        : 'rounded-full border border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-zinc-800'
                    }`}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message List */}
          {!isOnlyWelcome &&
            messages.map((message, index) => {
              const isUser = message.role === 'user';
              const hasSources = message.sources && message.sources.length > 0;
              const hasSearched = message.searchedWeb || message.tool === 'search' || hasSources;

              return (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex w-full ${
                    isUser ? 'justify-end' : 'justify-start'
                  } group`}
                >
                  <div
                    className={`flex flex-col ${
                      isUser
                        ? 'items-end max-w-[85%] sm:max-w-[75%]'
                        : 'items-start w-full max-w-full'
                    }`}
                  >
                    {/* User Message Bubble */}
                    {isUser ? (
                      <div
                        className={`leading-relaxed break-words whitespace-pre-wrap transition-all ${
                          theme === 'classic'
                            ? 'px-4 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-950/90 to-blue-950/90 text-cyan-50 text-[14.5px] border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                            : theme === 'fulldark'
                            ? 'px-5 py-3 rounded-[24px] bg-[#212121] text-[#f4f4f5] text-[15px] border border-[#2f2f2f] shadow-none'
                            : 'px-4 py-2.5 rounded-2xl bg-[#27272a] text-zinc-100 text-[14.5px] border border-zinc-700/60'
                        }`}
                      >
                        {message.content}
                      </div>
                    ) : (
                      /* Assistant Message */
                      <div
                        className={`w-full space-y-2 transition-all ${
                          theme === 'classic'
                            ? 'bg-slate-900/50 border border-cyan-500/20 backdrop-blur-md rounded-2xl p-4 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.35)]'
                            : theme === 'fulldark'
                            ? 'py-1 text-[#ececec]'
                            : 'py-1 text-zinc-200'
                        }`}
                      >
                        {/* Web Search Indicator Tag */}
                        {hasSearched && (
                          <div className="flex items-center gap-2 pt-1 pb-0.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                theme === 'classic'
                                  ? 'bg-cyan-950/70 text-cyan-300 border-cyan-500/40'
                                  : theme === 'fulldark'
                                  ? 'bg-[#1e1e1e] text-[#cfcfcf] border-[#2e2e2e]'
                                  : 'bg-zinc-800 text-zinc-300 border-zinc-700/60'
                              }`}
                            >
                              <Search size={11} className={theme === 'classic' ? 'text-cyan-400' : theme === 'fulldark' ? 'text-neutral-400' : 'text-cyan-400'} />
                              <span>Searched the web</span>
                              {hasSources && (
                                <span className={theme === 'fulldark' ? 'text-[#888] font-normal' : 'text-zinc-500 font-normal'}>
                                  ({message.sources?.length} {message.sources?.length === 1 ? 'source' : 'sources'})
                                </span>
                              )}
                            </span>

                            {hasSources && (
                              <button
                                type="button"
                                onClick={() => toggleSourceExpand(index)}
                                className={`text-[11px] flex items-center gap-0.5 transition-colors ${
                                  theme === 'fulldark'
                                    ? 'text-[#8e8e8e] hover:text-[#e0e0e0]'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                              >
                                <span>{expandedSources[index] ? 'Hide sources' : 'Show sources'}</span>
                                {expandedSources[index] ? (
                                  <ChevronUp size={12} />
                                ) : (
                                  <ChevronDown size={12} />
                                )}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Collapsible Verified Sources Panel with 10-item scrollable grid & domain trust badges */}
                        {hasSources && expandedSources[index] && (
                          <div
                            className={`my-2.5 p-2.5 rounded-xl border shadow-sm ${
                              theme === 'classic'
                                ? 'border-cyan-500/30 bg-slate-950/80'
                                : theme === 'fulldark'
                                ? 'border-[#282828] bg-[#141414]'
                                : 'border-zinc-800/80 bg-zinc-950/60'
                            }`}
                          >
                            <div
                              className={`flex items-center justify-between px-1 py-1 mb-2 border-b text-[11px] ${
                                theme === 'classic'
                                  ? 'border-cyan-500/20 text-cyan-300'
                                  : theme === 'fulldark'
                                  ? 'border-[#262626] text-[#a0a0a0]'
                                  : 'border-zinc-800/60 text-zinc-400'
                              }`}
                            >
                              <span className="font-medium flex items-center gap-1.5">
                                <Globe size={12} className={theme === 'classic' ? 'text-cyan-400' : 'text-zinc-400'} />
                                <span>Retrieved Sources ({message.sources?.length})</span>
                              </span>
                              <span className="text-[10.5px] opacity-75 hidden sm:inline">
                                Ranked by Domain Authority & Trust
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1">
                              {message.sources?.map((src, sIdx) => {
                                const isWiki =
                                  src.type === 'wikipedia' ||
                                  src.domain?.toLowerCase().includes('wikipedia');
                                const tier = src.trustTier ?? (isWiki ? 1 : 2);
                                const tierLabel =
                                  src.trustTierLabel ||
                                  (tier === 1 ? 'Official / Primary' : tier === 2 ? 'Secondary' : 'Unverified');

                                return (
                                  <a
                                    key={`${src.url}-${sIdx}`}
                                    href={src.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`p-2.5 rounded-lg border transition-all text-xs flex flex-col justify-between group/card ${
                                      theme === 'classic'
                                        ? 'border-cyan-500/20 bg-slate-900/70 hover:bg-slate-900 hover:border-cyan-500/40 text-cyan-100'
                                        : theme === 'fulldark'
                                        ? 'border-[#262626] bg-[#1c1c1c] hover:bg-[#242424] hover:border-[#383838] text-[#e0e0e0]'
                                        : 'border-zinc-800/90 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700 text-zinc-200'
                                    }`}
                                  >
                                    <div>
                                      <div className="flex items-center justify-between gap-1 mb-1.5 flex-wrap">
                                        <span className="inline-flex items-center gap-1 text-[10.5px] font-medium opacity-80 truncate max-w-[140px]">
                                          {isWiki ? (
                                            <>
                                              <BookOpen size={10} className="text-cyan-400 shrink-0" /> Wikipedia
                                            </>
                                          ) : (
                                            <>
                                              <Globe size={10} className="shrink-0" /> {src.domain || 'Web'}
                                            </>
                                          )}
                                        </span>

                                        {/* Trust Tier Badge */}
                                        <span
                                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-medium border ${
                                            tier === 1
                                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                                              : tier === 2
                                              ? 'bg-sky-950/60 text-sky-300 border-sky-700/60'
                                              : 'bg-amber-950/40 text-amber-300/90 border-amber-800/50'
                                          }`}
                                          title={src.trustTierReason || `Tier ${tier}: ${tierLabel}`}
                                        >
                                          <span
                                            className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${
                                              tier === 1
                                                ? 'bg-emerald-400'
                                                : tier === 2
                                                ? 'bg-sky-400'
                                                : 'bg-amber-400'
                                            }`}
                                          />
                                          Tier {tier} • {tierLabel}
                                        </span>
                                      </div>

                                      <p className="font-medium line-clamp-1 mb-1 group-hover/card:text-white transition-colors">
                                        {src.title}
                                      </p>
                                      {src.description && (
                                        <p className="text-[11px] opacity-75 line-clamp-2 leading-relaxed">
                                          {src.description}
                                        </p>
                                      )}
                                    </div>

                                    <div
                                      className={`mt-2 pt-1.5 border-t flex items-center justify-between text-[10px] ${
                                        theme === 'classic'
                                          ? 'border-cyan-500/20 text-cyan-300/60'
                                          : theme === 'fulldark'
                                          ? 'border-[#262626] text-[#707070]'
                                          : 'border-zinc-800/40 text-zinc-500'
                                      }`}
                                    >
                                      <span className="truncate max-w-[170px]">
                                        {src.url.replace(/^https?:\/\//, '')}
                                      </span>
                                      <ExternalLink size={11} className="shrink-0 ml-1 opacity-60 group-hover/card:opacity-100" />
                                    </div>
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Weather Data Widget (if returned) */}
                        {message.tool === 'weather' && message.weather && typeof message.weather === 'object' && (() => {
                          const weather = message.weather as {
                            current?: {
                              location?: string;
                              temperature?: number;
                              feelsLike?: number;
                              conditionLabel?: string;
                              humidity?: number;
                              rainProbability?: number;
                            };
                          };
                          const curr = weather.current;
                          if (!curr) return null;
                          return (
                            <div
                              className={`my-2 p-3 rounded-xl border text-xs flex items-center justify-between gap-4 flex-wrap ${
                                theme === 'classic'
                                  ? 'border-cyan-500/30 bg-slate-900/80 text-cyan-100'
                                  : theme === 'fulldark'
                                  ? 'border-[#262626] bg-[#1a1a1a] text-[#e0e0e0]'
                                  : 'border-zinc-800 bg-zinc-900/80 text-zinc-300'
                              }`}
                            >
                              <div>
                                <span className="font-medium text-white">
                                  {curr.location || 'Location'}
                                </span>
                                <span className="opacity-75 ml-2">
                                  {curr.conditionLabel || 'Current Weather'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span>🌡️ {curr.temperature ?? '—'}°C</span>
                                <span>💧 {curr.humidity ?? '—'}%</span>
                                <span>🌧️ {curr.rainProbability ?? '—'}%</span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* 3-Persona Sequential Panel (if Multi Chat) or Standard Response Body */}
                        {message.multiChatResponses && message.multiChatResponses.length > 0 ? (
                          <div className="space-y-3 pt-1">
                            {/* Multi-Chat Sequential Pipeline Bar */}
                            <div
                              className={`flex items-center justify-between px-3.5 py-2 rounded-xl border text-xs ${
                                theme === 'classic'
                                  ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-300'
                                  : theme === 'fulldark'
                                  ? 'bg-[#1a1a1a] border-[#2e2e2e] text-[#ccc]'
                                  : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <MessagesSquare size={14} className="text-cyan-400" />
                                <span className="font-semibold text-[11px] tracking-wide uppercase">
                                  3-Persona Sequential Dialogue
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10.5px] font-mono opacity-80">
                                <span className="text-cyan-400 font-semibold">NOVA 🧠</span>
                                <span>→</span>
                                <span className="text-pink-400 font-semibold">ORBIT 😎</span>
                                <span>→</span>
                                <span className="text-purple-400 font-semibold">COSMOS 🧘</span>
                              </div>
                            </div>

                            {/* Persona Response Cards */}
                            {message.multiChatResponses.map((resp, pIdx) => {
                              const isRunning = resp.status === 'running';
                              const isPending = resp.status === 'pending';
                              const isFailed = resp.status === 'failed';
                              const cleanPersonaText = resp.content || resp.text || '';
                              const personaKey = `${index}_${resp.personaId}`;
                              const isAudioPlaying = personaAudioPlayingKey === personaKey;
                              const isAudioLoading = personaAudioLoadingKey === personaKey;

                              return (
                                <div
                                  key={resp.personaId || pIdx}
                                  className={`p-4 rounded-2xl border transition-all ${
                                    isRunning
                                      ? 'ring-1 ring-cyan-400/40 animate-pulse'
                                      : ''
                                  } ${
                                    theme === 'classic'
                                      ? 'bg-slate-900/85 border-cyan-500/25 shadow-[0_2px_15px_rgba(6,182,212,0.08)]'
                                      : theme === 'fulldark'
                                      ? 'bg-[#181818] border-[#292929]'
                                      : 'bg-zinc-900/80 border-zinc-800/90'
                                  }`}
                                  style={{
                                    borderLeftColor: resp.accentColor || '#06b6d4',
                                    borderLeftWidth: '3.5px',
                                  }}
                                >
                                  {/* Persona Header */}
                                  <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                      {/* Persona Icon Badge */}
                                      <div
                                        className="w-7 h-7 rounded-lg grid place-items-center text-sm shadow-sm"
                                        style={{
                                          background: `${resp.accentColor || '#06b6d4'}20`,
                                          border: `1px solid ${resp.accentColor || '#06b6d4'}40`,
                                        }}
                                      >
                                        {resp.icon || '🤖'}
                                      </div>

                                      {/* Persona Name & Tone Badge */}
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-xs text-zinc-100 font-mono tracking-tight">
                                          {resp.name}
                                        </span>
                                        <span
                                          className="text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold"
                                          style={{
                                            background: `${resp.accentColor || '#06b6d4'}18`,
                                            color: resp.accentColor || '#06b6d4',
                                            border: `1px solid ${resp.accentColor || '#06b6d4'}35`,
                                          }}
                                        >
                                          {resp.toneBadge}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Status & Timing */}
                                    <div className="flex items-center gap-2">
                                      {isRunning && (
                                        <span className="inline-flex items-center gap-1.5 text-[11px] text-cyan-400 font-medium">
                                          <Loader2 size={11} className="animate-spin" />
                                          <span>Synthesizing...</span>
                                        </span>
                                      )}
                                      {isPending && (
                                        <span className="text-[11px] text-zinc-500 italic">
                                          Queued in sequence...
                                        </span>
                                      )}
                                      {isFailed && (
                                        <span className="inline-flex items-center gap-1 text-[11px] text-red-400">
                                          <AlertTriangle size={11} />
                                          <span>Failed</span>
                                        </span>
                                      )}
                                      {resp.durationMs && resp.status === 'completed' && (
                                        <span className="text-[10px] text-zinc-500 font-mono">
                                          {(resp.durationMs / 1000).toFixed(1)}s
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Persona Text Content */}
                                  {cleanPersonaText ? (
                                    <div
                                      className={`text-[14px] leading-relaxed break-words whitespace-pre-wrap ${
                                        theme === 'classic'
                                          ? 'text-slate-100'
                                          : theme === 'fulldark'
                                          ? 'text-[#e5e5e5]'
                                          : 'text-zinc-200'
                                      }`}
                                    >
                                      {cleanPersonaText}
                                    </div>
                                  ) : isRunning ? (
                                    <div className="text-xs text-zinc-400 py-1 flex items-center gap-2">
                                      <Loader2 size={12} className="animate-spin text-cyan-400" />
                                      <span>Thinking through {resp.name}&apos;s persona lens...</span>
                                    </div>
                                  ) : isPending ? (
                                    <div className="text-xs text-zinc-500 italic py-1">
                                      Awaiting prior persona answers to connect reasoning...
                                    </div>
                                  ) : isFailed ? (
                                    <div className="text-xs text-red-400 py-1">
                                      {resp.error || 'Failed to generate response for this persona.'}
                                    </div>
                                  ) : null}

                                  {/* Persona Action Toolbar */}
                                  {resp.status === 'completed' && cleanPersonaText && (
                                    <div
                                      className={`flex items-center justify-between pt-2.5 mt-2.5 border-t text-xs ${
                                        theme === 'classic'
                                          ? 'border-cyan-500/10 text-cyan-200/60'
                                          : theme === 'fulldark'
                                          ? 'border-[#262626] text-zinc-400'
                                          : 'border-zinc-800 text-zinc-400'
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5">
                                        {/* Copy persona text */}
                                        <button
                                          type="button"
                                          onClick={() => handleCopyText(cleanPersonaText, index * 100 + pIdx)}
                                          className={`p-1 rounded-md transition-colors ${
                                            theme === 'fulldark'
                                              ? 'hover:text-white hover:bg-[#282828]'
                                              : 'hover:text-zinc-200 hover:bg-zinc-800'
                                          }`}
                                          title={`Copy ${resp.name}'s response`}
                                        >
                                          {copiedIndex === index * 100 + pIdx ? (
                                            <Check size={12} className="text-emerald-400" />
                                          ) : (
                                            <Copy size={12} />
                                          )}
                                        </button>

                                        {/* Voice TTS Read Aloud */}
                                        <button
                                          type="button"
                                          onClick={() => handlePlayPersonaAudio(cleanPersonaText, personaKey, resp.personaId)}
                                          disabled={isAudioLoading}
                                          className={`p-1 rounded-md transition-colors ${
                                            isAudioPlaying
                                              ? 'text-cyan-400 bg-cyan-500/10'
                                              : theme === 'fulldark'
                                              ? 'hover:text-white hover:bg-[#282828]'
                                              : 'hover:text-zinc-200 hover:bg-zinc-800'
                                          }`}
                                          title={
                                            isAudioLoading
                                              ? `Synthesizing ${resp.name}'s Voice...`
                                              : isAudioPlaying
                                              ? `Stop ${resp.name}'s Voice`
                                              : `Listen to ${resp.name}'s Voice`
                                          }
                                        >
                                          {isAudioLoading ? (
                                            <Loader2 size={12} className="animate-spin text-cyan-400" />
                                          ) : isAudioPlaying ? (
                                            <VolumeX size={12} />
                                          ) : (
                                            <Volume2 size={12} />
                                          )}
                                        </button>
                                      </div>

                                      <span className="text-[10px] opacity-60 font-mono">
                                        Persona: {resp.name}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          /* Plain Transparent Assistant Message Body */
                          <div
                            className={`text-[15px] leading-relaxed break-words whitespace-pre-wrap pt-0.5 ${
                              theme === 'classic'
                                ? 'text-slate-100'
                                : theme === 'fulldark'
                                ? 'text-[#ececec] font-normal tracking-normal'
                                : 'text-zinc-200'
                            }`}
                          >
                            {message.content}
                          </div>
                        )}

                        {/* Generated Image Bubble (if present) */}
                        {message.image && (
                          <div
                            className={`my-3 p-3 rounded-2xl border transition-all ${
                              theme === 'classic'
                                ? 'border-cyan-500/30 bg-slate-900/80 shadow-[0_4px_25px_rgba(6,182,212,0.15)]'
                                : theme === 'fulldark'
                                ? 'border-[#2a2a2a] bg-[#171717]'
                                : 'border-zinc-800 bg-zinc-900/90'
                            }`}
                          >
                            {/* Image preview with hover actions */}
                            <div className="relative group/img overflow-hidden rounded-xl bg-black/40 flex items-center justify-center">
                              <img
                                src={message.image.imageData || message.image.url}
                                alt={message.image.prompt}
                                className="w-full max-h-[440px] object-contain rounded-xl transition-transform duration-300 group-hover/img:scale-[1.01]"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex flex-col justify-between p-3 pointer-events-none">
                                <div className="flex justify-end gap-2 pointer-events-auto">
                                  <button
                                    type="button"
                                    onClick={() => setFullscreenModalImage(message.image?.url || message.image?.imageData || null)}
                                    className="p-1.5 rounded-lg bg-black/70 text-white hover:bg-black/90 backdrop-blur-md transition-all shadow-md"
                                    title="View Fullscreen"
                                  >
                                    <Maximize2 size={14} />
                                  </button>
                                </div>
                                <div className="flex items-center justify-between text-xs text-white/90 pointer-events-auto">
                                  <span className="truncate max-w-[240px] font-medium drop-shadow-sm">
                                    {message.image.prompt}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadImage(message.image!)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs font-medium transition-all"
                                  >
                                    <Download size={12} />
                                    <span>Download</span>
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Metadata and Controls */}
                            <div className="mt-3 pt-2.5 border-t flex items-center justify-between flex-wrap gap-2 text-xs">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                                    theme === 'classic'
                                      ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40'
                                      : theme === 'fulldark'
                                      ? 'bg-[#222] text-[#e0e0e0] border-[#333]'
                                      : 'bg-zinc-800 text-zinc-300 border-zinc-700/60'
                                  }`}
                                >
                                  <Sparkles size={11} className={theme === 'classic' ? 'text-cyan-400' : 'text-purple-400'} />
                                  <span>{message.image.providerName}</span>
                                </span>

                                {message.image.model && (
                                  <span
                                    className={`hidden sm:inline-flex items-center text-[10.5px] px-2 py-0.5 rounded-md border ${
                                      theme === 'classic'
                                        ? 'bg-slate-900/60 text-slate-300 border-cyan-500/20'
                                        : theme === 'fulldark'
                                        ? 'bg-[#1a1a1a] text-[#aaa] border-[#292929]'
                                        : 'bg-zinc-950/60 text-zinc-400 border-zinc-800'
                                    }`}
                                  >
                                    {message.image.model}
                                  </span>
                                )}

                                <span
                                  className={`text-[10.5px] opacity-75 ${
                                    theme === 'classic' ? 'text-cyan-200/70' : 'text-zinc-400'
                                  }`}
                                >
                                  {message.image.width} × {message.image.height}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleDownloadImage(message.image!)}
                                  className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-all ${
                                    theme === 'classic'
                                      ? 'border-cyan-500/30 bg-cyan-950/40 text-cyan-200 hover:bg-cyan-900/50 hover:text-white'
                                      : theme === 'fulldark'
                                      ? 'border-[#333] bg-[#222] text-[#eee] hover:bg-[#2c2c2c] hover:text-white'
                                      : 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white'
                                  }`}
                                  title="Download Image"
                                >
                                  <Download size={12} />
                                  <span className="hidden sm:inline">Download</span>
                                </button>

                                <Link
                                  to={`/image-studio?prompt=${encodeURIComponent(message.image.prompt)}`}
                                  className={`p-1.5 rounded-lg border transition-all ${
                                    theme === 'classic'
                                      ? 'border-cyan-500/20 text-cyan-300/80 hover:bg-cyan-950/40 hover:text-cyan-100'
                                      : theme === 'fulldark'
                                      ? 'border-[#2e2e2e] text-[#aaa] hover:bg-[#222] hover:text-white'
                                      : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                                  }`}
                                  title="Open in Image Studio"
                                >
                                  <ExternalLink size={13} />
                                </Link>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Message Action Toolbar */}
                        <div
                          className={`flex items-center gap-1.5 pt-1 opacity-60 group-hover:opacity-100 transition-opacity ${
                            theme === 'fulldark' ? 'text-[#888]' : 'text-zinc-400'
                          }`}
                        >
                          {/* Copy */}
                          <button
                            type="button"
                            onClick={() => handleCopyText(message.content, index)}
                            className={`p-1 rounded-md transition-colors ${
                              theme === 'fulldark'
                                ? 'hover:text-white hover:bg-[#282828]'
                                : 'hover:text-zinc-200 hover:bg-zinc-800'
                            }`}
                            title="Copy response"
                          >
                            {copiedIndex === index ? (
                              <Check size={13} className="text-emerald-400" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>

                          {/* Browser Voice Read Aloud */}
                          <button
                            type="button"
                            onClick={() => toggleBrowserSpeak(message.content, index)}
                            className={`p-1 rounded-md transition-colors ${
                              speakingIndex === index
                                ? 'text-cyan-400 bg-cyan-500/10'
                                : theme === 'fulldark'
                                ? 'hover:text-white hover:bg-[#282828]'
                                : 'hover:text-zinc-200 hover:bg-zinc-800'
                            }`}
                            title={speakingIndex === index ? 'Stop voice' : 'Read aloud (Browser)'}
                          >
                            {speakingIndex === index ? (
                              <VolumeX size={13} />
                            ) : (
                              <Volume2 size={13} />
                            )}
                          </button>

                          {/* Neural Edge TTS */}
                          <button
                            type="button"
                            onClick={() => handleEdgeTtsSpeak(message.content, index)}
                            disabled={edgeTtsLoadingIndex === index}
                            className={`p-1 rounded-md transition-colors ${
                              edgeTtsPlayingIndex === index
                                ? 'text-purple-400 bg-purple-500/10'
                                : theme === 'fulldark'
                                ? 'hover:text-white hover:bg-[#282828]'
                                : 'hover:text-zinc-200 hover:bg-zinc-800'
                            }`}
                            title={
                              edgeTtsLoadingIndex === index
                                ? 'Synthesizing Neural voice...'
                                : edgeTtsPlayingIndex === index
                                ? 'Stop Edge TTS'
                                : 'Play Neural voice (Edge TTS)'
                            }
                          >
                            {edgeTtsLoadingIndex === index ? (
                              <Loader2 size={13} className="animate-spin text-purple-400" />
                            ) : edgeTtsPlayingIndex === index ? (
                              <Radio size={13} className="animate-pulse" />
                            ) : (
                              <Radio size={13} />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

          {/* Loading indicator */}
          {loading && (
            <div
              className={`flex items-center gap-2 text-xs py-2 ${
                imageGenEnabled
                  ? 'text-purple-300'
                  : theme === 'classic'
                  ? 'text-cyan-300'
                  : theme === 'fulldark'
                  ? 'text-[#a1a1a1]'
                  : 'text-zinc-400'
              }`}
            >
              <Loader2
                size={14}
                className={`animate-spin ${
                  imageGenEnabled
                    ? 'text-purple-400'
                    : theme === 'classic'
                    ? 'text-cyan-400'
                    : 'text-zinc-400'
                }`}
              />
              <span>
                {imageGenEnabled
                  ? imageLoadingPhase || 'Synthesizing AI image across providers...'
                  : 'NEXUS AI is thinking...'}
              </span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="my-2">
              <ErrorMessage message={error} />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar: Clean pinned container */}
        <div
          className={`sticky bottom-0 pt-4 pb-1 transition-colors ${
            theme === 'classic'
              ? 'bg-gradient-to-t from-[#060b13] via-[#060b13] to-transparent'
              : theme === 'fulldark'
              ? 'bg-gradient-to-t from-black via-black to-transparent'
              : 'bg-gradient-to-t from-[#111113] via-[#111113] to-transparent'
          }`}
        >
          {/* Quick prompts chips if conversation has few messages and user isn't typing */}
          {!isOnlyWelcome && messages.length <= 3 && !input && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2.5 no-scrollbar">
              {(imageGenEnabled ? QUICK_IMAGE_PROMPTS : QUICK_PROMPTS).slice(0, 3).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  disabled={loading}
                  className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                    theme === 'classic'
                      ? 'border-cyan-500/30 bg-slate-900/80 text-cyan-200 hover:text-white hover:border-cyan-400'
                      : theme === 'fulldark'
                      ? 'border-[#2e2e2e] bg-[#1a1a1a] text-[#d4d4d4] hover:text-white hover:border-[#404040]'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                  }`}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className={`transition-all ${
              theme === 'classic'
                ? 'rounded-2xl border border-cyan-500/40 bg-slate-900/85 backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.15)] focus-within:border-cyan-400 p-2.5 flex flex-col gap-2'
                : theme === 'fulldark'
                ? 'rounded-[28px] border border-[#303030] bg-[#212121] shadow-none focus-within:border-[#525252] p-3 flex flex-col gap-2'
                : 'rounded-2xl border border-zinc-700/70 bg-[#1e1e21] shadow-lg focus-within:border-zinc-500 p-2.5 flex flex-col gap-2'
            }`}
          >
            {/* Input Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={
                imageGenEnabled
                  ? 'Describe the image you want to generate...'
                  : 'Ask NEXUS AI anything...'
              }
              aria-label={imageGenEnabled ? 'Describe image prompt' : 'Message NEXUS AI'}
              rows={1}
              disabled={loading}
              className={`w-full bg-transparent text-[14.5px] leading-relaxed resize-none outline-none px-2 pt-1 pb-1 min-h-[44px] max-h-[180px] ${
                theme === 'classic'
                  ? 'text-white placeholder-cyan-300/40'
                  : theme === 'fulldark'
                  ? 'text-[#ececec] placeholder-[#737373]'
                  : 'text-zinc-100 placeholder-zinc-500'
              }`}
            />

            {/* Bottom Controls inside input box */}
            <div
              className={`flex items-center justify-between pt-1 border-t ${
                theme === 'classic'
                  ? 'border-cyan-500/20'
                  : theme === 'fulldark'
                  ? 'border-[#2e2e2e]'
                  : 'border-zinc-800/60'
              }`}
            >
              {/* Web Search Toggle, Image Toggle & Language tag */}
              <div className="flex items-center gap-2">
                {/* Web Search Toggle */}
                <button
                  type="button"
                  onClick={toggleWebSearch}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                    webSearchEnabled
                      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                      : theme === 'classic'
                      ? 'text-cyan-300/70 border-transparent hover:text-cyan-200 hover:bg-cyan-950/40'
                      : theme === 'fulldark'
                      ? 'text-[#a1a1aa] border-transparent hover:text-[#ececec] hover:bg-[#2a2a2a]'
                      : 'text-zinc-400 border-transparent hover:text-zinc-300 hover:bg-zinc-800/60'
                  }`}
                  title={
                    webSearchEnabled
                      ? 'Web Search is ON: forces live search on every request'
                      : 'Web Search is Auto: searches when needed'
                  }
                >
                  <Globe
                    size={13}
                    className={webSearchEnabled ? 'text-cyan-400' : 'text-zinc-400'}
                  />
                  <span>Web Search</span>
                  {webSearchEnabled && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  )}
                </button>

                {/* Image Generation Toggle */}
                <button
                  type="button"
                  onClick={toggleImageGen}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                    imageGenEnabled
                      ? 'bg-purple-500/15 text-purple-300 border-purple-500/40 font-medium shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                      : theme === 'classic'
                      ? 'text-cyan-300/70 border-transparent hover:text-cyan-200 hover:bg-cyan-950/40'
                      : theme === 'fulldark'
                      ? 'text-[#a1a1aa] border-transparent hover:text-[#ececec] hover:bg-[#2a2a2a]'
                      : 'text-zinc-400 border-transparent hover:text-zinc-300 hover:bg-zinc-800/60'
                  }`}
                  title={
                    imageGenEnabled
                      ? 'Image Generation is ON: messages are synthesized into images using Image Studio providers'
                      : 'Image Generation is OFF: standard conversational chat'
                  }
                >
                  <ImageIcon
                    size={13}
                    className={imageGenEnabled ? 'text-purple-400' : 'text-zinc-400'}
                  />
                  <span>Image</span>
                  {imageGenEnabled && (
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.8)]" />
                  )}
                </button>

                {responseLanguage && (
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className="text-[11px] px-2 py-1 rounded-md bg-zinc-800/80 text-zinc-300 border border-zinc-700/60 hover:border-zinc-600 transition-colors flex items-center gap-1"
                    title={`Response language set to ${responseLanguage}. Click to change in Settings.`}
                  >
                    <Languages size={11} className="text-cyan-400" />
                    <span>{responseLanguage}</span>
                  </button>
                )}
              </div>

              {/* Right: Send Button */}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    input.trim() && !loading
                      ? theme === 'classic'
                        ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)] cursor-pointer'
                        : theme === 'fulldark'
                        ? 'bg-white text-black hover:bg-neutral-200 cursor-pointer'
                        : imageGenEnabled
                        ? 'bg-purple-500 text-white hover:bg-purple-400 cursor-pointer'
                        : 'bg-zinc-100 text-zinc-900 hover:bg-white cursor-pointer'
                      : theme === 'classic'
                      ? 'bg-cyan-950/40 text-cyan-700 cursor-not-allowed opacity-50 border border-cyan-500/10'
                      : theme === 'fulldark'
                      ? 'bg-[#333333] text-[#737373] cursor-not-allowed opacity-50'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
                  }`}
                  aria-label="Send message"
                >
                  <Send size={14} className="translate-x-px" />
                </button>
              </div>
            </div>
          </form>

          {/* Subtext info */}
          <div className="text-center pt-2 pb-0.5 text-[11px] text-zinc-500 flex items-center justify-center gap-2 flex-wrap">
            <span>NEXUS AI</span>
            <span>·</span>
            <span>{multiChatEnabled ? 'Multi Chat (3-Persona Pipeline)' : imageGenEnabled ? 'Image Generation Mode Active' : webSearchEnabled ? 'Live Web Search Active' : 'Automatic Web Search'}</span>
            <span>·</span>
            <span>Theme: {theme === 'classic' ? 'NEXUS Classic' : theme === 'fulldark' ? 'Full Dark' : 'NEXUS Minimal'}</span>
            {responseLanguage && (
              <>
                <span>·</span>
                <span className="text-cyan-400/90">Language: {responseLanguage}</span>
              </>
            )}
            {permanentMemories.length > 0 && (
              <>
                <span>·</span>
                <span>{permanentMemories.length} Permanent {permanentMemories.length === 1 ? 'Memory' : 'Memories'}</span>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Settings Modal (Language, Permanent Memories, Theme) */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-700/80 bg-[#161618] text-zinc-200 p-6 shadow-2xl space-y-6 max-h-[88vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-zinc-200">
                  <SettingsIcon size={18} className="text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-100">
                    AI Assistant Settings
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Customize response language, permanent standing memories, and visual theme.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                title="Close settings"
              >
                <X size={18} />
              </button>
            </div>

            {/* Toast feedback inside modal if active */}
            {settingsSavedToast && (
              <div className="px-3.5 py-2 rounded-lg bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-xs flex items-center gap-2">
                <Check size={14} className="text-emerald-400 shrink-0" />
                <span>{settingsSavedToast}</span>
              </div>
            )}

            {/* Section 1: Visual Theme Selector */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Palette size={15} className="text-purple-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  Visual Theme
                </h4>
              </div>
              <p className="text-xs text-zinc-400">
                Select your preferred visual aesthetic for the NEXUS AI Assistant.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {/* Theme 1: NEXUS Minimal (Claude style) */}
                <button
                  type="button"
                  onClick={() => handleThemeChange('minimal')}
                  className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between group ${
                    theme === 'minimal'
                      ? 'border-zinc-400 bg-zinc-800/90 shadow-md ring-1 ring-zinc-400/40'
                      : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-xs text-zinc-100">
                        NEXUS Minimal
                      </span>
                      {theme === 'minimal' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-700/50">
                          <Check size={10} /> Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
                      Claude-inspired neutral dark aesthetic with refined spacing and clean sans-serif typography.
                    </p>
                  </div>
                  {/* Visual preview swatch */}
                  <div className="h-6 w-full rounded-md bg-[#111113] border border-zinc-700/60 p-1 flex items-center gap-1">
                    <div className="h-full w-1/3 rounded bg-[#26262a]" />
                    <div className="h-full w-2/3 rounded bg-[#1e1e21]" />
                  </div>
                </button>

                {/* Theme 2: NEXUS Classic (Glassmorphic Space) */}
                <button
                  type="button"
                  onClick={() => handleThemeChange('classic')}
                  className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between group ${
                    theme === 'classic'
                      ? 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_15px_rgba(6,182,212,0.2)] ring-1 ring-cyan-400/40'
                      : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-xs text-cyan-200">
                        NEXUS Classic
                      </span>
                      {theme === 'classic' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-300 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-500/50">
                          <Check size={10} /> Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
                      Glassmorphic cosmic dark space theme with glowing cyan accents and deep stellar background.
                    </p>
                  </div>
                  {/* Visual preview swatch */}
                  <div className="h-6 w-full rounded-md bg-[#060b13] border border-cyan-500/30 p-1 flex items-center gap-1">
                    <div className="h-full w-1/3 rounded bg-cyan-900/60 border border-cyan-500/30" />
                    <div className="h-full w-2/3 rounded bg-slate-900/80 border border-cyan-500/20" />
                  </div>
                </button>

                {/* Theme 3: Full Dark (ChatGPT style) */}
                <button
                  type="button"
                  onClick={() => handleThemeChange('fulldark')}
                  className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between group ${
                    theme === 'fulldark'
                      ? 'border-zinc-400 bg-[#212121] shadow-md ring-1 ring-zinc-400/40'
                      : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-xs text-[#ececec]">
                        Full Dark
                      </span>
                      {theme === 'fulldark' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-700/50">
                          <Check size={10} /> Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
                      ChatGPT-style high-contrast pure dark mode with deep black backdrop and flat clean stream.
                    </p>
                  </div>
                  {/* Visual preview swatch */}
                  <div className="h-6 w-full rounded-md bg-[#0d0d0d] border border-[#2f2f2f] p-1 flex items-center gap-1">
                    <div className="h-full w-1/3 rounded bg-[#212121]" />
                    <div className="h-full w-2/3 rounded bg-[#2f2f2f]" />
                  </div>
                </button>
              </div>
            </div>

            <div className="h-px bg-zinc-800" />

            {/* Section 2: Language Setting */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Languages size={15} className="text-cyan-400" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    Response Language
                  </h4>
                </div>
                {responseLanguage ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-700/50 flex items-center gap-1">
                    <Check size={11} /> {responseLanguage}
                  </span>
                ) : (
                  <span className="text-[11px] text-zinc-500">
                    English (Default)
                  </span>
                )}
              </div>

              <p className="text-xs text-zinc-400">
                Type any language name in plain words (e.g. <span className="text-zinc-200">Russian</span>, <span className="text-zinc-200">Russia</span>, <span className="text-zinc-200">Japanese</span>, <span className="text-zinc-200">Hindi</span>, <span className="text-zinc-200">Tamil</span>, <span className="text-zinc-200">Spanish</span>, <span className="text-zinc-200">German</span>). NEXUS AI interprets flexibly and will answer in your specified language.
              </p>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={responseLanguage}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    placeholder="e.g. Russian, Japanese, Hindi, Tamil, Spanish, German, French..."
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-900/90 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-500"
                  />
                  {responseLanguage && (
                    <button
                      type="button"
                      onClick={() => handleLanguageChange('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-0.5"
                      title="Clear field"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleResetToEnglish}
                  disabled={!responseLanguage}
                  className={`text-xs px-3 py-2 rounded-xl border flex items-center gap-1.5 transition-all shrink-0 ${
                    responseLanguage
                      ? 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                      : 'border-zinc-800 bg-zinc-900/40 text-zinc-600 cursor-not-allowed opacity-60'
                  }`}
                  title="Reset language back to English (Default)"
                >
                  <RotateCcw size={12} />
                  <span>Reset to English</span>
                </button>
              </div>

              <p className="text-[11px] text-zinc-500 italic">
                Tip: Country names like &quot;Russia&quot; or &quot;Japan&quot; will be automatically inferred as Russian and Japanese.
              </p>
            </div>

            <div className="h-px bg-zinc-800" />

            {/* Section 3: Permanent Memories */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bookmark size={15} className="text-amber-400" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    Permanent Memories
                  </h4>
                </div>
                <span className="text-[11px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-700/60">
                  {permanentMemories.length} {permanentMemories.length === 1 ? 'standing memory' : 'standing memories'}
                </span>
              </div>

              <p className="text-xs text-zinc-400">
                Standing facts, preferences, and personal context that are permanently injected into every AI Assistant turn (shared with Multi Chat).
              </p>

              {/* Add New Memory Input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newMemoryInput}
                  onChange={(e) => setNewMemoryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddPermanentMemory();
                    }
                  }}
                  placeholder="Add a standing fact (e.g. My preferred tech stack is TypeScript and React)..."
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900/90 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-500"
                />
                <button
                  type="button"
                  onClick={handleAddPermanentMemory}
                  disabled={!newMemoryInput.trim()}
                  className={`text-xs px-3 py-2 rounded-xl font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                    newMemoryInput.trim()
                      ? 'bg-zinc-100 text-zinc-900 hover:bg-white cursor-pointer'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
                  }`}
                >
                  <Plus size={13} />
                  <span>Add</span>
                </button>
              </div>

              {/* Permanent Memories List */}
              <div className="space-y-2 pt-1 max-h-[220px] overflow-y-auto pr-1">
                {permanentMemories.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 text-center text-xs text-zinc-500">
                    No permanent memories saved yet. Add facts above to have NEXUS AI always remember them across every conversation.
                  </div>
                ) : (
                  permanentMemories.map((mem, idx) => {
                    const isEditing = editingMemoryIndex === idx;

                    return (
                      <div
                        key={`perm-mem-${idx}`}
                        className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900/90 transition-colors flex items-center justify-between gap-3 text-xs"
                      >
                        {isEditing ? (
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              type="text"
                              value={editingMemoryDraft}
                              onChange={(e) => setEditingMemoryDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveEditPermanentMemory(idx);
                                } else if (e.key === 'Escape') {
                                  handleCancelEditPermanentMemory();
                                }
                              }}
                              className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-100 outline-none focus:border-zinc-400"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditPermanentMemory(idx)}
                              className="p-1 rounded bg-emerald-600/80 hover:bg-emerald-600 text-white"
                              title="Save changes"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEditPermanentMemory}
                              className="p-1 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
                              title="Cancel"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start gap-2 flex-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                              <span className="text-zinc-200 leading-relaxed break-words">
                                {mem}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEditPermanentMemory(idx)}
                                className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                                title="Edit memory"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePermanentMemory(idx)}
                                className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Delete memory"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="h-px bg-zinc-800" />

            {/* Section 4: Multi Chat Mode Toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessagesSquare size={15} className="text-cyan-400" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    Multi Chat (3-Persona Pipeline)
                  </h4>
                </div>
                <span
                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                    multiChatEnabled
                      ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                      : 'bg-zinc-800 text-zinc-500 border-zinc-700/60'
                  }`}
                >
                  {multiChatEnabled ? 'ACTIVE' : 'DISABLED'}
                </span>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">
                When enabled, every message sent in AI Assistant routes through the 3-persona sequential pipeline (NOVA 🧠 → ORBIT 😎 → COSMOS 🧘). Each persona builds upon prior reasoning and displays distinct response cards.
              </p>

              {/* Interactive Toggle Card */}
              <div
                onClick={toggleMultiChat}
                className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  multiChatEnabled
                    ? 'border-cyan-500/40 bg-cyan-950/20 shadow-[0_0_15px_rgba(6,182,212,0.12)]'
                    : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl grid place-items-center transition-colors ${
                      multiChatEnabled
                        ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300'
                        : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
                    }`}
                  >
                    <Bot size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-100 flex items-center gap-2">
                      <span>Enable Multi Chat</span>
                      {multiChatEnabled && (
                        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-1.5 py-0.2 rounded border border-cyan-500/40">
                          NOVA → ORBIT → COSMOS
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {multiChatEnabled
                        ? 'Connected 3-Persona sequential reasoning pipeline is active'
                        : 'Standard single NEXUS AI Assistant responses'}
                    </p>
                  </div>
                </div>

                {/* Toggle Switch */}
                <div
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                    multiChatEnabled ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]' : 'bg-zinc-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                      multiChatEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
              <span className="text-[11px] text-zinc-500">
                All changes are saved automatically to your device.
              </span>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="text-xs font-medium px-4 py-2 rounded-xl bg-zinc-100 text-zinc-900 hover:bg-white transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Memory Management Modal (Short-term scratchpad) */}
      {memoryEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-700/80 bg-[#19191c] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Brain size={16} className="text-cyan-400" />
                <h3 className="text-sm font-semibold text-zinc-100">
                  Short-Term Memory Scratchpad
                </h3>
              </div>
              <span className="text-[11px] text-zinc-500">
                {memoryDraft.length}/{MAX_MEMORY_LENGTH}
              </span>
            </div>

            <p className="text-xs text-zinc-400">
              Short-term scratchpad context derived from recent messages. (For standing facts across all sessions, use Settings &gt; Permanent Memories).
            </p>

            <textarea
              value={memoryDraft}
              onChange={(e) => setMemoryDraft(e.target.value)}
              maxLength={MAX_MEMORY_LENGTH}
              placeholder="e.g. My preferred tech stack is TypeScript and React. Always explain complex concepts concisely."
              rows={6}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 p-3 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500 resize-none font-sans"
            />

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={clearMemory}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 flex items-center gap-1 transition-colors"
              >
                <Trash2 size={13} />
                Clear
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMemoryEditorOpen(false)}
                  className="text-xs px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveMemory}
                  className="text-xs font-medium px-4 py-1.5 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Fullscreen Image Preview Modal */}
      {fullscreenModalImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setFullscreenModalImage(null)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setFullscreenModalImage(null)}
              className="absolute -top-10 right-0 p-2 text-zinc-400 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-all"
              title="Close Fullscreen"
            >
              <X size={18} />
            </button>
            <img
              src={fullscreenModalImage}
              alt="Fullscreen Preview"
              className="max-h-[85vh] w-auto max-w-full rounded-xl shadow-2xl object-contain border border-zinc-800"
            />
          </div>
        </div>
      )}
    </div>
  );
}
