import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Thermometer, CloudRain, Cloud, Wind, Gauge } from 'lucide-react';

type LayerId =
  | 'temp_new'
  | 'precipitation_new'
  | 'clouds_new'
  | 'wind_new'
  | 'pressure_new';

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
      gradient:
        'linear-gradient(to right, #440154, #3b528b, #21918c, #5ec962, #fde725)',
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
      gradient:
        'linear-gradient(to right, #ffffff, #a8d8f0, #4a90d9, #1a4a7a, #0a1a3a)',
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
      gradient:
        'linear-gradient(to right, #071016, #3a4a52, #81949e, #d4e4e8, #ffffff)',
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
      gradient:
        'linear-gradient(to right, #1a2a3a, #21918c, #5ec962, #fde725, #f97316)',
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
      gradient:
        'linear-gradient(to right, #3b528b, #21918c, #5ec962, #fde725, #f97316)',
      min: '950 hPa',
      max: '1050 hPa',
    },
  },
];

export function WeatherMap({
  latitude,
  longitude,
}: {
  latitude?: number;
  longitude?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.TileLayer | null>(null);

  const [layer, setLayer] = useState<LayerId>('temp_new');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let resizeObserver: ResizeObserver | undefined;

    const initialize = () => {
      if (cancelled || mapRef.current) return;

      const rect = container.getBoundingClientRect();

      if (rect.width <= 0 || rect.height <= 0) {
        retryTimer = setTimeout(initialize, 100);
        return;
      }

      const map = L.map(container, {
        zoomControl: true,
        preferCanvas: false,
      }).setView(
        [latitude ?? 20, longitude ?? 0],
        latitude !== undefined ? 6 : 2,
      );

      L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 18,
        },
      ).addTo(map);

      mapRef.current = map;

      const refresh = () => {
        if (!cancelled && mapRef.current) {
          mapRef.current.invalidateSize({ pan: false });
        }
      };

      map.whenReady(() => {
        refresh();
        setLoading(false);

        requestAnimationFrame(() => {
          refresh();

          requestAnimationFrame(() => {
            refresh();
          });
        });

        setTimeout(refresh, 100);
        setTimeout(refresh, 300);
        setTimeout(refresh, 700);
      });

      window.addEventListener('resize', refresh);

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          refresh();
        });

        resizeObserver.observe(container);
      }
    };

    initialize();

    return () => {
      cancelled = true;

      if (retryTimer) {
        clearTimeout(retryTimer);
      }

      window.removeEventListener(
        'resize',
        () => undefined,
      );

      resizeObserver?.disconnect();

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      overlayRef.current = null;
    };
  }, [latitude, longitude]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) return;

    setLoading(true);

    if (overlayRef.current) {
      map.removeLayer(overlayRef.current);
      overlayRef.current = null;
    }

    const overlay = L.tileLayer(
      `/api/maptile/${layer}/{z}/{x}/{y}.png`,
      {
        opacity: 0.65,
        maxZoom: 18,
      },
    );

    overlay.addTo(map);
    overlayRef.current = overlay;

    overlay.on('load', () => {
      setLoading(false);
      map.invalidateSize({ pan: false });
    });

    overlay.on('tileerror', () => {
      setLoading(false);
    });

    const timer = setTimeout(() => {
      setLoading(false);
    }, 5000);

    return () => {
      clearTimeout(timer);

      if (overlayRef.current === overlay) {
        map.removeLayer(overlay);
        overlayRef.current = null;
      }
    };
  }, [layer]);

  const activeLayer = LAYERS.find((item) => item.id === layer)!;

  return (
    <div className="weather-map">
      <div className="weather-map-layers">
        {LAYERS.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              className={`weather-map-layer-btn${
                item.id === layer ? ' active' : ''
              }`}
              onClick={() => setLayer(item.id)}
            >
              <Icon />
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        ref={containerRef}
        className="weather-map-canvas"
      />

      {loading && (
        <div className="weather-map-loading">
          <div className="weather-map-spinner" />
        </div>
      )}

      <div className="weather-map-legend">
        <div className="weather-map-legend-title">
          {activeLayer.legend.title}
        </div>

        <div
          className="weather-map-legend-bar"
          style={{
            background: activeLayer.legend.gradient,
          }}
        />

        <div className="weather-map-legend-labels">
          <span>{activeLayer.legend.min}</span>
          <span>{activeLayer.legend.max}</span>
        </div>
      </div>
    </div>
  );
}
