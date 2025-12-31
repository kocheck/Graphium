/**
 * Command Palette Component - Quick Actions & Asset Search (Cmd+P)
 *
 * Provides a Spotlight-style search interface for both:
 * - Actions: Tool selection, world view controls, dungeon generation
 * - Assets: Token library search and placement
 *
 * **Workflow:**
 * 1. User presses Cmd+P (keyboard shortcut)
 * 2. Modal opens with search input focused
 * 3. User types query (e.g., "marker" for tool or "dragon" for asset)
 * 4. Fuzzy search filters both actions and assets in real-time
 * 5. User clicks item or presses Enter to execute/add
 * 6. Modal closes
 *
 * **Keyboard shortcuts:**
 * - Cmd+P / Ctrl+P: Open palette
 * - Escape: Close palette
 * - Enter: Execute highlighted action/add asset
 * - Arrow Up/Down: Navigate results
 *
 * **Search algorithm:**
 * Commands and assets are searched separately and merged with section headers.
 *
 * @component
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import { fuzzySearch } from '../../utils/fuzzySearch';
import { addLibraryTokenToMap } from '../../utils/tokenHelpers';
import TokenMetadataEditor from './TokenMetadataEditor';
import LibraryModalErrorBoundary from './LibraryModalErrorBoundary';
import { createCommandRegistry, searchCommands, type Command } from '../../utils/commandRegistry';
import { RiEditLine, RiArrowRightSLine } from '@remixicon/react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  // Command handlers
  onSetTool: (tool: 'select' | 'marker' | 'eraser' | 'wall' | 'door' | 'measure') => void;
  onTogglePause: () => void;
  onLaunchWorldView: () => void;
  onOpenDungeonGenerator: () => void;
  isGamePaused: boolean;
}

type ResultItem =
  | { type: 'command'; data: Command }
  | { type: 'asset'; data: ReturnType<typeof fuzzySearch>[number] }
  | { type: 'section'; label: string };

const CommandPalette = ({
  isOpen,
  onClose,
  onSetTool,
  onTogglePause,
  onLaunchWorldView,
  onOpenDungeonGenerator,
  isGamePaused
}: CommandPaletteProps) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Metadata editor state
  const [isMetadataEditorOpen, setIsMetadataEditorOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Store selectors
  const tokenLibrary = useGameStore(state => state.campaign.tokenLibrary);
  const addToken = useGameStore(state => state.addToken);

  // Create command registry
  const commandRegistry = useMemo(() => createCommandRegistry({
    setToolSelect: () => onSetTool('select'),
    setToolMarker: () => onSetTool('marker'),
    setToolEraser: () => onSetTool('eraser'),
    setToolWall: () => onSetTool('wall'),
    setToolDoor: () => onSetTool('door'),
    setToolMeasure: () => onSetTool('measure'),
    togglePause: onTogglePause,
    launchWorldView: onLaunchWorldView,
    openDungeonGenerator: onOpenDungeonGenerator,
    isGamePaused,
  }), [onSetTool, onTogglePause, onLaunchWorldView, onOpenDungeonGenerator, isGamePaused]);

  // Search both commands and assets
  const commandResults = useMemo(
    () => searchCommands(commandRegistry, query),
    [commandRegistry, query]
  );

  const assetResults = useMemo(
    () => fuzzySearch(tokenLibrary, query),
    [tokenLibrary, query]
  );

  // Combine results with section headers
  const results = useMemo(() => {
    const combined: ResultItem[] = [];

    // Add commands section
    if (commandResults.length > 0) {
      combined.push({ type: 'section', label: 'Actions' });
      commandResults.forEach(cmd => {
        combined.push({ type: 'command', data: cmd });
      });
    }

    // Add assets section
    if (assetResults.length > 0) {
      combined.push({ type: 'section', label: 'Assets' });
      assetResults.forEach(asset => {
        combined.push({ type: 'asset', data: asset });
      });
    }

    return combined;
  }, [commandResults, assetResults]);

  // Reset selected index when results change, skip section headers
  useEffect(() => {
    // Find first non-section item
    const firstSelectableIndex = results.findIndex(item => item.type !== 'section');
    setSelectedIndex(firstSelectableIndex >= 0 ? firstSelectableIndex : 0);
  }, [results]);

  /**
   * Handles item selection
   * Executes command or adds token to map
   * Uses useCallback to prevent stale closure issues
   */
  const handleSelectItem = useCallback((index: number) => {
    const item = results[index];
    if (!item) return;

    if (item.type === 'section') {
      // Section headers are not selectable
      return;
    }

    if (item.type === 'command') {
      // Execute command
      item.data.execute();
      onClose();
      setQuery('');
    } else if (item.type === 'asset') {
      // Add asset to map
      const state = useGameStore.getState();
      const currentMap = state.map;
      addLibraryTokenToMap(item.data, addToken, currentMap);
      onClose();
      setQuery('');
    }
  }, [results, addToken, onClose]);

  // Auto-focus search input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Handle Escape key to close and arrow keys for navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && results.length > 0) {
        // Select highlighted result on Enter
        const selectedItem = results[selectedIndex];
        if (!selectedItem || selectedItem.type === 'section') {
          // Don't trigger selection when a section header is highlighted
          return;
        }
        handleSelectItem(selectedIndex);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        // Check if there are any selectable items at all
        const hasSelectableItems = results.some(item => item.type !== 'section');
        if (!hasSelectableItems) return;

        // Skip section headers
        let nextIndex = selectedIndex + 1;
        while (nextIndex < results.length && results[nextIndex].type === 'section') {
          nextIndex++;
        }
        if (nextIndex < results.length) {
          setSelectedIndex(nextIndex);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        // Check if there are any selectable items at all
        const hasSelectableItems = results.some(item => item.type !== 'section');
        if (!hasSelectableItems) return;

        // Skip section headers
        let prevIndex = selectedIndex - 1;
        while (prevIndex >= 0 && results[prevIndex].type === 'section') {
          prevIndex--;
        }
        if (prevIndex >= 0) {
          setSelectedIndex(prevIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, onClose, handleSelectItem, selectedIndex]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-32 bg-black/50"
      onClick={onClose}
    >
      {/* Modal content */}
      <div 
        className="w-full max-w-2xl bg-neutral-900 rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="p-4 border-b border-neutral-700">
          <input
            aria-label="Search actions and assets"
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search actions and assets..."
            className="w-full bg-neutral-800 text-white px-4 py-3 rounded-lg border border-neutral-600 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Results list */}
        <div className="max-h-96 overflow-y-auto">
          {results.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">
              <p className="text-lg mb-2">No results found</p>
              <p className="text-sm">Try searching for tools, actions, or assets</p>
            </div>
          ) : (
            <div role="listbox">
              {results.map((item, index) => {
                // Section header
                if (item.type === 'section') {
                  return (
                    <div key={`section-${item.label}`} className="px-4 py-2 bg-neutral-800 border-b border-neutral-700">
                      <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">{item.label}</h3>
                    </div>
                  );
                }

                // Command item
                if (item.type === 'command') {
                  const cmd = item.data;
                  return (
                    <div
                      key={cmd.id}
                      role="option"
                      aria-selected={index === selectedIndex}
                      onClick={() => handleSelectItem(index)}
                      className={`flex items-center gap-4 p-4 cursor-pointer transition-colors border-b border-neutral-800 ${
                        index === selectedIndex
                          ? 'bg-neutral-700'
                          : 'hover:bg-neutral-800'
                      }`}
                    >
                      {/* Icon */}
                      <div className="w-10 h-10 flex items-center justify-center text-2xl bg-neutral-800 rounded">
                        {cmd.icon || '⚡'}
                      </div>

                      {/* Metadata */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium">{cmd.label}</h3>
                        <p className="text-neutral-400 text-sm">{cmd.category}</p>
                      </div>

                      {/* Shortcut */}
                      {cmd.shortcut && (
                        <div className="text-neutral-500 text-xs">
                          <kbd className="px-2 py-1 bg-neutral-800 rounded border border-neutral-700">
                            {cmd.shortcut}
                          </kbd>
                        </div>
                      )}
                    </div>
                  );
                }

                // Asset item
                const asset = item.data;
                return (
                  <div
                    key={asset.id}
                    role="option"
                    aria-selected={index === selectedIndex}
                    onClick={() => handleSelectItem(index)}
                    className={`flex items-center gap-4 p-4 cursor-pointer transition-colors border-b border-neutral-800 ${
                      index === selectedIndex
                        ? 'bg-neutral-700'
                        : 'hover:bg-neutral-800'
                    }`}
                  >
                    {/* Thumbnail */}
                    <img
                      src={asset.thumbnailSrc.replace('file:', 'media:')}
                      alt={asset.name}
                      className="w-16 h-16 object-cover rounded bg-neutral-700"
                    />

                    {/* Metadata */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate">{asset.name}</h3>
                      <p className="text-neutral-400 text-sm">{asset.category}</p>
                      {asset.tags.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {asset.tags.slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-neutral-700 text-neutral-300 px-2 py-0.5 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                          {asset.tags.length > 3 && (
                            <span className="text-xs text-neutral-500">
                              +{asset.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {/* Edit button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingItemId(asset.id);
                          setIsMetadataEditorOpen(true);
                        }}
                        className="p-2 hover:bg-neutral-600 rounded text-neutral-400 hover:text-white transition-colors"
                        aria-label={`Edit ${asset.name}`}
                      >
                        <RiEditLine className="w-5 h-5" />
                      </button>

                      {/* Select indicator */}
                      <div className="text-neutral-600">
                        <RiArrowRightSLine className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-neutral-800 border-t border-neutral-700 flex justify-between text-xs text-neutral-400">
          <span>Press <kbd className="px-2 py-1 bg-neutral-700 rounded">↑↓</kbd> to navigate | <kbd className="px-2 py-1 bg-neutral-700 rounded">↵</kbd> to select</span>
          <span>Press <kbd className="px-2 py-1 bg-neutral-700 rounded">Esc</kbd> to close</span>
        </div>
      </div>

      {/* Token Metadata Editor */}
      <LibraryModalErrorBoundary
        onClose={() => {
          setIsMetadataEditorOpen(false);
          setEditingItemId(null);
        }}
      >
        <TokenMetadataEditor
          isOpen={isMetadataEditorOpen}
          libraryItemId={editingItemId}
          onClose={() => {
            setIsMetadataEditorOpen(false);
            setEditingItemId(null);
          }}
        />
      </LibraryModalErrorBoundary>
    </div>
  );
};

export default CommandPalette;
