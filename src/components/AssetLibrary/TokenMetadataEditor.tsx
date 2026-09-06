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
 * **Features:**
 * - Form validation (required name, positive scale, non-negative vision radius)
 * - Tag parsing (comma-separated, auto-trimmed, empty tags filtered)
 * - Conditional fields (vision radius only shown for PC tokens)
 * - Toast notifications for success/errors
 * - Mobile-responsive layout
 *
 * **Used by:**
 * - LibraryManager (edit button on token cards)
 * - CommandPalette (edit action in search results)
 *
 * @example
 * ```tsx
 * <TokenMetadataEditor
 *   isOpen={isEditing}
 *   libraryItemId={selectedTokenId}
 *   onClose={() => setIsEditing(false)}
 * />
 * ```
 */

import type React from 'react';
import { useState, useEffect } from 'react';

import { RiCloseLine } from '@remixicon/react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import { useIsMobile } from '../../hooks/useMediaQuery';
import { getStorage } from '../../services/storage';
import { useGameStore } from '../../store/gameStore';
import { toMediaProtocol } from '../../utils/mediaProtocol';
import { rollForMessage } from '../../utils/systemMessages';

/**
 * Props for TokenMetadataEditor component
 *
 * @property {boolean} isOpen - Controls modal visibility
 * @property {string | null} libraryItemId - ID of library item to edit (null = modal hidden)
 * @property {() => void} onClose - Callback when modal should close
 */
interface TokenMetadataEditorProps {
  /** Controls modal visibility */
  isOpen: boolean;
  /** ID of library item to edit (null = modal hidden) */
  libraryItemId: string | null;
  /** Callback when modal should close */
  onClose: () => void;
}

