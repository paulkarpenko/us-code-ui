export interface ChapterMeta {
  slug: string;
  number: string;
  heading: string;
  sectionCount: number;
}

export interface TitleMeta {
  slug: string;
  number: string;
  heading: string;
  positiveLaw?: boolean;
  chapters: ChapterMeta[];
  totalSections: number;
}

export interface CodeIndex {
  generatedAt: string;
  titles: TitleMeta[];
  totals: { titles: number; chapters: number; sections: number };
  /** Whether the server has ANTHROPIC_API_KEY configured. Drives Explain panel UX. */
  hasApiKey: boolean;
}

export interface SectionRef {
  id: string;
  number: string;
  heading: string;
}

export interface ChapterDoc {
  frontmatter: Record<string, unknown>;
  content: string;
  sections: SectionRef[];
}

export interface SearchHit {
  titleSlug: string;
  titleNumber: string;
  titleHeading: string;
  chapterSlug: string;
  chapterNumber: string;
  chapterHeading: string;
  score: number;
}
