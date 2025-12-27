/**
 * Add to Library Dialog Component
 *
 * Modal dialog for adding a token to the persistent library.
 * Prompts user for metadata (name, category, tags) before saving.
 *
 * **Workflow:**
 * 1. User uploads image via Sidebar or drags to canvas
 * 2. Image is processed (cropped, optimized to WebP)
 * 3. This dialog opens with preview
 * 4. User enters name, category, tags
 * 5. Generate thumbnail (128x128)
 * 6. Save to library via IPC (SAVE_ASSET_TO_LIBRARY)
 * 7. Add to store (addTokenToLibrary)
 * 8. Show success toast
 *
 * @component
 */

import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';

interface AddToLibraryDialogProps {
  isOpen: boolean;
  imageSrc: string | null; // file:// URL from temp storage
  imageBlob: Blob | null; // Original processed blob
  suggestedName?: string;
  onClose: () => void;
  onConfirm: () => void;
}

const DEFAULT_CATEGORIES = ['Monsters', 'NPCs', 'Props', 'Items', 'Custom'];

const AddToLibraryDialog = ({
  isOpen,
  imageSrc,
  imageBlob,
  suggestedName,
  onClose,
  onConfirm,
}: AddToLibraryDialogProps) => {
  const [name, setName] = useState(suggestedName || '');
  const [category, setCategory] = useState('Monsters');
  const [tagsInput, setTagsInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const addTokenToLibrary = useGameStore(state => state.addTokenToLibrary);
  const showToast = useGameStore(state => state.showToast);

  // Update name when suggestedName changes
  useEffect(() => {
    if (suggestedName) {
      setName(suggestedName);
    }
  }, [suggestedName]);

  /**
   * Generate thumbnail from image blob
   * Resizes to 128x128 and converts to WebP
   */
  const generateThumbnail = async (blob: Blob): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Draw image scaled to 128x128
        ctx.drawImage(img, 0, 0, 128, 128);

        canvas.toBlob(
          (thumbnailBlob) => {
            URL.revokeObjectURL(url);
            if (thumbnailBlob) {
              resolve(thumbnailBlob);
            } else {
              reject(new Error('Failed to generate thumbnail'));
            }
          },
          'image/webp',
          0.85
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  };

  /**
   * Handle save to library
   * Generates thumbnail, saves via IPC, updates store
   */
  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Please enter a name', 'error');
      return;
    }

    if (!imageBlob || !imageSrc) {
      showToast('No image data available', 'error');
      return;
    }

    setIsLoading(true);

    try {
      // Generate thumbnail
      const thumbnailBlob = await generateThumbnail(imageBlob);

      // Parse tags (comma or space separated)
      const tags = tagsInput
        .split(/[,\s]+/)
        .map(t => t.trim())
        .filter(t => t.length > 0);

      // Convert blobs to ArrayBuffers
      const fullSizeBuffer = await imageBlob.arrayBuffer();
      const thumbnailBuffer = await thumbnailBlob.arrayBuffer();

      // Generate UUID for asset
      const id = crypto.randomUUID();

      // Save to library via IPC
      const savedItem = await window.ipcRenderer.invoke('SAVE_ASSET_TO_LIBRARY', {
        fullSizeBuffer,
        thumbnailBuffer,
        metadata: {
          id,
          name: name.trim(),
          category,
          tags,
        },
      });

      // Add to store
      addTokenToLibrary(savedItem);

      showToast('Added to library successfully', 'success');
      onConfirm();
      handleClose();
    } catch (error) {
      console.error('[AddToLibraryDialog] Failed to save to library:', error);
      showToast('Failed to save to library', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Reset form and close
   */
  const handleClose = () => {
    setName(suggestedName || '');
    setCategory('Monsters');
    setTagsInput('');
    setIsLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
    >
      <div 
        className="bg-neutral-900 rounded-lg w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-neutral-700">
          <h2 className="text-lg font-bold text-white">Add to Library</h2>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Preview */}
          {imageSrc && (
            <div className="flex justify-center">
              <img
                src={imageSrc.replace('file:', 'media:')}
                alt="Preview"
                className="w-32 h-32 object-cover rounded bg-neutral-800"
              />
            </div>
          )}

          {/* Name */}
          <div>
            <label htmlFor="asset-name" className="block text-sm font-medium text-neutral-300 mb-1">
              Name *
            </label>
            <input
              id="asset-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Red Dragon"
              className="w-full bg-neutral-800 text-white px-3 py-2 rounded border border-neutral-600 focus:border-blue-500 focus:outline-none"
              disabled={isLoading}
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="asset-category" className="block text-sm font-medium text-neutral-300 mb-1">
              Category
            </label>
            <select
              id="asset-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-neutral-800 text-white px-3 py-2 rounded border border-neutral-600 focus:border-blue-500 focus:outline-none"
              disabled={isLoading}
            >
              {DEFAULT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="asset-tags" className="block text-sm font-medium text-neutral-300 mb-1">
              Tags (optional)
            </label>
            <input
              id="asset-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g., dragon, red, large"
              className="w-full bg-neutral-800 text-white px-3 py-2 rounded border border-neutral-600 focus:border-blue-500 focus:outline-none"
              disabled={isLoading}
            />
            <p className="text-xs text-neutral-500 mt-1">Separate tags with commas or spaces</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-700 flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded text-white font-medium"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading || !name.trim()}
          >
            {isLoading ? 'Saving...' : 'Add to Library'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddToLibraryDialog;
