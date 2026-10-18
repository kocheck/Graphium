import { Button } from '@/components/ui/button';

import type { ComponentExample } from '../types';

const toolbarButtons = (
  <div className="flex flex-wrap items-center gap-2">
    <Button variant="tool" size="tool">
      Tool
    </Button>
    <Button variant="tool" size="tool" active>
      Tool active
    </Button>
    <Button variant="tool" size="tool" state="paused">
      Paused
    </Button>
    <Button variant="tool" size="tool" state="running">
      Running
    </Button>
    <Button variant="mode" size="mode">
      Mode
    </Button>
    <Button variant="mode" size="mode" active>
      Mode active
    </Button>
    <Button variant="broadcast" size="mode">
      Broadcast
    </Button>
    <Button variant="broadcast" size="mode" active>
      Broadcasting
    </Button>
  </div>
);

export const buttonExamples: ComponentExample[] = [
  {
    id: 'ui-button',
    name: 'Button (ui)',
    category: 'button',
    description:
      'shadcn Button: default (.btn-primary), secondary (.btn-default), ghost (.btn), destructive, outline, link',
    component: (
      <div className="flex flex-wrap items-center gap-2">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="link">Link</Button>
        <Button disabled>Disabled</Button>
      </div>
    ),
    code: `import { Button } from '@/components/ui/button';

<Button>Default</Button>
<Button variant="secondary">Secondary</Button>`,
  },
  {
    id: 'ui-button-toolbar',
    name: 'Button toolbar variants (ui)',
    category: 'button',
    description:
      'tool / mode / broadcast variants with active and state, matching .btn-tool, .btn-mode, .btn-broadcast',
    component: toolbarButtons,
    code: `<Button variant="tool" size="tool" active>Tool</Button>
<Button variant="tool" size="tool" state="paused">Paused</Button>
<Button variant="broadcast" size="mode" active>Broadcasting</Button>`,
  },
];
