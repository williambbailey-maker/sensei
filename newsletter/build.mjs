// Build one issue of the weekly drop: an HTML email (tables, inline styles)
// plus a plain-text twin, from the live data. Nothing is written by hand each
// week; the content is the deals board, the cheapest item per product type
// and the headline counts.
//
//   node newsletter/build.mjs                 # live data → newsletter/dist/
//   node newsletter/build.mjs --sample        # sample data, for a look at the design
//
// Reads Supabase with the public (anon) key, the same one the site uses:
// live_deals, products, site_stats. Refuses to build from a menu older than
// MAX_AGE_DAYS unless FORCE=1, so a stale scrape never goes out as "this week".
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dywrisybvcorpfhbwgtg.supabase.co'
const ANON = (process.env.SUPABASE_ANON_KEY || '').trim()
const SITE = 'https://sensei.nyc'
const MAX_AGE_DAYS = 4
const SAMPLE = process.argv.includes('--sample')
const FORCE = /^(1|true|yes)$/i.test(process.env.FORCE || '')
// Your postal address is required on commercial email (CAN-SPAM). Set it as
// NEWSLETTER_ADDRESS; the placeholder stays visible until you do.
const ADDRESS = process.env.NEWSLETTER_ADDRESS || '[MAILING ADDRESS]'

const CATS = [
  ['flower', 'Flower'],
  ['pre-rolls', 'Pre-roll'],
  ['vaporizers', 'Vape'],
  ['edibles', 'Edible'],
]

async function get(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } })
  if (!r.ok) throw new Error(`${path}: ${r.status} ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

// --- data --------------------------------------------------------------------
async function load() {
  if (SAMPLE) return sample()
  if (!ANON) throw new Error('SUPABASE_ANON_KEY is not set')
  const [stats, deals, latest] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/rpc/site_stats`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' }, body: '{}' }).then((r) => r.json()),
    get('live_deals?select=title,description,url,price,price_was,pct,store_name,store_borough&order=featured.desc,sort.asc&limit=12'),
    get('products?select=last_seen&in_stock=eq.true&order=last_seen.desc&limit=1'),
  ])
  const lastScrape = latest[0]?.last_seen ? new Date(latest[0].last_seen) : null
  const ageDays = lastScrape ? (Date.now() - lastScrape.getTime()) / 864e5 : Infinity
  if (ageDays > MAX_AGE_DAYS && !FORCE) {
    throw new Error(`The menu was last refreshed ${lastScrape ? lastScrape.toDateString() : 'never'} (${Math.round(ageDays)} days ago). Run the scraper first, or FORCE=1 to build anyway.`)
  }
  // Cheapest real item per product type: a named brand and a photo, $5 up
  // (below that it is batteries and sparkling water).
  const cheapest = []
  for (const [cat, label] of CATS) {
    const rows = await get(
      `products?select=clean_name,name,clean_brand,brand,price_min,url,store:stores(name,borough)&in_stock=eq.true&category=eq.${cat}&price_min=gte.5&clean_brand=not.is.null&image_url=not.is.null&order=price_min.asc&limit=1`,
    )
    if (rows[0]) cheapest.push({ label, ...rows[0] })
  }
  return { stats, deals, cheapest, lastScrape }
}

function sample() {
  const s = (name, borough) => ({ store_name: name, store_borough: borough })
  return {
    stats: { shops: 126, neighborhoods: 33, in_stock: 63854 },
    lastScrape: new Date(),
    deals: [
      { title: 'Nyce | Alien Mints | Live Hash Rosin AIO | 1g', description: 'Nyce', url: SITE, price: 30, price_was: 50, pct: 40, ...s('Hii Williamsburg', 'Brooklyn') },
      { title: 'FLAMER | Lobotomy | Indica | Pre-Roll', description: 'FLAMER', url: SITE, price: 12, price_was: 18, pct: 33, ...s('The Travel Agency Downtown Brooklyn', 'Brooklyn') },
      { title: 'Peach Gummies 10pk', description: 'Wyld', url: SITE, price: 15.75, price_was: 22, pct: 28, ...s('Gotham Chelsea', 'Manhattan') },
      { title: 'Blue Dream | Sativa | 3.5g', description: 'Florist Farms', url: SITE, price: 35, price_was: 48, pct: 27, ...s('Terp Bros Astoria', 'Queens') },
      { title: 'Lemon Cherry Gelato Live Resin Cart 1g', description: 'Jetty Extracts', url: SITE, price: 45, price_was: 60, pct: 25, ...s('Housing Works Broadway', 'Manhattan') },
      { title: 'Sour Watermelon Gummies', description: 'Camino', url: SITE, price: 18, price_was: 24, pct: 25, ...s('Culture House Greenpoint', 'Brooklyn') },
    ],
    cheapest: [
      { label: 'Flower', clean_name: 'Shake 7g', clean_brand: 'Dank by Definition', price_min: 20, url: SITE, store: { name: 'Sunset Cannabis Co', borough: 'Brooklyn' } },
      { label: 'Pre-roll', clean_name: 'Classic 1g', clean_brand: 'Ayrloom', price_min: 6, url: SITE, store: { name: 'Green Rise', borough: 'Manhattan' } },
      { label: 'Vape', clean_name: 'Sunset Sherbet 0.5g', clean_brand: 'Fernway', price_min: 22, url: SITE, store: { name: 'Astoria Bud Boutique', borough: 'Queens' } },
      { label: 'Edible', clean_name: 'Cherry Pie 2pk', clean_brand: 'Good Tide', price_min: 5, url: SITE, store: { name: 'Bud & Honey', borough: 'Brooklyn' } },
    ],
  }
}

