import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

export function useSpotlight<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const frame = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const onPointerMove = useCallback((event: ReactPointerEvent<T>) => {
    const element = ref.current;
    if (!element) return;
    const { clientX, clientY } = event;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      element.style.setProperty('--spot-x', `${x}%`);
      element.style.setProperty('--spot-y', `${y}%`);
      element.style.setProperty('--tilt-y', `${(((x - 50) / 50) * 1.6).toFixed(2)}deg`);
      element.style.setProperty('--tilt-x', `${(((y - 50) / 50) * -1.6).toFixed(2)}deg`);
    });
  }, []);

  const onPointerLeave = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    element.style.setProperty('--tilt-x', '0deg');
    element.style.setProperty('--tilt-y', '0deg');
  }, []);

  return { ref, onPointerMove, onPointerLeave };
}
