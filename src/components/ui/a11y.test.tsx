import { render } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';

import { Button } from './button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Input } from './input';
import { Label } from './label';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Separator } from './separator';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from './sheet';
import { Slider } from './slider';
import { Switch } from './switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

const cases: Array<[name: string, element: JSX.Element]> = [
  [
    'button',
    <div key="b">
      <Button>Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="tool" size="tool" active>
        Tool
      </Button>
      <Button variant="broadcast" size="mode" state="running">
        Broadcast
      </Button>
    </div>,
  ],
  [
    'dialog (open)',
    <Dialog key="d" open>
      <DialogContent>
        <DialogTitle>Title</DialogTitle>
        <DialogDescription>Description</DialogDescription>
        <Button>Ok</Button>
      </DialogContent>
    </Dialog>,
  ],
  [
    'tooltip (open)',
    <TooltipProvider key="t">
      <Tooltip open>
        <TooltipTrigger asChild>
          <Button>Trigger</Button>
        </TooltipTrigger>
        <TooltipContent>Tip</TooltipContent>
      </Tooltip>
    </TooltipProvider>,
  ],
  [
    'input + label',
    <div key="i">
      <Label htmlFor="a11y-input">Name</Label>
      <Input id="a11y-input" />
    </div>,
  ],
  [
    'switch',
    <div key="sw">
      <Label htmlFor="a11y-switch">Snap</Label>
      <Switch id="a11y-switch" />
    </div>,
  ],
  [
    'select (open)',
    <Select key="se" open defaultValue="a">
      <SelectTrigger aria-label="Grid">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="a">A</SelectItem>
        <SelectItem value="b">B</SelectItem>
      </SelectContent>
    </Select>,
  ],
  ['slider', <Slider key="sl" defaultValue={[50]} thumbLabel="Opacity" />],
  [
    'tabs',
    <Tabs key="ta" defaultValue="one">
      <TabsList>
        <TabsTrigger value="one">One</TabsTrigger>
        <TabsTrigger value="two">Two</TabsTrigger>
      </TabsList>
      <TabsContent value="one">One</TabsContent>
      <TabsContent value="two">Two</TabsContent>
    </Tabs>,
  ],
  [
    'collapsible (open)',
    <Collapsible key="c" open>
      <CollapsibleTrigger asChild>
        <Button>Toggle</Button>
      </CollapsibleTrigger>
      <CollapsibleContent>Content</CollapsibleContent>
    </Collapsible>,
  ],
  ['separator', <Separator key="sp" />],
  [
    'sheet (open)',
    <Sheet key="sh" open>
      <SheetContent>
        <SheetTitle>Title</SheetTitle>
        <SheetDescription>Description</SheetDescription>
      </SheetContent>
    </Sheet>,
  ],
  [
    'popover (open)',
    <Popover key="p" open>
      <PopoverTrigger asChild>
        <Button>Trigger</Button>
      </PopoverTrigger>
      <PopoverContent>Content</PopoverContent>
    </Popover>,
  ],
  [
    'dropdown-menu (open)',
    <DropdownMenu key="dm" open>
      <DropdownMenuTrigger asChild>
        <Button>Menu</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Item</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>,
  ],
];

describe.each(cases)(
  '%s has no axe violations (WCAG 2.1 AA, contrast excluded)',
  (_name, element) => {
    it('passes', async () => {
      const view = render(element);
      const results = await axe.run(document.body, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
        rules: { 'color-contrast': { enabled: false } },
      });
      expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      view.unmount();
    });
  },
);
