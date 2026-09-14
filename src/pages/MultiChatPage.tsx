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
          gap: '12px',
          paddingBottom: '14px',
        }}
      >
        <div className="min-w-0 max-w-full">
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-[10px] shrink-0 grid place-items-center"
              style={{
                background: 'linear-gradient(135deg, rgba(97,215,201,0.25) 0%, rgba(129,140,248,0.25) 100%)',
                border: '1px solid rgba(97,215,201,0.4)',
                boxShadow: '0 0 16px rgba(97,215,201,0.25)',
              }}
            >
              <MessagesSquare size={16} className="text-accent sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap sm:flex-nowrap">
                <h1 className="m-0 text-lg sm:text-2xl md:text-[26px] font-black tracking-tight text-white leading-tight">
                  Multi Chat
                </h1>
                <span
                  className="text-[9px] sm:text-[11px] font-mono px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-md font-bold whitespace-nowrap"
                  style={{
                    background: 'rgba(97,215,201,0.15)',
                    color: 'var(--accent)',
                    border: '1px solid rgba(97,215,201,0.3)',
                  }}
                >
                  3-PERSONA COGNITIVE PANEL
                </span>
              </div>
            </div>
          </div>
          <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-[13px] text-slate-400 line-clamp-1 sm:line-clamp-none">
            Connected Multi-Agent Dialogue: NOVA 🧠 (Researcher) → ORBIT 😎 (Buddy) → COSMOS 🧘 (Mentor)
          </p>
        </div>

        {/* Tab Controls (Chat Console vs Agent Configurations) */}
        <div
          className="flex p-1 rounded-xl gap-1 w-full sm:w-auto"
          style={{
            background: 'rgba(6,16,24,0.7)',
            border: '1px solid rgba(165,207,214,0.18)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-[13px] font-bold border-none cursor-pointer transition-all"
            style={{
              background: activeTab === 'chat' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'chat' ? '#04121a' : 'var(--muted)',
            }}
          >
            <MessageSquare size={13} className="sm:w-3.5 sm:h-3.5" />
            <span>Chat Console</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-[13px] font-bold border-none cursor-pointer transition-all"
            style={{
              background: activeTab === 'settings' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'settings' ? '#04121a' : 'var(--muted)',
            }}
          >
            <Sliders size={13} className="sm:w-3.5 sm:h-3.5" />
            <span>Agent Configurations</span>
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
