import React, { useState } from 'react';
import {
  Play,
  ExternalLink,
  Image as ImageIcon,
  Film,
  BookOpen,
  Globe,
  Bookmark,
  Copy,
  Check,
} from 'lucide-react';
import type { UnifiedSearchResult } from '@/types';

interface UnifiedResultCardProps {
  result: UnifiedSearchResult;
  saved?: boolean;
  onSave?: () => void;
  onPlayMedia?: (result: UnifiedSearchResult) => void;
  onViewImage?: (result: UnifiedSearchResult) => void;
}

export const UnifiedResultCard: React.FC<UnifiedResultCardProps> = ({
  result,
  saved = false,
  onSave,
  onPlayMedia,
  onViewImage,
}) => {
  const [copied, setCopied] = useState(false);
  const isVideo = result.type === 'video';
  const isImage = result.type === 'image';
  const isWiki = result.source === 'wikipedia' || result.type === 'article';
  const isYouTube = result.source === 'youtube';
  const isWikimedia = result.source === 'wikimedia';

  const imageSrc = result.thumbnail;

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback if clipboard unavailable
    }
  };

  return (
    <article
      className={`unified-result-card ${
        isWiki ? 'card-wiki' : isVideo ? 'card-video' : isImage ? 'card-image' : 'card-web'
      }`}
    >
      {/* Top Metadata Header */}
      <div className="result-card-topbar">
        <div className="result-source-pill">
          {isYouTube ? (
            <span className="source-pill-youtube">
              <Film size={13} className="text-red-400 shrink-0" />
              <strong className="text-red-300">YouTube</strong>
              {result.channel && <span className="source-subtext">· {result.channel}</span>}
            </span>
          ) : isWikimedia && isVideo ? (
            <span className="source-pill-wikimedia">
              <Film size={13} className="text-cyan-400 shrink-0" />
              <strong className="text-cyan-300">Wikimedia Video</strong>
            </span>
          ) : isWikimedia && isImage ? (
            <span className="source-pill-wikimedia">
              <ImageIcon size={13} className="text-cyan-400 shrink-0" />
              <strong className="text-cyan-300">Wikimedia Commons</strong>
            </span>
          ) : isWiki ? (
            <span className="source-pill-wiki">
              <BookOpen size={13} className="text-teal-300 shrink-0" />
              <strong className="text-teal-200">Wikipedia</strong>
            </span>
          ) : isVideo ? (
            <span className="source-pill-video">
              <Film size={13} className="text-cyan-400 shrink-0" />
              <span>Video · {result.domain || 'web'}</span>
            </span>
          ) : isImage ? (
            <span className="source-pill-image">
              <ImageIcon size={13} className="text-cyan-400 shrink-0" />
              <span>Image · {result.domain || 'web'}</span>
            </span>
          ) : (
            <span className="source-pill-web">
              <Globe size={13} className="text-cyan-400/80 shrink-0" />
              <span>{result.domain || 'web'}</span>
            </span>
          )}
        </div>

        <div className="result-top-actions">
          {result.duration && (
            <span className="result-tag-duration" title="Duration">
              <Play size={10} fill="currentColor" /> {result.duration}
            </span>
          )}

          {result.license && (
            <span className="result-tag-license" title={result.license}>
              {result.license}
            </span>
          )}

          <button
            type="button"
            onClick={handleCopyLink}
            className={`result-action-icon-btn ${copied ? 'text-cyan-300' : ''}`}
            title={copied ? 'Link copied!' : 'Copy link address'}
            aria-label={copied ? 'Link copied' : 'Copy link'}
          >
            {copied ? <Check size={14} className="text-cyan-400" /> : <Copy size={14} />}
          </button>

          {onSave && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSave();
              }}
              className={`result-action-icon-btn ${saved ? 'active-saved' : ''}`}
              title={saved ? 'Remove bookmark' : 'Save bookmark'}
              aria-label={saved ? 'Remove from saved' : 'Save result'}
            >
              <Bookmark size={15} fill={saved ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="result-card-body">
        {/* Responsive Thumbnail / Media Preview */}
        {imageSrc && (
          <div
            className={`result-card-thumb-wrap ${
              isVideo || isImage ? 'cursor-pointer group' : ''
            }`}
            onClick={() => {
              if (isVideo && onPlayMedia) {
                onPlayMedia(result);
              } else if (isImage && onViewImage) {
                onViewImage(result);
              }
            }}
          >
            <img
              src={imageSrc}
              alt={result.title}
              className="result-card-thumb-img"
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80';
              }}
            />
            {isVideo && (
              <div className="thumb-play-overlay">
                <div className="play-pulse-btn">
                  <Play size={18} fill="currentColor" className="ml-0.5 text-slate-950" />
                </div>
              </div>
            )}
            {isImage && (
              <div className="thumb-image-overlay">
                <span className="view-img-badge">
                  <ImageIcon size={12} /> View
                </span>
              </div>
            )}
          </div>
        )}

        {/* Text Block & Description */}
        <div className="result-card-content">
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="result-card-title-link"
          >
            <h2 className="result-card-heading">
              <span>{result.title}</span>
              <ExternalLink size={14} className="result-title-arrow" />
            </h2>
          </a>

          {result.description && (
            <p className="result-card-snippet">
              {result.description}
            </p>
          )}

          {/* Footer with URL breadcrumb and Action Buttons */}
          <div className="result-card-footer">
            <div className="result-url-breadcrumb" title={result.url}>
              <code className="result-url-text">
                {result.url}
              </code>
              {result.author && (
                <span className="result-author-text">
                  by {result.author}
                </span>
              )}
            </div>

            <div className="result-interactive-buttons">
              {isVideo && (
                <button
                  type="button"
                  className="result-cta-btn btn-play"
                  onClick={() => onPlayMedia?.(result)}
                >
                  <Play size={12} fill="currentColor" />
                  <span>Play Video</span>
                </button>
              )}

              {isImage && (
                <button
                  type="button"
                  className="result-cta-btn btn-image"
                  onClick={() => onViewImage?.(result)}
                >
                  <ImageIcon size={12} />
                  <span>View Image</span>
                </button>
              )}

              {isWiki && (
                <a
                  href={result.url}
                  target="_blank"
                  rel="noreferrer"
                  className="result-cta-btn btn-wiki"
                >
                  <BookOpen size={12} />
                  <span>Read Article</span>
                </a>
              )}

              <a
                href={result.url}
                target="_blank"
                rel="noreferrer"
                className="result-cta-btn btn-open"
                title="Visit website in new tab"
                aria-label="Visit website"
              >
                <span>Visit</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};
