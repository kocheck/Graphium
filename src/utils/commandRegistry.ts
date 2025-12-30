/**
 * Command Registry - Centralized command palette actions
 *
 * Defines all actions available in the Command Palette (Cmd+P).
 * Separates UI commands from asset search for better organization.
 *
 * **Command Types:**
 * - Tool Selection: Switch drawing tools (Select, Marker, Eraser, Wall, Door, Measure)
 * - World View: Control World View window and playback state
 * - Generation: Open dungeon generator dialog
 * - System: Save, Load, other system actions
 */

export type CommandCategory = 'Tool' | 'World View' | 'Generation' | 'System';

export interface Command {
  id: string;
  label: string;
  category: CommandCategory;
  keywords: string[]; // For fuzzy search
  shortcut?: string; // Display shortcut hint (e.g., "V", "Cmd+P")
  icon?: string; // Optional icon/emoji
  execute: () => void;
}

export type CommandRegistry = Command[];

/**
 * Creates the command registry with all available actions
 *
 * @param handlers - Object containing handler functions for each action
 * @returns Array of commands for Command Palette
 */
export function createCommandRegistry(handlers: {
  // Tool selection handlers
  setToolSelect: () => void;
  setToolMarker: () => void;
  setToolEraser: () => void;
  setToolWall: () => void;
  setToolDoor: () => void;
  setToolMeasure: () => void;

  // World View handlers
  togglePause: () => void;
  launchWorldView: () => void;

  // Generation handlers
  openDungeonGenerator: () => void;

  // State getters
  isGamePaused: boolean;
}): CommandRegistry {
  return [
    // Tool Selection Commands
    {
      id: 'tool-select',
      label: 'Select Tool',
      category: 'Tool',
      keywords: ['select', 'cursor', 'move', 'tool', 'v'],
      shortcut: 'V',
      icon: '🔍',
      execute: handlers.setToolSelect,
    },
    {
      id: 'tool-marker',
      label: 'Marker Tool',
      category: 'Tool',
      keywords: ['marker', 'draw', 'pen', 'brush', 'tool', 'm'],
      shortcut: 'M',
      icon: '✏️',
      execute: handlers.setToolMarker,
    },
    {
      id: 'tool-eraser',
      label: 'Eraser Tool',
      category: 'Tool',
      keywords: ['eraser', 'erase', 'remove', 'tool', 'e'],
      shortcut: 'E',
      icon: '🧹',
      execute: handlers.setToolEraser,
    },
    {
      id: 'tool-wall',
      label: 'Wall Tool',
      category: 'Tool',
      keywords: ['wall', 'barrier', 'draw', 'tool', 'w'],
      shortcut: 'W',
      icon: '🧱',
      execute: handlers.setToolWall,
    },
    {
      id: 'tool-door',
      label: 'Door Tool',
      category: 'Tool',
      keywords: ['door', 'entrance', 'tool', 'd'],
      shortcut: 'D',
      icon: '🚪',
      execute: handlers.setToolDoor,
    },
    {
      id: 'tool-measure',
      label: 'Measure Tool',
      category: 'Tool',
      keywords: ['measure', 'ruler', 'distance', 'aoe', 'blast', 'cone', 'tool', 'r'],
      shortcut: 'R',
      icon: '📏',
      execute: handlers.setToolMeasure,
    },

    // World View Commands
    {
      id: 'world-view-toggle-pause',
      label: handlers.isGamePaused ? 'Resume World View (Play)' : 'Pause World View',
      category: 'World View',
      keywords: ['pause', 'play', 'resume', 'world', 'view', 'players', 'loading'],
      icon: handlers.isGamePaused ? '▶️' : '⏸️',
      execute: handlers.togglePause,
    },
    {
      id: 'world-view-launch',
      label: 'Launch World View Window',
      category: 'World View',
      keywords: ['world', 'view', 'projector', 'player', 'window', 'launch', 'open'],
      shortcut: 'Cmd+Shift+W',
      icon: '🖥️',
      execute: handlers.launchWorldView,
    },

    // Generation Commands
    {
      id: 'dungeon-generate',
      label: 'Generate Dungeon',
      category: 'Generation',
      keywords: ['dungeon', 'generator', 'generate', 'random', 'map', 'create'],
      icon: '🏰',
      execute: handlers.openDungeonGenerator,
    },
  ];
}

/**
 * Fuzzy search implementation for commands
 *
 * Scores commands based on query match against:
 * - Label (weight: 3x)
 * - Category (weight: 1x)
 * - Keywords (weight: 2x each)
 *
 * @param commands - Array of commands to search
 * @param query - Search query string
 * @returns Sorted array of commands by relevance score
 */
export function searchCommands(commands: Command[], query: string): Command[] {
  if (!query.trim()) return commands;

  const lowerQuery = query.toLowerCase();

  const scoredCommands = commands.map(cmd => {
    let score = 0;

    // Label match (weight: 3x)
    if (cmd.label.toLowerCase().includes(lowerQuery)) {
      score += 3;
    }

    // Category match (weight: 1x)
    if (cmd.category.toLowerCase().includes(lowerQuery)) {
      score += 1;
    }

    // Keywords match (weight: 2x each)
    cmd.keywords.forEach(keyword => {
      if (keyword.toLowerCase().includes(lowerQuery)) {
        score += 2;
      }
    });

    // Exact match bonus
    if (cmd.label.toLowerCase() === lowerQuery) {
      score += 10;
    }

    return { cmd, score };
  });

  // Filter out zero scores and sort by score descending
  return scoredCommands
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ cmd }) => cmd);
}
