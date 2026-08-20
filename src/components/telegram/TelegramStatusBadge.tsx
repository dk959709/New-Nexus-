import React from 'react';
import { Bot, RefreshCw, Radio } from 'lucide-react';

interface TelegramStatusBadgeProps {
  connected: boolean;
  botInfo: { id: number; username: string; first_name: string } | null;
  lastPolledAt?: Date | null;
  isPolling?: boolean;
  activityCount?: number;
  onRefresh?: () => void;
}

export const TelegramStatusBadge: React.FC<TelegramStatusBadgeProps> = ({
  connected,
  botInfo,
  lastPolledAt,
  isPolling,
  onRefresh,
}) => {
  return (
    <div
      id="telegram-connection-status-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        padding: '14px 18px',
        borderRadius: '12px',
        background: connected ? 'rgba(97, 215, 201, 0.06)' : 'rgba(239, 68, 68, 0.06)',
        border: `1px solid ${connected ? 'rgba(97, 215, 201, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            position: 'relative',
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: connected ? 'rgba(97, 215, 201, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            display: 'grid',
            placeItems: 'center',
            color: connected ? 'var(--accent)' : '#f87171',
          }}
        >
          <Bot size={20} />
          {connected && (
            <span
              style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 8px #10b981',
                border: '2px solid #071016',
              }}
            />
          )}
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              id="telegram-live-status-indicator"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 10px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.3px',
                background: connected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: connected ? '#34d399' : '#f87171',
                border: `1px solid ${connected ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
              }}
            >
              {connected ? '🟢 Bot Online' : '🔴 Disconnected'}
            </span>

            {connected && botInfo && (
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                @{botInfo.username}
              </span>
            )}
          </div>

          <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '4px 0 0' }}>
            {connected
              ? `Listening for incoming commands & scheduled briefings (ID: ${botInfo?.id || '—'})`
              : 'Bot is offline. Provide a valid token from @BotFather to activate live responses.'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {connected && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              color: 'var(--muted)',
            }}
          >
            <Radio size={12} style={{ color: '#10b981', animation: 'pulse 2s infinite' }} />
            <span>
              Live Polling Active
              {lastPolledAt && ` · ${lastPolledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
            </span>
          </div>
        )}

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh connection status"
            aria-label="Refresh status"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--line)',
              color: 'var(--muted)',
              padding: '6px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <RefreshCw
              size={13}
              style={{
                animation: isPolling ? 'spin 1s linear infinite' : 'none',
              }}
            />
          </button>
        )}
      </div>
    </div>
  );
};
