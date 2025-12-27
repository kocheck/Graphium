/**
 * Fuzzy search utility for token library
 *
 * Provides simple fuzzy matching for library asset search.
 * Matches query against asset name and tags (case-insensitive).
 *
 * @example
 * fuzzySearch(library, "dragon") // Returns all items with "dragon" in name or tags
 * fuzzySearch(library, "red drg") // Matches "Red Dragon" (substring matching)
 */

import type { TokenLibraryItem } from '../store/gameStore';

/**
 * Calculate fuzzy match score for a single string against query
 *
 * @param text - Text to search in
 * @param query - Search query
 * @returns Score (higher is better match), 0 if no match
 */
function scoreMatch(text: string, query: string): number {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Exact match = highest score
  if (lowerText === lowerQuery) return 100;

  // Starts with query = high score
  if (lowerText.startsWith(lowerQuery)) return 90;

  // Contains query = medium score
  if (lowerText.includes(lowerQuery)) return 70;

  // Check for substring matches of individual query words
  const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 0);
  const matchedWords = queryWords.filter(word => lowerText.includes(word));

  if (matchedWords.length === queryWords.length) {
    // All query words found
    return 50;
  } else if (matchedWords.length > 0) {
    // Some query words found
    return 30 * (matchedWords.length / queryWords.length);
  }

  return 0; // No match
}

/**
 * Search library items by name and tags
 *
 * @param items - Library items to search
 * @param query - Search query
 * @returns Filtered and sorted results (best matches first)
 */
export function fuzzySearch(items: TokenLibraryItem[], query: string): TokenLibraryItem[] {
  if (!query || query.trim().length === 0) {
    // No query = return all items sorted by date (newest first)
    return [...items].sort((a, b) => b.dateAdded - a.dateAdded);
  }

  const trimmedQuery = query.trim();

  // Score each item
  const scored = items.map(item => {
    let score = 0;

    // Score name (weight: 3x)
    score += scoreMatch(item.name, trimmedQuery) * 3;

    // Score category (weight: 1x)
    score += scoreMatch(item.category, trimmedQuery);

    // Score tags (weight: 2x each)
    for (const tag of item.tags) {
      score += scoreMatch(tag, trimmedQuery) * 2;
    }

    return { item, score };
  });

  // Filter out zero scores and sort by score descending
  return scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

/**
 * Filter library items by category
 *
 * @param items - Library items to filter
 * @param category - Category to filter by (case-insensitive)
 * @returns Filtered items
 */
export function filterByCategory(items: TokenLibraryItem[], category: string): TokenLibraryItem[] {
  if (!category || category === 'All') {
    return items;
  }

  return items.filter(item =>
    item.category.toLowerCase() === category.toLowerCase()
  );
}

/**
 * Get unique categories from library items
 *
 * @param items - Library items
 * @returns Sorted array of unique category names
 */
export function getCategories(items: TokenLibraryItem[]): string[] {
  const categories = new Set(items.map(item => item.category));
  return Array.from(categories).sort();
}
