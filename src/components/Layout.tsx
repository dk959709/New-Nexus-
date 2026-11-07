import {
  Bookmark,
  Bot,
  ChevronDown,
  ChevronUp,
  CloudSun,
  Home,
  Image,
  Map,
  Menu,
  MessagesSquare,
  Mic,
  Network,
  Newspaper,
  Radio,
  Rocket,
  Search,
  Send,
  Settings,
  Smartphone,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { playTapSound } from '@/lib/audio';

const navItems = [
  { to: '/', label: 'Overview', icon: Home },
  { to: '/jarvis', label: '🤖 JARVIS', icon: Bot },
  { to: '/multi-chat', label: '💬 Multi Chat', icon: MessagesSquare },
  { to: '/parallax', label: '🌀 Parallax', icon: Network },
  { to: '/search', label: 'Web Search', icon: Search },
  { to: '/assistant', label: 'AI Assistant', icon: Sparkles },
  { to: '/voice-ai', label: 'Voice AI', icon: Mic },
  { to: '/image-studio', label: 'Image Studio', icon: Image },
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
  const location = useLocation();
  const isWorkflowsPage =
    location.pathname.startsWith('/workflows') ||
    location.pathname.startsWith('/telegram') ||
    location.pathname.startsWith('/image-studio') ||
    location.pathname.startsWith('/parallax') ||
    location.pathname.startsWith('/multi-chat') ||
    location.pathname.startsWith('/jarvis') ||
    location.pathname.startsWith('/assistant');
  const [workflowNavVisible, setWorkflowNavVisible] = useState(false);
  const navTouchStartYRef = useRef<number | null>(null);
  const pageTouchStartYRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef(0);

  useEffect(() => {
    setWorkflowNavVisible(false);
    lastScrollTopRef.current = 0;
  }, [location.pathname]);

  useEffect(() => {
    const handleNavVisibility = (e: Event) => {
      const custom = e as CustomEvent<{ visible?: boolean; toggle?: boolean }>;
      if (custom.detail?.toggle) {
        setWorkflowNavVisible((prev) => !prev);
      } else if (typeof custom.detail?.visible === 'boolean') {
        setWorkflowNavVisible(custom.detail.visible);
      }
    };
    const handleToggleMenu = () => {
      setMenuOpen((prev) => !prev);
    };
    window.addEventListener('nexus-workflow-bottom-nav', handleNavVisibility);
    window.addEventListener('nexus-toggle-side-menu', handleToggleMenu);
    return () => {
      window.removeEventListener('nexus-workflow-bottom-nav', handleNavVisibility);
      window.removeEventListener('nexus-toggle-side-menu', handleToggleMenu);
    };
  }, []);

  useEffect(() => {
    if (!isWorkflowsPage) return;

    const getWindowDistanceFromBottom = () => {
      const docEl = document.documentElement;
      const body = document.body;
      const scrollTop = window.scrollY || docEl.scrollTop || body.scrollTop || 0;
      const scrollHeight = Math.max(docEl.scrollHeight, body.scrollHeight);
      const clientHeight = window.innerHeight || docEl.clientHeight;
      return {
        scrollTop,
        scrollHeight,
        clientHeight,
        distanceFromBottom: scrollHeight - (scrollTop + clientHeight),
      };
    };

    const handleWindowScroll = () => {
      const { scrollTop, scrollHeight, clientHeight, distanceFromBottom } =
        getWindowDistanceFromBottom();
      if (scrollHeight <= clientHeight + 24) return;

      const isNearBottom = distanceFromBottom <= 90;
      const scrollingDown = scrollTop > lastScrollTopRef.current + 3;
      const scrollingUp = scrollTop < lastScrollTopRef.current - 12;

      if (isNearBottom) {
        setWorkflowNavVisible(true);
      } else if (scrollingUp && distanceFromBottom > 170) {
        setWorkflowNavVisible(false);
      } else if (scrollingDown && distanceFromBottom <= 140) {
        setWorkflowNavVisible(true);
      }
      lastScrollTopRef.current = scrollTop;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        pageTouchStartYRef.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (pageTouchStartYRef.current === null || e.touches.length === 0) return;
      const currentY = e.touches[0].clientY;
      const deltaUp = pageTouchStartYRef.current - currentY;
      const startedNearBottomEdge = pageTouchStartYRef.current >= window.innerHeight - 110;
      const { distanceFromBottom } = getWindowDistanceFromBottom();
      const isAtBottom = distanceFromBottom <= 105;

      if ((startedNearBottomEdge && deltaUp > 22) || (isAtBottom && deltaUp > 18)) {
        setWorkflowNavVisible(true);
      } else if (deltaUp < -34 && !isAtBottom) {
        setWorkflowNavVisible(false);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      const { distanceFromBottom } = getWindowDistanceFromBottom();
      if (e.deltaY > 10 && distanceFromBottom <= 125) {
        setWorkflowNavVisible(true);
      } else if (e.deltaY < -18 && distanceFromBottom > 175) {
        setWorkflowNavVisible(false);
      }
    };

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleWindowScroll);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [isWorkflowsPage]);

  const handleNavClick = () => {
    setMenuOpen(false);
    if (settings.sound !== false) {
      playTapSound();
    }
  };

  const bottomNavRoutes = ['/', '/jarvis', '/search', '/assistant', '/weather', '/image-studio'] as const;
  const bottomNavItems = bottomNavRoutes
    .map((route) => navItems.find((item) => item.to === route))
    .filter((item): item is (typeof navItems)[number] => item !== undefined);

  return (
    <div className={`app-shell ${isWorkflowsPage ? 'workflows-fullscreen-mode' : ''}`}>
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

        <small className="brand-subtitle" style={{ marginTop: '1.25rem', marginBottom: '0.5rem', display: 'block' }}>WORKFLOW</small>

        <nav className="side-nav" style={{ marginBottom: '1rem' }}>
          <NavLink to="/workflows" onClick={handleNavClick}>
            <Workflow size={18} />
            Workflows
          </NavLink>
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

      {isWorkflowsPage && !workflowNavVisible && (
        <div
          onClick={() => {
            setWorkflowNavVisible(true);
            window.dispatchEvent(
              new CustomEvent('nexus-workflow-bottom-nav', { detail: { visible: true } }),
            );
          }}
          className="fixed bottom-0 left-0 right-0 h-7 flex flex-col items-center justify-end pb-1.5 bg-gradient-to-t from-black/85 via-black/35 to-transparent z-[1210] cursor-pointer group"
          role="button"
          tabIndex={0}
          aria-label="Show navigation bar"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setWorkflowNavVisible(true);
              window.dispatchEvent(
                new CustomEvent('nexus-workflow-bottom-nav', { detail: { visible: true } }),
              );
            }
          }}
        >
          <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#090d16]/90 border border-cyan-500/35 group-hover:border-cyan-400/70 transition-all shadow-[0_4px_16px_rgba(0,0,0,0.75)]">
            <div className="w-10 h-1 rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400" />
            <ChevronUp size={11} className="text-cyan-300/90" />
          </div>
        </div>
      )}

      <nav
        className={`bottom-nav ${isWorkflowsPage ? 'bottom-nav--workflow-smart' : ''} ${
          isWorkflowsPage && workflowNavVisible ? 'bottom-nav--workflow-visible' : ''
        }`}
        aria-label="Mobile navigation"
        onTouchStart={(e) => {
          navTouchStartYRef.current = e.touches[0]?.clientY ?? null;
        }}
        onTouchMove={(e) => {
          if (!isWorkflowsPage || navTouchStartYRef.current === null) return;
          const deltaDown = (e.touches[0]?.clientY ?? 0) - navTouchStartYRef.current;
          if (deltaDown > 22) {
            setWorkflowNavVisible(false);
            window.dispatchEvent(
              new CustomEvent('nexus-workflow-bottom-nav', { detail: { visible: false } }),
            );
            navTouchStartYRef.current = null;
          }
        }}
      >
        {isWorkflowsPage && (
          <button
            type="button"
            onClick={() => {
              setWorkflowNavVisible(false);
              window.dispatchEvent(
                new CustomEvent('nexus-workflow-bottom-nav', { detail: { visible: false } }),
              );
            }}
            className="workflow-nav-dismiss-pill"
            aria-label="Toggle navigation bar"
          >
            <span className="workflow-nav-dismiss-pill-bar" />
            <ChevronDown size={11} />
          </button>
        )}
        {bottomNavItems.map(({ to, label, icon: Icon }) => {
          const shortLabel =
            to === '/'
              ? 'Home'
              : to === '/assistant'
                ? 'AI'
                : to === '/image-studio'
                  ? 'Image Studio'
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
