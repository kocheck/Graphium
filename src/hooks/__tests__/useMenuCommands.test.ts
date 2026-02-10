import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useMenuCommands } from '../useMenuCommands';
import { useUiStore } from '../../store/uiStore';

// Mock campaignService
vi.mock('../../services/campaignService', () => ({
  saveCampaign: vi.fn().mockResolvedValue(true),
  loadCampaign: vi.fn().mockResolvedValue(true),
  startNewCampaign: vi.fn(),
}));

import { saveCampaign, loadCampaign, startNewCampaign } from '../../services/campaignService';

const mockSaveCampaign = vi.mocked(saveCampaign);
const mockLoadCampaign = vi.mocked(loadCampaign);
const mockStartNewCampaign = vi.mocked(startNewCampaign);

describe('useMenuCommands', () => {
  // The test setup (src/test/setup.ts) already defines window.ipcRenderer
  // as a mock with on/off/send/invoke. We use it directly.
  let mockIpcOn: ReturnType<typeof vi.fn>;
  let mockIpcOff: ReturnType<typeof vi.fn>;
  const ipcHandlers: Record<string, (...args: unknown[]) => void> = {};

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset uiStore
    useUiStore.setState({
      showResourceMonitor: false,
      dungeonDialog: false,
    });

    // Get references to the existing mock ipcRenderer from test setup
    const ipc = window.ipcRenderer!;
    mockIpcOn = ipc.on as ReturnType<typeof vi.fn>;
    mockIpcOff = ipc.off as ReturnType<typeof vi.fn>;

    // Capture handlers when on() is called
    mockIpcOn.mockImplementation((channel: string, handler: (...args: unknown[]) => void) => {
      ipcHandlers[channel] = handler;
    });

    // Clear captured handlers
    for (const key of Object.keys(ipcHandlers)) {
      delete ipcHandlers[key];
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers 6 IPC listeners on mount', () => {
    renderHook(() => useMenuCommands({ onShowAbout: vi.fn() }));

    expect(mockIpcOn).toHaveBeenCalledTimes(6);
    expect(mockIpcOn).toHaveBeenCalledWith('MENU_SAVE_CAMPAIGN', expect.any(Function));
    expect(mockIpcOn).toHaveBeenCalledWith('MENU_LOAD_CAMPAIGN', expect.any(Function));
    expect(mockIpcOn).toHaveBeenCalledWith('MENU_NEW_CAMPAIGN', expect.any(Function));
    expect(mockIpcOn).toHaveBeenCalledWith('MENU_TOGGLE_RESOURCE_MONITOR', expect.any(Function));
    expect(mockIpcOn).toHaveBeenCalledWith('MENU_GENERATE_DUNGEON', expect.any(Function));
    expect(mockIpcOn).toHaveBeenCalledWith('MENU_SHOW_ABOUT', expect.any(Function));
  });

  it('unregisters all IPC listeners on unmount', () => {
    const { unmount } = renderHook(() => useMenuCommands({ onShowAbout: vi.fn() }));
    unmount();

    expect(mockIpcOff).toHaveBeenCalledTimes(6);
    expect(mockIpcOff).toHaveBeenCalledWith('MENU_SAVE_CAMPAIGN', expect.any(Function));
    expect(mockIpcOff).toHaveBeenCalledWith('MENU_LOAD_CAMPAIGN', expect.any(Function));
    expect(mockIpcOff).toHaveBeenCalledWith('MENU_NEW_CAMPAIGN', expect.any(Function));
    expect(mockIpcOff).toHaveBeenCalledWith('MENU_TOGGLE_RESOURCE_MONITOR', expect.any(Function));
    expect(mockIpcOff).toHaveBeenCalledWith('MENU_GENERATE_DUNGEON', expect.any(Function));
    expect(mockIpcOff).toHaveBeenCalledWith('MENU_SHOW_ABOUT', expect.any(Function));
  });

  it('MENU_SAVE_CAMPAIGN triggers saveCampaign', () => {
    renderHook(() => useMenuCommands({ onShowAbout: vi.fn() }));

    ipcHandlers['MENU_SAVE_CAMPAIGN']();
    expect(mockSaveCampaign).toHaveBeenCalledTimes(1);
  });

  it('MENU_LOAD_CAMPAIGN triggers loadCampaign', () => {
    renderHook(() => useMenuCommands({ onShowAbout: vi.fn() }));

    ipcHandlers['MENU_LOAD_CAMPAIGN']();
    expect(mockLoadCampaign).toHaveBeenCalledTimes(1);
  });

  it('MENU_NEW_CAMPAIGN triggers startNewCampaign', () => {
    renderHook(() => useMenuCommands({ onShowAbout: vi.fn() }));

    ipcHandlers['MENU_NEW_CAMPAIGN']();
    expect(mockStartNewCampaign).toHaveBeenCalledTimes(1);
  });

  it('MENU_TOGGLE_RESOURCE_MONITOR toggles resource monitor', () => {
    renderHook(() => useMenuCommands({ onShowAbout: vi.fn() }));

    expect(useUiStore.getState().showResourceMonitor).toBe(false);

    ipcHandlers['MENU_TOGGLE_RESOURCE_MONITOR']();
    expect(useUiStore.getState().showResourceMonitor).toBe(true);

    ipcHandlers['MENU_TOGGLE_RESOURCE_MONITOR']();
    expect(useUiStore.getState().showResourceMonitor).toBe(false);
  });

  it('MENU_GENERATE_DUNGEON shows dungeon dialog', () => {
    renderHook(() => useMenuCommands({ onShowAbout: vi.fn() }));

    ipcHandlers['MENU_GENERATE_DUNGEON']();
    expect(useUiStore.getState().dungeonDialog).toBe(true);
  });

  it('MENU_SHOW_ABOUT calls onShowAbout callback', () => {
    const onShowAbout = vi.fn();
    renderHook(() => useMenuCommands({ onShowAbout }));

    ipcHandlers['MENU_SHOW_ABOUT']();
    expect(onShowAbout).toHaveBeenCalledTimes(1);
  });

  it('uses ref for onShowAbout to avoid re-registering', () => {
    const onShowAbout1 = vi.fn();
    const onShowAbout2 = vi.fn();

    const { rerender } = renderHook(({ onShowAbout }) => useMenuCommands({ onShowAbout }), {
      initialProps: { onShowAbout: onShowAbout1 },
    });

    // Should only register once (6 channels)
    expect(mockIpcOn).toHaveBeenCalledTimes(6);

    // Rerender with different callback
    rerender({ onShowAbout: onShowAbout2 });

    // Should NOT re-register (still 6 — stable [] deps)
    expect(mockIpcOn).toHaveBeenCalledTimes(6);

    // But calling MENU_SHOW_ABOUT should use the new callback via ref
    ipcHandlers['MENU_SHOW_ABOUT']();
    expect(onShowAbout1).not.toHaveBeenCalled();
    expect(onShowAbout2).toHaveBeenCalledTimes(1);
  });
});
