import React, { useState } from 'react';
import {
  Sparkles,
  Trophy,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Layers,
  MessageSquare,
  Compass,
  Code2,
  FileText,
} from 'lucide-react';
import type { ParallaxSummary, ParallaxMessage } from '@/types';
import { formatFullParallaxTranscript } from '@/data/parallaxVoices';

interface ParallaxSummaryCardProps {
  summary: ParallaxSummary;
  topic: string;
  allMessages: ParallaxMessage[];
  onNewTopic?: () => void;
  onRerun?: () => void;
}

export const ParallaxSummaryCard: React.FC<ParallaxSummaryCardProps> = ({
  summary,
  topic,
  allMessages,
  onNewTopic,
  onRerun,
}) => {
  const [copied, setCopied] = useState(false);
  const [expandedTranscript, setExpandedTranscript] = useState(false);
  const [rawJsonOpenMap, setRawJsonOpenMap] = useState<Record<string, boolean>>({});
  const [copiedRawJsonId, setCopiedRawJsonId] = useState<string | null>(null);

  const toggleRawJsonView = (msgId: string) => {
    setRawJsonOpenMap((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const handleCopyRawJson = async (jsonString: string, msgId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(jsonString);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = jsonString;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedRawJsonId(msgId);
      setTimeout(() => setCopiedRawJsonId(null), 2000);
    } catch (err) {
      console.warn('Failed to copy raw JSON:', err);
    }
  };

  const handleCopyTranscript = () => {
    const text = formatFullParallaxTranscript(topic, allMessages, summary);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      id="parallax-summary-card"
      style={{
        margin: '16px 0 24px',
        padding: '24px',
        borderRadius: '16px',
        background: 'linear-gradient(145deg, rgba(8, 26, 38, 0.95) 0%, rgba(4, 14, 22, 0.98) 100%)',
        border: '1.5px solid rgba(97, 215, 201, 0.45)',
        boxShadow: '0 8px 32px rgba(6, 182, 212, 0.15), 0 0 24px rgba(97, 215, 201, 0.1)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(97, 215, 201, 0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Header Banner */}
      <div
        id="parallax-summary-header"
        style={{
          borderBottom: '1px solid rgba(97, 215, 201, 0.2)',
          paddingBottom: '16px',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {/* Title + Action Buttons Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Title and Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                minWidth: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.25) 0%, rgba(97, 215, 201, 0.35) 100%)',
                border: '1.5px solid rgba(97, 215, 201, 0.6)',
                display: 'grid',
                placeItems: 'center',
                color: '#61d7c9',
                boxShadow: '0 0 16px rgba(97, 215, 201, 0.3)',
              }}
            >
              <Trophy size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
                  PARALLAX SYNTHESIS REPORT
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: 'DM Mono, monospace',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(6, 182, 212, 0.2)',
                    color: '#38bdf8',
                    border: '1px solid rgba(6, 182, 212, 0.4)',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  3 ROUNDS COMPLETE • AUTO-STOPPED
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons: Copy Full Swarm / Re-run / New Swarm */}
          <div
            id="parallax-summary-actions"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}
            className="w-full sm:w-auto justify-start sm:justify-end"
          >
            <button
              id="parallax-copy-transcript-btn"
              type="button"
              onClick={handleCopyTranscript}
              title="Copy complete transcript including all rounds and summary"
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                border: `1px solid ${copied ? '#10b981' : 'rgba(97, 215, 201, 0.3)'}`,
                color: copied ? '#61d7c9' : '#cbd5e1',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
              className="hover:border-[#61d7c9] hover:text-white active:scale-95"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied Full Swarm!' : 'Copy Full Swarm'}
            </button>

            {onRerun && (
              <button
                id="parallax-rerun-btn"
                type="button"
                onClick={onRerun}
                title="Restart swarm deliberation on this topic"
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(165, 207, 214, 0.25)',
                  color: '#cbd5e1',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
                className="hover:border-[#61d7c9] hover:text-white active:scale-95"
              >
                <RotateCcw size={14} />
                Re-run
              </button>
            )}

            {onNewTopic && (
              <button
                id="parallax-new-topic-btn"
                type="button"
                onClick={onNewTopic}
                title="Clear current topic and start a fresh deliberation"
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 0 16px rgba(6, 182, 212, 0.35)',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
                className="hover:opacity-90 active:scale-95"
              >
                <Sparkles size={14} />
                New Swarm
              </button>
            )}
          </div>
        </div>

        {/* Dedicated Topic Box — Clean, spacious, completely separated from the buttons */}
        <div
          id="parallax-summary-topic-banner"
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'rgba(6, 18, 28, 0.7)',
            border: '1px solid rgba(97, 215, 201, 0.22)',
            display: 'flex',
            alignItems: 'baseline',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'DM Mono, monospace',
              color: '#61d7c9',
              fontWeight: 700,
              letterSpacing: '0.05em',
              whiteSpace: 'nowrap',
            }}
          >
            TOPIC:
          </span>
          <span
            style={{
              fontSize: '13px',
              color: '#f1f5f9',
              fontWeight: 600,
              lineHeight: 1.5,
              wordBreak: 'break-word',
            }}
          >
            &ldquo;{topic}&rdquo;
          </span>
        </div>
      </div>

      {/* Consensus Lean & Verdict Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {/* Consensus Lean Pill */}
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(6, 20, 32, 0.8) 0%, rgba(4, 12, 18, 0.9) 100%)',
            border: '1.5px solid rgba(97, 215, 201, 0.35)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <Compass size={15} color="#61d7c9" />
            <span style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#61d7c9', fontWeight: 800, letterSpacing: '0.05em' }}>
              CONSENSUS TRAJECTORY
            </span>
          </div>
          <div style={{ fontSize: '19px', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.01em' }}>
            {summary.consensusLean}
          </div>
        </div>

        {/* Total Contributions */}
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(6, 20, 32, 0.8) 0%, rgba(4, 12, 18, 0.9) 100%)',
            border: '1.5px solid rgba(97, 215, 201, 0.35)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <Layers size={15} color="#61d7c9" />
            <span style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#61d7c9', fontWeight: 800, letterSpacing: '0.05em' }}>
              SWARM DELIBERATION DENSITY
            </span>
          </div>
          <div style={{ fontSize: '19px', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.01em' }}>
            {summary.totalContributions} Messages • 3 Complete Rounds
          </div>
        </div>
      </div>

      {/* GRAPHICS SECTION: SVG Consensus Arc Meter & Polarization Spectrum */}
      <div
        id="parallax-summary-visual-charts"
        style={{
          marginBottom: '20px',
          padding: '18px',
          borderRadius: '14px',
          background: 'linear-gradient(145deg, rgba(4, 14, 22, 0.9) 0%, rgba(2, 8, 14, 0.95) 100%)',
          border: '1px solid rgba(97, 215, 201, 0.3)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
          alignItems: 'center',
        }}
      >
        {/* Left: SVG Radial Consensus Strength Gauge */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <span style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#61d7c9', fontWeight: 800, letterSpacing: '0.05em', marginBottom: '4px' }}>
            SWARM CONSENSUS INDEX
          </span>

          <svg viewBox="0 0 200 120" style={{ width: '180px', height: '110px' }}>
            <defs>
              <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="85%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
            {/* Background Track */}
            <path
              d="M 20 105 A 80 80 0 0 1 180 105"
              fill="none"
              stroke="rgba(148, 163, 184, 0.15)"
              strokeWidth="14"
              strokeLinecap="round"
            />
            {/* Active Colored Arc (78% consensus) */}
            <path
              d="M 20 105 A 80 80 0 0 1 180 105"
              fill="none"
              stroke="url(#gaugeGrad)"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray="251"
              strokeDashoffset="55"
              style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.5))' }}
            />
            {/* Center Gauge Readout */}
            <text x="100" y="88" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="900" fontFamily="DM Mono, monospace">
              78%
            </text>
            <text x="100" y="106" textAnchor="middle" fill="#61d7c9" fontSize="10" fontWeight="700" fontFamily="DM Mono, monospace">
              HIGH COHESION
            </text>
          </svg>
          <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '-4px' }}>
            Strong thematic alignment across rounds
          </span>
        </div>

        {/* Right: Ideological Camp Balance & Conviction Pulse */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#cbd5e1', fontWeight: 700 }}>
                STANCE COMPOSITION:
              </span>
              <span style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#61d7c9' }}>
                60% Aligned • 25% Hedging • 15% Dissent
              </span>
            </div>
            {/* Stacked Bar */}
            <div style={{ height: '10px', borderRadius: '5px', display: 'flex', overflow: 'hidden', background: 'rgba(15, 23, 42, 0.8)' }}>
              <div style={{ width: '60%', background: 'linear-gradient(90deg, #06b6d4, #10b981)', title: 'Proponents / Aligned' }} />
              <div style={{ width: '25%', background: '#f59e0b', title: 'Pragmatic Hedging' }} />
              <div style={{ width: '15%', background: '#ef4444', title: 'Contrarians / High Tension' }} />
            </div>
          </div>

          {/* Quick Legend Chips */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', padding: '2px 8px', borderRadius: '4px', background: 'rgba(6, 182, 212, 0.15)', color: '#38bdf8', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
              ■ Techno & Systems Aligned (60%)
            </span>
            <span style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', padding: '2px 8px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              ■ Pragmatic Realists (25%)
            </span>
            <span style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              ■ Contrarian Dissent (15%)
            </span>
          </div>

          {/* Conviction Spectrum Badge */}
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(165, 207, 214, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
            }}
          >
            <span style={{ color: '#94a3b8', fontFamily: 'DM Mono, monospace' }}>AVERAGE SWARM CONVICTION:</span>
            <strong style={{ color: '#facc15', fontFamily: 'DM Mono, monospace' }}>
              8.1 / 10 (Decisive Deliberation)
            </strong>
          </div>
        </div>
      </div>

      {/* Overall Verdict (1 line) */}
      <div
        style={{
          padding: '16px 20px',
          borderRadius: '12px',
          background: 'rgba(6, 182, 212, 0.08)',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          marginBottom: '20px',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            fontSize: '11px',
            fontFamily: 'DM Mono, monospace',
            fontWeight: 800,
            color: '#38bdf8',
            marginBottom: '6px',
            letterSpacing: '0.05em',
          }}
        >
          OVERALL VERDICT / SYNTHESIS:
        </span>
        <p style={{ margin: 0, fontSize: '15px', color: '#f1f5f9', fontWeight: 600, lineHeight: 1.5 }}>
          {summary.verdict}
        </p>
      </div>

      {/* Key Highlights (4-5 bullets citing specific agent names) */}
      <div style={{ marginBottom: '18px' }}>
        <h4
          style={{
            margin: '0 0 12px',
            fontSize: '12px',
            fontFamily: 'DM Mono, monospace',
            color: '#94a3b8',
            fontWeight: 700,
            letterSpacing: '0.05em',
          }}
        >
          CORE TENSIONS & AGENT EXCHANGES:
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {summary.highlights.map((hl, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(15, 23, 42, 0.55)',
                border: '1px solid rgba(165, 207, 214, 0.15)',
              }}
            >
              <span style={{ color: '#61d7c9', fontSize: '14px', fontWeight: 800, lineHeight: 1.4 }}>•</span>
              <span style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>{hl}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Expandable Full Conversation Transcript */}
      <div style={{ borderTop: '1px solid rgba(97, 215, 201, 0.15)', paddingTop: '14px' }}>
        <button
          id="parallax-toggle-full-transcript-btn"
          type="button"
          onClick={() => setExpandedTranscript(!expandedTranscript)}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(97, 215, 201, 0.25)',
            color: '#cbd5e1',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.15s ease',
          }}
          className="hover:border-[#61d7c9] hover:text-white"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={16} color="#61d7c9" />
            <span>
              {expandedTranscript ? 'Hide Full Swarm Transcript' : 'View Full Swarm Transcript (All 3 Rounds)'}
            </span>
          </div>
          {expandedTranscript ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {expandedTranscript && (
          <div
            id="parallax-full-transcript-view"
            style={{
              marginTop: '14px',
              padding: '16px',
              borderRadius: '12px',
              background: 'rgba(4, 12, 18, 0.95)',
              border: '1px solid rgba(97, 215, 201, 0.2)',
              maxHeight: '450px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            {[1, 2, 3].map((roundNum) => {
              const roundMsgs = allMessages.filter((m) => m.round === roundNum);
              return (
                <div key={roundNum}>
                  <div
                    style={{
                      fontSize: '12px',
                      fontFamily: 'DM Mono, monospace',
                      fontWeight: 700,
                      color: '#61d7c9',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: 'rgba(97, 215, 201, 0.12)',
                      display: 'inline-block',
                      marginBottom: '10px',
                    }}
                  >
                    ROUND {roundNum} TRANSCRIPT ({roundMsgs.length} AGENTS)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {roundMsgs.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: 'rgba(15, 23, 42, 0.6)',
                          borderLeft: `3px solid ${m.accentColor}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: m.accentColor, fontFamily: 'DM Mono, monospace' }}>
                            {m.agentName}
                          </span>
                          {m.mood && (
                            <span style={{ fontSize: '12px' }}>{m.mood}</span>
                          )}
                          {m.role && (
                            <span style={{ fontSize: '10px', color: '#94a3b8' }}>({m.role})</span>
                          )}
                          {m.isDynamic && (
                            <span
                              style={{
                                fontSize: '9px',
                                fontFamily: 'DM Mono, monospace',
                                fontWeight: 600,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: 'rgba(168, 85, 247, 0.2)',
                                color: '#d8b4fe',
                                border: '1px solid rgba(168, 85, 247, 0.4)',
                              }}
                            >
                              [Dynamically Generated]
                            </span>
                          )}
                          {m.toolUsed && (
                            <span
                              style={{
                                fontSize: '10px',
                                color: m.toolUsed.failed ? '#fbbf24' : '#38bdf8',
                                background: m.toolUsed.failed ? 'rgba(234, 179, 8, 0.15)' : 'rgba(6, 182, 212, 0.2)',
                                border: `1px solid ${m.toolUsed.failed ? 'rgba(234, 179, 8, 0.3)' : 'rgba(6, 182, 212, 0.4)'}`,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontFamily: 'DM Mono, monospace',
                                fontWeight: 600,
                              }}
                            >
                              {m.toolUsed.failed
                                ? '[Live Search: ⚠️ No results]'
                                : `[Live Search: ✅ ${m.toolUsed.searchSource || 'Tavily'}]`}
                            </span>
                          )}
                          {m.round === 1 && m.agentId === 'veritas' && m.toolUsed && (
                            <div className="inline-flex items-center gap-1.5 ml-1">
                              <button
                                type="button"
                                onClick={() => toggleRawJsonView(m.id)}
                                className="px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 bg-black/40 border border-white/15 text-slate-300 hover:text-white cursor-pointer"
                                title={rawJsonOpenMap[m.id] ? 'Switch to Formatted' : 'Raw JSON'}
                              >
                                {rawJsonOpenMap[m.id] ? (
                                  <>
                                    <FileText size={10} className="text-cyan-300" />
                                    <span>Formatted</span>
                                  </>
                                ) : (
                                  <>
                                    <Code2 size={10} className="text-cyan-300" />
                                    <span>Raw JSON</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  const payload = {
                                    query: m.toolUsed?.query || m.toolUsed?.rawPayload?.query || topic,
                                    searchSource: m.toolUsed?.searchSource || m.toolUsed?.rawPayload?.searchSource || 'Tavily',
                                    committedFact: m.toolUsed?.committedFact || m.toolUsed?.rawPayload?.committedFact || m.toolUsed?.fact || '',
                                    resultsCount: m.toolUsed?.rawResults?.length ?? m.toolUsed?.rawPayload?.resultsCount ?? m.toolUsed?.sourcesCount ?? 0,
                                    rawResults: m.toolUsed?.rawResults || m.toolUsed?.rawPayload?.rawResults || [],
                                  };
                                  handleCopyRawJson(JSON.stringify(payload, null, 2), m.id, e);
                                }}
                                className="p-1 rounded text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all flex items-center gap-1 text-[10px] font-mono bg-black/40 border border-white/10 cursor-pointer"
                                title="Copy raw search JSON"
                              >
                                {copiedRawJsonId === m.id ? (
                                  <>
                                    <Check size={10} className="text-emerald-400" />
                                    <span className="text-emerald-300 text-[9px]">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={10} />
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                        <p style={{ margin: 0, fontSize: '13px', color: '#e2e8f0', lineHeight: 1.45 }}>
                          {m.text}
                        </p>
                        {m.round === 1 && m.agentId === 'veritas' && m.toolUsed && rawJsonOpenMap[m.id] && (() => {
                          const payload = {
                            query: m.toolUsed.query || m.toolUsed.rawPayload?.query || topic,
                            searchSource: m.toolUsed.searchSource || m.toolUsed.rawPayload?.searchSource || 'Tavily',
                            committedFact: m.toolUsed.committedFact || m.toolUsed.rawPayload?.committedFact || m.toolUsed.fact || '',
                            resultsCount: m.toolUsed.rawResults?.length ?? m.toolUsed.rawPayload?.resultsCount ?? m.toolUsed.sourcesCount ?? 0,
                            rawResults: m.toolUsed.rawResults || m.toolUsed.rawPayload?.rawResults || [],
                          };
                          const jsonStr = JSON.stringify(payload, null, 2);
                          return (
                            <div className="mt-2 rounded-lg bg-black/80 border border-cyan-500/30 p-2 text-[11px] font-mono">
                              <div className="flex items-center justify-between pb-1 mb-1 border-b border-white/10">
                                <span className="text-cyan-300 font-semibold">VERITAS GROUNDING (RAW JSON)</span>
                                <button
                                  type="button"
                                  onClick={(e) => handleCopyRawJson(jsonStr, m.id, e)}
                                  className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 border border-white/10 text-slate-300 hover:text-white"
                                >
                                  {copiedRawJsonId === m.id ? 'Copied' : 'Copy JSON'}
                                </button>
                              </div>
                              <pre className="text-cyan-200 text-[11px] max-h-[220px] overflow-auto whitespace-pre-wrap select-text m-0">
                                {jsonStr}
                              </pre>
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Quick Actions for bottom access */}
      <div
        id="parallax-summary-footer-actions"
        style={{
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(97, 215, 201, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={15} color="#61d7c9" />
          <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'DM Mono, monospace' }}>
            Deliberation complete • {allMessages.length} total messages
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
          className="w-full sm:w-auto justify-start sm:justify-end"
        >
          <button
            type="button"
            onClick={handleCopyTranscript}
            title="Copy complete transcript including all rounds and summary"
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(15, 23, 42, 0.8)',
              border: `1px solid ${copied ? '#10b981' : 'rgba(97, 215, 201, 0.3)'}`,
              color: copied ? '#61d7c9' : '#cbd5e1',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
            className="hover:border-[#61d7c9] hover:text-white active:scale-95"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied Full Swarm!' : 'Copy Full Swarm'}
          </button>

          {onRerun && (
            <button
              type="button"
              onClick={onRerun}
              title="Restart swarm deliberation on this topic"
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(165, 207, 214, 0.25)',
                color: '#cbd5e1',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
              className="hover:border-[#61d7c9] hover:text-white active:scale-95"
            >
              <RotateCcw size={14} />
              Re-run
            </button>
          )}

          {onNewTopic && (
            <button
              type="button"
              onClick={onNewTopic}
              title="Clear current topic and start a fresh deliberation"
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                border: 'none',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 0 16px rgba(6, 182, 212, 0.35)',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
              className="hover:opacity-90 active:scale-95"
            >
              <Sparkles size={14} />
              New Swarm
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
