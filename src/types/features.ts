// src/types/features.ts
//
// This file declares the FeatureFlags interface and default values.
// The RUNTIME flag state lives in uiStore (not here) — uiStore initializes
// its flag field from DEFAULT_FEATURE_FLAGS and allows toggling at runtime.
// Do not put flag-reading logic in this file.

/**
 * FeatureFlags gates entire subsystems. Lives in uiStore (runtime-only, not persisted).
 *
 * Checked in exactly two places:
 * 1. Renderer — skips the entire layer if the feature is disabled
 * 2. UI — hides controls for disabled features
 *
 * New flags default to false — features ship disabled until ready.
 * Disabled features leave their entity tables empty.
 */
export interface FeatureFlags {
  lighting: boolean; // LightSource entities + light pass in renderer
  mapLinks: boolean; // MapLink entities + floor navigation UI
  fogOfWar: boolean; // FogOfWarFilter + explored regions
  playerSync: boolean; // IPC sync to World View window
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  lighting: false,
  mapLinks: false,
  fogOfWar: true,
  playerSync: true,
};
