/**
 * ThemeManager Component
 *
 * Renderer-side theme controller that:
 * 1. Fetches initial theme state from main process on mount
 * 2. Applies theme by setting <html data-theme="..."> attribute
 * 3. Listens for theme changes (from menu or OS) and updates DOM
 * 4. Prevents flash of unstyled content (FOUC) with sync preload
 *
 * ARCHITECTURE:
 * - Mounts once at app root (src/App.tsx)
 * - Subscribes to 'theme-changed' IPC events
 * - Updates DOM directly (not via React state for performance)
 * - Handles 'theme-loading' class to disable transitions on init
 *
 * PREVENTING FOUC:
 * - Initial theme is applied synchronously in index.html <script>
 * - This component syncs with main process and corrects if needed
 * - 'theme-loading' class prevents transition animations on first paint
 */

import { useEffect } from 'react'

// TypeScript declarations for window.themeAPI (exposed by preload.ts)
declare global {
  interface Window {
    themeAPI: {
      getThemeState: () => Promise<{ mode: string; effectiveTheme: string }>
      setThemeMode: (mode: string) => Promise<void>
      onThemeChanged: (callback: (data: { mode: string; effectiveTheme: string }) => void) => () => void
    }
  }
}

/**
 * Apply theme to DOM
 *
 * Sets data-theme attribute on <html> element.
 * This triggers CSS variable switching in theme.css.
 *
 * @param theme - 'light' or 'dark'
 */
function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', theme)
}

/**
 * ThemeManager Component
 *
 * Mount this once at the app root. It has no visible UI.
 */
export function ThemeManager() {
  useEffect(() => {
    let cleanup: (() => void) | undefined

    /**
     * Initialize theme system
     *
     * 1. Fetch current theme from main process
     * 2. Apply to DOM
     * 3. Subscribe to theme changes
     * 4. Remove 'theme-loading' class to enable transitions
     */
    async function initializeTheme() {
      try {
        // Fetch initial theme state
        const { effectiveTheme } = await window.themeAPI.getThemeState()
        applyTheme(effectiveTheme as 'light' | 'dark')

        // Subscribe to theme changes from main process
        cleanup = window.themeAPI.onThemeChanged(({ effectiveTheme }) => {
          applyTheme(effectiveTheme as 'light' | 'dark')
        })

        // Enable smooth transitions after initial theme is applied
        // (prevents animated flash on page load)
        requestAnimationFrame(() => {
          document.body.classList.remove('theme-loading')
        })
      } catch (error) {
        console.error('[ThemeManager] Failed to initialize theme:', error)
        // Fallback to light theme on error
        applyTheme('light')
        document.body.classList.remove('theme-loading')
      }
    }

    initializeTheme()

    // Cleanup: unsubscribe from theme changes
    return () => {
      cleanup?.()
    }
  }, []) // Run once on mount

  // This component has no UI
  return null
}
