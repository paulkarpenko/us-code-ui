import * as Dialog from '@radix-ui/react-dialog';
import { Search, Hash } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import type { SearchHit } from '@/lib/types';
import { cn } from '@/lib/cn';

export function SearchPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQ('');
      setResults([]);
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const r = await api.search(q.trim());
        if (!cancelled) {
          setResults(r.results);
          setActive(0);
        }
      } catch {
        if (!cancelled) setResults([]);
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [q]);

  const go = (hit: SearchHit) => {
    onOpenChange(false);
    navigate(`/title/${hit.titleSlug}/${hit.chapterSlug}`);
  };

  const list = useMemo(() => results, [results]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-fg/15 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-[15vh] z-50 w-[min(640px,92vw)] -translate-x-1/2',
            'rounded-xl border border-border bg-surface shadow-2xl overflow-hidden',
          )}
        >
          <Dialog.Title className="sr-only">Search the U.S. Code</Dialog.Title>
          <Dialog.Description className="sr-only">
            Find a title or chapter by name or number.
          </Dialog.Description>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Search size={16} className="text-fg-subtle shrink-0" strokeWidth={1.75} />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((i) => Math.min(list.length - 1, i + 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((i) => Math.max(0, i - 1));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (list[active]) go(list[active]);
                }
              }}
              placeholder="Search titles and chapters…"
              className="flex-1 bg-transparent text-[14px] placeholder:text-fg-subtle focus:outline-none"
            />
            <kbd className="text-[11px] text-fg-subtle border border-border rounded px-1.5 py-0.5 font-mono">
              esc
            </kbd>
          </div>

          <div className="max-h-[50vh] overflow-y-auto py-1">
            {q.trim().length < 2 && (
              <div className="px-4 py-6 text-[13px] text-fg-subtle">
                Start typing — e.g. <span className="text-fg-muted">“firearms”</span> or{' '}
                <span className="text-fg-muted">“title 26”</span>.
              </div>
            )}
            {q.trim().length >= 2 && list.length === 0 && (
              <div className="px-4 py-6 text-[13px] text-fg-subtle">No matches.</div>
            )}
            {list.map((hit, i) => (
              <button
                key={`${hit.titleSlug}/${hit.chapterSlug}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(hit)}
                className={cn(
                  'w-full flex items-baseline gap-3 px-4 py-2 text-left',
                  i === active ? 'bg-accent-soft' : 'hover:bg-surface-2',
                )}
              >
                <Hash size={12} className="text-fg-subtle translate-y-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-fg truncate">
                    <span className="text-fg-muted font-mono mr-1.5">
                      {hit.titleNumber}·{hit.chapterNumber}
                    </span>
                    {hit.chapterHeading}
                  </div>
                  <div className="text-[11.5px] text-fg-subtle truncate">
                    Title {hit.titleNumber} · {hit.titleHeading}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
