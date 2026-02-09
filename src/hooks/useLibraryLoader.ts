/**
 * useLibraryLoader — Loads token library index on startup
 *
 * Fetches the library index from storage and merges it with the
 * campaign's existing token library. Only runs in Architect View.
 *
 * @see src/services/IStorageService.ts for loadLibraryIndex()
 */

import { useEffect } from 'react';

import { getStorage } from '../services/storage';
import { useGameStore } from '../store/gameStore';

export function useLibraryLoader(isArchitectView: boolean): void {
  useEffect(() => {
    if (!isArchitectView) {
      return;
    }

    const loadLibrary = async () => {
      try {
        const storage = getStorage();
        const libraryItems = await storage.loadLibraryIndex();

        if (libraryItems && Array.isArray(libraryItems)) {
          useGameStore.setState((state) => {
            const currentLibrary = state.campaign.tokenLibrary;
            const existingIds = new Set(currentLibrary.map((item) => item.id));
            const newItems = libraryItems.filter((item) => !existingIds.has(item.id));

            if (newItems.length === 0) {
              return state;
            }

            return {
              campaign: {
                ...state.campaign,
                tokenLibrary: [...currentLibrary, ...newItems],
              },
            };
          });
        }
      } catch (error) {
        console.error('[App] Failed to load library index:', error);
      }
    };

    void loadLibrary();
  }, [isArchitectView]);
}
