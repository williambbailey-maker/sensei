# Sensei — Subway signage redesign

Implement the subway-signage design across the Sensei surface — the React PWA in `app/`, the age gate, and the 108 static pages built by `seo/build.py` — and push it. Logic, data, analytics and routing do not change; this is a visual layer swap. Design lives only in `app/src/**`, `app/index.html`, `app/tailwind.config.js`, `app/public/favicon.svg`, and the `CSS` / `AGE_GATE` / `page()` / `pcard()` / `build_home()` parts of `seo/build.py`.

**Source of truth for the home page is `design/subway-landing.html`.** The SEO home at `/` must match it one-for-one in structure, copy, spacing and weights, with live numbers substituted. The app home reuses the same hero. Do not improve on it.

Branch `subway-sign` from `main`. Commit app and SEO separately. Push, open a PR titled "Subway signage redesign", then merge to `main` so Vercel deploys. The site is private; a visible regression is acceptable, a broken build is not. Real MTA line letters and colors are intended.

## 1. Tokens
| Token | Value | Use |
|---|---|---|
| `field` | `#0B0B0B` | page background |
| `deep` | `#1E1E1E` | image placeholders, option backgrounds, scrim |
| `ink` | `#FFFFFF` | all type, rules, CTA bar, marker |
| `mist` | `rgba(255,255,255,.6)` | secondary type |
| `line` | `rgba(255,255,255,.16)` | 1px hairlines |
| `line-strong` | `rgba(255,255,255,.4)` | input underlines |

Line-bullet colors (only in `.mb` and `.route`): red `#EE352E`, green `#00933C`, blue `#0039A6`, yellow `#FCCC0A` (text `#111`), orange `#FF6319`, grey `#A7A9AC`, purple `#B933AD`, light green `#6CBE45`. No other color. No radius except circles. No shadows, blur, gradients. Product images untreated.
`<meta name="theme-color" content="#0B0B0B">`, `color-scheme: dark`. Favicon: 64×64 SVG, `#0B0B0B` square, 10px white bar across the top, 20px-radius `#EE352E` circle centered.

## 2. Type
`font-family: "Helvetica Neue", Helvetica, Inter, Arial, sans-serif`; load Inter 400/500/700 from Google Fonts as fallback. Body `letter-spacing:-0.01em`. Sentence case everywhere.
| Class | Spec |
|---|---|
| `.mark` | hero headline. `clamp(64px,19vw,88px)` / 700 / lh .9 / tracking −.05em / left |
| `.lede` | 21px / 400 / lh 1.3 / tracking −.015em / max-width 22ch |
| `.poster` | screen titles. 32px / 700 / tracking −.03em / lh 1 / left |
| `.label` | row titles. 17px (19px in route stops) / 700 / tracking −.02em |
| `.meta` | 13px / 400 / mist |
| `.ghost` | quiet text buttons. 14px / 400 / mist, ink on hover |
| `.k` | section kicker. 13px / 700; optional `<small>` 12px/400 mist, 10px left margin |
| `.stat-v` / `.stat-k` | 40px/700 tracking −.05em ink over 13px/400 mist, 3-col `.stats` grid, gap 18px |

## 3. Devices (exactly as in subway-landing.html)
- `.bar`: 10px white strip at the top of every screen/page, sticky at `top:env(safe-area-inset-top)`.
- `.top`: "Sensei" 14px/700 left, "21+ · New York City" 14px/400 mist right, 22px below the bar.
- `.rule`: 2px white, full width, 40px top margin. `.hair`: 1px line.
- `.cta`: white bg, `#111` text, 18px/20px padding, 19px/700 tracking −.025em, label left, 26px/400 `→` right, full width. `.cta.ghost`: transparent, 2px white border, white text. One white CTA per screen; everything else `.ghost`.
- `.mb`: 40px circle, 21px/700 tracking −.03em white (`#111` on yellow). Hero row: `1 A 6 L N F`. In lists: 30px bullets with the shop's initial, colors cycling through the palette.
- `.route`: 6px colored vertical line (`--line-color`) at left; each `.stop` is a row (`.label` name, `.meta` count right, 13px vertical padding) with a 14px white station dot (3px field border + 2px white ring) on the line; `.stop.xfer` 18px dot. Grey line first group, red second.
- `.notice`: 2px white border, 18/20px padding, 16px/700 heading, list with 26px white circles holding `#111` numerals, hairlines between, 15px/400 text.
- `.board`: 2px white top rule; rows 13px padding, 16px/700 name, 13px/400 mist count right, hairlines between.
- `.exit`: 2px rules top and bottom, 16px padding, "↑ Exit to menus" 15px/700 left, "Updated nightly at 2 a.m." 15px/400 mist right.
- Footer: 12px/400 mist, lh 1.6, **Sensei** in white.
Column: max-width 520px (560 at ≥700px), 28px side padding, 60px bottom.

