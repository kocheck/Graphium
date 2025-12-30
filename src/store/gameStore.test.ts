import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from './gameStore';
import type { Campaign, Token, Drawing, Door, Stairs, MapConfig, TokenLibraryItem } from './gameStore';

// Mock system messages to avoid dependency on random message selection
vi.mock('../utils/systemMessages', () => ({
  rollForMessage: (key: string) => `Mock message for ${key}`
}));

describe('gameStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    const initialMap = {
      id: crypto.randomUUID(),
      name: 'Map 1',
      tokens: [],
      drawings: [],
      doors: [],
      stairs: [],
      map: null,
      gridSize: 50,
      gridType: 'LINES' as const,
      exploredRegions: [],
      isDaylightMode: false,
    };

    const initialCampaign: Campaign = {
      id: crypto.randomUUID(),
      name: 'New Campaign',
      maps: { [initialMap.id]: initialMap },
      activeMapId: initialMap.id,
      tokenLibrary: [],
    };

    useGameStore.setState({
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
      toast: null,
      confirmDialog: null,
      showResourceMonitor: false,
      dungeonDialog: false,
      isGamePaused: false,
      isMobileSidebarOpen: false,
      activeVisionPolygons: [],
      activeMeasurement: null,
      broadcastMeasurement: false,
      dmMeasurement: null,
      campaign: initialCampaign,
    });
  });

  describe('Token Operations', () => {
    it('should add a token to the current map', () => {
      const store = useGameStore.getState();
      const token: Token = {
        id: 'token-1',
        x: 100,
        y: 200,
        src: 'test.png',
        scale: 1,
      };

      store.addToken(token);

      const state = useGameStore.getState();
      expect(state.tokens).toHaveLength(1);
      expect(state.tokens[0]).toEqual(token);
    });

    it('should remove a token by id', () => {
      const store = useGameStore.getState();
      const token: Token = {
        id: 'token-1',
        x: 100,
        y: 200,
        src: 'test.png',
      };

      store.addToken(token);
      expect(useGameStore.getState().tokens).toHaveLength(1);

      store.removeToken('token-1');
      expect(useGameStore.getState().tokens).toHaveLength(0);
    });

    it('should remove multiple tokens by ids', () => {
      const store = useGameStore.getState();
      const tokens: Token[] = [
        { id: 'token-1', x: 100, y: 100, src: 'test1.png' },
        { id: 'token-2', x: 200, y: 200, src: 'test2.png' },
        { id: 'token-3', x: 300, y: 300, src: 'test3.png' },
      ];

      tokens.forEach(token => store.addToken(token));
      expect(useGameStore.getState().tokens).toHaveLength(3);

      store.removeTokens(['token-1', 'token-3']);
      const state = useGameStore.getState();
      expect(state.tokens).toHaveLength(1);
      expect(state.tokens[0].id).toBe('token-2');
    });

    it('should update token position', () => {
      const store = useGameStore.getState();
      const token: Token = {
        id: 'token-1',
        x: 100,
        y: 200,
        src: 'test.png',
      };

      store.addToken(token);
      store.updateTokenPosition('token-1', 300, 400);

      const state = useGameStore.getState();
      expect(state.tokens[0].x).toBe(300);
      expect(state.tokens[0].y).toBe(400);
    });

    it('should update token transform (position and scale)', () => {
      const store = useGameStore.getState();
      const token: Token = {
        id: 'token-1',
        x: 100,
        y: 200,
        src: 'test.png',
        scale: 1,
      };

      store.addToken(token);
      store.updateTokenTransform('token-1', 300, 400, 2);

      const state = useGameStore.getState();
      expect(state.tokens[0].x).toBe(300);
      expect(state.tokens[0].y).toBe(400);
      expect(state.tokens[0].scale).toBe(2);
    });

    it('should update token properties (type, visionRadius, name)', () => {
      const store = useGameStore.getState();
      const token: Token = {
        id: 'token-1',
        x: 100,
        y: 200,
        src: 'test.png',
      };

      store.addToken(token);
      store.updateTokenProperties('token-1', {
        type: 'PC',
        visionRadius: 60,
        name: 'Hero',
      });

      const state = useGameStore.getState();
      expect(state.tokens[0].type).toBe('PC');
      expect(state.tokens[0].visionRadius).toBe(60);
      expect(state.tokens[0].name).toBe('Hero');
    });

    it('should maintain immutability when updating tokens', () => {
      const store = useGameStore.getState();
      const token: Token = {
        id: 'token-1',
        x: 100,
        y: 200,
        src: 'test.png',
      };

      store.addToken(token);
      const originalTokensArray = useGameStore.getState().tokens;
      const originalToken = originalTokensArray[0];

      store.updateTokenPosition('token-1', 300, 400);

      const newTokensArray = useGameStore.getState().tokens;
      const newToken = newTokensArray[0];

      // Arrays should be different references (immutability)
      expect(originalTokensArray).not.toBe(newTokensArray);
      // Tokens should be different references (immutability)
      expect(originalToken).not.toBe(newToken);
      // But original should be unchanged
      expect(originalToken.x).toBe(100);
      expect(originalToken.y).toBe(200);
    });

    it('should handle updating non-existent token gracefully', () => {
      const store = useGameStore.getState();

      // Should not throw error
      expect(() => {
        store.updateTokenPosition('non-existent', 100, 200);
      }).not.toThrow();

      // State should remain empty
      expect(useGameStore.getState().tokens).toHaveLength(0);
    });
  });

  describe('Drawing Operations', () => {
    it('should add a drawing to the current map', () => {
      const store = useGameStore.getState();
      const drawing: Drawing = {
        id: 'drawing-1',
        tool: 'marker',
        points: [0, 0, 100, 100],
        color: '#ff0000',
        size: 5,
      };

      store.addDrawing(drawing);

      const state = useGameStore.getState();
      expect(state.drawings).toHaveLength(1);
      expect(state.drawings[0]).toEqual(drawing);
    });

    it('should remove a drawing by id', () => {
      const store = useGameStore.getState();
      const drawing: Drawing = {
        id: 'drawing-1',
        tool: 'marker',
        points: [0, 0, 100, 100],
        color: '#ff0000',
        size: 5,
      };

      store.addDrawing(drawing);
      expect(useGameStore.getState().drawings).toHaveLength(1);

      store.removeDrawing('drawing-1');
      expect(useGameStore.getState().drawings).toHaveLength(0);
    });

    it('should remove multiple drawings by ids', () => {
      const store = useGameStore.getState();
      const drawings: Drawing[] = [
        { id: 'drawing-1', tool: 'marker', points: [0, 0, 50, 50], color: '#ff0000', size: 5 },
        { id: 'drawing-2', tool: 'eraser', points: [100, 100, 150, 150], color: '#000000', size: 10 },
        { id: 'drawing-3', tool: 'wall', points: [200, 200, 250, 250], color: '#0000ff', size: 3 },
      ];

      drawings.forEach(drawing => store.addDrawing(drawing));
      expect(useGameStore.getState().drawings).toHaveLength(3);

      store.removeDrawings(['drawing-1', 'drawing-3']);
      const state = useGameStore.getState();
      expect(state.drawings).toHaveLength(1);
      expect(state.drawings[0].id).toBe('drawing-2');
    });

    it('should update drawing transform', () => {
      const store = useGameStore.getState();
      const drawing: Drawing = {
        id: 'drawing-1',
        tool: 'marker',
        points: [0, 0, 100, 100],
        color: '#ff0000',
        size: 5,
      };

      store.addDrawing(drawing);
      store.updateDrawingTransform('drawing-1', 50, 75, 2);

      const state = useGameStore.getState();
      expect(state.drawings[0].x).toBe(50);
      expect(state.drawings[0].y).toBe(75);
      expect(state.drawings[0].scale).toBe(2);
    });

    it('should maintain immutability when updating drawings', () => {
      const store = useGameStore.getState();
      const drawing: Drawing = {
        id: 'drawing-1',
        tool: 'marker',
        points: [0, 0, 100, 100],
        color: '#ff0000',
        size: 5,
      };

      store.addDrawing(drawing);
      const originalDrawingsArray = useGameStore.getState().drawings;

      store.updateDrawingTransform('drawing-1', 50, 75, 2);

      const newDrawingsArray = useGameStore.getState().drawings;

      // Arrays should be different references (immutability)
      expect(originalDrawingsArray).not.toBe(newDrawingsArray);
    });
  });

  describe('Door Operations', () => {
    it('should add a door to the current map', () => {
      const store = useGameStore.getState();
      const door: Door = {
        id: 'door-1',
        x: 100,
        y: 200,
        orientation: 'horizontal',
        isOpen: false,
        isLocked: false,
        size: 50,
      };

      store.addDoor(door);

      const state = useGameStore.getState();
      expect(state.doors).toHaveLength(1);
      expect(state.doors[0]).toEqual(door);
    });

    it('should remove a door by id', () => {
      const store = useGameStore.getState();
      const door: Door = {
        id: 'door-1',
        x: 100,
        y: 200,
        orientation: 'horizontal',
        isOpen: false,
        isLocked: false,
        size: 50,
      };

      store.addDoor(door);
      expect(useGameStore.getState().doors).toHaveLength(1);

      store.removeDoor('door-1');
      expect(useGameStore.getState().doors).toHaveLength(0);
    });

    it('should toggle a door open/closed', () => {
      const store = useGameStore.getState();
      const door: Door = {
        id: 'door-1',
        x: 100,
        y: 200,
        orientation: 'horizontal',
        isOpen: false,
        isLocked: false,
        size: 50,
      };

      store.addDoor(door);
      expect(useGameStore.getState().doors[0].isOpen).toBe(false);

      store.toggleDoor('door-1');
      expect(useGameStore.getState().doors[0].isOpen).toBe(true);

      store.toggleDoor('door-1');
      expect(useGameStore.getState().doors[0].isOpen).toBe(false);
    });

    it('should toggle a door regardless of lock state', () => {
      const store = useGameStore.getState();
      const door: Door = {
        id: 'door-1',
        x: 100,
        y: 200,
        orientation: 'horizontal',
        isOpen: false,
        isLocked: true,
        size: 50,
      };

      store.addDoor(door);
      expect(useGameStore.getState().doors[0].isOpen).toBe(false);

      // toggleDoor toggles the state regardless of lock (lock is UI-level constraint)
      store.toggleDoor('door-1');
      expect(useGameStore.getState().doors[0].isOpen).toBe(true);
    });

    it('should update door state directly', () => {
      const store = useGameStore.getState();
      const door: Door = {
        id: 'door-1',
        x: 100,
        y: 200,
        orientation: 'horizontal',
        isOpen: false,
        isLocked: false,
        size: 50,
      };

      store.addDoor(door);
      store.updateDoorState('door-1', true);

      expect(useGameStore.getState().doors[0].isOpen).toBe(true);
    });

    it('should update door lock state', () => {
      const store = useGameStore.getState();
      const door: Door = {
        id: 'door-1',
        x: 100,
        y: 200,
        orientation: 'horizontal',
        isOpen: false,
        isLocked: false,
        size: 50,
      };

      store.addDoor(door);
      store.updateDoorLock('door-1', true);

      expect(useGameStore.getState().doors[0].isLocked).toBe(true);
    });

    it('should update all unlocked doors at once', () => {
      const store = useGameStore.getState();
      const doors: Door[] = [
        { id: 'door-1', x: 100, y: 100, orientation: 'horizontal', isOpen: false, isLocked: false, size: 50 },
        { id: 'door-2', x: 200, y: 200, orientation: 'vertical', isOpen: false, isLocked: true, size: 50 },
        { id: 'door-3', x: 300, y: 300, orientation: 'horizontal', isOpen: false, isLocked: false, size: 50 },
      ];

      doors.forEach(door => store.addDoor(door));
      store.updateAllDoorStates(true);

      const state = useGameStore.getState();
      expect(state.doors[0].isOpen).toBe(true); // Unlocked, should open
      expect(state.doors[1].isOpen).toBe(false); // Locked, should remain closed
      expect(state.doors[2].isOpen).toBe(true); // Unlocked, should open
    });

    it('should update all door locks at once', () => {
      const store = useGameStore.getState();
      const doors: Door[] = [
        { id: 'door-1', x: 100, y: 100, orientation: 'horizontal', isOpen: false, isLocked: false, size: 50 },
        { id: 'door-2', x: 200, y: 200, orientation: 'vertical', isOpen: false, isLocked: true, size: 50 },
      ];

      doors.forEach(door => store.addDoor(door));
      store.updateAllDoorLocks(true);

      const state = useGameStore.getState();
      expect(state.doors[0].isLocked).toBe(true);
      expect(state.doors[1].isLocked).toBe(true);
    });

    it('should remove multiple doors', () => {
      const store = useGameStore.getState();
      const doors: Door[] = [
        { id: 'door-1', x: 100, y: 100, orientation: 'horizontal', isOpen: false, isLocked: false, size: 50 },
        { id: 'door-2', x: 200, y: 200, orientation: 'vertical', isOpen: false, isLocked: false, size: 50 },
        { id: 'door-3', x: 300, y: 300, orientation: 'horizontal', isOpen: false, isLocked: false, size: 50 },
      ];

      doors.forEach(door => store.addDoor(door));
      expect(useGameStore.getState().doors).toHaveLength(3);

      store.removeDoors(['door-1', 'door-3']);
      const state = useGameStore.getState();
      expect(state.doors).toHaveLength(1);
      expect(state.doors[0].id).toBe('door-2');
    });
  });

  describe('Stairs Operations', () => {
    it('should add stairs to the current map', () => {
      const store = useGameStore.getState();
      const stairs: Stairs = {
        id: 'stairs-1',
        x: 100,
        y: 200,
        direction: 'north',
        type: 'up',
        width: 100,
        height: 100,
      };

      store.addStairs(stairs);

      const state = useGameStore.getState();
      expect(state.stairs).toHaveLength(1);
      expect(state.stairs[0]).toEqual(stairs);
    });

    it('should remove stairs by id', () => {
      const store = useGameStore.getState();
      const stairs: Stairs = {
        id: 'stairs-1',
        x: 100,
        y: 200,
        direction: 'north',
        type: 'up',
        width: 100,
        height: 100,
      };

      store.addStairs(stairs);
      expect(useGameStore.getState().stairs).toHaveLength(1);

      store.removeStairs('stairs-1');
      expect(useGameStore.getState().stairs).toHaveLength(0);
    });

    it('should remove multiple stairs', () => {
      const store = useGameStore.getState();
      const stairsList: Stairs[] = [
        { id: 'stairs-1', x: 100, y: 100, direction: 'north', type: 'up', width: 100, height: 100 },
        { id: 'stairs-2', x: 200, y: 200, direction: 'south', type: 'down', width: 100, height: 100 },
        { id: 'stairs-3', x: 300, y: 300, direction: 'east', type: 'up', width: 100, height: 100 },
      ];

      stairsList.forEach(stairs => store.addStairs(stairs));
      expect(useGameStore.getState().stairs).toHaveLength(3);

      store.removeMultipleStairs(['stairs-1', 'stairs-3']);
      const state = useGameStore.getState();
      expect(state.stairs).toHaveLength(1);
      expect(state.stairs[0].id).toBe('stairs-2');
    });
  });

  describe('Map Operations', () => {
    it('should set a new map config', () => {
      const store = useGameStore.getState();
      const mapConfig: MapConfig = {
        src: 'map.png',
        x: 0,
        y: 0,
        width: 1000,
        height: 1000,
        scale: 1,
      };

      store.setMap(mapConfig);

      const state = useGameStore.getState();
      expect(state.map).toEqual(mapConfig);
    });

    it('should clear map config by setting to null', () => {
      const store = useGameStore.getState();
      const mapConfig: MapConfig = {
        src: 'map.png',
        x: 0,
        y: 0,
        width: 1000,
        height: 1000,
        scale: 1,
      };

      store.setMap(mapConfig);
      expect(useGameStore.getState().map).not.toBeNull();

      store.setMap(null);
      expect(useGameStore.getState().map).toBeNull();
    });

    it('should update map position', () => {
      const store = useGameStore.getState();
      const mapConfig: MapConfig = {
        src: 'map.png',
        x: 0,
        y: 0,
        width: 1000,
        height: 1000,
        scale: 1,
      };

      store.setMap(mapConfig);
      store.updateMapPosition(100, 200);

      const state = useGameStore.getState();
      expect(state.map?.x).toBe(100);
      expect(state.map?.y).toBe(200);
    });

    it('should update map scale', () => {
      const store = useGameStore.getState();
      const mapConfig: MapConfig = {
        src: 'map.png',
        x: 0,
        y: 0,
        width: 1000,
        height: 1000,
        scale: 1,
      };

      store.setMap(mapConfig);
      store.updateMapScale(2);

      const state = useGameStore.getState();
      expect(state.map?.scale).toBe(2);
    });

    it('should update map transform (scale and position)', () => {
      const store = useGameStore.getState();
      const mapConfig: MapConfig = {
        src: 'map.png',
        x: 0,
        y: 0,
        width: 1000,
        height: 1000,
        scale: 1,
      };

      store.setMap(mapConfig);
      store.updateMapTransform(2, 100, 200);

      const state = useGameStore.getState();
      expect(state.map?.scale).toBe(2);
      expect(state.map?.x).toBe(100);
      expect(state.map?.y).toBe(200);
    });

    it('should set grid size', () => {
      const store = useGameStore.getState();

      store.setGridSize(75);

      expect(useGameStore.getState().gridSize).toBe(75);
    });

    it('should set grid type', () => {
      const store = useGameStore.getState();

      store.setGridType('DOTS');

      expect(useGameStore.getState().gridType).toBe('DOTS');
    });

    it('should set daylight mode', () => {
      const store = useGameStore.getState();

      expect(useGameStore.getState().isDaylightMode).toBe(false);

      store.setDaylightMode(true);
      expect(useGameStore.getState().isDaylightMode).toBe(true);

      store.setDaylightMode(false);
      expect(useGameStore.getState().isDaylightMode).toBe(false);
    });
  });

  describe('Campaign Operations', () => {
    it('should load a campaign and hydrate active map', () => {
      const store = useGameStore.getState();

      const map1 = {
        id: 'map-1',
        name: 'Dungeon Level 1',
        tokens: [{ id: 'token-1', x: 100, y: 100, src: 'hero.png' }],
        drawings: [],
        doors: [],
        stairs: [],
        map: { src: 'dungeon1.png', x: 0, y: 0, width: 2000, height: 2000, scale: 1 },
        gridSize: 50,
        gridType: 'LINES' as const,
        exploredRegions: [],
        isDaylightMode: false,
      };

      const campaign: Campaign = {
        id: 'campaign-1',
        name: 'Test Campaign',
        maps: { 'map-1': map1 },
        activeMapId: 'map-1',
        tokenLibrary: [],
      };

      store.loadCampaign(campaign);

      const state = useGameStore.getState();
      expect(state.campaign).toEqual(campaign);
      expect(state.tokens).toEqual(map1.tokens);
      expect(state.map).toEqual(map1.map);
      expect(state.gridSize).toBe(50);
    });

    it('should handle invalid campaign structure gracefully', () => {
      const store = useGameStore.getState();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const invalidCampaign = {
        id: 'campaign-1',
        name: 'Invalid',
        maps: {},
        activeMapId: 'non-existent-map',
        tokenLibrary: [],
      } as Campaign;

      store.loadCampaign(invalidCampaign);

      // Should log error but not crash
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should add a new map to campaign', () => {
      const store = useGameStore.getState();
      const initialMapsCount = Object.keys(useGameStore.getState().campaign.maps).length;

      store.addMap('New Map');

      const state = useGameStore.getState();
      const mapsCount = Object.keys(state.campaign.maps).length;
      expect(mapsCount).toBe(initialMapsCount + 1);

      // Should switch to the new map
      const activeMap = state.campaign.maps[state.campaign.activeMapId];
      expect(activeMap.name).toBe('New Map');
    });

    it('should sync active map state to campaign before adding new map', () => {
      const store = useGameStore.getState();

      // Add a token to current map
      const token: Token = { id: 'token-1', x: 100, y: 100, src: 'test.png' };
      store.addToken(token);

      const originalActiveMapId = useGameStore.getState().campaign.activeMapId;

      // Add new map (should sync current map first)
      store.addMap('Second Map');

      const state = useGameStore.getState();
      const previousMap = state.campaign.maps[originalActiveMapId];

      // Previous map should have the token we added
      expect(previousMap.tokens).toHaveLength(1);
      expect(previousMap.tokens[0]).toEqual(token);
    });

    it('should delete a map from campaign', () => {
      const store = useGameStore.getState();

      // Add two maps
      store.addMap('Map 1');
      const map1Id = useGameStore.getState().campaign.activeMapId;
      store.addMap('Map 2');

      expect(Object.keys(useGameStore.getState().campaign.maps)).toHaveLength(3); // initial + 2

      // Delete one map
      store.deleteMap(map1Id);

      const state = useGameStore.getState();
      expect(Object.keys(state.campaign.maps)).toHaveLength(2);
      expect(state.campaign.maps[map1Id]).toBeUndefined();
    });

    it('should not delete the last remaining map', () => {
      const store = useGameStore.getState();
      const showToastSpy = vi.spyOn(store, 'showToast');

      const onlyMapId = useGameStore.getState().campaign.activeMapId;

      store.deleteMap(onlyMapId);

      // Map should still exist
      expect(useGameStore.getState().campaign.maps[onlyMapId]).toBeDefined();
      // Should show error toast
      expect(showToastSpy).toHaveBeenCalledWith(expect.any(String), 'error');
    });

    it('should switch to another map when deleting active map', () => {
      const store = useGameStore.getState();

      // Add second map
      store.addMap('Map 2');
      const map2Id = useGameStore.getState().campaign.activeMapId;

      // Go back to first map
      const map1Id = Object.keys(useGameStore.getState().campaign.maps).find(id => id !== map2Id)!;
      store.switchMap(map1Id);

      expect(useGameStore.getState().campaign.activeMapId).toBe(map1Id);

      // Delete the active map
      store.deleteMap(map1Id);

      // Should switch to map2
      expect(useGameStore.getState().campaign.activeMapId).toBe(map2Id);
    });

    it('should sync active map to campaign', () => {
      const store = useGameStore.getState();

      // Add entities to active map
      const token: Token = { id: 'token-1', x: 100, y: 100, src: 'test.png' };
      store.addToken(token);
      store.setGridSize(75);

      const activeMapId = useGameStore.getState().campaign.activeMapId;

      // Sync to campaign
      store.syncActiveMapToCampaign();

      const state = useGameStore.getState();
      const savedMap = state.campaign.maps[activeMapId];

      expect(savedMap.tokens).toHaveLength(1);
      expect(savedMap.tokens[0]).toEqual(token);
      expect(savedMap.gridSize).toBe(75);
    });
  });

  describe('Token Library Operations', () => {
    it('should add a token to the library', () => {
      const store = useGameStore.getState();
      const libraryItem: TokenLibraryItem = {
        id: 'lib-1',
        name: 'Goblin',
        src: 'goblin.png',
        thumbnailSrc: 'goblin-thumb.png',
        category: 'Monsters',
        tags: ['goblin', 'small', 'humanoid'],
        dateAdded: Date.now(),
        defaultScale: 1,
        defaultVisionRadius: 30,
        defaultType: 'NPC',
      };

      store.addTokenToLibrary(libraryItem);

      const state = useGameStore.getState();
      expect(state.campaign.tokenLibrary).toHaveLength(1);
      expect(state.campaign.tokenLibrary[0]).toEqual(libraryItem);
    });

    it('should remove a token from the library', () => {
      const store = useGameStore.getState();
      const libraryItem: TokenLibraryItem = {
        id: 'lib-1',
        name: 'Goblin',
        src: 'goblin.png',
        thumbnailSrc: 'goblin-thumb.png',
        category: 'Monsters',
        tags: ['goblin'],
        dateAdded: Date.now(),
      };

      store.addTokenToLibrary(libraryItem);
      expect(useGameStore.getState().campaign.tokenLibrary).toHaveLength(1);

      store.removeTokenFromLibrary('lib-1');
      expect(useGameStore.getState().campaign.tokenLibrary).toHaveLength(0);
    });

    it('should update a library token', () => {
      const store = useGameStore.getState();
      const libraryItem: TokenLibraryItem = {
        id: 'lib-1',
        name: 'Goblin',
        src: 'goblin.png',
        thumbnailSrc: 'goblin-thumb.png',
        category: 'Monsters',
        tags: ['goblin'],
        dateAdded: Date.now(),
      };

      store.addTokenToLibrary(libraryItem);
      store.updateLibraryToken('lib-1', {
        name: 'Hobgoblin',
        tags: ['hobgoblin', 'medium'],
        defaultScale: 1.5,
      });

      const state = useGameStore.getState();
      expect(state.campaign.tokenLibrary[0].name).toBe('Hobgoblin');
      expect(state.campaign.tokenLibrary[0].tags).toEqual(['hobgoblin', 'medium']);
      expect(state.campaign.tokenLibrary[0].defaultScale).toBe(1.5);
      // Original properties should be preserved
      expect(state.campaign.tokenLibrary[0].category).toBe('Monsters');
    });
  });

  describe('Exploration Operations', () => {
    it('should add an explored region', () => {
      const store = useGameStore.getState();
      const region = {
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
        timestamp: Date.now(),
      };

      store.addExploredRegion(region);

      const state = useGameStore.getState();
      expect(state.exploredRegions).toHaveLength(1);
      expect(state.exploredRegions[0]).toEqual(region);
    });

    it('should clear all explored regions', () => {
      const store = useGameStore.getState();
      const region = {
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
        timestamp: Date.now(),
      };

      store.addExploredRegion(region);
      expect(useGameStore.getState().exploredRegions).toHaveLength(1);

      store.clearExploredRegions();
      expect(useGameStore.getState().exploredRegions).toHaveLength(0);
    });
  });

  describe('System State Operations', () => {
    it('should show and clear toast messages', () => {
      const store = useGameStore.getState();

      store.showToast('Test message', 'success');

      let state = useGameStore.getState();
      expect(state.toast).toEqual({ message: 'Test message', type: 'success' });

      store.clearToast();

      state = useGameStore.getState();
      expect(state.toast).toBeNull();
    });

    it('should show and clear confirm dialog', () => {
      const store = useGameStore.getState();
      const onConfirm = vi.fn();

      store.showConfirmDialog('Are you sure?', onConfirm, 'Yes');

      let state = useGameStore.getState();
      expect(state.confirmDialog).toEqual({
        message: 'Are you sure?',
        onConfirm,
        confirmText: 'Yes',
      });

      store.clearConfirmDialog();

      state = useGameStore.getState();
      expect(state.confirmDialog).toBeNull();
    });

    it('should toggle calibration mode', () => {
      const store = useGameStore.getState();

      expect(useGameStore.getState().isCalibrating).toBe(false);

      store.setIsCalibrating(true);
      expect(useGameStore.getState().isCalibrating).toBe(true);

      store.setIsCalibrating(false);
      expect(useGameStore.getState().isCalibrating).toBe(false);
    });

    it('should toggle resource monitor', () => {
      const store = useGameStore.getState();

      expect(useGameStore.getState().showResourceMonitor).toBe(false);

      store.setShowResourceMonitor(true);
      expect(useGameStore.getState().showResourceMonitor).toBe(true);
    });

    it('should show and clear dungeon dialog', () => {
      const store = useGameStore.getState();

      expect(useGameStore.getState().dungeonDialog).toBe(false);

      store.showDungeonDialog();
      expect(useGameStore.getState().dungeonDialog).toBe(true);

      store.clearDungeonDialog();
      expect(useGameStore.getState().dungeonDialog).toBe(false);
    });

    it('should set game paused state', () => {
      const store = useGameStore.getState();

      expect(useGameStore.getState().isGamePaused).toBe(false);

      store.setIsGamePaused(true);
      expect(useGameStore.getState().isGamePaused).toBe(true);
    });

    it('should set mobile sidebar open state', () => {
      const store = useGameStore.getState();

      expect(useGameStore.getState().isMobileSidebarOpen).toBe(false);

      store.setMobileSidebarOpen(true);
      expect(useGameStore.getState().isMobileSidebarOpen).toBe(true);
    });
  });

  describe('Vision Operations', () => {
    it('should set active vision polygons', () => {
      const store = useGameStore.getState();
      const polygons = [
        [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
        [{ x: 200, y: 200 }, { x: 300, y: 200 }, { x: 300, y: 300 }],
      ];

      store.setActiveVisionPolygons(polygons);

      const state = useGameStore.getState();
      expect(state.activeVisionPolygons).toEqual(polygons);
    });
  });

  describe('Measurement Operations', () => {
    it('should set active measurement', () => {
      const store = useGameStore.getState();
      const measurement = {
        type: 'ruler' as const,
        startX: 0,
        startY: 0,
        endX: 100,
        endY: 100,
        distance: 141.42,
      };

      store.setActiveMeasurement(measurement);

      const state = useGameStore.getState();
      expect(state.activeMeasurement).toEqual(measurement);
    });

    it('should clear active measurement', () => {
      const store = useGameStore.getState();
      const measurement = {
        type: 'ruler' as const,
        startX: 0,
        startY: 0,
        endX: 100,
        endY: 100,
        distance: 141.42,
      };

      store.setActiveMeasurement(measurement);
      expect(useGameStore.getState().activeMeasurement).not.toBeNull();

      store.setActiveMeasurement(null);
      expect(useGameStore.getState().activeMeasurement).toBeNull();
    });

    it('should set broadcast measurement flag', () => {
      const store = useGameStore.getState();

      expect(useGameStore.getState().broadcastMeasurement).toBe(false);

      store.setBroadcastMeasurement(true);
      expect(useGameStore.getState().broadcastMeasurement).toBe(true);
    });

    it('should set DM measurement for World View', () => {
      const store = useGameStore.getState();
      const measurement = {
        type: 'cone' as const,
        startX: 0,
        startY: 0,
        endX: 100,
        endY: 100,
        distance: 141.42,
      };

      store.setDmMeasurement(measurement);

      const state = useGameStore.getState();
      expect(state.dmMeasurement).toEqual(measurement);
    });
  });
});
