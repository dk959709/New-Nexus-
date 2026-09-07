import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Bookmark,
  Film,
  Globe,
  Maximize2,
  Moon as MoonIcon,
  Rocket,
  Sparkles,
} from 'lucide-react';
import { ErrorMessage, LoadingMessage } from '@/components';
import { SpaceStarfield } from '@/components/SpaceStarfield';
import { MeteorShower } from '@/animations/MeteorShower';
import { storage } from '@/lib/storage';
import { useSettings } from '@/hooks/useSettings';
import { playTapSound } from '@/lib/audio';

const BASE = '';

function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-intro"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>;
}

export function SpacePage() {
  const [settings] = useSettings();
  const [activeTab, setActiveTab] = useState<'apod' | 'iss' | 'moon' | 'planets'>('apod');
  const [apod, setApod] = useState<{ title: string; explanation: string; url: string; hdurl?: string; date: string; media_type: string; copyright?: string } | null>(null);
  const [moon, setMoon] = useState<{ phaseName: string; illumination: number; ageDays: number } | null>(null);
  const [iss, setIss] = useState<{ latitude: number; longitude: number; timestamp: number } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState(false);

  useEffect(() => {
    fetch(BASE + '/api/space/moon').then((res) => res.json()).then((json) => setMoon(json.data)).catch(() => {});
    fetch(BASE + '/api/space/iss').then((res) => res.json()).then((json) => setIss(json.data)).catch(() => {});
    fetch(BASE + '/api/nasa/apod').then(async (res) => {
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'NASA data is temporarily unavailable.');
      setApod(body.data);
    }).catch((err: Error) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  const planets = [
    { name: 'Mercury', type: 'Terrestrial', distance: '57.9M km', radius: '2,439 km', temp: '167°C', moons: 0, color: 'from-amber-600 to-slate-700', desc: 'The smallest and innermost planet in the Solar System.' },
    { name: 'Venus', type: 'Terrestrial', distance: '108.2M km', radius: '6,051 km', temp: '464°C', moons: 0, color: 'from-yellow-500 to-amber-700', desc: 'Hottest planet with a thick carbon dioxide atmosphere.' },
    { name: 'Earth', type: 'Terrestrial', distance: '149.6M km', radius: '6,371 km', temp: '15°C', moons: 1, color: 'from-blue-500 to-cyan-700', desc: 'Our home planet, the only world known to harbor life.' },
    { name: 'Mars', type: 'Terrestrial', distance: '227.9M km', radius: '3,389 km', temp: '-65°C', moons: 2, color: 'from-red-600 to-orange-800', desc: 'The dusty, cold, desert world with a very thin atmosphere.' },
    { name: 'Jupiter', type: 'Gas Giant', distance: '778.5M km', radius: '69,911 km', temp: '-110°C', moons: 95, color: 'from-orange-400 to-amber-900', desc: 'The largest planet, featuring the iconic Great Red Spot.' },
    { name: 'Saturn', type: 'Gas Giant', distance: '1.43B km', radius: '58,232 km', temp: '-140°C', moons: 146, color: 'from-yellow-200 to-amber-600', desc: 'Adorned with a dazzling, complex system of icy rings.' },
    { name: 'Uranus', type: 'Ice Giant', distance: '2.87B km', radius: '25,362 km', temp: '-195°C', moons: 28, color: 'from-cyan-400 to-blue-800', desc: 'An ice giant with a unique sideways tilt on its axis.' },
    { name: 'Neptune', type: 'Ice Giant', distance: '4.50B km', radius: '24,622 km', temp: '-200°C', moons: 16, color: 'from-blue-600 to-indigo-950', desc: 'Dark, cold, and whipped by supersonic winds.' },
  ];

  const handleSaveApod = () => {
    if (!apod) return;
    playTapSound();
    storage.saveItem({
      id: `apod_${apod.date}`,
      title: apod.title,
      subtitle: `NASA APOD · ${apod.date}`,
      url: apod.hdurl || apod.url,
      type: 'space',
      savedAt: new Date().toISOString(),
    });
    setSavedStatus(true);
    setTimeout(() => setSavedStatus(false), 2500);
  };

  return (
    <>
      <SpaceStarfield />
      <MeteorShower reduced={settings.animations === 'reduced'} />
      <div className="space-content-wrapper max-w-6xl mx-auto px-4 py-8 relative z-10">
        <PageIntro eyebrow="COSMIC OBSERVATORY" title="Deep Space & NASA Explorer" description="Real-time orbital tracking, astronomical imagery, and solar system telemetry." />
        
        {/* Navigation Tabs */}
        <div className="space-tabs-bar flex flex-wrap gap-2 mb-8 border-b border-white/10 pb-4">
          <button
            onClick={() => { playTapSound(); setActiveTab('apod'); }}
            className={`space-tab-button px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'apod' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10' : 'bg-white/[0.03] text-slate-400 hover:text-white border border-white/5'}`}
          >
            <Sparkles size={16} /> NASA APOD
          </button>
          <button
            onClick={() => { playTapSound(); setActiveTab('iss'); }}
            className={`space-tab-button px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'iss' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10' : 'bg-white/[0.03] text-slate-400 hover:text-white border border-white/5'}`}
          >
            <Rocket size={16} /> Live ISS Tracker
          </button>
          <button
            onClick={() => { playTapSound(); setActiveTab('moon'); }}
            className={`space-tab-button px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'moon' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10' : 'bg-white/[0.03] text-slate-400 hover:text-white border border-white/5'}`}
          >
            <MoonIcon size={16} /> Lunar Phase
          </button>
          <button
            onClick={() => { playTapSound(); setActiveTab('planets'); }}
            className={`space-tab-button px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'planets' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10' : 'bg-white/[0.03] text-slate-400 hover:text-white border border-white/5'}`}
          >
            <Globe size={16} /> Solar System
          </button>
        </div>

        {loading && <LoadingMessage label="Connecting to NASA telemetry & deep space feeds..." />}
        {error && <ErrorMessage message={error} />}

        {/* Tab 1: APOD */}
        {activeTab === 'apod' && apod && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="rounded-2xl bg-slate-900/80 border border-cyan-500/20 p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                  <span className="inline-block px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono uppercase tracking-wider mb-2">
                    Astronomy Picture of the Day · {apod.date}
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{apod.title}</h2>
                  {apod.copyright && <p className="text-xs text-slate-400 mt-1">Image Credit & Copyright: {apod.copyright}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveApod}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-all flex items-center gap-1.5"
                  >
                    <Bookmark size={14} className={savedStatus ? "text-cyan-400 fill-cyan-400" : ""} />
                    {savedStatus ? 'Saved to Library' : 'Save Image'}
                  </button>
                </div>
              </div>

              {apod.media_type === 'image' ? (
                <div className="relative group rounded-xl overflow-hidden border border-white/10 bg-black/40 my-6">
                  <img
                    src={apod.hdurl || apod.url}
                    alt={apod.title}
                    className="w-full max-h-[600px] object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                    <button
                      onClick={() => setZoomImage(apod.hdurl || apod.url)}
                      className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-semibold text-xs flex items-center gap-2 shadow-lg hover:bg-cyan-400 transition-colors"
                    >
                      <Maximize2 size={14} /> View High Definition
                    </button>
                  </div>
                </div>
              ) : (
                <div className="my-6 p-8 rounded-xl bg-black/40 border border-white/10 text-center">
                  <Film size={48} className="mx-auto text-cyan-400 mb-3" />
                  <p className="text-sm text-slate-300 mb-4">Today's featured NASA media is a video presentation.</p>
                  <a
                    href={apod.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 text-slate-950 font-semibold text-sm hover:bg-cyan-400 transition-all shadow-lg"
                  >
                    Watch NASA Video <ArrowUpRight size={16} />
                  </a>
                </div>
              )}

              <div className="prose prose-invert max-w-none">
                <h3 className="text-sm font-semibold text-cyan-300 uppercase tracking-wider mb-2">Scientific Context</h3>
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed">{apod.explanation}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: ISS Tracker */}
        {activeTab === 'iss' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-300">
            <div className="md:col-span-2 rounded-2xl bg-slate-900/80 border border-cyan-500/20 p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden flex flex-col justify-between">
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono uppercase tracking-wider mb-3">
                  Live Orbital Telemetry
                </span>
                <h3 className="text-2xl font-bold text-white mb-2">International Space Station</h3>
                <p className="text-slate-300 text-sm mb-6">Tracking humanity's orbital laboratory in real-time as it orbits Earth every 90 minutes at 27,600 km/h.</p>
              </div>

              <div className="p-6 rounded-xl bg-black/50 border border-white/10 relative overflow-hidden flex flex-col items-center justify-center min-h-[240px]">
                {/* Radar animation circle */}
                <div className="absolute w-48 h-48 rounded-full border border-cyan-500/20 animate-ping pointer-events-none" />
                <div className="absolute w-32 h-32 rounded-full border border-cyan-500/40 pointer-events-none" />
                <div className="w-16 h-16 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/30 mb-4 z-10 animate-pulse">
                  <Rocket className="text-cyan-300 transform rotate-45" size={28} />
                </div>
                {iss ? (
                  <div className="text-center z-10">
                    <p className="text-sm font-mono text-cyan-300">LAT: {iss.latitude.toFixed(4)}° · LON: {iss.longitude.toFixed(4)}°</p>
                    <p className="text-xs text-slate-400 mt-1">Altitude: ~420 km · Speed: 7.66 km/s</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Acquiring orbital coordinates...</p>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl bg-slate-900/80 border border-cyan-500/20 p-6 backdrop-blur-xl shadow-2xl">
                <h4 className="text-sm font-semibold text-cyan-300 uppercase tracking-wider mb-4">Orbital Statistics</h4>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between pb-3 border-b border-white/5">
                    <span className="text-slate-400">Orbital Period</span>
                    <span className="font-mono text-white">92.90 minutes</span>
                  </div>
                  <div className="flex justify-between pb-3 border-b border-white/5">
                    <span className="text-slate-400">Incline</span>
                    <span className="font-mono text-white">51.64°</span>
                  </div>
                  <div className="flex justify-between pb-3 border-b border-white/5">
                    <span className="text-slate-400">Crew Onboard</span>
                    <span className="font-mono text-white">7 Astronauts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Orbit Type</span>
                    <span className="font-mono text-white">Low Earth Orbit (LEO)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Moon Phase */}
        {activeTab === 'moon' && moon && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
            <div className="rounded-2xl bg-slate-900/80 border border-cyan-500/20 p-6 backdrop-blur-xl shadow-2xl flex flex-col items-center justify-center text-center">
              <div className="w-36 h-36 rounded-full bg-gradient-to-tr from-slate-800 via-slate-600 to-slate-200 border-4 border-cyan-500/30 shadow-2xl shadow-cyan-500/20 flex items-center justify-center mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" style={{ clipPath: `polygon(${100 - moon.illumination}% 0%, 100% 0%, 100% 100%, ${100 - moon.illumination}% 100%)` }} />
                <MoonIcon size={48} className="text-cyan-200 z-10" />
              </div>
              <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 mb-1">Current Lunar Phase</span>
              <h3 className="text-2xl font-bold text-white mb-2">{moon.phaseName}</h3>
              <p className="text-slate-300 text-sm max-w-sm">The moon is currently {moon.illumination}% illuminated and is {moon.ageDays} days into its lunar cycle.</p>
            </div>

            <div className="rounded-2xl bg-slate-900/80 border border-cyan-500/20 p-6 backdrop-blur-xl shadow-2xl flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-semibold text-cyan-300 uppercase tracking-wider mb-4">Lunar Metrics</h4>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between pb-3 border-b border-white/5">
                    <span className="text-slate-400">Illumination</span>
                    <span className="font-mono text-white">{moon.illumination}%</span>
                  </div>
                  <div className="flex justify-between pb-3 border-b border-white/5">
                    <span className="text-slate-400">Lunar Age</span>
                    <span className="font-mono text-white">{moon.ageDays} / 29.5 days</span>
                  </div>
                  <div className="flex justify-between pb-3 border-b border-white/5">
                    <span className="text-slate-400">Distance from Earth</span>
                    <span className="font-mono text-white">~384,400 km</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tidal Impact</span>
                    <span className="font-mono text-cyan-400">Moderate Spring Tides</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-200">
                ✨ Tip: Clear night skies provide optimal stargazing conditions during this lunar phase.
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Solar System */}
        {activeTab === 'planets' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
            {planets.map((planet) => (
              <div key={planet.name} className="rounded-2xl bg-slate-900/80 border border-white/10 p-5 backdrop-blur-xl shadow-xl hover:border-cyan-500/40 transition-all flex flex-col justify-between group">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">{planet.type}</span>
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${planet.color} shadow-md group-hover:scale-110 transition-transform`} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">{planet.name}</h3>
                  <p className="text-xs text-slate-300 mb-4 leading-relaxed">{planet.desc}</p>
                </div>
                <div className="space-y-2 text-xs font-mono pt-3 border-t border-white/5 text-slate-400">
                  <div className="flex justify-between">
                    <span>Distance</span>
                    <span className="text-white">{planet.distance}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Radius</span>
                    <span className="text-white">{planet.radius}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Temp</span>
                    <span className="text-white">{planet.temp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Moons</span>
                    <span className="text-cyan-300">{planet.moons}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* High-Definition Image Modal */}
      {zoomImage && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setZoomImage(null)}
              className="absolute -top-12 right-0 px-4 py-2 rounded-xl bg-white/10 text-white font-semibold text-xs hover:bg-white/20 transition-colors"
            >
              ✕ Close HD View
            </button>
            <img src={zoomImage} alt="High Definition Space View" className="max-h-[82vh] rounded-2xl object-contain border border-white/20 shadow-2xl" />
          </div>
        </div>
      )}
    </>
  );
}
