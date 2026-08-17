import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Thermometer, CloudRain, Cloud, Wind, Gauge } from 'lucide-react';

type LayerId = 'temp_new' | 'precipitation_new' | 'clouds_new' | 'wind_new' | 'pressure_new';

interface LayerDef {
  id: LayerId;
  label: string;
  icon: typeof Thermometer;
  legend: {
    title: string;
    gradient: string;
    min: string;
    max: string;
  };
}

const LAYERS: LayerDef[] = [
  {
    id: 'temp_new',
    label: 'Temperature',
    icon: Thermometer,
    legend: {
      title: 'Temperature',
      gradient: 'linear-gradient(to right, #440154, #3b528b, #21918c, #5ec962, #fde725)',
      min: '-40°C',
      max: '+50°C',
    },
  },
  {
    id: 'precipitation_new',
    label: 'Precipitation',
    icon: CloudRain,
    legend: {
      title: 'Precipitation',
      gradient: 'linear-gradient(to right, #ffffff, #a8d8f0, #4a90d9, #1a4a7a, #0a1a3a)',
      min: '0 mm',
      max: '50+ mm',
    },
  },
  {
    id: 'clouds_new',
    label: 'Clouds',
    icon: Cloud,
    legend: {
      title: 'Cloud Cover',
      gradient: 'linear-gradient(to right, #071016, #3a4a52, #81949e, #d4e4e8, #ffffff)',
      min: '0%',
      max: '100%',
    },
  },
  {
    id: 'wind_new',
    label: 'Wind',
    icon: Wind,
    legend: {
      title: 'Wind Speed',
      gradient: 'linear-gradient(to right, #1a2a3a, #21918c, #5ec962, #fde725, #f97316)',
      min: '0 m/s',
      max: '40+ m/s',
    },
  },
  {
    id: 'pressure_new',
    label: 'Pressure',
    icon: Gauge,
    legend: {
      title: 'Pressure',
      gradient: 'linear-gradient(to right, #3b528b, #21918c, #5ec962, #fde725, #f97316)',
      min: '950 hPa',
      max: '1050 hPa',
    },
  },
];

export function WeatherMap({ latitude, longitude }: { latitude?: number; longitude?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.TileLayer | null>(null);
  const [layer, setLayer] = useState<LayerId>('temp_new');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true }).setView(
      [latitude ?? 20, longitude ?? 0],
      latitude ? 6 : 2,
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);
    mapRef.current = map;

    // Leaflet can initialize before the routed page has its final size.
    // Recalculate the map dimensions after the page is painted.
    const refreshMapSize = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize({ pan: false });
      }
    };

    map.whenReady(() => {
      refreshMapSize();
      setLoading(false);
      requestAnimationFrame(refreshMapSize);
      setTimeout(refreshMapSize, 100);
      setTimeout(refreshMapSize, 500);
    });

    window.addEventListener('resize', refreshMapSize);

    return () => {
      window.removeEventListener('resize', refreshMapSize);
      map.remove();
      mapRef.current = null;
    };
  }, [latitude, longitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setLoading(true);
    if (overlayRef.current) map.removeLayer(overlayRef.current);
    const overlay = L.tileLayer(`/api/maptile/${layer}/{z}/{x}/{y}.png`, {
      opacity: 0.65,
      maxZoom: 18,
    });
    overlay.addTo(map);
    overlayRef.current = overlay;
    overlay.on('load', () => setLoading(false));
    const timer = setTimeout(() => setLoading(false), 4000);
    return () => clearTimeout(timer);
  }, [layer]);

  const activeLayer = LAYERS.find((l) => l.id === layer)!;

  return (
    <div className="weather-map">
      <div className="weather-map-layers">
        {LAYERS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`weather-map-layer-btn${item.id === layer ? ' active' : ''}`}
              onClick={() => setLayer(item.id)}
            >
              <Icon />
              {item.label}
            </button>
          );
        })}
      </div>
      <div ref={containerRef} className="weather-map-canvas" />
      {loading && (
        <div className="weather-map-loading">
          <div className="weather-map-spinner" />
        </div>
      )}
      <div className="weather-map-legend" key={layer}>
        <div className="weather-map-legend-title">{activeLayer.legend.title}</div>
        <div
          className="weather-map-legend-bar"
          style={{ background: activeLayer.legend.gradient }}
        />
        <div className="weather-map-legend-labels">
          <span>{activeLayer.legend.min}</span>
          <span>{activeLayer.legend.max}</span>
        </div>
      </div>
    </div>
  );
}
