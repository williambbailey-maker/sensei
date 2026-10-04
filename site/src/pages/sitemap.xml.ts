import type { APIRoute } from 'astro'
import { SEO } from '../lib/site'

// Hand-rolled sitemap so the build has no integration dependency. Lists the
// static hub pages plus every generated template URL.
export const GET: APIRoute = ({ site }) => {
  const base = (site?.href ?? 'https://sensei.nyc/').replace(/\/$/, '')
  const paths = [
    '/',
    ...SEO.dispensaries.map((d: any) => `/dispensaries/${d.slug}`),
    ...SEO.neighborhoods.map((n: any) => `/neighborhoods/${n.slug}`),
    ...SEO.brands.map((b: any) => `/brands/${b.slug}`),
    ...Object.values(SEO.categories).map((c: any) => `/nyc/${c.slug}`),
  ]
  const now = new Date().toISOString().slice(0, 10)
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    paths
      .map((p) => `  <url><loc>${base}${p === '/' ? '' : p}</loc><lastmod>${now}</lastmod></url>`)
      .join('\n') +
    `\n</urlset>\n`
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } })
}
