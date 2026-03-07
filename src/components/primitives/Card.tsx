/**
 * Card Primitive — Design system surface/panel component
 *
 * Provides a themed container with 3 visual variants and configurable padding.
 * Uses theme tokens from theme.css for all colors.
 *
 * Variants:
 * - `surface` — Flat surface background (default)
 * - `elevated` — Raised with shadow
 * - `outlined` — Surface with border
 *
 * @example
 * <Card variant="outlined" padding="md">Content here</Card>
 * <Card variant="elevated" padding="lg">Important content</Card>
 */

import { forwardRef, type HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'surface' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingClasses = {
  none: '',
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
} as const;

const variantClasses = {
  surface: 'card-primitive card-primitive--surface',
  elevated: 'card-primitive card-primitive--elevated',
  outlined: 'card-primitive card-primitive--outlined',
} as const;

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'surface', padding = 'md', className = '', children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={[variantClasses[variant], paddingClasses[padding], className]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = 'Card';

export default Card;
