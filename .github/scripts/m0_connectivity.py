#!/usr/bin/env python3
"""Milestone 0 connectivity probe for Dutchie.

Tries a plain `requests` GET first; if that looks blocked, falls back to
Playwright headless Chromium. Classifies each attempt as OK (embedded product
JSON present) or BLOCKED (challenge / bot-wall / hard error), dumps the first
2KB of HTML from whichever method we relied on, and reports:

    METHOD_THAT_WORKED = requests | playwright | BLOCKED

to the GitHub Actions job summary.
"""

from __future__ import annotations

import os
import sys

TARGET_URL = os.environ.get(
    "TARGET_URL",
    "https://dutchie.com/dispensary/conbud-les/products/flower",
)

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)

BROWSER_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,image/apng,*/*;q=0.8"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Sec-CH-UA": '"Chromium";v="125", "Google Chrome";v="125", "Not.A/Brand";v="24"',
    "Sec-CH-UA-Mobile": "?0",
    "Sec-CH-UA-Platform": '"Windows"',
    "Connection": "keep-alive",
}

# Signals that the page carries Dutchie's embedded structured product data.
SUCCESS_MARKERS = (
    "__NEXT_DATA__",
    "__APOLLO_STATE__",
    "apolloState",
    "ROOT_QUERY",
)

# Signals of a bot-wall / challenge / hard block.
BLOCK_MARKERS = (
    "just a moment",
    "challenge-platform",
    "cf-browser-verification",
    "cf-chl",
    "_cf_chl",
    "attention required",
    "cloudflare",
    "px-captcha",
    "perimeterx",
    "_pxhd",
    "access denied",
    "request blocked",
    "are you a robot",
    "captcha",
)

BLOCK_STATUS = {401, 403, 405, 406, 429, 503}


def classify(status: int | None, html: str) -> str:
    """Return 'OK', 'BLOCKED', or 'UNKNOWN' for a fetched page."""
    lower = (html or "").lower()

    if status in BLOCK_STATUS:
        return "BLOCKED"
    if any(marker in lower for marker in BLOCK_MARKERS):
        return "BLOCKED"
    if any(marker.lower() in lower for marker in SUCCESS_MARKERS):
        return "OK"
    return "UNKNOWN"


def first_2kb(html: str) -> str:
    return (html or "")[:2048]


def try_requests() -> tuple[str, int | None, str]:
    """Return (verdict, status, html)."""
    import requests

    try:
        resp = requests.get(
            TARGET_URL,
            headers=BROWSER_HEADERS,
            timeout=30,
            allow_redirects=True,
        )
    except Exception as exc:  # noqa: BLE001 - report any failure, don't crash the gate
        return "ERROR", None, f"requests raised: {exc!r}"

    return classify(resp.status_code, resp.text), resp.status_code, resp.text


def try_playwright() -> tuple[str, int | None, str]:
    """Return (verdict, status, html)."""
    try:
        from playwright.sync_api import sync_playwright
    except Exception as exc:  # noqa: BLE001
        return "ERROR", None, f"playwright import failed: {exc!r}"

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=USER_AGENT,
                locale="en-US",
                viewport={"width": 1280, "height": 800},
            )
            page = context.new_page()
            response = page.goto(TARGET_URL, wait_until="domcontentloaded", timeout=45000)
            # Give client-side hydration / challenge scripts a beat to settle.
            page.wait_for_timeout(4000)
            status = response.status if response else None
            html = page.content()
            browser.close()
    except Exception as exc:  # noqa: BLE001
        return "ERROR", None, f"playwright raised: {exc!r}"

    return classify(status, html), status, html


def emit(line: str = "") -> None:
    """Print to the job log and append to the step summary."""
    print(line)
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")


def main() -> int:
    emit("# Milestone 0 — Dutchie connectivity")
    emit()
    emit(f"**Target URL:** `{TARGET_URL}`")
    emit()

    # --- Attempt 1: plain requests ---------------------------------------
    req_verdict, req_status, req_html = try_requests()
    print(f"[requests] verdict={req_verdict} status={req_status}")

    method = None
    used_html = req_html
    used_status = req_status
    used_label = "requests"

    if req_verdict == "OK":
        method = "requests"
    else:
        # --- Attempt 2: Playwright fallback ------------------------------
        print("[requests] not usable — falling back to Playwright")
        pw_verdict, pw_status, pw_html = try_playwright()
        print(f"[playwright] verdict={pw_verdict} status={pw_status}")

        if pw_verdict == "OK":
            method = "playwright"
        else:
            method = "BLOCKED"

        # Report the fallback attempt's HTML — it's the more informative one.
        used_html = pw_html
        used_status = pw_status
        used_label = "playwright"

    # --- Report ----------------------------------------------------------
    emit(f"## METHOD_THAT_WORKED = {method}")
    emit()
    emit("| Attempt | Verdict | HTTP status |")
    emit("| --- | --- | --- |")
    emit(f"| requests | {req_verdict} | {req_status} |")
    if method != "requests":
        # pw_* exist in this branch
        emit(f"| playwright | {pw_verdict} | {pw_status} |")
    emit()

    if method == "requests":
        emit("✅ **`requests` works** — best case. The pipeline can be fast and simple.")
    elif method == "playwright":
        emit("🟡 **Only `playwright` works** — fine, jobs will be slightly slower.")
    else:
        emit(
            "🛑 **BLOCKED** — both methods failed. STOP. Do not build the pipeline on "
            "an unverified foundation. Options to discuss with William: rotating "
            "residential proxy (~$5–10/mo via a proxy env secret), or a different runner."
        )
    emit()

    # --- First 2KB of HTML, either way -----------------------------------
    emit(f"### First 2KB of HTML (from `{used_label}`, HTTP {used_status})")
    emit()
    emit("```html")
    emit(first_2kb(used_html))
    emit("```")

    # Also dump to the raw log for easy copy/paste.
    print("\n" + "=" * 72)
    print(f"FIRST 2KB OF HTML (from {used_label}, HTTP {used_status}):")
    print("=" * 72)
    print(first_2kb(used_html))
    print("=" * 72)
    print(f"METHOD_THAT_WORKED = {method}")

    # Milestone 0 is a diagnostic gate: surface the result, but don't fail the
    # job on BLOCKED — the summary is the deliverable a human reads from a phone.
    return 0


if __name__ == "__main__":
    sys.exit(main())
