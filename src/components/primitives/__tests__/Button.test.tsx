import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import Button from '../Button';

describe('Button', () => {
  describe('rendering', () => {
    it('renders with children text', () => {
      render(<Button variant="primary">Click me</Button>);
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('renders as a button element', () => {
      render(<Button variant="primary">Test</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('defaults to type="button"', () => {
      render(<Button variant="primary">Test</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    });

    it('allows overriding type', () => {
      render(
        <Button variant="primary" type="submit">
          Submit
        </Button>,
      );
      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
    });
  });

  describe('variants', () => {
    it('applies primary variant class', () => {
      render(<Button variant="primary">Primary</Button>);
      expect(screen.getByRole('button')).toHaveClass('btn-primitive--primary');
    });

    it('applies secondary variant class', () => {
      render(<Button variant="secondary">Secondary</Button>);
      expect(screen.getByRole('button')).toHaveClass('btn-primitive--secondary');
    });

    it('applies ghost variant class', () => {
      render(<Button variant="ghost">Ghost</Button>);
      expect(screen.getByRole('button')).toHaveClass('btn-primitive--ghost');
    });

    it('applies destructive variant class', () => {
      render(<Button variant="destructive">Delete</Button>);
      expect(screen.getByRole('button')).toHaveClass('btn-primitive--destructive');
    });

    it('applies tool variant class', () => {
      render(<Button variant="tool">Tool</Button>);
      expect(screen.getByRole('button')).toHaveClass('btn-primitive--tool');
    });
  });

  describe('sizes', () => {
    it('defaults to md size', () => {
      render(<Button variant="primary">Default</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('text-sm');
    });

    it('applies sm size classes', () => {
      render(
        <Button variant="primary" size="sm">
          Small
        </Button>,
      );
      const button = screen.getByRole('button');
      expect(button.className).toContain('text-xs');
    });

    it('applies lg size classes', () => {
      render(
        <Button variant="primary" size="lg">
          Large
        </Button>,
      );
      const button = screen.getByRole('button');
      expect(button.className).toContain('text-base');
    });
  });

  describe('active state', () => {
    it('adds active class when isActive is true', () => {
      render(
        <Button variant="tool" isActive>
          Active
        </Button>,
      );
      expect(screen.getByRole('button')).toHaveClass('active');
    });

    it('does not add active class when isActive is false', () => {
      render(
        <Button variant="tool" isActive={false}>
          Inactive
        </Button>,
      );
      expect(screen.getByRole('button')).not.toHaveClass('active');
    });
  });

  describe('disabled state', () => {
    it('disables the button when disabled prop is true', () => {
      render(
        <Button variant="primary" disabled>
          Disabled
        </Button>,
      );
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('sets aria-disabled when disabled', () => {
      render(
        <Button variant="primary" disabled>
          Disabled
        </Button>,
      );
      expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
    });

    it('adds disabled class when disabled', () => {
      render(
        <Button variant="primary" disabled>
          Disabled
        </Button>,
      );
      expect(screen.getByRole('button')).toHaveClass('btn-primitive--disabled');
    });
  });

  describe('loading state', () => {
    it('disables the button when loading', () => {
      render(
        <Button variant="primary" isLoading>
          Loading
        </Button>,
      );
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('sets aria-busy when loading', () => {
      render(
        <Button variant="primary" isLoading>
          Loading
        </Button>,
      );
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    });

    it('renders spinner when loading', () => {
      const { container } = render(
        <Button variant="primary" isLoading>
          Loading
        </Button>,
      );
      expect(container.querySelector('.btn-primitive__spinner')).toBeInTheDocument();
    });

    it('hides left icon when loading', () => {
      render(
        <Button variant="primary" isLoading leftIcon={<span data-testid="icon">+</span>}>
          Loading
        </Button>,
      );
      expect(screen.queryByTestId('icon')).not.toBeInTheDocument();
    });
  });

  describe('icons', () => {
    it('renders left icon', () => {
      render(
        <Button variant="primary" leftIcon={<span data-testid="left-icon">+</span>}>
          Add
        </Button>,
      );
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    });

    it('renders right icon', () => {
      render(
        <Button variant="primary" rightIcon={<span data-testid="right-icon">→</span>}>
          Next
        </Button>,
      );
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    });

    it('hides right icon when loading', () => {
      render(
        <Button variant="primary" isLoading rightIcon={<span data-testid="right-icon">→</span>}>
          Next
        </Button>,
      );
      expect(screen.queryByTestId('right-icon')).not.toBeInTheDocument();
    });

    it('marks icons as aria-hidden', () => {
      const { container } = render(
        <Button variant="primary" leftIcon={<span>+</span>} rightIcon={<span>→</span>}>
          Action
        </Button>,
      );
      const icons = container.querySelectorAll('.btn-primitive__icon');
      icons.forEach((icon) => {
        expect(icon).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('event handling', () => {
    it('calls onClick when clicked', () => {
      const onClick = vi.fn();
      render(
        <Button variant="primary" onClick={onClick}>
          Click
        </Button>,
      );
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', () => {
      const onClick = vi.fn();
      render(
        <Button variant="primary" disabled onClick={onClick}>
          Click
        </Button>,
      );
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).not.toHaveBeenCalled();
    });

    it('does not call onClick when loading', () => {
      const onClick = vi.fn();
      render(
        <Button variant="primary" isLoading onClick={onClick}>
          Click
        </Button>,
      );
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('className merging', () => {
    it('merges custom className with variant classes', () => {
      render(
        <Button variant="primary" className="custom-class">
          Test
        </Button>,
      );
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-primitive--primary');
      expect(button).toHaveClass('custom-class');
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref to the button element', () => {
      const ref = { current: null } as React.RefObject<HTMLButtonElement>;
      render(
        <Button ref={ref} variant="primary">
          Ref
        </Button>,
      );
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });
  });

  describe('displayName', () => {
    it('has Button displayName', () => {
      expect(Button.displayName).toBe('Button');
    });
  });
});
