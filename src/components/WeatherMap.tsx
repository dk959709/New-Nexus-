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
  const baseRef = useRef<L.TileLayer | null>(null);
  const overlayRef = useRef<L.TileLayer | null>(null);
  const readyRef = useRef(false);

  const [layer, setLayer] = useState<LayerId>('temp_new');
  const [loading, setLoading] = useState(true);

  /*
   * IMPORTANT:
   * The map is created only after the container has a real size.
   * This prevents the hard-reload/white-map Leaflet race.
   */
  useEffect(() => {
    const container = containerRef.current;

    if (!container || mapRef.current) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let map: L.Map | null = null;

    const createMap = () => {
      if (cancelled || mapRef.current) return;

      const rect = container.getBoundingClientRect();

      if (rect.width < 10 || rect.height < 10) {
        retryTimer = setTimeout(createMap, 100);
        return;
      }

      map = L.map(container, {
        zoomControl: true,
        preferCanvas: true,
      });

      map.setView(
        [latitude ?? 20, longitude ?? 0],
        latitude !== undefined && longitude !== undefined ? 6 : 2,
      );

      /*
       * CARTO base map.
       * This avoids the OpenStreetMap tile-server blocking problem.
       */
      const base = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          attribution:
            '&copy; OpenStreetMap contributors &copy; CARTO',
          maxZoom: 20,
          subdomains: 'abcd',
        },
      );

      base.addTo(map);
      baseRef.current = base;

      mapRef.current = map;

      const refreshSize = () => {
        if (!mapRef.current) return;

        requestAnimationFrame(() => {
          mapRef.current?.invalidateSize({
            pan: false,
            animate: false,
          });
        });
      };

      const onMapReady = () => {
        if (cancelled || !mapRef.current) return;

        readyRef.current = true;

        refreshSize();

        setTimeout(refreshSize, 50);
        setTimeout(refreshSize, 200);
        setTimeout(refreshSize, 500);

        setLoading(false);
      };

      map.whenReady(onMapReady);

      window.addEventListener('resize', refreshSize);

      /*
       * ResizeObserver handles the special case where the route
       * becomes visible after React/BrowserRouter has already mounted.
       */
      const observer = new ResizeObserver(() => {
        refreshSize();
      });

      observer.observe(container);

      return () => {
        window.removeEventListener('resize', refreshSize);
        observer.disconnect();

        readyRef.current = false;

        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }

        baseRef.current = null;
        overlayRef.current = null;
      };
    };

    const cleanup = createMap();

    return () => {
      cancelled = true;

      if (retryTimer) {
        clearTimeout(retryTimer);
      }

      if (cleanup) {
        cleanup();
      } else if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      baseRef.current = null;
      overlayRef.current = null;
      readyRef.current = false;
    };
  }, [latitude, longitude]);

  /*
   * Weather overlay.
   *
   * The crucial part is that it does NOT attempt to create the
   * overlay until Leaflet has completed map initialization.
   */
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const addOverlay = () => {
      if (cancelled) return;

      const map = mapRef.current;

      if (!map || !readyRef.current) {
        timer = setTimeout(addOverlay, 100);
        return;
      }

      if (overlayRef.current) {
        map.removeLayer(overlayRef.current);
        overlayRef.current = null;
      }

      setLoading(true);

      const overlay = L.tileLayer(
        `/api/maptile/${layer}/{z}/{x}/{y}.png`,
        {
          opacity: 0.65,
          maxZoom: 18,
          crossOrigin: true,
        },
      );

      overlayRef.current = overlay;

      let finished = false;

      const finish = () => {
        if (finished || cancelled) return;
        finished = true;
        setLoading(false);
      };

      overlay.on('load', finish);
      overlay.on('tileerror', finish);

      overlay.addTo(map);

      timer = setTimeout(finish, 5000);

      requestAnimationFrame(() => {
        map.invalidateSize({
          pan: false,
          animate: false,
        });
      });
    };

    addOverlay();

    return () => {
      cancelled = true;

      if (timer) {
        clearTimeout(timer);
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
        aria-label="Interactive weather map"
      />

      {loading && (
        <div className="weather-map-loading">
          <div className="weather-map-spinner" />
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
