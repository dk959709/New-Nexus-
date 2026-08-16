import { useEffect, useState } from 'react';
import { Bot, Send, Sparkles, User, Trash2, Plus, Brain } from 'lucide-react';
import { api } from '@/services/api';
import { ErrorMessage } from '@/components';

type Source = {
  title: string;
  url: string;
  domain?: string;
  description?: string;
  date?: string;
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
  tool?: 'none' | 'search' | 'weather';
  sources?: Source[];
};

const CHAT_KEY = 'nexus-ai-conversation-v2';
const MEMORY_KEY = 'nexus-ai-smart-memory-v1';

const RECENT_MESSAGES = 8;
const MAX_MEMORY_LENGTH = 1200;

const QUICK_PROMPTS = [
  'Explain something simply',
  'Help me solve a problem',
  'Give me productivity tips',
  'Summarize a topic',
];

const welcomeMessage: Message = {
  role: 'assistant',
  content:
    "Hi! I'm NEXUS AI. Ask me anything and I'll help with explanations, ideas, problem solving, summaries, and more.",
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
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [memoryEditorOpen, setMemoryEditorOpen] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState(smartMemory);

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

  const sendMessage = async (value = input) => {
    const message = value.trim();

    if (!message || loading) return;

    setInput('');
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

    try {
      const response = await api.aiChat(
        message,
        historyForRequest,
        smartMemory,
      );

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.answer,
        tool: response.tool,
        sources: response.sources,
      };

      setMessages((current) => [...current, assistantMessage]);

      // Keep a compact local memory instead of sending the full conversation.
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
  };

  const clearMemory = () => {
    setSmartMemory('');
    setMemoryDraft('');
    setMemoryEditorOpen(false);
    setMessages([welcomeMessage]);
    setError('');

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

  const saveMemory = () => {
    const cleaned = memoryDraft.trim().slice(-MAX_MEMORY_LENGTH);
    setSmartMemory(cleaned);
    setMemoryDraft(cleaned);
    setMemoryEditorOpen(false);
  };

  return (
    <div className="assistant-page">
      <div className="page-intro">
        <span className="eyebrow">NEXUS AI</span>
        <h1>Ask the intelligence.</h1>
        <p>
          Chat with NEXUS AI for answers, explanations, ideas,
          summaries, and problem solving.
        </p>
      </div>

      <section
        className="assistant-shell"
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '65vh',
          border: '1px solid rgba(100,220,210,.18)',
          borderRadius: 20,
          overflow: 'hidden',
          background: 'rgba(8,24,30,.72)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '16px 18px',
            borderBottom: '1px solid rgba(255,255,255,.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                width: 40,
                height: 40,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 12,
                color: '#61ddd2',
                background: 'rgba(97,221,210,.1)',
              }}
            >
              <Bot size={21} />
            </span>

            <div>
              <strong>NEXUS AI</strong>

              <small
                style={{
                  display: 'block',
                  opacity: 0.55,
                  marginTop: 2,
                }}
              >
                DeepSeek · OpenRouter · Smart Memory
              </small>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="icon-button"
              onClick={newChat}
              aria-label="New chat"
              title="New chat"
              type="button"
            >
              <Plus size={18} />
            </button>

            <button
              className="icon-button"
              onClick={clearMemory}
              aria-label="Clear memory"
              title="Clear memory"
              type="button"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </header>

        <div
          style={{
            padding: '10px 18px',
            borderBottom: '1px solid rgba(255,255,255,.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              fontSize: 12,
              opacity: 0.7,
            }}
          >
            <Brain size={14} />
            <span>
              {smartMemory
                ? 'Memory saved locally'
                : 'No saved memories'}
            </span>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={openMemoryEditor}
            title="Manage memory"
            aria-label="Manage memory"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 10px',
            }}
          >
            <Brain size={14} />
            <span style={{ fontSize: 12 }}>Manage</span>
          </button>
        </div>

        {memoryEditorOpen && (
          <div
            style={{
              margin: '12px 18px',
              padding: 14,
              borderRadius: 14,
              border: '1px solid rgba(97,221,210,.18)',
              background: 'rgba(97,221,210,.045)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                marginBottom: 8,
              }}
            >
              <strong style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Brain size={16} />
                AI Memory
              </strong>

              <small style={{ opacity: 0.5 }}>
                Stored on this device
              </small>
            </div>

            <p style={{ fontSize: 12, opacity: 0.6, margin: '0 0 10px' }}>
              Edit what NEXUS AI should remember. Keep it short and useful.
            </p>

            <textarea
              value={memoryDraft}
              onChange={(event) => setMemoryDraft(event.target.value)}
              maxLength={MAX_MEMORY_LENGTH}
              placeholder="Example: My name is Alex. I like space photography."
              rows={5}
              style={{
                width: '100%',
                resize: 'vertical',
                boxSizing: 'border-box',
                padding: 12,
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,.1)',
                background: 'rgba(0,0,0,.2)',
                color: '#e8f0f2',
                outline: 'none',
                font: 'inherit',
              }}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                marginTop: 10,
                flexWrap: 'wrap',
              }}
            >
              <small style={{ opacity: 0.45 }}>
                {memoryDraft.length}/{MAX_MEMORY_LENGTH}
              </small>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setMemoryEditorOpen(false)}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="icon-button"
                  onClick={clearMemory}
                  title="Delete all memory"
                >
                  <Trash2 size={14} />
                  Clear
                </button>

                <button
                  type="button"
                  className="icon-button"
                  onClick={saveMemory}
                  title="Save memory"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        <div
          style={{
            padding: '8px 18px',
            borderBottom: '1px solid rgba(255,255,255,.05)',
            fontSize: 12,
            opacity: 0.55,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Brain size={14} />
          {smartMemory
            ? 'Smart memory active · recent context only'
            : 'Smart memory ready'}
        </div>

        <div
          style={{
            flex: 1,
            padding: 18,
            overflowY: 'auto',
          }}
        >
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              style={{
                display: 'flex',
                justifyContent:
                  message.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  maxWidth: '88%',
                  flexDirection:
                    message.role === 'user' ? 'row-reverse' : 'row',
                }}
              >
                <span
                  style={{
                    flex: '0 0 auto',
                    width: 32,
                    height: 32,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 10,
                    color:
                      message.role === 'user'
                        ? '#8fa4ad'
                        : '#61ddd2',
                    background:
                      message.role === 'user'
                        ? 'rgba(255,255,255,.06)'
                        : 'rgba(97,221,210,.1)',
                  }}
                >
                  {message.role === 'user' ? (
                    <User size={16} />
                  ) : (
                    <Sparkles size={16} />
                  )}
                </span>

                <div style={{ width: '100%' }}>
                  {message.role === 'assistant' && message.tool === 'search' && (
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.7,
                        marginBottom: 6,
                        color: '#61ddd2',
                      }}
                    >
                      🔎 NEXUS Search
                    </div>
                  )}

                  {message.role === 'assistant' && message.tool === 'weather' && (
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.7,
                        marginBottom: 6,
                        color: '#61ddd2',
                      }}
                    >
                      🌤️ Weather data
                    </div>
                  )}

                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 15,
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    color: '#e8f0f2',
                    background:
                      message.role === 'user'
                        ? 'rgba(97,221,210,.12)'
                        : 'rgba(255,255,255,.055)',
                    border: '1px solid rgba(255,255,255,.07)',
                  }}
                >
                    {message.content}
                  </div>

                  {message.role === 'assistant' &&
                    message.tool === 'search' &&
                    message.sources?.length ? (
                    <div
                      style={{
                        display: 'grid',
                        gap: 8,
                        marginTop: 10,
                      }}
                    >
                      {message.sources.slice(0, 5).map((source, sourceIndex) => (
                        <a
                          key={`${source.url}-${sourceIndex}`}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'block',
                            padding: '10px 12px',
                            borderRadius: 12,
                            textDecoration: 'none',
                            color: 'inherit',
                            background: 'rgba(255,255,255,.035)',
                            border: '1px solid rgba(255,255,255,.07)',
                          }}
                        >
                          <strong
                            style={{
                              display: 'block',
                              fontSize: 13,
                              marginBottom: 3,
                            }}
                          >
                            {source.title}
                          </strong>

                          <span
                            style={{
                              display: 'block',
                              fontSize: 11,
                              opacity: 0.55,
                              marginBottom: source.description ? 4 : 0,
                            }}
                          >
                            {source.domain || source.url}
                            {source.date ? ` · ${source.date}` : ''}
                          </span>

                          {source.description && (
                            <span
                              style={{
                                display: 'block',
                                fontSize: 12,
                                lineHeight: 1.4,
                                opacity: 0.7,
                              }}
                            >
                              {source.description}
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                opacity: 0.7,
                padding: '8px 0',
              }}
            >
              <Sparkles size={17} />
              <span>NEXUS AI is thinking...</span>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 8 }}>
              <ErrorMessage message={error} />
            </div>
          )}
        </div>

        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(255,255,255,.07)',
          }}
        >
          {!input && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                paddingBottom: 10,
              }}
            >
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="secondary-button"
                  onClick={() => sendMessage(prompt)}
                  disabled={loading}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 10,
            }}
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask NEXUS AI anything..."
              aria-label="Message NEXUS AI"
              rows={1}
              disabled={loading}
              style={{
                flex: 1,
                resize: 'none',
                minHeight: 48,
                maxHeight: 140,
                padding: '13px 14px',
                borderRadius: 13,
                border: '1px solid rgba(97,221,210,.2)',
                background: 'rgba(5,18,23,.8)',
                color: 'inherit',
                font: 'inherit',
                outline: 'none',
              }}
            />

            <button
              className="search-submit"
              type="submit"
              disabled={!input.trim() || loading}
              aria-label="Send message"
              style={{
                minWidth: 50,
                minHeight: 48,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Send size={18} />
            </button>
          </form>

          <small
            style={{
              display: 'block',
              textAlign: 'center',
              opacity: 0.42,
              marginTop: 8,
            }}
          >
            Recent context + compact memory · saved on this device
          </small>
        </div>
      </section>
    </div>
  );
}
