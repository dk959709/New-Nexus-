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
  const initializedRef = useRef(false);

  const [layer, setLayer] = useState<LayerId>('temp_new');
  const [loading, setLoading] = useState(true);

  /*
   * IMPORTANT:
   * Map creation and overlay creation happen in the SAME initialization
   * flow. This prevents the hard-reload race where the layer effect fires
   * before mapRef.current exists.
   */
  useEffect(() => {
    const container = containerRef.current;

    if (!container || initializedRef.current) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const initialize = () => {
      if (cancelled || initializedRef.current) return;

      const rect = container.getBoundingClientRect();

      if (rect.width <= 0 || rect.height <= 0) {
        retryTimer = setTimeout(initialize, 100);
        return;
      }

      initializedRef.current = true;

      const map = L.map(container, {
        zoomControl: true,
        preferCanvas: true,
      }).setView(
        [latitude ?? 20, longitude ?? 0],
        latitude !== undefined && longitude !== undefined ? 6 : 2,
      );

      mapRef.current = map;

      /*
       * CARTO dark base map instead of OSM.
       * This avoids the OSM tile-policy issue encountered in production.
       */
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          attribution:
            '&copy; OpenStreetMap contributors &copy; CARTO',
          subdomains: 'abcd',
          maxZoom: 20,
        },
      ).addTo(map);

      const refreshSize = () => {
        if (mapRef.current) {
          mapRef.current.invalidateSize({ pan: false });
        }
      };

      const addWeatherOverlay = () => {
        if (cancelled || !mapRef.current) return;

        if (overlayRef.current) {
          overlayRef.current.remove();
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

        overlay.on('load', () => {
          if (!cancelled) setLoading(false);
          refreshSize();
        });

        overlay.on('tileerror', () => {
          if (!cancelled) setLoading(false);
        });

        overlay.addTo(map);

        /*
         * Don't leave the loading screen forever if the provider
         * doesn't return a tile event.
         */
        setTimeout(() => {
          if (!cancelled) setLoading(false);
        }, 5000);
      };

      map.whenReady(() => {
        if (cancelled) return;

        refreshSize();
        requestAnimationFrame(refreshSize);
        setTimeout(refreshSize, 100);
        setTimeout(refreshSize, 500);

        /*
         * This is the key fix:
         * the first weather overlay is created only AFTER Leaflet
         * has successfully created the map.
         */
        addWeatherOverlay();
      });

      window.addEventListener('resize', refreshSize);

      return () => {
        window.removeEventListener('resize', refreshSize);

        if (overlayRef.current) {
          overlayRef.current.remove();
          overlayRef.current = null;
        }

        map.remove();
        mapRef.current = null;
        initializedRef.current = false;
      };
    };

    const cleanup = initialize();

    return () => {
      cancelled = true;

      if (retryTimer) {
        clearTimeout(retryTimer);
      }

      if (typeof cleanup === 'function') {
        cleanup();
      } else {
        if (overlayRef.current) {
          overlayRef.current.remove();
          overlayRef.current = null;
        }

        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }

        initializedRef.current = false;
      }
    };
  }, [latitude, longitude]);

  /*
   * Layer changes happen AFTER the map already exists.
   * This effect is therefore safe for Temperature/Clouds/Wind/etc.
   */
  useEffect(() => {
    const map = mapRef.current;

    if (!map) return;

    if (overlayRef.current) {
      overlayRef.current.remove();
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

    overlay.on('load', () => {
      setLoading(false);

      if (mapRef.current) {
        mapRef.current.invalidateSize({ pan: false });
      }
    });

    overlay.on('tileerror', () => {
      setLoading(false);
    });

    overlay.addTo(map);

    const timer = setTimeout(() => setLoading(false), 5000);

    return () => {
      clearTimeout(timer);

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

      <div ref={containerRef} className="weather-map-canvas" />

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
