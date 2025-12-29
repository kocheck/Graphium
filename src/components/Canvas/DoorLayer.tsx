import DoorShape from './DoorShape';
import type { Door } from '../../store/gameStore';

interface DoorLayerProps {
  doors: Door[];
  isWorldView: boolean;
  onToggleDoor?: (id: string) => void;
}

/**
 * DoorLayer renders all doors on the canvas
 *
 * **Rendering Order:**
 * - Doors are rendered AFTER walls but BEFORE tokens
 * - This ensures doors appear on top of walls but don't obscure tokens
 *
 * **Interaction:**
 * - In DM mode: Doors can be clicked to toggle open/closed (unless locked)
 * - In World View: Doors are non-interactive (read-only)
 *
 * **Performance:**
 * - Each door is rendered as a separate Konva Group for individual interaction
 * - The layer itself does not listen to events (only door shapes do)
 *
 * @param doors - Array of doors from gameStore
 * @param isWorldView - If true, blocks interaction (player view)
 * @param onToggleDoor - Callback when a door is toggled (DM only)
 */
const DoorLayer = ({ doors, isWorldView, onToggleDoor }: DoorLayerProps) => {
  console.log('[DoorLayer] Rendering', doors.length, 'doors. isWorldView:', isWorldView);
  console.log('[DoorLayer] Doors state:', doors.map(d => ({id: d.id, isOpen: d.isOpen})));

  return (
    <>
      {doors.map((door) => {
        console.log('[DoorLayer] Rendering door:', door.id, 'isOpen:', door.isOpen, 'at', door.x, door.y);
        return (
          <DoorShape
            key={door.id}
            door={door}
            isWorldView={isWorldView}
            onToggle={onToggleDoor}
          />
        );
      })}
    </>
  );
};

export default DoorLayer;
