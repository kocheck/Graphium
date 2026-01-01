/**
 * Playground Registry - Component Examples for Design System
 *
 * This file defines all component examples displayed in the Design System Playground.
 * Each example includes the component instance and its usage code snippet.
 */

import ToggleSwitch from '../ToggleSwitch';
import { ComponentExample, ComponentCategory } from './types';
import { useGameStore } from '../../store/gameStore';
import {
  RiHomeLine,
  RiUserLine,
  RiSettings3Line,
  RiMap2Line,
  RiSwordLine,
  RiGobletLine,
  RiSearchLine
} from '@remixicon/react';

/**
 * Component categories for the playground
 */
export const categories: ComponentCategory[] = [
  {
    id: 'button',
    name: 'Buttons',
    description: 'Primary, secondary, and icon buttons',
  },
  {
    id: 'input',
    name: 'Inputs',
    description: 'Text inputs, search bars, and form controls',
  },
  {
    id: 'toggle',
    name: 'Toggles & Switches',
    description: 'Toggle switches and checkbox replacements',
  },
  {
    id: 'badge',
    name: 'Badges & Tags',
    description: 'Status indicators and labels',
  },
  {
    id: 'modal',
    name: 'Modals & Dialogs',
    description: 'Confirmation dialogs and modal overlays',
  },
  {
    id: 'toast',
    name: 'Toasts',
    description: 'Notification components',
  },
  {
    id: 'typography',
    name: 'Typography',
    description: 'Text styles and heading hierarchy',
  },
  {
    id: 'color',
    name: 'Colors',
    description: 'Theme color palette and variables',
  },
  {
    id: 'icon',
    name: 'Icons',
    description: 'Common UI icons (Remix Icon)',
  },
  {
    id: 'card',
    name: 'Cards',
    description: 'Card components and containers',
  },
];

/**
 * Component examples registry
 */
