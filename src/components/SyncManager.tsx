import { useEffect, useRef } from 'react';

import { DEFAULT_GRID_COLOR, useGameStore } from '../store/gameStore';
import {
  buildFullSyncPayload,
  cloneSyncableStateFromGame,
  cloneSyncableStateFromPayload,
  detectChanges,
  detectWorldViewTokenUpdates,
} from '../utils/syncUtils';

import type { GameState, Token } from '../store/gameStore';
import type { SyncAction, SyncableGameState } from '../utils/syncUtils';

// Basic throttle implementation to limit IPC frequency
// Ensures leading edge execution and trailing edge (so final state is always sent)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number,
): T & { cancel: () => void } {
  let lastFunc: ReturnType<typeof setTimeout> | undefined;
  let lastRan: number | undefined;

  const throttled = function (this: unknown, ...args: Parameters<T>): void {
    if (lastRan === undefined) {
      func.apply(this, args);
      lastRan = Date.now();
    } else {
      if (lastFunc) {
        clearTimeout(lastFunc);
      }
      lastFunc = setTimeout(
        () => {
          if (Date.now() - (lastRan ?? 0) >= limit) {
            func.apply(this, args);
            lastRan = Date.now();
          }
        },
        limit - (Date.now() - (lastRan ?? 0)),
      );
    }
  } as T & { cancel: () => void };

  throttled.cancel = (): void => {
    if (lastFunc) {
      clearTimeout(lastFunc);
      lastFunc = undefined;
    }
  };

  return throttled;
}

