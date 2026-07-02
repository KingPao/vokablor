import { test, expect } from '@playwright/test';

test.describe('PWA install flow', () => {
  test('serves a valid, linked web app manifest', async ({ page, baseURL }) => {
    await page.goto('/');

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBeTruthy();

    const manifestUrl = new URL(manifestHref!, baseURL).toString();
    const response = await page.request.get(manifestUrl);
    expect(response.ok()).toBe(true);

    const manifest = await response.json();
    expect(manifest.display).toBe('standalone');
    expect(manifest.name).toBeTruthy();
    expect(manifest.icons?.length).toBeGreaterThan(0);
    for (const icon of manifest.icons) {
      const iconResponse = await page.request.get(new URL(icon.src, baseURL).toString());
      expect(iconResponse.ok()).toBe(true);
    }
  });

  test('registers a service worker', async ({ page }) => {
    await page.goto('/');
    const hasController = await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      return navigator.serviceWorker.controller !== null || (await navigator.serviceWorker.getRegistration()) !== undefined;
    });
    expect(hasController).toBe(true);
  });
});
