import { useEffect, useRef, useState, useCallback } from 'react';

import { useGameStore } from '../../store/gameStore';

import type { Token, Door } from '../../types/domain';

/**
 * CanvasAccessibility — Off-screen ARIA live region for canvas state announcements.
 *
 * Konva renders to `<canvas>`, which is opaque to screen readers. This component
 * provides an accessible bridge by:
 * 1. Announcing state changes via `aria-live="polite"` (token moves, door toggles,
 *    measurement results, tool changes)
 * 2. Providing a `role="region"` wrapper with a descriptive aria-label summarizing
 *    the current canvas state (token count, map name, etc.)
 * 3. Enabling keyboard token selection: Tab through tokens, Enter to select,
 *    Arrow keys to move selected token by one grid cell
 *
 * Positioned off-screen (sr-only) so it's invisible but available to assistive tech.
 *
 * @see https://www.w3.org/WAI/ARIA/apg/ for ARIA patterns used
 */

interface CanvasAccessibilityProps {
  /** Active drawing/interaction tool */
  tool: string;
  /** IDs of currently selected tokens */
  selectedTokenIds: string[];
  /** Callback when a token is selected via keyboard */
  onSelectToken: (tokenId: string) => void;
  /** Whether this is the World View (player-facing) */
  isWorldView: boolean;
}

/**
 * Builds a human-readable summary of the canvas state for screen readers.
 */
function buildCanvasDescription(
  tokenCount: number,
  mapName: string | null,
  tool: string,
  isWorldView: boolean,
): string {
  const view = isWorldView ? 'World View' : 'Architect View';
  const mapInfo = mapName ? `Map: ${mapName}.` : 'No map loaded.';
  const tokenInfo = tokenCount === 1 ? '1 token' : `${tokenCount} tokens`;
  const toolInfo = isWorldView ? '' : ` Active tool: ${tool}.`;
  return `${view}. ${mapInfo} ${tokenInfo} on canvas.${toolInfo}`;
}

