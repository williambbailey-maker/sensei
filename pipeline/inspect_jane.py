"""Diagnostic: is I Heart Jane free-reachable from GitHub Actions, and what
product data does it expose?

Jane menus are backed by Algolia (a CDN search API), which is not Cloudflare-
walled — so a datacenter runner should reach it directly with plain requests,
no unblocker, $0. This probe:
  1. tests reachability of iheartjane.com from the Actions runner,
  2. hits candidate Jane store-discovery endpoints (find NYC stores + ids),
  3. extracts the public Algolia app id + search key from a store page,
  4. queries Algolia for one store's products and dumps the shape.
Throwaway.
"""

from __future__ import annotations

import json
import os
import re

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


def get(url, **kw):
    try:
        r = requests.get(url, headers=H, timeout=30, **kw)
        return r
    except Exception as exc:  # noqa: BLE001
        return exc


def show(label, r, n=400):
    if isinstance(r, Exception):
        emit(f"- {label}: ERROR `{r!r}`")
        return None
    ctype = r.headers.get("content-type", "")
    emit(f"- {label}: HTTP {r.status_code} · {ctype} · {len(r.text)} bytes")
    body = r.text[:n].replace("```", "``")
    emit("```")
    emit(body)
    emit("```")
    return r


def main() -> int:
    emit("# I Heart Jane reachability + data probe")
    emit()

    emit("## 1. reachability (direct, no unblocker)")
    show("GET iheartjane.com", get("https://www.iheartjane.com/"), n=200)
    emit()

    emit("## 2. store discovery candidates")
    candidates = [
        "https://www.iheartjane.com/api/v1/stores?per_page=3",
        "https://api.iheartjane.com/v1/stores?per_page=3",
        "https://www.iheartjane.com/api/v1/stores/search?query=New%20York&per_page=3",
        "https://www.iheartjane.com/api/v2/stores?per_page=3",
    ]
    reachable_store = None
    for u in candidates:
        r = show(u.replace("https://", ""), get(u), n=500)
        if isinstance(r, requests.Response) and r.status_code == 200 and "json" in r.headers.get("content-type", ""):
            try:
                j = r.json()
                # try to pull a store id
                for path in (("stores", 0, "id"), ("data", 0, "id"), (0, "id")):
                    cur = j
                    ok = True
                    for k in path:
                        cur = cur[k] if (isinstance(cur, list) or isinstance(cur, dict)) else None
                        if cur is None:
                            ok = False
                            break
                    if ok:
                        reachable_store = cur
                        emit(f"  -> found store id: {cur}")
                        break
            except Exception:  # noqa: BLE001
                pass
        emit()

    emit("## 3. algolia credentials from a store page")
    # Try the storefront to extract Algolia app id + search key + index.
    page = get("https://www.iheartjane.com/stores")
    if isinstance(page, requests.Response):
        emit(f"- /stores: HTTP {page.status_code}, {len(page.text)} bytes")
        for pat, name in [
            (r'"?algoliaAppId"?\s*[:=]\s*"([A-Z0-9]{6,})"', "algoliaAppId"),
            (r'"?algoliaApiKey"?\s*[:=]\s*"([a-z0-9]{16,})"', "algoliaApiKey"),
            (r'application[_-]?id["\']?\s*[:=]\s*["\']([A-Z0-9]{6,})', "appId(alt)"),
            (r'(menu-products-production|menu-products)', "index"),
            (r'algolianet\.com', "algolia-host-ref"),
        ]:
            m = re.search(pat, page.text)
            emit(f"  - {name}: {m.group(1) if m else '—'}")
    emit()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
