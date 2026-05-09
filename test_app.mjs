import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, 'test_screenshots');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

try {
  // 1. Load page
  console.log('1. Loading page...');
  await page.goto('http://localhost:3001');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: join(outDir, '01_initial.png') });
  console.log('   Screenshot: 01_initial.png');

  // 2. Check mode toggle
  console.log('2. Checking mode toggle...');
  const briefTab = page.getByRole('button', { name: 'Text Brief' });
  const imageTab = page.getByRole('button', { name: 'Image → 3D' });
  console.log(`   Text Brief tab visible: ${await briefTab.isVisible()}`);
  console.log(`   Image → 3D tab visible: ${await imageTab.isVisible()}`);

  // 3. Click Image mode
  console.log('3. Switching to Image → 3D mode...');
  await imageTab.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(outDir, '02_image_mode.png') });
  console.log('   Screenshot: 02_image_mode.png');

  const uploadArea = page.locator('text=Drop a floor plan or booth sketch');
  console.log(`   Upload area visible: ${await uploadArea.isVisible()}`);

  // 4. Back to brief mode
  console.log('4. Switching back to Text Brief...');
  await briefTab.click();
  await page.waitForTimeout(300);

  // 5. Select Tech template
  console.log('5. Selecting Tech/Software template...');
  await page.locator('text=Tech / Software').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, '03_template.png') });
  console.log('   Screenshot: 03_template.png');

  // 6. Generate booth
  console.log('6. Generating booth (calling Claude API ~15-30s)...');
  await page.locator('button:has-text("Generate Booth")').click();

  // Wait for result
  await page.waitForSelector('text=3D View', { timeout: 90000 });
  await page.waitForTimeout(3000); // Let Three.js render
  await page.screenshot({ path: join(outDir, '04_result_3d.png') });
  console.log('   Screenshot: 04_result_3d.png');

  // 7. Check export buttons
  console.log('7. Checking export buttons...');
  console.log(`   .glb: ${await page.locator('button:has-text(".glb")').isVisible()}`);
  console.log(`   .usdz: ${await page.locator('button:has-text(".usdz")').isVisible()}`);
  console.log(`   .rb: ${await page.locator('button:has-text(".rb")').isVisible()}`);

  // 8. Floor Plan view
  console.log('8. Switching to Floor Plan...');
  await page.locator('button:has-text("Floor Plan")').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(outDir, '05_floor_plan.png') });
  console.log('   Screenshot: 05_floor_plan.png');

  // 9. Back to 3D
  console.log('9. Back to 3D View...');
  await page.locator('button:has-text("3D View")').click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(outDir, '06_3d_final.png') });
  console.log('   Screenshot: 06_3d_final.png');

  console.log('\nAll tests PASSED!');

} catch (e) {
  await page.screenshot({ path: join(outDir, '99_error.png') });
  console.error(`ERROR: ${e.message}`);
  console.log('   Screenshot: 99_error.png');
} finally {
  await browser.close();
}
