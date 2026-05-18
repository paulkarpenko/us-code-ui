import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Lightbulb,
  Send,
  X,
  Sparkles,
  BookOpen,
  KeyRound,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
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
 * History is browser-like: each Ask pushes onto a stack at cursor+1,
 * truncating any forward entries. Back/Forward walk the cursor; Reset
 * clears everything. Kept in memory only — feels like a calculator, not
 * a chat log.
 */

export interface FeynmanRequest {
  concept: string;
  excerpt?: string;
  /** Override the live page location — used when the trigger isn't tied to
   *  the article the user is reading (e.g. clicking Explain on a sidebar
   *  row that points at a different title/chapter). */
  location?: FeynmanLocation;
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
  // Location captured when the question was asked, so navigating back
  // through history doesn't get re-anchored to whatever the user is
  // currently reading.
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
  const [stack, setStack] = useState<HistoryEntry[]>([]);
  const [cursor, setCursor] = useState<number>(-1);
  // Index of the entry currently being streamed (or -1 when no stream is
  // in flight). Tracked separately from cursor so the user can navigate
  // history while a stream finishes in the background.
  const [streamingIdx, setStreamingIdx] = useState<number>(-1);
  const abortRef = useRef<(() => void) | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // Refs let `ask` read the freshest stack/cursor synchronously (avoids
  // racing two functional setState updates against each other).
  const stackRef = useRef(stack);
  const cursorRef = useRef(cursor);
  const locationRef = useRef(location);
  useEffect(() => { stackRef.current = stack; }, [stack]);
  useEffect(() => { cursorRef.current = cursor; }, [cursor]);
  useEffect(() => { locationRef.current = location; }, [location]);

  const current = cursor >= 0 && cursor < stack.length ? stack[cursor] : null;
  const canBack = cursor > 0;
  const canForward = cursor < stack.length - 1;
  const isStreaming = streamingIdx >= 0;
  const isStreamingCurrent = isStreaming && streamingIdx === cursor;

