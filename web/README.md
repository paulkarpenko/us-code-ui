# U.S. Code Web

A reading & understanding interface for the United States Code repository.

- **Stack** — Vite + React 19 + TypeScript, Tailwind v4, Radix UI primitives, Hono API.
- **Index** — `scripts/build-index.ts` walks `../uscode/` and emits a compact
  `public/index.json` (titles + chapter heads + counts) that the SPA loads on boot.
  Per-chapter content + section list is fetched on demand from the API.
- **Feynman lookup** — right-hand panel sends the selected concept (plus the
  currently-open chapter as context) to Claude via a streaming Anthropic SDK call
  and renders the response as it arrives.

## Run

```bash
cp .env.example .env       # add ANTHROPIC_API_KEY for the Feynman panel
pnpm install
pnpm dev                   # builds the index, then runs Vite + the API
```

Vite serves at <http://localhost:5173> (proxying `/api/*` to the Hono server on
port 8787). Without `ANTHROPIC_API_KEY` everything except the Feynman panel still
works; the panel returns a 500 explaining the missing key.

## Keyboard

- `⌘K` — open search palette
- `⌘.` — toggle Feynman panel
- `⌘↵` (inside Feynman input) — send

## Layout

```
┌────────────┬─────────────────────────────┬──────────────┐
│  Titles    │  Chapter (markdown)         │  Feynman     │
│  sidebar   │  + section rail (xl+)       │  lookup      │
└────────────┴─────────────────────────────┴──────────────┘
```

## Extending

- **Search across section text** — `/api/search` currently scores against
  title/chapter headings only. Add a per-section text index (e.g. minisearch)
  and update `parseSections` to capture section bodies.
- **History / commits view** — the underlying repo is git, so a left-tab to
  switch between `annual/2013`-style snapshots could expose `git diff` directly.
  See `../ROADMAP.md`.
- **Different explainer modes** — `/api/feynman` is one prompt. Adding
  `/api/eli5`, `/api/cite-back`, etc. is a copy-paste of the handler.
