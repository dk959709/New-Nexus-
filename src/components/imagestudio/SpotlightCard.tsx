import { useSpotlight } from './useSpotlight';
import type { CSSProperties, ReactNode } from 'react';

type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  title?: string;
  index?: number;
};

export function SpotlightCard({
  children,
  className,
  onClick,
  title,
  index = 0,
}: SpotlightCardProps) {
  const { ref, onPointerMove, onPointerLeave } = useSpotlight<HTMLDivElement>();

  return (
    <div
      ref={ref}
      onClick={onClick}
      title={title}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={`is-spotlight ${className ?? ''}`}
      style={
        {
          animationDelay: `${Math.min(index * 28, 280)}ms`,
          '--spot-x': '50%',
          '--spot-y': '50%',
        } as CSSProperties
      }
    >
      {children}
      <span aria-hidden="true" className="is-spotlight-glow" />
    </div>
  );
}
