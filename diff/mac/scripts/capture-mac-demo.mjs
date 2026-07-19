/**
 * Capture Mac island states (requires `npm run dev` with renderer on :5173).
 * Writes to docs/demo-shots/mac-*.png
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

mkdirSync('docs/demo-shots', { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
})

await page.addInitScript(() => {
  Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' })
  window.ryu = {
    setInteractive: () => {},
    decide: () => {},
    onEvent: () => () => {},
    isDev: () => true,
    platform: 'darwin'
  }
})

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.addStyleTag({
  content: `
    html, body, #root { background: #1a1b1e !important; }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      background: radial-gradient(ellipse at top, #2a2d35, #121316 55%);
      z-index: -1;
    }
  `
})

// Idle — notch glow only
await page.screenshot({ path: 'docs/demo-shots/mac-01-idle.png' })

await page.getByRole('button', { name: 'Inject permission' }).click()
await page.waitForTimeout(400)

// Attention — hover notch strip to reveal dock (auto-expands card when pending)
await page.mouse.move(640, 12)
await page.waitForTimeout(700)
await page.screenshot({ path: 'docs/demo-shots/mac-02-attention-expanded.png' })

// Explicit expanded framing
await page.screenshot({ path: 'docs/demo-shots/mac-03-expanded.png' })

await page.getByRole('button', { name: 'Approve' }).click()
await page.waitForTimeout(450)
await page.screenshot({ path: 'docs/demo-shots/mac-04-resolved.png' })

await browser.close()
console.log('Mac shots written to docs/demo-shots/mac-*.png')
