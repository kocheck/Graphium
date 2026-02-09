/**
 * useMenuCommands — Electron IPC menu command handler registration
 *
 * Centralizes the binding between Electron menu items and application actions.
 * In web mode (no ipcRenderer), this hook is a no-op.
 *
 * @see electron/main.ts for menu item definitions
 * @see src/services/campaignService.ts for save/load implementations
 */

import { useEffect, useRef } from 'react';

import { saveCampaign, loadCampaign, startNewCampaign } from '../services/campaignService';
import { useUiStore } from '../store/uiStore';

interface UseMenuCommandsOptions {
  /** Callback to open the About modal (local App state) */
  onShowAbout: () => void;
}

/**
 * Registers IPC menu command handlers for Electron integration
 *
 * Handles: MENU_SAVE_CAMPAIGN, MENU_LOAD_CAMPAIGN, MENU_NEW_CAMPAIGN,
 * MENU_TOGGLE_RESOURCE_MONITOR, MENU_GENERATE_DUNGEON, MENU_SHOW_ABOUT
 *
 * All handlers use Zustand getState() for store access, so the effect
 * has stable dependencies and only runs once.
 */
export function useMenuCommands({ onShowAbout }: UseMenuCommandsOptions): void {
  // Use ref to avoid re-registering IPC listeners when callback changes
  const onShowAboutRef = useRef(onShowAbout);
  onShowAboutRef.current = onShowAbout;

  useEffect(() => {
    const ipcRenderer = window.ipcRenderer;
    if (!ipcRenderer) {
      return;
    }

    const handleSave = (): void => {
      void saveCampaign();
    };

    const handleLoad = (): void => {
      void loadCampaign();
    };

    const handleToggleMonitor = () => {
      useUiStore.getState().setShowResourceMonitor(!useUiStore.getState().showResourceMonitor);
    };

    const handleGenerateDungeon = () => {
      useUiStore.getState().showDungeonDialog();
    };

    const handleNewCampaign = () => {
      startNewCampaign();
    };

    const handleShowAbout = () => {
      onShowAboutRef.current();
    };

    ipcRenderer.on('MENU_SAVE_CAMPAIGN', handleSave);
    ipcRenderer.on('MENU_LOAD_CAMPAIGN', handleLoad);
    ipcRenderer.on('MENU_TOGGLE_RESOURCE_MONITOR', handleToggleMonitor);
    ipcRenderer.on('MENU_GENERATE_DUNGEON', handleGenerateDungeon);
    ipcRenderer.on('MENU_NEW_CAMPAIGN', handleNewCampaign);
    ipcRenderer.on('MENU_SHOW_ABOUT', handleShowAbout);

    return () => {
      ipcRenderer.off('MENU_SAVE_CAMPAIGN', handleSave);
      ipcRenderer.off('MENU_LOAD_CAMPAIGN', handleLoad);
      ipcRenderer.off('MENU_TOGGLE_RESOURCE_MONITOR', handleToggleMonitor);
      ipcRenderer.off('MENU_GENERATE_DUNGEON', handleGenerateDungeon);
      ipcRenderer.off('MENU_NEW_CAMPAIGN', handleNewCampaign);
      ipcRenderer.off('MENU_SHOW_ABOUT', handleShowAbout);
    };
  }, []); // Stable: all handlers use getState() or refs
}
