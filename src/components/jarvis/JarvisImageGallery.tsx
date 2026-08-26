import { useState } from 'react';
import {
  Image as ImageIcon,
  ExternalLink,
  Maximize2,
  X,
  Sparkles,
  Layers,
} from 'lucide-react';
import type { JarvisImageResult } from '@/types';

interface JarvisImageGalleryProps {
  images: JarvisImageResult[];
  title?: string;
}

export function JarvisImageGallery({ images, title }: JarvisImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<JarvisImageResult | null>(null);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());

  if (!images || images.length === 0) return null;

  const validImages = images.filter((img) => !failedUrls.has(img.url));
  if (validImages.length === 0) return null;

  const handleImageError = (url: string) => {
    setFailedUrls((prev) => new Set(prev).add(url));
  };

  return (
    <div
      className="my-5 rounded-2xl overflow-hidden backdrop-blur-xl transition-all duration-300"
      style={{
        background: 'linear-gradient(145deg, rgba(16, 24, 44, 0.85) 0%, rgba(30, 20, 50, 0.9) 100%)',
        border: '1.5px solid rgba(236, 72, 153, 0.35)',
        boxShadow: '0 12px 36px rgba(0,0,0,0.5), 0 0 24px rgba(236, 72, 153, 0.15)',
      }}
    >
      {/* Header Bar */}
      <div
        className="px-4 py-3 flex items-center justify-between flex-wrap gap-2"
        style={{
          background: 'linear-gradient(90deg, rgba(236, 72, 153, 0.18) 0%, rgba(168, 85, 247, 0.12) 100%)',
          borderBottom: '1px solid rgba(236, 72, 153, 0.25)',
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-pink-500/20 border border-pink-400/50 flex items-center justify-center shadow-[0_0_10px_rgba(236,72,153,0.3)]">
            <ImageIcon size={14} className="text-pink-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-white tracking-wide">
                RETRIEVED PHOTOGRAPHIC MEDIA
              </span>
              <span className="px-2 py-0.5 rounded-full bg-pink-500/20 border border-pink-400/40 text-pink-300 text-[10px] font-mono font-bold">
                {validImages.length} {validImages.length === 1 ? 'PHOTO' : 'PHOTOS'}
              </span>
            </div>
            {title && (
              <p className="text-[11px] text-pink-200/70 font-mono truncate max-w-md m-0">
                Visual evidence for: {title}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-pink-300/80 font-mono">
          <Sparkles size={12} className="text-pink-400" />
          <span>Real World Grounding</span>
        </div>
      </div>

      {/* Grid of Images */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
        {validImages.map((img, idx) => (
          <div
            key={idx}
            className="group relative rounded-xl overflow-hidden flex flex-col transition-all duration-300 hover:scale-[1.02]"
            style={{
              background: 'rgba(7, 14, 28, 0.75)',
              border: '1px solid rgba(236, 72, 153, 0.25)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            {/* Image Container with Hover Overlay */}
            <div
              className="relative aspect-video w-full overflow-hidden bg-slate-950 cursor-pointer"
              onClick={() => setSelectedImage(img)}
            >
              <img
                src={img.url}
                alt={img.title || 'Retrieved photo'}
                referrerPolicy="no-referrer"
                onError={() => handleImageError(img.url)}
                className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-108"
                loading="lazy"
              />

              {/* Source Badge Overlay */}
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/15 text-[10px] font-mono font-bold text-pink-200 uppercase flex items-center gap-1">
                <Layers size={10} className="text-pink-400" />
                <span>{img.source || 'NEXUS Image'}</span>
              </div>

              {/* Hover Enlarge Icon */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-between p-2.5">
                <span className="text-[11px] text-white font-medium truncate drop-shadow-md">
                  Click to enlarge
                </span>
                <div className="w-6 h-6 rounded-full bg-pink-500/80 backdrop-blur-md flex items-center justify-center text-white shadow-md">
                  <Maximize2 size={12} />
                </div>
              </div>
            </div>

            {/* Caption & Source Details */}
            <div className="p-3 flex-1 flex flex-col justify-between gap-1.5">
              <h5
                className="text-xs font-bold text-slate-100 line-clamp-2 m-0 group-hover:text-pink-200 transition-colors"
                title={img.title}
              >
                {img.title || 'Photographic Reference'}
              </h5>

              <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-white/5">
                <span className="text-slate-400 font-mono truncate max-w-[130px]" title={img.domain || img.author}>
                  {img.domain || img.author || 'Verified Grounding'}
                </span>

                <a
                  href={img.sourceUrl || img.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-pink-300 hover:text-white px-2 py-0.5 rounded-full bg-pink-500/15 hover:bg-pink-500/30 border border-pink-400/30 transition-all shrink-0"
                  title="View original high-res image source"
                >
                  <span>Source</span>
                  <ExternalLink size={10} />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Fullscreen Preview Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-md"
          style={{ background: 'rgba(2, 6, 18, 0.85)' }}
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl"
            style={{
              background: 'linear-gradient(145deg, #091322 0%, #151028 100%)',
              border: '1.5px solid rgba(236, 72, 153, 0.5)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.8), 0 0 32px rgba(236, 72, 153, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-black/60 border-b border-pink-500/25 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-pink-500/20 border border-pink-400/50 flex items-center justify-center">
                  <ImageIcon size={16} className="text-pink-300" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white truncate m-0">
                    {selectedImage.title || 'Photographic Preview'}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] text-pink-300 font-mono">
                    <span>{selectedImage.source || 'NEXUS Search'}</span>
                    {selectedImage.domain && <span>• {selectedImage.domain}</span>}
                    {selectedImage.author && <span>• By {selectedImage.author}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={selectedImage.sourceUrl || selectedImage.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-pink-200 bg-pink-500/20 hover:bg-pink-500/35 border border-pink-400/40 transition-all"
                >
                  <span>Open Full-Res</span>
                  <ExternalLink size={12} />
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Image View */}
            <div className="relative flex-1 min-h-[300px] max-h-[68vh] bg-black/90 flex items-center justify-center p-2 overflow-auto">
              <img
                src={selectedImage.url}
                alt={selectedImage.title || 'Retrieved photo'}
                referrerPolicy="no-referrer"
                className="max-h-full max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>

            {/* Modal Footer Caption */}
            {selectedImage.description && (
              <div className="p-3.5 bg-black/60 border-t border-pink-500/20 text-xs text-slate-300 leading-relaxed">
                {selectedImage.description}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
