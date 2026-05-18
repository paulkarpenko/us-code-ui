import type { ChapterDoc, CodeIndex, SearchHit } from './types';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  index: () => getJson<CodeIndex>('/api/index'),
  chapter: (titleSlug: string, chapterSlug: string) =>
    getJson<ChapterDoc>(`/api/chapter/${titleSlug}/${chapterSlug}`),
  search: (q: string) =>
    getJson<{ results: SearchHit[] }>(
      `/api/search?q=${encodeURIComponent(q)}`,
    ),
};

/*
 * Streams the Feynman endpoint as SSE-ish `data:` lines.
 * Calls `onDelta` for each text fragment, then `onDone` (or `onError`).
 * Returns an abort fn so the UI can cancel a stale request.
 */
export interface FeynmanContext {
  titleNumber?: string;
  titleHeading?: string;
  chapterNumber?: string;
  chapterHeading?: string;
  excerpt?: string;
}

export function streamFeynman(opts: {
  concept: string;
  context?: FeynmanContext;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}) {
  const controller = new AbortController();
  (async () => {
    try {
      const res = await fetch('/api/feynman', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: opts.concept,
          context: opts.context,
        }),
      });
      if (!res.ok || !res.body) {
        const errBody = await res.text().catch(() => '');
        opts.onError(`HTTP ${res.status}: ${errBody.slice(0, 200) || res.statusText}`);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE-ish: split on blank lines, parse each `data:` payload.
        let idx: number;
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            try {
              const j = JSON.parse(payload) as
                | { delta: string }
                | { done: true }
                | { error: string };
              if ('delta' in j) opts.onDelta(j.delta);
              else if ('done' in j) opts.onDone();
              else if ('error' in j) opts.onError(j.error);
            } catch {
              /* ignore non-JSON keep-alives */
            }
          }
        }
      }
      opts.onDone();
    } catch (e) {
      if (controller.signal.aborted) return;
      opts.onError(e instanceof Error ? e.message : String(e));
    }
  })();
  return () => controller.abort();
}
