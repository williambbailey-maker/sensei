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
