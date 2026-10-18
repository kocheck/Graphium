import type React from 'react';

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
  {
    id: 'motion',
    name: 'Motion',
    description: 'Duration and easing tokens, with the reduced-motion twin',
  },
];

export const componentExamples: ComponentExample[] = [
  ...legacyExamples,
  ...buttonExamples,
  ...overlayExamples,
  ...formExamples,
  ...layoutExamples,
  {
    id: 'readout',
    name: 'Readout',
    category: 'typography',
    description: 'Numeric readout in the direction readout face (brief §2.1, §2.4)',
    component: (
      <div
        data-testid="playground-readout"
        className="inline-flex items-baseline gap-3 px-3 py-2 border border-[var(--app-border-default)] bg-[var(--app-bg-surface)] text-[var(--app-text-primary)]"
        style={{
          fontFamily: 'var(--app-font-family-readout, "IBM Plex Mono", monospace)',
          fontSize: 'var(--app-font-size-readout, 13px)',
          fontWeight: 'var(--app-font-weight-readout, 500)' as React.CSSProperties['fontWeight'],
        }}
      >
        <span>GRID 70 px</span>
        <span>1,024 tokens</span>
        <span>02:14:09</span>
      </div>
    ),
    code: `<div data-testid="playground-readout" style={{ fontFamily: 'var(--app-font-family-readout)' }}>…</div>`,
    tags: ['readout', 'mono', 'numeral'],
  },
  {
    id: 'motion-press',
    name: 'Press',
    category: 'motion',
    description:
      'Active state animates with --app-duration-fast / --app-ease-standard; zero under prefers-reduced-motion',
    component: (
      <button
        type="button"
        data-testid="playground-motion-press"
        className="px-4 py-2 border border-[var(--app-border-default)] bg-[var(--app-bg-surface)] text-[var(--app-text-primary)] active:bg-[var(--app-bg-active)] active:[box-shadow:var(--app-elevation-active,none)]"
        style={{
          transition:
            'background-color var(--app-duration-fast, 120ms) var(--app-ease-standard, ease-out), box-shadow var(--app-duration-fast, 120ms) var(--app-ease-standard, ease-out)',
        }}
      >
        Press and hold
      </button>
    ),
    code: `<button style={{ transition: 'background-color var(--app-duration-fast) var(--app-ease-standard)' }}>Press and hold</button>`,
    tags: ['motion', 'duration', 'easing', 'reduced-motion'],
  },
];
