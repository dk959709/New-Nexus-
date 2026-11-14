import React, { useState } from 'react';
import {
  Terminal,
  Network,
  Database,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import type {
  SandboxNetworkEntry,
  SandboxStorageEntry,
} from '@/lib/canvasSandbox';

export interface SandboxConsoleLogEntry {
  id: string;
  level: 'log' | 'warn' | 'error';
  text: string;
  timestamp: number;
}

interface SandboxDevDrawerProps {
  isOpen: boolean;
  consoleLogs: SandboxConsoleLogEntry[];
  networkLogs: SandboxNetworkEntry[];
  storageEntries: SandboxStorageEntry[];
  onClearConsole: () => void;
  onClearNetwork: () => void;
  onRefreshStorage: () => void;
  onClearStorage: () => void;
  onClose: () => void;
}

export const SandboxDevDrawer: React.FC<SandboxDevDrawerProps> = ({
  isOpen,
  consoleLogs,
  networkLogs,
  storageEntries,
  onClearConsole,
  onClearNetwork,
  onRefreshStorage,
  onClearStorage,
  onClose,
}) => {
  const [devTab, setDevTab] = useState<'console' | 'network' | 'storage'>('console');

  if (!isOpen) return null;

  return (
    <div className="h-44 sm:h-48 border-t border-zinc-800 bg-zinc-950 flex flex-col shrink-0">
      {/* 3-Tab Header (>=38-44px mobile touch friendly) */}
      <div className="px-2.5 py-1 border-b border-zinc-800/80 flex items-center justify-between gap-2 shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setDevTab('console')}
            className={`min-h-[36px] px-2.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer tabular-nums ${
              devTab === 'console'
                ? 'bg-zinc-800 text-cyan-300'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Terminal size={12} />
            <span>Console ({consoleLogs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setDevTab('network')}
            className={`min-h-[36px] px-2.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer tabular-nums ${
              devTab === 'network'
                ? 'bg-zinc-800 text-emerald-300'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Network size={12} />
            <span>Network ({networkLogs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDevTab('storage');
              onRefreshStorage();
            }}
            className={`min-h-[36px] px-2.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer tabular-nums ${
              devTab === 'storage'
                ? 'bg-zinc-800 text-amber-300'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Database size={12} />
            <span>Storage ({storageEntries.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {devTab === 'console' && (
            <button
              type="button"
              onClick={onClearConsole}
              className="min-h-[36px] px-2.5 rounded-lg text-[11px] font-mono text-zinc-400 hover:text-white hover:bg-zinc-900 cursor-pointer"
            >
              Clear
            </button>
          )}
          {devTab === 'network' && (
            <button
              type="button"
              onClick={onClearNetwork}
              className="min-h-[36px] px-2.5 rounded-lg text-[11px] font-mono text-zinc-400 hover:text-white hover:bg-zinc-900 cursor-pointer"
            >
              Clear
            </button>
          )}
          {devTab === 'storage' && (
            <>
              <button
                type="button"
                onClick={onRefreshStorage}
                className="min-h-[36px] min-w-[36px] rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 flex items-center justify-center cursor-pointer"
                title="Refresh Storage"
              >
                <RefreshCw size={13} />
              </button>
              <button
                type="button"
                onClick={onClearStorage}
                className="min-h-[36px] min-w-[36px] rounded-lg text-zinc-400 hover:text-rose-300 hover:bg-rose-950/40 flex items-center justify-center cursor-pointer"
                title="Clear Sandbox Storage"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 flex items-center justify-center cursor-pointer"
            aria-label="Close DevTools Drawer"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1 font-mono text-xs">
        {devTab === 'console' &&
          (consoleLogs.length === 0 ? (
            <div className="text-zinc-500 text-[11px]">
              No console output recorded yet.
            </div>
          ) : (
            consoleLogs.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-start gap-2 ${
                  entry.level === 'error'
                    ? 'text-rose-400'
                    : entry.level === 'warn'
                    ? 'text-amber-300'
                    : 'text-zinc-300'
                }`}
              >
                <span className="text-zinc-600 select-none tabular-nums shrink-0">
                  {new Date(entry.timestamp).toLocaleTimeString([], {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
                <span className="break-all">{entry.text}</span>
              </div>
            ))
          ))}

        {devTab === 'network' &&
          (networkLogs.length === 0 ? (
            <div className="text-zinc-500 text-[11px]">
              No fetch() requests captured yet. Requests inside the live sandbox appear here automatically.
            </div>
          ) : (
            networkLogs.map((req) => (
              <div
                key={req.id}
                className="px-2 py-1 rounded-lg bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold text-cyan-300 shrink-0">
                    {req.method}
                  </span>
                  <span className="truncate text-zinc-200">{req.url}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 tabular-nums">
                  <span
                    className={`text-[10px] font-bold ${
                      req.ok ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {req.status}
                  </span>
                  <span className="text-[10px] text-zinc-500">{req.durationMs}ms</span>
                </div>
              </div>
            ))
          ))}

        {devTab === 'storage' &&
          (storageEntries.length === 0 ? (
            <div className="text-zinc-500 text-[11px]">
              Sandbox localStorage is empty. Apps calling localStorage work seamlessly inside the opaque preview origin.
            </div>
          ) : (
            storageEntries.map((item) => (
              <div
                key={item.key}
                className="px-2 py-1 rounded-lg bg-zinc-900/70 border border-zinc-800/80 flex items-start justify-between gap-3"
              >
                <span className="text-amber-300 font-semibold shrink-0">{item.key}</span>
                <span className="text-zinc-300 break-all text-right">{item.value}</span>
              </div>
            ))
          ))}
      </div>
    </div>
  );
};
