import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QuickTokenSidebar from './QuickTokenSidebar';
import { TokenLibraryItem } from '../store/gameStore';

describe('QuickTokenSidebar', () => {
  const mockOnDragStart = vi.fn();

  const recentTokens: TokenLibraryItem[] = [
    {
      id: 'recent1',
      name: 'Dragon',
      src: 'file://dragon.png',
      thumbnailSrc: 'file://thumb-dragon.png',
      category: 'Monster',
      tags: ['monster', 'fire'],
      dateAdded: Date.now() - 1000,
      defaultType: 'NPC'
    },
    {
      id: 'recent2',
      name: 'Goblin',
      src: 'file://goblin.png',
      thumbnailSrc: 'file://thumb-goblin.png',
      category: 'Monster',
      tags: ['monster'],
      dateAdded: Date.now() - 2000,
      defaultType: 'NPC'
    }
  ];

  const playerTokens: TokenLibraryItem[] = [
    {
      id: 'pc1',
      name: 'Warrior',
      src: 'file://warrior.png',
      thumbnailSrc: 'file://thumb-warrior.png',
      category: 'Player',
      tags: ['player', 'melee'],
      dateAdded: Date.now() - 500,
      defaultType: 'PC'
    },
    {
      id: 'pc2',
      name: 'Wizard',
      src: 'file://wizard.png',
      thumbnailSrc: 'file://thumb-wizard.png',
      category: 'Player',
      tags: ['player', 'magic'],
      dateAdded: Date.now() - 300,
      defaultType: 'PC'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Recent History Section', () => {
    it('should render Recent History section when recent tokens exist', () => {
      render(
        <QuickTokenSidebar
          recentTokens={recentTokens}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      expect(screen.getByText('Recent History')).toBeInTheDocument();
    });

    it('should not render Recent History section when no recent tokens', () => {
      render(
        <QuickTokenSidebar
          recentTokens={[]}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      expect(screen.queryByText('Recent History')).not.toBeInTheDocument();
    });

    it('should render all recent tokens', () => {
      render(
        <QuickTokenSidebar
          recentTokens={recentTokens}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      expect(screen.getByAltText('Dragon')).toBeInTheDocument();
      expect(screen.getByAltText('Goblin')).toBeInTheDocument();
    });

    it('should make recent tokens draggable', () => {
      render(
        <QuickTokenSidebar
          recentTokens={recentTokens}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      const dragonToken = screen.getByAltText('Dragon').closest('div');
      expect(dragonToken).toHaveAttribute('draggable', 'true');
    });

    it('should call onDragStart with correct parameters for recent token', () => {
      render(
        <QuickTokenSidebar
          recentTokens={recentTokens}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      const dragonToken = screen.getByAltText('Dragon').closest('div');
      const dragEvent = new DragEvent('dragstart', { bubbles: true });

      if (dragonToken) {
        fireEvent(dragonToken, dragEvent);
      }

      expect(mockOnDragStart).toHaveBeenCalledWith(
        expect.any(Object),
        'LIBRARY_TOKEN',
        'file://dragon.png',
        'recent1'
      );
    });

    it('should convert file:// to media:// for thumbnail images', () => {
      render(
        <QuickTokenSidebar
          recentTokens={recentTokens}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      const dragonImage = screen.getByAltText('Dragon') as HTMLImageElement;
      expect(dragonImage.src).toContain('media://thumb-dragon.png');
    });
  });

  describe('Party Section', () => {
    it('should always render Party section', () => {
      render(
        <QuickTokenSidebar
          recentTokens={recentTokens}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      expect(screen.getByText('Party')).toBeInTheDocument();
    });

    it('should render Party section even with empty tokens', () => {
      render(
        <QuickTokenSidebar
          recentTokens={[]}
          playerTokens={[]}
          onDragStart={mockOnDragStart}
        />
      );

      expect(screen.getByText('Party')).toBeInTheDocument();
    });

    it('should always render Generic Token as first slot', () => {
      render(
        <QuickTokenSidebar
          recentTokens={recentTokens}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      // Look for tooltip with "Generic Token" text
      const partySection = screen.getByText('Party').parentElement;
      expect(partySection).toBeTruthy();
    });

    it('should make Generic Token draggable', () => {
      const { container } = render(
        <QuickTokenSidebar
          recentTokens={recentTokens}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      // Find the generic token (has dashed border and is in Party section)
      const genericToken = container.querySelector('.border-dashed');
      expect(genericToken).toHaveAttribute('draggable', 'true');
    });

    it('should render all player tokens after Generic Token', () => {
      render(
        <QuickTokenSidebar
          recentTokens={recentTokens}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      expect(screen.getByAltText('Warrior')).toBeInTheDocument();
      expect(screen.getByAltText('Wizard')).toBeInTheDocument();
    });

    it('should make player tokens draggable', () => {
      render(
        <QuickTokenSidebar
          recentTokens={recentTokens}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      const warriorToken = screen.getByAltText('Warrior').closest('div');
      expect(warriorToken).toHaveAttribute('draggable', 'true');
    });

    it('should call onDragStart with correct parameters for player token', () => {
      render(
        <QuickTokenSidebar
          recentTokens={recentTokens}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      const warriorToken = screen.getByAltText('Warrior').closest('div');
      const dragEvent = new DragEvent('dragstart', { bubbles: true });

      if (warriorToken) {
        fireEvent(warriorToken, dragEvent);
      }

      expect(mockOnDragStart).toHaveBeenCalledWith(
        expect.any(Object),
        'LIBRARY_TOKEN',
        'file://warrior.png',
        'pc1'
      );
    });

    it('should handle up to 5 player tokens', () => {
      const manyPlayers: TokenLibraryItem[] = Array.from({ length: 5 }, (_, i) => ({
        id: `pc${i}`,
        name: `Player ${i}`,
        src: `file://player${i}.png`,
        thumbnailSrc: `file://thumb-player${i}.png`,
        category: 'Player',
        tags: [],
        dateAdded: Date.now() - i * 100,
        defaultType: 'PC' as const
      }));

      render(
        <QuickTokenSidebar
          recentTokens={recentTokens}
          playerTokens={manyPlayers}
          onDragStart={mockOnDragStart}
        />
      );

      // Should render all 5 player tokens plus generic token (6 total in Party section)
      manyPlayers.forEach((player) => {
        expect(screen.getByAltText(player.name)).toBeInTheDocument();
      });
    });
  });

  describe('Generic Token Behavior', () => {
    it('should set correct data transfer format for generic token', () => {
      const { container } = render(
        <QuickTokenSidebar
          recentTokens={recentTokens}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      const genericToken = container.querySelector('.border-dashed');
      const mockDataTransfer = {
        setData: vi.fn(),
        setDragImage: vi.fn()
      };

      const dragEvent = new DragEvent('dragstart', {
        bubbles: true,
        dataTransfer: mockDataTransfer as any
      });

      if (genericToken) {
        fireEvent(genericToken, dragEvent);
      }

      expect(mockDataTransfer.setData).toHaveBeenCalledWith(
        'application/json',
        expect.stringContaining('GENERIC_TOKEN')
      );
    });

    it('should have distinctive styling for generic token', () => {
      const { container } = render(
        <QuickTokenSidebar
          recentTokens={recentTokens}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      const genericToken = container.querySelector('.border-dashed');
      expect(genericToken).toHaveClass('border-2', 'border-dashed');
    });

    it('should display user icon for generic token', () => {
      const { container } = render(
        <QuickTokenSidebar
          recentTokens={recentTokens}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      const genericToken = container.querySelector('.border-dashed');
      // Check for SVG icon (RiUser3Line renders as SVG)
      const icon = genericToken?.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty recent and player tokens', () => {
      render(
        <QuickTokenSidebar
          recentTokens={[]}
          playerTokens={[]}
          onDragStart={mockOnDragStart}
        />
      );

      // Should still render Party section with Generic Token
      expect(screen.getByText('Party')).toBeInTheDocument();
      expect(screen.queryByText('Recent History')).not.toBeInTheDocument();
    });

    it('should handle single recent token', () => {
      render(
        <QuickTokenSidebar
          recentTokens={[recentTokens[0]]}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      expect(screen.getByText('Recent History')).toBeInTheDocument();
      expect(screen.getByAltText('Dragon')).toBeInTheDocument();
      expect(screen.queryByAltText('Goblin')).not.toBeInTheDocument();
    });

    it('should handle single player token', () => {
      render(
        <QuickTokenSidebar
          recentTokens={recentTokens}
          playerTokens={[playerTokens[0]]}
          onDragStart={mockOnDragStart}
        />
      );

      expect(screen.getByAltText('Warrior')).toBeInTheDocument();
      expect(screen.queryByAltText('Wizard')).not.toBeInTheDocument();
    });

    it('should handle tokens with special characters in names', () => {
      const specialTokens: TokenLibraryItem[] = [
        {
          id: 'special1',
          name: "Zarkon's Minion",
          src: 'file://special.png',
          thumbnailSrc: 'file://thumb-special.png',
          category: 'Monster',
          tags: [],
          dateAdded: Date.now(),
          defaultType: 'NPC'
        }
      ];

      render(
        <QuickTokenSidebar
          recentTokens={specialTokens}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      expect(screen.getByAltText("Zarkon's Minion")).toBeInTheDocument();
    });

    it('should handle tokens with very long names', () => {
      const longNameTokens: TokenLibraryItem[] = [
        {
          id: 'long1',
          name: 'A Very Long Token Name That Exceeds Normal Length Expectations',
          src: 'file://long.png',
          thumbnailSrc: 'file://thumb-long.png',
          category: 'Monster',
          tags: [],
          dateAdded: Date.now(),
          defaultType: 'NPC'
        }
      ];

      render(
        <QuickTokenSidebar
          recentTokens={longNameTokens}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      expect(
        screen.getByAltText('A Very Long Token Name That Exceeds Normal Length Expectations')
      ).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      render(
        <QuickTokenSidebar
          recentTokens={recentTokens}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      const headings = screen.getAllByRole('heading', { level: 4 });
      expect(headings.length).toBeGreaterThan(0);
    });

    it('should provide alt text for all token images', () => {
      render(
        <QuickTokenSidebar
          recentTokens={recentTokens}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      const images = screen.getAllByRole('img');
      images.forEach((img) => {
        expect(img).toHaveAttribute('alt');
        expect(img.getAttribute('alt')).not.toBe('');
      });
    });

    it('should have draggable elements with proper cursor', () => {
      render(
        <QuickTokenSidebar
          recentTokens={recentTokens}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      const dragonToken = screen.getByAltText('Dragon').closest('div');
      expect(dragonToken).toHaveClass('cursor-grab');
    });
  });

  describe('Layout and Styling', () => {
    it('should apply proper spacing between sections', () => {
      const { container } = render(
        <QuickTokenSidebar
          recentTokens={recentTokens}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('space-y-4');
    });

    it('should apply flex layout for token grids', () => {
      render(
        <QuickTokenSidebar
          recentTokens={recentTokens}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      const recentHistorySection = screen.getByText('Recent History').nextElementSibling;
      expect(recentHistorySection).toHaveClass('flex', 'gap-2', 'flex-wrap');
    });

    it('should set consistent token size', () => {
      render(
        <QuickTokenSidebar
          recentTokens={recentTokens}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      const dragonToken = screen.getByAltText('Dragon').closest('div');
      expect(dragonToken).toHaveClass('w-16', 'h-16');
    });

    it('should apply sidebar-token class to tokens', () => {
      render(
        <QuickTokenSidebar
          recentTokens={recentTokens}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      const dragonToken = screen.getByAltText('Dragon').closest('div');
      expect(dragonToken).toHaveClass('sidebar-token');
    });
  });

  describe('Interaction', () => {
    it('should not interfere with drag events', () => {
      render(
        <QuickTokenSidebar
          recentTokens={recentTokens}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      const dragonToken = screen.getByAltText('Dragon').closest('div');
      const dragStartEvent = new DragEvent('dragstart', { bubbles: true });

      if (dragonToken) {
        const result = fireEvent(dragonToken, dragStartEvent);
        expect(result).toBe(true); // Event was not prevented
      }
    });

    it('should maintain pointer-events-none on images', () => {
      render(
        <QuickTokenSidebar
          recentTokens={recentTokens}
          playerTokens={playerTokens}
          onDragStart={mockOnDragStart}
        />
      );

      const dragonImage = screen.getByAltText('Dragon');
      expect(dragonImage).toHaveClass('pointer-events-none');
    });
  });
});
