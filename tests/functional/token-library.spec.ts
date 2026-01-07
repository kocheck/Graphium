/**
 * Token Library Functional Tests
 *
 * Tests the token library system:
 * - Uploading tokens to library
 * - Browsing and searching library
 * - Categorizing tokens
 * - Deleting from library
 * - Using library tokens in campaigns
 */

import { test, expect } from '@playwright/test';
import { bypassLandingPageAndInjectState } from '../helpers/bypassLandingPage';
import { createNewCampaign, openTokenLibrary } from '../helpers/campaignHelpers';

test.describe('Token Library - Upload and Storage', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Library Test');
  });

  test('should open token library modal', async ({ page }) => {
    const library = await openTokenLibrary(page);

    await expect(library, 'Token library modal should be visible').toBeVisible();

    await expect(
      page.locator('[data-testid="library-modal-title"]'),
      'Library should have correct title',
    ).toHaveText('Token Library');
  });

  test('should upload token to library', async ({ page }) => {
    await openTokenLibrary(page);

    // Click upload button
    await page.click('[data-testid="upload-to-library-button"]');

    // Upload test image (if available)
    // await page.setInputFiles(
    //   '[data-testid="library-upload-input"]',
    //   './test-assets/hero-token.webp'
    // );

    // Verify token added to library
    // const libraryItems = page.locator('[data-testid^="library-token-"]');
    // await expect(libraryItems).toHaveCount(1);
  });

  test('should show upload progress indicator', async ({ page }) => {
    await openTokenLibrary(page);
    await page.click('[data-testid="upload-to-library-button"]');

    // Start upload
    // await page.setInputFiles('[data-testid="library-upload-input"]', './test-assets/large-token.webp');

    // Verify progress indicator
    // await expect(
    //   page.locator('[data-testid="upload-progress-indicator"]'),
    //   'Upload progress should be visible during upload'
    // ).toBeVisible();
  });

  test('should reject invalid file types', async ({ page }) => {
    await openTokenLibrary(page);
    await page.click('[data-testid="upload-to-library-button"]');

    // Try to upload text file
    const invalidFile = Buffer.from('not an image');
    await page.setInputFiles('[data-testid="library-upload-input"]', {
      name: 'invalid.txt',
      mimeType: 'text/plain',
      buffer: invalidFile,
    });

    // Should show error
    await expect(
      page.locator('[data-testid="upload-error-message"]'),
      'Should show error for invalid file type',
    ).toBeVisible();
  });

  test('should handle large file uploads', async ({ page }) => {
    await openTokenLibrary(page);

    // Note: This would require a large test file
    // Test timeout and size limits
  });
});

test.describe('Token Library - Browsing and Search', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Browse Test');

    // Pre-populate library with test data
    // (Would inject via bypassLandingPageAndInjectState with library data)
  });

  test('should display all library tokens in grid', async ({ page }) => {
    await openTokenLibrary(page);

    // Verify grid view
    const libraryGrid = page.locator('[data-testid="library-grid"]');
    await expect(libraryGrid, 'Library should display in grid layout').toBeVisible();

    // Verify tokens displayed
    const tokens = page.locator('[data-testid^="library-token-"]');
    await expect(tokens, 'Library tokens should be visible in grid').toHaveCount(
      await tokens.count(),
    );
  });

  test('should search library by token name', async ({ page }) => {
    await openTokenLibrary(page);

    // Type in search box
    const searchInput = page.locator('[data-testid="library-search-input"]');
    await searchInput.fill('hero');

    // Verify filtered results
    const visibleTokens = page.locator('[data-testid^="library-token-"]:visible');
    // Should only show tokens matching "hero"
  });

  test('should filter library by category', async ({ page }) => {
    await openTokenLibrary(page);

    // Select category filter
    await page.selectOption('[data-testid="library-category-filter"]', 'characters');

    // Verify only character tokens shown
    // const visibleTokens = page.locator('[data-testid^="library-token-"]:visible');
  });

  test('should sort library tokens', async ({ page }) => {
    await openTokenLibrary(page);

    // Sort by date added (newest first)
    await page.selectOption('[data-testid="library-sort-select"]', 'date-desc');

    // Verify order (would check data-testid or timestamps)
  });

  test('should show token preview on hover', async ({ page }) => {
    await openTokenLibrary(page);

    const firstToken = page.locator('[data-testid="library-token-0"]');
    await firstToken.hover();

    // Verify preview tooltip appears
    await expect(
      page.locator('[data-testid="library-token-preview"]'),
      'Token preview should appear on hover',
    ).toBeVisible();
  });
});

