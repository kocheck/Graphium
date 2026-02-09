/**
 * UI Store — Ephemeral UI state (not persisted, not synced via IPC)
 *
 * This store holds all transient UI state that does NOT need to be:
 * - Persisted to campaign files
 * - Synced between Architect and World View windows
 *
 * Separated from gameStore (ADR-001) so that UI state changes
 * (toasts, dialogs, sidebar toggles) don't trigger IPC sync in SyncManager.
 *
 * @see gameStore.ts for domain state (tokens, drawings, campaign, etc.)
 */

import { create } from 'zustand';

import type { ToastMessage, ConfirmDialog } from '../types/domain';

// Re-export types for consumer convenience
export type { ToastMessage, ConfirmDialog };

export interface UiState {
  // --- Toast notifications ---
  toast: ToastMessage | null;

  // --- Confirm dialog ---
  confirmDialog: ConfirmDialog | null;

  // --- Resource monitor visibility ---
  showResourceMonitor: boolean;

  // --- Dungeon generator dialog ---
  dungeonDialog: boolean;

  // --- Game pause state (World View loading screen) ---
  isGamePaused: boolean;

  // --- Mobile sidebar ---
  isMobileSidebarOpen: boolean;

  // --- Command palette ---
  isCommandPaletteOpen: boolean;

  // --- Actions ---
  showToast: (message: string, type: 'error' | 'success' | 'info') => void;
  clearToast: () => void;
  showConfirmDialog: (message: string, onConfirm: () => void, confirmText?: string) => void;
  clearConfirmDialog: () => void;
  setShowResourceMonitor: (show: boolean) => void;
  showDungeonDialog: () => void;
  clearDungeonDialog: () => void;
  setIsGamePaused: (isPaused: boolean) => void;
  setMobileSidebarOpen: (isOpen: boolean) => void;
  setCommandPaletteOpen: (isOpen: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  // --- Initial State ---
  toast: null,
  confirmDialog: null,
  showResourceMonitor: false,
  dungeonDialog: false,
  isGamePaused: false,
  isMobileSidebarOpen: false,
  isCommandPaletteOpen: false,

  // --- Actions ---
  showToast: (message: string, type: 'error' | 'success' | 'info') =>
    set({ toast: { message, type } }),
  clearToast: () => set({ toast: null }),
  showConfirmDialog: (message: string, onConfirm: () => void, confirmText?: string) =>
    set({ confirmDialog: { message, onConfirm, confirmText } }),
  clearConfirmDialog: () => set({ confirmDialog: null }),
  setShowResourceMonitor: (show: boolean) => set({ showResourceMonitor: show }),
  showDungeonDialog: () => set({ dungeonDialog: true }),
  clearDungeonDialog: () => set({ dungeonDialog: false }),
  setIsGamePaused: (isPaused: boolean) => set({ isGamePaused: isPaused }),
  setMobileSidebarOpen: (isOpen: boolean) => set({ isMobileSidebarOpen: isOpen }),
  setCommandPaletteOpen: (isOpen: boolean) => set({ isCommandPaletteOpen: isOpen }),
}));
