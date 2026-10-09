-- Metrics store for the weekly report (Block 3). Applied to the Supabase project
-- as a migration; kept here version-controlled.
--
-- The reporting job (.github/workflows/report.yml) writes one row per run
-- (daily), each holding the full metrics JSON for a rolling window plus the
-- Haiku-written summary. "Latest stats" = the most recent row; trends = a query
-- across rows. Only the job (service_role, bypasses RLS) touches it.

create table if not exists public.weekly_metrics (
  as_of          date primary key,
  window_days    integer not null default 7,
  metrics        jsonb not null,
  summary        text,
  prompt_version text,
  created_at     timestamptz not null default now()
);
alter table public.weekly_metrics enable row level security;
-- No anon policy on purpose: metrics are internal, not exposed to the public client.
