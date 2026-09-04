import { useEffect } from 'react';

import { useGameStore } from '../../store/gameStore';
import { flattenTracks } from '../../utils/sessionConsoleBoard';

import type { GameState } from '../../store/gameStore';

const PANEL_SELECTOR = '[data-session-console="panel"], [data-testid="session-console-panel"]';

function isTypingTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return true;
  }
  if (target instanceof HTMLSelectElement) {
    return true;
  }
  return target instanceof HTMLElement && target.isContentEditable;
}

function isInsideSessionConsolePanel(node: EventTarget | null): boolean {
  if (!(node instanceof Element)) {
    return false;
  }
  return node.closest(PANEL_SELECTOR) !== null;
}

function isSessionConsoleHotkeyFocus(event: KeyboardEvent): boolean {
  return (
    isInsideSessionConsolePanel(document.activeElement) || isInsideSessionConsolePanel(event.target)
  );
}

function isModalEscOwnerOpen(): boolean {
  return Boolean(
    document.querySelector('[data-esc-owns="true"], [aria-modal="true"], [role="dialog"]'),
  );
}

export function shouldDeferSessionConsoleEscape(
  store: Pick<
    GameState,
    | 'isCommandPaletteOpen'
    | 'confirmDialog'
    | 'dungeonDialog'
    | 'isCalibrating'
    | 'activeMeasurement'
  >,
  target: EventTarget | null,
  extraDefer = false,
): boolean {
  return (
    extraDefer ||
    store.isCommandPaletteOpen ||
    Boolean(store.confirmDialog) ||
    store.dungeonDialog ||
    store.isCalibrating ||
    Boolean(store.activeMeasurement) ||
    isTypingTarget(target) ||
    isModalEscOwnerOpen()
  );
}

function handleSessionConsoleEscape(event: KeyboardEvent, extraDefer = false): boolean {
  if (event.key !== 'Escape') {
    return false;
  }
  const store = useGameStore.getState();
  if (shouldDeferSessionConsoleEscape(store, event.target, extraDefer)) {
    return false;
  }
  if (store.sessionConsoleRuntime.audio.status === 'stopped') {
    return false;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
  store.dispatchSessionConsole({ type: 'STOP' });
  return true;
}

export function useSessionConsoleEscapeStop(extraDefer = false): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      handleSessionConsoleEscape(event, extraDefer);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [extraDefer]);
}

export function useSessionConsoleHotkeys(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const store = useGameStore.getState();
      if (store.isCommandPaletteOpen || isTypingTarget(event.target)) {
        return;
      }

      if (!isSessionConsoleHotkeyFocus(event)) {
        return;
      }

      if (event.key === 'd' || event.key === 'D') {
        event.preventDefault();
        event.stopImmediatePropagation();
        store.dispatchSessionConsole({
          type: 'SET_DUCKED',
          ducked: !store.sessionConsoleRuntime.ducked,
        });
        return;
      }

      if (!/^[1-9]$/.test(event.key)) {
        return;
      }

      const track = flattenTracks(store.sessionConsole)[Number(event.key) - 1];
      if (track) {
        event.preventDefault();
        event.stopImmediatePropagation();
        store.dispatchSessionConsole({ type: 'PLAY_TRACK', trackId: track.id });
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, []);
}
