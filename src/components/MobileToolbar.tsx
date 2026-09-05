/**
 * MobileToolbar Component
 *
 * Bottom navigation bar for mobile devices that replaces the desktop toolbar.
 * Provides quick access to the most commonly used tools.
 *
 * Features:
 * - Fixed bottom positioning
 * - 5 slots: 4 primary tools + overflow menu
 * - 44px minimum touch targets
 * - Active state indicators
 * - Icon-only buttons to save space
 * - Overflow menu for secondary actions
 *
 * Layout:
 * ┌────────┬────────┬────────┬────────┬────────┐
 * │ Select │ Marker │ Eraser │  Wall  │  More  │
 * │   ✋   │   ✏️   │   🧹   │   🧱   │   ⋯   │
 * └────────┴────────┴────────┴────────┴────────┘
 *
 * @param tool - Active tool selection
 * @param setTool - Callback to change tool
 * @param color - Current marker color
 * @param setColor - Callback to change color
 * @param onOpenMenu - Callback to open hamburger menu (for sidebar)
 */

import type React from 'react';
import { useState, useRef } from 'react';

import {
  RiPlayFill,
  RiPauseFill,
  RiDoorOpenLine,
  RiBuildingLine,
  RiGlobalLine,
  RiCursorLine,
  RiPencilLine,
  RiEraserLine,
  RiLayoutMasonryLine,
  RiMoreLine,
} from '@remixicon/react';

import { Button } from '@/components/ui/button';

import { useGameStore } from '../store/gameStore';

interface MobileToolbarProps {
  tool: 'select' | 'marker' | 'eraser' | 'wall' | 'door' | 'measure';
  setTool: (tool: 'select' | 'marker' | 'eraser' | 'wall' | 'door' | 'measure') => void;
  color: string;
  setColor: (color: string) => void;
  doorOrientation?: 'horizontal' | 'vertical';
  setDoorOrientation?: (orientation: 'horizontal' | 'vertical') => void;
  isGamePaused: boolean;
  onPauseToggle: () => void;
}