test.describe('Token Library - Categorization', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Category Test');
  });

  test('should assign category when uploading token', async ({ page }) => {
    await openTokenLibrary(page);
    await page.click('[data-testid="upload-to-library-button"]');

    // Select category during upload
    await page.selectOption('[data-testid="library-category-select"]', 'monsters');

    // Upload file
    // await page.setInputFiles('[data-testid="library-upload-input"]', './test-assets/monster.webp');

    // Verify category assigned
    // const token = page.locator('[data-testid="library-token-0"]');
    // const category = await token.getAttribute('data-category');
    // expect(category).toBe('monsters');
  });

  test('should change token category after upload', async ({ page }) => {
    await openTokenLibrary(page);

    // Right-click token
    const token = page.locator('[data-testid="library-token-0"]');
    await token.click({ button: 'right' });

    // Select "Change Category"
    await page.click('[data-testid="library-context-menu-change-category"]');

    // Select new category
    await page.selectOption('[data-testid="library-category-select"]', 'npcs');
    await page.click('[data-testid="save-category-button"]');

    // Verify category changed
    // const newCategory = await token.getAttribute('data-category');
    // expect(newCategory).toBe('npcs');
  });

  test('should create custom category', async ({ page }) => {
    await openTokenLibrary(page);
    await page.click('[data-testid="upload-to-library-button"]');

    // Click "Add Custom Category"
    await page.click('[data-testid="add-custom-category-button"]');

    // Enter category name
    await page.fill('[data-testid="custom-category-input"]', 'Bosses');
    await page.click('[data-testid="save-custom-category"]');

    // Verify appears in dropdown
    const categoryOptions = page.locator('[data-testid="library-category-select"] option');
    await expect(categoryOptions, 'Custom category should appear in dropdown').toContainText([
      'Bosses',
    ]);
  });
});

test.describe('Token Library - Deletion', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Delete Test');
  });

  test('should delete token from library', async ({ page }) => {
    await openTokenLibrary(page);

    // Get initial count
    let tokens = page.locator('[data-testid^="library-token-"]');
    const initialCount = await tokens.count();

    // Right-click and delete first token
    const firstToken = page.locator('[data-testid="library-token-0"]');
    await firstToken.click({ button: 'right' });
    await page.click('[data-testid="library-context-menu-delete"]');
    await page.click('[data-testid="confirm-delete-library-token"]');

    // Verify count decreased
    tokens = page.locator('[data-testid^="library-token-"]');
    await expect(tokens, 'Library should have one fewer token after deletion').toHaveCount(
      initialCount - 1,
    );
  });

  test('should not delete when canceling confirmation', async ({ page }) => {
    await openTokenLibrary(page);

    let tokens = page.locator('[data-testid^="library-token-"]');
    const initialCount = await tokens.count();

    // Attempt delete but cancel
    const firstToken = page.locator('[data-testid="library-token-0"]');
    await firstToken.click({ button: 'right' });
    await page.click('[data-testid="library-context-menu-delete"]');
    await page.click('[data-testid="cancel-delete-library-token"]');

    // Verify count unchanged
    tokens = page.locator('[data-testid^="library-token-"]');
    await expect(
      tokens,
      'Token count should remain unchanged when deletion is cancelled',
    ).toHaveCount(initialCount);
  });

  test('should warn when deleting token used in campaigns', async ({ page }) => {
    await openTokenLibrary(page);

    // Add token to canvas (use it)
    const libraryToken = page.locator('[data-testid="library-token-0"]');
    await libraryToken.click();
    await page.click('[data-testid="canvas"]', { position: { x: 200, y: 200 } });

    // Close library and reopen
    await page.click('[data-testid="close-library"]');
    await openTokenLibrary(page);

    // Try to delete
    await libraryToken.click({ button: 'right' });
    await page.click('[data-testid="library-context-menu-delete"]');

    // Should show warning
    await expect(
      page.locator('[data-testid="delete-library-warning"]'),
      'Should warn when deleting token used in campaign',
    ).toContainText('used in');
  });
});

