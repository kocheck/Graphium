/**
 * Command Palette Component - Quick Asset Search (Cmd+P)
 *
 * Provides a Spotlight-style search interface for the token library.
 * Users can press Cmd+P (Mac) or Ctrl+P (Windows/Linux) to open the palette,
 * search for assets by name/tags, and quickly add them to the active map.
 *
 * **Workflow:**
 * 1. User presses Cmd+P (keyboard shortcut)
 * 2. Modal opens with search input focused
 * 3. User types query (e.g., "dragon")
 * 4. Fuzzy search filters library items in real-time
 * 5. User clicks item or presses Enter to add token to map
 * 6. Modal closes, token appears at map center
 *
 * **Keyboard shortcuts:**
 * - Cmd+P / Ctrl+P: Open palette
 * - Escape: Close palette
 * - Enter: Select highlighted item
 * - Arrow Up/Down: Navigate results
 *
 * **Search algorithm:**
 * Uses fuzzySearch() utility which scores items based on:
 * - Name match (weight: 3x)
 * - Category match (weight: 1x)
 * - Tag matches (weight: 2x each)
 * Results sorted by score descending
 *
 * @component
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import { fuzzySearch } from '../../utils/fuzzySearch';
import { addLibraryTokenToMap } from '../../utils/tokenHelpers';
import TokenMetadataEditor from './TokenMetadataEditor';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const CommandPalette = ({ isOpen, onClose }: CommandPaletteProps) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Metadata editor state
  const [isMetadataEditorOpen, setIsMetadataEditorOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Store selectors
  const tokenLibrary = useGameStore(state => state.campaign.tokenLibrary);
  const addToken = useGameStore(state => state.addToken);

  // Fuzzy search results (memoized to avoid re-running on every render)
  const results = useMemo(
    () => fuzzySearch(tokenLibrary, query),
    [tokenLibrary, query]
  );

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  /**
   * Handles item selection
   * Adds token to map at center position
   * Uses useCallback to prevent stale closure issues
   */
  const handleSelectItem = useCallback((itemId: string) => {
    const state = useGameStore.getState();
    const currentTokenLibrary = state.campaign.tokenLibrary;
    const currentMap = state.map;
    
    const item = currentTokenLibrary.find(i => i.id === itemId);
    if (!item) return;

    addLibraryTokenToMap(item, addToken, currentMap);
    onClose();
    setQuery(''); // Reset search
  }, [addToken, onClose]);

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
        handleSelectItem(results[selectedIndex].id);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
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
            aria-label="Search library assets"
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search library assets (name, category, tags)..."
            className="w-full bg-neutral-800 text-white px-4 py-3 rounded-lg border border-neutral-600 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Results list */}
        <div className="max-h-96 overflow-y-auto">
          {results.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">
              {tokenLibrary.length === 0 ? (
                <>
                  <p className="text-lg mb-2">Library is empty</p>
                  <p className="text-sm">Add assets to your library to use the command palette</p>
                </>
              ) : (
                <>
                  <p className="text-lg mb-2">No results found</p>
                  <p className="text-sm">Try a different search term</p>
                </>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-neutral-800" role="listbox">
              {results.map((item, index) => (
                <li
                  key={item.id}
                  role="option"
                  aria-selected={index === selectedIndex}
                  onClick={() => handleSelectItem(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectItem(item.id);
                    }
                  }}
                  className={`flex items-center gap-4 p-4 cursor-pointer transition-colors ${
                    index === selectedIndex 
                      ? 'bg-neutral-700' 
                      : 'hover:bg-neutral-800'
                  }`}
                >
                  {/* Thumbnail */}
                  <img
                    src={item.thumbnailSrc.replace('file:', 'media:')}
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded bg-neutral-700"
                  />

                  {/* Metadata */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium truncate">{item.name}</h3>
                    <p className="text-neutral-400 text-sm">{item.category}</p>
                    {item.tags.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {item.tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            className="text-xs bg-neutral-700 text-neutral-300 px-2 py-0.5 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        {item.tags.length > 3 && (
                          <span className="text-xs text-neutral-500">
                            +{item.tags.length - 3}
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
                        setEditingItemId(item.id);
                        setIsMetadataEditorOpen(true);
                      }}
                      className="p-2 hover:bg-neutral-600 rounded text-neutral-400 hover:text-white transition-colors"
                      aria-label={`Edit ${item.name}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>

                    {/* Select indicator */}
                    <div className="text-neutral-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-neutral-800 border-t border-neutral-700 flex justify-between text-xs text-neutral-400">
          <span>Press <kbd className="px-2 py-1 bg-neutral-700 rounded">↑↓</kbd> to navigate | <kbd className="px-2 py-1 bg-neutral-700 rounded">↵</kbd> to select</span>
          <span>Press <kbd className="px-2 py-1 bg-neutral-700 rounded">Esc</kbd> to close</span>
        </div>
      </div>

      {/* Token Metadata Editor */}
      <TokenMetadataEditor
        isOpen={isMetadataEditorOpen}
        libraryItemId={editingItemId}
        onClose={() => {
          setIsMetadataEditorOpen(false);
          setEditingItemId(null);
        }}
      />
    </div>
  );
};

export default CommandPalette;
