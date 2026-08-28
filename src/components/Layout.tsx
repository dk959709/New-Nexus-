import {
  Bookmark,
  Bot,
  CloudSun,
  Home,
  Map,
  Menu,
  Newspaper,
  Radio,
  Rocket,
  Search,
  Send,
  Settings,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { playTapSound } from '@/lib/audio';

const navItems = [
  { to: '/', label: 'Overview', icon: Home },
  { to: '/jarvis', label: '🤖 JARVIS', icon: Bot },
  { to: '/search', label: 'Web Search', icon: Search },
  { to: '/assistant', label: 'AI Assistant', icon: Sparkles },
  { to: '/devices', label: 'Devices', icon: Smartphone },
  { to: '/weather', label: 'Weather', icon: CloudSun },
  { to: '/weather/map', label: 'Weather Map', icon: Map },
  { to: '/news', label: 'Live News', icon: Newspaper },
  { to: '/space', label: 'NASA Space', icon: Rocket },
  { to: '/telegram', label: 'Telegram Bot', icon: Send },
  { to: '/saved', label: 'Saved', icon: Bookmark },
] as const;

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [settings] = useSettings();

  const handleNavClick = () => {
    setMenuOpen(false);
    if (settings.sound !== false) {
      playTapSound();
    }
  };

  const bottomNavItems = navItems.filter((item) =>
    ['/', '/jarvis', '/search', '/assistant', '/weather', '/space'].includes(item.to)
  );

  return (
    <div className="app-shell">
      <aside className={menuOpen ? 'open' : ''} style={{ overflowY: 'auto' }}>
        <div className="brand">
          <span><Radio size={17} /></span>
          <b>NEXUS</b>
        </div>
        <small className="brand-subtitle">INTELLIGENCE OS</small>

        <nav className="side-nav">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink to={to} end={to === '/'} key={to} onClick={handleNavClick}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <NavLink className="settings-link" to="/settings" onClick={handleNavClick}>
          <Settings size={18} />
          Settings
        </NavLink>

        <p className="system-status">
          <i /> Systems online
        </p>
      </aside>

      <header className="mobile-header">
        <button
          className="icon-button"
          onClick={() => setMenuOpen((value) => !value)}
          aria-label="Open menu"
        >
          <Menu size={21} />
        </button>
        <div className="brand">
          <span><Radio size={15} /></span>
          <b>NEXUS</b>
        </div>
        <NavLink
          to="/search"
          className="icon-button"
          aria-label="Search"
          onClick={handleNavClick}
        >
          <Search size={19} />
        </NavLink>
      </header>

      {menuOpen && (
        <button
          className="menu-overlay"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        />
      )}

      <main>
        <div className="page-content">
          <Outlet />
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        {bottomNavItems.map(({ to, label, icon: Icon }) => {
          const shortLabel =
            to === '/'
              ? 'Home'
              : to === '/assistant'
                ? 'AI'
                : label.replace('Web ', '').replace('NASA ', '').replace(' Bot', '');
          return (
            <NavLink to={to} end={to === '/'} key={to} onClick={handleNavClick}>
              <Icon size={18} />
              <small>{shortLabel}</small>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
