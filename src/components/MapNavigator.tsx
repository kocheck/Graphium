import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { rollForMessage } from '../utils/systemMessages';

/**
 * MapNavigator component
 *
 * Provides UI for managing maps within the current campaign.
 * Allows switching active map, creating new maps, and deleting maps.
 */
const MapNavigator: React.FC = () => {
    const campaign = useGameStore(state => state.campaign);
    const activeMapId = useGameStore(state => state.campaign.activeMapId);
    const addMap = useGameStore(state => state.addMap);
    const switchMap = useGameStore(state => state.switchMap);
    const deleteMap = useGameStore(state => state.deleteMap);
    const renameMap = useGameStore(state => state.renameMap);
    const showConfirmDialog = useGameStore(state => state.showConfirmDialog);

    const [editingMapId, setEditingMapId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const handleStartEdit = (id: string, currentName: string) => {
        setEditingMapId(id);
        setEditName(currentName);
    };

    const handleFinishEdit = () => {
        if (!editingMapId) {
            return;
        }

        const newName = editName.trim();

        // Prevent renaming to an empty or whitespace-only name.
        if (!newName) {
            // Revert to the original name if available.
            const originalMap =
                campaign && campaign.maps ? campaign.maps[editingMapId] : undefined;
            if (originalMap) {
                setEditName(originalMap.name);
            }
            setEditingMapId(null);
            return;
        }

        renameMap(editingMapId, newName);
        setEditingMapId(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleFinishEdit();
        } else if (e.key === 'Escape') {
            setEditingMapId(null);
        }
    };

    const handleDelete = (e: React.MouseEvent, id: string, name: string) => {
        e.stopPropagation();
        showConfirmDialog(
            rollForMessage('CONFIRM_MAP_DELETE', { mapName: name }),
            () => deleteMap(id),
            'Delete'
        );
    };

    if (!campaign) return null;

    const maps = Object.values(campaign.maps).sort((a, b) =>
        a.name.localeCompare(b.name)
    );

    return (
        <div className="mb-6">
            <h2 className="text-xl font-bold mb-4 flex justify-between items-center">
                <span>Campaign</span>
                <span className="text-xs font-normal text-right max-w-[100px] truncate" title={campaign.name} style={{ color: 'var(--app-text-muted)' }}>
                    {campaign.name}
                </span>
            </h2>

            <ul className="space-y-2 mb-4" aria-label="Campaign maps">
                {maps.map(map => {
                    const isActive = map.id === activeMapId;
                    return (
                        <li
                            key={map.id}
                            className={`
                                group flex items-center justify-between p-2 rounded transition
                                ${isActive
                                    ? 'bg-[var(--app-accent-bg)] border border-[var(--app-accent-border)]'
                                    : 'bg-[var(--app-bg-subtle)]'
                                }
                            `}
                        >
                            <button
                                onClick={() => switchMap(map.id)}
                                aria-label={`${isActive ? 'Current map: ' : 'Switch to '}${map.name}`}
                                aria-current={isActive ? 'page' : undefined}
                                className="flex-1 min-w-0 flex items-center gap-2 text-left hover:opacity-80 transition"
                            >
                                <span className="text-lg leading-none">
                                    {isActive ? '📍' : '🗺️'}
                                </span>
                                {editingMapId === map.id ? (
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onBlur={handleFinishEdit}
                                        onKeyDown={handleKeyDown}
                                        className="bg-[var(--app-bg-base)] text-[var(--app-text-primary)] px-1 rounded w-full border border-[var(--app-border-default)] text-sm"
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <span
                                        className={`text-sm font-medium truncate ${isActive ? 'text-[var(--app-accent-text)]' : ''}`}
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleStartEdit(map.id, map.name);
                                        }}
                                        title={map.name}
                                    >
                                        {map.name}
                                    </span>
                                )}
                            </button>

                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartEdit(map.id, map.name);
                                    }}
                                    className="p-1 hover:text-[var(--app-accent-text)]"
                                    title="Rename"
                                    aria-label={`Rename ${map.name}`}
                                >
                                    ✏️
                                </button>
                                <button
                                    onClick={(e) => handleDelete(e, map.id, map.name)}
                                    className="p-1 hover:text-red-500"
                                    title="Delete"
                                    aria-label={`Delete ${map.name}`}
                                    disabled={maps.length <= 1}
                                >
                                    🗑️
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>

            <button
                onClick={() => {
                    const mapNumbers = maps
                        .map((m) => {
                            const match = /^Map (\d+)$/.exec(m.name);
                            return match ? parseInt(match[1], 10) : 0;
                        })
                        .filter((n) => n > 0);
                    const nextNumber = mapNumbers.length > 0
                        ? Math.max(...mapNumbers) + 1
                        : maps.length + 1;
                    addMap(`Map ${nextNumber}`);
                }}
                className="btn btn-secondary w-full py-2 text-sm flex items-center justify-center gap-2 border-dashed border-2"
            >
                <span>➕</span> New Map
            </button>
        </div>
    );
};

export default MapNavigator;
