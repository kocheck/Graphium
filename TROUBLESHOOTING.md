# Troubleshooting Guide

This guide helps diagnose and fix common issues in Hyle. Issues are organized by category with symptoms, causes, and solutions.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Window and Display Issues](#window-and-display-issues)
3. [State Synchronization Issues](#state-synchronization-issues)
4. [Asset and Image Issues](#asset-and-image-issues)
5. [Campaign Save/Load Issues](#campaign-saveload-issues)
6. [Performance Issues](#performance-issues)
7. [Development Issues](#development-issues)
8. [Platform-Specific Issues](#platform-specific-issues)

---

## Quick Diagnostics

### Health Check Checklist

Run through this checklist when diagnosing any issue:

- [ ] **Electron version:** Check `package.json` - should be 28.x or later
- [ ] **Node version:** Run `node --version` - should be 18.x or 20.x
- [ ] **Dependencies:** Run `npm install` to ensure all packages are installed
- [ ] **Dev tools:** Open with `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Opt+I` (Mac)
- [ ] **Console errors:** Check for red error messages in DevTools console
- [ ] **Network tab:** Verify media:// protocol requests succeed

### Log Files

**Electron main process logs:**
```bash
# View console output where you ran `npm run dev`
```

**Renderer process logs:**
```bash
# Open DevTools: Ctrl+Shift+I (Windows/Linux) or Cmd+Opt+I (Mac)
# Check Console tab
```

---

## Window and Display Issues

### Issue: World Window Not Appearing

**Symptoms:**
- Click "World View" button, nothing happens
- No second window opens

**Causes & Solutions:**

**Cause 1: World Window already exists (minimized or hidden)**

```typescript
// Symptom: Console shows window exists but user can't see it
// Solution: World Window is singleton - check if already open

// Fix: Force window to front
1. Click "World View" button again (focuses existing window)
2. Check all displays/desktops (might be on different monitor)
3. Check taskbar for second Hyle window
```

**Cause 2: IPC handler not registered**

```bash
# Symptom: Console error "Unknown channel: create-world-window"
# Solution: Ensure main.ts registers handler

# Check electron/main.ts:209
ipcMain.on('create-world-window', createWorldWindow)

# Fix: Restart dev server
npm run dev
```

**Cause 3: Preload script error**

```bash
# Symptom: Error "window.ipcRenderer is undefined"
# Solution: Preload path incorrect

# Check electron/main.ts:84-86
webPreferences: {
  preload: path.join(__dirname, 'preload.mjs'),
}

# Fix: Rebuild Electron
npm run build
```

---

### Issue: Images Not Loading in Canvas

**Symptoms:**
- Tokens appear as blank squares
- Console error: "Failed to load image"
- Network tab shows 404 or protocol error

**Causes & Solutions:**

**Cause 1: media:// protocol not registered**

```bash
# Symptom: Console error "net::ERR_UNKNOWN_URL_SCHEME"
# Solution: Protocol not registered before app.whenReady()

# Check electron/main.ts:38-40
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { secure: true, ... } }
])

# Fix: Ensure this runs BEFORE app.whenReady()
```

**Cause 2: File path incorrect**

```typescript
// Symptom: 404 error in network tab
// Solution: Check file actually exists

// Debug: Log file path
console.log('Token src:', token.src)
// Expected: file:///Users/.../temp_assets/123456-goblin.webp

// Check file exists
ls ~/Library/Application\ Support/Hyle/temp_assets/

// Fix: Re-upload token
```

**Cause 3: Protocol handler not translating correctly**

```typescript
// Symptom: media:// URLs not working
// Solution: Check URLImage conversion logic

// src/components/Canvas/CanvasManager.tsx:48-49
const safeSrc = src.startsWith('file:') ? src.replace('file:', 'media:') : src

// Debug: Log URLs
console.log('Original:', src)
console.log('Converted:', safeSrc)

// Fix: Ensure file:// → media:// conversion happens
```

---

## State Synchronization Issues

### Issue: World Window Not Updating

**Symptoms:**
- Add token in Architect View, doesn't appear in World View
- World Window shows outdated state
- No errors in console

**Causes & Solutions:**

**Cause 1: World Window not listening to IPC**

```typescript
// Symptom: No SYNC_WORLD_STATE events received
// Solution: Check SyncManager mounted in World Window

// Debug: Add logging in src/components/SyncManager.tsx:85
window.ipcRenderer.on('SYNC_WORLD_STATE', (event, state) => {
  console.log('World Window received state:', state)  // Add this
  useGameStore.getState().setState(state)
})

// Fix: Ensure SyncManager component is rendered in World Window
```

**Cause 2: Architect Window not sending updates**

```typescript
// Symptom: No IPC sends from Architect Window
// Solution: Check subscription active

// Debug: Add logging in src/components/SyncManager.tsx:111
window.ipcRenderer.send('SYNC_WORLD_STATE', state)
console.log('Architect sent state:', state)  // Add this

// Fix: Ensure SyncManager subscription is active
useGameStore.subscribe((state) => { ... })
```

**Cause 3: Main process not relaying**

```typescript
// Symptom: Architect sends but World doesn't receive
// Solution: Check main process relay

// electron/main.ts:225-229
ipcMain.on('SYNC_WORLD_STATE', (_event, state) => {
  console.log('Main received, relaying to World')  // Add this
  if (worldWindow && !worldWindow.isDestroyed()) {
    worldWindow.webContents.send('SYNC_WORLD_STATE', state)
  } else {
    console.log('World window not available')  // Add this
  }
})
```

---

### Issue: State Syncing Too Slowly

**Symptoms:**
- Drawing strokes appear 1-2 seconds late in World Window
- Token movements lag
- High CPU usage

**Cause: High-frequency IPC updates**

```typescript
// Solution: Throttle state synchronization

// Install lodash
npm install lodash

// Modify src/components/SyncManager.tsx:101-112
import { throttle } from 'lodash'

const syncState = throttle((state) => {
  window.ipcRenderer.send('SYNC_WORLD_STATE', state)
}, 16)  // Max 60 FPS

useGameStore.subscribe(syncState)
```

---

## Asset and Image Issues

### Issue: Images Appear Stretched or Distorted

**Symptoms:**
- Tokens don't look square
- Aspect ratio is wrong

**Cause: Incorrect aspect ratio in cropper**

```typescript
// Solution: Ensure 1:1 aspect ratio enforced

// Check src/components/ImageCropper.tsx:46
<Cropper
  aspect={1}  // Must be 1 for square crops
  ...
/>

// Fix: Always use aspect={1} for tokens
```

---

### Issue: Uploaded Images Are Huge (File Size)

**Symptoms:**
- Campaign files are 50MB+ with only a few tokens
- Slow save/load times

**Cause: Images not being compressed**

```typescript
// Solution: Verify WebP conversion and resizing

// Check src/utils/AssetProcessor.ts:112
canvas.toBlob(async (blob) => {
  // Should be 'image/webp' with quality 1
}, 'image/webp', 1)

// Check resize constraints
const MAX_SIZE = assetType === 'MAP' ? 4096 : 512

// Fix: Ensure processImage() is called for all uploads
```

---

### Issue: "Failed to Save Asset" Error

**Symptoms:**
- Error message when dropping image on canvas
- Console error: "EACCES" or "ENOSPC"

**Causes & Solutions:**

**Cause 1: Permission denied**

```bash
# Symptom: Error "EACCES: permission denied"
# Solution: Check write permissions

# macOS/Linux
chmod 755 ~/Library/Application\ Support/Hyle

# Windows: Run as administrator or check folder permissions
```

**Cause 2: Disk full**

```bash
# Symptom: Error "ENOSPC: no space left on device"
# Solution: Free up disk space

# Check available space
df -h  # macOS/Linux
# or use Disk Management on Windows

# Clean up old session directories
rm -rf ~/Library/Application\ Support/Hyle/sessions/*
```

---

## Campaign Save/Load Issues

### Issue: "Invalid Hyle File" Error on Load

**Symptoms:**
- Error when trying to load .hyle file
- Console: "Invalid Hyle file"

**Causes & Solutions:**

**Cause 1: Corrupted ZIP**

```bash
# Solution: Verify ZIP integrity

# Try unzipping manually
unzip campaign.hyle -d test_extract/

# If error: ZIP is corrupted, use backup
# If success: Check manifest.json exists
cat test_extract/manifest.json
```

**Cause 2: Missing manifest.json**

```typescript
// Symptom: ZIP extracts but missing manifest.json
// Solution: Check save logic created manifest

// electron/main.ts:333
zip.file("manifest.json", JSON.stringify(stateToSave))

// Manual fix: Create manifest.json from scratch
{
  "tokens": [],
  "drawings": [],
  "gridSize": 50
}
```

**Cause 3: Malformed JSON**

```bash
# Solution: Validate JSON syntax

# Extract and validate
unzip campaign.hyle manifest.json
cat manifest.json | jq .  # Requires jq tool

# Fix: Remove trailing commas, fix brackets
```

---

### Issue: Loaded Campaign Missing Assets

**Symptoms:**
- Campaign loads but tokens show as broken images
- Console: 404 errors for media:// URLs

**Cause: Assets not extracted from ZIP**

```typescript
// Solution: Check asset extraction logic

// Debug electron/main.ts:399-416
console.log('Extracting assets from ZIP')
const assets = zip.folder("assets")
if (!assets) {
  console.log('No assets folder in ZIP!')  // Issue here
}

// Check ZIP structure
unzip -l campaign.hyle
# Should show:
#   manifest.json
#   assets/123456-goblin.webp
#   assets/123457-dragon.webp

// Fix: Re-save campaign to regenerate assets
```

---

### Issue: Can't Save Campaign (Dialog Doesn't Appear)

**Symptoms:**
- Click "Save" button, nothing happens
- No file dialog appears

**Cause: IPC handler not responding**

```typescript
// Debug App.tsx:89
console.log('Invoking SAVE_CAMPAIGN')
const result = await window.ipcRenderer.invoke('SAVE_CAMPAIGN', dataToSave)
console.log('Result:', result)

// Check electron/main.ts:309
ipcMain.handle('SAVE_CAMPAIGN', async (event, gameState) => {
  console.log('Handler called with:', gameState)  // Add this
  ...
})

// Fix: Restart Electron app
npm run dev
```

---

## Performance Issues

### Issue: Canvas Rendering Feels Laggy

**Symptoms:**
- Dragging tokens stutters
- Drawing strokes are choppy
- Low FPS (<30)

**Causes & Solutions:**

**Cause 1: Too many grid lines**

```typescript
// Symptom: 4096x4096 canvas = 6561 grid lines
// Solution: Limit grid rendering or use single Path

// Option 1: Reduce canvas size
const MAX_CANVAS_SIZE = 2048  // Instead of 4096

// Option 2: Optimize GridOverlay (future enhancement)
// Use single Konva.Path instead of many Line components
```

**Cause 2: High-resolution token images**

```typescript
// Symptom: 4096x4096px token images slowing down
// Solution: Ensure processImage() resizes properly

// Check src/utils/AssetProcessor.ts:51-58
const MAX_SIZE = assetType === 'MAP' ? 4096 : 512
// Tokens should be max 512px

// Fix: Delete temp_assets/ and re-upload tokens
```

**Cause 3: Excessive IPC messages**

```typescript
// Symptom: Hundreds of SYNC_WORLD_STATE per second
// Solution: Throttle as shown in "State Syncing Too Slowly" section
```

---

### Issue: High Memory Usage (>1GB)

**Symptoms:**
- Electron uses excessive RAM
- App becomes slow over time

**Cause: Image caching accumulation**

```typescript
// Solution: Clear image cache periodically

// Add to src/components/Canvas/CanvasManager.tsx
useEffect(() => {
  return () => {
    // Cleanup on unmount
    URL.revokeObjectURL(objectUrl)  // If using Object URLs
  }
}, [])

// Alternative: Restart app periodically during long sessions
```

---

## Development Issues

### Issue: "Cannot find module" Errors

**Symptoms:**
- TypeScript errors: "Cannot find module 'X'"
- Build fails

**Solution:**

```bash
# Clean install dependencies
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf dist dist-electron .vite

# Rebuild
npm run dev
```

---

### Issue: Hot Reload Not Working

**Symptoms:**
- Change code, browser doesn't update
- Need to manually refresh

**Solution:**

```bash
# Restart Vite dev server
# Ctrl+C, then:
npm run dev

# If still broken, clear cache:
rm -rf .vite
npm run dev
```

---

### Issue: TypeScript Errors for window.ipcRenderer

**Symptoms:**
- `Property 'ipcRenderer' does not exist on type 'Window'`

**Solution:**

```typescript
// Option 1: Use @ts-ignore (current approach)
// @ts-ignore
window.ipcRenderer.send('channel', data)

// Option 2: Add type declarations (better)
// Create src/types/electron.d.ts:
interface Window {
  ipcRenderer: {
    send: (channel: string, ...args: any[]) => void
    invoke: (channel: string, ...args: any[]) => Promise<any>
    on: (channel: string, listener: Function) => void
    off: (channel: string, listener: Function) => void
  }
}
```

---

## Platform-Specific Issues

### macOS Issues

**Issue: "App can't be opened because developer cannot be verified"**

**Solution:**

```bash
# Allow unsigned app
xattr -cr /Applications/Hyle.app

# Or: System Preferences > Security & Privacy > Open Anyway
```

---

**Issue: Blank white screen on launch**

**Solution:**

```bash
# GPU acceleration issue
# Add to package.json start script:
"start": "electron . --disable-gpu-sandbox"
```

---

### Windows Issues

**Issue: "VCRUNTIME140.dll not found"**

**Solution:**

```bash
# Install Visual C++ Redistributable
# Download from Microsoft:
https://aka.ms/vs/17/release/vc_redist.x64.exe

# Run installer, restart, then launch Hyle
```

---

**Issue: Images not loading (file:// URLs blocked)**

**Solution:**

```javascript
// Check Windows path format in electron/main.ts:265
return `file://${filePath.replace(/\\/g, '/')}`
// Ensure forward slashes in file:// URLs
```

---

### Linux Issues

**Issue: App won't launch (no GUI)**

**Solution:**

```bash
# Missing X11 libraries
sudo apt-get install libx11-dev libxkbfile-dev libsecret-1-dev

# AppImage sandbox issue
./Hyle.AppImage --no-sandbox
```

---

## Error Message Reference

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `net::ERR_UNKNOWN_URL_SCHEME` | media:// protocol not registered | Check `protocol.registerSchemesAsPrivileged()` |
| `window.ipcRenderer is undefined` | Preload script not loaded | Verify `webPreferences.preload` path |
| `ENOENT: no such file or directory` | Asset file doesn't exist | Re-upload token or check path |
| `Invalid Hyle file` | Missing manifest.json in ZIP | Check ZIP structure |
| `EACCES: permission denied` | No write permissions | Check folder permissions |
| `ENOSPC: no space left on device` | Disk full | Free up space |
| `Can't find end of central directory` | Corrupted ZIP | Use backup .hyle file |

---

## Debugging Tools

### Enable Verbose Logging

```typescript
// electron/main.ts (add at top)
app.commandLine.appendSwitch('enable-logging')
app.commandLine.appendSwitch('v', '1')

// Check logs:
// macOS: ~/Library/Logs/Hyle/
// Windows: %USERPROFILE%\AppData\Roaming\Hyle\logs\
// Linux: ~/.config/Hyle/logs/
```

### Inspect IPC Traffic

```typescript
// Log all IPC events (main process)
ipcMain.on('*', (event, ...args) => {
  console.log('[IPC]', event.sender.getURL(), ...args)
})

// Log all IPC sends (renderer)
const originalSend = window.ipcRenderer.send
window.ipcRenderer.send = function(channel, ...args) {
  console.log('[IPC Send]', channel, args)
  return originalSend.call(this, channel, ...args)
}
```

### Monitor Performance

```typescript
// src/App.tsx (add to component)
useEffect(() => {
  const logPerf = setInterval(() => {
    console.log('Memory:', performance.memory.usedJSHeapSize / 1024 / 1024, 'MB')
    console.log('Tokens:', useGameStore.getState().tokens.length)
    console.log('Drawings:', useGameStore.getState().drawings.length)
  }, 5000)

  return () => clearInterval(logPerf)
}, [])
```

---

## Getting Help

If you're still stuck after trying these solutions:

1. **Check existing issues:** [GitHub Issues](https://github.com/username/Hyle/issues)
2. **Open DevTools:** `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Opt+I` (Mac)
3. **Collect diagnostics:**
   - Electron version: Check `package.json`
   - OS version: `uname -a` (macOS/Linux) or `winver` (Windows)
   - Console errors: Screenshot from DevTools
   - Steps to reproduce
4. **File a bug report:** Include all diagnostics above

---

**Last updated:** 2025-01-XX
**Document version:** 1.0
