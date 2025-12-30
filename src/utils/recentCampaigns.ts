/**
 * Recent Campaigns Manager
 *
 * Manages the list of recently opened campaigns in localStorage.
 * Used by the HomeScreen to display quick access to recent files.
 */

export interface RecentCampaign {
  id: string;
  name: string;
  filePath?: string; // Electron only - file system path
  lastOpened: number; // Timestamp
}

const STORAGE_KEY = 'hyle-recent-campaigns';
const MAX_RECENT = 3;

/**
 * Get list of recent campaigns from localStorage
 * @returns Array of recent campaigns, sorted by last opened (newest first)
 */
export function getRecentCampaigns(): RecentCampaign[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const campaigns = JSON.parse(stored) as RecentCampaign[];
    return campaigns.sort((a, b) => b.lastOpened - a.lastOpened).slice(0, MAX_RECENT);
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
