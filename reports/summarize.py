#!/usr/bin/env python3
"""
Sensei weekly report — summarize, store, email.

Reads reports/out/week.json, asks Haiku for a short fixed-structure summary,
upserts the whole thing into Supabase (weekly_metrics) so it can be read back on
demand ("what are the stats?"), and emails it via Resend if configured.

Storing to Supabase is the important step and always runs. The summary is a
deterministic template by default (no model, no cost); Haiku is used only if
ANTHROPIC_API_KEY is set and the call succeeds. Email is sent if Resend is set.

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

# Tolerate a pasted snippet around the key: keep only the sk-… token.
_k = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_KEY = next((t for t in _k.replace('"', " ").split() if t.startswith("sk-")), _k.strip())
MODEL = os.environ.get("REPORT_MODEL") or "claude-haiku-5-5"

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
    "Pipeline — scrape health: last run and days since, match rate, how many stores are stale (flag loudly if the last run is more than 2 days old).\n"
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
    if not r.ok:
        print(f"Anthropic API {r.status_code}: {r.text[:300]}")
    r.raise_for_status()
    return "".join(b.get("text", "") for b in r.json().get("content", [])).strip()


def _delta(cur, prev):
    if cur is None:
        return "n/a"
    if prev is None:
        return str(cur)
    d = cur - prev
    arrow = "up" if d > 0 else "down" if d < 0 else "flat"
    return f"{cur} ({arrow} from {prev})" if d else f"{cur} (flat)"


def template_summary(m):
    """Deterministic summary from the metrics JSON — no model, no cost, no
    invented numbers. Same six sections the Haiku prompt asks for."""
    t, tp = m.get("traffic") or {}, m.get("traffic_prev") or {}
    s, sp = m.get("search") or {}, m.get("search_prev") or {}
    p = m.get("pipeline") or {}
    w = m.get("window_days", 7)
    out = []

    # Headline
    if t:
        org, orge = t.get("organic_sessions") or 0, t.get("organic_exploratory_sessions") or 0
        rate = f" ({round(100*orge/org)}%)" if org else ""
        out.append(f"HEADLINE\n{orge} of {org} organic sessions took an exploratory action{rate}. "
                   f"Last week: {tp.get('organic_exploratory_sessions') or 0} of {tp.get('organic_sessions') or 0}.")
    else:
        out.append("HEADLINE\nTraffic: not connected.")

    # What moved
    if t:
        lines = [f"- Visitors {_delta(t.get('visitors'), tp.get('visitors'))}; "
                 f"organic {_delta((t.get('by_source') or {}).get('organic', 0), (tp.get('by_source') or {}).get('organic', 0))}, "
                 f"direct {_delta((t.get('by_source') or {}).get('direct', 0), (tp.get('by_source') or {}).get('direct', 0))}."]
        if s:
            lines.append(f"- Google impressions {_delta(s.get('impressions'), sp.get('impressions'))}; clicks {_delta(s.get('clicks'), sp.get('clicks'))}.")
        lines.append(f"- Tap journeys completed: {t.get('journey_completed_sessions') or 0}. "
                     f"Menu clicks {t.get('menu_clicks') or 0}, saves {t.get('saves') or 0}, signups {t.get('signups') or 0}.")
        dev = t.get("devices") or {}
        if dev:
            lines.append(f"- Devices: mobile {dev.get('mobile', 0)}, desktop {dev.get('desktop', 0)}.")
        out.append("WHAT MOVED\n" + "\n".join(lines))

    # Search
    if s:
        tq = s.get("top_queries") or []
        q_lines = "; ".join(f"\"{q['query']}\" {q['clicks']} clicks / {q['impressions']} imp" for q in tq[:3]) or "none"
        pages_clicked = [x for x in (s.get("top_pages") or []) if x.get("clicks")]
        pg = ", ".join(x["page"].replace("https://", "") for x in pages_clicked[:3]) or "none"
        out.append(f"SEARCH\n{s.get('impressions')} impressions, {s.get('clicks')} clicks, "
                   f"CTR {round(100*(s.get('ctr') or 0), 1)}%, avg position {s.get('position')}.\n"
                   f"Top queries: {q_lines}.\nPages earning clicks: {pg}.")
    else:
        out.append("SEARCH\nNot connected.")

    # Brands
    brands = (t.get("brands") or []) if t else []
    if brands:
        b_lines = "\n".join(f"- {b['brand']}: {b['impressions']} imp, {b.get('brand_views', 0)} views, {b['menu_clicks']} menu clicks"
                             for b in brands[:5])
        out.append("BRANDS\n" + b_lines)
    else:
        out.append("BRANDS\nNo brand events this week.")

    # Pipeline
    if p:
        d = p.get("days_since_last_run")
        stale = p.get("stale_stores") or []
        out.append(f"PIPELINE\nLast scrape {str(p.get('last_run') or '')[:10]}"
                   f"{f' ({d} days ago)' if d is not None else ''}. "
                   f"{p.get('in_stock')} in stock, match rate {p.get('match_rate')}%. "
                   f"Stale stores: {len(stale)} of {p.get('active_stores')}.")
    else:
        out.append("PIPELINE\nNot connected.")

    # Flag
    flags = []
    if p and (p.get("days_since_last_run") or 0) > 2:
        flags.append(f"Scraper has not run in {p['days_since_last_run']} days — menus are stale.")
    if p and p.get("stale_stores") and p.get("active_stores") and len(p["stale_stores"]) * 2 > p["active_stores"]:
        flags.append(f"{len(p['stale_stores'])} of {p['active_stores']} stores have no fresh products.")
    if s and (s.get("impressions") or 0) >= 20 and not any(x.get("clicks") for x in (s.get("top_pages") or []) if "/dispensaries/" in x.get("page", "")):
        flags.append("Dispensary pages get impressions but no clicks.")
    errs = m.get("errors") or {}
    if errs:
        flags.append("Sources with errors: " + ", ".join(errs))
    out.append("FLAG\n" + (" ".join(flags) if flags else "Nothing flagged."))

    return f"Sensei weekly — last {w} days\n\n" + "\n\n".join(out)


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
        summary = haiku_summary(metrics)  # optional; only if ANTHROPIC_API_KEY is set
    except Exception as e:  # noqa: BLE001
        print(f"Haiku summary failed: {type(e).__name__}: {str(e)[:160]}")
    if not summary:
        summary = template_summary(metrics)
        print("Using template summary (no model).")
    as_of = datetime.now(timezone.utc).date().isoformat()
    store(as_of, metrics, summary)
    email(summary)
    if summary:
        print("\n--- summary ---\n" + summary)


if __name__ == "__main__":
    main()
