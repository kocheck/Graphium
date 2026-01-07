/**
 * Playground Registry - Component Examples for Design System
 *
 * This file defines all component examples displayed in the Design System Playground.
 * Each example includes the component instance and its usage code snippet.
 */

import ToggleSwitch from '../ToggleSwitch';
import { ComponentExample, ComponentCategory } from './types';
import { useGameStore } from '../../store/gameStore';
import { useState } from 'react';
import UpdateManager from '../UpdateManager';
import {
  RiHomeLine,
  RiUserLine,
  RiSettings3Line,
  RiMap2Line,
  RiSwordLine,
  RiGobletLine,
  RiSearchLine,
  RiMoonLine,
  RiSunLine,
  RiComputerLine,
  RiFlashlightLine,
  RiSparklingLine,
  RiFileList3Line,
  RiDownloadCloudLine,
  RiBuilding2Line,
  RiTreeLine,
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
  {
    id: 'landing-patterns',
    name: 'Landing Page Patterns',
    description: 'Advanced patterns used in the landing page (keyboard shortcuts, lite mode, templates, etc.)',
  },
  {
    id: 'performance',
    name: 'Performance Patterns',
    description: 'Optimization techniques for low-end devices',
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
  {
    id: 'modal-update-manager',
    name: 'Update Manager',
    category: 'modal',
    description: 'Software update dialog for electron-updater integration',
    component: (() => {
      // Create a wrapper component with state
      const UpdateManagerDemo = () => {
        const [isOpen, setIsOpen] = useState(false);
        return (
          <>
            <button
              className="px-4 py-2 rounded font-medium transition-all bg-[var(--app-accent-solid)] hover:bg-[var(--app-accent-solid-hover)] text-white shadow-sm"
              onClick={() => setIsOpen(true)}
            >
              Check for Updates
            </button>
            <UpdateManager isOpen={isOpen} onClose={() => setIsOpen(false)} />
          </>
        );
      };
      return <UpdateManagerDemo />;
    })(),
    code: `import UpdateManager from './components/UpdateManager';
import { useState } from 'react';

const [isUpdateManagerOpen, setIsUpdateManagerOpen] = useState(false);

// Trigger from button or About modal
<button onClick={() => setIsUpdateManagerOpen(true)}>
  Check for Updates
</button>

// Render modal
<UpdateManager
  isOpen={isUpdateManagerOpen}
  onClose={() => setIsUpdateManagerOpen(false)}
/>

// Features:
// - Checks GitHub Releases for new versions
// - Shows download progress with speed indicator
// - Install and restart when ready
// - Handles errors gracefully
// - Disabled in development mode`,
    tags: ['modal', 'dialog', 'update', 'electron'],
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

  // LANDING PAGE PATTERNS
  {
    id: 'landing-theme-switcher',
    name: 'Theme Switcher (Footer)',
    category: 'landing-patterns',
    description: 'Cyclical theme toggle (Light → Dark → Auto) with icon indicators',
    component: (() => {
      const ThemeSwitcherDemo = () => {
        const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('dark');
        const getIcon = () => {
          if (theme === 'light') return <RiSunLine className="w-4 h-4" />;
          if (theme === 'dark') return <RiMoonLine className="w-4 h-4" />;
          return <RiComputerLine className="w-4 h-4" />;
        };
        const getLabel = () => {
          if (theme === 'light') return 'Light';
          if (theme === 'dark') return 'Dark';
          return 'Auto';
        };
        const cycleTheme = () => {
          const themes: typeof theme[] = ['light', 'dark', 'system'];
          const currentIndex = themes.indexOf(theme);
          setTheme(themes[(currentIndex + 1) % themes.length]);
        };
        return (
          <button
            onClick={cycleTheme}
            className="footer-link footer-icon-link"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              color: 'var(--app-text-muted)',
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              fontFamily: 'inherit',
              fontSize: '0.875rem',
              transition: 'color 0.2s'
            }}
            title={`Theme: ${getLabel()} (click to cycle)`}
          >
            {getIcon()}
            <span>{getLabel()}</span>
          </button>
        );
      };
      return <ThemeSwitcherDemo />;
    })(),
    code: `const [currentTheme, setCurrentTheme] = useState<ThemeMode>('system');

const handleToggleTheme = async () => {
  const storage = getStorage();
  const themes: ThemeMode[] = ['light', 'dark', 'system'];
  const currentIndex = themes.indexOf(currentTheme);
  const nextTheme = themes[(currentIndex + 1) % themes.length];

  await storage.setThemeMode(nextTheme);
  setCurrentTheme(nextTheme);

  // Apply immediately for web
  if (storage.getPlatform() === 'web') {
    const effectiveTheme = nextTheme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : nextTheme;
    document.documentElement.setAttribute('data-theme', effectiveTheme);

    // Broadcast to other tabs
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('graphium-theme-sync');
      channel.postMessage({ type: 'THEME_CHANGED', mode: nextTheme });
      channel.close();
    }
  }
};`,
    tags: ['landing', 'theme', 'toggle', 'footer', 'accessibility'],
  },
  {
    id: 'landing-lite-mode-toggle',
    name: 'Lite Mode Toggle',
    category: 'landing-patterns',
    description: 'Performance mode toggle that disables animations/effects for low-end devices',
    component: (() => {
      const LiteModeDemo = () => {
        const [liteMode, setLiteMode] = useState(false);
        return (
          <button
            onClick={() => setLiteMode(!liteMode)}
            className="footer-link footer-icon-link"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              color: 'var(--app-text-muted)',
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              fontFamily: 'inherit',
              fontSize: '0.875rem',
              transition: 'color 0.2s'
            }}
            title={liteMode ? 'Lite Mode: ON (better performance)' : 'Full Mode: ON (all animations)'}
          >
            {liteMode ? <RiFlashlightLine className="w-4 h-4" /> : <RiSparklingLine className="w-4 h-4" />}
            <span>{liteMode ? 'Lite' : 'Full'}</span>
          </button>
        );
      };
      return <LiteModeDemo />;
    })(),
    code: `const [liteMode, setLiteMode] = useState(() =>
  localStorage.getItem('liteMode') === 'true'
);

const handleToggleLiteMode = () => {
  const newLiteMode = !liteMode;
  setLiteMode(newLiteMode);
  localStorage.setItem('liteMode', String(newLiteMode));
  showToast(
    newLiteMode
      ? '⚡ Lite Mode enabled - animations disabled for better performance'
      : '✨ Full Mode enabled - animations restored',
    'success'
  );
};

// In JSX:
<div data-lite-mode={liteMode}>
  {/* Content */}
</div>

// CSS:
[data-lite-mode="true"] .bg-gradient,
[data-lite-mode="true"] .grid-overlay,
[data-lite-mode="true"] .noise-overlay {
  display: none;
}

[data-lite-mode="true"] .content-container {
  animation: none;
}

[data-lite-mode="true"] .card-hover-effect {
  display: none;
}`,
    tags: ['landing', 'performance', 'toggle', 'lite-mode', 'accessibility'],
  },
  {
    id: 'landing-search-filter',
    name: 'Campaign Search Filter',
    category: 'landing-patterns',
    description: 'Search input with icon that appears when list has 6+ items',
    component: (() => {
      const SearchFilterDemo = () => {
        const [query, setQuery] = useState('');
        return (
          <div style={{ position: 'relative', marginBottom: '0.75rem', width: '300px' }}>
            <RiSearchLine style={{
              position: 'absolute',
              left: '0.875rem',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '1.125rem',
              height: '1.125rem',
              color: 'var(--app-text-muted)',
              pointerEvents: 'none'
            }} />
            <input
              type="search"
              placeholder="Search campaigns..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="recent-search"
              style={{
                width: '100%',
                padding: '0.625rem 0.875rem 0.625rem 2.75rem',
                background: 'var(--app-bg-base)',
                border: '1px solid var(--app-border-subtle)',
                borderRadius: '8px',
                color: 'var(--app-text-primary)',
                fontSize: '0.875rem',
                transition: 'border-color 0.2s'
              }}
            />
          </div>
        );
      };
      return <SearchFilterDemo />;
    })(),
    code: `const [searchQuery, setSearchQuery] = useState('');
const [campaigns, setCampaigns] = useState<Campaign[]>([]);

// Filter logic
const filteredCampaigns = campaigns.filter(campaign =>
  campaign.name.toLowerCase().includes(searchQuery.toLowerCase())
);

// Show search only if 6+ campaigns
{campaigns.length >= 6 && (
  <div className="recent-search-container">
    <RiSearchLine className="search-icon" />
    <input
      type="search"
      placeholder="Search campaigns..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="recent-search"
      aria-label="Filter recent campaigns by name"
    />
  </div>
)}

// Empty state
{filteredCampaigns.length === 0 && searchQuery && (
  <div className="recent-empty">
    <p>No campaigns match "{searchQuery}"</p>
  </div>
)}`,
    tags: ['landing', 'search', 'filter', 'input', 'icon'],
  },
  {
    id: 'landing-keyboard-shortcuts',
    name: 'Global Keyboard Shortcuts',
    category: 'landing-patterns',
    description: 'System-wide keyboard shortcuts for primary actions',
    component: (
      <div className="p-4 bg-[var(--app-bg-surface)] rounded-lg border border-[var(--app-border-subtle)] space-y-2">
        <h4 className="font-semibold text-[var(--app-text-primary)] mb-3">Available Shortcuts</h4>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--app-text-secondary)]">New Campaign</span>
          <kbd className="px-2 py-1 text-xs font-mono rounded bg-[var(--app-bg-subtle)] text-[var(--app-text-muted)] border border-[var(--app-border-subtle)]">
            Ctrl+N
          </kbd>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--app-text-secondary)]">Load Campaign</span>
          <kbd className="px-2 py-1 text-xs font-mono rounded bg-[var(--app-bg-subtle)] text-[var(--app-text-muted)] border border-[var(--app-border-subtle)]">
            Ctrl+O
          </kbd>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--app-text-secondary)]">Generate Dungeon</span>
          <kbd className="px-2 py-1 text-xs font-mono rounded bg-[var(--app-bg-subtle)] text-[var(--app-text-muted)] border border-[var(--app-border-subtle)]">
            Ctrl+G
          </kbd>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--app-text-secondary)]">Open Templates</span>
          <kbd className="px-2 py-1 text-xs font-mono rounded bg-[var(--app-bg-subtle)] text-[var(--app-text-muted)] border border-[var(--app-border-subtle)]">
            Ctrl+T
          </kbd>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--app-text-secondary)]">Help</span>
          <kbd className="px-2 py-1 text-xs font-mono rounded bg-[var(--app-bg-subtle)] text-[var(--app-text-muted)] border border-[var(--app-border-subtle)]">
            ?
          </kbd>
        </div>
      </div>
    ),
    code: `useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    // Global shortcuts (Ctrl/Cmd + key)
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      if (e.key === 'n') {
        e.preventDefault();
        handleNewCampaign();
      } else if (e.key === 'o') {
        e.preventDefault();
        handleLoadCampaign();
      } else if (e.key === 'g') {
        e.preventDefault();
        handleGenerateDungeon();
      } else if (e.key === 't') {
        e.preventDefault();
        setShowTemplates(true);
      }
    }

    // Help shortcut
    if ((e.key === '?' || (e.shiftKey && e.key === '/')) && !isAboutOpen) {
      e.preventDefault();
      setIsAboutOpen(true);
    }

    // Escape to close
    if (e.key === 'Escape') {
      if (showTemplates) setShowTemplates(false);
      else if (isAboutOpen) setIsAboutOpen(false);
    }
  };

  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, [isAboutOpen, showTemplates]);`,
    tags: ['landing', 'keyboard', 'shortcuts', 'accessibility', 'a11y'],
  },
  {
    id: 'landing-platform-banner',
    name: 'Platform-Specific Download Banner',
    category: 'landing-patterns',
    description: 'OS-aware download prompt (detects Mac/Windows/Linux)',
    component: (
      <div className="w-full max-w-md">
        <div style={{
          background: 'var(--app-accent-bg)',
          border: '1px solid var(--app-accent-solid)',
          borderRadius: '12px',
          padding: '1rem',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <RiDownloadCloudLine style={{
              width: '2rem',
              height: '2rem',
              flexShrink: 0,
              color: 'var(--app-accent-text)'
            }} />
            <div style={{ flex: 1 }}>
              <h3 style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--app-accent-text-contrast)',
                marginBottom: '0.25rem'
              }}>Download the Desktop App</h3>
              <p style={{
                fontSize: '0.875rem',
                color: 'var(--app-accent-text-contrast)'
              }}>Get native performance and offline support</p>
            </div>
            <a
              href="#"
              style={{
                background: 'var(--app-accent-solid)',
                color: 'white',
                padding: '0.5rem 1.5rem',
                borderRadius: '8px',
                fontWeight: 500,
                textDecoration: 'none',
                whiteSpace: 'nowrap'
              }}
            >
              Download
            </a>
          </div>
        </div>
      </div>
    ),
    code: `// Platform detection
const [isMac, setIsMac] = useState(false);
const [isWindows, setIsWindows] = useState(false);
const [isLinux, setIsLinux] = useState(false);

useEffect(() => {
  if (typeof navigator !== 'undefined') {
    const uaData = navigator.userAgentData;
    const platformHint = uaData?.platform ?? '';
    const userAgent = navigator.userAgent ?? '';

    setIsMac(platformHint.toLowerCase().includes('mac') || /mac/i.test(userAgent));
    setIsWindows(platformHint.toLowerCase().includes('win') || /win/i.test(userAgent));
    setIsLinux(platformHint.toLowerCase().includes('linux') || /linux/i.test(userAgent));
  }
}, []);

// Render banner
{!isElectron && !hideDownloadBanner && (isMac || isWindows || isLinux) && (
  <div className="download-banner">
    <div className="banner-content">
      <RiDownloadCloudLine className="banner-icon" />
      <div className="banner-text">
        <h3 className="banner-title">
          {isMac && 'Download the Mac App'}
          {isWindows && 'Download the Windows App'}
          {isLinux && 'Download for Linux'}
        </h3>
        <p className="banner-description">
          Get native performance and offline support
        </p>
      </div>
      <a href="https://github.com/user/repo/releases" className="banner-button">
        Download
      </a>
    </div>
  </div>
)}`,
    tags: ['landing', 'download', 'banner', 'platform-detection'],
  },
  {
    id: 'landing-template-card',
    name: 'Template Card',
    category: 'landing-patterns',
    description: 'Campaign template selection card with Remix icon',
    component: (
      <button style={{
        background: 'var(--app-bg-base)',
        border: '1px solid var(--app-border-subtle)',
        borderRadius: '12px',
        padding: '1.25rem',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s',
        width: '240px'
      }}>
        <RiBuilding2Line style={{ width: '3rem', height: '3rem', display: 'block', margin: '0 auto 0.75rem', color: 'var(--blue-11)' }} />
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--app-text-primary)', marginBottom: '0.5rem' }}>
          Classic Dungeon
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--app-text-secondary)', marginBottom: '0.75rem', lineHeight: 1.4 }}>
          5-room dungeon with fog of war
        </p>
        <div style={{ fontSize: '0.8125rem', color: 'var(--app-text-muted)', fontFamily: 'monospace' }}>
          30×30 • 50px cells
        </div>
      </button>
    ),
    code: `import { RiBuilding2Line, RiTreeLine, RiGobletLine, RiSwordLine } from '@remixicon/react';

interface CampaignTemplate {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  grid: { width: number; height: number; cellSize: number; };
}

const TEMPLATES: CampaignTemplate[] = [
  {
    id: 'dungeon',
    name: 'Classic Dungeon',
    icon: RiBuilding2Line,
    description: '5-room dungeon with fog of war',
    grid: { width: 30, height: 30, cellSize: 50 }
  },
  // ... more templates
];

// Render
<div className="templates-grid">
  {TEMPLATES.map((template) => {
    const IconComponent = template.icon;
    return (
      <button
        key={template.id}
        onClick={() => handleSelectTemplate(template)}
        className="template-card"
      >
        <IconComponent className="template-icon" />
        <h3 className="template-name">{template.name}</h3>
        <p className="template-description">{template.description}</p>
        <div className="template-specs">
          {template.grid.width}×{template.grid.height} • {template.grid.cellSize}px cells
        </div>
      </button>
    );
  })}
</div>

// CSS
.template-icon {
  width: 3rem;
  height: 3rem;
  display: block;
  margin: 0 auto 0.75rem;
  color: var(--blue-11);
}`,
    tags: ['landing', 'template', 'card', 'icons'],
  },

  // PERFORMANCE PATTERNS
  {
    id: 'perf-fluid-typography',
    name: 'Fluid Typography',
    category: 'performance',
    description: 'Responsive font sizing using CSS clamp() - no breakpoints needed',
    component: (
      <div className="space-y-4">
        <h2 style={{ fontSize: 'clamp(1.25rem, 2.5vw + 0.5rem, 1.75rem)', fontWeight: 600, color: 'var(--app-text-primary)' }}>
          Hero Title (Fluid)
        </h2>
        <p style={{ fontSize: 'clamp(0.875rem, 1.5vw + 0.5rem, 1.125rem)', color: 'var(--app-text-secondary)' }}>
          Subtitle text that scales smoothly
        </p>
        <p className="text-xs text-[var(--app-text-muted)]">
          Resize your browser to see smooth scaling without breakpoints
        </p>
      </div>
    ),
    code: `/* Fluid Typography - Scales smoothly without media queries */

.hero-title {
  /* Scales from 1.25rem (20px) to 1.75rem (28px) */
  font-size: clamp(1.25rem, 2.5vw + 0.5rem, 1.75rem);
}

.hero-subtitle {
  /* Scales from 0.875rem (14px) to 1.125rem (18px) */
  font-size: clamp(0.875rem, 1.5vw + 0.5rem, 1.125rem);
}

.card-title {
  font-size: clamp(0.9375rem, 1.2vw + 0.6rem, 1rem);
}

.footer-version {
  font-size: clamp(0.75rem, 1vw + 0.4rem, 0.8125rem);
}

/* Benefits:
   - No awkward sizes between breakpoints
   - Respects user font size preferences
   - Better accessibility
   - Smoother responsive behavior
*/`,
    tags: ['performance', 'typography', 'responsive', 'clamp', 'css'],
  },
  {
    id: 'perf-data-attribute-modes',
    name: 'Data Attribute Performance Modes',
    category: 'performance',
    description: 'Use data attributes to toggle expensive CSS features',
    component: (
      <div className="space-y-3">
        <div className="p-3 bg-[var(--app-bg-surface)] rounded border border-[var(--app-border-subtle)]">
          <code className="text-xs text-[var(--app-text-secondary)]">data-lite-mode="false"</code>
          <p className="text-sm mt-2">✨ Full animations and effects enabled</p>
        </div>
        <div className="p-3 bg-[var(--app-bg-surface)] rounded border border-[var(--app-border-subtle)]">
          <code className="text-xs text-[var(--app-text-secondary)]">data-lite-mode="true"</code>
          <p className="text-sm mt-2">⚡ Animations disabled, ~60% performance boost</p>
        </div>
      </div>
    ),
    code: `// React component
<div className="home-screen" data-lite-mode={liteMode}>
  {/* Content */}
</div>

/* CSS - Disable expensive features in lite mode */
[data-lite-mode="true"] .bg-gradient,
[data-lite-mode="true"] .grid-overlay,
[data-lite-mode="true"] .noise-overlay {
  display: none; /* Hide decorative backgrounds */
}

[data-lite-mode="true"] .content-container {
  animation: none; /* Disable fadeInUp */
}

[data-lite-mode="true"] .card-hover-effect {
  display: none; /* Disable shimmer */
}

[data-lite-mode="true"] .logo {
  filter: none; /* Disable drop-shadow */
}

[data-lite-mode="true"] .action-card:hover,
[data-lite-mode="true"] .template-card:hover {
  transform: none; /* Disable lift effect */
}

/* What gets disabled:
   - CSS animations
   - Blur filters (expensive on GPU)
   - Drop shadows
   - Transform animations
   - Decorative gradients and overlays

   Result: ~60% reduction in GPU/CPU usage on <2GB RAM devices
*/`,
    tags: ['performance', 'optimization', 'low-end', 'lite-mode', 'css'],
  },
];
