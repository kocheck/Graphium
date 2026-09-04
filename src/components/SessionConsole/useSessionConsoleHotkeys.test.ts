import { describe, expect, it } from 'vitest';

import { emptySessionConsoleRuntime } from '../../types/sessionConsole';
import { shouldDeferSessionConsoleEscape } from './useSessionConsoleHotkeys';

describe('shouldDeferSessionConsoleEscape', () => {
  const store = {
    isCommandPaletteOpen: false,
    confirmDialog: null,
    dungeonDialog: false,
    isCalibrating: false,
    activeMeasurement: null,
  };

  it('defers while a confirm dialog, palette, or measurement is active', () => {
    expect(shouldDeferSessionConsoleEscape(store, null)).toBe(false);
    expect(shouldDeferSessionConsoleEscape({ ...store, isCommandPaletteOpen: true }, null)).toBe(
      true,
    );
    expect(
      shouldDeferSessionConsoleEscape(
        { ...store, confirmDialog: { message: 'x', onConfirm: () => undefined } },
        null,
      ),
    ).toBe(true);
    expect(shouldDeferSessionConsoleEscape({ ...store, dungeonDialog: true }, null)).toBe(true);
    expect(shouldDeferSessionConsoleEscape(store, null, true)).toBe(true);
  });
});

describe('empty runtime stays stopped', () => {
  it('starts stopped so Esc does not capture', () => {
    expect(emptySessionConsoleRuntime().audio.status).toBe('stopped');
  });
});
