# Roadmap

## Current Status

✅ **Baseline complete** — 53 titles, ~60,400 sections, 13 historical snapshots (2013–2025) with annual and Congress-level tags.

## Near Term

### Web Interface
- Browse all titles, chapters, and sections in a clean web UI
- Chapter-level pages (sections stay in context of their chapter)
- Static app shell on GitHub Pages, content served from CDN (Cloudflare R2)
- Deep links to specific sections (`/title/42/chapter/7#section-1395`)
- Mobile-friendly reading experience
- **Repo:** [nickvido/us-code-web](https://github.com/v1d0b0t/us-code-web) (private, in development)

### Cross-Reference Graph
- Parse all ~60K sections for statutory cross-references (`section NNN of Title NN`, `NN U.S.C. § NNN`, etc.)
- Build inbound/outbound citation index — for any section, see what cites it and what it cites
- Reference counts on section headings showing relative importance
- Interactive exploration: tap a section to see its connections, navigate the graph
- Pre-built at content generation time, served as JSON from CDN

### Diff View
- For each historical snapshot, show what changed (added, removed, modified text)
- Link diffs to the public law that caused the change
- Limited to 2013–present (OLRC baseline)

## Medium Term

### Bills as Pull Requests
- Every bill introduced in Congress becomes a PR against the current Code
- Amendments are commits on the PR branch
- Votes recorded in PR metadata
- Bills that pass → PR merges; bills that die → PR closes
- Data sources: Congress.gov API, GovInfo

### Roll Call Votes
- Attach vote records (yea/nay/abstain with party breakdown) to bill PRs
- Data source: VoteView

### Congress Member Profiles
- Link legislative activity to individual members
- Sponsorship, co-sponsorship, voting record
- Data sources: Congress.gov, @unitedstates project

### Full-Text Search
- Client-side search index (Pagefind or similar)
- Search across all ~60K sections
- Filter by title, chapter, or keyword

## Long Term

### Sync Engine
- Automated pipeline: when OLRC publishes a new release point, generate a new commit
- Monitor for new public laws and update the repo
- GitHub Actions or scheduled job

### Time Travel UI
- Browse the US Code as it existed at any point in time
- Visual timeline scrubber
- Side-by-side comparison of any two snapshots

### Court Rulings Overlay
- Link sections to significant court decisions interpreting them
- Show which provisions have been challenged, upheld, or struck down

### API
- RESTful API for programmatic access to sections, cross-references, and diffs
- Useful for legal tech tools, research, and journalism

## Contributing

This project is in early development. If you're interested in contributing, open an issue to discuss. The [us-code-tools](https://github.com/nickvido/us-code-tools) repo contains the ingestion engine.
