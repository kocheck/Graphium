import { useState, useEffect } from 'react';
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

  // Get selected tokens
  const selectedTokens = tokens.filter((t) => selectedTokenIds.includes(t.id));

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
  }, [selectedTokenIds.join(',')]); // Dependency on comma-separated IDs

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
    <div className="token-inspector fixed bottom-4 right-4 w-80 p-4 rounded shadow-lg z-50 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {selectedTokens.length === 1
            ? (selectedTokens[0].name || 'Unnamed Token')
            : `${selectedTokens.length} Tokens Selected`}
        </h3>
        {isEditing && (
            <button
                onClick={() => setIsEditing(false)}
                className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
                ✕
            </button>
        )}
      </div>

      {!isEditing ? (
        /* Summary View */
        <div>
            {selectedTokens.length === 1 && (
                 <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                    <p>Type: {selectedTokens[0].type || 'NPC'}</p>
                    <p>Vision: {selectedTokens[0].visionRadius || 0} ft</p>
                 </div>
            )}
            <button
                onClick={() => setIsEditing(true)}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
            >
                Edit Properties
            </button>
        </div>
      ) : (
        /* Edit View (Form) */
        <div className="space-y-4">
            {/* Token Name */}
            <div>
                <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                Name
                </label>
                <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={
                    selectedTokens.length > 1 ? 'Multiple tokens' : 'Token name'
                }
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Token Type */}
            <div>
                <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                Type
                </label>
                <div className="flex gap-2">
                <button
                    onClick={() => handleTypeChange('PC')}
                    className={`flex-1 px-3 py-2 rounded font-medium transition-colors ${
                    type === 'PC'
                        ? 'bg-blue-500 text-white'
                        : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600'
                    }`}
                >
                    PC
                </button>
                <button
                    onClick={() => handleTypeChange('NPC')}
                    className={`flex-1 px-3 py-2 rounded font-medium transition-colors ${
                    type === 'NPC'
                        ? 'bg-blue-500 text-white'
                        : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600'
                    }`}
                >
                    NPC
                </button>
                </div>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Only PC tokens emit vision for Fog of War
                </p>
            </div>

            {/* Vision Radius */}
            <div>
                <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                Vision Radius (feet)
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                {[0, 30, 60, 120].map((radius) => (
                    <button
                    key={radius}
                    onClick={() => handleVisionRadiusChange(radius)}
                    className={`px-2 py-1 text-sm rounded font-medium transition-colors ${
                        visionRadius === radius
                        ? 'bg-green-500 text-white'
                        : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600'
                    }`}
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
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
            </div>

            {/* Token Info Footer */}
            {selectedTokens.length === 1 && (
                <div className="pt-3 border-t border-neutral-300 dark:border-neutral-700">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    <strong>Scale:</strong> {selectedTokens[0].scale}x
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
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
