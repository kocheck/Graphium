import { describe, it, expect, beforeEach, vi } from 'vitest';

import { saveCampaign, loadCampaign, startNewCampaign } from '../campaignService';
import { useGameStore } from '../../store/gameStore';
import { useUiStore } from '../../store/uiStore';

import type { Campaign } from '../../types/domain';

// Mock dependencies
vi.mock('../storage', () => ({
  getStorage: vi.fn(),
}));

vi.mock('../../utils/recentCampaigns', () => ({
  addRecentCampaignWithPlatform: vi.fn(),
}));

vi.mock('../../utils/systemMessages', () => ({
  rollForMessage: (key: string) => `Mock: ${key}`,
}));

// Import mocked modules for assertion
import { getStorage } from '../storage';
import { addRecentCampaignWithPlatform } from '../../utils/recentCampaigns';

const mockGetStorage = vi.mocked(getStorage);
const mockAddRecent = vi.mocked(addRecentCampaignWithPlatform);

function createTestCampaign(overrides?: Partial<Campaign>): Campaign {
  const mapId = 'test-map-1';
  return {
    id: 'test-campaign-1',
    name: 'Test Campaign',
    maps: {
      [mapId]: {
        id: mapId,
        name: 'Map 1',
        tokens: [],
        drawings: [],
        doors: [],
        stairs: [],
        map: null,
        gridSize: 50,
        gridType: 'LINES',
        exploredRegions: [],
        isDaylightMode: false,
      },
    },
    activeMapId: mapId,
    tokenLibrary: [],
    ...overrides,
  };
}

describe('campaignService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress expected console.error from error-path tests
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Reset uiStore
    useUiStore.setState({
      toast: null,
      confirmDialog: null,
    });

    // Reset gameStore with a test campaign
    const campaign = createTestCampaign();
    useGameStore.setState({
      campaign,
      tokens: [],
      drawings: [],
      doors: [],
      stairs: [],
      gridSize: 50,
      gridType: 'LINES',
      map: null,
      exploredRegions: [],
      isDaylightMode: false,
      isCalibrating: false,
      activeVisionPolygons: [],
      activeMeasurement: null,
      broadcastMeasurement: false,
      dmMeasurement: null,
    });
  });

  describe('saveCampaign', () => {
    it('saves campaign and shows success toast', async () => {
      const mockStorage = {
        saveCampaign: vi.fn().mockResolvedValue(true),
      };
      mockGetStorage.mockReturnValue(mockStorage as ReturnType<typeof getStorage>);

      const result = await saveCampaign();

      expect(result).toBe(true);
      expect(mockStorage.saveCampaign).toHaveBeenCalledTimes(1);
      expect(mockAddRecent).toHaveBeenCalledWith('test-campaign-1', 'Test Campaign');
      expect(useUiStore.getState().toast?.type).toBe('success');
    });

    it('calls syncActiveMapToCampaign before saving', async () => {
      const syncSpy = vi.fn();
      useGameStore.setState({ syncActiveMapToCampaign: syncSpy });

      const mockStorage = {
        saveCampaign: vi.fn().mockResolvedValue(true),
      };
      mockGetStorage.mockReturnValue(mockStorage as ReturnType<typeof getStorage>);

      await saveCampaign();

      expect(syncSpy).toHaveBeenCalledTimes(1);
    });

    it('returns false when storage returns false', async () => {
      const mockStorage = {
        saveCampaign: vi.fn().mockResolvedValue(false),
      };
      mockGetStorage.mockReturnValue(mockStorage as ReturnType<typeof getStorage>);

      const result = await saveCampaign();

      expect(result).toBe(false);
      expect(mockAddRecent).not.toHaveBeenCalled();
      expect(useUiStore.getState().toast).toBeNull();
    });

    it('returns false and shows error toast on exception', async () => {
      const mockStorage = {
        saveCampaign: vi.fn().mockRejectedValue(new Error('Disk full')),
      };
      mockGetStorage.mockReturnValue(mockStorage as ReturnType<typeof getStorage>);

      const result = await saveCampaign();

      expect(result).toBe(false);
      expect(useUiStore.getState().toast?.type).toBe('error');
    });
  });

  describe('loadCampaign', () => {
    it('loads campaign, hydrates store, and shows success toast', async () => {
      const loadedCampaign = createTestCampaign({
        id: 'loaded-campaign',
        name: 'Loaded Campaign',
      });
      const mockStorage = {
        loadCampaign: vi.fn().mockResolvedValue(loadedCampaign),
      };
      mockGetStorage.mockReturnValue(mockStorage as ReturnType<typeof getStorage>);

      const loadCampaignAction = vi.fn();
      useGameStore.setState({ loadCampaign: loadCampaignAction });

      const result = await loadCampaign();

      expect(result).toBe(true);
      expect(loadCampaignAction).toHaveBeenCalledWith(loadedCampaign);
      expect(mockAddRecent).toHaveBeenCalledWith('loaded-campaign', 'Loaded Campaign');
      expect(useUiStore.getState().toast?.type).toBe('success');
    });

    it('returns false when storage returns null (user cancelled)', async () => {
      const mockStorage = {
        loadCampaign: vi.fn().mockResolvedValue(null),
      };
      mockGetStorage.mockReturnValue(mockStorage as ReturnType<typeof getStorage>);

      const result = await loadCampaign();

      expect(result).toBe(false);
      expect(mockAddRecent).not.toHaveBeenCalled();
      expect(useUiStore.getState().toast).toBeNull();
    });

    it('returns false and shows error toast on exception', async () => {
      const mockStorage = {
        loadCampaign: vi.fn().mockRejectedValue(new Error('File corrupted')),
      };
      mockGetStorage.mockReturnValue(mockStorage as ReturnType<typeof getStorage>);

      const result = await loadCampaign();

      expect(result).toBe(false);
      expect(useUiStore.getState().toast?.type).toBe('error');
    });
  });

  describe('startNewCampaign', () => {
    it('shows confirmation dialog with correct message', () => {
      startNewCampaign();

      const dialog = useUiStore.getState().confirmDialog;
      expect(dialog).not.toBeNull();
      expect(dialog?.message).toBe('Create a new campaign? Any unsaved changes will be lost.');
      expect(dialog?.confirmText).toBe('Create New Campaign');
    });

    it('calls resetToNewCampaign when confirmed', () => {
      const resetSpy = vi.fn();
      useGameStore.setState({ resetToNewCampaign: resetSpy });

      startNewCampaign();

      // Simulate user confirming
      const dialog = useUiStore.getState().confirmDialog;
      expect(dialog).not.toBeNull();
      dialog?.onConfirm();

      expect(resetSpy).toHaveBeenCalledTimes(1);
    });
  });
});
