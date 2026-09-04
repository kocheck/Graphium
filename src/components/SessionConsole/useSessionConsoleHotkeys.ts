import { useEffect } from 'react';

import { useGameStore } from '../../store/gameStore';
import { flattenTracks } from '../../utils/sessionConsoleBoard';

const PANEL_SELECTOR = '[data-session-console="panel"], [data-testid="session-console-panel"]';

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
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

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        store.dispatchSessionConsole({ type: 'STOP' });
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
