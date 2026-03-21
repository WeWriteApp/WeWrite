import { test, expect } from '@playwright/test';

test.describe('Smoke tests', () => {
  test('homepage loads without crashing', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(500);
  });

  test('welcome page loads', async ({ page }) => {
    const response = await page.goto('/welcome');
    expect(response?.status()).toBe(200);
    await expect(page.locator('body')).toBeVisible();
  });

  test('login page is accessible', async ({ page }) => {
    const response = await page.goto('/auth/login');
    expect(response?.status()).toBe(200);
  });

  test('register page is accessible', async ({ page }) => {
    const response = await page.goto('/auth/register');
    expect(response?.status()).toBe(200);
  });

  test('trending page loads', async ({ page }) => {
    const response = await page.goto('/trending');
    expect(response?.status()).toBe(200);
  });

  test('leaderboard page loads', async ({ page }) => {
    const response = await page.goto('/leaderboard');
    expect(response?.status()).toBe(200);
  });

  test('topics page loads', async ({ page }) => {
    const response = await page.goto('/topics');
    expect(response?.status()).toBe(200);
  });

  test('privacy page loads', async ({ page }) => {
    const response = await page.goto('/privacy');
    expect(response?.status()).toBe(200);
  });

  test('terms page loads', async ({ page }) => {
    const response = await page.goto('/terms');
    expect(response?.status()).toBe(200);
  });
});

test.describe('Error handling', () => {
  test('non-existent page does not crash', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-xyz-12345');
    expect(response?.status()).toBeLessThan(500);
  });
});
