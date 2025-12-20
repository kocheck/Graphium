import { useState, useEffect, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';

interface TokenInspectorProps {
  selectedTokenIds: string[];
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
 */
const TokenInspector = ({ selectedTokenIds }: TokenInspectorProps) => {
  const tokens = useGameStore((s) => s.tokens);
  const updateTokenProperties = useGameStore((s) => s.updateTokenProperties);

  // Get selected tokens (memoized to avoid unnecessary recalculations)
  const selectedTokens = useMemo(
    () => tokens.filter((t) => selectedTokenIds.includes(t.id)),
    [tokens, selectedTokenIds]
  );

  // Local state for editing
  const [name, setName] = useState('');
  const [type, setType] = useState<'PC' | 'NPC'>('NPC');
  const [visionRadius, setVisionRadius] = useState<number>(0);
  const [isEditing, setIsEditing] = useState(false);

  // Update local state when selection changes
  useEffect(() => {
    setIsEditing(false); // Reset to summary view on new selection
    if (selectedTokens.length === 1) {
      const token = selectedTokens[0];
      setName(token.name || '');
      setType(token.type || 'NPC');
      setVisionRadius(token.visionRadius ?? 0);
    } else if (selectedTokens.length > 1) {
      setName('');
      setType('NPC');
      setVisionRadius(0);
    }
  }, [selectedTokens]); // Only re-run when selected tokens actually change

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

  return (
    <div
      className="token-inspector fixed bottom-4 right-4 w-80 p-4 rounded shadow-lg z-50"
      style={{
        backgroundColor: 'var(--app-bg-surface)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'var(--app-border-default)',
        boxShadow: '0 10px 15px -3px var(--app-shadow-lg), 0 4px 6px -2px var(--app-shadow-md)'
      }}
    >
      <div className="flex justify-between items-center mb-3">
        <h3
          className="text-lg font-semibold"
          style={{ color: 'var(--app-text-primary)' }}
        >
          {selectedTokens.length === 1
            ? (selectedTokens[0].name || 'Unnamed Token')
            : `${selectedTokens.length} Tokens Selected`}
        </h3>
        {isEditing && (
            <button
                onClick={() => setIsEditing(false)}
                style={{ color: 'var(--app-text-muted)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--app-text-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--app-text-muted)'}
            >
                ✕
            </button>
        )}
      </div>

      {!isEditing ? (
        /* Summary View */
        <div>
            {selectedTokens.length === 1 && (
                 <div className="text-sm mb-4" style={{ color: 'var(--app-text-secondary)' }}>
                    <p>Type: {selectedTokens[0].type || 'NPC'}</p>
                    <p>Vision: {selectedTokens[0].visionRadius || 0} ft</p>
                 </div>
            )}
            <button
                onClick={() => setIsEditing(true)}
                className="w-full py-2 rounded font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--app-accent-solid)',
                  color: 'var(--app-accent-solid-text)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--app-accent-solid-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--app-accent-solid)'}
            >
                Edit Properties
            </button>
        </div>
      ) : (
        /* Edit View (Form) */
        <div className="space-y-4">
            {/* Token Name */}
            <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--app-text-secondary)' }}>
                Name
                </label>
                <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={
                    selectedTokens.length > 1 ? 'Multiple tokens' : 'Token name'
                }
                className="w-full px-3 py-2 rounded focus:outline-none focus:ring-2"
                style={{
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'var(--app-border-default)',
                  backgroundColor: 'var(--app-bg-base)',
                  color: 'var(--app-text-primary)',
                  outlineColor: 'var(--app-accent-solid)'
                }}
                />
            </div>

            {/* Token Type */}
            <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--app-text-secondary)' }}>
                Type
                </label>
                <div className="flex gap-2">
                <button
                    onClick={() => handleTypeChange('PC')}
                    className="flex-1 px-3 py-2 rounded font-medium transition-colors"
                    style={{
                      backgroundColor: type === 'PC' ? 'var(--app-accent-solid)' : 'var(--app-bg-hover)',
                      color: type === 'PC' ? 'var(--app-accent-solid-text)' : 'var(--app-text-primary)'
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
                    className="flex-1 px-3 py-2 rounded font-medium transition-colors"
                    style={{
                      backgroundColor: type === 'NPC' ? 'var(--app-accent-solid)' : 'var(--app-bg-hover)',
                      color: type === 'NPC' ? 'var(--app-accent-solid-text)' : 'var(--app-text-primary)'
                    }}
                    onMouseEnter={(e) => {
                      if (type !== 'NPC') e.currentTarget.style.backgroundColor = 'var(--app-bg-active)';
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
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--app-text-secondary)' }}>
                Vision Radius (feet)
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                {[0, 30, 60, 120].map((radius) => (
                    <button
                    key={radius}
                    onClick={() => handleVisionRadiusChange(radius)}
                    className="px-2 py-1 text-sm rounded font-medium transition-colors"
                    style={{
                      backgroundColor: visionRadius === radius ? 'var(--app-success-solid)' : 'var(--app-bg-hover)',
                      color: visionRadius === radius ? 'white' : 'var(--app-text-primary)'
                    }}
                    onMouseEnter={(e) => {
                      if (visionRadius !== radius) e.currentTarget.style.backgroundColor = 'var(--app-bg-active)';
                    }}
                    onMouseLeave={(e) => {
                      if (visionRadius !== radius) e.currentTarget.style.backgroundColor = 'var(--app-bg-hover)';
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
                  outlineColor: 'var(--app-success-solid)'
                }}
                />
            </div>

            {/* Token Info Footer */}
            {selectedTokens.length === 1 && (
                <div
                  className="pt-3"
                  style={{
                    borderTopWidth: '1px',
                    borderTopStyle: 'solid',
                    borderTopColor: 'var(--app-border-subtle)'
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
};

export default TokenInspector;