export const componentExamples: ComponentExample[] = [
  // BUTTONS
  {
    id: 'button-primary',
    name: 'Primary Button',
    category: 'button',
    description: 'Main call-to-action button with accent color',
    component: (
      <button className="px-4 py-2 rounded font-medium transition-all bg-[var(--app-accent-solid)] hover:bg-[var(--app-accent-solid-hover)] text-white shadow-sm">
        Primary Action
      </button>
    ),
    code: `<button className="px-4 py-2 rounded font-medium transition-all bg-[var(--app-accent-solid)] hover:bg-[var(--app-accent-solid-hover)] text-white shadow-sm">
  Primary Action
</button>`,
    tags: ['button', 'primary', 'action'],
  },
  {
    id: 'button-secondary',
    name: 'Secondary Button',
    category: 'button',
    description: 'Secondary action button with subtle styling',
    component: (
      <button className="px-4 py-2 rounded font-medium transition-all bg-[var(--app-bg-surface)] hover:bg-[var(--app-bg-hover)] border border-[var(--app-border-default)] text-[var(--app-text-primary)]">
        Secondary Action
      </button>
    ),
    code: `<button className="px-4 py-2 rounded font-medium transition-all bg-[var(--app-bg-surface)] hover:bg-[var(--app-bg-hover)] border border-[var(--app-border-default)] text-[var(--app-text-primary)]">
  Secondary Action
</button>`,
    tags: ['button', 'secondary'],
  },
  {
    id: 'button-danger',
    name: 'Danger Button',
    category: 'button',
    description: 'Destructive action button (delete, remove, etc.)',
    component: (
      <button className="px-4 py-2 rounded font-medium transition-all bg-[var(--app-error-solid)] hover:bg-[var(--app-error-solid-hover)] text-white shadow-sm">
        Delete
      </button>
    ),
    code: `<button className="px-4 py-2 rounded font-medium transition-all bg-[var(--app-error-solid)] hover:bg-[var(--app-error-solid-hover)] text-white shadow-sm">
  Delete
</button>`,
    tags: ['button', 'danger', 'delete'],
  },
  {
    id: 'button-ghost',
    name: 'Ghost Button',
    category: 'button',
    description: 'Transparent button with border only',
    component: (
      <button className="px-4 py-2 rounded font-medium transition-all border border-[var(--app-border-subtle)] hover:bg-[var(--app-bg-hover)] text-[var(--app-text-primary)]">
        Ghost Button
      </button>
    ),
    code: `<button className="px-4 py-2 rounded font-medium transition-all border border-[var(--app-border-subtle)] hover:bg-[var(--app-bg-hover)] text-[var(--app-text-primary)]">
  Ghost Button
</button>`,
    tags: ['button', 'ghost', 'outline'],
  },

  // INPUTS
  {
    id: 'input-text',
    name: 'Text Input',
    category: 'input',
    description: 'Standard text input field',
    component: (
      <input
        type="text"
        placeholder="Enter text..."
        className="px-3 py-2 rounded bg-[var(--app-bg-surface)] border border-[var(--app-border-default)] text-[var(--app-text-primary)] placeholder-[var(--app-text-muted)] focus:outline-none focus:border-[var(--app-accent-solid)] focus:ring-1 focus:ring-[var(--app-accent-solid)] transition-all"
      />
    ),
    code: `<input
  type="text"
  placeholder="Enter text..."
  className="px-3 py-2 rounded bg-[var(--app-bg-surface)] border border-[var(--app-border-default)] text-[var(--app-text-primary)] placeholder-[var(--app-text-muted)] focus:outline-none focus:border-[var(--app-accent-solid)] focus:ring-1 focus:ring-[var(--app-accent-solid)] transition-all"
/>`,
    tags: ['input', 'text', 'form'],
  },
  {
    id: 'input-search',
    name: 'Search Input',
    category: 'input',
    description: 'Search input with icon',
    component: (
      <div className="relative">
        <input
          type="search"
          placeholder="Search..."
          className="pl-10 pr-3 py-2 rounded bg-[var(--app-bg-surface)] border border-[var(--app-border-default)] text-[var(--app-text-primary)] placeholder-[var(--app-text-muted)] focus:outline-none focus:border-[var(--app-accent-solid)] focus:ring-1 focus:ring-[var(--app-accent-solid)] transition-all w-64"
        />
        <RiSearchLine className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)]" />
      </div>
    ),
    code: `import { RiSearchLine } from '@remixicon/react';

<div className="relative">
  <input
    type="search"
    placeholder="Search..."
    className="pl-10 pr-3 py-2 rounded bg-[var(--app-bg-surface)] border border-[var(--app-border-default)] text-[var(--app-text-primary)] placeholder-[var(--app-text-muted)] focus:outline-none focus:border-[var(--app-accent-solid)] focus:ring-1 focus:ring-[var(--app-accent-solid)] transition-all w-64"
  />
  <RiSearchLine className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)]" />
</div>`,
    tags: ['input', 'search', 'icon'],
  },

  // TOGGLES
  {
    id: 'toggle-switch',
    name: 'Toggle Switch',
    category: 'toggle',
    description: 'Modern toggle switch component',
    component: <ToggleSwitch checked={true} onChange={() => {}} label="Enable Feature" />,
    code: `import ToggleSwitch from './components/ToggleSwitch';

<ToggleSwitch
  checked={isEnabled}
  onChange={(checked) => setIsEnabled(checked)}
  label="Enable Feature"
/>`,
    tags: ['toggle', 'switch', 'checkbox'],
  },
  {
    id: 'toggle-switch-description',
    name: 'Toggle with Description',
    category: 'toggle',
    description: 'Toggle switch with explanatory text',
    component: (
      <ToggleSwitch
        checked={false}
        onChange={() => {}}
        label="Dark Mode"
        description="Enable dark theme across the application"
      />
    ),
    code: `<ToggleSwitch
  checked={isDarkMode}
  onChange={(checked) => setIsDarkMode(checked)}
  label="Dark Mode"
  description="Enable dark theme across the application"
/>`,
    tags: ['toggle', 'switch', 'description'],
  },

  // BADGES
  {
    id: 'badge-default',
    name: 'Default Badge',
    category: 'badge',
    description: 'Standard status indicator',
    component: (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--app-bg-subtle)] text-[var(--app-text-primary)] border border-[var(--app-border-subtle)]">
        Default
      </span>
    ),
    code: `<span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--app-bg-subtle)] text-[var(--app-text-primary)] border border-[var(--app-border-subtle)]">
  Default
</span>`,
    tags: ['badge', 'tag', 'label'],
  },
  {
    id: 'badge-success',
    name: 'Success Badge',
    category: 'badge',
    description: 'Success status indicator',
    component: (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--app-success-bg)] text-[var(--app-success-text)] border border-[var(--app-success-border)]">
        Active
      </span>
    ),
    code: `<span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--app-success-bg)] text-[var(--app-success-text)] border border-[var(--app-success-border)]">
  Active
</span>`,
    tags: ['badge', 'success', 'status'],
  },
  {
    id: 'badge-warning',
    name: 'Warning Badge',
    category: 'badge',
    description: 'Warning status indicator',
    component: (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--app-warning-bg)] text-[var(--app-warning-text)] border border-[var(--app-warning-border)]">
        Pending
      </span>
    ),
    code: `<span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--app-warning-bg)] text-[var(--app-warning-text)] border border-[var(--app-warning-border)]">
  Pending
</span>`,
    tags: ['badge', 'warning', 'status'],
  },
  {
    id: 'badge-error',
    name: 'Error Badge',
    category: 'badge',
    description: 'Error status indicator',
    component: (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--app-error-bg)] text-[var(--app-error-text)] border border-[var(--app-error-border)]">
        Failed
      </span>
    ),
    code: `<span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--app-error-bg)] text-[var(--app-error-text)] border border-[var(--app-error-border)]">
  Failed
</span>`,
    tags: ['badge', 'error', 'status'],
  },

  // MODALS
  {
    id: 'modal-confirm',
    name: 'Confirm Dialog',
    category: 'modal',
    description: 'Trigger a global confirmation dialog',
    component: (
      <button
        className="px-4 py-2 rounded font-medium transition-all bg-[var(--app-bg-surface)] hover:bg-[var(--app-bg-hover)] border border-[var(--app-border-default)] text-[var(--app-text-primary)]"
        onClick={() => {
            useGameStore.getState().showConfirmDialog(
                'Are you sure you want to proceed with this potentially destructive action?',
                () => useGameStore.getState().showToast('Confirmed!', 'success'),
                'Proceed'
            );
        }}
      >
        Open Dialog
      </button>
    ),
    code: `const { showConfirmDialog, showToast } = useGameStore();

showConfirmDialog(
  'Are you sure you want to proceed?',
  () => showToast('Confirmed!', 'success'),
  'Proceed'
);`,
    tags: ['modal', 'dialog', 'confirm'],
  },

  // TOASTS
  {
    id: 'toast-success',
    name: 'Success Toast',
    category: 'toast',
    description: 'Trigger a success notification',
    component: (
      <button
        className="px-4 py-2 rounded font-medium transition-all bg-[var(--app-success-bg)] text-[var(--app-success-text)] border border-[var(--app-success-border)] hover:brightness-110"
        onClick={() => useGameStore.getState().showToast('Operation completed successfully', 'success')}
      >
        Show Success
      </button>
    ),
    code: `useGameStore.getState().showToast('Operation completed successfully', 'success');`,
    tags: ['toast', 'notification', 'success'],
  },
  {
    id: 'toast-error',
    name: 'Error Toast',
    category: 'toast',
    description: 'Trigger an error notification',
    component: (
      <button
        className="px-4 py-2 rounded font-medium transition-all bg-[var(--app-error-bg)] text-[var(--app-error-text)] border border-[var(--app-error-border)] hover:brightness-110"
        onClick={() => useGameStore.getState().showToast('Something went wrong', 'error')}
      >
        Show Error
      </button>
    ),
    code: `useGameStore.getState().showToast('Something went wrong', 'error');`,
    tags: ['toast', 'notification', 'error'],
  },
  {
    id: 'toast-info',
    name: 'Info Toast',
    category: 'toast',
    description: 'Trigger an info notification',
    component: (
      <button
        className="px-4 py-2 rounded font-medium transition-all bg-[var(--app-accent-bg)] text-[var(--app-accent-text)] border border-[var(--app-accent-solid)] hover:brightness-110"
        onClick={() => useGameStore.getState().showToast('Here is some useful information', 'info')}
      >
        Show Info
      </button>
    ),
    code: `useGameStore.getState().showToast('Here is some useful information', 'info');`,
    tags: ['toast', 'notification', 'info'],
  },

  // ICONS
  {
    id: 'icons-common',
    name: 'Common Icons',
    category: 'icon',
    description: 'Frequently used UI icons from Remix Icon',
    component: (
      <div className="flex gap-4">
        <RiHomeLine className="w-6 h-6 text-[var(--app-text-primary)]" />
        <RiUserLine className="w-6 h-6 text-[var(--app-text-primary)]" />
        <RiSettings3Line className="w-6 h-6 text-[var(--app-text-primary)]" />
        <RiMap2Line className="w-6 h-6 text-[var(--app-text-primary)]" />
        <RiSwordLine className="w-6 h-6 text-[var(--app-text-primary)]" />
        <RiGobletLine className="w-6 h-6 text-[var(--app-text-primary)]" />
      </div>
    ),
    code: `import { RiHomeLine, RiUserLine, RiSettings3Line } from '@remixicon/react';

<RiHomeLine className="w-6 h-6 text-[var(--app-text-primary)]" />`,
    tags: ['icon', 'svg', 'remix'],
  },

  // TYPOGRAPHY
  {
    id: 'typography-h1',
    name: 'Heading 1',
    category: 'typography',
    description: 'Primary page heading',
    component: <h1 className="text-4xl font-bold text-[var(--app-text-primary)]">Heading 1</h1>,
    code: `<h1 className="text-4xl font-bold text-[var(--app-text-primary)]">Heading 1</h1>`,
    tags: ['typography', 'heading', 'h1'],
  },
  {
    id: 'typography-h2',
    name: 'Heading 2',
    category: 'typography',
    description: 'Section heading',
    component: <h2 className="text-3xl font-bold text-[var(--app-text-primary)]">Heading 2</h2>,
    code: `<h2 className="text-3xl font-bold text-[var(--app-text-primary)]">Heading 2</h2>`,
    tags: ['typography', 'heading', 'h2'],
  },
  {
    id: 'typography-h3',
    name: 'Heading 3',
    category: 'typography',
    description: 'Subsection heading',
    component: <h3 className="text-2xl font-semibold text-[var(--app-text-primary)]">Heading 3</h3>,
    code: `<h3 className="text-2xl font-semibold text-[var(--app-text-primary)]">Heading 3</h3>`,
    tags: ['typography', 'heading', 'h3'],
  },
  {
    id: 'typography-body',
    name: 'Body Text',
    category: 'typography',
    description: 'Standard paragraph text',
    component: <p className="text-base text-[var(--app-text-secondary)]">This is body text. The quick brown fox jumps over the lazy dog.</p>,
    code: `<p className="text-base text-[var(--app-text-secondary)]">This is body text.</p>`,
    tags: ['typography', 'paragraph', 'body'],
  },
  {
    id: 'typography-secondary',
    name: 'Secondary Text',
    category: 'typography',
    description: 'Muted secondary text',
    component: <p className="text-sm text-[var(--app-text-muted)]">This is secondary text with lower emphasis.</p>,
    code: `<p className="text-sm text-[var(--app-text-muted)]">This is secondary text.</p>`,
    tags: ['typography', 'secondary', 'muted'],
  },
  {
    id: 'typography-caption',
    name: 'Caption Text',
    category: 'typography',
    description: 'Small caption or helper text',
    component: <p className="text-xs text-[var(--app-text-disabled)]">Caption or helper text</p>,
    code: `<p className="text-xs text-[var(--app-text-disabled)]">Caption or helper text</p>`,
    tags: ['typography', 'caption', 'small'],
  },

  // COLORS
  {
    id: 'color-bg-base',
    name: 'Background Base',
    category: 'color',
    description: 'Main application background',
    component: (
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded bg-[var(--app-bg-base)] border border-[var(--app-border-default)] shadow-sm"></div>
        <div>
          <div className="text-[var(--app-text-primary)] font-mono text-sm">--app-bg-base</div>
          <div className="text-[var(--app-text-muted)] text-xs">var(--slate-1)</div>
        </div>
      </div>
    ),
    code: `<div className="bg-[var(--app-bg-base)]">Base Background</div>`,
    tags: ['color', 'background', 'theme'],
  },
  {
    id: 'color-bg-surface',
    name: 'Background Surface',
    category: 'color',
    description: 'Card and panel background',
    component: (
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded bg-[var(--app-bg-surface)] border border-[var(--app-border-default)] shadow-sm"></div>
        <div>
          <div className="text-[var(--app-text-primary)] font-mono text-sm">--app-bg-surface</div>
          <div className="text-[var(--app-text-muted)] text-xs">var(--slate-3)</div>
        </div>
      </div>
    ),
    code: `<div className="bg-[var(--app-bg-surface)]">Surface Background</div>`,
    tags: ['color', 'background', 'theme'],
  },
  {
    id: 'color-accent',
    name: 'Accent Color',
    category: 'color',
    description: 'Primary interactive color',
    component: (
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded bg-[var(--app-accent-solid)] border border-transparent shadow-sm"></div>
        <div>
          <div className="text-[var(--app-text-primary)] font-mono text-sm">--app-accent-solid</div>
          <div className="text-[var(--app-text-muted)] text-xs">Primary Brand</div>
        </div>
      </div>
    ),
    code: `<div className="bg-[var(--app-accent-solid)]">Accent Color</div>`,
    tags: ['color', 'primary', 'theme'],
  },

  // CARDS
  {
    id: 'card-basic',
    name: 'Basic Card',
    category: 'card',
    description: 'Standard card container',
    component: (
      <div className="p-4 rounded-lg bg-[var(--app-bg-surface)] border border-[var(--app-border-default)] shadow-sm">
        <h3 className="text-lg font-semibold text-[var(--app-text-primary)] mb-2">Card Title</h3>
        <p className="text-sm text-[var(--app-text-secondary)]">This is a basic card with some content inside.</p>
      </div>
    ),
    code: `<div className="p-4 rounded-lg bg-[var(--app-bg-surface)] border border-[var(--app-border-default)] shadow-sm">
  <h3 className="text-lg font-semibold text-[var(--app-text-primary)] mb-2">Card Title</h3>
  <p className="text-sm text-[var(--app-text-secondary)]">Card content here.</p>
</div>`,
    tags: ['card', 'container'],
  },
  {
    id: 'card-hover',
    name: 'Hoverable Card',
    category: 'card',
    description: 'Card with hover state',
    component: (
      <div className="p-4 rounded-lg bg-[var(--app-bg-surface)] border border-[var(--app-border-default)] hover:bg-[var(--app-bg-hover)] hover:border-[var(--app-border-hover)] transition-all cursor-pointer shadow-sm hover:shadow-md">
        <h3 className="text-lg font-semibold text-[var(--app-text-primary)] mb-2">Hover Me</h3>
        <p className="text-sm text-[var(--app-text-secondary)]">This card changes on hover.</p>
      </div>
    ),
    code: `<div className="p-4 rounded-lg bg-[var(--app-bg-surface)] border border-[var(--app-border-default)] hover:bg-[var(--app-bg-hover)] hover:border-[var(--app-border-hover)] transition-all cursor-pointer shadow-sm hover:shadow-md">
  <h3 className="text-lg font-semibold text-[var(--app-text-primary)] mb-2">Hover Me</h3>
  <p className="text-sm text-[var(--app-text-secondary)]">This card changes on hover.</p>
</div>`,
    tags: ['card', 'hover', 'interactive'],
  },
];
