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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

import { TooltipExample } from './TooltipExample';

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

const sheetExample = (
  <Sheet>
    <SheetTrigger asChild>
      <Button variant="secondary" data-testid="playground-open-sheet">
        Open sheet
      </Button>
    </SheetTrigger>
    <SheetContent data-testid="playground-sheet-content">
      <SheetHeader>
        <SheetTitle>Sheet title</SheetTitle>
        <SheetDescription>Side panel, same focus rules as Dialog.</SheetDescription>
      </SheetHeader>
    </SheetContent>
  </Sheet>
);

const popoverExample = (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="secondary" data-testid="playground-open-popover">
        Open popover
      </Button>
    </PopoverTrigger>
    <PopoverContent data-testid="playground-popover-content">
      <p>Popover content</p>
      <Button variant="ghost" data-testid="playground-popover-action">
        Action
      </Button>
    </PopoverContent>
  </Popover>
);

const dropdownMenuExample = (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="secondary" data-testid="playground-open-dropdown">
        Open menu
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent data-testid="playground-dropdown-content">
      <DropdownMenuItem>First item</DropdownMenuItem>
      <DropdownMenuItem>Second item</DropdownMenuItem>
      <DropdownMenuItem>Third item</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
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
    component: <TooltipExample />,
    code: `<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild><Button>Trigger</Button></TooltipTrigger>
    <TooltipContent>Tooltip text</TooltipContent>
  </Tooltip>
</TooltipProvider>`,
  },
  {
    id: 'ui-sheet',
    name: 'Sheet (ui)',
    category: 'overlay',
    description:
      'Side panel (MapSettingsSheet / SessionConsoleEditorSheet migrate here in plan 004)',
    component: sheetExample,
    code: `<Sheet><SheetTrigger asChild><Button>Open</Button></SheetTrigger>
  <SheetContent side="right" data-testid="sheet-example-root">…</SheetContent></Sheet>`,
  },
  {
    id: 'ui-popover',
    name: 'Popover (ui)',
    category: 'overlay',
    description: 'Non-modal popover for colour pickers and token quick-actions',
    component: popoverExample,
    code: `<Popover><PopoverTrigger asChild><Button>Open</Button></PopoverTrigger>
  <PopoverContent>…</PopoverContent></Popover>`,
  },
  {
    id: 'ui-dropdown-menu',
    name: 'Dropdown menu (ui)',
    category: 'overlay',
    description: 'Keyboard-navigable menu for token and map context actions',
    component: dropdownMenuExample,
    code: `<DropdownMenu><DropdownMenuTrigger asChild><Button>Menu</Button></DropdownMenuTrigger>
  <DropdownMenuContent><DropdownMenuItem>Item</DropdownMenuItem></DropdownMenuContent></DropdownMenu>`,
  },
];
