import { useGameStore } from '../store/gameStore';
import { RiLockLine, RiDoorOpenLine, RiLockUnlockLine } from '@remixicon/react';

/**
 * DoorControls provides bulk operations for managing all doors in the dungeon
 *
 * **Features:**
 * - Open All Doors: Opens all doors simultaneously
 * - Close All Doors: Closes all doors simultaneously
 * - Unlock All Doors: Unlocks all locked doors
 *
 * **Use Cases:**
 * - DM wants to reset dungeon state between encounters
 * - DM wants to quickly unlock all doors for players
 * - DM wants to close all doors for dramatic effect
 *
 * @component
 */
const DoorControls = () => {
  const doors = useGameStore((state) => state.doors);
  const updateAllDoorStates = useGameStore((state) => state.updateAllDoorStates);
  const updateAllDoorLocks = useGameStore((state) => state.updateAllDoorLocks);

  const doorCount = doors.length;
  const openDoorCount = doors.filter((d) => d.isOpen).length;
  const closedDoorCount = doorCount - openDoorCount;
  const lockedDoorCount = doors.filter((d) => d.isLocked).length;

  const handleOpenAll = () => {
    updateAllDoorStates(true);
  };

  const handleCloseAll = () => {
    updateAllDoorStates(false);
  };

  const handleUnlockAll = () => {
    updateAllDoorLocks(false);
  };

  // Don't show controls if there are no doors
  if (doorCount === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3
          className="text-sm uppercase font-bold tracking-wider"
          style={{ color: 'var(--app-text-secondary)' }}
        >
          Door Controls
        </h3>
        <span className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
          {doorCount} door{doorCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Door statistics */}
      <div className="text-xs mb-3 space-y-1" style={{ color: 'var(--app-text-muted)' }}>
        <div className="flex justify-between">
          <span>Open:</span>
          <span className="font-mono">{openDoorCount}</span>
        </div>
        <div className="flex justify-between">
          <span>Closed:</span>
          <span className="font-mono">{closedDoorCount}</span>
        </div>
        {lockedDoorCount > 0 && (
          <div className="flex justify-between text-orange-400">
            <span className="flex items-center gap-1">
              <RiLockLine className="w-3 h-3" /> Locked:
            </span>
            <span className="font-mono">{lockedDoorCount}</span>
          </div>
        )}
      </div>

      {/* Bulk action buttons */}
      <div className="space-y-2">
        <button
          onClick={handleOpenAll}
          disabled={closedDoorCount === 0 || closedDoorCount === lockedDoorCount}
          className="btn btn-default w-full text-xs py-2 px-3 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          title="Open all unlocked doors"
        >
          <span className="flex items-center justify-center gap-1">
            <RiDoorOpenLine className="w-4 h-4" /> Open All (
            {Math.max(0, closedDoorCount - lockedDoorCount)})
          </span>
        </button>

        <button
          onClick={handleCloseAll}
          disabled={openDoorCount === 0}
          className="btn btn-default w-full text-xs py-2 px-3 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          title="Close all open doors"
        >
          <span className="flex items-center justify-center gap-1">
            <RiDoorOpenLine className="w-4 h-4" /> Close All ({openDoorCount})
          </span>
        </button>

        {lockedDoorCount > 0 && (
          <button
            onClick={handleUnlockAll}
            className="btn btn-default w-full text-xs py-2 px-3 rounded transition bg-orange-600/20 hover:bg-orange-600/30"
            title="Unlock all locked doors"
          >
            <span className="flex items-center justify-center gap-1">
              <RiLockUnlockLine className="w-4 h-4" /> Unlock All ({lockedDoorCount})
            </span>
          </button>
        )}
      </div>

      <div
        className="mt-3 text-[10px] italic p-2 rounded"
        style={{
          color: 'var(--app-text-muted)',
          backgroundColor: 'var(--app-bg-subtle)',
        }}
      >
        <strong>Tip:</strong> Click individual doors on the map to toggle them. Locked doors must be
        unlocked first.
      </div>
    </div>
  );
};

export default DoorControls;
