import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { SectionLink } from './SectionLink';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, ExternalLink, Sparkles, Wand2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { ChapterDoc, CodeIndex } from '@/lib/types';
import { ScrollArea } from './ui/ScrollArea';
import { ResizeHandle } from './ui/ResizeHandle';
import { useResizable } from '@/lib/useResizable';
import { cn } from '@/lib/cn';

export function ChapterView({
  index,
  onExplain,
}: {
  index: CodeIndex;
  onExplain: (concept: string, excerpt?: string) => void;
}) {
  const { titleSlug, chapterSlug } = useParams();
  const [doc, setDoc] = useState<ChapterDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const [selection, setSelection] = useState<{
    text: string;
    excerpt?: string;
    x: number;
    y: number;
  } | null>(null);

  const title = index.titles.find((t) => t.slug === titleSlug);
  const chapter = title?.chapters.find((c) => c.slug === chapterSlug);

  useEffect(() => {
    if (!titleSlug || !chapterSlug) return;
    setDoc(null);
    setError(null);
    setLoading(true);
    setActiveSection(null);
    let cancelled = false;
    (async () => {
      try {
        const d = await api.chapter(titleSlug, chapterSlug);
        if (!cancelled) setDoc(d);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [titleSlug, chapterSlug]);

  // Scroll viewport to top on chapter change.
  useEffect(() => {
    viewportRef.current?.scrollTo({ top: 0 });
  }, [titleSlug, chapterSlug]);

  // Observe section headings for a current-section indicator in the rail.
  useEffect(() => {
    if (!doc || !viewportRef.current) return;
    const root = viewportRef.current;
    const headings = Array.from(
      root.querySelectorAll<HTMLAnchorElement>('a.section-anchor'),
    );
    if (headings.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { root, rootMargin: '-20% 0px -70% 0px', threshold: 0 },
    );
    headings.forEach((h) => obs.observe(h));
    return () => obs.disconnect();
  }, [doc]);

  // Promote `<a id="section-XXX"></a>` placeholders into in-flow anchors.
  // The markdown puts them on their own line, separate from the heading,
  // so a wrapping `<span>` is fine and won't break paragraph nesting.
  const processed = useMemo(() => {
    if (!doc) return '';
    return doc.content.replace(
      /<a id="(section-[\w\-.]+)"><\/a>/g,
      '<span class="section-anchor" id="$1"></span>',
    );
  }, [doc]);

  const handleSelection = useCallback(() => {
    const sel = window.getSelection?.();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setSelection(null);
      return;
    }
    const text = sel.toString().trim();
    if (text.length < 3 || text.length > 280) {
      setSelection(null);
      return;
    }
    // Only show pill when the selection lives within our article.
    if (!articleRef.current || !articleRef.current.contains(sel.anchorNode)) {
      setSelection(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return;
    const fullText = doc?.content ?? '';
    const idx = fullText.indexOf(text);
    const excerpt =
      idx >= 0
        ? fullText.slice(
            Math.max(0, idx - 400),
            Math.min(fullText.length, idx + text.length + 400),
          )
        : undefined;
    setSelection({
      text,
      excerpt,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }, [doc]);

  useEffect(() => {
    const onMouseUp = () => setTimeout(handleSelection, 0);
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
  }, [handleSelection]);

  if (!titleSlug || !chapterSlug) {
    return <EmptyState />;
  }

  return (
    <div className="flex h-full min-w-0 flex-1">
      <ScrollArea
        className="flex-1"
        viewportRef={viewportRef}
        viewportClassName="px-10 py-8 lg:px-16 xl:px-20"
      >
        <article className="mx-auto max-w-[72ch]">
          <header className="mb-6 pb-4 border-b border-border">
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-1 text-[12px] text-fg-subtle mb-1.5"
            >
              <Link to="/" className="hover:text-fg-muted">All titles</Link>
              <ChevronRight size={11} strokeWidth={2.5} />
              {title && (
                <>
                  <Link
                    to={`/title/${title.slug}`}
                    className="hover:text-fg-muted truncate"
                  >
                    Title {title.number} · {smallCaps(title.heading)}
                  </Link>
                  <ChevronRight size={11} strokeWidth={2.5} />
                </>
              )}
              <span className="text-fg-muted">Chapter {chapter?.number}</span>
            </nav>
            <h1 className="text-[22px] font-semibold tracking-tight text-fg">
              {chapter ? smallCaps(chapter.heading) : '…'}
            </h1>
            {(() => {
              const src = doc?.frontmatter.source;
              if (typeof src !== 'string') return null;
              return (
                <a
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-fg-subtle hover:text-link"
                >
                  Source on uscode.house.gov <ExternalLink size={11} />
                </a>
              );
            })()}
          </header>

          {loading && <SkeletonBody />}
          {error && (
            <div className="rounded-md border border-border bg-surface-2 p-4 text-[13px] text-fg-muted">
              Couldn't load this chapter: {error}
            </div>
          )}
          {doc && (
            <div ref={articleRef as React.RefObject<HTMLDivElement>} className="prose-statute">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  // Every <a> in chapter prose flows through SectionLink, which
                  // distinguishes internal section routes (HoverCard preview +
                  // router navigation) from external uscode.house.gov fallbacks.
                  a: SectionLink,
                }}
              >
                {processed}
              </ReactMarkdown>
            </div>
          )}
        </article>
      </ScrollArea>

      {doc && doc.sections.length > 0 && (
        <SectionRail sections={doc.sections} active={activeSection} />
      )}

      {selection && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onExplain(selection.text, selection.excerpt);
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
      )}
    </div>
  );
}

function SectionRail({
  sections,
  active,
}: {
  sections: { id: string; number: string; heading: string }[];
  active: string | null;
}) {
  const { width, handleProps } = useResizable({
    storageKey: 'uscode:sectionrail:width',
    defaultWidth: 260,
    min: 180,
    max: 480,
    side: 'left',
  });
  return (
    <aside
      style={{ width }}
      className="relative hidden xl:flex shrink-0 flex-col border-l border-border bg-surface"
    >
      <ResizeHandle side="left" handleProps={handleProps} />
      <div className="px-4 pt-5 pb-2 text-[10.5px] uppercase tracking-wider text-fg-subtle">
        Sections
      </div>
      <ScrollArea className="flex-1" viewportClassName="px-2 pb-4">
        <ol className="space-y-px min-w-max">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className={cn(
                  'flex items-baseline gap-2 rounded px-2 py-1 text-[12px]',
                  active === s.id
                    ? 'text-fg bg-accent-soft'
                    : 'text-fg-muted hover:text-fg hover:bg-surface-2',
                )}
              >
                <span className="font-mono text-[10.5px] text-fg-subtle tabular-nums w-9 shrink-0">
                  § {s.number}
                </span>
                <span className="whitespace-nowrap pr-2">{s.heading || '—'}</span>
              </a>
            </li>
          ))}
        </ol>
      </ScrollArea>
    </aside>
  );
}

function SkeletonBody() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 w-2/3 bg-surface-2 rounded" />
      <div className="h-3 w-full bg-surface-2 rounded" />
      <div className="h-3 w-11/12 bg-surface-2 rounded" />
      <div className="h-3 w-10/12 bg-surface-2 rounded" />
      <div className="h-4 w-1/2 bg-surface-2 rounded mt-6" />
      <div className="h-3 w-full bg-surface-2 rounded" />
      <div className="h-3 w-11/12 bg-surface-2 rounded" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-1 items-center justify-center text-center px-8">
      <div className="max-w-md space-y-3">
        <Sparkles className="mx-auto text-fg-subtle" size={28} strokeWidth={1.5} />
        <h2 className="text-[15px] font-medium text-fg">Pick a chapter to start reading</h2>
        <p className="text-[13px] text-fg-muted leading-relaxed">
          Browse titles in the left rail, or hit{' '}
          <kbd className="text-[11px] border border-border bg-surface px-1.5 py-0.5 rounded font-mono">
            ⌘K
          </kbd>{' '}
          to jump to one. Select any word or phrase inside a chapter and the right-hand panel
          will explain it in plain English.
        </p>
      </div>
    </div>
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

