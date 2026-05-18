import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { Tooltip } from './ui/Tooltip';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <Tooltip content={dark ? 'Switch to light' : 'Switch to dark'}>
      <button
        type="button"
        onClick={toggle}
        aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
      >
        {dark ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
      </button>
    </Tooltip>
  );
}
