import type { Door } from '../../types/domain';

interface DoorContextMenuProps {
  /** The door entity for this context menu */
  door: Door;
  /** X position relative to canvas container (pixels) */
  x: number;
  /** Y position relative to canvas container (pixels) */
  y: number;
  /** Toggle door open/closed state */
  onToggleDoor: (id: string) => void;
  /** Toggle door locked/unlocked state */
  onUpdateDoorLock: (id: string, locked: boolean) => void;
  /** Remove the door from the map */
  onRemoveDoor: (id: string) => void;
  /** Close this context menu */
  onClose: () => void;
}

/**
 * Context menu for door interactions (right-click on a door).
 *
 * Provides actions: Open/Close, Lock/Unlock, Delete.
 * Locked doors cannot be toggled open/closed (button is disabled).
 * Renders with an invisible backdrop to close on outside click.
 */
export default function DoorContextMenu({
  door,
  x,
  y,
  onToggleDoor,
  onUpdateDoorLock,
  onRemoveDoor,
  onClose,
}: DoorContextMenuProps): JSX.Element {
  return (
    <>
      {/* Invisible backdrop to close menu on outside click */}
      <div className="fixed inset-0 z-40" onClick={onClose} role="presentation" />
      <div
        className="absolute z-50 bg-[var(--app-bg-secondary)] border border-[var(--app-border)] rounded-lg shadow-lg py-1 min-w-[160px]"
        style={{ left: x, top: y }}
      >
        <button
          className="w-full px-3 py-1.5 text-left text-sm text-[var(--app-text-primary)] hover:bg-[var(--app-bg-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={door.isLocked}
          onClick={() => {
            onToggleDoor(door.id);
            onClose();
          }}
        >
          {door.isOpen ? 'Close Door' : 'Open Door'}
        </button>
        <button
          className="w-full px-3 py-1.5 text-left text-sm text-[var(--app-text-primary)] hover:bg-[var(--app-bg-tertiary)]"
          onClick={() => {
            onUpdateDoorLock(door.id, !door.isLocked);
            onClose();
          }}
        >
          {door.isLocked ? 'Unlock Door' : 'Lock Door'}
        </button>
        <div className="border-t border-[var(--app-border)] my-1" />
        <button
          className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-[var(--app-bg-tertiary)]"
          onClick={() => {
            onRemoveDoor(door.id);
            onClose();
          }}
        >
          Delete Door
        </button>
      </div>
    </>
  );
}
