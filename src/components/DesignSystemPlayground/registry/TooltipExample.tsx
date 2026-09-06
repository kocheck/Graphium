import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/** Playground tooltip. Playwright `locator.focus()` is not `:focus-visible` in CI
 *  Chromium, so Radix closes immediately; reopen on the next microtask. Escape still
 *  goes through `onOpenChange(false)` because that is not a second focus event. */
export function TooltipExample(): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <Button
            variant="secondary"
            data-testid="playground-open-tooltip"
            onFocus={() => {
              queueMicrotask(() => setOpen(true));
            }}
          >
            Hover or focus me
          </Button>
        </TooltipTrigger>
        <TooltipContent data-testid="playground-tooltip-content">Tooltip text</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
