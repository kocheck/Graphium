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

import React, { useRef, useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { processImage, ProcessingHandle } from '../utils/AssetProcessor';
import AddToLibraryDialog from './AssetLibrary/AddToLibraryDialog';
import LibraryManager from './AssetLibrary/LibraryManager';
import MobileSidebarDrawer from './MobileSidebarDrawer';
import DoorControls from './DoorControls';
import CollapsibleSection from './CollapsibleSection';
import MapSettingsSheet from './MapSettingsSheet';
import Tooltip from './Tooltip';
import QuickTokenSidebar from './QuickTokenSidebar';
import { QuickTokenSidebarErrorBoundary } from './QuickTokenSidebarErrorBoundary';
import { useIsMobile } from '../hooks/useMediaQuery';
import { rollForMessage } from '../utils/systemMessages';
import { useCommandPalette } from '../hooks/useCommandPalette';
import {
  RiArrowLeftSLine,
  RiPushpinLine,
  RiMap2Line,
  RiSettings4Line,
  RiAddLine,
  RiSearchLine,
  RiBookLine,
} from '@remixicon/react';
import { getRecentTokens, getPlayerTokens, deduplicatePlayerTokens } from '../utils/tokenUtils';

/**
 * Sidebar component provides map upload, grid settings, and token library
 */
const Sidebar = () => {
    // Store selectors
    const campaign = useGameStore(state => state.campaign);
    const activeMapId = useGameStore(state => state.campaign.activeMapId);
    const switchMap = useGameStore(state => state.switchMap);
    const tokenLibrary = useGameStore(state => state.campaign.tokenLibrary);
    const showToast = useGameStore(state => state.showToast);
    const tokens = useGameStore(state => state.tokens);

    // Get recent tokens (last 3 unique tokens placed on the map)
    const recentTokens = React.useMemo(() => {
        return getRecentTokens(tokens, tokenLibrary);
    }, [tokens, tokenLibrary]);

    // Get player tokens from library (up to 5)
    const playerTokens = React.useMemo(() => {
        return getPlayerTokens(tokenLibrary, 5);
    }, [tokenLibrary]);

    // Deduplicate player tokens (remove any that appear in recent history)
    const deduplicatedPlayerTokens = React.useMemo(() => {
        return deduplicatePlayerTokens(playerTokens, recentTokens);
    }, [playerTokens, recentTokens]);

    // Refs
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

    // Map Settings Sheet state
    const [isMapSettingsOpen, setIsMapSettingsOpen] = useState(false);
    const [mapSettingsMode, setMapSettingsMode] = useState<'CREATE' | 'EDIT'>('CREATE');
    const [editingMapId, setEditingMapId] = useState<string | null>(null);

    // Sidebar collapsed state
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // Command Palette hook
    const [, setPaletteOpen] = useCommandPalette();

    // Mobile drawer state
    const isMobile = useIsMobile();
    const isMobileDrawerOpen = useGameStore(state => state.isMobileSidebarOpen);
    const setMobileDrawerOpen = useGameStore(state => state.setMobileSidebarOpen);

    // Reset sidebar collapse state when switching to mobile
    useEffect(() => {
        if (isMobile) {
            setIsSidebarCollapsed(false);
        }
    }, [isMobile]);

    /**
     * Handles drag start for library tokens
     * Sets JSON payload with token type and image source
     *
     * @param e - Drag event
     * @param type - Token type (e.g., 'LIBRARY_TOKEN')
     * @param src - Image source URL
     * @param libraryItemId - Optional library item ID for prototype linkage
     */
    const handleDragStart = (e: React.DragEvent, type: string, src: string, libraryItemId?: string) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ type, src, libraryItemId }));

        // Create custom drag image
        const img = new Image();
        img.src = src.replace('file:', 'media:');
        img.width = 64;
        img.height = 64;

        // We need the image to be loaded for setDragImage to work
        // It's likely cached since it's displayed on screen, but defensive check:
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.top = '-1000px';
        div.style.left = '-1000px';
        div.style.width = '64px';
        div.style.height = '64px';
        div.style.backgroundImage = `url(${src.replace('file:', 'media:')})`;
        div.style.backgroundSize = 'contain';
        div.style.backgroundRepeat = 'no-repeat';
        div.style.backgroundPosition = 'center';
        div.style.pointerEvents = 'none';
        document.body.appendChild(div);

        e.dataTransfer.setDragImage(div, 32, 32);

        // Cleanup after a short delay
        setTimeout(() => {
            document.body.removeChild(div);
        }, 100);
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
            showToast(rollForMessage('TOKEN_UPLOAD_FAILED'), 'error');
            processingHandleRef.current = null;
        } finally {
            e.target.value = '';
        }
    };

    const maps = Object.values(campaign.maps).sort((a, b) =>
        a.name.localeCompare(b.name)
    );

    // Sidebar content (same for mobile and desktop)
    const sidebarContent = (
        <div className={`sidebar flex flex-col p-4 z-10 overflow-y-auto transition-all duration-300 ${isMobile ? 'w-full h-full' : isSidebarCollapsed ? 'w-16 shrink-0' : 'w-64 shrink-0'}`}>
            {/* Header Section */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div className={`flex-1 min-w-0 transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0' : 'opacity-100 delay-100'}`}>
                        <h2 className="text-xs uppercase font-semibold mb-1" style={{ color: 'var(--app-text-secondary)' }}>
                            Campaign
                        </h2>
                        <p className="text-sm font-medium truncate" title={campaign.name}>
                            {campaign.name}
                        </p>
                    </div>
                    {!isMobile && (
                        <Tooltip content={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                            <button
                                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                                className="p-2 hover:bg-[var(--app-bg-subtle)] rounded transition"
                                aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                            >
                                <RiArrowLeftSLine className={`w-4 h-4 transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
                            </button>
                        </Tooltip>
                    )}
                </div>
            </div>

            {!isSidebarCollapsed && (
                <>
                    {/* MAPS Section */}
                    <CollapsibleSection title="MAPS">
                        <ul className="space-y-2 mb-4" aria-label="Campaign maps">
                            {maps.map(map => {
                                const isActive = map.id === activeMapId;
                                return (
                                    <li
                                        key={map.id}
                                        className={`
                                            group flex items-center justify-between p-2 rounded transition
                                            ${isActive
                                                ? 'bg-[var(--app-accent-bg)] border border-[var(--app-accent-border)]'
                                                : 'bg-[var(--app-bg-subtle)]'
                                            }
                                        `}
                                    >
                                        <button
                                            onClick={() => switchMap(map.id)}
                                            aria-label={`${isActive ? 'Current map: ' : 'Switch to '}${map.name}`}
                                            aria-current={isActive ? 'page' : undefined}
                                            className="flex-1 min-w-0 flex items-center gap-2 text-left hover:opacity-80 transition"
                                        >
                                            {isActive ? (
                                                <RiPushpinLine className="w-5 h-5" />
                                            ) : (
                                                <RiMap2Line className="w-5 h-5" />
                                            )}
                                            <span
                                                className={`text-sm font-medium truncate ${isActive ? 'text-[var(--app-accent-text)]' : ''}`}
                                                title={map.name}
                                            >
                                                {map.name}
                                            </span>
                                        </button>

                                        <Tooltip content="Edit map">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingMapId(map.id);
                                                    setMapSettingsMode('EDIT');
                                                    setIsMapSettingsOpen(true);
                                                }}
                                                className="p-1 opacity-0 group-hover:opacity-100 hover:text-[var(--app-accent-text)] transition-opacity"
                                                aria-label={`Edit ${map.name}`}
                                            >
                                                <RiSettings4Line className="w-4 h-4" />
                                            </button>
                                        </Tooltip>
                                    </li>
                                );
                            })}
                        </ul>

                        <button
                            onClick={() => {
                                setMapSettingsMode('CREATE');
                                setEditingMapId(null);
                                setIsMapSettingsOpen(true);
                            }}
                            className="btn btn-secondary w-full py-2 text-sm flex items-center justify-center gap-2 border-dashed border-2"
                        >
                            <RiAddLine className="w-5 h-5" /> New Map
                        </button>
                    </CollapsibleSection>

                    <div className="w-full h-px bg-[var(--app-border-default)] my-6"></div>

                    {/* Door Controls Section */}
                    <DoorControls />

                    {/* LIBRARY Section */}
                    <CollapsibleSection title="LIBRARY">
                        {/* Action Bar */}
                        <div className="flex gap-2 mb-4">
                            <Tooltip content="Open Command Palette (Cmd+K / Cmd+P)">
                                <button
                                    onClick={() => setPaletteOpen(true)}
                                    className="btn btn-secondary flex-1 py-2 text-sm flex items-center justify-center gap-2"
                                >
                                    <RiSearchLine className="w-5 h-5" /> Place
                                </button>
                            </Tooltip>

                            <input
                                type="file"
                                accept="image/*"
                                ref={tokenInputRef}
                                className="hidden"
                                onChange={handleTokenUpload}
                            />
                            <Tooltip content="Add token to library">
                                <button
                                    onClick={() => tokenInputRef.current?.click()}
                                    className="btn btn-secondary flex-1 py-2 text-sm flex items-center justify-center gap-2"
                                >
                                    <RiAddLine className="w-5 h-5" /> Add
                                </button>
                            </Tooltip>

                            <Tooltip content="Manage library">
                                <button
                                    onClick={() => setIsLibraryManagerOpen(true)}
                                    className="btn btn-ghost px-3 py-2"
                                    aria-label="Manage library"
                                >
                                    <RiBookLine className="w-5 h-5" />
                                </button>
                            </Tooltip>
                        </div>

                        {/* Quick Token Access - Recent History + Party Tokens */}
                        <QuickTokenSidebarErrorBoundary>
                            <QuickTokenSidebar
                                recentTokens={recentTokens}
                                playerTokens={deduplicatedPlayerTokens}
                                onDragStart={handleDragStart}
                            />
                        </QuickTokenSidebarErrorBoundary>
                    </CollapsibleSection>
                </>
            )}

        </div>
    );

    return (
        <>
            {/* Sidebar Content */}
            {isMobile ? (
                <MobileSidebarDrawer isOpen={isMobileDrawerOpen} onClose={() => setMobileDrawerOpen(false)}>
                    {sidebarContent}
                </MobileSidebarDrawer>
            ) : (
                sidebarContent
            )}

            {/* Map Settings Sheet */}
            <MapSettingsSheet
                isOpen={isMapSettingsOpen}
                onClose={() => {
                    setIsMapSettingsOpen(false);
                    setEditingMapId(null);
                }}
                mode={mapSettingsMode}
                mapId={editingMapId || undefined}
            />

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
        </>
    );
};

export default Sidebar;
