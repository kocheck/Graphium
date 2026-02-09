/**
 * UI Primitives — Design system components
 *
 * These components form the visual foundation of the app.
 * They import only from styles/ and types/ — never from store or services.
 * See CLAUDE.md "Design System Contract" for boundary rules.
 */
export { default as Button } from './Button';
export type { ButtonProps } from './Button';

export { default as Input } from './Input';
export type { InputProps } from './Input';

export { default as Card } from './Card';
export type { CardProps } from './Card';

export { default as ToggleSwitch } from './ToggleSwitch';
