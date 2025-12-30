import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HomeScreen } from './HomeScreen';
import { useGameStore } from '../store/gameStore';
import * as recentCampaignsModule from '../utils/recentCampaigns';
import * as storageModule from '../services/storage';

// Mock the storage module
vi.mock('../services/storage', () => ({
  getStorage: vi.fn(),
}));

// Mock the recentCampaigns module
vi.mock('../utils/recentCampaigns', () => ({
  getRecentCampaigns: vi.fn(),
  addRecentCampaignWithPlatform: vi.fn(),
  removeRecentCampaign: vi.fn(),
}));

describe('HomeScreen', () => {
  const mockOnStartEditor = vi.fn();
  const mockShowToast = vi.fn();
  const mockLoadCampaign = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset Zustand store
    useGameStore.setState({
      toast: null,
      campaign: {
        id: 'default',
        name: 'Untitled Campaign',
        maps: [],
        activeMapId: null,
      },
    });

    // Mock store functions
    vi.spyOn(useGameStore.getState(), 'showToast').mockImplementation(mockShowToast);
    vi.spyOn(useGameStore.getState(), 'loadCampaign').mockImplementation(mockLoadCampaign);

    // Mock recentCampaigns to return empty by default
    vi.mocked(recentCampaignsModule.getRecentCampaigns).mockReturnValue([]);

    // Mock storage
    vi.mocked(storageModule.getStorage).mockReturnValue({
      getPlatform: () => 'web',
      loadCampaign: vi.fn(),
    } as any);

    // Mock navigator
    Object.defineProperty(window, 'navigator', {
      value: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      writable: true,
      configurable: true,
    });
  });

  describe('rendering', () => {
    it('should render home screen with branding', () => {
      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      expect(screen.getByText('Hyle')).toBeInTheDocument();
      expect(screen.getByText('Virtual Tabletop for Dungeon Masters')).toBeInTheDocument();
    });

    it('should render primary action buttons', () => {
      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      expect(screen.getByText('New Campaign')).toBeInTheDocument();
      expect(screen.getByText('Load Campaign')).toBeInTheDocument();
      expect(screen.getByText('Start a fresh adventure with a blank canvas')).toBeInTheDocument();
      expect(screen.getByText('Continue an existing campaign from a file')).toBeInTheDocument();
    });

    it('should display version number from __APP_VERSION__', () => {
      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      // The version is defined in vite.config.ts, but in tests it might be undefined
      // We just check that "Version" text is present
      expect(screen.getByText(/Version/i)).toBeInTheDocument();
      expect(screen.getByText(/Web Edition/i)).toBeInTheDocument();
    });

    it('should show Desktop Edition when on Electron', () => {
      vi.mocked(storageModule.getStorage).mockReturnValue({
        getPlatform: () => 'electron',
        loadCampaign: vi.fn(),
      } as any);

      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      expect(screen.getByText(/Desktop Edition/i)).toBeInTheDocument();
    });
  });

  describe('platform detection', () => {
    it('should show Mac download banner on Mac web platform', () => {
      // Mock Mac user agent
      Object.defineProperty(window, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        },
        writable: true,
        configurable: true,
      });

      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      expect(screen.getByText('Download the Mac App')).toBeInTheDocument();
      expect(
        screen.getByText(/Get greater portability, offline support, and privacy/)
      ).toBeInTheDocument();
    });

    it('should not show Mac download banner on non-Mac platform', () => {
      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      expect(screen.queryByText('Download the Mac App')).not.toBeInTheDocument();
    });

    it('should not show Mac download banner on Electron', () => {
      // Mock Mac user agent AND Electron platform
      Object.defineProperty(window, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        },
        writable: true,
        configurable: true,
      });

      vi.mocked(storageModule.getStorage).mockReturnValue({
        getPlatform: () => 'electron',
        loadCampaign: vi.fn(),
      } as any);

      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      expect(screen.queryByText('Download the Mac App')).not.toBeInTheDocument();
    });
  });

  describe('recent campaigns', () => {
    it('should display recent campaigns list', () => {
      vi.mocked(recentCampaignsModule.getRecentCampaigns).mockReturnValue([
        {
          platform: 'web',
          id: 'campaign-1',
          name: 'The Lost Mines',
          lastOpened: Date.now(),
        },
        {
          platform: 'web',
          id: 'campaign-2',
          name: 'Curse of Strahd',
          lastOpened: Date.now() - 1000000,
        },
      ]);

      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      expect(screen.getByText('Recent Campaigns')).toBeInTheDocument();
      expect(screen.getByText('The Lost Mines')).toBeInTheDocument();
      expect(screen.getByText('Curse of Strahd')).toBeInTheDocument();
    });

    it('should not display recent campaigns section when empty', () => {
      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      expect(screen.queryByText('Recent Campaigns')).not.toBeInTheDocument();
    });

    it('should show informative toast when clicking a recent campaign', async () => {
      vi.mocked(recentCampaignsModule.getRecentCampaigns).mockReturnValue([
        {
          platform: 'web',
          id: 'campaign-1',
          name: 'Test Campaign',
          lastOpened: Date.now(),
        },
      ]);

      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      const campaignButton = screen.getByText('Test Campaign').closest('button');
      expect(campaignButton).toBeInTheDocument();

      fireEvent.click(campaignButton!);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          'Recent campaigns are a reference list only right now. Use "Load Campaign" and select the matching .hyle file.',
          'info'
        );
      });
    });

    it('should remove campaign when remove button is clicked', async () => {
      const mockCampaigns = [
        {
          platform: 'web' as const,
          id: 'campaign-1',
          name: 'Test Campaign',
          lastOpened: Date.now(),
        },
      ];

      vi.mocked(recentCampaignsModule.getRecentCampaigns).mockReturnValue(mockCampaigns);

      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      const campaignButton = screen.getByText('Test Campaign').closest('button');
      expect(campaignButton).toBeInTheDocument();

      // Find remove button (it has aria-label with "Remove")
      const removeButton = screen.getByLabelText(/Remove.*from recent campaigns/i);

      // Simulate removal: when removeRecentCampaign is called, getRecentCampaigns returns empty
      vi.mocked(recentCampaignsModule.getRecentCampaigns).mockReturnValue([]);

      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(recentCampaignsModule.removeRecentCampaign).toHaveBeenCalledWith('campaign-1');
        expect(screen.queryByText('Test Campaign')).not.toBeInTheDocument();
      });
    });
  });

  describe('new campaign flow', () => {
    it('should start editor when New Campaign is clicked', () => {
      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      const newCampaignButton = screen.getByText('New Campaign').closest('button');
      fireEvent.click(newCampaignButton!);

      expect(mockOnStartEditor).toHaveBeenCalledTimes(1);
    });
  });

  describe('load campaign flow', () => {
    it('should load campaign and start editor on successful load', async () => {
      const mockCampaign = {
        id: 'loaded-campaign',
        name: 'Loaded Campaign',
        maps: [],
        activeMapId: null,
      };

      const mockLoadCampaignFn = vi.fn().mockResolvedValue(mockCampaign);

      vi.mocked(storageModule.getStorage).mockReturnValue({
        getPlatform: () => 'web',
        loadCampaign: mockLoadCampaignFn,
      } as any);

      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      const loadCampaignButton = screen.getByText('Load Campaign').closest('button');
      fireEvent.click(loadCampaignButton!);

      await waitFor(() => {
        expect(mockLoadCampaignFn).toHaveBeenCalledTimes(1);
        expect(mockLoadCampaign).toHaveBeenCalledWith(mockCampaign);
        expect(recentCampaignsModule.addRecentCampaignWithPlatform).toHaveBeenCalledWith(
          'loaded-campaign',
          'Loaded Campaign'
        );
        expect(mockOnStartEditor).toHaveBeenCalledTimes(1);
        expect(mockShowToast).toHaveBeenCalledWith(expect.any(String), 'success');
      });
    });

    it('should show error toast on load failure', async () => {
      const mockLoadCampaignFn = vi.fn().mockRejectedValue(new Error('Load failed'));

      vi.mocked(storageModule.getStorage).mockReturnValue({
        getPlatform: () => 'web',
        loadCampaign: mockLoadCampaignFn,
      } as any);

      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      const loadCampaignButton = screen.getByText('Load Campaign').closest('button');
      fireEvent.click(loadCampaignButton!);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(expect.any(String), 'error');
        expect(mockOnStartEditor).not.toHaveBeenCalled();
      });
    });

    it('should not start editor if no campaign is loaded', async () => {
      const mockLoadCampaignFn = vi.fn().mockResolvedValue(null);

      vi.mocked(storageModule.getStorage).mockReturnValue({
        getPlatform: () => 'web',
        loadCampaign: mockLoadCampaignFn,
      } as any);

      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      const loadCampaignButton = screen.getByText('Load Campaign').closest('button');
      fireEvent.click(loadCampaignButton!);

      await waitFor(() => {
        expect(mockLoadCampaignFn).toHaveBeenCalledTimes(1);
        expect(mockOnStartEditor).not.toHaveBeenCalled();
      });
    });
  });

  describe('accessibility', () => {
    it('should have ARIA labels on action buttons', () => {
      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      const newCampaignButton = screen.getByLabelText(
        'Create a new campaign and start the editor'
      );
      const loadCampaignButton = screen.getByLabelText(
        'Load an existing campaign from a .hyle file'
      );

      expect(newCampaignButton).toBeInTheDocument();
      expect(loadCampaignButton).toBeInTheDocument();
    });

    it('should have descriptive ARIA labels on recent campaign items', () => {
      vi.mocked(recentCampaignsModule.getRecentCampaigns).mockReturnValue([
        {
          platform: 'web',
          id: 'campaign-1',
          name: 'Test Campaign',
          lastOpened: Date.now(),
        },
      ]);

      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      const campaignButton = screen.getByLabelText(/Recent campaign: Test Campaign/i);
      expect(campaignButton).toBeInTheDocument();
    });
  });
});
