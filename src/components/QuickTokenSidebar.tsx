/**
 * QuickTokenSidebar Component
 *
 * Provides quick access to frequently used tokens for the DM:
 * - Recent History: Last 3 unique tokens placed on the map
 * - Party Tokens: Generic placeholder + up to 5 PC tokens (deduplicated)
 *
 * Features:
 * - Drag-and-drop support for all tokens
 * - Generic token placeholder for quick blank token placement
 * - Automatic deduplication (player tokens won't show if in recent history)
 * - Tooltip labels for all tokens
 *
 * @component
 */

import React from 'react';
import Tooltip from './Tooltip';
import { RiUser3Line } from '@remixicon/react';
import { TokenLibraryItem } from '../store/gameStore';

interface QuickTokenSidebarProps {
    recentTokens: TokenLibraryItem[];
    playerTokens: TokenLibraryItem[];
    onDragStart: (e: React.DragEvent, type: string, src: string, libraryItemId?: string) => void;
}

/**
 * QuickTokenSidebar displays recent and party tokens for quick DM access
 */
const QuickTokenSidebar: React.FC<QuickTokenSidebarProps> = ({
    recentTokens,
    playerTokens,
    onDragStart,
}) => {
    /**
     * Handles drag start for the generic token placeholder
     * Creates a special payload with a placeholder type
     */
    const handleGenericTokenDragStart = (e: React.DragEvent) => {
        // Create a generic token payload with a placeholder identifier
        const genericTokenData = {
            type: 'GENERIC_TOKEN',
            src: '', // No source image
        };

        e.dataTransfer.setData('application/json', JSON.stringify(genericTokenData));

        // Create a simple drag image (gray circle with icon)
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.top = '-1000px';
        div.style.left = '-1000px';
        div.style.width = '64px';
        div.style.height = '64px';
        div.style.borderRadius = '8px';
        div.style.backgroundColor = 'var(--app-bg-subtle)';
        div.style.border = '2px dashed var(--app-border-default)';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.justifyContent = 'center';
        div.style.color = 'var(--app-text-secondary)';
        div.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="3"/><path d="M12 14c-4 0-7 2-7 4v2h14v-2c0-2-3-4-7-4z"/></svg>';
        document.body.appendChild(div);

        e.dataTransfer.setDragImage(div, 32, 32);

        // Cleanup after a short delay; guard against DOM changes before this runs
        setTimeout(() => {
            if (div.parentNode === document.body) {
                try {
                    document.body.removeChild(div);
                } catch (error) {
                    // Safe no-op: drag helper is already gone or cannot be removed
                    console.debug('Drag helper cleanup failed:', error);
                }
            }
        }, 100);
    };

    return (
        <div className="space-y-4">
            {/* Recent History Section */}
            {recentTokens.length > 0 && (
                <div>
                    <h4 className="text-xs uppercase font-semibold mb-2" style={{ color: 'var(--app-text-secondary)' }}>
                        Recent History
                    </h4>
                    <div className="flex gap-2 flex-wrap">
                        {recentTokens.map(token => (
                            <Tooltip key={token.id} content={token.name}>
                                <div
                                    className="sidebar-token w-16 h-16 rounded cursor-grab flex items-center justify-center transition relative group"
                                    draggable
                                    onDragStart={(e) => onDragStart(e, 'LIBRARY_TOKEN', token.src, token.id)}
                                >
                                    <img
                                        src={token.thumbnailSrc.replace('file:', 'media:')}
                                        alt={token.name}
                                        className="w-full h-full object-contain pointer-events-none rounded"
                                    />
                                </div>
                            </Tooltip>
                        ))}
                    </div>
                </div>
            )}

            {/* Party Tokens Section */}
            <div>
                <h4 className="text-xs uppercase font-semibold mb-2" style={{ color: 'var(--app-text-secondary)' }}>
                    Party
                </h4>
                <div className="flex gap-2 flex-wrap">
                    {/* Generic Token (Always first slot) */}
                    <Tooltip content="Generic Token">
                        <div
                            className="sidebar-token w-16 h-16 rounded cursor-grab flex items-center justify-center transition relative group border-2 border-dashed"
                            style={{
                                backgroundColor: 'var(--app-bg-subtle)',
                                borderColor: 'var(--app-border-default)',
                            }}
                            draggable
                            onDragStart={handleGenericTokenDragStart}
                        >
                            <RiUser3Line
                                className="w-8 h-8 pointer-events-none"
                                style={{ color: 'var(--app-text-secondary)' }}
                            />
                        </div>
                    </Tooltip>

                    {/* Player Tokens (Slots 2-6) */}
                    {playerTokens.map(token => (
                        <Tooltip key={token.id} content={token.name}>
                            <div
                                className="sidebar-token w-16 h-16 rounded cursor-grab flex items-center justify-center transition relative group"
                                draggable
                                onDragStart={(e) => onDragStart(e, 'LIBRARY_TOKEN', token.src, token.id)}
                            >
                                <img
                                    src={token.thumbnailSrc.replace('file:', 'media:')}
                                    alt={token.name}
                                    className="w-full h-full object-contain pointer-events-none rounded"
                                />
                            </div>
                        </Tooltip>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default QuickTokenSidebar;
