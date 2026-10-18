import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Dialog, DialogContent, DialogTitle } from './dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Sheet, SheetContent, SheetTitle } from './sheet';

const OWNER = '[data-esc-owns="true"]';

const cases: Array<[name: string, render: (ownsEscape: boolean) => JSX.Element]> = [
  [
    'DialogContent',
    (ownsEscape) => (
      <Dialog open>
        <DialogContent ownsEscape={ownsEscape}>
          <DialogTitle>t</DialogTitle>
        </DialogContent>
      </Dialog>
    ),
  ],
  [
    'SheetContent',
    (ownsEscape) => (
      <Sheet open>
        <SheetContent ownsEscape={ownsEscape}>
          <SheetTitle>t</SheetTitle>
        </SheetContent>
      </Sheet>
    ),
  ],
  [
    'PopoverContent',
    (ownsEscape) => (
      <Popover open>
        <PopoverTrigger>t</PopoverTrigger>
        <PopoverContent ownsEscape={ownsEscape}>c</PopoverContent>
      </Popover>
    ),
  ],
  [
    'DropdownMenuContent',
    (ownsEscape) => (
      <DropdownMenu open>
        <DropdownMenuTrigger>t</DropdownMenuTrigger>
        <DropdownMenuContent ownsEscape={ownsEscape}>
          <DropdownMenuItem>i</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  ],
];

describe.each(cases)('%s claims the global Escape', (_name, renderCase) => {
  it('renders data-esc-owns="true" by default', () => {
    const view = render(renderCase(true));
    expect(document.querySelector(OWNER)).not.toBeNull();
    view.unmount();
    expect(document.querySelector(OWNER)).toBeNull();
  });

  it('renders no data-esc-owns with ownsEscape={false}', () => {
    const view = render(renderCase(false));
    expect(document.querySelector(OWNER)).toBeNull();
    view.unmount();
  });
});
