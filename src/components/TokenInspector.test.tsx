import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TokenInspector from './TokenInspector';
import { useGameStore } from '../store/gameStore';

// Mock dependencies
vi.mock('../store/gameStore', () => ({
  useGameStore: vi.fn(),
}));

vi.mock('../hooks/useMediaQuery', () => ({
  useIsMobile: () => false,
}));

vi.mock('./MobileBottomSheet', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock getStorage
vi.mock('../services/storage', () => ({
  getStorage: () => ({
    updateLibraryMetadata: mockUpdateLibraryMetadata,
  }),
}));

const mockUpdateLibraryMetadata = vi.fn().mockResolvedValue({});

describe('TokenInspector', () => {
  const mockUpdateTokenProperties = vi.fn();
  const mockUpdateLibraryToken = vi.fn();
  const mockShowToast = vi.fn();

  const mockLibraryItem = {
    id: 'lib-1',
    name: 'Goblin Warrior',
    src: 'goblin.png',
    thumbnailSrc: 'thumb.png',
    category: 'Monsters',
    tags: [],
    dateAdded: Date.now(),
    defaultType: 'NPC' as const,
    defaultVisionRadius: 0,
  };

  const mockToken = {
    id: 'token-1',
    x: 0,
    y: 0,
    src: 'goblin.png',
    libraryItemId: 'lib-1',
    // Inherits name, type, visionRadius from libraryItem
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useGameStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: any) => {
      const state = {
        tokens: [mockToken],
        campaign: {
          tokenLibrary: [mockLibraryItem],
        },
        updateTokenProperties: mockUpdateTokenProperties,
        updateLibraryToken: mockUpdateLibraryToken,
        showToast: mockShowToast,
      };
      return selector(state);
    });
  });

  it('inherits values from library item', () => {
    render(<TokenInspector selectedTokenIds={['token-1']} />);

    // Should show library name
    expect(screen.getByText('Goblin Warrior')).toBeDefined();

    // Should show inherited type and vision
    expect(screen.getByText('Type: NPC')).toBeDefined();
    expect(screen.getByText('Vision: 0 ft')).toBeDefined();
  });

  it('uses instance overrides when present', () => {
    const overrideToken = {
      ...mockToken,
      name: 'Boss Goblin',
      type: 'PC' as const,
      visionRadius: 60,
    };

    (useGameStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: any) => {
      const state = {
        tokens: [overrideToken],
        campaign: {
          tokenLibrary: [mockLibraryItem],
        },
        updateTokenProperties: mockUpdateTokenProperties,
        updateLibraryToken: mockUpdateLibraryToken,
        showToast: mockShowToast,
      };
      return selector(state);
    });

    render(<TokenInspector selectedTokenIds={['token-1']} />);

    expect(screen.getByText('Boss Goblin')).toBeDefined();
    expect(screen.getByText('Type: PC')).toBeDefined();
    expect(screen.getByText('Vision: 60 ft')).toBeDefined();
  });

  it('re-renders without closing edit mode when token properties update', () => {
    // 1. Initial Render
    const { rerender } = render(<TokenInspector selectedTokenIds={['token-1']} />);

    // 2. Enter Edit Mode
    fireEvent.click(screen.getByText('Edit Properties'));
    const input = screen.getByDisplayValue('Goblin Warrior');

    // 3. Simulate User Typing
    // This triggers handleNameChange -> updates local state AND calls updateTokenProperties
    fireEvent.change(input, { target: { value: 'Goblin Updated' } });

    // Check local state updated immediately
    expect((input as HTMLInputElement).value).toBe('Goblin Updated');
    expect(mockUpdateTokenProperties).toHaveBeenCalledWith('token-1', { name: 'Goblin Updated' });

    // 4. Simulate store update (reaction to the action)
    const updatedToken = { ...mockToken, name: 'Goblin Updated' };
    (useGameStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: any) => {
      const state = {
        tokens: [updatedToken],
        campaign: { tokenLibrary: [mockLibraryItem] },
        updateTokenProperties: mockUpdateTokenProperties,
        updateLibraryToken: mockUpdateLibraryToken,
        showToast: mockShowToast,
      };
      return selector(state);
    });

    // Rerender with new store data
    rerender(<TokenInspector selectedTokenIds={['token-1']} />);

    // 5. Verify we are STILL in edit mode
    // Input should still be visible and contain the value
    expect(screen.getByDisplayValue('Goblin Updated')).toBeDefined();
    expect(screen.queryByText('Edit Properties')).toBeNull();
  });

  it('saves defaults to library', async () => {
    render(<TokenInspector selectedTokenIds={['token-1']} />);

    // Enter edit mode
    fireEvent.click(screen.getByText('Edit Properties'));

    // Change some values
    fireEvent.change(screen.getByDisplayValue('Goblin Warrior'), {
      target: { value: 'Goblin Elite' },
    });

    // Click "Save Defaults to Library"
    const saveButton = screen.getByText('Save Defaults to Library');
    await fireEvent.click(saveButton);

    // Verify storage update called (persistence)
    await waitFor(() => {
      expect(mockUpdateLibraryMetadata).toHaveBeenCalledWith(
        'lib-1',
        expect.objectContaining({
          name: 'Goblin Elite',
          defaultType: 'NPC',
          defaultVisionRadius: 0,
        }),
      );
    });

    // Verify store update called (UI sync)
    expect(mockUpdateLibraryToken).toHaveBeenCalledWith(
      'lib-1',
      expect.objectContaining({
        name: 'Goblin Elite',
        defaultType: 'NPC',
        defaultVisionRadius: 0,
      }),
    );

    // Verify toast
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('Updated'), 'success');
  });
});
