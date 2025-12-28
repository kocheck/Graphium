import StairsShape from './StairsShape';
import type { Stairs } from '../../store/gameStore';

interface StairsLayerProps {
  stairs: Stairs[];
  isWorldView: boolean;
}

/**
 * StairsLayer renders all stairs on the canvas
 *
 * **Rendering Order:**
 * - Stairs are rendered with walls and doors (architectural elements)
 * - They appear below tokens to avoid obscuring characters
 *
 * **Interaction:**
 * - Stairs are non-interactive in both DM and World View
 * - They serve as visual indicators for level transitions
 *
 * **Performance:**
 * - Each staircase is rendered as a separate Konva Group
 * - The layer itself does not listen to events (stairs are static)
 *
 * @param stairs - Array of stairs from gameStore
 * @param isWorldView - If true, player view (currently no behavioral difference)
 */
const StairsLayer = ({ stairs, isWorldView }: StairsLayerProps) => {
  return (
    <>
      {stairs.map((stair) => (
        <StairsShape
          key={stair.id}
          stairs={stair}
          isWorldView={isWorldView}
        />
      ))}
    </>
  );
};

export default StairsLayer;
