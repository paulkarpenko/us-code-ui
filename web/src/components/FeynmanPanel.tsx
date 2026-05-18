import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Lightbulb, Send, X, History, Sparkles, BookOpen, KeyRound } from 'lucide-react';
import { streamFeynman } from '@/lib/api';
import { ScrollArea } from './ui/ScrollArea';
import { ResizeHandle } from './ui/ResizeHandle';
import { useResizable } from '@/lib/useResizable';
import { cn } from '@/lib/cn';

/*
 * The Feynman panel.
 *
 * It accepts a "concept" (a word, a phrase, the user's own question) and
 * streams a Feynman-method-style explanation grounded in the chapter the
 * user is currently reading. The four-part Feynman scaffold is enforced
 * server-side in the system prompt.
 *
 * Local history is kept in memory only (not persisted) — we want this to feel
 * like a calculator, not a chat log.
 */

export interface FeynmanRequest {
  concept: string;
  excerpt?: string;
}

/*
 * Current reading location. The panel is rendered outside <Routes>, so the
 * parent resolves the active title/chapter and hands it down. `null` when
 * the user is on the home or another non-chapter page.
 */
export interface FeynmanLocation {
  titleSlug: string;
  titleNumber: string;
  titleHeading: string;
  chapterSlug?: string;
  chapterNumber?: string;
  chapterHeading?: string;
}

interface HistoryEntry {
  concept: string;
  excerpt?: string;
  body: string;
  error?: string;
  ts: number;
  // Location captured when the question was asked, so re-opening from history
  // doesn't get re-anchored to whatever the user is currently reading.
  location: FeynmanLocation | null;
}

interface Props {
  location: FeynmanLocation | null;
  /** Whether the server has ANTHROPIC_API_KEY configured. When false the panel
   *  swaps the input form for a setup hint instead of failing on submit. */
  hasApiKey: boolean;
  request: FeynmanRequest | null;
  /** Bump to re-trigger the same request (parent toggles a counter). */
  requestKey: number;
  onCollapse: () => void;
}

