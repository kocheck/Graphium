import { buttonExamples } from './buttons';
import { formExamples } from './forms';
import { layoutExamples } from './layout';
import { legacyCategories, legacyExamples } from './legacy';
import { overlayExamples } from './overlays';

import type { ComponentCategory, ComponentExample } from '../types';

/** New categories for src/components/ui primitives. Legacy categories stay first. */
export const categories: ComponentCategory[] = [
  ...legacyCategories,
  {
    id: 'overlay',
    name: 'Overlays (ui)',
    description: 'Dialog, sheet, popover, dropdown menu, tooltip',
  },
  {
    id: 'form',
    name: 'Form controls (ui)',
    description: 'Input, label, switch, select, slider',
  },
  {
    id: 'layout',
    name: 'Layout (ui)',
    description: 'Tabs, collapsible, separator, theme bridge probe',
  },
];

export const componentExamples: ComponentExample[] = [
  ...legacyExamples,
  ...buttonExamples,
  ...overlayExamples,
  ...formExamples,
  ...layoutExamples,
];
