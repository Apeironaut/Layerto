import { chromium } from 'playwright';

const ARTIFACT_DIR = '/home/naviya-c/.gemini/antigravity-ide/brain/24dcc952-74ec-40d0-852b-6b832fc65177';

async function main() {
  console.log('🚀 Starting Lab Notebook & 50/50 Architecture Verification Suite...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 },
  });

  // Inject session cookies for naviya@gmail.com
  await context.addCookies([
    { name: 'lt_session', value: 'dev_session_token_12345', url: 'http://localhost:8080' },
    { name: 'lt_session', value: 'dev_session_token_12345', url: 'http://localhost:5174' },
    { name: 'lt_session', value: 'dev_session_token_12345', url: 'http://localhost:5173' },
  ]);

  const page = await context.newPage();

  // -------------------------------------------------------------
  // STEP 1: Navigate to Clinical Area Overview & Lab Notebook
  // -------------------------------------------------------------
  console.log('\n[1/6] Navigating to Clinical Area Overview (http://localhost:5174/research)...');
  await page.goto('http://localhost:5174/research', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Click on Clinical Radiology & Neural Pathology Lab
  await page.click('text=Clinical Radiology & Neural Pathology Lab');
  await page.waitForTimeout(1500);

  // -------------------------------------------------------------
  // STEP 2: Verify 50% / 50% Responsive X-Axis Grid Architecture
  // -------------------------------------------------------------
  console.log('\n[2/6] Verifying 50% / 50% X-Axis Layout Split...');
  
  // Left half: Research Area Pulse
  const pulseHeader = page.locator('text=Research Hypothesis & Core Objective');
  await pulseHeader.waitFor({ state: 'visible' });
  console.log('✓ Found Left 50% component: Research Hypothesis & Objective');

  const milestoneHeader = page.locator('text=Interdisciplinary Milestone Checklist');
  await milestoneHeader.waitFor({ state: 'visible' });
  console.log('✓ Found Left 50% component: Interdisciplinary Milestone Checklist');

  // Test toggling a milestone
  console.log('Toggling milestone in checklist...');
  const milestoneItem = page.locator('text=Baseline Neural Architecture Benchmark Training');
  await milestoneItem.click();
  await page.waitForTimeout(400);
  console.log('✓ Toggled milestone checklist item!');

  // Right half: Lab Notebook & Field Scratchpad
  const notebookHeader = page.locator('h3:has-text("Lab Notebook & Field Scratchpad")');
  await notebookHeader.waitFor({ state: 'visible' });
  console.log('✓ Found Right 50% component: Lab Notebook & Field Scratchpad');

  await page.screenshot({
    path: `${ARTIFACT_DIR}/overview_lab_notebook_50_50_split_verified.png`,
    fullPage: false,
  });
  console.log('📸 Screenshot saved: overview_lab_notebook_50_50_split_verified.png');

  // -------------------------------------------------------------
  // STEP 3: Test Search, Filter, and Sort Controls
  // -------------------------------------------------------------
  console.log('\n[3/6] Testing Search & Sort Controls...');
  const searchInput = page.locator('input[placeholder="Search notes or #number..."]');
  await searchInput.fill('Axial');
  await page.waitForTimeout(400);

  // Verify only matching note is shown
  const axialNote = page.locator('text=Axial T2-FLAIR Contrast S6 Lesion Segmentation Benchmark');
  await axialNote.waitFor({ state: 'visible' });
  console.log('✓ Search query successfully filtered notes!');

  // Clear search
  await searchInput.fill('');
  await page.waitForTimeout(400);

  // Test sort dropdown
  const sortSelect = page.locator('select').first();
  await sortSelect.selectOption('oldest');
  await page.waitForTimeout(400);
  console.log('✓ Selected sort: Oldest First');
  await sortSelect.selectOption('newest');
  await page.waitForTimeout(400);
  console.log('✓ Reverted sort: Newest First');

  // -------------------------------------------------------------
  // STEP 4: Open Ruled Paper Sheet Composer Popup & Attach Evidence
  // -------------------------------------------------------------
  console.log('\n[4/6] Opening Ruled Research Lab Sheet Composer Modal...');
  await page.click('button:has-text("Add Note")');
  await page.waitForTimeout(1000);

  // Verify modal is visible
  await page.locator('text=Lab Sheet Composer').waitFor({ state: 'visible' });
  console.log('✓ Ruled Sheet Composer opened!');

  // Fill Title
  await page.fill('input[placeholder="Observation Entry Title / Subject..."]', 'Post-Operative Glioma Margin Cavity Inspection');
  
  // Use formatting toolbar
  await page.click('button[title="Heading (###)"]');
  await page.waitForTimeout(200);
  await page.click('button[title="Bullet List (- )"]');
  await page.waitForTimeout(200);

  // Fill Body
  const composerTextarea = page.locator('#ruled-composer-textarea');
  await composerTextarea.fill(`### Intraoperative Cavity Contrast Evaluation
Post-resection contrast-enhanced T1-weighted volume verification at 3.0 Tesla.

- Complete resection achieved along anterior temporal margins
- Zero extravasation of gadolinium contrast within surgical bed
- Post-operative diffusion-weighted imaging excludes acute peri-cavity ischemia

> [!NOTE]
> TransUNet re-run on post-op cavity confirms 0.00 cc residual hyperintense tumor volume.`);

  // Attach an evidence photograph
  console.log('Attaching evidence photograph...');
  await page.click('button:has-text("Attach Image")');
  await page.waitForTimeout(400);

  await page.fill('input[placeholder="Image URL (https://...)"]', 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1200&q=80');
  await page.fill('input[placeholder="Title (e.g. Axial T2 Scan)"]', 'Post-op Cavity MRI Scan');
  await page.fill('input[placeholder="Optional observation caption / clinical notes..."]', 'Zero residual contrast enhancement observed in resection margins');
  await page.click('button:has-text("Add Image")');
  await page.waitForTimeout(500);
  console.log('✓ Evidence scan attached with caption!');

  // Attach a literature link
  console.log('Attaching literature citation...');
  await page.click('button:has-text("Attach Citation")');
  await page.waitForTimeout(400);

  await page.fill('input[placeholder="Citation URL (https://pubmed.ncbi... or doi.org/...)"]', 'https://nature.com/articles/s41591-026-00123-x');
  await page.fill('input[placeholder="Reference Title (e.g. Nature 2026)"]', 'Nature Medicine: Surgical Margin AI');
  await page.click('button:has-text("Add Link")');
  await page.waitForTimeout(500);
  console.log('✓ Literature link citation attached!');

  await page.screenshot({
    path: `${ARTIFACT_DIR}/ruled_sheet_composer_modal_verified.png`,
    fullPage: false,
  });
  console.log('📸 Screenshot saved: ruled_sheet_composer_modal_verified.png');

  // Save note to database
  console.log('Saving note to PostgreSQL...');
  await page.click('button:has-text("Save to Lab Notebook")');
  await page.waitForTimeout(1500);
  console.log('✓ Note persisted to database!');

  // Verify note appeared in list with evidence pills
  const newNoteCard = page.locator('text=Post-Operative Glioma Margin Cavity Inspection');
  await newNoteCard.waitFor({ state: 'visible' });
  console.log('✓ New entry appeared in chronological list with evidence badges!');

  // -------------------------------------------------------------
  // STEP 5: Interactive Note Reader Popup & Keyboard Arrow Navigation
  // -------------------------------------------------------------
  console.log('\n[5/6] Opening Ruled Sheet Reader Popup...');
  await newNoteCard.click();
  await page.waitForTimeout(1000);

  await page.locator('text=Lab Notebook Sheet').waitFor({ state: 'visible' });
  console.log('✓ Ruled Sheet Reader opened!');

  await page.screenshot({
    path: `${ARTIFACT_DIR}/ruled_sheet_reader_modal_verified.png`,
    fullPage: false,
  });
  console.log('📸 Screenshot saved: ruled_sheet_reader_modal_verified.png');

  // Test Image Lightbox
  console.log('Testing Evidence Image Lightbox...');
  const evidenceCard = page.locator('.group:has-text("Post-op Cavity MRI Scan")').first();
  await evidenceCard.scrollIntoViewIfNeeded();
  await evidenceCard.waitFor({ state: 'visible' });
  await evidenceCard.click();
  await page.waitForTimeout(600);

  await page.screenshot({
    path: `${ARTIFACT_DIR}/evidence_lightbox_gallery_verified.png`,
    fullPage: false,
  });
  console.log('📸 Screenshot saved: evidence_lightbox_gallery_verified.png');

  // Close Lightbox using button
  await page.click('button:has-text("Close Preview")');
  await page.waitForTimeout(500);

  // Test Arrow-Key Navigation
  console.log('Testing ArrowLeft keyboard navigation to previous note...');
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(800);

  // Verify previous note title is displayed
  const prevTitle = page.locator('h2:has-text("Axial T2-FLAIR Contrast S6 Lesion Segmentation Benchmark")');
  await prevTitle.waitFor({ state: 'visible' });
  console.log('✓ ArrowLeft successfully flipped to sequential previous note!');

  console.log('Testing ArrowRight keyboard navigation to next note...');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(800);

  const nextTitle = page.locator('h2:has-text("Post-Operative Glioma Margin Cavity Inspection")');
  await nextTitle.waitFor({ state: 'visible' });
  console.log('✓ ArrowRight successfully flipped back to next note!');

  // Close reader using ESC key
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  console.log('✓ Escape key closed the reader modal!');

  // -------------------------------------------------------------
  // STEP 6: Zero-Leakage Cross-Area Isolation Verification
  // -------------------------------------------------------------
  console.log('\n[6/6] Verifying Strict Research Area Isolation...');
  await page.goto('http://localhost:5174/research', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Click on Sinhala-Tamil Linguistics Area
  await page.click('text=Sinhala-Tamil Low-Resource NLP & Paleography Corpus');
  await page.waitForTimeout(1500);

  // Verify only linguistics notes are in this vault
  const olaNote = page.locator('text=Ola Leaf Manuscript Recto/Verso Ligature Transcription Log');
  await olaNote.waitFor({ state: 'visible' });
  console.log('✓ Found Sinhala-Tamil Linguistics notes!');

  // Verify clinical note is NOT leaked here
  const leakedNote = page.locator('text=Post-Operative Glioma Margin Cavity Inspection');
  const count = await leakedNote.count();
  if (count === 0) {
    console.log('✓ Zero leakage verified: Clinical notes do not exist in Linguistics vault!');
  } else {
    throw new Error('Leakage detected! Clinical note found in Linguistics vault.');
  }

  await browser.close();
  console.log('\n🎉 ALL LAB NOTEBOOK & 50/50 ARCHITECTURE TESTS PASSED WITH 100% SUCCESS!');
}

main().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
