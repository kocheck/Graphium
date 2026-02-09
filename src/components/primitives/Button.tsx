/**
 * Button Primitive — Design system button component
 *
 * Provides a consistent, accessible button with 5 visual variants and 3 sizes.
 * Uses theme tokens from theme.css for all colors.
 *
 * Variants:
 * - `primary` — Main action (accent blue)
 * - `secondary` — Secondary action (surface background)
 * - `ghost` — Minimal/cancel (transparent background)
 * - `destructive` — Dangerous action (red)
 * - `tool` — Toolbar toggle (dark background, border)
 *
 * @example
 * <Button variant="primary" onClick={handleSave}>Save</Button>
 * <Button variant="destructive" size="sm" leftIcon={<TrashIcon />}>Delete</Button>
 * <Button variant="tool" isActive={tool === 'draw'}>Draw</Button>
 */

import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'tool';
  size?: 'sm' | 'md' | 'lg';
  isActive?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const sizeClasses = {
  sm: 'px-2 py-1 text-xs gap-1',
  md: 'px-3 py-1.5 text-sm gap-1.5',
  lg: 'px-4 py-2 text-base gap-2',
} as const;

const variantClasses = {
  primary: 'btn-primitive btn-primitive--primary',
  secondary: 'btn-primitive btn-primitive--secondary',
  ghost: 'btn-primitive btn-primitive--ghost',
  destructive: 'btn-primitive btn-primitive--destructive',
  tool: 'btn-primitive btn-primitive--tool',
} as const;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant,
      size = 'md',
      isActive = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      className = '',
      disabled,
      type = 'button',
      ...rest
    },
    ref,
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-disabled={isDisabled || undefined}
        aria-busy={isLoading || undefined}
        className={[
          variantClasses[variant],
          sizeClasses[size],
          isActive ? 'active' : '',
          isDisabled ? 'btn-primitive--disabled' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      >
        {isLoading ? (
          <span className="btn-primitive__spinner" aria-hidden="true" />
        ) : leftIcon ? (
          <span className="btn-primitive__icon" aria-hidden="true">
            {leftIcon}
          </span>
        ) : null}
        {children && <span>{children}</span>}
        {rightIcon && !isLoading && (
          <span className="btn-primitive__icon" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';

export default Button;
