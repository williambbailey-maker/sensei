import type { APIRoute } from 'astro'

export const GET: APIRoute = ({ site }) => {
  const base = (site?.href ?? 'https://sensei.nyc/').replace(/\/$/, '')
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`
  return new Response(body, { headers: { 'Content-Type': 'text/plain' } })
}
