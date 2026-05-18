/*
 * Cross-reference rewriting for US Code chapter markdown.
 *
 * Two passes, both run server-side:
 *
 *   1. REWRITE existing markdown links that point to uscode.house.gov.
 *      Every such link has the title and section in its URL, e.g.
 *
 *         https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section5845/b&...
 *
 *      We extract (title=26, section=5845), look the section up in the
 *      resolver, and rewrite the href to an internal route. If the title
 *      isn't in our snapshot (appendix titles 5A, 11a, 18a, 28a, 50A) we
 *      leave the link external — graceful degradation.
 *
 *   2. AUTO-LINK three bare textual patterns in body text:
 *        • `§ NNN[(...)]`        — same-title reference (uses the chapter's
 *                                   own title number as context)
 *        • `section NNN of title MM` — fully-qualified
 *        • `NN U.S.C. § MMM`     — formal citation
 *
 *      Skip rules — important for precision:
 *        a) Statutory notes (everything from `### Statutory Notes` onward).
 *           These are dense with Public Law citations that share syntax with
 *           USC sections but mean something different ("§ 110105(2)" inside
 *           "Pub. L. 103–322, title XI, § 110105(2)" is a Pub.L. section).
 *        b) Lines containing `Pub. L.`, `Stat.`, or `et seq.` markers.
 *        c) Anything already inside a markdown link `[...](...)` — we split
 *           on the link syntax first and only linkify text fragments outside.
 *
 * Internal-route shape: `/title/<titleSlug>/<chapterSlug>#section-<n>`.
 * The hash matches the anchor ids ChapterView already produces.
 */

export type SectionResolver = (
  titleNumber: string,
  sectionNumber: string,
) => { titleSlug: string; chapterSlug: string } | null;

/* -------------------------------------------------------------------------- */
/*  Pass 1 — existing-link rewriting                                          */
/* -------------------------------------------------------------------------- */

// Captures title number and section number from a uscode.house.gov URL.
// Examples:
//   .../USC-prelim-title26-section5845/b&...
//   .../USC-prelim-title18-section921&...
//   .../USC-prelim-title5a-section1&...   (appendix titles — may not resolve)
const USC_URL_RE =
  /uscode\.house\.gov[^\s)]*?title([0-9]+[a-z]?)-section([0-9]+[a-z]?)/i;

