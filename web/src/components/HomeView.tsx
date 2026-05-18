import { Link } from 'react-router-dom';
import { BookOpen, GitCommit, Lightbulb, Search } from 'lucide-react';
import { ScrollArea } from './ui/ScrollArea';
import { Tooltip } from './ui/Tooltip';
import type { CodeIndex } from '@/lib/types';
import { cn } from '@/lib/cn';

/*
 * Default landing view — an at-a-glance "shape of federal law":
 * - top-level callouts (what this is, how to navigate)
 * - 53 titles on a grid sized by chapter count (so the user sees that
 *   Title 26 / Title 42 / Title 18 are the heavyweights without having
 *   to click into them)
 */

export function HomeView({
  index,
  onOpenSearch,
}: {
  index: CodeIndex;
  onOpenSearch: () => void;
}) {
  const maxChapters = Math.max(...index.titles.map((t) => t.chapters.length));

  return (
    <ScrollArea className="flex-1" viewportClassName="px-10 py-8 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <div className="text-[11px] uppercase tracking-wider text-fg-subtle">
            United States Code
          </div>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-fg">
            The shape of federal law, at a glance.
          </h1>
          <p className="mt-3 max-w-2xl text-[14px] text-fg-muted leading-relaxed">
            {index.totals.titles} titles, {index.totals.chapters.toLocaleString()} chapters,{' '}
            {index.totals.sections.toLocaleString()} sections — sourced from the Office of the
            Law Revision Counsel and rendered for reading. Pick a title below, search by topic,
            or select any phrase to get a plain-English explanation.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <Tip
            icon={<Search size={14} />}
            title="Jump anywhere"
            body={
              <>
                Press <Kbd>⌘</Kbd>
                <Kbd>K</Kbd> to search titles & chapters.
              </>
            }
          />
          <Tip
            icon={<BookOpen size={14} />}
            title="Read like a book"
            body="Section rail on the right keeps you oriented inside long chapters."
          />
          <Tip
            icon={<Lightbulb size={14} />}
            title="Explain anything"
            body="Select any phrase to get a plain-English explanation, grounded in context."
          />
        </div>

        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-fg">Titles</h2>
          <button
            onClick={onOpenSearch}
            className="text-[12px] text-fg-muted hover:text-fg"
          >
            Or use search →
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {index.titles.map((t) => {
            const weight = t.chapters.length / maxChapters;
            return (
              <Link
                key={t.slug}
                to={`/title/${t.slug}`}
                className={cn(
                  'group block rounded-lg border border-border bg-surface',
                  'p-3 hover:border-border-strong hover:shadow-sm transition',
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[11px] text-fg-subtle">
                    Title {t.number}
                  </span>
                  <Tooltip
                    side="top"
                    align="end"
                    content={
                      <SizeTooltipContent
                        chapters={t.chapters.length}
                        sections={t.totalSections}
                        weight={weight}
                      />
                    }
                  >
                    <span className="text-[10.5px] text-fg-muted underline decoration-dotted decoration-fg-subtle underline-offset-2 cursor-help">
                      {t.chapters.length} ch
                    </span>
                  </Tooltip>
                </div>
                <div className="mt-1 text-[12.5px] text-fg group-hover:text-fg leading-snug line-clamp-2 min-h-[2.6em]">
                  {smallCaps(t.heading)}
                </div>
              </Link>
            );
          })}
        </div>

        <footer className="mt-10 pt-5 border-t border-border text-[11.5px] text-fg-subtle flex items-center gap-2">
          <GitCommit size={12} />
          Index built {new Date(index.generatedAt).toLocaleString()}
        </footer>
      </div>
    </ScrollArea>
  );
}

function SizeTooltipContent({
  chapters,
  sections,
  weight,
}: {
  chapters: number;
  sections: number;
  weight: number;
}) {
  const tier =
    weight >= 0.8
      ? {
          label: 'Among the largest titles',
          implication: 'sprawling scope — expect dense cross-references and long chapters.',
        }
      : weight >= 0.5
        ? {
            label: 'Substantial title',
            implication: 'broad scope across many topics.',
          }
        : weight >= 0.2
          ? {
              label: 'Mid-sized title',
              implication: 'moderate breadth; navigable in a sitting.',
            }
          : {
              label: 'Among the slimmest titles',
              implication: 'narrow scope — quick to skim end-to-end.',
            };
  const pct = Math.round(weight * 100);
  return (
    <div className="max-w-[240px] leading-snug">
      <div className="font-medium">
        {chapters.toLocaleString()} chapters · {sections.toLocaleString()} sections
      </div>
      <div className="mt-1 opacity-80">
        {tier.label} ({pct}% of the largest by chapter count) — {tier.implication}
      </div>
    </div>
  );
}

function Tip({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-fg-muted">
        <span className="text-accent">{icon}</span>
        <span className="text-[12px] font-medium text-fg">{title}</span>
      </div>
      <div className="mt-1 text-[12px] text-fg-muted leading-snug">{body}</div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-block min-w-[16px] text-center border border-border bg-surface-2 px-1 py-0.5 rounded font-mono text-[10.5px] text-fg-muted mr-0.5">
      {children}
    </kbd>
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
