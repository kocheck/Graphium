/**
 * Token utility functions
 */

export interface Token {
    id: string;
    src: string;
    [key: string]: unknown;
}

export interface LibraryItem {
    id: string;
    src: string;
    thumbnailSrc: string;
    name: string;
    [key: string]: unknown;
}

/**
 * Gets unique recent tokens from the current map's token list
 * based on matching source images in the library.
 *
 * @param tokens - List of tokens currently on the map
 * @param library - The token library to look up metadata
 * @param limit - Max number of recent tokens to return (default 3)
 */
export function getRecentTokens(
    tokens: Token[],
    library: LibraryItem[],
    limit: number = 3
): LibraryItem[] {
    const uniqueSrcs = new Set<string>();
    const recent: LibraryItem[] = [];

    // Iterate tokens in reverse (most recent first)
    // Assuming the tokens array order roughly correlates to addition order
    // or at least presence.
    for (let i = tokens.length - 1; i >= 0 && recent.length < limit; i--) {
        const token = tokens[i];
        if (!uniqueSrcs.has(token.src)) {
            uniqueSrcs.add(token.src);
            // Find corresponding library item
            const libraryItem = library.find(item => item.src === token.src);
            if (libraryItem) {
                recent.push(libraryItem);
            }
        }
    }
    return recent;
}
