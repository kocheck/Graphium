/**
 * Toolbar — the desktop tool strip (Architect View, non-mobile). Extracted from App.tsx in plan
 * 004; every value still lives in App and arrives as a prop (plan 005 moves them to a store).
 */

import type { JSX, RefObject } from 'react';

import {
  RiCursorLine,
  RiDoorOpenLine,
  RiEraserLine,
  RiLayoutMasonryLine,
  RiPauseFill,
  RiPencilLine,
  RiPlayFill,
  RiRulerLine,
} from '@remixicon/react';
import { useShallow } from 'zustand/shallow';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

import Tooltip from './Tooltip';
import { useUiStore } from '../store/uiStore';

// eslint-disable-next-line import/no-unused-modules -- public props type for plan 005
export interface ToolbarProps {
  colorInputRef: RefObject<HTMLInputElement>;
  broadcastMeasurement: boolean;
  setBroadcastMeasurement: (value: boolean) => void;
  isGamePaused: boolean;
  onPauseToggle: () => void;
}

// eslint-disable-next-line max-lines-per-function
function Toolbar({
  colorInputRef,
  broadcastMeasurement,
  setBroadcastMeasurement,
  isGamePaused,
  onPauseToggle,
}: ToolbarProps): JSX.Element {
  const {
    tool,
    setTool,
    color,
    setColor,
    recentColors,
    doorOrientation,
    toggleDoorOrientation,
    measurementMode,
    setMeasurementMode,
  } = useUiStore(
    useShallow((state) => ({
      tool: state.tool,
      setTool: state.setTool,
      color: state.color,
      setColor: state.setColor,
      recentColors: state.recentColors,
      doorOrientation: state.doorOrientation,
      toggleDoorOrientation: state.toggleDoorOrientation,
      measurementMode: state.measurementMode,
      setMeasurementMode: state.setMeasurementMode,
    })),
  );
  return (
    <>
      <div
        className="toolbar fixed bottom-4 left-1/2 -translate-x-1/2 p-3 rounded-lg shadow-[var(--app-elevation-high)] flex items-center gap-2 z-50"
        data-testid="toolbar-root"
      >
        {/* Play/Pause Button */}
        <Tooltip
          content={
            isGamePaused ? 'Resume - Players will see the map' : 'Pause - Hide map from players'
          }
        >
          <Button
            variant="tool"
            size="tool"
            state={isGamePaused ? 'paused' : 'running'}
            data-state={isGamePaused ? 'paused' : 'running'}
            className="flex items-center justify-center font-semibold"
            onClick={onPauseToggle}
            aria-label={isGamePaused ? 'Resume game' : 'Pause game'}
            data-testid="toolbar-pause"
          >
            {isGamePaused ? <RiPlayFill className="size-5" /> : <RiPauseFill className="size-5" />}
          </Button>
        </Tooltip>
        <Separator variant="toolbar" />
        {/* Select Tool */}
        <Tooltip content="Select (V)">
          <Button
            variant="tool"
            size="tool"
            active={tool === 'select'}
            aria-pressed={tool === 'select'}
            className="p-2"
            onClick={() => setTool('select')}
            aria-label="Select tool"
            data-testid="toolbar-tool-select"
          >
            <RiCursorLine className="size-5" />
          </Button>
        </Tooltip>
        {/* Marker Tool */}
        <Tooltip content="Marker (M)">
          <Button
            variant="tool"
            size="tool"
            active={tool === 'marker'}
            aria-pressed={tool === 'marker'}
            className="p-2"
            onClick={() => setTool('marker')}
            aria-label="Marker tool"
            data-testid="toolbar-tool-marker"
          >
            <RiPencilLine className="size-5" />
          </Button>
        </Tooltip>
        {/* Eraser Tool */}
        <Tooltip content="Eraser (E)">
          <Button
            variant="tool"
            size="tool"
            active={tool === 'eraser'}
            aria-pressed={tool === 'eraser'}
            className="p-2"
            onClick={() => setTool('eraser')}
            aria-label="Eraser tool"
            data-testid="toolbar-tool-eraser"
          >
            <RiEraserLine className="size-5" />
          </Button>
        </Tooltip>
        {/* Wall Tool */}
        <Tooltip content="Wall (W)">
          <Button
            variant="tool"
            size="tool"
            active={tool === 'wall'}
            aria-pressed={tool === 'wall'}
            className="p-2"
            onClick={() => setTool('wall')}
            aria-label="Wall tool"
            data-testid="toolbar-tool-wall"
          >
            <RiLayoutMasonryLine className="size-5" />
          </Button>
        </Tooltip>
        {/* Door Tool */}
        <Tooltip content="Door (D) - Arrow keys or R to rotate">
          <Button
            variant="tool"
            size="tool"
            active={tool === 'door'}
            aria-pressed={tool === 'door'}
            className="p-2"
            onClick={() => setTool('door')}
            aria-label="Door tool"
            data-testid="toolbar-tool-door"
          >
            <RiDoorOpenLine className="size-5" />
          </Button>
        </Tooltip>
        {/* Door Orientation Toggle (only visible when door tool active) */}
        {tool === 'door' && (
          <Tooltip content="Toggle orientation (R)">
            <Button
              variant="tool"
              size="tool"
              className="text-lg px-2"
              onClick={toggleDoorOrientation}
              aria-label="Toggle door orientation"
            >
              {doorOrientation === 'horizontal' ? '↔' : '↕'}
            </Button>
          </Tooltip>
        )}
        <Separator variant="toolbar" />
        {/* Measurement Tool with Mode Selector */}
        <div className="flex gap-1 items-center">
          <Tooltip content="Measure (R) - Distance, Blast, Cone">
            <Button
              variant="tool"
              size="tool"
              active={tool === 'measure'}
              aria-pressed={tool === 'measure'}
              className="p-2"
              onClick={() => setTool('measure')}
              aria-label="Measure tool"
              data-testid="toolbar-tool-measure"
            >
              <RiRulerLine className="size-5" />
            </Button>
          </Tooltip>
          {tool === 'measure' && (
            <div className="flex gap-1 ml-1 items-center">
              <Button
                variant="mode"
                size="mode"
                active={measurementMode === 'ruler'}
                aria-pressed={measurementMode === 'ruler'}
                onClick={() => setMeasurementMode('ruler')}
                title="Ruler: Measure distance between two points"
              >
                Ruler
              </Button>
              <Button
                variant="mode"
                size="mode"
                active={measurementMode === 'blast'}
                aria-pressed={measurementMode === 'blast'}
                onClick={() => setMeasurementMode('blast')}
                title="Blast: Circular AoE (e.g., Fireball)"
              >
                Blast
              </Button>
              <Button
                variant="mode"
                size="mode"
                active={measurementMode === 'cone'}
                aria-pressed={measurementMode === 'cone'}
                onClick={() => setMeasurementMode('cone')}
                title="Cone: 53° cone AoE (e.g., Burning Hands)"
              >
                Cone
              </Button>
              <Separator variant="toolbar" className="h-6" />
              <Button
                variant="broadcast"
                size="mode"
                active={broadcastMeasurement}
                aria-pressed={broadcastMeasurement}
                onClick={() => setBroadcastMeasurement(!broadcastMeasurement)}
                title="Broadcast measurements to players in World View"
              >
                {broadcastMeasurement ? '📡 Broadcasting' : '📡 Local Only'}
              </Button>
            </div>
          )}
        </div>
        {/* Hidden color picker input (triggered by clicking main color circle) */}
        <input
          ref={colorInputRef}
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="hidden"
        />
      </div>
      {tool === 'marker' && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
          {/* Current color - Large circle */}
          <Tooltip content="Change marker color (I)">
            <button
              onClick={() => colorInputRef.current?.click()}
              className="w-12 h-12 rounded-full border-2 shadow-[var(--app-elevation-medium)] hover:scale-110 transition-transform cursor-pointer"
              style={{ backgroundColor: color, borderColor: 'var(--app-border-hover)' }}
              aria-label="Change marker color"
            />
          </Tooltip>

          {/* Recent colors - Smaller circles */}
          <div className="flex gap-1.5">
            {recentColors.map((recentColor) => (
              <Tooltip key={recentColor} content={`Use color ${recentColor}`}>
                <button
                  onClick={() => setColor(recentColor)}
                  className="w-8 h-8 rounded-full border-2 shadow-[var(--app-elevation-medium)] hover:scale-110 transition-transform cursor-pointer"
                  style={{ backgroundColor: recentColor, borderColor: 'var(--app-border-hover)' }}
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
