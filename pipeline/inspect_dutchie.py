"""Diagnostic v6: capture Dutchie's real product API call via ScrapingBee XHR.

Introspection is off and type suggestions are hidden, so stop guessing: render
the category page with json_response=true and inspect the captured XHR/fetch
calls. The GraphQL request Dutchie's own frontend makes contains the exact
operation, input type, and variables; its response contains the product JSON.
Dump both. Throwaway.
"""

from __future__ import annotations

import json
import os

import requests

SLUG = os.environ.get("INSPECT_SLUG", "conbud-les")
CATEGORY = os.environ.get("INSPECT_CATEGORY", "flower")
URL = f"https://dutchie.com/dispensary/{SLUG}/products/{CATEGORY}"
ENDPOINT = "https://app.scrapingbee.com/api/v1/"
KEY = os.environ["SCRAPINGBEE_KEY"]


def emit(line: str = "") -> None:
    print(line, flush=True)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")


def main() -> int:
    emit("# Dutchie XHR capture (v6)")
    emit(f"URL `{URL}`")
    emit()
    params = {
        "api_key": KEY,
        "url": URL,
        "render_js": "true",
        "json_response": "true",
        "country_code": "us",
        "wait": "8000",
    }
    r = requests.get(ENDPOINT, params=params, timeout=180)
    emit(f"- HTTP {r.status_code}, {len(r.text):,} bytes")
    try:
        data = json.loads(r.text)
    except json.JSONDecodeError:
        emit("- not JSON; first 500 bytes:")
        emit("```")
        emit(r.text[:500])
        emit("```")
        return 0

    emit(f"- json_response keys: {list(data.keys())}")
    xhr = data.get("xhr") or []
    emit(f"- captured xhr calls: {len(xhr)}")

    gql_calls = [x for x in xhr if "graphql" in (x.get("url") or "").lower()]
    emit(f"- graphql xhr calls: {len(gql_calls)}")

    for i, x in enumerate(gql_calls[:6]):
        emit(f"### graphql xhr #{i}: {x.get('method')} status={x.get('status')}")
        # Request payload — the exact query + variables + input type.
        for key in ("post_data", "postData", "body_sent", "request_body"):
            if x.get(key):
                emit(f"- request `{key}` (first 900 chars):")
                emit("```json")
                emit(str(x[key])[:900])
                emit("```")
                break
        # Response body — product JSON.
        body = x.get("body") or x.get("response_body") or ""
        if body:
            has_products = '"products"' in body or '"Products"' in body
            emit(f"- response {len(body)} bytes, has products: {has_products}")
            emit("```json")
            emit(body[:900])
            emit("```")

    if not gql_calls and xhr:
        emit("- xhr URLs seen (first 20):")
        for x in xhr[:20]:
            emit(f"  - {x.get('method')} {x.get('status')} {(x.get('url') or '')[:120]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