// eslint-disable-next-line max-lines-per-function
function TokenMetadataEditor({
  isOpen,
  libraryItemId,
  onClose,
}: TokenMetadataEditorProps): React.ReactElement | null {
  const isMobile = useIsMobile();

  // Get library item and update function from store
  const tokenLibrary = useGameStore((state) => state.campaign.tokenLibrary);
  const updateLibraryToken = useGameStore((state) => state.updateLibraryToken);
  const showToast = useGameStore((state) => state.showToast);

  // Find the library item
  const libraryItem = libraryItemId ? tokenLibrary.find((item) => item.id === libraryItemId) : null;

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
      setDefaultScale(libraryItem.defaultScale?.toString() ?? '');
      setDefaultVisionRadius(libraryItem.defaultVisionRadius?.toString() ?? '');
      setDefaultType(libraryItem.defaultType ?? '');
    }
  }, [libraryItem]);

  const handleSave = (): void => {
    if (!libraryItemId) {
      return;
    }

    // Parse tags (comma-separated)
    const parsedTags = tags
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    // Parse numeric values
    const parsedScale = defaultScale ? parseFloat(defaultScale) : undefined;
    const parsedVisionRadius = defaultVisionRadius ? parseInt(defaultVisionRadius) : undefined;

    // Validate
    if (!name.trim()) {
      showToast('Name cannot be empty', 'error');
      return;
    }

    if (parsedScale !== undefined && (isNaN(parsedScale) || parsedScale <= 0)) {
      showToast('Scale must be a positive number', 'error');
      return;
    }

    if (parsedVisionRadius !== undefined && (isNaN(parsedVisionRadius) || parsedVisionRadius < 0)) {
      showToast('Vision radius must be a non-negative number', 'error');
      return;
    }

    // Update library item
    const updates = {
      name: name.trim(),
      category: category || 'Custom',
      tags: parsedTags,
      defaultScale: parsedScale,
      defaultVisionRadius: parsedVisionRadius,
      defaultType: defaultType || undefined,
    };

    // Optimistic update in store
    updateLibraryToken(libraryItemId, updates);

    // Persist to storage
    try {
      getStorage()
        .updateLibraryMetadata(libraryItemId, updates)
        .catch((err) => {
          console.error('[TokenMetadataEditor] Failed to persist updates:', err);
          showToast(rollForMessage('LIBRARY_UPDATE_FAILED'), 'error');
        });
    } catch (err) {
      console.error('[TokenMetadataEditor] Storage error:', err);
    }

    showToast(`Updated metadata for "${name.trim()}"`, 'success');
    onClose();
  };

  if (!isOpen || !libraryItem) {
    return null;
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent
        className={
          isMobile
            ? 'w-full h-full max-w-none rounded-none p-0 flex flex-col'
            : 'max-w-2xl w-full rounded-lg p-0 flex flex-col'
        }
        data-testid="dialog-token-metadata-root"
        showCloseButton={false}
      >
        {/* Header */}
        <div className="p-4 border-b border-[var(--app-border-default)] bg-[var(--app-bg-surface)]">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold text-[var(--app-text-primary)]">
              Edit Token Metadata
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <RiCloseLine className="size-6" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Preview */}
          <div className="flex items-center gap-4 p-4 bg-[var(--app-bg-surface)] rounded-lg">
            <img
              src={toMediaProtocol(libraryItem.thumbnailSrc)}
              alt={libraryItem.name}
              className="w-20 h-20 object-cover rounded-sm"
            />
            <div className="flex-1">
              <p className="text-[var(--app-text-primary)] font-medium">{libraryItem.name}</p>
              <p className="text-[var(--app-text-secondary)] text-sm">{libraryItem.category}</p>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-[var(--app-text-primary)] text-sm font-medium mb-2">
              Name *
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[var(--app-bg-active)] text-[var(--app-text-primary)] px-4 py-2 rounded-sm border border-[var(--app-border-default)] focus:border-[var(--app-accent-solid)] focus:outline-none"
              placeholder="Token name"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-[var(--app-text-primary)] text-sm font-medium mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-[var(--app-bg-active)] text-[var(--app-text-primary)] px-4 py-2 rounded-sm border border-[var(--app-border-default)] focus:border-[var(--app-accent-solid)] focus:outline-none"
            >
              <option value="PC">PC (Player Character)</option>
              <option value="Monsters">Monsters</option>
              <option value="NPCs">NPCs</option>
              <option value="Props">Props</option>
              <option value="Custom">Custom</option>
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[var(--app-text-primary)] text-sm font-medium mb-2">
              Tags (comma-separated)
            </label>
            <Input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full bg-[var(--app-bg-active)] text-[var(--app-text-primary)] px-4 py-2 rounded-sm border border-[var(--app-border-default)] focus:border-[var(--app-accent-solid)] focus:outline-none"
              placeholder="e.g., dragon, red, large"
            />
            <p className="text-[var(--app-text-muted)] text-xs mt-1">
              Used for search. Separate tags with commas.
            </p>
          </div>

          {/* Default Scale */}
          <div>
            <label className="block text-[var(--app-text-primary)] text-sm font-medium mb-2">
              Default Scale
            </label>
            <Input
              type="number"
              step="0.1"
              min="0.1"
              value={defaultScale}
              onChange={(e) => setDefaultScale(e.target.value)}
              className="w-full bg-[var(--app-bg-active)] text-[var(--app-text-primary)] px-4 py-2 rounded-sm border border-[var(--app-border-default)] focus:border-[var(--app-accent-solid)] focus:outline-none"
              placeholder="1.0"
            />
            <p className="text-[var(--app-text-muted)] text-xs mt-1">
              Size multiplier when placed on map (e.g., 1.0 = 1 grid square, 2.0 = 2 grid squares)
            </p>
          </div>

          {/* Default Type */}
          <div>
            <label className="block text-[var(--app-text-primary)] text-sm font-medium mb-2">
              Default Type
            </label>
            <select
              value={defaultType}
              onChange={(e) => setDefaultType(e.target.value as 'PC' | 'NPC' | '')}
              className="w-full bg-[var(--app-bg-active)] text-[var(--app-text-primary)] px-4 py-2 rounded-sm border border-[var(--app-border-default)] focus:border-[var(--app-accent-solid)] focus:outline-none"
            >
              <option value="">None</option>
              <option value="PC">PC (Player Character)</option>
              <option value="NPC">NPC (Non-Player Character)</option>
            </select>
            <p className="text-[var(--app-text-muted)] text-xs mt-1">
              PC tokens emit vision in Fog of War
            </p>
          </div>

          {/* Default Vision Radius */}
          {defaultType === 'PC' && (
            <div>
              <label className="block text-[var(--app-text-primary)] text-sm font-medium mb-2">
                Default Vision Radius (feet)
              </label>
              <Input
                type="number"
                step="5"
                min="0"
                value={defaultVisionRadius}
                onChange={(e) => setDefaultVisionRadius(e.target.value)}
                className="w-full bg-[var(--app-bg-active)] text-[var(--app-text-primary)] px-4 py-2 rounded-sm border border-[var(--app-border-default)] focus:border-[var(--app-accent-solid)] focus:outline-none"
                placeholder="60"
              />
              <p className="text-[var(--app-text-muted)] text-xs mt-1">
                How far this token can see in feet (e.g., 60 for darkvision)
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--app-border-default)] bg-[var(--app-bg-surface)] flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="default" onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TokenMetadataEditor;
