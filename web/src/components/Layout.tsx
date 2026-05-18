import { Link } from 'react-router-dom';
import { Lightbulb, Scale, Search } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { Tooltip } from './ui/Tooltip';
import { cn } from '@/lib/cn';

export function Header({
  onOpenSearch,
  feynmanOpen,
  onToggleFeynman,
}: {
  onOpenSearch: () => void;
  feynmanOpen: boolean;
  onToggleFeynman: () => void;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <Link to="/" className="flex items-center gap-2 group">
        <Scale size={16} className="text-accent" strokeWidth={2} />
        <span className="text-[13.5px] font-semibold tracking-tight text-fg group-hover:text-fg">
          U.S. Code
        </span>
        <span className="hidden sm:inline text-[11px] text-fg-subtle">
          read & understand
        </span>
      </Link>

      <div className="flex-1" />

      <button
        onClick={onOpenSearch}
        className={cn(
          'flex items-center gap-2 rounded-md border border-border bg-surface-2/60',
          'px-2.5 py-1.5 text-[12px] text-fg-subtle hover:text-fg hover:border-border-strong transition',
        )}
      >
        <Search size={12} strokeWidth={2} />
        <span>Search</span>
        <kbd className="ml-2 font-mono text-[10.5px] border border-border bg-surface px-1 py-px rounded">
          ⌘K
        </kbd>
      </button>

      <Tooltip content={feynmanOpen ? 'Hide explain panel' : 'Show explain panel'}>
        <button
          onClick={onToggleFeynman}
          aria-pressed={feynmanOpen}
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
            feynmanOpen
              ? 'bg-accent-soft text-accent'
              : 'text-fg-muted hover:text-fg hover:bg-surface-2',
          )}
        >
          <Lightbulb size={15} strokeWidth={1.75} />
        </button>
      </Tooltip>

      <ThemeToggle />
    </header>
  );
}
