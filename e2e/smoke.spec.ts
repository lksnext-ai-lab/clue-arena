import { test, expect } from '@playwright/test';

/**
 * Smoke test: unauthenticated user is redirected to /login
 */
test('redirect to login when unauthenticated', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: /Clue Arena/i })).toBeVisible();
});

test('ranking page is public', async ({ page }) => {
  await page.goto('/ranking');
  await expect(page).toHaveURL(/\/ranking/);
  await expect(page.getByRole('heading', { name: /Ranking/i })).toBeVisible();
});

test('admin page redirects unauthenticated users', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login/);
});

test('/instrucciones is publicly accessible without authentication', async ({ page }) => {
  await page.goto('/instrucciones');
  await expect(page).toHaveURL(/\/instrucciones/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('/instrucciones shows MCP contract section', async ({ page }) => {
  await page.goto('/instrucciones');
  await expect(page.getByText('Contrato MCP')).toBeVisible();
});

test('/instrucciones shows all three element categories', async ({ page }) => {
  await page.goto('/instrucciones');
  await expect(page.getByText('Sospechosos (6)')).toBeVisible();
  await expect(page.getByText('Armas (6)')).toBeVisible();
  await expect(page.getByText('Escenarios (9)')).toBeVisible();
});
