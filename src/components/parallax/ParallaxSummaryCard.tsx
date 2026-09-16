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
} from 'lucide-react';
import type { ParallaxSummary, ParallaxMessage } from '@/types';

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

  const handleCopyTranscript = () => {
    let text = `=== PARALLAX SWARM TRANSCRIPT ===\nTopic: ${topic}\nConsensus Lean: ${summary.consensusLean}\nVerdict: ${summary.verdict}\n\nKey Highlights:\n`;
    for (const hl of summary.highlights) {
      text += `• ${hl}\n`;
    }
    text += `\n--- ROUND-BY-ROUND TRANSCRIPT ---\n`;
    for (let r = 1; r <= 3; r++) {
      text += `\n[ROUND ${r}]\n`;
      const roundMsgs = allMessages.filter((m) => m.round === r);
      for (const m of roundMsgs) {
        text += `${m.agentName}: "${m.text}"\n`;
      }
    }
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
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid rgba(97, 215, 201, 0.2)',
          paddingBottom: '16px',
          marginBottom: '18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.25) 0%, rgba(97, 215, 201, 0.35) 100%)',
              border: '1.5px solid rgba(97, 215, 201, 0.6)',
              display: 'grid',
              placeItems: 'center',
              color: '#61d7c9',
              boxShadow: '0 0 16px rgba(97, 215, 201, 0.3)',
            }}
          >
            <Trophy size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                }}
              >
                3 ROUNDS COMPLETE • AUTO-STOPPED
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Topic:</span>
              <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 600 }}>&ldquo;{topic}&rdquo;</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            id="parallax-copy-transcript-btn"
            type="button"
            onClick={handleCopyTranscript}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(97, 215, 201, 0.3)',
              color: copied ? '#61d7c9' : '#cbd5e1',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
            className="hover:border-[#61d7c9] hover:text-white"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied Transcript!' : 'Copy Transcript'}
          </button>

          {onRerun && (
            <button
              id="parallax-rerun-btn"
              type="button"
              onClick={onRerun}
              style={{
                padding: '7px 14px',
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
              }}
              className="hover:border-[#61d7c9] hover:text-white"
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
              style={{
                padding: '7px 14px',
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
              }}
              className="hover:opacity-90"
            >
              <Sparkles size={14} />
              New Swarm
            </button>
          )}
        </div>
      </div>

      {/* Consensus Lean & Verdict */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {/* Consensus Lean Pill */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: '12px',
            background: 'rgba(6, 16, 24, 0.65)',
            border: '1px solid rgba(97, 215, 201, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <Compass size={14} color="#61d7c9" />
            <span style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#61d7c9', fontWeight: 700, letterSpacing: '0.05em' }}>
              CONSENSUS LEAN
            </span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.01em' }}>
            {summary.consensusLean}
          </div>
        </div>

        {/* Total Contributions */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: '12px',
            background: 'rgba(6, 16, 24, 0.65)',
            border: '1px solid rgba(97, 215, 201, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <Layers size={14} color="#61d7c9" />
            <span style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#61d7c9', fontWeight: 700, letterSpacing: '0.05em' }}>
              SWARM SCALE
            </span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.01em' }}>
            {summary.totalContributions} Contributions across 3 Rounds
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: m.accentColor, fontFamily: 'DM Mono, monospace' }}>
                            {m.agentName}
                          </span>
                          {m.toolUsed && (
                            <span style={{ fontSize: '10px', color: '#38bdf8', background: 'rgba(6, 182, 212, 0.2)', padding: '1px 6px', borderRadius: '4px' }}>
                              🔍 Verified Fact Used
                            </span>
                          )}
                        </div>
                        <p style={{ margin: 0, fontSize: '13px', color: '#e2e8f0', lineHeight: 1.45 }}>
                          {m.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