  // Auto-scroll while the displayed entry is streaming.
  useEffect(() => {
    if (!bodyRef.current) return;
    if (!isStreamingCurrent) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [current?.body, isStreamingCurrent]);

  // Snap scroll to top when the cursor moves (Back/Forward navigation).
  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.scrollTop = 0;
  }, [cursor]);

  const ask = (concept: string, opts?: { excerpt?: string; location?: FeynmanLocation }) => {
    const trimmed = concept.trim();
    if (!trimmed) return;
    abortRef.current?.();

    const loc = opts?.location ?? locationRef.current;
    const entry: HistoryEntry = {
      concept: trimmed,
      excerpt: opts?.excerpt,
      body: '',
      ts: Date.now(),
      location: loc,
    };

    const nextStack = [...stackRef.current.slice(0, cursorRef.current + 1), entry];
    const newIdx = nextStack.length - 1;
    setStack(nextStack);
    setCursor(newIdx);
    setStreamingIdx(newIdx);

    abortRef.current = streamFeynman({
      concept: trimmed,
      context: {
        titleNumber: loc?.titleNumber,
        titleHeading: loc?.titleHeading,
        chapterNumber: loc?.chapterNumber,
        chapterHeading: loc?.chapterHeading,
        excerpt: opts?.excerpt,
      },
      onDelta: (text) => {
        setStack((s) => {
          if (!s[newIdx]) return s;
          const copy = [...s];
          copy[newIdx] = { ...copy[newIdx], body: copy[newIdx].body + text };
          return copy;
        });
      },
      onDone: () => setStreamingIdx(-1),
      onError: (err) => {
        setStack((s) => {
          if (!s[newIdx]) return s;
          const copy = [...s];
          copy[newIdx] = { ...copy[newIdx], error: err };
          return copy;
        });
        setStreamingIdx(-1);
      },
    });
  };

  const goBack = () => setCursor((c) => (c > 0 ? c - 1 : c));
  const goForward = () =>
    setCursor((c) => (c < stackRef.current.length - 1 ? c + 1 : c));
  const resetHistory = () => {
    abortRef.current?.();
    abortRef.current = null;
    setStack([]);
    setCursor(-1);
    setStreamingIdx(-1);
  };

  // Externally triggered requests (from text selection, h1 buttons, sidebar).
  useEffect(() => {
    if (request && request.concept) {
      ask(request.concept, { excerpt: request.excerpt, location: request.location });
      setInput(request.concept);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  // Context shown in the chip: when viewing a stack entry, prefer the
  // location captured when that entry was asked; fall back to the live page.
  const chipLocation = current?.location ?? location;

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

      {stack.length > 0 && (
        <div className="flex items-center gap-1 border-b border-border px-3 py-1.5 bg-surface-2/30">
          <button
            onClick={goBack}
            disabled={!canBack}
            aria-label="Previous explanation"
            className={cn(
              'inline-flex h-6 w-6 items-center justify-center rounded',
              'text-fg-subtle hover:text-fg hover:bg-surface-2',
              'disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-fg-subtle',
            )}
          >
            <ArrowLeft size={13} strokeWidth={2} />
          </button>
          <span className="text-[10.5px] text-fg-subtle tabular-nums px-1 min-w-[3.5rem] text-center">
            {cursor + 1} <span className="text-fg-subtle/60">of</span> {stack.length}
          </span>
          <button
            onClick={goForward}
            disabled={!canForward}
            aria-label="Next explanation"
            className={cn(
              'inline-flex h-6 w-6 items-center justify-center rounded',
              'text-fg-subtle hover:text-fg hover:bg-surface-2',
              'disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-fg-subtle',
            )}
          >
            <ArrowRight size={13} strokeWidth={2} />
          </button>
          <div className="flex-1" />
          <button
            onClick={resetHistory}
            aria-label="Clear all explanations"
            className="inline-flex items-center gap-1 rounded px-1.5 h-6 text-[10.5px] text-fg-subtle hover:text-fg hover:bg-surface-2"
          >
            <RotateCcw size={11} strokeWidth={2} /> Clear
          </button>
        </div>
      )}

      {/*
       * Persistent "what's attached" chip — answers the user's first question
       * before they ask: yes, the panel knows what you're reading and any
       * lookup will use it as context. When viewing a past entry, reflects
       * the context that entry actually used.
       */}
      <ContextChip location={chipLocation} viewingEntry={!!current} />

      <ScrollArea className="flex-1" viewportRef={bodyRef as React.RefObject<HTMLDivElement>}>
        <div className="px-4 py-4 space-y-5">
          {!hasApiKey && <MissingKeyCard />}
          {hasApiKey && !current && <EmptyHelper location={location} />}

          {hasApiKey && current && (
            <ResponseCard
              entry={current}
              streaming={isStreamingCurrent}
            />
          )}
        </div>
      </ScrollArea>

      {hasApiKey && <form
        className="border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || isStreaming) return;
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
                if (input.trim() && !isStreaming) ask(input);
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
            disabled={!input.trim() || isStreaming}
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
          ⌘↵ to send · Select text, click a title, or click a sidebar row for instant lookup
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

function ContextChip({
  location,
  viewingEntry,
}: {
  location: FeynmanLocation | null;
  viewingEntry: boolean;
}) {
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
        <BookOpen size={10} /> {viewingEntry ? 'Context' : 'Reading'}
      </div>
      <div className="mt-0.5 text-[12px] text-fg leading-snug">
        <span className="font-mono text-[10.5px] text-fg-subtle mr-1.5 tabular-nums">
          {location.titleNumber}
          {location.chapterNumber ? `·${location.chapterNumber}` : ''}
        </span>
        {smallCaps(location.chapterHeading ?? location.titleHeading)}
      </div>
      <div className="mt-0.5 text-[10.5px] text-fg-subtle">
        {viewingEntry
          ? `Answered using this ${location.chapterNumber ? 'chapter' : 'title'} as context.`
          : `Questions are answered using this ${location.chapterNumber ? 'chapter' : 'title'} as context.`}
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
          <div
            className={cn('prose-feynman', streaming && 'streaming-cursor')}
            data-explainable="true"
            // Drilling into a concept from inside an answer keeps the answer's
            // own context (which may differ from the live page if the entry
            // was originated from a sidebar row).
            data-explain-location={entry.location ? JSON.stringify(entry.location) : undefined}
          >
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
        <li className="flex gap-2">
          <span className="text-accent">·</span>
          <span>
            Hover a chapter title or any sidebar row and click the small{' '}
            <em>Explain</em> icon.
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