// eslint-disable-next-line max-lines-per-function, complexity
function MobileToolbar({
  tool,
  setTool,
  color,
  setColor,
  doorOrientation = 'horizontal',
  setDoorOrientation,
  isGamePaused,
  onPauseToggle,
}: MobileToolbarProps): React.ReactElement {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Close menu when clicking outside
  const handleMoreClick = (): void => {
    setShowMoreMenu(!showMoreMenu);
  };

  const handleDungeonGen = (): void => {
    useGameStore.getState().showDungeonDialog();
    setShowMoreMenu(false);
  };

  const handleWorldView = (): void => {
    const ipcRenderer = window.ipcRenderer;
    if (ipcRenderer) {
      // Electron: Use IPC to create separate window
      ipcRenderer.send('create-world-window');
    } else {
      // Web: Open in new tab with ?type=world parameter
      const baseUrl = window.location.origin + window.location.pathname;
      window.open(`${baseUrl}?type=world`, '_blank');
    }
    setShowMoreMenu(false);
  };

  const handleColorPicker = (): void => {
    colorInputRef.current?.click();
    setShowMoreMenu(false);
  };

  return (
    <>
      {/* Overflow Menu (slides up from bottom) */}
      {showMoreMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[var(--app-overlay)] z-40"
            onClick={() => setShowMoreMenu(false)}
          />

          {/* Menu */}
          <div
            className="fixed bottom-16 right-0 left-0 mx-4 mb-2 rounded-lg shadow-xl z-50 overflow-hidden bg-[var(--app-bg-surface)] border border-[var(--app-border-default)]"
            data-testid="toolbar-mobile-more-menu"
          >
            {/* Play/Pause Button */}
            <Button
              variant="ghost"
              onClick={() => {
                onPauseToggle();
                setShowMoreMenu(false);
              }}
              className={`w-full px-4 py-4 text-left flex items-center gap-3 min-h-[56px] ${
                isGamePaused
                  ? 'bg-[var(--app-error-solid)] text-[var(--app-error-solid-text)]'
                  : 'bg-[var(--app-success-solid)] text-[var(--app-success-solid-text)]'
              } border-b border-[var(--app-border-subtle)]`}
            >
              {isGamePaused ? (
                <RiPlayFill className="size-5" />
              ) : (
                <RiPauseFill className="size-5" />
              )}
              <span className="font-semibold">
                {isGamePaused ? 'PAUSED - Click to Resume' : 'PLAYING - Click to Pause'}
              </span>
            </Button>

            {/* Door Tool */}
            <Button
              variant="ghost"
              onClick={() => {
                setTool('door');
                setShowMoreMenu(false);
              }}
              className={`w-full px-4 py-4 text-left flex items-center gap-3 transition-colors min-h-[56px] text-[var(--app-text-primary)] border-b border-[var(--app-border-subtle)] ${
                tool === 'door' ? 'bg-[var(--app-accent-bg)]' : 'bg-[var(--app-bg-surface)]'
              }`}
            >
              <RiDoorOpenLine className="size-6" />
              <div className="flex-1">
                <span>Place Door</span>
                {tool === 'door' && (
                  <div className="text-xs opacity-70 mt-1">
                    {doorOrientation === 'horizontal' ? 'Horizontal ↔' : 'Vertical ↕'}
                  </div>
                )}
              </div>
              {tool === 'door' && setDoorOrientation && (
                <Button
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDoorOrientation(
                      doorOrientation === 'horizontal' ? 'vertical' : 'horizontal',
                    );
                  }}
                  className="px-3 py-1 rounded text-sm bg-[var(--app-accent-solid)] text-[var(--app-accent-solid-text)]"
                >
                  Rotate
                </Button>
              )}
            </Button>

            {/* Color Picker */}
            <Button
              variant="ghost"
              onClick={handleColorPicker}
              className="w-full px-4 py-4 text-left flex items-center gap-3 transition-colors min-h-[56px] text-[var(--app-text-primary)] bg-[var(--app-bg-surface)] border-b border-[var(--app-border-subtle)]"
            >
              <div
                className="w-6 h-6 rounded border-2 border-[var(--app-border-default)]"
                style={{
                  backgroundColor: color,
                }}
              />
              <span>Change Marker Color</span>
              <input
                ref={colorInputRef}
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="hidden"
              />
            </Button>

            {/* Dungeon Generator */}
            <Button
              variant="ghost"
              onClick={handleDungeonGen}
              className="w-full px-4 py-4 text-left flex items-center gap-3 transition-colors min-h-[56px] text-[var(--app-text-primary)] bg-[var(--app-bg-surface)] border-b border-[var(--app-border-subtle)]"
            >
              <RiBuildingLine className="size-6" />
              <span>Generate Random Dungeon</span>
            </Button>

            {/* World View */}
            <Button
              variant="ghost"
              onClick={handleWorldView}
              className="w-full px-4 py-4 text-left flex items-center gap-3 transition-colors min-h-[56px] text-[var(--app-text-primary)] bg-[var(--app-bg-surface)]"
            >
              <RiGlobalLine className="size-6" />
              <span>Open World View (Player Display)</span>
            </Button>
          </div>
        </>
      )}

      {/* Bottom Navigation Bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-[var(--app-bg-surface)] border-t border-[var(--app-border-subtle)] pb-[env(safe-area-inset-bottom,0px)]"
        data-testid="toolbar-mobile-root"
      >
        {/* Select Tool */}
        <Button
          variant="ghost"
          onClick={() => setTool('select')}
          className={`flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] transition-colors ${
            tool === 'select'
              ? 'text-[var(--app-accent-solid)] bg-[var(--app-accent-bg)]'
              : 'text-[var(--app-text-secondary)] bg-transparent'
          }`}
        >
          <RiCursorLine className="size-6" />
          <span className="text-xs mt-1">Select</span>
        </Button>

        {/* Marker Tool */}
        <Button
          variant="ghost"
          onClick={() => setTool('marker')}
          className={`flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] transition-colors ${
            tool === 'marker'
              ? 'text-[var(--app-accent-solid)] bg-[var(--app-accent-bg)]'
              : 'text-[var(--app-text-secondary)] bg-transparent'
          }`}
        >
          <RiPencilLine className="size-6" />
          <span className="text-xs mt-1">Marker</span>
        </Button>

        {/* Eraser Tool */}
        <Button
          variant="ghost"
          onClick={() => setTool('eraser')}
          className={`flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] transition-colors ${
            tool === 'eraser'
              ? 'text-[var(--app-accent-solid)] bg-[var(--app-accent-bg)]'
              : 'text-[var(--app-text-secondary)] bg-transparent'
          }`}
        >
          <RiEraserLine className="size-6" />
          <span className="text-xs mt-1">Eraser</span>
        </Button>

        {/* Wall Tool */}
        <Button
          variant="ghost"
          onClick={() => setTool('wall')}
          className={`flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] transition-colors ${
            tool === 'wall'
              ? 'text-[var(--app-accent-solid)] bg-[var(--app-accent-bg)]'
              : 'text-[var(--app-text-secondary)] bg-transparent'
          }`}
        >
          <RiLayoutMasonryLine className="size-6" />
          <span className="text-xs mt-1">Wall</span>
        </Button>

        {/* More Menu */}
        <Button
          variant="ghost"
          onClick={handleMoreClick}
          data-testid="toolbar-mobile-more"
          className={`flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] transition-colors ${
            showMoreMenu
              ? 'text-[var(--app-accent-solid)] bg-[var(--app-accent-bg)]'
              : 'text-[var(--app-text-secondary)] bg-transparent'
          }`}
        >
          <RiMoreLine className="size-6" />
          <span className="text-xs mt-1">More</span>
        </Button>
      </div>
    </>
  );
}

export default MobileToolbar;
