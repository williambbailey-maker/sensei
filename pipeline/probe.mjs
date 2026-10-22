// See what data a menu page loads — run on your Mac, paste the output to Claude.
//
// Usage, from this pipeline folder:
//   node probe.mjs <menu url> [more urls…]
//
// Opens each page in a real browser (one load, a few scrolls), records every
// JSON request it makes, and prints a short summary per request: host + path,
// status, which custom headers it sent, and whether the response holds a list
// of products. Also lists any embedded menu frames. The full capture is saved
// to logs/probe-<host>-<time>.json. Reads only; writes nothing to Supabase.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const urls = process.argv.slice(2)
if (!urls.length) {
  console.error('Usage: node probe.mjs <menu url> [more urls…]')
  process.exit(1)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const MAX_BODY = 200_000

// The longest array of objects anywhere in a JSON body, as a product hint.
function largestArray(node, depth = 0, best = { len: 0, path: '', keys: [] }, path = '$') {
  if (!node || typeof node !== 'object' || depth > 12) return best
  if (Array.isArray(node)) {
    const objs = node.filter((x) => x && typeof x === 'object' && !Array.isArray(x))
    if (objs.length > best.len) Object.assign(best, { len: objs.length, path, keys: Object.keys(objs[0]).slice(0, 25) })
    node.slice(0, 50).forEach((v, i) => largestArray(v, depth + 1, best, `${path}[${i}]`))
  } else {
    for (const k of Object.keys(node)) largestArray(node[k], depth + 1, best, `${path}.${k}`)
  }
  return best
}

const browser = await chromium.launch({ headless: false })
mkdirSync('logs', { recursive: true })
for (const url of urls) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const calls = []
  page.on('response', async (r) => {
    const req = r.request()
    const ct = r.headers()['content-type'] || ''
    if (!/json|graphql/i.test(ct) && !['xhr', 'fetch'].includes(req.resourceType())) return
    let body = null
    try {
      const text = await r.text()
      body = JSON.parse(text)
    } catch {
      return // not JSON
    }
    const u = new URL(r.url())
    // Custom header names (and a short prefix of their value) — API keys and
    // store ids often ride in these.
    const hdrs = Object.entries(req.headers())
      .filter(([k]) => /^x-|authorization|apikey|api-key|store|venue|shop|tenant/i.test(k))
      .map(([k, v]) => `${k}=${String(v).slice(0, 12)}…`)
    const big = largestArray(body)
    calls.push({
      method: req.method(),
      status: r.status(),
      host: u.host,
      path: u.pathname,
      query: u.search.slice(0, 300),
      post: (req.postData() || '').slice(0, 400),
      headers: hdrs,
      products: big.len,
      productsAt: big.path,
      itemKeys: big.keys,
      errors: Array.isArray(body?.errors) ? body.errors.map((e) => e.message).slice(0, 3) : undefined,
      body: JSON.stringify(body).length > MAX_BODY ? '(too large, trimmed)' : body,
    })
  })

  console.log(`\n=== ${url}`)
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await sleep(6000)
    for (let i = 0; i < 3; i++) {
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)').catch(() => {})
      await sleep(1500)
    }
  } catch (e) {
    console.log(`  page error: ${e.message.slice(0, 120)}`)
  }
  console.log(`  landed on: ${page.url()}`)
  const frames = page.frames().map((f) => f.url()).filter((f) => f && f !== 'about:blank' && f !== page.url())
  if (frames.length) console.log(`  embedded frames:\n${frames.slice(0, 8).map((f) => `    ${f.slice(0, 160)}`).join('\n')}`)
  console.log(`  ${calls.length} JSON requests:`)
  for (const c of calls.slice(0, 40)) {
    const op = (c.query.match(/operationName=([^&]+)/) || c.post.match(/"operationName":"([^"]+)"/) || [])[1]
    console.log(
      `  ${c.status} ${c.method} ${c.host}${c.path}${op ? ` [${op}]` : ''}` +
        (c.products ? ` · list of ${c.products}` : '') +
        (c.headers.length ? ` · headers: ${c.headers.join(' ')}` : '') +
        (c.errors ? ` · ERRORS: ${c.errors.join(' | ').slice(0, 160)}` : ''),
    )
  }
  const best = [...calls].sort((a, b) => b.products - a.products)[0]
  if (best?.products) console.log(`  biggest list: ${best.products} items from ${best.host}${best.path}\n  item fields: ${best.itemKeys.join(', ')}`)
  const file = `logs/probe-${new URL(url).host}-${Date.now()}.json`
  writeFileSync(file, JSON.stringify({ url, landed: page.url(), frames, calls }, null, 2))
  console.log(`  saved: ${file}`)
  await page.close()
  await sleep(3000) // polite gap between pages
}
await browser.close()
