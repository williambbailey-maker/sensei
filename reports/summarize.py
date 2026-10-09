#!/usr/bin/env python3
"""
Sensei weekly report — summarize, store, email.

Reads reports/out/week.json, asks Haiku for a short fixed-structure summary,
upserts the whole thing into Supabase (weekly_metrics) so it can be read back on
demand ("what are the stats?"), and emails it via Resend if configured.

Storing to Supabase is the important step and always runs; the Haiku summary and
the email are best-effort (skipped if their keys are absent).

Run after pull.py:  python reports/summarize.py
"""
import json
import os
from datetime import date, datetime, timezone
from pathlib import Path

import requests

OUT = Path(__file__).resolve().parent / "out"
PROMPT_VERSION = "2026-10-09.1"

SUPABASE_URL = (os.environ.get("SUPABASE_URL") or "https://dywrisybvcorpfhbwgtg.supabase.co").rstrip("/")
SERVICE = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip()
MODEL = os.environ.get("REPORT_MODEL") or "claude-haiku-4-5"

RESEND_KEY = os.environ.get("RESEND_API_KEY", "").strip()
MAIL_TO = os.environ.get("REPORT_EMAIL_TO", "").strip()
MAIL_FROM = (os.environ.get("REPORT_EMAIL_FROM") or "Sensei <onboarding@resend.dev>").strip()

SYSTEM = (
    "You write Sensei's weekly metrics email. Sensei is an NYC cannabis discovery "
    "site that grows via Google traffic to programmatic pages and sells brand "
    "placement. You are given a JSON metrics object for this week and last week. "
    "Write a plain-text summary UNDER 250 words with exactly these sections, each "
    "one short paragraph or a few bullets:\n"
    "Headline — the single most important number this week (organic sessions with "
    "an exploratory action, if available) and its direction vs last week.\n"
    "What moved — the biggest 2-3 changes week over week.\n"
    "Search — Google clicks/impressions/position and a notable query, if present.\n"
    "Brands — the brands getting the most attention (impressions/views/menu clicks).\n"
    "Pipeline — scrape health: last run, match rate, any stale stores.\n"
    "Flag — one thing to watch, or 'Nothing flagged.'\n\n"
    "RULES: Use ONLY numbers present in the JSON. Never invent or estimate. If a "
    "section's data is null or missing, say so in one short clause (e.g. 'Search: "
    "not connected yet'). No preamble, no sign-off."
)


def haiku_summary(metrics):
    if not ANTHROPIC_KEY:
        return None
    r = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01",
                 "content-type": "application/json"},
        json={"model": MODEL, "max_tokens": 700, "system": SYSTEM,
              "messages": [{"role": "user", "content": json.dumps(metrics, default=str)}]},
        timeout=60,
    )
    r.raise_for_status()
    return "".join(b.get("text", "") for b in r.json().get("content", [])).strip()


def store(as_of, metrics, summary):
    if not SERVICE:
        print("No SUPABASE_SERVICE_ROLE_KEY — skipping store (the report can't be read back).")
        return
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/weekly_metrics?on_conflict=as_of",
        headers={"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}",
                 "Content-Type": "application/json",
                 "Prefer": "resolution=merge-duplicates,return=minimal"},
        json={"as_of": as_of, "window_days": metrics.get("window_days", 7),
              "metrics": metrics, "summary": summary, "prompt_version": PROMPT_VERSION},
        timeout=30,
    )
    r.raise_for_status()
    print(f"Stored weekly_metrics for {as_of}.")


def email(summary):
    # The job stores metrics every day (so stats stay fresh for on-demand reads)
    # but only emails when REPORT_SEND_EMAIL is set — the workflow sets it on
    # Mondays and for manual runs.
    if os.environ.get("REPORT_SEND_EMAIL", "0").lower() not in ("1", "true", "yes"):
        print("Email gated off for this run (not Monday) — stored only.")
        return
    if not (RESEND_KEY and MAIL_TO and summary):
        print("Resend not configured (or no summary) — skipping email.")
        return
    r = requests.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {RESEND_KEY}", "Content-Type": "application/json"},
        json={"from": MAIL_FROM, "to": [x.strip() for x in MAIL_TO.split(",") if x.strip()],
              "subject": f"Sensei weekly — {date.today().isoformat()}", "text": summary},
        timeout=30,
    )
    print("Emailed report." if r.ok else f"Email failed: {r.status_code} {r.text[:160]}")


def main():
    metrics = json.loads((OUT / "week.json").read_text())
    summary = None
    try:
        summary = haiku_summary(metrics)
    except Exception as e:  # noqa: BLE001
        print(f"Haiku summary failed: {type(e).__name__}: {str(e)[:160]}")
    as_of = datetime.now(timezone.utc).date().isoformat()
    store(as_of, metrics, summary)
    email(summary)
    if summary:
        print("\n--- summary ---\n" + summary)


if __name__ == "__main__":
    main()
