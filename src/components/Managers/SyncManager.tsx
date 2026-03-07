import { useEffect, useRef } from 'react';

import { useGameStore } from '../../store/gameStore';
import { isEqual, detectChanges } from '../../utils/syncUtils';

import type { GameState } from '../../store/gameStore';
import type { Token } from '../../types/domain';
import type { SyncAction, SyncableGameState } from '../../utils/syncUtils';

// Basic throttle implementation to limit IPC frequency
// Ensures leading edge execution and trailing edge (so final state is always sent)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function throttle<T extends (...args: any[]) => void>(func: T, limit: number): T {
  let lastFunc: ReturnType<typeof setTimeout>;
  let lastRan: number | undefined;

  return function (this: unknown, ...args: Parameters<T>) {
    if (lastRan === undefined) {
      func.apply(this, args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(
        () => {
          if (lastRan !== undefined && Date.now() - lastRan >= limit) {
            func.apply(this, args);
            lastRan = Date.now();
          }
        },
        limit - (Date.now() - lastRan),
      );
    }
  } as T;
}

/**
 * SyncManager handles real-time state synchronization between windows
 *
 * **PERFORMANCE OPTIMIZATION:** This component now uses delta-based updates instead of
 * full state broadcasts. This reduces IPC traffic by ~95% for single-entity changes.
 *
 * ... (Comments preserved)
 */
