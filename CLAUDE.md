# Sensei — project notes

## Design checkpoints

Named, revertable snapshots of the app's visual design. Each checkpoint is a
**git branch** frozen at the production commit where that design shipped, so it
can always be restored cleanly.

- **knicks-design** — branch `knicks-design` (commit `a96e711`). The
  "swatch-poster" system: cream/navy paper (`#F5EFDF` / `#1B2A4A`), royal blue +
  orange as the only accents (Knicks colors), Poppins throughout, 2px ink
  borders, hard offset shadows, and a big **static masthead** (the blue `sensei`
  wordmark with its 3px orange rule). The selection journey renders as
  alternating blue/orange **colorblock swatch blocks** with real store counts.

- **sign-barlow** — branch `sign-barlow`. The "Sign" system: black condensed
  caps on mustard paper (`#F2C230` field / `#141414` ink, with `deep`, `mist`,
  `line`, `line-strong` as the only other tokens; reading surfaces — the app's
  results/detail/cart screens and every SEO page but the home — sit on cream
  `#F7F3EA` with the yellow kept for the action block, footer band and age
  gate), **Barlow Condensed** 600/700
  throughout, `body { text-transform: uppercase }` except editorial copy,
  descriptions and inputs. No shadows, blur,
  gradients, rounded cards or colors beyond the six tokens; product images are
  the only color and sit on the field with `mix-blend-mode: multiply`. Devices:
  the masthead (96px SENSEI → "A guide to New York" → a sentence-case
  description → one line of counts), the numbered "Start here" `.ways` block
  (Near me / Pick a borough / Search in your words / See everything, each a
  full-width row with heavy ink rules and an arrow), `.row` lists with 2px rules
  and a 10px marker circle, 44px circle `.thumb`s, underlined inputs/selects/tabs,
  the `—01—` `.rule`, and exactly one `.dotcta` (poster text + →) per screen with
  everything else a `.ghost` text button. Same system on the SEO pages via
  `seo/build.py` (`CSS`, `AGE_GATE`, `page()`, `build_home()`).

- **subway-sign** — branch `subway-sign`. The "Subway signage" system: white
  Helvetica Neue (Inter fallback) on near-black (`#0B0B0B` field / `#FFFFFF`
  ink, with `deep #1E1E1E`, `mist`, `line`, `line-strong`), sentence case,
  body tracking −.01em, and the eight MTA line colors used only in the `.mb`
  line bullets and the `.route` station lines. Source of truth for the home is
  `design/subway-landing.html`: 10px white `.bar`, `.top` (Sensei · 21+ · New
  York City), `.mark` "Every menu. One stop.", `.lede`, three line bullets
  spelling `T H C`, one white `.cta` per screen ("Shops near me"), `.stats`, 2px `.rule`
  and 1px `.hair`, grey and red `.route` stop lists, the `.notice` box, the
  `.board`, the `.exit` bar and the demo footer. Option A kept the "Start here"
  block (centered 32px title, rows with 40px lettered bullets B / S / E and 2px
  rules; the menu's Find group uses the same letters), the burger menu, the
  three index pages and
  the swipeable product detail (full-height sheet with a spec grid and colored
  effect pills). Hairline `.row` lists, 44px untreated circle `.thumb`s,
  underlined inputs/selects/tabs. No radius except circles, no shadows, blur or
  gradients. Same system on the SEO pages via `seo/build.py`.

### How to revert to a checkpoint

Design lives entirely in `app/` (components, `tailwind.config.js`, `index.css`,
`index.html`). Reverting the look does **not** touch Supabase data or the
scraper. To restore a checkpoint onto `main` without rewriting history:

```
git checkout <checkpoint-branch> -- app/
git commit -m "Revert to <checkpoint-branch>"
git push
```

When the user names a design ("save this as X design"), create a
`git branch X` at the current production commit and push it.
