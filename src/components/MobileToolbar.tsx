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

const MobileToolbar = ({
  tool,
  setTool,
  color,
  setColor,
  doorOrientation = 'horizontal',
  setDoorOrientation,
  isGamePaused,
  onPauseToggle,
}: MobileToolbarProps) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Close menu when clicking outside
  const handleMoreClick = () => {
    setShowMoreMenu(!showMoreMenu);
  };

  const handleDungeonGen = () => {
    useGameStore.getState().showDungeonDialog();
    setShowMoreMenu(false);
  };

  const handleWorldView = () => {
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

  const handleColorPicker = () => {
    colorInputRef.current?.click();
    setShowMoreMenu(false);
  };

  return (
    <>
      {/* Overflow Menu (slides up from bottom) */}
      {showMoreMenu && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowMoreMenu(false)} />

          {/* Menu */}
          <div
            className="fixed bottom-16 right-0 left-0 mx-4 mb-2 rounded-lg shadow-xl z-50 overflow-hidden"
            style={{
              backgroundColor: 'var(--app-bg-surface)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'var(--app-border-default)',
            }}
          >
            {/* Play/Pause Button */}
            <button
              onClick={() => {
                onPauseToggle();
                setShowMoreMenu(false);
              }}
              className="w-full px-4 py-4 text-left flex items-center gap-3 min-h-[56px]"
              style={{
                backgroundColor: isGamePaused
                  ? 'var(--app-error-solid)'
                  : 'var(--app-success-solid)',
                color: 'white',
                borderBottomWidth: '1px',
                borderBottomStyle: 'solid',
                borderBottomColor: 'var(--app-border-subtle)',
              }}
            >
              {isGamePaused ? (
                <RiPlayFill className="w-5 h-5" />
              ) : (
                <RiPauseFill className="w-5 h-5" />
              )}
              <span className="font-semibold">
                {isGamePaused ? 'PAUSED - Click to Resume' : 'PLAYING - Click to Pause'}
              </span>
            </button>

            {/* Door Tool */}
            <button
              onClick={() => {
                setTool('door');
                setShowMoreMenu(false);
              }}
              className="w-full px-4 py-4 text-left flex items-center gap-3 transition-colors min-h-[56px]"
              style={{
                color: 'var(--app-text-primary)',
                backgroundColor: tool === 'door' ? 'var(--app-accent-bg)' : 'transparent',
                borderBottomWidth: '1px',
                borderBottomStyle: 'solid',
                borderBottomColor: 'var(--app-border-subtle)',
              }}
            >
              <RiDoorOpenLine className="w-6 h-6" />
              <div className="flex-1">
                <span>Place Door</span>
                {tool === 'door' && (
                  <div className="text-xs opacity-70 mt-1">
                    {doorOrientation === 'horizontal' ? 'Horizontal ↔' : 'Vertical ↕'}
                  </div>
                )}
              </div>
              {tool === 'door' && setDoorOrientation && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDoorOrientation(
                      doorOrientation === 'horizontal' ? 'vertical' : 'horizontal',
                    );
                  }}
                  className="px-3 py-1 rounded text-sm"
                  style={{
                    backgroundColor: 'var(--app-accent-solid)',
                    color: 'white',
                  }}
                >
                  Rotate
                </button>
              )}
            </button>

            {/* Color Picker */}
            <button
              onClick={handleColorPicker}
              className="w-full px-4 py-4 text-left flex items-center gap-3 transition-colors min-h-[56px]"
              style={{
                color: 'var(--app-text-primary)',
                borderBottomWidth: '1px',
                borderBottomStyle: 'solid',
                borderBottomColor: 'var(--app-border-subtle)',
              }}
            >
              <div
                className="w-6 h-6 rounded border-2"
                style={{
                  backgroundColor: color,
                  borderColor: 'var(--app-border-default)',
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
            </button>

            {/* Dungeon Generator */}
            <button
              onClick={handleDungeonGen}
              className="w-full px-4 py-4 text-left flex items-center gap-3 transition-colors min-h-[56px]"
              style={{
                color: 'var(--app-text-primary)',
                borderBottomWidth: '1px',
                borderBottomStyle: 'solid',
                borderBottomColor: 'var(--app-border-subtle)',
              }}
            >
              <RiBuildingLine className="w-6 h-6" />
              <span>Generate Random Dungeon</span>
            </button>

            {/* World View */}
            <button
              onClick={handleWorldView}
              className="w-full px-4 py-4 text-left flex items-center gap-3 transition-colors min-h-[56px]"
              style={{
                color: 'var(--app-text-primary)',
              }}
            >
              <RiGlobalLine className="w-6 h-6" />
              <span>Open World View (Player Display)</span>
            </button>
          </div>
        </>
      )}

      {/* Bottom Navigation Bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around"
        style={{
          backgroundColor: 'var(--app-bg-surface)',
          borderTopWidth: '1px',
          borderTopStyle: 'solid',
          borderTopColor: 'var(--app-border-subtle)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)', // iOS safe area
        }}
      >
        {/* Select Tool */}
        <button
          onClick={() => setTool('select')}
          className="flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] transition-colors"
          style={{
            color: tool === 'select' ? 'var(--app-accent-solid)' : 'var(--app-text-secondary)',
            backgroundColor: tool === 'select' ? 'var(--app-accent-bg)' : 'transparent',
          }}
        >
          <RiCursorLine className="w-6 h-6" />
          <span className="text-xs mt-1">Select</span>
        </button>

        {/* Marker Tool */}
        <button
          onClick={() => setTool('marker')}
          className="flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] transition-colors"
          style={{
            color: tool === 'marker' ? 'var(--app-accent-solid)' : 'var(--app-text-secondary)',
            backgroundColor: tool === 'marker' ? 'var(--app-accent-bg)' : 'transparent',
          }}
        >
          <RiPencilLine className="w-6 h-6" />
          <span className="text-xs mt-1">Marker</span>
        </button>

        {/* Eraser Tool */}
        <button
          onClick={() => setTool('eraser')}
          className="flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] transition-colors"
          style={{
            color: tool === 'eraser' ? 'var(--app-accent-solid)' : 'var(--app-text-secondary)',
            backgroundColor: tool === 'eraser' ? 'var(--app-accent-bg)' : 'transparent',
          }}
        >
          <RiEraserLine className="w-6 h-6" />
          <span className="text-xs mt-1">Eraser</span>
        </button>

        {/* Wall Tool */}
        <button
          onClick={() => setTool('wall')}
          className="flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] transition-colors"
          style={{
            color: tool === 'wall' ? 'var(--app-accent-solid)' : 'var(--app-text-secondary)',
            backgroundColor: tool === 'wall' ? 'var(--app-accent-bg)' : 'transparent',
          }}
        >
          <RiLayoutMasonryLine className="w-6 h-6" />
          <span className="text-xs mt-1">Wall</span>
        </button>

        {/* More Menu */}
        <button
          onClick={handleMoreClick}
          className="flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] transition-colors"
          style={{
            color: showMoreMenu ? 'var(--app-accent-solid)' : 'var(--app-text-secondary)',
            backgroundColor: showMoreMenu ? 'var(--app-accent-bg)' : 'transparent',
          }}
        >
          <RiMoreLine className="w-6 h-6" />
          <span className="text-xs mt-1">More</span>
        </button>
      </div>
    </>
  );
};

export default MobileToolbar;
