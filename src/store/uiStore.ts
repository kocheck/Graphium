import { create } from 'zustand';

import { useGameStore } from './gameStore';

import type { MeasurementMode } from '../types/measurement';

type Tool = 'select' | 'marker' | 'eraser' | 'wall' | 'door' | 'measure';
type DoorOrientation = 'horizontal' | 'vertical';

interface UiState {
  tool: Tool;
  color: string;
  recentColors: string[];
  doorOrientation: DoorOrientation;
  measurementMode: MeasurementMode;
  selectedTokenIds: string[];
  setTool: (tool: Tool) => void;
  setColor: (color: string) => void;
  toggleDoorOrientation: () => void;
  setMeasurementMode: (mode: MeasurementMode) => void;
  setSelectedTokenIds: (ids: string[]) => void;
  clearSelection: () => void;
}

const EMPTY_SELECTION: string[] = [];

/**
 * Ephemeral editor UI state: active tool, marker colour, door orientation, measurement mode and
 * the mirrored token selection. Deliberately NOT persisted and NOT part of gameStore: nothing here
 * may reach a .graphium file or the World View broadcast. Anything durable belongs in gameStore.
 */
export const useUiStore = create<UiState>((set) => ({
  tool: 'select',
  color: '#df4b26',
  recentColors: ['#df4b26', '#3b82f6', '#22c55e'],
  doorOrientation: 'horizontal',
  measurementMode: 'ruler',
  selectedTokenIds: EMPTY_SELECTION,
  setTool: (tool) => set({ tool }),
  setColor: (color) =>
    set((state) => ({
      color,
      recentColors: [
        color,
        ...state.recentColors.filter((c) => c.toLowerCase() !== color.toLowerCase()),
      ].slice(0, 3),
    })),
  toggleDoorOrientation: () =>
    set((state) => ({
      doorOrientation: state.doorOrientation === 'horizontal' ? 'vertical' : 'horizontal',
    })),
  setMeasurementMode: (measurementMode) => {
    set({ measurementMode });
    // App.tsx used to clear the active measurement in an effect keyed on measurementMode.
    useGameStore.getState().setActiveMeasurement(null);
  },
  setSelectedTokenIds: (selectedTokenIds) => set({ selectedTokenIds }),
  clearSelection: () => set({ selectedTokenIds: EMPTY_SELECTION }),
}));
