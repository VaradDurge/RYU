import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

mkdirSync('docs/demo-shots', { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
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

await page.screenshot({ path: 'docs/demo-shots/01-idle.png' })

// Hover top-center to open dock in idle
await page.mouse.move(640, 20)
await page.waitForTimeout(400)
await page.screenshot({ path: 'docs/demo-shots/01b-dock-hover.png' })

await page.getByRole('button', { name: 'Inject Cursor' }).click()
await page.waitForTimeout(800)
await page.screenshot({ path: 'docs/demo-shots/02-attention.png' })
await page.screenshot({ path: 'docs/demo-shots/03-expanded.png' })

await page.getByRole('button', { name: 'Approve' }).click()
await page.waitForTimeout(450)
await page.screenshot({ path: 'docs/demo-shots/04-resolved.png' })

await browser.close()
console.log('shots written to docs/demo-shots')
