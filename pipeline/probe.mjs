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
//
// To print sample items from a saved capture (for Claude to read the shape):
//   node probe.mjs --show logs/probe-<file>.json <text in the request url>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

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
    if (objs.length > best.len) Object.assign(best, { len: objs.length, path, keys: Object.keys(objs[0]).slice(0, 25), items: objs })
    node.slice(0, 50).forEach((v, i) => largestArray(v, depth + 1, best, `${path}[${i}]`))
  } else {
    for (const k of Object.keys(node)) largestArray(node[k], depth + 1, best, `${path}.${k}`)
  }
  return best
}

// --show: the matching requests from a saved capture, with their two first
// items (trimmed), so a new platform's product shape can be read.
if (urls[0] === '--show') {
  const [, file, match = ''] = urls
  if (file.endsWith('.html')) {
    const nd = readFileSync(file, 'utf8').match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    if (!nd) {
      console.log('no __NEXT_DATA__ in that page')
      process.exit(0)
    }
    const big = largestArray(JSON.parse(nd[1]))
    console.log(`__NEXT_DATA__: biggest list ${big.len} items at ${big.path}`)
    for (const item of (big.items || []).slice(0, 2)) console.log(JSON.stringify(item, null, 1).slice(0, 3000))
    process.exit(0)
  }
  const { calls } = JSON.parse(readFileSync(file, 'utf8'))
  const hits = calls.filter((c) => `${c.host}${c.path}${c.query}${c.post}`.includes(match))
  console.log(`${hits.length} of ${calls.length} requests match "${match}"`)
  for (const c of hits.slice(0, 4)) {
    console.log(`\n--- ${c.status} ${c.method} ${c.host}${c.path}`)
    if (c.query) console.log(`query: ${decodeURIComponent(c.query).slice(0, 600)}`)
    if (c.post) console.log(`post: ${c.post.slice(0, 400)}`)
    if (c.headers.length) console.log(`headers: ${c.headers.join(' ')}`)
    if (typeof c.body !== 'object') {
      console.log(`body: ${c.body}`)
      continue
    }
    const big = largestArray(c.body)
    console.log(`top-level keys: ${Object.keys(c.body || {}).join(', ')}`)
    console.log(`biggest list: ${big.len} items at ${big.path}`)
    for (const item of (big.items || []).slice(0, 2)) console.log(JSON.stringify(item, null, 1).slice(0, 3000))
  }
  process.exit(0)
}

const { chromium } = await import('playwright')
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
  // Server-rendered sites ship the first page of products inside the HTML
  // (Next.js __NEXT_DATA__ and the like) rather than fetching it.
  const html = await page.content().catch(() => '')
  const embedded = []
  const nd = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (nd) {
    try {
      const big = largestArray(JSON.parse(nd[1]))
      embedded.push(`__NEXT_DATA__ (${Math.round(nd[1].length / 1024)} KB) · biggest list ${big.len} items at ${big.path} · item fields: ${big.keys.join(', ')}`)
    } catch {
      embedded.push(`__NEXT_DATA__ (${Math.round(nd[1].length / 1024)} KB, unparseable)`)
    }
  }
  for (const name of ['__NUXT__', '__INITIAL_STATE__', '__PRELOADED_STATE__', '__APOLLO_STATE__']) {
    if (html.includes(name)) embedded.push(`${name} present in the HTML`)
  }
  if (embedded.length) console.log(`  embedded data:\n${embedded.map((e) => `    ${e}`).join('\n')}`)
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
  writeFileSync(file, JSON.stringify({ url, landed: page.url(), frames, embedded, calls }, null, 2))
  writeFileSync(file.replace(/\.json$/, '.html'), html)
  console.log(`  saved: ${file} (+ .html)`)
  await page.close()
  await sleep(3000) // polite gap between pages
}
await browser.close()
