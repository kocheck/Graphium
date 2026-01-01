/**
 * Theme Manager for Graphium
 *
 * Manages application theme state with three modes:
 * - 'light': Force light theme
 * - 'dark': Force dark theme
 * - 'system': Follow OS theme preference (default)
 *
 * ARCHITECTURE:
 * - Main process stores theme preference using electron-store
 * - Monitors OS theme changes via nativeTheme.on('updated')
 * - Communicates resolved theme to renderer via IPC
 * - Renderer applies theme by setting <html data-theme="...">
 *
 * STATE FLOW:
 * 1. User selects theme from Menu → setTheme() → Store preference
 * 2. OS theme changes → nativeTheme.on('updated') → Recalculate effective theme
 * 3. Effective theme → Broadcast to all renderer windows via IPC
 * 4. Renderer → Apply data-theme attribute
 *
 * PERSISTENCE:
 * Theme preference is stored in: ~/Library/Application Support/graphium/config.json
 * (on macOS, varies by platform)
 */

import { nativeTheme, BrowserWindow } from 'electron'
import Store from 'electron-store'

export type ThemeMode = 'light' | 'dark' | 'system'
export type EffectiveTheme = 'light' | 'dark'

interface ThemeStoreSchema {
  theme: ThemeMode
}

/**
 * Theme store configuration
 *
 * Uses electron-store for persistent storage of user preference.
 * Stored in app.getPath('userData')/config.json
 */
const store = new Store<ThemeStoreSchema>({
  defaults: {
    theme: 'system', // Default to following OS preference
  },
  name: 'theme-preferences', // Creates theme-preferences.json
})

/**
 * Get the current theme mode preference
 *
 * @returns The user's theme preference ('light', 'dark', or 'system')
 */
export function getThemeMode(): ThemeMode {
  return store.get('theme')
}

/**
 * Set the theme mode preference and broadcast to renderers
 *
 * @param mode - Theme mode to set
 * @emits 'theme-changed' to all renderer windows with effective theme
 */
export function setThemeMode(mode: ThemeMode): void {
  store.set('theme', mode)

  // Force nativeTheme to match preference (if not 'system')
  if (mode === 'light') {
    nativeTheme.themeSource = 'light'
  } else if (mode === 'dark') {
    nativeTheme.themeSource = 'dark'
  } else {
    nativeTheme.themeSource = 'system' // Follow OS preference
  }

  // Broadcast effective theme to all renderer windows
  broadcastThemeToRenderers()
}

/**
 * Get the effective theme (resolves 'system' to actual theme)
 *
 * @returns 'light' or 'dark' based on current mode and OS preference
 */
export function getEffectiveTheme(): EffectiveTheme {
  const mode = getThemeMode()

  if (mode === 'system') {
    // Use OS preference when in system mode
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  }

  return mode // 'light' or 'dark' (explicit override)
}

/**
 * Broadcast current theme to all renderer windows
 *
 * Sends IPC message 'theme-changed' with effective theme.
 * Called when:
 * - Theme mode changes (user selection)
 * - OS theme changes (system mode only)
 * - New window is created (initial theme sync)
 */
export function broadcastThemeToRenderers(): void {
  const effectiveTheme = getEffectiveTheme()
  const mode = getThemeMode()

  BrowserWindow.getAllWindows().forEach((window: BrowserWindow) => {
    window.webContents.send('theme-changed', {
      mode,
      effectiveTheme,
    })
  })
}

/**
 * Initialize theme system
 *
 * Sets up OS theme change listener and applies initial theme.
 * Call this once during app.whenReady().
 */
export function initializeThemeManager(): void {
  // Apply stored theme preference
  const mode = getThemeMode()
  setThemeMode(mode) // This will broadcast to renderers

  /**
   * Monitor OS theme changes
   *
   * When user changes system theme (e.g., macOS Dark Mode toggle),
   * nativeTheme.updated fires. We recalculate effective theme and
   * broadcast to renderers (but only if in 'system' mode).
   */
  nativeTheme.on('updated', () => {
    const currentMode = getThemeMode()

    // Only broadcast if we're in system mode (user wants to follow OS)
    if (currentMode === 'system') {
      broadcastThemeToRenderers()
    }
  })
}

/**
 * Get theme state for IPC handler
 *
 * Used by renderer to query current theme on mount.
 *
 * @returns Object with mode and effectiveTheme
 */
export function getThemeState(): { mode: ThemeMode; effectiveTheme: EffectiveTheme } {
  return {
    mode: getThemeMode(),
    effectiveTheme: getEffectiveTheme(),
  }
}
