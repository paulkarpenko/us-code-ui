/*
 * API server for the US Code browser.
 *
 *   GET  /api/index                              → cached titles index (JSON)
 *   GET  /api/chapter/:titleSlug/:chapterSlug    → chapter markdown + parsed sections
 *   GET  /api/search?q=...                       → fuzzy chapter/section search
 *   POST /api/feynman                            → SSE stream from Claude
 *
 * The Feynman endpoint streams a Feynman-method-style explanation: simple
 * one-paragraph plain-English version → key terms → a sharper, deeper take
 * → "what's still unclear" check questions.
 */
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { stream } from 'hono/streaming';
import { cors } from 'hono/cors';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import Anthropic from '@anthropic-ai/sdk';
import { linkifyChapter, type SectionResolver } from './linkify';

// Load .env from the web/ root so ANTHROPIC_API_KEY is available without
// requiring callers to pass --env-file. Node 20.6+ ships loadEnvFile().
try {
  const envPath = path.resolve(import.meta.dirname, '..', '.env');
  process.loadEnvFile(envPath);
} catch {
  /* no .env present — fall through to whatever the shell exported */
}

const ROOT = path.resolve(import.meta.dirname, '..', '..', 'uscode');
const INDEX_PATH = path.resolve(import.meta.dirname, '..', 'public', 'index.json');
const SECTIONS_PATH = path.resolve(import.meta.dirname, '..', 'data', 'sections.json');

const app = new Hono();
app.use('*', cors());

interface ChapterInfo {
  slug: string;
  number: string;
  heading: string;
  sectionCount: number;
}
interface TitleInfo {
  slug: string;
  number: string;
  heading: string;
  positiveLaw?: boolean;
  chapters: ChapterInfo[];
  totalSections: number;
}
interface IndexFile {
  generatedAt: string;
  titles: TitleInfo[];
  totals: { titles: number; chapters: number; sections: number };
}

let indexCache: IndexFile | null = null;
async function getIndex(): Promise<IndexFile> {
  if (indexCache) return indexCache;
  const raw = await readFile(INDEX_PATH, 'utf8');
  indexCache = JSON.parse(raw);
  return indexCache!;
}

/*
 * Section resolver: title+section → {titleSlug, chapterSlug}.
 *
 * Loaded once from data/sections.json. Keys are normalised to lowercase
 * and stripped of leading zeros so "18:921", "018:921", "18:0921" all hit.
 */
type SectionsMap = Record<string, { titleSlug: string; chapterSlug: string }>;
let sectionsCache: SectionsMap | null = null;
async function getSections(): Promise<SectionsMap> {
  if (sectionsCache) return sectionsCache;
  const raw = await readFile(SECTIONS_PATH, 'utf8');
  sectionsCache = JSON.parse(raw);
  return sectionsCache!;
}

function normalizeNumber(n: string): string {
  return n.toLowerCase().replace(/^0+(?=[0-9])/, '');
}

function buildResolver(map: SectionsMap): SectionResolver {
  return (titleNumber, sectionNumber) =>
    map[`${normalizeNumber(titleNumber)}:${normalizeNumber(sectionNumber)}`] ?? null;
}

// Kick off the load eagerly so the first chapter request usually finds the
// promise already resolved; awaited explicitly in handlers below.
const sectionsReady = getSections().catch((e) => {
  console.error('Failed to load sections map:', e);
  return {} as SectionsMap;
});

app.get('/api/index', async (c) => {
  const idx = await getIndex();
  // Tell the client whether the Explain panel will actually work, so it
  // can collapse the panel and surface a setup hint instead of failing
  // on first use.
  return c.json({ ...idx, hasApiKey: !!process.env.ANTHROPIC_API_KEY });
});

/*
 * Section extraction — runs at request time so the index stays small.
 * Captures the §-number and trailing heading.
 */
const SECTION_RE = /^##\s+§+\s*([\w\-–—]+)\.?\s*(.*)$/gm;

function parseSections(body: string) {
  const out: { id: string; number: string; heading: string; offset: number }[] = [];
  SECTION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SECTION_RE.exec(body)) !== null) {
    const number = m[1].trim();
    const heading = m[2].trim().replace(/\s+/g, ' ');
    out.push({
      id: `section-${number.toLowerCase()}`,
      number,
      heading,
      offset: m.index,
    });
  }
  return out;
}

