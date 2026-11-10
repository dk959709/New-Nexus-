import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { ChevronsLeftRight, ImagePlus, Maximize2, Sparkles } from 'lucide-react';
import { DevelopImage } from './DevelopImage';

type BeforeAfterSliderProps = {
  beforeSrc: string;
  afterSrc: string;
  alt: string;
  modelLabel?: string;
  onExpand?: () => void;
};

export function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  alt,
  modelLabel,
  onExpand,
}: BeforeAfterSliderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const lastDragEndRef = useRef(0);
  const [position, setPosition] = useState(50);

  const updateFromClientX = useCallback((clientX: number) => {
    const element = containerRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (!rect.width) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(96, Math.max(4, next)));
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    draggingRef.current = true;
    movedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromClientX(event.clientX);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    movedRef.current = true;
    updateFromClientX(event.clientX);
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (movedRef.current) {
      lastDragEndRef.current = Date.now();
    }
    draggingRef.current = false;
    const target = event.target as Element | null;
    if (target?.hasPointerCapture?.(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 10 : 2;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setPosition((previous) => Math.max(4, previous - step));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setPosition((previous) => Math.min(96, previous + step));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setPosition(4);
    } else if (event.key === 'End') {
      event.preventDefault();
      setPosition(96);
    }
  };

  const handleExpand = () => {
    if (draggingRef.current || Date.now() - lastDragEndRef.current < 260) return;
    onExpand?.();
  };

  return (
    <div className="bg-[#0a0a0f] p-2.5">
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-t-xl bg-[#161620] border border-[#232332] border-b-0 text-[10px] font-mono">
        <span className="inline-flex items-center gap-1 font-semibold text-gray-400">
          <ImagePlus size={11} /> BEFORE (Reference)
        </span>
        <span className="inline-flex items-center gap-1 font-bold text-pink-300">
          <Sparkles size={11} className="text-pink-400" /> AFTER (Edited)
          {modelLabel && (
            <span className="rounded bg-pink-500/20 px-1.5 py-0.5 text-[9px]">{modelLabel}</span>
          )}
        </span>
        {onExpand && (
          <button
            type="button"
            onClick={handleExpand}
            className="inline-flex items-center gap-1 text-[10px] font-mono text-gray-400 hover:text-white bg-transparent border-0 cursor-pointer transition"
            title="Expand fullscreen"
          >
            <Maximize2 size={10} />
            Expand
          </button>
        )}
      </div>

      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="is-compare relative h-[300px] w-full select-none overflow-hidden rounded-b-xl border border-[#232332] bg-[#070709] touch-none sm:h-[400px]"
      >
        <img
          src={beforeSrc}
          alt="Reference before"
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain"
        />

        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <DevelopImage
            key={afterSrc}
            src={afterSrc}
            alt={alt}
            containerClassName="absolute inset-0"
            className="h-full w-full object-contain block"
            onClick={handleExpand}
          />
        </div>

        <div className="absolute inset-y-0" style={{ left: `${position}%` }}>
          <span className="absolute inset-y-0 -left-px w-px bg-white/80 shadow-[0_0_14px_rgba(255,45,135,0.85)]" />
          <span className="absolute inset-y-0 -left-[14px] w-[28px] cursor-ew-resize" />
          <button
            type="button"
            role="slider"
            aria-label="Before and after comparison"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(position)}
            tabIndex={0}
            onPointerDown={handlePointerDown}
            onKeyDown={handleKeyDown}
            className="is-compare-handle absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center rounded-full border border-white/30 bg-[#121218]/90 text-pink-200 shadow-[0_0_20px_rgba(255,45,135,0.45)] backdrop-blur-md transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/70"
          >
            <ChevronsLeftRight size={17} />
          </button>
        </div>

        <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-gray-300 backdrop-blur-md">
          DRAG SPLIT
        </span>
        <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-pink-200 backdrop-blur-md">
          {Math.round(position)}%
        </span>
      </div>
    </div>
  );
}
