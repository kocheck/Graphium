import type React from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';

import { useGameStore } from '../store/gameStore';
import { DungeonGenerator } from '../utils/DungeonGenerator';

/** Radix focuses the first tabbable element on open; we want Generate instead. */
function focusGenerateButton(event: Event): void {
  event.preventDefault();
  const root = event.currentTarget;
  if (root instanceof HTMLElement) {
    root
      .querySelector<HTMLButtonElement>('[data-testid="dialog-dungeon-generator-generate"]')
      ?.focus();
  }
}

/**
 * DungeonGeneratorDialog is a modal that allows users to configure and
 * generate procedural dungeons on the canvas.
 */
// eslint-disable-next-line max-lines-per-function
export function DungeonGeneratorDialog(): React.ReactElement | null {
  const addDrawing = useGameStore((state) => state.addDrawing);
  const addDoor = useGameStore((state) => state.addDoor);
  const removeDrawings = useGameStore((state) => state.removeDrawings);
  const removeDoors = useGameStore((state) => state.removeDoors);
  const existingDrawings = useGameStore((state) => state.drawings);
  const existingDoors = useGameStore((state) => state.doors);
  const gridSize = useGameStore((state) => state.gridSize);
  const clearDungeonDialog = useGameStore((state) => state.clearDungeonDialog);
  const dungeonDialog = useGameStore((state) => state.dungeonDialog);
  const [numRooms, setNumRooms] = useState(5);
  const [minRoomSize, setMinRoomSize] = useState(3);
  const [maxRoomSize, setMaxRoomSize] = useState(8);
  const [clearCanvas, setClearCanvas] = useState(false);

  if (!dungeonDialog) {
    return null;
  }

  const handleGenerate = (): void => {
    // Use the current window size for the canvas, with fallbacks to preserve existing behavior
    const canvasWidth = window.innerWidth || 1920;
    const canvasHeight = window.innerHeight || 1080;

    // Use default wall settings
    // TODO: Once wall tool settings are in the store, use those instead of defaults
    const wallColor = '#ff0000'; // Default red
    const wallSize = 8; // Default size

    // Generate the dungeon
    const generator = new DungeonGenerator({
      numRooms,
      minRoomSize,
      maxRoomSize,
      gridSize,
      canvasWidth,
      canvasHeight,
      wallColor,
      wallSize,
    });

    const { drawings, doors } = generator.generate();

    // Clear existing drawings and doors if requested
    if (clearCanvas) {
      removeDrawings(existingDrawings.map((d) => d.id));
      removeDoors(existingDoors.map((d) => d.id));
    }

    // Add all generated wall drawings and doors to the store
    drawings.forEach((drawing) => addDrawing(drawing));
    doors.forEach((door) => addDoor(door));

    // Close the dialog
    clearDungeonDialog();
  };

  const handleOpenChange = (open: boolean): void => {
    if (!open) {
      clearDungeonDialog();
    }
  };

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-md rounded-lg"
        data-testid="dialog-dungeon-generator-root"
        showCloseButton={false}
        onOpenAutoFocus={focusGenerateButton}
      >
        <DialogTitle
          id="dungeon-dialog-title"
          className="text-xl font-bold mb-4 text-[var(--app-text)]"
        >
          Dungeon Generator
        </DialogTitle>

        <div className="space-y-4">
          {/* Number of Rooms */}
          <div>
            <label className="block text-sm font-medium mb-1">Number of Rooms: {numRooms}</label>
            <input
              type="range"
              min="3"
              max="15"
              value={numRooms}
              onChange={(e) => setNumRooms(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-[var(--app-text-muted)]">
              <span>3</span>
              <span>15</span>
            </div>
          </div>

          {/* Min Room Size */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Min Room Size (grid cells): {minRoomSize}
            </label>
            <input
              type="range"
              min="2"
              max="6"
              value={minRoomSize}
              onChange={(e) => setMinRoomSize(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-[var(--app-text-muted)]">
              <span>2</span>
              <span>6</span>
            </div>
          </div>

          {/* Max Room Size */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Max Room Size (grid cells): {maxRoomSize}
            </label>
            <input
              type="range"
              min="4"
              max="12"
              value={maxRoomSize}
              onChange={(e) => setMaxRoomSize(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-[var(--app-text-muted)]">
              <span>4</span>
              <span>12</span>
            </div>
          </div>

          {/* Clear Canvas Option */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="clearCanvas"
              checked={clearCanvas}
              onChange={(e) => setClearCanvas(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="clearCanvas" className="text-sm">
              Clear existing drawings before generating
            </label>
          </div>

          {/* Info Text */}
          <div className="text-xs p-3 rounded-sm text-[var(--app-text-muted)] bg-[var(--app-bg-subtle)]">
            <p>
              <strong>Note:</strong> The dungeon will be drawn using the Wall tool and will be fully
              interactive. You can modify the generated walls manually after creation.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={clearDungeonDialog}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleGenerate}
            data-testid="dialog-dungeon-generator-generate"
          >
            Generate Dungeon
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
