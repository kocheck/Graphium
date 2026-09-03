import { useEffect, useRef } from 'react';

import { DEFAULT_GRID_COLOR, useGameStore } from '../store/gameStore';
import { recordIpcAction } from '../utils/perfCounters';
import { queueSyncAction, setRafSyncSender } from '../utils/rafSync';
import {
  beginInboundApply,
  endInboundApply,
  isInboundApply,
  registerArchitectPrevStamper,
  stampTokenPositionsOnSnapshot,
} from '../utils/syncStamp';
import {
  buildFullSyncPayload,
  cloneSyncableStateFromGame,
  cloneSyncableStateFromPayload,
  coalesceSyncActions,
  detectChanges,
  detectWorldViewTokenUpdates,
  isSyncSliceUnchanged,
} from '../utils/syncUtils';
import { throttle } from '../utils/throttle';
import { patchTokenInIndex } from '../utils/tokenIndex';
import { applyTokenNodePosition, applyTokenNodePositions } from '../utils/tokenNodeRegistry';
import {
  pickTokenPositionChanges,
  sanitizeWorldToArchitectAction,
} from '../utils/worldViewTokenSync';

import type { GameState, Token } from '../store/gameStore';
import type { SyncAction, SyncableGameState } from '../utils/syncUtils';
import type { WorldToArchitectAction } from '../utils/worldViewTokenSync';

