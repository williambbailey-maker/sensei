// Coarse visitor location for the analytics beacon. Vercel sets these headers
// at the edge; we return them and never store or log the IP.
export const config = { runtime: 'edge' }

export default function handler(req: Request): Response {
  const h = req.headers
  const body = {
    country: h.get('x-vercel-ip-country') || null,
    region: h.get('x-vercel-ip-country-region') || null,
    city: decodeURIComponent(h.get('x-vercel-ip-city') || '') || null,
  }
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
  })
}
