/**
 * ToggleSwitch Component - Modern toggle switch with theme support
 *
 * A reusable toggle switch component with smooth animations and theme-aware styling.
 * Designed to replace standard checkboxes for better UX.
 *
 * @param checked - Whether the toggle is on or off
 * @param onChange - Callback when toggle state changes (receives new boolean value)
 * @param label - Optional label text to display next to the toggle
 * @param description - Optional description text below the toggle
 * @param disabled - Whether the toggle is disabled
 * @param id - Optional ID for the toggle (for accessibility)
 */
interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}

const ToggleSwitch = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  id,
}: ToggleSwitchProps) => {
  const handleToggle = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onChange(!checked);
    }
  };

  const toggleId = id || `toggle-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div>
      <div className="flex items-center justify-between">
        {label && (
          <label
            htmlFor={toggleId}
            className="text-xs uppercase font-semibold cursor-pointer"
            style={{ color: 'var(--app-text-secondary)' }}
          >
            {label}
          </label>
        )}

        <button
          id={toggleId}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-disabled={disabled}
          disabled={disabled}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
            focus:outline-none focus:ring-2 focus:ring-offset-2
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${checked
              ? 'bg-[var(--app-accent-solid)] focus:ring-[var(--app-accent-solid)]'
              : 'bg-[var(--app-border-default)] focus:ring-[var(--app-border-default)]'
            }
          `}
          style={{
            transitionDuration: '200ms',
          }}
        >
          <span
            className={`
              inline-block h-5 w-5 transform rounded-full bg-white transition-transform
              shadow-sm
              ${checked ? 'translate-x-6' : 'translate-x-1'}
            `}
            style={{
              transitionDuration: '200ms',
              transitionTimingFunction: 'ease-in-out',
            }}
          />
        </button>
      </div>

      {description && (
        <p
          className="text-xs mt-1"
          style={{ color: 'var(--app-text-muted)' }}
        >
          {description}
        </p>
      )}
    </div>
  );
};

export default ToggleSwitch;

