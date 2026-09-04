import { useEffect, useState } from 'react';

import { useGameStore } from '../../store/gameStore';
import { parseSessionConsoleWorldEvent } from '../../utils/syncUtils';

type WorldLinkStatus = 'closed' | 'connected' | 'armed';

export function useWorldLinkStatus(): WorldLinkStatus {
  const worldArmed = useGameStore((state) => state.sessionConsoleRuntime.worldArmed);
  const [worldConnected, setWorldConnected] = useState(false);

  useEffect(() => {
    const markConnected = (): void => {
      setWorldConnected(true);
    };
    const onWorldEvent = (_event: unknown, raw?: unknown): void => {
      const parsed = parseSessionConsoleWorldEvent(raw ?? _event);
      if (parsed?.type === 'ready' || parsed?.type === 'armed') {
        markConnected();
      }
      if (parsed?.type === 'unarmed') {
        setWorldConnected(false);
      }
    };

    window.ipcRenderer?.on('REQUEST_INITIAL_STATE', markConnected);
    window.ipcRenderer?.on('SESSION_CONSOLE_WORLD_EVENT', onWorldEvent);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined' && !window.ipcRenderer) {
      channel = new BroadcastChannel('graphium-sync');
      channel.onmessage = (event: MessageEvent<{ type?: string; payload?: unknown }>): void => {
        if (event.data?.type === 'REQUEST_INITIAL_STATE') {
          markConnected();
        }
        if (event.data?.type === 'SESSION_CONSOLE_WORLD_EVENT') {
          onWorldEvent(event.data.payload);
        }
      };
    }

    return () => {
      window.ipcRenderer?.off('REQUEST_INITIAL_STATE', markConnected);
      window.ipcRenderer?.off('SESSION_CONSOLE_WORLD_EVENT', onWorldEvent);
      channel?.close();
    };
  }, []);

  if (worldArmed) {
    return 'armed';
  }
  if (worldConnected) {
    return 'connected';
  }
  return 'closed';
}
