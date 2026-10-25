# The weekly drop

The newsletter is generated, not written. Each issue is built from the live
data by `build.mjs`: the deals board (`live_deals`, picked after every
scrape), the cheapest item of each product type, and the headline counts.
`send.mjs` sends it through Resend. `.github/workflows/newsletter.yml` runs
both.

## How a week goes

1. **Wednesday 9:37 ET** the workflow builds the issue and emails a preview
   to you. It refuses to build if the menu is more than 4 days old, so run
   the scraper earlier in the week.
2. Read the preview. If it looks right: GitHub → Actions → **Weekly drop** →
   Run workflow → mode **send**. That syncs subscribers into the Resend
   audience and sends the broadcast. If it doesn't, don't click; nothing goes
   out.

Every run attaches the built HTML and text to the run page, so you can look at
an issue even before Resend is set up.

## One-time setup

1. **Resend**: create an account, add the domain `sensei.nyc` (three DNS
   records at your registrar), create an audience, and make an API key.
2. **GitHub → Settings → Secrets and variables → Actions**:
   - Secrets: `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `NEWSLETTER_PREVIEW_TO`
     (your email), `SUPABASE_SERVICE_ROLE_KEY` (for the subscriber sync; the
     subscribers table is not public).
   - Variables: `NEWSLETTER_FROM` (e.g. `Sensei <drop@sensei.nyc>`),
     `NEWSLETTER_ADDRESS` (a postal address; required on commercial email, a
     P.O. box is fine). Until it is set the footer shows `[MAILING ADDRESS]`.

## Locally

```
SUPABASE_ANON_KEY=... node newsletter/build.mjs      # live data
node newsletter/build.mjs --sample                   # sample data, design check
```

Output lands in `newsletter/dist/` (ignored by git).

## Design

The app on paper: white field, black Helvetica Neue (Arial behind it),
sentence case, the green route line with a stop per section, hairline rules,
rows that match the app's deals board (name, brand · shop · borough, then
−40% ~~$50~~ $30). Tables and inline styles only, because email clients
ignore most CSS.
