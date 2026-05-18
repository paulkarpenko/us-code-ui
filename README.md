# U.S. Code — Read & Understand

A web reading interface for the United States Code, built so people can actually finish reading a statute.

Federal law is dense, recursive, and written for an audience that already knows the conventions. Reading a single section often means three browser tabs, a glossary, and more patience than most readers bring. This UI shortens that distance.

## What it does

**Browse.** Every title and chapter in the bundled corpus is reachable from a keyboard-driven sidebar. Long chapters get a section rail so you keep your place; SHOUTED statutory headings render as readable small-caps without losing the underlying meaning.

**Resolve cross-references in place.** Mentions like `§ 921`, `section 921 of title 18`, or `26 U.S.C. § 5845` become hover-previewed links to the right section — no detour through search, no lost place.

**Ask in plain English.** Select a phrase anywhere — a statute, a chapter title, a sidebar row, even another answer — and an "Explain" pill brings up a Feynman-style explanation from Claude, grounded in the chapter you're reading. Browser-style Back / Forward let you drill in and back out without losing your trail.

**Search.** `⌘K` opens a search palette across titles and chapters. `⌘.` toggles the Explain panel.

```
┌──────────┬─────────────────────────┬──────────────┐
│ titles & │  chapter text           │  Explain     │
│ chapters │  + cross-ref previews   │  panel       │
│ sidebar  │  + section rail (xl+)   │  (Feynman)   │
└──────────┴─────────────────────────┴──────────────┘
```

## Try it

```bash
cd web
cp .env.example .env       # ANTHROPIC_API_KEY enables Explain
pnpm install
pnpm dev
```

Then open <http://localhost:5173>. The Explain panel needs an Anthropic API key; everything else (browsing, search, cross-reference previews) works without one.

Developer details — stack, scripts, the build-index pipeline, how to extend the explainer — live in [`web/README.md`](web/README.md).

## What this repo is, and isn't

**This repo is the UI.** The reading experience, the cross-reference linker, the Explain panel — that's [`web/`](web/).

**The corpus is bundled, not authored here.** The U.S. Code text — titles, chapters, sections, statutory notes, with each OLRC release point as its own commit — lives in [`uscode/`](uscode/). For what that data project is on its own (history-as-git, tags per Congress, the XML→Markdown pipeline), see [`ROADMAP.md`](ROADMAP.md) and the upstream tooling credited below.

**It's a reader, not a legal product.** Explanations from the Explain panel are best-effort plain-English summaries from a language model. They are not legal advice and do not replace reading the section.

## Status

Early. Browsing, cross-reference previews, and the Explain flow work end-to-end against the latest OLRC release point. Honest gaps:

- Search scores against title and chapter headings only, not section bodies.
- The git history of the corpus isn't surfaced in the UI yet — no "diff between Congresses" view.
- Appendix titles (5A, 11A, 18A, 28A, 50A) aren't indexed.
- Explain history is in-memory only by design — refresh the page and it's gone.

## License

The U.S. Code is a work of the U.S. Government and is in the public domain (17 USC § 105). The UI source is MIT.

## Credits

Built by [nickvido](https://github.com/nickvido) and [v1d0b0t](https://github.com/v1d0b0t).

Read the story behind the corpus: [Every Law a Commit](https://v1d0b0t.github.io/blog/posts/2026-03-29-every-law-a-commit.html).
