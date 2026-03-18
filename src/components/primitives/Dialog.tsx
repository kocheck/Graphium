/**
 * Dialog Primitive — Accessible modal dialog component
 *
 * Provides a fully accessible modal dialog with focus management, keyboard
 * navigation, and ARIA attributes. Built without external dependencies
 * (ADR-003: no component library).
 *
 * Features:
 * - Focus trap: Tab/Shift+Tab cycle within the dialog
 * - Escape key closes the dialog
 * - Overlay click closes (configurable via `closeOnOverlayClick`)
 * - Auto-focuses first focusable element on open
 * - Returns focus to trigger element on close
 * - Scroll lock on body while open
 * - `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby`
 * - Reduced-motion safe (no animations when prefers-reduced-motion)
 *
 * @example
 * <Dialog isOpen={isOpen} onClose={onClose} title="Confirm">
 *   <p>Are you sure?</p>
 *   <Dialog.Footer>
 *     <Button variant="ghost" onClick={onClose}>Cancel</Button>
 *     <Button variant="primary" onClick={onConfirm}>OK</Button>
 *   </Dialog.Footer>
 * </Dialog>
 */

import {
  forwardRef,
  useEffect,
  useRef,
  useCallback,
  useId,
  type ReactNode,
  type MutableRefObject,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'full';
  children: ReactNode;
  footer?: ReactNode;
  closeOnOverlayClick?: boolean;
}

const sizeClasses = {
  sm: 'dialog-primitive--sm',
  md: 'dialog-primitive--md',
  lg: 'dialog-primitive--lg',
  full: 'dialog-primitive--full',
} as const;

const FOCUSABLE_SELECTOR =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

const Dialog = forwardRef<HTMLDivElement, DialogProps>(
  // eslint-disable-next-line max-lines-per-function
  (
    {
      isOpen,
      onClose,
      title,
      description,
      size = 'md',
      children,
      footer,
      closeOnOverlayClick = true,
    },
    ref,
  ) => {
    const generatedId = useId();
    const titleId = `${generatedId}-title`;
    const descriptionId = description ? `${generatedId}-desc` : undefined;
    const dialogRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<Element | null>(null);

    // Merge forwarded ref with internal ref
    const setDialogRef = useCallback(
      (node: HTMLDivElement | null) => {
        (dialogRef as MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    // Store trigger element on open, restore focus on close
    useEffect(() => {
      if (isOpen) {
        triggerRef.current = document.activeElement;
      } else if (triggerRef.current) {
        const trigger = triggerRef.current as HTMLElement;
        if (typeof trigger.focus === 'function') {
          trigger.focus();
        }
        triggerRef.current = null;
      }
    }, [isOpen]);

    // Auto-focus first focusable element on open
    useEffect(() => {
      if (!isOpen || !dialogRef.current) {
        return;
      }

      // Small delay to ensure DOM is painted
      const timer = requestAnimationFrame(() => {
        if (!dialogRef.current) {
          return;
        }
        const firstFocusable = dialogRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          // If no focusable element, focus the dialog panel itself
          dialogRef.current.focus();
        }
      });

      return () => cancelAnimationFrame(timer);
    }, [isOpen]);

    // Scroll lock on body
    useEffect(() => {
      if (!isOpen) {
        return;
      }

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }, [isOpen]);

    // Keyboard handling: Escape + focus trap
    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
          return;
        }

        // Focus trap
        if (e.key === 'Tab' && dialogRef.current) {
          const focusableElements =
            dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
          if (focusableElements.length === 0) {
            // No focusable children — prevent Tab from escaping the dialog
            e.preventDefault();
            return;
          }

          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const first = focusableElements[0]!;
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const last = focusableElements[focusableElements.length - 1]!;

          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      },
      [onClose],
    );

    const handleOverlayClick = useCallback(
      (e: MouseEvent) => {
        if (closeOnOverlayClick && e.target === e.currentTarget) {
          onClose();
        }
      },
      [closeOnOverlayClick, onClose],
    );

    if (!isOpen) {
      return null;
    }

    /* eslint-disable jsx-a11y/no-noninteractive-element-interactions -- overlay click-to-close is intentional UX */
    return (
      <div
        className="dialog-primitive__overlay"
        onClick={handleOverlayClick}
        aria-hidden="true"
        role="presentation"
      >
        <div
          ref={setDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          className={`dialog-primitive__panel ${sizeClasses[size]}`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        >
          {/* Header */}
          <div className="dialog-primitive__header">
            <div>
              <h2 id={titleId} className="dialog-primitive__title">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="dialog-primitive__description">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="dialog-primitive__close"
              aria-label="Close dialog"
              type="button"
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div className="dialog-primitive__body">{children}</div>

          {/* Footer (optional) */}
          {footer && <div className="dialog-primitive__footer">{footer}</div>}
        </div>
      </div>
    );
  },
);

Dialog.displayName = 'Dialog';

export default Dialog;
