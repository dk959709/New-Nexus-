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
      ? { box: 28, radius: 8, iconSize: 15, border: 1, glow: 8 }
      : size === 'lg'
      ? { box: 44, radius: 12, iconSize: 22, border: 2, glow: 16 }
      : { box: 38, radius: 10, iconSize: 19, border: 1.5, glow: 12 };

  return (
    <div
      className={className}
      style={{
        width: `${dimensions.box}px`,
        height: `${dimensions.box}px`,
        borderRadius: `${dimensions.radius}px`,
        background: `${accentColor}25`,
        border: `${dimensions.border}px solid ${accentColor}88`,
        display: 'grid',
        placeItems: 'center',
        color: accentColor,
        boxShadow: `0 0 ${dimensions.glow}px ${accentColor}33`,
        flexShrink: 0,
        ...style,
      }}
      title={agentName || agentId}
    >
      <Icon size={dimensions.iconSize} color={accentColor} strokeWidth={2.2} />
    </div>
  );
};
