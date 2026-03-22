import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login page loads with form and OAuth buttons', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('unauthenticated user redirects to login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });
});
