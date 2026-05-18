import * as HoverCard from '@radix-ui/react-hover-card';
import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, BookOpen } from 'lucide-react';
import { cn } from '@/lib/cn';

/*
 * Rendered in place of every `<a>` inside chapter markdown.
 *
 * Three cases:
 *   1. Internal route (href starts with `/title/...`) — render a router
 *      <Link> wrapped in a Radix HoverCard. On first hover we fetch a
 *      preview of the target section and cache the result.
 *   2. External href to uscode.house.gov — render a plain anchor with
 *      a small external-link glyph (these are unresolved fallbacks).
 *   3. Anything else (e.g. footnote refs) — render an unstyled anchor.
 */

interface Preview {
  heading: string;
  snippet: string;
  titleSlug: string;
  chapterSlug: string;
  sectionNumber: string;
}

// Module-level cache — once we fetch a given section preview, every link
// to it across every chapter the user opens benefits.
const previewCache = new Map<string, Promise<Preview | null>>();

/*
 * Internal hrefs look like `/title/<titleSlug>/<chapterSlug>#section-<n>`.
 * Pull the title number out of the title slug and the section number from
 * the hash so we can hit /api/section/:title/:section.
 */
function parseInternalHref(
  href: string,
): { titleNumber: string; sectionNumber: string; toRoute: string } | null {
  const m = href.match(/^\/title\/title-(\d+[a-z]?)-[^/]+\/([^#]+)#section-([\w-]+)$/i);
  if (!m) return null;
  return {
    titleNumber: m[1],
    sectionNumber: m[3],
    toRoute: href,
  };
}

function fetchPreview(titleNumber: string, sectionNumber: string): Promise<Preview | null> {
  const key = `${titleNumber}:${sectionNumber}`;
  const hit = previewCache.get(key);
  if (hit) return hit;
  const p = (async () => {
    try {
      const res = await fetch(`/api/section/${titleNumber}/${sectionNumber}`);
      if (!res.ok) return null;
      return (await res.json()) as Preview;
    } catch {
      return null;
    }
  })();
  previewCache.set(key, p);
  return p;
}

export function SectionLink({
  href,
  children,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (!href) return <a {...rest}>{children}</a>;

  // External — leave as-is, add a subtle external indicator.
  if (/^https?:\/\//.test(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-link hover:text-link"
        {...rest}
      >
        {children}
        <ExternalLink
          size={10}
          strokeWidth={2}
          className="inline-block ml-0.5 -mt-0.5 opacity-60"
        />
      </a>
    );
  }

  // Section route — wrap in HoverCard.
  const parsed = parseInternalHref(href);
  if (parsed) {
    return <InternalSectionLink parsed={parsed}>{children}</InternalSectionLink>;
  }

  // Other (mailto, in-page anchors etc.)
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

function InternalSectionLink({
  parsed,
  children,
}: {
  parsed: { titleNumber: string; sectionNumber: string; toRoute: string };
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null | 'loading'>(null);

  const onOpen = useCallback(() => {
    if (preview !== null && preview !== 'loading') return;
    setPreview('loading');
    fetchPreview(parsed.titleNumber, parsed.sectionNumber).then((p) => {
      setPreview(p);
    });
  }, [parsed.titleNumber, parsed.sectionNumber, preview]);

  return (
    <HoverCard.Root
      openDelay={200}
      closeDelay={100}
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) onOpen();
      }}
    >
      <HoverCard.Trigger asChild>
        <Link
          to={parsed.toRoute}
          className={cn(
            'text-link underline decoration-link/30 hover:decoration-link',
            'underline-offset-2 transition-colors',
          )}
        >
          {children}
        </Link>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            'z-50 w-[360px] rounded-lg border border-border bg-surface',
            'shadow-xl shadow-fg/10 p-3.5',
          )}
        >
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-fg-subtle">
            <BookOpen size={10} />
            {preview && preview !== 'loading'
              ? `Title ${parsed.titleNumber} · § ${preview.sectionNumber}`
              : `Title ${parsed.titleNumber} · § ${parsed.sectionNumber}`}
          </div>
          {preview === 'loading' && (
            <div className="mt-1 text-[12.5px] text-fg-subtle">Loading…</div>
          )}
          {preview === null && (
            <div className="mt-1 text-[12.5px] text-fg-subtle">
              No preview available.
            </div>
          )}
          {preview && preview !== 'loading' && (
            <>
              <div className="mt-0.5 text-[13.5px] font-medium text-fg leading-snug">
                {preview.heading}
              </div>
              <p className="mt-1.5 text-[12.5px] text-fg-muted leading-relaxed line-clamp-6">
                {preview.snippet}
              </p>
              <div className="mt-2.5 pt-2 border-t border-border text-[11px] text-fg-subtle">
                Click to open ·{' '}
                <span className="font-mono">return to top after navigation</span>
              </div>
            </>
          )}
          <HoverCard.Arrow className="fill-surface" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
