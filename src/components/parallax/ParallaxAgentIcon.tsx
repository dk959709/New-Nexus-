import React from 'react';
import { getParallaxAgentIcon } from './agentIcons';

export interface ParallaxAgentAvatarProps {
  agentId?: string;
  agentName?: string;
  accentColor: string;
  size?: 'sm' | 'md' | 'lg';
  style?: React.CSSProperties;
  className?: string;
}

export const ParallaxAgentAvatar: React.FC<ParallaxAgentAvatarProps> = ({
  agentId,
  agentName,
  accentColor,
  size = 'md',
  style,
  className,
}) => {
  const Icon = getParallaxAgentIcon(agentId || agentName);

  const dimensions =
    size === 'sm'
      ? { box: 28, radius: 8, iconSize: 14, border: 1, glow: 10 }
      : size === 'lg'
      ? { box: 44, radius: 12, iconSize: 21, border: 1.5, glow: 18 }
      : { box: 38, radius: 10, iconSize: 18, border: 1.5, glow: 14 };

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: `${dimensions.box}px`,
        height: `${dimensions.box}px`,
        borderRadius: `${dimensions.radius}px`,
        background: `radial-gradient(circle at 30% 25%, ${accentColor}38 0%, ${accentColor}14 55%, rgba(6, 10, 18, 0.92) 100%)`,
        border: `${dimensions.border}px solid ${accentColor}88`,
        display: 'grid',
        placeItems: 'center',
        color: accentColor,
        boxShadow: `0 0 ${dimensions.glow}px ${accentColor}35, inset 0 1px 1px rgba(255, 255, 255, 0.22)`,
        flexShrink: 0,
        overflow: 'hidden',
        ...style,
      }}
      title={agentName || agentId}
    >
      {/* Internal Holographic SVG Reticle & Orbital Arc */}
      <svg
        viewBox="0 0 40 40"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          opacity: 0.75,
        }}
        aria-hidden="true"
      >
        <circle
          cx="20"
          cy="20"
          r="16.5"
          fill="none"
          stroke={accentColor}
          strokeWidth="0.8"
          strokeDasharray="6 4 2 4"
          strokeOpacity="0.55"
        />
        <circle
          cx="20"
          cy="20"
          r="13.5"
          fill="none"
          stroke={accentColor}
          strokeWidth="0.5"
          strokeOpacity="0.28"
        />
        <path
          d="M 4 9 L 4 4 L 9 4 M 31 4 L 36 4 L 36 9 M 36 31 L 36 36 L 31 36 M 9 36 L 4 36 L 4 31"
          fill="none"
          stroke={accentColor}
          strokeWidth="0.9"
          strokeOpacity="0.45"
        />
      </svg>

      <Icon
        size={dimensions.iconSize}
        color={accentColor}
        strokeWidth={2.2}
        style={{
          position: 'relative',
          zIndex: 1,
          filter: `drop-shadow(0 0 5px ${accentColor}66)`,
        }}
      />
    </div>
  );
};

