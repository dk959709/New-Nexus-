import React from 'react';
import { CheckCircle2, Search, Zap, Check } from 'lucide-react';
import type { ParallaxMessage } from '@/types';

interface ParallaxRoundTrackerProps {
  currentRound: 1 | 2 | 3 | null;
  isRunning: boolean;
  isComplete: boolean;
  wasStoppedEarly: boolean;
  messages: ParallaxMessage[];
}

export const ParallaxRoundTracker: React.FC<ParallaxRoundTrackerProps> = ({
  currentRound,
  isRunning,
  isComplete,
  wasStoppedEarly,
  messages,
}) => {
  const roundCounts = {
    1: messages.filter((m) => m.round === 1).length,
    2: messages.filter((m) => m.round === 2).length,
    3: messages.filter((m) => m.round === 3).length,
  };

  const roundsInfo = [
    {
      round: 1 as const,
      label: 'ROUND 1: THESIS',
      subtitle: 'VERITAS Tool Grounding & Initial Takes',
      icon: Search,
      target: 20,
    },
    {
      round: 2 as const,
      label: 'ROUND 2: CROSS-EXAMINATION',
      subtitle: 'Direct Peer Pushback & Dialectics',
      icon: Zap,
      target: 20,
    },
    {
      round: 3 as const,
      label: 'ROUND 3: SYNTHESIS',
      subtitle: 'Consensus Resolution & Hard Stop',
      icon: CheckCircle2,
      target: 20,
    },
  ];

  return (
    <div
      id="parallax-round-tracker"
      className="parallax-round-stepper-tracker"
      style={{
        padding: '14px 18px',
        borderRadius: '14px',
        background: 'linear-gradient(145deg, rgba(8, 20, 32, 0.85) 0%, rgba(4, 12, 18, 0.95) 100%)',
        border: '1px solid rgba(97, 215, 201, 0.25)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Top Status Title & Hard Cap Badge */}
      <div className="parallax-tracker-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            className="parallax-tracker-title"
            style={{
              fontSize: '11px',
              fontFamily: 'DM Mono, monospace',
              color: '#61d7c9',
              fontWeight: 800,
              letterSpacing: '0.06em',
            }}
          >
            DELIBERATION PROTOCOL CHRONOLOGY
          </span>
          <span
            className="parallax-tracker-badge"
            style={{
              fontSize: '10px',
              fontFamily: 'DM Mono, monospace',
              padding: '1px 6px',
              borderRadius: '4px',
              background: 'rgba(6, 182, 212, 0.15)',
              color: '#38bdf8',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              fontWeight: 700,
            }}
          >
            3-ROUND HARD CAP
          </span>
          {wasStoppedEarly && (
            <span
              className="parallax-tracker-badge"
              style={{
                fontSize: '10px',
                fontFamily: 'DM Mono, monospace',
                padding: '1px 6px',
                borderRadius: '4px',
                background: 'rgba(244, 63, 94, 0.15)',
                color: '#fb7185',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                fontWeight: 700,
              }}
            >
              HALTED EARLY
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontFamily: 'DM Mono, monospace' }}>
          <span style={{ color: '#94a3b8' }}>TOTAL COMPLETED:</span>
          <strong style={{ color: '#61d7c9' }}>{messages.length}</strong>
          <span style={{ color: '#64748b' }}>/ 60 MAX</span>
        </div>
      </div>

      {/* 3 Step Timeline Cards */}
      <div
        className="parallax-tracker-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '10px',
          position: 'relative',
        }}
      >
        {roundsInfo.map((info) => {
          const rNum = info.round;
          const count = roundCounts[rNum];
          const isActive = isRunning && currentRound === rNum;
          const isDone = isComplete || (currentRound && currentRound > rNum) || (!isRunning && count >= 20);

          const StepIcon = info.icon;

          return (
            <div
              key={rNum}
              id={`parallax-tracker-step-${rNum}`}
              className="parallax-tracker-card"
              style={{
                position: 'relative',
                padding: '10px 14px',
                borderRadius: '10px',
                background: isActive
                  ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.18) 0%, rgba(97, 215, 201, 0.12) 100%)'
                  : isDone
                  ? 'rgba(16, 185, 129, 0.08)'
                  : 'rgba(15, 23, 42, 0.55)',
                border: `1.5px solid ${
                  isActive
                    ? 'rgba(6, 182, 212, 0.7)'
                    : isDone
                    ? 'rgba(16, 185, 129, 0.4)'
                    : 'rgba(165, 207, 214, 0.15)'
                }`,
                boxShadow: isActive ? '0 0 16px rgba(6, 182, 212, 0.25)' : 'none',
                transition: 'all 0.25s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              {/* Step Status Icon / Number */}
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: isActive
                    ? 'rgba(6, 182, 212, 0.3)'
                    : isDone
                    ? 'rgba(16, 185, 129, 0.25)'
                    : 'rgba(148, 163, 184, 0.1)',
                  border: `1px solid ${
                    isActive
                      ? '#38bdf8'
                      : isDone
                      ? '#10b981'
                      : 'rgba(148, 163, 184, 0.2)'
                  }`,
                  display: 'grid',
                  placeItems: 'center',
                  color: isActive ? '#38bdf8' : isDone ? '#4ade80' : '#94a3b8',
                  flexShrink: 0,
                  boxShadow: isActive ? '0 0 10px rgba(56, 189, 248, 0.4)' : 'none',
                }}
              >
                {isDone ? (
                  <Check size={16} strokeWidth={2.6} />
                ) : (
                  <StepIcon size={15} className={isActive ? 'animate-pulse' : ''} />
                )}
              </div>

              {/* Step Info */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                  <span
                    className="parallax-tracker-step-title"
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      fontFamily: 'DM Mono, monospace',
                      color: isActive ? '#38bdf8' : isDone ? '#4ade80' : '#cbd5e1',
                    }}
                  >
                    {info.label}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      fontFamily: 'DM Mono, monospace',
                      fontWeight: 700,
                      color: isActive ? '#38bdf8' : isDone ? '#34d399' : '#64748b',
                    }}
                  >
                    {count}/20
                  </span>
                </div>

                <div
                  className="parallax-tracker-step-desc"
                  style={{
                    fontSize: '10px',
                    color: '#94a3b8',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: '2px',
                  }}
                >
                  {info.subtitle}
                </div>

                {/* Progress bar line */}
                <div
                  style={{
                    marginTop: '5px',
                    height: '3px',
                    borderRadius: '2px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, (count / 20) * 100)}%`,
                      height: '100%',
                      background: isActive
                        ? 'linear-gradient(90deg, #06b6d4, #61d7c9)'
                        : isDone
                        ? '#10b981'
                        : '#64748b',
                      boxShadow: isActive ? '0 0 6px #06b6d4' : 'none',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
