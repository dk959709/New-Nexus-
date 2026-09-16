import React, { useEffect, useState } from 'react';
import { Square, Activity, Radio, Disc } from 'lucide-react';
import { ParallaxAgentAvatar } from './ParallaxAgentIcon';

interface ParallaxAudioVisualizerProps {
  isPlaying: boolean;
  activeKey: string | null; // message.id or 'full_swarm'
  activeAgentName?: string;
  activeAgentId?: string;
  accentColor?: string;
  voiceName?: string;
  progressText?: string;
  onStop: () => void;
}

export const ParallaxAudioVisualizer: React.FC<ParallaxAudioVisualizerProps> = ({
  isPlaying,
  activeKey,
  activeAgentName = 'Swarm Deliberation',
  activeAgentId,
  accentColor = '#61d7c9',
  voiceName,
  progressText,
  onStop,
}) => {
  const [waveHeights, setWaveHeights] = useState<number[]>([
    12, 28, 45, 20, 60, 35, 75, 50, 85, 40, 95, 65, 70, 45, 80, 55, 40, 65, 30, 20, 15,
  ]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setWaveHeights((prev) =>
        prev.map(() => Math.floor(Math.random() * 70) + 15)
      );
    }, 110);
    return () => clearInterval(interval);
  }, [isPlaying]);

  if (!isPlaying && !activeKey) return null;

  const isFullSwarm = activeKey === 'full_swarm';

  return (
    <div
      id="parallax-audio-visualizer-bar"
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '14px',
        padding: '12px 18px',
        background: 'linear-gradient(135deg, rgba(6, 20, 32, 0.95) 0%, rgba(4, 12, 18, 0.98) 100%)',
        border: `1.5px solid ${accentColor}66`,
        boxShadow: `0 0 24px ${accentColor}25, 0 8px 32px rgba(0, 0, 0, 0.5)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Background cyber scanline */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: `linear-gradient(90deg, transparent 0%, ${accentColor} 50%, transparent 100%)`,
          boxShadow: `0 0 10px ${accentColor}`,
          animation: 'pulse 2s infinite',
        }}
      />

      {/* Left: Speaker Identity & Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px' }}>
        {isFullSwarm ? (
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.3) 0%, rgba(97, 215, 201, 0.3) 100%)',
              border: '1.5px solid rgba(97, 215, 201, 0.8)',
              display: 'grid',
              placeItems: 'center',
              color: '#61d7c9',
              boxShadow: '0 0 16px rgba(97, 215, 201, 0.4)',
              flexShrink: 0,
            }}
          >
            <Radio size={20} className="animate-pulse" />
          </div>
        ) : (
          <ParallaxAgentAvatar
            agentId={activeAgentId}
            agentName={activeAgentName}
            accentColor={accentColor}
            size="md"
          />
        )}

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 900,
                color: isFullSwarm ? '#61d7c9' : accentColor,
                fontFamily: 'DM Mono, monospace',
                letterSpacing: '-0.01em',
              }}
            >
              {isFullSwarm ? 'FULL SWARM DELIBERATION' : activeAgentName}
            </span>
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'DM Mono, monospace',
                padding: '1px 6px',
                borderRadius: '4px',
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#4ade80',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 700,
              }}
            >
              <Activity size={10} className="animate-spin" />
              LIVE AUDIO
            </span>
          </div>

          <div
            style={{
              fontSize: '11px',
              color: '#94a3b8',
              fontFamily: 'DM Mono, monospace',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '2px',
            }}
          >
            {voiceName && (
              <span title="Neural voice model">
                <Disc size={11} style={{ display: 'inline', marginRight: '3px' }} />
                {voiceName}
              </span>
            )}
            {progressText && (
              <>
                <span>•</span>
                <span style={{ color: '#38bdf8' }}>{progressText}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Center: Dynamic Neural Waveform Frequency Bars */}
      <div
        id="parallax-oscilloscope-frequency-bars"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          height: '36px',
          padding: '0 12px',
          flex: 1,
          justifyContent: 'center',
          minWidth: '180px',
        }}
      >
        {waveHeights.map((h, i) => {
          const barColor =
            i % 3 === 0 ? accentColor : i % 2 === 0 ? '#38bdf8' : '#2dd4bf';
          return (
            <div
              key={i}
              style={{
                width: '3.5px',
                height: isPlaying ? `${Math.max(6, (h / 100) * 32)}px` : '4px',
                borderRadius: '2px',
                background: `linear-gradient(180deg, ${barColor} 0%, rgba(15, 23, 42, 0.4) 100%)`,
                boxShadow: isPlaying ? `0 0 8px ${barColor}88` : 'none',
                transition: 'height 0.1s ease',
              }}
            />
          );
        })}
      </div>

      {/* Right: Stop audio control */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          id="parallax-visualizer-stop-btn"
          type="button"
          onClick={onStop}
          style={{
            padding: '6px 14px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(185, 28, 28, 0.35) 100%)',
            border: '1.5px solid rgba(239, 68, 68, 0.65)',
            color: '#fecdd3',
            fontSize: '11px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            boxShadow: '0 0 12px rgba(239, 68, 68, 0.25)',
            whiteSpace: 'nowrap',
          }}
          className="hover:bg-red-900/60 hover:text-white active:scale-95"
          title="Stop current audio playback"
        >
          <Square size={11} fill="currentColor" />
          <span>Halt Audio</span>
        </button>
      </div>
    </div>
  );
};
