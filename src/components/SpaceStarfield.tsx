import React, { useMemo } from 'react';

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  minOpacity: number;
  maxOpacity: number;
  duration: number;
  delay: number;
  tint: 'cyan' | 'warm' | 'blue' | 'white';
}

export const SpaceStarfield: React.FC = () => {
  // Generate a fixed set of stars once
  const stars: Star[] = useMemo(() => {
    const starList: Star[] = [];
    const count = 75; // Lightweight count
    const tints: Array<'cyan' | 'warm' | 'blue' | 'white'> = ['white', 'white', 'cyan', 'blue', 'warm'];

    for (let i = 0; i < count; i++) {
      // Deterministic pseudorandom based on index
      const seed1 = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
      const rand1 = seed1 - Math.floor(seed1);

      const seed2 = Math.sin(i * 37.719 + 11.137) * 24634.6345;
      const rand2 = seed2 - Math.floor(seed2);

      const seed3 = Math.sin(i * 93.243 + 45.321) * 87342.1245;
      const rand3 = seed3 - Math.floor(seed3);

      const size = 1 + rand1 * 1.8; // 1px to 2.8px
      const minOpacity = 0.15 + rand2 * 0.25; // 0.15 to 0.40
      const maxOpacity = 0.65 + rand3 * 0.35; // 0.65 to 1.00
      const duration = 2.5 + rand1 * 4.5; // 2.5s to 7.0s
      const delay = rand2 * 5.0; // 0s to 5.0s
      const tint = tints[i % tints.length];

      starList.push({
        id: i,
        x: rand1 * 100,
        y: rand2 * 100,
        size,
        minOpacity,
        maxOpacity,
        duration,
        delay,
        tint,
      });
    }
    return starList;
  }, []);

  return (
    <div className="space-starfield-container" aria-hidden="true">
      <div className="space-nebula-glow" />
      {stars.map((star) => {
        const tintClass =
          star.tint === 'cyan'
            ? 'tint-cyan'
            : star.tint === 'warm'
              ? 'tint-warm'
              : star.tint === 'blue'
                ? 'tint-blue'
                : '';

        return (
          <div
            key={star.id}
            className={`space-star ${tintClass}`}
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              ['--min-opacity' as string]: star.minOpacity,
              ['--max-opacity' as string]: star.maxOpacity,
              animationDuration: `${star.duration}s`,
              animationDelay: `${star.delay}s`,
            }}
          />
        );
      })}
      {/* Subtle sporadic shooting stars */}
      <div
        className="space-shooting-star"
        style={{ top: '18%', left: '75%', animationDelay: '2s' }}
      />
      <div
        className="space-shooting-star"
        style={{ top: '48%', left: '85%', animationDelay: '9s' }}
      />
    </div>
  );
};
