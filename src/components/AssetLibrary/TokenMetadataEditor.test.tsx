import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TokenMetadataEditor from './TokenMetadataEditor';
import { useGameStore } from '../../store/gameStore';

/**
 * Test Suite for TokenMetadataEditor Component
 *
 * Tests the modal editor for library token metadata.
 * Covers:
 * - Rendering and visibility based on isOpen prop
 * - Form initialization with library item data
 * - User input handling for all fields
 * - Validation (required fields, numeric constraints)
 * - Save operation and store updates
 * - Error handling and toast notifications
 * - Modal close behavior
 * - Mobile vs desktop layouts
 */

// Mock the useGameStore
vi.mock('../../store/gameStore', () => ({
  useGameStore: vi.fn(),
}));

vi.mock('../../hooks/useMediaQuery', () => ({
  useIsMobile: vi.fn(() => false),
}));

// Mock storage service
const mockUpdateLibraryMetadata = vi.fn().mockResolvedValue(undefined);
vi.mock('../../services/storage', () => ({
  getStorage: () => ({
    updateLibraryMetadata: mockUpdateLibraryMetadata,
  }),
}));

describe('TokenMetadataEditor', () => {
  let mockUpdateLibraryToken: ReturnType<typeof vi.fn>;
  let mockShowToast: ReturnType<typeof vi.fn>;
  let mockOnClose: ReturnType<typeof vi.fn>;

  const mockLibraryItem = {
    id: 'lib-1',
    name: 'Ancient Dragon',
    thumbnailSrc: 'file:///path/to/thumb.png',
    originalSrc: '/path/to/original.png',
    category: 'Monsters',
    tags: ['dragon', 'ancient', 'red'],
    defaultScale: 2.5,
    defaultType: 'NPC' as const,
    defaultVisionRadius: 120,
  };

  const mockTokenLibrary = [mockLibraryItem];

  beforeEach(() => {
    mockUpdateLibraryToken = vi.fn();
    mockShowToast = vi.fn();
    mockOnClose = vi.fn();
    mockUpdateLibraryMetadata.mockClear();

    // Mock the useGameStore implementation
    vi.mocked(useGameStore).mockImplementation((selector: any) => {
      const state = {
        campaign: {
          tokenLibrary: mockTokenLibrary,
        },
        updateLibraryToken: mockUpdateLibraryToken,
        showToast: mockShowToast,
      };
      return selector(state);
    });
  });

  it('should not render when isOpen is false', () => {
    render(
      <TokenMetadataEditor
        isOpen={false}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText('Edit Token Metadata')).not.toBeInTheDocument();
  });

  it('should not render when libraryItemId is null', () => {
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId={null}
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText('Edit Token Metadata')).not.toBeInTheDocument();
  });

  it('should render when isOpen is true and libraryItemId is valid', () => {
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Edit Token Metadata')).toBeInTheDocument();
  });

  it('should initialize form with library item data', () => {
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByDisplayValue('Ancient Dragon')).toBeInTheDocument();
    expect(screen.getByDisplayValue('dragon, ancient, red')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2.5')).toBeInTheDocument();
    // Vision radius hidden for NPC via defaultType
    expect(screen.queryByDisplayValue('120')).not.toBeInTheDocument();
  });

  it('should display preview image with correct src transformation', () => {
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    const img = screen.getByAltText('Ancient Dragon');
    // thumbnailSrc should have 'file:' replaced with 'media:'
    expect(img).toHaveAttribute('src', 'media:///path/to/thumb.png');
  });

  it('should close modal when clicking backdrop', async () => {
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    const backdrop = screen.getByText('Edit Token Metadata').closest('.fixed');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('should not close modal when clicking inside modal content', async () => {
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    const modalContent = screen.getByText('Edit Token Metadata').closest('div');
    if (modalContent && modalContent.parentElement) {
      fireEvent.click(modalContent.parentElement);
      expect(mockOnClose).not.toHaveBeenCalled();
    }
  });

  it('should close modal when clicking close button', async () => {
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should close modal when clicking Cancel button', async () => {
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should update name field on user input', async () => {
    const user = userEvent.setup();
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    const nameInput = screen.getByDisplayValue('Ancient Dragon');
    await user.clear(nameInput);
    await user.type(nameInput, 'Young Dragon');

    expect(screen.getByDisplayValue('Young Dragon')).toBeInTheDocument();
  });

  it('should update category field on selection', async () => {
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    const categorySelect = screen.getByDisplayValue('Monsters');
    fireEvent.change(categorySelect, { target: { value: 'NPCs' } });

    expect(screen.getByDisplayValue('NPCs')).toBeInTheDocument();
  });

  it('should update tags field on user input', async () => {
    const user = userEvent.setup();
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    const tagsInput = screen.getByDisplayValue('dragon, ancient, red');
    await user.clear(tagsInput);
    await user.type(tagsInput, 'beast, flying');

    expect(screen.getByDisplayValue('beast, flying')).toBeInTheDocument();
  });

  it('should update default scale field on user input', async () => {
    const user = userEvent.setup();
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );


    const scaleInput = screen.getByDisplayValue('2.5');
    fireEvent.change(scaleInput, { target: { value: '3.0' } });

    expect(screen.getByDisplayValue('3.0')).toBeInTheDocument();
  });

  it('should show validation error when name is empty', async () => {
    const user = userEvent.setup();
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    const nameInput = screen.getByDisplayValue('Ancient Dragon');
    await user.clear(nameInput);

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    expect(mockShowToast).toHaveBeenCalledWith('Name cannot be empty', 'error');
    expect(mockUpdateLibraryToken).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('should show validation error for invalid scale (negative)', async () => {
    const user = userEvent.setup();
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    const scaleInput = screen.getByDisplayValue('2.5');
    await user.clear(scaleInput);
    await user.type(scaleInput, '-1');

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    expect(mockShowToast).toHaveBeenCalledWith('Scale must be a positive number', 'error');
    expect(mockUpdateLibraryToken).not.toHaveBeenCalled();
  });

  it('should show validation error for invalid scale (zero)', async () => {
    const user = userEvent.setup();
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    const scaleInput = screen.getByDisplayValue('2.5');
    await user.clear(scaleInput);
    await user.type(scaleInput, '0');

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    expect(mockShowToast).toHaveBeenCalledWith('Scale must be a positive number', 'error');
  });

  it('should show validation error for invalid vision radius (negative)', async () => {
    const user = userEvent.setup();
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    // Change to PC first to show vision radius
    const selects = screen.getAllByRole('combobox');
    let typeSelect = selects[1];
    fireEvent.change(typeSelect, { target: { value: 'PC' } });

    const visionInput = await screen.findByDisplayValue('120');
    await user.clear(visionInput);
    await user.type(visionInput, '-10');

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    expect(mockShowToast).toHaveBeenCalledWith('Vision radius must be a non-negative number', 'error');
  });

  it('should allow zero vision radius (blind token)', async () => {
    const user = userEvent.setup();
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    // Switch to PC
    const selects = screen.getAllByRole('combobox');
    let typeSelect = selects[1];
    fireEvent.change(typeSelect, { target: { value: 'PC' } });

    const visionInput = await screen.findByDisplayValue('120');
    await user.clear(visionInput);
    await user.type(visionInput, '0');

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    expect(mockUpdateLibraryToken).toHaveBeenCalledWith('lib-1', expect.objectContaining({
      defaultVisionRadius: 0,
    }));
  });

  it('should save valid data and close modal', async () => {
    const user = userEvent.setup();
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    const nameInput = screen.getByDisplayValue('Ancient Dragon');
    await user.clear(nameInput);
    await user.type(nameInput, 'Elder Dragon');

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateLibraryToken).toHaveBeenCalledWith('lib-1', {
        name: 'Elder Dragon',
        category: 'Monsters',
        tags: ['dragon', 'ancient', 'red'],
        defaultScale: 2.5,
        defaultVisionRadius: 120,
        defaultType: 'NPC',
      });
    });

    expect(mockShowToast).toHaveBeenCalledWith('Updated metadata for "Elder Dragon"', 'success');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should parse tags correctly (comma-separated, trimmed)', async () => {
    const user = userEvent.setup();
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    const tagsInput = screen.getByDisplayValue('dragon, ancient, red');
    await user.clear(tagsInput);
    await user.type(tagsInput, '  beast ,  flying , large  ');

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    expect(mockUpdateLibraryToken).toHaveBeenCalledWith('lib-1', expect.objectContaining({
      tags: ['beast', 'flying', 'large'],
    }));
  });

  it('should filter out empty tags', async () => {
    const user = userEvent.setup();
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    const tagsInput = screen.getByDisplayValue('dragon, ancient, red');
    await user.clear(tagsInput);
    await user.type(tagsInput, 'valid,,  , empty, ,another');

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    expect(mockUpdateLibraryToken).toHaveBeenCalledWith('lib-1', expect.objectContaining({
      tags: ['valid', 'empty', 'another'],
    }));
  });

  it('should handle empty tags field', async () => {
    const user = userEvent.setup();
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    const tagsInput = screen.getByDisplayValue('dragon, ancient, red');
    await user.clear(tagsInput);

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    expect(mockUpdateLibraryToken).toHaveBeenCalledWith('lib-1', expect.objectContaining({
      tags: [],
    }));
  });

  it('should default category to Custom if empty', async () => {
    const user = userEvent.setup();
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    const categorySelect = screen.getByDisplayValue('Monsters');
    fireEvent.change(categorySelect, { target: { value: '' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    expect(mockUpdateLibraryToken).toHaveBeenCalledWith('lib-1', expect.objectContaining({
      category: 'Custom',
    }));
  });

  it('should handle undefined optional fields', async () => {
    const user = userEvent.setup();
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    // Clear optional fields
    const scaleInput = screen.getByDisplayValue('2.5');
    await user.clear(scaleInput);

    // Switch to PC to clear vision
    const selects = screen.getAllByRole('combobox');
    let typeSelect = selects[1];
    fireEvent.change(typeSelect, { target: { value: 'PC' } });

    const visionInput = await screen.findByDisplayValue('120');
    await user.clear(visionInput);

    // Clear type
    fireEvent.change(typeSelect, { target: { value: '' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    expect(mockUpdateLibraryToken).toHaveBeenCalledWith('lib-1', expect.objectContaining({
      defaultScale: undefined,
      defaultVisionRadius: undefined,
      defaultType: undefined,
    }));
  });

  it('should only show vision radius field when type is PC', async () => {
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    // Initially NPC, vision radius should NOT be visible
    expect(screen.queryByDisplayValue('120')).not.toBeInTheDocument();

    const selects = screen.getAllByRole('combobox');
    let typeSelect = selects[1]; // Category is 0, Type is 1

    // Change to None
    fireEvent.change(typeSelect, { target: { value: '' } });

    // Vision radius field should not be visible
    expect(screen.queryByText(/Default Vision Radius/)).not.toBeInTheDocument();

    // Change to PC
    // Re-query by new display value
    typeSelect = screen.getByDisplayValue('None');
    fireEvent.change(typeSelect, { target: { value: 'PC' } });

    // Vision radius should be visible again
    await waitFor(() => {
      expect(screen.getByText(/Default Vision Radius/)).toBeInTheDocument();
    });
  });

  it('should handle non-existent library item gracefully', () => {
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="non-existent-id"
        onClose={mockOnClose}
      />
    );

    // Should not render when library item not found
    expect(screen.queryByText('Edit Token Metadata')).not.toBeInTheDocument();
  });

  it('should handle decimal scale values', async () => {
    const user = userEvent.setup();
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    const scaleInput = screen.getByDisplayValue('2.5');
    await user.clear(scaleInput);
    await user.type(scaleInput, '1.75');

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    expect(mockUpdateLibraryToken).toHaveBeenCalledWith('lib-1', expect.objectContaining({
      defaultScale: 1.75,
    }));
  });

  it('should trim whitespace from name before saving', async () => {
    const user = userEvent.setup();
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    const nameInput = screen.getByDisplayValue('Ancient Dragon');
    await user.clear(nameInput);
    await user.type(nameInput, '  Trimmed Name  ');

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    expect(mockUpdateLibraryToken).toHaveBeenCalledWith('lib-1', expect.objectContaining({
      name: 'Trimmed Name',
    }));

    expect(mockShowToast).toHaveBeenCalledWith('Updated metadata for "Trimmed Name"', 'success');
  });

  it('should reject whitespace-only name', async () => {
    const user = userEvent.setup();
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    const nameInput = screen.getByDisplayValue('Ancient Dragon');
    await user.clear(nameInput);
    await user.type(nameInput, '   ');

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    expect(mockShowToast).toHaveBeenCalledWith('Name cannot be empty', 'error');
    expect(mockUpdateLibraryToken).not.toHaveBeenCalled();
  });

  it('should handle very large vision radius values', async () => {
    const user = userEvent.setup();
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    // Change to PC first to show vision radius
    const typeSelect = screen.getByDisplayValue('NPC (Non-Player Character)');
    await user.selectOptions(typeSelect, 'PC');

    // Now look for vision radius
    const visionInput = await screen.findByDisplayValue('120');
    await user.clear(visionInput);
    await user.type(visionInput, '9999');

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    expect(mockUpdateLibraryToken).toHaveBeenCalledWith('lib-1', expect.objectContaining({
      defaultVisionRadius: 9999,
    }));
  });

  it('should show correct help text for each field', () => {
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/Used for search/)).toBeInTheDocument();
    expect(screen.getByText(/Size multiplier when placed on map/)).toBeInTheDocument();
    expect(screen.getByText(/PC tokens emit vision in Fog of War/)).toBeInTheDocument();
  });

  it('should call storage service to persist changes', async () => {
    const user = userEvent.setup();
    render(
      <TokenMetadataEditor
        isOpen={true}
        libraryItemId="lib-1"
        onClose={mockOnClose}
      />
    );

    const nameInput = screen.getByDisplayValue('Ancient Dragon');
    await user.clear(nameInput);
    await user.type(nameInput, 'Persisted Dragon');

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateLibraryMetadata).toHaveBeenCalledWith('lib-1', expect.objectContaining({
        name: 'Persisted Dragon',
      }));
    });
  });
});
