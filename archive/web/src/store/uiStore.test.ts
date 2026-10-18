import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useGameStore } from './gameStore';
import { useUiStore } from './uiStore';

const DEFAULTS = {
  tool: 'select' as const,
  color: '#df4b26',
  recentColors: ['#df4b26', '#3b82f6', '#22c55e'],
  doorOrientation: 'horizontal' as const,
  measurementMode: 'ruler' as const,
  selectedTokenIds: [] as string[],
};

describe('uiStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.setState(DEFAULTS);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts on the select tool with the default colour and three recent colours', () => {
    expect(useUiStore.getState()).toMatchObject(DEFAULTS);
  });

  it('setColor puts the colour first in recentColors, deduplicated case-insensitively, max three', () => {
    useUiStore.getState().setColor('#3B82F6');
    expect(useUiStore.getState().color).toBe('#3B82F6');
    expect(useUiStore.getState().recentColors).toEqual(['#3B82F6', '#df4b26', '#22c55e']);
    useUiStore.getState().setColor('#ffffff');
    expect(useUiStore.getState().recentColors).toEqual(['#ffffff', '#3B82F6', '#df4b26']);
  });

  it('toggleDoorOrientation flips between horizontal and vertical', () => {
    useUiStore.getState().toggleDoorOrientation();
    expect(useUiStore.getState().doorOrientation).toBe('vertical');
    useUiStore.getState().toggleDoorOrientation();
    expect(useUiStore.getState().doorOrientation).toBe('horizontal');
  });

  it('setMeasurementMode clears the active measurement in gameStore', () => {
    const clear = vi.spyOn(useGameStore.getState(), 'setActiveMeasurement');
    useUiStore.getState().setMeasurementMode('blast');
    expect(useUiStore.getState().measurementMode).toBe('blast');
    expect(clear).toHaveBeenCalledWith(null);
  });

  it('setSelectedTokenIds and clearSelection round-trip', () => {
    useUiStore.getState().setSelectedTokenIds(['a', 'b']);
    expect(useUiStore.getState().selectedTokenIds).toEqual(['a', 'b']);
    useUiStore.getState().clearSelection();
    expect(useUiStore.getState().selectedTokenIds).toEqual([]);
  });

  it('writes nothing to localStorage (not persisted)', () => {
    useUiStore.getState().setTool('marker');
    useUiStore.getState().setColor('#000000');
    expect(localStorage.length).toBe(0);
  });
});
