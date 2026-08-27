import { useEffect, useState } from 'react';
import {
  Bell,
  Bot,
  CheckCircle2,
  Film,
  Info,
  Palette,
  Send,
  Shield,
  User,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { AIProvidersSettings } from '@/components/AIProvidersSettings';
import { WallpaperSelector } from '@/components/WallpaperSelector';
import { api } from '@/services/api';
import { storage } from '@/lib/storage';
import { useSettings } from '@/hooks/useSettings';
import { playTapSound } from '@/lib/audio';
import type { Settings } from '@/types';

function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-intro"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>;
}

type SettingsCategory =
  | 'account'
  | 'appearance'
  | 'notifications'
  | 'ai'
  | 'media-backend'
  | 'privacy'
  | 'about';

interface TestResultData {
  available: boolean;
  version?: string;
  success: boolean;
  title?: string;
  thumbnail?: string;
  duration?: number;
  source?: string;
  originalUrl?: string;
  formats?: Array<{
    formatId: string;
    ext: string;
    height?: number;
    width?: number;
    fps?: number;
    hasVideo: boolean;
    hasAudio: boolean;
    playableUrl: string;
  }>;
  error?: string;
}

function MediaBackendSettings() {
  const [status, setStatus] = useState<{ available: boolean; version?: string; message?: string } | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [testUrl, setTestUrl] = useState('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResultData | null>(null);

  const checkStatus = () => {
    setLoadingStatus(true);
    api.getMediaStatus()
      .then((res) => {
        setStatus(res);
        setLoadingStatus(false);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to check status';
        setStatus({ available: false, message: msg });
        setLoadingStatus(false);
      });
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleTest = () => {
    if (!testUrl.trim()) return;
    setTesting(true);
    setTestResult(null);
    api.testMediaBackend(testUrl.trim())
      .then((res) => {
        setTesting(false);
        setTestResult(res);
      })
      .catch((err: unknown) => {
        setTesting(false);
        const msg = err instanceof Error ? err.message : 'Test failed';
        setTestResult({ available: false, success: false, error: msg });
      });
  };

  return (
    <div className="settings-list space-y-6">
      <section
        style={{
          background: 'rgba(14,31,39,0.6)',
          border: '1px solid var(--line)',
          borderRadius: '12px',
          padding: '24px',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 style={{ fontSize: '16px', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🎬</span> yt-dlp Backend Integration
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: '12px', margin: 0 }}>
              Server-side media stream extraction for YouTube, Vimeo, and public video sources.
            </p>
          </div>
          <button
            onClick={checkStatus}
            className="secondary-button text-xs px-3 py-1.5"
            disabled={loadingStatus}
          >
            Refresh Status
          </button>
        </div>

        <div className="flex items-center gap-3 p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 mb-6">
          <div className="flex-1">
            <span className="text-xs text-slate-400 block mb-1">Backend Status</span>
            {loadingStatus ? (
              <span className="text-xs text-slate-400">Checking status...</span>
            ) : status?.available ? (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm font-semibold text-emerald-400">Available ({status.version || 'Active'})</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-sm font-semibold text-rose-400">Unavailable ({status?.message || 'Not found'})</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">Test Media Backend Extraction</h3>
          <p className="text-xs text-slate-400">
            Enter a public video URL to test metadata extraction and stream resolution.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={handleTest}
              disabled={testing || !testUrl.trim()}
              className="search-submit text-xs px-4 py-2 whitespace-nowrap flex items-center gap-1.5"
            >
              {testing ? 'Extracting...' : 'Test Backend'}
            </button>
          </div>

          {testResult && (
            <div className="mt-4 p-4 rounded-lg bg-slate-950/80 border border-slate-800 text-xs space-y-2 font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Test Result</span>
                <span className={testResult.success ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {testResult.success ? 'SUCCESS ✓' : 'FAILED ✕'}
                </span>
              </div>
              {testResult.success ? (
                <>
                  <p><strong className="text-cyan-400">Title:</strong> {testResult.title}</p>
                  <p><strong className="text-cyan-400">Source:</strong> {testResult.source}</p>
                  <p><strong className="text-cyan-400">Formats Found:</strong> {testResult.formats?.length || 0}</p>
                  <p><strong className="text-cyan-400">Playable Stream URL:</strong> <a href={testResult.formats?.[0]?.playableUrl} target="_blank" rel="noreferrer" className="text-cyan-300 underline truncate block">{testResult.formats?.[0]?.playableUrl}</a></p>
                </>
              ) : (
                <p className="text-rose-400"><strong className="text-slate-300">Error:</strong> {testResult.error}</p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SettingRow({ label, description, value, options, onChange }: { label: string; description: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <section className="setting-row">
      <div>
        <h2>{label}</h2>
        <p>{description}</p>
      </div>
      <div className="segmented-control">
        {options.map((option) => (
          <button
            className={option === value ? 'selected' : ''}
            onClick={() => onChange(option)}
            key={option}
          >
            {option}
          </button>
        ))}
      </div>
    </section>
  );
}

export function SettingsPage() {
  const [settings, update] = useSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTabParam = (searchParams.get('tab') as SettingsCategory) || 'ai';
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>(activeTabParam);

  const switchCategory = (cat: SettingsCategory) => {
    setActiveCategory(cat);
    setSearchParams({ tab: cat });
    if (settings.sound !== false) {
      playTapSound();
    }
  };

  const choose = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    update({ [key]: value });
    if (settings.sound !== false && key === 'sound') {
      if (value === true) playTapSound();
    } else if (settings.sound !== false) {
      playTapSound();
    }
  };

  return (
    <>
      <PageIntro
        eyebrow="SYSTEM CONFIGURATION"
        title="Settings & Intelligence."
        description="Manage AI providers, neural keys, workspace appearance, and system integrations."
      />

      {/* Category Navigation Bar */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '12px',
          marginBottom: '24px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <button
          onClick={() => switchCategory('ai')}
          className={activeCategory === 'ai' ? 'selected' : ''}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '8px',
            border: `1px solid ${
              activeCategory === 'ai' ? 'var(--accent)' : 'rgba(165,207,214,0.18)'
            }`,
            background:
              activeCategory === 'ai'
                ? 'rgba(97,215,201,0.15)'
                : 'rgba(14,31,39,0.6)',
            color: activeCategory === 'ai' ? 'var(--accent)' : 'var(--muted)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow:
              activeCategory === 'ai' ? '0 0 12px rgba(97,215,201,0.2)' : 'none',
          }}
        >
          <Bot size={16} /> 🤖 AI Providers
        </button>

        <button
          onClick={() => switchCategory('appearance')}
          className={activeCategory === 'appearance' ? 'selected' : ''}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '8px',
            border: `1px solid ${
              activeCategory === 'appearance'
                ? 'var(--accent)'
                : 'rgba(165,207,214,0.18)'
            }`,
            background:
              activeCategory === 'appearance'
                ? 'rgba(97,215,201,0.15)'
                : 'rgba(14,31,39,0.6)',
            color: activeCategory === 'appearance' ? 'var(--accent)' : 'var(--muted)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Palette size={16} /> Appearance
        </button>

        <button
          onClick={() => switchCategory('notifications')}
          className={activeCategory === 'notifications' ? 'selected' : ''}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '8px',
            border: `1px solid ${
              activeCategory === 'notifications'
                ? 'var(--accent)'
                : 'rgba(165,207,214,0.18)'
            }`,
            background:
              activeCategory === 'notifications'
                ? 'rgba(97,215,201,0.15)'
                : 'rgba(14,31,39,0.6)',
            color:
              activeCategory === 'notifications' ? 'var(--accent)' : 'var(--muted)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Bell size={16} /> Notifications
        </button>

        <button
          onClick={() => switchCategory('account')}
          className={activeCategory === 'account' ? 'selected' : ''}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '8px',
            border: `1px solid ${
              activeCategory === 'account'
                ? 'var(--accent)'
                : 'rgba(165,207,214,0.18)'
            }`,
            background:
              activeCategory === 'account'
                ? 'rgba(97,215,201,0.15)'
                : 'rgba(14,31,39,0.6)',
            color: activeCategory === 'account' ? 'var(--accent)' : 'var(--muted)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <User size={16} /> Account
        </button>

        <button
          onClick={() => switchCategory('media-backend')}
          className={activeCategory === 'media-backend' ? 'selected' : ''}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '8px',
            border: `1px solid ${
              activeCategory === 'media-backend'
                ? 'var(--accent)'
                : 'rgba(165,207,214,0.18)'
            }`,
            background:
              activeCategory === 'media-backend'
                ? 'rgba(97,215,201,0.15)'
                : 'rgba(14,31,39,0.6)',
            color: activeCategory === 'media-backend' ? 'var(--accent)' : 'var(--muted)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Film size={16} /> Media Backends
        </button>

        <button
          onClick={() => switchCategory('privacy')}
          className={activeCategory === 'privacy' ? 'selected' : ''}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '8px',
            border: `1px solid ${
              activeCategory === 'privacy'
                ? 'var(--accent)'
                : 'rgba(165,207,214,0.18)'
            }`,
            background:
              activeCategory === 'privacy'
                ? 'rgba(97,215,201,0.15)'
                : 'rgba(14,31,39,0.6)',
            color: activeCategory === 'privacy' ? 'var(--accent)' : 'var(--muted)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Shield size={16} /> Privacy & Security
        </button>

        <button
          onClick={() => switchCategory('about')}
          className={activeCategory === 'about' ? 'selected' : ''}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '8px',
            border: `1px solid ${
              activeCategory === 'about'
                ? 'var(--accent)'
                : 'rgba(165,207,214,0.18)'
            }`,
            background:
              activeCategory === 'about'
                ? 'rgba(97,215,201,0.15)'
                : 'rgba(14,31,39,0.6)',
            color: activeCategory === 'about' ? 'var(--accent)' : 'var(--muted)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Info size={16} /> About
        </button>
      </div>

      {/* Category Views */}
      <div className="settings-content-wrapper">
        {/* 🤖 AI Providers Category */}
        {activeCategory === 'ai' && <AIProvidersSettings />}

        {/* 🎬 Media Backends Category */}
        {activeCategory === 'media-backend' && <MediaBackendSettings />}

        {/* 🎨 Appearance Category */}
        {activeCategory === 'appearance' && (
          <div className="settings-list">
            <SettingRow
              label="Theme Mode"
              description="Switch between Dark, Light, or match your system settings."
              value={settings.theme}
              options={['dark', 'light', 'system']}
              onChange={(value) => choose('theme', value as Settings['theme'])}
            />
            <SettingRow
              label="Navigation Audio Feedback"
              description="Play a subtle tactical sound when switching tabs and interacting with controls."
              value={settings.sound !== false ? 'on' : 'off'}
              options={['on', 'off']}
              onChange={(value) => choose('sound', value === 'on')}
            />
            <SettingRow
              label="Temperature Units"
              description="Display atmospheric weather readings in Celsius or Fahrenheit."
              value={settings.temperature}
              options={['celsius', 'fahrenheit']}
              onChange={(value) => choose('temperature', value as Settings['temperature'])}
            />
            <SettingRow
              label="Wind Speed Units"
              description="Display wind velocity in kilometers per hour or miles per hour."
              value={settings.wind}
              options={['kmh', 'mph']}
              onChange={(value) => choose('wind', value as Settings['wind'])}
            />
            <SettingRow
              label="Motion & Starfield Effects"
              description="Toggle high-fidelity orbital animations or distraction-free static mode."
              value={settings.animations}
              options={['full', 'reduced']}
              onChange={(value) => choose('animations', value as Settings['animations'])}
            />
            <WallpaperSelector
              value={settings.wallpaper}
              onSelect={(wallpaper) => choose('wallpaper', wallpaper)}
            />
          </div>
        )}

        {/* 🔔 Notifications Category */}
        {activeCategory === 'notifications' && (
          <div className="settings-list">
            <section
              className="setting-row"
              style={{
                background: 'linear-gradient(135deg, rgba(14,31,39,0.7) 0%, rgba(20,24,48,0.7) 100%)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '20px',
              }}
            >
              <div>
                <h2 style={{ fontSize: '16px', margin: '0 0 4px' }}>Telegram Bot Integration</h2>
                <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0 }}>
                  Connect your personal Telegram bot for instant weather alerts, smart search, and scheduled briefings.
                </p>
              </div>
              <Link
                to="/telegram"
                className="secondary-button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
              >
                <Send size={15} /> Configure Telegram
              </Link>
            </section>

            <section
              className="setting-row"
              style={{
                background: 'rgba(14,31,39,0.5)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '20px',
              }}
            >
              <div>
                <h2 style={{ fontSize: '15px', margin: '0 0 4px' }}>Severe Weather Alerts</h2>
                <p style={{ color: 'var(--muted)', fontSize: '12px', margin: 0 }}>
                  Display alert banners on dashboard when meteorological agencies issue warnings for your area.
                </p>
              </div>
              <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 600 }}>
                Enabled (Active)
              </span>
            </section>
          </div>
        )}

        {/* 👤 Account Category */}
        {activeCategory === 'account' && (
          <div className="settings-list">
            <section
              className="setting-row"
              style={{
                background: 'linear-gradient(135deg, rgba(14,31,39,0.7) 0%, rgba(20,24,48,0.7) 100%)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'rgba(97,215,201,0.15)',
                    color: 'var(--accent)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <User size={24} />
                </div>
                <div>
                  <h2 style={{ fontSize: '16px', margin: '0 0 4px' }}>NEXUS Local User</h2>
                  <p style={{ color: 'var(--muted)', fontSize: '12px', margin: 0 }}>
                    Workspace Session · Encrypted Client Storage
                  </p>
                </div>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  background: 'rgba(52,211,153,0.15)',
                  color: '#34d399',
                  fontWeight: 600,
                }}
              >
                Local Synced
              </span>
            </section>

            <section
              className="setting-row"
              style={{
                background: 'rgba(14,31,39,0.5)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '20px',
              }}
            >
              <div>
                <h2 style={{ fontSize: '15px', margin: '0 0 4px' }}>AI Provider Credentials</h2>
                <p style={{ color: 'var(--muted)', fontSize: '12px', margin: 0 }}>
                  Manage multiple API keys, rotation strategy, and models in the AI Providers section.
                </p>
              </div>
              <button
                onClick={() => switchCategory('ai')}
                className="secondary-button"
                style={{ padding: '8px 14px', borderRadius: '7px', fontSize: '12px' }}
              >
                Open AI Providers
              </button>
            </section>
          </div>
        )}

        {/* 🔒 Privacy & Security Category */}
        {activeCategory === 'privacy' && (
          <div className="settings-list">
            <section
              className="setting-row"
              style={{
                background: 'linear-gradient(135deg, rgba(14,31,39,0.7) 0%, rgba(20,24,48,0.7) 100%)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '20px',
              }}
            >
              <div>
                <h2 style={{ fontSize: '15px', margin: '0 0 4px' }}>Client-Side Zero Telemetry</h2>
                <p style={{ color: 'var(--muted)', fontSize: '12px', margin: 0 }}>
                  Your search history, saved articles, smart memory, and custom API keys are stored locally on your device.
                </p>
              </div>
              <CheckCircle2 size={20} color="#34d399" />
            </section>

            <section
              className="setting-row"
              style={{
                background: 'rgba(14,31,39,0.5)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '20px',
              }}
            >
              <div>
                <h2 style={{ fontSize: '15px', margin: '0 0 4px' }}>Reset System Preferences & Data</h2>
                <p style={{ color: 'var(--muted)', fontSize: '12px', margin: 0 }}>
                  Erase local caches, preferences, search history, and reset all configured state.
                </p>
              </div>
              <button
                className="danger-button"
                onClick={() => {
                  if (confirm('Are you sure you want to reset all preferences and stored state?')) {
                    storage.clearAll();
                    window.location.reload();
                  }
                }}
              >
                Reset All Data
              </button>
            </section>
          </div>
        )}

        {/* ℹ️ About Category */}
        {activeCategory === 'about' && (
          <div className="settings-list">
            <section
              style={{
                background: 'linear-gradient(135deg, rgba(14,31,39,0.7) 0%, rgba(20,24,48,0.7) 100%)',
                border: '1px solid var(--line)',
                borderRadius: '12px',
                padding: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'rgba(97,215,201,0.15)',
                    color: 'var(--accent)',
                  }}
                >
                  <Bot size={20} />
                </span>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', letterSpacing: '-0.02em' }}>
                    NEXUS Intelligence OS
                  </h2>
                  <p style={{ margin: 0, color: 'var(--muted)', fontSize: '12px' }}>
                    Version 2.5.0 · Neural Search & Multi-Provider Architecture
                  </p>
                </div>
              </div>

              <p style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: 1.6, margin: '14px 0' }}>
                NEXUS provides unified intelligence, meteorological science, NASA astrophysics data, and real-time news retrieval. All AI providers share a centralized tool context layer supporting DeepSeek, OpenRouter, Google Gemini, Groq, and custom API endpoints with multi-key failover and rotation.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  borderTop: '1px solid var(--line)',
                  paddingTop: '16px',
                  marginTop: '16px',
                  fontSize: '12px',
                }}
              >
                <div>
                  <span style={{ color: 'var(--muted)' }}>Neural Core:</span>
                  <div style={{ fontWeight: 600, color: '#fff' }}>Multi-Provider Engine</div>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Key Redundancy:</span>
                  <div style={{ fontWeight: 600, color: '#34d399' }}>Automatic Failover / Round Robin</div>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Shared Tools:</span>
                  <div style={{ fontWeight: 600, color: '#93c5fd' }}>Web · Wiki · Weather · Space · News</div>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Environment:</span>
                  <div style={{ fontWeight: 600, color: '#fff' }}>TypeScript · Express · Vite</div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
