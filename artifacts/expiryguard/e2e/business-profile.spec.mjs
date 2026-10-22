import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:4179';
const profile = { name: 'Harbor Cafe', type: 'cafe' };
let viteOutput = '';
const vite = spawn('pnpm', ['exec', 'vite', '--config', 'vite.e2e.config.ts'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, PORT: '4179', BASE_PATH: '/' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
vite.stdout.on('data', (chunk) => { viteOutput += chunk.toString(); });
vite.stderr.on('data', (chunk) => { viteOutput += chunk.toString(); });

let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (vite.exitCode !== null) throw new Error(`Vite exited early.\n${viteOutput}`);
    try {
      const response = await fetch(`${baseUrl}/e2e/`);
      if (response.ok) { ready = true; break; }
    } catch {}
    await delay(250);
  }
  if (!ready) throw new Error(`Vite did not start.\n${viteOutput}`);

  const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ?? execFileSync('which', ['chromium'], { encoding: 'utf8' }).trim();
  browser = await chromium.launch({
    headless: true,
    ...(chromiumPath ? { executablePath: chromiumPath } : {}),
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (error) => { console.error('Browser page error:', error.message); });

  await page.route('**/api/guard/state', async (route) => {
    await route.fulfill({ json: { businessProfile: profile, today: '2026-10-22', tomorrow: '2026-10-23', summary: { pendingCount: 0 } } });
  });
  await page.route('**/api/guard/business-profile', async (route) => {
    assert.equal(route.request().method(), 'PATCH');
    Object.assign(profile, route.request().postDataJSON());
    await route.fulfill({ json: { businessProfile: profile, today: '2026-10-22', tomorrow: '2026-10-23', summary: { pendingCount: 0 } } });
  });
  await page.route('**/api/guard/inbox', async (route) => {
    await route.fulfill({
      json: {
        items: [],
        unreadCount: 0,
        checkedAt: '2026-10-22T00:00:00.000Z',
        thresholds: { warningDays: 3, upcomingDays: 7 },
        counts: { critical: 0, approaching: 0, pendingApproval: 0, failed: 0 },
      },
    });
  });

  await page.goto(`${baseUrl}/e2e/#/business-profile`);
  const nameInput = page.getByTestId('input-business-name');
  await nameInput.waitFor();
  await nameInput.fill('Harbor Noodles');
  await page.getByTestId('select-business-type').click();
  await page.getByRole('option', { name: 'Food vendor' }).click();
  await page.getByTestId('button-save-business-profile').click();
  await page.getByRole('status').filter({ hasText: 'Business profile saved.' }).waitFor();

  const identityBanner = page.getByTestId('text-synthetic-banner');
  await page.waitForFunction(() => {
    const banner = document.querySelector('[data-testid="text-synthetic-banner"]');
    return banner?.textContent?.includes('Harbor Noodles · Food vendor') ?? false;
  });
  assert.match(await identityBanner.textContent(), /Synthetic data demo/);
  assert.match(await identityBanner.textContent(), /Harbor Noodles · Food vendor/);

  await page.getByTestId('link-menu').click();
  await page.getByRole('heading', { name: 'Menu workspace' }).waitFor();
  await page.getByTestId('link-business').click();
  await nameInput.waitFor();
  assert.equal(await nameInput.inputValue(), 'Harbor Noodles');
  assert.match(await identityBanner.textContent(), /Harbor Noodles · Food vendor/);

  await page.reload();
  await nameInput.waitFor();
  await page.waitForFunction(() => {
    const name = document.querySelector('[data-testid="input-business-name"]');
    const banner = document.querySelector('[data-testid="text-synthetic-banner"]');
    return name?.value === 'Harbor Noodles'
      && banner?.textContent?.includes('Harbor Noodles · Food vendor');
  }, { timeout: 10000 }).catch(async (error) => {
    console.error('Reload state:', {
      apiProfile: profile,
      name: await nameInput.inputValue(),
      type: await page.getByTestId('select-business-type').textContent(),
      banner: await identityBanner.textContent(),
    });
    throw error;
  });
  assert.match(await page.getByTestId('select-business-type').textContent(), /Food vendor/);
  assert.match(await identityBanner.textContent(), /Synthetic data demo/);

  console.log('Business profile browser test passed: saved identity updates the shared banner, survives navigation and reload, and keeps the synthetic disclosure visible.');
} finally {
  await browser?.close();
  vite.kill('SIGTERM');
}
