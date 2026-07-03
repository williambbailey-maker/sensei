"""Diagnostic v3: query Jane's Algolia products index directly.

The /api/v1/stores list is sparse. Better: Jane's `menu-products-production`
Algolia index carries store info on each product, so we can query NY products
directly and enumerate NY stores from facets. This confirms the free
comprehensive path and reveals the real field names. Throwaway.
"""

from __future__ import annotations

import json
import os
from urllib.parse import urlencode

import requests

APP = "VFM4X0N23A"
KEY = "edc5435c65d771cecbd98bbd488aa8d3"
INDEX = "menu-products-production"
URL = f"https://{APP}-dsn.algolia.net/1/indexes/{INDEX}/query"
HEAD = {"X-Algolia-Application-Id": APP, "X-Algolia-API-Key": KEY, "Content-Type": "application/json"}


def emit(line: str = "") -> None:
    print(line, flush=True)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")


def query(params: dict) -> dict:
    r = requests.post(URL, headers=HEAD, json={"params": urlencode(params)}, timeout=30)
    emit(f"  (HTTP {r.status_code})")
    return r.json()


def main() -> int:
    emit("# Jane Algolia products probe (v3)")
    emit()

    # 1. Unfiltered: total index size, one product's full shape, facetable fields.
    emit("## 1. index overview")
    d = query({"hitsPerPage": 1, "facets": '["*"]'})
    emit(f"- total products in index (network-wide): nbHits={d.get('nbHits')}")
    facets = d.get("facets") or {}
    emit(f"- facetable fields: {sorted(facets.keys())}")
    hits = d.get("hits") or []
    if hits:
        emit(f"- product field keys: {sorted(hits[0].keys())}")
        emit("- sample product:")
        emit("```json")
        emit(json.dumps(hits[0], indent=2)[:2000])
        emit("```")
    emit()

    # 2. Figure out the state facet field + NY value, then count NY + enumerate stores.
    state_field = None
    for cand in ("state", "store_state", "root_types", "state_code"):
        if cand in facets:
            state_field = cand
            emit(f"- state facet `{cand}` values (sample): {dict(list(facets[cand].items())[:8])}")
    emit()

    emit("## 2. NY coverage")
    for val in ("NY", "New York", "new york"):
        if not state_field:
            break
        d2 = query({
            "hitsPerPage": 1,
            "facetFilters": json.dumps([[f"{state_field}:{val}"]]),
            "facets": '["store_id","store_name","store_city","city"]',
            "maxValuesPerFacet": 1000,
        })
        nb = d2.get("nbHits")
        emit(f"- filter `{state_field}={val}` -> nbHits={nb}")
        if nb:
            f2 = d2.get("facets") or {}
            store_names = f2.get("store_name") or {}
            store_ids = f2.get("store_id") or {}
            emit(f"  - distinct NY stores: by store_name={len(store_names)}, by store_id={len(store_ids)}")
            emit(f"  - sample store_name facet: {dict(list(store_names.items())[:12])}")
            break
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
