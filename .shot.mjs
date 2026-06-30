import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:5174/';
const out = process.argv[3] || 'shot.png';
const wait = Number(process.argv[4] || 6000);

const browser = await chromium.launch({
  executablePath:
    process.env.PW_CHROME ||
    'C:\\Users\\miazh\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1223\\chrome-headless-shell-win64\\chrome-headless-shell.exe',
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
const [vw, vh] = (process.env.VIEWPORT || '1440x900').split('x').map(Number);
const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page
  .goto(url, { waitUntil: process.env.WAITUNTIL || 'networkidle' })
  .catch((e) => logs.push('goto: ' + e.message));
await page.waitForTimeout(wait);
if (process.env.GOTO) {
  // drive the dev scroll hook to a section index, then let it settle
  const idx = Number(process.env.GOTO);
  await page.evaluate((i) => window.__aquaria?.scrollToSection?.(i), idx);
  await page.waitForTimeout(Number(process.env.GOTOWAIT || 1600));
}
if (process.env.MOUSE) {
  // sweep the pointer to emit mouse bubbles, then a click burst
  await page.mouse.move(500, 480);
  for (let i = 0; i <= 20; i++) await page.mouse.move(500 + i * 18, 480 + Math.sin(i / 3) * 60);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(400);
}
const clip = process.env.CLIP
  ? (() => {
      const [x, y, width, height] = process.env.CLIP.split(',').map(Number);
      return { x, y, width, height };
    })()
  : undefined;
await page.screenshot({ path: out, clip });
console.log('--- console ---');
console.log(logs.join('\n'));
await browser.close();