## 4. SEO home (`build_home()`)
Reproduce subway-landing.html verbatim, substituting: stats = `len(SITE['dispensaries'])`, `sum(c['in_stock'] for c in SITE['categories'])` as `37k`-style, `len(SITE['neighborhoods'])`; first route group "Downtown & Brooklyn" (`most shops`) = top five from `TOP_HOODS` in lower Manhattan or Brooklyn, second "Uptown & Queens" = next four elsewhere, each linking to its neighborhood page, two highest as `.xfer`; board = top five brands from `SITE['brands']` by shop count linking to brand pages; both CTAs to `{APP}/`, "Shops near me" with `?near=1`. Keep JSON-LD, analytics, robots, sitemap. Rebuild and commit `seo/dist`.

## 5. Other SEO pages
Re-style existing builders with these tokens/devices; keep data logic. Header everywhere: `.bar` then `.top` (right side `21+ · {borough or NYC}`). `h1`→`.poster` 32px; `.eyebrow`→`.k`; `.crumb`→`.meta`; `.lede` 17px. Product cards→`.row` with 44px circular `.thumb` (`#1E1E1E`, 1px line border, cover), `.label` name, `.meta` brand · size · THC · type, `.label` price; no emoji fallback. Shop lists→row with 30px `.mb` initial, name, `.meta` street · count, distance/hours right. Chips→`.tab`/`.tab.on` in a scrolling row, hidden scrollbar. `.bars`→hairline rows with 2px track and white fill; `.xgrid/.xl`→two-column spec grid (11px mist key over 17px/700 value, hairline under); `.faq .qa`→hairline `<details>` with `+`/`–`; `.know li`→`→` prefixed 15px lines. Age gate: `.bar`, `.top`, `.mark` "Are you 21 or older?", `.lede` "Cannabis products are for adults 21 and over in New York State.", `.cta` "Yes, I'm 21 or older", `.ghost` "I'm under 21"; keep the sessionStorage script.

## 6. App screens (`app/src`)
Keep all props, state, effects, Supabase calls, `track()` events. Replace classes/markup only.
- App.tsx: `.bar`+`.top` sticky header ("Sensei" restarts journey). Cart banner → one `.row` with `.meta` text and two `.ghost` actions. Home: hero exactly as demo (`.mark` "Every menu. One stop.", `.lede`, six bullets, `.cta` "Shops near me" → journey location step, `.stats`), then SmartSearch, TapJourney. Footer: `.exit`, demo footer text, build id 11px mist.
- IntroSlice: keep animation; field bg, white word 700 `clamp(4rem,20vw,9rem)` tracking −.05em, white glow .6.
- AgeGate: as §5.
- SmartSearch: underlined input (line-strong, white on focus), 17px/400 left, placeholder mist; `.ghost` "Go"; `.meta` hint.
- TapJourney: `.ghost` Back/Home · `.meta` `01 / 05` · `.ghost` See all. Titles as `.poster` ("Where are you", "Where in Brooklyn", "What are you after", "Which strain", "How much", "Your budget"), `.meta` hint, options as `.row` with `.disc` marker (filled when selected) and `.label`; counts `.meta` right. Location = `.cta`. Skip = `.ghost`.
- Results: `.ghost` bar; `.poster` location; `.meta` "N matches · open now"; RefineBar as `.sel`; FilterChips as `.tab.on`; product rows; empty `.poster` "Nothing matched" + 17px `.lede`; loading `.meta` "Pulling live menus".
- ProductCard: row `.thumb` · (`.label` name / `.meta` brand · size · thc · type / `.meta` store · hood · distance) · `.label` price. Detail: full-height sheet, bg field, no radius: `.top` with category + `.ghost` Close; green 10px dot + "In stock · updated last night" 13px/500; `.poster` name; `.meta` brand; two-column grid Price / Size / THC / Type / Also at N shops / Lowest nearby; description 15px/400 lh 1.55; effects as 30px pills (orange, blue, yellow); `.cta` "View on Dutchie"; `.ghost` "Add to cart".
- CartView: `.ghost` bar, `.poster` store, `.meta` count · total, rows with `.thumb` and `− n +` as `.ghost`, `.cta` "Order at {store}", 13px disclaimer.
- Deals: `.rule`, `.k` "Worth a look", `.board` rows. Newsletter: underlined input + `.ghost` "Join".
Delete unused classes and old color names; `tailwind.config.js` colors = the six tokens only.

## 7. Acceptance
- `npm --prefix app run build` clean; `python seo/build.py` reports 108 pages.
- `grep -rE "F2C230|14214A|Harajuku|Barlow|Poppins|rounded-(sm|md|lg|xl|2xl|3xl)|shadow-|backdrop-blur" app/src app/index.html app/tailwind.config.js seo/build.py` returns nothing.
- `seo/dist/index.html` at 390px matches `design/subway-landing.html` apart from live data.
- One white CTA per screen; one `.bar` per page; hairlines 1px, rules 2px.
- Product images are 44px circles; missing → empty `#1E1E1E` circle.
- Add **subway-sign** to CLAUDE.md design checkpoints.
- Pushed, PR merged to main, Vercel green. Report URL and commit hash.
