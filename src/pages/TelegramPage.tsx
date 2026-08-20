import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bot,
  Send,
  CheckCircle2,
  AlertCircle,
  Key,
  Hash,
  Trash2,
  MessageSquare,
  Shield,
  ShieldCheck,
  UserPlus,
  X,
  AlertTriangle,
  Lock,
  Unlock,
  Check,
  Clock,
  CloudRain,
  Radio,
  Sliders,
  Play,
  Zap,
} from 'lucide-react';
import { api } from '@/services/api';
import { LoadingMessage } from '@/components';
import {
  TelegramStatusBadge,
  TelegramCommandMenu,
  TelegramActivityLog,
} from '@/components/telegram';
import type { TelegramAutomations, TelegramActivityItem } from '@/types';

const defaultAutomations: TelegramAutomations = {
  dailyWeatherEnabled: true,
  dailyWeatherTime: '07:00',
  dailyWeatherCity: 'London, UK',
  rainAlertEnabled: true,
  rainAlertCity: 'London, UK',
  issAlertEnabled: true,
  issAlertLocationName: 'London, UK',
  issAlertLatitude: 51.5074,
  issAlertLongitude: -0.1278,
  quickRepliesEnabled: true,
};

export function TelegramPage() {
  const [token, setToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [allowedUsers, setAllowedUsers] = useState<string[]>([]);
  const [newUserInput, setNewUserInput] = useState('');
  const [allowedUsersSaving, setAllowedUsersSaving] = useState(false);
  const [allowedUsersSavedNotice, setAllowedUsersSavedNotice] = useState(false);

  // Automations state
  const [automations, setAutomations] = useState<TelegramAutomations>(defaultAutomations);
  const [automationsSaving, setAutomationsSaving] = useState(false);
  const [automationsSavedNotice, setAutomationsSavedNotice] = useState(false);
  const [testingAlert, setTestingAlert] = useState<string | null>(null);
  const [alertFeedback, setAlertFeedback] = useState<{ msg: string; error?: boolean } | null>(null);

  // Connection & Bot state
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [botInfo, setBotInfo] = useState<{ id: number; username: string; first_name: string } | null>(null);
  const [lastPolledAt, setLastPolledAt] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Activity Log state
  const [activities, setActivities] = useState<TelegramActivityItem[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  // Disconnect Confirmation Modal
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Test chat state
  const [testMessage, setTestMessage] = useState('');
  const [chatLogs, setChatLogs] = useState<Array<{ role: 'user' | 'bot'; text: string; time: string }>>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch status and activity
  const refreshStatusAndActivity = useCallback(async (showSpin = false) => {
    if (showSpin) {
      setIsPolling(true);
      setActivitiesLoading(true);
    }
    try {
      const [statusRes, actRes] = await Promise.all([
        api.telegramStatus(),
        api.telegramGetActivity().catch(() => ({ activities: [] })),
      ]);

      if (!isMountedRef.current) return;

      setConnected(statusRes.connected);
      if (statusRes.connected) {
        setBotInfo(statusRes.botInfo ?? null);
        if (statusRes.chatId) setChatId(statusRes.chatId);
        if (statusRes.allowedUsers) setAllowedUsers(statusRes.allowedUsers);
        if (statusRes.automations) {
          setAutomations((prev) => ({ ...prev, ...statusRes.automations }));
        }
      } else {
        setBotInfo(null);
      }

      if (actRes.activities) {
        setActivities(actRes.activities);
      }
      setLastPolledAt(new Date());
    } catch (err) {
      console.warn('Status poll error:', err);
    } finally {
      if (isMountedRef.current) {
        setStatusLoading(false);
        setIsPolling(false);
        setActivitiesLoading(false);
      }
    }
  }, []);

  // Initial load & background live polling
  useEffect(() => {
    refreshStatusAndActivity();

    // Auto-update status & activity logs every 3.5s in near real-time
    const interval = setInterval(() => {
      refreshStatusAndActivity(false);
    }, 3500);

    return () => clearInterval(interval);
  }, [refreshStatusAndActivity]);

  const saveAutomations = async (updated: Partial<TelegramAutomations>) => {
    const next = { ...automations, ...updated };
    setAutomations(next);
    if (!connected) return;

    setAutomationsSaving(true);
    try {
      await api.telegramUpdateAutomations(next);
      setAutomationsSavedNotice(true);
      setTimeout(() => setAutomationsSavedNotice(false), 2500);
      refreshStatusAndActivity();
    } catch (err) {
      console.error('Failed to save automations:', err);
    } finally {
      setAutomationsSaving(false);
    }
  };

  const handleTestAlert = async (type: 'weather' | 'rain' | 'iss' | 'quick_replies') => {
    if (!chatId.trim()) {
      setAlertFeedback({
        msg: 'Please set and save a Default Chat ID above to receive test alerts in Telegram.',
        error: true,
      });
      setTimeout(() => setAlertFeedback(null), 4000);
      return;
    }

    setTestingAlert(type);
    setAlertFeedback(null);
    try {
      const city =
        type === 'weather'
          ? automations.dailyWeatherCity
          : type === 'rain'
          ? automations.rainAlertCity
          : undefined;

      const res = await api.telegramTestAlert(type, city);
      setAlertFeedback({ msg: 'Test alert sent to Telegram chat successfully!' });

      // Add to the simulator chat
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatLogs((prev) => [
        ...prev,
        {
          role: 'bot',
          text: res.message,
          time: nowTime,
        },
      ]);

      refreshStatusAndActivity();
    } catch (err: unknown) {
      setAlertFeedback({
        msg: err instanceof Error ? err.message : 'Failed to send test alert.',
        error: true,
      });
    } finally {
      setTestingAlert(null);
      setTimeout(() => setAlertFeedback(null), 4000);
    }
  };

  const handleConnect = async (e?: React.FormEvent | React.MouseEvent) => {
    alert('Button clicked');
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    console.log('[TelegramPage] Connect Bot triggered with token length:', token.trim().length, 'chatId:', chatId);
    if (!token.trim()) {
      console.warn('[TelegramPage] Connect Bot aborted: Token is empty');
      setError('Please enter your Telegram Bot Token.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      console.log('[TelegramPage] Calling api.telegramConnect with params:', {
        token: token.trim().slice(0, 8) + '...',
        chatId: chatId.trim() || undefined,
        allowedUsers,
        automations,
      });
      const res = await api.telegramConnect(
        token.trim(),
        chatId.trim() || undefined,
        allowedUsers,
        automations,
      );
      console.log('[TelegramPage] Successfully connected to Telegram Bot:', res.botInfo);
      setConnected(true);
      setBotInfo(res.botInfo);
      if (res.allowedUsers) setAllowedUsers(res.allowedUsers);
      if (res.automations) setAutomations(res.automations);
      setToken('');
      setChatLogs([
        {
          role: 'bot',
          text: `Connected successfully! I am @${res.botInfo.username}.\n\nSmart automations, command menu, and quick reply buttons are now active. Tap any button or send a command!`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      refreshStatusAndActivity();
    } catch (err: unknown) {
      console.error('[TelegramPage] telegramConnect error caught:', err);
      setError(err instanceof Error ? err.message : 'Invalid bot token or connection failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDisconnect = async () => {
    setDisconnecting(true);
    try {
      await api.telegramDisconnect();
      setConnected(false);
      setBotInfo(null);
      setChatId('');
      setChatLogs([]);
      setShowDisconnectModal(false);
      refreshStatusAndActivity();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect bot.');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleAddAllowedUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = newUserInput.trim().replace(/^@/, '');
    if (!cleanUser) return;

    if (allowedUsers.some((u) => u.toLowerCase().replace(/^@/, '') === cleanUser.toLowerCase())) {
      setNewUserInput('');
      return;
    }

    const updated = [...allowedUsers, newUserInput.trim()];
    setAllowedUsers(updated);
    setNewUserInput('');

    if (connected) {
      setAllowedUsersSaving(true);
      try {
        await api.telegramUpdateAllowedUsers(updated);
        setAllowedUsersSavedNotice(true);
        setTimeout(() => setAllowedUsersSavedNotice(false), 2500);
        refreshStatusAndActivity();
      } catch (err) {
        console.error('Failed to update allowed users:', err);
      } finally {
        setAllowedUsersSaving(false);
      }
    }
  };

  const handleRemoveAllowedUser = async (userToRemove: string) => {
    const updated = allowedUsers.filter((u) => u !== userToRemove);
    setAllowedUsers(updated);

    if (connected) {
      setAllowedUsersSaving(true);
      try {
        await api.telegramUpdateAllowedUsers(updated);
        setAllowedUsersSavedNotice(true);
        setTimeout(() => setAllowedUsersSavedNotice(false), 2500);
        refreshStatusAndActivity();
      } catch (err) {
        console.error('Failed to update allowed users:', err);
      } finally {
        setAllowedUsersSaving(false);
      }
    }
  };

  const handleSendTest = async (messageText?: string) => {
    const msg = (messageText || testMessage).trim();
    if (!msg || chatLoading) return;
    if (!messageText) setTestMessage('');

    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatLogs((prev) => [...prev, { role: 'user', text: msg, time: userTime }]);
    setChatLoading(true);

    try {
      const res = await api.telegramMessage(msg);
      const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatLogs((prev) => [...prev, { role: 'bot', text: res.answer, time: botTime }]);
      refreshStatusAndActivity();
    } catch (err: unknown) {
      const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatLogs((prev) => [
        ...prev,
        {
          role: 'bot',
          text: `Error: ${err instanceof Error ? err.message : 'Failed to process message.'}`,
          time: botTime,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <>
      <div className="page-intro" id="telegram-intro">
        <span className="eyebrow">INTEGRATIONS</span>
        <h1>Telegram Bot</h1>
        <p>
          Manage your Telegram bot integration with real-time connection telemetry, registered command list,
          scheduled briefings, proactive condition alerts, and live activity logs.
        </p>
      </div>

      {statusLoading ? (
        <LoadingMessage label="Checking bot connection status..." />
      ) : (
        <div style={{ display: 'grid', gap: '22px', maxWidth: '840px' }}>
          {/* Feature 2: Live Connection Status Indicator Badge */}
          <TelegramStatusBadge
            connected={connected}
            botInfo={botInfo}
            lastPolledAt={lastPolledAt}
            isPolling={isPolling}
            activityCount={activities.length}
            onRefresh={() => refreshStatusAndActivity(true)}
          />

          {connected ? (
            <div
              className="news-card"
              id="telegram-active-panel"
              style={{ padding: '24px', display: 'grid', gap: '22px' }}
            >
              {/* Bot Header Card & Disconnect Button */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      background: 'rgba(97,215,201,0.15)',
                      display: 'grid',
                      placeItems: 'center',
                      color: 'var(--accent)',
                    }}
                  >
                    <Bot size={24} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h2 style={{ fontSize: '18px', margin: 0 }}>@{botInfo?.username}</h2>
                      <span
                        style={{
                          background: 'rgba(97,215,201,0.12)',
                          color: 'var(--accent)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      >
                        Active & Polling
                      </span>
                    </div>
                    <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '2px 0 0' }}>
                      {botInfo?.first_name} (ID: {botInfo?.id})
                    </p>
                  </div>
                </div>

                {/* Disconnect Bot Button with Confirmation Prompt */}
                <button
                  id="disconnect-bot-button"
                  type="button"
                  onClick={() => setShowDisconnectModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <Trash2 size={16} /> Disconnect Bot
                </button>
              </div>

              {/* Status Details Box */}
              <div
                style={{
                  background: 'rgba(14,31,39,0.5)',
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid var(--line)',
                  display: 'grid',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--accent)',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  <CheckCircle2 size={16} /> Connected and listening for messages
                </div>
                <p style={{ color: 'var(--muted)', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
                  Your Telegram bot is actively processing messages with registered commands, automated alerts,
                  and allowed-users authorization filter.
                </p>
                {chatId ? (
                  <p
                    style={{
                      color: 'var(--muted)',
                      fontSize: '12px',
                      margin: '4px 0 0',
                      fontFamily: 'monospace',
                    }}
                  >
                    Default Chat ID for alerts: {chatId}
                  </p>
                ) : (
                  <p style={{ color: '#f59e0b', fontSize: '12px', margin: '4px 0 0' }}>
                    ⚠️ Note: Default Chat ID is not configured. Add your Chat ID when connecting or updating settings to enable scheduled push messages.
                  </p>
                )}
              </div>

              {/* Feedback toast for test alerts */}
              {alertFeedback && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    background: alertFeedback.error
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'rgba(97, 215, 201, 0.15)',
                    border: `1px solid ${
                      alertFeedback.error ? 'rgba(239, 68, 68, 0.4)' : 'rgba(97, 215, 201, 0.4)'
                    }`,
                    color: alertFeedback.error ? '#f87171' : 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {alertFeedback.error ? <AlertCircle size={16} /> : <Check size={16} />}
                  {alertFeedback.msg}
                </div>
              )}

              {/* Feature 1: Command List & Menu Sync Section */}
              <TelegramCommandMenu
                connected={connected}
                onSendCommandTest={(cmd) => handleSendTest(cmd)}
              />

              {/* Feature 3: Live Recent Activity Log */}
              <TelegramActivityLog
                activities={activities}
                loading={activitiesLoading}
                onRefresh={() => refreshStatusAndActivity(true)}
                onClear={() => setActivities([])}
              />

              {/* Smart Automations & Scheduled Alerts Section */}
              <div
                id="smart-automations-section"
                style={{
                  background: 'rgba(7,16,22,0.6)',
                  border: '1px solid var(--line)',
                  borderRadius: '12px',
                  padding: '18px',
                  display: 'grid',
                  gap: '18px',
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
                    <Sliders size={18} style={{ color: 'var(--accent)' }} />
                    <h3 style={{ fontSize: '15px', margin: 0 }}>Smart Automation & Scheduled Alerts</h3>
                  </div>
                  {automationsSavedNotice && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        color: 'var(--accent)',
                        background: 'rgba(97,215,201,0.1)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                      }}
                    >
                      <Check size={12} /> Automations synchronized
                    </span>
                  )}
                </div>

                {/* Scheduled Daily Weather */}
                <div
                  id="scheduled-weather-card"
                  style={{
                    background: 'rgba(14,31,39,0.5)',
                    border: '1px solid var(--line)',
                    borderRadius: '10px',
                    padding: '16px',
                    display: 'grid',
                    gap: '12px',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '8px',
                          background: 'rgba(97,215,201,0.1)',
                          display: 'grid',
                          placeItems: 'center',
                          color: 'var(--accent)',
                        }}
                      >
                        <Clock size={18} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '14px', color: '#fff' }}>
                          Scheduled Daily Weather Message
                        </h4>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                          Automatically receive a comprehensive morning weather briefing at your chosen time.
                        </p>
                      </div>
                    </div>

                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        id="daily-weather-toggle"
                        type="checkbox"
                        checked={automations.dailyWeatherEnabled}
                        onChange={(e) => saveAutomations({ dailyWeatherEnabled: e.target.checked })}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                        {automations.dailyWeatherEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  </div>

                  {automations.dailyWeatherEnabled && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                        paddingTop: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Daily Time:</span>
                        <input
                          id="daily-weather-time-input"
                          type="time"
                          value={automations.dailyWeatherTime}
                          onChange={(e) => saveAutomations({ dailyWeatherTime: e.target.value })}
                          style={{
                            padding: '6px 10px',
                            background: 'rgba(7,16,22,0.8)',
                            border: '1px solid var(--line)',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '13px',
                            outline: 'none',
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '180px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>City:</span>
                        <input
                          id="daily-weather-city-input"
                          type="text"
                          value={automations.dailyWeatherCity}
                          onChange={(e) => saveAutomations({ dailyWeatherCity: e.target.value })}
                          placeholder="e.g. London, UK"
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            background: 'rgba(7,16,22,0.8)',
                            border: '1px solid var(--line)',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '13px',
                            outline: 'none',
                          }}
                        />
                      </div>

                      <button
                        id="test-daily-weather-btn"
                        type="button"
                        onClick={() => handleTestAlert('weather')}
                        disabled={testingAlert === 'weather' || automationsSaving}
                        style={{
                          background: 'rgba(97,215,201,0.12)',
                          border: '1px solid rgba(97,215,201,0.3)',
                          color: 'var(--accent)',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Play size={12} />
                        {testingAlert === 'weather' ? 'Sending...' : 'Test Send'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Rain Alert Toggle */}
                <div
                  id="rain-alert-card"
                  style={{
                    background: 'rgba(14,31,39,0.5)',
                    border: '1px solid var(--line)',
                    borderRadius: '10px',
                    padding: '16px',
                    display: 'grid',
                    gap: '12px',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '8px',
                          background: 'rgba(96, 165, 250, 0.15)',
                          display: 'grid',
                          placeItems: 'center',
                          color: '#60a5fa',
                        }}
                      >
                        <CloudRain size={18} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '14px', color: '#fff' }}>
                          Rain Expected Alert
                        </h4>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                          Proactively notifies you if precipitation probability exceeds 50% for your city.
                        </p>
                      </div>
                    </div>

                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        id="rain-alert-toggle"
                        type="checkbox"
                        checked={automations.rainAlertEnabled}
                        onChange={(e) => saveAutomations({ rainAlertEnabled: e.target.checked })}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                        {automations.rainAlertEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  </div>

                  {automations.rainAlertEnabled && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                        paddingTop: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '180px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Monitored City:</span>
                        <input
                          id="rain-alert-city-input"
                          type="text"
                          value={automations.rainAlertCity}
                          onChange={(e) => saveAutomations({ rainAlertCity: e.target.value })}
                          placeholder="e.g. London, UK"
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            background: 'rgba(7,16,22,0.8)',
                            border: '1px solid var(--line)',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '13px',
                            outline: 'none',
                          }}
                        />
                      </div>

                      <button
                        id="test-rain-alert-btn"
                        type="button"
                        onClick={() => handleTestAlert('rain')}
                        disabled={testingAlert === 'rain' || automationsSaving}
                        style={{
                          background: 'rgba(96, 165, 250, 0.15)',
                          border: '1px solid rgba(96, 165, 250, 0.3)',
                          color: '#60a5fa',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Play size={12} />
                        {testingAlert === 'rain' ? 'Testing...' : 'Simulate Rain Alert'}
                      </button>
                    </div>
                  )}
                </div>

                {/* ISS Orbit Alert Toggle */}
                <div
                  id="iss-alert-card"
                  style={{
                    background: 'rgba(14,31,39,0.5)',
                    border: '1px solid var(--line)',
                    borderRadius: '10px',
                    padding: '16px',
                    display: 'grid',
                    gap: '12px',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '8px',
                          background: 'rgba(168, 85, 247, 0.15)',
                          display: 'grid',
                          placeItems: 'center',
                          color: '#c084fc',
                        }}
                      >
                        <Radio size={18} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '14px', color: '#fff' }}>
                          ISS Overhead Visibility Alert
                        </h4>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                          Alerts you when the International Space Station passes overhead near your location.
                        </p>
                      </div>
                    </div>

                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        id="iss-alert-toggle"
                        type="checkbox"
                        checked={automations.issAlertEnabled}
                        onChange={(e) => saveAutomations({ issAlertEnabled: e.target.checked })}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                        {automations.issAlertEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  </div>

                  {automations.issAlertEnabled && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                        paddingTop: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '180px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Observer Location:</span>
                        <input
                          id="iss-alert-location-input"
                          type="text"
                          value={automations.issAlertLocationName}
                          onChange={(e) => saveAutomations({ issAlertLocationName: e.target.value })}
                          placeholder="e.g. London, UK"
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            background: 'rgba(7,16,22,0.8)',
                            border: '1px solid var(--line)',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '13px',
                            outline: 'none',
                          }}
                        />
                      </div>

                      <button
                        id="test-iss-alert-btn"
                        type="button"
                        onClick={() => handleTestAlert('iss')}
                        disabled={testingAlert === 'iss' || automationsSaving}
                        style={{
                          background: 'rgba(168, 85, 247, 0.15)',
                          border: '1px solid rgba(168, 85, 247, 0.3)',
                          color: '#c084fc',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Play size={12} />
                        {testingAlert === 'iss' ? 'Testing...' : 'Simulate ISS Pass'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Quick Reply Buttons Toggle */}
                <div
                  id="quick-reply-settings-card"
                  style={{
                    background: 'rgba(14,31,39,0.5)',
                    border: '1px solid var(--line)',
                    borderRadius: '10px',
                    padding: '16px',
                    display: 'grid',
                    gap: '12px',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '8px',
                          background: 'rgba(234, 179, 8, 0.15)',
                          display: 'grid',
                          placeItems: 'center',
                          color: '#facc15',
                        }}
                      >
                        <Zap size={18} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '14px', color: '#fff' }}>
                          Interactive Quick Reply Buttons
                        </h4>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                          Include tappable inline keyboard buttons on bot messages for instant 1-tap actions.
                        </p>
                      </div>
                    </div>

                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        id="quick-replies-toggle"
                        type="checkbox"
                        checked={automations.quickRepliesEnabled}
                        onChange={(e) => saveAutomations({ quickRepliesEnabled: e.target.checked })}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                        {automations.quickRepliesEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Active Buttons:</span>
                    <span
                      style={{
                        background: 'rgba(97,215,201,0.1)',
                        border: '1px solid rgba(97,215,201,0.25)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#fff',
                        fontWeight: 500,
                      }}
                    >
                      🌦️ Weather
                    </span>
                    <span
                      style={{
                        background: 'rgba(97,215,201,0.1)',
                        border: '1px solid rgba(97,215,201,0.25)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#fff',
                        fontWeight: 500,
                      }}
                    >
                      🔍 Search
                    </span>
                    <span
                      style={{
                        background: 'rgba(97,215,201,0.1)',
                        border: '1px solid rgba(97,215,201,0.25)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#fff',
                        fontWeight: 500,
                      }}
                    >
                      🚀 Space
                    </span>
                    <span
                      style={{
                        background: 'rgba(97,215,201,0.1)',
                        border: '1px solid rgba(97,215,201,0.25)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#fff',
                        fontWeight: 500,
                      }}
                    >
                      📰 News
                    </span>
                  </div>
                </div>
              </div>

              {/* Allowed Users / Access Control Section */}
              <div
                id="allowed-users-section"
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
                    <Shield size={18} style={{ color: 'var(--accent)' }} />
                    <h3 style={{ fontSize: '15px', margin: 0 }}>Allowed Users & Access Control</h3>
                  </div>
                  {allowedUsersSavedNotice && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        color: 'var(--accent)',
                        background: 'rgba(97,215,201,0.1)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                      }}
                    >
                      <Check size={12} /> Saved to server
                    </span>
                  )}
                </div>

                <p style={{ color: 'var(--muted)', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
                  Add your Telegram Chat ID (e.g. <code>123456789</code>) or username (e.g.{' '}
                  <code>@yourusername</code>) to restrict bot responses strictly to authorized accounts.
                </p>

                {/* Add User Form */}
                <form
                  onSubmit={handleAddAllowedUser}
                  style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <input
                    id="allowed-user-input"
                    type="text"
                    placeholder="Telegram Chat ID or @username..."
                    value={newUserInput}
                    onChange={(e) => setNewUserInput(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: '220px',
                      padding: '9px 12px',
                      background: 'rgba(14,31,39,0.8)',
                      border: '1px solid var(--line)',
                      borderRadius: '7px',
                      color: '#fff',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                  <button
                    id="add-allowed-user-button"
                    type="submit"
                    disabled={!newUserInput.trim() || allowedUsersSaving}
                    style={{
                      background: 'var(--accent)',
                      color: '#071016',
                      border: 0,
                      padding: '9px 14px',
                      borderRadius: '7px',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: newUserInput.trim() ? 'pointer' : 'not-allowed',
                      opacity: newUserInput.trim() ? 1 : 0.6,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <UserPlus size={15} /> Add User
                  </button>
                </form>

                {/* Allowed Users List */}
                <div style={{ display: 'grid', gap: '8px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      color: 'var(--muted)',
                    }}
                  >
                    <span>
                      {allowedUsers.length > 0
                        ? `Whitelisted Accounts (${allowedUsers.length})`
                        : 'No accounts restricted yet'}
                    </span>
                    <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {allowedUsers.length > 0 ? (
                        <>
                          <Lock size={12} style={{ color: 'var(--accent)' }} /> Strict Mode (Authorized Only)
                        </>
                      ) : (
                        <>
                          <Unlock size={12} /> Open Mode (Responds to anyone)
                        </>
                      )}
                    </span>
                  </div>

                  {allowedUsers.length === 0 ? (
                    <div
                      style={{
                        padding: '12px 14px',
                        background: 'rgba(14,31,39,0.4)',
                        border: '1px dashed var(--line)',
                        borderRadius: '8px',
                        color: 'var(--muted)',
                        fontSize: '12px',
                        lineHeight: 1.5,
                      }}
                    >
                      Currently in <strong>Open Mode</strong>. The bot responds to all incoming messages.
                      Add your Chat ID or username above to block unauthorized users.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {allowedUsers.map((user) => (
                        <div
                          key={user}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'rgba(97,215,201,0.1)',
                            border: '1px solid rgba(97,215,201,0.25)',
                            padding: '6px 10px 6px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            color: '#fff',
                          }}
                        >
                          <ShieldCheck size={14} style={{ color: 'var(--accent)' }} />
                          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{user}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAllowedUser(user)}
                            aria-label={`Remove ${user}`}
                            style={{
                              background: 'transparent',
                              border: 0,
                              color: 'var(--muted)',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'grid',
                              placeItems: 'center',
                              borderRadius: '50%',
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Test Simulator with Quick Action Buttons */}
              <div style={{ display: 'grid', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={16} style={{ color: 'var(--accent)' }} />
                  <h3 style={{ fontSize: '15px', margin: 0 }}>Live Bot Simulator & Chat Test</h3>
                </div>
                <div
                  style={{
                    background: 'rgba(7,16,22,0.6)',
                    border: '1px solid var(--line)',
                    borderRadius: '10px',
                    height: '320px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      padding: '16px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    {!chatLogs.length && (
                      <div
                        style={{
                          textAlign: 'center',
                          color: 'var(--muted)',
                          margin: 'auto',
                          fontSize: '13px',
                        }}
                      >
                        Type a command (e.g. <code>/weather</code>, <code>/search</code>) or message below to test @{botInfo?.username}.
                      </div>
                    )}
                    {chatLogs.map((log, idx) => (
                      <div
                        key={idx}
                        style={{
                          alignSelf: log.role === 'user' ? 'flex-end' : 'flex-start',
                          maxWidth: '85%',
                          background:
                            log.role === 'user' ? 'rgba(97,215,201,0.15)' : 'rgba(14,31,39,0.8)',
                          border: '1px solid var(--line)',
                          padding: '10px 14px',
                          borderRadius: '10px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '12px',
                            marginBottom: '4px',
                            fontSize: '10px',
                            color: 'var(--muted)',
                          }}
                        >
                          <span>{log.role === 'user' ? 'You' : `@${botInfo?.username}`}</span>
                          <span>{log.time}</span>
                        </div>
                        <div
                          style={{
                            fontSize: '13px',
                            lineHeight: 1.5,
                            color: '#fff',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {log.text}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div
                        style={{
                          alignSelf: 'flex-start',
                          background: 'rgba(14,31,39,0.8)',
                          border: '1px solid var(--line)',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          color: 'var(--muted)',
                          fontSize: '12px',
                        }}
                      >
                        Bot is typing...
                      </div>
                    )}
                  </div>

                  {/* Simulator Quick Reply Action Chips */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      padding: '8px 12px',
                      background: 'rgba(14,31,39,0.9)',
                      borderTop: '1px solid var(--line)',
                      overflowX: 'auto',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: 'var(--muted)', alignSelf: 'center', whiteSpace: 'nowrap' }}>
                      Quick Actions:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSendTest('/weather')}
                      disabled={chatLoading}
                      style={{
                        background: 'rgba(97,215,201,0.12)',
                        border: '1px solid rgba(97,215,201,0.3)',
                        color: 'var(--accent)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      🌦️ /weather
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendTest('/search')}
                      disabled={chatLoading}
                      style={{
                        background: 'rgba(97,215,201,0.12)',
                        border: '1px solid rgba(97,215,201,0.3)',
                        color: 'var(--accent)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      🔍 /search
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendTest('/space')}
                      disabled={chatLoading}
                      style={{
                        background: 'rgba(97,215,201,0.12)',
                        border: '1px solid rgba(97,215,201,0.3)',
                        color: 'var(--accent)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      🚀 /space
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendTest('/news')}
                      disabled={chatLoading}
                      style={{
                        background: 'rgba(97,215,201,0.12)',
                        border: '1px solid rgba(97,215,201,0.3)',
                        color: 'var(--accent)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      📰 /news
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendTest('/help')}
                      disabled={chatLoading}
                      style={{
                        background: 'rgba(97,215,201,0.12)',
                        border: '1px solid rgba(97,215,201,0.3)',
                        color: 'var(--accent)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ℹ️ /help
                    </button>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendTest();
                    }}
                    style={{
                      display: 'flex',
                      borderTop: '1px solid var(--line)',
                      padding: '10px',
                      background: 'var(--panel)',
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Ask bot or type command (e.g. /weather, /space, /news)..."
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      style={{
                        flex: 1,
                        background: 'none',
                        border: 0,
                        outline: 0,
                        color: '#fff',
                        fontSize: '13px',
                        padding: '6px 8px',
                      }}
                    />
                    <button
                      type="submit"
                      disabled={chatLoading || !testMessage.trim()}
                      style={{
                        background: 'var(--accent)',
                        color: '#071016',
                        border: 0,
                        padding: '8px 14px',
                        borderRadius: '6px',
                        fontWeight: 600,
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <Send size={14} /> Send
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ) : (
            <div className="news-card" id="telegram-connect-panel" style={{ padding: '28px' }}>
              <form onSubmit={handleConnect} style={{ display: 'grid', gap: '20px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '4px',
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'rgba(97,215,201,0.15)',
                      display: 'grid',
                      placeItems: 'center',
                      color: 'var(--accent)',
                    }}
                  >
                    <Bot size={22} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '18px', margin: 0 }}>Connect Telegram Bot</h2>
                    <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '2px 0 0' }}>
                      Enter your Telegram bot credentials from @BotFather.
                    </p>
                  </div>
                </div>

                {error && (
                  <div
                    className="error-message"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <AlertCircle size={16} /> {error}
                  </div>
                )}

                <div style={{ display: 'grid', gap: '8px' }}>
                  <label
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Key size={14} style={{ color: 'var(--accent)' }} /> Bot Token *
                  </label>
                  <input
                    type="password"
                    placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'rgba(7,16,22,0.8)',
                      border: '1px solid var(--line)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                    required
                  />
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    Get this token by talking to{' '}
                    <a
                      href="https://t.me/BotFather"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                    >
                      @BotFather
                    </a>{' '}
                    on Telegram.
                  </span>
                </div>

                <div style={{ display: 'grid', gap: '8px' }}>
                  <label
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Hash size={14} style={{ color: 'var(--accent)' }} /> Default Chat ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. -100123456789 or 987654321"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'rgba(7,16,22,0.8)',
                      border: '1px solid var(--line)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    Your Telegram account or channel Chat ID for receiving automated alerts and daily weather.
                  </span>
                </div>

                {/* Pre-connection Allowed Users list */}
                <div
                  style={{
                    background: 'rgba(7,16,22,0.5)',
                    border: '1px solid var(--line)',
                    borderRadius: '8px',
                    padding: '14px',
                    display: 'grid',
                    gap: '10px',
                  }}
                >
                  <label
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Shield size={14} style={{ color: 'var(--accent)' }} /> Allowed Users / Chat IDs (Optional)
                  </label>
                  <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>
                    Restrict bot to only respond to specific Chat IDs or usernames.
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="e.g. 123456789 or @myusername"
                      value={newUserInput}
                      onChange={(e) => setNewUserInput(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        background: 'rgba(14,31,39,0.8)',
                        border: '1px solid var(--line)',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '12px',
                        outline: 'none',
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newUserInput.trim() && !allowedUsers.includes(newUserInput.trim())) {
                            setAllowedUsers([...allowedUsers, newUserInput.trim()]);
                            setNewUserInput('');
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newUserInput.trim() && !allowedUsers.includes(newUserInput.trim())) {
                          setAllowedUsers([...allowedUsers, newUserInput.trim()]);
                          setNewUserInput('');
                        }
                      }}
                      style={{
                        background: 'rgba(97,215,201,0.15)',
                        border: '1px solid rgba(97,215,201,0.3)',
                        color: 'var(--accent)',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Add
                    </button>
                  </div>
                  {allowedUsers.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                      {allowedUsers.map((u) => (
                        <span
                          key={u}
                          style={{
                            background: 'rgba(97,215,201,0.1)',
                            border: '1px solid rgba(97,215,201,0.25)',
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: '#fff',
                          }}
                        >
                          {u}
                          <button
                            type="button"
                            onClick={() => setAllowedUsers(allowedUsers.filter((x) => x !== u))}
                            style={{
                              background: 'none',
                              border: 0,
                              color: 'var(--muted)',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  id="connect-bot-submit"
                  type="submit"
                  onClick={(e) => handleConnect(e)}
                  disabled={loading}
                  style={{
                    background: 'var(--accent)',
                    color: '#071016',
                    border: 0,
                    padding: '12px 20px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                  }}
                >
                  {loading ? 'Verifying Token...' : 'Connect Bot'} <Send size={16} />
                </button>
              </form>
            </div>
          )}

          <div className="news-card" style={{ padding: '22px' }}>
            <h3 style={{ fontSize: '16px', margin: '0 0 10px' }}>Bot Capabilities & Observability</h3>
            <ul
              style={{
                margin: 0,
                paddingLeft: '18px',
                color: 'var(--muted)',
                fontSize: '13px',
                display: 'grid',
                gap: '8px',
                lineHeight: 1.5,
              }}
            >
              <li>
                <strong>Command Menu:</strong> Registered with Telegram API (<code>/weather</code>, <code>/search</code>, <code>/news</code>, <code>/space</code>, <code>/help</code>) for instant slash-command autocompletion.
              </li>
              <li>
                <strong>Live Telemetry & Status:</strong> Real-time connection badge with automatic polling and heartbeat indicator.
              </li>
              <li>
                <strong>Recent Activity Log:</strong> Live streaming message inspector tracking inbound and outbound traffic, delivery status, and blocked sender telemetry.
              </li>
              <li>
                <strong>Scheduled Briefings & Condition Alerts:</strong> Automated morning weather delivery, ISS orbit passes, and precipitation forecasts.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {showDisconnectModal && (
        <div
          id="disconnect-confirmation-modal"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3, 7, 10, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#0e1f27',
              border: '1px solid var(--line)',
              borderRadius: '14px',
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              display: 'grid',
              gap: '16px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#f87171',
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '17px', margin: 0, color: '#fff' }}>Disconnect Bot?</h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                  @{botInfo?.username}
                </p>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5, margin: 0 }}>
              Are you sure you want to disconnect? This will remove the stored bot token and stop the
              bot from responding to any messages or sending scheduled alerts.
            </p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '6px',
              }}
            >
              <button
                id="cancel-disconnect-btn"
                type="button"
                onClick={() => setShowDisconnectModal(false)}
                disabled={disconnecting}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid var(--line)',
                  color: '#fff',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                id="confirm-disconnect-btn"
                type="button"
                onClick={handleConfirmDisconnect}
                disabled={disconnecting}
                style={{
                  background: '#ef4444',
                  border: 0,
                  color: '#fff',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: disconnecting ? 'not-allowed' : 'pointer',
                  opacity: disconnecting ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Trash2 size={15} />
                {disconnecting ? 'Disconnecting...' : 'Yes, Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
