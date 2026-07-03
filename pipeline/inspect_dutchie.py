"""Diagnostic v2: locate Dutchie's product data source.

The embedded-JSON approach is dead (products aren't in __NEXT_DATA__ or an Apollo
cache in the HTML). This probe figures out where they DO come from:
  1. Render the page and report which data-source fingerprints appear
     (self.__next_f RSC chunks, graphql/api.dutchie references, a dispensary id).
  2. Try Dutchie's consumer GraphQL directly through ScrapingBee — dispensary
     lookup by cName, then FilteredProducts — dumping raw responses (GraphQL
     errors are informative about the real schema).
Throwaway.
"""

from __future__ import annotations

import json
import os
import re

import requests

SLUG = os.environ.get("INSPECT_SLUG", "conbud-les")
CATEGORY = os.environ.get("INSPECT_CATEGORY", "Flower")
URL = f"https://dutchie.com/dispensary/{SLUG}/products/{CATEGORY.lower()}"
GRAPHQL = "https://dutchie.com/graphql"
ENDPOINT = "https://app.scrapingbee.com/api/v1/"
KEY = os.environ["SCRAPINGBEE_KEY"]


def emit(line: str = "") -> None:
    print(line, flush=True)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")


def bee_get(url: str, render: bool, premium: bool = False) -> requests.Response:
    params = {"api_key": KEY, "url": url, "render_js": "true" if render else "false", "country_code": "us"}
    if render:
        params["wait"] = "6000"
    if premium:
        params["premium_proxy"] = "true"
    return requests.get(ENDPOINT, params=params, timeout=120)


def bee_post(url: str, body: dict, premium: bool = False) -> requests.Response:
    params = {"api_key": KEY, "url": url, "render_js": "false", "country_code": "us"}
    if premium:
        params["premium_proxy"] = "true"
    # ScrapingBee forwards the POST body + content-type to the target.
    return requests.post(
        ENDPOINT, params=params, json=body,
        headers={"Content-Type": "application/json"}, timeout=120,
    )


def fingerprints(html: str) -> None:
    emit(f"- length {len(html):,}")
    needles = [
        "self.__next_f", "__APOLLO_STATE__", "apolloState", "dispensaryId",
        "/graphql", "api.dutchie.com", "operationName", "persistedQuery",
        "productsFilter", "filteredProducts", "retailerId", "cName",
    ]
    hits = {n: html.count(n) for n in needles}
    emit("- fingerprint counts: " + ", ".join(f"`{k}`={v}" for k, v in hits.items() if v))

    # Any dispensary id near the word "dispensary"/"retailer"?
    for pat in (r'"dispensaryId"\s*:\s*"?([A-Za-z0-9]{6,})"?',
                r'"retailerId"\s*:\s*"?([A-Za-z0-9-]{6,})"?',
                r'"id"\s*:\s*"([0-9a-f]{24})"'):
        m = re.search(pat, html)
        if m:
            emit(f"- id via `{pat}` -> `{m.group(1)}`")

    for needle in ("self.__next_f", '"graphql', "operationName", "dispensaryId"):
        i = html.find(needle)
        if i != -1:
            emit(f"- snippet @ `{needle}`:")
            emit("```")
            emit(html[i: i + 500].replace("```", "``"))
            emit("```")


def try_graphql() -> None:
    emit("## GraphQL probes")

    # Candidate dispensary lookups — dump whatever comes back.
    dispensary_queries = [
        {
            "operationName": "ConsumerDispensary",
            "variables": {"dispensaryFilter": {"cNameOrID": SLUG}},
            "query": "query ConsumerDispensary($dispensaryFilter: DispensaryFilter) { filteredDispensaries(dispensaryFilter: $dispensaryFilter) { id cName name } }",
        },
        {
            "operationName": "DispensaryByCNAME",
            "variables": {"cName": SLUG},
            "query": "query DispensaryByCNAME($cName: String!) { dispensaryByCNAME(cName: $cName) { id name cName } }",
        },
    ]
    for i, q in enumerate(dispensary_queries):
        for premium in (False, True):
            tag = f"dispensary#{i} premium={premium}"
            try:
                r = bee_post(GRAPHQL, q, premium=premium)
                emit(f"- {tag}: HTTP {r.status_code}, {len(r.text)} bytes")
                emit("```")
                emit(r.text[:700].replace("```", "``"))
                emit("```")
                if r.status_code == 200 and '"data"' in r.text and "null" not in r.text[:60]:
                    return  # got something useful; stop burning credits
            except Exception as exc:  # noqa: BLE001
                emit(f"- {tag}: error `{exc!r}`")


def main() -> int:
    emit("# Dutchie data-source inspection v2")
    emit(f"URL: `{URL}`  ·  slug: `{SLUG}`  ·  category: `{CATEGORY}`")
    emit()
    emit("## rendered page fingerprints")
    try:
        r = bee_get(URL, render=True)
        fingerprints(r.text)
    except Exception as exc:  # noqa: BLE001
        emit(f"- render fetch error: `{exc!r}`")
    emit()
    try_graphql()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
