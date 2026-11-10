import { memo, useEffect, useRef, useState } from 'react';

type DevelopImageProps = {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  onClick?: () => void;
};

export const DevelopImage = memo(function DevelopImage({
  src,
  alt,
  className,
  containerClassName,
  onClick,
}: DevelopImageProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  return (
    <div className={containerClassName ?? 'relative h-full w-full'}>
      {!loaded && (
        <div
          aria-hidden="true"
          className="is-develop-loading absolute inset-0 z-[1] flex items-center justify-center overflow-hidden bg-[#0a0a0f]"
        >
          <span className="is-develop-shimmer absolute inset-0" />
          <span className="relative font-mono text-[9px] uppercase tracking-[0.22em] text-pink-300/80">
            Developing
          </span>
        </div>
      )}
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        decoding="async"
        onClick={onClick}
        onLoad={() => setLoaded(true)}
        draggable={false}
        className={`is-develop-img ${loaded ? 'is-developed' : ''} ${className ?? ''}`}
      />
      {loaded && (
        <span
          aria-hidden="true"
          className="is-develop-scan pointer-events-none absolute inset-x-0 top-0 h-1/5"
        />
      )}
    </div>
  );
});
