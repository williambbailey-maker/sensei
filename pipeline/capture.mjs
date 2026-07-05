// Capture a reference website so its design can be replicated — run on your Mac.
//
// Usage, from this pipeline folder:
//   node capture.mjs https://example.com
//
// Opens the page in a real browser, scrolls through it (to trigger lazy images
// and scroll animations), then saves into ./capture/<hostname>/ :
//   top.png     — screenshot of the first screen
//   full.png    — full-page screenshot
//   page.html   — the rendered HTML (includes inline styles/scripts)
//   style-N.css — every stylesheet the page loaded (animations live here)
//
// Upload that folder to the GitHub repo (repo page → Add file → Upload files)
// so the design can be read exactly — colors, fonts, keyframes, transitions.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const url = process.argv[2]
if (!url) {
  console.error('Usage: node capture.mjs <url>')
  process.exit(1)
}
const host = new URL(url).hostname
const dir = join('capture', host)
mkdirSync(dir, { recursive: true })

const browser = await chromium.launch({ headless: false })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const cssFiles = []
page.on('response', async (res) => {
  try {
    const ct = res.headers()['content-type'] || ''
    if (ct.includes('text/css') || new URL(res.url()).pathname.endsWith('.css')) {
      cssFiles.push({ url: res.url(), text: await res.text() })
    }
  } catch {
    /* ignore unreadable responses */
  }
})

await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2000)

// Scroll through the whole page so lazy content and scroll-triggered
// animations have fired before we snapshot.
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 600) {
    window.scrollTo(0, y)
    await new Promise((r) => setTimeout(r, 200))
  }
  window.scrollTo(0, 0)
})
await page.waitForTimeout(1500)

await page.screenshot({ path: join(dir, 'top.png') })
await page.screenshot({ path: join(dir, 'full.png'), fullPage: true })
writeFileSync(join(dir, 'page.html'), await page.content())
cssFiles.forEach((c, i) =>
  writeFileSync(join(dir, `style-${i}.css`), `/* source: ${c.url} */\n` + c.text),
)

console.log(`\nSaved to ${join(process.cwd(), dir)}`)
console.log(`  screenshots: top.png, full.png`)
console.log(`  code: page.html + ${cssFiles.length} css file(s)`)
console.log(`\nNext: upload that folder to GitHub (repo → Add file → Upload files).`)
await browser.close()
