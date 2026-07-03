"""Diagnostic: where does a Dutchie category page keep its product data?

Fetches one page via ScrapingBee with render_js off AND on, and reports for each:
status, HTML length, presence of __NEXT_DATA__ / __APOLLO_STATE__, the counts of
each __typename value, and a snippet around the first product-ish node. Output
goes to the job summary. Throwaway once the parser is settled.
"""

from __future__ import annotations

import json
import os
import re
from collections import Counter

import requests

URL = os.environ.get(
    "INSPECT_URL", "https://dutchie.com/dispensary/conbud-les/products/flower"
)
ENDPOINT = "https://app.scrapingbee.com/api/v1/"
KEY = os.environ["SCRAPINGBEE_KEY"]

NEXT_RE = re.compile(r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.DOTALL)
APOLLO_RE = re.compile(r'window\.__APOLLO_STATE__\s*=\s*(\{.*?\});?</script>', re.DOTALL)


def emit(line: str = "") -> None:
    print(line, flush=True)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")


def typename_counts(html: str) -> Counter:
    return Counter(re.findall(r'"__typename"\s*:\s*"([^"]+)"', html))


def fetch(render: bool):
    params = {"api_key": KEY, "url": URL, "render_js": "true" if render else "false", "country_code": "us"}
    if render:
        # Wait for client-side product queries to resolve.
        params["wait"] = "5000"
    r = requests.get(ENDPOINT, params=params, timeout=120)
    return r


def report(render: bool):
    label = f"render_js={'true' if render else 'false'}"
    emit(f"## {label}")
    try:
        r = fetch(render)
    except Exception as exc:  # noqa: BLE001
        emit(f"- fetch error: `{exc!r}`")
        emit()
        return
    html = r.text
    emit(f"- HTTP {r.status_code}, length {len(html):,}")
    emit(f"- `__NEXT_DATA__` present: {bool(NEXT_RE.search(html))}")
    emit(f"- `window.__APOLLO_STATE__` present: {bool(APOLLO_RE.search(html))}")

    tn = typename_counts(html)
    emit(f"- distinct __typename count: {len(tn)}; Product nodes: {tn.get('Product', 0)}")
    if tn:
        top = ", ".join(f"{k}={v}" for k, v in tn.most_common(15))
        emit(f"- top __typename: {top}")

    # If NEXT_DATA parses, show its top-level shape and whether products live in it.
    m = NEXT_RE.search(html)
    if m:
        try:
            nd = json.loads(m.group(1))
            pp = nd.get("props", {}).get("pageProps", {})
            emit(f"- __NEXT_DATA__ props.pageProps keys: {list(pp.keys())[:25]}")
            emit(f"- Product nodes inside __NEXT_DATA__: {typename_counts(json.dumps(nd)).get('Product', 0)}")
        except Exception as exc:  # noqa: BLE001
            emit(f"- __NEXT_DATA__ JSON parse error: `{exc!r}`")

    # Snippet around the first Product node, if any.
    idx = html.find('"__typename":"Product"')
    if idx == -1:
        idx = html.find('"__typename": "Product"')
    if idx != -1:
        emit("- snippet around first Product node:")
        emit("```json")
        emit(html[max(0, idx - 200): idx + 900])
        emit("```")
    emit()


def main() -> int:
    emit("# Dutchie page structure inspection")
    emit(f"URL: `{URL}`")
    emit()
    report(render=False)
    report(render=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
