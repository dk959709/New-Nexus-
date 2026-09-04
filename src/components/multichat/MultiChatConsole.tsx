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
  Loader2,
  Share2,
  Sliders,
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { copyToClipboard } from '@/lib/clipboard';
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

const QUICK_STARTERS = [
  'What is quantum entanglement and how does it challenge classical physics?',
  'Give me actionable advice for staying motivated when working on long projects.',
  'Explain how machine learning differs from human reasoning.',
  'How do I balance high career ambition with everyday mindfulness?',
];

export function MultiChatConsole({ config, onNavigateToSettings }: MultiChatConsoleProps) {
  const [messages, setMessages] = useState<MultiChatMessage[]>(() => storage.getMultiChatMessages());
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [playingAudioKey, setPlayingAudioKey] = useState<string | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
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
        conversationHistory: messages, // History of previous turns for context
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

  const handleToggleAudio = (text: string, idKey: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported in this browser.');
      return;
    }

    if (playingAudioKey === idKey) {
      window.speechSynthesis.cancel();
      setPlayingAudioKey(null);
      return;
    }

    window.speechSynthesis.cancel();
    // Clean markdown stars and special symbols for natural speech
    const cleanText = text
      .replace(/[*_#`~[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = idKey.includes('orbit') ? 1.1 : idKey.includes('cosmos') ? 0.9 : 1.0;
    utterance.onend = () => setPlayingAudioKey(null);
    utterance.onerror = () => setPlayingAudioKey(null);

    setPlayingAudioKey(idKey);
    window.speechSynthesis.speak(utterance);
  };

  const handleClearHistory = () => {
    storage.clearMultiChatMessages();
    setMessages([]);
    setShowClearModal(false);
  };

  const handleExportTranscript = async () => {
    if (messages.length === 0) return;

    const transcriptLines: string[] = ['# NEXUS // MULTI CHAT TRANSCRIPT', `Exported on: ${new Date().toLocaleString()}`, ''];

    for (const msg of messages) {
      transcriptLines.push(`### 👤 USER INQUIRY (${new Date(msg.timestamp).toLocaleTimeString()})`);
      transcriptLines.push(msg.query);
      transcriptLines.push('');
      for (const resp of msg.responses) {
        transcriptLines.push(`#### ${resp.icon} ${resp.name} [${resp.toneBadge || 'Persona'}]`);
        if (resp.status === 'completed') {
          transcriptLines.push(resp.text);
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

  return (
    <div className="flex flex-col gap-6" style={{ maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
      {/* Top Console Status Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 18px',
          background: 'linear-gradient(135deg, rgba(8, 20, 32, 0.85) 0%, rgba(4, 12, 20, 0.95) 100%)',
          borderRadius: '14px',
          border: '1px solid rgba(97, 215, 201, 0.25)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Personas active badges */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontFamily: 'DM Mono', color: 'var(--muted)', fontWeight: 700 }}>
            CONNECTED PERSONAS:
          </span>

          {Object.values(config.personas).map((persona) => (
            <div
              key={persona.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '8px',
                background: persona.enabled ? `${persona.accentColor}18` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${persona.enabled ? persona.accentColor + '44' : 'rgba(255,255,255,0.1)'}`,
                opacity: persona.enabled ? 1 : 0.45,
              }}
            >
              <span>{persona.icon}</span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: persona.enabled ? persona.accentColor : 'var(--muted)',
                }}
              >
                {persona.name}
              </span>
              <span
                style={{
                  fontSize: '9px',
                  fontFamily: 'DM Mono',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#94a3b8',
                }}
              >
                {persona.modelId.split('/').pop() || 'chat'}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {messages.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleExportTranscript}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#cbd5e1',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                title="Copy entire conversation history as Markdown"
              >
                <Share2 size={13} />
                Export
              </button>

              <button
                type="button"
                onClick={() => setShowClearModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                title="Clear conversation history"
              >
                <Trash2 size={13} />
                Clear Chat
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onNavigateToSettings}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'rgba(97, 215, 201, 0.12)',
              border: '1px solid rgba(97, 215, 201, 0.3)',
              color: '#61d7c9',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Sliders size={13} />
            Configure
          </button>
        </div>
      </div>

      {/* Messages Thread or Welcome Hero */}
      <div className="flex flex-col gap-8">
        {messages.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              borderRadius: '20px',
              background: 'linear-gradient(150deg, rgba(8, 22, 34, 0.7) 0%, rgba(4, 12, 18, 0.9) 100%)',
              border: '1px solid rgba(97, 215, 201, 0.25)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '24px',
            }}
          >
            {/* 3 Personas Showcase Hero */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '18px',
                  background: 'rgba(97, 215, 201, 0.15)',
                  border: '1px solid rgba(97, 215, 201, 0.4)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '32px',
                  boxShadow: '0 0 24px rgba(97, 215, 201, 0.25)',
                }}
              >
                🧠
              </div>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '18px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '32px',
                  boxShadow: '0 0 24px rgba(245, 158, 11, 0.25)',
                }}
              >
                😎
              </div>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '18px',
                  background: 'rgba(129, 140, 248, 0.15)',
                  border: '1px solid rgba(129, 140, 248, 0.4)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '32px',
                  boxShadow: '0 0 24px rgba(129, 140, 248, 0.25)',
                }}
              >
                🧘
              </div>
            </div>

            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '24px',
                  fontWeight: 900,
                  color: '#fff',
                  letterSpacing: '-0.02em',
                }}
              >
                Welcome to NEXUS Multi Chat
              </h2>
              <p
                style={{
                  maxWidth: '580px',
                  margin: '8px auto 0',
                  fontSize: '14px',
                  color: 'var(--muted)',
                  lineHeight: 1.6,
                }}
              >
                Ask a single question and receive 3 distinct intellectual perspectives in parallel:
                <br />
                <strong style={{ color: '#61d7c9' }}>NOVA</strong> (factual & deep),{' '}
                <strong style={{ color: '#f59e0b' }}>ORBIT</strong> (casual & fun buddy), and{' '}
                <strong style={{ color: '#818cf8' }}>COSMOS</strong> (calm & wise mentor).
              </p>
            </div>

            {/* Suggested Starter Prompts */}
            <div style={{ width: '100%', maxWidth: '780px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontFamily: 'DM Mono',
                  color: 'var(--accent)',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  marginBottom: '12px',
                }}
              >
                TRY AN INQUIRY
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: '10px',
                }}
              >
                {QUICK_STARTERS.map((starter, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(starter)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '12px',
                      background: 'rgba(10, 26, 40, 0.8)',
                      border: '1px solid rgba(97, 215, 201, 0.25)',
                      color: '#e2e8f0',
                      fontSize: '13px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                    className="hover:border-cyan-400 hover:bg-cyan-950/30"
                  >
                    <Sparkles size={14} className="text-cyan-400 shrink-0" />
                    <span>{starter}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex flex-col gap-4">
              {/* User Inquiry Message Card */}
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, rgba(14, 34, 52, 0.9) 0%, rgba(8, 20, 32, 0.95) 100%)',
                  border: '1px solid rgba(97, 215, 201, 0.35)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'rgba(97, 215, 201, 0.2)',
                    border: '1px solid rgba(97, 215, 201, 0.4)',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#61d7c9',
                    shrink: 0,
                  }}
                >
                  <User size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '4px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        fontFamily: 'DM Mono',
                        color: '#61d7c9',
                        letterSpacing: '0.05em',
                      }}
                    >
                      YOU // INQUIRY
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '15px', color: '#fff', lineHeight: 1.6, fontWeight: 500 }}>
                    {msg.query}
                  </p>
                </div>
              </div>

              {/* Multi-Persona Answers Grid (All 3 side-by-side or stacked grid) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: '16px',
                  alignItems: 'stretch',
                }}
              >
                {msg.responses.map((resp) => {
                  const personaKey = `${msg.id}_${resp.personaId}`;
                  const isPlayingThis = playingAudioKey === personaKey;
                  const isCopied = copiedId === personaKey;

                  return (
                    <div
                      key={resp.personaId}
                      style={{
                        borderRadius: '16px',
                        background: 'linear-gradient(150deg, rgba(8, 22, 34, 0.85) 0%, rgba(4, 12, 18, 0.95) 100%)',
                        border: `1px solid ${resp.accentColor}55`,
                        boxShadow: `0 4px 20px ${resp.accentColor}12`,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Persona Reply Header */}
                      <div
                        style={{
                          padding: '12px 16px',
                          background: `${resp.accentColor}12`,
                          borderBottom: `1px solid ${resp.accentColor}25`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '20px' }}>{resp.icon}</span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                style={{
                                  fontSize: '14px',
                                  fontWeight: 800,
                                  color: '#fff',
                                  letterSpacing: '-0.01em',
                                }}
                              >
                                {resp.name}
                              </span>
                              {resp.toneBadge && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontFamily: 'DM Mono',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    background: `${resp.accentColor}22`,
                                    color: resp.accentColor,
                                    fontWeight: 700,
                                  }}
                                >
                                  {resp.toneBadge}
                                </span>
                              )}
                            </div>
                            {resp.durationMs && (
                              <span style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
                                {(resp.durationMs / 1000).toFixed(1)}s
                                {resp.model ? ` • ${resp.model.split('/').pop()}` : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions for this persona card */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {resp.status === 'completed' && resp.text && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleToggleAudio(resp.text, personaKey)}
                                style={{
                                  padding: '5px',
                                  borderRadius: '6px',
                                  background: isPlayingThis ? `${resp.accentColor}33` : 'rgba(0,0,0,0.3)',
                                  border: `1px solid ${isPlayingThis ? resp.accentColor : 'rgba(255,255,255,0.1)'}`,
                                  color: isPlayingThis ? resp.accentColor : '#cbd5e1',
                                  cursor: 'pointer',
                                }}
                                title={isPlayingThis ? 'Stop Audio' : 'Speak Answer (TTS)'}
                              >
                                {isPlayingThis ? <VolumeX size={14} /> : <Volume2 size={14} />}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCopyText(resp.text, personaKey)}
                                style={{
                                  padding: '5px',
                                  borderRadius: '6px',
                                  background: isCopied ? 'rgba(16,185,129,0.2)' : 'rgba(0,0,0,0.3)',
                                  border: `1px solid ${isCopied ? '#10b981' : 'rgba(255,255,255,0.1)'}`,
                                  color: isCopied ? '#10b981' : '#cbd5e1',
                                  cursor: 'pointer',
                                }}
                                title="Copy answer to clipboard"
                              >
                                {isCopied ? <Check size={14} /> : <Copy size={14} />}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Card Content Body */}
                      <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {resp.status === 'running' && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '24px 12px',
                              color: resp.accentColor,
                              fontSize: '13px',
                              fontFamily: 'DM Mono',
                            }}
                          >
                            <Loader2 size={16} className="animate-spin" />
                            <span>Synthesizing perspective...</span>
                          </div>
                        )}

                        {resp.status === 'failed' && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '10px',
                              padding: '12px',
                              borderRadius: '8px',
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#fca5a5',
                              fontSize: '12px',
                              lineHeight: 1.5,
                            }}
                          >
                            <AlertCircle size={16} className="shrink-0 text-red-400" />
                            <div>
                              <strong style={{ display: 'block', color: '#f87171' }}>Response Generation Failed</strong>
                              <span>{resp.error || 'Provider returned an error.'}</span>
                            </div>
                          </div>
                        )}

                        {resp.status === 'completed' && resp.text && (
                          <div className="prose prose-invert max-w-none text-slate-100 text-sm leading-relaxed">
                            <FormattedText text={resp.text} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Dock Bar (Stationary / Sticky bottom) */}
      <div
        style={{
          position: 'sticky',
          bottom: '16px',
          zIndex: 40,
          background: 'linear-gradient(135deg, rgba(8, 22, 34, 0.95) 0%, rgba(4, 12, 20, 0.98) 100%)',
          borderRadius: '16px',
          border: '1px solid rgba(97, 215, 201, 0.35)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          padding: '12px',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
          <textarea
            ref={inputRef}
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message NOVA, ORBIT, and COSMOS simultaneously... (Shift+Enter for newline)"
            disabled={isGenerating}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(4, 10, 16, 0.9)',
              border: '1px solid rgba(165, 207, 214, 0.25)',
              color: '#fff',
              fontSize: '14px',
              lineHeight: 1.5,
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />

          <button
            type="button"
            onClick={() => handleSend()}
            disabled={isGenerating || !inputText.trim()}
            style={{
              padding: '12px 20px',
              borderRadius: '10px',
              background:
                isGenerating || !inputText.trim()
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'linear-gradient(135deg, var(--accent) 0%, #38bdf8 100%)',
              border: 'none',
              color: isGenerating || !inputText.trim() ? 'var(--muted)' : '#04121a',
              fontWeight: 800,
              fontSize: '14px',
              cursor: isGenerating || !inputText.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: isGenerating || !inputText.trim() ? 'none' : '0 0 16px rgba(97, 215, 201, 0.3)',
              transition: 'all 0.2s',
              height: '48px',
            }}
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Broadcasting...</span>
              </>
            ) : (
              <>
                <span>Send</span>
                <Send size={15} />
              </>
            )}
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '8px',
            padding: '0 4px',
            fontSize: '11px',
            color: 'var(--muted)',
            fontFamily: 'DM Mono',
          }}
        >
          <span>
            Memory active: last 10 messages of conversation history will be passed to each persona
          </span>
          <span>Press Enter to send to all active personas</span>
        </div>
      </div>

      {/* Clear Chat Confirmation Modal */}
      {showClearModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            padding: '16px',
          }}
        >
          <div
            style={{
              maxWidth: '420px',
              width: '100%',
              background: '#071622',
              borderRadius: '16px',
              border: '1px solid rgba(239,68,68,0.4)',
              padding: '24px',
              boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#f87171', marginBottom: '14px' }}>
              <Trash2 size={24} />
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#fff' }}>
                Clear Multi Chat History?
              </h3>
            </div>
            <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: 1.6, margin: '0 0 20px' }}>
              Are you sure you want to clear all conversation inquiries and responses in Multi Chat? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#cbd5e1',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearHistory}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  background: '#ef4444',
                  border: 'none',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Clear History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
