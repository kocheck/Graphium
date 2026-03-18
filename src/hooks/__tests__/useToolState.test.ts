import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useToolState } from '../useToolState';

import type { ToolType } from '../useToolState';

// Stable mock references — hoisted outside factory so selectors always return
// the same function identity (prevents spurious useEffect re-fires).
const mockSetBroadcastMeasurement = vi.fn();
const mockSetActiveMeasurement = vi.fn();

vi.mock('../../store/gameStore', () => ({
  useGameStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) => {
    const state = {
      broadcastMeasurement: false,
      setBroadcastMeasurement: mockSetBroadcastMeasurement,
      setActiveMeasurement: mockSetActiveMeasurement,
    };
    return selector(state);
  }),
}));

describe('useToolState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('starts with select tool', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: true }));
      expect(result.current.tool).toBe('select');
    });

    it('starts with default marker color', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: true }));
      expect(result.current.color).toBe('#df4b26');
    });

    it('starts with 3 default recent colors', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: true }));
      expect(result.current.recentColors).toEqual(['#df4b26', '#3b82f6', '#22c55e']);
    });

    it('starts with horizontal door orientation', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: true }));
      expect(result.current.doorOrientation).toBe('horizontal');
    });

    it('starts with ruler measurement mode', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: true }));
      expect(result.current.measurementMode).toBe('ruler');
    });
  });

  describe('tool selection', () => {
    it('setTool changes active tool', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: true }));

      act(() => {
        result.current.setTool('marker');
      });
      expect(result.current.tool).toBe('marker');

      act(() => {
        result.current.setTool('wall');
      });
      expect(result.current.tool).toBe('wall');
    });

    it('supports all tool types', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: true }));
      const tools: ToolType[] = ['select', 'marker', 'eraser', 'wall', 'door', 'measure'];

      for (const tool of tools) {
        act(() => {
          result.current.setTool(tool);
        });
        expect(result.current.tool).toBe(tool);
      }
    });
  });

  describe('color management', () => {
    it('setColor updates current color', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: true }));

      act(() => {
        result.current.setColor('#ff0000');
      });
      expect(result.current.color).toBe('#ff0000');
    });

    it('handleColorChange updates color and recent colors', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: true }));

      act(() => {
        result.current.handleColorChange('#ff0000');
      });

      expect(result.current.color).toBe('#ff0000');
      expect(result.current.recentColors[0]).toBe('#ff0000');
      expect(result.current.recentColors).toHaveLength(3);
    });

    it('handleColorChange deduplicates colors (case insensitive)', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: true }));

      // Default colors: #df4b26, #3b82f6, #22c55e
      act(() => {
        result.current.handleColorChange('#DF4B26'); // Same as default, different case
      });

      // Should move to front, not create a duplicate
      expect(result.current.recentColors).toHaveLength(3);
      expect(result.current.recentColors[0]).toBe('#DF4B26');
    });

    it('handleColorChange keeps max 3 recent colors', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: true }));

      act(() => {
        result.current.handleColorChange('#111111');
      });
      act(() => {
        result.current.handleColorChange('#222222');
      });

      expect(result.current.recentColors).toHaveLength(3);
      expect(result.current.recentColors[0]).toBe('#222222');
    });
  });

  describe('door orientation', () => {
    it('setDoorOrientation changes orientation', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: true }));

      act(() => {
        result.current.setDoorOrientation('vertical');
      });
      expect(result.current.doorOrientation).toBe('vertical');
    });
  });

  describe('measurement mode', () => {
    it('setMeasurementMode changes mode', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: true }));

      act(() => {
        result.current.setMeasurementMode('blast');
      });
      expect(result.current.measurementMode).toBe('blast');

      act(() => {
        result.current.setMeasurementMode('cone');
      });
      expect(result.current.measurementMode).toBe('cone');
    });

    it('clears active measurement when mode changes', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: true }));

      mockSetActiveMeasurement.mockClear();

      act(() => {
        result.current.setMeasurementMode('blast');
      });

      expect(mockSetActiveMeasurement).toHaveBeenCalledWith(null);
    });
  });

  describe('keyboard shortcuts (Architect View)', () => {
    it('V key switches to select tool', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: true }));

      act(() => {
        result.current.setTool('marker');
      });
      expect(result.current.tool).toBe('marker');

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v' }));
      });
      expect(result.current.tool).toBe('select');
    });

    it('M key switches to marker tool', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: true }));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' }));
      });
      expect(result.current.tool).toBe('marker');
    });

    it('E key switches to eraser tool', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: true }));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
      });
      expect(result.current.tool).toBe('eraser');
    });

    it('W key switches to wall tool', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: true }));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
      });
      expect(result.current.tool).toBe('wall');
    });

    it('D key switches to door tool', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: true }));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
      });
      expect(result.current.tool).toBe('door');
    });

    it('R key switches to measure tool when not on door', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: true }));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
      });
      expect(result.current.tool).toBe('measure');
    });

    it('R key toggles door orientation when door tool active', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: true }));

      act(() => {
        result.current.setTool('door');
      });
      expect(result.current.doorOrientation).toBe('horizontal');

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
      });
      expect(result.current.doorOrientation).toBe('vertical');
    });

    it('arrow keys toggle door orientation when door tool active', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: true }));

      act(() => {
        result.current.setTool('door');
      });

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      });
      expect(result.current.doorOrientation).toBe('vertical');

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      });
      expect(result.current.doorOrientation).toBe('horizontal');
    });

    it('does not respond to keyboard when not Architect View', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: false }));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' }));
      });
      expect(result.current.tool).toBe('select'); // Unchanged
    });

    it('ignores keyboard when target is an input element', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: true }));

      const input = document.createElement('input');
      document.body.appendChild(input);

      try {
        act(() => {
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }));
        });
        expect(result.current.tool).toBe('select'); // Unchanged
      } finally {
        document.body.removeChild(input);
      }
    });

    it('ignores keyboard when target is a textarea', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: true }));

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);

      try {
        act(() => {
          textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));
        });
        expect(result.current.tool).toBe('select'); // Unchanged
      } finally {
        document.body.removeChild(textarea);
      }
    });
  });

  describe('ref access', () => {
    it('provides colorInputRef', () => {
      const { result } = renderHook(() => useToolState({ isArchitectView: true }));
      expect(result.current.colorInputRef).toBeDefined();
      expect(result.current.colorInputRef.current).toBeNull();
    });
  });
});
