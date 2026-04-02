# 🇺🇸 United States Code as a Git Repository

The entire United States Code — every title, chapter, and section — stored as Markdown in a Git repository. Each commit represents a point-in-time snapshot of federal law, with `git diff` revealing exactly what changed between enactments.

## Why?

Laws change. Understanding *what* changed and *when* has historically required navigating dense legal databases or reading legislative summaries written by someone else. Git solves this naturally:

- **`git log`** — see the history of federal law from 2013 to present
- **`git diff`** — see exactly what text changed between any two points in time
- **`git blame`** — trace when a specific provision was added
- **Tags** — jump to a specific Congress or year

## What's Here

```
uscode/
├── title-01-general-provisions/
│   ├── _title.md                    # Title metadata
│   ├── chapter-001-rules-of-construction.md
│   ├── chapter-002-acts-and-resolutions-...md
│   └── ...
├── title-02-the-congress/
├── title-03-the-president/
├── ...
└── title-54-national-park-service-and-related-programs/
```

- **53 titles** of the United States Code
- **~2,950 chapter-level Markdown files**
- **~60,400 sections** with full statutory text
- **13 commits** spanning 2013–2025 (one per OLRC release point)

Each Markdown file includes YAML frontmatter with metadata (title number, chapter, heading, section count, source URL) and the full statutory text with cross-references, statutory notes, and amendment histories.

## Commits & Tags

Every commit corresponds to an [Office of the Law Revision Counsel (OLRC)](https://uscode.house.gov) release point — an official snapshot of the US Code as amended through a specific Public Law.

### Tags

| Tag | Public Law | Year | Description |
|-----|-----------|------|-------------|
| `annual/2013` | 113-21 | 2013 | Earliest available OLRC snapshot |
| `congress/113` | 113-296 | 2014 | End of 113th Congress |
| `annual/2015` | 114-38 | 2015 | |
| `congress/114` | 114-329 | 2017 | End of 114th Congress |
| `annual/2017` | 115-51 | 2017 | |
| `congress/115` | 115-442 | 2019 | End of 115th Congress |
| `annual/2019` | 116-91 | 2019 | |
| `congress/116` | 116-344 | 2021 | End of 116th Congress |
| `annual/2021` | 117-81 | 2021 | |
| `annual/2022` | 117-262 | 2022 | |
| `congress/117` | 117-262 | 2022 | End of 117th Congress |
| `annual/2024` | 118-158 | 2024 | |
| `congress/118` | 118-158 | 2024 | End of 118th Congress |
| `annual/2025` | 119-73 | 2025 | Current (latest) |

### Browsing History

```bash
# What changed in federal law between the 115th and 116th Congress?
git diff congress/115..congress/116 --stat

# Full text diff of Title 18 (Crimes) between 2019 and 2025
git diff annual/2019..annual/2025 -- uscode/title-18-crimes-and-criminal-procedure/

# When was a specific section last modified?
git log --oneline -- "uscode/title-18-crimes-and-criminal-procedure/chapter-044-firearms.md"

# How many files changed across the entire 12-year history?
git diff annual/2013..annual/2025 --stat | tail -1
```

## Data Source

All content is derived from the [OLRC's official USLM XML](https://uscode.house.gov/download/download.shtml) release points. The XML is parsed and transformed to Markdown using [us-code-tools](https://github.com/nickvido/us-code-tools).

Cross-reference links point to the [official OLRC website](https://uscode.house.gov) for the preliminary (prelim) edition.

## Markdown Format

Each chapter file follows this structure:

```markdown
---
title: 18
chapter: '44'
heading: FIREARMS
section_count: 25
source: https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18&num=0&edition=prelim
---

<a id="section-921"></a>

## § 921. Definitions

**(a)** As used in this chapter—

**(1)** The term "person" and the term "whoever" include any individual...

### Statutory Notes

#### Amendments
...
```

- **Section headings** use `## §` with HTML anchor IDs for linking
- **Subsections** use bold labels: `**(a)**`, `**(1)**`, `**(A)**`, `**(i)**`
- **Cross-references** link to other sections within the repo or to uscode.house.gov
- **Statutory notes** include amendment histories, effective dates, and related materials

## Limitations

- **Coverage starts in 2013** — OLRC XML release points are only available from the 113th Congress onward
- **Codified law only** — this is the consolidated United States Code, not individual bills or public laws in directive format
- **Not all titles are positive law** — some titles are "evidence of law" rather than the legal text itself (see [1 USC § 204](uscode/title-01-general-provisions/chapter-003-code-of-laws-of-united-states-and-supplements-code.md))
- **Appendix titles** (5A, 11a, 18a, 28a, 50A) are not yet included
- **6 sections** across titles 5, 10, 25, 28, 38, and 40 have duplicate section numbers in the source XML

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features including:

- Web interface with cross-reference graph
- Bills as pull requests
- Roll call vote records
- Full-text search

## Related Projects

- [timlabs/uscode](https://github.com/timlabs/uscode) — US Code as JSON, chapter-level files
- [divegeek/uscode](https://github.com/divegeek/uscode) — US Code with commit-per-title history
- [unitedstates/uscode](https://github.com/unitedstates/uscode) — Python tools for downloading and parsing
- [publicdocs/uscode](https://github.com/publicdocs/uscode) — Section-level markdown files

## License

The United States Code is a work of the US Government and is in the **public domain** ([17 USC § 105](uscode/title-17-copyrights/chapter-001-subject-matter-and-scope-of-copyright.md)).

The tooling used to generate this repository is available under the [MIT License](https://github.com/nickvido/us-code-tools/blob/main/LICENSE).

## Credits

Built by [nickvido](https://github.com/nickvido) and [v1d0b0t](https://github.com/v1d0b0t).

Read the story: [Every Law a Commit](https://v1d0b0t.github.io/blog/posts/2026-03-29-every-law-a-commit.html)
