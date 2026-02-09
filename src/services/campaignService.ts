/**
 * Campaign Service — Campaign I/O orchestration
 *
 * Consolidates campaign save/load/new operations that were previously
 * scattered across App.tsx menu command handlers. Uses Zustand stores
 * imperatively via getState() — no React imports.
 *
 * @see src/services/IStorageService.ts for the storage abstraction
 * @see src/store/gameStore.ts for campaign state
 */

import { getStorage } from './storage';
import { useGameStore } from '../store/gameStore';
import { useUiStore } from '../store/uiStore';
import { addRecentCampaignWithPlatform } from '../utils/recentCampaigns';
import { rollForMessage } from '../utils/systemMessages';

/**
 * Save the current campaign to storage
 *
 * Syncs the active map to the campaign, serializes via the storage service,
 * and updates the recent campaigns list on success.
 *
 * @returns true if save was successful
 */
export async function saveCampaign(): Promise<boolean> {
  try {
    const store = useGameStore.getState();
    store.syncActiveMapToCampaign();
    const campaignToSave = useGameStore.getState().campaign;
    const storage = getStorage();
    const result = await storage.saveCampaign(campaignToSave);
    if (result) {
      addRecentCampaignWithPlatform(campaignToSave.id, campaignToSave.name);
      useUiStore.getState().showToast(rollForMessage('CAMPAIGN_SAVE_SUCCESS'), 'success');
      return true;
    }
    return false;
  } catch (e) {
    console.error('[campaignService] Save failed:', e);
    useUiStore
      .getState()
      .showToast(rollForMessage('CAMPAIGN_SAVE_FAILED', { error: String(e) }), 'error');
    return false;
  }
}

/**
 * Load a campaign from storage
 *
 * Opens file picker (Electron) or restores from IndexedDB (web),
 * deserializes the campaign data, and hydrates the game store.
 *
 * @returns true if load was successful
 */
export async function loadCampaign(): Promise<boolean> {
  try {
    const storage = getStorage();
    const campaign = await storage.loadCampaign();
    if (campaign) {
      useGameStore.getState().loadCampaign(campaign);
      addRecentCampaignWithPlatform(campaign.id, campaign.name);
      useUiStore.getState().showToast(rollForMessage('CAMPAIGN_LOAD_SUCCESS'), 'success');
      return true;
    }
    return false;
  } catch (e) {
    console.error('[campaignService] Load failed:', e);
    useUiStore
      .getState()
      .showToast(rollForMessage('CAMPAIGN_LOAD_FAILED', { error: String(e) }), 'error');
    return false;
  }
}

/**
 * Start a new campaign with confirmation
 *
 * Shows a confirmation dialog before resetting the store to a fresh campaign.
 * The user can cancel to preserve unsaved work.
 */
export function startNewCampaign(): void {
  useUiStore.getState().showConfirmDialog(
    'Create a new campaign? Any unsaved changes will be lost.',
    () => {
      const { resetToNewCampaign } = useGameStore.getState();
      resetToNewCampaign();
    },
    'Create New Campaign',
  );
}
