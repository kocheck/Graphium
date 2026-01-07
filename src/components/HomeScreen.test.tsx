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
  const mockResetToNewCampaign = vi.fn();
  const mockSetGridSize = vi.fn();

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
    vi.spyOn(useGameStore.getState(), 'resetToNewCampaign').mockImplementation(mockResetToNewCampaign);
    vi.spyOn(useGameStore.getState(), 'setGridSize').mockImplementation(mockSetGridSize);

    // Mock recentCampaigns to return empty by default
    vi.mocked(recentCampaignsModule.getRecentCampaigns).mockReturnValue([]);

    // Mock storage
    vi.mocked(storageModule.getStorage).mockReturnValue({
      getPlatform: () => 'web',
      loadCampaign: vi.fn(),
      getThemeMode: vi.fn().mockResolvedValue('system'),
      setThemeMode: vi.fn().mockResolvedValue(undefined),
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

      expect(screen.getByAltText('Graphium')).toBeInTheDocument();
      expect(screen.getByText(/Virtual Tabletop for/)).toBeInTheDocument();
    });

    it('should render primary action buttons', () => {
      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      expect(screen.getByText('New Campaign')).toBeInTheDocument();
      expect(screen.getByText('Load Campaign')).toBeInTheDocument();
      expect(screen.getByText('Generate Dungeon')).toBeInTheDocument();
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
        getThemeMode: vi.fn().mockResolvedValue('system'),
        setThemeMode: vi.fn().mockResolvedValue(undefined),
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
        screen.getByText(/Get greater portability, offline support, and privacy/),
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
        getThemeMode: vi.fn().mockResolvedValue('system'),
        setThemeMode: vi.fn().mockResolvedValue(undefined),
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
          'Recent campaigns are a reference list only right now. Use "Load Campaign" and select the matching .graphium file.',
          'info',
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
        getThemeMode: vi.fn().mockResolvedValue('system'),
        setThemeMode: vi.fn().mockResolvedValue(undefined),
      } as any);

      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      const loadCampaignButton = screen.getByText('Load Campaign').closest('button');
      fireEvent.click(loadCampaignButton!);

      await waitFor(() => {
        expect(mockLoadCampaignFn).toHaveBeenCalledTimes(1);
        expect(mockLoadCampaign).toHaveBeenCalledWith(mockCampaign);
        expect(recentCampaignsModule.addRecentCampaignWithPlatform).toHaveBeenCalledWith(
          'loaded-campaign',
          'Loaded Campaign',
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
        getThemeMode: vi.fn().mockResolvedValue('system'),
        setThemeMode: vi.fn().mockResolvedValue(undefined),
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
        getThemeMode: vi.fn().mockResolvedValue('system'),
        setThemeMode: vi.fn().mockResolvedValue(undefined),
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

      const newCampaignButton = screen.getByLabelText('Create a new campaign');
      const loadCampaignButton = screen.getByLabelText('Load an existing campaign');

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

    it('should have ARIA labels on Templates button', () => {
      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      const templatesButton = screen.getByLabelText('Browse campaign templates');
      expect(templatesButton).toBeInTheDocument();
    });

    it('should have ARIA labels on theme switcher', () => {
      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      const themeSwitcher = screen.getByLabelText(
        /Current theme: .*\. Click to cycle themes\./i
      );
      expect(themeSwitcher).toBeInTheDocument();
    });
  });

  describe('keyboard shortcuts', () => {
    it('should open templates modal when Ctrl+T is pressed', async () => {
      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      // Press Ctrl+T
      fireEvent.keyDown(window, { key: 't', ctrlKey: true });

      await waitFor(() => {
        expect(screen.getByText('Campaign Templates')).toBeInTheDocument();
      });
    });

    it('should close templates modal when Escape is pressed', async () => {
      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      // Open templates modal
      fireEvent.keyDown(window, { key: 't', ctrlKey: true });

      await waitFor(() => {
        expect(screen.getByText('Campaign Templates')).toBeInTheDocument();
      });

      // Press Escape
      fireEvent.keyDown(window, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByText('Campaign Templates')).not.toBeInTheDocument();
      });
    });

    it('should trigger New Campaign when Ctrl+N is pressed', async () => {
      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      fireEvent.keyDown(window, { key: 'n', ctrlKey: true });

      await waitFor(() => {
        expect(mockOnStartEditor).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('templates feature', () => {
    it('should render Templates action card', () => {
      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      expect(screen.getByText('Templates')).toBeInTheDocument();
      // Tooltip content is only shown on hover, so we verify the button has the aria-label
      const templatesButton = screen.getByLabelText('Browse campaign templates');
      expect(templatesButton).toBeInTheDocument();
    });

    it('should open templates modal when Templates card is clicked', async () => {
      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      const templatesButton = screen.getByText('Templates').closest('button');
      fireEvent.click(templatesButton!);

      await waitFor(() => {
        expect(screen.getByText('Campaign Templates')).toBeInTheDocument();
        expect(screen.getByText('Classic Dungeon')).toBeInTheDocument();
        expect(screen.getByText('Wilderness Map')).toBeInTheDocument();
        expect(screen.getByText('Starting Tavern')).toBeInTheDocument();
        expect(screen.getByText('Combat Arena')).toBeInTheDocument();
      });
    });

    it('should close templates modal when Close button is clicked', async () => {
      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      const templatesButton = screen.getByText('Templates').closest('button');
      fireEvent.click(templatesButton!);

      await waitFor(() => {
        expect(screen.getByText('Campaign Templates')).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText('Close templates');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('Campaign Templates')).not.toBeInTheDocument();
      });
    });

    it('should start editor when a template is selected', async () => {
      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      // Open templates modal
      const templatesButton = screen.getByText('Templates').closest('button');
      fireEvent.click(templatesButton!);

      await waitFor(() => {
        expect(screen.getByText('Classic Dungeon')).toBeInTheDocument();
      });

      // Select a template
      const dungeonTemplate = screen.getByText('Classic Dungeon').closest('button');
      fireEvent.click(dungeonTemplate!);

      await waitFor(() => {
        expect(mockOnStartEditor).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('Campaign Templates')).not.toBeInTheDocument();
        // Verify store methods were called with correct template values
        expect(mockResetToNewCampaign).toHaveBeenCalledTimes(1);
        expect(mockSetGridSize).toHaveBeenCalledWith(50); // Classic Dungeon has cellSize: 50
      });
    });
  });

  describe('recent campaigns search', () => {
    it('should show search input when 6+ campaigns exist', () => {
      const campaigns = Array.from({ length: 7 }, (_, i) => ({
        platform: 'web' as const,
        id: `campaign-${i}`,
        name: `Campaign ${i}`,
        lastOpened: Date.now() - i * 1000,
      }));

      vi.mocked(recentCampaignsModule.getRecentCampaigns).mockReturnValue(campaigns);

      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      const searchInput = screen.getByPlaceholderText(/Search campaigns/i);
      expect(searchInput).toBeInTheDocument();
    });

    it('should not show search input when fewer than 6 campaigns exist', () => {
      const campaigns = Array.from({ length: 5 }, (_, i) => ({
        platform: 'web' as const,
        id: `campaign-${i}`,
        name: `Campaign ${i}`,
        lastOpened: Date.now() - i * 1000,
      }));

      vi.mocked(recentCampaignsModule.getRecentCampaigns).mockReturnValue(campaigns);

      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      const searchInput = screen.queryByPlaceholderText(/Search campaigns/i);
      expect(searchInput).not.toBeInTheDocument();
    });

    it('should filter campaigns based on search query', async () => {
      const campaigns = [
        { platform: 'web' as const, id: '1', name: 'Dragon Quest', lastOpened: Date.now() },
        { platform: 'web' as const, id: '2', name: 'Goblin Camp', lastOpened: Date.now() },
        { platform: 'web' as const, id: '3', name: 'Dragon Heist', lastOpened: Date.now() },
        { platform: 'web' as const, id: '4', name: 'Lost Mines', lastOpened: Date.now() },
        { platform: 'web' as const, id: '5', name: 'Curse of Strahd', lastOpened: Date.now() },
        { platform: 'web' as const, id: '6', name: 'Tomb of Annihilation', lastOpened: Date.now() },
      ];

      vi.mocked(recentCampaignsModule.getRecentCampaigns).mockReturnValue(campaigns);

      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      const searchInput = screen.getByPlaceholderText(/Search campaigns/i);

      // Filter for "Dragon"
      fireEvent.change(searchInput, { target: { value: 'dragon' } });

      await waitFor(() => {
        expect(screen.getByText('Dragon Quest')).toBeInTheDocument();
        expect(screen.getByText('Dragon Heist')).toBeInTheDocument();
        expect(screen.queryByText('Goblin Camp')).not.toBeInTheDocument();
        expect(screen.queryByText('Lost Mines')).not.toBeInTheDocument();
      });
    });
  });

  describe('platform-specific download banners', () => {
    it('should show Windows download banner on Windows web platform', () => {
      Object.defineProperty(window, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        writable: true,
        configurable: true,
      });

      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      expect(screen.getByText('Download the Windows App')).toBeInTheDocument();
      expect(
        screen.getByText(
          /Get greater portability, offline support, and privacy with the native desktop application\./i
        )
      ).toBeInTheDocument();
    });

    it('should show Linux download banner on Linux web platform', () => {
      Object.defineProperty(window, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
        },
        writable: true,
        configurable: true,
      });

      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      expect(screen.getByText('Download for Linux')).toBeInTheDocument();
    });

    it('should show Mac download banner on Mac web platform', () => {
      Object.defineProperty(window, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        },
        writable: true,
        configurable: true,
      });

      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      expect(screen.getByText('Download the Mac App')).toBeInTheDocument();
    });

    it('should not show download banner on Electron', () => {
      vi.mocked(storageModule.getStorage).mockReturnValue({
        getPlatform: () => 'electron',
        loadCampaign: vi.fn(),
        getThemeMode: vi.fn().mockResolvedValue('system'),
        setThemeMode: vi.fn().mockResolvedValue(undefined),
      } as any);

      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      expect(screen.queryByText(/Download the .* App/)).not.toBeInTheDocument();
    });
  });

  describe('theme switcher', () => {
    beforeEach(() => {
      // Mock BroadcastChannel
      (global as any).BroadcastChannel = class {
        postMessage = vi.fn();
        close = vi.fn();
      };

      // Mock storage methods
      vi.mocked(storageModule.getStorage).mockReturnValue({
        getPlatform: () => 'web',
        loadCampaign: vi.fn(),
        getThemeMode: vi.fn().mockResolvedValue('dark'),
        setThemeMode: vi.fn().mockResolvedValue(undefined),
      } as any);
    });

    it('should render theme switcher in footer', () => {
      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      const themeSwitcher = screen.getByLabelText(
        /Current theme: .*\. Click to cycle themes\./i
      );
      expect(themeSwitcher).toBeInTheDocument();
    });

    it('should cycle through themes when clicked', async () => {
      const mockSetThemeMode = vi.fn().mockResolvedValue(undefined);
      vi.mocked(storageModule.getStorage).mockReturnValue({
        getPlatform: () => 'web',
        loadCampaign: vi.fn(),
        getThemeMode: vi.fn().mockResolvedValue('dark'),
        setThemeMode: mockSetThemeMode,
      } as any);

      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      // Wait for theme to load
      await waitFor(() => {
        expect(screen.getByLabelText(/Current theme: Dark\. Click to cycle themes\./i)).toBeInTheDocument();
      });

      const themeSwitcher = screen.getByLabelText(
        /Current theme: Dark\. Click to cycle themes\./i
      );

      // Click to cycle from dark → system
      fireEvent.click(themeSwitcher);

      await waitFor(() => {
        expect(mockSetThemeMode).toHaveBeenCalledWith('system');
      });
    });

    it('should handle theme switcher errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockSetThemeMode = vi.fn().mockRejectedValue(new Error('Failed to set theme'));
      vi.mocked(storageModule.getStorage).mockReturnValue({
        getPlatform: () => 'web',
        loadCampaign: vi.fn(),
        getThemeMode: vi.fn().mockResolvedValue('light'),
        setThemeMode: mockSetThemeMode,
      } as any);

      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      // Wait for theme to load
      await waitFor(() => {
        expect(screen.getByLabelText(/Current theme: Light\. Click to cycle themes\./i)).toBeInTheDocument();
      });

      const themeSwitcher = screen.getByLabelText(
        /Current theme: Light\. Click to cycle themes\./i
      );

      // Click to cycle theme
      fireEvent.click(themeSwitcher);

      await waitFor(() => {
        expect(mockSetThemeMode).toHaveBeenCalledWith('dark');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[HomeScreen] Failed to set theme:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('lite mode toggle', () => {
    beforeEach(() => {
      // Clear localStorage before each test
      localStorage.clear();
    });

    it('should render lite mode toggle in footer', () => {
      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      const liteToggle = screen.getByLabelText(
        /Full Mode enabled\. Click to enable lite mode\./i
      );
      expect(liteToggle).toBeInTheDocument();
    });

    it('should toggle lite mode when clicked', async () => {
      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      const liteToggle = screen.getByLabelText(
        /Full Mode enabled\. Click to enable lite mode\./i
      );

      // Click to enable lite mode
      fireEvent.click(liteToggle);

      await waitFor(() => {
        expect(localStorage.getItem('liteMode')).toBe('true');
      });

      // Check aria-label updated
      const liteToggleAfter = screen.getByLabelText(
        /Lite Mode enabled\. Click to enable full mode\./i
      );
      expect(liteToggleAfter).toBeInTheDocument();

      // Click to disable
      fireEvent.click(liteToggleAfter);

      await waitFor(() => {
        expect(localStorage.getItem('liteMode')).toBe('false');
      });
    });

    it('should persist lite mode preference from localStorage', () => {
      localStorage.setItem('liteMode', 'true');

      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      const liteToggle = screen.getByLabelText(
        /Lite Mode enabled\. Click to enable full mode\./i
      );
      expect(liteToggle).toBeInTheDocument();
    });

    it('should set data-lite-mode attribute on root element', async () => {
      render(<HomeScreen onStartEditor={mockOnStartEditor} />);

      const liteToggle = screen.getByLabelText(
        /Full Mode enabled\. Click to enable lite mode\./i
      );

      // Enable lite mode
      fireEvent.click(liteToggle);

      await waitFor(() => {
        const rootElement = document.querySelector('.home-screen');
        expect(rootElement?.getAttribute('data-lite-mode')).toBe('true');
      });
    });
  });
});
