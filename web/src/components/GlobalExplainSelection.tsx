import { useCallback, useEffect, useState } from 'react';
import { Wand2 } from 'lucide-react';
import type { FeynmanLocation } from './FeynmanPanel';
import { cn } from '@/lib/cn';

/*
 * Global text-selection → Explain pill for regions outside the article.
 *
 * Any element with `data-explainable` is opted-in: selecting text inside
 * it shows a floating pill anchored to the selection. An optional
 * `data-explain-location` attribute (JSON-encoded FeynmanLocation) lets a
 * marker override the live page location — useful for sidebar rows that
 * point at a different title/chapter than the one currently open.
 *
 * The article body uses its own selection handler in ChapterView (it
 * extracts a 400-char excerpt around the selection, which this handler
 * intentionally does not do). Article selections never trigger this
 * pill because the prose container has no `data-explainable` marker.
 */

type ExplainHandler = (
  concept: string,
  opts?: { excerpt?: string; location?: FeynmanLocation },
) => void;

interface SelectionState {
  text: string;
  location?: FeynmanLocation;
  x: number;
  y: number;
}

export function GlobalExplainSelection({ onExplain }: { onExplain: ExplainHandler }) {
  const [selection, setSelection] = useState<SelectionState | null>(null);

  const recompute = useCallback(() => {
    const sel = window.getSelection?.();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setSelection(null);
      return;
    }
    const anchor = sel.anchorNode;
    if (!anchor) {
      setSelection(null);
      return;
    }

    // Find the nearest ancestor marked [data-explainable].
    let node: Node | null = anchor;
    let host: HTMLElement | null = null;
    while (node) {
      if (node instanceof HTMLElement && node.dataset.explainable !== undefined) {
        host = node;
        break;
      }
      node = node.parentNode;
    }
    if (!host) {
      setSelection(null);
      return;
    }

    const text = sel.toString().trim();
    if (text.length < 2 || text.length > 280) {
      setSelection(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      setSelection(null);
      return;
    }

    let location: FeynmanLocation | undefined;
    const locAttr = host.dataset.explainLocation;
    if (locAttr) {
      try {
        location = JSON.parse(locAttr) as FeynmanLocation;
      } catch {
        // Ignore malformed JSON — fall through to live-page location.
      }
    }

    setSelection({
      text,
      location,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }, []);

  useEffect(() => {
    const onMouseUp = () => setTimeout(recompute, 0);
    const onSelectionChange = () => {
      const sel = window.getSelection?.();
      if (!sel || sel.isCollapsed) setSelection(null);
    };
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, [recompute]);

  if (!selection) return null;

  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onExplain(selection.text, { location: selection.location });
        window.getSelection?.()?.removeAllRanges();
        setSelection(null);
      }}
      style={{
        position: 'fixed',
        top: Math.max(8, selection.y - 38),
        left: selection.x,
        transform: 'translateX(-50%)',
      }}
      className={cn(
        'z-40 inline-flex items-center gap-1.5 rounded-full',
        'bg-accent text-accent-fg shadow-lg shadow-fg/20',
        'px-3 py-1.5 text-[12px] font-medium',
        'hover:brightness-110 transition',
      )}
    >
      <Wand2 size={12} strokeWidth={2} />
      Explain
    </button>
  );
}
