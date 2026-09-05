/**
 * ToggleSwitch adapter — same props API, rendered on the `switch` and `label` primitives.
 */

import type { JSX } from 'react';
import { useId } from 'react';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}

function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  id,
}: ToggleSwitchProps): JSX.Element {
  const generatedId = useId();
  const toggleId = id ?? generatedId;

  return (
    <div>
      <div className="flex items-center justify-between">
        {label && (
          <Label
            htmlFor={toggleId}
            className="text-xs uppercase font-semibold cursor-pointer text-[var(--app-text-secondary)]"
          >
            {label}
          </Label>
        )}
        <Switch
          id={toggleId}
          checked={checked}
          onCheckedChange={onChange}
          disabled={disabled}
          aria-disabled={disabled}
        />
      </div>
      {description && <p className="text-xs mt-1 text-[var(--app-text-muted)]">{description}</p>}
    </div>
  );
}

export default ToggleSwitch;
