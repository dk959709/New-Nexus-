import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { WeatherMap } from '@/components';
import { api } from '@/services/api';
import { getLocation } from '@/services/location';

function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-intro"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>;
}

export function MapPage() {
  const [status, setStatus] = useState<boolean | null>(null);
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | undefined>(undefined);

  useEffect(() => {
    api.configStatus().then((data) => setStatus(data.map)).catch(() => setStatus(false));
  }, []);

  useEffect(() => {
    getLocation().then((pos) => setPosition({ latitude: pos.latitude, longitude: pos.longitude })).catch(() => undefined);
  }, []);

  return (
    <>
      <PageIntro eyebrow="WEATHER MAP" title="See the bigger picture." description="Explore live weather layers around the world." />
      {status ? (
        <WeatherMap latitude={position?.latitude} longitude={position?.longitude} />
      ) : (
        <div className="map-panel">
          <MapPin size={36} />
          <h2>Map provider not configured</h2>
          <p>Add MAP_API_KEY to the server environment to enable a live weather map. NEXUS does not invent map tiles or weather layers.</p>
        </div>
      )}
    </>
  );
}
