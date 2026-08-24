import React from 'react';
import { Play, ExternalLink, Image as ImageIcon, Film, Music } from 'lucide-react';
import type { MediaItem } from '@/types';

interface MediaResultCardProps {
  item: MediaItem;
  onSelect: (item: MediaItem) => void;
}

export const MediaResultCard: React.FC<MediaResultCardProps> = ({ item, onSelect }) => {
  const isVideo = item.type === 'video';
  const isAudio = item.type === 'audio';
  const isYouTube = item.source === 'YouTube' || item.domain.includes('youtube');

  return (
    <article className="result-card media-result-card">
      <div className="result-meta">
        <span className="result-domain-tag">
          {isYouTube ? (
            <>
              <Film size={13} className="text-cyan-400" />
              <span>🎬 YouTube {item.channel ? `· ${item.channel}` : ''}</span>
            </>
          ) : isVideo ? (
            <>
              <Film size={13} className="text-cyan-400" />
              <span>Video · {item.domain}</span>
            </>
          ) : isAudio ? (
            <>
              <Music size={13} className="text-cyan-400" />
              <span>Audio · {item.domain}</span>
            </>
          ) : (
            <>
              <ImageIcon size={13} className="text-cyan-400" />
              <span>Image · {item.domain}</span>
            </>
          )}
        </span>
        {item.license ? (
          <span className="text-xs text-cyan-300 opacity-80 truncate max-w-[140px]" title={item.license}>
            {item.license}
          </span>
        ) : item.channel ? (
          <span className="text-xs text-cyan-400 opacity-90 truncate max-w-[140px]">
            {item.channel}
          </span>
        ) : null}
      </div>

      <div className="result-content-layout">
        <div
          className="result-thumb-container relative group cursor-pointer overflow-hidden rounded-lg bg-black/45"
          onClick={() => onSelect(item)}
        >
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            className="result-thumb-img group-hover:scale-105 transition-transform duration-300 object-cover w-full h-full min-h-[120px]"
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80';
            }}
          />
          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/35 group-hover:bg-black/20 transition-colors">
              <div className="w-10 h-10 rounded-full bg-cyan-500/90 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <Play size={20} fill="currentColor" className="ml-0.5" />
              </div>
            </div>
          )}
        </div>

        <div className="result-text-block">
          <h2 className="font-semibold text-slate-100 text-base mb-1 line-clamp-2 cursor-pointer hover:text-cyan-300 transition-colors" onClick={() => onSelect(item)}>
            {item.title}
          </h2>
          {item.description && (
            <p className="text-sm text-slate-300 opacity-90 line-clamp-2 mb-3">
              {item.description}
            </p>
          )}
          <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-800/60">
            {item.duration ? (
              <span className="text-xs text-cyan-400 font-medium">{item.duration}</span>
            ) : (
              <code className="text-xs text-slate-400 truncate max-w-[180px]">{item.domain}</code>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="secondary-button text-xs px-3 py-1.5 inline-flex items-center gap-1.5"
                onClick={() => onSelect(item)}
              >
                {isVideo ? (
                  <>
                    <Play size={14} fill="currentColor" /> Play
                  </>
                ) : (
                  <>
                    <ImageIcon size={14} /> View Media
                  </>
                )}
              </button>
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 text-slate-400 hover:text-cyan-300 transition-colors"
                title={isYouTube ? 'Open on YouTube' : 'Open Source'}
              >
                <ExternalLink size={15} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};
