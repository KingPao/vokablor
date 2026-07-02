import { test, expect } from '@playwright/test';

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function registerAndLogin(page: import('@playwright/test').Page, email: string): Promise<void> {
  await page.goto('/#/register');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', 'correct-horse-battery');
  await page.click('button[type="submit"]');
  await page.waitForURL(/#\/vocabulary/);
}

test.describe('offline behavior', () => {
  test('training review keeps working offline; speaking/conversation fail with a clear message; queued answers sync on reconnect', async ({
    page,
    context,
  }) => {
    const email = uniqueEmail();
    await registerAndLogin(page, email);

    // Add a word and open training once while online so due items + a session are cached.
    await page.fill('#add-form input[name="term"]', 'bonjour');
    await page.fill('#add-form input[name="translation"]', 'hello');
    await page.click('#add-form button[type="submit"]');
    await expect(page.locator('#vocabulary-list li')).toContainText('bonjour');

    await page.goto('/#/training');
    await expect(page.locator('#offline-banner')).toBeHidden();
    await expect(page.locator('.term')).toHaveText('bonjour');

    // Go offline mid-session (Edge Cases: no internet connection).
    await context.setOffline(true);

    await page.fill('#quiz input[name="translation"]', 'hello');
    await page.click('#quiz button[type="submit"]');
    // Offline-capable vocabulary review keeps working (FR-020) — the app doesn't hang or
    // throw; it queues the answer and says so.
    await expect(page.locator('#offline-banner')).toBeVisible();

    // Speaking and conversation require the network and must say so clearly, not hang.
    await page.goto('/#/speaking');
    await expect(page.locator('#speaking-content')).toContainText(/internet connection/i);

    await page.goto('/#/conversation');
    await expect(page.locator('#conversation-error')).toContainText(/internet connection/i);

    // Reconnect: the queued training answer must flush and apply exactly once.
    await context.setOffline(false);
    await page.goto('/#/vocabulary');
    await page.waitForTimeout(500); // let the 'online' event handler flush the queue
    await page.reload();
    await expect(page.locator('#vocabulary-list li')).toContainText('learning');
  });
});
