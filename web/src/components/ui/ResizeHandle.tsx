import { cn } from '@/lib/cn';

/*
 * A thin draggable separator that lives on the inner edge of a resizable
 * panel. Wide enough to grab (6px) but only the centerline shows on hover,
 * so it doesn't visually crowd the panel border.
 */
export function ResizeHandle({
  side,
  handleProps,
}: {
  side: 'left' | 'right';
  handleProps: React.HTMLAttributes<HTMLDivElement>;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize · double-click to reset"
      {...handleProps}
      className={cn(
        'absolute top-0 bottom-0 w-1.5 z-30 cursor-col-resize group',
        side === 'right' ? '-right-[3px]' : '-left-[3px]',
      )}
    >
      <div
        className={cn(
          'absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px',
          'bg-transparent group-hover:bg-accent group-active:bg-accent transition-colors',
        )}
      />
    </div>
  );
}
