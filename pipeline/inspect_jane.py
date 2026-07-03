"""Diagnostic v2: confirm Jane free path end-to-end.

v1 proved iheartjane.com/api/v1/stores is free-reachable and extracted the public
Algolia creds. Now: pull the store directory, count NY stores, and query Algolia
for one NY store's products to confirm coverage + product shape. All free, no
unblocker. Throwaway.
"""

from __future__ import annotations

import json
import os

import requests

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
H = {"User-Agent": UA, "Accept": "application/json,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9"}

ALGOLIA_APP = "VFM4X0N23A"
ALGOLIA_KEY = "edc5435c65d771cecbd98bbd488aa8d3"
INDEX = "menu-products-production"


def emit(line: str = "") -> None:
    print(line, flush=True)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")


def main() -> int:
    emit("# Jane free-path confirmation (v2)")
    emit()

    # 1. Store directory
    r = requests.get("https://www.iheartjane.com/api/v1/stores", headers=H, timeout=60)
    stores = r.json().get("stores", [])
    emit(f"## store directory: HTTP {r.status_code}, {len(stores)} stores total")
    if stores:
        emit(f"- store record keys: {sorted(stores[0].keys())}")

    def is_ny(s: dict) -> bool:
        blob = json.dumps(s).lower()
        st = (s.get("state") or "").upper()
        return st == "NY" or st == "NEW YORK" or '"state": "ny"' in blob

    ny = [s for s in stores if is_ny(s)]
    emit(f"- NY stores: {len(ny)}")
    emit()
    emit("- first 8 NY stores (id · name · city):")
    for s in ny[:8]:
        emit(f"  - {s.get('id')} · {s.get('name')} · {s.get('city')}, {s.get('state')}")
    emit()

    # cities breakdown for NY
    from collections import Counter
    cities = Counter((s.get("city") or "?") for s in ny)
    emit(f"- NY city counts (top 15): {dict(cities.most_common(15))}")
    emit()

    if not ny:
        emit("No NY stores found; dumping a sample store record:")
        emit("```json")
        emit(json.dumps(stores[0], indent=2)[:1200] if stores else "(none)")
        emit("```")
        return 0

    # 2. Algolia products for the first NY store
    store = ny[0]
    sid = store.get("id")
    emit(f"## products for store {sid} ({store.get('name')}) via Algolia")
    url = f"https://{ALGOLIA_APP}-dsn.algolia.net/1/indexes/{INDEX}/query"
    headers = {
        "X-Algolia-Application-Id": ALGOLIA_APP,
        "X-Algolia-API-Key": ALGOLIA_KEY,
        "Content-Type": "application/json",
    }
    body = {"params": f"filters=store_id={sid}&hitsPerPage=3"}
    ar = requests.post(url, headers=headers, json=body, timeout=30)
    emit(f"- Algolia HTTP {ar.status_code}")
    try:
        aj = ar.json()
    except Exception:  # noqa: BLE001
        emit("```")
        emit(ar.text[:500])
        emit("```")
        return 0
    hits = aj.get("hits", [])
    emit(f"- nbHits={aj.get('nbHits')}, returned={len(hits)}")
    if hits:
        emit(f"- product keys: {sorted(hits[0].keys())}")
        emit("- first product:")
        emit("```json")
        emit(json.dumps(hits[0], indent=2)[:1800])
        emit("```")
    else:
        emit("- no hits; raw (first 600):")
        emit("```json")
        emit(json.dumps(aj, indent=2)[:600])
        emit("```")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