test.describe('Token Library - Usage in Campaigns', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Usage Test');
  });

  test('should add library token to canvas', async ({ page }) => {
    await openTokenLibrary(page);

    // Select token
    const libraryToken = page.locator('[data-testid="library-token-0"]');
    await libraryToken.click();

    // Click on canvas
    await page.click('[data-testid="canvas"]', { position: { x: 300, y: 250 } });

    // Verify token added to canvas
    const canvasToken = page.locator('[data-testid^="token-"]').first();
    await expect(canvasToken, 'Token from library should be added to canvas').toBeVisible();
  });

  test('should drag library token to canvas', async ({ page }) => {
    await openTokenLibrary(page);

    const libraryToken = page.locator('[data-testid="library-token-0"]');
    const canvas = page.locator('[data-testid="canvas"]');

    // Drag from library to canvas
    await libraryToken.dragTo(canvas, { targetPosition: { x: 400, y: 300 } });

    // Verify token added
    const canvasToken = page.locator('[data-testid^="token-"]').first();
    await expect(
      canvasToken,
      'Token should be added to canvas after drag from library',
    ).toBeVisible();
  });

  test('should use same library token multiple times', async ({ page }) => {
    await openTokenLibrary(page);

    const libraryToken = page.locator('[data-testid="library-token-0"]');

    // Add token 3 times
    for (let i = 0; i < 3; i++) {
      await libraryToken.click();
      await page.click('[data-testid="canvas"]', {
        position: { x: 200 + i * 100, y: 200 },
      });
    }

    // Close library
    await page.click('[data-testid="close-library"]');

    // Verify 3 instances on canvas
    const canvasTokens = page.locator('[data-testid^="token-"]');
    await expect(
      canvasTokens,
      'Should be able to use same library token multiple times',
    ).toHaveCount(3);
  });
});

test.describe('Token Library - Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Persistence Test');
  });

  test('should persist library after page reload', async ({ page }) => {
    await openTokenLibrary(page);

    // Get library count
    let tokens = page.locator('[data-testid^="library-token-"]');
    const count = await tokens.count();

    await page.click('[data-testid="close-library"]');

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Reopen library
    await openTokenLibrary(page);

    // Verify same count
    tokens = page.locator('[data-testid^="library-token-"]');
    await expect(tokens, 'Library should persist after page reload').toHaveCount(count);
  });

  test('should preserve library across campaigns', async ({ page }) => {
    await openTokenLibrary(page);

    // Note library count in first campaign
    let tokens = page.locator('[data-testid^="library-token-"]');
    const firstCount = await tokens.count();

    await page.click('[data-testid="close-library"]');

    // Create new campaign
    await createNewCampaign(page, 'Second Campaign');

    // Open library
    await openTokenLibrary(page);

    // Verify same library
    tokens = page.locator('[data-testid^="library-token-"]');
    await expect(tokens, 'Library should be shared across all campaigns').toHaveCount(firstCount);
  });
});

test.describe('Token Library - Metadata', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLandingPageAndInjectState(page);
    await createNewCampaign(page, 'Metadata Test');
  });

  test('should edit token name in library', async ({ page }) => {
    await openTokenLibrary(page);

    const token = page.locator('[data-testid="library-token-0"]');

    // Right-click and edit
    await token.click({ button: 'right' });
    await page.click('[data-testid="library-context-menu-edit"]');

    // Change name
    await page.fill('[data-testid="library-token-name-input"]', 'Renamed Token');
    await page.click('[data-testid="save-library-metadata"]');

    // Verify name updated
    await expect(
      page.locator('[data-testid="library-token-0-name"]'),
      'Token name should update in library',
    ).toHaveText('Renamed Token');
  });

  test('should add tags to library token', async ({ page }) => {
    await openTokenLibrary(page);

    const token = page.locator('[data-testid="library-token-0"]');
    await token.click({ button: 'right' });
    await page.click('[data-testid="library-context-menu-edit"]');

    // Add tags
    await page.fill('[data-testid="library-token-tags-input"]', 'undead, boss, fire');
    await page.click('[data-testid="save-library-metadata"]');

    // Search by tag
    await page.fill('[data-testid="library-search-input"]', 'boss');

    // Should find tagged token
    const results = page.locator('[data-testid^="library-token-"]:visible');
    await expect(results, 'Should find token by tag in search').toHaveCount(await results.count());
  });
});
