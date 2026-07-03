"""Diagnostic v4: broad Jane discovery — real store ids, product endpoints, and
the true Algolia config from a store menu page.

All free (Jane is not Cloudflare-walled for its first-party API; public repo =
free Actions). Casts a wide net in one run to minimize iterations.
"""

from __future__ import annotations

import json
import os
import re
from urllib.parse import urlencode

import requests

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
H = {"User-Agent": UA, "Accept": "application/json, text/html;q=0.9,*/*;q=0.8",
     "Accept-Language": "en-US,en;q=0.9"}


def emit(line: str = "") -> None:
    print(line, flush=True)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")


def g(url, **kw):
    try:
        return requests.get(url, headers=H, timeout=30, **kw)
    except Exception as exc:  # noqa: BLE001
        return exc


def brief(label, r, n=350):
    if isinstance(r, Exception):
        emit(f"- {label}: ERR {r!r}")
        return
    ct = r.headers.get("content-type", "")
    emit(f"- {label}: {r.status_code} · {ct[:30]} · {len(r.text)}b")
    emit("```")
    emit(r.text[:n].replace("```", "``"))
    emit("```")


def main() -> int:
    emit("# Jane discovery v4")
    emit()

    # 1. Full store records from /api/v1/stores
    emit("## 1. store records (full)")
    r = g("https://www.iheartjane.com/api/v1/stores?per_page=2")
    store_id = store_slug = None
    if isinstance(r, requests.Response) and r.status_code == 200:
        try:
            js = r.json()
            stores = js.get("stores") if isinstance(js, dict) else js
            emit(f"- top-level keys: {list(js.keys()) if isinstance(js, dict) else 'list'}")
            emit(f"- store count: {len(stores)}")
            for i, s in enumerate(stores[:2]):
                emit(f"- store[{i}] keys: {sorted(s.keys())}")
                emit("```json")
                emit(json.dumps(s, indent=1)[:1200])
                emit("```")
                if not store_id and s.get("id"):
                    store_id, store_slug = s.get("id"), s.get("url_slug") or s.get("slug")
        except Exception as exc:  # noqa: BLE001
            emit(f"- parse error: {exc!r}; head: {r.text[:200]}")
    emit(f"- picked store_id={store_id} slug={store_slug}")
    emit()

    # 2. NY directory page to get a real NY store id + slug
    emit("## 2. NY directory")
    for u in ("https://www.iheartjane.com/dispensaries/new-york",
              "https://www.iheartjane.com/stores?state=NY",
              "https://www.iheartjane.com/embed/stores"):
        rr = g(u)
        if isinstance(rr, requests.Response):
            emit(f"- {u}: {rr.status_code} ({len(rr.text)}b)")
            m = re.findall(r'/stores/(\d+)/([a-z0-9-]+)', rr.text)
            if m:
                emit(f"  - store links found: {m[:5]}")
                if not store_id:
                    store_id, store_slug = m[0]
    emit(f"- store_id now={store_id} slug={store_slug}")
    emit()

    # 3. First-party product endpoints for that store
    emit("## 3. product endpoints")
    if store_id:
        for u in (
            f"https://www.iheartjane.com/api/v1/stores/{store_id}",
            f"https://www.iheartjane.com/api/v1/stores/{store_id}/menu_products?per_page=2",
            f"https://www.iheartjane.com/api/v1/menu_products?store_id={store_id}&per_page=2",
            f"https://www.iheartjane.com/api/v1/stores/{store_id}/products?per_page=2",
        ):
            brief(u.replace("https://www.iheartjane.com", ""), g(u), n=300)
    emit()

    # 4. True Algolia config from a store menu page
    emit("## 4. algolia config from store menu page")
    if store_id:
        menu = g(f"https://www.iheartjane.com/stores/{store_id}/{store_slug or 'x'}/menu")
        if isinstance(menu, requests.Response):
            emit(f"- menu page: {menu.status_code} ({len(menu.text)}b)")
            t = menu.text
            app = re.search(r'[Aa]lgolia[_A-Za-z]*[Aa]pp[_A-Za-z]*[Ii]d["\':= ]+([A-Z0-9]{8,12})', t)
            key = re.search(r'[Aa]lgolia[_A-Za-z]*(?:[Aa]pi)?[_A-Za-z]*[Kk]ey["\':= ]+([a-f0-9]{20,40})', t)
            idx = re.search(r'(menu-products[-a-z]*)', t)
            emit(f"  - appId={app.group(1) if app else '—'} key={key.group(1) if key else '—'} index={idx.group(1) if idx else '—'}")
            # try Algolia with query-param auth
            if app and key:
                a, k = app.group(1), key.group(1)
                index = idx.group(1) if idx else "menu-products-production"
                url = f"https://{a}-dsn.algolia.net/1/indexes/{index}/query"
                params = {"x-algolia-application-id": a, "x-algolia-api-key": k}
                ar = requests.post(url + "?" + urlencode(params),
                                   json={"params": urlencode({"hitsPerPage": 1, "filters": f"store_id={store_id}"})},
                                   headers={"Content-Type": "application/json"}, timeout=30)
                emit(f"  - Algolia query: HTTP {ar.status_code}")
                emit("```json")
                emit(ar.text[:900])
                emit("```")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