// In-repo relative links. The source corpus uses `./chapter-XXX.md#section-N`
// for *every* same-title cross-reference (~128K of them across the corpus).
// We never see `../title-YY/...` for cross-title — those go through the
// uscode.house.gov URL form instead.
const REL_MD_RE = /^\.\/(chapter-[a-z0-9\-]+)\.md(#[\w\-]+)?$/i;

/*
 * Return values:
 *   string  — replace the href with this (internal route or untouched external)
 *   null    — strip the link entirely; render the link text as plain prose
 *
 * We strip rather than keep dead links because the OLRC `prelim` URL form
 * 404s for sections that have been repealed or renumbered between editions,
 * and a broken-link experience is worse than no link at all.
 */
function rewriteHref(
  href: string,
  resolve: SectionResolver,
  currentTitleSlug: string,
): string | null {
  // Pass A: uscode.house.gov URL form.
  const m = href.match(USC_URL_RE);
  if (m) {
    const titleNumber = m[1];
    const sectionNumber = m[2];
    const resolved = resolve(titleNumber, sectionNumber);
    if (resolved) {
      return `/title/${resolved.titleSlug}/${resolved.chapterSlug}#section-${sectionNumber.toLowerCase()}`;
    }
    // Section not in our snapshot — strip the link so the user doesn't get
    // sent to a broken OLRC page.
    return null;
  }
  // Pass B: in-repo relative markdown path. Preserve hash; drop `.md`.
  const rel = href.match(REL_MD_RE);
  if (rel) {
    const chapterSlug = rel[1];
    const hash = rel[2] ?? '';
    return `/title/${currentTitleSlug}/${chapterSlug}${hash}`;
  }
  return href;
}


/* -------------------------------------------------------------------------- */
/*  Pass 2 — auto-link bare textual patterns                                  */
/* -------------------------------------------------------------------------- */

const BODY_NOTES_DELIMITER = /\n###\s+Statutory Notes\b/;

// Skip auto-linking inside:
//   - markdown headings (lines starting with `#`), since the section heading
//     `## § 921. …` would otherwise link to its own anchor
//   - lines carrying Pub. L. / Stat. / et seq. legislative citations, where
//     `§ NNN` references a Public Law section, not a USC section
const SKIP_LINE_RE = /^\s*#|\b(Pub\. ?L\.|Stat\.|et seq\.)\b/;

/*
 * All four patterns extend their match to swallow trailing subsection
 * markers like `(a)(11)(A)` so the rendered link text matches what the
 * reader sees. We always resolve to the parent section number, since
 * subsection anchors aren't a separately addressable concept in our model.
 *
 * Subsection-suffix group: `(?:\([^)\s]+\))*`
 */
const SUBSEC = String.raw`(?:\([^)\s]+\))*`;

/*
 * Pattern A: "section NNN[(...)] of title MM" — fully qualified.
 *   Groups: 1=section, 2=subsec, 3=title
 */
const PATTERN_SECTION_OF_TITLE = new RegExp(
  `\\bsection\\s+(\\d+[a-z]?)(${SUBSEC})\\s+of\\s+title\\s+(\\d+[a-z]?)\\b`,
  'gi',
);

/*
 * Pattern B: "MM U.S.C. § NNN[(...)]" — formal citation.
 *   Groups: 1=title, 2=section, 3=subsec
 */
const PATTERN_USC_CITATION = new RegExp(
  `\\b(\\d+[a-z]?)\\s+U\\.\\s?S\\.\\s?C\\.\\s+§*\\s*(\\d+[a-z]?)(${SUBSEC})\\b`,
  'gi',
);

/*
 * Pattern C: bare `section NNN[(...)]` — same-title reference.
 * Resolved against the chapter's own title number. Restricted to 2+ digits
 * so we don't catch enumerated lists like "section 1 of the Act".
 *   Groups: 1=section, 2=subsec
 *
 * Note: we deliberately do NOT match "section N" with a single digit
 * because the false-positive rate in non-statutory prose is too high.
 */
const PATTERN_SECTION_SAMETITLE = new RegExp(
  `\\bsection\\s+(\\d{2,}[a-z]?)(${SUBSEC})\\b`,
  'g',
);

/*
 * Pattern D: bare `§ NNN[(...)]` symbol form.
 *   Groups: 1=section, 2=subsec
 */
const PATTERN_BARE_SECTION = new RegExp(`§\\s*(\\d+[a-z]?)(${SUBSEC})`, 'g');

function linkifyFragment(
  fragment: string,
  currentTitleNumber: string,
  resolve: SectionResolver,
): string {
  // Replace in order so the most-specific patterns win. Each replacement
  // emits markdown link syntax `[text](url)` — subsequent regexes run on
  // the *already-modified* text, so we guard against re-matching by
  // ensuring patterns don't match inside `[...](...)`.
  //
  // Approach: build matches across all patterns, sort by offset, emit
  // non-overlapping replacements in a single rewrite pass.
  interface Hit {
    start: number;
    end: number;
    text: string;
    titleNum: string;
    sectionNum: string;
  }
  const hits: Hit[] = [];

  for (const m of fragment.matchAll(PATTERN_SECTION_OF_TITLE)) {
    hits.push({
      start: m.index!,
      end: m.index! + m[0].length,
      text: m[0],
      titleNum: m[3],
      sectionNum: m[1],
    });
  }
  for (const m of fragment.matchAll(PATTERN_USC_CITATION)) {
    hits.push({
      start: m.index!,
      end: m.index! + m[0].length,
      text: m[0],
      titleNum: m[1],
      sectionNum: m[2],
    });
  }
  for (const m of fragment.matchAll(PATTERN_SECTION_SAMETITLE)) {
    hits.push({
      start: m.index!,
      end: m.index! + m[0].length,
      text: m[0],
      titleNum: currentTitleNumber,
      sectionNum: m[1],
    });
  }
  for (const m of fragment.matchAll(PATTERN_BARE_SECTION)) {
    hits.push({
      start: m.index!,
      end: m.index! + m[0].length,
      text: m[0],
      titleNum: currentTitleNumber,
      sectionNum: m[1],
    });
  }

  if (hits.length === 0) return fragment;

  // Drop overlapping hits, preferring earlier-start + longer-match
  // (a fully-qualified ref always wins over a bare § inside it).
  hits.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const kept: Hit[] = [];
  let cursor = -1;
  for (const h of hits) {
    if (h.start < cursor) continue;
    kept.push(h);
    cursor = h.end;
  }

  let out = '';
  let pos = 0;
  for (const h of kept) {
    out += fragment.slice(pos, h.start);
    const resolved = resolve(h.titleNum, h.sectionNum);
    if (resolved) {
      const href = `/title/${resolved.titleSlug}/${resolved.chapterSlug}#section-${h.sectionNum.toLowerCase()}`;
      out += `[${h.text}](${href})`;
    } else {
      out += h.text;
    }
    pos = h.end;
  }
  out += fragment.slice(pos);
  return out;
}

/*
 * Walk the body text and apply auto-linking only to fragments that are NOT
 * already inside markdown link syntax. We split on `[...](...)` boundaries,
 * linkify the gaps, and stitch back together.
 */
function autoLinkBodyText(
  body: string,
  currentTitleNumber: string,
  resolve: SectionResolver,
): string {
  const linkRegex = /\[[^\]\n]+\]\([^)\s]+(?:\s+"[^"]*")?\)/g;
  let out = '';
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(body)) !== null) {
    const gap = body.slice(lastIndex, m.index);
    out += linkifyByLines(gap, currentTitleNumber, resolve);
    out += m[0]; // preserve existing link as-is
    lastIndex = m.index + m[0].length;
  }
  out += linkifyByLines(body.slice(lastIndex), currentTitleNumber, resolve);
  return out;
}

