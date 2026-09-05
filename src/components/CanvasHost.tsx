import type { JSX } from 'react';

import { useShallow } from 'zustand/shallow';

import { ProfiledCanvasManager } from '../perf/profiler';
import { useUiStore } from '../store/uiStore';

/**
 * Feeds CanvasManager from uiStore so App does not subscribe to tool state (plan 005).
 * CanvasManager takes `tool` as a prop and must re-render on a tool switch; that render is
 * expected. Selection is written back through the store's stable setter.
 */
export default function CanvasHost({ isWorldView }: { isWorldView: boolean }): JSX.Element {
  const { tool, color, doorOrientation, measurementMode, setSelectedTokenIds } = useUiStore(
    useShallow((state) => ({
      tool: state.tool,
      color: state.color,
      doorOrientation: state.doorOrientation,
      measurementMode: state.measurementMode,
      setSelectedTokenIds: state.setSelectedTokenIds,
    })),
  );
  return (
    <ProfiledCanvasManager
      tool={tool}
      color={color}
      doorOrientation={doorOrientation}
      isWorldView={isWorldView}
      onSelectionChange={setSelectedTokenIds}
      measurementMode={measurementMode}
    />
  );
}
