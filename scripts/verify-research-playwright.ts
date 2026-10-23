import path from 'node:path';
import { chromium } from 'playwright';

const ARTIFACT_DIR = '/home/naviya-c/.gemini/antigravity-ide/brain/24dcc952-74ec-40d0-852b-6b832fc65177';

async function main() {
  console.log('Launching headless browser...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  // Inject authentication session cookie
  await context.addCookies([
    {
      name: 'lt_session',
      value: 'test_token_naviya_12345',
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ]);

  await context.addInitScript(() => {
    try {
      sessionStorage.setItem('layerto_intro_seen', '1');
      localStorage.setItem('layerto_theme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } catch {}
  });

  const page = await context.newPage();
  page.on('console', (msg) => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('requestfailed', (request) =>
    console.log('REQUEST FAILED:', request.method(), request.url(), request.failure()?.errorText)
  );
  page.on('response', (response) => {
    if (response.status() >= 400) {
      console.log('HTTP ERROR:', response.status(), response.url());
    }
  });

  console.log('Navigating to http://localhost:5173/research ...');
  await page.goto('http://localhost:5173/research', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Take screenshot of Level 1 Main Research Hub
  const shot1 = path.join(ARTIFACT_DIR, 'research_hub_level1_verified.png');
  await page.screenshot({ path: shot1, fullPage: true });
  console.log('Captured:', shot1);

  // Click on Marine Zoology Research Area
  console.log('Clicking Marine Zoology area card...');
  const marineCard = page.locator('text=Marine Zoology & Fauna Photo-ID Research').first();
  await marineCard.click();
  await page.waitForTimeout(2000);

  // Switch to Unified view mode so both domain and tech features are rendered
  console.log('Switching to Unified view mode...');
  const unifiedBtn = page.locator('button:has-text("Unified")').first();
  await unifiedBtn.click();
  await page.waitForTimeout(1000);

  // Take screenshot of Level 2 Workspace Overview
  const shot2 = path.join(ARTIFACT_DIR, 'marine_zoology_overview_verified.png');
  await page.screenshot({ path: shot2, fullPage: true });
  console.log('Captured:', shot2);

  // Switch to Data & Specimens Tab
  console.log('Switching to Specimens tab...');
  const specimensTab = page.locator('button:has-text("Data & Specimen Vault")').first();
  await specimensTab.click();
  await page.waitForTimeout(2000);

  const shot3 = path.join(ARTIFACT_DIR, 'marine_specimens_vault_verified.png');
  await page.screenshot({ path: shot3, fullPage: true });
  console.log('Captured:', shot3);

  // Switch to Experiments & Arena Tab
  console.log('Switching to Experiments tab...');
  const experimentsTab = page.locator('button:has-text("Experiments & Visual Arena")').first();
  await experimentsTab.click();
  await page.waitForTimeout(2000);

  const shot4 = path.join(ARTIFACT_DIR, 'ablation_experiments_arena_verified.png');
  await page.screenshot({ path: shot4, fullPage: true });
  console.log('Captured:', shot4);

  // Switch to Tech Collaboration Tab
  console.log('Switching to Collaboration tab...');
  const collabTab = page.locator('button:has-text("Tech Collaboration Hub")').first();
  await collabTab.click();
  await page.waitForTimeout(2000);

  const shot5 = path.join(ARTIFACT_DIR, 'tech_collaboration_contracts_verified.png');
  await page.screenshot({ path: shot5, fullPage: true });
  console.log('Captured:', shot5);

  // Switch to Publications & Monetization Tab
  console.log('Switching to Publications tab...');
  const pubsTab = page.locator('button:has-text("Publications & Monetization")').first();
  await pubsTab.click();
  await page.waitForTimeout(2000);

  const shot6 = path.join(ARTIFACT_DIR, 'publications_royalty_ledger_verified.png');
  await page.screenshot({ path: shot6, fullPage: true });
  console.log('Captured:', shot6);

  // Click Back to Main Research Hub
  console.log('Clicking back button...');
  const backBtn = page.locator('text=Research Dashboard').first();
  await backBtn.click();
  await page.waitForTimeout(1500);

  // Click Forest Canopy Analysis Area
  console.log('Clicking Forest Canopy area card...');
  const forestCard = page.locator('text=Autonomous Aerial Forest Canopy Analysis').first();
  await forestCard.click();
  await page.waitForTimeout(1500);

  const shot7 = path.join(ARTIFACT_DIR, 'forest_canopy_isolated_workspace_verified.png');
  await page.screenshot({ path: shot7, fullPage: true });
  console.log('Captured:', shot7);

  await browser.close();
  console.log('All screenshots captured successfully!');
}

main().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
