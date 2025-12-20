/**
 * Sidebar Component - Map Upload, Grid Settings, and Token Library
 *
 * Primary control panel for map management, grid configuration, and token access.
 * Fixed left sidebar providing core VTT functionality.
 *
 * **Map upload and processing:**
 * 1. User selects image file via file input
 * 2. processImage() copies to user data directory (persistent storage)
 * 3. Create temporary Object URL to read dimensions
 * 4. Initialize map at (0,0) with original dimensions, scale=1
 * 5. Auto-enable calibration mode for grid alignment
 * 6. Revoke Object URL to prevent memory leaks
 *
 * **Map calibration workflow:**
 * When user clicks "Calibrate via Draw":
 * 1. Enters calibration mode (isCalibrating = true)
 * 2. User draws rectangle on map representing one grid cell
 * 3. Canvas.tsx calculates scale: gridSize / drawnRectangleSize
 * 4. Map rescaled so drawn rectangle = exactly gridSize pixels
 * 5. Result: Grid overlay perfectly aligns with map grid
 *
 * **Why calibration is needed:**
 * Maps vary in resolution. A 5ft grid square might be 50px, 100px, or 250px
 * depending on the map image. Calibration measures the map's actual grid
 * size and scales the map so it matches our gridSize (default 50px).
 *
 * **Grid types:**
 * - LINES: Traditional grid with vertical/horizontal lines
 * - DOTS: Minimalist grid with dots at intersections
 * - HIDDEN: No grid overlay (clean view)
 *
 * **Token library:**
 * Draggable token assets for quick placement on canvas.
 * Uses HTML5 drag-and-drop API with JSON payload.
 *
 * **Error handling:**
 * - Image load failures show error toast
 * - Upload errors show error toast
 * - File input reset to allow re-upload of same file
 *
 * @example
 * // Usage in App.tsx
 * <div className="flex">
 *   <Sidebar />
 *   <Canvas />
 * </div>
 *
 * @component
 */

import React, { useRef, useEffect } from 'react';
import { useGameStore, GridType } from '../store/gameStore';
import { processImage, ProcessingHandle } from '../utils/AssetProcessor';

/**
 * Sidebar component provides map upload, grid settings, and token library
 */
