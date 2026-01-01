# Graphium E2E Test Suite

**Comprehensive End-to-End Testing with Playwright**

This directory contains functional and integration tests for the Graphium application (Web & Electron builds).

---

## 📁 Directory Structure

```
tests/
├── functional/              # Functional tests (behavior-focused, redesign-resistant)
│   ├── campaign-workflow.spec.ts
│   └── state-persistence.spec.ts
├── electron/               # Electron-specific integration tests
│   └── (to be added)
├── helpers/                # Reusable test utilities
│   ├── bypassLandingPage.ts
│   ├── campaignHelpers.ts
│   └── mockElectronAPIs.ts
├── accessibility.spec.ts   # WCAG 2.1 AA compliance tests
└── README.md              # This file
```

---

## 🚀 Running Tests

### Quick Start

```bash
# Run all E2E tests
npm run test:e2e

# Run only Web tests
npm run test:e2e:web

# Run only Electron tests
npm run test:e2e:electron

# Run only functional tests
npm run test:e2e:functional

# Run accessibility tests
npm run test:a11y
```

### Interactive Mode

```bash
# Open Playwright UI (great for debugging)
npm run test:e2e:ui

# Debug mode (step through tests)
npm run test:e2e:debug
```

### View Test Report

```bash
# Open the last HTML report
npm run test:e2e:report
```

---

## 🎯 Testing Strategy

Our tests focus on **behavior and functionality**, not visual appearance. This makes them **redesign-resistant**.

### What We Test

✅ **User workflows** - Can users complete tasks?
✅ **State persistence** - Does data survive reloads?
✅ **Data integrity** - Do save/load cycles work?
✅ **Feature availability** - Do features work in Web vs Electron?
❌ **Visual appearance** - NOT tested (until after redesign)

### Test Philosophy

**Good Test (Behavior):**
```typescript
test('should persist campaign name after reload', async ({ page }) => {
  await createNewCampaign(page, 'My Campaign');
  await page.reload();

  await expect(
    page.locator('[data-testid="campaign-title"]'),
    'Campaign name should persist after reload'
  ).toHaveText('My Campaign');
});
```

**Bad Test (Appearance):**
```typescript
test('should have correct styles', async ({ page }) => {
  await expect(page.locator('.title')).toHaveCSS('color', 'rgb(0, 0, 0)');
  // ❌ Breaks on redesign
});
```

---

## 📖 Writing New Tests

### Step 1: Choose the Right Directory

- **`functional/`** - User workflows, state management, data integrity
- **`electron/`** - Electron-specific features (IPC, native dialogs, file system)
- **Root** - Accessibility, special cross-cutting concerns

### Step 2: Use Helper Functions

Import helpers to avoid duplication:

```typescript
import { bypassLandingPageAndInjectState } from '../helpers/bypassLandingPage';
import { createNewCampaign, exportCampaign } from '../helpers/campaignHelpers';

test('my test', async ({ page }) => {
  // Bypass landing page
  await bypassLandingPageAndInjectState(page);

  // Use helpers for common operations
  await createNewCampaign(page, 'Test Campaign');
});
```

### Step 3: Write Descriptive Assertions

Always include custom error messages:

```typescript
// ❌ Bad - no context
await expect(button).toBeVisible();

// ✅ Good - clear context
await expect(
  button,
  'Save button should appear after making changes'
).toBeVisible();
```

### Step 4: Focus on Behavior

Test what users **do**, not what they **see**:

```typescript
// ✅ Good - tests behavior
test('should switch theme', async ({ page }) => {
  await switchTheme(page, 'dark');
  const theme = await page.getAttribute('html', 'data-theme');
  expect(theme).toBe('dark');
});

// ❌ Bad - tests appearance
test('should have dark background', async ({ page }) => {
  await expect(page.locator('body')).toHaveCSS('background-color', '#000');
});
```

---

## 🔧 Available Helpers

### `bypassLandingPage.ts`

```typescript
// Skip landing page and inject test state
await bypassLandingPageAndInjectState(page);

// Inject specific campaign data
await injectCampaignState(page, myCampaign);

// Clear all test data
await clearAllTestData(page);
```

### `campaignHelpers.ts`

```typescript
// Create new campaign
await createNewCampaign(page, 'Campaign Name');

// Add map background
await addMapBackground(page, './test-assets/map.webp');

// Open token library
const library = await openTokenLibrary(page);

// Add token to canvas
await addTokenToCanvas(page, 'token-1', { x: 200, y: 200 });

// Export/import campaign
const filePath = await exportCampaign(page);
await importCampaign(page, filePath);

// Switch theme
await switchTheme(page, 'dark');

// Verify campaign state
await verifyCampaignState(page, {
  name: 'Expected Name',
  tokenCount: 5,
  mapCount: 2,
});
```

---

## 🐛 Debugging Tests

### Option 1: UI Mode (Recommended)

```bash
npm run test:e2e:ui
```

- **Visual test runner** - See tests in a browser
- **Time-travel debugging** - Inspect DOM at each step
- **Watch mode** - Tests re-run on file changes