export function CanvasAccessibility({
  tool,
  selectedTokenIds,
  onSelectToken,
  isWorldView,
}: CanvasAccessibilityProps) {
  const [announcement, setAnnouncement] = useState('');
  const prevTokensRef = useRef<Token[]>([]);
  const prevDoorsRef = useRef<Door[]>([]);
  const prevToolRef = useRef(tool);

  // Store selectors
  const tokens = useGameStore((s) => s.tokens);
  const doors = useGameStore((s) => s.doors);
  const gridSize = useGameStore((s) => s.gridSize);
  const mapName = useGameStore((s) => s.campaign.maps[s.campaign.activeMapId]?.name ?? null);

  const announce = useCallback((message: string) => {
    // Clear first to ensure repeated identical messages are announced
    setAnnouncement('');
    requestAnimationFrame(() => {
      setAnnouncement(message);
    });
  }, []);

  // Announce tool changes
  useEffect(() => {
    if (tool !== prevToolRef.current && !isWorldView) {
      const toolNames: Record<string, string> = {
        select: 'Select',
        marker: 'Marker',
        eraser: 'Eraser',
        wall: 'Wall',
        door: 'Door',
        measure: 'Measure',
      };
      announce(`Tool changed to ${toolNames[tool] ?? tool}`);
      prevToolRef.current = tool;
    }
  }, [tool, isWorldView, announce]);

  // Announce door state changes (open/close/lock)
  useEffect(() => {
    const prevDoors = prevDoorsRef.current;
    if (prevDoors.length > 0 && doors.length > 0) {
      for (const door of doors) {
        const prev = prevDoors.find((d) => d.id === door.id);
        if (prev) {
          if (prev.isOpen !== door.isOpen) {
            announce(`Door ${door.isOpen ? 'opened' : 'closed'}`);
          }
          if (prev.isLocked !== door.isLocked) {
            announce(`Door ${door.isLocked ? 'locked' : 'unlocked'}`);
          }
        }
      }
    }
    prevDoorsRef.current = doors;
  }, [doors, announce]);

  // Announce token count changes (added/removed)
  useEffect(() => {
    const prevTokens = prevTokensRef.current;
    if (prevTokens.length > 0 || tokens.length > 0) {
      const added = tokens.length - prevTokens.length;
      if (added > 0) {
        announce(`${added} token${added > 1 ? 's' : ''} added`);
      } else if (added < 0) {
        announce(`${Math.abs(added)} token${Math.abs(added) > 1 ? 's' : ''} removed`);
      }
    }
    prevTokensRef.current = tokens;
  }, [tokens, announce]);

  // Keyboard navigation: Tab through tokens, Arrow keys to move
  const focusedTokenIndex = useRef(-1);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Escape exits the canvas keyboard widget (returns to normal tab order)
      if (e.key === 'Escape') {
        focusedTokenIndex.current = -1;
        (e.target as HTMLElement).blur();
        return;
      }

      if (tokens.length === 0) {
        return; // Let Tab pass through naturally when there are no tokens
      }

      const updateTokenPosition = useGameStore.getState().updateTokenPosition;

      if (e.key === 'Tab') {
        // Allow Tab to pass through at boundaries so users can exit the widget
        if (e.shiftKey && focusedTokenIndex.current <= 0) {
          // Shift+Tab at first token (or before cycling): exit backward
          focusedTokenIndex.current = -1;
          return;
        }
        if (!e.shiftKey && focusedTokenIndex.current >= tokens.length - 1) {
          // Tab past last token: exit forward
          focusedTokenIndex.current = -1;
          return;
        }

        e.preventDefault();
        if (e.shiftKey) {
          focusedTokenIndex.current =
            (focusedTokenIndex.current - 1 + tokens.length) % tokens.length;
        } else {
          focusedTokenIndex.current = focusedTokenIndex.current + 1;
        }
        const token = tokens[focusedTokenIndex.current];
        if (token) {
          onSelectToken(token.id);
          announce(
            `Token ${token.name ?? 'unnamed'} selected. ${focusedTokenIndex.current + 1} of ${tokens.length}`,
          );
        }
        return;
      }

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (focusedTokenIndex.current >= 0 && focusedTokenIndex.current < tokens.length) {
          const token = tokens[focusedTokenIndex.current];
          if (token) {
            onSelectToken(token.id);
            announce(`Token ${token.name ?? 'unnamed'} activated`);
          }
        }
        return;
      }

      // Arrow keys move selected token by one grid cell
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (selectedTokenIds.length === 0) {
          return;
        }
        e.preventDefault();

        const dx = e.key === 'ArrowLeft' ? -gridSize : e.key === 'ArrowRight' ? gridSize : 0;
        const dy = e.key === 'ArrowUp' ? -gridSize : e.key === 'ArrowDown' ? gridSize : 0;

        for (const id of selectedTokenIds) {
          const token = tokens.find((t) => t.id === id);
          if (token) {
            updateTokenPosition(id, token.x + dx, token.y + dy);
          }
        }

        const direction =
          e.key === 'ArrowUp'
            ? 'up'
            : e.key === 'ArrowDown'
              ? 'down'
              : e.key === 'ArrowLeft'
                ? 'left'
                : 'right';
        announce(
          `Moved ${selectedTokenIds.length} token${selectedTokenIds.length > 1 ? 's' : ''} ${direction}`,
        );
      }
    },
    [tokens, selectedTokenIds, gridSize, onSelectToken, announce],
  );

  const canvasDescription = buildCanvasDescription(tokens.length, mapName, tool, isWorldView);

  return (
    <>
      {/* Keyboard navigation widget for canvas — role="application" tells assistive
          tech this component manages its own keyboard shortcuts (Tab cycles tokens,
          Arrow keys move selected tokens, Enter activates).
          Disabling a11y lint: this is an intentional ARIA application widget that
          manages its own keyboard navigation, not a misused non-interactive element. */}
      {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
      <div
        role="application"
        aria-label={canvasDescription}
        aria-roledescription="canvas keyboard controls"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="sr-only"
      >
        <span>{canvasDescription}</span>
        <span>Tab: cycle tokens. Arrow keys: move selected. Enter: activate.</span>
      </div>
      {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}

      {/* ARIA live region for dynamic announcements */}
      <div aria-live="polite" aria-atomic="true" role="status" className="sr-only">
        {announcement}
      </div>
    </>
  );
}

export default CanvasAccessibility;
