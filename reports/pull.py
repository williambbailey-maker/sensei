#!/usr/bin/env python3
"""
Sensei weekly report — data pull.

Pulls three sources into reports/out/week.json:
  - PostHog (traffic + behavior + brand attribution)   via query API / HogQL
  - Google Search Console (search demand)              via service account
  - Supabase (pipeline health + inventory)             via REST

Each source is independent and optional: if its credentials aren't set, that
section is null and the rest still runs. Reads config from env (see
reports/README.md). Writes the current window and the prior window for deltas.

Run: python reports/pull.py            (default 7-day window)
     WINDOW_DAYS=28 python reports/pull.py
"""
import json
import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import requests

OUT = Path(__file__).resolve().parent / "out"
WINDOW = int(os.environ.get("WINDOW_DAYS", "7"))

SUPABASE_URL = (os.environ.get("SUPABASE_URL") or "https://dywrisybvcorpfhbwgtg.supabase.co").rstrip("/")
SERVICE = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

PH_KEY = os.environ.get("POSTHOG_API_KEY", "").strip()
PH_PID = os.environ.get("POSTHOG_PROJECT_ID", "").strip()
PH_HOST = (os.environ.get("POSTHOG_HOST") or "https://us.posthog.com").rstrip("/")

GSC_JSON = os.environ.get("GSC_SA_JSON", "").strip()
GSC_SITE = (os.environ.get("GSC_SITE_URL") or "sc-domain:sensei.nyc").strip()

EXPLORATORY = ("product_view", "compare_view", "brand_view", "save", "chip_tap")


# ---------- PostHog ----------------------------------------------------------
def hogql(query):
    r = requests.post(
        f"{PH_HOST}/api/projects/{PH_PID}/query/",
        headers={"Authorization": f"Bearer {PH_KEY}", "Content-Type": "application/json"},
        json={"query": {"kind": "HogQLQuery", "query": query}},
        timeout=60,
    )
    r.raise_for_status()
    return r.json().get("results", [])


def posthog_window(days_ago_start, days_ago_end):
    """Traffic + behavior + brands for the window [start, end) days ago."""
    if not (PH_KEY and PH_PID):
        return None
    where = f"timestamp >= now() - interval {days_ago_start} day and timestamp < now() - interval {days_ago_end} day"
    totals = hogql(
        f"select count(distinct person_id) as visitors, "
        f"countIf(event='$pageview') as pageviews, "
        f"count(distinct properties.$session_id) as sessions "
        f"from events where {where}"
    )
    v, pv, ss = (totals[0] if totals else [0, 0, 0])
    by_source = hogql(
        f"select properties.source as source, count(distinct properties.$session_id) as sessions "
        f"from events where {where} and event='$pageview' group by source order by sessions desc"
    )
    org_sessions = hogql(
        f"select count(distinct properties.$session_id) from events where {where} and properties.source='organic'"
    )
    org_explore = hogql(
        f"select count(distinct properties.$session_id) from events where {where} "
        f"and properties.source='organic' and event in {EXPLORATORY}"
    )
    top_pages = hogql(
        f"select properties.$pathname as path, count() as views from events "
        f"where {where} and event='$pageview' group by path order by views desc limit 10"
    )
    brands = hogql(
        f"select properties.brand as brand, "
        f"countIf(event='product_impression') as impressions, "
        f"countIf(event='brand_view') as brand_views, "
        f"countIf(event='menu_click') as menu_clicks "
        f"from events where {where} and properties.brand is not null and properties.brand != '' "
        f"group by brand order by impressions desc limit 15"
    )
    org = org_sessions[0][0] if org_sessions else 0
    orge = org_explore[0][0] if org_explore else 0
    return {
        "visitors": v, "pageviews": pv, "sessions": ss,
        "by_source": {row[0] or "unknown": row[1] for row in by_source},
        "organic_sessions": org,
        "organic_exploratory_sessions": orge,
        "organic_exploratory_rate": round(orge / org, 3) if org else None,
        "top_pages": [{"path": row[0], "views": row[1]} for row in top_pages],
        "brands": [
            {"brand": row[0], "impressions": row[1], "brand_views": row[2], "menu_clicks": row[3]}
            for row in brands
        ],
    }


