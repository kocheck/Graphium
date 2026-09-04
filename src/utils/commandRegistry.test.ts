import { afterEach, describe, expect, it, vi } from 'vitest';

import { useGameStore } from '../store/gameStore';
import { emptySessionConsoleCatalog } from '../types/sessionConsole';
import { createCommandRegistry } from './commandRegistry';
import { OPEN_SESSION_CONSOLE_SETTINGS_EVENT } from './sessionConsoleEvents';

function handlers() {
  return {
    setToolSelect: vi.fn(),
    setToolMarker: vi.fn(),
    setToolEraser: vi.fn(),
    setToolWall: vi.fn(),
    setToolDoor: vi.fn(),
    setToolMeasure: vi.fn(),
    togglePause: vi.fn(),
    launchWorldView: vi.fn(),
    openDungeonGenerator: vi.fn(),
    isGamePaused: false,
  };
}

const SESSION_CONSOLE_COMMAND_IDS = [
  'session-console-stop',
  'session-console-duck',
  'session-console-return-to-map',
  'session-console-test-tone',
  'session-console-settings',
] as const;

describe('createCommandRegistry session console commands', () => {
  afterEach(() => {
    useGameStore.getState().resetToNewCampaign();
  });

  it('registers the five session console command ids', () => {
    const commands = createCommandRegistry(handlers());
    const ids = commands.map((command) => command.id);
    for (const id of SESSION_CONSOLE_COMMAND_IDS) {
      expect(ids).toContain(id);
    }
  });

  it('stop, duck, return-to-map, and test-tone dispatch runtime commands', () => {
    const store = useGameStore.getState();
    store.resetToNewCampaign();
    store.updateSessionConsole({
      type: 'REPLACE_CATALOG',
      catalog: {
        ...emptySessionConsoleCatalog('Ash Crown'),
        trackGroups: [
          {
            id: 'g1',
            title: 'Beds',
            note: '',
            accent: 'bed',
            tracks: [
              {
                id: 't1',
                title: 'Tavern',
                cue: '',
                tag: 'bed',
                source: 'youtube',
                youtubeId: 'bLZApMsorjA',
                volumeOffset: 0,
                loop: true,
              },
            ],
          },
        ],
      },
    });
    store.dispatchSessionConsole({ type: 'PLAY_TRACK', trackId: 't1' });
    expect(useGameStore.getState().sessionConsoleRuntime.audio.status).toBe('playing');

    const commands = createCommandRegistry(handlers());
    const byId = Object.fromEntries(commands.map((command) => [command.id, command]));

    byId['session-console-duck']?.execute();
    expect(useGameStore.getState().sessionConsoleRuntime.ducked).toBe(true);

    byId['session-console-return-to-map']?.execute();
    expect(useGameStore.getState().sessionConsoleRuntime.stageVisible).toBe(false);
    expect(useGameStore.getState().sessionConsoleRuntime.audio.status).toBe('playing');

    byId['session-console-test-tone']?.execute();
    expect(useGameStore.getState().sessionConsoleRuntime.sfxId).toBe('test-tone');
    expect(useGameStore.getState().sessionConsoleRuntime.sfxSeq).toBeGreaterThan(0);

    byId['session-console-stop']?.execute();
    expect(useGameStore.getState().sessionConsoleRuntime.audio.status).toBe('stopped');
  });

  it('settings command opens the Session Console settings sheet via custom event', () => {
    const listener = vi.fn();
    window.addEventListener(OPEN_SESSION_CONSOLE_SETTINGS_EVENT, listener);
    const commands = createCommandRegistry(handlers());
    commands.find((command) => command.id === 'session-console-settings')?.execute();
    window.removeEventListener(OPEN_SESSION_CONSOLE_SETTINGS_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
