import React, { useRef, useEffect } from 'react';
import {
  Send,
  Radio,
  Clock,
  Activity,
  CheckCircle2,
  Square,
  CornerDownLeft,
  Sparkles,
  Volume2,
  RotateCcw,
} from 'lucide-react';
import { playTapSound } from '@/lib/audio';
import { LiveConnectionState } from './LiveWaveformVisualizer';

export interface LiveSessionMessage {
  id: string;
  text: string;
  sentAt: number;
  status: 'queued' | 'speaking' | 'spoken';
  firstScheduledStartTime?: number;
  lastScheduledEndTime?: number;
  audioDurationSec?: number;
}

interface LiveSessionFeedProps {
  messages: LiveSessionMessage[];
  currentInput: string;
  onInputChange: (val: string) => void;
  onSendMessage: (textToSend?: string) => void;
  isSessionActive: boolean;
  isConnecting: boolean;
  connectionStatus: LiveConnectionState;
  onStartSession: () => void;
  onEndSession: () => void;
  onHardStop?: () => void;
  samplePrompts: { title: string; text: string }[];
}

export function LiveSessionFeed({
  messages,
  currentInput,
  onInputChange,
  onSendMessage,
  isSessionActive,
  isConnecting,
  connectionStatus,
  onStartSession,
  onEndSession,
  onHardStop,
  samplePrompts,
}: LiveSessionFeedProps) {
  const feedEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const lastMessageStatus = messages.length > 0 ? messages[messages.length - 1].status : undefined;

  // Auto-scroll to the bottom when new messages arrive or change status
  useEffect(() => {
    if (messages.length > 0) {
      feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, lastMessageStatus]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (currentInput.trim()) {
        playTapSound();
        onSendMessage();
      }
    }
  };

  const speakingCount = messages.filter((m) => m.status === 'speaking').length;
  const queuedCount = messages.filter((m) => m.status === 'queued').length;
  const spokenCount = messages.filter((m) => m.status === 'spoken').length;

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
      {/* Feed Header */}
      <div className="px-5 py-3.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
            <Radio size={14} className={isSessionActive ? 'animate-pulse' : ''} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <span>Live Narration Feed</span>
              {isSessionActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              {messages.length === 0
                ? 'Persistent session • send dialogue anytime'
                : `${messages.length} total • ${spokenCount} spoken • ${speakingCount} speaking • ${queuedCount} queued`}
            </p>
          </div>
        </div>

        {/* Live Status Indicators & Controls */}
        <div className="flex items-center gap-2">
          {isSessionActive ? (
            <>
              {speakingCount > 0 && (
                <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center gap-1.5 shadow-sm">
                  <Activity size={12} className="animate-spin text-rose-400" />
                  <span>AI Voicing</span>
                </span>
              )}

              {onHardStop && (connectionStatus === 'streaming' || connectionStatus === 'finishing') && (
                <button
                  type="button"
                  onClick={onHardStop}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 font-medium text-xs transition cursor-pointer flex items-center gap-1"
                  title="Stop all currently playing audio immediately"
                >
                  <Square size={11} className="fill-current" />
                  <span>Stop Audio</span>
                </button>
              )}

              <button
                type="button"
                onClick={onEndSession}
                className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition shadow cursor-pointer flex items-center gap-1.5"
                title="End session after queued audio finishes"
              >
                <Square size={11} className="fill-current" />
                <span>End Session</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onStartSession}
              disabled={isConnecting}
              className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition shadow cursor-pointer flex items-center gap-1.5"
            >
              <Radio size={13} />
              <span>Start Live Session</span>
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Conversation Stream */}
      <div className="p-4 sm:p-5 min-h-[220px] max-h-[380px] overflow-y-auto space-y-3 scroll-smooth">
        {messages.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 mx-auto flex items-center justify-center text-purple-400">
              <Radio size={22} />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <p className="text-sm font-semibold text-slate-200">
                Persistent Live Session
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Send dialogue anytime — even while previous messages are actively speaking. New audio queues gaplessly without interrupting or restarting.
              </p>
            </div>
            {/* Quick Starter Prompts */}
            <div className="pt-2 flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
              {samplePrompts.slice(0, 3).map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    playTapSound();
                    if (!isSessionActive) {
                      onStartSession();
                    }
                    onSendMessage(prompt.text);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm text-left truncate max-w-xs"
                >
                  <Sparkles size={11} className="text-purple-400 shrink-0" />
                  <span className="truncate">{prompt.title}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isSpeaking = msg.status === 'speaking';
            const isQueued = msg.status === 'queued';
            const isSpoken = msg.status === 'spoken';

            return (
              <div
                key={msg.id}
                className={`p-3.5 sm:p-4 rounded-xl border transition-all duration-200 animate-fadeIn ${
                  isSpeaking
                    ? 'bg-purple-950/40 border-purple-500/50 shadow-lg shadow-purple-950/30 ring-1 ring-purple-500/40'
                    : isQueued
                    ? 'bg-slate-900/60 border-amber-500/30'
                    : 'bg-slate-900/40 border-slate-800'
                }`}
              >
                {/* Message Header */}
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold text-slate-400">
                      #{index + 1}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {new Date(msg.sentAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    {isSpeaking && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center gap-1.5 animate-pulse">
                        <Activity size={11} className="animate-spin text-rose-400" />
                        <span>SPEAKING NOW</span>
                      </span>
                    )}

                    {isQueued && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center gap-1.5">
                        <Clock size={11} className="text-amber-400" />
                        <span>QUEUED IN PIPELINE</span>
                      </span>
                    )}

                    {isSpoken && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-1">
                        <CheckCircle2 size={11} className="text-emerald-400" />
                        <span>SPOKEN</span>
                      </span>
                    )}

                    {/* Resend button */}
                    <button
                      type="button"
                      onClick={() => {
                        playTapSound();
                        onSendMessage(msg.text);
                      }}
                      className="p-1 text-slate-400 hover:text-purple-300 transition cursor-pointer rounded hover:bg-slate-800"
                      title="Speak this line again"
                    >
                      <RotateCcw size={11} />
                    </button>
                  </div>
                </div>

                {/* Message Body */}
                <p className="text-sm text-slate-100 leading-relaxed font-normal">
                  {msg.text}
                </p>

                {/* Timing Footer if available */}
                {msg.audioDurationSec && (
                  <div className="mt-2 pt-1 border-t border-slate-800/60 flex items-center gap-2 text-[10px] font-mono text-slate-500">
                    <Volume2 size={10} className="text-purple-400" />
                    <span>Duration: ~{msg.audioDurationSec.toFixed(1)}s</span>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={feedEndRef} />
      </div>

      {/* Interactive Input Bar */}
      <div className="p-3.5 sm:p-4 bg-slate-900/90 border-t border-slate-800 space-y-2.5">
        {/* Quick prompt suggestions when session is active */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <span className="text-[11px] font-mono text-slate-400 shrink-0">Quick line:</span>
          {samplePrompts.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                playTapSound();
                onInputChange(p.text);
                textareaRef.current?.focus();
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 text-[11px] shrink-0 transition cursor-pointer truncate max-w-[170px]"
              title={p.text}
            >
              {p.title}
            </button>
          ))}
        </div>

        {/* Input box + Send Button */}
        <div className="flex items-end gap-2.5">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={currentInput}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isSessionActive
                  ? 'Type new dialogue to speak live... (Press Enter to send, Shift+Enter for new line)'
                  : 'Type initial dialogue, then click "Start Live Session"...'
              }
              rows={2}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3 text-slate-100 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition resize-none shadow-inner leading-relaxed placeholder:text-slate-500"
            />
            <span className="absolute bottom-2.5 right-3 text-[10px] font-mono text-slate-500 pointer-events-none hidden sm:inline-block">
              ↵ Send
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (currentInput.trim()) {
                playTapSound();
                if (!isSessionActive) {
                  onStartSession();
                }
                onSendMessage();
              }
            }}
            disabled={!currentInput.trim() || isConnecting}
            className="px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition shadow-lg shadow-purple-600/30 flex items-center gap-2 cursor-pointer shrink-0 active:scale-95"
            title="Send dialogue to stream in real-time"
          >
            <Send size={15} />
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span className="flex items-center gap-1">
            <CornerDownLeft size={11} className="text-purple-400" />
            <span>Sends instantly via WebSocket (24kHz PCM gapless queue)</span>
          </span>
          <span>{currentInput.length} chars</span>
        </div>
      </div>
    </div>
  );
}
