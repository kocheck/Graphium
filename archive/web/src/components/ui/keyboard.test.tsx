import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Button } from './button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

function DialogFixture(): JSX.Element {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open</Button>
      </DialogTrigger>
      <DialogContent data-testid="dialog-root">
        <DialogTitle>Title</DialogTitle>
        <DialogDescription>Description</DialogDescription>
        <Button>Cancel</Button>
        <Button>Confirm</Button>
      </DialogContent>
    </Dialog>
  );
}

describe('Dialog keyboard behaviour', () => {
  it('Escape closes and focus returns to the trigger', async () => {
    const user = userEvent.setup();
    render(<DialogFixture />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);
    expect(await screen.findByTestId('dialog-root')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('Tab stays inside the open dialog', async () => {
    const user = userEvent.setup();
    render(<DialogFixture />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const root = await screen.findByTestId('dialog-root');
    for (let i = 0; i < 6; i += 1) {
      await user.tab();
      expect(root.contains(document.activeElement)).toBe(true);
    }
  });
});

describe('DropdownMenu keyboard behaviour', () => {
  it('ArrowDown moves focus through the items', async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Menu</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>First</DropdownMenuItem>
          <DropdownMenuItem>Second</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    screen.getByRole('button', { name: 'Menu' }).focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('menu');
    // Radix focuses the first item itself when the menu opens from the keyboard.
    expect(screen.getByRole('menuitem', { name: 'First' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Second' })).toHaveFocus();
  });
});

describe('Tooltip keyboard behaviour', () => {
  it('opens when the trigger receives focus', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button>Trigger</Button>
          </TooltipTrigger>
          <TooltipContent>Tip</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    await user.tab();
    expect(screen.getByRole('button', { name: 'Trigger' })).toHaveFocus();
    expect((await screen.findAllByText('Tip')).length).toBeGreaterThanOrEqual(1);
  });
});
