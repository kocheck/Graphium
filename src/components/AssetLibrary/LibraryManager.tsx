/**
 * Library Manager Component - Asset Grid View
 *
 * Provides a comprehensive UI for managing the token library.
 * Shows all library assets in a grid with filtering, search, and management actions.
 *
 * **Features:**
 * - Grid view with thumbnails
 * - Category filter dropdown
 * - Search bar (integrated with fuzzy search)
 * - Delete action per asset
 * - Edit metadata (name, category, tags)
 * - Drag-to-canvas for quick placement
 *
 * **Layout:**
 * - Header: Search bar + Category filter + Close button
 * - Body: Scrollable grid of asset cards
 * - Footer: Asset count + Actions
 *
 * @component
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import type { TokenLibraryItem } from '../../store/gameStore';
import { fuzzySearch, filterByCategory, getCategories } from '../../utils/fuzzySearch';
import { processImage, ProcessingHandle } from '../../utils/AssetProcessor';
import { addLibraryTokenToMap } from '../../utils/tokenHelpers';
import AddToLibraryDialog from './AddToLibraryDialog';
import TokenMetadataEditor from './TokenMetadataEditor';
import { getStorage } from '../../services/storage';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { rollForMessage } from '../../utils/systemMessages';

interface LibraryManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const LibraryManager = ({ isOpen, onClose }: LibraryManagerProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Mobile responsiveness
  const isMobile = useIsMobile();

  // Upload state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<{
    src: string;
    blob: Blob;
    name: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingHandleRef = useRef<ProcessingHandle | null>(null);

  // Metadata editor state
  const [isMetadataEditorOpen, setIsMetadataEditorOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Store selectors
  const tokenLibrary = useGameStore(state => state.campaign.tokenLibrary);
  const removeTokenFromLibrary = useGameStore(state => state.removeTokenFromLibrary);
  const showConfirmDialog = useGameStore(state => state.showConfirmDialog);
  const showToast = useGameStore(state => state.showToast);
  const addToken = useGameStore(state => state.addToken);
  const map = useGameStore(state => state.map);

  // Get categories from library
  const categories = ['All', ...getCategories(tokenLibrary)];

  // Filter and search (optimized: category filter first to reduce fuzzy search work)
  const filteredItems = useMemo(() => {
    const categoryFiltered = filterByCategory(tokenLibrary, selectedCategory);
    return fuzzySearch(categoryFiltered, searchQuery);
  }, [tokenLibrary, selectedCategory, searchQuery]);

  // Cleanup processing handle on unmount
  useEffect(() => {
    return () => {
      if (processingHandleRef.current) {
        processingHandleRef.current.cancel();
        processingHandleRef.current = null;
      }
    };
  }, []);

  /**
   * Handle file upload
   * Opens AddToLibraryDialog for metadata input
   */
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Process image to optimize it
      const handle = processImage(file, 'TOKEN');
      processingHandleRef.current = handle;
      const src = await handle.promise;
      processingHandleRef.current = null;

      // Read the processed file back as blob so thumbnails and saved assets
      // are generated from the optimized image, not the original upload
      try {
        const response = await fetch(src);
        const blob = await response.blob();

        setPendingImage({
          src,
          blob,
          name: file.name.split('.')[0] || 'New Asset',
        });
        setIsAddDialogOpen(true);
      } catch (fetchErr) {
        console.error('[LibraryManager] Failed to read processed file:', fetchErr);
        showToast(rollForMessage('PROCESSED_IMAGE_READ_FAILED'), 'error');
        processingHandleRef.current = null;
      }
    } catch (err) {
      console.error('[LibraryManager] Failed to process upload:', err);
      showToast(rollForMessage('IMAGE_PROCESS_FAILED'), 'error');
      processingHandleRef.current = null;
    } finally {
      e.target.value = ''; // Reset input
    }
  };

  /**
   * Handle delete asset
   * Shows confirmation dialog before deleting
   */
  const handleDelete = async (itemId: string, itemName: string) => {
    showConfirmDialog(
      rollForMessage('CONFIRM_LIBRARY_ASSET_DELETE', { assetName: itemName }),
      async () => {
        try {
          // Delete from storage (filesystem or IndexedDB)
          const storage = getStorage();
          await storage.deleteLibraryAsset(itemId);

          // Remove from store
          removeTokenFromLibrary(itemId);

          showToast(rollForMessage('ASSET_DELETED_SUCCESS'), 'success');
        } catch (error) {
          console.error('[LibraryManager] Failed to delete asset:', error);
          showToast(rollForMessage('ASSET_DELETE_FAILED'), 'error');
        }
      },
      'Delete'
    );
  };

  /**
   * Handle drag start for library tokens
   * Allows dragging tokens from library to canvas
   * Passes library item ID to create instance reference
   */
  const handleDragStart = (e: React.DragEvent, libraryToken: TokenLibraryItem) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type: 'LIBRARY_TOKEN',
        libraryItemId: libraryToken.id, // Reference to prototype
        src: libraryToken.src,
        // Note: metadata (name, scale, type, visionRadius) will be inherited from library
      })
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      {/* Modal container: Full-screen on mobile, centered on desktop */}
      <div
        className={`w-full flex flex-col overflow-hidden shadow-2xl ${
          isMobile
            ? 'h-full'
            : 'max-w-6xl h-[80vh] rounded-lg'
        }`}
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--app-bg-base)',
        }}
      >
        {/* Header */}
        <div className="p-4 border-b border-neutral-700 bg-neutral-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Token Library</h2>
            <div className="flex gap-2">
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={handleUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Upload
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-neutral-700 rounded text-white"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Search and filter */}
          <div className="flex gap-3">
            <input
              aria-label="Search library assets"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assets..."
              className="flex-1 bg-neutral-700 text-white px-4 py-2 rounded border border-neutral-600 focus:border-blue-500 focus:outline-none text-base"
            />
            <select
              aria-label="Filter by category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-neutral-700 text-white px-4 py-2 rounded border border-neutral-600 focus:border-blue-500 focus:outline-none text-base"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Asset grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredItems.length === 0 ? (
            <div className="text-center py-16 text-neutral-500">
              {tokenLibrary.length === 0 ? (
                <>
                  <p className="text-lg mb-2">Library is empty</p>
                  <p className="text-sm">Add assets using the "Add to Library" button in the sidebar</p>
                </>
              ) : (
                <>
                  <p className="text-lg mb-2">No assets found</p>
                  <p className="text-sm">Try adjusting your search or filter</p>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  className="group bg-neutral-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all cursor-grab active:cursor-grabbing"
                >
                  {/* Thumbnail */}
                  <div className="aspect-square bg-neutral-700 relative">
                    <img
                      src={item.thumbnailSrc.replace('file:', 'media:')}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                    {/* Action buttons (show on hover) */}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Edit button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingItemId(item.id);
                          setIsMetadataEditorOpen(true);
                        }}
                        className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded"
                        aria-label={`Edit ${item.name}`}
                      >
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {/* Delete button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id, item.name);
                        }}
                        className="p-1.5 bg-red-600 hover:bg-red-500 rounded"
                        aria-label={`Delete ${item.name}`}
                      >
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="p-3">
                    <h3 className="text-white font-medium text-sm truncate mb-1">{item.name}</h3>
                    <p className="text-neutral-400 text-xs truncate">{item.category}</p>
                    {item.tags.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {item.tags.slice(0, 2).map((tag, idx) => (
                          <span
                            key={idx}
                            className="text-xs bg-neutral-700 text-neutral-300 px-2 py-0.5 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        {item.tags.length > 2 && (
                          <span className="text-xs text-neutral-500">
                            +{item.tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Keyboard-accessible add button */}
                    <button
                      onClick={() => {
                        addLibraryTokenToMap(item, addToken, map);
                        showToast(rollForMessage('ASSET_ADDED_TO_MAP_SUCCESS', { itemName: item.name }), 'success');
                      }}
                      className="w-full mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white text-xs font-medium"
                      aria-label={`Add ${item.name} to map`}
                    >
                      Add to Map
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-700 bg-neutral-800 flex justify-between items-center">
          <span className="text-neutral-400 text-sm">
            {filteredItems.length} of {tokenLibrary.length} assets
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded text-white font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Add to Library Dialog */}
      <AddToLibraryDialog
        isOpen={isAddDialogOpen}
        imageSrc={pendingImage?.src || null}
        imageBlob={pendingImage?.blob || null}
        suggestedName={pendingImage?.name}
        onClose={() => {
          setIsAddDialogOpen(false);
          setPendingImage(null);
        }}
        onConfirm={() => {
          setIsAddDialogOpen(false);
          setPendingImage(null);
        }}
      />

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

export default LibraryManager;
