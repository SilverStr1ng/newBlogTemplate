// CI browser validation: real WGSL compilation/execution on SwiftShader, not a
// hardware performance benchmark. Run after `pnpm build`; no runtime dependency.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(resolve(process.env.HERO_BROWSER_DEPS || '.', 'package.json'));
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const root = process.cwd();
const output = resolve('hero-browser-results');
await mkdir(output, { recursive: true });
const types = { '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path === '/__fixture') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><style>body{margin:0;background:black}canvas{display:block}</style><canvas width="192" height="192"></canvas>'); return; }
    const source = path.startsWith('/__source/');
    const base = resolve(root, source ? 'src/lib/hero' : 'dist');
    let file = resolve(base, '.' + (source ? path.slice('/__source'.length) : path));
    if (!file.startsWith(base + '/') && file !== base) { res.writeHead(403).end(); return; }
    if (!extname(file)) file = join(file, 'index.html');
    const content = await readFile(file);
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream'); res.end(content);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: [
  '--enable-unsafe-webgpu', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader',
] });
const errors = [], results = [];
try {
  const context = await browser.newContext({ viewport: { width: 1536, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'warning' && m.text().includes('[LightHero]')) errors.push(m.text()); });
  await page.goto(origin);
  await page.waitForFunction(() => document.querySelector('.hero')?.dataset.backend === 'webgpu', null, { timeout: 90000 });
  for (const width of [1536, 900, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(1200);
    const metrics = await page.evaluate(() => {
      const hero = document.querySelector('.hero');
      const links = [...document.querySelectorAll('nav .nav-link')];
      return { backend: hero.dataset.backend, overflow: document.documentElement.scrollWidth > innerWidth,
        oldBlocks: hero.querySelectorAll('.description, .hint, .archive-link, .experiment, .readout, .controls').length,
        navColors: links.map((link) => getComputedStyle(link).color), title: hero.querySelector('h1').textContent };
    });
    assert.equal(metrics.backend, 'webgpu'); assert.equal(metrics.overflow, false, `overflow at ${width}`);
    assert.equal(metrics.oldBlocks, 0); assert.equal(metrics.navColors.length, 2);
    assert.ok(metrics.title.includes('rakuyou'));
    const shot = await page.screenshot({ path: join(output, `hero-${width}.png`) });
    // Optional compact, inspectable preview for environments that cannot fetch binary artifacts.
    if (width === 1536 && process.env.HERO_PREVIEW_LOG === '1') {
      const preview = await page.evaluate(async (base64) => {
        const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
        const small = document.createElement('canvas'); small.width = 640; small.height = 375;
        small.getContext('2d').drawImage(image, 0, 0, 640, 375);
        return small.toDataURL('image/jpeg', .5).split(',')[1];
      }, shot.toString('base64'));
      console.log('HERO_PREVIEW_JPEG=' + preview);
    }
    console.log('Viewport check:', JSON.stringify({ width, ...metrics }));
    results.push({ width, ...metrics });
  }
  await page.setViewportSize({ width: 1000, height: 800 });
  const next = page.getByRole('button', { name: '切换迷宫', exact: true });
  const presets = new Set([await page.locator('.hero').getAttribute('data-preset')]);
  for (let i = 0; i < 3; i++) {
    await next.focus(); await next.press('Enter'); await page.waitForTimeout(500);
    presets.add(await page.locator('.hero').getAttribute('data-preset'));
  }
  assert.equal(presets.size, 4, 'keyboard Next must reach all four settled layouts');
  await page.getByRole('button', { name: '重置场景', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const pause = page.getByRole('button', { name: '暂停场景动画', exact: true });
  await pause.click();
  assert.equal(await page.getByRole('button', { name: '继续场景动画', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.mouse.move(650, 260); await page.mouse.down();
  await page.mouse.move(690, 340, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('.hero').getAttribute('data-backend'), 'webgpu');
  await context.close();

  // A simple complete occluder is more useful than a shader-source string check:
  // the opposite half-plane should not receive visible direct radiance.
  const fixture = await browser.newPage();
  fixture.on('pageerror', (e) => errors.push(String(e)));
  await fixture.goto(origin + '/__fixture');
  const failures = await fixture.evaluate(async () => {
    const { createGPU } = await import('/__source/gpu.js');
    const canvas = document.querySelector('canvas');
    const abort = new AbortController(); const failures = [];
    const renderer = await createGPU(canvas, (error) => failures.push(String(error)), abort.signal);
    renderer.resize(192, 192, 1);
    const wall = { x0: 96, y0: -10, x1: 96, y1: 202, radius: 4, color: [0,0,0] };
    const light = { x0: 45, y0: 65, x1: 45, y1: 125, radius: 6, color: [0.3,1,0.6] };
    renderer.render({ shapes: [wall, light] });
    await renderer.flush();
    // Keep the renderer/device alive until the compositor screenshot is captured.
    // drawImage(WebGPUCanvas) returned a zero bitmap on this software stack; test
    // the actual presented pixels instead of treating that readback as light data.
    window.fixtureCleanup = () => { renderer.destroy(); abort.abort(); };
    window.fixtureFailures = failures;
    return failures;
  });
  const shot = await fixture.locator('canvas').screenshot({ path: join(output, 'occlusion.png') });
  const image = PNG.sync.read(shot);
  assert.equal(image.width, 192); assert.equal(image.height, 192);
  const mean = (x0, x1) => {
    let sum = 0, n = 0;
    for (let y=50; y<140; y++) for (let x=x0; x<x1; x++) { sum += image.data[(y*192+x)*4+1]; n++; }
    return sum/n;
  };
  failures.push(...await fixture.evaluate(() => window.fixtureFailures));
  const pixels = { lit: mean(55,80), shadow: mean(115,155), failures };
  console.log('WebGPU opaque-barrier fixture:', JSON.stringify(pixels));
  await fixture.evaluate(() => window.fixtureCleanup());
  assert.deepEqual(pixels.failures, []);
  assert.ok(pixels.lit > 25, 'fixture is not actually illuminated');
  assert.ok(pixels.shadow < pixels.lit * .35, 'light leaks through a complete opaque barrier');
  await fixture.close();
  assert.deepEqual(errors, []);
  results.push({ fixture: pixels, adapter: 'Chromium SwiftShader (software, not hardware timings)' });
  console.log('Browser checks passed:', JSON.stringify(results));
} finally {
  await writeFile(join(output, 'results.json'), JSON.stringify({ results, errors }, null, 2));
  await browser.close(); await new Promise((r) => server.close(r));
}
