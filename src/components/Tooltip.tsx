/**
 * Tooltip adapter — same props API as before, rendered on the `tooltip` primitive.
 * Keeps the `inline-flex` wrapper so flex toolbars lay out exactly as they did; opening on
 * focus and flipping at viewport edges are accepted improvements (CONVENTIONS §9).
 */

import type { JSX, ReactNode } from 'react';

import {
  Tooltip as TooltipRoot,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TooltipProps {
  content: string;
  children: ReactNode;
  delay?: number; // Delay in milliseconds before showing tooltip
  offset?: number; // Distance in pixels from the top of the element to the top of the tooltip
}

/** The old tooltip box was ~36px tall; sideOffset is the visible gap, so subtract it. */
const OLD_BOX_HEIGHT = 36;
const MIN_GAP = 4;

function Tooltip({ content, children, delay = 100, offset = 50 }: TooltipProps): JSX.Element {
  return (
    <TooltipProvider delayDuration={delay}>
      <TooltipRoot>
        <TooltipTrigger asChild>
          <span className="inline-flex">{children}</span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={Math.max(MIN_GAP, offset - OLD_BOX_HEIGHT)}>
          {content}
        </TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  );
}

export default Tooltip;
