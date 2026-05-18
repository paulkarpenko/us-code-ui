import * as RT from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RT.Provider delayDuration={250} skipDelayDuration={100}>{children}</RT.Provider>;
}

export function Tooltip({
  content,
  children,
  side = 'bottom',
  align = 'center',
}: {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
}) {
  return (
    <RT.Root>
      <RT.Trigger asChild>{children}</RT.Trigger>
      <RT.Portal>
        <RT.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cn(
            'z-50 rounded-md px-2 py-1 text-[12px]',
            'bg-fg text-canvas shadow-sm',
          )}
        >
          {content}
          <RT.Arrow className="fill-fg" />
        </RT.Content>
      </RT.Portal>
    </RT.Root>
  );
}