# ---------- Google Search Console --------------------------------------------
def gsc_window(start_days_ago, end_days_ago):
    if not GSC_JSON:
        return None
    from google.oauth2 import service_account
    from google.auth.transport.requests import AuthorizedSession

    creds = service_account.Credentials.from_service_account_info(
        json.loads(GSC_JSON), scopes=["https://www.googleapis.com/auth/webmasters.readonly"]
    )
    sess = AuthorizedSession(creds)
    end = date.today() - timedelta(days=end_days_ago)
    start = date.today() - timedelta(days=start_days_ago)

    def q(dimensions, limit=10):
        r = sess.post(
            f"https://searchconsole.googleapis.com/webmasters/v3/sites/{requests.utils.quote(GSC_SITE, safe='')}/searchAnalytics/query",
            json={"startDate": start.isoformat(), "endDate": end.isoformat(),
                  "dimensions": dimensions, "rowLimit": limit},
            timeout=60,
        )
        r.raise_for_status()
        return r.json().get("rows", [])

    totals = q([], limit=1)
    t = totals[0] if totals else {}
    return {
        "clicks": round(t.get("clicks", 0)),
        "impressions": round(t.get("impressions", 0)),
        "ctr": round(t.get("ctr", 0), 4),
        "position": round(t.get("position", 0), 1),
        "top_queries": [
            {"query": r["keys"][0], "clicks": round(r["clicks"]), "impressions": round(r["impressions"])}
            for r in q(["query"])
        ],
        "top_pages": [
            {"page": r["keys"][0], "clicks": round(r["clicks"])} for r in q(["page"])
        ],
    }


# ---------- Supabase pipeline health -----------------------------------------
def sb_count(path):
    r = requests.head(
        f"{SUPABASE_URL}/rest/v1/{path}{'&' if '?' in path else '?'}select=id",
        headers={"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}",
                 "Prefer": "count=exact", "Range": "0-0"},
        timeout=30,
    )
    total = (r.headers.get("content-range") or "").split("/")[-1]
    return int(total) if total.isdigit() else 0


def sb_get(path):
    r = requests.get(f"{SUPABASE_URL}/rest/v1/{path}",
                     headers={"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}"}, timeout=30)
    r.raise_for_status()
    return r.json()


def pipeline_health():
    if not SERVICE:
        return None
    runs = sb_get("pipeline_runs?select=ran_at,stores_ok,stores_failed,products_seen,products_tagged,notes&order=ran_at.desc&limit=1")
    last = runs[0] if runs else {}
    in_stock = sb_count("products?in_stock=eq.true")
    matched = sb_count("products?in_stock=eq.true&clean_brand=not.is.null")
    cutoff = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
    fresh = {r["store_id"] for r in sb_get(f"products?last_seen=gte.{cutoff}&select=store_id")}
    active = sb_get("stores?active=eq.true&select=slug,id")
    stale = [s["slug"] for s in active if s["id"] not in fresh]
    return {
        "last_run": last.get("ran_at"),
        "stores_ok": last.get("stores_ok"),
        "stores_failed": last.get("stores_failed"),
        "products_seen": last.get("products_seen"),
        "in_stock": in_stock,
        "match_rate": round(100 * matched / in_stock, 1) if in_stock else None,
        "active_stores": len(active),
        "stale_stores": stale,
    }


def safe(fn, *a):
    try:
        return fn(*a), None
    except Exception as e:  # noqa: BLE001 — one bad source shouldn't kill the report
        return None, f"{fn.__name__}: {type(e).__name__}: {str(e)[:160]}"


def main():
    errors = {}
    traffic, errors["posthog"] = safe(posthog_window, WINDOW, 0)
    traffic_prev, _ = safe(posthog_window, WINDOW * 2, WINDOW)
    search, errors["gsc"] = safe(gsc_window, WINDOW + 3, 3)  # GSC lags ~3 days
    search_prev, _ = safe(gsc_window, WINDOW * 2 + 3, WINDOW + 3)
    pipeline, errors["supabase"] = safe(pipeline_health)

    metrics = {
        "window_days": WINDOW,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "traffic": traffic,
        "traffic_prev": traffic_prev,
        "search": search,
        "search_prev": search_prev,
        "pipeline": pipeline,
        "sources_ok": {
            "posthog": traffic is not None,
            "gsc": search is not None,
            "supabase": pipeline is not None,
        },
        "errors": {k: v for k, v in errors.items() if v},
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "week.json").write_text(json.dumps(metrics, indent=2, default=str))

    # Headline numbers to the log (so an on-demand run surfaces them directly).
    print("=== SENSEI REPORT HEADLINE ===")
    print(json.dumps({"sources_ok": metrics["sources_ok"], "errors": metrics["errors"]}, indent=2))
    t = traffic or {}
    if traffic:
        print(f"TRAFFIC ({WINDOW}d): visitors={t.get('visitors')} pageviews={t.get('pageviews')} "
              f"sessions={t.get('sessions')} by_source={t.get('by_source')} "
              f"organic_exploratory_rate={t.get('organic_exploratory_rate')}")
        print(f"TOP PAGES: {t.get('top_pages')}")
        print(f"TOP BRANDS: {t.get('brands')}")
    if search:
        print(f"SEARCH ({WINDOW}d): clicks={search.get('clicks')} impressions={search.get('impressions')} "
              f"ctr={search.get('ctr')} position={search.get('position')}")
        print(f"TOP QUERIES: {search.get('top_queries')}")
    if pipeline:
        print(f"PIPELINE: {pipeline}")
    print("=== END HEADLINE ===")


if __name__ == "__main__":
    main()
