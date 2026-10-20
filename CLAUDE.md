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
  `line`, `line-strong` as the only other tokens), **Barlow Condensed** 600/700
  throughout with Noto Sans JP for the 先生 kanji pair, `body { text-transform:
  uppercase }` except editorial copy, descriptions and inputs. No shadows, blur,
  gradients, rounded cards or colors beyond the six tokens; product images are
  the only color and sit on the field with `mix-blend-mode: multiply`. Devices:
  the masthead (kanji → 96px SENSEI → "A guide to New York" → double-headed arrow
  with a center divider → two three-line columns), `.row` lists with 2px rules
  and a 10px marker circle, 44px circle `.thumb`s, underlined inputs/selects/tabs,
  the `—01—` `.rule`, and exactly one `.dotcta` (poster text + →) per screen with
  everything else a `.ghost` text button. Same system on the SEO pages via
  `seo/build.py` (`CSS`, `AGE_GATE`, `page()`, `build_home()`).

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