const Sidebar = () => {
    const {
        setMap, gridType, setGridType,
        map, updateMapPosition, updateMapScale,
        isCalibrating, setIsCalibrating, showToast,
        isDaylightMode, setDaylightMode
    } = useGameStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const processingHandleRef = useRef<ProcessingHandle | null>(null);

    // Cleanup: Cancel any active processing on unmount
    useEffect(() => {
        return () => {
            if (processingHandleRef.current) {
                console.log('[Sidebar] Cancelling in-flight map processing on unmount');
                processingHandleRef.current.cancel();
                processingHandleRef.current = null;
            }
        };
    }, []);

    /**
     * Handles drag start for library tokens
     * Sets JSON payload with token type and image source
     *
     * @param e - Drag event
     * @param type - Token type (e.g., 'LIBRARY_TOKEN')
     * @param src - Image source URL
     */
    const handleDragStart = (e: React.DragEvent, type: string, src: string) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ type, src }));
        // Also set a drag image if we want
    };

    /**
     * Handles map image upload and initialization
     *
     * **Process:**
     * 1. Process image (copy to user data directory)
     * 2. Create Object URL to read dimensions
     * 3. Initialize map state with dimensions and scale=1
     * 4. Enable calibration mode for grid alignment
     * 5. Clean up Object URL
     *
     * **Error handling:**
     * - Shows error toast on upload failure
     * - Shows error toast on image load failure
     * - Resets file input to allow re-upload
     *
     * @param e - File input change event
     */
    const handleMapUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Cancel any previous processing
        if (processingHandleRef.current) {
            processingHandleRef.current.cancel();
            processingHandleRef.current = null;
        }

        try {
            // Use new ProcessingHandle API
            const handle = processImage(file, 'MAP');
            processingHandleRef.current = handle;

            const src = await handle.promise;

            // Clear handle after successful completion
            processingHandleRef.current = null;

             // Create a temporary image to get dimensions using a safe Object URL
            let objectUrl: string;
            try {
                objectUrl = URL.createObjectURL(file);
            } catch (err) {
                console.error("Failed to create object URL for map image", err);
                showToast('Failed to process map image. The file may be invalid or unsupported.', 'error');
                return;
            }
            const img = new Image();
            img.src = objectUrl;
            img.onload = () => {
                 setMap({
                    src, // Keep the processed path for the store
                    x: 0,
                    y: 0,
                    width: img.width,
                    height: img.height,
                    scale: 1
                });
                setIsCalibrating(true);
                URL.revokeObjectURL(objectUrl);
            };
            img.onerror = (e) => {
                console.error("Map Image Failed to Load for Dimensions", e);
                URL.revokeObjectURL(objectUrl);
                showToast('Failed to load map image. Please check the file format and try again.', 'error');
            }
        } catch (err) {
            console.error("Failed to upload map", err);
            showToast('Failed to upload map. Please ensure the file is a valid image.', 'error');
            // Clear handle on error
            processingHandleRef.current = null;
        } finally {
            // Reset the file input so the same file can be uploaded again
            e.target.value = '';
        }
    };

    return (
        <div className="sidebar w-64 flex flex-col p-4 z-10 shrink-0 overflow-y-auto">
            <h2 className="text-xl font-bold mb-6">Library</h2>

            <div className="mb-8">
                <h3 className="text-sm mb-3 uppercase font-bold tracking-wider" style={{ color: 'var(--app-text-secondary)' }}>Map Settings</h3>

                <div className="space-y-4">
                    {/* Map Upload */}
                    <div>
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleMapUpload}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="btn btn-primary w-full font-medium py-2 px-4 rounded transition flex items-center justify-center gap-2"
                        >
                            <span>🗺️</span> Upload Map
                        </button>
                    </div>

                    {/* Grid Type Selector */}
                    <div>
                        <label htmlFor="grid-type-select" className="block text-xs mb-2 uppercase font-semibold" style={{ color: 'var(--app-text-secondary)' }}>Grid Type</label>
                        <select
                            id="grid-type-select"
                            value={gridType}
                            onChange={(e) => setGridType(e.target.value as GridType)}
                            className="sidebar-input w-full rounded px-3 py-2 text-sm"
                        >
                            <option value="LINES">Lines</option>
                            <option value="DOTS">Dots</option>
                            <option value="HIDDEN">Hidden</option>
                        </select>
                    </div>

                    {/* Daylight Mode Toggle */}
                    <div>
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-xs uppercase font-semibold" style={{ color: 'var(--app-text-secondary)' }}>Daylight Mode</span>
                            <input
                                type="checkbox"
                                checked={isDaylightMode}
                                onChange={(e) => setDaylightMode(e.target.checked)}
                                className="w-4 h-4 rounded cursor-pointer"
                            />
                        </label>
                        <p className="text-xs mt-1" style={{ color: 'var(--app-text-muted)' }}>
                            {isDaylightMode ? '☀️ Fog of War disabled' : '🌙 Fog of War enabled'}
                        </p>
                    </div>

                    {/* Map Calibration */}
                    <div className="sidebar-section pt-4">
                         <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs uppercase font-semibold" style={{ color: 'var(--app-text-secondary)' }}>Calibration</h4>
                            {isCalibrating && <span className="text-xs animate-pulse" style={{ color: 'var(--app-accent-text)' }}>Active</span>}
                         </div>

                         {isCalibrating ? (
                             <div className="info-box rounded p-3 mb-3 text-xs">
                                 <p className="mb-2"><strong>Draw a square</strong> on the map that represents exactly <strong>one grid cell</strong> (e.g. 5ft square).</p>
                                 <button
                                     onClick={() => setIsCalibrating(false)}
                                     className="btn btn-default w-full py-1 rounded transition"
                                 >
                                     Cancel
                                 </button>
                             </div>
                         ) : (
                             <button
                                onClick={() => setIsCalibrating(true)}
                                className="btn btn-default w-full font-medium py-2 px-3 rounded mb-3 text-sm flex items-center justify-center gap-2 transition"
                                disabled={!map}
                             >
                                <span>📐</span> Calibrate via Draw
                             </button>
                         )}

                         <div className="text-center">
                            <button
                                onClick={() => {
                                    updateMapPosition(0, 0);
                                    updateMapScale(1);
                                }}
                                className="text-xs underline"
                                style={{ color: 'var(--app-text-muted)' }}
                                disabled={!map}
                            >
                                Reset Map
                            </button>
                         </div>
                    </div>
                </div>
            </div>

            <div className="mb-4">
                <h3 className="text-sm mb-3 uppercase font-bold tracking-wider" style={{ color: 'var(--app-text-secondary)' }}>Tokens</h3>
                <div className="grid grid-cols-2 gap-2">
                     <div
                        className="sidebar-token w-full aspect-square rounded cursor-grab flex items-center justify-center transition"
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'LIBRARY_TOKEN', 'https://konvajs.org/assets/lion.png')}
                     >
                        🦁
                    </div>
                     <div
                        className="sidebar-token w-full aspect-square rounded cursor-grab flex items-center justify-center transition"
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'LIBRARY_TOKEN', 'https://konvajs.org/assets/yoda.jpg')}
                     >
                        👽
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
