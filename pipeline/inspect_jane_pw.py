"""Diagnostic: capture Jane's real API + working Algolia creds with Playwright.

Jane is a client-rendered SPA but NOT Cloudflare-walled, so a headless browser
on GitHub Actions can load it directly (free — no ScrapingBee). We capture every
network call to Jane's API and Algolia, so we learn:
  - the store-list/search API endpoint + shape (to enumerate NY stores),
  - the WORKING Algolia app id + search key (from the live request headers/params),
  - a product response shape.
Throwaway.
"""

from __future__ import annotations

import json
import os

from playwright.sync_api import sync_playwright

START = os.environ.get("JANE_URL", "https://www.iheartjane.com/stores")


def emit(line: str = "") -> None:
    print(line, flush=True)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")


def main() -> int:
    emit("# Jane Playwright network capture")
    emit(f"start: `{START}`")
    emit()

    calls = []  # (url, status, req_headers, body_snippet)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(locale="en-US", viewport={"width": 1280, "height": 900})
        page = ctx.new_page()

        def on_response(resp):
            url = resp.url
            if not any(h in url for h in ("iheartjane.com/api", "api.iheartjane.com",
                                          "algolia.net", "algolianet.com")):
                return
            body = ""
            try:
                if "application/json" in (resp.headers.get("content-type") or ""):
                    body = resp.text()[:600]
            except Exception:  # noqa: BLE001
                pass
            calls.append((resp.request.method, url, resp.status, dict(resp.request.headers), body))

        page.on("response", on_response)

        try:
            page.goto(START, wait_until="networkidle", timeout=45000)
        except Exception as exc:  # noqa: BLE001
            emit(f"- goto note: {exc!r}")
        page.wait_for_timeout(4000)

        # Try to trigger a location search for New York if there's a search box.
        for sel in ('input[type="search"]', 'input[placeholder*=" address" i]',
                    'input[placeholder*="location" i]', 'input[placeholder*="search" i]'):
            try:
                el = page.query_selector(sel)
                if el:
                    el.click()
                    el.type("New York, NY", delay=40)
                    page.wait_for_timeout(2500)
                    page.keyboard.press("Enter")
                    page.wait_for_timeout(4000)
                    break
            except Exception:  # noqa: BLE001
                pass

        browser.close()

    emit(f"## captured {len(calls)} API/Algolia calls")
    # Algolia calls: creds live in request headers or URL params.
    algolia = [c for c in calls if "algolia" in c[1]]
    emit(f"### Algolia calls: {len(algolia)}")
    for method, url, status, headers, body in algolia[:4]:
        appid = headers.get("x-algolia-application-id") or headers.get("X-Algolia-Application-Id")
        key = headers.get("x-algolia-api-key") or headers.get("X-Algolia-API-Key")
        emit(f"- {method} {status} {url[:90]}")
        emit(f"  - appId={appid} key={key}")
        if body:
            emit("```json")
            emit(body[:500])
            emit("```")

    jane = [c for c in calls if "algolia" not in c[1]]
    emit(f"### Jane API calls: {len(jane)}")
    for method, url, status, headers, body in jane[:15]:
        emit(f"- {method} {status} {url[:120]}")
        if body and ("store" in body.lower() or "product" in body.lower() or "menu" in body.lower()):
            emit("```json")
            emit(body[:400])
            emit("```")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
