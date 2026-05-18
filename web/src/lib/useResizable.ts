import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * Width state for a horizontally-resizable panel.
 *
 *   - persists to localStorage so widths survive reloads
 *   - clamps to [min, max]
 *   - uses pointer capture so dragging works even if the cursor leaves
 *     the handle while moving fast
 *   - exposes a `reset()` for double-click-to-default behaviour
 */
export interface ResizableOpts {
  storageKey: string;
  defaultWidth: number;
  min?: number;
  max?: number;
  /** Which edge of the panel the handle sits on; affects drag direction sign. */
  side: 'left' | 'right';
}

export function useResizable({
  storageKey,
  defaultWidth,
  min = 180,
  max = 720,
  side,
}: ResizableOpts) {
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return defaultWidth;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const n = parseInt(stored, 10);
        if (Number.isFinite(n) && n >= min && n <= max) return n;
      }
    } catch {}
    return defaultWidth;
  });

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, String(width)); } catch {}
  }, [storageKey, width]);

  // Drag state stays in a ref so move/up handlers don't reallocate per-render.
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      dragRef.current = { startX: e.clientX, startW: width };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [width],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const sign = side === 'right' ? 1 : -1;
      const next = Math.min(max, Math.max(min, dragRef.current.startW + sign * dx));
      setWidth(next);
    },
    [min, max, side],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    dragRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const reset = useCallback(() => setWidth(defaultWidth), [defaultWidth]);

  return {
    width,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onDoubleClick: reset,
    },
  };
}
