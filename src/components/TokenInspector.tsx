import { useState, useEffect, useMemo } from 'react';
import { useGameStore, Token } from '../store/gameStore';
import { useIsMobile } from '../hooks/useMediaQuery';
import MobileBottomSheet from './MobileBottomSheet';
import { RiSaveLine } from '@remixicon/react';
import { getStorage } from '../services/storage';

interface TokenInspectorProps {
  selectedTokenIds: string[];
  onClose?: () => void;
}

/**
 * TokenInspector provides a UI panel for editing token properties
 *
 * Displays when one or more tokens are selected in the Architect View (DM).
 * Allows editing:
 * - Token name (display label)
 * - Token type (PC vs NPC - only PCs emit vision)
 * - Vision radius (in feet, for Fog of War calculations)
 *
 * **Multi-selection behavior:**
 * - If multiple tokens selected, shows "Multiple tokens selected"
 * - Edits apply to ALL selected tokens simultaneously
 *
 * **Vision radius presets:**
 * - 0 ft: No vision (blind)
 * - 30 ft: Dim light / limited darkvision
 * - 60 ft: Standard darkvision
 * - 120 ft: Superior darkvision
 * - Custom: Manual input
 *
 * @param selectedTokenIds - Array of token IDs currently selected
 * @param onClose - Optional callback to deselect tokens (used on mobile)
 */
