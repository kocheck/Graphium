# Hyle Theme System Documentation

**Version:** 1.0.0
**Last Updated:** 2025-12-15

This document explains Hyle's accessible theme system for developers, future AI assistants, and contributors.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Color System](#color-system)
3. [Using Semantic Variables](#using-semantic-variables)
4. [Main Process (Theme Logic)](#main-process-theme-logic)
5. [Renderer Process (Theme Application)](#renderer-process-theme-application)
6. [State Management](#state-management)
7. [Testing & Accessibility](#testing--accessibility)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Three-Tier Theme System

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERACTION                        │
│          (Menu → View → Theme → Light/Dark/System)          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   MAIN PROCESS (Node.js)                    │
│                                                             │
│  electron/themeManager.ts                                   │
│  ├── electron-store (persistent storage)                    │
│  ├── nativeTheme API (OS theme detection)                   │
│  └── IPC broadcast (→ all renderer windows)                 │
│                                                             │
│  Stored in: ~/Library/Application Support/hyle/             │
│              theme-preferences.json                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  RENDERER PROCESS (React)                   │
│                                                             │
│  src/components/ThemeManager.tsx                            │
│  ├── Subscribes to 'theme-changed' IPC                      │
│  ├── Applies <html data-theme="light|dark">                 │
│  └── Triggers CSS variable switching                        │
│                                                             │
│  src/styles/theme.css                                       │
│  └── Semantic CSS variables → Radix Colors                  │
└─────────────────────────────────────────────────────────────┘
```

### Theme Modes

| Mode | Behavior |
|------|----------|
| **Light** | Force light theme, ignores OS preference |
| **Dark** | Force dark theme, ignores OS preference |
| **System** (default) | Follows OS preference, updates dynamically |

---

## Color System

### Radix Colors Foundation

Hyle uses [Radix Colors](https://www.radix-ui.com/colors) as its color foundation. Radix provides:
- **WCAG AA compliant** color scales out-of-the-box
- **Automatic light/dark variants** (e.g., `slate` → `slate-dark`)
- **Semantic scale steps** (1-12) for consistent contrast

**Scale Semantics:**
- **Steps 1-2:** App backgrounds (lightest)
- **Steps 3-6:** Component backgrounds, borders, hover states
- **Steps 9-10:** Solid colors (buttons, badges)
- **Steps 11-12:** High-contrast text (guaranteed AA compliance)

### Semantic Variable Mapping

**CRITICAL RULE:** Never use raw Radix scale names (e.g., `var(--slate-4)`) in components. Always use semantic variables.

#### Example Mappings

```css
/* ✅ CORRECT */
background: var(--app-bg-surface);
color: var(--app-text-primary);
border: 1px solid var(--app-border-default);

/* ❌ WRONG - DO NOT DO THIS */
background: var(--slate-3);
color: var(--slate-12);
border: 1px solid var(--slate-7);
```

#### Full Variable Reference

See `src/styles/theme.css` for the complete list. Key categories:

| Category | Variables | Usage |
|----------|-----------|-------|
| **Backgrounds** | `--app-bg-base`, `--app-bg-surface`, `--app-bg-hover` | Page backgrounds, panels, cards |
| **Text** | `--app-text-primary`, `--app-text-secondary`, `--app-text-muted` | Body text, labels, placeholders |
| **Borders** | `--app-border-subtle`, `--app-border-default` | Dividers, outlines |
| **Accent** | `--app-accent-solid`, `--app-accent-text` | Primary buttons, links |
| **Status** | `--app-error-*`, `--app-warning-*`, `--app-success-*` | Alerts, notifications |

---

## Using Semantic Variables

### In CSS Files

```css
.my-component {
  background: var(--app-bg-surface);
  color: var(--app-text-primary);
  border: 1px solid var(--app-border-subtle);
}

.my-component:hover {
  background: var(--app-bg-hover);
}
```

### In Tailwind CSS (Future)

When migrating existing Tailwind classes, replace hardcoded colors:

```tsx
/* Before */
<div className="bg-neutral-900 text-white">

/* After */
<div style={{ background: 'var(--app-bg-base)', color: 'var(--app-text-primary)' }}>

/* Or create Tailwind utility classes: */
<div className="bg-surface text-primary">
```

To extend Tailwind with semantic variables, update `tailwind.config.js`:

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        'bg-base': 'var(--app-bg-base)',
        'bg-surface': 'var(--app-bg-surface)',
        'text-primary': 'var(--app-text-primary)',
        // ... add all semantic variables
      }
    }
  }
}
```

---

## Main Process (Theme Logic)

### File: `electron/themeManager.ts`

This module manages theme state in the Electron main process.

#### Key Functions

```typescript
import { getThemeState, setThemeMode, initializeThemeManager } from './themeManager.js'

// Get current theme state
const state = getThemeState()
// Returns: { mode: 'system', effectiveTheme: 'dark' }

// Set theme mode
setThemeMode('dark') // Options: 'light' | 'dark' | 'system'

// Initialize (called in app.whenReady())
initializeThemeManager()
```

#### Storage Location

Theme preference is stored in:
- **macOS:** `~/Library/Application Support/hyle/theme-preferences.json`
- **Windows:** `%APPDATA%/hyle/theme-preferences.json`
- **Linux:** `~/.config/hyle/theme-preferences.json`

Example contents:
```json
{
  "theme": "system"
}
```

#### OS Theme Detection

When in `'system'` mode, the app monitors OS theme changes using Electron's `nativeTheme` API:

```typescript
nativeTheme.on('updated', () => {
  if (getThemeMode() === 'system') {
    broadcastThemeToRenderers() // Auto-sync with OS
  }
})
```

---

## Renderer Process (Theme Application)

### File: `src/components/ThemeManager.tsx`

This React component applies the theme by setting the `data-theme` attribute on the `<html>` element.

#### How It Works

1. **Mount:** Component fetches initial theme via IPC
2. **Apply:** Sets `<html data-theme="light|dark">`
3. **Subscribe:** Listens for `'theme-changed'` IPC events
4. **Update:** Applies new theme when received

#### Usage

Mount once in `App.tsx`:

```tsx
import { ThemeManager } from './components/ThemeManager'

function App() {
  return (
    <>
      <ThemeManager /> {/* No props, no UI */}
      {/* Rest of app */}
    </>
  )
}
```

### Preventing Flash of Unstyled Content (FOUC)

To prevent a white flash on app load:

1. **index.html** runs a synchronous script to detect system theme:
   ```html
   <script>
     const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
     document.documentElement.setAttribute('data-theme', systemPrefersDark ? 'dark' : 'light');
     document.body.classList.add('theme-loading');
   </script>
   ```

2. **ThemeManager** syncs with stored preference and removes `theme-loading` class:
   ```typescript
   requestAnimationFrame(() => {
     document.body.classList.remove('theme-loading')
   })
   ```

3. **theme.css** disables transitions while loading:
   ```css
   .theme-loading * {
     transition: none !important;
   }
   ```

---

## State Management

### IPC Communication Flow

```
User clicks menu → Main process (setThemeMode)
                  → electron-store (persist)
                  → nativeTheme.themeSource = 'dark'
                  → IPC broadcast 'theme-changed'
                  → Renderer (ThemeManager)
                  → document.documentElement.setAttribute('data-theme', 'dark')
                  → CSS variables switch
```

### IPC Channels

| Channel | Direction | Payload | Purpose |
|---------|-----------|---------|---------|
| `get-theme-state` | Renderer → Main | None | Fetch initial theme on mount |
| `set-theme-mode` | Renderer → Main | `'light'` \| `'dark'` \| `'system'` | Update theme preference |
| `theme-changed` | Main → Renderer | `{ mode, effectiveTheme }` | Notify of theme change |

---

## Testing & Accessibility

### Running Accessibility Tests

```bash
npm run test:a11y
```

This runs Playwright + axe-core tests to verify:
- WCAG AA contrast ratios (≥ 4.5:1 for text)
- Both light and dark themes
- System theme synchronization

### CI/CD Integration

Pull requests to `NEXT` branch automatically run accessibility audits:
- File: `.github/workflows/accessibility.yml`
- Fails build if WCAG AA violations detected
- Posts comment with violation details

### Manual Contrast Checking

Use browser DevTools:
1. Inspect element with text
2. Open "Accessibility" pane in DevTools
3. Verify contrast ratio ≥ 4.5:1

Reference: `docs/WCAG_CONTRAST_AUDIT.md`

---

## Troubleshooting

### Theme Not Persisting

**Problem:** Theme resets to system after app restart.

**Solution:**
- Check `electron-store` permissions (write access to config folder)
- Verify `electron/themeManager.ts` imports correctly
- Check for errors in console: `Failed to initialize theme`

### Flash of Wrong Theme on Load

**Problem:** App shows light theme briefly before switching to dark.

**Solution:**
- Ensure `index.html` FOUC prevention script runs before `<body>`
- Verify `theme-loading` class is added to `<body>`
- Check `ThemeManager.tsx` removes class after sync

### Menu Checkmarks Not Updating

**Problem:** Theme menu shows wrong selection after change.

**Solution:**
- `buildApplicationMenu()` is called only once on app start
- After setting theme, call `buildApplicationMenu()` again to rebuild menu
- Add this to `themeManager.ts:setThemeMode()`:
  ```typescript
  export function rebuildMenu() {
    // Import buildApplicationMenu and call it
  }
  ```

### System Theme Not Syncing

**Problem:** OS theme changes but app doesn't update.

**Solution:**
- Verify theme mode is set to `'system'` (not `'light'` or `'dark'`)
- Check `nativeTheme.on('updated')` listener is registered
- macOS: Go to System Preferences → General → Appearance and toggle

---

## Future Enhancements

### 1. High Contrast Mode

Add a third theme for accessibility:
```css
[data-theme="high-contrast"] {
  --app-text-primary: #000; /* Pure black on white */
  --app-bg-base: #fff;
}
```

### 2. Custom Color Schemes

Allow users to customize accent colors:
```typescript
setThemeMode('dark', { accentColor: '#ff6b6b' })
```

Validate contrast before applying:
```typescript
function validateContrast(color: string, background: string): boolean {
  const ratio = calculateContrastRatio(color, background)
  return ratio >= 4.5 // WCAG AA
}
```

### 3. Per-Window Themes

Support different themes for Architect vs World View:
```typescript
setWindowTheme(worldWindow, 'dark')
setWindowTheme(architectWindow, 'light')
```

---

## Quick Reference

### Adding a New Color

1. Choose semantic name: `--app-new-element-bg`
2. Map to Radix scale in `src/styles/theme.css`:
   ```css
   :root {
     --app-new-element-bg: var(--blue-4);
   }
   [data-theme="dark"] {
     --app-new-element-bg: var(--blue-4); /* Same step for dark */
   }
   ```
3. Verify contrast: `docs/WCAG_CONTRAST_AUDIT.md`
4. Use in component: `background: var(--app-new-element-bg)`

### Changing Theme Programmatically

```typescript
// From renderer (React component)
window.themeAPI.setThemeMode('dark')

// From main process
import { setThemeMode } from './electron/themeManager.js'
setThemeMode('dark')
```

### Debugging Theme State

```typescript
// In renderer console
await window.themeAPI.getThemeState()
// Returns: { mode: 'system', effectiveTheme: 'dark' }

// Check applied theme
document.documentElement.getAttribute('data-theme')
// Returns: 'dark'
```

---

## Support

For issues or questions:
- Open issue on GitHub: [Hyle Issues](https://github.com/your-username/hyle/issues)
- Check existing docs: `docs/WCAG_CONTRAST_AUDIT.md`
- Review Radix Colors docs: https://www.radix-ui.com/colors

**Maintainer Note:** This system was designed with AI assistance. When asking AI for help with theming, share this document for context.
