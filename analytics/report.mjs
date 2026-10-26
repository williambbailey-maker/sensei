// Traffic report: one HTML page for a date range, from traffic_report() in
// Supabase (supabase/traffic.sql). Same definitions every time; see README.md.
//
//   node analytics/report.mjs 2026-10-01 2026-10-31          # needs SUPABASE_SERVICE_ROLE_KEY
//   node analytics/report.mjs --json report.json             # render a saved result
//
// Writes analytics/dist/traffic-<start>_<end>.html (git-ignored).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)

async function load() {
  const j = args.indexOf('--json')
  if (j >= 0) return JSON.parse(readFileSync(args[j + 1], 'utf8'))
  const [start, end] = args
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '') || !/^\d{4}-\d{2}-\d{2}$/.test(end || '')) {
    console.error('usage: node analytics/report.mjs <start YYYY-MM-DD> <end YYYY-MM-DD>  |  --json <file>')
    process.exit(2)
  }
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!key) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set (the report is owner-only).')
    process.exit(1)
  }
  const url = process.env.SUPABASE_URL || 'https://dywrisybvcorpfhbwgtg.supabase.co'
  const r = await fetch(`${url}/rest/v1/rpc/traffic_report`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ start_day: start, end_day: end }),
  })
  if (!r.ok) throw new Error(`traffic_report: ${r.status} ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

const CHANNEL = {
  meta_ad: ['Meta ads', '#0062CF'],
  search: ['Search (Google etc.)', '#00933C'],
  social: ['Social, not an ad', '#FF6319'],
  tagged_other: ['Other tagged links', '#B933AD'],
  untagged: ['Untagged', '#808183'],
}
const esc = (x) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '—')
const fmtDay = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

function render(r) {
  const t = r.totals
  const clicks = t.menu_clicks + t.directions_clicks + t.order_clicks + t.deal_clicks
  const ch = r.by_channel
  const maxDay = Math.max(1, ...r.by_day.map((d) => d.visits))
  const order = ['meta_ad', 'search', 'social', 'tagged_other', 'untagged']
  const pc = r.place_by_connection, pt = r.place_by_timezone
  const located = (pc.nyc || 0) + (pc.ny_state || 0) + (pc.elsewhere || 0)
  const tzKnown = (pt.eastern || 0) + (pt.other || 0)
  const since = r.fields_since

  const tile = (n, label, sub = '') => `<div class="tile"><div class="n">${esc(n)}</div><div class="l">${esc(label)}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ''}</div>`
  const bar = (d) => order.map((k) => (d[k] ? `<span style="width:${(100 * d[k]) / maxDay}%;background:${CHANNEL[k][1]}" title="${esc(CHANNEL[k][0])}: ${d[k]}"></span>` : '')).join('')

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sensei traffic · ${esc(r.range.start)} to ${esc(r.range.end)}</title>
<style>
:root{--field:#0B0B0B;--deep:#1E1E1E;--ink:#fff;--mist:rgba(255,255,255,.62);--line:rgba(255,255,255,.16)}
*{box-sizing:border-box}body{margin:0;background:var(--field);color:var(--ink);font:16px/1.5 "Helvetica Neue",Helvetica,Inter,Arial,sans-serif;letter-spacing:-.01em}
.page{max-width:880px;margin:0 auto;padding:36px 16px 72px}
h1{font-size:clamp(34px,7vw,52px);letter-spacing:-.045em;line-height:1;margin:6px 0 0}
.k{font-size:13px;font-weight:700;color:var(--mist);margin:0}
h2{font-size:13px;font-weight:700;margin:44px 0 12px;padding-top:18px;border-top:2px solid var(--ink)}
.note{color:var(--mist);font-size:14px;margin:8px 0 0}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);margin-top:24px}
.tile{background:var(--field);padding:16px}.tile .n{font-size:32px;font-weight:700;letter-spacing:-.03em}.tile .l{font-size:13px;font-weight:700}.tile .s{font-size:12px;color:var(--mist)}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:right;padding:9px 0 9px 12px;border-bottom:1px solid var(--line);white-space:nowrap}
th{font-size:12px;color:var(--mist);font-weight:400}th:first-child,td:first-child{text-align:left;padding-left:0;white-space:normal}
.dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:8px;vertical-align:0}
.days td.b{width:55%}.days td:first-child{white-space:nowrap}.bar{display:flex;height:12px;background:var(--deep)}.bar span{display:block;height:100%}
.legend{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;color:var(--mist);margin-top:10px}
.scroll{overflow-x:auto}
.two{display:grid;grid-template-columns:1fr 1fr;gap:24px}@media(max-width:640px){.two{grid-template-columns:1fr}}
ul.def{padding-left:18px;color:var(--mist);font-size:14px}ul.def b{color:var(--ink)}
</style></head><body><main class="page">
<p class="k">Sensei traffic report</p>
<h1>${esc(fmtDay(r.range.start))} – ${esc(fmtDay(r.range.end))}</h1>
<p class="note">Visits by real people only: your own marked devices (${t.excluded_internal}) and probable automated visits (${t.excluded_suspect}) are left out and counted at the bottom. Days are Eastern time.</p>

<div class="tiles">
${tile(t.visits, 'Visits', `${t.people} different people`)}
${tile(pct(t.engaged_visits, t.visits), 'Did something', `${t.engaged_visits} of ${t.visits} visits went past the first screen`)}
${tile(clicks, 'Clicks out', `${t.menu_clicks} menu · ${t.directions_clicks} directions · ${t.order_clicks} order · ${t.deal_clicks} deal`)}
${tile(t.pageviews, 'Pages viewed')}
</div>

<h2>Where visits came from</h2>
<div class="scroll"><table>
<tr><th>Channel</th><th>Visits</th><th>People</th><th>Did something</th><th>Clicks out</th><th>On a phone</th><th>In NYC*</th></tr>
${ch.map((c) => `<tr><td><span class="dot" style="background:${(CHANNEL[c.channel] || ['', '#808183'])[1]}"></span>${esc((CHANNEL[c.channel] || [c.channel])[0])}</td><td>${c.visits}</td><td>${c.people}</td><td>${pct(c.engaged, c.visits)}</td><td>${c.clicks}</td><td>${pct(c.mobile, c.visits)}</td><td>${c.visits - c.place_unknown ? `${pct(c.nyc, c.visits - c.place_unknown)}` : '—'}</td></tr>`).join('')}
</table></div>
<p class="note">* Share of the visits we could locate. Location from the connection started ${esc(since.location ?? '—')}; before that it's unknown.</p>

<h2>By day</h2>
<div class="scroll"><table class="days">
<tr><th>Day</th><th>Visits</th><th>Did something</th><th></th></tr>
${r.by_day.map((d) => `<tr><td>${esc(fmtDay(d.day))}</td><td>${d.visits}</td><td>${d.engaged}</td><td class="b"><div class="bar">${bar(d)}</div></td></tr>`).join('')}
</table></div>
<div class="legend">${order.map((k) => `<span><span class="dot" style="background:${CHANNEL[k][1]}"></span>${esc(CHANNEL[k][0])}</span>`).join('')}</div>

<h2>Where visitors are</h2>
<div class="two"><div>
<p class="k">By connection</p>
<table>
<tr><td>New York City</td><td>${pc.nyc || 0}</td><td>${pct(pc.nyc || 0, located)}</td></tr>
<tr><td>Elsewhere in New York State</td><td>${pc.ny_state || 0}</td><td>${pct(pc.ny_state || 0, located)}</td></tr>
<tr><td>Outside New York</td><td>${pc.elsewhere || 0}</td><td>${pct(pc.elsewhere || 0, located)}</td></tr>
<tr><td>Not recorded</td><td>${pc.unknown || 0}</td><td></td></tr>
</table>
<p class="note">Recorded since ${esc(since.location ?? '—')}. Phone carriers can place a connection in the wrong city, so read it with the time zone.</p>
</div><div>
<p class="k">By the device's own time zone</p>
<table>
<tr><td>Eastern (New York's)</td><td>${pt.eastern || 0}</td><td>${pct(pt.eastern || 0, tzKnown)}</td></tr>
<tr><td>Another time zone</td><td>${pt.other || 0}</td><td>${pct(pt.other || 0, tzKnown)}</td></tr>
<tr><td>Not recorded</td><td>${pt.unknown || 0}</td><td></td></tr>
</table>
<p class="note">Recorded since ${esc(since.timezone ?? '—')}. Set by the phone itself, so a carrier can't fake it; Eastern also covers Florida to Maine.</p>
</div></div>
${r.top_cities.length ? `<p class="k" style="margin-top:20px">Top cities</p><table>${r.top_cities.map((c) => `<tr><td>${esc(c.city)}, ${esc(c.region)}</td><td>${c.visits}</td></tr>`).join('')}</table>` : ''}

<h2>Meta ads</h2>
${r.meta_campaigns.length ? `<div class="scroll"><table>
<tr><th>Campaign</th><th>Ad</th><th>Visits</th><th>Did something</th><th>Clicks out</th></tr>
${r.meta_campaigns.map((m) => `<tr><td>${esc(m.campaign)}</td><td style="text-align:left">${esc(m.ad || '—')}</td><td>${m.visits}</td><td>${pct(m.engaged, m.visits)}</td><td>${m.clicks}</td></tr>`).join('')}
</table></div>` : '<p class="note">No Meta ad visits in this range.</p>'}
<p class="note">Campaign and ad names are recorded since ${esc(since.link_tags ?? 'the next tagged click')}. Earlier ad visits show as "(untagged campaign)".</p>

<h2>Where people landed</h2>
<table><tr><th>Page</th><th>Visits</th><th>Did something</th></tr>
${r.landing_pages.map((l) => `<tr><td>${esc(l.landing)}</td><td>${l.visits}</td><td>${pct(l.engaged, l.visits)}</td></tr>`).join('')}
</table>

<h2>Left out of the numbers above</h2>
<table>
<tr><td>Your own marked devices (?me=1)</td><td>${t.excluded_internal}</td></tr>
<tr><td>Probable automated visits</td><td>${t.excluded_suspect}</td></tr>
</table>
${Object.keys(r.suspect_by_day).length ? `<p class="note">Automated, by day: ${Object.entries(r.suspect_by_day).map(([d, n]) => `${esc(fmtDay(d))}: ${n}`).join(' · ')}</p>` : ''}

<h2>How to read this</h2>
<ul class="def">
<li><b>Visit</b>: one browser tab's time on the site. <b>People</b>: different devices.</li>
<li><b>Did something</b>: tapped, searched, scrolled to products or opened anything after landing.</li>
<li><b>Clicks out</b>: a shop's menu, directions, "Order at" in the cart, or a deal.</li>
<li><b>Meta ads</b>: links tagged as a Meta ad. <b>Search</b>: arrived from Google, Bing etc. <b>Social</b>: from Instagram or Facebook without an ad tag. <b>Untagged</b>: no tag and no referring site (typed in, a bookmark, or an app that hides where it came from).</li>
<li><b>Probable automated</b>: untagged, on a computer, one page, no referring site, did nothing, and (when located) at a data centre. Headless browsers are no longer recorded at all.</li>
<li>Visits recorded since ${esc(since.visits ?? '—')}. Other fields started later (dates noted beside each).</li>
</ul>
</main></body></html>`
}

const r = await load()
const out = join(HERE, 'dist')
mkdirSync(out, { recursive: true })
const file = join(out, `traffic-${r.range.start}_${r.range.end}.html`)
writeFileSync(file, render(r))
console.log(`Wrote ${file}`)
console.log(`${r.totals.visits} visits · ${r.totals.people} people · ${r.totals.engaged_visits} did something · excluded ${r.totals.excluded_internal} internal, ${r.totals.excluded_suspect} automated`)
