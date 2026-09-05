import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import type { ComponentExample } from '../types';

const dialogExample = (
  <Dialog>
    <DialogTrigger asChild>
      <Button variant="secondary" data-testid="playground-open-dialog">
        Open dialog
      </Button>
    </DialogTrigger>
    <DialogContent data-testid="playground-dialog-content">
      <DialogHeader>
        <DialogTitle>Dialog title</DialogTitle>
        <DialogDescription>Escape closes; focus returns to the trigger.</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="ghost" data-testid="playground-dialog-cancel">
          Cancel
        </Button>
        <Button data-testid="playground-dialog-confirm">Confirm</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const tooltipExample = (
  <TooltipProvider delayDuration={0}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="secondary" data-testid="playground-open-tooltip">
          Hover or focus me
        </Button>
      </TooltipTrigger>
      <TooltipContent data-testid="playground-tooltip-content">Tooltip text</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export const overlayExamples: ComponentExample[] = [
  {
    id: 'ui-dialog',
    name: 'Dialog (ui)',
    category: 'overlay',
    description: 'Radix dialog: focus trap, Escape, focus restore, data-esc-owns',
    component: dialogExample,
    code: `<Dialog>
  <DialogTrigger asChild><Button>Open</Button></DialogTrigger>
  <DialogContent data-testid="dialog-example-root">
    <DialogHeader><DialogTitle>Title</DialogTitle></DialogHeader>
  </DialogContent>
</Dialog>`,
  },
  {
    id: 'ui-tooltip',
    name: 'Tooltip (ui)',
    category: 'overlay',
    description: 'Radix tooltip: opens on hover and focus, flips at viewport edges',
    component: tooltipExample,
    code: `<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild><Button>Trigger</Button></TooltipTrigger>
    <TooltipContent>Tooltip text</TooltipContent>
  </Tooltip>
</TooltipProvider>`,
  },
];
