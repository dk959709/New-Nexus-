import React, { useState, useEffect, useRef } from 'react';
import {
  Network,
  Sparkles,
  Square,
  ChevronDown,
  ChevronUp,
  Settings2,
  MessageSquare,
  Archive,
  Trash2,
  Info,
  Search,
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { runParallaxSwarm } from '@/services/parallaxOrchestrator';
import { ParallaxSummaryCard } from '@/components/parallax/ParallaxSummaryCard';
import { ParallaxSettings } from '@/components/parallax/ParallaxSettings';
import { ParallaxAgentAvatar } from '@/components/parallax/ParallaxAgentIcon';
import type {
  ParallaxMessage,
  ParallaxSummary,
  ParallaxSystemConfig,
  ParallaxSession,
} from '@/types';

const SAMPLE_TOPICS = [
  'Will humanoid robots replace household chores by 2035?',
  'Can universal basic income coexist with inflation?',
  'Is open-source AI safer than centralized proprietary models?',
  'Should humanity build permanent cities on Mars before fixing Earth?',
  'Is social media rewiring human memory and attention spans?',
];

export const ParallaxPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'feed' | 'settings' | 'archive'>('feed');
  const [topicInput, setTopicInput] = useState('');
  const [currentTopic, setCurrentTopic] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentRound, setCurrentRound] = useState<1 | 2 | 3 | null>(null);
  const [messages, setMessages] = useState<ParallaxMessage[]>([]);
  const [summary, setSummary] = useState<ParallaxSummary | null>(null);
  const [statusText, setStatusText] = useState<string>('Ready to mobilize 20-agent swarm.');
  const [errorText, setErrorText] = useState<string | null>(null);

  // Per-round expand states for curated viewing
  const [expandedRounds, setExpandedRounds] = useState<Record<number, boolean>>({
    1: false,
    2: false,
    3: false,
  });

  // Config & Session state
  const [config, setConfig] = useState<ParallaxSystemConfig>(() => storage.getParallaxConfig());
  const [sessions, setSessions] = useState<ParallaxSession[]>(() => storage.getParallaxSessions());

  const abortControllerRef = useRef<AbortController | null>(null);
  const feedEndRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Sync config from storage
  useEffect(() => {
    const handleStorage = () => {
      setConfig(storage.getParallaxConfig());
      setSessions(storage.getParallaxSessions());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Auto-scroll feed on new messages
  useEffect(() => {
    if (autoScroll && feedEndRef.current && isRunning) {
      feedEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, autoScroll, isRunning]);

  const toggleRoundExpand = (roundNum: number) => {
    setExpandedRounds((prev) => ({ ...prev, [roundNum]: !prev[roundNum] }));
  };

  const handleStartSwarm = async (topicToRun?: string) => {
    const targetTopic = (topicToRun || topicInput).trim();
    if (!targetTopic) return;

    // Reset swarm state
    setErrorText(null);
    setSummary(null);
    setMessages([]);
    setCurrentTopic(targetTopic);
    setIsRunning(true);
    setCurrentRound(1);
    setStatusText('Mobilizing 20-agent cognitive mesh...');
    setExpandedRounds({ 1: false, 2: false, 3: false });
    setAutoScroll(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    await runParallaxSwarm({
      topic: targetTopic,
      config,
      signal: controller.signal,
      onRoundStart: (r) => {
        setCurrentRound(r);
      },
      onMessage: (msg) => {
        setMessages((prev) => [...prev, msg]);
      },
      onStatusUpdate: (status) => {
        setStatusText(status);
      },
      onComplete: (sum) => {
        setSummary(sum);
        setIsRunning(false);
        setSessions(storage.getParallaxSessions());
      },
      onError: (err) => {
        setErrorText(err);
        setIsRunning(false);
      },
    });

    setIsRunning(false);
  };

  const handleStopSwarm = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsRunning(false);
    setStatusText('Swarm halted by operator.');
  };

  const enabledAgentsCount = Object.values(config.agents || {}).filter((a) => a.enabled !== false).length;

  return (
    <div
      id="parallax-page"
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '24px 20px 80px',
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Top HUD Header */}
      <div
        id="parallax-header"
        style={{
          borderRadius: '16px',
          padding: '20px 24px',
          background: 'linear-gradient(135deg, rgba(8, 22, 34, 0.95) 0%, rgba(4, 12, 18, 0.98) 100%)',
          border: '1.5px solid rgba(97, 215, 201, 0.35)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.25) 0%, rgba(97, 215, 201, 0.25) 100%)',
              border: '1.5px solid rgba(97, 215, 201, 0.5)',
              display: 'grid',
              placeItems: 'center',
              color: '#61d7c9',
              boxShadow: '0 0 20px rgba(6, 182, 212, 0.3)',
            }}
          >
            <Network size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 900, letterSpacing: '-0.02em', color: '#fff' }}>
                PARALLAX
              </h1>
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'DM Mono, monospace',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: 'rgba(97, 215, 201, 0.15)',
                  color: '#61d7c9',
                  border: '1px solid rgba(97, 215, 201, 0.35)',
                }}
              >
                SWARM MATRIX v1.0
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#94a3b8' }}>
              20-Persona High-Velocity Swarm Discussion • 3-Round Hard Cap • VERITAS Tool Grounding
            </p>
          </div>
        </div>

        {/* HUD Badges & Round Tracker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Round Indicator Pill */}
          <div
            id="parallax-round-indicator"
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              background: isRunning
                ? 'rgba(6, 182, 212, 0.2)'
                : summary
                ? 'rgba(34, 197, 94, 0.2)'
                : 'rgba(15, 23, 42, 0.8)',
              border: `1px solid ${
                isRunning
                  ? 'rgba(6, 182, 212, 0.5)'
                  : summary
                  ? 'rgba(34, 197, 94, 0.5)'
                  : 'rgba(165, 207, 214, 0.2)'
              }`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              fontWeight: 700,
              fontFamily: 'DM Mono, monospace',
              color: isRunning ? '#38bdf8' : summary ? '#4ade80' : '#cbd5e1',
            }}
          >
            {isRunning && (
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#38bdf8',
                  boxShadow: '0 0 8px #38bdf8',
                  animation: 'pulse 1.5s infinite',
                }}
              />
            )}
            {isRunning
              ? `ROUND ${currentRound || 1} OF 3`
              : summary
              ? 'SWARM COMPLETE (3/3)'
              : 'READY (3 ROUNDS)'}
          </div>

          {/* Active Agents Badge */}
          <div
            style={{
              padding: '6px 12px',
              borderRadius: '999px',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(165, 207, 214, 0.2)',
              fontSize: '12px',
              fontFamily: 'DM Mono, monospace',
              color: '#94a3b8',
            }}
          >
            <strong style={{ color: '#61d7c9' }}>{enabledAgentsCount}</strong>/20 Personas
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div
        id="parallax-tabs-nav"
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid rgba(165, 207, 214, 0.15)',
          paddingBottom: '12px',
          marginBottom: '20px',
        }}
      >
        <button
          id="parallax-tab-feed"
          type="button"
          onClick={() => setActiveTab('feed')}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            background: activeTab === 'feed' ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
            border: `1px solid ${activeTab === 'feed' ? 'rgba(6, 182, 212, 0.4)' : 'transparent'}`,
            color: activeTab === 'feed' ? '#61d7c9' : '#94a3b8',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <MessageSquare size={16} />
          Swarm Live Feed
          {messages.length > 0 && (
            <span
              style={{
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '999px',
                background: '#0891b2',
                color: '#fff',
              }}
            >
              {messages.length}
            </span>
          )}
        </button>

        <button
          id="parallax-tab-settings"
          type="button"
          onClick={() => setActiveTab('settings')}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            background: activeTab === 'settings' ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
            border: `1px solid ${activeTab === 'settings' ? 'rgba(6, 182, 212, 0.4)' : 'transparent'}`,
            color: activeTab === 'settings' ? '#61d7c9' : '#94a3b8',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <Settings2 size={16} />
          Agent Configurations (20)
        </button>

        <button
          id="parallax-tab-archive"
          type="button"
          onClick={() => setActiveTab('archive')}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            background: activeTab === 'archive' ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
            border: `1px solid ${activeTab === 'archive' ? 'rgba(6, 182, 212, 0.4)' : 'transparent'}`,
            color: activeTab === 'archive' ? '#61d7c9' : '#94a3b8',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <Archive size={16} />
          Past Swarms ({sessions.length})
        </button>
      </div>

      {/* TAB CONTENT: SETTINGS */}
      {activeTab === 'settings' && (
        <ParallaxSettings config={config} onConfigChange={(newCfg) => setConfig(newCfg)} />
      )}

      {/* TAB CONTENT: ARCHIVE */}
      {activeTab === 'archive' && (
        <div id="parallax-archive-tab" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' }}>
              Saved Swarm Discussions ({sessions.length})
            </h3>
            {sessions.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  storage.clearParallaxSessions();
                  setSessions([]);
                  setSelectedArchivedSession(null);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Trash2 size={14} />
                Clear Archive
              </button>
            )}
          </div>

          {sessions.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#94a3b8',
                borderRadius: '12px',
                background: 'rgba(8, 22, 34, 0.5)',
                border: '1px dashed rgba(165, 207, 214, 0.2)',
              }}
            >
              No archived sessions yet. Run a swarm from the Live Feed tab to see past synthesis reports here.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {sessions.map((sess) => (
                <div
                  key={sess.id}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'rgba(8, 22, 34, 0.8)',
                    border: '1px solid rgba(97, 215, 201, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#fff', lineHeight: 1.4 }}>
                      &ldquo;{sess.topic}&rdquo;
                    </span>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'DM Mono, monospace' }}>
                      {new Date(sess.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  {sess.summary && (
                    <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.4 }}>
                      <strong style={{ color: '#61d7c9' }}>Lean:</strong> {sess.summary.consensusLean}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'DM Mono, monospace' }}>
                      {sess.messages.length} messages (3 rounds)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setMessages(sess.messages);
                        setSummary(sess.summary || null);
                        setCurrentTopic(sess.topic);
                        setActiveTab('feed');
                      }}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '6px',
                        background: 'rgba(6, 182, 212, 0.2)',
                        border: '1px solid rgba(6, 182, 212, 0.4)',
                        color: '#61d7c9',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Load in Feed
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: FEED */}
      {activeTab === 'feed' && (
        <div id="parallax-feed-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Topic Input Bar & Presets */}
          <div
            id="parallax-input-container"
            style={{
              padding: '16px 20px',
              borderRadius: '16px',
              background: 'linear-gradient(145deg, rgba(8, 22, 34, 0.9) 0%, rgba(4, 12, 18, 0.95) 100%)',
              border: '1px solid rgba(97, 215, 201, 0.3)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            }}
          >
            {/* Input Row */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                id="parallax-topic-input"
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isRunning) {
                    e.preventDefault();
                    handleStartSwarm();
                  }
                }}
                disabled={isRunning}
                placeholder="Enter topic for 20-agent swarm discussion (e.g. Will humanoid robots replace household chores?)..."
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1.5px solid rgba(165, 207, 214, 0.25)',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none',
                }}
                className="focus:border-[#61d7c9] transition-colors"
              />

              {isRunning ? (
                <button
                  id="parallax-stop-swarm-btn"
                  type="button"
                  onClick={handleStopSwarm}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '12px',
                    background: 'rgba(239, 68, 68, 0.25)',
                    border: '1.5px solid rgba(239, 68, 68, 0.6)',
                    color: '#f87171',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Square size={16} />
                  Stop Swarm
                </button>
              ) : (
                <button
                  id="parallax-start-swarm-btn"
                  type="button"
                  onClick={() => handleStartSwarm()}
                  disabled={!topicInput.trim()}
                  style={{
                    padding: '12px 26px',
                    borderRadius: '12px',
                    background: topicInput.trim()
                      ? 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'
                      : 'rgba(15, 23, 42, 0.6)',
                    border: 'none',
                    color: topicInput.trim() ? '#fff' : '#64748b',
                    fontSize: '14px',
                    fontWeight: 800,
                    cursor: topicInput.trim() ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    whiteSpace: 'nowrap',
                    boxShadow: topicInput.trim() ? '0 0 20px rgba(6, 182, 212, 0.4)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                  className={topicInput.trim() ? 'hover:opacity-90 active:scale-95' : ''}
                >
                  <Sparkles size={16} />
                  Start Parallax
                </button>
              )}
            </div>

            {/* Starter Presets */}
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#94a3b8', fontWeight: 600 }}>
                POPULAR TOPICS:
              </span>
              {SAMPLE_TOPICS.map((topic, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={isRunning}
                  onClick={() => {
                    setTopicInput(topic);
                    handleStartSwarm(topic);
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid rgba(165, 207, 214, 0.2)',
                    color: '#cbd5e1',
                    fontSize: '11px',
                    cursor: isRunning ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  className="hover:border-[#61d7c9] hover:text-[#61d7c9]"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          {/* Current Swarm Status Bar */}
          <div
            id="parallax-status-bar"
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              background: 'rgba(6, 16, 24, 0.75)',
              border: '1px solid rgba(97, 215, 201, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              fontSize: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={14} color="#61d7c9" />
              <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{statusText}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#94a3b8' }}>
              <span style={{ fontFamily: 'DM Mono, monospace' }}>
                <strong style={{ color: '#61d7c9' }}>{enabledAgentsCount}</strong> agents active
              </span>
              <span>•</span>
              <span style={{ fontFamily: 'DM Mono, monospace', color: '#38bdf8' }}>
                Auto-stops after round 3
              </span>
            </div>
          </div>

          {/* Error Banner */}
          {errorText && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                fontSize: '13px',
              }}
            >
              {errorText}
            </div>
          )}

          {/* Live YouTube-Style Swarm Feed */}
          <div
            id="parallax-live-feed-container"
            style={{
              borderRadius: '16px',
              background: 'rgba(4, 12, 18, 0.95)',
              border: '1px solid rgba(97, 215, 201, 0.25)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              padding: '20px',
              minHeight: '380px',
              maxHeight: '650px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            {messages.length === 0 && !isRunning ? (
              <div
                style={{
                  margin: 'auto',
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#94a3b8',
                }}
              >
                <Network size={42} color="rgba(97, 215, 201, 0.4)" style={{ margin: '0 auto 16px' }} />
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#e2e8f0' }}>
                  No Active Swarm
                </h3>
                <p style={{ margin: 0, fontSize: '13px', maxWidth: '420px', lineHeight: 1.5 }}>
                  Enter a topic above and tap <strong>Start Parallax</strong>. Exactly 20 small AI personas will react across 3 rounds, then auto-stop and generate a consensus summary.
                </p>
              </div>
            ) : (
              <>
                {/* RENDER BY ROUND WITH INLINE CURATION (first 4-5 inline, rest collapsed) */}
                {[1, 2, 3].map((roundNum) => {
                  const roundMsgs = messages.filter((m) => m.round === roundNum);
                  if (roundMsgs.length === 0) return null;

                  const isExpanded = Boolean(expandedRounds[roundNum]);
                  const CURATED_COUNT = 5;
                  const visibleMsgs = isExpanded ? roundMsgs : roundMsgs.slice(0, CURATED_COUNT);
                  const hiddenCount = Math.max(0, roundMsgs.length - CURATED_COUNT);

                  return (
                    <div key={roundNum} id={`parallax-round-section-${roundNum}`}>
                      {/* Round Header Divider */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          marginBottom: '14px',
                          paddingBottom: '8px',
                          borderBottom: '1px solid rgba(165, 207, 214, 0.15)',
                        }}
                      >
                        <div
                          style={{
                            padding: '3px 10px',
                            borderRadius: '6px',
                            background: 'rgba(6, 182, 212, 0.2)',
                            border: '1px solid rgba(6, 182, 212, 0.4)',
                            fontSize: '11px',
                            fontFamily: 'DM Mono, monospace',
                            fontWeight: 800,
                            color: '#38bdf8',
                          }}
                        >
                          ROUND {roundNum} OF 3
                        </div>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {roundNum === 1
                            ? 'Initial reactions to topic (VERITAS tool grounding)'
                            : roundNum === 2
                            ? 'Reacting to peer statements from Round 1'
                            : 'Final synthesis reactions before hard stop'}
                        </span>
                        <span
                          style={{
                            marginLeft: 'auto',
                            fontSize: '11px',
                            fontFamily: 'DM Mono, monospace',
                            color: '#61d7c9',
                          }}
                        >
                          {roundMsgs.length} replies
                        </span>
                      </div>

                      {/* YouTube Chat Style Message Stream */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {visibleMsgs.map((msg) => (
                          <div
                            key={msg.id}
                            className="transition-all duration-200"
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '10px',
                              padding: '8px 12px',
                              borderRadius: '10px',
                              background: 'rgba(8, 22, 34, 0.65)',
                              borderLeft: `3px solid ${msg.accentColor}`,
                            }}
                          >
                            {/* Agent Icon Avatar */}
                            <ParallaxAgentAvatar
                              agentId={msg.agentId}
                              agentName={msg.agentName}
                              accentColor={msg.accentColor}
                              size="sm"
                              style={{ marginTop: '2px' }}
                            />

                            {/* Message Content */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  flexWrap: 'wrap',
                                  marginBottom: '2px',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: '12px',
                                    fontWeight: 800,
                                    color: msg.accentColor,
                                    fontFamily: 'DM Mono, monospace',
                                  }}
                                >
                                  {msg.agentName}
                                </span>

                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontFamily: 'DM Mono, monospace',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    background: 'rgba(148, 163, 184, 0.1)',
                                    color: '#94a3b8',
                                  }}
                                >
                                  R{msg.round}
                                </span>

                                {msg.toolUsed && (
                                  <span
                                    title={`Fact: ${msg.toolUsed.fact}`}
                                    style={{
                                      fontSize: '10px',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      background: 'rgba(6, 182, 212, 0.2)',
                                      color: '#38bdf8',
                                      border: '1px solid rgba(6, 182, 212, 0.4)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                    }}
                                  >
                                    <Search size={10} />
                                    Fact Injected
                                  </span>
                                )}

                                <span
                                  style={{
                                    fontSize: '10px',
                                    color: '#64748b',
                                    marginLeft: 'auto',
                                    fontFamily: 'DM Mono, monospace',
                                  }}
                                >
                                  {new Date(msg.timestamp).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                  })}
                                </span>
                              </div>

                              <p
                                style={{
                                  margin: 0,
                                  fontSize: '13px',
                                  color: '#e2e8f0',
                                  lineHeight: 1.5,
                                  wordBreak: 'break-word',
                                }}
                              >
                                {msg.text}
                              </p>

                              {/* Tool snippet preview if used */}
                              {msg.toolUsed && (
                                <div
                                  style={{
                                    marginTop: '4px',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    background: 'rgba(6, 182, 212, 0.08)',
                                    border: '1px solid rgba(6, 182, 212, 0.2)',
                                    fontSize: '11px',
                                    color: '#94a3b8',
                                    fontStyle: 'italic',
                                  }}
                                >
                                  🔍 <strong style={{ color: '#38bdf8' }}>Verified Tool Data:</strong> &ldquo;
                                  {msg.toolUsed.fact}&rdquo;
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Expand / Collapse Button for this Round */}
                      {hiddenCount > 0 && (
                        <button
                          id={`parallax-toggle-round-${roundNum}-btn`}
                          type="button"
                          onClick={() => toggleRoundExpand(roundNum)}
                          style={{
                            marginTop: '10px',
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: 'rgba(15, 23, 42, 0.7)',
                            border: '1px dashed rgba(97, 215, 201, 0.3)',
                            color: '#61d7c9',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease',
                          }}
                          className="hover:bg-[rgba(97,215,201,0.1)]"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp size={14} />
                              Collapse Round {roundNum} (Showing all {roundMsgs.length} replies)
                            </>
                          ) : (
                            <>
                              <ChevronDown size={14} />+{hiddenCount} more agents replied in Round {roundNum} (Click to expand)
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Parallax Summary Card (Appears after Round 3) */}
                {summary && (
                  <ParallaxSummaryCard
                    summary={summary}
                    topic={currentTopic}
                    allMessages={messages}
                    onNewTopic={() => {
                      setTopicInput('');
                      setMessages([]);
                      setSummary(null);
                    }}
                    onRerun={() => handleStartSwarm(currentTopic)}
                  />
                )}

                <div ref={feedEndRef} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
