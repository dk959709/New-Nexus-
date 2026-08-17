import { Home, Map, Newspaper, Search, Settings, Bookmark, CloudSun, Radio, Rocket } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AmbientBackdrop } from '@/components/WeatherIcon';
import { useSettings } from '@/hooks/useSettings';

const nav = [{ to: '/', label: 'Home', icon: Home }, { to: '/search', label: 'Search', icon: Search }, { to: '/weather', label: 'Weather', icon: CloudSun }, { to: '/weather/map', label: 'Weather Map', icon: Map }, { to: '/news', label: 'News', icon: Newspaper }, { to: '/space', label: 'Space', icon: Rocket }, { to: '/saved', label: 'Saved', icon: Bookmark }];

export function Layout() {
  useSettings();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => { const on = () => setOnline(true); const off = () => setOnline(false); window.addEventListener('online', on); window.addEventListener('offline', off); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); }; }, []);
  return <div className="app-shell"><AmbientBackdrop condition="clear" /><aside className="sidebar"><div className="brand"><span className="brand-mark"><Radio size={18} /></span><span>NEXUS</span></div><span className="sidebar-label">INTELLIGENCE OS</span><nav>{nav.map(({ to, label, icon: Icon }) => <NavLink to={to} key={to} end={to === '/'}><Icon size={19} /><span>{label}</span></NavLink>)}</nav><NavLink className="settings-link" to="/settings"><Settings size={19} /><span>Settings</span></NavLink><div className="system-status"><span className={online ? 'status-dot' : 'status-dot offline'} />{online ? 'Systems online' : 'You’re offline'}</div></aside><main className="main-content"><header className="mobile-header"><div className="brand"><span className="brand-mark"><Radio size={16} /></span><span>NEXUS</span></div><span className={online ? 'status-dot' : 'status-dot offline'} /></header><div className="page-content"><Outlet /></div></main><nav className="bottom-nav">{nav.slice(0, 5).map(({ to, label, icon: Icon }) => <NavLink to={to} key={to} end={to === '/'}><Icon size={20} /><span>{label}</span></NavLink>)}</nav></div>;
}