app.get('/api/chapter/:titleSlug/:chapterSlug', async (c) => {
  const { titleSlug, chapterSlug } = c.req.param();
  if (!/^title-[a-z0-9\-]+$/i.test(titleSlug) || !/^chapter-[a-z0-9\-]+$/i.test(chapterSlug)) {
    return c.json({ error: 'invalid path' }, 400);
  }
  const file = path.join(ROOT, titleSlug, `${chapterSlug}.md`);
  if (!file.startsWith(ROOT)) return c.json({ error: 'invalid path' }, 400);
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    return c.json({ error: 'not found' }, 404);
  }
  const parsed = matter(raw);
  const sections = parseSections(parsed.content).map(({ id, number, heading }) => ({
    id,
    number,
    heading,
  }));

  // Resolve the title number from frontmatter for same-title auto-linking
  // (bare `section NNN` in body text → look up against this title).
  const titleNumber = String(parsed.data.title ?? '');
  const map = await sectionsReady;
  const linkified = linkifyChapter(parsed.content, titleNumber, titleSlug, buildResolver(map));

  return c.json({
    frontmatter: parsed.data,
    content: linkified.content,
    sections,
    linkStats: {
      rewritten: linkified.rewrittenLinks,
      stripped: linkified.strippedLinks,
      autoLinked: linkified.autoLinks,
    },
  });
});

/*
 * Section preview for hover cards. Returns the section heading and a short
 * snippet of the first paragraph. Reads the chapter, slices out the requested
 * section, strips its inline subsection labels, and trims to ~300 chars.
 *
 * Cache: per-(titleSlug, sectionNumber) so a hovered link doesn't re-parse
 * the entire chapter file every time.
 */
const previewCache = new Map<string, { heading: string; snippet: string; titleSlug: string; chapterSlug: string; sectionNumber: string }>();

async function getSectionPreview(titleNumber: string, sectionNumber: string) {
  const key = `${normalizeNumber(titleNumber)}:${normalizeNumber(sectionNumber)}`;
  const cached = previewCache.get(key);
  if (cached) return cached;

  const map = await sectionsReady;
  const resolved = buildResolver(map)(titleNumber, sectionNumber);
  if (!resolved) return null;

  const file = path.join(ROOT, resolved.titleSlug, `${resolved.chapterSlug}.md`);
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    return null;
  }
  const parsed = matter(raw);
  const sections = parseSections(parsed.content);
  const normSec = normalizeNumber(sectionNumber);
  const idx = sections.findIndex((s) => normalizeNumber(s.number) === normSec);
  if (idx === -1) return null;
  const start = sections[idx].offset;
  const end = idx + 1 < sections.length ? sections[idx + 1].offset : parsed.content.length;
  const body = parsed.content.slice(start, end);

  // Strip the leading `## § ...` heading from the body — we already return it
  // separately. Then strip markdown adornments for a clean text snippet.
  const headerMatch = body.match(/^##\s+§+\s*[\w\-A-Z0-9.–—]+\.?\s*(.*)$/m);
  const heading = headerMatch ? headerMatch[1].trim() : sections[idx].heading;
  const afterHeader = body.replace(/^##\s+§+[^\n]*\n+/, '');
  const flat = afterHeader
    .replace(/<a[^>]*><\/a>/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]\n]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  const snippet = flat.length > 320 ? flat.slice(0, 320).replace(/\s+\S*$/, '') + '…' : flat;

  const out = {
    heading,
    snippet,
    titleSlug: resolved.titleSlug,
    chapterSlug: resolved.chapterSlug,
    sectionNumber,
  };
  previewCache.set(key, out);
  return out;
}

app.get('/api/section/:titleNumber/:sectionNumber', async (c) => {
  const { titleNumber, sectionNumber } = c.req.param();
  if (!/^\d+[a-z]?$/i.test(titleNumber) || !/^\d+[a-z]?$/i.test(sectionNumber)) {
    return c.json({ error: 'invalid' }, 400);
  }
  const preview = await getSectionPreview(titleNumber, sectionNumber);
  if (!preview) return c.json({ error: 'not found' }, 404);
  return c.json(preview);
});

/*
 * Lightweight search over the in-memory index. We don't yet index section
 * headings (they're not in index.json) — chapters only. Good enough for v1
 * jumpnav; we can add a section-text indexer later.
 */
