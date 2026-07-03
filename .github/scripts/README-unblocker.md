# Testing M0 connectivity through a Cloudflare-unblocker API

The M0 gate came back **BLOCKED** on GitHub's hosted runners: Cloudflare returns
`403 "Just a moment..."` because `ubuntu-latest` runs on datacenter IPs that
Dutchie blocks. An **unblocker API** solves the Cloudflare challenge server-side
and hands back the real page HTML — so the job stays on hosted GitHub Actions and
you keep running everything from your phone. No home machine required.

The gate supports **ScraperAPI** or **ScrapingBee**. Pick one (both have free
tiers of ~1,000 requests/month — plenty to prove M0, and ~49 stores/day fits
cheap paid tiers later).

## 1. Get a key (phone-friendly)

- **ScraperAPI** — sign up at scraperapi.com, copy the API key from the dashboard.
- **ScrapingBee** — sign up at scrapingbee.com, copy the API key from the dashboard.

## 2. Add it as a repo secret

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

- ScraperAPI → name it **`SCRAPERAPI_KEY`**
- ScrapingBee → name it **`SCRAPINGBEE_KEY`**

Add just one. The workflow reads whichever is present; if neither is set, the gate
skips the unblocker attempt and behaves as before.

## 3. Run the gate

Actions → **M0 Connectivity Test → Run workflow**. Leave **Runner to test from**
at `ubuntu-latest`. Run.

The gate tries `requests` first (still expected to be BLOCKED), then routes through
the unblocker, then falls back to Playwright. The job summary reports
`METHOD_THAT_WORKED = requests | unblocker | playwright | BLOCKED` and dumps the
first 2KB of HTML.

## 4. Interpreting the result

- **`METHOD_THAT_WORKED = unblocker`** → success. The daily pipeline can fetch
  Dutchie through the unblocker on hosted Actions. Keep an eye on the monthly
  request quota (1 request per store per category page).
- **unblocker row shows `API_ERROR`** → not a Dutchie block; it's a key/quota/plan
  problem with the service. Check the key value and your remaining credits.
- **still `BLOCKED`** → the service's default tier didn't get through. Options:
  enable the provider's premium/"ultra"/JS-rendering mode (a param bump in
  `try_unblocker()`), or fall back to a rotating residential proxy.

## Notes

- The unblocker call is slow (it solves the challenge), so the gate allows up to
  120s for it — normal.
- Rendering is on (`render=true` / `render_js=true`) so the returned HTML is the
  hydrated page containing the embedded product JSON.
