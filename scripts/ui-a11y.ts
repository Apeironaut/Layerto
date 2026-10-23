import path from 'node:path';
import { chromium, type Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createSpaServer, setupMockApiRoutes } from './test-server.ts';

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

interface PageTarget {
  name: string;
  url: string;
  setup?: (page: Page) => Promise<void>;
}

async function run() {
  console.log('Starting preview servers for accessibility audit...');
  const webServer = await createSpaServer(path.resolve(process.cwd(), 'apps/web/dist'), 4173);
  const dashboardServer = await createSpaServer(path.resolve(process.cwd(), 'apps/dashboard/dist'), 4174);
  const adminServer = await createSpaServer(path.resolve(process.cwd(), 'apps/admin/dist'), 4175);

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
  });
  const context = await browser.newContext();
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem('layerto_intro_seen', '1');
    } catch {}
  });
  const page = await context.newPage();
  await setupMockApiRoutes(page);

  const targets: PageTarget[] = [
    { name: 'Web Home', url: `${webServer.url}/` },
    { name: 'Web Docs', url: `${webServer.url}/docs` },
    { name: 'Web Privacy', url: `${webServer.url}/privacy` },
    { name: 'Dashboard Overview', url: `${dashboardServer.url}/` },
    {
      name: 'Dashboard Usage',
      url: `${dashboardServer.url}/`,
      setup: async (p) => {
        await p.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find((b) =>
            b.textContent?.includes('Usage')
          );
          btn?.click();
        });
        await p.waitForTimeout(150);
      },
    },
    {
      name: 'Dashboard Requests Log',
      url: `${dashboardServer.url}/`,
      setup: async (p) => {
        await p.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Activity Log') || b.textContent?.includes('Requests')
          );
          btn?.click();
        });
        await p.waitForTimeout(150);
      },
    },
    {
      name: 'Dashboard API Keys',
      url: `${dashboardServer.url}/`,
      setup: async (p) => {
        await p.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find((b) =>
            b.textContent?.includes('API Keys')
          );
          btn?.click();
        });
        await p.waitForTimeout(150);
      },
    },
    {
      name: 'Dashboard Playground',
      url: `${dashboardServer.url}/`,
      setup: async (p) => {
        await p.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find((b) =>
            b.textContent?.includes('Playground')
          );
          btn?.click();
        });
        await p.waitForTimeout(150);
      },
    },
    { name: 'Admin Users', url: `${adminServer.url}/` },
    {
      name: 'Admin Models',
      url: `${adminServer.url}/`,
      setup: async (p) => {
        await p.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find((b) =>
            b.textContent?.includes('Models')
          );
          btn?.click();
        });
        await p.waitForTimeout(150);
      },
    },
    {
      name: 'Admin Routes',
      url: `${adminServer.url}/`,
      setup: async (p) => {
        await p.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Routes') || b.textContent?.includes('Keyword')
          );
          btn?.click();
        });
        await p.waitForTimeout(150);
      },
    },
    {
      name: 'Admin Ledger',
      url: `${adminServer.url}/`,
      setup: async (p) => {
        await p.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find((b) =>
            b.textContent?.includes('Ledger')
          );
          btn?.click();
        });
        await p.waitForTimeout(150);
      },
    },
  ];

  const themes: ('light' | 'dark')[] = ['light', 'dark'];
  let totalViolations = 0;

  try {
    for (const target of targets) {
      for (const theme of themes) {
        process.stdout.write(`Auditing ${target.name} [${theme}]... `);
        await page.goto(target.url, { waitUntil: 'networkidle' });
        await setTheme(page, theme);
        if (target.setup) {
          await target.setup(page);
        }

        // Exclude sample SVG or illustrative mock elements if needed, but test everything
        const builder = new (AxeBuilder as any)({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);

        const results = await builder.analyze();

        const seriousOrCritical = results.violations.filter(
          (v: any) => v.impact === 'serious' || v.impact === 'critical'
        );

        if (seriousOrCritical.length > 0) {
          console.log(`FAILED (${seriousOrCritical.length} serious/critical violations)`);
          for (const v of seriousOrCritical) {
            console.error(`  - [${v.impact?.toUpperCase()}] ${v.id}: ${v.description}`);
            console.error(`    Help: ${v.helpUrl}`);
            for (const node of v.nodes.slice(0, 3)) {
              console.error(`    Node: ${node.html}`);
            }
          }
          totalViolations += seriousOrCritical.length;
        } else {
          console.log('PASSED (0 serious/critical violations)');
        }
      }
    }

    if (totalViolations > 0) {
      console.error(`\nA11y audit failed with ${totalViolations} serious/critical violation(s).`);
      process.exit(1);
    } else {
      console.log('\nA11y audit PASSED: Zero serious or critical violations across all pages in both light and dark modes.');
    }
  } finally {
    await browser.close();
    await webServer.close();
    await dashboardServer.close();
    await adminServer.close();
  }
}

run().catch((err) => {
  console.error('A11y audit execution failed:', err);
  process.exit(1);
});
