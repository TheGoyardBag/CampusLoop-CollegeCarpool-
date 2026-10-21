import { test, expect } from '@playwright/test';
// Run against the real Next.js + NestJS stack with a freshly seeded disposable database.
test('rider requests a seat, driver confirms, rider coordinates a pickup', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Rider', exact: true }).click();
    await page.getByRole('button', { name: 'Sign in →', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Good to see you, Maya.' })).toBeVisible();
    await page.locator('.ride-card').filter({ hasText: 'Leo Chen' }).getByRole('button', { name: /Request seat/ }).click();
    await page.getByLabel('Note to the driver (optional)').fill('See you at the public transit shelter.');
    await page.getByRole('button', { name: 'Send request', exact: true }).click();
    await page.getByRole('button', { name: /My trips/ }).click();
    await expect(page.locator('.trip-card .badge').first()).toHaveText('requested');
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('button', { name: 'Driver', exact: true }).click();
    await page.getByRole('button', { name: 'Sign in →', exact: true }).click();
    await page.getByRole('button', { name: /Driver hub/ }).click();
    await page.locator('.request-card').filter({ hasText: 'Maya Patel' }).getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(page.locator('.request-card').filter({ hasText: 'Maya Patel' }).locator('.badge')).toHaveText('confirmed');
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('button', { name: 'Rider', exact: true }).click();
    await page.getByRole('button', { name: 'Sign in →', exact: true }).click();
    await page.getByRole('button', { name: /My trips/ }).click();
    await page.getByRole('button', { name: 'Trip messages', exact: true }).first().click();
    await page.getByLabel('Message', { exact: true }).fill('I will wait at the marked public loading bay.');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page.getByText('I will wait at the marked public loading bay.', { exact: true })).toBeVisible();
});
test('mobile layout has usable navigation and form inputs', async ({ page }) => { await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/'); await page.getByRole('button', { name: 'Rider', exact: true }).click(); await page.getByRole('button', { name: 'Sign in →', exact: true }).click(); await page.getByRole('button', { name: /Class schedule/ }).click(); await expect(page.getByRole('heading', { name: 'Class schedule', exact: true })).toBeVisible(); await expect(page.getByLabel('Course name')).toBeVisible(); });
