"""Diagnostic v3: nail Dutchie's GraphQL query shape.

We have a real dispensaryId and confirmed dutchie.com/graphql is reachable via
ScrapingBee (it returned 400 to a malformed query). This probe uses
transparent_status_code so ScrapingBee passes Dutchie's ACTUAL response body
through (GraphQL errors name the correct fields), tries the canonical
FilteredProducts query against both hosts, and dumps the raw response.
Throwaway.
"""

from __future__ import annotations

import json
import os

import requests

DISPENSARY_ID = os.environ.get("INSPECT_DISP_ID", "6430f42042cf3c004e37f0f8")
CATEGORY = os.environ.get("INSPECT_CATEGORY", "Flower")
ENDPOINT = "https://app.scrapingbee.com/api/v1/"
KEY = os.environ["SCRAPINGBEE_KEY"]

HOSTS = ["https://dutchie.com/graphql", "https://api.dutchie.com/graphql"]

PRODUCT_FIELDS = (
    "id cName brandName Name Options Prices recPrices medPrices type strainType "
    "THCContent { unit range } CBDContent { unit range } Image"
)

_Q0 = (
    "query FilteredProducts($productsFilter: ProductFilterInput!, $page: Int!, $perPage: Int!) { "
    "filteredProducts(filter: $productsFilter, page: $page, perPage: $perPage) { "
    "products { __FIELDS__ } queryInfo { totalCount totalPages } } }"
).replace("__FIELDS__", PRODUCT_FIELDS)

_Q1 = (
    "query FilteredProducts($dispensaryFilter: ProductsFilterInput!, $page: Int, $perPage: Int) { "
    "filteredProducts(productsFilter: $dispensaryFilter, page: $page, perPage: $perPage) { "
    "products { __FIELDS__ } queryInfo { totalCount } } }"
).replace("__FIELDS__", PRODUCT_FIELDS)

# Two candidate query shapes — the filter arg name differs across schema versions.
QUERIES = [
    {
        "operationName": "FilteredProducts",
        "variables": {
            "productsFilter": {
                "dispensaryId": DISPENSARY_ID,
                "Status": "Active",
                "types": [CATEGORY],
                "useCache": False,
                "sortDirection": 1,
                "isDefaultSort": True,
                "bypassOnlineThresholds": False,
            },
            "page": 0,
            "perPage": 50,
        },
        "query": _Q0,
    },
    {
        "operationName": "FilteredProducts",
        "variables": {
            "dispensaryFilter": {
                "dispensaryId": DISPENSARY_ID,
                "Status": "Active",
                "types": [CATEGORY],
                "sortDirection": 1,
            },
            "page": 0,
            "perPage": 50,
        },
        "query": _Q1,
    },
]


def emit(line: str = "") -> None:
    print(line, flush=True)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")


def bee_post(url: str, body: dict) -> requests.Response:
    params = {
        "api_key": KEY,
        "url": url,
        "render_js": "false",
        "country_code": "us",
        "transparent_status_code": "true",  # pass Dutchie's real status/body through
        "forward_headers": "true",
    }
    return requests.post(
        ENDPOINT,
        params=params,
        json=body,
        headers={
            "Content-Type": "application/json",
            "Spb-Origin": "https://dutchie.com",
            "Spb-Referer": "https://dutchie.com/",
        },
        timeout=90,
    )


def main() -> int:
    emit("# Dutchie GraphQL probe v3")
    emit(f"dispensaryId: `{DISPENSARY_ID}` · category: `{CATEGORY}`")
    emit()
    for host in HOSTS:
        for i, q in enumerate(QUERIES):
            emit(f"## {host}  ·  query#{i} (filter var: {list(q['variables'])[0]})")
            try:
                r = bee_post(host, q)
                emit(f"- HTTP {r.status_code}, {len(r.text)} bytes")
                body = r.text
                # If it's JSON, pretty-trim; else raw.
                try:
                    parsed = json.loads(body)
                    if "data" in parsed and parsed.get("data", {}).get("filteredProducts"):
                        fp = parsed["data"]["filteredProducts"]
                        prods = fp.get("products") or []
                        emit(f"- ✅ products returned: {len(prods)}; queryInfo={fp.get('queryInfo')}")
                        emit("```json")
                        emit(json.dumps(prods[0], indent=2)[:1500] if prods else "(empty)")
                        emit("```")
                        return 0
                    emit("```json")
                    emit(json.dumps(parsed, indent=2)[:1200])
                    emit("```")
                except json.JSONDecodeError:
                    emit("```")
                    emit(body[:1000])
                    emit("```")
            except Exception as exc:  # noqa: BLE001
                emit(f"- error `{exc!r}`")
            emit()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
