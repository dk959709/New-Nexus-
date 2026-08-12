import { motion } from 'framer-motion';
import type { Condition } from '@/types';

interface AmbientProps {
  condition: Condition;
  isDay: boolean;
  reduced: boolean;
}

export function WeatherBackground({ condition, isDay, reduced }: AmbientProps) {
  if (reduced) return null;

  const gradient = getGradient(condition, isDay);

  return (
    <div className="weather-bg" style={{ background: gradient }} aria-hidden>
      {(condition === 'clear' || condition === 'partly-cloudy') && <Stars />}
      {(condition === 'cloudy' || condition === 'partly-cloudy' || condition === 'rain') && <Clouds />}
      {condition === 'rain' && <Rain />}
      {condition === 'storm' && <Rain />}
      {condition === 'snow' && <Snow />}
      {condition === 'fog' && <Fog />}
    </div>
  );
}

function getGradient(condition: Condition, isDay: boolean): string {
  if (!isDay) {
    return 'linear-gradient(180deg, #0a0e1a 0%, #0d1424 50%, #0a0e1a 100%)';
  }
  switch (condition) {
    case 'clear':
      return 'linear-gradient(180deg, #0c1e2e 0%, #103048 50%, #0c1e2e 100%)';
    case 'partly-cloudy':
      return 'linear-gradient(180deg, #0e2230 0%, #163548 50%, #0e2230 100%)';
    case 'cloudy':
      return 'linear-gradient(180deg, #0c1a24 0%, #142838 50%, #0c1a24 100%)';
    case 'rain':
      return 'linear-gradient(180deg, #0a1620 0%, #102530 50%, #0a1620 100%)';
    case 'storm':
      return 'linear-gradient(180deg, #080d14 0%, #0e1820 50%, #080d14 100%)';
    case 'snow':
      return 'linear-gradient(180deg, #0c1820 0%, #163040 50%, #0c1820 100%)';
    case 'fog':
      return 'linear-gradient(180deg, #0c1418 0%, #182830 50%, #0c1418 100%)';
    default:
      return 'linear-gradient(180deg, #071016 0%, #0d1820 100%)';
  }
}

function Stars() {
  const stars = Array.from({ length: 30 }, (_, i) => i);
  return (
    <div className="stars-layer">
      {stars.map((i) => (
        <motion.div
          key={i}
          className="star"
          style={{
            left: `${(i * 37) % 100}%`,
            top: `${(i * 53) % 60}%`,
          }}
          animate={{ opacity: [0.2, 0.8, 0.2] }}
          transition={{
            duration: 2 + (i % 3),
            repeat: Infinity,
            delay: i * 0.1,
          }}
        />
      ))}
    </div>
  );
}

function Clouds() {
  return (
    <div className="clouds-layer">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="cloud"
          style={{ top: `${10 + i * 20}%` }}
          animate={{ x: ['-20%', '120%'] }}
          transition={{
            duration: 40 + i * 15,
            repeat: Infinity,
            ease: 'linear',
            delay: i * 5,
          }}
        />
      ))}
    </div>
  );
}

function Rain() {
  const drops = Array.from({ length: 40 }, (_, i) => i);
  return (
    <div className="rain-layer">
      {drops.map((i) => (
        <motion.div
          key={i}
          className="raindrop"
          style={{ left: `${(i * 2.5) % 100}%` }}
          animate={{ y: [-20, window.innerHeight + 20] }}
          transition={{
            duration: 0.5 + (i % 3) * 0.2,
            repeat: Infinity,
            ease: 'linear',
            delay: (i % 10) * 0.1,
          }}
        />
      ))}
    </div>
  );
}

function Snow() {
  const flakes = Array.from({ length: 25 }, (_, i) => i);
  return (
    <div className="snow-layer">
      {flakes.map((i) => (
        <motion.div
          key={i}
          className="snowflake"
          style={{ left: `${(i * 4) % 100}%` }}
          animate={{ y: [-20, window.innerHeight + 20], rotate: 360 }}
          transition={{
            duration: 4 + (i % 3),
            repeat: Infinity,
            ease: 'linear',
            delay: (i % 8) * 0.5,
          }}
        />
      ))}
    </div>
  );
}

function Fog() {
  return (
    <div className="fog-layer">
      {[0, 1].map((i) => (
        <motion.div
          key={i}
          className="fog-band"
          style={{ top: `${20 + i * 30}%` }}
          animate={{ opacity: [0.1, 0.3, 0.1], x: ['-10%', '10%', '-10%'] }}
          transition={{
            duration: 8 + i * 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}