const TokenInspector = ({ selectedTokenIds, onClose }: TokenInspectorProps) => {
  const tokens = useGameStore((s) => s.tokens);
  const tokenLibrary = useGameStore((s) => s.campaign.tokenLibrary);
  const updateTokenProperties = useGameStore((s) => s.updateTokenProperties);
  const updateLibraryToken = useGameStore((s) => s.updateLibraryToken);
  const showToast = useGameStore((s) => s.showToast);

  // Mobile responsiveness
  const isMobile = useIsMobile();

  // Get selected tokens (memoized to avoid unnecessary recalculations)
  const selectedTokens = useMemo(
    () => tokens.filter((t) => selectedTokenIds.includes(t.id)),
    [tokens, selectedTokenIds],
  );

  // Helper to resolve effective properties (instance > library > default)
  const getEffectiveValues = (token: Token) => {
    const libraryItem = token.libraryItemId
      ? tokenLibrary.find((i) => i.id === token.libraryItemId)
      : undefined;

    // Determine effective type:
    // 1. Instance override
    // 2. Library defaultType
    // 3. Library category == 'PC' -> 'PC'
    // 4. Default 'NPC'
    let effectiveType: 'PC' | 'NPC' = 'NPC';
    if (token.type) {
      effectiveType = token.type;
    } else if (libraryItem?.defaultType) {
      effectiveType = libraryItem.defaultType;
    } else if (libraryItem?.category === 'PC') {
      effectiveType = 'PC';
    }

    // Determine effective name
    const effectiveName = token.name || libraryItem?.name || '';

    // Determine effective vision radius
    const effectiveVisionRadius = token.visionRadius ?? libraryItem?.defaultVisionRadius ?? 0;

    return {
      name: effectiveName,
      type: effectiveType,
      visionRadius: effectiveVisionRadius,
      libraryItem, // Return the linked library item if it exists
    };
  };

  // Local state for editing
  const [name, setName] = useState('');
  const [type, setType] = useState<'PC' | 'NPC'>('NPC');
  const [visionRadius, setVisionRadius] = useState<number>(0);
  const [isEditing, setIsEditing] = useState(false);

  // Track the previous selection IDs to detect actual selection changes
  // This prevents the inspector from resetting/closing when we edit properties
  // (which causes selectedTokens to update, but the IDs remain the same)
  const selectedIdsString = selectedTokenIds.sort().join(',');

  // Update local state and mode when SELECTION changes
  useEffect(() => {
    setIsEditing(false); // Reset to summary view on NEW selection

    if (selectedTokens.length === 1) {
      const { name, type, visionRadius } = getEffectiveValues(selectedTokens[0]);
      setName(name);
      setType(type);
      setVisionRadius(visionRadius);
    } else if (selectedTokens.length > 1) {
      setName('');
      setType('NPC');
      setVisionRadius(0);
    }
  }, [selectedIdsString]); // Depends on IDs, not the token objects themselves

  // Update local input values if the underlying token data changes EXTERNALLY
  // (e.g. undo/redo) but NOT while we are actively editing?
  // Actually, we want the inputs to reflect the current state if we are just viewing.
  // But if we are editing, we probably want to keep our local state until we blur/commit?
  // For now, let's keep it simple: The inputs drive the store immediately, so they should stay in sync.
  // If we rely on the store updates to feed back into the inputs, we might get cursor jumps.
  // But our handle* functions update local state AND store.

  if (selectedTokens.length === 0) {
    return null;
  }

  const handleNameChange = (newName: string) => {
    setName(newName);
    selectedTokenIds.forEach((id) => {
      updateTokenProperties(id, { name: newName });
    });
  };

  const handleTypeChange = (newType: 'PC' | 'NPC') => {
    setType(newType);
    selectedTokenIds.forEach((id) => {
      updateTokenProperties(id, { type: newType });
    });
  };

  const handleVisionRadiusChange = (radius: number) => {
    setVisionRadius(radius);
    selectedTokenIds.forEach((id) => {
      updateTokenProperties(id, { visionRadius: radius });
    });
  };

  const handleSaveToLibrary = async () => {
    if (selectedTokens.length !== 1) return;
    const token = selectedTokens[0];
    if (!token.libraryItemId) return;

    const libraryItem = tokenLibrary.find((i) => i.id === token.libraryItemId);
    if (!libraryItem) return;

    const updates = {
      name: name || libraryItem.name, // Use library name if empty
      category: libraryItem.category,
      tags: libraryItem.tags,
      defaultType: type,
      defaultVisionRadius: visionRadius,
    };

    try {
      // 1. Update persistent storage (writes to index.json or IndexedDB)
      await getStorage().updateLibraryMetadata(token.libraryItemId, updates);

      // 2. Update in-memory store (updates UI immediately)
      updateLibraryToken(token.libraryItemId, updates);

      showToast(`Updated "${libraryItem.name}" in library`, 'success');
    } catch (error) {
      console.error('[TokenInspector] Failed to update library:', error);
      showToast('Failed to save to library', 'error');
    }
  };

  // Inspector content (same for mobile and desktop)
  const inspectorContent = (
    <div className={isMobile ? 'w-full' : 'p-4'}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--app-text-primary)' }}>
          {selectedTokens.length === 1
            ? getEffectiveValues(selectedTokens[0]).name || 'Unnamed Token'
            : `${selectedTokens.length} Tokens Selected`}
        </h3>
        {isEditing && (
          <button
            onClick={() => setIsEditing(false)}
            style={{ color: 'var(--app-text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--app-text-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--app-text-muted)')}
          >
            ✕
          </button>
        )}
      </div>

      {!isEditing ? (
        /* Summary View */
        <div>
          {selectedTokens.length === 1 &&
            (() => {
              const { type, visionRadius } = getEffectiveValues(selectedTokens[0]);
              return (
                <div className="text-sm mb-4" style={{ color: 'var(--app-text-secondary)' }}>
                  <p>Type: {type}</p>
                  <p>Vision: {visionRadius} ft</p>
                </div>
              );
            })()}
          <button
            onClick={() => setIsEditing(true)}
            className="w-full py-3 rounded font-medium transition-colors min-h-[44px]"
            style={{
              backgroundColor: 'var(--app-accent-solid)',
              color: 'var(--app-accent-solid-text)',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = 'var(--app-accent-solid-hover)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = 'var(--app-accent-solid)')
            }
          >
            Edit Properties
          </button>
        </div>
      ) : (
        /* Edit View (Form) */
        <div className="space-y-4">
          {/* Token Name */}
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--app-text-secondary)' }}
            >
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={selectedTokens.length > 1 ? 'Multiple tokens' : 'Token name'}
              className="w-full px-3 py-2 rounded focus:outline-none focus:ring-2"
              style={{
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'var(--app-border-default)',
                backgroundColor: 'var(--app-bg-base)',
                color: 'var(--app-text-primary)',
                outlineColor: 'var(--app-accent-solid)',
              }}
            />
          </div>

          {/* Token Type */}
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--app-text-secondary)' }}
            >
              Type
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => handleTypeChange('PC')}
                className="flex-1 px-3 py-3 rounded font-medium transition-colors min-h-[44px]"
                style={{
                  backgroundColor:
                    type === 'PC' ? 'var(--app-accent-solid)' : 'var(--app-bg-hover)',
                  color: type === 'PC' ? 'var(--app-accent-solid-text)' : 'var(--app-text-primary)',
                }}
                onMouseEnter={(e) => {
                  if (type !== 'PC') e.currentTarget.style.backgroundColor = 'var(--app-bg-active)';
                }}
                onMouseLeave={(e) => {
                  if (type !== 'PC') e.currentTarget.style.backgroundColor = 'var(--app-bg-hover)';
                }}
              >
                PC
              </button>
              <button
                onClick={() => handleTypeChange('NPC')}
                className="flex-1 px-3 py-3 rounded font-medium transition-colors min-h-[44px]"
                style={{
                  backgroundColor:
                    type === 'NPC' ? 'var(--app-accent-solid)' : 'var(--app-bg-hover)',
                  color:
                    type === 'NPC' ? 'var(--app-accent-solid-text)' : 'var(--app-text-primary)',
                }}
                onMouseEnter={(e) => {
                  if (type !== 'NPC')
                    e.currentTarget.style.backgroundColor = 'var(--app-bg-active)';
                }}
                onMouseLeave={(e) => {
                  if (type !== 'NPC') e.currentTarget.style.backgroundColor = 'var(--app-bg-hover)';
                }}
              >
                NPC
              </button>
            </div>
            <p className="mt-1 text-xs" style={{ color: 'var(--app-text-muted)' }}>
              Only PC tokens emit vision for Fog of War
            </p>
          </div>

          {/* Vision Radius */}
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--app-text-secondary)' }}
            >
              Vision Radius (feet)
            </label>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[0, 30, 60, 120].map((radius) => (
                <button
                  key={radius}
                  onClick={() => handleVisionRadiusChange(radius)}
                  className="px-2 text-sm rounded font-medium transition-colors min-h-[44px]"
                  style={{
                    backgroundColor:
                      visionRadius === radius ? 'var(--app-success-solid)' : 'var(--app-bg-hover)',
                    color: visionRadius === radius ? 'white' : 'var(--app-text-primary)',
                  }}
                  onMouseEnter={(e) => {
                    if (visionRadius !== radius)
                      e.currentTarget.style.backgroundColor = 'var(--app-bg-active)';
                  }}
                  onMouseLeave={(e) => {
                    if (visionRadius !== radius)
                      e.currentTarget.style.backgroundColor = 'var(--app-bg-hover)';
                  }}
                >
                  {radius}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={visionRadius}
              onChange={(e) => handleVisionRadiusChange(Number(e.target.value))}
              min="0"
              max="300"
              step="5"
              className="w-full px-3 py-2 rounded focus:outline-none focus:ring-2"
              style={{
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'var(--app-border-default)',
                backgroundColor: 'var(--app-bg-base)',
                color: 'var(--app-text-primary)',
                outlineColor: 'var(--app-success-solid)',
              }}
            />
          </div>

          {/* Save to Library Button */}
          {selectedTokens.length === 1 && selectedTokens[0].libraryItemId && (
            <div className="pt-2">
              <button
                onClick={handleSaveToLibrary}
                className="w-full py-2 px-4 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors border"
                style={{
                  borderColor: 'var(--app-border-default)',
                  color: 'var(--app-text-secondary)',
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--app-bg-hover)';
                  e.currentTarget.style.color = 'var(--app-text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--app-text-secondary)';
                }}
              >
                <RiSaveLine className="w-4 h-4" />
                Save Defaults to Library
              </button>
              <p className="text-xs mt-1 text-center" style={{ color: 'var(--app-text-muted)' }}>
                Updates the library item and all other tokens that use its defaults.
              </p>
            </div>
          )}

          {/* Token Info Footer */}
          {selectedTokens.length === 1 && (
            <div
              className="pt-3"
              style={{
                borderTopWidth: '1px',
                borderTopStyle: 'solid',
                borderTopColor: 'var(--app-border-subtle)',
              }}
            >
              <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                <strong>Scale:</strong> {selectedTokens[0].scale}x
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--app-text-muted)' }}>
                <strong>Position:</strong> ({Math.round(selectedTokens[0].x)},{' '}
                {Math.round(selectedTokens[0].y)})
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Render: Mobile bottom sheet or desktop fixed panel
  if (isMobile) {
    return (
      <MobileBottomSheet isOpen={true} onClose={() => onClose?.()}>
        {inspectorContent}
      </MobileBottomSheet>
    );
  }

  // Desktop: Fixed bottom-right panel
  return (
    <div
      className="token-inspector fixed bottom-4 right-4 w-80 rounded shadow-lg z-50"
      style={{
        backgroundColor: 'var(--app-bg-surface)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'var(--app-border-default)',
        boxShadow: '0 10px 15px -3px var(--app-shadow-lg), 0 4px 6px -2px var(--app-shadow-md)',
      }}
    >
      {inspectorContent}
    </div>
  );
};

export default TokenInspector;
