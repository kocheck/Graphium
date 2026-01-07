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
/**
 * Calculate fuzzy match score using subsequence matching
 *
 * @param text - Text to search in
 * @param query - Search query
 * @returns Score (higher is better match), 0 if no match
 */
function scoreMatch(text: string, query: string): number {
  if (!query) return 0;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Exact match = highest score
  if (lowerText === lowerQuery) return 100;

  // 1. Check if query is a subsequence
  let qIdx = 0;
  let tIdx = 0;
  while (tIdx < lowerText.length && qIdx < lowerQuery.length) {
    if (lowerText[tIdx] === lowerQuery[qIdx]) {
      qIdx++;
    }
    tIdx++;
  }

  // If not all query chars found in order, no match
  if (qIdx < lowerQuery.length) return 0;

  // 2. Calculate score based on quality of match
  let score = 0;

  // Baseline for matching
  score += 10;

  // Bonus: Starts with query
  if (lowerText.startsWith(lowerQuery)) score += 40;

  // Bonus: Contains exact query substring
  if (lowerText.includes(lowerQuery)) score += 20;

  // Re-scan for structural bonuses
  let lastMatchIdx = -1;
  let compactness = 0; // Penalty for distance between matches

  qIdx = 0;
  for (let i = 0; i < lowerQuery.length; i++) {
    const char = lowerQuery[i];
    // Find next occurrence
    const idx = lowerText.indexOf(char, lastMatchIdx + 1);

    // Bonus: Match is at start of word (or start of string)
    if (
      idx === 0 ||
      lowerText[idx - 1] === ' ' ||
      lowerText[idx - 1] === '-' ||
      lowerText[idx - 1] === '_'
    ) {
      score += 15;
    }

    // Bonus: Consecutive match
    if (idx === lastMatchIdx + 1) {
      score += 10;
    } else {
      // Distance penalty
      if (lastMatchIdx !== -1) {
        compactness += idx - lastMatchIdx;
      }
    }

    lastMatchIdx = idx;
  }

  // Deduct penalty for spread out matches (shorter spread is better)
  score -= Math.min(compactness, 20);

  return Math.max(0, score);
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
  const lowerQuery = trimmedQuery.toLowerCase();

  // Check if searching for section title
  const isSectionSearch = 'assets'.startsWith(lowerQuery);
  const sectionBoost = isSectionSearch ? 50 : 0;

  // Score each item
  const scored = items.map((item) => {
    let score = 0;

    // Apply section boost if applicable
    if (isSectionSearch) {
      score += sectionBoost;
      // If exact "assets" typed, show everything with high score
      if (lowerQuery === 'assets') return { item, score: 100 };
    }

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

  return items.filter((item) => item.category.toLowerCase() === category.toLowerCase());
}

/**
 * Get unique categories from library items
 *
 * @param items - Library items
 * @returns Sorted array of unique category names
 */
export function getCategories(items: TokenLibraryItem[]): string[] {
  const categories = new Set(items.map((item) => item.category));
  return Array.from(categories).sort();
}
