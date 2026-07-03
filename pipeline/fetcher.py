"""Fetch Dutchie pages through the ScrapingBee unblocker.

M0 proved hosted GitHub Actions runners are Cloudflare-blocked at Dutchie, and
that ScrapingBee gets through. All page fetches go through it.

Credit awareness: a render_js=true call costs ~5 ScrapingBee credits, a plain
call ~1. Dutchie embeds its product JSON in __NEXT_DATA__ server-side, so the
plain call may be enough. The fetcher auto-detects on the first fetch of a run:
try without JS rendering; if the page lacks the embedded JSON, retry with
rendering and remember that choice for the rest of the run.
"""

from __future__ import annotations

import os
import time

import requests

SCRAPINGBEE_ENDPOINT = "https://app.scrapingbee.com/api/v1/"

SUCCESS_MARKERS = ("__NEXT_DATA__", "__APOLLO_STATE__", "apolloState", "ROOT_QUERY")


class FetchError(Exception):
    pass


class Fetcher:
    def __init__(self, api_key: str | None = None):
        self.api_key = (api_key or os.environ.get("SCRAPINGBEE_KEY", "")).strip()
        if not self.api_key:
            raise FetchError("SCRAPINGBEE_KEY is not set")
        # None = undetermined; False/True once the first fetch decides.
        self.render_js: bool | None = None
        self.requests_made = 0
        self.credits_estimate = 0

    def _call(self, url: str, render: bool) -> requests.Response:
        params = {
            "api_key": self.api_key,
            "url": url,
            "render_js": "true" if render else "false",
            "country_code": "us",
        }
        self.requests_made += 1
        self.credits_estimate += 5 if render else 1
        return requests.get(SCRAPINGBEE_ENDPOINT, params=params, timeout=120)

    @staticmethod
    def _has_product_json(html: str) -> bool:
        return any(m in html for m in SUCCESS_MARKERS)

    def fetch(self, url: str, retries: int = 2) -> str:
        """Return page HTML containing the embedded product JSON, or raise."""
        last_err: str = ""
        for attempt in range(retries + 1):
            if attempt:
                time.sleep(5 * attempt)
            try:
                if self.render_js is None:
                    # Detection fetch: cheap mode first.
                    resp = self._call(url, render=False)
                    if resp.status_code == 200 and self._has_product_json(resp.text):
                        self.render_js = False
                        return resp.text
                    resp = self._call(url, render=True)
                    if resp.status_code == 200 and self._has_product_json(resp.text):
                        self.render_js = True
                        return resp.text
                    last_err = f"detection failed: HTTP {resp.status_code}"
                    continue

                resp = self._call(url, render=self.render_js)
                if resp.status_code == 200 and self._has_product_json(resp.text):
                    return resp.text
                last_err = f"HTTP {resp.status_code}, json_markers={self._has_product_json(resp.text)}"
            except requests.RequestException as exc:
                last_err = repr(exc)
        raise FetchError(f"fetch failed for {url}: {last_err}")