// --- copy helpers --------------------------------------------------------------
const esc = (x) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const money = (n) => (n == null ? '' : `$${Number.isInteger(Number(n)) ? Number(n) : Number(n).toFixed(2)}`)
const fmt = (n) => Number(n).toLocaleString('en-US')

// The same trim the app does to "Brand | Product | Type | Size" names: drop
// the brand, strain and size parts and keep the product.
const STRAIN = /^(true\s+)?(indica|sativa|hybrid|balanced)([- /](dominant|dom|hybrid|indica|sativa))?$|^(cbd|thc|thcv|cbn|cbg|cbc)([\s:/+&-]*(cbd|thc|thcv|cbn|cbg|cbc))*$/i
const SIZE = /^\.?\d+(\.\d+)?\s*(mg|g|oz|ml|pk|pack|ct|pc|pcs)\b.*$|^(single|singles|jar|eighth|quarter|half[- ]ounce|ounce)$/i
const CATEGORY = /^(flower|whole flower|pre-?rolls?|pre rolls?|joints?|blunts?|vapes?|vape pens?|cartridges?|carts?|aio|vape aio|all[- ]in[- ]one|disposables?|pods?|edibles?|gummies|gummy|chocolates?|beverages?|drinks?|concentrates?|tinctures?|topicals?|capsules?|tablets?)$/i
function title(raw, brand) {
  const b = (brand || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const parts = String(raw || '')
    .split('|')
    .map((p) => p.trim())
    .filter((p) => p && p.toLowerCase().replace(/[^a-z0-9]/g, '') !== b && !STRAIN.test(p) && !SIZE.test(p) && !CATEGORY.test(p))
  return parts.join(' · ') || raw || ''
}

// --- the email -----------------------------------------------------------------
// Email clients ignore most CSS, so this is nested tables with inline styles.
// Palette: white field, black ink, grey mist, one green (the line). Helvetica
// Neue with Arial behind it, sentence case, hairline rules: the app on paper.
const FONT = "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;"
const INK = '#0b0b0b'
const MIST = '#6b6b6b'
const LINE = '#dcdcdc'
const GREEN = '#00933c'

function routeLine(stops) {
  // A green bar with a stop per section; the current issue's sections.
  const cells = stops
    .map(
      (s, i) => `<td align="${i === 0 ? 'left' : i === stops.length - 1 ? 'right' : 'center'}" valign="top" style="padding:0;${FONT}font-size:12px;line-height:16px;color:${INK};">
        <div style="width:14px;height:14px;border-radius:7px;background:#ffffff;border:3px solid ${INK};margin:${i === 0 ? '0' : i === stops.length - 1 ? '0 0 0 auto' : '0 auto'};"></div>
        <div style="padding-top:6px;">${esc(s)}</div></td>`,
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;">
    <tr><td style="padding:0 0 0 0;"><div style="height:6px;background:${GREEN};margin:7px 7px 0 7px;"></div></td></tr>
    <tr><td style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:-13px;"><tr>${cells}</tr></table></td></tr>
  </table>`
}

function section(kicker, small) {
  return `<tr><td style="padding:36px 0 0 0;${FONT}font-size:13px;font-weight:700;color:${INK};border-top:2px solid ${INK};">
    ${esc(kicker)} <span style="font-weight:400;color:${MIST};padding-left:8px;">${esc(small)}</span></td></tr>`
}

function dealRow(d) {
  const name = title(d.title, d.description)
  const sub = [d.description, d.store_name, d.store_borough].filter(Boolean).join(' · ')
  return `<tr><td style="padding:0;border-bottom:1px solid ${LINE};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td valign="top" style="padding:14px 12px 14px 0;${FONT}">
        <a href="${esc(d.url || SITE)}" style="color:${INK};text-decoration:none;font-size:16px;font-weight:700;line-height:20px;">${esc(name)}</a>
        <div style="font-size:13px;line-height:18px;color:${MIST};padding-top:2px;">${esc(sub)}</div></td>
      <td valign="top" align="right" nowrap style="padding:14px 0;${FONT}white-space:nowrap;">
        ${d.pct ? `<span style="display:inline-block;background:${INK};color:#ffffff;font-size:12px;font-weight:700;padding:2px 6px;vertical-align:middle;">&minus;${esc(d.pct)}%</span>` : ''}
        ${d.price_was != null ? `<span style="font-size:13px;color:${MIST};text-decoration:line-through;padding-left:8px;vertical-align:middle;">${money(d.price_was)}</span>` : ''}
        <span style="font-size:16px;font-weight:700;color:${INK};padding-left:8px;vertical-align:middle;">${money(d.price)}</span></td>
    </tr></table></td></tr>`
}

function cheapRow(c) {
  const name = title(c.clean_name ?? c.name, c.clean_brand ?? c.brand)
  const sub = [c.clean_brand ?? c.brand, c.store?.name, c.store?.borough].filter(Boolean).join(' · ')
  return `<tr><td style="padding:0;border-bottom:1px solid ${LINE};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td valign="top" width="72" style="padding:14px 12px 14px 0;${FONT}font-size:12px;font-weight:700;color:${MIST};line-height:20px;">${esc(c.label)}</td>
      <td valign="top" style="padding:14px 12px 14px 0;${FONT}">
        <a href="${esc(c.url || SITE)}" style="color:${INK};text-decoration:none;font-size:16px;font-weight:700;line-height:20px;">${esc(name)}</a>
        <div style="font-size:13px;line-height:18px;color:${MIST};padding-top:2px;">${esc(sub)}</div></td>
      <td valign="top" align="right" style="padding:14px 0;${FONT}font-size:16px;font-weight:700;color:${INK};line-height:20px;">${money(c.price_min)}</td>
    </tr></table></td></tr>`
}

function render({ stats, deals, cheapest }, date) {
  const dateStr = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const subject = deals.length
    ? `This week's deals: ${deals[0].pct}% off ${title(deals[0].title, deals[0].description)} and ${deals.length - 1} more`
    : `The weekly drop · ${dateStr}`
  const preheader = `${fmt(stats.in_stock)} items at ${stats.shops} licensed shops. The biggest markdowns this week, and the cheapest of each kind.`
  const stops = ['Deals', 'Cheapest', 'Sensei']

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:28px 16px 48px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td style="padding:0 0 14px 0;border-bottom:1px solid ${LINE};${FONT}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="${FONT}font-size:34px;font-weight:700;letter-spacing:-1.5px;color:${INK};line-height:36px;"><a href="${SITE}" style="color:${INK};text-decoration:none;">Sensei</a></td>
      <td align="right" style="${FONT}font-size:13px;color:${MIST};">The weekly drop<br>${esc(dateStr)}</td>
    </tr></table></td></tr>
  <tr><td style="padding:0;">${routeLine(stops)}</td></tr>
  <tr><td style="padding:30px 0 0 0;${FONT}font-size:28px;font-weight:700;letter-spacing:-1px;line-height:32px;color:${INK};">Every menu. One stop.</td></tr>
  <tr><td style="padding:12px 0 28px 0;${FONT}font-size:16px;line-height:24px;color:${INK};">
    ${fmt(stats.in_stock)} items in stock at ${stats.shops} licensed shops across ${stats.neighborhoods} neighborhoods. Below: the biggest real markdowns on the menu this week, then the cheapest of each kind in the city. Prices are menu prices before tax.</td></tr>

  ${section('Deals', 'biggest markdowns this week')}
  ${deals.length ? deals.map(dealRow).join('') : `<tr><td style="padding:14px 0;${FONT}font-size:14px;color:${MIST};">No markdowns worth a row this week.</td></tr>`}
  <tr><td style="padding:18px 0 0 0;${FONT}font-size:14px;"><a href="${SITE}/#deals" style="color:${INK};font-weight:700;text-decoration:underline;text-underline-offset:3px;">See the live board &rarr;</a></td></tr>

  ${section('Cheapest in the city', 'by product type')}
  ${cheapest.map(cheapRow).join('')}

  <tr><td align="center" style="padding:40px 0 0 0;">
    <a href="${SITE}/?entry=near" style="display:inline-block;background:${INK};color:#ffffff;${FONT}font-size:16px;font-weight:700;padding:14px 22px;text-decoration:none;">Shops near me &rarr;</a></td></tr>

  <tr><td align="center" style="padding:48px 0 0 0;border-top:1px solid ${LINE};margin-top:48px;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:36px;"><tr>
      <td style="width:28px;height:28px;border-radius:14px;background:${GREEN};color:#ffffff;${FONT}font-size:15px;font-weight:700;text-align:center;line-height:28px;">N</td><td width="6"></td>
      <td style="width:28px;height:28px;border-radius:14px;background:#6cbe45;color:#ffffff;${FONT}font-size:15px;font-weight:700;text-align:center;line-height:28px;">Y</td><td width="6"></td>
      <td style="width:28px;height:28px;border-radius:14px;background:#1b5e3a;color:#ffffff;${FONT}font-size:15px;font-weight:700;text-align:center;line-height:28px;">C</td>
    </tr></table></td></tr>
  <tr><td align="center" style="padding:18px 0 0 0;${FONT}font-size:12px;line-height:18px;color:${MIST};">
    <b style="color:${INK};">Sensei</b> is an independent guide for adults 21 and over. Sensei does not sell or deliver cannabis and is not affiliated with any dispensary, delivery service, cultivator, processor, brand, or menu platform.<br><br>
    You get this because you signed up at sensei.nyc. <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:${MIST};">Unsubscribe</a> &middot; <a href="${SITE}/privacy/" style="color:${MIST};">Privacy</a><br>
    Sensei NYC &middot; ${esc(ADDRESS)}</td></tr>
</table></td></tr></table>
</body></html>`

  const text = [
    `SENSEI · The weekly drop · ${dateStr}`,
    '',
    `${fmt(stats.in_stock)} items in stock at ${stats.shops} licensed shops across ${stats.neighborhoods} neighborhoods. Prices are menu prices before tax.`,
    '',
    'DEALS · biggest markdowns this week',
    ...deals.map((d) => `  ${money(d.price)} (was ${money(d.price_was)}, ${d.pct}% off)  ${title(d.title, d.description)} · ${[d.description, d.store_name, d.store_borough].filter(Boolean).join(' · ')}\n    ${d.url || SITE}`),
    `  Live board: ${SITE}/#deals`,
    '',
    'CHEAPEST IN THE CITY · by product type',
    ...cheapest.map((c) => `  ${c.label}: ${money(c.price_min)}  ${title(c.clean_name ?? c.name, c.clean_brand ?? c.brand)} · ${[c.clean_brand ?? c.brand, c.store?.name, c.store?.borough].filter(Boolean).join(' · ')}`),
    '',
    `Shops near me: ${SITE}/?entry=near`,
    '',
    'Sensei is an independent guide for adults 21 and over. Sensei does not sell or deliver cannabis and is not affiliated with any dispensary, delivery service, cultivator, processor, brand, or menu platform.',
    'Unsubscribe: {{{RESEND_UNSUBSCRIBE_URL}}}',
    `Sensei NYC · ${ADDRESS}`,
  ].join('\n')

  return { subject, html, text }
}

const data = await load()
const date = new Date()
const issue = render(data, date)
const out = join(HERE, 'dist')
mkdirSync(out, { recursive: true })
const stem = SAMPLE ? 'sample' : date.toISOString().slice(0, 10)
writeFileSync(join(out, `${stem}.html`), issue.html)
writeFileSync(join(out, `${stem}.txt`), issue.text)
writeFileSync(join(out, `${stem}.json`), JSON.stringify({ subject: issue.subject, deals: data.deals.length, cheapest: data.cheapest.length, lastScrape: data.lastScrape }, null, 2))
console.log(`Built newsletter/dist/${stem}.html (${(issue.html.length / 1024).toFixed(0)} KB)`)
console.log(`Subject: ${issue.subject}`)
console.log(`${data.deals.length} deals · ${data.cheapest.length} cheapest · menu as of ${data.lastScrape ? new Date(data.lastScrape).toDateString() : '?'}`)
