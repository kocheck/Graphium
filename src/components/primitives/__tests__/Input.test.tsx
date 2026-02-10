import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import Input from '../Input';

describe('Input', () => {
  describe('rendering', () => {
    it('renders an input element', () => {
      render(<Input />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders with label', () => {
      render(<Input label="Username" />);
      expect(screen.getByLabelText('Username')).toBeInTheDocument();
    });

    it('renders without label', () => {
      const { container } = render(<Input />);
      expect(container.querySelector('label')).toBeNull();
    });

    it('passes through HTML input attributes', () => {
      render(<Input placeholder="Enter text" type="email" />);
      const input = screen.getByPlaceholderText('Enter text');
      expect(input).toHaveAttribute('type', 'email');
    });
  });

  describe('label association', () => {
    it('associates label with input via htmlFor/id', () => {
      render(<Input label="Email" />);
      const input = screen.getByLabelText('Email');
      expect(input).toBeInTheDocument();
      expect(input.tagName).toBe('INPUT');
    });

    it('uses provided id for label association', () => {
      render(<Input label="Name" id="custom-id" />);
      const input = screen.getByLabelText('Name');
      expect(input).toHaveAttribute('id', 'custom-id');
    });

    it('auto-generates id when not provided', () => {
      render(<Input label="Auto ID" />);
      const input = screen.getByLabelText('Auto ID');
      expect(input.id).toBeTruthy();
    });
  });

  describe('error state', () => {
    it('renders error message', () => {
      render(<Input error="Invalid email" />);
      expect(screen.getByText('Invalid email')).toBeInTheDocument();
    });

    it('error message has role="alert"', () => {
      render(<Input error="Error!" />);
      expect(screen.getByRole('alert')).toHaveTextContent('Error!');
    });

    it('sets aria-invalid when error is present', () => {
      render(<Input label="Test" error="Error" />);
      expect(screen.getByLabelText('Test')).toHaveAttribute('aria-invalid', 'true');
    });

    it('does not set aria-invalid when no error', () => {
      render(<Input label="Test" />);
      expect(screen.getByLabelText('Test')).not.toHaveAttribute('aria-invalid');
    });

    it('associates error with input via aria-describedby', () => {
      render(<Input label="Test" error="Error text" />);
      const input = screen.getByLabelText('Test');
      const describedBy = input.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(document.getElementById(describedBy!)).toHaveTextContent('Error text');
    });

    it('adds error CSS class', () => {
      render(<Input error="Error" />);
      expect(screen.getByRole('textbox')).toHaveClass('input-primitive--error');
    });
  });

  describe('helper text', () => {
    it('renders helper text', () => {
      render(<Input helperText="Enter your full name" />);
      expect(screen.getByText('Enter your full name')).toBeInTheDocument();
    });

    it('associates helper with input via aria-describedby', () => {
      render(<Input label="Name" helperText="Full name please" />);
      const input = screen.getByLabelText('Name');
      const describedBy = input.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(document.getElementById(describedBy!)).toHaveTextContent('Full name please');
    });

    it('error takes priority over helper text', () => {
      render(<Input error="Error!" helperText="Helper" />);
      expect(screen.getByText('Error!')).toBeInTheDocument();
      expect(screen.queryByText('Helper')).not.toBeInTheDocument();
    });
  });

  describe('event handling', () => {
    it('calls onChange when value changes', () => {
      const onChange = vi.fn();
      render(<Input label="Test" onChange={onChange} />);
      fireEvent.change(screen.getByLabelText('Test'), { target: { value: 'hello' } });
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('calls onFocus and onBlur', () => {
      const onFocus = vi.fn();
      const onBlur = vi.fn();
      render(<Input label="Test" onFocus={onFocus} onBlur={onBlur} />);
      const input = screen.getByLabelText('Test');
      fireEvent.focus(input);
      expect(onFocus).toHaveBeenCalledTimes(1);
      fireEvent.blur(input);
      expect(onBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe('className merging', () => {
    it('merges custom className with base class', () => {
      render(<Input className="custom-input" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('input-primitive');
      expect(input).toHaveClass('custom-input');
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref to the input element', () => {
      const ref = { current: null } as React.RefObject<HTMLInputElement>;
      render(<Input ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });
  });

  describe('displayName', () => {
    it('has Input displayName', () => {
      expect(Input.displayName).toBe('Input');
    });
  });
});
