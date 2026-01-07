/**
 * useMediaQuery Hook
 *
 * Provides reactive media query support for responsive design.
 * Returns true/false based on whether the media query matches.
 *
 * @example
 * const isMobile = useMediaQuery('(max-width: 767px)');
 * return isMobile ? <MobileView /> : <DesktopView />;
 *
 * @param query - CSS media query string
 * @returns boolean - true if media query matches
 */

import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  // Initialize with current match state
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    // Create media query list
    const mediaQuery = window.matchMedia(query);

    // Update state to match current query
    setMatches(mediaQuery.matches);

    // Handler for media query changes
    const handler = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    // Listen for changes (modern API)
    mediaQuery.addEventListener('change', handler);

    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, [query]);

  return matches;
}

/**
 * Convenience hook: Mobile devices (phones)
 * Breakpoint: 0px - 767px
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}

/**
 * Convenience hook: Tablet devices
 * Breakpoint: 768px - 1023px
 */
export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
}

/**
 * Convenience hook: Desktop devices
 * Breakpoint: 1024px and above
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}

/**
 * Convenience hook: Touch-capable devices
 * Detects if device supports touch (not just screen size)
 */
export function useIsTouchDevice(): boolean {
  const [isTouch] = useState(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false;
    }

    const nav = navigator as Navigator & { msMaxTouchPoints?: number };

    return 'ontouchstart' in window || nav.maxTouchPoints > 0 || (nav.msMaxTouchPoints ?? 0) > 0;
  });

  return isTouch;
}
