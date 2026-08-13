import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const LAYERS: Array<{ id: string; label: string }> = [
  { id: 'temp_new', label: 'Temperature' },
  { id: 'precipitation_new', label: 'Precipitation' },
  { id: 'clouds_new', label: 'Clouds' },
  { id: 'wind_new', label: 'Wind' },
  { id: 'pressure_new', label: 'Pressure' },
];

export function WeatherMap({ latitude, longitude }: { latitude?: number; longitude?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.TileLayer | null>(null);
  const [layer, setLayer] = useState('temp_new');

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true }).setView([latitude ?? 20, longitude ?? 0], latitude ? 6 : 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [latitude, longitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (overlayRef.current) map.removeLayer(overlayRef.current);
    const overlay = L.tileLayer(`/api/maptile/${layer}/{z}/{x}/{y}.png`, { opacity: 0.65, maxZoom: 18 });
    overlay.addTo(map);
    overlayRef.current = overlay;
  }, [layer]);

  return (
    <div className="weather-map">
      <div className="weather-map-layers">
        {LAYERS.map((item) => (
          <button
            key={item.id}
            className={item.id === layer ? 'active' : ''}
            onClick={() => setLayer(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div ref={containerRef} className="weather-map-canvas" />
    </div>
  );
}
