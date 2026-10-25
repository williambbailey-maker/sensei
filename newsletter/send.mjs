// Send a built issue through Resend.
//
//   node newsletter/send.mjs preview 2026-10-28   # one copy to NEWSLETTER_PREVIEW_TO
//   node newsletter/send.mjs send 2026-10-28      # the audience (a Resend broadcast)
//
// Env (GitHub secrets in the workflow): RESEND_API_KEY, RESEND_AUDIENCE_ID,
// NEWSLETTER_FROM ("Sensei <drop@sensei.nyc>"), NEWSLETTER_PREVIEW_TO.
// `send` first syncs subscribers from Supabase into the Resend audience, which
// needs SUPABASE_SERVICE_ROLE_KEY (the subscribers table is not public).
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const [mode, stem] = process.argv.slice(2)
if (!['preview', 'send'].includes(mode) || !stem) {
  console.error('usage: node newsletter/send.mjs <preview|send> <issue stem, e.g. 2026-10-28>')
  process.exit(2)
}
const KEY = (process.env.RESEND_API_KEY || '').trim()
const FROM = process.env.NEWSLETTER_FROM || 'Sensei <drop@sensei.nyc>'
if (!KEY) {
  console.error('RESEND_API_KEY is not set: nothing sent. The built issue is in newsletter/dist/.')
  process.exit(1)
}
const html = readFileSync(join(HERE, 'dist', `${stem}.html`), 'utf8')
const text = readFileSync(join(HERE, 'dist', `${stem}.txt`), 'utf8')
const { subject } = JSON.parse(readFileSync(join(HERE, 'dist', `${stem}.json`), 'utf8'))

async function resend(path, body, method = 'POST') {
  const r = await fetch(`https://api.resend.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${JSON.stringify(j).slice(0, 300)}`)
  return j
}

if (mode === 'preview') {
  const to = process.env.NEWSLETTER_PREVIEW_TO
  if (!to) {
    console.error('NEWSLETTER_PREVIEW_TO is not set.')
    process.exit(1)
  }
  // A preview is a plain email, so the unsubscribe merge tag would show raw.
  const strip = (s) => s.replace(/\{\{\{RESEND_UNSUBSCRIBE_URL\}\}\}/g, 'https://sensei.nyc/#drop')
  const r = await resend('/emails', { from: FROM, to: [to], subject: `[preview] ${subject}`, html: strip(html), text: strip(text) })
  console.log(`Preview sent to ${to} (${r.id}).`)
} else {
  const audience = process.env.RESEND_AUDIENCE_ID
  if (!audience) {
    console.error('RESEND_AUDIENCE_ID is not set.')
    process.exit(1)
  }
  // Sync subscribers → audience. Resend ignores an email it already has.
  const service = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (service) {
    const url = process.env.SUPABASE_URL || 'https://dywrisybvcorpfhbwgtg.supabase.co'
    const subs = await fetch(`${url}/rest/v1/subscribers?select=email&order=created_at.asc`, {
      headers: { apikey: service, Authorization: `Bearer ${service}` },
    }).then((r) => r.json())
    let added = 0
    for (const s of subs) {
      if (!s.email || !s.email.includes('@')) continue
      await resend(`/audiences/${audience}/contacts`, { email: s.email, unsubscribed: false }).then(() => added++).catch(() => {})
    }
    console.log(`Audience synced: ${subs.length} subscribers in Supabase, ${added} added or confirmed.`)
  } else {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not set: audience not synced, sending to whoever is already in it.')
  }
  const b = await resend('/broadcasts', { audience_id: audience, from: FROM, subject, html, text, name: `Weekly drop ${stem}` })
  await resend(`/broadcasts/${b.id}/send`, {})
  console.log(`Broadcast ${b.id} sent: "${subject}".`)
}
