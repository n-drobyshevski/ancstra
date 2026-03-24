// apps/web/components/research/item-detail/use-resize-handle.ts
'use client';

import { useCallback, useRef, useState } from 'react';

const MIN_HEIGHT = 128;

interface UseResizeHandleOptions {
  /** Initial height in pixels. Default 320. */
  initialHeight?: number;
  /** Minimum height in pixels. Default 128. */
  minHeight?: number;
}

export function useResizeHandle(options: UseResizeHandleOptions = {}) {
  const { initialHeight = 320, minHeight = MIN_HEIGHT } = options;
  const [height, setHeight] = useState(initialHeight);
  const heightRef = useRef(initialHeight);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      startY.current = e.clientY;
      startHeight.current = heightRef.current;
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const onPointerMove = (ev: PointerEvent) => {
        const delta = ev.clientY - startY.current;
        const newH = Math.max(minHeight, startHeight.current + delta);
        heightRef.current = newH;
        setHeight(newH);
      };

      const onPointerUp = () => {
        target.removeEventListener('pointermove', onPointerMove);
        target.removeEventListener('pointerup', onPointerUp);
      };

      target.addEventListener('pointermove', onPointerMove);
      target.addEventListener('pointerup', onPointerUp);
    },
    [minHeight],
  );

  return { height, onPointerDown };
}
