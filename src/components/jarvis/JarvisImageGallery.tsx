import { useState } from 'react';
import {
  Image as ImageIcon,
  ExternalLink,
  Maximize2,
  X,
  Sparkles,
  Camera,
  Palette,
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

  const hasRealPhoto = validImages.some((img) => img.imageType === 'real' || img.domain?.includes('wiki'));
  const hasAiGenerated = validImages.some((img) => img.imageType === 'ai' || img.source?.includes('AI'));

  // Header Title
  let headerTitle = 'RETRIEVED PHOTOGRAPHIC MEDIA';
  if (hasRealPhoto && hasAiGenerated) {
    headerTitle = 'REAL PHOTO & AI VISUAL SYNTHESIS';
  } else if (hasAiGenerated && !hasRealPhoto) {
    headerTitle = 'AI GENERATED VISUAL';
  }

  const getImageLabel = (img: JarvisImageResult): string => {
    if (img.label) return img.label;
    if (img.imageType === 'ai' || img.source?.includes('AI')) {
      return '🎨 AI Generated';
    }
    if (img.imageType === 'real' || img.domain?.includes('wikipedia') || img.domain?.includes('wikimedia')) {
      return '📷 Real Photo (Wikipedia)';
    }
    return img.source || '📷 Real Photo';
  };

  const isAi = (img: JarvisImageResult): boolean => {
    return img.imageType === 'ai' || (img.source?.includes('AI') ?? false);
  };

  return (
    <div
      className="my-5 rounded-2xl overflow-hidden backdrop-blur-xl transition-all duration-300"
      style={{
        background: 'linear-gradient(145deg, rgba(14, 22, 38, 0.9) 0%, rgba(26, 18, 44, 0.92) 100%)',
        border: '1.5px solid rgba(236, 72, 153, 0.35)',
        boxShadow: '0 12px 36px rgba(0,0,0,0.5), 0 0 24px rgba(236, 72, 153, 0.15)',
      }}
    >
      {/* Header Bar */}
      <div
        className="px-4 py-3 flex items-center justify-between flex-wrap gap-2"
        style={{
          background: 'linear-gradient(90deg, rgba(236, 72, 153, 0.18) 0%, rgba(168, 85, 247, 0.15) 100%)',
          borderBottom: '1px solid rgba(236, 72, 153, 0.25)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-pink-500/20 border border-pink-400/50 flex items-center justify-center shadow-[0_0_10px_rgba(236,72,153,0.3)]">
            <ImageIcon size={14} className="text-pink-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-extrabold text-white tracking-wide">
                {headerTitle}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-pink-500/20 border border-pink-400/40 text-pink-300 text-[10px] font-mono font-bold">
                {validImages.length} {validImages.length === 1 ? 'VISUAL' : 'VISUALS'}
              </span>
            </div>
            {title && (
              <p className="text-[11px] text-pink-200/70 font-mono truncate max-w-md m-0">
                Visual subject: {title}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-pink-300/80 font-mono">
          <Sparkles size={12} className="text-pink-400" />
          <span>Multimodal Intelligence</span>
        </div>
      </div>

      {/* Grid of Images: Side-by-side on desktop, stacked on mobile */}
      <div
        className={`p-4 grid gap-4 ${
          validImages.length === 1
            ? 'grid-cols-1 max-w-xl mx-auto'
            : validImages.length === 2
            ? 'grid-cols-1 md:grid-cols-2'
            : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
        }`}
      >
        {validImages.map((img, idx) => {
          const imgIsAi = isAi(img);
          const labelText = getImageLabel(img);

          return (
            <div
              key={idx}
              className="group relative rounded-xl overflow-hidden flex flex-col transition-all duration-300 hover:scale-[1.015]"
              style={{
                background: imgIsAi
                  ? 'linear-gradient(180deg, rgba(28, 14, 46, 0.8) 0%, rgba(14, 18, 36, 0.9) 100%)'
                  : 'linear-gradient(180deg, rgba(8, 28, 32, 0.8) 0%, rgba(10, 18, 32, 0.9) 100%)',
                border: imgIsAi
                  ? '1.5px solid rgba(168, 85, 247, 0.35)'
                  : '1.5px solid rgba(16, 185, 129, 0.35)',
                boxShadow: imgIsAi
                  ? '0 6px 20px rgba(168, 85, 247, 0.12)'
                  : '0 6px 20px rgba(16, 185, 129, 0.12)',
              }}
            >
              {/* Category Header Strip / Tag */}
              <div
                className="px-3.5 py-2 flex items-center justify-between border-b"
                style={{
                  background: imgIsAi ? 'rgba(168, 85, 247, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                  borderColor: imgIsAi ? 'rgba(168, 85, 247, 0.25)' : 'rgba(16, 185, 129, 0.25)',
                }}
              >
                <div className="flex items-center gap-1.5">
                  {imgIsAi ? (
                    <Palette size={13} className="text-purple-300" />
                  ) : (
                    <Camera size={13} className="text-emerald-300" />
                  )}
                  <span
                    className={`text-xs font-bold font-mono tracking-wide ${
                      imgIsAi ? 'text-purple-200' : 'text-emerald-200'
                    }`}
                  >
                    {labelText}
                  </span>
                </div>

                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                    imgIsAi
                      ? 'bg-purple-950/60 border-purple-500/30 text-purple-300'
                      : 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300'
                  }`}
                >
                  {img.domain || (imgIsAi ? 'AI Model' : 'Wikipedia')}
                </span>
              </div>

              {/* Image Container with Hover Overlay */}
              <div
                className="relative aspect-video sm:aspect-[4/3] md:aspect-video w-full overflow-hidden bg-slate-950 cursor-pointer"
                onClick={() => setSelectedImage(img)}
              >
                <img
                  src={img.url}
                  alt={img.title || labelText}
                  referrerPolicy="no-referrer"
                  onError={() => handleImageError(img.url)}
                  className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />

                {/* Hover Enlarge Icon */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-between p-3">
                  <span className="text-[11px] text-white font-medium truncate drop-shadow-md">
                    Click to view full resolution
                  </span>
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-white shadow-md ${
                      imgIsAi ? 'bg-purple-600' : 'bg-emerald-600'
                    }`}
                  >
                    <Maximize2 size={13} />
                  </div>
                </div>
              </div>

              {/* Caption & Source Details */}
              <div className="p-3.5 flex-1 flex flex-col justify-between gap-2">
                <div>
                  <h5
                    className="text-xs font-bold text-slate-100 line-clamp-2 m-0 group-hover:text-pink-200 transition-colors"
                    title={img.title}
                  >
                    {img.title || (imgIsAi ? 'AI Neural Synthesis' : 'Photographic Reference')}
                  </h5>
                  {img.description && (
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed m-0">
                      {img.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-white/5">
                  <span
                    className="text-slate-400 font-mono truncate max-w-[150px]"
                    title={img.author || img.domain}
                  >
                    {img.author ? `By ${img.author}` : img.domain || (imgIsAi ? 'Image AI' : 'Wikipedia')}
                  </span>

                  {img.sourceUrl && (
                    <a
                      href={img.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all shrink-0 ${
                        imgIsAi
                          ? 'bg-purple-500/15 text-purple-200 hover:bg-purple-500/30 border-purple-400/30'
                          : 'bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/30 border-emerald-400/30'
                      }`}
                      title="View original source"
                    >
                      <span>Source</span>
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
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
              border: isAi(selectedImage)
                ? '1.5px solid rgba(168, 85, 247, 0.5)'
                : '1.5px solid rgba(16, 185, 129, 0.5)',
              boxShadow: isAi(selectedImage)
                ? '0 24px 64px rgba(0,0,0,0.8), 0 0 32px rgba(168, 85, 247, 0.3)'
                : '0 24px 64px rgba(0,0,0,0.8), 0 0 32px rgba(16, 185, 129, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-black/60 border-b border-white/10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-full border flex items-center justify-center ${
                    isAi(selectedImage)
                      ? 'bg-purple-500/20 border-purple-400/50 text-purple-300'
                      : 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                  }`}
                >
                  {isAi(selectedImage) ? <Palette size={16} /> : <Camera size={16} />}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white truncate m-0">
                    {selectedImage.title || getImageLabel(selectedImage)}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-300">
                    <span className={isAi(selectedImage) ? 'text-purple-300 font-bold' : 'text-emerald-300 font-bold'}>
                      {getImageLabel(selectedImage)}
                    </span>
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    isAi(selectedImage)
                      ? 'text-purple-200 bg-purple-500/20 hover:bg-purple-500/35 border-purple-400/40'
                      : 'text-emerald-200 bg-emerald-500/20 hover:bg-emerald-500/35 border-emerald-400/40'
                  }`}
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
                alt={selectedImage.title || getImageLabel(selectedImage)}
                referrerPolicy="no-referrer"
                className="max-h-full max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>

            {/* Modal Footer Caption */}
            {selectedImage.description && (
              <div className="p-3.5 bg-black/60 border-t border-white/10 text-xs text-slate-300 leading-relaxed">
                {selectedImage.description}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
