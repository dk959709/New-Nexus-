import React from 'react';

interface JarvisCornerBracketsProps {
  color?: string;
  size?: number;
  thickness?: number;
  offset?: number;
  className?: string;
  glow?: boolean;
}

/**
 * Faint, sharp sci-fi tactical corner brackets for framing
 * message containers, HUD panels, and diagnostic terminal readouts.
 */
export const JarvisCornerBrackets: React.FC<JarvisCornerBracketsProps> = ({
  color = 'rgba(56, 189, 248, 0.45)',
  size = 10,
  className = '',
  glow = true,
}) => {
  return (
    <div
      className={`absolute inset-0 pointer-events-none z-10 ${className}`}
      aria-hidden="true"
      style={{
        filter: glow ? `drop-shadow(0 0 4px ${color})` : 'none',
      }}
    >
      {/* Top-Left Corner */}
      <svg
        className="absolute top-0 left-0"
        width={size + 2}
        height={size + 2}
        viewBox={`0 0 ${size + 2} ${size + 2}`}
        fill="none"
      >
        <path
          d={`M 1 ${size + 1} L 1 1 L ${size + 1} 1`}
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="square"
        />
        <circle cx="1" cy="1" r="1" fill={color} />
      </svg>

      {/* Top-Right Corner */}
      <svg
        className="absolute top-0 right-0"
        width={size + 2}
        height={size + 2}
        viewBox={`0 0 ${size + 2} ${size + 2}`}
        fill="none"
      >
        <path
          d={`M 1 1 L ${size + 1} 1 L ${size + 1} ${size + 1}`}
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="square"
        />
        <circle cx={size + 1} cy="1" r="1" fill={color} />
      </svg>

      {/* Bottom-Left Corner */}
      <svg
        className="absolute bottom-0 left-0"
        width={size + 2}
        height={size + 2}
        viewBox={`0 0 ${size + 2} ${size + 2}`}
        fill="none"
      >
        <path
          d={`M 1 1 L 1 ${size + 1} L ${size + 1} ${size + 1}`}
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="square"
        />
        <circle cx="1" cy={size + 1} r="1" fill={color} />
      </svg>

      {/* Bottom-Right Corner */}
      <svg
        className="absolute bottom-0 right-0"
        width={size + 2}
        height={size + 2}
        viewBox={`0 0 ${size + 2} ${size + 2}`}
        fill="none"
      >
        <path
          d={`M ${size + 1} 1 L ${size + 1} ${size + 1} L 1 ${size + 1}`}
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="square"
        />
        <circle cx={size + 1} cy={size + 1} r="1" fill={color} />
      </svg>
    </div>
  );
};
