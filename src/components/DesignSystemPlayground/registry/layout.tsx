import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type { ComponentExample } from '../types';

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
];
