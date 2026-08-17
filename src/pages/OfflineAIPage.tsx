import { useState } from 'react';
import { Brain, Send, Download, Loader2 } from 'lucide-react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export function OfflineAIPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingModel, setLoadingModel] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState('');

  const loadModel = async () => {
    if (modelReady || loadingModel) return;

    setLoadingModel(true);
    setError('');
    setProgress(0);

    try {
      const { loadOfflineAI } = await import('@/services/offlineAI');

      await loadOfflineAI((value) => {
        setProgress(value);
      });

      setModelReady(true);
      setProgress(100);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load the offline AI model.',
      );
    } finally {
      setLoadingModel(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();

    if (!text || thinking) return;

    setInput('');
    setError('');

    setMessages((current) => [
      ...current,
      { role: 'user', content: text },
    ]);

    setThinking(true);

    try {
      const { askOfflineAI } = await import('@/services/offlineAI');

      let streamed = '';

      const answer = await askOfflineAI(text, (token) => {
        streamed += token;

        setMessages((current) => {
          const next = [...current];

          const last = next[next.length - 1];

          if (last?.role === 'assistant') {
            next[next.length - 1] = {
              role: 'assistant',
              content: streamed,
            };
          } else {
            next.push({
              role: 'assistant',
              content: streamed,
            });
          }

          return next;
        });
      });

      if (!streamed) {
        setMessages((current) => [
          ...current,
          {
            role: 'assistant',
            content: answer || 'I could not generate a response.',
          },
        ]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Offline AI could not generate a response.',
      );
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="assistant-page">
      <div className="page-intro">
        <span className="eyebrow">OFFLINE AI</span>
        <h1>Private intelligence.</h1>
        <p>
          Run LFM2.5 locally in your browser. Your conversation is not sent
          to the online NEXUS AI service.
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
              <Brain size={21} />
            </span>

            <div>
              <strong>Offline AI</strong>
              <div style={{ fontSize: 12, opacity: 0.65 }}>
                LFM2.5 350M · WebGPU · Local
              </div>
            </div>
          </div>

          <span
            style={{
              fontSize: 12,
              padding: '6px 10px',
              borderRadius: 999,
              background: modelReady
                ? 'rgba(97,221,210,.12)'
                : 'rgba(255,255,255,.06)',
              color: modelReady ? '#61ddd2' : 'inherit',
            }}
          >
            {modelReady ? 'READY' : 'NOT LOADED'}
          </span>
        </header>

        {!modelReady && (
          <div
            style={{
              margin: 18,
              padding: 20,
              borderRadius: 16,
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.08)',
              textAlign: 'center',
            }}
          >
            <Brain size={38} style={{ marginBottom: 10 }} />

            <h2 style={{ margin: '0 0 8px' }}>
              Load LFM2.5
            </h2>

            <p style={{ opacity: 0.7, marginBottom: 16 }}>
              The model downloads once to this browser's local storage/cache.
              After loading, inference runs locally.
            </p>

            {loadingModel && (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    height: 8,
                    borderRadius: 999,
                    background: 'rgba(255,255,255,.08)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${progress}%`,
                      height: '100%',
                      background: '#61ddd2',
                      transition: 'width .2s ease',
                    }}
                  />
                </div>

                <small style={{ opacity: 0.65 }}>
                  Loading model… {progress}%
                </small>
              </div>
            )}

            <button
              type="button"
              onClick={loadModel}
              disabled={loadingModel}
              style={{
                border: 0,
                borderRadius: 12,
                padding: '12px 18px',
                cursor: loadingModel ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {loadingModel ? (
                <Loader2 size={18} />
              ) : (
                <Download size={18} />
              )}

              {loadingModel ? 'Loading LFM2.5…' : 'Load Offline AI'}
            </button>
          </div>
        )}

        <div
          style={{
            flex: 1,
            padding: 18,
            overflowY: 'auto',
          }}
        >
          {!messages.length && modelReady && (
            <div
              style={{
                minHeight: 300,
                display: 'grid',
                placeItems: 'center',
                textAlign: 'center',
                opacity: 0.7,
              }}
            >
              <div>
                <Brain size={42} />
                <h2>Offline AI is ready</h2>
                <p>
                  Ask LFM2.5 a question. Processing happens locally.
                </p>
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              style={{
                marginBottom: 14,
                padding: 14,
                borderRadius: 14,
                background:
                  message.role === 'user'
                    ? 'rgba(97,221,210,.08)'
                    : 'rgba(255,255,255,.05)',
              }}
            >
              <strong>
                {message.role === 'user'
                  ? 'You'
                  : 'NEXUS Offline AI'}
              </strong>

              <div
                style={{
                  marginTop: 6,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {message.content}
              </div>
            </div>
          ))}

          {thinking && (
            <div style={{ opacity: 0.65 }}>
              NEXUS Offline AI is thinking…
            </div>
          )}
        </div>

        {error && (
          <div
            style={{
              margin: '0 14px 14px',
              padding: 12,
              borderRadius: 12,
              background: 'rgba(255,80,80,.08)',
              color: '#ff9a9a',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 10,
            padding: 14,
            borderTop: '1px solid rgba(255,255,255,.08)',
          }}
        >
          <input
            value={input}
            disabled={!modelReady || thinking}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void sendMessage();
              }
            }}
            placeholder={
              modelReady
                ? 'Ask Offline AI…'
                : 'Load the model first…'
            }
            style={{
              flex: 1,
              minWidth: 0,
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,.12)',
              background: 'rgba(255,255,255,.05)',
              color: 'inherit',
              outline: 'none',
            }}
          />

          <button
            type="button"
            disabled={!modelReady || thinking || !input.trim()}
            onClick={() => void sendMessage()}
            aria-label="Send message"
            style={{
              width: 46,
              border: 0,
              borderRadius: 12,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            <Send size={19} />
          </button>
        </div>
      </section>
    </div>
  );
}
