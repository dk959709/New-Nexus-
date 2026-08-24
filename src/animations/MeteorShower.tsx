import React, { useMemo } from 'react';

interface MeteorItem {
  id: number;
  startX: number;
  startY: number;
  length: number;
  thickness: number;
  duration: number;
  delay: number;
  angle: number;
  isHero: boolean;
}

interface MeteorShowerProps {
  reduced?: boolean;
}

export const MeteorShower: React.FC<MeteorShowerProps> = ({ reduced = false }) => {
  const meteors: MeteorItem[] = useMemo(() => {
    const list: MeteorItem[] = [];
    const count = 8; // 8 meteors active at all times on independent infinite loops

    for (let i = 0; i < count; i++) {
      const seed1 = Math.sin(i * 17.31 + 43.19) * 43758.5453;
      const r1 = seed1 - Math.floor(seed1);

      const seed2 = Math.sin(i * 31.79 + 11.23) * 24634.6345;
      const r2 = seed2 - Math.floor(seed2);

      const seed3 = Math.sin(i * 71.13 + 59.71) * 87342.1245;
      const r3 = seed3 - Math.floor(seed3);

      const isHero = i === 0 || i === 4 || r3 > 0.7;

      list.push({
        id: i,
        startX: 5 + r1 * 105, // spread across top/right
        startY: -20 - r2 * 25, // off-screen top
        length: isHero ? 320 + r3 * 120 : 160 + r2 * 110,
        thickness: isHero ? 3.8 : 2.1 + r1 * 1.3,
        duration: isHero ? 2.1 + r3 * 1.4 : 1.6 + r2 * 1.9, // 1.6s to 3.5s per streak
        delay: i * 0.45 + r1 * 2.0, // staggered independent delays
        angle: 128 + r3 * 20, // diagonal downward-left streak angle
        isHero,
      });
    }
    return list;
  }, []);

  if (reduced) return null;

  return (
    <div className="meteor-shower-container" aria-hidden="true">
      {meteors.map((meteor) => (
        <div
          key={meteor.id}
          className={`meteor-streak-wrapper ${meteor.isHero ? 'meteor-hero' : ''}`}
          style={{
            left: `${meteor.startX}%`,
            top: `${meteor.startY}%`,
            animationDuration: `${meteor.duration}s`,
            animationDelay: `${meteor.delay}s`,
            transform: `rotate(${meteor.angle}deg)`,
          }}
        >
          <div
            className="meteor-head"
            style={{
              width: `${meteor.thickness * 3.5}px`,
              height: `${meteor.thickness * 3.5}px`,
            }}
          />
        </div>
      ))}
    </div>
  );
};
