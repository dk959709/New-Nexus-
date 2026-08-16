import { useEffect, useState } from 'react';
import { Bot, Send, Sparkles, User, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import { ErrorMessage } from '@/components';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

const QUICK_PROMPTS = [
  'Explain something simply',
  'Help me solve a problem',
  'Give me productivity tips',
  'Summarize a topic',
];

const MEMORY_KEY = 'nexus-ai-conversation-v1';
const MAX_MEMORY_MESSAGES = 20;

const welcomeMessage: Message = {
  role: 'assistant',
  content:
    "Hi! I'm NEXUS AI. Ask me anything and I'll help with explanations, ideas, problem solving, summaries, and more.",
};

function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
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

    return messages.length
      ? messages.slice(-MAX_MEMORY_MESSAGES)
      : [welcomeMessage];
  } catch {
    return [welcomeMessage];
  }
}

export function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(
        MEMORY_KEY,
        JSON.stringify(messages.slice(-MAX_MEMORY_MESSAGES)),
      );
    } catch {
      // Storage can be unavailable in private/restricted browser modes.
    }
  }, [messages]);

  const sendMessage = async (value = input) => {
    const message = value.trim();
    if (!message || loading) return;

    setInput('');
    setError('');

    setMessages((current) => [
      ...current,
      { role: 'user', content: message },
    ]);

    setLoading(true);

    try {
      const history = messages.slice(-MAX_MEMORY_MESSAGES);
      const response = await api.aiChat(message, history);

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: response.answer,
        },
      ]);
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

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content:
          "Chat cleared. I'm ready for your next question.",
      },
    ]);
    setError('');
    try {
      localStorage.removeItem(MEMORY_KEY);
    } catch {
      // Ignore storage errors.
    }
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
                DeepSeek · OpenRouter · Memory on
              </small>
            </div>
          </div>

          <button
            className="icon-button"
            onClick={clearChat}
            aria-label="Clear chat and memory"
            title="Clear chat and memory"
          >
            <Trash2 size={18} />
          </button>
        </header>

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
                    border:
                      '1px solid rgba(255,255,255,.07)',
                  }}
                >
                  {message.content}
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
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey
                ) {
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
                border:
                  '1px solid rgba(97,221,210,.2)',
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
            Conversation memory is saved on this device · Enter to send · Shift+Enter for a new line
          </small>
        </div>
      </section>
    </div>
  );
}
