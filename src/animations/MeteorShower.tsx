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
  colorType: 'blue' | 'magenta' | 'cyan';
}

interface MeteorShowerProps {
  reduced?: boolean;
}

export const MeteorShower: React.FC<MeteorShowerProps> = ({ reduced = false }) => {
  const meteors: MeteorItem[] = useMemo(() => {
    const list: MeteorItem[] = [];
    const count = 14; // 14 small continuous meteors/asteroids raining across the sky

    for (let i = 0; i < count; i++) {
      const seed1 = Math.sin(i * 17.31 + 43.19) * 43758.5453;
      const r1 = seed1 - Math.floor(seed1);

      const seed2 = Math.sin(i * 31.79 + 11.23) * 24634.6345;
      const r2 = seed2 - Math.floor(seed2);

      const seed3 = Math.sin(i * 71.13 + 59.71) * 87342.1245;
      const r3 = seed3 - Math.floor(seed3);

      const isHero = i === 0 || i === 7 || r3 > 0.8;
      const colorTypes: ('blue' | 'magenta' | 'cyan')[] = ['blue', 'magenta', 'cyan', 'blue'];
      const colorType = colorTypes[i % colorTypes.length];

      list.push({
        id: i,
        startX: 5 + r1 * 100, // spread across top/right
        startY: -20 - r2 * 25, // off-screen top
        length: isHero ? 240 + r3 * 100 : 120 + r2 * 80,
        thickness: isHero ? 2.2 : 0.8 + r1 * 0.9, // small size asteroid / meteor particles
        duration: isHero ? 7.0 + r3 * 4.0 : 5.0 + r2 * 5.0, // 5s to 10s slow-moving asteroid drift
        delay: i * 0.25 + r1 * 2.0, // staggered independent infinite delays
        angle: 132 + r3 * 18, // diagonal downward-left streak angle
        isHero,
        colorType,
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
          className={`meteor-streak-wrapper meteor-${meteor.colorType} ${meteor.isHero ? 'meteor-hero' : ''}`}
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
              width: `${meteor.thickness * 2.5}px`,
              height: `${meteor.thickness * 2.5}px`,
            }}
          />
        </div>
      ))}
    </div>
  );
};