app.get('/api/search', async (c) => {
  const q = (c.req.query('q') ?? '').trim().toLowerCase();
  if (q.length < 2) return c.json({ results: [] });
  const idx = await getIndex();
  const tokens = q.split(/\s+/);
  const hits: {
    titleSlug: string;
    titleNumber: string;
    titleHeading: string;
    chapterSlug: string;
    chapterNumber: string;
    chapterHeading: string;
    score: number;
  }[] = [];
  for (const t of idx.titles) {
    for (const ch of t.chapters) {
      const haystack = `${t.heading} ${ch.heading} chapter ${ch.number} title ${t.number}`.toLowerCase();
      let score = 0;
      for (const tok of tokens) {
        const i = haystack.indexOf(tok);
        if (i < 0) { score = 0; break; }
        score += 10 - Math.min(9, i / 10);
      }
      if (score > 0) {
        hits.push({
          titleSlug: t.slug,
          titleNumber: t.number,
          titleHeading: t.heading,
          chapterSlug: ch.slug,
          chapterNumber: ch.number,
          chapterHeading: ch.heading,
          score,
        });
      }
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return c.json({ results: hits.slice(0, 40) });
});

/*
 * Feynman-style explainer. Streams Claude's response as SSE-ish plain
 * `data:` lines so the client can render progressively without a full SDK.
 */
const FEYNMAN_SYSTEM = `You are a legal-concept tutor who teaches by the Feynman Method.
Your goal is to make federal statutory concepts genuinely *clear* — not just summarised.

Structure every response in four short sections. The first is an unlabeled lead paragraph; the remaining three use these exact headings.

Start with one paragraph (≤3 sentences) — no heading, no preamble, no jargon, no hedging. If a child or non-lawyer could not follow it, rewrite it.

**Key terms**
A short bulleted list. For each term in the user's concept that has a technical legal meaning, give a one-line gloss in everyday language.

**A sharper take**
2–4 sentences for someone who got the basics. Bring in the *why* (purpose, mechanism, who it constrains, what it changes from the default rule). If it interacts with other statutes or doctrines, name them briefly.

**Check your understanding**
Two pointed questions that would expose a shallow read of the concept. Don't answer them.

Rules:
- Never invent statutory text or section numbers. If you don't know, say so.
- If you reference the surrounding chapter/section the user provided, do so naturally — do not summarise it back at them.
- Keep the whole response under ~250 words.
- Prefer concrete examples over abstract paraphrase.`;

interface FeynmanReq {
  concept: string;
  context?: {
    titleNumber?: string;
    titleHeading?: string;
    chapterNumber?: string;
    chapterHeading?: string;
    excerpt?: string;
  };
  model?: string;
}

app.post('/api/feynman', async (c) => {
  const body = (await c.req.json().catch(() => null)) as FeynmanReq | null;
  if (!body || !body.concept || body.concept.trim().length < 1) {
    return c.json({ error: 'concept required' }, 400);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return c.json(
      { error: 'ANTHROPIC_API_KEY not set on the server' },
      500,
    );
  }

  const client = new Anthropic({ apiKey });
  const model = body.model ?? 'claude-sonnet-4-6';

  const ctxBits: string[] = [];
  if (body.context?.titleNumber || body.context?.titleHeading) {
    ctxBits.push(
      `Title ${body.context.titleNumber ?? '?'} — ${body.context.titleHeading ?? ''}`.trim(),
    );
  }
  if (body.context?.chapterNumber || body.context?.chapterHeading) {
    ctxBits.push(
      `Chapter ${body.context.chapterNumber ?? '?'} — ${body.context.chapterHeading ?? ''}`.trim(),
    );
  }
  if (body.context?.excerpt) {
    const excerpt = body.context.excerpt.slice(0, 4000);
    ctxBits.push(`Excerpt the user is reading:\n"""${excerpt}"""`);
  }

  const userMsg = ctxBits.length
    ? `Reading context:\n${ctxBits.join('\n\n')}\n\nExplain this concept using the Feynman method:\n\n${body.concept.trim()}`
    : `Explain this concept using the Feynman method:\n\n${body.concept.trim()}`;

  return stream(c, async (s) => {
    s.onAbort(() => { /* client disconnected */ });
    c.header('Content-Type', 'text/event-stream; charset=utf-8');
    c.header('Cache-Control', 'no-cache, no-transform');
    c.header('Connection', 'keep-alive');
    c.header('X-Accel-Buffering', 'no');

    try {
      const stream = await client.messages.stream({
        model,
        max_tokens: 800,
        system: FEYNMAN_SYSTEM,
        messages: [{ role: 'user', content: userMsg }],
      });
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          const payload = JSON.stringify({ delta: event.delta.text });
          await s.write(`data: ${payload}\n\n`);
        }
      }
      await s.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await s.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    }
  });
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
