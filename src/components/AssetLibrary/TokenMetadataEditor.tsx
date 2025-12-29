/**
 * TokenMetadataEditor Component - Modal for editing library token metadata
 *
 * Allows editing all metadata properties of a library token:
 * - Name
 * - Category (Monsters, NPCs, Props, Custom)
 * - Tags (for fuzzy search)
 * - Default Scale
 * - Default Vision Radius
 * - Default Type (PC/NPC)
 *
 * Used by:
 * - LibraryManager (edit button on token cards)
 * - CommandPalette (edit action in search results)
 */

import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface TokenMetadataEditorProps {
  isOpen: boolean;
  libraryItemId: string | null;
  onClose: () => void;
}

const TokenMetadataEditor = ({ isOpen, libraryItemId, onClose }: TokenMetadataEditorProps) => {
  const isMobile = useIsMobile();

  // Get library item and update function from store
  const tokenLibrary = useGameStore(state => state.campaign.tokenLibrary);
  const updateLibraryToken = useGameStore(state => state.updateLibraryToken);
  const showToast = useGameStore(state => state.showToast);

  // Find the library item
  const libraryItem = libraryItemId
    ? tokenLibrary.find(item => item.id === libraryItemId)
    : null;

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [defaultScale, setDefaultScale] = useState('');
  const [defaultVisionRadius, setDefaultVisionRadius] = useState('');
  const [defaultType, setDefaultType] = useState<'PC' | 'NPC' | ''>('');

  // Initialize form with library item data
  useEffect(() => {
    if (libraryItem) {
      setName(libraryItem.name);
      setCategory(libraryItem.category);
      setTags(libraryItem.tags.join(', '));
      setDefaultScale(libraryItem.defaultScale?.toString() || '');
      setDefaultVisionRadius(libraryItem.defaultVisionRadius?.toString() || '');
      setDefaultType(libraryItem.defaultType || '');
    }
  }, [libraryItem]);

  const handleSave = () => {
    if (!libraryItemId) return;

    // Parse tags (comma-separated)
    const parsedTags = tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    // Parse numeric values
    const parsedScale = defaultScale ? parseFloat(defaultScale) : undefined;
    const parsedVisionRadius = defaultVisionRadius ? parseInt(defaultVisionRadius) : undefined;

    // Validate
    if (!name.trim()) {
      showToast('Name cannot be empty', 'error');
      return;
    }

    if (parsedScale !== undefined && (parsedScale <= 0 || isNaN(parsedScale))) {
      showToast('Scale must be a positive number', 'error');
      return;
    }

    if (parsedVisionRadius !== undefined && (parsedVisionRadius < 0 || isNaN(parsedVisionRadius))) {
      showToast('Vision radius must be a non-negative number', 'error');
      return;
    }

    // Update library item
    updateLibraryToken(libraryItemId, {
      name: name.trim(),
      category: category || 'Custom',
      tags: parsedTags,
      defaultScale: parsedScale,
      defaultVisionRadius: parsedVisionRadius,
      defaultType: defaultType || undefined,
    });

    showToast(`Updated metadata for "${name.trim()}"`, 'success');
    onClose();
  };

  if (!isOpen || !libraryItem) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className={`flex flex-col overflow-hidden shadow-2xl ${
          isMobile
            ? 'w-full h-full'
            : 'max-w-2xl w-full rounded-lg'
        }`}
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--app-bg-base)',
        }}
      >
        {/* Header */}
        <div className="p-4 border-b border-neutral-700 bg-neutral-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Edit Token Metadata</h2>
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Preview */}
          <div className="flex items-center gap-4 p-4 bg-neutral-800 rounded-lg">
            <img
              src={libraryItem.thumbnailSrc.replace('file:', 'media:')}
              alt={libraryItem.name}
              className="w-20 h-20 object-cover rounded"
            />
            <div className="flex-1">
              <p className="text-white font-medium">{libraryItem.name}</p>
              <p className="text-neutral-400 text-sm">{libraryItem.category}</p>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-neutral-700 text-white px-4 py-2 rounded border border-neutral-600 focus:border-blue-500 focus:outline-none"
              placeholder="Token name"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-neutral-700 text-white px-4 py-2 rounded border border-neutral-600 focus:border-blue-500 focus:outline-none"
            >
              <option value="Monsters">Monsters</option>
              <option value="NPCs">NPCs</option>
              <option value="Props">Props</option>
              <option value="Custom">Custom</option>
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full bg-neutral-700 text-white px-4 py-2 rounded border border-neutral-600 focus:border-blue-500 focus:outline-none"
              placeholder="e.g., dragon, red, large"
            />
            <p className="text-neutral-500 text-xs mt-1">
              Used for search. Separate tags with commas.
            </p>
          </div>

          {/* Default Scale */}
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Default Scale
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={defaultScale}
              onChange={(e) => setDefaultScale(e.target.value)}
              className="w-full bg-neutral-700 text-white px-4 py-2 rounded border border-neutral-600 focus:border-blue-500 focus:outline-none"
              placeholder="1.0"
            />
            <p className="text-neutral-500 text-xs mt-1">
              Size multiplier when placed on map (e.g., 1.0 = 1 grid square, 2.0 = 2 grid squares)
            </p>
          </div>

          {/* Default Type */}
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Default Type
            </label>
            <select
              value={defaultType}
              onChange={(e) => setDefaultType(e.target.value as 'PC' | 'NPC' | '')}
              className="w-full bg-neutral-700 text-white px-4 py-2 rounded border border-neutral-600 focus:border-blue-500 focus:outline-none"
            >
              <option value="">None</option>
              <option value="PC">PC (Player Character)</option>
              <option value="NPC">NPC (Non-Player Character)</option>
            </select>
            <p className="text-neutral-500 text-xs mt-1">
              PC tokens emit vision in Fog of War
            </p>
          </div>

          {/* Default Vision Radius */}
          {defaultType === 'PC' && (
            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Default Vision Radius (feet)
              </label>
              <input
                type="number"
                step="5"
                min="0"
                value={defaultVisionRadius}
                onChange={(e) => setDefaultVisionRadius(e.target.value)}
                className="w-full bg-neutral-700 text-white px-4 py-2 rounded border border-neutral-600 focus:border-blue-500 focus:outline-none"
                placeholder="60"
              />
              <p className="text-neutral-500 text-xs mt-1">
                How far this token can see in feet (e.g., 60 for darkvision)
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-700 bg-neutral-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded text-white font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-medium"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default TokenMetadataEditor;
