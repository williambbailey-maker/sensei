# Weekly report (Block 3)

Pulls traffic (PostHog), search (Google Search Console) and pipeline health
(Supabase) into one place, writes it to Supabase so it can be read back on
demand ("what are the stats?"), and emails a short summary on Mondays.

## Why it lives in GitHub Actions

Interactive Claude sessions can't reach PostHog or Google (network policy), but
**GitHub Actions has open internet**, so the job runs there. It stores results
in Supabase, which Claude *can* reach — so asking Claude for the stats works
from anywhere.

## Pieces

- `pull.py` — pulls each source into `out/week.json` (this + prior window).
  Each source is independent; missing credentials just null that section.
- `summarize.py` — Haiku writes a <250-word summary, upserts into Supabase
  `weekly_metrics`, and emails via Resend (Mondays / manual runs only).
- `schema.sql` — the `weekly_metrics` table (already applied to the project).
- `../.github/workflows/report.yml` — runs daily 11:00 UTC (stores), emails Mondays.

## Setup — GitHub repo secrets

Add these at **GitHub → repo Settings → Secrets and variables → Actions → New
repository secret**. The job works with whatever's present and skips the rest,
so you can add them in stages.

| Secret | For | Required? |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | store + read metrics, pipeline health | **Yes** (nothing persists without it) |
| `POSTHOG_API_KEY` | traffic + brand attribution | for traffic |
| `POSTHOG_PROJECT_ID` | " | for traffic |
| `GSC_SA_JSON` | Google search demand (whole service-account JSON) | for search |
| `ANTHROPIC_API_KEY` | the written summary (Haiku) | for the summary text |
| `RESEND_API_KEY` | emailing the report | for email |
| `REPORT_EMAIL_TO` | who gets the email | for email |
| Optional: `POSTHOG_HOST` (default `https://us.posthog.com`), `GSC_SITE_URL` (default `sc-domain:sensei.nyc`), `REPORT_EMAIL_FROM`, `SUPABASE_URL` | — | no |

**Staging suggestion:**
1. `SUPABASE_SERVICE_ROLE_KEY` + `POSTHOG_API_KEY` + `POSTHOG_PROJECT_ID` → traffic + health working.
2. `GSC_SA_JSON` → adds search demand (service-account steps below).
3. `ANTHROPIC_API_KEY` → adds the written summary.
4. `RESEND_API_KEY` + `REPORT_EMAIL_TO` → turns on the Monday email.

Rotate any key that was ever pasted into chat before storing it here.

### Google Search Console service account (`GSC_SA_JSON`)

1. console.cloud.google.com → new project → enable **Search Console API**.
2. APIs & Services → Credentials → Create → **Service account** → create a
   **JSON key**, download it.
3. Search Console → your `sensei.nyc` property → Settings → Users and
   permissions → add the service-account email as **Full**.
4. Paste the entire JSON file contents as the `GSC_SA_JSON` secret.

## Run it

- Automatic: daily at 11:00 UTC (stores), Monday also emails.
- Manual: GitHub → Actions → **Weekly report** → Run workflow (also emails).
- Ask Claude "what are the stats?" any time — it reads the latest
  `weekly_metrics` row from Supabase.
