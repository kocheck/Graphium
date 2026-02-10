import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import Dialog from '../Dialog';

// Helper: the overlay has aria-hidden="true" so we need { hidden: true } to find the dialog
const getDialog = () => screen.getByRole('dialog', { hidden: true });
const queryDialog = () => screen.queryByRole('dialog', { hidden: true });

describe('Dialog', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  describe('rendering', () => {
    it('renders nothing when isOpen is false', () => {
      const { container } = render(
        <Dialog isOpen={false} onClose={vi.fn()} title="Test">
          Content
        </Dialog>,
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders dialog when isOpen is true', () => {
      render(
        <Dialog isOpen={true} onClose={vi.fn()} title="Test Dialog">
          Dialog content
        </Dialog>,
      );
      expect(getDialog()).toBeInTheDocument();
      expect(screen.getByText('Dialog content')).toBeInTheDocument();
    });

    it('renders title', () => {
      render(
        <Dialog isOpen={true} onClose={vi.fn()} title="My Title">
          Body
        </Dialog>,
      );
      expect(screen.getByText('My Title')).toBeInTheDocument();
    });

    it('renders description when provided', () => {
      render(
        <Dialog isOpen={true} onClose={vi.fn()} title="Title" description="A description">
          Body
        </Dialog>,
      );
      expect(screen.getByText('A description')).toBeInTheDocument();
    });

    it('does not render description when not provided', () => {
      render(
        <Dialog isOpen={true} onClose={vi.fn()} title="Title">
          Body
        </Dialog>,
      );
      expect(screen.queryByText('A description')).not.toBeInTheDocument();
    });

    it('renders footer when provided', () => {
      render(
        <Dialog isOpen={true} onClose={vi.fn()} title="Title" footer={<button>OK</button>}>
          Body
        </Dialog>,
      );
      expect(screen.getByText('OK')).toBeInTheDocument();
    });

    it('renders close button', () => {
      render(
        <Dialog isOpen={true} onClose={vi.fn()} title="Title">
          Body
        </Dialog>,
      );
      expect(screen.getByLabelText('Close dialog')).toBeInTheDocument();
    });
  });

  describe('ARIA attributes', () => {
    it('has role="dialog"', () => {
      render(
        <Dialog isOpen={true} onClose={vi.fn()} title="Title">
          Body
        </Dialog>,
      );
      expect(getDialog()).toBeInTheDocument();
    });

    it('has aria-modal="true"', () => {
      render(
        <Dialog isOpen={true} onClose={vi.fn()} title="Title">
          Body
        </Dialog>,
      );
      expect(getDialog()).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-labelledby pointing to title', () => {
      render(
        <Dialog isOpen={true} onClose={vi.fn()} title="Dialog Title">
          Body
        </Dialog>,
      );
      const dialog = getDialog();
      const titleId = dialog.getAttribute('aria-labelledby');
      expect(titleId).toBeTruthy();
      expect(document.getElementById(titleId!)).toHaveTextContent('Dialog Title');
    });

    it('has aria-describedby when description is provided', () => {
      render(
        <Dialog isOpen={true} onClose={vi.fn()} title="Title" description="Desc text">
          Body
        </Dialog>,
      );
      const dialog = getDialog();
      const descId = dialog.getAttribute('aria-describedby');
      expect(descId).toBeTruthy();
      expect(document.getElementById(descId!)).toHaveTextContent('Desc text');
    });

    it('does not have aria-describedby when no description', () => {
      render(
        <Dialog isOpen={true} onClose={vi.fn()} title="Title">
          Body
        </Dialog>,
      );
      expect(getDialog().getAttribute('aria-describedby')).toBeNull();
    });
  });

  describe('size variants', () => {
    it('defaults to md size', () => {
      render(
        <Dialog isOpen={true} onClose={vi.fn()} title="Title">
          Body
        </Dialog>,
      );
      expect(getDialog()).toHaveClass('dialog-primitive--md');
    });

    it('applies sm size class', () => {
      render(
        <Dialog isOpen={true} onClose={vi.fn()} title="Title" size="sm">
          Body
        </Dialog>,
      );
      expect(getDialog()).toHaveClass('dialog-primitive--sm');
    });

    it('applies lg size class', () => {
      render(
        <Dialog isOpen={true} onClose={vi.fn()} title="Title" size="lg">
          Body
        </Dialog>,
      );
      expect(getDialog()).toHaveClass('dialog-primitive--lg');
    });

    it('applies full size class', () => {
      render(
        <Dialog isOpen={true} onClose={vi.fn()} title="Title" size="full">
          Body
        </Dialog>,
      );
      expect(getDialog()).toHaveClass('dialog-primitive--full');
    });
  });

  describe('close behavior', () => {
    it('calls onClose when close button clicked', () => {
      const onClose = vi.fn();
      render(
        <Dialog isOpen={true} onClose={onClose} title="Title">
          Body
        </Dialog>,
      );
      fireEvent.click(screen.getByLabelText('Close dialog'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape key is pressed', () => {
      const onClose = vi.fn();
      render(
        <Dialog isOpen={true} onClose={onClose} title="Title">
          Body
        </Dialog>,
      );
      fireEvent.keyDown(getDialog(), { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when overlay is clicked (default)', () => {
      const onClose = vi.fn();
      const { container } = render(
        <Dialog isOpen={true} onClose={onClose} title="Title">
          Body
        </Dialog>,
      );
      const overlay = container.querySelector('.dialog-primitive__overlay');
      expect(overlay).not.toBeNull();
      fireEvent.click(overlay!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when overlay clicked with closeOnOverlayClick=false', () => {
      const onClose = vi.fn();
      const { container } = render(
        <Dialog isOpen={true} onClose={onClose} title="Title" closeOnOverlayClick={false}>
          Body
        </Dialog>,
      );
      const overlay = container.querySelector('.dialog-primitive__overlay');
      fireEvent.click(overlay!);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not call onClose when dialog panel is clicked', () => {
      const onClose = vi.fn();
      render(
        <Dialog isOpen={true} onClose={onClose} title="Title">
          Body
        </Dialog>,
      );
      fireEvent.click(getDialog());
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('scroll lock', () => {
    it('sets body overflow to hidden when open', () => {
      render(
        <Dialog isOpen={true} onClose={vi.fn()} title="Title">
          Body
        </Dialog>,
      );
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body overflow when closed', () => {
      document.body.style.overflow = 'auto';
      const { rerender } = render(
        <Dialog isOpen={true} onClose={vi.fn()} title="Title">
          Body
        </Dialog>,
      );
      expect(document.body.style.overflow).toBe('hidden');

      rerender(
        <Dialog isOpen={false} onClose={vi.fn()} title="Title">
          Body
        </Dialog>,
      );
      expect(document.body.style.overflow).toBe('auto');
    });
  });

  describe('focus trap', () => {
    it('traps Tab at the end — wraps to first focusable element', async () => {
      render(
        <Dialog isOpen={true} onClose={vi.fn()} title="Title">
          <button>First</button>
          <button>Last</button>
        </Dialog>,
      );

      // Focus the last button in body
      const lastButton = screen.getByText('Last');
      lastButton.focus();
      expect(document.activeElement).toBe(lastButton);

      // Tab should wrap to close button (first focusable in dialog)
      fireEvent.keyDown(getDialog(), { key: 'Tab' });

      await waitFor(() => {
        const closeBtn = screen.getByLabelText('Close dialog');
        expect(document.activeElement).toBe(closeBtn);
      });
    });

    it('traps Shift+Tab at the beginning — wraps to last focusable element', async () => {
      render(
        <Dialog isOpen={true} onClose={vi.fn()} title="Title">
          <button>First</button>
          <button>Last</button>
        </Dialog>,
      );

      // Focus the close button (first focusable)
      const closeBtn = screen.getByLabelText('Close dialog');
      closeBtn.focus();

      // Shift+Tab should wrap to last button
      fireEvent.keyDown(getDialog(), { key: 'Tab', shiftKey: true });

      await waitFor(() => {
        expect(document.activeElement).toBe(screen.getByText('Last'));
      });
    });
  });

  describe('displayName', () => {
    it('has Dialog displayName', () => {
      expect(Dialog.displayName).toBe('Dialog');
    });
  });
});
