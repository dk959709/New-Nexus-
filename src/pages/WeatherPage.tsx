import { useCallback, useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { WeatherCard, HourlyForecast, DailyForecast, ErrorMessage, LoadingMessage } from '@/components';
import { api } from '@/services/api';
import { getLocation } from '@/services/location';
import { useSettings } from '@/hooks/useSettings';
import type { WeatherData } from '@/types';

function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-intro"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>;
}

function WeatherAlerts({ alerts }: { alerts: WeatherData['alerts'] }) {
  return (
    <aside className="alerts-card">
      <span className="eyebrow">WEATHER ALERTS</span>
      {alerts.length ? (
        alerts.map((alert) => (
          <div className={`alert ${alert.severity}`} key={alert.title}>
            <b>{alert.title}</b>
            <p>{alert.description}</p>
          </div>
        ))
      ) : (
        <div className="no-alerts">
          <span>✓</span>
          <p>No active alerts returned for this location.</p>
        </div>
      )}
    </aside>
  );
}

export function WeatherPage() {
  const [settings] = useSettings();
  const [city, setCity] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback((query: string) => {
    setLoading(true);
    setError('');
    api.weather(query)
      .then(setWeather)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    getLocation()
      .then((position) => load(`latitude=${position.latitude}&longitude=${position.longitude}`))
      .catch(() => {
        // Fallback default city if location is not granted
        load('city=New York');
      });
  }, [load]);

  const searchCity = () => {
    if (city.trim()) load(`city=${encodeURIComponent(city.trim())}`);
  };

  const useMyLocation = () => {
    setLoading(true);
    setError('');
    getLocation()
      .then((position) => load(`latitude=${position.latitude}&longitude=${position.longitude}`))
      .catch((err: Error) => {
        setLoading(false);
        setError(err.message);
      });
  };

  return (
    <>
      <PageIntro
        eyebrow="WEATHER INTELLIGENCE"
        title="Read the atmosphere."
        description="Live conditions, hourly detail, and a 7-day forecast from real weather data."
      />
      <div className="location-search">
        <MapPin size={17} />
        <input
          value={city}
          onChange={(event) => setCity(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') searchCity();
          }}
          placeholder="Search a city"
          aria-label="Search a city"
        />
        <button onClick={searchCity}>Update</button>
        <button className="secondary-button" onClick={useMyLocation}>
          Use my location
        </button>
      </div>

      {loading && <LoadingMessage label="Reading live atmosphere data..." />}
      
      {error && (
        <ErrorMessage
          message={
            error.includes('permission')
              ? error
              : error.includes('configured')
              ? 'Weather is unavailable. The server weather provider is not configured.'
              : error
          }
        />
      )}

      {weather && (
        <div className="weather-dashboard">
          <div className="weather-main">
            <WeatherCard
              data={weather.current}
              temperatureUnit={settings.temperature}
              windUnit={settings.wind}
              reduced={settings.animations === 'reduced'}
            />
            <HourlyForecast entries={weather.hourly} unit={settings.temperature} />
            <DailyForecast
              data={weather.daily}
              temperatureUnit={settings.temperature}
              windUnit={settings.wind}
            />
          </div>
          <WeatherAlerts alerts={weather.alerts} />
        </div>
      )}
    </>
  );
}
