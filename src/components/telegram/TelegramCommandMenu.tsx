import React, { useState } from 'react';
import { Terminal, RefreshCw, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import { api } from '@/services/api';
import type { TelegramBotCommand } from '@/types';

interface TelegramCommandMenuProps {
  connected: boolean;
  onSendCommandTest?: (cmd: string) => void;
}

const defaultBotCommands: TelegramBotCommand[] = [
  { command: 'weather', description: 'Get live weather conditions, forecasts & sunrise/sunset' },
  { command: 'search', description: 'Search the web using Google Search API' },
  { command: 'news', description: 'Retrieve latest global headlines and breaking news' },
  { command: 'space', description: 'Get ISS live orbit telemetry & space news' },
  { command: 'help', description: 'Display available Nexus bot commands and shortcuts' },
  { command: 'start', description: 'Welcome greeting and interactive quick actions menu' },
];

export const TelegramCommandMenu: React.FC<TelegramCommandMenuProps> = ({
  connected,
  onSendCommandTest,
}) => {
  const [commands, setCommands] = useState<TelegramBotCommand[]>(defaultBotCommands);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; msg: string } | null>(null);

  const handleSyncCommands = async () => {
    if (!connected) return;
    setSyncing(true);
    setSyncResult(null);

    try {
      const res = await api.telegramSyncCommands();
      if (res.commands && res.commands.length > 0) {
        setCommands(res.commands);
      }
      setSyncResult({
        success: true,
        msg: `Successfully registered ${res.commands?.length || 6} commands with Telegram Bot API!`,
      });
      setTimeout(() => setSyncResult(null), 4000);
    } catch (err: unknown) {
      setSyncResult({
        success: false,
        msg: err instanceof Error ? err.message : 'Failed to register commands with Telegram.',
      });
      setTimeout(() => setSyncResult(null), 5000);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div
      id="telegram-commands-menu-section"
      style={{
        background: 'rgba(7,16,22,0.6)',
        border: '1px solid var(--line)',
        borderRadius: '12px',
        padding: '18px',
        display: 'grid',
        gap: '14px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(97,215,201,0.12)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--accent)',
            }}
          >
            <Terminal size={16} />
          </div>
          <div>
            <h3 style={{ fontSize: '15px', margin: 0 }}>Command List & Bot Menu</h3>
            <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '2px 0 0' }}>
              Commands registered via Telegram <code>setMyCommands</code> API appear as suggestions when typing "/"
            </p>
          </div>
        </div>

        <button
          id="sync-telegram-commands-btn"
          type="button"
          onClick={handleSyncCommands}
          disabled={!connected || syncing}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 12px',
            background: connected ? 'rgba(97,215,201,0.15)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${connected ? 'rgba(97,215,201,0.3)' : 'var(--line)'}`,
            color: connected ? 'var(--accent)' : 'var(--muted)',
            borderRadius: '7px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: connected && !syncing ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
          }}
        >
          <RefreshCw
            size={13}
            style={{
              animation: syncing ? 'spin 1s linear infinite' : 'none',
            }}
          />
          {syncing ? 'Syncing with Telegram...' : 'Sync Commands to Telegram'}
        </button>
      </div>

      {syncResult && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            background: syncResult.success ? 'rgba(97, 215, 201, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${syncResult.success ? 'rgba(97, 215, 201, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
            color: syncResult.success ? 'var(--accent)' : '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {syncResult.success ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {syncResult.msg}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '10px',
        }}
      >
        {commands.map((cmd) => (
          <div
            key={cmd.command}
            style={{
              background: 'rgba(14,31,39,0.7)',
              border: '1px solid var(--line)',
              borderRadius: '8px',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--accent)',
                  background: 'rgba(97,215,201,0.1)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                /{cmd.command}
              </span>

              {onSendCommandTest && (
                <button
                  type="button"
                  onClick={() => onSendCommandTest(`/${cmd.command}`)}
                  title={`Test /${cmd.command} in simulator`}
                  style={{
                    background: 'transparent',
                    border: 0,
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
                >
                  <Send size={11} /> Test
                </button>
              )}
            </div>

            <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)', lineHeight: 1.4 }}>
              {cmd.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
