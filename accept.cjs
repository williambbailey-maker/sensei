// Acceptance checks for the 21+ bottom sheet, against `vite preview` with
// Supabase mocked. Usage: node accept.cjs <base url> <screenshot dir>
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright')
const BASE = process.argv[2]
const OUT = process.argv[3]
const UA_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const UA_PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const stores = [
  { id: 'st1', slug: 'hii-williamsburg', name: 'Hii', borough: 'Brooklyn', neighborhood: 'Williamsburg', lat: 40.71, lng: -73.96, menu_url: 'https://example.com' },
  { id: 'st2', slug: 'qube', name: 'Qube', borough: 'Manhattan', neighborhood: 'Chelsea', lat: 40.74, lng: -74.0, menu_url: 'https://example.com' },
]
const deals = Array.from({ length: 8 }, (_, i) => ({ id: 'd' + i, title: 'Deal item ' + i, description: 'Brand', url: 'https://example.com', featured: i < 4, sort: i, kind: 'sale', product_id: 'p' + i, price: 15, price_was: 22, pct: 32, image_url: null, store_name: 'Hii', store_borough: 'Brooklyn', store_slug: 'hii-williamsburg' }))

let failures = 0
const ok = (cond, label, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`)
  if (!cond) failures++
}

async function open(b, { width, height, phone = true, flag = false }) {
  const ctx = await b.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    ...(phone ? { userAgent: UA_PHONE, isMobile: true, hasTouch: true } : { userAgent: UA_DESKTOP }),
  })
  // Headless browsers are filtered from analytics on purpose; look like a person.
  await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }))
  if (flag) await ctx.addInitScript(() => localStorage.setItem('sensei_age_ok', 'true'))
  const p = await ctx.newPage()
  const events = []
  await p.route('**/*supabase.co/**', (r) => {
    const u = r.request().url()
    if (r.request().method() === 'POST' && /\/rest\/v1\/events/.test(u)) {
      const d = JSON.parse(r.request().postData() || '{}')
      events.push({ event: d.event, props: d.props || {} })
      return r.fulfill({ status: 201, body: '' })
    }
    if (r.request().method() === 'POST') return r.fulfill({ status: 201, body: '' })
    if (u.includes('live_stores')) return r.fulfill({ json: stores })
    if (u.includes('live_deals')) return r.fulfill({ json: deals })
    if (u.includes('site_stats')) return r.fulfill({ json: { shops: 126, neighborhoods: 33, in_stock: 63854 } })
    return r.fulfill({ json: [], headers: { 'content-range': '0-0/0' } })
  })
  await p.route('**/api/geo', (r) => r.fulfill({ json: { country: 'US', region: 'NY', city: 'Brooklyn' } }))
  await p.route(/google\.com|connect\.facebook|posthog/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>google</title>ok' }))
  await p.goto(BASE + '/')
  await p.waitForTimeout(900)
  return { ctx, p, events }
}

const box = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height } }, sel)

;(async () => {
  let b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch())

  // 1. Viewports: header and headline above the sheet, Yes fully visible, no scroll.
  for (const [w, h, phone] of [[375, 560, true], [390, 664, true], [430, 740, true], [1280, 800, false]]) {
    const { ctx, p } = await open(b, { width: w, height: h, phone })
    const sheet = await box(p, '.agesheet'), top = await box(p, '.top'), mark = await box(p, '.mark'), yes = await box(p, '.agesheet .cta')
    const scrollY = await p.evaluate(() => window.scrollY)
    ok(!!sheet && top.bottom <= sheet.top && mark.bottom <= sheet.top, `${w}×${h}: header and headline fully above the sheet`, `header ends ${Math.round(top.bottom)}, headline ends ${Math.round(mark.bottom)}, sheet starts ${Math.round(sheet.top)}`)
    ok(yes.top >= 0 && yes.bottom <= h, `${w}×${h}: Yes button fully inside the viewport`, `${Math.round(yes.top)}–${Math.round(yes.bottom)} of ${h}`)
    ok(sheet.height <= 300 && sheet.height <= h / 2, `${w}×${h}: sheet height within budget`, `${Math.round(sheet.height)}px (limit ${Math.min(300, h / 2)})`)
    ok(scrollY === 0, `${w}×${h}: page at the top`)
    await p.screenshot({ path: `${OUT}/sheet-${w}x${h}.png` })
    await ctx.close()
  }

  // 2. Taps behind the sheet do nothing (phone, then desktop where the
  // "Start here" rows are visible beside the sheet).
  for (const [w, h, phone] of [[390, 664, true], [1280, 800, false]]) {
    const { ctx, p, events } = await open(b, { width: w, height: h, phone })
    const focusInSheet = async () => p.evaluate(() => !!document.activeElement && !!document.activeElement.closest('.agesheet'))
    if (phone) ok(await focusInSheet() && (await p.evaluate(() => document.activeElement.textContent)).includes("Yes, I'm 21"), 'focus starts on the Yes button')
    if (phone) ok((await p.evaluate(() => getComputedStyle(document.activeElement).outlineStyle)) === 'none', 'no focus ring on arrival (touch visitors)')
    const targets = { 'Sensei wordmark': '.top .wm', 'Menu button': '.mnu', 'headline': '.mark', 'Shops near me row': '.way:nth-child(1)', 'Pick a borough row': '.way:nth-child(2)' }
    for (const [name, sel] of Object.entries(targets)) {
      const r = await box(p, sel)
      if (!r || r.top >= (await box(p, '.agesheet')).top) { console.log(`      (${w}px: skip ${name}, it's under the sheet)`); continue }
      await p.mouse.click(r.left + 8, r.top + Math.min(8, r.height / 2))
      await p.touchscreen.tap(r.left + 8, r.top + Math.min(8, r.height / 2)).catch(() => {})
    }
    await p.waitForTimeout(500)
    const menuOpen = await p.evaluate(() => !!document.querySelector('.menu.open, [data-menu-open="true"]'))
    const journey = await p.evaluate(() => !!document.querySelector('#journey'))
    const others = events.filter((e) => e.event !== 'age_gate_shown')
    ok(!menuOpen && !journey, `${w}px: taps behind the sheet: no navigation, no menu`)
    ok(others.length === 0 && events.some((e) => e.event === 'age_gate_shown' && e.props.variant === 'sheet'), `${w}px: taps behind the sheet: only age_gate_shown (variant sheet) sent`, events.map((e) => e.event).join(', '))
    const inert = await p.evaluate(() => document.querySelector('[inert]') !== null && document.querySelector('.agesheet').closest('[inert]') === null)
    ok(inert, `${w}px: page wrapper is inert, the sheet is not`)

    // 3. Tab never leaves the sheet.
    if (!phone) { await ctx.close(); continue }
    let stayed = true
    for (let i = 0; i < 6; i++) { await p.keyboard.press('Tab'); stayed = stayed && (await focusInSheet()) }
    for (let i = 0; i < 6; i++) { await p.keyboard.press('Shift+Tab'); stayed = stayed && (await focusInSheet()) }
    ok(stayed, 'Tab and Shift+Tab stay inside the sheet (12 presses)')
    const ring = await p.evaluate(() => getComputedStyle(document.activeElement).outlineStyle)
    ok(ring === 'solid', 'after keyboard use, the focused answer shows a square ring', ring)
    await p.screenshot({ path: `${OUT}/keyboard-focus-390x664.png` })
    await ctx.close()
  }

  // 4–5. Yes, then reload.
  {
    const { ctx, p, events } = await open(b, { width: 390, height: 664 })
    await p.getByText("Yes, I'm 21 or older").click()
    await p.waitForTimeout(400)
    const gone = !(await p.$('.agesheet'))
    const flag = await p.evaluate(() => localStorage.getItem('sensei_age_ok'))
    const inert = await p.evaluate(() => document.querySelector('[inert]') !== null)
    ok(gone && flag === 'true' && !inert, 'Yes: sheet gone, flag stored, nothing inert', `flag=${flag}`)
    const yesEv = events.find((e) => e.event === 'age_gate_yes')
    ok(!!yesEv && yesEv.props.variant === 'sheet', 'Yes: age_gate_yes sent with variant sheet')
    await p.evaluate(() => window.scrollTo(0, 400)); await p.waitForTimeout(200)
    ok((await p.evaluate(() => window.scrollY)) > 0, 'Yes: the home scrolls')
    await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(100)
    await p.getByText('Pick a borough').first().click(); await p.waitForTimeout(400)
    ok(!!(await p.$('#journey')) && events.some((e) => e.event === 'journey_step'), 'Yes: the home is interactive (Pick a borough opens the journey)')
    await p.screenshot({ path: `${OUT}/after-yes-390x664.png` })
    await p.reload(); await p.waitForTimeout(900)
    ok(!(await p.$('.agesheet')), 'reload after Yes: no sheet')
    await ctx.close()
  }

  // 6. Under 21.
  {
    const { ctx, p, events } = await open(b, { width: 390, height: 664 })
    await p.getByText("I'm under 21").click()
    await p.waitForURL(/google\.com/, { timeout: 3000 }).catch(() => {})
    const noEv = events.find((e) => e.event === 'age_gate_no')
    ok(!!noEv && noEv.props.variant === 'sheet', 'Under 21: age_gate_no sent with variant sheet')
    ok(/google\.com/.test(p.url()), 'Under 21: goes to google.com', p.url())
    await ctx.close()
  }

  // 7. Desktop: sheet content in the .wrap column; layout behind unchanged.
  // Run with real scrollbars (Playwright hides them by default), so a shift
  // when the scrollbar comes back after "Yes" would show up here.
  await b.close()
  b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', ignoreDefaultArgs: ['--hide-scrollbars'] }).catch(() => chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] }))
  for (const [w, h] of [[900, 800], [1280, 800]]) {
    const gated = await open(b, { width: w, height: h, phone: false })
    const free = await open(b, { width: w, height: h, phone: false, flag: true })
    const sheetIn = await box(gated.p, '.agesheet .wrap'), header = await box(gated.p, 'header.wrap')
    ok(Math.abs(sheetIn.left - header.left) < 1 && Math.abs(sheetIn.right - header.right) < 1, `${w}px: sheet content sits in the .wrap column`, `sheet ${Math.round(sheetIn.left)}–${Math.round(sheetIn.right)}, header ${Math.round(header.left)}–${Math.round(header.right)}`)
    const same = [], diffs = []
    for (const sel of ['.top', '.mark', 'main .lede', '.way', '#deals']) {
      const a = await box(gated.p, sel), c = await box(free.p, sel)
      const eq = a && c && Math.abs(a.top - c.top) < 1 && Math.abs(a.left - c.left) < 1 && Math.abs(a.right - c.right) < 1
      same.push(eq)
      if (!eq) diffs.push(`${sel} gated ${a && Math.round(a.left)}–${a && Math.round(a.right)} vs ${c && Math.round(c.left)}–${c && Math.round(c.right)}`)
    }
    ok(same.every(Boolean), `${w}px: layout behind the sheet is identical to the ungated page`, diffs.join('; '))
    if (w === 1280) await free.p.screenshot({ path: `${OUT}/no-sheet-1280x800.png` })
    await gated.ctx.close(); await free.ctx.close()
  }

  await b.close()
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed')
  process.exit(failures ? 1 : 0)
})()
