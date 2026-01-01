import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getRecentCampaigns,
  addRecentCampaign,
  addRecentCampaignWithPlatform,
  removeRecentCampaign,
  clearRecentCampaigns,
  type RecentCampaign,
} from './recentCampaigns';

describe('recentCampaigns', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('getRecentCampaigns', () => {
    it('should return empty array when no campaigns are stored', () => {
      const campaigns = getRecentCampaigns();
      expect(campaigns).toEqual([]);
    });

    it('should return stored campaigns', () => {
      const mockCampaign: RecentCampaign = {
        platform: 'web',
        id: 'test-1',
        name: 'Test Campaign',
        lastOpened: Date.now(),
      };

      localStorage.setItem('graphium-recent-campaigns', JSON.stringify([mockCampaign]));

      const campaigns = getRecentCampaigns();
      expect(campaigns).toHaveLength(1);
      expect(campaigns[0].id).toBe('test-1');
      expect(campaigns[0].name).toBe('Test Campaign');
    });

    it('should handle corrupted localStorage data', () => {
      localStorage.setItem('graphium-recent-campaigns', 'invalid json');

      const campaigns = getRecentCampaigns();
      expect(campaigns).toEqual([]);
    });

    it('should return campaigns in pre-sorted order', () => {
      const campaign1: RecentCampaign = {
        platform: 'web',
        id: 'test-1',
        name: 'Campaign 1',
        lastOpened: 1000,
      };
      const campaign2: RecentCampaign = {
        platform: 'web',
        id: 'test-2',
        name: 'Campaign 2',
        lastOpened: 2000,
      };

      // Store in already sorted order (newest first)
      localStorage.setItem('graphium-recent-campaigns', JSON.stringify([campaign2, campaign1]));

      const campaigns = getRecentCampaigns();
      expect(campaigns[0].id).toBe('test-2'); // Newer campaign first
      expect(campaigns[1].id).toBe('test-1');
    });
  });

  describe('addRecentCampaign', () => {
    it('should add a new campaign to empty list', () => {
      const campaign: RecentCampaign = {
        platform: 'web',
        id: 'test-1',
        name: 'Test Campaign',
        lastOpened: Date.now(),
      };

      addRecentCampaign(campaign);

      const stored = getRecentCampaigns();
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe('test-1');
    });

    it('should add campaign to beginning of list', () => {
      const campaign1: RecentCampaign = {
        platform: 'web',
        id: 'test-1',
        name: 'Campaign 1',
        lastOpened: 1000,
      };
      const campaign2: RecentCampaign = {
        platform: 'web',
        id: 'test-2',
        name: 'Campaign 2',
        lastOpened: 2000,
      };

      addRecentCampaign(campaign1);
      addRecentCampaign(campaign2);

      const stored = getRecentCampaigns();
      expect(stored[0].id).toBe('test-2'); // Most recent first
      expect(stored[1].id).toBe('test-1');
    });

    it('should update existing campaign timestamp', () => {
      const campaign1: RecentCampaign = {
        platform: 'web',
        id: 'test-1',
        name: 'Campaign 1',
        lastOpened: 1000,
      };
      const campaign2: RecentCampaign = {
        platform: 'web',
        id: 'test-2',
        name: 'Campaign 2',
        lastOpened: 2000,
      };

      addRecentCampaign(campaign1);
      addRecentCampaign(campaign2);

      // Re-open campaign 1 (should move to top)
      const campaign1Updated: RecentCampaign = {
        platform: 'web',
        id: 'test-1',
        name: 'Campaign 1',
        lastOpened: 3000,
      };
      addRecentCampaign(campaign1Updated);

      const stored = getRecentCampaigns();
      expect(stored).toHaveLength(2);
      expect(stored[0].id).toBe('test-1'); // Now first
      expect(stored[1].id).toBe('test-2');
    });

    it('should limit to MAX_RECENT campaigns (3)', () => {
      const campaigns: RecentCampaign[] = [
        { platform: 'web', id: 'test-1', name: 'Campaign 1', lastOpened: 1000 },
        { platform: 'web', id: 'test-2', name: 'Campaign 2', lastOpened: 2000 },
        { platform: 'web', id: 'test-3', name: 'Campaign 3', lastOpened: 3000 },
        { platform: 'web', id: 'test-4', name: 'Campaign 4', lastOpened: 4000 },
      ];

      campaigns.forEach((campaign) => addRecentCampaign(campaign));

      const stored = getRecentCampaigns();
      expect(stored).toHaveLength(3);
      expect(stored[0].id).toBe('test-4'); // Newest
      expect(stored[1].id).toBe('test-3');
      expect(stored[2].id).toBe('test-2');
    });

    it('should handle Electron campaigns with file paths', () => {
      const campaign: RecentCampaign = {
        platform: 'electron',
        id: 'test-1',
        name: 'Test Campaign',
        filePath: '/path/to/campaign.graphium',
        lastOpened: Date.now(),
      };

      addRecentCampaign(campaign);

      const stored = getRecentCampaigns();
      expect(stored).toHaveLength(1);
      expect(stored[0].platform).toBe('electron');
      if (stored[0].platform === 'electron') {
        expect(stored[0].filePath).toBe('/path/to/campaign.graphium');
      }
    });
  });

  describe('addRecentCampaignWithPlatform', () => {
    it('should create web campaign when not in Electron', () => {
      // Mock window without ipcRenderer (web environment)
      const originalWindow = global.window;
      global.window = { ipcRenderer: undefined } as any;

      addRecentCampaignWithPlatform('test-1', 'Test Campaign');

      const stored = getRecentCampaigns();
      expect(stored).toHaveLength(1);
      expect(stored[0].platform).toBe('web');
      expect(stored[0].id).toBe('test-1');
      expect(stored[0].name).toBe('Test Campaign');

      global.window = originalWindow;
    });

    it('should create Electron campaign with file path when in Electron', () => {
      // Mock window with ipcRenderer (Electron environment)
      const originalWindow = global.window;
      global.window = { ipcRenderer: {} } as any;

      addRecentCampaignWithPlatform('test-1', 'Test Campaign', '/path/to/campaign.graphium');

      const stored = getRecentCampaigns();
      expect(stored).toHaveLength(1);
      expect(stored[0].platform).toBe('electron');
      if (stored[0].platform === 'electron') {
        expect(stored[0].filePath).toBe('/path/to/campaign.graphium');
      }

      global.window = originalWindow;
    });

    it('should create web campaign in Electron if no file path provided', () => {
      // Mock window with ipcRenderer but no file path
      const originalWindow = global.window;
      global.window = { ipcRenderer: {} } as any;

      addRecentCampaignWithPlatform('test-1', 'Test Campaign');

      const stored = getRecentCampaigns();
      expect(stored).toHaveLength(1);
      expect(stored[0].platform).toBe('web');

      global.window = originalWindow;
    });
  });

  describe('removeRecentCampaign', () => {
    it('should remove campaign by id', () => {
      const campaign1: RecentCampaign = {
        platform: 'web',
        id: 'test-1',
        name: 'Campaign 1',
        lastOpened: 1000,
      };
      const campaign2: RecentCampaign = {
        platform: 'web',
        id: 'test-2',
        name: 'Campaign 2',
        lastOpened: 2000,
      };

      addRecentCampaign(campaign1);
      addRecentCampaign(campaign2);

      removeRecentCampaign('test-1');

      const stored = getRecentCampaigns();
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe('test-2');
    });

    it('should handle removing non-existent campaign', () => {
      const campaign: RecentCampaign = {
        platform: 'web',
        id: 'test-1',
        name: 'Campaign 1',
        lastOpened: 1000,
      };

      addRecentCampaign(campaign);
      removeRecentCampaign('non-existent');

      const stored = getRecentCampaigns();
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe('test-1');
    });

    it('should handle removing from empty list', () => {
      removeRecentCampaign('test-1');

      const stored = getRecentCampaigns();
      expect(stored).toEqual([]);
    });
  });

  describe('clearRecentCampaigns', () => {
    it('should clear all campaigns', () => {
      const campaign1: RecentCampaign = {
        platform: 'web',
        id: 'test-1',
        name: 'Campaign 1',
        lastOpened: 1000,
      };
      const campaign2: RecentCampaign = {
        platform: 'web',
        id: 'test-2',
        name: 'Campaign 2',
        lastOpened: 2000,
      };

      addRecentCampaign(campaign1);
      addRecentCampaign(campaign2);

      clearRecentCampaigns();

      const stored = getRecentCampaigns();
      expect(stored).toEqual([]);
    });

    it('should handle clearing when already empty', () => {
      clearRecentCampaigns();

      const stored = getRecentCampaigns();
      expect(stored).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle localStorage errors gracefully in getRecentCampaigns', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock localStorage.getItem to throw
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = vi.fn(() => {
        throw new Error('Storage error');
      });

      const campaigns = getRecentCampaigns();
      expect(campaigns).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();

      Storage.prototype.getItem = originalGetItem;
      consoleErrorSpy.mockRestore();
    });

    it('should handle localStorage errors gracefully in addRecentCampaign', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock localStorage.setItem to throw
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        throw new Error('Storage error');
      });

      const campaign: RecentCampaign = {
        platform: 'web',
        id: 'test-1',
        name: 'Test Campaign',
        lastOpened: Date.now(),
      };

      addRecentCampaign(campaign); // Should not throw
      expect(consoleErrorSpy).toHaveBeenCalled();

      Storage.prototype.setItem = originalSetItem;
      consoleErrorSpy.mockRestore();
    });
  });
});
