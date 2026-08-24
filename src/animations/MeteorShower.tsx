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
    const count = 10; // 10 continuous meteors raining across the sky

    for (let i = 0; i < count; i++) {
      const seed1 = Math.sin(i * 17.31 + 43.19) * 43758.5453;
      const r1 = seed1 - Math.floor(seed1);

      const seed2 = Math.sin(i * 31.79 + 11.23) * 24634.6345;
      const r2 = seed2 - Math.floor(seed2);

      const seed3 = Math.sin(i * 71.13 + 59.71) * 87342.1245;
      const r3 = seed3 - Math.floor(seed3);

      const isHero = i === 0 || i === 5 || r3 > 0.72;
      const colorTypes: ('blue' | 'magenta' | 'cyan')[] = ['blue', 'magenta', 'cyan', 'blue'];
      const colorType = colorTypes[i % colorTypes.length];

      list.push({
        id: i,
        startX: 10 + r1 * 95, // spread across top/right
        startY: -25 - r2 * 30, // off-screen top
        length: isHero ? 360 + r3 * 140 : 180 + r2 * 120,
        thickness: isHero ? 4.2 : 2.2 + r1 * 1.5,
        duration: isHero ? 2.4 + r3 * 1.5 : 1.7 + r2 * 2.0, // 1.7s to 3.7s per streak
        delay: i * 0.35 + r1 * 2.5, // staggered independent infinite delays
        angle: 132 + r3 * 18, // diagonal downward-left streak angle matching reference
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
              width: `${meteor.thickness * 4.5}px`,
              height: `${meteor.thickness * 4.5}px`,
            }}
          />
        </div>
      ))}
    </div>
  );
};
