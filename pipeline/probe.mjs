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
//   node probe.mjs --show logs/probe-<file>.json <text in the request url> [path.in.body]
//   node probe.mjs --show logs/probe-<file>.html [<text in the data path>]
// To click around first (a store picker), e.g. 45 seconds:
//   node probe.mjs --wait 45 <menu url>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const urls = process.argv.slice(2)
// --wait <seconds>: keep the page open that long before recording, so a
// store picker or age gate can be clicked by hand.
let WAIT = 0
const wi = urls.indexOf('--wait')
if (wi >= 0) {
  WAIT = parseInt(urls[wi + 1], 10) || 30
  urls.splice(wi, 2)
}
if (!urls.length) {
  console.error('Usage: node probe.mjs <menu url> [more urls…]')
  process.exit(1)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const MAX_BODY = 3_000_000

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
  const [, file, match = '', at = ''] = urls
  // A dotted path (hits.hits[0]._source) prints that spot of the first match.
  const dig = (o, path) => path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean).reduce((x, k) => (x == null ? x : x[k]), o)
  if (file.endsWith('.html')) {
    const nd = readFileSync(file, 'utf8').match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    if (!nd) {
      console.log('no __NEXT_DATA__ in that page')
      process.exit(0)
    }
    const data = JSON.parse(nd[1])
    console.log(`buildId: ${data.buildId} · page: ${data.page} · query: ${JSON.stringify(data.query)}`)
    console.log(`pageProps keys: ${Object.keys(data.props?.pageProps || {}).join(', ')}`)
    // Every list of objects with 3+ items, biggest first, so the product list
    // can be told apart from filters and menus.
    const lists = []
    ;(function walk(node, path, depth) {
      if (!node || typeof node !== 'object' || depth > 12) return
      if (Array.isArray(node)) {
        const objs = node.filter((x) => x && typeof x === 'object' && !Array.isArray(x))
        if (objs.length >= 3) lists.push({ path, len: objs.length, keys: Object.keys(objs[0]).slice(0, 12), first: objs[0] })
        node.slice(0, 3).forEach((v, i) => walk(v, `${path}[${i}]`, depth + 1))
      } else for (const k of Object.keys(node)) walk(node[k], `${path}.${k}`, depth + 1)
    })(data, '$', 0)
    lists.sort((a, b) => b.len - a.len)
    for (const l of lists.slice(0, 15)) console.log(`  ${String(l.len).padStart(4)} items  ${l.path}  [${l.keys.join(', ')}]`)
    const pick = match ? lists.find((l) => l.path.includes(match)) : lists[0]
    if (pick) console.log(`\nfirst item of ${pick.path}:\n${JSON.stringify(pick.first, null, 1).slice(0, 3500)}`)
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
    if (at) {
      console.log(`${at}:\n${JSON.stringify(dig(c.body, at), null, 1)?.slice(0, 6000)}`)
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
  const other = [] // xhr/fetch responses that weren't JSON (so nothing is missed)
  page.on('response', async (r) => {
    const req = r.request()
    const ct = r.headers()['content-type'] || ''
    const isXhr = ['xhr', 'fetch'].includes(req.resourceType())
    if (!/json|graphql/i.test(ct) && !isXhr) return
    let body = null
    try {
      const text = await r.text()
      body = JSON.parse(text)
    } catch {
      if (isXhr) other.push(`${r.status()} ${req.method()} ${new URL(r.url()).host}${new URL(r.url()).pathname} (${ct.split(';')[0] || 'no content-type'})`)
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
    await sleep(4000)
    // Age gate: click the first "I'm 21 / Yes / Enter" style button, if any,
    // since many menus don't load products until it's answered.
    // Only a short button whose whole label reads like a gate answer.
    const gate = page
      .locator('button, a, [role="button"]')
      .filter({ hasText: /^\s*(i'?m|i am|yes|enter|confirm|agree|continue)\b|\b21\b/i })
      .filter({ hasNot: page.locator('img') })
      .first()
    const label = (await gate.innerText({ timeout: 1500 }).catch(() => '')).trim().slice(0, 40)
    if (label && label.length <= 40 && (await gate.isVisible().catch(() => false))) {
      await gate.click({ timeout: 3000 }).catch(() => {})
      console.log(`  clicked "${label}" (age gate?)`)
      await sleep(5000)
    }
    await sleep(2000)
    if (WAIT) {
      console.log(`  waiting ${WAIT}s — click through the site now (pick a location, etc.)`)
      await sleep(WAIT * 1000)
    }
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
  await page.screenshot({ path: `logs/probe-${new URL(url).host}-${Date.now()}.png`, fullPage: false }).catch(() => {})
  if (other.length) console.log(`  non-JSON data requests:\n${[...new Set(other)].slice(0, 10).map((o) => `    ${o}`).join('\n')}`)
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
  console.log(`  saved: ${file} (+ .html, .png screenshot)`)
  await page.close()
  await sleep(3000) // polite gap between pages
}
await browser.close()