function linkifyByLines(
  text: string,
  currentTitleNumber: string,
  resolve: SectionResolver,
): string {
  // Process line-by-line so we can skip lines that look like Pub. L. citations.
  return text
    .split('\n')
    .map((line) => (SKIP_LINE_RE.test(line) ? line : linkifyFragment(line, currentTitleNumber, resolve)))
    .join('\n');
}

/* -------------------------------------------------------------------------- */
/*  Public entry                                                              */
/* -------------------------------------------------------------------------- */

export interface LinkifyResult {
  content: string;
  /** How many existing uscode.house.gov links were rewritten to internal routes. */
  rewrittenLinks: number;
  /** How many uscode.house.gov links pointed to sections not in our snapshot
   *  and were stripped (rendered as plain text). */
  strippedLinks: number;
  /** How many new auto-links were added in body text. */
  autoLinks: number;
}

export function linkifyChapter(
  markdown: string,
  currentTitleNumber: string,
  currentTitleSlug: string,
  resolve: SectionResolver,
): LinkifyResult {
  // Count for telemetry / hover-card debugging.
  let rewritten = 0;
  let stripped = 0;
  let added = 0;

  // Pass 1 across the whole document — uscode.house.gov URLs get rewritten
  // to internal routes when resolvable (and stripped when not, to avoid
  // sending users to broken OLRC pages); in-repo relative `.md` paths get
  // rewritten in place.
  const afterPass1 = markdown.replace(
    /\[([^\]\n]+)\]\(([^)\s]+)(\s+"[^"]*")?\)/g,
    (_full, text, url, title) => {
      const newUrl = rewriteHref(url, resolve, currentTitleSlug);
      if (newUrl === null) {
        stripped++;
        return text; // emit plain text; drop the link entirely
      }
      if (newUrl !== url) rewritten++;
      return `[${text}](${newUrl}${title ?? ''})`;
    },
  );

  // Pass 2: split body / statutory notes, only linkify body.
  const split = afterPass1.split(BODY_NOTES_DELIMITER);
  const body = split[0];
  const notesTail = split.length > 1 ? '\n### Statutory Notes' + split.slice(1).join('\n### Statutory Notes') : '';

  const countingAutolinker: SectionResolver = (t, s) => {
    const r = resolve(t, s);
    if (r) added++;
    return r;
  };
  const newBody = autoLinkBodyText(body, currentTitleNumber, countingAutolinker);

  return {
    content: newBody + notesTail,
    rewrittenLinks: rewritten,
    strippedLinks: stripped,
    autoLinks: added,
  };
}
