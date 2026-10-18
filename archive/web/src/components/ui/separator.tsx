'use client';

import type * as React from 'react';

import { Separator as SeparatorPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

type SeparatorProps = React.ComponentProps<typeof SeparatorPrimitive.Root> & {
  /** 'toolbar' reproduces `.toolbar-divider w-px mx-1` from App.tsx (vertical, no fixed height). */
  variant?: 'default' | 'toolbar';
};

function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  variant = 'default',
  ...props
}: SeparatorProps): JSX.Element {
  const isToolbar = variant === 'toolbar';
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={isToolbar ? 'vertical' : orientation}
      className={cn(
        isToolbar
          ? 'mx-1 w-px shrink-0 bg-border'
          : 'shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
export type { SeparatorProps };
