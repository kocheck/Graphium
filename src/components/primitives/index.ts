/**
 * UI Primitives — Design system components
 *
 * These components form the visual foundation of the app.
 * They import only from styles/ and types/ — never from store or services.
 * See CLAUDE.md "Design System Contract" for boundary rules.
 */
export { default as Button } from './Button';
// eslint-disable-next-line import/no-unused-modules
export type { ButtonProps } from './Button';

export { default as Input } from './Input';
// eslint-disable-next-line import/no-unused-modules
export type { InputProps } from './Input';

export { default as Card } from './Card';
// eslint-disable-next-line import/no-unused-modules
export type { CardProps } from './Card';

// eslint-disable-next-line import/no-unused-modules
export { default as Dialog } from './Dialog';
// eslint-disable-next-line import/no-unused-modules
export type { DialogProps } from './Dialog';

export { default as ToggleSwitch } from './ToggleSwitch';
