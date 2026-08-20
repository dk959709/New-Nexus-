import React, { useState } from 'react';
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Trash2,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { api } from '@/services/api';
import type { TelegramActivityItem } from '@/types';

interface TelegramActivityLogProps {
  activities: TelegramActivityItem[];
  loading?: boolean;
  onRefresh: () => void;
  onClear: () => void;
}

export const TelegramActivityLog: React.FC<TelegramActivityLogProps> = ({
  activities,
  loading = false,
  onRefresh,
  onClear,
}) => {
  const [filter, setFilter] = useState<'all' | 'incoming' | 'outgoing' | 'command' | 'alert' | 'blocked'>('all');
  const [clearing, setClearing] = useState(false);

  const filteredActivities = activities.filter((act) => {
    if (filter === 'all') return true;
    if (filter === 'incoming') return act.direction === 'incoming';
    if (filter === 'outgoing') return act.direction === 'outgoing';
    if (filter === 'command') return act.type === 'command' || Boolean(act.command);
    if (filter === 'alert') return act.type === 'alert' || act.type === 'automation';
    if (filter === 'blocked') return act.status === 'blocked';
    return true;
  });

  const handleClear = async () => {
    setClearing(true);
    try {
      await api.telegramClearActivity();
      onClear();
    } catch (err) {
      console.error('Failed to clear activity log:', err);
    } finally {
      setClearing(false);
    }
  };

  const formatTime = (timestamp: number) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return 'Just now';
    }
  };

  const getStatusBadge = (status: TelegramActivityItem['status']) => {
    switch (status) {
      case 'delivered':
        return (
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              fontWeight: 600,
            }}
          >
            Delivered
          </span>
        );
      case 'processed':
        return (
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '10px',
              background: 'rgba(97, 215, 201, 0.15)',
              color: 'var(--accent)',
              border: '1px solid rgba(97, 215, 201, 0.3)',
              fontWeight: 600,
            }}
          >
            Processed
          </span>
        );
      case 'blocked':
        return (
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              fontWeight: 600,
            }}
          >
            Blocked
          </span>
        );
      case 'error':
        return (
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '10px',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#fbbf24',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              fontWeight: 600,
            }}
          >
            Error
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      id="telegram-activity-log-section"
      style={{
        background: 'rgba(7,16,22,0.6)',
        border: '1px solid var(--line)',
        borderRadius: '12px',
        padding: '18px',
        display: 'grid',
        gap: '14px',
      }}
    >
      {/* Header */}
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
            <Activity size={16} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h3 style={{ fontSize: '15px', margin: 0 }}>Recent Activity Log</h3>
              <span
                style={{
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'var(--muted)',
                }}
              >
                {activities.length} recorded
              </span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '2px 0 0' }}>
              Live stream of messages sent and received through the Telegram bot
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh logs"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 10px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--line)',
              color: 'var(--muted)',
              borderRadius: '6px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            <span>Refresh</span>
          </button>

          {activities.length > 0 && (
            <button
              id="clear-telegram-activity-btn"
              type="button"
              onClick={handleClear}
              disabled={clearing}
              title="Clear activity log"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#f87171',
                borderRadius: '6px',
                fontSize: '11px',
                cursor: clearing ? 'not-allowed' : 'pointer',
              }}
            >
              <Trash2 size={12} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          paddingBottom: '4px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        {(
          [
            { id: 'all', label: 'All Events' },
            { id: 'incoming', label: '📥 Incoming' },
            { id: 'outgoing', label: '📤 Outgoing' },
            { id: 'command', label: '⚡ Commands' },
            { id: 'alert', label: '🔔 Alerts' },
            { id: 'blocked', label: '🚫 Blocked' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
              background: filter === tab.id ? 'var(--accent)' : 'transparent',
              color: filter === tab.id ? '#071016' : 'var(--muted)',
              border: filter === tab.id ? 0 : '1px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Activities List */}
      <div
        style={{
          maxHeight: '340px',
          overflowY: 'auto',
          display: 'grid',
          gap: '8px',
          paddingRight: '2px',
        }}
      >
        {filteredActivities.length === 0 ? (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
              color: 'var(--muted)',
              fontSize: '12px',
              background: 'rgba(14,31,39,0.3)',
              borderRadius: '8px',
              border: '1px dashed var(--line)',
            }}
          >
            No activity logs match the selected filter yet. Send a test message or command to see live telemetry!
          </div>
        ) : (
          filteredActivities.map((act) => (
            <div
              key={act.id}
              style={{
                background: 'rgba(14,31,39,0.6)',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                padding: '10px 12px',
                display: 'grid',
                gap: '6px',
                fontSize: '12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: act.direction === 'incoming' ? '#60a5fa' : 'var(--accent)',
                    }}
                  >
                    {act.direction === 'incoming' ? (
                      <ArrowDownLeft size={13} style={{ color: '#60a5fa' }} />
                    ) : (
                      <ArrowUpRight size={13} style={{ color: 'var(--accent)' }} />
                    )}
                    {act.sender}
                  </span>

                  {act.chatId && (
                    <span style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'monospace' }}>
                      (ID: {act.chatId})
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {getStatusBadge(act.status)}
                  <span style={{ fontSize: '10px', color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <Clock size={10} />
                    {formatTime(act.timestamp)}
                  </span>
                </div>
              </div>

              <div
                style={{
                  color: '#fff',
                  lineHeight: 1.45,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: '12px',
                }}
              >
                {act.text}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
