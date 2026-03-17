/**
 * Toolbar — Desktop floating toolbar for tool selection and game controls
 *
 * Renders the bottom-center toolbar with tool buttons, measurement controls,
 * play/pause toggle, and floating color palette (when marker tool is active).
 * Only rendered in Architect View on desktop (not mobile — see MobileToolbar).
 *
 * @see src/hooks/useToolState.ts for tool state management
 * @see src/components/Mobile/MobileToolbar.tsx for mobile equivalent
 */

import {
  RiPlayFill,
  RiPauseFill,
  RiCursorLine,
  RiPencilLine,
  RiEraserLine,
  RiLayoutMasonryLine,
  RiDoorOpenLine,
  RiRulerLine,
} from '@remixicon/react';

import Tooltip from './Tooltip';

import type { UseToolStateReturn } from '../hooks/useToolState';
import type { HexColor } from '../types/domain';

interface ToolbarProps {
  toolState: UseToolStateReturn;
  isGamePaused: boolean;
  onPauseToggle: () => void;
}

// eslint-disable-next-line max-lines-per-function, complexity
function Toolbar({ toolState, isGamePaused, onPauseToggle }: ToolbarProps): JSX.Element {
  const {
    tool,
    setTool,
    color,
    handleColorChange,
    recentColors,
    colorInputRef,
    doorOrientation,
    setDoorOrientation,
    measurementMode,
    setMeasurementMode,
    broadcastMeasurement,
    setBroadcastMeasurement,
  } = toolState;

  return (
    <>
      {/* Desktop Toolbar */}
      <div className="toolbar fixed bottom-4 left-1/2 -translate-x-1/2 p-3 rounded-lg shadow-2xl flex items-center gap-2 z-50 bg-black border-2 border-neutral-600">
        {/* Play/Pause Button */}
        <Tooltip
          content={
            isGamePaused ? 'Resume - Players will see the map' : 'Pause - Hide map from players'
          }
        >
          <button
            className={`btn btn-tool flex items-center justify-center font-semibold ${
              isGamePaused
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
            onClick={onPauseToggle}
            aria-label={isGamePaused ? 'Resume game' : 'Pause game'}
          >
            {isGamePaused ? (
              <RiPlayFill className="w-5 h-5" />
            ) : (
              <RiPauseFill className="w-5 h-5" />
            )}
          </button>
        </Tooltip>
        <div className="toolbar-divider w-px mx-1"></div>
        {/* Select Tool */}
        <Tooltip content="Select (V)">
          <button
            className={`btn btn-tool p-2 ${tool === 'select' ? 'active' : ''}`}
            onClick={() => setTool('select')}
            aria-label="Select tool"
          >
            <RiCursorLine className="w-5 h-5" />
          </button>
        </Tooltip>
        {/* Marker Tool */}
        <Tooltip content="Marker (M)">
          <button
            className={`btn btn-tool p-2 ${tool === 'marker' ? 'active' : ''}`}
            onClick={() => setTool('marker')}
            aria-label="Marker tool"
          >
            <RiPencilLine className="w-5 h-5" />
          </button>
        </Tooltip>
        {/* Eraser Tool */}
        <Tooltip content="Eraser (E)">
          <button
            className={`btn btn-tool p-2 ${tool === 'eraser' ? 'active' : ''}`}
            onClick={() => setTool('eraser')}
            aria-label="Eraser tool"
          >
            <RiEraserLine className="w-5 h-5" />
          </button>
        </Tooltip>
        {/* Wall Tool */}
        <Tooltip content="Wall (W)">
          <button
            className={`btn btn-tool p-2 ${tool === 'wall' ? 'active' : ''}`}
            onClick={() => setTool('wall')}
            aria-label="Wall tool"
          >
            <RiLayoutMasonryLine className="w-5 h-5" />
          </button>
        </Tooltip>
        {/* Door Tool */}
        <Tooltip content="Door (D) - Arrow keys or R to rotate">
          <button
            className={`btn btn-tool p-2 ${tool === 'door' ? 'active' : ''}`}
            onClick={() => setTool('door')}
            aria-label="Door tool"
          >
            <RiDoorOpenLine className="w-5 h-5" />
          </button>
        </Tooltip>
        {/* Door Orientation Toggle (only visible when door tool active) */}
        {tool === 'door' && (
          <Tooltip content="Toggle orientation (R)">
            <button
              className="btn btn-tool text-lg px-2"
              onClick={() =>
                setDoorOrientation((prev) => (prev === 'horizontal' ? 'vertical' : 'horizontal'))
              }
              aria-label="Toggle door orientation"
            >
              {doorOrientation === 'horizontal' ? '↔' : '↕'}
            </button>
          </Tooltip>
        )}
        <div className="toolbar-divider w-px mx-1"></div>
        {/* Measurement Tool with Mode Selector */}
        <div className="flex gap-1 items-center">
          <Tooltip content="Measure (R) - Distance, Blast, Cone">
            <button
              className={`btn btn-tool p-2 ${tool === 'measure' ? 'active' : ''}`}
              onClick={() => setTool('measure')}
              aria-label="Measure tool"
            >
              <RiRulerLine className="w-5 h-5" />
            </button>
          </Tooltip>
          {tool === 'measure' && (
            <div className="flex gap-1 ml-1 items-center">
              <button
                className={`btn btn-mode ${measurementMode === 'ruler' ? 'active' : ''}`}
                onClick={() => setMeasurementMode('ruler')}
                title="Ruler: Measure distance between two points"
              >
                Ruler
              </button>
              <button
                className={`btn btn-mode ${measurementMode === 'blast' ? 'active' : ''}`}
                onClick={() => setMeasurementMode('blast')}
                title="Blast: Circular AoE (e.g., Fireball)"
              >
                Blast
              </button>
              <button
                className={`btn btn-mode ${measurementMode === 'cone' ? 'active' : ''}`}
                onClick={() => setMeasurementMode('cone')}
                title="Cone: 53° cone AoE (e.g., Burning Hands)"
              >
                Cone
              </button>
              <div className="toolbar-divider w-px mx-1 h-6"></div>
              <button
                className={`btn btn-broadcast ${broadcastMeasurement ? 'active' : ''}`}
                onClick={() => setBroadcastMeasurement(!broadcastMeasurement)}
                title="Broadcast measurements to players in World View"
              >
                {broadcastMeasurement ? '📡 Broadcasting' : '📡 Local Only'}
              </button>
            </div>
          )}
        </div>
        {/* Hidden color picker input (triggered by clicking main color circle) */}
        <input
          ref={colorInputRef}
          type="color"
          value={color}
          onChange={(e) => handleColorChange(e.target.value as HexColor)}
          className="hidden"
        />
      </div>

      {/* Floating Color Palette (appears above toolbar when marker tool active) */}
      {tool === 'marker' && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
          {/* Current color - Large circle */}
          <Tooltip content="Change marker color (I)">
            <button
              onClick={() => colorInputRef.current?.click()}
              className="w-12 h-12 rounded-full border-2 border-white shadow-lg hover:scale-110 transition-transform cursor-pointer"
              style={{ backgroundColor: color }}
              aria-label="Change marker color"
            />
          </Tooltip>

          {/* Recent colors - Smaller circles */}
          <div className="flex gap-1.5">
            {recentColors.map((recentColor) => (
              <Tooltip key={recentColor} content={`Use color ${recentColor}`}>
                <button
                  onClick={() => handleColorChange(recentColor)}
                  className="w-8 h-8 rounded-full border-2 border-neutral-600 shadow-md hover:scale-110 transition-transform cursor-pointer"
                  style={{ backgroundColor: recentColor }}
                  aria-label={`Switch to color ${recentColor}`}
                />
              </Tooltip>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default Toolbar;
