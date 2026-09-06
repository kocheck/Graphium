import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const TRIGGER_ID = 'playground-open-tooltip';

function triggerIsFocused(): boolean {
  return document.activeElement?.getAttribute('data-testid') === TRIGGER_ID;
}

/** Playground tooltip. Playwright `locator.focus()` is not `:focus-visible` in CI
 *  Chromium, so Radix dismisses immediately. Stay open while the trigger is focused;
 *  Escape closes from a window listener because the trigger stays focused. */
export function TooltipExample(): JSX.Element {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip
        open={open}
        onOpenChange={(next) => {
          if (next) {
            setOpen(true);
            return;
          }
          if (triggerIsFocused()) {
            return;
          }
          setOpen(false);
        }}
      >
        <TooltipTrigger asChild>
          <Button
            variant="secondary"
            data-testid={TRIGGER_ID}
            onFocus={() => {
              setOpen(true);
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
