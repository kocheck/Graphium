/**
 * Recent Campaigns Manager
 *
 * Manages the list of recently opened campaigns in localStorage.
 * Used by the HomeScreen to display quick access to recent files.
 */

/**
 * Base properties shared by all recent campaign entries
 */
interface RecentCampaignBase {
  id: string;
  name: string;
  lastOpened: number; // Timestamp
}

/**
 * Recent campaign entry for web platform (no file path)
 */
interface RecentCampaignWeb extends RecentCampaignBase {
  platform: 'web';
}

/**
 * Recent campaign entry for Electron platform (includes file path)
 */
interface RecentCampaignElectron extends RecentCampaignBase {
  platform: 'electron';
  filePath: string;
}

/**
 * Discriminated union for recent campaign entries
 */
export type RecentCampaign = RecentCampaignWeb | RecentCampaignElectron;

const STORAGE_KEY = 'graphium-recent-campaigns';
const MAX_RECENT = 3;

/**
 * Get list of recent campaigns from localStorage
 * @returns Array of recent campaigns, already sorted by last opened (newest first) and limited to MAX_RECENT
 */
export function getRecentCampaigns(): RecentCampaign[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const campaigns = JSON.parse(stored) as RecentCampaign[];
    // Data is already sorted and limited in addRecentCampaign
    return campaigns;
  } catch (error) {
    console.error('[RecentCampaigns] Failed to load recent campaigns:', error);
    return [];
  }
}

/**
 * Add or update a campaign in the recent list
 * @param campaign Campaign to add/update
 */
export function addRecentCampaign(campaign: RecentCampaign): void {
  try {
    const existing = getRecentCampaigns();

    // Remove existing entry if present (by id)
    const filtered = existing.filter(c => c.id !== campaign.id);

    // Add new entry at the top
    const updated = [{ ...campaign, lastOpened: Date.now() }, ...filtered].slice(0, MAX_RECENT);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('[RecentCampaigns] Failed to save recent campaign:', error);
  }
}

/**
 * Helper to add a recent campaign with automatic platform detection
 * @param id Campaign ID
 * @param name Campaign name
 * @param filePath Optional file path (Electron only)
 */
export function addRecentCampaignWithPlatform(
  id: string,
  name: string,
  filePath?: string
): void {
  const isElectron = typeof window !== 'undefined' && window.ipcRenderer !== undefined;

  if (isElectron && filePath) {
    addRecentCampaign({
      platform: 'electron',
      id,
      name,
      filePath,
      lastOpened: Date.now(),
    });
  } else {
    addRecentCampaign({
      platform: 'web',
      id,
      name,
      lastOpened: Date.now(),
    });
  }
}

/**
 * Remove a campaign from the recent list
 * @param campaignId Campaign ID to remove
 */
export function removeRecentCampaign(campaignId: string): void {
  try {
    const existing = getRecentCampaigns();
    const filtered = existing.filter(c => c.id !== campaignId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('[RecentCampaigns] Failed to remove recent campaign:', error);
  }
}

/**
 * Clear all recent campaigns
 */
export function clearRecentCampaigns(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('[RecentCampaigns] Failed to clear recent campaigns:', error);
  }
}
