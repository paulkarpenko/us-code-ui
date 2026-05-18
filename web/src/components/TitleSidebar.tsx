import { ChevronRight } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { ScrollArea } from './ui/ScrollArea';
import { ResizeHandle } from './ui/ResizeHandle';
import { useResizable } from '@/lib/useResizable';
import type { CodeIndex, TitleMeta } from '@/lib/types';
import { cn } from '@/lib/cn';

export function TitleSidebar({ index }: { index: CodeIndex }) {
  const { titleSlug, chapterSlug } = useParams();
  const [filter, setFilter] = useState('');
  const f = filter.trim().toLowerCase();
  const { width, handleProps } = useResizable({
    storageKey: 'uscode:sidebar:width',
    defaultWidth: 320,
    min: 220,
    max: 560,
    side: 'right',
  });

  const filtered = useMemo(() => {
    if (!f) return index.titles;
    return index.titles
      .map((t) => {
        const headMatch =
          t.heading.toLowerCase().includes(f) || `title ${t.number}`.includes(f);
        const chs = t.chapters.filter(
          (c) =>
            c.heading.toLowerCase().includes(f) ||
            `chapter ${c.number}`.includes(f),
        );
        if (headMatch || chs.length > 0) {
          return { ...t, chapters: headMatch ? t.chapters : chs };
        }
        return null;
      })
      .filter((x): x is TitleMeta => x !== null);
  }, [index.titles, f]);

  return (
    <aside
      style={{ width }}
      className="relative flex h-full shrink-0 flex-col border-r border-border bg-surface"
    >
      <div className="px-3 pt-3 pb-2 border-b border-border">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter titles & chapters…"
          className={cn(
            'w-full bg-surface-2 rounded-md px-2.5 py-1.5',
            'text-[12.5px] placeholder:text-fg-subtle',
            'border border-transparent focus:border-border-strong focus:outline-none',
          )}
        />
      </div>
      <ScrollArea className="flex-1" viewportClassName="px-1 py-2">
        <nav className="space-y-0.5 min-w-max">
          {filtered.map((t) => (
            <TitleGroup
              key={t.slug}
              title={t}
              forceOpen={!!f}
              activeTitle={titleSlug}
              activeChapter={chapterSlug}
            />
          ))}
        </nav>
      </ScrollArea>
      <div className="px-3 py-2 border-t border-border text-[11px] text-fg-subtle whitespace-nowrap overflow-hidden text-ellipsis">
        {index.totals.titles} titles · {index.totals.chapters.toLocaleString()} chapters ·{' '}
        {index.totals.sections.toLocaleString()} §
      </div>
      <ResizeHandle side="right" handleProps={handleProps} />
    </aside>
  );
}

function TitleGroup({
  title,
  forceOpen,
  activeTitle,
  activeChapter,
}: {
  title: TitleMeta;
  forceOpen: boolean;
  activeTitle?: string;
  activeChapter?: string;
}) {
  const isActiveTitle = activeTitle === title.slug;
  const [openState, setOpen] = useState(isActiveTitle);
  const open = forceOpen || openState || isActiveTitle;

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left',
          'hover:bg-surface-2',
          isActiveTitle && 'bg-surface-2',
        )}
      >
        <ChevronRight
          size={12}
          strokeWidth={2}
          className={cn(
            'text-fg-subtle transition-transform shrink-0',
            open && 'rotate-90',
          )}
        />
        <span className="font-mono text-[11px] text-fg-subtle w-6 shrink-0 tabular-nums">
          {title.number}
        </span>
        <span className="text-[12.5px] text-fg-muted group-hover:text-fg whitespace-nowrap pr-2">
          {toTitleCase(title.heading)}
        </span>
      </button>
      {open && (
        <ul className="ml-[1.65rem] mt-0.5 mb-2 border-l border-border pl-1 space-y-px">
          {title.chapters.map((c) => {
            const active = isActiveTitle && activeChapter === c.slug;
            return (
              <li key={c.slug}>
                <Link
                  to={`/title/${title.slug}/${c.slug}`}
                  className={cn(
                    'flex items-baseline gap-2 rounded-md px-2 py-1 text-[12.5px]',
                    'text-fg-muted hover:text-fg hover:bg-surface-2',
                    active && 'bg-accent-soft text-fg',
                  )}
                >
                  <span className="font-mono text-[10.5px] text-fg-subtle w-7 shrink-0 tabular-nums">
                    {c.number}
                  </span>
                  <span className="whitespace-nowrap pr-2">{toTitleCase(c.heading)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function toTitleCase(s: string): string {
  if (!s) return '';
  // Statutory headings are SHOUTED — soften without losing all-caps acronyms.
  if (s === s.toUpperCase()) {
    return s
      .toLowerCase()
      .replace(/\b([a-z])([a-z]*)/g, (_, a, b) => a.toUpperCase() + b)
      .replace(/\b(And|Of|The|To|For|In|On|A|An|Or|By|With)\b/g, (m) => m.toLowerCase());
  }
  return s;
}
