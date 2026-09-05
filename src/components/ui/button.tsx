import * as React from 'react';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        /** .btn-primary */
        default: 'bg-primary text-primary-foreground hover:bg-[var(--app-accent-solid-hover)]',
        /** .btn-default */
        secondary: 'bg-secondary text-secondary-foreground hover:bg-accent',
        /** bare .btn (also .btn-secondary / .btn-ghost / .btn-destructive, undefined in app.css) */
        ghost: 'bg-transparent text-foreground hover:bg-accent',
        destructive:
          'bg-destructive text-[var(--app-error-solid-text)] hover:bg-[var(--app-error-solid-hover)]',
        outline: 'border border-input bg-background text-foreground hover:bg-accent',
        link: 'text-[var(--app-accent-text)] underline-offset-4 hover:underline',
        /** .btn-tool */
        tool: 'border border-input bg-secondary text-secondary-foreground hover:bg-accent hover:border-[var(--app-border-hover)]',
        /** .btn-mode */
        mode: 'bg-secondary text-secondary-foreground hover:bg-accent',
        /** .btn-broadcast */
        broadcast: 'bg-secondary text-secondary-foreground hover:bg-accent',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 gap-1.5 px-3 text-xs',
        lg: 'h-10 px-6',
        icon: 'size-9',
        /** close-button size used by generated dialog.tsx until Step 5 */
        'icon-sm': 'size-7',
        /** .btn padding/font; pair with variant="tool" */
        tool: 'px-3 py-1 text-sm',
        /** .btn-mode / .btn-broadcast padding/font; pair with variant="mode" | "broadcast" */
        mode: 'px-2 py-0.5 text-xs',
      },
      /** .active on .btn-tool / .btn-mode / .btn-broadcast (colours set in compoundVariants) */
      active: {
        true: '',
        false: '',
      },
      /** .is-paused / .is-running on .btn-tool (plan 001) */
      state: {
        none: '',
        paused: '',
        running: '',
      },
    },
    compoundVariants: [
      {
        variant: ['tool', 'mode'],
        active: true,
        class:
          'bg-primary text-primary-foreground border-primary hover:bg-[var(--app-accent-solid-hover)] hover:border-[var(--app-accent-solid-hover)]',
      },
      {
        variant: 'broadcast',
        active: true,
        class:
          'bg-[var(--app-success-solid)] text-[var(--app-success-solid-text)] hover:bg-[var(--app-success-solid-hover)]',
      },
      {
        variant: 'tool',
        state: 'paused',
        class:
          'bg-destructive text-[var(--app-error-solid-text)] border-destructive hover:bg-[var(--app-error-solid-hover)] hover:border-[var(--app-error-solid-hover)]',
      },
      {
        variant: 'tool',
        state: 'running',
        class:
          'bg-[var(--app-success-solid)] text-[var(--app-success-solid-text)] border-[var(--app-success-solid)] hover:bg-[var(--app-success-solid-hover)] hover:border-[var(--app-success-solid-hover)]',
      },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
      active: false,
      state: 'none',
    },
  },
);

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, active, state, asChild = false, ...props },
  ref,
): JSX.Element {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      data-slot="button"
      data-active={active === true ? 'true' : undefined}
      className={cn(buttonVariants({ variant, size, active, state, className }))}
      {...props}
    />
  );
});

export { Button, buttonVariants };
export type { ButtonProps };
