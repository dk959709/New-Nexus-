import type { Condition } from '@/types';

interface WeatherBackgroundProps {
  condition: Condition;
  isDay: boolean;
  reduced: boolean;
}

export function WeatherBackground({ condition, isDay, reduced }: WeatherBackgroundProps) {
  if (reduced) return null;

  return (
    <div className={`weather-bg weather-bg-${condition} ${isDay ? 'is-day' : 'is-night'}`} aria-hidden="true">
      {/* Base ambient gradient layer */}
      <div className="weather-bg-gradient" />

      {/* Condition-specific particle and ambient effects */}
      {condition === 'clear' && (
        <>
          {isDay ? (
            <div className="weather-sun-layer">
              <div className="sun-radiance-aura" />
              <div className="sun-light-beam beam-1" />
              <div className="sun-light-beam beam-2" />
            </div>
          ) : (
            <div className="weather-stars-layer">
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className="weather-micro-star"
                  style={{
                    left: `${(i * 41 + 17) % 96}%`,
                    top: `${(i * 37 + 11) % 85}%`,
                    animationDelay: `${(i % 5) * 0.7}s`,
                    animationDuration: `${2.2 + (i % 3) * 0.8}s`,
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {condition === 'partly-cloudy' && (
        <>
          {isDay && <div className="sun-radiance-aura subtle" />}
          <div className="weather-clouds-layer">
            <div className="weather-cloud-puff puff-1" />
            <div className="weather-cloud-puff puff-2" />
            <div className="weather-cloud-puff puff-3" />
          </div>
        </>
      )}

      {condition === 'cloudy' && (
        <div className="weather-clouds-layer dense">
          <div className="weather-cloud-puff puff-dense-1" />
          <div className="weather-cloud-puff puff-dense-2" />
          <div className="weather-cloud-puff puff-dense-3" />
        </div>
      )}

      {condition === 'rain' && (
        <div className="weather-rain-layer">
          {Array.from({ length: 22 }).map((_, i) => (
            <div
              key={i}
              className="weather-raindrop"
              style={{
                left: `${(i * 4.6 + 2) % 98}%`,
                animationDelay: `${(i % 8) * 0.18}s`,
                animationDuration: `${0.65 + (i % 4) * 0.12}s`,
                opacity: 0.25 + (i % 5) * 0.1,
              }}
            />
          ))}
          <div className="weather-rain-mist" />
        </div>
      )}

      {condition === 'storm' && (
        <div className="weather-storm-layer">
          <div className="weather-lightning-flash" />
          {Array.from({ length: 26 }).map((_, i) => (
            <div
              key={i}
              className="weather-raindrop heavy"
              style={{
                left: `${(i * 3.9 + 1) % 98}%`,
                animationDelay: `${(i % 7) * 0.14}s`,
                animationDuration: `${0.55 + (i % 3) * 0.1}s`,
                opacity: 0.35 + (i % 4) * 0.12,
              }}
            />
          ))}
        </div>
      )}

      {condition === 'snow' && (
        <div className="weather-snow-layer">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="weather-snowflake-dot"
              style={{
                left: `${(i * 5.1 + 3) % 96}%`,
                animationDelay: `${(i % 6) * 0.6}s`,
                animationDuration: `${3.5 + (i % 4) * 0.8}s`,
                width: `${3 + (i % 3) * 2}px`,
                height: `${3 + (i % 3) * 2}px`,
              }}
            />
          ))}
        </div>
      )}

      {condition === 'fog' && (
        <div className="weather-fog-layer">
          <div className="weather-fog-band band-1" />
          <div className="weather-fog-band band-2" />
          <div className="weather-fog-band band-3" />
        </div>
      )}
    </div>
  );
}
