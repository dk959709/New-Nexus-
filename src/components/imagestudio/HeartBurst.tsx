import type { CSSProperties } from 'react';

type HeartBurstProps = {
  burstKey: number;
};

const PARTICLES = [
  { angle: -58, distance: 20, delay: 0 },
  { angle: -24, distance: 26, delay: 30 },
  { angle: 8, distance: 22, delay: 10 },
  { angle: 42, distance: 26, delay: 45 },
  { angle: 76, distance: 18, delay: 20 },
  { angle: 150, distance: 16, delay: 35 },
];

export function HeartBurst({ burstKey }: HeartBurstProps) {
  if (!burstKey) return null;

  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-20">
      {PARTICLES.map((particle, index) => (
        <span
          key={`${burstKey}-${index}`}
          className="is-heart-particle"
          style={
            {
              '--burst-angle': `${particle.angle}deg`,
              '--burst-distance': `${particle.distance}px`,
              animationDelay: `${particle.delay}ms`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
