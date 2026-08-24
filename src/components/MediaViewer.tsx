import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Image as ImageIcon, Film, ShieldAlert, Loader2 } from 'lucide-react';
import type { MediaItem, UnifiedSearchResult } from '@/types';

interface MediaViewerProps {
  item: MediaItem | UnifiedSearchResult | null;
  onClose: () => void;
}

interface MediaFormatItem {
  formatId: string;
  ext: string;
  height?: number;
  width?: number;
  fps?: number;
  hasVideo: boolean;
  hasAudio: boolean;
  playableUrl: string;
}

interface ExtractionData {
  success: boolean;
  title?: string;
  thumbnail?: string;
  duration?: number;
  source?: string;
  originalUrl?: string;
  formats?: MediaFormatItem[];
  error?: string;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({ item, onClose }) => {
  const [videoError, setVideoError] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtractionData | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<string>('auto');
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false);

  // Normalize item fields whether coming from MediaItem or UnifiedSearchResult
  const normalizedItem = item ? {
    id: item.id,
    title: item.title,
    description: item.description,
    thumbnailUrl: 'thumbnailUrl' in item && item.thumbnailUrl ? item.thumbnailUrl : (('thumbnail' in item && item.thumbnail) ? item.thumbnail : ''),
    mediaUrl: 'mediaUrl' in item && item.mediaUrl ? item.mediaUrl : (('playableUrl' in item && item.playableUrl) ? item.playableUrl : (('url' in item && item.url) ? item.url : '')),
    sourceUrl: 'sourceUrl' in item && item.sourceUrl ? item.sourceUrl : (('url' in item && item.url) ? item.url : ''),
    domain: item.domain || '',
    type: item.type === 'image' ? ('image' as const) : ('video' as const),
    author: ('author' in item && item.author) ? item.author : (('creator' in item && item.creator) ? item.creator : undefined),
    license: item.license,
    duration: item.duration,
    videoId: item.videoId,
    channel: item.channel,
    embedUrl: item.embedUrl,
    source: item.source,
  } : null;

  const isWikimedia = Boolean(
    normalizedItem && (
      normalizedItem.domain === 'commons.wikimedia.org' ||
      normalizedItem.source === 'Wikimedia' ||
      normalizedItem.source === 'wikimedia' ||
      normalizedItem.mediaUrl?.includes('wikimedia.org') ||
      normalizedItem.sourceUrl?.includes('wikimedia.org') ||
      normalizedItem.id?.startsWith('wiki_comm_') ||
      normalizedItem.id?.startsWith('wiki_vid_')
    )
  );

  const isYouTube = Boolean(
    normalizedItem && (
      normalizedItem.source === 'YouTube' ||
      normalizedItem.source === 'youtube' ||
      normalizedItem.domain?.includes('youtube') ||
      Boolean(normalizedItem.videoId) ||
      normalizedItem.mediaUrl?.includes('youtube.com/embed') ||
      normalizedItem.sourceUrl?.includes('youtube.com') ||
      normalizedItem.sourceUrl?.includes('youtu.be')
    )
  );

  useEffect(() => {
    setVideoError(false);
    setExtracting(false);
    setExtractionResult(null);
    setExtractionError(null);
    setSelectedQuality('auto');
    setHasStartedPlayback(false);
  }, [item]);

  if (!normalizedItem) return null;

