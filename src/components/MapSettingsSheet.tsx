/**
 * MapSettingsSheet Component - Map Configuration Drawer
 *
 * A slide-in drawer from the right side for configuring map settings.
 * Supports two modes:
 * - CREATE: For creating a new map
 * - EDIT: For editing an existing map
 *
 * @component
 */

import type React from 'react';
import { useRef, useState, useEffect } from 'react';

import { RiRulerLine } from '@remixicon/react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';

import ToggleSwitch from './ToggleSwitch';
import { useGameStore } from '../store/gameStore';
import { processImage } from '../utils/AssetProcessor';
import { rollForMessage } from '../utils/systemMessages';

import type { GridType } from '../store/gameStore';
import type { ProcessingHandle } from '../utils/AssetProcessor';

interface MapSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'CREATE' | 'EDIT';
  mapId?: string; // Required when mode is EDIT
}

// eslint-disable-next-line max-lines-per-function, complexity
function MapSettingsSheet({
  isOpen,
  onClose,
  mode,
  mapId,
}: MapSettingsSheetProps): React.ReactElement {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingHandleRef = useRef<ProcessingHandle | null>(null);

  // Store selectors
  const campaign = useGameStore((state) => state.campaign);
  const setMap = useGameStore((state) => state.setMap);
  const gridType = useGameStore((state) => state.gridType);
  const setGridType = useGameStore((state) => state.setGridType);
  const gridColor = useGameStore((state) => state.gridColor);
  const setGridColor = useGameStore((state) => state.setGridColor);
  const isDaylightMode = useGameStore((state) => state.isDaylightMode);
  const setDaylightMode = useGameStore((state) => state.setDaylightMode);
  const isCalibrating = useGameStore((state) => state.isCalibrating);
  const setIsCalibrating = useGameStore((state) => state.setIsCalibrating);
  const updateMapPosition = useGameStore((state) => state.updateMapPosition);
  const updateMapScale = useGameStore((state) => state.updateMapScale);
  const showToast = useGameStore((state) => state.showToast);
  const showConfirmDialog = useGameStore((state) => state.showConfirmDialog);
  const addMap = useGameStore((state) => state.addMap);
  const renameMap = useGameStore((state) => state.renameMap);

  // Local state for map name
  const [mapName, setMapName] = useState('');

  // Local state for pending map data in CREATE mode
  const [pendingMapData, setPendingMapData] = useState<{
    src: string;
    width: number;
    height: number;
  } | null>(null);

  // Local state for pending changes
  const [pendingGridType, setPendingGridType] = useState<GridType>(gridType);
  const [pendingGridColor, setPendingGridColor] = useState<string>(gridColor);
  const [pendingDaylightMode, setPendingDaylightMode] = useState<boolean>(isDaylightMode);

  // Load current map data when in EDIT mode
  useEffect(() => {
    if (mode === 'EDIT' && mapId && campaign.maps[mapId]) {
      setMapName(campaign.maps[mapId].name);
    } else if (mode === 'CREATE') {
      // Generate default name for new map
      const maps = Object.values(campaign.maps);
      const mapNumbers = maps
        .map((m) => {
          const match = /^Map (\d+)$/.exec(m.name);
          return match?.[1] ? parseInt(match[1], 10) : 0;
        })
        .filter((n) => n > 0);
      const nextNumber = mapNumbers.length > 0 ? Math.max(...mapNumbers) + 1 : maps.length + 1;
      setMapName(`Map ${nextNumber}`);
      // Clear pending map data when opening in CREATE mode
      setPendingMapData(null);
      // Initialize pending grid settings from current store state
      setPendingGridType(gridType);
      setPendingGridColor(gridColor);
      setPendingDaylightMode(isDaylightMode);
    }
  }, [mode, mapId, campaign.maps, isOpen, gridType, gridColor, isDaylightMode]);

  // Cleanup processing on unmount
  useEffect(() => {
    return () => {
      if (processingHandleRef.current) {
        processingHandleRef.current.cancel();
        processingHandleRef.current = null;
      }
    };
  }, []);

  const handleMapUpload = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    // Cancel any previous processing
    if (processingHandleRef.current) {
      processingHandleRef.current.cancel();
      processingHandleRef.current = null;
    }

    try {
      const handle = processImage(file, 'MAP');
      processingHandleRef.current = handle;

      const src = await handle.promise;
      processingHandleRef.current = null;

      // Create a temporary image to get dimensions
      let objectUrl: string;
      try {
        objectUrl = URL.createObjectURL(file);
      } catch (err) {
        console.error('Failed to create object URL for map image', err);
        showToast(rollForMessage('MAP_IMAGE_PROCESS_FAILED'), 'error');
        return;
      }

      const img = new Image();
      img.src = objectUrl;
      img.onload = () => {
        const nextMap = {
          src,
          x: 0,
          y: 0,
          width: img.width,
          height: img.height,
          scale: 1,
        };

        // Only apply to the active map immediately when editing an existing map.
        // In CREATE mode, store in local state to avoid mutating the global active map
        // so that cancelling the sheet does not leave behind unintended changes.
        if (mode === 'EDIT') {
          setMap(nextMap);
          setIsCalibrating(true);
        } else if (mode === 'CREATE') {
          setPendingMapData({
            src,
            width: img.width,
            height: img.height,
          });
        }
        URL.revokeObjectURL(objectUrl);
      };
      img.onerror = (e) => {
        console.error('Map Image Failed to Load for Dimensions', e);
        URL.revokeObjectURL(objectUrl);
        showToast(rollForMessage('MAP_IMAGE_LOAD_FAILED'), 'error');
      };
    } catch (err) {
      console.error('Failed to upload map', err);
      showToast(rollForMessage('MAP_UPLOAD_FAILED'), 'error');
      processingHandleRef.current = null;
    } finally {
      e.target.value = '';
    }
  };

  const handleSave = (): void => {
    const trimmedName = mapName.trim();

    if (mode === 'CREATE') {
      // Create new map
      // NOTE: addMap() switches to the new map immediately, making it the active map.
      // After addMap() completes, the newly created map becomes the current active map.
      // We then call setMap() to apply the pending map image to this newly active map.
      addMap(trimmedName || 'Untitled Map');

      // Apply pending grid settings
      setGridType(pendingGridType);
      setDaylightMode(pendingDaylightMode);
      setGridColor(pendingGridColor);

      // Apply pending map data if it exists
      if (pendingMapData) {
        setMap({
          src: pendingMapData.src,
          x: 0,
          y: 0,
          width: pendingMapData.width,
          height: pendingMapData.height,
          scale: 1,
        });
        setIsCalibrating(true);
      }

      onClose();
    } else if (mode === 'EDIT' && mapId) {
      // Update existing map name
      if (!trimmedName) {
        showToast('Map name cannot be empty.', 'error');
        return;
      }
      renameMap(mapId, trimmedName);
      onClose();
    }
  };

  const handleResetMap = (): void => {
    showConfirmDialog(
      'Reset map position and scale to default?',
      () => {
        updateMapPosition(0, 0);
        updateMapScale(1);
      },
      'Reset',
    );
  };

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      modal={!isCalibrating}
    >
      <SheetContent
        side="right"
        className="w-full sm:w-96 sm:max-w-none p-0 overflow-y-auto"
        data-testid="sheet-map-settings-root"
      >
        <SheetHeader className="sticky top-0 bg-[var(--app-bg-surface)] border-b border-[var(--app-border-default)] p-4">
          <SheetTitle className="text-lg font-bold">
            {mode === 'CREATE' ? 'New Map' : 'Edit Map'}
          </SheetTitle>
        </SheetHeader>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Map Name */}
          <div>
            <label
              htmlFor="map-name"
              className="block text-xs mb-2 uppercase font-semibold text-[var(--app-text-secondary)]"
            >
              Map Name
            </label>
            <Input
              id="map-name"
              type="text"
              value={mapName}
              onChange={(e) => setMapName(e.target.value)}
              className="w-full"
              placeholder="Enter map name"
            />
          </div>

          {/* Upload Map */}
          <div>
            <label className="block text-xs mb-2 uppercase font-semibold text-[var(--app-text-secondary)]">
              Upload Map
            </label>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              className="hidden"
              onChange={(e) => {
                void handleMapUpload(e);
              }}
            />
            <Button
              variant="default"
              onClick={() => fileInputRef.current?.click()}
              className="w-full font-medium py-2 px-4"
            >
              <span>🗺️</span> Choose Map Image
            </Button>
          </div>

          {/* Calibrate Map */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs uppercase font-semibold text-[var(--app-text-secondary)]">
                Calibration
              </label>
              {isCalibrating && (
                <span className="text-xs animate-pulse text-[var(--app-accent-text)]">Active</span>
              )}
            </div>

            {isCalibrating ? (
              <div className="rounded p-3 mb-3 text-xs bg-[var(--app-accent-bg)] border border-[var(--app-accent-solid)] text-[var(--app-accent-text-contrast)]">
                <p className="mb-2">
                  <strong>Draw a square</strong> on the map that represents exactly{' '}
                  <strong>one grid cell</strong> (e.g. 5ft square).
                </p>
                <Button
                  variant="secondary"
                  onClick={() => setIsCalibrating(false)}
                  className="w-full py-1"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="secondary"
                onClick={() => setIsCalibrating(true)}
                className="w-full font-medium py-2 px-3 text-sm"
                disabled={gridType === 'HEXAGONAL' || gridType === 'ISOMETRIC'}
                title={
                  gridType === 'HEXAGONAL' || gridType === 'ISOMETRIC'
                    ? 'Calibration only works with square grids'
                    : 'Draw a box around one grid cell to calibrate map scale'
                }
              >
                <RiRulerLine className="size-4" /> Calibrate via Draw
                {(gridType === 'HEXAGONAL' || gridType === 'ISOMETRIC') && (
                  <span className="text-xs opacity-50">(Square grids only)</span>
                )}
              </Button>
            )}
          </div>

          {/* Grid Type */}
          <div>
            <label
              htmlFor="grid-type-select"
              className="block text-xs mb-2 uppercase font-semibold text-[var(--app-text-secondary)]"
            >
              Grid Type
            </label>
            <select
              id="grid-type-select"
              value={mode === 'CREATE' ? pendingGridType : gridType}
              onChange={(e) =>
                mode === 'CREATE'
                  ? setPendingGridType(e.target.value as GridType)
                  : setGridType(e.target.value as GridType)
              }
              className="w-full"
            >
              <option value="LINES">Square - Lines</option>
              <option value="DOTS">Square - Dots</option>
              <option value="HEXAGONAL">Hexagonal</option>
              <option value="ISOMETRIC">Isometric</option>
              <option value="HIDDEN">Hidden</option>
            </select>
          </div>

          {/* Grid Color */}
          <div>
            <label
              htmlFor="grid-color-input"
              className="block text-xs mb-1 uppercase font-semibold text-[var(--app-text-secondary)]"
            >
              Grid Color
            </label>
            {gridType === 'HIDDEN' && (
              <p className="text-[10px] mb-2 text-[var(--app-text-secondary)]">
                Grid is currently hidden. This color will be applied when you switch to a visible
                grid type.
              </p>
            )}
            <div className="flex gap-2 items-center">
              <input
                id="grid-color-input"
                type="color"
                value={mode === 'CREATE' ? pendingGridColor : gridColor}
                onChange={(e) =>
                  mode === 'CREATE'
                    ? setPendingGridColor(e.target.value)
                    : setGridColor(e.target.value)
                }
                className="h-10 w-20 rounded cursor-pointer border border-[var(--app-border-default)]"
              />
              <span className="text-xs text-[var(--app-text-secondary)]">
                {mode === 'CREATE' ? pendingGridColor : gridColor}
              </span>
            </div>
          </div>

          {/* Fog of War */}
          <div>
            <ToggleSwitch
              checked={mode === 'CREATE' ? pendingDaylightMode : isDaylightMode}
              onChange={(checked) =>
                mode === 'CREATE' ? setPendingDaylightMode(checked) : setDaylightMode(checked)
              }
              label="Daylight Mode"
              description={
                (mode === 'CREATE' ? pendingDaylightMode : isDaylightMode)
                  ? '☀️ Fog of War disabled'
                  : '🌙 Fog of War enabled'
              }
            />
          </div>

          {/* Reset Map */}
          {mode === 'EDIT' && (
            <div>
              <label className="block text-xs mb-2 uppercase font-semibold text-[var(--app-text-secondary)]">
                Danger Zone
              </label>
              <Button
                variant="ghost"
                onClick={handleResetMap}
                className="w-full font-medium py-2 px-3 text-sm"
              >
                <span>⚠️</span> Reset Map Position & Scale
              </Button>
            </div>
          )}
        </div>

        <SheetFooter className="sticky bottom-0 bg-[var(--app-bg-surface)] border-t border-[var(--app-border-default)] p-4 flex flex-row gap-2">
          <Button variant="ghost" className="flex-1 py-2" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="default" className="flex-1 py-2" onClick={handleSave}>
            {mode === 'CREATE' ? 'Create Map' : 'Save Changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default MapSettingsSheet;
