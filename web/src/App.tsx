import { useEffect, useMemo, useState } from 'react';
import { Routes, Route, useMatch } from 'react-router-dom';
import { Header } from './components/Layout';
import { TitleSidebar } from './components/TitleSidebar';
import { ChapterView } from './components/ChapterView';
import { TitleOverview } from './components/TitleOverview';
import { HomeView } from './components/HomeView';
import {
  FeynmanPanel,
  type FeynmanRequest,
  type FeynmanLocation,
} from './components/FeynmanPanel';
import { SearchPalette } from './components/SearchPalette';
import { GlobalExplainSelection } from './components/GlobalExplainSelection';
import { TooltipProvider } from './components/ui/Tooltip';
import { api } from './lib/api';
import type { CodeIndex } from './lib/types';

export function App() {
  const [index, setIndex] = useState<CodeIndex | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.index()
      .then((i) => { if (!cancelled) setIndex(i); })
      .catch((e) => { if (!cancelled) setIndexError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, []);

  if (indexError) {
    return (
      <div className="flex h-full items-center justify-center text-fg-muted">
        Failed to load index: {indexError}
      </div>
    );
  }

  if (!index) {
    return (
      <div className="flex h-full items-center justify-center text-fg-subtle">
        Loading the U.S. Code…
      </div>
    );
  }

  // Shell is mounted only once the index has loaded, so it can seed
  // panel-visibility state from `index.hasApiKey` without flashing.
  return <Shell index={index} />;
}

function Shell({ index }: { index: CodeIndex }) {
  const [searchOpen, setSearchOpen] = useState(false);
  // Default: open when the Explain panel can actually work; collapsed
  // otherwise (the panel itself surfaces the missing-key hint when toggled
  // open manually).
  const [feynmanOpen, setFeynmanOpen] = useState<boolean>(index.hasApiKey);
  const [request, setRequest] = useState<FeynmanRequest | null>(null);
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      } else if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault();
        setFeynmanOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleExplain = (
    concept: string,
    opts?: { excerpt?: string; location?: FeynmanLocation },
  ) => {
    setFeynmanOpen(true);
    setRequest({ concept, excerpt: opts?.excerpt, location: opts?.location });
    setRequestKey((k) => k + 1);
  };

  /*
   * The Explain panel lives outside <Routes>, so it can't use useParams().
   * Match the chapter route here and resolve title/chapter from the loaded
   * index, then hand the panel a stable "current location" object.
   */
  const chapterMatch = useMatch('/title/:titleSlug/:chapterSlug');
  const titleMatch = useMatch('/title/:titleSlug');
  const feynmanLocation = useMemo<FeynmanLocation | null>(() => {
    const titleSlug = chapterMatch?.params.titleSlug ?? titleMatch?.params.titleSlug;
    if (!titleSlug) return null;
    const t = index.titles.find((x) => x.slug === titleSlug);
    if (!t) return null;
    const chapterSlug = chapterMatch?.params.chapterSlug;
    const c = chapterSlug ? t.chapters.find((x) => x.slug === chapterSlug) : undefined;
    return {
      titleSlug: t.slug,
      titleNumber: t.number,
      titleHeading: t.heading,
      chapterSlug: c?.slug,
      chapterNumber: c?.number,
      chapterHeading: c?.heading,
    };
  }, [index, chapterMatch, titleMatch]);

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        <Header
          onOpenSearch={() => setSearchOpen(true)}
          feynmanOpen={feynmanOpen}
          onToggleFeynman={() => setFeynmanOpen((v) => !v)}
        />
        <div className="flex flex-1 min-h-0">
          <TitleSidebar index={index} onExplain={handleExplain} />
          <main className="flex flex-1 min-w-0">
            <Routes>
              <Route
                path="/"
                element={<HomeView index={index} onOpenSearch={() => setSearchOpen(true)} />}
              />
              <Route
                path="/title/:titleSlug"
                element={<TitleOverview index={index} onExplain={handleExplain} />}
              />
              <Route
                path="/title/:titleSlug/:chapterSlug"
                element={<ChapterView index={index} onExplain={handleExplain} />}
              />
            </Routes>
          </main>
          {feynmanOpen && (
            <FeynmanPanel
              location={feynmanLocation}
              hasApiKey={index.hasApiKey}
              request={request}
              requestKey={requestKey}
              onCollapse={() => setFeynmanOpen(false)}
            />
          )}
        </div>
        <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} />
        <GlobalExplainSelection onExplain={handleExplain} />
      </div>
    </TooltipProvider>
  );
}
