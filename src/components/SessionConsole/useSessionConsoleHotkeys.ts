import { useEffect } from 'react';

import { useGameStore } from '../../store/gameStore';
import { flattenTracks } from '../../utils/sessionConsoleBoard';

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

export function useSessionConsoleHotkeys(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const store = useGameStore.getState();
      if (store.isCommandPaletteOpen || isTypingTarget(event.target)) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
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
        store.dispatchSessionConsole({ type: 'PLAY_TRACK', trackId: track.id });
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, []);
}
