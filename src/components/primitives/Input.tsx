/**
 * Input Primitive — Design system text input component
 *
 * Provides a themed, accessible text input with optional label, error, and helper text.
 * Uses theme tokens from theme.css for all colors.
 *
 * @example
 * <Input label="Campaign Name" value={name} onChange={e => setName(e.target.value)} />
 * <Input label="Email" error="Invalid email address" />
 * <Input helperText="Used for display only" />
 */

import React, { useId } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id, ...rest }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText && !error ? `${inputId}-helper` : undefined;

    return (
      <div>
        {label && (
          <label htmlFor={inputId} className="input-primitive__label">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId || helperId || undefined}
          className={['input-primitive', error ? 'input-primitive--error' : '', className]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        />
        {error && (
          <p id={errorId} className="input-primitive__error-text" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="input-primitive__helper">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

export default Input;
