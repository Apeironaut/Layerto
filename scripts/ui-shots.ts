import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright';
import { createSpaServer, setupMockApiRoutes } from './test-server.ts';

const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'docs/screenshots');

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
    try {
      localStorage.setItem('layerto_theme', t);
    } catch {
      // ignore
    }
  }, theme);
  await page.waitForTimeout(100);
}

async function run() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  console.log('Starting SPA preview servers...');
  const webServer = await createSpaServer(path.resolve(process.cwd(), 'apps/web/dist'), 4173);
  const dashboardServer = await createSpaServer(path.resolve(process.cwd(), 'apps/dashboard/dist'), 4174);
  const adminServer = await createSpaServer(path.resolve(process.cwd(), 'apps/admin/dist'), 4175);

  console.log(`Web server: ${webServer.url}`);
  console.log(`Dashboard server: ${dashboardServer.url}`);
  console.log(`Admin server: ${adminServer.url}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
  });

  const viewports = [
    { name: '1440', width: 1440, height: 900 },
    { name: '390', width: 390, height: 844 },
  ];

  const themes: ('light' | 'dark')[] = ['light', 'dark'];

  try {
    for (const vp of viewports) {
      console.log(`\nCapturing screenshots for viewport ${vp.width}x${vp.height}...`);
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
      });

      await context.addInitScript(() => {
        try {
          sessionStorage.setItem('layerto_intro_seen', '1');
        } catch {}
      });

      const page = await context.newPage();
      await setupMockApiRoutes(page);

      for (const theme of themes) {
        console.log(`  Theme: ${theme}`);

        // --- Apps Web ---
        // 1. Web Home
        await page.goto(`${webServer.url}/`, { waitUntil: 'networkidle' });
        await setTheme(page, theme);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `web-home-${theme}-${vp.name}.png`),
          fullPage: false,
        });

        // 2. Web Docs
        await page.goto(`${webServer.url}/docs`, { waitUntil: 'networkidle' });
        await setTheme(page, theme);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `web-docs-${theme}-${vp.name}.png`),
          fullPage: false,
        });

        // 3. Web Privacy
        await page.goto(`${webServer.url}/privacy`, { waitUntil: 'networkidle' });
        await setTheme(page, theme);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `web-privacy-${theme}-${vp.name}.png`),
          fullPage: false,
        });

        // --- Apps Dashboard ---
        // 4. Dashboard Overview
        await page.goto(`${dashboardServer.url}/`, { waitUntil: 'networkidle' });
        await setTheme(page, theme);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `dashboard-overview-${theme}-${vp.name}.png`),
          fullPage: false,
        });

        // 5. Dashboard Usage & Billing
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Usage')
          );
          btn?.click();
        });
        await page.waitForTimeout(200);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `dashboard-usage-${theme}-${vp.name}.png`),
          fullPage: false,
        });

        // 6. Dashboard Requests Activity Log
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Activity Log') || b.textContent?.includes('Requests')
          );
          btn?.click();
        });
        await page.waitForTimeout(200);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `dashboard-requests-${theme}-${vp.name}.png`),
          fullPage: false,
        });

        // 7. Dashboard API Keys
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('API Keys')
          );
          btn?.click();
        });
        await page.waitForTimeout(200);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `dashboard-keys-${theme}-${vp.name}.png`),
          fullPage: false,
        });

        // 8. Dashboard Playground
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Playground')
          );
          btn?.click();
        });
        await page.waitForTimeout(200);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `dashboard-playground-${theme}-${vp.name}.png`),
          fullPage: false,
        });

        // --- Apps Admin ---
        // 9. Admin Users
        await page.goto(`${adminServer.url}/`, { waitUntil: 'networkidle' });
        await setTheme(page, theme);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `admin-users-${theme}-${vp.name}.png`),
          fullPage: false,
        });

        // 10. Admin Models & Pricing
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Models')
          );
          btn?.click();
        });
        await page.waitForTimeout(200);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `admin-models-${theme}-${vp.name}.png`),
          fullPage: false,
        });

        // 11. Admin Routes
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Routes') || b.textContent?.includes('Keyword')
          );
          btn?.click();
        });
        await page.waitForTimeout(200);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `admin-routes-${theme}-${vp.name}.png`),
          fullPage: false,
        });

        // 12. Admin Ledger
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Ledger')
          );
          btn?.click();
        });
        await page.waitForTimeout(200);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `admin-ledger-${theme}-${vp.name}.png`),
          fullPage: false,
        });
      }

      await context.close();
    }

    console.log(`\nAll screenshots successfully captured into ${SCREENSHOTS_DIR}`);
  } finally {
    await browser.close();
    await webServer.close();
    await dashboardServer.close();
    await adminServer.close();
  }
}

run().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
