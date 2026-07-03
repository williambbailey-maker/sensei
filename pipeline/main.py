"""Pipeline orchestrator: scrape active stores from the registry into Supabase.

Env:
  SCRAPINGBEE_KEY            required — all fetches go through the unblocker
  SUPABASE_URL               optional (defaults to the project URL)
  SUPABASE_SERVICE_ROLE_KEY  required for writes; without it the run degrades
                             to a dry run automatically
  DRY_RUN                    "true" to scrape + parse but skip all DB writes
  STORE_LIMIT                integer; scrape only the first N stores (after
                             shuffling) — for cheap verification runs
  CATEGORIES                 comma-separated; default "flower"

Behavior per spec: randomized store order, 2-4s randomized delay between
requests, fail-soft per store (one broken store never kills the run). The
GitHub job summary reports per-store outcomes so failures are readable from
a phone.
"""

from __future__ import annotations

import os
import random
import sys
import time
import traceback
from datetime import datetime, timezone

from adapters import dutchie
from fetcher import Fetcher
from sync import Supa


def emit(line: str = "") -> None:
    print(line, flush=True)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")


def main() -> int:
    run_start = datetime.now(timezone.utc).isoformat()
    dry_run = os.environ.get("DRY_RUN", "").lower() in ("1", "true", "yes")
    store_limit = int(os.environ.get("STORE_LIMIT") or 0)
    categories = [
        c.strip() for c in (os.environ.get("CATEGORIES") or "flower").split(",") if c.strip()
    ]

    supa = Supa()
    if not supa.can_write and not dry_run:
        emit("> ⚠️ SUPABASE_SERVICE_ROLE_KEY is not set — degrading to DRY RUN (no DB writes).")
        dry_run = True

    fetcher = Fetcher()
    stores = supa.active_stores()
    random.shuffle(stores)
    if store_limit:
        stores = stores[:store_limit]

    emit(f"# Daily scrape — {'DRY RUN' if dry_run else 'full run'}")
    emit()
    emit(f"Stores: {len(stores)} · Categories: {', '.join(categories)}")
    emit()
    emit("| Store | Status | Products |")
    emit("| --- | --- | --- |")

    stores_ok = 0
    stores_failed = 0
    products_seen = 0
    failures: list[str] = []

    for store in stores:
        slug = store["slug"]
        try:
            store_products: list[dict] = []
            for category in categories:
                store_products.extend(
                    dutchie.scrape_store_category(fetcher, slug, category)
                )
                time.sleep(random.uniform(2, 4))
            if not dry_run:
                supa.upsert_products(store["id"], store_products)
                supa.mark_unseen_out_of_stock(store["id"], run_start)
            stores_ok += 1
            products_seen += len(store_products)
            emit(f"| {slug} | ✅ ok | {len(store_products)} |")
        except Exception as exc:  # noqa: BLE001 — fail soft per store
            stores_failed += 1
            failures.append(f"{slug}: {exc}")
            emit(f"| {slug} | ❌ FAILED | — |")
            print(f"[{slug}] {traceback.format_exc()}", file=sys.stderr)

    render_mode = {None: "n/a", True: "render_js=true", False: "render_js=false"}[fetcher.render_js]
    emit()
    emit(
        f"**Totals:** {stores_ok} ok · {stores_failed} failed · {products_seen} products"
        f" · {fetcher.requests_made} fetches · ~{fetcher.credits_estimate} ScrapingBee credits"
        f" ({render_mode})"
    )
    if failures:
        emit()
        emit("**Failures:**")
        for f in failures:
            emit(f"- {f}")

    if not dry_run:
        notes = f"categories={','.join(categories)}; credits~{fetcher.credits_estimate}"
        if failures:
            notes += "; failed: " + "; ".join(failures)[:500]
        supa.log_run(stores_ok, stores_failed, products_seen, notes)

    # The run "fails" only if nothing succeeded — partial failures are fail-soft.
    return 1 if stores and stores_ok == 0 else 0


if __name__ == "__main__":
    sys.exit(main())
