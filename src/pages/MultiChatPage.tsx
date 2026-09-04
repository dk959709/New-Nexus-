import { useState, useEffect } from 'react';
import { MessageSquare, Sliders, MessagesSquare } from 'lucide-react';
import { storage } from '@/lib/storage';
import { MultiChatConsole } from '@/components/multichat/MultiChatConsole';
import { MultiChatSettings } from '@/components/multichat/MultiChatSettings';
import type { MultiChatSystemConfig } from '@/types';

export function MultiChatPage() {
  const [activeTab, setActiveTab] = useState<'chat' | 'settings'>('chat');
  const [config, setConfig] = useState<MultiChatSystemConfig>(() => storage.getMultiChatConfig());

  // Keep state synchronized with storage whenever switching views or when storage updates
  useEffect(() => {
    setConfig(storage.getMultiChatConfig());
  }, [activeTab]);

  useEffect(() => {
    const handleStorageChange = () => {
      setConfig(storage.getMultiChatConfig());
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleStorageChange);
    };
  }, []);

  const handleConfigSaved = (updated: MultiChatSystemConfig) => {
    setConfig(updated);
  };

  return (
    <div className="main-content-flow" style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '32px' }}>
      {/* Multi Chat Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          paddingBottom: '14px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(97,215,201,0.25) 0%, rgba(129,140,248,0.25) 100%)',
                border: '1px solid rgba(97,215,201,0.4)',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 0 16px rgba(97,215,201,0.25)',
              }}
            >
              <MessagesSquare size={20} className="text-accent" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 900, letterSpacing: '-0.03em', color: '#fff' }}>
                  Multi Chat
                </h1>
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: 'DM Mono',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: 'rgba(97,215,201,0.15)',
                    color: 'var(--accent)',
                    border: '1px solid rgba(97,215,201,0.3)',
                    fontWeight: 700,
                  }}
                >
                  3-PERSONA COGNITIVE PANEL
                </span>
              </div>
            </div>
          </div>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '13px' }}>
            Connected Multi-Agent Dialogue: NOVA 🧠 (Researcher) → ORBIT 😎 (Buddy) → COSMOS 🧘 (Mentor)
          </p>
        </div>

        {/* Tab Controls (Chat Console vs Agent Configurations) */}
        <div
          style={{
            display: 'flex',
            padding: '4px',
            background: 'rgba(6,16,24,0.7)',
            border: '1px solid rgba(165,207,214,0.18)',
            borderRadius: '12px',
            gap: '4px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'chat' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'chat' ? '#04121a' : 'var(--muted)',
              transition: 'all 0.2s ease',
            }}
          >
            <MessageSquare size={14} />
            Chat Console
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'settings' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'settings' ? '#04121a' : 'var(--muted)',
              transition: 'all 0.2s ease',
            }}
          >
            <Sliders size={14} />
            Agent Configurations
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'chat' ? (
        <MultiChatConsole config={config} onNavigateToSettings={() => setActiveTab('settings')} />
      ) : (
        <MultiChatSettings onSaved={handleConfigSaved} />
      )}
    </div>
  );
}

export default MultiChatPage;
