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

// WEATHER_MAP_DIAGNOSTIC
window.addEventListener('error', (event) => {
  console.error('[WEATHER_MAP_DIAGNOSTIC]', event.error || event.message);
});

export function WeatherMap({
  latitude,
  longitude,
}: {
  latitude?: number;
  longitude?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.TileLayer | null>(null);
  const initTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [layer, setLayer] = useState<LayerId>('temp_new');
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;
    if (mapRef.current) return;

    let cancelled = false;

    const clearInitTimer = () => {
      if (initTimerRef.current) {
        clearTimeout(initTimerRef.current);
        initTimerRef.current = null;
      }
    };

    const refreshSize = () => {
      const map = mapRef.current;
      if (!map) return;

      requestAnimationFrame(() => {
        try {
          map.invalidateSize({ pan: false });
        } catch {
          // Ignore Leaflet size refresh errors during route transitions.
        }
      });
    };

    const initialize = () => {
      if (cancelled || mapRef.current) return;

      const rect = container.getBoundingClientRect();

      if (rect.width <= 0 || rect.height <= 0) {
        initTimerRef.current = setTimeout(initialize, 100);
        return;
      }

      try {
        setMapError('');
        setLoading(true);

        const map = L.map(container, {
          zoomControl: true,
          preferCanvas: true,
        });

        map.setView(
          [latitude ?? 20, longitude ?? 0],
          latitude !== undefined && longitude !== undefined ? 6 : 2,
        );

        L.tileLayer(
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 18,
            crossOrigin: true,
          },
        ).addTo(map);

        mapRef.current = map;

        const handleResize = () => refreshSize();

        window.addEventListener('resize', handleResize);

        map.whenReady(() => {
          if (cancelled) return;

          setLoading(false);

          refreshSize();
          requestAnimationFrame(refreshSize);

          setTimeout(refreshSize, 100);
          setTimeout(refreshSize, 300);
          setTimeout(refreshSize, 700);
        });

        // Leaflet's load event is not guaranteed to fire in every
        // hard-reload/layout timing scenario, so also refresh after mount.
        requestAnimationFrame(refreshSize);
      } catch (error) {
        console.error('WeatherMap initialization failed:', error);

        setLoading(false);
        setMapError(
          error instanceof Error
            ? error.message
            : 'Weather map failed to initialize.',
        );
      }
    };

    initialize();

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (!mapRef.current) {
              clearInitTimer();
              initialize();
            } else {
              refreshSize();
            }
          })
        : null;

    observer?.observe(container);

    return () => {
      cancelled = true;
      clearInitTimer();
      observer?.disconnect();

      const map = mapRef.current;

      if (map) {
        try {
          map.remove();
        } catch {
          // Ignore cleanup errors during navigation/reload.
        }
      }

      mapRef.current = null;
      overlayRef.current = null;
    };
  }, [latitude, longitude]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) return;

    let cancelled = false;

    setLoading(true);
    setMapError('');

    if (overlayRef.current) {
      try {
        map.removeLayer(overlayRef.current);
      } catch {
        // Ignore stale Leaflet layer during navigation.
      }
      overlayRef.current = null;
    }

    const overlay = L.tileLayer(
      `/api/maptile/${layer}/{z}/{x}/{y}.png`,
      {
        opacity: 0.65,
        maxZoom: 18,
      },
    );

    overlayRef.current = overlay;

    overlay.on('load', () => {
      if (!cancelled) {
        setLoading(false);
      }
    });

    overlay.on('tileerror', () => {
      if (!cancelled) {
        setLoading(false);
        setMapError(
          'Weather layer is temporarily unavailable. The base map is still available.',
        );
      }
    });

    try {
      overlay.addTo(map);
      map.invalidateSize({ pan: false });
    } catch (error) {
      console.error('Weather overlay failed:', error);

      if (!cancelled) {
        setLoading(false);
        setMapError('Weather layer failed to load.');
      }
    }

    const timer = setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearTimeout(timer);

      try {
        if (map.hasLayer(overlay)) {
          map.removeLayer(overlay);
        }
      } catch {
        // Ignore cleanup errors.
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
              type="button"
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
        style={{
          minHeight: '420px',
          width: '100%',
        }}
      />

      {loading && (
        <div className="weather-map-loading">
          <div className="weather-map-spinner" />
        </div>
      )}

      {mapError && (
        <div
          className="weather-map-error"
          role="status"
          style={{
            position: 'absolute',
            left: '16px',
            right: '16px',
            bottom: '16px',
            zIndex: 1000,
            padding: '10px 12px',
            borderRadius: '10px',
            background: 'rgba(7, 16, 22, 0.92)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {mapError}
        </div>
      )}

      <div className="weather-map-legend" key={layer}>
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
