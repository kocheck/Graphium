import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

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
  {
    id: 'ui-switch',
    name: 'Switch (ui)',
    category: 'form',
    description: 'Radix switch (replaces ToggleSwitch.tsx in plan 004)',
    component: (
      <div className="flex items-center gap-2">
        <Switch id="ui-switch-example" defaultChecked />
        <Label htmlFor="ui-switch-example">Snap to grid</Label>
      </div>
    ),
    code: `<Switch id="snap" checked={value} onCheckedChange={setValue} />`,
  },
  {
    id: 'ui-select',
    name: 'Select (ui)',
    category: 'form',
    description: 'Radix select (replaces the native <select> in MapSettingsSheet in plan 004)',
    component: (
      <Select defaultValue="square">
        <SelectTrigger className="w-48" data-testid="playground-open-select" aria-label="Grid type">
          <SelectValue placeholder="Grid type" />
        </SelectTrigger>
        <SelectContent data-testid="playground-select-content">
          <SelectItem value="square">Square</SelectItem>
          <SelectItem value="hex">Hex</SelectItem>
          <SelectItem value="none">None</SelectItem>
        </SelectContent>
      </Select>
    ),
    code: `<Select value={v} onValueChange={setV}>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent><SelectItem value="square">Square</SelectItem></SelectContent>
</Select>`,
  },
  {
    id: 'ui-slider',
    name: 'Slider (ui)',
    category: 'form',
    description: 'Radix slider for grid size, opacity, audio volume',
    component: (
      <Slider defaultValue={[50]} max={100} step={1} className="w-64" thumbLabel="Opacity" />
    ),
    code: `<Slider value={[opacity]} onValueChange={([v]) => setOpacity(v)} max={100} />`,
  },
];
