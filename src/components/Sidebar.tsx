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

import React, { useRef, useEffect, useState } from 'react';
import { useGameStore, GridType } from '../store/gameStore';
import { processImage, ProcessingHandle } from '../utils/AssetProcessor';
import MapNavigator from './MapNavigator';
import AddToLibraryDialog from './AssetLibrary/AddToLibraryDialog';
import LibraryManager from './AssetLibrary/LibraryManager';
import ToggleSwitch from './ToggleSwitch';
import MobileSidebarDrawer from './MobileSidebarDrawer';
import DoorControls from './DoorControls';
import { useIsMobile } from '../hooks/useMediaQuery';

/**
 * Sidebar component provides map upload, grid settings, and token library
 */
const Sidebar = () => {
    const setMap = useGameStore(state => state.setMap);
    const gridType = useGameStore(state => state.gridType);
    const setGridType = useGameStore(state => state.setGridType);
    const map = useGameStore(state => state.map);
    const updateMapPosition = useGameStore(state => state.updateMapPosition);
    const updateMapScale = useGameStore(state => state.updateMapScale);
    const isCalibrating = useGameStore(state => state.isCalibrating);
    const setIsCalibrating = useGameStore(state => state.setIsCalibrating);
    const showToast = useGameStore(state => state.showToast);
    const showConfirmDialog = useGameStore(state => state.showConfirmDialog);
    const isDaylightMode = useGameStore(state => state.isDaylightMode);
    const setDaylightMode = useGameStore(state => state.setDaylightMode);

    // Campaign Token Library
    const tokenLibrary = useGameStore(state => state.campaign.tokenLibrary);
    const removeTokenFromLibrary = useGameStore(state => state.removeTokenFromLibrary);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const tokenInputRef = useRef<HTMLInputElement>(null);
    const processingHandleRef = useRef<ProcessingHandle | null>(null);

    // Library dialog state
    const [isAddToLibraryOpen, setIsAddToLibraryOpen] = useState(false);
    const [pendingLibraryImage, setPendingLibraryImage] = useState<{
        src: string;
        blob: Blob;
        name: string;
    } | null>(null);
    const [isLibraryManagerOpen, setIsLibraryManagerOpen] = useState(false);

    // Mobile drawer state
    const isMobile = useIsMobile();
    const isMobileDrawerOpen = useGameStore(state => state.isMobileSidebarOpen);
    const setMobileDrawerOpen = useGameStore(state => state.setMobileSidebarOpen);

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
     * ... (comments truncated)
     */
    const handleMapUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        // ... (implementation same as before)
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

    /**
     * Handles token image upload and addition to library
     */
    const handleTokenUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Cancel previous processing
        if (processingHandleRef.current) {
            processingHandleRef.current.cancel();
            processingHandleRef.current = null;
        }

        try {
            const handle = processImage(file, 'TOKEN');
            processingHandleRef.current = handle;
            const src = await handle.promise;
            processingHandleRef.current = null;

            // Convert file:// URL to media:// for fetch (Electron security requirement)
            const safeSrc = src.startsWith('file:') ? src.replace('file:', 'media:') : src;

            // Convert to blob for AddToLibraryDialog
            const response = await fetch(safeSrc);
            const blob = await response.blob();

            // Open AddToLibraryDialog to collect metadata
            setPendingLibraryImage({
                src,
                blob,
                name: file.name.split('.')[0] || 'New Token'
            });
            setIsAddToLibraryOpen(true);
        } catch (err) {
            console.error("Failed to upload token", err);
            showToast('Failed to upload token.', 'error');
            processingHandleRef.current = null;
        } finally {
            e.target.value = '';
        }
    };

    // Sidebar content (same for mobile and desktop)
    const sidebarContent = (
        <div className={`sidebar flex flex-col p-4 z-10 overflow-y-auto ${isMobile ? 'w-full h-full' : 'w-64 shrink-0'}`}>
            {/* Campaign Navigation */}
            <MapNavigator />

            <div className="w-full h-px bg-[var(--app-border-default)] my-6"></div>

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
                        <ToggleSwitch
                            checked={isDaylightMode}
                            onChange={(checked) => setDaylightMode(checked)}
                            label="Daylight Mode"
                            description={isDaylightMode ? '☀️ Fog of War disabled' : '🌙 Fog of War enabled'}
                        />
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

            {/* Door Controls Section */}
            <DoorControls />

            <div className="mb-4">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm uppercase font-bold tracking-wider" style={{ color: 'var(--app-text-secondary)' }}>Token Library</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsLibraryManagerOpen(true)}
                            className="text-xs btn btn-sm btn-ghost px-2 py-1 rounded"
                            title="Manage Persistent Library"
                        >
                            📚 Library
                        </button>
                        <input
                            type="file"
                            accept="image/*"
                            ref={tokenInputRef}
                            className="hidden"
                            onChange={handleTokenUpload}
                        />
                        <button
                            onClick={() => tokenInputRef.current?.click()}
                            className="text-xs btn btn-sm btn-ghost px-2 py-1 rounded"
                            title="Add Token to Library"
                        >
                            ➕ Add
                        </button>
                    </div>
                </div>

                {(!tokenLibrary || tokenLibrary.length === 0) ? (
                    <div className="text-center text-xs py-4 italic" style={{ color: 'var(--app-text-muted)' }}>
                        No tokens in library. Upload or drag & drop to map.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        {tokenLibrary.map(token => (
                            <div
                                key={token.id}
                                className="sidebar-token w-full aspect-square rounded cursor-grab flex flex-col items-center justify-center transition p-1 relative group"
                                draggable
                                onDragStart={(e) => handleDragStart(e, 'LIBRARY_TOKEN', token.src)}
                            >
                                <img
                                    src={token.src}
                                    alt={token.name}
                                    className="w-full h-full object-contain pointer-events-none"
                                />
                                {/* Delete button overlay: visible on mobile, hover-only on desktop */}
                                <div className={`absolute inset-0 bg-black/60 items-center justify-center gap-1 rounded ${
                                    isMobile ? 'flex' : 'hidden group-hover:flex'
                                }`}>
                                    <button
                                        className="text-xs bg-red-500/80 hover:bg-red-500 text-white rounded px-2 py-1 min-h-[32px] min-w-[32px]"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            showConfirmDialog(
                                                'Remove this token from library?',
                                                () => removeTokenFromLibrary(token.id),
                                                'Remove'
                                            );
                                        }}
                                    >
                                        🗑️
                                    </button>
                                </div>
                                <span className="text-[10px] truncate max-w-full mt-1 bg-black/50 px-1 rounded text-white absolute bottom-1">{token.name}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Library Manager Modal */}
            <LibraryManager
                isOpen={isLibraryManagerOpen}
                onClose={() => setIsLibraryManagerOpen(false)}
            />

            {/* Add to Library Dialog */}
            <AddToLibraryDialog
                isOpen={isAddToLibraryOpen}
                imageSrc={pendingLibraryImage?.src || null}
                imageBlob={pendingLibraryImage?.blob || null}
                suggestedName={pendingLibraryImage?.name}
                onClose={() => {
                    setIsAddToLibraryOpen(false);
                    setPendingLibraryImage(null);
                }}
                onConfirm={() => {
                    setIsAddToLibraryOpen(false);
                    setPendingLibraryImage(null);
                }}
            />
        </div>
    );

    // Render: Mobile drawer or desktop sidebar
    if (isMobile) {
        return (
            <MobileSidebarDrawer isOpen={isMobileDrawerOpen} onClose={() => setMobileDrawerOpen(false)}>
                {sidebarContent}
            </MobileSidebarDrawer>
        );
    }

    return sidebarContent;
};

export default Sidebar;
