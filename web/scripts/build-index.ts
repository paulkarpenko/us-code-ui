/*
 * Builds two indexes of the US Code repository:
 *
 *   public/index.json     — lean titles + chapter heads (shipped to client)
 *   data/sections.json    — section-number → {titleSlug, chapterSlug} map
 *                           (kept server-side; loaded into memory by the API
 *                           for cross-reference resolution and previews)
 *
 * Run: pnpm index
 */
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

const ROOT = path.resolve(import.meta.dirname, '..', '..', 'uscode');
const OUT = path.resolve(import.meta.dirname, '..', 'public', 'index.json');
const SECTIONS_OUT = path.resolve(import.meta.dirname, '..', 'data', 'sections.json');

export interface ChapterEntry {
  slug: string;        // file basename without .md
  number: string;
  heading: string;
  sectionCount: number;
}

export interface TitleEntry {
  slug: string;        // dir name
  number: string;
  heading: string;
  positiveLaw?: boolean;
  chapters: ChapterEntry[];
  totalSections: number;
}

export interface Index {
  generatedAt: string;
  titles: TitleEntry[];
  totals: {
    titles: number;
    chapters: number;
    sections: number;
  };
}

// Capture the section number (digits + optional alpha suffix, optional range).
// Excludes `.` from the char class so the trailing period in `## § 921. Title`
// isn't sucked into the captured number.
const SECTION_RE = /^##\s+§+\s*([\w\-–—]+)\.?\s*(.*)$/gm;

function extractSectionNumbers(body: string): string[] {
  SECTION_RE.lastIndex = 0;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = SECTION_RE.exec(body)) !== null) {
    out.push(m[1].trim());
  }
  return out;
}

function chapterNumberFromSlug(slug: string): string {
  const m = slug.match(/^chapter-([0-9a-z\-]+?)(?:-|$)/i);
  return m ? m[1].replace(/^0+(?=\d)/, '') : slug;
}

function titleNumberFromSlug(slug: string): string {
  const m = slug.match(/^title-([0-9a-z]+)/i);
  return m ? m[1].replace(/^0+(?=\d)/, '') : slug;
}

async function exists(p: string) {
  try { await stat(p); return true; } catch { return false; }
}

/*
 * Section-resolution map. Keys are "<titleNumber>:<sectionNumber>" both
 * lower-cased and stripped of leading zeros, so "18:921" and "5:552a"
 * both look up cleanly regardless of how the citation was written.
 *
 * Same-number collisions (the README notes ~6 across the corpus) keep the
 * first occurrence — predictable beats fancy here.
 */
export type SectionsMap = Record<string, { titleSlug: string; chapterSlug: string }>;

function sectionKey(titleNum: string, sectionNum: string): string {
  const t = titleNum.toLowerCase().replace(/^0+(?=[0-9])/, '');
  const s = sectionNum.toLowerCase().replace(/^0+(?=[0-9])/, '');
  return `${t}:${s}`;
}

async function buildTitle(
  dir: string,
  sectionsMap: SectionsMap,
): Promise<TitleEntry | null> {
  const slug = path.basename(dir);
  if (!slug.startsWith('title-')) return null;

  const number = titleNumberFromSlug(slug);
  let heading = '';
  let positiveLaw: boolean | undefined;

  const titleMetaPath = path.join(dir, '_title.md');
  if (await exists(titleMetaPath)) {
    const raw = await readFile(titleMetaPath, 'utf8');
    const fm = matter(raw).data as Record<string, unknown>;
    heading = String(fm.heading ?? '');
    if (typeof fm.positive_law === 'boolean') positiveLaw = fm.positive_law;
  }

  const entries = await readdir(dir);
  const chapterFiles = entries
    .filter((f) => f.startsWith('chapter-') && f.endsWith('.md'))
    .sort();

  const chapters: ChapterEntry[] = [];
  let totalSections = 0;
  for (const file of chapterFiles) {
    const full = path.join(dir, file);
    const raw = await readFile(full, 'utf8');
    const parsed = matter(raw);
    const fm = parsed.data as Record<string, unknown>;
    const slugChapter = file.replace(/\.md$/, '');
    const chapterNumber = String(fm.chapter ?? chapterNumberFromSlug(slugChapter));
    const chapterHeading = String(fm.heading ?? '');

    const sectionNumbers = extractSectionNumbers(parsed.content);
    for (const s of sectionNumbers) {
      const key = sectionKey(number, s);
      if (!(key in sectionsMap)) {
        sectionsMap[key] = { titleSlug: slug, chapterSlug: slugChapter };
      }
    }

    const sectionCount = typeof fm.section_count === 'number'
      ? (fm.section_count as number)
      : sectionNumbers.length;
    totalSections += sectionCount;
    chapters.push({
      slug: slugChapter,
      number: chapterNumber,
      heading: chapterHeading,
      sectionCount,
    });
  }

  return {
    slug,
    number,
    heading,
    positiveLaw,
    chapters,
    totalSections,
  };
}

async function main() {
  const dirs = await readdir(ROOT);
  const titles: TitleEntry[] = [];
  const sectionsMap: SectionsMap = {};
  for (const d of dirs.sort()) {
    const full = path.join(ROOT, d);
    const s = await stat(full);
    if (!s.isDirectory()) continue;
    const t = await buildTitle(full, sectionsMap);
    if (t) titles.push(t);
  }

  // Sort by numeric title where possible (handle "5a" etc by lexical fallback).
  titles.sort((a, b) => {
    const na = parseInt(a.number, 10);
    const nb = parseInt(b.number, 10);
    if (Number.isNaN(na) || Number.isNaN(nb)) return a.slug.localeCompare(b.slug);
    if (na !== nb) return na - nb;
    return a.number.localeCompare(b.number);
  });

  const totals = titles.reduce(
    (acc, t) => {
      acc.chapters += t.chapters.length;
      acc.sections += t.totalSections;
      return acc;
    },
    { titles: titles.length, chapters: 0, sections: 0 },
  );

  const idx: Index = {
    generatedAt: new Date().toISOString(),
    titles,
    totals,
  };

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(idx));
  const kb = (JSON.stringify(idx).length / 1024).toFixed(1);
  console.log(
    `Indexed ${totals.titles} titles, ${totals.chapters} chapters, ${totals.sections} sections (${kb} KB) → ${path.relative(process.cwd(), OUT)}`,
  );

  await mkdir(path.dirname(SECTIONS_OUT), { recursive: true });
  const sectionsStr = JSON.stringify(sectionsMap);
  await writeFile(SECTIONS_OUT, sectionsStr);
  const sectionsKb = (sectionsStr.length / 1024).toFixed(1);
  console.log(
    `Resolver  ${Object.keys(sectionsMap).length.toLocaleString()} section keys (${sectionsKb} KB) → ${path.relative(process.cwd(), SECTIONS_OUT)}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
