import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  CloudRain,
  CloudSun,
  Gauge,
  Thermometer,
  Wind,
} from 'lucide-react';

type LayerId =
  | 'temp_new'
  | 'precipitation_new'
  | 'clouds_new'
  | 'wind_new'
  | 'pressure_new';

interface WeatherMapProps {
  latitude?: number;
  longitude?: number;
}

const LAYERS: Array<{
  id: LayerId;
  label: string;
  icon: typeof Thermometer;
  legend: {
    title: string;
    min: string;
    max: string;
    gradient: string;
  };
}> = [
  {
    id: 'temp_new',
    label: 'Temperature',
    icon: Thermometer,
    legend: {
      title: 'Temperature',
      min: 'Cold',
      max: 'Hot',
      gradient:
        'linear-gradient(90deg, #313695, #4575b4, #74add1, #abd9e9, #ffffbf, #fdae61, #f46d43, #d73027, #a50026)',
    },
  },
  {
    id: 'precipitation_new',
    label: 'Rain',
    icon: CloudRain,
    legend: {
      title: 'Precipitation',
      min: 'Light',
      max: 'Heavy',
      gradient:
        'linear-gradient(90deg, #f7fbff, #c6dbef, #6baed6, #2171b5, #08306b)',
    },
  },
  {
    id: 'clouds_new',
    label: 'Clouds',
    icon: CloudSun,
    legend: {
      title: 'Cloud Cover',
      min: 'Clear',
      max: 'Overcast',
      gradient:
        'linear-gradient(90deg, #f7fbff, #c6dbef, #9ecae1, #6baed6, #3182bd, #08519c)',
    },
  },
  {
    id: 'wind_new',
    label: 'Wind',
    icon: Wind,
    legend: {
      title: 'Wind Speed',
      min: 'Calm',
      max: 'Strong',
      gradient:
        'linear-gradient(90deg, #f7fcf5, #c7e9c0, #74c476, #31a354, #006d2c)',
    },
  },
  {
    id: 'pressure_new',
    label: 'Pressure',
    icon: Gauge,
    legend: {
      title: 'Pressure',
      min: 'Low',
      max: 'High',
      gradient:
        'linear-gradient(90deg, #f7fbff, #c6dbef, #6baed6, #2171b5, #08306b)',
    },
  },
];

export function WeatherMap({ latitude, longitude }: WeatherMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const overlayRef = useRef<L.TileLayer | null>(null);

  const [layer, setLayer] = useState<LayerId>('temp_new');
  const [loading, setLoading] = useState(true);

  /*
   * ONE lifecycle:
   * 1. Wait until the container has real dimensions.
   * 2. Create Leaflet exactly once.
   * 3. Add the base map.
   * 4. Add the weather overlay.
   * 5. Clean everything up on unmount.
   *
   * This avoids the reload race where the overlay effect runs
   * before the Leaflet map exists.
   */
  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let resizeHandler: (() => void) | null = null;

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
        latitude != null && longitude != null ? 6 : 2,
      );

      mapRef.current = map;

      const baseLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          attribution:
            '&copy; OpenStreetMap contributors &copy; CARTO',
          maxZoom: 20,
          subdomains: 'abcd',
        },
      );

      baseLayer.addTo(map);
      baseLayerRef.current = baseLayer;

      const refreshSize = () => {
        if (!cancelled && mapRef.current) {
          mapRef.current.invalidateSize({ pan: false });
        }
      };

      resizeHandler = refreshSize;
      window.addEventListener('resize', refreshSize);

      map.whenReady(() => {
        if (cancelled) return;

        refreshSize();

        requestAnimationFrame(() => {
          if (!cancelled) refreshSize();
        });

        setTimeout(() => {
          if (!cancelled) refreshSize();
        }, 150);

        setTimeout(() => {
          if (!cancelled) refreshSize();
        }, 500);

        setLoading(false);
      });
    };

    initialize();

    return () => {
      cancelled = true;

      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }

      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
      }

      if (overlayRef.current) {
        overlayRef.current.remove();
        overlayRef.current = null;
      }

      if (baseLayerRef.current) {
        baseLayerRef.current.remove();
        baseLayerRef.current = null;
      }

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [latitude, longitude]);

  /*
   * Overlay lifecycle.
   * This effect does NOT create the Leaflet map.
   * It only changes the weather layer after the map exists.
   */
  useEffect(() => {
    const map = mapRef.current;

    if (!map) return;

    let cancelled = false;

    setLoading(true);

    if (overlayRef.current) {
      overlayRef.current.remove();
      overlayRef.current = null;
    }

    const overlay = L.tileLayer(
      `/api/maptile/${layer}/{z}/{x}/{y}.png`,
      {
        opacity: 0.65,
        maxZoom: 18,
        crossOrigin: true,
      },
    );

    overlayRef.current = overlay;

    const finishLoading = () => {
      if (!cancelled) {
        setLoading(false);
      }
    };

    overlay.on('load', finishLoading);
    overlay.on('tileerror', finishLoading);

    overlay.addTo(map);

    const timeout = setTimeout(finishLoading, 5000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);

      overlay.off('load', finishLoading);
      overlay.off('tileerror', finishLoading);

      if (overlayRef.current === overlay) {
        overlay.remove();
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
              type="button"
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
