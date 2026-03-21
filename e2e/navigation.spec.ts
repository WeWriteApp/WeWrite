import { test, expect } from '@playwright/test';

const publicPages = ['/welcome', '/trending', '/leaderboard', '/topics', '/privacy', '/terms'];

test.describe('Navigation — unauthenticated', () => {
  for (const path of publicPages) {
    test(`${path} returns 200`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
    });
  }

  test('API health — search endpoint responds', async ({ request }) => {
    const response = await request.get('/api/search-unified?q=test&limit=1');
    expect(response.status()).toBeLessThan(500);
  });
});

test.describe('Navigation — mobile viewport', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('pages render on mobile viewport', async ({ page }) => {
    const response = await page.goto('/welcome');
    expect(response?.status()).toBe(200);
    await expect(page.locator('body')).toBeVisible();
  });
});
