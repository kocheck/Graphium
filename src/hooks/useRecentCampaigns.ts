/**
 * useRecentCampaigns — Hook for managing recent campaign list
 *
 * Wraps the localStorage-based recentCampaigns utility functions
 * into a React hook with reactive state. HomeScreen uses this
 * instead of directly calling localStorage.
 *
 * @see src/utils/recentCampaigns.ts for the underlying storage logic
 */

import { useState, useCallback } from 'react';

import {
  getRecentCampaigns,
  addRecentCampaignWithPlatform,
  removeRecentCampaign,
} from '../utils/recentCampaigns';

import type { RecentCampaign } from '../utils/recentCampaigns';

export type { RecentCampaign };

interface UseRecentCampaignsReturn {
  /** List of recent campaigns, sorted newest first */
  recentCampaigns: RecentCampaign[];
  /** Add a campaign to the recent list (auto-detects platform) */
  addRecent: (id: string, name: string) => void;
  /** Remove a campaign from the recent list */
  removeRecent: (campaignId: string) => void;
  /** Reload the list from localStorage (e.g., after external mutation) */
  refresh: () => void;
}

export function useRecentCampaigns(): UseRecentCampaignsReturn {
  const [recentCampaigns, setRecentCampaigns] = useState<RecentCampaign[]>(() =>
    getRecentCampaigns(),
  );

  const refresh = useCallback(() => {
    setRecentCampaigns(getRecentCampaigns());
  }, []);

  const addRecent = useCallback((id: string, name: string) => {
    addRecentCampaignWithPlatform(id, name);
    setRecentCampaigns(getRecentCampaigns());
  }, []);

  const removeRecent = useCallback((campaignId: string) => {
    removeRecentCampaign(campaignId);
    setRecentCampaigns(getRecentCampaigns());
  }, []);

  return { recentCampaigns, addRecent, removeRecent, refresh };
}
