import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import type { ComponentExample } from '../types';

export const formExamples: ComponentExample[] = [
  {
    id: 'ui-input',
    name: 'Input + Label (ui)',
    category: 'form',
    description: 'Text input with an associated label',
    component: (
      <div className="grid w-64 gap-1.5">
        <Label htmlFor="ui-input-example">Campaign name</Label>
        <Input id="ui-input-example" placeholder="Untitled campaign" />
      </div>
    ),
    code: `<Label htmlFor="name">Campaign name</Label>
<Input id="name" placeholder="Untitled campaign" />`,
  },
  {
    id: 'ui-label',
    name: 'Label (ui)',
    category: 'form',
    description: 'Radix label; disabled peer styling',
    component: <Label>Standalone label</Label>,
    code: `<Label htmlFor="field">Label</Label>`,
  },
];
