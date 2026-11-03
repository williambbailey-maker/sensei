# /start — ad entry page

A static page at `https://sensei.nyc/start` that paid ads link to instead of the home page. It is a full-screen 21+ check and nothing else. On "Yes" it sends the visitor into the app at `/` with their link tags intact.

Why it exists: Meta's ad review reads the landing page's HTML (title, meta, nav, text), not just what is on screen. The home page's `<title>` and `og:title` say "every licensed cannabis menu in NYC" and its nav links to Edibles. `/start` has none of that. Everything a reviewer reads is exactly what a visitor sees.

## Where it lives

- File: `app/public/start/index.html` (served by Vercel at `/start`, same as `app/public/about/`).
- Static HTML, no React. Generate it from a `build_start()` function in `seo/build.py` so it reuses `CSS` and `analytics_js()`, and write the result to `app/public/start/index.html`. Commit the built file.
- Not in `sitemap.xml`. Not linked from anywhere on the site. Do **not** add `noindex` (site rule 7: no noindex on production).
- Leave the app's existing bottom-sheet gate and the static pages' gate alone. `/start` is in addition to them.

## Head

```html
<title>Sensei — a guide to New York</title>
<meta name="description" content="Sensei is a guide to what's near you in New York. Pick a neighborhood and see what's close.">
<meta property="og:title" content="Sensei — a guide to New York">
<meta property="og:description" content="Sensei is a guide to what's near you in New York. Pick a neighborhood and see what's close.">
<meta property="og:url" content="https://sensei.nyc/start">
<meta property="og:image" content="https://sensei.nyc/start/og.png">
<meta name="theme-color" content="#0B0B0B">
```

- `start/og.png`: new 1200×630 image, `#0B0B0B` field, white "Sensei" wordmark, the three N Y C bullets under it. Do not reuse `/og.png`.
- No JSON-LD.
- Favicon and fonts: same as the other static pages.

## Word rule

The HTML source of `/start` (text, alt text, comments, hrefs, meta, JS strings) must not contain any of: cannabis, THC, CBD, weed, marijuana, edible(s), flower, pre-roll, vape, dispensary, dispensaries, strain, menu, 21+ written as a tag. "21 or older" in the question is fine. Add a check to `build_start()` that asserts none of these words appear in the output and fails the build if one does.

## Design

Subway-sign system, same tokens and classes as `seo/build.py` `CSS`:

- Field `#0B0B0B`, ink `#FFFFFF`, `deep #1E1E1E`, `mist`, `line`, `line-strong`. Sentence case, body tracking −.01em. No radius except circles, no shadows, blur or gradients.
- Full viewport, `min-height: 100dvh`, content vertically centered, 16px side gutters on phones, max-width 560px centered on desktop.

Layout, top to bottom:

1. Header: "Sensei" 42px left, hairline under. No menu.
2. Three line bullets (`.mb`, 44px circles, MTA colors as in the app) reading **N Y C**. Not T H C.
3. `<h1>` "Are you 21 or older?" — 32px.
4. Note, `mist`: "Sensei is for adults 21 and over in New York State."
5. White `.cta` button, full width on phones: "Yes, I'm 21 or older".
6. `.ghost` text link under it: "I'm under 21".
7. 2px `.rule`, then a one-line footer: "Terms · Privacy" linking to `/terms` and `/privacy`.

Tap targets ≥ 48px. Focus "Yes" on load. Tab cycles between the two answers.

## Behavior

- Age key: same `localStorage` key the app uses, `sensei_age_ok` = `'true'`, so the app does not ask again after `/start`.
- On load, if `localStorage.sensei_age_ok === 'true'`: `location.replace('/' + location.search)` immediately. (Returning visitors skip the page. The HTML still contains the gate; only the JS redirects.)
- **Yes**: set the key, fire `age_gate_yes` with `{ variant: 'start' }`, then `location.assign('/' + location.search)`. The query string must pass through unchanged so `utm_*`, `src` and `click_id` reach the app and the `pageviews` row for the app visit keeps its attribution.
- **I'm under 21**: fire `age_gate_no` with `{ variant: 'start' }`, wait 250 ms, then `location.assign('https://www.google.com')`.
- On load fire `age_gate_shown` with `{ variant: 'start' }`.
- Page view: include the same `analytics_js()` snippet the static pages use, with `page_type: 'start'`, so the visit writes a `pageviews` row with `path: '/start'` and the link's `utm_*` tags, and the visitor/session IDs carry into the app.
- `.github/workflows/analytics-check.yml`: add `/start` — open it, answer Yes, confirm the app loads at `/` with the query string preserved and the sheet does not appear.

## After it ships (not Claude Code's job)

The ad's Website URL changes from `https://sensei.nyc/?utm_...` to `https://sensei.nyc/start?utm_...` with the same tags. The ad is a new one, not an edit of A1.