  const isVideo = normalizedItem.type === 'video';
  const videoId = normalizedItem.videoId || (normalizedItem.mediaUrl.match(/\/embed\/([a-zA-Z0-9_-]{11})/)?.[1]) || (normalizedItem.sourceUrl?.match(/(?:v=|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1]);
  const safeEmbedUrl = videoId 
    ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&enablejsapi=1&modestbranding=1&rel=0`
    : normalizedItem.embedUrl || normalizedItem.mediaUrl;
  const watchUrl = isWikimedia
    ? (normalizedItem.sourceUrl || normalizedItem.mediaUrl)
    : (videoId ? `https://www.youtube.com/watch?v=${videoId}` : (normalizedItem.sourceUrl || normalizedItem.mediaUrl));

  const formats = extractionResult?.formats || [];
  const selectedFormat = (() => {
    if (formats.length === 0) return null;
    const withAudioVideo = formats.filter((f) => f.hasVideo && f.playableUrl);
    if (withAudioVideo.length === 0) return formats[0];

    if (selectedQuality === '1080') {
      return withAudioVideo.find((f) => f.height === 1080) || withAudioVideo.find((f) => f.height !== undefined && f.height <= 1080) || withAudioVideo[0];
    }
    if (selectedQuality === '720') {
      return withAudioVideo.find((f) => f.height === 720) || withAudioVideo.find((f) => f.height !== undefined && f.height <= 720) || withAudioVideo[0];
    }
    if (selectedQuality === '480') {
      return withAudioVideo.find((f) => f.height === 480) || withAudioVideo.find((f) => f.height !== undefined && f.height <= 480) || withAudioVideo[0];
    }
    if (selectedQuality === '360') {
      return withAudioVideo.find((f) => f.height === 360) || withAudioVideo.find((f) => f.height !== undefined && f.height <= 360) || withAudioVideo[0];
    }
    return withAudioVideo.reduce((prev, curr) => ((curr.height || 0) > (prev.height || 0) ? curr : prev), withAudioVideo[0]);
  })();

  const playableStreamUrl = isWikimedia
    ? (normalizedItem.mediaUrl || normalizedItem.sourceUrl)
    : (selectedFormat?.playableUrl || normalizedItem.mediaUrl);


  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Media Viewer"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center flex-shrink-0">
              {isVideo ? <Film size={18} /> : <ImageIcon size={18} />}
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-100 text-base truncate">{extractionResult?.title || normalizedItem.title}</h3>
              <p className="text-xs text-slate-400 truncate">
                Source: {isWikimedia ? 'Wikimedia Commons' : (extractionResult?.source || normalizedItem.domain)}
                {normalizedItem.channel ? ` · ${normalizedItem.channel}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close viewer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Quality Selector Toolbar for YouTube Extracted Stream */}
        {isVideo && isYouTube && formats.length > 0 && (
          <div className="flex items-center justify-between px-5 py-2.5 bg-slate-950/85 border-b border-slate-800 text-xs">
            <span className="text-slate-300 font-medium">yt-dlp Extracted Stream</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Quality:</span>
              <select
                value={selectedQuality}
                onChange={(e) => setSelectedQuality(e.target.value)}
                className="bg-slate-900 text-slate-200 border border-slate-700 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-cyan-500"
              >
                <option value="auto">Auto (Best)</option>
                <option value="1080">1080p</option>
                <option value="720">720p</option>
                <option value="480">480p</option>
                <option value="360">360p</option>
              </select>
            </div>
          </div>
        )}

        {/* Media Container */}
        <div className="relative flex-1 bg-black/90 flex items-center justify-center overflow-hidden min-h-[300px] max-h-[60vh]">
          {isVideo ? (
            extracting ? (
              <div className="text-center p-8 space-y-3">
                <Loader2 size={38} className="animate-spin text-cyan-400 mx-auto" />
                <p className="text-sm font-medium text-slate-200">Extracting YouTube media...</p>
                <p className="text-xs text-slate-400">Preparing player stream via yt-dlp backend</p>
              </div>
            ) : isWikimedia ? (
              videoError ? (
                <div className="p-8 text-center max-w-md">
                  <ShieldAlert size={42} className="mx-auto text-amber-400 mb-3" />
                  <h4 className="text-slate-100 font-semibold mb-1">Wikimedia media direct playback unavailable.</h4>
                  <p className="text-xs text-slate-400 mb-4">
                    This Wikimedia Commons video format requires external viewing on Wikimedia Commons.
                  </p>
                  <a
                    href={watchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="secondary-button inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30"
                  >
                    <Film size={16} /> ▶ Open Original Commons File <ExternalLink size={14} />
                  </a>
                </div>
              ) : (
                <video
                  src={playableStreamUrl}
                  controls
                  autoPlay
                  className="w-full h-full max-h-[60vh] object-contain"
                  onPlay={() => setHasStartedPlayback(true)}
                  onError={() => setVideoError(true)}
                >
                  Your browser does not support the video tag.
                </video>
              )
            ) : extractionResult && playableStreamUrl && !videoError ? (
              <video
                src={playableStreamUrl}
                controls
                autoPlay
                className="w-full h-full max-h-[60vh] object-contain"
                onPlay={() => setHasStartedPlayback(true)}
                onError={() => setVideoError(true)}
              >
                Your browser does not support the video tag.
              </video>
            ) : isYouTube && !videoError ? (
              <iframe
                src={safeEmbedUrl}
                title={normalizedItem.title}
                className="w-full h-full aspect-video border-0 min-h-[360px]"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={() => {
                  setHasStartedPlayback(true);
                }}
                onError={() => {
                  setVideoError(true);
                }}
              />
            ) : videoError || extractionError ? (
              <div className="p-8 text-center max-w-md">
                <ShieldAlert size={42} className="mx-auto text-amber-400 mb-3" />
                <h4 className="text-slate-100 font-semibold mb-1">This video can't be played inside NEXUS.</h4>
                <p className="text-xs text-slate-400 mb-4">
                  {extractionError || 'In-app playback unavailable — YouTube playback is available externally.'}
                </p>
                <a
                  href={watchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="secondary-button inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30"
                >
                  <Film size={16} /> ▶ Open on YouTube <ExternalLink size={14} />
                </a>
              </div>
            ) : (
              <video
                src={normalizedItem.mediaUrl}
                controls
                autoPlay
                className="w-full h-full max-h-[60vh] object-contain"
                onPlay={() => setHasStartedPlayback(true)}
                onError={() => setVideoError(true)}
              >
                Your browser does not support the video tag.
              </video>
            )
          ) : (
            <img
              src={normalizedItem.mediaUrl}
              alt={normalizedItem.title}
              className="w-full h-full max-h-[60vh] object-contain select-none"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = normalizedItem.thumbnailUrl;
              }}
            />
          )}
        </div>

        {/* Footer Details */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            {normalizedItem.description && (
              <p className="text-sm text-slate-300 line-clamp-2">{normalizedItem.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              {normalizedItem.author && <span className="text-slate-300">Author: {normalizedItem.author}</span>}
              {normalizedItem.channel && <span className="text-cyan-400 font-medium">Channel: {normalizedItem.channel}</span>}
              {hasStartedPlayback && <span className="text-emerald-400 font-medium">Status: Playing</span>}
              {normalizedItem.license && (
                <span className="px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-800/40">
                  {normalizedItem.license}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <a
              href={watchUrl}
              target="_blank"
              rel="noreferrer"
              className="secondary-button inline-flex items-center gap-1.5 text-xs px-4 py-2"
            >
              {isWikimedia ? 'Open Original Commons File' : (isYouTube ? 'Open on YouTube' : 'Open Original')} <ExternalLink size={14} />
            </a>
            <button
              type="button"
              className="search-submit text-xs px-4 py-2 inline-flex items-center gap-1.5"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
