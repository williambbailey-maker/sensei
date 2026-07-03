"""Diagnostic v4: confirm the corrected Dutchie FilteredProducts query.

Schema learned from v3's GraphQL errors: argument is `filter:`, input type is
`ProductFilterInput`, product type is `Products`. The GraphQL endpoint is behind
Cloudflare and challenges intermittently, so retry on 403. Dumps a full product
so the real field formats (Options/Prices/THCContent/Image) are visible before
the adapter is rebuilt. Throwaway.
"""

from __future__ import annotations

import json
import os
import time

import requests

DISPENSARY_ID = os.environ.get("INSPECT_DISP_ID", "6430f42042cf3c004e37f0f8")
CATEGORY = os.environ.get("INSPECT_CATEGORY", "Flower")
ENDPOINT = "https://app.scrapingbee.com/api/v1/"
GRAPHQL = "https://dutchie.com/graphql"
KEY = os.environ["SCRAPINGBEE_KEY"]

PRODUCT_FIELDS = (
    "id cName brandName brand { name } Name Options Prices type strainType "
    "THCContent { unit range } CBDContent { unit range } Image effects"
)

QUERY = (
    "query FilteredProducts($productsFilter: ProductFilterInput!, $page: Int!, $perPage: Int!) { "
    "filteredProducts(filter: $productsFilter, page: $page, perPage: $perPage) { "
    "products { __FIELDS__ } queryInfo { totalCount totalPages } } }"
).replace("__FIELDS__", PRODUCT_FIELDS)


def emit(line: str = "") -> None:
    print(line, flush=True)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")


def graphql(body: dict, tries: int = 6) -> requests.Response:
    params = {
        "api_key": KEY,
        "url": GRAPHQL,
        "render_js": "false",
        "country_code": "us",
        "transparent_status_code": "true",
    }
    last = None
    for i in range(tries):
        r = requests.post(
            ENDPOINT, params=params, json=body,
            headers={"Content-Type": "application/json"}, timeout=90,
        )
        last = r
        if r.status_code != 403:  # 403 = intermittent Cloudflare challenge; retry
            return r
        time.sleep(2 + i)
    return last


def main() -> int:
    emit("# Dutchie FilteredProducts confirm (v4)")
    emit(f"dispensaryId `{DISPENSARY_ID}` · category `{CATEGORY}`")
    emit()
    body = {
        "operationName": "FilteredProducts",
        "variables": {
            "productsFilter": {
                "dispensaryId": DISPENSARY_ID,
                "Status": "Active",
                "types": [CATEGORY],
                "sortDirection": 1,
                "isDefaultSort": True,
                "bypassOnlineThresholds": False,
            },
            "page": 0,
            "perPage": 30,
        },
        "query": QUERY,
    }
    r = graphql(body)
    emit(f"- HTTP {r.status_code}, {len(r.text)} bytes")
    try:
        data = json.loads(r.text)
    except json.JSONDecodeError:
        emit("- non-JSON (likely Cloudflare); first 600 bytes:")
        emit("```")
        emit(r.text[:600])
        emit("```")
        return 0

    if "errors" in data:
        emit("- GraphQL errors:")
        emit("```json")
        emit(json.dumps(data["errors"], indent=2)[:1500])
        emit("```")
        return 0

    fp = (data.get("data") or {}).get("filteredProducts") or {}
    prods = fp.get("products") or []
    emit(f"- ✅ queryInfo={fp.get('queryInfo')}; products in page: {len(prods)}")
    if prods:
        emit("- first product (real field shapes):")
        emit("```json")
        emit(json.dumps(prods[0], indent=2)[:1800])
        emit("```")
        emit("- second product Options/Prices:")
        if len(prods) > 1:
            p = prods[1]
            emit(f"  Options={p.get('Options')} Prices={p.get('Prices')} THCContent={p.get('THCContent')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
