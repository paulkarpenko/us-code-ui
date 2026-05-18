import * as RSA from '@radix-ui/react-scroll-area';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function ScrollArea({
  children,
  className,
  viewportClassName,
  viewportRef,
  orientation = 'both',
}: {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
  viewportRef?: React.Ref<HTMLDivElement>;
  /** Which scrollbars to render. Defaults to both axes. */
  orientation?: 'vertical' | 'horizontal' | 'both';
}) {
  return (
    <RSA.Root className={cn('overflow-hidden', className)}>
      <RSA.Viewport
        ref={viewportRef}
        className={cn('h-full w-full', viewportClassName)}
      >
        {children}
      </RSA.Viewport>
      {(orientation === 'vertical' || orientation === 'both') && (
        <RSA.Scrollbar
          orientation="vertical"
          className="flex w-2 touch-none select-none p-0.5 transition-colors hover:bg-surface-2/60"
        >
          <RSA.Thumb className="relative flex-1 rounded-full bg-border-strong/60 hover:bg-border-strong" />
        </RSA.Scrollbar>
      )}
      {(orientation === 'horizontal' || orientation === 'both') && (
        <RSA.Scrollbar
          orientation="horizontal"
          className="flex flex-col h-2 touch-none select-none p-0.5 transition-colors hover:bg-surface-2/60"
        >
          <RSA.Thumb className="relative flex-1 rounded-full bg-border-strong/60 hover:bg-border-strong" />
        </RSA.Scrollbar>
      )}
      <RSA.Corner />
    </RSA.Root>
  );
}