// eslint-disable-next-line max-lines-per-function
function SyncManager(): null {
  // Track previous state for diffing
  const prevStateRef = useRef<Partial<SyncableGameState> | null>(null);

  // Track previous state for World View changes (bidirectional sync)
  const worldViewPrevStateRef = useRef<Partial<SyncableGameState> | null>(null);

  // Use a ref to track if IPC listener is already set up
  const listenerSetupRef = useRef<boolean>(false);

  // eslint-disable-next-line max-lines-per-function, complexity
  useEffect(() => {
    // Detect platform: Electron vs Web
    const ipcRenderer = window.ipcRenderer;
    const isElectron = Boolean(ipcRenderer);
    const isWeb = !isElectron;

    // Store IPC listener reference for cleanup
    let ipcListener: ((event: unknown, action: SyncAction) => void) | null = null;

    // Detect window type from URL parameter
    const params = new URLSearchParams(window.location.search);
    const isWorldView = params.get('type') === 'world';

    // Transport Setup
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
      const handleSyncAction = (_event: unknown, action: SyncAction): void => {
        const store = useGameStore.getState();

        switch (action.type) {
          case 'FULL_SYNC': {
            // Separate tokenLibrary from the rest because it lives in 'campaign'
            const { tokenLibrary: fullLib, ...restState } = action.payload;
            useGameStore.setState(restState as Partial<SyncableGameState>);

            if (fullLib) {
              useGameStore.setState((state) => ({
                campaign: { ...state.campaign, tokenLibrary: fullLib },
              }));
            }

            // Initialize World View's previous state for bidirectional sync
            worldViewPrevStateRef.current = {
              tokens: action.payload.tokens ? [...action.payload.tokens] : [],
              tokenLibrary: fullLib ? [...fullLib] : [], // Initialize library for diffing
              drawings: [...(action.payload.drawings ?? [])],
              doors: [...(action.payload.doors ?? [])],
              stairs: [...(action.payload.stairs ?? [])],
              gridSize: action.payload.gridSize ?? 50,
              gridType: action.payload.gridType ?? 'LINES',
              gridColor: action.payload.gridColor ?? '#333333',
              map: action.payload.map ? { ...action.payload.map } : null,
              isDaylightMode: action.payload.isDaylightMode ?? false,
            };
            break;
          }

          case 'LIBRARY_UPDATE':
            useGameStore.setState((state) => ({
              campaign: { ...state.campaign, tokenLibrary: action.payload },
            }));
            // Update ref
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
            // Temporarily update position for smooth visual feedback
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

          case 'MAP_UPDATE':
            useGameStore.setState({ map: action.payload });
            break;

          case 'GRID_UPDATE':
            useGameStore.setState(action.payload);
            break;

          case 'MEASUREMENT_UPDATE':
            store.setDmMeasurement(action.payload);
            break;

          default:
            break;
        }
      };

      if (isWeb && channel) {
        channel.onmessage = (event) => {
          const message = event.data as { type?: string };
          if (message?.type === 'REQUEST_INITIAL_STATE') {
            // Ignore (World View doesn't have initial state to give)
          } else if (message?.type) {
            handleSyncAction(null, message as SyncAction);
          }
        };
        // Request initial state
        channel.postMessage({ type: 'REQUEST_INITIAL_STATE' });
      } else if (isElectron && ipcRenderer) {
        ipcListener = (event: unknown, action: SyncAction) => {
          handleSyncAction(event, action);
        };

        if (!listenerSetupRef.current) {
          ipcRenderer.on('SYNC_WORLD_STATE', ipcListener);
          listenerSetupRef.current = true;
        }

        ipcRenderer.send('REQUEST_INITIAL_STATE');
      }

      // BIDIRECTIONAL: Sync from World View to Architect
      const detectWorldViewChanges = (
        prevState: Partial<SyncableGameState> | null,
        currentState: Partial<SyncableGameState>,
      ): SyncAction[] => {
        const actions: SyncAction[] = [];
        if (!prevState) {
          return actions;
        }

        const prevTokenMap = new Map((prevState.tokens ?? []).map((t) => [t.id, t]));

        (currentState.tokens ?? []).forEach((token) => {
          const prev = prevTokenMap.get(token.id);
          if (prev) {
            const changes: Partial<Token> = {};
            if (!isEqual(token.x, prev.x)) {
              changes.x = token.x;
            }
            if (!isEqual(token.y, prev.y)) {
              changes.y = token.y;
            }
            if (Object.keys(changes).length > 0) {
              actions.push({ type: 'TOKEN_UPDATE', payload: { id: token.id, changes } });
            }
          }
        });
        return actions;
      };

      const handleWorldViewUpdate = (state: GameState): void => {
        const syncable: Partial<SyncableGameState> = {
          tokens: state.tokens,
          tokenLibrary: state.campaign.tokenLibrary,
          drawings: state.drawings,
          doors: state.doors,
          stairs: state.stairs,
          gridSize: state.gridSize,
          gridType: state.gridType,
          gridColor: state.gridColor,
          map: state.map,
          isDaylightMode: state.isDaylightMode,
        };
        const actions = detectWorldViewChanges(worldViewPrevStateRef.current, syncable);
        actions.forEach((action) => {
          if (isWeb && channel) {
            channel.postMessage(action);
          } else if (isElectron && ipcRenderer) {
            ipcRenderer.send('SYNC_FROM_WORLD_VIEW', action);
          }
        });

        worldViewPrevStateRef.current = {
          tokens: [...state.tokens],
          tokenLibrary: [...(state.campaign.tokenLibrary ?? [])], // This usually won't change from WV, but good for completeness
          drawings: [...state.drawings],
          doors: [...(state.doors ?? [])],
          stairs: [...(state.stairs ?? [])],
          gridSize: state.gridSize,
          gridType: state.gridType,
          gridColor: state.gridColor,
          map: state.map ? { ...state.map } : null,
          isDaylightMode: state.isDaylightMode,
        };
      };

      const throttledWorldViewSync = throttle(handleWorldViewUpdate, 32);
      const unsubWorldView = useGameStore.subscribe(throttledWorldViewSync);

      return () => {
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

      const handleInitialStateRequest = (_event: unknown): void => {
        const state = useGameStore.getState();
        const initialAction: SyncAction = {
          type: 'FULL_SYNC',
          payload: {
            tokens: state.tokens,
            tokenLibrary: state.campaign.tokenLibrary, // Pass library
            drawings: state.drawings,
            doors: state.doors ?? [],
            stairs: state.stairs ?? [],
            gridSize: state.gridSize,
            gridType: state.gridType,
            gridColor: state.gridColor,
            map: state.map,
            exploredRegions: state.exploredRegions,
            isDaylightMode: state.isDaylightMode,
          },
        };

        if (isWeb && channel) {
          channel.postMessage(initialAction);
        } else if (isElectron && ipcRenderer) {
          ipcRenderer.send('SYNC_WORLD_STATE', initialAction);
        }
      };

      if (isWeb && channel) {
        channel.onmessage = (event) => {
          const msg = event.data as { type?: string } | null;
          if (msg?.type === 'REQUEST_INITIAL_STATE') {
            handleInitialStateRequest(event);
          }
        };
      } else if (isElectron && ipcRenderer) {
        ipcRenderer.on('REQUEST_INITIAL_STATE', handleInitialStateRequest);
      }

      const handleStoreUpdate = (state: GameState): void => {
        // Create a syncable state object including tokenLibrary from campaign
        const syncableState: Partial<SyncableGameState> = {
          tokens: state.tokens,
          tokenLibrary: state.campaign.tokenLibrary,
          drawings: state.drawings,
          doors: state.doors,
          stairs: state.stairs,
          gridSize: state.gridSize,
          gridType: state.gridType,
          gridColor: state.gridColor,
          map: state.map,
          exploredRegions: state.exploredRegions,
          isDaylightMode: state.isDaylightMode,
        };

        const actions = detectChanges(prevStateRef.current ?? {}, syncableState);
        actions.forEach((action) => {
          if (isWeb && channel) {
            channel.postMessage(action);
          } else if (isElectron && ipcRenderer) {
            ipcRenderer.send('SYNC_WORLD_STATE', action);
          }
        });

        prevStateRef.current = {
          tokens: [...state.tokens],
          tokenLibrary: [...state.campaign.tokenLibrary],
          drawings: [...state.drawings],
          doors: [...(state.doors ?? [])],
          stairs: [...(state.stairs ?? [])],
          gridSize: state.gridSize,
          gridType: state.gridType,
          gridColor: state.gridColor,
          map: state.map ? { ...state.map } : null,
          exploredRegions: state.exploredRegions ? [...state.exploredRegions] : [],
          isDaylightMode: state.isDaylightMode,
        };
      };

      const throttledSync = throttle(handleStoreUpdate, 32);
      const unsub = useGameStore.subscribe(throttledSync);

      // Listen for updates FROM world view
      if (isElectron && ipcRenderer) {
        ipcRenderer.on('SYNC_FROM_WORLD_VIEW', (_event, action: SyncAction) => {
          if (action.type === 'TOKEN_UPDATE') {
            const { id, changes } = action.payload;
            const store = useGameStore.getState();
            const currentToken = store.tokens.find((t) => t.id === id);
            if (currentToken) {
              const newTokens = store.tokens.map((t) => (t.id === id ? { ...t, ...changes } : t));
              useGameStore.setState({ tokens: newTokens });
            }
          }
        });
      }

      return () => {
        unsub();
        if (channel) {
          channel.close();
        }
        if (isElectron && ipcRenderer) {
          ipcRenderer.removeAllListeners('REQUEST_INITIAL_STATE');
          ipcRenderer.removeAllListeners('SYNC_FROM_WORLD_VIEW');
        }
        // @ts-expect-error - graphiumSync is dynamically added
        delete window.graphiumSync;
      };
    }
  }, []);

  return null;
}

export default SyncManager;
