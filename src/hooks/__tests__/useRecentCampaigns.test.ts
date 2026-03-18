import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useRecentCampaigns } from '../useRecentCampaigns';

// Mock the recentCampaigns utility with simple vi.fn() mocks
vi.mock('../../utils/recentCampaigns', () => ({
  getRecentCampaigns: vi.fn(() => []),
  addRecentCampaignWithPlatform: vi.fn(),
  removeRecentCampaign: vi.fn(),
}));

// Import mocked functions for assertion and control
import {
  getRecentCampaigns,
  addRecentCampaignWithPlatform,
  removeRecentCampaign,
} from '../../utils/recentCampaigns';

const mockGetRecent = vi.mocked(getRecentCampaigns);
const mockAddRecent = vi.mocked(addRecentCampaignWithPlatform);
const mockRemoveRecent = vi.mocked(removeRecentCampaign);

describe('useRecentCampaigns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return empty list
    mockGetRecent.mockReturnValue([]);
  });

  it('returns initial empty list from storage', () => {
    const { result } = renderHook(() => useRecentCampaigns());
    expect(result.current.recentCampaigns).toEqual([]);
  });

  it('returns campaigns from storage on mount', () => {
    const campaigns = [{ id: '1', name: 'Campaign 1', lastOpened: 1000, platform: 'web' as const }];
    // Use mockReturnValue (not Once) — StrictMode double-invokes the useState
    // initializer, so mockReturnValueOnce would be consumed on the first call
    // and the second call would fall through to the default empty array.
    mockGetRecent.mockReturnValue(campaigns);

    const { result } = renderHook(() => useRecentCampaigns());
    expect(result.current.recentCampaigns).toEqual(campaigns);

    // Restore default for subsequent tests
    mockGetRecent.mockReturnValue([]);
  });

  it('addRecent calls utility and refreshes list', () => {
    const { result } = renderHook(() => useRecentCampaigns());
    expect(result.current.recentCampaigns).toEqual([]);

    // After addRecent, getRecentCampaigns is called again for refresh
    const updatedList = [
      { id: 'new-id', name: 'New Campaign', lastOpened: 2000, platform: 'web' as const },
    ];
    mockGetRecent.mockReturnValueOnce(updatedList);

    act(() => {
      result.current.addRecent('new-id', 'New Campaign');
    });

    expect(mockAddRecent).toHaveBeenCalledWith('new-id', 'New Campaign');
    expect(result.current.recentCampaigns).toEqual(updatedList);
  });

  it('removeRecent calls utility and refreshes list', () => {
    // Use mockReturnValue (not Once) — StrictMode-resilient (see mount test comment)
    mockGetRecent.mockReturnValue([
      { id: 'to-remove', name: 'Remove Me', lastOpened: 1000, platform: 'web' as const },
    ]);

    const { result } = renderHook(() => useRecentCampaigns());
    expect(result.current.recentCampaigns).toHaveLength(1);

    // After removal, return empty list
    mockGetRecent.mockReturnValueOnce([]);

    act(() => {
      result.current.removeRecent('to-remove');
    });

    expect(mockRemoveRecent).toHaveBeenCalledWith('to-remove');
    expect(result.current.recentCampaigns).toHaveLength(0);
  });

  it('refresh reloads from storage', () => {
    const { result } = renderHook(() => useRecentCampaigns());
    expect(result.current.recentCampaigns).toEqual([]);

    // Simulate external mutation by changing what getRecentCampaigns returns
    mockGetRecent.mockReturnValueOnce([
      { id: 'ext', name: 'External', lastOpened: 2000, platform: 'web' as const },
    ]);

    act(() => {
      result.current.refresh();
    });

    expect(result.current.recentCampaigns).toHaveLength(1);
    expect(result.current.recentCampaigns[0].id).toBe('ext');
  });
});