// eslint-disable-next-line max-lines-per-function
function SyncManager(): null {
  const prevStateRef = useRef<SyncableGameState | null>(null);
  const worldViewPrevStateRef = useRef<SyncableGameState | null>(null);

  // eslint-disable-next-line max-lines-per-function
  useEffect((): (() => void) => {
    const ipcRenderer = window.ipcRenderer;
    const isElectron = Boolean(ipcRenderer);
    const isWeb = !isElectron;

    let ipcListener: ((event: Electron.IpcRendererEvent, action: SyncAction) => void) | null = null;

    const params = new URLSearchParams(window.location.search);
    const isWorldView = params.get('type') === 'world';

    let channel: BroadcastChannel | null = null;

    const sendSyncAction = (action: SyncAction): void => {
      recordIpcAction(action.type);
      if (isWeb && channel) {
        channel.postMessage(action);
      } else if (isElectron && ipcRenderer) {
        ipcRenderer.send('SYNC_WORLD_STATE', action);
      }
    };

    setRafSyncSender(sendSyncAction);

    const sendCoalescedActions = (
      actions: SyncAction[],
      currentState: Partial<SyncableGameState>,
    ): void => {
      for (const action of coalesceSyncActions(actions, currentState)) {
        sendSyncAction(action);
      }
    };

    if (!isWorldView) {
      window.graphiumSync = queueSyncAction;
    }

    if (isWeb && typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('graphium-sync');
    }

    if (isWorldView) {
      // eslint-disable-next-line complexity
      const applyDragPositions = (
        positions: Array<{ id: string; x: number; y: number }>,
        commit: boolean,
      ): void => {
        applyTokenNodePositions(positions);
        if (!commit) {
          return;
        }
        beginInboundApply();
        try {
          for (const pos of positions) {
            useGameStore.getState().updateTokenPosition(pos.id, pos.x, pos.y);
          }
          if (worldViewPrevStateRef.current) {
            stampTokenPositionsOnSnapshot(worldViewPrevStateRef.current, positions);
          }
        } finally {
          endInboundApply();
        }
      };

      // eslint-disable-next-line complexity
      const handleSyncAction = (
        _event: Electron.IpcRendererEvent | null,
        action: SyncAction,
      ): void => {
        const store = useGameStore.getState();

        switch (action.type) {
          case 'BATCH':
            for (const inner of action.payload) {
              if (inner.type !== 'BATCH') {
                handleSyncAction(_event, inner);
              }
            }
            break;

          case 'FULL_SYNC': {
            const { tokenLibrary: fullLib, ...restState } = action.payload;
            store.setState({
              ...(restState as Partial<SyncableGameState>),
              tokens: action.payload.tokens ?? store.tokens,
            });

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
            const patched = patchTokenInIndex(store.tokens, store.tokensById, id, changes);
            if (patched) {
              beginInboundApply();
              try {
                useGameStore.setState(patched);
                if (worldViewPrevStateRef.current) {
                  worldViewPrevStateRef.current.tokens = [...patched.tokens];
                }
              } finally {
                endInboundApply();
              }
            }
            break;
          }

          case 'TOKEN_REMOVE':
            store.removeToken(action.payload.id);
            break;

          case 'TOKEN_DRAG_START':
          case 'TOKEN_DRAG_MOVE':
            applyTokenNodePosition(action.payload.id, action.payload.x, action.payload.y);
            break;

          case 'TOKEN_DRAG_MOVE_BATCH':
            applyTokenNodePositions(action.payload);
            break;

          case 'TOKEN_DRAG_END': {
            applyDragPositions([action.payload], true);
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
          if (message?.type && message.type !== 'REQUEST_INITIAL_STATE') {
            handleSyncAction(null, message as SyncAction);
          }
        };
        channel.postMessage({ type: 'REQUEST_INITIAL_STATE' });
      } else if (isElectron && ipcRenderer) {
        ipcListener = (event: Electron.IpcRendererEvent, action: SyncAction): void => {
          handleSyncAction(event, action);
        };
        ipcRenderer.on('SYNC_WORLD_STATE', ipcListener);
        ipcRenderer.send('REQUEST_INITIAL_STATE');
      }

      const handleWorldViewUpdate = (state: GameState): void => {
        const actions = detectWorldViewTokenUpdates(worldViewPrevStateRef.current, state.tokens);
        actions.forEach((action) => {
          if (isWeb && channel) {
            channel.postMessage(action);
          } else if (isElectron && ipcRenderer) {
            ipcRenderer.send('SYNC_FROM_WORLD_VIEW', action);
          }
        });

        if (actions.length > 0 || !worldViewPrevStateRef.current) {
          worldViewPrevStateRef.current = cloneSyncableStateFromGame(state);
        } else {
          worldViewPrevStateRef.current.tokens = [...state.tokens];
        }
      };

      const throttledWorldViewSync = throttle(handleWorldViewUpdate, 32);
      const unsubWorldView = useGameStore.subscribe((state: GameState, previous: GameState) => {
        if (isInboundApply() || state.tokens === previous.tokens) {
          return;
        }
        throttledWorldViewSync(state);
      });

      return (): void => {
        setRafSyncSender(null);
        throttledWorldViewSync.cancel();
        unsubWorldView();
        if (channel) {
          channel.close();
        }
        if (ipcRenderer && ipcListener) {
          ipcRenderer.off('SYNC_WORLD_STATE', ipcListener);
        }
      };
    }

    const handleInitialStateRequest = (
      _event: Electron.IpcRendererEvent | MessageEvent | null,
    ): void => {
      const state = useGameStore.getState();
      sendSyncAction({
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
      });
    };

    const applyArchitectTokenUpdate = (id: string, changes: Partial<Token>): void => {
      const positionOnly = pickTokenPositionChanges(changes);
      const store = useGameStore.getState();
      const existing = store.tokensById[id];
      if (!existing) {
        return;
      }
      const x = positionOnly.x ?? existing.x;
      const y = positionOnly.y ?? existing.y;
      if (x === existing.x && y === existing.y) {
        return;
      }
      store.updateTokenPosition(id, x, y);
      stampTokenPositionsOnSnapshot(prevStateRef.current, [{ id, x, y }]);
    };

    const applyWorldToArchitectAction = (rawAction: unknown): void => {
      const action = sanitizeWorldToArchitectAction(rawAction);
      if (!action) {
        return;
      }

      const applyOne = (
        update: Extract<WorldToArchitectAction, { type: 'TOKEN_UPDATE' }>,
      ): void => {
        applyArchitectTokenUpdate(update.payload.id, update.payload.changes);
      };

      if (action.type === 'TOKEN_UPDATE') {
        applyOne(action);
        return;
      }

      for (const inner of action.payload) {
        applyOne(inner);
      }
    };

    if (isWeb && channel) {
      channel.onmessage = (event: MessageEvent<{ type: string }>): void => {
        if (event.data?.type === 'REQUEST_INITIAL_STATE') {
          handleInitialStateRequest(event);
        } else if (event.data?.type === 'TOKEN_UPDATE' || event.data?.type === 'BATCH') {
          applyWorldToArchitectAction(event.data);
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

      // null prev → FULL_SYNC (first Architect subscribe snapshot after mount).
      const actions = detectChanges(prevStateRef.current, syncableState);
      sendCoalescedActions(actions, syncableState);

      if (actions.length === 0 && prevStateRef.current) {
        return;
      }

      prevStateRef.current = cloneSyncableStateFromGame(state, {
        prevExploredRegions: prevStateRef.current?.exploredRegions,
      });
    };

    registerArchitectPrevStamper((id, x, y) => {
      stampTokenPositionsOnSnapshot(prevStateRef.current, [{ id, x, y }]);
    });

    const throttledSync = throttle(handleStoreUpdate, 32);
    const unsub = useGameStore.subscribe((state: GameState, previous: GameState) => {
      if (isInboundApply() || isSyncSliceUnchanged(state, previous)) {
        return;
      }
      throttledSync(state);
    });

    if (isElectron && ipcRenderer) {
      ipcRenderer.on(
        'SYNC_WORLD_STATE',
        (_event: Electron.IpcRendererEvent, action: SyncAction) => {
          applyWorldToArchitectAction(action);
        },
      );
    }

    return (): void => {
      registerArchitectPrevStamper(null);
      setRafSyncSender(null);
      throttledSync.cancel();
      unsub();
      if (channel) {
        channel.close();
      }
      if (isElectron && ipcRenderer) {
        ipcRenderer.removeAllListeners('REQUEST_INITIAL_STATE');
        ipcRenderer.removeAllListeners('SYNC_WORLD_STATE');
      }
      delete window.graphiumSync;
    };
  }, []);

  return null;
}

export default SyncManager;
