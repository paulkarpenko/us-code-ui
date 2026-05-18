import { Link, useParams } from 'react-router-dom';
import { ChevronRight, ShieldCheck, Wand2 } from 'lucide-react';
import { ScrollArea } from './ui/ScrollArea';
import type { CodeIndex } from '@/lib/types';
import type { FeynmanLocation } from './FeynmanPanel';
import { cn } from '@/lib/cn';

export function TitleOverview({
  index,
  onExplain,
}: {
  index: CodeIndex;
  onExplain: (
    concept: string,
    opts?: { excerpt?: string; location?: FeynmanLocation },
  ) => void;
}) {
  const { titleSlug } = useParams();
  const title = index.titles.find((t) => t.slug === titleSlug);

  if (!title) {
    return (
      <div className="flex flex-1 items-center justify-center text-fg-subtle">
        Title not found.
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1" viewportClassName="px-10 py-8 lg:px-16">
      <div className="mx-auto max-w-3xl">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-[12px] text-fg-subtle mb-2"
        >
          <Link to="/" className="hover:text-fg-muted">All titles</Link>
          <ChevronRight size={11} strokeWidth={2.5} />
          <span className="text-fg-muted">Title {title.number}</span>
        </nav>
        <div
          className="group/h1 flex items-baseline gap-2 flex-wrap"
          data-explainable="true"
        >
          <h1 className="text-[24px] font-semibold tracking-tight text-fg">
            Title {title.number}. {smallCaps(title.heading)}
          </h1>
          <button
            type="button"
            onClick={() =>
              onExplain(`Title ${title.number} — ${smallCaps(title.heading)}`, {
                location: {
                  titleSlug: title.slug,
                  titleNumber: title.number,
                  titleHeading: title.heading,
                },
              })
            }
            aria-label="Explain this title"
            className={cn(
              'opacity-0 group-hover/h1:opacity-100 focus:opacity-100',
              'inline-flex items-center gap-1 rounded-md border border-border bg-surface-2/60',
              'px-1.5 py-0.5 text-[11px] text-fg-subtle',
              'hover:text-link hover:border-border-strong transition',
            )}
          >
            <Wand2 size={11} strokeWidth={2} /> Explain
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3 text-[12.5px] text-fg-muted">
          <span>{title.chapters.length} chapters</span>
          <span className="text-fg-subtle">·</span>
          <span>{title.totalSections.toLocaleString()} sections</span>
          {title.positiveLaw && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-fg"
              title="Enacted as positive law (the text of this title *is* the law, not merely evidence of it)"
            >
              <ShieldCheck size={11} className="text-accent" />
              Positive law
            </span>
          )}
        </div>

        <hr className="my-6 border-border" />

        <h2 className="text-[12px] uppercase tracking-wider text-fg-subtle mb-2">Chapters</h2>
        <ol className="space-y-px">
          {title.chapters.map((c) => (
            <li key={c.slug}>
              <Link
                to={`/title/${title.slug}/${c.slug}`}
                className={cn(
                  'group flex items-baseline gap-3 rounded-md px-2 py-2 -mx-2',
                  'hover:bg-surface-2',
                )}
              >
                <span className="font-mono text-[11px] text-fg-subtle tabular-nums w-8 shrink-0">
                  {c.number}
                </span>
                <span className="flex-1 text-[13.5px] text-fg-muted group-hover:text-fg leading-snug">
                  {smallCaps(c.heading)}
                </span>
                <span className="text-[11px] text-fg-subtle shrink-0">
                  {c.sectionCount} §
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </ScrollArea>
  );
}

function smallCaps(s: string): string {
  if (!s) return '';
  if (s === s.toUpperCase()) {
    return s
      .toLowerCase()
      .replace(/\b([a-z])([a-z]*)/g, (_, a, b) => a.toUpperCase() + b)
      .replace(/\b(And|Of|The|To|For|In|On|A|An|Or|By|With)\b/g, (m) => m.toLowerCase());
  }
  return s;
}
