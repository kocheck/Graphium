/**
 * ThemeManager Component
 *
 * Platform-agnostic theme controller that:
 * 1. Fetches initial theme state from storage (electron-store or localStorage)
 * 2. Applies theme by setting <html data-theme="..."> attribute
 * 3. Listens for theme changes (Electron: from menu/OS, Web: from storage events)
 * 4. Prevents flash of unstyled content (FOUC) with sync preload
 *
 * ARCHITECTURE:
 * - Mounts once at app root (src/App.tsx)
 * - Subscribes to theme changes (IPC events in Electron, storage events in Web)
 * - Updates DOM directly (not via React state for performance)
 * - Handles 'theme-loading' class to disable transitions on init
 *
 * PREVENTING FOUC:
 * - Initial theme is applied synchronously in index.html <script>
 * - This component syncs with storage and corrects if needed
 * - 'theme-loading' class prevents transition animations on first paint
 */

import { useEffect } from 'react'
import { getStorage } from '../services/storage'

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
     * Resolve effective theme based on mode
     * @param mode - Theme mode ('light', 'dark', or 'system')
     * @returns Effective theme ('light' or 'dark')
     */
    function resolveEffectiveTheme(mode: 'light' | 'dark' | 'system'): 'light' | 'dark' {
      if (mode === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
      return mode
    }

    /**
     * Initialize theme system
     *
     * 1. Fetch current theme from storage
     * 2. Apply to DOM
     * 3. Subscribe to theme changes (platform-specific)
     * 4. Remove 'theme-loading' class to enable transitions
     */
    async function initializeTheme() {
      try {
        const storage = getStorage()
        const isElectron = storage.getPlatform() === 'electron'

        if (isElectron && window.themeAPI) {
          // Electron: Use themeAPI for full OS integration
          const { effectiveTheme } = await window.themeAPI.getThemeState()
          applyTheme(effectiveTheme as 'light' | 'dark')

          // Subscribe to theme changes from main process
          cleanup = window.themeAPI.onThemeChanged(({ effectiveTheme }) => {
            applyTheme(effectiveTheme as 'light' | 'dark')
          })
        } else {
          // Web: Use storage service and matchMedia for system theme
          const mode = await storage.getThemeMode()
          const effectiveTheme = resolveEffectiveTheme(mode)
          applyTheme(effectiveTheme)

          // Subscribe to system theme changes (for 'system' mode)
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
          const handleSystemThemeChange = async () => {
            const currentMode = await storage.getThemeMode()
            if (currentMode === 'system') {
              const newTheme = resolveEffectiveTheme('system')
              applyTheme(newTheme)
            }
          }

          // Subscribe to cross-tab theme changes (for multi-window sync)
          const themeChannel = new BroadcastChannel('hyle-theme-sync')
          const handleCrossTabThemeChange = (event: MessageEvent) => {
            if (event.data?.type === 'THEME_CHANGED') {
              const newMode = event.data.mode as 'light' | 'dark' | 'system'
              const newTheme = resolveEffectiveTheme(newMode)
              applyTheme(newTheme)
            }
          }

          mediaQuery.addEventListener('change', handleSystemThemeChange)
          themeChannel.addEventListener('message', handleCrossTabThemeChange)
          
          cleanup = () => {
            mediaQuery.removeEventListener('change', handleSystemThemeChange)
            themeChannel.removeEventListener('message', handleCrossTabThemeChange)
            themeChannel.close()
          }
        }

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
