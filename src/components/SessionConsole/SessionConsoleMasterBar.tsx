import {
  RiPauseLine,
  RiPlayLine,
  RiRestartLine,
  RiStopLine,
  RiVolumeMuteLine,
} from '@remixicon/react';

import { useWorldLinkStatus } from './useWorldLinkStatus';
import { useGameStore } from '../../store/gameStore';

const STATUS_LABEL: Record<ReturnType<typeof useWorldLinkStatus>, string> = {
  closed: 'World closed',
  connected: 'World connected',
  armed: 'World armed',
};

const STATUS_COLOR: Record<ReturnType<typeof useWorldLinkStatus>, string> = {
  closed: '#6b7280',
  connected: '#d97706',
  armed: '#22c55e',
};

export function SessionConsoleMasterBar(): JSX.Element {
  const runtime = useGameStore((state) => state.sessionConsoleRuntime);
  const dispatchSessionConsole = useGameStore((state) => state.dispatchSessionConsole);
  const status = useWorldLinkStatus();

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span
          data-testid="session-console-status"
          aria-label={STATUS_LABEL[status]}
          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: STATUS_COLOR[status] }}
        />
        <span className="text-xs truncate" style={{ color: 'var(--app-text-secondary)' }}>
          {STATUS_LABEL[status]}
        </span>
      </div>
      <label className="block text-xs" style={{ color: 'var(--app-text-secondary)' }}>
        Volume
        <input
          type="range"
          min={0}
          max={100}
          aria-label="Session volume"
          value={runtime.volume}
          onChange={(event) =>
            dispatchSessionConsole({ type: 'SET_VOLUME', volume: Number(event.target.value) })
          }
          className="w-full mt-1"
        />
      </label>
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className="btn btn-secondary px-2 py-1 text-xs"
          aria-pressed={runtime.ducked}
          onClick={() => dispatchSessionConsole({ type: 'SET_DUCKED', ducked: !runtime.ducked })}
        >
          <RiVolumeMuteLine className="w-3.5 h-3.5 inline" /> Duck
        </button>
        <button
          type="button"
          className="btn btn-secondary px-2 py-1 text-xs"
          onClick={() => dispatchSessionConsole({ type: 'PAUSE' })}
        >
          <RiPauseLine className="w-3.5 h-3.5 inline" /> Pause
        </button>
        <button
          type="button"
          className="btn btn-secondary px-2 py-1 text-xs"
          onClick={() => dispatchSessionConsole({ type: 'RESUME' })}
        >
          <RiPlayLine className="w-3.5 h-3.5 inline" /> Resume
        </button>
        <button
          type="button"
          className="btn btn-secondary px-2 py-1 text-xs"
          onClick={() => dispatchSessionConsole({ type: 'RESTART' })}
        >
          <RiRestartLine className="w-3.5 h-3.5 inline" /> Restart
        </button>
        <button
          type="button"
          className="btn btn-secondary px-2 py-1 text-xs"
          onClick={() => dispatchSessionConsole({ type: 'STOP' })}
        >
          <RiStopLine className="w-3.5 h-3.5 inline" /> Stop
        </button>
        <button
          type="button"
          className="btn btn-secondary px-2 py-1 text-xs"
          onClick={() => dispatchSessionConsole({ type: 'RETURN_TO_MAP' })}
        >
          Return to map
        </button>
        <button
          type="button"
          className="btn btn-secondary px-2 py-1 text-xs"
          onClick={() => dispatchSessionConsole({ type: 'FIRE_SFX', sfxId: 'test-tone' })}
        >
          Test tone
        </button>
      </div>
    </div>
  );
}
