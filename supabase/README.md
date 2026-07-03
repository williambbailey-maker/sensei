# Supabase (database)

Sensei's data lives in a Supabase Postgres database (free tier). These files are
the source of truth for the schema and the store seed.

- **`schema.sql`** — tables (`stores`, `products`, `deals`, `subscribers`,
  `pipeline_runs`) and Row Level Security policies.
- **`seed_stores.sql`** — the ~49 Dutchie store slugs (deduped). Idempotent.

## Which project

Applied to the existing active project on William's account (the free tier allows
2 projects and both slots are in use, so a dedicated project would require freeing
one). The sensei tables coexist with an unrelated task app; the names don't
collide.

## Applying (already done for the current DB)

Via the Supabase SQL editor (dashboard → SQL) or CLI: run `schema.sql` first, then
`seed_stores.sql`. Both are safe to re-run.

## Security model (RLS)

- **anon key** (shipped in the frontend): `SELECT` on `stores`, `products`,
  `deals`; `INSERT`-only on `subscribers` (can add a newsletter email, cannot read
  the list). No access to `pipeline_runs`.
- **service_role key** (pipeline only — a GitHub Actions secret, never in the
  frontend): bypasses RLS, does all writes.

## Keys the app/pipeline need (kept as secrets, not in this repo)

- Frontend (Vercel env): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Pipeline (GitHub Actions secrets): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