export function FeynmanPanel({ location, hasApiKey, request, requestKey, onCollapse }: Props) {
  const { width, handleProps } = useResizable({
    storageKey: 'uscode:feynman:width',
    defaultWidth: 400,
    min: 280,
    max: 720,
    side: 'left',
  });
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [current, setCurrent] = useState<HistoryEntry | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const abortRef = useRef<(() => void) | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // Keep the freshest location in a ref so `ask` (used by effects) always
  // sees the *current* page even when the request comes from a stale closure.
  const locationRef = useRef(location);
  useEffect(() => { locationRef.current = location; }, [location]);

  // Auto-scroll while streaming.
  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [current?.body]);

  const ask = (concept: string, excerpt?: string) => {
    const trimmed = concept.trim();
    if (!trimmed) return;
    // Cancel any in-flight stream.
    abortRef.current?.();
    if (current && current.body) {
      setHistory((h) => [current, ...h].slice(0, 12));
    }
    const loc = locationRef.current;
    const entry: HistoryEntry = {
      concept: trimmed,
      excerpt,
      body: '',
      ts: Date.now(),
      location: loc,
    };
    setCurrent(entry);
    setStreaming(true);
    abortRef.current = streamFeynman({
      concept: trimmed,
      context: {
        titleNumber: loc?.titleNumber,
        titleHeading: loc?.titleHeading,
        chapterNumber: loc?.chapterNumber,
        chapterHeading: loc?.chapterHeading,
        excerpt,
      },
      onDelta: (text) => {
        setCurrent((c) => (c ? { ...c, body: c.body + text } : c));
      },
      onDone: () => setStreaming(false),
      onError: (err) => {
        setCurrent((c) => (c ? { ...c, error: err } : c));
        setStreaming(false);
      },
    });
  };

  // Externally triggered requests (from text selection in the article).
  useEffect(() => {
    if (request && request.concept) {
      ask(request.concept, request.excerpt);
      setInput(request.concept);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  return (
    <aside
      style={{ width }}
      className="relative flex h-full shrink-0 flex-col border-l border-border bg-surface"
    >
      <ResizeHandle side="left" handleProps={handleProps} />
      <header className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Lightbulb size={14} className="text-accent" strokeWidth={2} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-fg leading-tight">Explain</div>
          <div className="text-[11px] text-fg-subtle leading-tight">
            Ask for a plain-English explanation
          </div>
        </div>
        <button
          onClick={onCollapse}
          aria-label="Hide explain panel"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle hover:text-fg hover:bg-surface-2"
        >
          <X size={14} />
        </button>
      </header>

      {/*
       * Persistent "what's attached" chip — answers the user's first question
       * before they ask: yes, the panel knows what you're reading and any
       * lookup will use it as context.
       */}
      <ContextChip location={location} />

      <ScrollArea className="flex-1" viewportRef={bodyRef as React.RefObject<HTMLDivElement>}>
        <div className="px-4 py-4 space-y-5">
          {!hasApiKey && <MissingKeyCard />}
          {hasApiKey && !current && history.length === 0 && <EmptyHelper location={location} />}

          {hasApiKey && current && (
            <ResponseCard
              entry={current}
              streaming={streaming}
            />
          )}

          {history.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-fg-subtle mb-2">
                <History size={11} /> Earlier in this session
              </div>
              <div className="space-y-3">
                {history.map((h) => (
                  <button
                    key={h.ts}
                    onClick={() => {
                      setCurrent(h);
                      setHistory((xs) => xs.filter((x) => x.ts !== h.ts));
                    }}
                    className="block w-full text-left rounded-md border border-border bg-surface-2/60 p-2.5 hover:border-border-strong"
                  >
                    <div className="text-[12px] text-fg-muted truncate">{h.concept}</div>
                    <div className="text-[11px] text-fg-subtle truncate mt-0.5">
                      {h.body.replace(/[#*>\n]/g, ' ').slice(0, 90)}…
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {hasApiKey && <form
        className="border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || streaming) return;
          ask(input);
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (input.trim() && !streaming) ask(input);
              }
            }}
            rows={2}
            placeholder={
              location?.chapterNumber
                ? `Ask about what you're reading…`
                : 'Ask about any U.S. Code concept…'
            }
            className={cn(
              'flex-1 resize-none rounded-md bg-surface-2 px-2.5 py-2',
              'text-[12.5px] placeholder:text-fg-subtle',
              'border border-transparent focus:border-border-strong focus:outline-none',
            )}
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-md',
              'bg-accent text-accent-fg hover:brightness-110 disabled:opacity-40',
              'transition-all',
            )}
            aria-label="Send"
          >
            <Send size={14} strokeWidth={2} />
          </button>
        </div>
        <div className="mt-1.5 text-[10.5px] text-fg-subtle">
          ⌘↵ to send · Select text in the article for instant lookup
        </div>
      </form>}
    </aside>
  );
}

function MissingKeyCard() {
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-4">
      <div className="flex items-center gap-2 text-fg">
        <KeyRound size={14} className="text-accent" strokeWidth={2} />
        <div className="text-[13px] font-medium">Add an Anthropic API key</div>
      </div>
      <p className="mt-2 text-[12.5px] text-fg-muted leading-relaxed">
        Plain-English explanations are powered by Claude. To enable them, set{' '}
        <code className="font-mono text-[11.5px] bg-surface px-1 py-0.5 rounded border border-border">
          ANTHROPIC_API_KEY
        </code>{' '}
        on the server and restart it.
      </p>
      <ol className="mt-3 space-y-1.5 text-[12px] text-fg-muted list-decimal pl-4">
        <li>
          Get a key from{' '}
          <a
            href="https://console.anthropic.com/"
            target="_blank"
            rel="noreferrer"
            className="text-link underline decoration-link/30 hover:decoration-link underline-offset-2"
          >
            console.anthropic.com
          </a>
          .
        </li>
        <li>
          Add it to{' '}
          <code className="font-mono text-[11.5px] bg-surface px-1 py-0.5 rounded border border-border">
            web/.env
          </code>
          :
          <pre className="mt-1.5 font-mono text-[11.5px] bg-surface border border-border rounded p-2 text-fg overflow-x-auto">
ANTHROPIC_API_KEY=sk-ant-…</pre>
        </li>
        <li>
          Restart the dev server (
          <code className="font-mono text-[11.5px] bg-surface px-1 py-0.5 rounded border border-border">
            pnpm dev
          </code>
          ).
        </li>
      </ol>
      <p className="mt-3 text-[11px] text-fg-subtle">
        Everything else — browsing, search, cross-reference previews — works without a key.
      </p>
    </div>
  );
}

function ContextChip({ location }: { location: FeynmanLocation | null }) {
  if (!location) {
    return (
      <div className="border-b border-border px-4 py-2 text-[11.5px] text-fg-subtle flex items-center gap-1.5">
        <BookOpen size={11} />
        No chapter open — questions will be answered without context.
      </div>
    );
  }
  return (
    <div className="border-b border-border bg-surface-2/40 px-4 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-fg-subtle">
        <BookOpen size={10} /> Reading
      </div>
      <div className="mt-0.5 text-[12px] text-fg leading-snug">
        <span className="font-mono text-[10.5px] text-fg-subtle mr-1.5 tabular-nums">
          {location.titleNumber}
          {location.chapterNumber ? `·${location.chapterNumber}` : ''}
        </span>
        {smallCaps(location.chapterHeading ?? location.titleHeading)}
      </div>
      <div className="mt-0.5 text-[10.5px] text-fg-subtle">
        Questions are answered using this {location.chapterNumber ? 'chapter' : 'title'} as context.
      </div>
    </div>
  );
}

function ResponseCard({
  entry,
  streaming,
}: {
  entry: HistoryEntry;
  streaming: boolean;
}) {
  const loc = entry.location;
  return (
    <article>
      <div className="mb-2">
        <div className="text-[10.5px] uppercase tracking-wider text-fg-subtle">
          Concept
        </div>
        <div className="text-[13px] text-fg mt-0.5 leading-snug">{entry.concept}</div>
        {loc && (
          <div className="text-[11px] text-fg-subtle mt-0.5">
            Asked while reading Title {loc.titleNumber}
            {loc.chapterNumber ? `, Chapter ${loc.chapterNumber}` : ''}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface-2/40 p-3">
        {entry.error && (
          <div className="text-[12px] text-fg-muted">
            <span className="text-fg">Sorry — request failed.</span>
            <div className="mt-1 text-[11px] text-fg-subtle">{entry.error}</div>
          </div>
        )}
        {!entry.error && !entry.body && streaming && (
          <div className="text-[12px] text-fg-subtle inline-flex items-center gap-1.5">
            <Sparkles size={12} className="animate-pulse" />
            Thinking…
          </div>
        )}
        {entry.body && (
          <div className={cn('prose-feynman', streaming && 'streaming-cursor')}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.body}</ReactMarkdown>
          </div>
        )}
      </div>
    </article>
  );
}

function EmptyHelper({ location }: { location: FeynmanLocation | null }) {
  const hasChapter = !!location?.chapterNumber;
  return (
    <div className="text-[12.5px] text-fg-muted leading-relaxed">
      <p className="text-fg-muted">
        Get a <strong className="text-fg">plain-English</strong> explanation of any concept
        — a single term, a clause, or a whole section.
      </p>
      <ul className="mt-3 space-y-2 text-[12px]">
        <li className="flex gap-2">
          <span className="text-accent">·</span>
          <span>Type a question below.</span>
        </li>
        <li className="flex gap-2">
          <span className="text-accent">·</span>
          <span>
            Select text in the article — a small <em>Explain</em> pill will appear.
          </span>
        </li>
      </ul>
      {hasChapter && (
        <p className="mt-3 text-[11.5px] text-fg-subtle">
          The currently-open chapter is automatically attached as context.
        </p>
      )}
    </div>
  );
}

function smallCaps(s: string | undefined | null): string {
  if (!s) return '';
  if (s === s.toUpperCase()) {
    return s
      .toLowerCase()
      .replace(/\b([a-z])([a-z]*)/g, (_, a, b) => a.toUpperCase() + b)
      .replace(/\b(And|Of|The|To|For|In|On|A|An|Or|By|With)\b/g, (m) => m.toLowerCase());
  }
  return s;
}
