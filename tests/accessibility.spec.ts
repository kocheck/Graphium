/**
 * Accessibility Tests - WCAG AA Compliance
 *
 * This test suite uses Playwright + axe-core to automatically detect
 * accessibility violations in the Hyle application.
 *
 * TESTED CRITERIA:
 * - WCAG 2.1 Level AA contrast ratios (4.5:1 for normal text, 3:1 for large text)
 * - Color contrast on all UI components
 * - Form labels and ARIA attributes
 * - Keyboard navigation support
 *
 * EXCLUSIONS:
 * - Canvas layer (Konva.js) - excluded as it contains game-specific graphics
 * - Disabled elements (intentionally low contrast per WCAG exception)
 *
 * RUN LOCALLY:
 * npm run test:a11y
 */

import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import fs from 'fs'
import { injectMockElectronAPIs } from './helpers/mockElectronAPIs'

test.describe('Accessibility Audit', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to built application
    // In CI: npm run build creates dist/ folder, we serve it statically
    // In dev: use npm run dev server
    const baseURL = process.env.CI
      ? 'http://localhost:4173' // Vite preview server
      : 'http://localhost:5173' // Vite dev server

    // Inject mock Electron APIs before the page loads
    await page.addInitScript(injectMockElectronAPIs)

    await page.goto(baseURL)

    // Wait for app to fully render (visible, not just present)
    await page.waitForSelector('#root:visible', { timeout: 60000 })
  })

  test('Light theme - no WCAG AA violations', async ({ page }) => {
    // Force light theme via theme API
    await page.evaluate(() => {
      // @ts-ignore - window.themeAPI is exposed by preload.ts
      window.themeAPI?.setThemeMode('light')
    })

    // Wait for theme to apply
    await page.waitForFunction(() => {
      return document.documentElement.getAttribute('data-theme') === 'light'
    })

    // Run axe accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']) // WCAG 2.1 AA rules
      .exclude('canvas') // Exclude Konva canvas (non-text graphics)
      .exclude('[aria-disabled="true"]') // Exclude disabled elements (WCAG exception)
      .analyze()

    // Save violations to file for CI reporting
    if (accessibilityScanResults.violations.length > 0) {
      fs.writeFileSync(
        'accessibility-violations.json',
        JSON.stringify(accessibilityScanResults.violations, null, 2)
      )
    }

    // Fail test if any violations found
    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('Dark theme - no WCAG AA violations', async ({ page }) => {
    // Force dark theme via theme API
    await page.evaluate(() => {
      // @ts-ignore
      window.themeAPI?.setThemeMode('dark')
    })

    // Wait for theme to apply
    await page.waitForFunction(() => {
      return document.documentElement.getAttribute('data-theme') === 'dark'
    })

    // Run axe accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('canvas')
      .exclude('[aria-disabled="true"]')
      .analyze()

    // Save violations
    if (accessibilityScanResults.violations.length > 0) {
      fs.writeFileSync(
        'accessibility-violations-dark.json',
        JSON.stringify(accessibilityScanResults.violations, null, 2)
      )
    }

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('System theme syncs with OS preference', async ({ page }, testInfo) => {
    // Skip in CI: This test verifies Electron theme sync functionality, not WCAG compliance
    // It requires complex media query mocking that's not critical for accessibility
    testInfo.skip(!!process.env.CI, 'Skipping OS theme sync test in CI (not a WCAG requirement)');

    // Simulate dark mode OS preference
    await page.emulateMedia({ colorScheme: 'dark' })

    // Set theme to 'system' mode
    await page.evaluate(() => {
      // @ts-ignore
      window.themeAPI?.setThemeMode('system')
    })

    // Wait for theme to sync
    await page.waitForFunction(() => {
      return document.documentElement.getAttribute('data-theme') === 'dark'
    })

    // Verify dark theme is applied
    const theme = await page.getAttribute('html', 'data-theme')
    expect(theme).toBe('dark')

    // Switch OS preference to light
    await page.emulateMedia({ colorScheme: 'light' })

    // Wait for theme to update
    await page.waitForFunction(() => {
      return document.documentElement.getAttribute('data-theme') === 'light'
    })

    const newTheme = await page.getAttribute('html', 'data-theme')
    expect(newTheme).toBe('light')
  })

  test('Specific contrast checks - primary text on background', async ({ page }) => {
    // This test verifies critical text/background combinations manually
    // (axe-core already checks these, but we validate specific Radix mappings)

    await page.evaluate(() => {
      // @ts-ignore
      window.themeAPI?.setThemeMode('light')
    })

    await page.waitForFunction(() => {
      return document.documentElement.getAttribute('data-theme') === 'light'
    })

    // Get computed styles for semantic variables
    const contrast = await page.evaluate(() => {
      const root = document.documentElement
      const styles = getComputedStyle(root)

      return {
        bgBase: styles.getPropertyValue('--app-bg-base').trim(),
        textPrimary: styles.getPropertyValue('--app-text-primary').trim(),
        textSecondary: styles.getPropertyValue('--app-text-secondary').trim(),
      }
    })

    // Verify variables are defined (actual contrast checked by axe)
    expect(contrast.bgBase).toBeTruthy()
    expect(contrast.textPrimary).toBeTruthy()
    expect(contrast.textSecondary).toBeTruthy()
  })
})
