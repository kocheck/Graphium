import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type { ComponentExample } from '../types';

/** One row per bridge token: the shadcn utility and the --app-* value it must equal. */
const BRIDGE_PROBES: ReadonlyArray<{ token: string; utility: string; expected: string }> = [
  { token: 'background', utility: 'bg-background', expected: 'bg-[var(--app-bg-base)]' },
  { token: 'foreground', utility: 'bg-foreground', expected: 'bg-[var(--app-text-primary)]' },
  { token: 'card', utility: 'bg-card', expected: 'bg-[var(--app-bg-surface)]' },
  {
    token: 'card-foreground',
    utility: 'bg-card-foreground',
    expected: 'bg-[var(--app-text-primary)]',
  },
  { token: 'popover', utility: 'bg-popover', expected: 'bg-[var(--app-bg-surface)]' },
  {
    token: 'popover-foreground',
    utility: 'bg-popover-foreground',
    expected: 'bg-[var(--app-text-primary)]',
  },
  { token: 'primary', utility: 'bg-primary', expected: 'bg-[var(--app-accent-solid)]' },
  {
    token: 'primary-foreground',
    utility: 'bg-primary-foreground',
    expected: 'bg-[var(--app-accent-solid-text)]',
  },
  { token: 'secondary', utility: 'bg-secondary', expected: 'bg-[var(--app-bg-active)]' },
  {
    token: 'secondary-foreground',
    utility: 'bg-secondary-foreground',
    expected: 'bg-[var(--app-text-primary)]',
  },
  { token: 'muted', utility: 'bg-muted', expected: 'bg-[var(--app-bg-subtle)]' },
  {
    token: 'muted-foreground',
    utility: 'bg-muted-foreground',
    expected: 'bg-[var(--app-text-secondary)]',
  },
  { token: 'accent', utility: 'bg-accent', expected: 'bg-[var(--app-bg-hover)]' },
  {
    token: 'accent-foreground',
    utility: 'bg-accent-foreground',
    expected: 'bg-[var(--app-text-primary)]',
  },
  { token: 'destructive', utility: 'bg-destructive', expected: 'bg-[var(--app-error-solid)]' },
  {
    token: 'destructive-foreground',
    utility: 'bg-destructive-foreground',
    expected: 'bg-[var(--app-accent-solid-text)]',
  },
  { token: 'border', utility: 'bg-border', expected: 'bg-[var(--app-border-subtle)]' },
  { token: 'input', utility: 'bg-input', expected: 'bg-[var(--app-border-default)]' },
  { token: 'ring', utility: 'bg-ring', expected: 'bg-[var(--app-accent-solid)]' },
];

const bridgeProbe = (
  <div className="flex flex-wrap gap-2" data-testid="bridge-probe">
    {BRIDGE_PROBES.map((p) => (
      <div key={p.token} className="flex items-center gap-1" title={p.token}>
        <div
          data-testid={`bridge-swatch-${p.token}`}
          className={`size-4 rounded-sm ${p.utility}`}
        />
        <div
          data-testid={`bridge-expected-${p.token}`}
          className={`size-4 rounded-sm ${p.expected}`}
        />
      </div>
    ))}
    <div data-testid="bridge-swatch-none" className="size-4 bg-[var(--color-does-not-exist)]" />
    <div
      data-testid="bridge-dark-probe"
      className="size-4 bg-[var(--app-bg-base)] dark:bg-[var(--app-accent-solid)]"
    />
    <div data-testid="bridge-dark-ref-light" className="size-4 bg-[var(--app-bg-base)]" />
    <div data-testid="bridge-dark-ref-dark" className="size-4 bg-[var(--app-accent-solid)]" />
  </div>
);

export const layoutExamples: ComponentExample[] = [
  {
    id: 'ui-tabs',
    name: 'Tabs (ui)',
    category: 'layout',
    description: 'Radix tabs (replaces .tab-button in AboutModal in plan 004)',
    component: (
      <Tabs defaultValue="about" className="w-80">
        <TabsList>
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="tutorial">Tutorial</TabsTrigger>
          <TabsTrigger value="shortcuts">Shortcuts</TabsTrigger>
        </TabsList>
        <TabsContent value="about">About panel</TabsContent>
        <TabsContent value="tutorial">Tutorial panel</TabsContent>
        <TabsContent value="shortcuts">Shortcuts panel</TabsContent>
      </Tabs>
    ),
    code: `<Tabs defaultValue="about">
  <TabsList><TabsTrigger value="about">About</TabsTrigger></TabsList>
  <TabsContent value="about">…</TabsContent>
</Tabs>`,
  },
  {
    id: 'ui-collapsible',
    name: 'Collapsible (ui)',
    category: 'layout',
    description: 'Radix collapsible (replaces CollapsibleSection.tsx in plan 004)',
    component: (
      <Collapsible defaultOpen className="w-80">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" data-testid="playground-open-collapsible">
            Section title
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">Section content</CollapsibleContent>
      </Collapsible>
    ),
    code: `<Collapsible open={open} onOpenChange={setOpen}>
  <CollapsibleTrigger asChild><Button variant="ghost">Title</Button></CollapsibleTrigger>
  <CollapsibleContent>…</CollapsibleContent>
</Collapsible>`,
  },
  {
    id: 'ui-separator',
    name: 'Separator (ui)',
    category: 'layout',
    description: 'Horizontal, vertical, and the toolbar variant (.toolbar-divider w-px mx-1)',
    component: (
      <div className="w-80">
        <p>Above</p>
        <Separator className="my-2" />
        <div className="flex h-6 items-center gap-2">
          <span>Tool</span>
          <Separator variant="toolbar" className="h-6" />
          <span>Tool</span>
          <Separator orientation="vertical" />
          <span>Tool</span>
        </div>
      </div>
    ),
    code: `<Separator />
<Separator variant="toolbar" className="h-6" />`,
  },
  {
    id: 'ui-bridge-probe',
    name: 'Theme bridge probe (ui)',
    category: 'layout',
    description:
      'Each bridged shadcn utility next to the --app-* value it must equal (tests/theme-bridge.spec.ts)',
    component: bridgeProbe,
    code: `// bg-primary === bg-[var(--app-accent-solid)] in both themes`,
  },
];
