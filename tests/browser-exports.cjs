const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const {fixture, generateRubyScript, generateFloorPlanSvg} = require('./fixture.cjs');
const port = 4327;
const origin = `http://127.0.0.1:${port}`;
const payload = {config: fixture, rubyScript: generateRubyScript(fixture), floorPlanSvg: generateFloorPlanSvg(fixture), warnings: []};

(async () => {
  // Own this test server; never reuse an existing app or enable a provider.
  const server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: path.resolve(__dirname, '..'),
    env: {...process.env, ANTHROPIC_API_KEY: '', NEXT_TELEMETRY_DISABLED: '1'},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', chunk => { log += chunk; });
  server.stderr.on('data', chunk => { log += chunk; });
  let browser;
  const downloads = fs.mkdtempSync(path.join(os.tmpdir(), 'booth-browser-'));
  try {
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw Error(`Test server exited: ${log}`);
      if (log.includes('Ready in')) break;
      if (i === 99) throw Error(`Test server did not start: ${log}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    browser = await chromium.launch({headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
    const page = await browser.newPage({viewport: {width: 1440, height: 1000}, serviceWorkers: 'block'});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      return url.origin === origin || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort();
    });
    await page.goto(origin);
    await page.getByRole('button', {name: 'Generate Booth', exact: true}).click();
    await page.getByText('AI generation is not configured.', {exact: false}).waitFor();
    console.log('Missing provider error shown PASS');
    await page.route('**/api/generate', route => route.fulfill({contentType: 'application/json', body: JSON.stringify(payload)}));
    await page.getByRole('button', {name: 'Generate Booth', exact: true}).click();
    await page.locator('canvas').waitFor();
    await page.waitForTimeout(1000);
    assert.deepEqual(errors, [], 'Canvas must mount without React/renderer errors');
    for (const ext of ['rb', 'glb', 'usdz']) {
      const waiting = page.waitForEvent('download');
      await page.getByRole('button', {name: '.' + ext, exact: true}).click();
      const download = await waiting;
      const filename = path.join(downloads, `fixture.${ext}`);
      await download.saveAs(filename);
      const bytes = fs.readFileSync(filename);
      assert.ok(bytes.length > 50, `Empty ${ext}`);
      if (ext === 'glb') assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
      if (ext === 'usdz') assert.equal(bytes.toString('ascii', 0, 2), 'PK');
      console.log(`${ext} ${bytes.length} bytes PASS`);
    }
    await page.getByRole('button', {name: 'Floor Plan', exact: true}).click();
    await page.locator('svg[viewBox="0 0 440 320"]').waitFor();
    assert.deepEqual(errors, [], 'No browser page errors');
    console.log('Floor plan and browser errors PASS');
  } finally {
    if (browser) await browser.close();
    if (server.exitCode === null) {
      server.kill('SIGTERM');
      await new Promise(resolve => server.once('exit', resolve));
    }
    fs.rmSync(downloads, {recursive: true, force: true});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
