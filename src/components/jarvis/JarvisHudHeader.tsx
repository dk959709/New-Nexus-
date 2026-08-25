import { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  Radio,
  Zap,
  Shield,
  Clock,
  Sparkles,
} from 'lucide-react';
import type { JarvisSystemConfig } from '@/types';

interface JarvisHudHeaderProps {
  config: JarvisSystemConfig;
  isRunning: boolean;
  activeView: 'chat' | 'topology' | 'categories' | 'reactor';
  onSelectView: (view: 'chat' | 'topology' | 'categories' | 'reactor') => void;
  messageCount: number;
}

export function JarvisHudHeader({
  config,
  isRunning,
  activeView,
  onSelectView,
  messageCount,
}: JarvisHudHeaderProps) {
  const [timeStr, setTimeStr] = useState('');
  const [fps] = useState('60.0');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + `.${Math.floor(now.getMilliseconds() / 10).toString().padStart(2, '0')}`,
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 100);
    return () => clearInterval(interval);
  }, []);

  const activeAgentsCount = config?.agents
    ? Object.values(config.agents).filter((a) => a?.enabled).length
    : 5;

  return (
    <div
      className="jarvis-hud-card"
      style={{
        padding: '16px 20px',
        marginBottom: '16px',
        border: isRunning
          ? '1px solid rgba(97,215,201,0.6)'
          : '1px solid rgba(165,207,214,0.22)',
      }}
    >
      {/* Top Telemetry Ticker */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          paddingBottom: '12px',
          borderBottom: '1px solid rgba(165,207,214,0.12)',
          fontSize: '11px',
          fontFamily: 'DM Mono, monospace',
          color: 'var(--muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isRunning ? '#38bdf8' : '#61d7c9',
                boxShadow: isRunning
                  ? '0 0 12px #38bdf8, 0 0 20px #61d7c9'
                  : '0 0 8px #61d7c9',
                animation: isRunning ? 'jarvisCorePulse 1.5s ease-in-out infinite' : 'none',
              }}
            />
            <span style={{ color: isRunning ? '#38bdf8' : '#61d7c9', fontWeight: 700 }}>
              {isRunning ? 'PIPELINE ENGAGED' : 'SYSTEM ONLINE'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Radio size={12} className="text-accent" />
            <span>NEURAL CHANNELS: <strong style={{ color: '#fff' }}>{activeAgentsCount}/5</strong></span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={12} className="text-accent" />
            <span>ORCHESTRATOR: <strong style={{ color: '#fff' }}>v5.2.0-PRO</strong></span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={12} style={{ color: '#38bdf8' }} />
            <span>REFRESH: <strong style={{ color: '#fff' }}>{fps} Hz</strong></span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)' }}>
            <Clock size={12} />
            <span>SYS_TIME: {timeStr || '00:00:00.00'}</span>
          </div>
          <span
            style={{
              background: 'rgba(97,215,201,0.1)',
              border: '1px solid rgba(97,215,201,0.25)',
              padding: '2px 8px',
              borderRadius: '4px',
              color: 'var(--accent)',
              fontWeight: 600,
            }}
          >
            {messageCount} {messageCount === 1 ? 'SESSION' : 'SESSIONS'}
          </span>
        </div>
      </div>

      {/* Main Control & Visual Switcher Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          paddingTop: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(97,215,201,0.2) 0%, rgba(56,189,248,0.25) 100%)',
              border: '1px solid rgba(97,215,201,0.4)',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 0 16px rgba(97,215,201,0.2)',
            }}
          >
            <Zap size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                JARVIS HUD MATRIX
              </h2>
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: 'DM Mono',
                  background: 'rgba(56,189,248,0.15)',
                  border: '1px solid rgba(56,189,248,0.3)',
                  color: '#38bdf8',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontWeight: 700,
                }}
              >
                MULTI-AI
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
              Autonomous 5-Tier Reasoning & Knowledge Synthesis Network
            </p>
          </div>
        </div>

        {/* Visual Mode Navigation */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(4,12,18,0.7)',
            border: '1px solid rgba(165,207,214,0.18)',
            borderRadius: '10px',
            padding: '3px',
            gap: '4px',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => onSelectView('chat')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: activeView === 'chat' ? 'var(--accent)' : 'transparent',
              color: activeView === 'chat' ? '#04121a' : 'var(--muted)',
              transition: 'all 0.2s ease',
            }}
          >
            <Sparkles size={13} />
            <span>Chat Console</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectView('topology')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: activeView === 'topology' ? 'var(--accent)' : 'transparent',
              color: activeView === 'topology' ? '#04121a' : 'var(--muted)',
              transition: 'all 0.2s ease',
            }}
          >
            <Cpu size={13} />
            <span>5-Agent Topology</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectView('categories')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: activeView === 'categories' ? 'var(--accent)' : 'transparent',
              color: activeView === 'categories' ? '#04121a' : 'var(--muted)',
              transition: 'all 0.2s ease',
            }}
          >
            <Shield size={13} />
            <span>Graphic Categories</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectView('reactor')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: activeView === 'reactor' ? 'var(--accent)' : 'transparent',
              color: activeView === 'reactor' ? '#04121a' : 'var(--muted)',
              transition: 'all 0.2s ease',
            }}
          >
            <Zap size={13} />
            <span>Neural Core</span>
          </button>
        </div>
      </div>
    </div>
  );
}