### Option 2: Debug Mode

```bash
npm run test:e2e:debug
```

- **Playwright Inspector** - Step through tests
- **Breakpoints** - Pause execution
- **Console** - Run commands at any point

### Option 3: Headed Mode

```bash
npx playwright test --headed
```

Watch tests run in a real browser.

### Option 4: Trace Viewer

If a test fails in CI, download the trace artifact:

```bash
npx playwright show-trace trace.zip
```

Includes:
- Video recording
- DOM snapshots
- Network activity
- Console logs

---

## 🏗️ CI/CD Integration

Tests run automatically on **every PR** via GitHub Actions.

### Workflow: `.github/workflows/e2e.yml`

**Jobs:**
1. **test-web** - Web tests (sharded 3 ways for speed)
2. **test-electron** - Electron tests
3. **merge-reports** - Combine results into single report

### Branch Protection

PRs **cannot merge** until all tests pass:

- ✅ `test-web (1, 3)`
- ✅ `test-web (2, 3)`
- ✅ `test-web (3, 3)`
- ✅ `test-electron`

### Viewing CI Results

1. Go to PR checks tab
2. Click failing job
3. Download `playwright-report-*.zip` artifact
4. Unzip and open `index.html`

---

## 📊 Test Coverage Goals

| Area | Target | Current |
|------|--------|---------|
| Campaign workflows | 80% | 🔨 In progress |
| State persistence | 90% | 🔨 In progress |
| Token management | 70% | ⏳ Planned |
| Electron features | 60% | ⏳ Planned |
| Accessibility | 100% | ✅ Complete |

---

## 🔬 Advanced Topics

### Testing with Real Assets

Place test assets in `test-assets/`:

```
test-assets/
├── dungeon.webp
├── tavern.webp
└── hero-token.webp
```

Use in tests:

```typescript
await addMapBackground(page, './test-assets/dungeon.webp');
```

### Testing Electron-Specific Features

```typescript
// electron/startup.electron.spec.ts
test('should launch Electron app', async ({ _electron }) => {
  const app = await _electron.launch({
    executablePath: require('electron'),
    args: ['./dist-electron/main.js'],
  });

  const window = await app.firstWindow();
  await expect(window.title()).resolves.toBe('Graphium');
});
```

### Testing IPC Communication

```typescript
test('should communicate via IPC', async ({ page }) => {
  // Listen for IPC events
  const ipcMessage = await page.evaluate(() => {
    return new Promise((resolve) => {
      window.ipcRenderer.on('test-event', (event, data) => {
        resolve(data);
      });
      window.ipcRenderer.send('trigger-test');
    });
  });

  expect(ipcMessage).toBe('expected-value');
});
```

### Handling Flaky Tests

If a test is flaky:

1. **Add explicit waits**:
   ```typescript
   await page.waitForLoadState('networkidle');
   ```

2. **Use `waitFor` assertions**:
   ```typescript
   await expect(locator).toBeVisible({ timeout: 10000 });
   ```

3. **Avoid timers** - use `waitForFunction` instead:
   ```typescript
   // ❌ Bad
   await page.waitForTimeout(1000);

   // ✅ Good
   await page.waitForFunction(() => document.readyState === 'complete');
   ```

---

## 📚 Resources

- **Strategy Doc**: `../TESTING_STRATEGY.md` - Full testing strategy
- **Playwright Docs**: https://playwright.dev
- **Best Practices**: https://playwright.dev/docs/best-practices

---

## 🤝 Contributing

### Before Committing Tests

1. ✅ Run tests locally: `npm run test:e2e`
2. ✅ Use descriptive test names
3. ✅ Add custom error messages to assertions
4. ✅ Update this README if adding new helpers
5. ✅ Focus on behavior, not appearance

### Test Naming Convention

```typescript
test.describe('Feature Name', () => {
  test('should [expected behavior] when [condition]', async ({ page }) => {
    // Clear, user-story format
  });
});
```

**Examples:**
- ✅ `should create campaign when user provides valid name`
- ✅ `should persist token positions after page reload`
- ❌ `test 1` (not descriptive)
- ❌ `check if button works` (vague)

---

## ❓ FAQ

**Q: Why don't we have visual regression tests?**
A: We have a UI redesign coming up. Visual tests would break constantly. We'll add them after the redesign.

**Q: How do I test something that requires authentication?**
A: Use `bypassLandingPageAndInjectState` to inject a logged-in user state.

**Q: Tests are slow. How do I speed them up?**
A: Use `test.describe.configure({ mode: 'parallel' })` for independent tests.

**Q: A test passes locally but fails in CI. Why?**
A: Likely a timing issue. Add explicit waits or increase timeouts.

**Q: How do I skip a test temporarily?**
A: Use `test.skip()` or `test.fixme()` with a reason:
```typescript
test.skip('should do X', async ({ page }) => {
  // TODO: Fix after redesign
});
```

---

**Last Updated:** 2025-12-28
**Maintainer:** QA Team
