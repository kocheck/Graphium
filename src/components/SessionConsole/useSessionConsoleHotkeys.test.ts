import { describe, expect, it } from 'vitest';

import { emptySessionConsoleRuntime } from '../../types/sessionConsole';
import { shouldDeferSessionConsoleEscape } from './useSessionConsoleHotkeys';

import type { GameState } from '../../store/gameStore';

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
    expect(shouldDeferSessionConsoleEscape({ ...store, isCalibrating: true }, null)).toBe(true);
    expect(
      shouldDeferSessionConsoleEscape(
        { ...store, activeMeasurement: { id: 'm' } as GameState['activeMeasurement'] },
        null,
      ),
    ).toBe(true);
    expect(shouldDeferSessionConsoleEscape(store, null, true)).toBe(true);
  });

  it('defers while typing in an input', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    expect(shouldDeferSessionConsoleEscape(store, input)).toBe(true);
    input.remove();
  });

  it('defers only for explicit Esc owners, not a nav drawer dialog', () => {
    const drawer = document.createElement('div');
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    document.body.appendChild(drawer);
    expect(shouldDeferSessionConsoleEscape(store, null)).toBe(false);

    drawer.setAttribute('data-esc-owns', 'true');
    expect(shouldDeferSessionConsoleEscape(store, null)).toBe(true);
    drawer.remove();
  });
});

describe('empty runtime stays stopped', () => {
  it('starts stopped so Esc does not capture', () => {
    expect(emptySessionConsoleRuntime().audio.status).toBe('stopped');
  });
});
