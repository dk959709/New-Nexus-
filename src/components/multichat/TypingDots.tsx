import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface TypingDotsProps {
  /** Accent color taken from the persona (hex string). */
  color?: string;
  /** Dot diameter in px. Keep small — this renders 3 dots per running agent. */
  size?: number;
  className?: string;
}

/**
 * Lightweight "agent is typing" indicator.
 * Transform/opacity only, so it stays cheap on low-RAM phones.
 * Falls back to static dots when the user prefers reduced motion.
 */
export const TypingDots: React.FC<TypingDotsProps> = ({
  color = '#38bdf8',
  size = 4,
  className = '',
}) => {
  const reduceMotion = useReducedMotion();

  const dotStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: 999,
    backgroundColor: color,
  };

  if (reduceMotion) {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`} aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ ...dotStyle, opacity: 0.7 }} />
        ))}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      role="status"
      aria-label="Agent is thinking"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          style={dotStyle}
          animate={{ y: [0, -3, 0], opacity: [0.45, 1, 0.45] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </span>
  );
};

export default TypingDots;