// eslint-disable-next-line max-lines-per-function
function SyncManager(): null {
  const prevStateRef = useRef<SyncableGameState | null>(null);
  const worldViewPrevStateRef = useRef<SyncableGameState | null>(null);
  const listenerSetupRef = useRef<boolean>(false);

  // eslint-disable-next-line max-lines-per-function, complexity
  useEffect((): (() => void) => {
    const ipcRenderer = window.ipcRenderer;
    const isElectron = Boolean(ipcRenderer);
    const isWeb = !isElectron;

    let ipcListener: ((event: Electron.IpcRendererEvent, action: SyncAction) => void) | null = null;

    const params = new URLSearchParams(window.location.search);
    const isWorldView = params.get('type') === 'world';

    let channel: BroadcastChannel | null = null;

    const sendSyncActionDirectly = (action: SyncAction): void => {
      if (isWeb && channel) {
        channel.postMessage(action);
      } else if (isElectron && ipcRenderer) {
        ipcRenderer.send('SYNC_WORLD_STATE', action);
      }
    };

    if (!isWorldView) {
      // @ts-expect-error - graphiumSync is dynamically added
      window.graphiumSync = sendSyncActionDirectly;
    }

    if (isWeb && typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('graphium-sync');
    }

    if (isWorldView) {
      // ============================================================
      // WORLD VIEW (CONSUMER)
      // ============================================================

      // eslint-disable-next-line complexity
      const handleSyncAction = (
        _event: Electron.IpcRendererEvent | null,
        action: SyncAction,
      ): void => {
        const store = useGameStore.getState();

        switch (action.type) {
          case 'FULL_SYNC': {
            const { tokenLibrary: fullLib, ...restState } = action.payload;
            useGameStore.setState(restState as Partial<SyncableGameState>);

            const activeMeasurement = action.payload.activeMeasurement ?? null;
            const broadcastMeasurement = Boolean(action.payload.broadcastMeasurement ?? false);
            store.setDmMeasurement(broadcastMeasurement ? activeMeasurement : null);

            if (fullLib) {
              useGameStore.setState((state) => ({
                campaign: { ...state.campaign, tokenLibrary: fullLib },
              }));
            }

            worldViewPrevStateRef.current = cloneSyncableStateFromPayload(action.payload, {
              gridColor: DEFAULT_GRID_COLOR,
            });
            break;
          }

          case 'LIBRARY_UPDATE':
            useGameStore.setState((state) => ({
              campaign: { ...state.campaign, tokenLibrary: action.payload },
            }));
            if (worldViewPrevStateRef.current) {
              worldViewPrevStateRef.current.tokenLibrary = [...action.payload];
            }
            break;

          case 'TOKEN_ADD':
            store.addToken(action.payload);
            break;

          case 'TOKEN_UPDATE': {
            const { id, changes } = action.payload;
            const currentToken = store.tokens.find((t) => t.id === id);
            if (currentToken) {
              const newTokens = store.tokens.map((t) => (t.id === id ? { ...t, ...changes } : t));
              useGameStore.setState({ tokens: newTokens });
              if (worldViewPrevStateRef.current) {
                worldViewPrevStateRef.current.tokens = [...newTokens];
              }
            }
            break;
          }

          case 'TOKEN_REMOVE':
            store.removeToken(action.payload.id);
            break;

          case 'TOKEN_DRAG_START':
          case 'TOKEN_DRAG_MOVE': {
            const { id: dId, x: dX, y: dY } = action.payload;
            const dToken = store.tokens.find((t) => t.id === dId);
            if (dToken) {
              const newTokens = store.tokens.map((t) =>
                t.id === dId ? { ...t, x: dX, y: dY } : t,
              );
              useGameStore.setState({ tokens: newTokens });
              if (worldViewPrevStateRef.current) {
                worldViewPrevStateRef.current.tokens = [...newTokens];
              }
            }
            break;
          }

          case 'TOKEN_DRAG_END': {
            const { id: eId, x: eX, y: eY } = action.payload;
            store.updateTokenPosition(eId, eX, eY);
            if (worldViewPrevStateRef.current) {
              const { tokens: updatedTokens } = useGameStore.getState();
              worldViewPrevStateRef.current.tokens = [...updatedTokens];
            }
            break;
          }

          case 'DRAWING_ADD':
            store.addDrawing(action.payload);
            break;

          case 'DRAWING_UPDATE': {
            const { id: drawId, changes: drawChanges } = action.payload;
            useGameStore.setState({
              drawings: store.drawings.map((d) => (d.id === drawId ? { ...d, ...drawChanges } : d)),
            });
            break;
          }

          case 'DRAWING_REMOVE':
            store.removeDrawing(action.payload.id);
            break;

          case 'DOOR_ADD':
            store.addDoor(action.payload);
            break;

          case 'DOOR_UPDATE': {
            const { id: doorId, changes: doorChanges } = action.payload;
            useGameStore.setState({
              doors: store.doors.map((d) => (d.id === doorId ? { ...d, ...doorChanges } : d)),
            });
            break;
          }

          case 'DOOR_REMOVE':
            store.removeDoor(action.payload.id);
            break;

          case 'DOOR_TOGGLE':
            store.toggleDoor(action.payload.id);
            break;

          case 'STAIRS_ADD':
            store.addStairs(action.payload);
            break;

          case 'STAIRS_UPDATE': {
            const { id: stairsId, changes: stairsChanges } = action.payload;
            useGameStore.setState({
              stairs: store.stairs.map((s) => (s.id === stairsId ? { ...s, ...stairsChanges } : s)),
            });
            break;
          }

          case 'STAIRS_REMOVE':
            store.removeStairs(action.payload.id);
            break;

          case 'MAP_UPDATE':
            useGameStore.setState({ map: action.payload });
            break;

          case 'GRID_UPDATE':
            useGameStore.setState(action.payload);
            break;

          case 'EXPLORED_UPDATE':
            useGameStore.setState({ exploredRegions: action.payload });
            break;

          case 'MEASUREMENT_UPDATE':
            store.setDmMeasurement(action.payload);
            break;

          default:
            break;
        }
      };

      if (isWeb && channel) {
        channel.onmessage = (event: MessageEvent<{ type: string }>): void => {
          const message = event.data;
          if (message?.type === 'REQUEST_INITIAL_STATE') {
            // Ignore (World View doesn't have initial state to give)
          } else if (message?.type) {
            handleSyncAction(null, message as SyncAction);
          }
        };
        channel.postMessage({ type: 'REQUEST_INITIAL_STATE' });
      } else if (isElectron && ipcRenderer) {
        ipcListener = (event: Electron.IpcRendererEvent, action: SyncAction): void => {
          handleSyncAction(event, action);
        };

        if (!listenerSetupRef.current) {
          ipcRenderer.on('SYNC_WORLD_STATE', ipcListener);
          listenerSetupRef.current = true;
        }

        ipcRenderer.send('REQUEST_INITIAL_STATE');
      }

      // BIDIRECTIONAL: Sync from World View to Architect
      const handleWorldViewUpdate = (state: GameState): void => {
        const actions = detectWorldViewTokenUpdates(worldViewPrevStateRef.current, state.tokens);
        actions.forEach((action) => {
          if (isWeb && channel) {
            channel.postMessage(action);
          } else if (isElectron && ipcRenderer) {
            ipcRenderer.send('SYNC_FROM_WORLD_VIEW', action);
          }
        });

        worldViewPrevStateRef.current = cloneSyncableStateFromGame(state);
      };

      const throttledWorldViewSync = throttle(handleWorldViewUpdate, 32);
      const unsubWorldView = useGameStore.subscribe((state: GameState) =>
        throttledWorldViewSync(state),
      );

      return (): void => {
        throttledWorldViewSync.cancel();
        unsubWorldView();
        if (channel) {
          channel.close();
        }
        if (listenerSetupRef.current && ipcRenderer && ipcListener) {
          ipcRenderer.off('SYNC_WORLD_STATE', ipcListener);
          listenerSetupRef.current = false;
        }
      };
    } else {
      // ============================================================
      // ARCHITECT VIEW (PRODUCER)
      // ============================================================

      const handleInitialStateRequest = (
        _event: Electron.IpcRendererEvent | MessageEvent | null,
      ): void => {
        const state = useGameStore.getState();
        const initialAction: SyncAction = {
          type: 'FULL_SYNC',
          payload: buildFullSyncPayload({
            tokens: state.tokens,
            tokenLibrary: state.campaign.tokenLibrary,
            drawings: state.drawings,
            doors: state.doors ?? [],
            stairs: state.stairs ?? [],
            gridSize: state.gridSize,
            gridType: state.gridType,
            gridColor: state.gridColor,
            map: state.map,
            exploredRegions: state.exploredRegions,
            isDaylightMode: state.isDaylightMode,
            activeMeasurement: state.activeMeasurement ?? null,
            broadcastMeasurement: state.broadcastMeasurement ?? false,
          }),
        };

        if (isWeb && channel) {
          channel.postMessage(initialAction);
        } else if (isElectron && ipcRenderer) {
          ipcRenderer.send('SYNC_WORLD_STATE', initialAction);
        }
      };

      const applyArchitectTokenUpdate = (id: string, changes: Partial<Token>): void => {
        const store = useGameStore.getState();
        if (!store.tokens.some((t) => t.id === id)) {
          return;
        }
        const newTokens = store.tokens.map((t) => (t.id === id ? { ...t, ...changes } : t));
        useGameStore.setState({ tokens: newTokens });
        if (prevStateRef.current) {
          prevStateRef.current.tokens = newTokens;
        }
      };

      if (isWeb && channel) {
        channel.onmessage = (event: MessageEvent<{ type: string }>): void => {
          if (event.data?.type === 'REQUEST_INITIAL_STATE') {
            handleInitialStateRequest(event);
          } else if (event.data?.type === 'TOKEN_UPDATE') {
            const updateAction = event.data as Extract<SyncAction, { type: 'TOKEN_UPDATE' }>;
            applyArchitectTokenUpdate(updateAction.payload.id, updateAction.payload.changes);
          }
        };
      } else if (isElectron && ipcRenderer) {
        ipcRenderer.on('REQUEST_INITIAL_STATE', handleInitialStateRequest);
      }

      const handleStoreUpdate = (state: GameState): void => {
        const syncableState: Partial<SyncableGameState> = {
          ...state,
          tokenLibrary: state.campaign.tokenLibrary,
        };

        const actions = detectChanges(prevStateRef.current ?? {}, syncableState);
        actions.forEach((action) => {
          if (isWeb && channel) {
            channel.postMessage(action);
          } else if (isElectron && ipcRenderer) {
            ipcRenderer.send('SYNC_WORLD_STATE', action);
          }
        });

        const prev = prevStateRef.current;
        prevStateRef.current = cloneSyncableStateFromGame(state, {
          prevExploredRegions: prev?.exploredRegions,
        });
      };

      const throttledSync = throttle(handleStoreUpdate, 32);
      const unsub = useGameStore.subscribe((state: GameState) => throttledSync(state));

      if (isElectron && ipcRenderer) {
        ipcRenderer.on(
          'SYNC_WORLD_STATE',
          (_event: Electron.IpcRendererEvent, action: SyncAction) => {
            if (action?.type === 'TOKEN_UPDATE') {
              applyArchitectTokenUpdate(action.payload.id, action.payload.changes);
            }
          },
        );
      }

      return (): void => {
        throttledSync.cancel();
        unsub();
        if (channel) {
          channel.close();
        }
        if (isElectron && ipcRenderer) {
          ipcRenderer.removeAllListeners('REQUEST_INITIAL_STATE');
          ipcRenderer.removeAllListeners('SYNC_WORLD_STATE');
        }
        // @ts-expect-error - graphiumSync is dynamically added
        delete window.graphiumSync;
      };
    }
  }, []);

  return null;
}

export default SyncManager;
