import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Preferences for wall tool path optimization
 */
export interface WallToolPreferences {
  /** Enable path smoothing using RDP algorithm */
  enableSmoothing: boolean;
  /** RDP epsilon value - higher = more aggressive simplification (pixels) */
  smoothingEpsilon: number;
  /** Enable geometry snapping */
  enableSnapping: boolean;
  /** Snap threshold - maximum distance for snapping (pixels) */
  snapThreshold: number;
  /** Minimum points to keep after smoothing */
  minPoints: number;
}

/**
 * Application preferences state
 */
export interface PreferencesState {
  wallTool: WallToolPreferences;
  setWallToolPreference: <K extends keyof WallToolPreferences>(
    key: K,
    value: WallToolPreferences[K]
  ) => void;
  resetWallToolPreferences: () => void;
}

/**
 * Default wall tool preferences
 */
const defaultWallToolPreferences: WallToolPreferences = {
  enableSmoothing: true,
  smoothingEpsilon: 3.0,
  enableSnapping: true,
  snapThreshold: 10,
  minPoints: 2,
};

/**
 * Preferences store with localStorage persistence
 */
export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      wallTool: defaultWallToolPreferences,

      setWallToolPreference: (key, value) =>
        set((state) => ({
          wallTool: {
            ...state.wallTool,
            [key]: value,
          },
        })),

      resetWallToolPreferences: () =>
        set({
          wallTool: defaultWallToolPreferences,
        }),
    }),
    {
      name: 'hyle-preferences',
    }
  )
);
