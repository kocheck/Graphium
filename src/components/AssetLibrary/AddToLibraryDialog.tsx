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

import type React from 'react';
import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import { useIsMobile } from '../../hooks/useMediaQuery';
import { getStorage } from '../../services/storage';
import { useGameStore } from '../../store/gameStore';
import { toMediaProtocol } from '../../utils/mediaProtocol';
import { rollForMessage } from '../../utils/systemMessages';

interface AddToLibraryDialogProps {
  isOpen: boolean;
  imageSrc: string | null; // file:// URL from temp storage
  imageBlob: Blob | null; // Original processed blob
  suggestedName?: string;
  onClose: () => void;
  onConfirm: () => void;
}

const DEFAULT_CATEGORIES = ['PC', 'Monsters', 'NPCs', 'Props', 'Items', 'Custom'];

// eslint-disable-next-line max-lines-per-function
function AddToLibraryDialog({
  isOpen,
  imageSrc,
  imageBlob,
  suggestedName,
  onClose,
  onConfirm,
}: AddToLibraryDialogProps): React.ReactElement {
  const [name, setName] = useState(suggestedName ?? '');
  const [category, setCategory] = useState('Monsters');
  const [tagsInput, setTagsInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Mobile responsiveness
  const isMobile = useIsMobile();

  const addTokenToLibrary = useGameStore((state) => state.addTokenToLibrary);
  const showToast = useGameStore((state) => state.showToast);

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
          0.85,
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
  const handleSave = async (): Promise<void> => {
    if (!name.trim()) {
      showToast(rollForMessage('LIBRARY_NAME_REQUIRED'), 'error');
      return;
    }

    if (!imageBlob || !imageSrc) {
      showToast(rollForMessage('LIBRARY_IMAGE_DATA_MISSING'), 'error');
      return;
    }

    setIsLoading(true);

    try {
      // Generate thumbnail
      const thumbnailBlob = await generateThumbnail(imageBlob);

      // Parse tags (comma or space separated)
      const tags = tagsInput
        .split(/[,\s]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      // Convert blobs to ArrayBuffers
      const fullSizeBuffer = await imageBlob.arrayBuffer();
      const thumbnailBuffer = await thumbnailBlob.arrayBuffer();

      // Generate UUID for asset
      const id = crypto.randomUUID();

      // Save to library via storage service
      const storage = getStorage();
      const savedItem = await storage.saveAssetToLibrary(fullSizeBuffer, thumbnailBuffer, {
        id,
        name: name.trim(),
        category,
        tags,
      });

      // Add to store
      addTokenToLibrary(savedItem);

      showToast(rollForMessage('ASSET_ADDED_TO_LIBRARY_SUCCESS'), 'success');
      onConfirm();
      handleClose();
    } catch (error) {
      console.error('[AddToLibraryDialog] Failed to save to library:', error);
      showToast(rollForMessage('LIBRARY_SAVE_FAILED'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Reset form and close
   */
  const handleClose = (): void => {
    setName(suggestedName ?? '');
    setCategory('Monsters');
    setTagsInput('');
    setIsLoading(false);
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <DialogContent
        className={isMobile ? 'h-full max-w-none rounded-none' : 'max-w-md rounded-lg'}
        data-testid="dialog-add-to-library-root"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>Add to Library</DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-4">
          {imageSrc && (
            <div className="flex justify-center">
              <img
                src={toMediaProtocol(imageSrc)}
                alt="Preview"
                className="w-32 h-32 object-cover rounded-sm bg-[var(--app-bg-subtle)]"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="asset-name"
              className="block text-sm font-medium text-[var(--app-text-secondary)] mb-1"
            >
              Name *
            </label>
            <Input
              id="asset-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Red Dragon"
              className="w-full px-3 py-2 rounded-sm bg-[var(--app-bg-active)] text-[var(--app-text-primary)] border border-[var(--app-border-default)]"
              disabled={isLoading}
            />
          </div>

          <div>
            <label
              htmlFor="asset-category"
              className="block text-sm font-medium text-[var(--app-text-secondary)] mb-1"
            >
              Category
            </label>
            <select
              id="asset-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-sm bg-[var(--app-bg-active)] text-[var(--app-text-primary)] border border-[var(--app-border-default)]"
              disabled={isLoading}
            >
              {DEFAULT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="asset-tags"
              className="block text-sm font-medium text-[var(--app-text-secondary)] mb-1"
            >
              Tags (optional)
            </label>
            <Input
              id="asset-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g., dragon, red, large"
              className="w-full px-3 py-2 rounded-sm bg-[var(--app-bg-active)] text-[var(--app-text-primary)] border border-[var(--app-border-default)]"
              disabled={isLoading}
            />
            <p className="text-xs text-[var(--app-text-muted)] mt-1">
              Separate tags with commas or spaces
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-[var(--app-border-default)] flex justify-end gap-2">
          <Button variant="secondary" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={() => {
              void handleSave();
            }}
            disabled={isLoading || !name.trim()}
          >
            {isLoading ? 'Saving...' : 'Add to Library'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddToLibraryDialog;
