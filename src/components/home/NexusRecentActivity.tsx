import { Zap, Globe, Sparkles, CloudSun, Newspaper, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { storage } from '@/lib/storage';

interface ActivityItem {
  id: string;
  type: 'search' | 'ai' | 'weather' | 'news';
  label: string;
  query?: string;
  target?: string;
  time: string;
  color: string;
  borderColor: string;
}

interface NexusRecentActivityProps {
  onExecuteSearch?: (query: string) => void;
}

export function NexusRecentActivity({ onExecuteSearch }: NexusRecentActivityProps) {
  const navigate = useNavigate();
  const searches = storage.getSearches();

  // Construct realistic live activity sequence combined with user's actual stored searches
  const activityItems: ActivityItem[] = [
    ...(searches.slice(0, 3).map((query, idx) => ({
      id: `stored-${idx}`,
      type: 'search' as const,
      label: `Web Search: "${query}"`,
      query,
      target: `/search?q=${encodeURIComponent(query)}`,
      time: idx === 0 ? 'Just now' : `${(idx + 1) * 3}m ago`,
      color: 'text-cyan-400',
      borderColor: 'border-cyan-500/30 hover:border-cyan-400',
    }))),
    {
      id: 'act-ai-1',
      type: 'ai',
      label: 'AI Query: Quantum computing architecture',
      query: 'Quantum computing architecture',
      target: '/search?q=Quantum+computing+architecture&type=ai',
      time: '4m ago',
      color: 'text-emerald-400',
      borderColor: 'border-emerald-500/30 hover:border-emerald-400',
    },
    {
      id: 'act-weather-1',
      type: 'weather',
      label: 'Weather Check: Local Doppler radar sync',
      target: '/weather',
      time: '12m ago',
      color: 'text-cyan-300',
      borderColor: 'border-cyan-500/30 hover:border-cyan-400',
    },
    {
      id: 'act-news-1',
      type: 'news',
      label: 'News Update: Global tech & science wire',
      target: '/news',
      time: '18m ago',
      color: 'text-amber-400',
      borderColor: 'border-amber-500/30 hover:border-amber-400',
    },
    {
      id: 'act-search-2',
      type: 'search',
      label: 'Web Search: James Webb telescope latest',
      query: 'James Webb telescope latest',
      target: '/search?q=James+Webb+telescope+latest',
      time: '25m ago',
      color: 'text-fuchsia-400',
      borderColor: 'border-fuchsia-500/30 hover:border-fuchsia-400',
    },
    {
      id: 'act-ai-2',
      type: 'ai',
      label: 'AI Query: Autonomous space exploration',
      query: 'Autonomous space exploration',
      target: '/search?q=Autonomous+space+exploration&type=ai',
      time: '34m ago',
      color: 'text-emerald-400',
      borderColor: 'border-emerald-500/30 hover:border-emerald-400',
    },
  ];

  const handleItemClick = (item: ActivityItem) => {
    if (item.query && onExecuteSearch) {
      onExecuteSearch(item.query);
    } else if (item.target) {
      navigate(item.target);
    }
  };

  const renderIcon = (type: ActivityItem['type'], colorClass: string) => {
    switch (type) {
      case 'ai':
        return <Sparkles size={13} className={colorClass} />;
      case 'weather':
        return <CloudSun size={13} className={colorClass} />;
      case 'news':
        return <Newspaper size={13} className={colorClass} />;
      case 'search':
      default:
        return <Globe size={13} className={colorClass} />;
    }
  };

  return (
    <section
      id="recent-activity-panel"
      aria-label="Recent Activity"
      className="relative w-full rounded-2xl border border-cyan-500/30 bg-[#030712]/90 p-4 sm:p-5 shadow-[0_0_25px_rgba(6,182,212,0.1)] font-mono my-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-cyan-500/15">
        <div className="flex items-center gap-2 text-cyan-300">
          <Zap size={16} className="text-amber-400" />
          <span className="text-xs font-bold tracking-widest uppercase">
            RECENT ACTIVITY
          </span>
        </div>
        <span className="text-[11px] text-slate-400 hidden sm:inline-block">
          LIVE TELEMETRY STREAM
        </span>
      </div>

      {/* Horizontally Scrollable Pills Row */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-cyan-500/20 scrollbar-track-transparent">
        {activityItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleItemClick(item)}
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-900/80 border ${item.borderColor} text-xs text-slate-200 transition-all hover:bg-slate-800/80 hover:shadow-[0_0_15px_rgba(34,211,238,0.2)] shrink-0 group text-left`}
          >
            {renderIcon(item.type, item.color)}
            <span className="font-mono text-slate-300 group-hover:text-white transition-colors max-w-[200px] truncate">
              {item.label}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold px-1.5 py-0.5 rounded bg-black/40 border border-white/5 shrink-0">
              {item.time}
            </span>
            <ArrowRight size={11} className="text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
          </button>
        ))}
      </div>
    </section>
  );
}
